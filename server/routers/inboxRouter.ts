import { z } from "zod";
import { tenantProcedure, tenantWriteProcedure, getTenantId, router } from "../_core/trpc";
import * as crm from "../crmDb";
import { emitEvent } from "../middleware/eventLog";
import { getDb } from "../db";
import { createInternalNote } from "../db";
import { waMessages, crmUsers } from "../../drizzle/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { formatDate, formatTime, SYSTEM_TIMEZONE } from "../../shared/dateUtils";

export const inboxRouter = router({
  // ─── CHANNELS ───
  channels: router({
    list: tenantProcedure
      
      .query(async ({ input, ctx }) => {
        return crm.listChannels(getTenantId(ctx));
      }),
    create: tenantWriteProcedure
      .input(z.object({ type: z.enum(["whatsapp", "instagram", "email", "webchat"]), name: z.string().optional(), connectionId: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createChannel({ ...input, tenantId: getTenantId(ctx) });
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "channel", entityId: result?.id, action: "create" });
        return result;
      }),
  }),

  // ─── CONVERSATIONS ───
  conversations: router({
    list: tenantProcedure
      .input(z.object({ status: z.string().optional(), channelId: z.number().optional(), limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ input, ctx }) => {
        return crm.listConversations(getTenantId(ctx), input);
      }),
    get: tenantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return crm.getConversationById(getTenantId(ctx), input.id);
      }),
    create: tenantWriteProcedure
      .input(z.object({ channelId: z.number(), contactId: z.number().optional(), providerThreadId: z.string().optional(), assignedToUserId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createConversation({ ...input, tenantId: getTenantId(ctx) });
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "conversation", entityId: result?.id, action: "create" });
        return result;
      }),
    update: tenantWriteProcedure
      .input(z.object({ id: z.number(), status: z.enum(["open", "pending", "closed"]).optional(), assignedToUserId: z.number().optional(), assignedTeamId: z.number().optional(), priority: z.enum(["low", "medium", "high", "urgent"]).optional() }))
      .mutation(async ({ ctx, input }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
        await crm.updateConversation(tenantId, id, data);
        await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "conversation", entityId: id, action: "update" });
        return { success: true };
      }),
    count: tenantProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        return crm.countConversations(getTenantId(ctx), input.status);
      }),
  }),

  // ─── MESSAGES ───
  messages: router({
    list: tenantProcedure
      .input(z.object({ conversationId: z.number(), limit: z.number().default(100), offset: z.number().default(0) }))
      .query(async ({ input, ctx }) => {
        return crm.listInboxMessages(getTenantId(ctx), input.conversationId, input);
      }),
    send: tenantWriteProcedure
      .input(z.object({ conversationId: z.number(), bodyText: z.string().min(1), senderLabel: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createInboxMessage({
          tenantId: getTenantId(ctx),
          conversationId: input.conversationId,
          direction: "outbound",
          bodyText: input.bodyText,
          senderLabel: input.senderLabel || ctx.user.name || "Agent",
        });
        return result;
      }),
  }),
  // ─── IMPORT CONVERSATION AS NOTE ───
  importConversationAsNote: tenantWriteProcedure
    .input(z.object({
      sessionId: z.string(),
      remoteJid: z.string(),
      period: z.enum(["all", "last50", "24h", "48h"]),
      dealId: z.number().nullable().optional(),
      waConversationId: z.number().nullable().optional(),
      agentDisplayName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = getTenantId(ctx);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // ── Build time filter ──
      let timeFilter: ReturnType<typeof gte> | undefined;
      const now = new Date();
      if (input.period === "24h") {
        timeFilter = gte(waMessages.timestamp, new Date(now.getTime() - 24 * 60 * 60 * 1000));
      } else if (input.period === "48h") {
        timeFilter = gte(waMessages.timestamp, new Date(now.getTime() - 48 * 60 * 60 * 1000));
      }

      // ── Fetch messages from wa_messages (NO external API call) ──
      const conditions = [
        eq(waMessages.sessionId, input.sessionId),
        eq(waMessages.remoteJid, input.remoteJid),
        eq(waMessages.tenantId, tenantId),
      ];
      if (timeFilter) conditions.push(timeFilter);

      let query = db.select({
        id: waMessages.id,
        fromMe: waMessages.fromMe,
        senderAgentId: waMessages.senderAgentId,
        pushName: waMessages.pushName,
        messageType: waMessages.messageType,
        content: waMessages.content,
        mediaFileName: waMessages.mediaFileName,
        timestamp: waMessages.timestamp,
      })
        .from(waMessages)
        .where(and(...conditions))
        .orderBy(waMessages.timestamp);

      let messages: Awaited<typeof query>;
      if (input.period === "last50") {
        // Get last 50 messages (newest first, then reverse)
        const newest = await db.select({
          id: waMessages.id,
          fromMe: waMessages.fromMe,
          senderAgentId: waMessages.senderAgentId,
          pushName: waMessages.pushName,
          messageType: waMessages.messageType,
          content: waMessages.content,
          mediaFileName: waMessages.mediaFileName,
          timestamp: waMessages.timestamp,
        })
          .from(waMessages)
          .where(and(...conditions))
          .orderBy(desc(waMessages.timestamp))
          .limit(50);
        messages = newest.reverse();
      } else if (input.period === "all") {
        messages = await query.limit(5000);
      } else {
        messages = await query.limit(5000);
      }

      if (messages.length === 0) {
        return { success: false, error: "Nenhuma mensagem encontrada no período selecionado." };
      }

      // ── Resolve agent names for fromMe messages ──
      const agentIds = Array.from(new Set(messages.filter(m => m.fromMe && m.senderAgentId).map(m => m.senderAgentId!)));
      const agentMap = new Map<number, string>();
      if (agentIds.length > 0) {
        const agents = await db.select({ id: crmUsers.id, name: crmUsers.name })
          .from(crmUsers)
          .where(and(eq(crmUsers.tenantId, tenantId), sql`${crmUsers.id} IN (${sql.join(agentIds.map(id => sql`${id}`), sql`, `)})`));
        for (const a of agents) agentMap.set(a.id, a.name);
      }

      // ── Internal types to ignore ──
      const IGNORED_TYPES = new Set([
        "protocolMessage", "senderKeyDistributionMessage", "senderKeyDistribution",
        "reactionMessage", "reaction", "protocol", "messageContextInfo",
      ]);

      // ── Format messages in WhatsApp copy/paste style ──
      const defaultAgentName = input.agentDisplayName || ctx.user.name || "Agente";
      const lines: string[] = [];

      for (const msg of messages) {
        if (IGNORED_TYPES.has(msg.messageType)) continue;

        const time = formatTime(msg.timestamp);
        const date = formatDate(msg.timestamp);

        // Resolve sender name
        let sender: string;
        if (msg.fromMe) {
          sender = (msg.senderAgentId && agentMap.get(msg.senderAgentId)) || defaultAgentName;
        } else {
          sender = msg.pushName || input.remoteJid.replace("@s.whatsapp.net", "").replace(/^(\d{2})(\d+)/, "+$1$2");
        }

        // Resolve content based on messageType
        let content: string;
        const msgType = msg.messageType.toLowerCase();
        if (msgType === "text" || msgType === "conversation" || msgType === "extendedtextmessage" || msgType === "extended_text") {
          content = msg.content || "";
        } else if (msgType === "image" || msgType === "imagemessage") {
          content = "[Imagem]";
        } else if (msgType === "audio" || msgType === "audiomessage" || msgType === "ptt" || msgType === "pttmessage") {
          content = "[Áudio]";
        } else if (msgType === "video" || msgType === "videomessage") {
          content = "[Vídeo]";
        } else if (msgType === "document" || msgType === "documentmessage" || msgType === "documentwithcaptionmessage") {
          content = msg.mediaFileName ? `[Documento: ${msg.mediaFileName}]` : "[Documento]";
        } else if (msgType === "sticker" || msgType === "stickermessage") {
          content = "[Figurinha]";
        } else if (msgType === "location" || msgType === "locationmessage" || msgType === "liveLocationMessage") {
          content = "[Localização]";
        } else if (msgType === "contact" || msgType === "contactmessage" || msgType === "contactsarraymessage") {
          content = "[Contato]";
        } else {
          content = msg.content || `[${msg.messageType}]`;
        }

        if (content) {
          lines.push(`[${time}, ${date}] ${sender} : ${content}`);
        }
      }

      if (lines.length === 0) {
        return { success: false, error: "Nenhuma mensagem válida encontrada (apenas mensagens de sistema)." };
      }

      const noteBody = lines.join("\n\n");
      const firstMsg = messages.find(m => !IGNORED_TYPES.has(m.messageType));
      const titleDate = firstMsg ? `${formatDate(firstMsg.timestamp)} ${formatTime(firstMsg.timestamp)}` : formatDate(new Date());
      const noteTitle = `Conversa WhatsApp — ${titleDate}`;

      // ── Save as CRM note (deal) or internal note (conversation) ──
      if (input.dealId) {
        await crm.createNote({
          tenantId,
          entityType: "deal",
          entityId: input.dealId,
          body: `**${noteTitle}**\n\n${noteBody}`,
          createdByUserId: ctx.user.id,
        });
        // Also log in deal history
        await crm.createDealHistory({
          dealId: input.dealId,
          tenantId,
          action: "note",
          description: noteTitle,
          actorUserId: ctx.user.id,
          actorName: ctx.user.name || "Usuário",
          eventCategory: "note",
          eventSource: "user",
        });
      } else if (input.waConversationId) {
        await createInternalNote(
          tenantId,
          input.waConversationId,
          input.sessionId,
          input.remoteJid,
          ctx.user.id,
          `**${noteTitle}**\n\n${noteBody}`,
          undefined,
          "whatsapp_import",
        );
      } else {
        // Fallback: try to find waConversationId from messages
        return { success: false, error: "Nenhuma negociação ou conversa vinculada encontrada." };
      }

      return { success: true, messageCount: lines.length, title: noteTitle };
    }),
});
