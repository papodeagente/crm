import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as crm from "../crmDb";
import { emitEvent } from "../middleware/eventLog";

export const inboxRouter = router({
  // ─── CHANNELS ───
  channels: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return crm.listChannels(input.tenantId);
      }),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), type: z.enum(["whatsapp", "instagram", "email", "webchat"]), name: z.string().optional(), connectionId: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createChannel(input);
        await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "channel", entityId: result?.id, action: "create" });
        return result;
      }),
  }),

  // ─── CONVERSATIONS ───
  conversations: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), status: z.string().optional(), channelId: z.number().optional(), limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return crm.listConversations(input.tenantId, input);
      }),
    get: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .query(async ({ input }) => {
        return crm.getConversationById(input.tenantId, input.id);
      }),
    create: protectedProcedure
      .input(z.object({ tenantId: z.number(), channelId: z.number(), contactId: z.number().optional(), providerThreadId: z.string().optional(), assignedToUserId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createConversation(input);
        await emitEvent({ tenantId: input.tenantId, actorUserId: ctx.user.id, entityType: "conversation", entityId: result?.id, action: "create" });
        return result;
      }),
    update: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number(), status: z.enum(["open", "pending", "closed"]).optional(), assignedToUserId: z.number().optional(), assignedTeamId: z.number().optional(), priority: z.enum(["low", "medium", "high", "urgent"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        const { tenantId, id, ...data } = input;
        await crm.updateConversation(tenantId, id, data);
        await emitEvent({ tenantId, actorUserId: ctx.user.id, entityType: "conversation", entityId: id, action: "update" });
        return { success: true };
      }),
    count: protectedProcedure
      .input(z.object({ tenantId: z.number(), status: z.string().optional() }))
      .query(async ({ input }) => {
        return crm.countConversations(input.tenantId, input.status);
      }),
  }),

  // ─── MESSAGES ───
  messages: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number(), conversationId: z.number(), limit: z.number().default(100), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return crm.listInboxMessages(input.tenantId, input.conversationId, input);
      }),
    send: protectedProcedure
      .input(z.object({ tenantId: z.number(), conversationId: z.number(), bodyText: z.string().min(1), senderLabel: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createInboxMessage({
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          direction: "outbound",
          bodyText: input.bodyText,
          senderLabel: input.senderLabel || ctx.user.name || "Agent",
        });
        return result;
      }),
  }),
});
