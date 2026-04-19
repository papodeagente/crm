import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { eq, and, sql } from "drizzle-orm";
import { crmUsers, tenants, subscriptions, passwordResetTokens } from "../drizzle/schema";
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

  // Create tenant — new tenants get 7-day trial (non-legacy)
  const slug = data.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 64);
  const trialDays = 7;
  const trialExpiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

  const [tenantResult] = await db.insert(tenants).values({
    name: data.companyName,
    slug,
    plan: "start",
    status: "active",
    billingStatus: "trialing",
    isLegacy: false,
    hotmartEmail: data.email,
    freemiumDays: trialDays,
    freemiumExpiresAt: trialExpiresAt,
  }).returning({ id: tenants.id });

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
    role: "admin",
    status: "active",
  }).returning({ id: crmUsers.id });

  // Update tenant owner
  await db.update(tenants).set({ ownerUserId: userResult.id }).where(eq(tenants.id, tenantId));

  // Auto-create default pipelines for new tenant
  try {
    const { createDefaultPipelines } = await import("./classificationEngine");
    await createDefaultPipelines(tenantId);
  } catch (e) {
    console.error("[Onboarding] Failed to create default pipelines for tenant", tenantId, e);
  }

  // Create subscription (7-day trial)
  await db.insert(subscriptions).values({
    tenantId,
    provider: "hotmart",
    plan: "start",
    status: "trialing",
    trialStartedAt: new Date(),
    trialEndsAt: trialExpiresAt,
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

  // Find ALL users with this email (may exist in multiple tenants)
  const allUsers = await db.select().from(crmUsers).where(eq(crmUsers.email, email));
  if (allUsers.length === 0) {
    throw new Error("INVALID_CREDENTIALS");
  }

  // Try to find a matching user: prioritize active users with passwordHash
  const sortedUsers = allUsers
    .filter(u => u.passwordHash)
    .sort((a, b) => {
      const statusOrder: Record<string, number> = { active: 0, invited: 1, inactive: 2 };
      return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    });

  if (sortedUsers.length === 0) {
    throw new Error("INVALID_CREDENTIALS");
  }

  // Verify password against each candidate (usually just 1-2)
  let user = null;
  for (const candidate of sortedUsers) {
    const valid = await verifyPassword(password, candidate.passwordHash!);
    if (valid) {
      user = candidate;
      break;
    }
  }

  if (!user) {
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

  // Check if tenant is hard-suspended (admin action)
  // Note: billingStatus "restricted" still allows login (read-only mode)
  if (tenant.status === "suspended") {
    // Legacy tenants: check subscription
    if (tenant.isLegacy) {
      const subs = await db.select().from(subscriptions)
        .where(and(eq(subscriptions.tenantId, tenant.id), eq(subscriptions.status, "active")))
        .limit(1);
      if (subs.length === 0) {
        throw new Error("SUBSCRIPTION_EXPIRED");
      }
    } else {
      // Non-legacy: suspended means admin action, block login
      throw new Error("SUBSCRIPTION_EXPIRED");
    }
  }

  // Update last login — and activate invited users on first login
  const updateFields: Record<string, any> = { lastLoginAt: new Date() };
  if (user.status === "invited") {
    updateFields.status = "active";
  }
  await db.update(crmUsers).set(updateFields).where(eq(crmUsers.id, user.id));

  // Determine role: owner is always admin, otherwise use DB role
  const isOwner = tenant.ownerUserId === user.id;
  const role = isOwner ? "admin" : (user.role || "user");

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
      billingStatus: tenant.billingStatus,
      isLegacy: tenant.isLegacy,
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
  billingStatus?: string;
  isLegacy?: boolean;
  message?: string;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
}> {
  const { checkBillingAccess } = await import("./services/billingAccessService");
  const billing = await checkBillingAccess(tenantId);

  // Also check tenant.status for suspended/cancelled (admin-level suspension)
  const db = await getDb();
  if (db) {
    const tenantRows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (tenantRows.length > 0) {
      const tenant = tenantRows[0];
      if (tenant.status === "suspended") {
        return {
          allowed: false,
          reason: "SUSPENDED",
          plan: tenant.plan,
          paymentUrl: "/upgrade",
          billingStatus: billing.billingStatus,
          isLegacy: billing.isLegacy,
          message: "Sua conta foi suspensa. Entre em contato com o suporte.",
        };
      }
      if (tenant.status === "cancelled") {
        return {
          allowed: false,
          reason: "CANCELLED",
          plan: tenant.plan,
          billingStatus: billing.billingStatus,
          isLegacy: billing.isLegacy,
        };
      }

      // Legacy tenants with freemium: check expiration (backward compat)
      if (tenant.isLegacy && tenant.plan === "free" && tenant.freemiumExpiresAt) {
        const now = new Date();
        if (now > tenant.freemiumExpiresAt) {
          await db.update(tenants).set({ status: "suspended" }).where(eq(tenants.id, tenantId));
          return { allowed: false, reason: "FREEMIUM_EXPIRED", plan: "free", paymentUrl: "/upgrade", isLegacy: true, billingStatus: "expired" };
        }
        const daysLeft = Math.ceil((tenant.freemiumExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        return { allowed: true, plan: "free", daysLeft, isLegacy: true, billingStatus: "active" };
      }
    }
  }

  return {
    allowed: billing.level === "full",
    reason: billing.reason,
    plan: billing.plan,
    billingStatus: billing.billingStatus,
    isLegacy: billing.isLegacy,
    message: billing.message,
    trialEndsAt: billing.trialEndsAt,
    currentPeriodEnd: billing.currentPeriodEnd,
    paymentUrl: billing.level === "restricted" ? "/upgrade" : undefined,
  };
}

// ═══════════════════════════════════════
// SUPERADMIN CHECK
// ═══════════════════════════════════════

const PROTECTED_SUPERADMIN_EMAIL = "bruno@entur.com.br";

/**
 * Sync check — always true for protected email, false for others.
 * Most existing code uses this. For dynamic super admins, use isSuperAdminAsync.
 */
export function isSuperAdmin(email: string): boolean {
  if (email.toLowerCase() === PROTECTED_SUPERADMIN_EMAIL) return true;
  return false;
}

/**
 * Async version that checks the database for isSuperAdmin flag.
 * Protected email always returns true without DB query.
 */
export async function isSuperAdminAsync(email: string): Promise<boolean> {
  if (email.toLowerCase() === PROTECTED_SUPERADMIN_EMAIL) return true;
  const db = await getDb();
  if (!db) return false;
  const { users } = await import("../drizzle/schema");
  const { eq: eqOp, and: andOp } = await import("drizzle-orm");
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(andOp(eqOp(users.email, email.toLowerCase()), eqOp(users.isSuperAdmin, true)))
    .limit(1);
  return !!user;
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

// ═══════════════════════════════════════
// PASSWORD RESET
// ═══════════════════════════════════════

import { randomBytes } from "crypto";
import { sendPasswordResetEmail, sendInviteEmail } from "./emailService";

const RESET_TOKEN_EXPIRY_MINUTES = 60;

export async function requestPasswordReset(email: string, origin: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find ALL users with this email (may exist in multiple tenants)
  // Generate a single reset token for the primary (active) account
  const allUsers = await db.select().from(crmUsers).where(eq(crmUsers.email, email));
  if (allUsers.length === 0) {
    // Don't reveal if email exists
    return;
  }
  // Prioritize active user; fall back to first found
  const user = allUsers.find(u => u.status === "active" && u.passwordHash) || allUsers[0];

  // Generate token
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

  // Save token
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token,
    expiresAt,
  });

  // Send email
  const resetUrl = `${origin}/reset-password?token=${token}`;
  await sendPasswordResetEmail({
    to: user.email,
    userName: user.name,
    resetUrl,
    expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
  });
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  // Find token
  const tokens = await db.select().from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (tokens.length === 0) {
    return { success: false, error: "Token inválido" };
  }

  const resetToken = tokens[0];

  // Check if already used
  if (resetToken.usedAt) {
    return { success: false, error: "Este link já foi utilizado" };
  }

  // Check expiration
  if (new Date() > resetToken.expiresAt) {
    return { success: false, error: "Link expirado. Solicite um novo." };
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update password
  await db.update(crmUsers).set({ passwordHash }).where(eq(crmUsers.id, resetToken.userId));

  // Mark token as used
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, resetToken.id));

  return { success: true };
}

// ═══════════════════════════════════════
// INVITE USER TO TENANT
// ═══════════════════════════════════════

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function inviteUserToTenant(data: {
  tenantId: number;
  name: string;
  email: string;
  phone?: string;
  role?: "admin" | "user";
  inviterName: string;
  origin: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check plan user limit before proceeding
  const { assertCanAddUser } = await import("./services/planLimitsService");
  await assertCanAddUser(data.tenantId);

  // Check if email already exists in this tenant
  const existing = await db.select().from(crmUsers)
    .where(and(eq(crmUsers.tenantId, data.tenantId), eq(crmUsers.email, data.email)))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("EMAIL_EXISTS_IN_TENANT");
  }

  // Generate temp password
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  // Create user with status "invited"
  const [userResult] = await db.insert(crmUsers).values({
    tenantId: data.tenantId,
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    passwordHash,
    role: data.role || "user",
    status: "invited",
  }).returning({ id: crmUsers.id });

  // Get tenant name
  const tenantRows = await db.select().from(tenants).where(eq(tenants.id, data.tenantId)).limit(1);
  const companyName = tenantRows[0]?.name || "sua empresa";

  // Send invite email
  const loginUrl = `${data.origin}/login`;
  await sendInviteEmail({
    to: data.email,
    inviterName: data.inviterName,
    companyName,
    tempPassword,
    loginUrl,
  });

  return {
    success: true,
    userId: userResult.id,
    emailSent: true,
  };
}


// ═══════════════════════════════════════
// TENANT METRICS (SUPERADMIN)
// ═══════════════════════════════════════

export interface TenantMetrics {
  tenantId: number;
  dealsOpen: number;
  dealsTotal: number;
  contactsTotal: number;
  whatsappConnected: boolean;
  wonThisMonthCents: number;
}

/**
 * Single aggregated query that returns operational metrics per tenant.
 * Uses LEFT JOINs and conditional aggregation to avoid N+1.
 */
export async function getTenantMetricsAdmin(): Promise<TenantMetrics[]> {
  const db = await getDb();
  if (!db) return [];

  // Get first day of current month in UTC
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

  const rows: any[][] = await db.execute(sql`
    SELECT
      t.id AS tenantId,
      COALESCE(d.dealsOpen, 0)         AS dealsOpen,
      COALESCE(d.dealsTotal, 0)        AS dealsTotal,
      COALESCE(c.contactsTotal, 0)     AS contactsTotal,
      COALESCE(w.connectedCount, 0)    AS connectedCount,
      COALESCE(d.wonThisMonthCents, 0) AS wonThisMonthCents
    FROM tenants t
    LEFT JOIN (
      SELECT
        tenantId,
        SUM(CASE WHEN status = 'open' AND deletedAt IS NULL THEN 1 ELSE 0 END) AS dealsOpen,
        SUM(CASE WHEN deletedAt IS NULL THEN 1 ELSE 0 END) AS dealsTotal,
        SUM(CASE WHEN status = 'won' AND deletedAt IS NULL AND updatedAt >= ${monthStart} THEN COALESCE(valueCents, 0) ELSE 0 END) AS wonThisMonthCents
      FROM deals
      GROUP BY tenantId
    ) d ON d.tenantId = t.id
    LEFT JOIN (
      SELECT tenantId, COUNT(*) AS contactsTotal
      FROM contacts
      WHERE deletedAt IS NULL
      GROUP BY tenantId
    ) c ON c.tenantId = t.id
    LEFT JOIN (
      SELECT tenantId, SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) AS connectedCount
      FROM whatsapp_sessions
      GROUP BY tenantId
    ) w ON w.tenantId = t.id
  `) as unknown as any[][];

  const resultRows = rows[0] || [];
  return resultRows.map((r: any) => ({
    tenantId: Number(r.tenantId),
    dealsOpen: Number(r.dealsOpen),
    dealsTotal: Number(r.dealsTotal),
    contactsTotal: Number(r.contactsTotal),
    whatsappConnected: Number(r.connectedCount) > 0,
    wonThisMonthCents: Number(r.wonThisMonthCents),
  }));
}

// ═══════════════════════════════════════
// DELETE TENANT COMPLETELY (SUPERADMIN)
// ═══════════════════════════════════════

/**
 * Deletes a tenant and ALL associated data from the database.
 * This is a hard-delete that removes everything so the account
 * can be recreated from scratch without any leftover data.
 *
 * Tables are deleted in reverse dependency order to avoid FK violations.
 */
export async function deleteTenantCompletely(tenantId: number): Promise<{
  success: boolean;
  deletedTables: string[];
  errors: string[];
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Safety: never delete tenant 0 or negative
  if (tenantId <= 0) throw new Error("Invalid tenant ID");

  // Safety: never delete the root tenant "Entur" — the only protected tenant
  const [targetTenant] = await db.select().from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (targetTenant && targetTenant.name.toLowerCase() === "entur") {
    throw new Error("O tenant 'Entur' é o tenant raiz e não pode ser excluído");
  }

  const deletedTables: string[] = [];
  const errors: string[] = [];

  // First, get all session IDs for this tenant (needed for non-tenant tables)
  let sessionIds: string[] = [];
  try {
    const sessions = await db.execute(
      sql`SELECT sessionId FROM whatsapp_sessions WHERE tenantId = ${tenantId}`
    );
    sessionIds = ((sessions as unknown as any[][])[0] || []).map((r: any) => r.sessionId);
  } catch (e: any) {
    errors.push(`whatsapp_sessions lookup: ${e.message}`);
  }

  // Get all user IDs for this tenant
  let userIds: number[] = [];
  try {
    const users = await db.execute(
      sql`SELECT id FROM crm_users WHERE tenantId = ${tenantId}`
    );
    userIds = ((users as unknown as any[][])[0] || []).map((r: any) => r.id);
  } catch (e: any) {
    errors.push(`crm_users lookup: ${e.message}`);
  }

  // ─── Phase 1: Delete tables with tenantId (leaf tables first) ───
  // Order matters: delete child/leaf tables before parent tables

  const tenantTables = [
    // Leaf tables (no other table references these)
    "ai_conversation_analyses",
    "ai_integrations",
    "wa_audit_log",
    "wa_identities",
    "wa_conversations",
    "lead_event_log",
    "tracking_tokens",
    "rd_station_webhook_log",
    "rd_field_mappings",
    "rd_station_config",
    "meta_integration_config",
    "portal_sessions",
    "portal_tickets",
    "portal_users",
    "performance_snapshots",
    "metrics_daily",
    "alerts",
    "event_log",
    "job_dlq",
    "jobs",
    "webhook_config",
    "webhooks",
    "notifications",
    "user_preferences",
    "quick_replies",
    "rfv_contacts",
    "rfv_filter_snapshots",
    "session_shares",
    "google_calendar_tokens",
    "internal_notes",
    "conversation_events",
    "contact_action_logs",
    "bulk_campaign_messages",
    "bulk_campaigns",
    "messages",

    // Custom fields
    "custom_field_values",
    "custom_fields",

    // CRM attachments, notes, tasks
    "task_assignees",
    "crm_attachments",
    "crm_notes",
    "crm_tasks",

    // Deals child tables
    "deal_history",
    "deal_products",
    "deal_participants",
    "proposal_items",
    "proposal_signatures",
    "proposals",
    "proposal_templates",

    // Trip items before trips
    "trip_items",
    "trips",

    // Deals before pipelines
    "task_automations",
    "date_automations",
    "deals",

    // Pipeline child tables
    "pipeline_automations",
    "pipeline_stages",
    "pipelines",

    // Products
    "product_catalog",
    "product_categories",

    // Contacts & accounts
    "contacts",
    "accounts",

    // Inbox/messaging
    "inbox_messages",
    "conversations",
    "channels",

    // Conversation assignments
    "conversation_assignments",

    // Teams & distribution
    "team_members",
    "distribution_rules",
    "teams",

    // Roles & permissions
    "role_permissions",
    "user_roles",
    "crm_roles",
    "api_keys",

    // Integrations
    "integration_connections",
    "integration_credentials",
    "integrations",

    // Subscriptions
    "subscriptions",

    // Courses / LMS
    "enrollments",
    "lessons",
    "courses",

    // Goals
    "goals",

    // Loss reasons
    "loss_reasons",

    // Lead sources & campaigns
    "campaigns",
    "lead_sources",
  ];

  for (const table of tenantTables) {
    try {
      await db.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE tenantId = ${tenantId}`);
      deletedTables.push(table);
    } catch (e: any) {
      errors.push(`${table}: ${e.message}`);
    }
  }

  // ─── Phase 2: Delete non-tenant tables linked by sessionId ───
  if (sessionIds.length > 0) {
    const sessionLinkedTables = [
      "chatbot_rules",
      "chatbot_settings",
      "wa_contacts",
      "activity_logs",
    ];

    for (const table of sessionLinkedTables) {
      try {
        for (const sid of sessionIds) {
          await db.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE sessionId = ${sid}`);
        }
        deletedTables.push(table);
      } catch (e: any) {
        errors.push(`${table}: ${e.message}`);
      }
    }

    // Delete messages linked by sessionId
    try {
      for (const sid of sessionIds) {
        await db.execute(sql`DELETE FROM messages WHERE sessionId = ${sid}`);
      }
      deletedTables.push("messages");
    } catch (e: any) {
      errors.push(`messages: ${e.message}`);
    }
  }

  // ─── Phase 3: Delete whatsapp_sessions for this tenant ───
  try {
    await db.execute(sql`DELETE FROM whatsapp_sessions WHERE tenantId = ${tenantId}`);
    deletedTables.push("whatsapp_sessions");
  } catch (e: any) {
    errors.push(`whatsapp_sessions: ${e.message}`);
  }

  // ─── Phase 4: Delete password_reset_tokens for tenant users ───
  if (userIds.length > 0) {
    try {
      for (const uid of userIds) {
        await db.execute(sql`DELETE FROM password_reset_tokens WHERE userId = ${uid}`);
      }
      deletedTables.push("password_reset_tokens");
    } catch (e: any) {
      errors.push(`password_reset_tokens: ${e.message}`);
    }
  }

  // ─── Phase 5: Delete crm_users for this tenant ───
  try {
    await db.execute(sql`DELETE FROM crm_users WHERE tenantId = ${tenantId}`);
    deletedTables.push("crm_users");
  } catch (e: any) {
    errors.push(`crm_users: ${e.message}`);
  }

  // ─── Phase 6: Delete the tenant itself ───
  try {
    await db.execute(sql`DELETE FROM tenants WHERE id = ${tenantId}`);
    deletedTables.push("tenants");
  } catch (e: any) {
    errors.push(`tenants: ${e.message}`);
  }

  return {
    success: errors.length === 0,
    deletedTables,
    errors,
  };
}
