/**
 * Provider Factory — Z-API Only
 *
 * All sessions use Z-API. The factory resolves credentials per session
 * and returns the instrumented Z-API provider.
 *
 * Evolution API has been fully removed from the system.
 */

import type { WhatsAppProvider, ProviderType, ProviderMetrics } from "./types";
import { zapiProvider, registerZApiSession, getZApiSession } from "./zapiProvider";
import { instrumentProvider } from "./instrumentedProvider";
import { getDb } from "../db";
import { whatsappSessions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ════════════════════════════════════════════════════════════
// PROVIDER REGISTRY — Z-API only
// ════════════════════════════════════════════════════════════

const instrumentedZapi = instrumentProvider(zapiProvider);

const providers: Record<string, WhatsAppProvider> = {
  zapi: instrumentedZapi,
  // "evolution" key kept as alias so old DB rows don't crash lookups
  evolution: instrumentedZapi,
};

/** Get provider by type — always returns Z-API */
export function getProvider(_type?: ProviderType | string): WhatsAppProvider {
  return instrumentedZapi;
}

/** Default provider is always zapi */
export function getDefaultProviderType(): ProviderType {
  return "zapi";
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
 * It checks the DB for Z-API credentials and registers them if needed.
 *
 * @param sessionId - The canonical session ID (e.g. "crm-1-2")
 * @returns The WhatsAppProvider (always Z-API)
 */
export async function resolveProviderForSession(sessionId: string): Promise<WhatsAppProvider> {
  // Check cache first
  const cached = sessionProviderCache.get(sessionId);
  if (cached && cached.expiresAt > Date.now()) {
    return instrumentedZapi;
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
    sessionProviderCache.set(sessionId, { type: "zapi", expiresAt: Date.now() + CACHE_TTL_MS });
    return instrumentedZapi;
  }

  // Ensure Z-API credentials are registered
  if (session.providerInstanceId && session.providerToken) {
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
  sessionProviderCache.set(sessionId, { type: "zapi", expiresAt: Date.now() + CACHE_TTL_MS });

  return instrumentedZapi;
}

/**
 * Resolve provider type for a session (without full provider instance).
 * Always returns "zapi".
 */
export async function resolveProviderTypeForSession(_sessionId: string): Promise<ProviderType> {
  return "zapi";
}

/**
 * Invalidate the provider cache for a session.
 * Call this when the session's credentials change.
 */
export function invalidateProviderCache(sessionId: string): void {
  sessionProviderCache.delete(sessionId);
}

/** Clear entire provider cache (e.g. on server restart) */
export function clearProviderCache(): void {
  sessionProviderCache.clear();
}

// ════════════════════════════════════════════════════════════
// MIGRATION HELPERS — Kept for backward compatibility
// ════════════════════════════════════════════════════════════

/**
 * Migrate a single session to Z-API (the only supported provider).
 * Updates the DB and invalidates cache.
 */
export async function migrateSessionProvider(
  sessionId: string,
  _toProvider: ProviderType,
  zapiConfig?: { instanceId: string; token: string; clientToken?: string }
): Promise<void> {
  const updateData: Record<string, any> = {
    provider: "zapi",
  };

  if (zapiConfig) {
    updateData.providerInstanceId = zapiConfig.instanceId;
    updateData.providerToken = zapiConfig.token;
    updateData.providerClientToken = zapiConfig.clientToken || null;

    registerZApiSession(sessionId, {
      instanceId: zapiConfig.instanceId,
      token: zapiConfig.token,
      clientToken: zapiConfig.clientToken,
    });
  }

  const dbConn3 = (await getDb())!;
  await dbConn3
    .update(whatsappSessions)
    .set(updateData)
    .where(eq(whatsappSessions.sessionId, sessionId));

  invalidateProviderCache(sessionId);

  console.log(`[ProviderFactory] Session "${sessionId}" configured with Z-API`);
}

/** @deprecated Evolution API removed — this is a no-op */
export async function rollbackSessionToEvolution(_sessionId: string): Promise<void> {
  console.warn("[ProviderFactory] rollbackSessionToEvolution is deprecated — Evolution API removed");
}

/**
 * Get all sessions using a specific provider.
 */
export async function getSessionsByProvider(_providerType: ProviderType): Promise<string[]> {
  const dbConn4 = (await getDb())!;
  const sessions = await dbConn4
    .select({ sessionId: whatsappSessions.sessionId })
    .from(whatsappSessions);

  return sessions.map((s: { sessionId: string }) => s.sessionId);
}

// ════════════════════════════════════════════════════════════
// OBSERVABILITY — Provider metrics (Z-API only)
// ════════════════════════════════════════════════════════════

const metricsStore: Record<string, ProviderMetrics> = {
  zapi: createEmptyMetrics("zapi"),
};

function createEmptyMetrics(provider: string): ProviderMetrics {
  return {
    provider: provider as ProviderType,
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
 */
export function recordProviderMetric(
  _provider: ProviderType,
  operation: string,
  latencyMs: number,
  error?: string
): void {
  const m = metricsStore.zapi;
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

/** Get metrics for Z-API provider */
export function getProviderMetrics(_provider?: ProviderType): ProviderMetrics {
  return { ...metricsStore.zapi };
}

/** Get metrics for all providers */
export function getAllProviderMetrics(): Record<string, ProviderMetrics> {
  return {
    zapi: getProviderMetrics("zapi"),
  };
}

/** Reset metrics (for testing) */
export function resetProviderMetrics(): void {
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
      .from(whatsappSessions);

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
