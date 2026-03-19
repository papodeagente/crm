import { z } from "zod";
import { tenantProcedure, getTenantId, router } from "../_core/trpc";
import * as crm from "../crmDb";
import { emitEvent } from "../middleware/eventLog";

export const inboxRouter = router({
  // ─── CHANNELS ───
  channels: router({
    list: tenantProcedure
      
      .query(async ({ input, ctx }) => {
        return crm.listChannels(getTenantId(ctx));
      }),
    create: tenantProcedure
      .input(z.object({ type: z.enum(["whatsapp", "instagram", "email", "webchat"]), name: z.string().optional(), connectionId: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createChannel(input);
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
    create: tenantProcedure
      .input(z.object({ channelId: z.number(), contactId: z.number().optional(), providerThreadId: z.string().optional(), assignedToUserId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const result = await crm.createConversation(input);
        await emitEvent({ tenantId: getTenantId(ctx), actorUserId: ctx.user.id, entityType: "conversation", entityId: result?.id, action: "create" });
        return result;
      }),
    update: tenantProcedure
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
    send: tenantProcedure
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
});
