/**
 * WhatsApp Session Status Scheduler
 *
 * Polla a Z-API a cada N minutos e reconcilia o `whatsapp_sessions.status` com
 * a realidade da instância. Cobre o caso em que:
 *   - O smartphone cai e volta rápido (webhook on-connection perdido)
 *   - Container reinicia e perde o estado em memória
 *   - Z-API derruba a instância silenciosamente
 *
 * Em qualquer transição (connected→disconnected ou vice-versa), grava
 * notification do tipo `whatsapp_disconnected` ou `whatsapp_connected` para
 * o tenant ser avisado em tempo real.
 *
 * NÃO substitui o webhook — é defesa em profundidade.
 */

import { sql } from "drizzle-orm";
import { getDb, rowsOf, createNotification } from "./db";

const CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 min
let intervalHandle: NodeJS.Timeout | null = null;

interface SessionRow {
  id: number;
  sessionId: string;
  tenantId: number;
  status: string | null;
  providerInstanceId: string | null;
  providerToken: string | null;
  providerClientToken: string | null;
}

async function pollZapiStatus(instanceId: string, token: string, clientToken: string | null): Promise<{ connected: boolean; smartphoneConnected: boolean } | null> {
  try {
    const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (clientToken) headers["Client-Token"] = clientToken;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const r = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const json = await r.json() as any;
    return {
      connected: !!json.connected,
      smartphoneConnected: !!json.smartphoneConnected,
    };
  } catch {
    return null;
  }
}

async function reconcileSession(row: SessionRow): Promise<void> {
  if (!row.providerInstanceId || !row.providerToken) return;
  const live = await pollZapiStatus(row.providerInstanceId, row.providerToken, row.providerClientToken);
  if (!live) return; // Z-API offline ou rate limit — não toca no DB

  const isLiveConnected = live.connected && live.smartphoneConnected;
  const dbConnected = row.status === "connected";
  if (isLiveConnected === dbConnected) return; // já está sincronizado

  const db = await getDb();
  if (!db) return;

  const newStatus = isLiveConnected ? "connected" : "disconnected";
  await db.execute(sql`
    UPDATE whatsapp_sessions SET status = ${newStatus}, "updatedAt" = NOW()
    WHERE id = ${row.id}
  `);

  // Notifica o tenant em qualquer transição
  if (row.tenantId) {
    try {
      if (isLiveConnected) {
        await createNotification(row.tenantId, {
          type: "whatsapp_connected",
          title: "WhatsApp reconectado",
          body: "A sessão do WhatsApp voltou a ficar online. Mensagens automáticas e atendimento liberados.",
          entityType: "whatsapp_session",
          entityId: row.sessionId,
        });
      } else {
        await createNotification(row.tenantId, {
          type: "whatsapp_disconnected",
          title: "WhatsApp desconectado",
          body: "Detectamos via health-check que a sessão do WhatsApp caiu. Mensagens automáticas estão pausadas. Acesse Configurações → WhatsApp para reconectar.",
          entityType: "whatsapp_session",
          entityId: row.sessionId,
        });
      }
    } catch (e: any) {
      console.warn(`[WaStatusSched] notify fail (${row.tenantId}):`, e?.message);
    }
  }

  console.log(`[WaStatusSched] tenant=${row.tenantId} session=${row.sessionId} ${row.status} → ${newStatus}`);
}

export async function runWhatsAppStatusSweep(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const r = await db.execute(sql`
      SELECT id, "sessionId", "tenantId", status,
             "providerInstanceId", "providerToken", "providerClientToken"
      FROM whatsapp_sessions
      WHERE provider = 'zapi' AND "providerInstanceId" IS NOT NULL
    `);
    const rows = rowsOf(r) as SessionRow[];
    if (rows.length === 0) return;
    await Promise.all(rows.map(reconcileSession));
  } catch (e: any) {
    console.error("[WaStatusSched] sweep crashed:", e?.message);
  }
}

export function startWhatsAppStatusScheduler() {
  if (intervalHandle) return;
  // Primeira execução em 30s (deixar boot completar)
  setTimeout(() => runWhatsAppStatusSweep().catch(e => console.error("[WaStatusSched] boot run fail:", e)), 30_000);
  intervalHandle = setInterval(() => {
    runWhatsAppStatusSweep().catch(e => console.error("[WaStatusSched] interval fail:", e));
  }, CHECK_INTERVAL_MS);
  console.log("[WaStatusSched] Scheduler started (sweep a cada 2 min)");
}

export function stopWhatsAppStatusScheduler() {
  if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
}
