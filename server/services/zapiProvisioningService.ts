/**
 * Z-API Partner Provisioning Service
 * 
 * Manages automatic provisioning of Z-API instances for tenants
 * when they transition from trial to paid plan.
 * 
 * Flow:
 * 1. Tenant completes trial and pays (PURCHASE_APPROVED/PURCHASE_COMPLETE)
 * 2. This service creates a Z-API instance via Partner API
 * 3. Configures webhooks on the new instance
 * 4. Subscribes the instance (activates billing on Z-API side)
 * 5. Stores credentials in tenant_zapi_instances table
 * 6. Creates a WhatsApp session linked to the Z-API provider
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { tenantZapiInstances, whatsappSessions, tenants } from "../../drizzle/schema";

// ─── Configuration ───
const ZAPI_BASE_URL = "https://api.z-api.io";
const WEBHOOK_BASE_URL = process.env.ZAPI_WEBHOOK_BASE_URL || "https://crm.enturos.com";
const PARTNER_TOKEN = () => process.env.ZAPI_PARTNER_TOKEN || "";
const CLIENT_TOKEN = () => process.env.ZAPI_CLIENT_TOKEN || "";

// ─── Types ───
export interface ZapiCreateInstanceResponse {
  id: string;
  token: string;
  due: number; // timestamp
}

export interface ZapiProvisionResult {
  success: boolean;
  instanceId?: string;
  token?: string;
  error?: string;
  alreadyProvisioned?: boolean;
}

export interface ZapiInstanceInfo {
  id: number;
  tenantId: number;
  zapiInstanceId: string;
  zapiToken: string;
  zapiClientToken: string | null;
  instanceName: string;
  status: string;
  subscribedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

// ─── Partner API HTTP Client ───
async function zapiPartnerFetch(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: Record<string, any>
): Promise<any> {
  const token = PARTNER_TOKEN();
  if (!token) {
    throw new Error("[ZapiProvisioning] ZAPI_PARTNER_TOKEN not configured");
  }

  const url = `${ZAPI_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  console.log(`[ZapiProvisioning] ${method} ${path}`);

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[ZapiProvisioning] ${method} ${path} failed: ${res.status} ${text}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

// ─── Core Functions ───

/**
 * Create a new Z-API instance via Partner API
 */
async function createInstance(name: string, sessionId: string): Promise<ZapiCreateInstanceResponse> {
  const webhookBase = `${WEBHOOK_BASE_URL}/api/webhooks/zapi/${sessionId}`;

  const body: Record<string, any> = {
    name,
    deliveryCallbackUrl: `${webhookBase}/on-message-send`,
    receivedCallbackUrl: `${webhookBase}/on-message-received`,
    disconnectedCallbackUrl: `${webhookBase}/on-disconnected`,
    connectedCallbackUrl: `${webhookBase}/on-connected`,
    messageStatusCallbackUrl: `${webhookBase}/on-whatsapp-message-status-changes`,
    presenceChatCallbackUrl: `${webhookBase}/on-chat-presence`,
    receivedAndDeliveryCallbackUrl: `${webhookBase}`,
    callRejectAuto: false,
    autoReadMessage: false,
    autoReadStatus: false,
    isDevice: false,
    businessDevice: false,
  };

  const result = await zapiPartnerFetch("POST", "/instances/integrator/on-demand", body);
  console.log(`[ZapiProvisioning] Instance created: id=${result.id}, due=${result.due}`);
  return result as ZapiCreateInstanceResponse;
}

/**
 * Subscribe (activate billing) for a Z-API instance
 */
async function subscribeInstance(instanceId: string, token: string): Promise<void> {
  await zapiPartnerFetch(
    "POST",
    `/instances/${instanceId}/token/${token}/integrator/on-demand/subscription`
  );
  console.log(`[ZapiProvisioning] Instance ${instanceId} subscribed`);
}

/**
 * Cancel a Z-API instance subscription
 */
async function cancelInstance(instanceId: string, token: string): Promise<void> {
  await zapiPartnerFetch(
    "POST",
    `/instances/${instanceId}/token/${token}/integrator/on-demand/cancel`
  );
  console.log(`[ZapiProvisioning] Instance ${instanceId} cancelled`);
}

/**
 * Update/upgrade a Z-API instance subscription
 * Docs: https://developer.z-api.io/partner/update-instance
 * PUT /instances/{id}/token/{token}/integrator/on-demand/subscription/update
 */
async function updateInstanceSubscription(instanceId: string, token: string): Promise<void> {
  await zapiPartnerFetch(
    "PUT",
    `/instances/${instanceId}/token/${token}/integrator/on-demand/subscription/update`
  );
  console.log(`[ZapiProvisioning] Instance ${instanceId} subscription updated`);
}

/**
 * List all instances from partner account with automatic pagination.
 * Uses GET /instances?page=X&pageSize=Y (per Z-API Partner docs)
 */
async function listInstances(): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  while (true) {
    const result = await zapiPartnerFetch("GET", `/instances?page=${page}&pageSize=20`);
    const content = result?.content || [];
    all.push(...content);
    const totalPages = result?.totalPage || 1;
    if (page >= totalPages || content.length === 0) break;
    page++;
  }
  return all;
}

// ─── Main Provisioning Logic ───

/**
 * Provision a Z-API instance for a tenant.
 * Called when tenant transitions from trial to paid.
 * 
 * Steps:
 * 1. Check if tenant already has a provisioned instance
 * 2. Create instance via Partner API
 * 3. Subscribe instance (activate)
 * 4. Store credentials in DB
 * 5. Return instance info
 */
export async function provisionZapiForTenant(
  tenantId: number,
  tenantName: string
): Promise<ZapiProvisionResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database unavailable" };
  }

  try {
    // 1. Check if tenant already has an active instance
    const existing = await db
      .select()
      .from(tenantZapiInstances)
      .where(
        and(
          eq(tenantZapiInstances.tenantId, tenantId),
          eq(tenantZapiInstances.status, "active")
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`[ZapiProvisioning] Tenant ${tenantId} already has active instance: ${existing[0].zapiInstanceId}`);
      return {
        success: true,
        instanceId: existing[0].zapiInstanceId,
        token: existing[0].zapiToken,
        alreadyProvisioned: true,
      };
    }

    // 2. Generate session ID for this tenant
    const sessionId = `zapi-${tenantId}-${Date.now()}`;
    const instanceName = `EnturOS-${tenantName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20)}-${tenantId}`;

    // 3. Create instance via Partner API
    console.log(`[ZapiProvisioning] Creating instance for tenant ${tenantId}: ${instanceName}`);
    const instance = await createInstance(instanceName, sessionId);

    // 4. Subscribe instance (activate billing)
    console.log(`[ZapiProvisioning] Subscribing instance ${instance.id} for tenant ${tenantId}`);
    await subscribeInstance(instance.id, instance.token);

    // 5. Store in database
    await db.insert(tenantZapiInstances).values({
      tenantId,
      zapiInstanceId: instance.id,
      zapiToken: instance.token,
      zapiClientToken: CLIENT_TOKEN(),
      instanceName,
      status: "active",
      subscribedAt: new Date(),
      expiresAt: new Date(instance.due),
      webhookBaseUrl: `${WEBHOOK_BASE_URL}/api/webhooks/zapi/${sessionId}`,
    });

    // 6. Create a WhatsApp session linked to Z-API
    // Note: whatsappSessions requires userId — we'll get the tenant owner
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const userId = tenant?.ownerUserId || 0;

    await db.insert(whatsappSessions).values({
      sessionId,
      userId,
      tenantId,
      provider: "zapi",
      providerInstanceId: instance.id,
      providerToken: instance.token,
      providerClientToken: CLIENT_TOKEN(),
      status: "disconnected",
    });

    console.log(`[ZapiProvisioning] ✓ Tenant ${tenantId} provisioned: instance=${instance.id}, session=${sessionId}`);

    return {
      success: true,
      instanceId: instance.id,
      token: instance.token,
    };
  } catch (error: any) {
    console.error(`[ZapiProvisioning] ✗ Failed for tenant ${tenantId}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Deprovision (cancel) a Z-API instance for a tenant.
 * Called when tenant subscription is cancelled/expired/restricted.
 */
export async function deprovisionZapiForTenant(tenantId: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database unavailable" };
  }

  try {
    const instances = await db
      .select()
      .from(tenantZapiInstances)
      .where(
        and(
          eq(tenantZapiInstances.tenantId, tenantId),
          eq(tenantZapiInstances.status, "active")
        )
      );

    if (instances.length === 0) {
      console.log(`[ZapiProvisioning] No active instance for tenant ${tenantId}`);
      return { success: true };
    }

    for (const inst of instances) {
      // 1. Cancel instance on Z-API Partner API
      try {
        await cancelInstance(inst.zapiInstanceId, inst.zapiToken);
      } catch (err: any) {
        console.warn(`[ZapiProvisioning] Failed to cancel Z-API instance ${inst.zapiInstanceId}: ${err.message}`);
        // Continue anyway — mark as cancelled locally even if API call fails
      }

      // 2. Mark instance as cancelled in DB
      await db
        .update(tenantZapiInstances)
        .set({ status: "cancelled", cancelledAt: new Date() })
        .where(eq(tenantZapiInstances.id, inst.id));

      // 3. Deactivate all WhatsApp sessions linked to this Z-API instance
      const linkedSessions = await db
        .select()
        .from(whatsappSessions)
        .where(
          and(
            eq(whatsappSessions.tenantId, tenantId),
            eq(whatsappSessions.provider, "zapi"),
            eq(whatsappSessions.providerInstanceId, inst.zapiInstanceId)
          )
        );

      for (const session of linkedSessions) {
        await db
          .update(whatsappSessions)
          .set({ status: "disconnected" })
          .where(eq(whatsappSessions.id, session.id));
        console.log(`[ZapiProvisioning] Session ${session.sessionId} deactivated (instance ${inst.zapiInstanceId} cancelled)`);
      }
    }

    console.log(`[ZapiProvisioning] ✓ Deprovisioned ${instances.length} instance(s) for tenant ${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[ZapiProvisioning] ✗ Deprovision failed for tenant ${tenantId}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get the provisioned Z-API instance for a tenant
 */
export async function getZapiInstanceForTenant(tenantId: number): Promise<ZapiInstanceInfo | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(tenantZapiInstances)
    .where(
      and(
        eq(tenantZapiInstances.tenantId, tenantId),
        eq(tenantZapiInstances.status, "active")
      )
    )
    .limit(1);

  return rows[0] || null;
}

/**
 * Check if a tenant has a provisioned Z-API instance
 */
export async function hasZapiInstance(tenantId: number): Promise<boolean> {
  const instance = await getZapiInstanceForTenant(tenantId);
  return instance !== null;
}

/**
 * Sync Z-API instances from Partner API with local DB.
 * Compares remote state with tenant_zapi_instances and reports mismatches.
 * Does NOT auto-fix — returns a report for manual review.
 */
export async function syncPartnerInstances(): Promise<{
  synced: number;
  errors: number;
  report: Array<{
    tenantId: number;
    instanceName: string;
    zapiInstanceId: string;
    dbStatus: string;
    zapiConnected: boolean;
    webhookCorrect: boolean;
    issue?: string;
  }>;
}> {
  const report: Array<any> = [];
  try {
    const db = await getDb();
    if (!db) return { synced: 0, errors: 1, report: [] };

    const remoteInstances = await listInstances();
    console.log(`[ZapiProvisioning] Partner account has ${remoteInstances.length} instance(s)`);

    // Build remote lookup
    const remoteLookup = new Map<string, any>();
    for (const inst of remoteInstances) {
      remoteLookup.set(inst.id, inst);
    }

    // Check each local active instance against remote
    const localInstances = await db
      .select()
      .from(tenantZapiInstances)
      .where(eq(tenantZapiInstances.status, "active"));

    for (const local of localInstances) {
      const remote = remoteLookup.get(local.zapiInstanceId);
      const zapiConnected = remote ? (remote.phoneConnected && remote.whatsappConnected) : false;
      const webhookCorrect = remote
        ? (remote.receivedAndDeliveryCallbackUrl || "").includes("crm.enturos.com")
        : false;

      let issue: string | undefined;
      if (!remote) issue = "Instance not found in Z-API Partner API";
      else if (!zapiConnected) issue = "Instance disconnected on Z-API";
      else if (!webhookCorrect) issue = `Webhook pointing to wrong server: ${remote.receivedAndDeliveryCallbackUrl}`;

      report.push({
        tenantId: local.tenantId,
        instanceName: local.instanceName,
        zapiInstanceId: local.zapiInstanceId,
        dbStatus: local.status,
        zapiConnected,
        webhookCorrect,
        issue,
      });

      if (issue) {
        console.warn(`[ZapiProvisioning] Tenant ${local.tenantId} (${local.instanceName}): ${issue}`);
      }
    }

    return { synced: localInstances.length, errors: 0, report };
  } catch (error: any) {
    console.error(`[ZapiProvisioning] Sync failed:`, error.message);
    return { synced: 0, errors: 1, report };
  }
}

/**
 * Upgrade a tenant's Z-API instance subscription.
 * Used when tenant changes plan and needs instance capabilities updated.
 */
export async function upgradeZapiInstance(tenantId: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  try {
    const instances = await db
      .select()
      .from(tenantZapiInstances)
      .where(
        and(
          eq(tenantZapiInstances.tenantId, tenantId),
          eq(tenantZapiInstances.status, "active")
        )
      );

    if (instances.length === 0) {
      return { success: false, error: "No active instance found" };
    }

    for (const inst of instances) {
      await updateInstanceSubscription(inst.zapiInstanceId, inst.zapiToken);
    }

    console.log(`[ZapiProvisioning] ✓ Upgraded ${instances.length} instance(s) for tenant ${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[ZapiProvisioning] ✗ Upgrade failed for tenant ${tenantId}:`, error.message);
    return { success: false, error: error.message };
  }
}
