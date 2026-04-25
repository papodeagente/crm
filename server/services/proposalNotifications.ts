/**
 * Proposal-related WhatsApp notifications
 *
 * Sent automatically by:
 * - asaasWebhook (payment confirmed/received → thank-you message)
 * - asaasWebhook (overdue → reminder with new payment link)
 * - proposalFollowupScheduler (3+ days sent without payment → reminder)
 *
 * Tolerant by design: any failure logs and returns false; never throws,
 * so webhook handlers don't 500 because WhatsApp is down.
 */

import * as crm from "../crmDb";
import { getDb } from "../db";
import { whatsappSessions } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";

export type NotificationKind = "paid" | "overdue" | "followup";

interface AutomationFlags {
  whatsappAutoPaid?: boolean;
  whatsappAutoOverdue?: boolean;
  whatsappAutoFollowup?: boolean;
  whatsappFollowupDays?: number;
}

async function loadTenantAutomation(tenantId: number): Promise<AutomationFlags> {
  const db = await getDb();
  if (!db) return {};
  const { tenants } = await import("../../drizzle/schema");
  const rows = await db.select({ settingsJson: tenants.settingsJson })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const settings = (rows[0]?.settingsJson || {}) as any;
  return {
    whatsappAutoPaid: settings.whatsappAutoPaid !== false, // default: ON
    whatsappAutoOverdue: settings.whatsappAutoOverdue !== false, // default: ON
    whatsappAutoFollowup: settings.whatsappAutoFollowup !== false, // default: ON
    whatsappFollowupDays: typeof settings.whatsappFollowupDays === "number" ? settings.whatsappFollowupDays : 3,
  };
}

async function getActiveSession(tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(whatsappSessions)
    .where(and(eq(whatsappSessions.tenantId, tenantId), eq(whatsappSessions.status, "connected")))
    .limit(1);
  return rows[0] || null;
}

function firstName(full?: string | null): string {
  if (!full) return "";
  return full.trim().split(/\s+/)[0] || "";
}

function buildMessage(kind: NotificationKind, opts: {
  contactName?: string | null;
  clinicName: string;
  amount?: string;
  invoiceUrl?: string | null;
  proposalId: number;
}): string {
  const greeting = opts.contactName ? `Olá, ${firstName(opts.contactName)}!` : "Olá!";
  switch (kind) {
    case "paid":
      return [
        `${greeting} Confirmamos o recebimento do seu pagamento${opts.amount ? ` no valor de ${opts.amount}` : ""}.`,
        `Obrigado por confiar em nós. Em breve entraremos em contato para os próximos passos.`,
        `— ${opts.clinicName}`,
      ].join("\n\n");
    case "overdue":
      return [
        `${greeting} Notamos que o pagamento da proposta #${opts.proposalId} está em atraso.`,
        opts.invoiceUrl ? `Você pode regularizar pelo link abaixo:\n${opts.invoiceUrl}` : "Entre em contato para regularizar.",
        `Se já pagou, por favor desconsidere esta mensagem.`,
        `— ${opts.clinicName}`,
      ].join("\n\n");
    case "followup":
      return [
        `${greeting} Tudo bem? Passando para lembrar da proposta #${opts.proposalId}${opts.amount ? ` (${opts.amount})` : ""} que enviamos.`,
        opts.invoiceUrl ? `Quando puder, é só pagar pelo link:\n${opts.invoiceUrl}` : "Qualquer dúvida, é só chamar por aqui.",
        `Estamos à disposição!`,
        `— ${opts.clinicName}`,
      ].join("\n\n");
  }
}

function brl(cents?: number | null): string {
  if (!cents && cents !== 0) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export async function sendProposalWhatsAppNotification(
  tenantId: number,
  proposalId: number,
  kind: NotificationKind,
): Promise<{ sent: boolean; reason?: string }> {
  try {
    // 1. Check feature toggle
    const auto = await loadTenantAutomation(tenantId);
    const flag = kind === "paid" ? auto.whatsappAutoPaid
      : kind === "overdue" ? auto.whatsappAutoOverdue
      : auto.whatsappAutoFollowup;
    if (flag === false) return { sent: false, reason: "automation disabled" };

    // 2. Resolve proposal + deal + contact
    const proposal = await crm.getProposalById(tenantId, proposalId);
    if (!proposal) return { sent: false, reason: "proposal not found" };
    const deal = await crm.getDealById(tenantId, proposal.dealId);
    if (!deal?.contactId) return { sent: false, reason: "no contact on deal" };
    const contact = await crm.getContactById(tenantId, deal.contactId);
    if (!contact) return { sent: false, reason: "contact not found" };
    const phone = contact.phoneE164 || contact.phone || contact.phoneDigits;
    if (!phone) return { sent: false, reason: "contact has no phone" };

    // 3. Resolve session
    const session = await getActiveSession(tenantId);
    if (!session) return { sent: false, reason: "no connected WhatsApp session" };

    // 4. Build message
    const tenant = await crm.getTenantBranding(tenantId);
    const message = buildMessage(kind, {
      contactName: contact.name,
      clinicName: tenant?.name || "Clínica",
      amount: brl(proposal.totalCents),
      invoiceUrl: proposal.asaasInvoiceUrl,
      proposalId: proposal.id,
    });

    // 5. Send
    const { whatsappManager } = await import("../whatsappEvolution");
    await whatsappManager.sendTextMessage(session.sessionId, phone, message);

    return { sent: true };
  } catch (err: any) {
    console.error(`[ProposalNotif] Failed to send ${kind} for tenant ${tenantId}, proposal ${proposalId}:`, err.message || err);
    return { sent: false, reason: err.message || String(err) };
  }
}
