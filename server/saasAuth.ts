import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { eq, and } from "drizzle-orm";
import { crmUsers, tenants, subscriptions } from "../drizzle/schema";
import { getDb } from "./db";

const JWT_SECRET_KEY = () => new TextEncoder().encode(process.env.JWT_SECRET ?? "saas-secret");
const SAAS_COOKIE = "entur_saas_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ═══════════════════════════════════════
// PASSWORD HELPERS
// ═══════════════════════════════════════

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ═══════════════════════════════════════
// JWT SESSION
// ═══════════════════════════════════════

export interface SaasSessionPayload {
  userId: number;
  tenantId: number;
  email: string;
  name: string;
  role: string;
}

export async function createSaasSessionToken(payload: SaasSessionPayload): Promise<string> {
  const issuedAt = Date.now();
  const expirationSeconds = Math.floor((issuedAt + SESSION_DURATION_MS) / 1000);
  return new SignJWT({
    userId: payload.userId,
    tenantId: payload.tenantId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    type: "saas",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(JWT_SECRET_KEY());
}

export async function verifySaasSession(token: string | undefined | null): Promise<SaasSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY(), { algorithms: ["HS256"] });
    if (payload.type !== "saas") return null;
    return {
      userId: payload.userId as number,
      tenantId: payload.tenantId as number,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

export { SAAS_COOKIE, SESSION_DURATION_MS };

// ═══════════════════════════════════════
// REGISTRATION
// ═══════════════════════════════════════

export async function registerTenantAndUser(data: {
  companyName: string;
  userName: string;
  email: string;
  password: string;
  phone?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if email already exists
  const existing = await db.select().from(crmUsers).where(eq(crmUsers.email, data.email)).limit(1);
  if (existing.length > 0) {
    throw new Error("EMAIL_EXISTS");
  }

  // Create tenant
  const slug = data.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 64);
  const freemiumDays = 365;
  const freemiumExpiresAt = new Date(Date.now() + freemiumDays * 24 * 60 * 60 * 1000);

  const [tenantResult] = await db.insert(tenants).values({
    name: data.companyName,
    slug,
    plan: "free",
    status: "active",
    hotmartEmail: data.email,
    freemiumDays,
    freemiumExpiresAt,
  }).$returningId();

  const tenantId = tenantResult.id;

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user as admin of the tenant
  const [userResult] = await db.insert(crmUsers).values({
    tenantId,
    name: data.userName,
    email: data.email,
    phone: data.phone || null,
    passwordHash,
    status: "active",
  }).$returningId();

  // Update tenant owner
  await db.update(tenants).set({ ownerUserId: userResult.id }).where(eq(tenants.id, tenantId));

  // Create subscription (trialing/freemium)
  await db.insert(subscriptions).values({
    tenantId,
    plan: "free",
    status: "trialing",
    trialStartedAt: new Date(),
    trialEndsAt: freemiumExpiresAt,
  });

  return {
    tenantId,
    userId: userResult.id,
    email: data.email,
    name: data.userName,
  };
}

// ═══════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════

export async function loginWithEmail(email: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find user by email
  const users = await db.select().from(crmUsers).where(eq(crmUsers.email, email)).limit(1);
  if (users.length === 0) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const user = users[0];

  if (!user.passwordHash) {
    throw new Error("INVALID_CREDENTIALS");
  }

  // Verify password
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (user.status === "inactive") {
    throw new Error("ACCOUNT_INACTIVE");
  }

  // Get tenant
  const tenantRows = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);
  if (tenantRows.length === 0) {
    throw new Error("TENANT_NOT_FOUND");
  }

  const tenant = tenantRows[0];

  // Check if tenant is suspended
  if (tenant.status === "suspended") {
    // Check subscription
    const subs = await db.select().from(subscriptions)
      .where(and(eq(subscriptions.tenantId, tenant.id), eq(subscriptions.status, "active")))
      .limit(1);
    
    if (subs.length === 0) {
      throw new Error("SUBSCRIPTION_EXPIRED");
    }
  }

  // Update last login
  await db.update(crmUsers).set({ lastLoginAt: new Date() }).where(eq(crmUsers.id, user.id));

  // Determine role (check if user is the owner or has admin role)
  const isOwner = tenant.ownerUserId === user.id;
  const role = isOwner ? "admin" : "user";

  return {
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    role,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      freemiumExpiresAt: tenant.freemiumExpiresAt,
    },
  };
}

// ═══════════════════════════════════════
// TENANT STATUS CHECK
// ═══════════════════════════════════════

export async function checkTenantAccess(tenantId: number): Promise<{
  allowed: boolean;
  reason?: string;
  plan: string;
  daysLeft?: number;
  paymentUrl?: string;
}> {
  const db = await getDb();
  if (!db) return { allowed: false, reason: "DB_ERROR", plan: "free" };

  const tenantRows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (tenantRows.length === 0) return { allowed: false, reason: "TENANT_NOT_FOUND", plan: "free" };

  const tenant = tenantRows[0];

  if (tenant.status === "cancelled") {
    return { allowed: false, reason: "CANCELLED", plan: tenant.plan };
  }

  if (tenant.status === "suspended") {
    return { allowed: false, reason: "SUSPENDED", plan: tenant.plan, paymentUrl: "/upgrade" };
  }

  // Check freemium expiration
  if (tenant.plan === "free" && tenant.freemiumExpiresAt) {
    const now = new Date();
    if (now > tenant.freemiumExpiresAt) {
      // Freemium expired - suspend tenant
      await db.update(tenants).set({ status: "suspended" }).where(eq(tenants.id, tenantId));
      return { allowed: false, reason: "FREEMIUM_EXPIRED", plan: "free", paymentUrl: "/upgrade" };
    }
    const daysLeft = Math.ceil((tenant.freemiumExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return { allowed: true, plan: "free", daysLeft };
  }

  // Pro/Enterprise - check active subscription
  if (tenant.plan === "pro" || tenant.plan === "enterprise") {
    const subs = await db.select().from(subscriptions)
      .where(and(eq(subscriptions.tenantId, tenantId)))
      .limit(1);
    
    if (subs.length > 0) {
      const sub = subs[0];
      if (sub.status === "expired" || sub.status === "cancelled") {
        await db.update(tenants).set({ status: "suspended" }).where(eq(tenants.id, tenantId));
        return { allowed: false, reason: "SUBSCRIPTION_EXPIRED", plan: tenant.plan, paymentUrl: "/upgrade" };
      }
    }
  }

  return { allowed: true, plan: tenant.plan };
}

// ═══════════════════════════════════════
// SUPERADMIN CHECK
// ═══════════════════════════════════════

const SUPERADMIN_EMAIL = "bruno@entur.com.br";

export function isSuperAdmin(email: string): boolean {
  return email.toLowerCase() === SUPERADMIN_EMAIL;
}

// ═══════════════════════════════════════
// ADMIN: UPDATE FREEMIUM PERIOD
// ═══════════════════════════════════════

export async function updateFreemiumPeriod(tenantId: number, days: number) {
  if (days < 7) throw new Error("Mínimo de 7 dias");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const freemiumExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db.update(tenants).set({
    freemiumDays: days,
    freemiumExpiresAt,
    status: "active", // Reactivate if was suspended
  }).where(eq(tenants.id, tenantId));

  return { tenantId, freemiumDays: days, freemiumExpiresAt };
}

// ═══════════════════════════════════════
// LIST ALL TENANTS (SUPERADMIN)
// ═══════════════════════════════════════

export async function listAllTenantsAdmin() {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select().from(tenants);
  
  // Get subscription info for each tenant
  const result = await Promise.all(rows.map(async (t: any) => {
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, t.id)).limit(1);
    const userCount = await db.select().from(crmUsers).where(eq(crmUsers.tenantId, t.id));
    return {
      ...t,
      subscription: subs[0] || null,
      userCount: userCount.length,
    };
  }));

  return result;
}

// ═══════════════════════════════════════
// UPDATE TENANT PLAN (SUPERADMIN)
// ═══════════════════════════════════════

export async function updateTenantPlan(tenantId: number, plan: "free" | "pro" | "enterprise") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(tenants).set({ plan, status: "active" }).where(eq(tenants.id, tenantId));

  if (plan === "pro" || plan === "enterprise") {
    // Create or update subscription
    const existing = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId)).limit(1);
    if (existing.length > 0) {
      await db.update(subscriptions).set({
        plan,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }).where(eq(subscriptions.id, existing[0].id));
    } else {
      await db.insert(subscriptions).values({
        tenantId,
        plan,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }
  }

  return { tenantId, plan };
}


// ═══════════════════════════════════════
// LIST USERS BY TENANT (SUPERADMIN)
// ═══════════════════════════════════════

export async function listTenantUsersAdmin(tenantId: number) {
  const db = await getDb();
  if (!db) return [];

  const users = await db
    .select({
      id: crmUsers.id,
      name: crmUsers.name,
      email: crmUsers.email,
      phone: crmUsers.phone,
      status: crmUsers.status,
      lastLoginAt: crmUsers.lastLoginAt,
      createdAt: crmUsers.createdAt,
    })
    .from(crmUsers)
    .where(eq(crmUsers.tenantId, tenantId));

  return users;
}

// ═══════════════════════════════════════
// UPDATE USER STATUS (SUPERADMIN)
// ═══════════════════════════════════════

export async function updateUserStatusAdmin(userId: number, status: "active" | "inactive") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(crmUsers).set({ status }).where(eq(crmUsers.id, userId));
  return { userId, status };
}
