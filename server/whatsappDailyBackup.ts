/**
 * WhatsApp Daily Backup — Copia conversas do dia para o histórico do deal (deal_history)
 * 
 * Executa automaticamente todos os dias à meia-noite (00:05 horário de São Paulo).
 * Para cada deal que tem um contato com telefone, busca as mensagens WhatsApp do dia
 * e cria um registro no deal_history com o resumo da conversa.
 */

import { getDb } from "./db";
import { waMessages as messages, deals, contacts, dealHistory, whatsappSessions } from "../drizzle/schema";
import { eq, and, gte, lt, desc, sql, inArray } from "drizzle-orm";

const TIMEZONE = "America/Sao_Paulo";

/** Format a phone number to WhatsApp JID */
// Use centralized phone normalization
import { phoneToJid, getAllJidVariants } from "./phoneUtils";

/** Format timestamp to readable Brazilian format */
function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Get start and end of yesterday in UTC based on São Paulo timezone */
function getYesterdayRange(): { start: Date; end: Date } {
  // Get current time in São Paulo
  const now = new Date();
  const spFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  
  // Get yesterday's date in São Paulo
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = spFormatter.format(yesterday); // YYYY-MM-DD
  
  // Create start and end of yesterday in São Paulo timezone
  // We use a trick: create dates and adjust for timezone offset
  const start = new Date(`${yesterdayStr}T00:00:00-03:00`); // São Paulo is UTC-3
  const end = new Date(`${yesterdayStr}T23:59:59.999-03:00`);
  
  return { start, end };
}

/** Build conversation text from messages */
function buildConversationText(msgs: Array<{
  fromMe: boolean;
  content: string | null;
  timestamp: Date;
  messageType: string;
}>, contactName: string, myName: string): string {
  if (msgs.length === 0) return "";

  const lines: string[] = [];
  let lastDate = "";

  for (const msg of msgs) {
    const ts = new Date(msg.timestamp);
    const dateStr = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(ts);

    const timeStr = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
    }).format(ts);

    // Add date separator if new day
    if (dateStr !== lastDate) {
      if (lines.length > 0) lines.push("");
      lines.push(`── ${dateStr} ──`);
      lastDate = dateStr;
    }

    const sender = msg.fromMe ? myName : contactName;
    const contentText = msg.content || `[${msg.messageType}]`;
    lines.push(`[${timeStr}] ${sender}: ${contentText}`);
  }

  return lines.join("\n");
}

/** Run the daily backup for all active deals with WhatsApp contacts */
export async function runDailyWhatsAppBackup(): Promise<{ dealsProcessed: number; messagesBackedUp: number }> {
  const db = await getDb();
  if (!db) return { dealsProcessed: 0, messagesBackedUp: 0 };

  const { start, end } = getYesterdayRange();
  let dealsProcessed = 0;
  let messagesBackedUp = 0;

  try {
    // Get all active sessions
    const sessions = await db.select().from(whatsappSessions);
    if (!sessions.length) return { dealsProcessed: 0, messagesBackedUp: 0 };

    // Get all open deals that have a contactId
    const openDeals = await db.select({
      dealId: deals.id,
      dealTitle: deals.title,
      tenantId: deals.tenantId,
      contactId: deals.contactId,
    }).from(deals).where(eq(deals.status, "open"));

    for (const deal of openDeals) {
      if (!deal.contactId) continue;

      // Get the contact's phone number
      const contactRows = await db.select({
        name: contacts.name,
        phone: contacts.phone,
      }).from(contacts).where(eq(contacts.id, deal.contactId)).limit(1);

      const contact = contactRows[0];
      if (!contact?.phone) continue;

      // Get all possible JID variants for this phone (handles 9th digit discrepancy)
      const jidVariants = getAllJidVariants(contact.phone);

      // Find messages for this contact across all sessions in the date range
      for (const session of sessions) {
        const dayMessages = await db.select({
          fromMe: messages.fromMe,
          content: messages.content,
          timestamp: messages.timestamp,
          messageType: messages.messageType,
        }).from(messages).where(
          and(
            eq(messages.sessionId, session.sessionId),
            jidVariants.length === 1
              ? eq(messages.remoteJid, jidVariants[0])
              : inArray(messages.remoteJid, jidVariants),
            gte(messages.timestamp, start),
            lt(messages.timestamp, end),
          )
        ).orderBy(messages.timestamp);

        if (dayMessages.length === 0) continue;

        // Build conversation text
        const myName = session.pushName || "Eu";
        const conversationText = buildConversationText(dayMessages, contact.name, myName);

        // Format the date for the description
        const dateStr = new Intl.DateTimeFormat("pt-BR", {
          timeZone: TIMEZONE,
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(start);

        const sentCount = dayMessages.filter((m) => m.fromMe).length;
        const receivedCount = dayMessages.filter((m) => !m.fromMe).length;

        // Create deal_history entry
        await db.insert(dealHistory).values({
          tenantId: deal.tenantId,
          dealId: deal.dealId,
          action: "whatsapp_backup",
          description: `Backup de conversa WhatsApp — ${dateStr} — ${dayMessages.length} mensagens (${sentCount} enviadas, ${receivedCount} recebidas)`,
          actorName: "Sistema (Backup Automático)",
          metadataJson: {
            date: dateStr,
            contactName: contact.name,
            contactPhone: contact.phone,
            sessionId: session.sessionId,
            totalMessages: dayMessages.length,
            sentMessages: sentCount,
            receivedMessages: receivedCount,
            conversation: conversationText,
          },
        });

        dealsProcessed++;
        messagesBackedUp += dayMessages.length;
      }
    }

    return { dealsProcessed, messagesBackedUp };
  } catch (e) {
    console.error("Error in daily WhatsApp backup:", e);
    return { dealsProcessed, messagesBackedUp };
  }
}

/** Start the daily backup scheduler */
export function startDailyBackupScheduler() {
  // Calculate milliseconds until next 00:05 São Paulo time
  function msUntilNextRun(): number {
    const now = new Date();
    // Get current São Paulo time
    const spTime = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const currentHour = parseInt(spTime.find((p) => p.type === "hour")?.value || "0");
    const currentMinute = parseInt(spTime.find((p) => p.type === "minute")?.value || "0");

    // Target: 00:05 São Paulo time
    const targetHour = 0;
    const targetMinute = 5;

    let hoursUntil = targetHour - currentHour;
    let minutesUntil = targetMinute - currentMinute;

    if (hoursUntil < 0 || (hoursUntil === 0 && minutesUntil <= 0)) {
      hoursUntil += 24; // Next day
    }

    return (hoursUntil * 60 + minutesUntil) * 60 * 1000;
  }

  function scheduleNext() {
    const ms = msUntilNextRun();
    console.log(`[WhatsApp Backup] Próximo backup em ${Math.round(ms / 60000)} minutos`);

    setTimeout(async () => {
      console.log("[WhatsApp Backup] Iniciando backup diário...");
      try {
        const result = await runDailyWhatsAppBackup();
        console.log(`[WhatsApp Backup] Concluído: ${result.dealsProcessed} deals processados, ${result.messagesBackedUp} mensagens salvas no histórico`);
      } catch (e) {
        console.error("[WhatsApp Backup] Erro:", e);
      }
      // Schedule next run
      scheduleNext();
    }, ms);
  }

  scheduleNext();
  console.log("[WhatsApp Backup] Scheduler de backup diário iniciado");
}
