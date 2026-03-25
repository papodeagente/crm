/**
 * Provider Factory — Resolves the correct WhatsAppProvider per session.
 *
 * Resolution strategy (in order):
 * 1. Session-level: whatsapp_sessions.provider column (most granular)
 * 2. Tenant-level: tenants.defaultWaProvider column (future)
 * 3. Global fallback: WA_PROVIDER env var
 * 4. Default: "evolution"
 *
 * This allows progressive rollout: one session on Z-API while others stay on Evolution.
 * The factory also handles Z-API session registration (loading credentials from DB).
 */

import type { WhatsAppProvider, ProviderType, ProviderMetrics } from "./types";
import { evolutionProvider } from "./evolutionProvider";
import { zapiProvider, registerZApiSession, getZApiSession } from "./zapiProvider";
import { instrumentProvider } from "./instrumentedProvider";
import { getDb } from "../db";
import { whatsappSessions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ════════════════════════════════════════════════════════════
// PROVIDER REGISTRY
// ════════════════════════════════════════════════════════════

const providers: Record<ProviderType, WhatsAppProvider> = {
  evolution: instrumentProvider(evolutionProvider),
  zapi: instrumentProvider(zapiProvider),
};

/** Get provider by type */
export function getProvider(type: ProviderType): WhatsAppProvider {
  const provider = providers[type];
  if (!provider) {
    throw new Error(`[ProviderFactory] Unknown provider type: ${type}`);
  }
  return provider;
}

/** Get the default provider type from env or fallback */
export function getDefaultProviderType(): ProviderType {
  const envProvider = process.env.WA_PROVIDER;
  if (envProvider === "zapi") return "zapi";
  return "evolution";
}

// ════════════════════════════════════════════════════════════
// SESSION-LEVEL RESOLUTION
// ════════════════════════════════════════════════════════════

/** Cache of session → provider type to avoid repeated DB lookups */
const sessionProviderCache = new Map<string, { type: ProviderType; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Resolve the WhatsAppProvider for a specific session.
 *
 * This is the PRIMARY entry point used by all consumers.
 * It checks the DB for the session's provider field, registers Z-API
 * credentials if needed, and returns the correct provider instance.
 *
 * @param sessionId - The canonical session ID (e.g. "crm-1-2")
 * @returns The WhatsAppProvider for this session
 */
export async function resolveProviderForSession(sessionId: string): Promise<WhatsAppProvider> {
  // Check cache first
  const cached = sessionProviderCache.get(sessionId);
  if (cached && cached.expiresAt > Date.now()) {
    return getProvider(cached.type);
  }

  // Look up session in DB
  const dbConn = (await getDb())!;
  const [session] = await dbConn
    .select({
      provider: whatsappSessions.provider,
      providerInstanceId: whatsappSessions.providerInstanceId,
      providerToken: whatsappSessions.providerToken,
      providerClientToken: whatsappSessions.providerClientToken,
    })
    .from(whatsappSessions)
    .where(eq(whatsappSessions.sessionId, sessionId))
    .limit(1);

  if (!session) {
    // Session not found in DB — use default provider
    const defaultType = getDefaultProviderType();
    sessionProviderCache.set(sessionId, { type: defaultType, expiresAt: Date.now() + CACHE_TTL_MS });
    return getProvider(defaultType);
  }

  const providerType = (session.provider || getDefaultProviderType()) as ProviderType;

  // If Z-API, ensure credentials are registered
  if (providerType === "zapi" && session.providerInstanceId && session.providerToken) {
    const existing = getZApiSession(sessionId);
    if (!existing) {
      registerZApiSession(sessionId, {
        instanceId: session.providerInstanceId,
        token: session.providerToken,
        clientToken: session.providerClientToken || undefined,
      });
    }
  }

  // Update cache
  sessionProviderCache.set(sessionId, { type: providerType, expiresAt: Date.now() + CACHE_TTL_MS });

  return getProvider(providerType);
}

/**
 * Resolve provider type for a session (without full provider instance).
 * Useful for quick checks without loading the full provider.
 */
export async function resolveProviderTypeForSession(sessionId: string): Promise<ProviderType> {
  const cached = sessionProviderCache.get(sessionId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.type;
  }

  const dbConn2 = (await getDb())!;
  const [session] = await dbConn2
    .select({ provider: whatsappSessions.provider })
    .from(whatsappSessions)
    .where(eq(whatsappSessions.sessionId, sessionId))
    .limit(1);

  const type = (session?.provider || getDefaultProviderType()) as ProviderType;
  sessionProviderCache.set(sessionId, { type, expiresAt: Date.now() + CACHE_TTL_MS });
  return type;
}

/**
 * Invalidate the provider cache for a session.
 * Call this when the session's provider is changed (e.g. during migration).
 */
export function invalidateProviderCache(sessionId: string): void {
  sessionProviderCache.delete(sessionId);
}

/** Clear entire provider cache (e.g. on server restart) */
export function clearProviderCache(): void {
  sessionProviderCache.clear();
}

// ════════════════════════════════════════════════════════════
// MIGRATION HELPERS — For controlled rollout
// ════════════════════════════════════════════════════════════

/**
 * Migrate a single session from one provider to another.
 * Updates the DB and invalidates cache.
 *
 * @param sessionId - Session to migrate
 * @param toProvider - Target provider type
 * @param zapiConfig - Z-API credentials (required when migrating to zapi)
 */
export async function migrateSessionProvider(
  sessionId: string,
  toProvider: ProviderType,
  zapiConfig?: { instanceId: string; token: string; clientToken?: string }
): Promise<void> {
  if (toProvider === "zapi" && !zapiConfig) {
    throw new Error("[ProviderFactory] Z-API credentials required when migrating to zapi");
  }

  const updateData: Record<string, any> = {
    provider: toProvider,
  };

  if (toProvider === "zapi" && zapiConfig) {
    updateData.providerInstanceId = zapiConfig.instanceId;
    updateData.providerToken = zapiConfig.token;
    updateData.providerClientToken = zapiConfig.clientToken || null;

    // Register Z-API session
    registerZApiSession(sessionId, {
      instanceId: zapiConfig.instanceId,
      token: zapiConfig.token,
      clientToken: zapiConfig.clientToken,
    });
  } else {
    // Migrating back to evolution — clear Z-API fields
    updateData.providerInstanceId = null;
    updateData.providerToken = null;
    updateData.providerClientToken = null;
  }

  const dbConn3 = (await getDb())!;
  await dbConn3
    .update(whatsappSessions)
    .set(updateData)
    .where(eq(whatsappSessions.sessionId, sessionId));

  // Invalidate cache
  invalidateProviderCache(sessionId);

  console.log(`[ProviderFactory] Session "${sessionId}" migrated to "${toProvider}"`);
}

/**
 * Rollback a session to Evolution provider.
 * Quick helper for emergency rollback.
 */
export async function rollbackSessionToEvolution(sessionId: string): Promise<void> {
  await migrateSessionProvider(sessionId, "evolution");
}

/**
 * Get all sessions using a specific provider.
 * Useful for monitoring rollout progress.
 */
export async function getSessionsByProvider(providerType: ProviderType): Promise<string[]> {
  const dbConn4 = (await getDb())!;
  const sessions = await dbConn4
    .select({ sessionId: whatsappSessions.sessionId })
    .from(whatsappSessions)
    .where(eq(whatsappSessions.provider, providerType));

  return sessions.map((s: { sessionId: string }) => s.sessionId);
}

// ════════════════════════════════════════════════════════════
// OBSERVABILITY — Per-provider metrics
// ════════════════════════════════════════════════════════════

const metricsStore: Record<ProviderType, ProviderMetrics> = {
  evolution: createEmptyMetrics("evolution"),
  zapi: createEmptyMetrics("zapi"),
};

function createEmptyMetrics(provider: ProviderType): ProviderMetrics {
  return {
    provider,
    totalRequests: 0,
    totalErrors: 0,
    totalTimeouts: 0,
    avgLatencyMs: 0,
    lastError: null,
    lastErrorAt: null,
    operations: {},
  };
}

/**
 * Record a provider operation for metrics.
 * Call this from the instrumented wrapper (see observability phase).
 */
export function recordProviderMetric(
  provider: ProviderType,
  operation: string,
  latencyMs: number,
  error?: string
): void {
  const m = metricsStore[provider];
  if (!m) return;

  m.totalRequests++;
  m.avgLatencyMs = (m.avgLatencyMs * (m.totalRequests - 1) + latencyMs) / m.totalRequests;

  if (error) {
    m.totalErrors++;
    m.lastError = error;
    m.lastErrorAt = Date.now();
    if (error.includes("timeout") || error.includes("timed out")) {
      m.totalTimeouts++;
    }
  }

  // Per-operation
  if (!m.operations[operation]) {
    m.operations[operation] = { count: 0, errors: 0, avgLatencyMs: 0, lastLatencyMs: 0 };
  }
  const op = m.operations[operation];
  op.count++;
  op.lastLatencyMs = latencyMs;
  op.avgLatencyMs = (op.avgLatencyMs * (op.count - 1) + latencyMs) / op.count;
  if (error) op.errors++;
}

/** Get metrics for a specific provider */
export function getProviderMetrics(provider: ProviderType): ProviderMetrics {
  return { ...metricsStore[provider] };
}

/** Get metrics for all providers */
export function getAllProviderMetrics(): Record<ProviderType, ProviderMetrics> {
  return {
    evolution: getProviderMetrics("evolution"),
    zapi: getProviderMetrics("zapi"),
  };
}

/** Reset metrics (for testing) */
export function resetProviderMetrics(): void {
  metricsStore.evolution = createEmptyMetrics("evolution");
  metricsStore.zapi = createEmptyMetrics("zapi");
}

// ════════════════════════════════════════════════════════════
// INITIALIZATION — Load Z-API sessions from DB on startup
// ════════════════════════════════════════════════════════════

/**
 * Load all Z-API sessions from DB and register them.
 * Call this on server startup.
 */
export async function initializeProviderSessions(): Promise<void> {
  try {
    const dbConn5 = (await getDb())!;
    const zapiSessions = await dbConn5
      .select({
        sessionId: whatsappSessions.sessionId,
        providerInstanceId: whatsappSessions.providerInstanceId,
        providerToken: whatsappSessions.providerToken,
        providerClientToken: whatsappSessions.providerClientToken,
      })
      .from(whatsappSessions)
      .where(eq(whatsappSessions.provider, "zapi"));

    let registered = 0;
    for (const session of zapiSessions) {
      if (session.providerInstanceId && session.providerToken) {
        registerZApiSession(session.sessionId, {
          instanceId: session.providerInstanceId,
          token: session.providerToken,
          clientToken: session.providerClientToken || undefined,
        });
        registered++;
      }
    }

    console.log(`[ProviderFactory] Initialized ${registered} Z-API sessions from DB`);
  } catch (err) {
    console.error("[ProviderFactory] Failed to initialize Z-API sessions:", err);
  }
}
