/**
 * useInboxActions — Extracted tRPC mutations for conversation management.
 *
 * Wraps all action callbacks that were previously inline in Inbox.tsx:
 *   claimConversation, finishAttendance, assignConversation,
 *   updateAssignmentStatus, assignFromQueue, markConversationRead,
 *   syncContacts.
 *
 * Each mutation applies optimistic updates to the ConversationStore
 * and fires the appropriate callback so Inbox.tsx can refetch queries.
 */

import { useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useConversationStore, makeConvKey } from "./useConversationStore";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────

interface UseInboxActionsOptions {
  sessionId: string | null;
  myUserId: number;
  onConversationClaimed?: () => void;   // refetch queue + queue stats
  onAttendanceFinished?: () => void;
  onAssigned?: () => void;
  onConversationsChanged?: () => void;  // trigger refetch of conversations
}

interface UseInboxActionsResult {
  claimConversation: (remoteJid: string) => void;
  finishAttendance: (remoteJid: string) => void;
  assignConversation: (remoteJid: string, agentId: number | null) => void;
  updateAssignmentStatus: (remoteJid: string, status: "open" | "pending" | "resolved" | "closed") => void;
  assignFromQueue: (remoteJid: string, agentId: number) => void;
  markConversationRead: (remoteJid: string, conversationId?: number) => void;
  syncContacts: () => void;
  isClaimPending: boolean;
  isFinishPending: boolean;
  isSyncContactsPending: boolean;
}

// ── Hook ───────────────────────────────────────────────

export function useInboxActions(opts: UseInboxActionsOptions): UseInboxActionsResult {
  const {
    sessionId,
    myUserId,
    onConversationClaimed,
    onAttendanceFinished,
    onAssigned,
    onConversationsChanged,
  } = opts;

  const convStore = useConversationStore();

  // ── 1. Claim conversation from queue ──────────────────

  const claimMutation = trpc.whatsapp.queue.claim.useMutation({
    onSuccess: (_data, variables) => {
      // Optimistic: show conversation in "mine" tab immediately
      const key = makeConvKey(variables.sessionId, variables.remoteJid);
      convStore.updateAssignment(key, {
        assignedUserId: myUserId,
        assignmentStatus: "open",
      });

      onConversationClaimed?.();

      // Delay refetch to avoid overwriting the optimistic update with stale DB data
      setTimeout(() => onConversationsChanged?.(), 2500);

      toast.success("Conversa atribuída a você");
    },
    onError: (e) => toast.error(e.message || "Erro ao puxar conversa"),
  });

  // ── 2. Finish attendance ──────────────────────────────

  const finishMut = trpc.whatsapp.finishAttendance.useMutation({
    onSuccess: (_data, variables) => {
      // Optimistic: remove from "mine" tab
      const key = makeConvKey(variables.sessionId, variables.remoteJid);
      convStore.updateAssignment(key, {
        assignedUserId: null,
        assignmentStatus: "resolved",
      });

      onAttendanceFinished?.();
      toast.success("Atendimento finalizado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao finalizar"),
  });

  // ── 3. Assign conversation to agent ───────────────────

  const assignMutation = trpc.whatsapp.assignConversation.useMutation({
    onSuccess: () => {
      onAssigned?.();
      toast.success("Conversa atribuída com sucesso");
    },
    onError: (e) => toast.error(e.message || "Erro ao atribuir conversa"),
  });

  // ── 4. Update assignment status ───────────────────────

  const updateStatusMutation = trpc.whatsapp.updateAssignmentStatus.useMutation({});

  // ── 5. Admin: assign from queue to specific agent ─────

  const assignFromQueueMut = trpc.whatsapp.supervision.assignToAgent.useMutation({
    onSuccess: () => {
      onConversationClaimed?.();
      toast.success("Conversa atribuída ao agente");
    },
    onError: (e) => toast.error(e.message || "Erro ao atribuir"),
  });

  // ── 6. Mark conversation as read + sync on open ──────

  const markReadMut = trpc.whatsapp.markRead.useMutation({
    // No full refetch — unreadCount already set to 0 optimistically
  });

  const syncOnOpenMut = trpc.whatsapp.syncOnOpen.useMutation();

  // ── 7. Sync WA contacts ──────────────────────────────

  const syncContactsMut = trpc.whatsapp.syncContacts.useMutation({
    onSuccess: (data: any) => {
      const resolvedMsg = data.resolved > 0 ? ` (${data.resolved} LIDs resolvidos)` : "";
      toast.success(`Contatos sincronizados: ${data.synced}/${data.total}${resolvedMsg}`);
    },
    onError: (e) => toast.error(e.message || "Erro ao sincronizar contatos"),
  });

  // ── Wrapped callbacks ─────────────────────────────────

  const claimConversation = useCallback(
    (remoteJid: string) => {
      if (!sessionId) return;
      claimMutation.mutate({ sessionId, remoteJid });
    },
    [sessionId, claimMutation],
  );

  const finishAttendance = useCallback(
    (remoteJid: string) => {
      if (!sessionId) return;
      finishMut.mutate({ sessionId, remoteJid });
    },
    [sessionId, finishMut],
  );

  const assignConversation = useCallback(
    (remoteJid: string, agentId: number | null) => {
      if (!sessionId) return;
      assignMutation.mutate({ sessionId, remoteJid, assignedUserId: agentId });
    },
    [sessionId, assignMutation],
  );

  const updateAssignmentStatus = useCallback(
    (remoteJid: string, status: "open" | "pending" | "resolved" | "closed") => {
      if (!sessionId) return;
      updateStatusMutation.mutate({ sessionId, remoteJid, status });
    },
    [sessionId, updateStatusMutation],
  );

  const assignFromQueue = useCallback(
    (remoteJid: string, agentId: number) => {
      if (!sessionId) return;
      assignFromQueueMut.mutate({ sessionId, remoteJid, agentId });
    },
    [sessionId, assignFromQueueMut],
  );

  const markConversationRead = useCallback(
    (remoteJid: string, conversationId?: number) => {
      if (!sessionId) return;

      const key = makeConvKey(sessionId, remoteJid);

      // Optimistic: zero unread count instantly (O(1), no refetch)
      convStore.markRead(key);

      // Persist to server
      markReadMut.mutate({ sessionId, remoteJid });

      // Lightweight sync: fetch last messages on conversation open
      if (conversationId) {
        syncOnOpenMut.mutate(
          { sessionId, remoteJid, conversationId },
          {
            onSuccess: (r) => {
              // Only re-hydrate if new messages were inserted during sync
              if (r.inserted > 0) {
                onConversationsChanged?.();
              }
            },
          },
        );
      }
    },
    [sessionId, convStore, markReadMut, syncOnOpenMut, onConversationsChanged],
  );

  const syncContacts = useCallback(() => {
    if (!sessionId) return;
    syncContactsMut.mutate({ sessionId });
  }, [sessionId, syncContactsMut]);

  // ── Return ────────────────────────────────────────────

  return {
    claimConversation,
    finishAttendance,
    assignConversation,
    updateAssignmentStatus,
    assignFromQueue,
    markConversationRead,
    syncContacts,
    isClaimPending: claimMutation.isPending,
    isFinishPending: finishMut.isPending,
    isSyncContactsPending: syncContactsMut.isPending,
  };
}
