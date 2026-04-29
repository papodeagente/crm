/**
 * automationRuleWorker — varre regras de automação de mensagens diariamente
 * e enfileira envios em scheduled_messages.
 *
 * Como funciona:
 *   - Cada regra tem triggerField (birthDate/weddingDate/appointmentDate/followUpDate),
 *     offsetDays (negativo=antes, positivo=depois) e timeOfDay (HH:MM).
 *   - Para cada regra ativa, calcula a data-alvo do registro: targetDate = hoje + |offset|
 *     se "antes", ou hoje - offset se "depois". Em ambos os casos: targetDate = hoje - offsetDays.
 *   - Para birthDate/weddingDate (recorrência anual MM-DD), bate o MM-DD.
 *     Para appointmentDate/followUpDate (data exata), bate YYYY-MM-DD.
 *   - Cria scheduled_messages com scheduledAt = hoje at timeOfDay e registra
 *     em automation_rule_runs (UNIQUE evita duplicatas).
 *
 * Roda a cada 30 min e no boot. Idempotente: rodar múltiplas vezes no mesmo
 * dia não cria duplicatas (graças ao UNIQUE em (ruleId, targetType, targetId, runDate)).
 */

import { sql } from "drizzle-orm";
import { getDb, rowsOf } from "./db";
import { whatsappManager } from "./whatsappEvolution";

const RUN_INTERVAL_MS = 30 * 60 * 1000; // 30 min
let intervalHandle: NodeJS.Timeout | null = null;

interface AutomationRule {
  id: number;
  tenantId: number;
  name: string;
  triggerField: "birthDate" | "weddingDate" | "appointmentDate" | "followUpDate";
  offsetDays: number;
  timeOfDay: string; // HH:MM
  messageTemplate: string;
}

interface MatchTarget {
  contactId: number;
  contactName: string | null;
  phoneE164: string | null;
  phone: string | null;
  dealId?: number;
  dealTitle?: string;
}

function todayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function mmdd(d: Date): string {
  return d.toISOString().slice(5, 10); // MM-DD
}

function applyTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

/** "09:00" → Date hoje 09:00 */
function todayAt(timeOfDay: string): Date {
  const d = new Date();
  const [hh, mm] = (timeOfDay || "09:00").split(":").map(Number);
  d.setHours(hh || 9, mm || 0, 0, 0);
  return d;
}

async function findActiveSession(tenantId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const r = await db.execute(sql`
    SELECT "sessionId" FROM whatsapp_sessions
    WHERE "tenantId" = ${tenantId} AND status = 'connected'
    ORDER BY id ASC LIMIT 1
  `);
  return rowsOf(r)[0]?.sessionId || null;
}

async function findMatchingTargets(
  tenantId: number,
  rule: AutomationRule,
  targetDate: Date,
): Promise<MatchTarget[]> {
  const db = await getDb();
  if (!db) return [];

  if (rule.triggerField === "birthDate" || rule.triggerField === "weddingDate") {
    // Match anual: pega só MM-DD do contato
    const targetMmDd = mmdd(targetDate);
    const col = rule.triggerField; // "birthDate" ou "weddingDate"
    const r = await db.execute(sql`
      SELECT id, name, "phoneE164", phone
      FROM contacts
      WHERE "tenantId" = ${tenantId}
        AND ${sql.raw(`"${col}"`)} IS NOT NULL
        AND ${sql.raw(`"${col}"`)} <> ''
        AND (
          RIGHT(${sql.raw(`"${col}"`)}, 5) = ${targetMmDd}
          OR ${sql.raw(`"${col}"`)} = ${targetMmDd}
        )
        AND ("isDeleted" = false OR "isDeleted" IS NULL)
    `);
    return rowsOf(r).map((row: any) => ({
      contactId: row.id,
      contactName: row.name,
      phoneE164: row.phoneE164,
      phone: row.phone,
    }));
  }

  // Para deals: appointmentDate ou followUpDate
  const col = rule.triggerField;
  const targetYmd = ymd(targetDate);
  const r = await db.execute(sql`
    SELECT d.id AS "dealId", d.title AS "dealTitle", d."contactId",
           c.name AS "contactName", c."phoneE164", c.phone
    FROM deals d
    LEFT JOIN contacts c ON c.id = d."contactId"
    WHERE d."tenantId" = ${tenantId}
      AND d."contactId" IS NOT NULL
      AND ${sql.raw(`d."${col}"`)} IS NOT NULL
      AND DATE(${sql.raw(`d."${col}"`)}) = ${targetYmd}
      AND (d.status IS NULL OR d.status NOT IN ('lost', 'cancelled'))
  `);
  return rowsOf(r).map((row: any) => ({
    contactId: row.contactId,
    contactName: row.contactName,
    phoneE164: row.phoneE164,
    phone: row.phone,
    dealId: row.dealId,
    dealTitle: row.dealTitle,
  }));
}

function targetToJid(t: MatchTarget): string | null {
  const phone = (t.phoneE164 || t.phone || "").replace(/\D/g, "");
  if (!phone || phone.length < 10) return null;
  return `${phone}@s.whatsapp.net`;
}

async function processRule(rule: AutomationRule, runDateStr: string): Promise<{ created: number; skipped: number; errors: number }> {
  const stats = { created: 0, skipped: 0, errors: 0 };
  const db = await getDb();
  if (!db) return stats;

  // targetDate = hoje - offsetDays (offset negativo joga pro futuro = antes; positivo joga pro passado = depois)
  const targetDate = new Date();
  targetDate.setHours(0, 0, 0, 0);
  targetDate.setDate(targetDate.getDate() - rule.offsetDays);

  const targets = await findMatchingTargets(rule.tenantId, rule, targetDate);
  if (targets.length === 0) return stats;

  const sessionId = await findActiveSession(rule.tenantId);
  if (!sessionId) {
    console.warn(`[Automation] Tenant ${rule.tenantId} sem sessão WhatsApp ativa — pulando regra ${rule.id}`);
    return stats;
  }

  const scheduledAt = todayAt(rule.timeOfDay);
  // Se o horário já passou hoje, joga pra +5min pra disparar logo
  if (scheduledAt.getTime() < Date.now()) {
    scheduledAt.setTime(Date.now() + 5 * 60 * 1000);
  }

  const tenantBranding = await db.execute(sql`SELECT name FROM tenants WHERE id = ${rule.tenantId} LIMIT 1`);
  const clinicName = (rowsOf(tenantBranding)[0] as any)?.name || "";

  for (const t of targets) {
    const jid = targetToJid(t);
    if (!jid) { stats.skipped++; continue; }

    const fullName = t.contactName || "";
    const firstName = fullName.split(/\s+/)[0] || "";
    const dataFmt = `${String(targetDate.getDate()).padStart(2, "0")}/${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
    const message = applyTemplate(rule.messageTemplate, {
      nome: fullName,
      primeiroNome: firstName,
      clinica: clinicName,
      data: dataFmt,
      dealTitle: t.dealTitle || "",
    });

    const targetType = t.dealId ? "deal" : "contact";
    const targetId = t.dealId ?? t.contactId;

    try {
      // Insere primeiro o run (UNIQUE protege duplicata). Se já existe, pula.
      const runIns = await db.execute(sql`
        INSERT INTO automation_rule_runs ("ruleId", "tenantId", "targetType", "targetId", "runDate")
        VALUES (${rule.id}, ${rule.tenantId}, ${targetType}, ${targetId}, ${runDateStr})
        ON CONFLICT ("ruleId", "targetType", "targetId", "runDate") DO NOTHING
        RETURNING id
      `);
      const runRow = rowsOf(runIns)[0];
      if (!runRow) { stats.skipped++; continue; }

      // Insere scheduled_message
      const smIns = await db.execute(sql`
        INSERT INTO scheduled_messages ("tenantId", "sessionId", "remoteJid", content, "contentType", "scheduledAt", status, "createdBy")
        VALUES (${rule.tenantId}, ${sessionId}, ${jid}, ${message}, 'text', ${scheduledAt.toISOString()}, 'pending', NULL)
        RETURNING id
      `);
      const smId = (rowsOf(smIns)[0] as any)?.id;

      // Vincula run → scheduledMessage
      if (smId) {
        await db.execute(sql`UPDATE automation_rule_runs SET "scheduledMessageId" = ${smId} WHERE id = ${runRow.id}`);
        const { enqueueScheduledMessage } = await import("./scheduledMessageWorker");
        await enqueueScheduledMessage(smId, scheduledAt);
        stats.created++;
      }
    } catch (e: any) {
      console.error(`[Automation] Erro processando target ${targetType}:${targetId} regra ${rule.id}:`, e.message);
      stats.errors++;
    }
  }

  return stats;
}

export async function runAutomationSweep(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const runDateStr = ymd(todayLocal());

  try {
    const r = await db.execute(sql`
      SELECT id, "tenantId", name, "triggerField", "offsetDays", "timeOfDay", "messageTemplate"
      FROM automation_rules
      WHERE "isActive" = TRUE
    `);
    const rules = rowsOf(r) as AutomationRule[];
    if (rules.length === 0) return;

    let total = { created: 0, skipped: 0, errors: 0 };
    for (const rule of rules) {
      const stats = await processRule(rule, runDateStr);
      total.created += stats.created;
      total.skipped += stats.skipped;
      total.errors += stats.errors;
      if (stats.created > 0) {
        console.log(`[Automation] Regra "${rule.name}" (#${rule.id}): ${stats.created} mensagens enfileiradas`);
      }
    }
    if (total.created > 0 || total.errors > 0) {
      console.log(`[Automation] Sweep done: ${total.created} criadas, ${total.skipped} puladas, ${total.errors} erros`);
    }
  } catch (e: any) {
    console.error("[Automation] Sweep crashed:", e.message);
  }
}

export function initAutomationWorker() {
  if (intervalHandle) return;
  // Roda no boot e a cada 30 min
  setTimeout(() => runAutomationSweep().catch(e => console.error("[Automation] Boot sweep error:", e)), 30_000);
  intervalHandle = setInterval(() => {
    runAutomationSweep().catch(e => console.error("[Automation] Interval sweep error:", e));
  }, RUN_INTERVAL_MS);
  console.log("[Automation] Worker iniciado (sweep a cada 30 min)");
}

export function stopAutomationWorker() {
  if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
}
