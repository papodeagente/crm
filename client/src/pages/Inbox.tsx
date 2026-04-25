import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { useConversationStore, makeConvKey, getJidFromKey } from "@/hooks/useConversationStore";
import type { ConvEntry } from "@/hooks/useConversationStore";
import WhatsAppChat from "@/components/WhatsAppChat";
import {
  Search, MessageSquare, MoreVertical, ArrowLeft,
  Plus, X, Volume2, VolumeX,
  UserPlus, Loader2,
  MessageCircle,
  WifiOff, RefreshCw, CheckCircle2,
  Contact2, LayoutGrid,
  Timer,
  PanelRightOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import { Inbox as InboxIcon, ListOrdered } from "lucide-react";

/* ─── Extracted components ─── */
import { playNotification, MUTE_KEY } from "@/components/inbox/NotificationSound";
import ConversationItem, {
  WaAvatar, UrgencyTimer,
  formatPhoneNumber, getMessagePreview,
  type ConvItem,
} from "@/components/inbox/ConversationItem";
import CreateContactDialog from "@/components/inbox/CreateContactDialog";
import CreateDealDialog from "@/components/inbox/CreateDealDialog";
import NewChatPanel from "@/components/inbox/NewChatPanel";
import { EmptyChat, NoSession } from "@/components/inbox/EmptyStates";
import ContactDetailsSidebar from "@/components/inbox/ContactDetailsSidebar";

/* ═══════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   MAIN INBOX PAGE
   ═══════════════════════════════════════════════════════ */

type InboxTab = "mine" | "queue" | "contacts" | "all" | "finished";
type AgentFilter = "all" | "unread" | "mine" | "unassigned";

export default function InboxPage() {
  const trpcUtils = trpc.useUtils();
  const { lastMessage, lastStatusUpdate, lastConversationUpdate, isConnected: socketConnected } = useSocket();
  // selectedKey = conversationKey (sessionId:remoteJid) — primary selection state
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // selectedJid = remoteJid only — derived for API calls that need just the JID
  const selectedJid = selectedKey ? getJidFromKey(selectedKey) : null;
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [activeTab, setActiveTab] = useState<InboxTab>("mine");
  const [filter, setFilter] = useState<AgentFilter>("all");
  const isAdmin = useIsAdmin();
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) === "true"; } catch { return false; }
  });
  const DETAILS_KEY = "inbox.detailsSidebarOpen";
  const [detailsOpen, setDetailsOpen] = useState(() => {
    try { return localStorage.getItem(DETAILS_KEY) !== "false"; } catch { return true; }
  });
  const selectedKeyRef = useRef<string | null>(null);
  // Keep ref in sync with state so socket handler closure always has the latest value
  selectedKeyRef.current = selectedKey;
  const prevMessageRef = useRef<typeof lastMessage>(null);
  // Suppress notification sounds temporarily when opening a conversation
  // This prevents sounds from firing during message hydration/syncOnOpen
  const soundSuppressedUntilRef = useRef<number>(0);
  // Track processed message signatures to avoid duplicate sounds
  const processedMsgRef = useRef<Set<string>>(new Set());

  // ─── Data queries ───
  const sessionsQ = trpc.whatsapp.sessions.useQuery();
  // Find connected session first, otherwise use any session for offline history viewing
  const activeSession = useMemo(
    () => {
      const sessions = sessionsQ.data || [];
      const connected = sessions.find((s: any) => s.liveStatus === "connected");
      if (connected) return connected;
      // Fallback: use first session from DB so we can still show conversation history
      return sessions.length > 0 ? sessions[0] : undefined;
    },
    [sessionsQ.data]
  );
  const isConnected = useMemo(
    () => (sessionsQ.data || []).some((s: any) => s.liveStatus === "connected"),
    [sessionsQ.data]
  );

  // ─── Deterministic Conversation Store ───
  // Socket is the source of truth. Initial load from server, then all updates via socket.
  const convStore = useConversationStore();
  const hydrationDoneRef = useRef(false);

  // Initial load only — fetch conversations once from server
  const conversationsQ = trpc.whatsapp.waConversations.useQuery(
    { sessionId: activeSession?.sessionId || ""},
    { enabled: !!activeSession?.sessionId && !hydrationDoneRef.current, staleTime: Infinity, refetchInterval: false, refetchOnWindowFocus: false }
  );

  // Hydrate store from initial server data (runs once)
  useEffect(() => {
    if (conversationsQ.data && !hydrationDoneRef.current) {
      convStore.hydrate(conversationsQ.data as ConvEntry[]);
      hydrationDoneRef.current = true;
    }
  }, [conversationsQ.data]);

  // Periodic background sync — only when socket is DISCONNECTED (fallback)
  // When socket is connected, the store is updated in real-time via socket events.
  const bgSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!activeSession?.sessionId || !hydrationDoneRef.current) return;
    // Clear any existing interval
    if (bgSyncRef.current) clearInterval(bgSyncRef.current);

    // RECONCILIATION STRATEGY:
    // - Socket disconnected: aggressive polling every 15s to catch up
    // - Socket connected: lightweight reconciliation every 60s to fix any drift
    //   (e.g., missed socket events, race conditions, stale preview/status)
    const interval = socketConnected ? 60000 : 15000;
    bgSyncRef.current = setInterval(() => {
      conversationsQ.refetch().then((result) => {
        if (result.data) {
          convStore.hydrate(result.data as ConvEntry[]);
        }
      });
    }, interval);

    return () => { if (bgSyncRef.current) clearInterval(bgSyncRef.current); };
  }, [activeSession?.sessionId, socketConnected]);

  // Agents list for assignment
  const agentsQ = trpc.whatsapp.agents.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const agents = useMemo(() => (agentsQ.data || []) as Array<{ id: number; name: string; email: string; avatarUrl?: string | null; status: string }>, [agentsQ.data]);

  // Queue conversations
  const queueQ = trpc.whatsapp.queue.list.useQuery(
    { sessionId: activeSession?.sessionId || "", limit: 100 },
    { enabled: !!activeSession?.sessionId && (activeTab === "queue" || activeTab === "all"), refetchInterval: socketConnected ? 30000 : 20000, staleTime: 10000, refetchIntervalInBackground: false }
  );
  const queueStatsQ = trpc.whatsapp.queue.stats.useQuery(
    { sessionId: activeSession?.sessionId || "" },
    { enabled: !!activeSession?.sessionId, refetchInterval: socketConnected ? 60000 : 30000, staleTime: 15000, refetchIntervalInBackground: false }
  );
  const claimMutation = trpc.whatsapp.queue.claim.useMutation({
    onSuccess: (_data, variables) => {
      queueQ.refetch(); queueStatsQ.refetch();
      // Optimistically update convStore so the conversation appears in "mine" tab immediately
      const key = makeConvKey(variables.sessionId, variables.remoteJid);
      convStore.updateAssignment(key, {
        assignedUserId: myUserId,
        assignmentStatus: "open",
      });
      // Delay refetch to avoid overwriting the optimistic update with stale DB data
      setTimeout(() => conversationsQ.refetch(), 2500);
      toast.success("Conversa atribuída a você");
    },
    onError: (e) => toast.error(e.message || "Erro ao puxar conversa"),
  });

  // Auto-open agent assignment dropdown in WhatsAppChat
  const [autoOpenAssign, setAutoOpenAssign] = useState(false);

  // Assign from queue to specific agent (admin only)
  const [assigningQueueJid, setAssigningQueueJid] = useState<string | null>(null);
  const [selectedAgentForQueue, setSelectedAgentForQueue] = useState<number | null>(null);
  const assignFromQueueMut = trpc.whatsapp.supervision.assignToAgent.useMutation({
    onSuccess: () => {
      queueQ.refetch(); queueStatsQ.refetch();
      toast.success("Conversa atribuída ao agente");
      setAssigningQueueJid(null); setSelectedAgentForQueue(null);
    },
    onError: (e) => toast.error(e.message || "Erro ao atribuir"),
  });

  // Finish attendance mutation
  const finishMut = trpc.whatsapp.finishAttendance.useMutation({
    onSuccess: (_data, variables) => {
      queueStatsQ.refetch();
      // Optimistically update convStore so the conversation disappears from "mine" tab immediately
      const key = makeConvKey(variables.sessionId, variables.remoteJid);
      convStore.updateAssignment(key, {
        assignedUserId: null,
        assignmentStatus: "resolved",
      });
      toast.success("Atendimento finalizado");
      setSelectedKey(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao finalizar"),
  });

  const handleFinishAttendance = useCallback((remoteJid: string) => {
    if (!activeSession?.sessionId) return;
    finishMut.mutate({ sessionId: activeSession.sessionId, remoteJid});
  }, [activeSession?.sessionId, finishMut]);

  // WA Contacts for Contacts tab (reuse waContactsMap but as a list)
  const waContactsForTabQ = trpc.whatsapp.waContactsMap.useQuery(
    { sessionId: activeSession?.sessionId || "" },
    { enabled: !!activeSession?.sessionId && activeTab === "contacts", staleTime: 5 * 60 * 1000 }
  );
  const waContactsList = useMemo(() => {
    const map = waContactsForTabQ.data || {};
    return Object.entries(map)
      .map(([jid, c]) => ({
        jid,
        phoneNumber: c.phoneNumber,
        pushName: c.pushName,
        savedName: c.savedName,
        verifiedName: c.verifiedName,
        displayName: c.savedName || c.verifiedName || c.pushName || formatPhoneNumber(jid),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [waContactsForTabQ.data]);

  // Assignment mutations
  const assignMutation = trpc.whatsapp.assignConversation.useMutation({
    onSuccess: () => { queueQ.refetch(); queueStatsQ.refetch(); toast.success("Conversa atribuída com sucesso"); },
    onError: (e) => toast.error(e.message || "Erro ao atribuir conversa"),
  });
  const updateStatusMutation = trpc.whatsapp.updateAssignmentStatus.useMutation({});

  const contactsQ = trpc.crm.contacts.list.useQuery(
    { limit: 500 },
    { enabled: true, staleTime: 5 * 60 * 1000 }
  );

  // Profile pictures — derive from store (no dependency on conversationsQ.data)
  const convJids = useMemo(() => {
    return convStore.sortedIds.map(key => getJidFromKey(key));
  }, [convStore.sortedIds]);

  // Fetch profile pics from DB (fast query, no API calls) — can handle more
  const visibleJids = useMemo(() => convJids.slice(0, 100), [convJids]);
  const profilePicsQ = trpc.whatsapp.profilePictures.useQuery(
    { sessionId: activeSession?.sessionId || "", jids: visibleJids },
    { enabled: !!activeSession?.sessionId && visibleJids.length > 0, staleTime: 60_000, refetchInterval: 30_000, refetchIntervalInBackground: false }
  );

  const profilePicMap = useMemo(() => (profilePicsQ.data || {}) as Record<string, string | null>, [profilePicsQ.data]);

  // WA Contacts map (LID ↔ Phone resolution from Baileys contacts sync)
  const waContactsMapQ = trpc.whatsapp.waContactsMap.useQuery(
    { sessionId: activeSession?.sessionId || "" },
    { enabled: !!activeSession?.sessionId, staleTime: 10 * 60 * 1000, refetchInterval: false }
  );
  const waContactsMap = useMemo(() => (waContactsMapQ.data || {}) as Record<string, { phoneNumber: string | null; pushName: string | null; savedName: string | null; verifiedName: string | null }>, [waContactsMapQ.data]);

  // Sync contacts mutation
  const syncContactsMut = trpc.whatsapp.syncContacts.useMutation({
    onSuccess: (data: any) => {
      waContactsMapQ.refetch();
      const resolvedMsg = data.resolved > 0 ? ` (${data.resolved} LIDs resolvidos)` : "";
      toast.success(`Contatos sincronizados: ${data.synced}/${data.total}${resolvedMsg}`);
    },
    onError: (e) => toast.error(e.message || "Erro ao sincronizar contatos"),
  });

  // PushName map from store (instant, no conversationsQ dependency)
  const pushNameMap = useMemo(() => {
    const map = new Map<string, string>();
    Array.from(convStore.conversationMap.entries()).forEach(([key, conv]) => {
      const jid = getJidFromKey(key);
      if (conv.contactPushName) map.set(jid, conv.contactPushName);
    });
    return map;
  }, [convStore.version]);

  // Mark as read
  const markRead = trpc.whatsapp.markRead.useMutation({
    // Part 8: No full refetch — unreadCount already set to 0 optimistically in handleSelectConv
  });

  // Contact name map (CRM phone → contact info)
  const contactNameMap = useMemo(() => {
    const map = new Map<string, { id: number; name: string; phone: string; email?: string; avatarUrl?: string }>();
    for (const c of (((contactsQ.data as any)?.items || contactsQ.data || []) as any[])) {
      if (c.phone) {
        const cleaned = c.phone.replace(/\D/g, "");
        const entry = { id: c.id, name: c.name, phone: c.phone, email: c.email || undefined, avatarUrl: undefined };
        map.set(cleaned, entry);
        if (cleaned.startsWith("55")) map.set(cleaned.substring(2), entry);
        else map.set(`55${cleaned}`, entry);
      }
    }
    return map;
  }, [contactsQ.data]);

  const getContactForJid = useCallback((jid: string) => {
    const phone = jid.split("@")[0];
    const directMatch = contactNameMap.get(phone);
    if (directMatch) return directMatch;
    // For LID JIDs, resolve via waContactsMap to get the real phone number
    if (jid.endsWith("@lid")) {
      const waContact = waContactsMap[jid];
      if (waContact?.phoneNumber) {
        const resolvedPhone = waContact.phoneNumber.split("@")[0];
        return contactNameMap.get(resolvedPhone) || null;
      }
    }
    return null;
  }, [contactNameMap, waContactsMap]);

  const isRealName = useCallback((name: string | null | undefined): boolean => {
    if (!name || !name.trim()) return false;
    const cleaned = name.replace(/[\s\-\(\)\+]/g, "");
    return !/^\d+$/.test(cleaned);
  }, []);

  const getDisplayName = useCallback((jid: string, conv?: ConvItem) => {
    // 1. CRM contact match — only use if the name is a real name (not just a phone number)
    const contact = getContactForJid(jid);
    if (contact && isRealName(contact.name)) return contact.name;
    // 2. contactName from wa_conversations JOIN with contacts table
    if (conv?.contactName && isRealName(conv.contactName)) return conv.contactName;
    // 3. WA Contacts map (savedName > verifiedName > pushName)
    const waContact = waContactsMap[jid];
    if (waContact) {
      if (isRealName(waContact.savedName)) return waContact.savedName!;
      if (isRealName(waContact.verifiedName)) return waContact.verifiedName!;
      if (isRealName(waContact.pushName)) return waContact.pushName!;
    }
    // 4. PushName from conversation data (contactPushName in wa_conversations)
    const pushName = pushNameMap.get(jid);
    if (isRealName(pushName)) return pushName!;
    // 5. CRM contact name as fallback (even if it's a phone number, it's still better than raw JID)
    if (contact) return contact.name;
    // 6. For LID JIDs, try to show a resolved phone number instead of the LID
    if (jid.endsWith("@lid")) {
      if (waContact?.phoneNumber) return formatPhoneNumber(waContact.phoneNumber);
      return "Cliente WhatsApp";
    }
    // 7. Format the phone number from the JID
    return formatPhoneNumber(jid);
  }, [getContactForJid, pushNameMap, waContactsMap, isRealName]);

  // ─── Socket → Deterministic Store (instant updates) ───
  // Socket is the ONLY source of truth for conversation list updates.
  // No refetch, no polling, no full sort. Target: < 20ms per update.
  useEffect(() => {
    if (!lastMessage) return;
    const _traceReceiveTime = Date.now();
    const _traceEmitAt = (lastMessage as any)._traceEmitAt;
    const _traceMsgId = (lastMessage as any).messageId || 'N/A';
    console.log(`[TRACE][FRONTEND_SOCKET_RECEIVED] timestamp: ${_traceReceiveTime} | delta_from_emit: ${_traceEmitAt ? _traceReceiveTime - _traceEmitAt : 'N/A'}ms | msgId: ${_traceMsgId} | remoteJid: ${lastMessage.remoteJid?.substring(0, 15)}`);

    // ── Validation — ignore events without required fields ──
    if (!lastMessage.remoteJid || !lastMessage.timestamp) {
      console.log(`[TRACE][FILTER_DROPPED] reason: missing_fields | remoteJid: ${lastMessage.remoteJid} | timestamp: ${lastMessage.timestamp} | msgId: ${_traceMsgId}`);
      prevMessageRef.current = lastMessage;
      return;
    }

    // ── Strict Message Ownership — validate sessionId matches active session ──
    const currentSessionId = activeSession?.sessionId || "";
    if (lastMessage.sessionId && currentSessionId && lastMessage.sessionId !== currentSessionId) {
      console.log(`[TRACE][FILTER_DROPPED] reason: session_mismatch | msg_session: ${lastMessage.sessionId} | active_session: ${currentSessionId} | msgId: ${_traceMsgId}`);
      prevMessageRef.current = lastMessage;
      return;
    }

    // Skip non-inbox event types from preview update
    const previewSkipTypes = [
      'protocolMessage', 'senderKeyDistributionMessage', 'messageContextInfo',
      'ephemeralMessage', 'reactionMessage', 'editedMessage',
      'deviceSentMessage', 'bcallMessage', 'callLogMesssage',
      'keepInChatMessage', 'encReactionMessage', 'viewOnceMessageV2Extension',
    ];
    if (previewSkipTypes.includes(lastMessage.messageType)) {
      prevMessageRef.current = lastMessage;
      return;
    }

    // Skip group messages
    if (lastMessage.remoteJid?.endsWith('@g.us')) {
      prevMessageRef.current = lastMessage;
      return;
    }

    // ── INSTANT UPDATE via deterministic store ──
    // handleMessage: O(1) map update + O(n) splice for moveToTop
    // No full sort, no refetch, no cache invalidation
    const _traceStoreStart = Date.now();
    // CRITICAL: Use content directly from socket event — backend guarantees it matches DB preview.
    // No more frontend-side preview generation that could diverge from the DB.
    const handled = convStore.handleMessage({
      sessionId: lastMessage.sessionId || currentSessionId,
      remoteJid: lastMessage.remoteJid,
      content: lastMessage.content || getMessagePreview(null, lastMessage.messageType),
      fromMe: lastMessage.fromMe,
      messageType: lastMessage.messageType,
      timestamp: lastMessage.timestamp,
      status: (lastMessage as any).status,  // Backend now sends status in socket event
      isSync: (lastMessage as any).isSync,
      messageId: lastMessage.messageId || undefined,  // Track which message the lastStatus belongs to
      pushName: (lastMessage as any).pushName || undefined,
    }, selectedKeyRef.current);
    const _traceStoreEnd = Date.now();
    console.log(`[TRACE][STORE_UPDATED] timestamp: ${_traceStoreEnd} | delta: ${_traceStoreEnd - _traceStoreStart}ms | handled: ${handled} | msgId: ${_traceMsgId}`);
    console.log(`[TRACE][TOTAL_FRONTEND] timestamp: ${_traceStoreEnd} | total_frontend_processing: ${_traceStoreEnd - _traceReceiveTime}ms | total_from_emit: ${_traceEmitAt ? _traceStoreEnd - _traceEmitAt : 'N/A'}ms | msgId: ${_traceMsgId}`);

    // If conversation is new (not in store), do a one-time fetch
    if (!handled) {
      console.log(`[TRACE][NEW_CONV_REFETCH] timestamp: ${Date.now()} | msgId: ${_traceMsgId} — conversation not in store, triggering refetch`);
      conversationsQ.refetch().then((result) => {
        if (result.data) convStore.hydrate(result.data as ConvEntry[]);
        console.log(`[TRACE][NEW_CONV_REFETCH_DONE] timestamp: ${Date.now()} | msgId: ${_traceMsgId}`);
      });
      // Refresh contacts map so new contact name/picture show immediately
      waContactsMapQ.refetch();
    }

    // ────────────────────────────────────────────────────────────────────────────────
    // Notification Sound Guards
    // ────────────────────────────────────────────────────────────────────────────────
    const msgSig = `${lastMessage.remoteJid}:${lastMessage.content}:${lastMessage.timestamp}`;

    // Guard 1: Skip duplicate messages
    if (processedMsgRef.current.has(msgSig)) {
      prevMessageRef.current = lastMessage;
      return;
    }
    if (processedMsgRef.current.size > 100) processedMsgRef.current.clear();
    processedMsgRef.current.add(msgSig);

    // Guard 2: NEVER play for fromMe messages
    if (lastMessage.fromMe) { prevMessageRef.current = lastMessage; return; }

    // Guard 3: Skip sync batches
    if ((lastMessage as any).isSync || (lastMessage as any).syncBatch) { prevMessageRef.current = lastMessage; return; }

    // Guard 4: Skip non-inbox event types for sound
    const skipTypes = [
      'protocolMessage', 'senderKeyDistributionMessage', 'messageContextInfo',
      'ephemeralMessage', 'reactionMessage', 'editedMessage',
      'internal_note', 'deviceSentMessage', 'bcallMessage',
      'callLogMesssage', 'keepInChatMessage', 'encReactionMessage',
      'viewOnceMessageV2Extension',
    ];
    if (skipTypes.includes(lastMessage.messageType)) { prevMessageRef.current = lastMessage; return; }

    // Guard 5: Skip group messages
    if (lastMessage.remoteJid?.endsWith('@g.us')) { prevMessageRef.current = lastMessage; return; }

    // Guard 6: Skip if muted
    if (isMuted) { prevMessageRef.current = lastMessage; return; }

    // Guard 7: Skip if sound is suppressed (conversation just opened / hydration)
    if (Date.now() < soundSuppressedUntilRef.current) { prevMessageRef.current = lastMessage; return; }

    // Guard 8: Skip if this is the currently viewed conversation
    const currentJid = selectedKeyRef.current ? getJidFromKey(selectedKeyRef.current) : null;
    if (currentJid === lastMessage.remoteJid) { prevMessageRef.current = lastMessage; return; }

    // All guards passed — play notification
    playNotification();
    prevMessageRef.current = lastMessage;
  }, [lastMessage]);

  // Status update via deterministic store — O(1)
  useEffect(() => {
    if (!lastStatusUpdate) return;
    const remoteJid = lastStatusUpdate.remoteJid;
    if (!remoteJid) return;
    const sid = lastStatusUpdate.sessionId || activeSession?.sessionId || "";
    convStore.handleStatusUpdate({ sessionId: sid, remoteJid, status: lastStatusUpdate.status, messageId: lastStatusUpdate.messageId });
  }, [lastStatusUpdate]);

  // ── Assignment/ownership changes via socket — instant tab movement ──
  useEffect(() => {
    if (!lastConversationUpdate) return;
    const { type, sessionId: evtSessionId, remoteJid, assignedUserId, status } = lastConversationUpdate as any;
    if (!remoteJid) return;
    const sid = evtSessionId || activeSession?.sessionId || "";
    const key = makeConvKey(sid, remoteJid);

    // Update the conversation store with new assignment data
    if (type === "assignment" || type === "claimed" || type === "transfer") {
      convStore.updateAssignment(key, {
        assignedUserId: assignedUserId ?? null,
        assignmentStatus: "open",
      });
    } else if (type === "enqueued") {
      convStore.updateAssignment(key, {
        assignedUserId: null,
        assignmentStatus: "open",
      });
    } else if (type === "finished") {
      convStore.updateAssignment(key, {
        assignedUserId: null,
        assignmentStatus: status || "resolved",
      });
    } else if (type === "reopened") {
      convStore.updateAssignment(key, {
        assignedUserId: null,
        assignmentStatus: "open",
      });
    } else if (type === "status_change") {
      convStore.updateAssignment(key, {
        assignmentStatus: status || null,
      });
    }

    // Invalidate queue stats for instant badge update
    queueStatsQ.refetch();
  }, [lastConversationUpdate]);

  // Select conversation
  // Sync on conversation open — lightweight fetch of last 10 messages
  const syncOnOpen = trpc.whatsapp.syncOnOpen.useMutation();
  const handleSelectConv = useCallback((jid: string) => {
    const key = makeConvKey(activeSession?.sessionId || "", jid);
    setSelectedKey(key);
    setShowMobileChat(true);

    // ── Suppress notification sounds for 2 seconds while conversation loads ──
    soundSuppressedUntilRef.current = Date.now() + 2000;

    // ── Instant: mark read in deterministic store (O(1), no refetch) ──
    convStore.markRead(key);

    if (activeSession?.sessionId) {
      markRead.mutate({ sessionId: activeSession.sessionId, remoteJid: jid });
      // Find conversationId from store (O(1) lookup)
      const conv = convStore.getConversation(key);
      if (conv?.conversationId) {
        syncOnOpen.mutate(
          { sessionId: activeSession.sessionId, remoteJid: jid, conversationId: conv.conversationId },
          {
            onSuccess: (r) => {
              // Only re-hydrate if new messages were inserted during sync
              if (r.inserted > 0) {
                conversationsQ.refetch().then((result) => {
                  if (result.data) convStore.hydrate(result.data as ConvEntry[]);
                });
              }
            }
          }
        );
      }
    }
  }, [activeSession?.sessionId, markRead, syncOnOpen, convStore]);

  // View queue conversation WITHOUT auto-claiming
  const handleSelectQueueConv = useCallback((jid: string) => {
    const key = makeConvKey(activeSession?.sessionId || "", jid);
    setSelectedKey(key);
    setShowMobileChat(true);
    // Do NOT auto-claim — user must click "Puxar" or "Atribuir" explicitly
  }, []);

  // Current user ID for filtering "mine" tab
  const meQ = trpc.auth.me.useQuery();
  const myUserId = useMemo(() => (meQ.data as any)?.saasUser?.userId || (meQ.data as any)?.id || 0, [meQ.data]);

  // ─── Render from deterministic store (pre-sorted, pre-deduped) ───
  // Store already maintains sorted order via moveToTop. No full sort needed.
  const dedupedConvs = useMemo(() => {
    return convStore.getSorted() as ConvItem[];
  }, [convStore.version]);

  // Filter by tab, unread, and search
  const filteredConvs = useMemo(() => {
    let convs = dedupedConvs;
    // Tab-based primary filter
    if (activeTab === "mine") {
      convs = convs.filter((c) => c.assignedUserId === myUserId);
    } else if (activeTab === "queue") {
      // Queue tab uses its own data source, return empty for main list
      return [];
    } else if (activeTab === "contacts") {
      // Contacts tab uses its own data source
      return [];
    } else if (activeTab === "finished") {
      // Finished tab uses its own filtering below
      return [];
    }
    // "all" tab shows everything
    // Secondary filter (within tab)
    if (filter === "unread") convs = convs.filter((c) => Number(c.unreadCount) > 0);
    // Search filter
    // Hide archived conversations
    convs = convs.filter((c) => !(c.isArchived === true || c.isArchived === 1));
    if (search) {
      const s = search.toLowerCase();
      convs = convs.filter((c) => {
        const name = getDisplayName(c.remoteJid, c).toLowerCase();
        const phone = c.remoteJid.split("@")[0];
        return name.includes(s) || phone.includes(s);
      });
    }
    // Sort: pinned first, then by lastTimestamp desc
    convs.sort((a, b) => {
      const aPinned = a.isPinned === true || a.isPinned === 1 ? 1 : 0;
      const bPinned = b.isPinned === true || b.isPinned === 1 ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return 0; // preserve existing lastTimestamp sort from store
    });
    return convs;
  }, [dedupedConvs, search, filter, activeTab, getDisplayName, myUserId, convStore.version]);

  // Queue conversations filtered by search
  const filteredQueueConvs = useMemo(() => {
    if (activeTab !== "queue") return [];
    let convs = (queueQ.data || []) as ConvItem[];
    if (search) {
      const s = search.toLowerCase();
      convs = convs.filter((c) => {
        const name = getDisplayName(c.remoteJid, c).toLowerCase();
        const phone = c.remoteJid.split("@")[0];
        return name.includes(s) || phone.includes(s);
      });
    }
    return convs;
  }, [queueQ.data, search, activeTab, getDisplayName]);

  // Finished conversations (resolved/closed) filtered by search
  const filteredFinishedConvs = useMemo(() => {
    if (activeTab !== "finished") return [];
    let convs = dedupedConvs.filter((c) =>
      c.assignmentStatus === "resolved" || c.assignmentStatus === "closed"
    );
    if (search) {
      const s = search.toLowerCase();
      convs = convs.filter((c) => {
        const name = getDisplayName(c.remoteJid, c).toLowerCase();
        const phone = c.remoteJid.split("@")[0];
        return name.includes(s) || phone.includes(s);
      });
    }
    return convs;
  }, [dedupedConvs, search, activeTab, getDisplayName, convStore.version]);

  // WA Contacts filtered by search
  const filteredWaContacts = useMemo(() => {
    if (activeTab !== "contacts") return [];
    if (!search) return waContactsList;
    const s = search.toLowerCase();
    return waContactsList.filter((c) => {
      return c.displayName.toLowerCase().includes(s) ||
        (c.phoneNumber && c.phoneNumber.includes(s)) ||
        c.jid.split("@")[0].includes(s);
    });
  }, [waContactsList, search, activeTab]);

  // My conversations count for badge
  const myConvsCount = useMemo(() => {
    return dedupedConvs.filter((c) => c.assignedUserId === myUserId).length;
  }, [dedupedConvs, myUserId]);

  // Queue count for badge
  const queueCount = useMemo(() => {
    return (queueStatsQ.data as any)?.total || 0;
  }, [queueStatsQ.data]);

  // Get assignment for selected conversation (O(1) from store)
  const selectedAssignment = useMemo(() => {
    if (!selectedKey) return null;
    const conv = convStore.getConversation(selectedKey) as ConvItem | undefined;
    if (!conv) return null;
    return {
      assignedUserId: conv.assignedUserId,
      assignedAgentName: conv.assignedAgentName,
      assignmentStatus: conv.assignmentStatus,
      assignmentPriority: conv.assignmentPriority,
    };
  }, [selectedKey, convStore.version]);

  const handleAssign = useCallback((agentId: number | null) => {
    if (!selectedJid || !activeSession?.sessionId) return;
    assignMutation.mutate({ sessionId: activeSession.sessionId,
      remoteJid: selectedJid,
      assignedUserId: agentId,
    });
    setShowAssignPanel(false);
  }, [selectedJid, activeSession?.sessionId, assignMutation]);

  const handleStatusChange = useCallback((status: "open" | "pending" | "resolved" | "closed") => {
    if (!selectedJid || !activeSession?.sessionId) return;
    updateStatusMutation.mutate({ sessionId: activeSession.sessionId,
      remoteJid: selectedJid,
      status,
    });
  }, [selectedJid, activeSession?.sessionId, updateStatusMutation]);

  // Selected contact info
  const selectedContact = useMemo(() => {
    if (!selectedKey) return null;
    const jid = getJidFromKey(selectedKey);
    const crmContact = getContactForJid(jid);
    const pic = profilePicMap[jid] || undefined;
    const selectedConv = convStore.getConversation(selectedKey) as ConvItem | undefined;
    const displayName = getDisplayName(jid, selectedConv);
    const phone = jid.split("@")[0];
    if (crmContact) return { ...crmContact, name: displayName, avatarUrl: pic };
    return { id: 0, name: displayName, phone, email: undefined, avatarUrl: pic };
  }, [selectedKey, getContactForJid, profilePicMap, getDisplayName, convStore.version]);

  const hasCrmContact = useMemo(() => {
    if (!selectedKey) return false;
    const jid = getJidFromKey(selectedKey);
    return !!getContactForJid(jid);
  }, [selectedKey, getContactForJid]);

  // Get waConversationId for selected conversation (O(1) from store)
  const selectedWaConversationId = useMemo(() => {
    if (!selectedKey) return undefined;
    const conv = convStore.getConversation(selectedKey) as ConvItem | undefined;
    return conv?.conversationId;
  }, [selectedKey, convStore.version]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      try { localStorage.setItem(MUTE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  // No session state
  if (!activeSession && !sessionsQ.isLoading) {
    return <div className="h-full"><NoSession /></div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* ═══ RECONNECTION BANNER ═══ */}
      {!isConnected && activeSession && (
        <div className="shrink-0 flex items-center justify-between px-4 py-[6px]" style={{ backgroundColor: '#ffc107', color: '#3b3a32' }}>
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span className="text-[14px]">Computador não conectado — certifique-se de que o celular está com internet.</span>
          </div>
          <a href="/whatsapp" className="px-3 py-1 bg-white/30 hover:bg-white/50 rounded text-[13px] font-medium transition-colors">
            Reconectar
          </a>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
      {/* ═══ LEFT PANEL: Conversations List ═══ */}
      <div
        className={`w-full md:w-[360px] lg:w-[380px] flex flex-col border-r border-border shrink-0 inbox-glass ${showMobileChat ? "hidden md:flex" : "flex"}`}
      >
        {/* New Chat Panel (slide-over) */}
        <NewChatPanel
          open={showNewChat}
          onClose={() => setShowNewChat(false)}
          onSelectJid={(jid) => { handleSelectConv(jid); setShowNewChat(false); }}
          sessionId={activeSession?.sessionId || ""}
        />

        {/* ── Header (glassmorphism) ── */}
        <div className="h-14 flex items-center justify-between px-4 shrink-0 border-b border-border">
          <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Conversas</h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setShowNewChat(true); }}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Nova conversa"
            >
              <Plus className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-muted-foreground bg-accent px-2 py-0.5 rounded-full">{dedupedConvs.length}</span>
            <div className="relative">
              <button
                onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showHeaderMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowHeaderMenu(false)} />
                  <div className="absolute top-full right-0 mt-1.5 w-52 rounded-xl shadow-2xl z-50 overflow-hidden py-1 bg-popover border border-border">
                    <button
                      onClick={() => { toggleMute(); setShowHeaderMenu(false); }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 transition-colors text-left text-[13px] text-foreground hover:bg-accent"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4 text-muted-foreground" /> : <Volume2 className="w-4 h-4 text-muted-foreground" />}
                      {isMuted ? "Ativar som" : "Desativar som"}
                    </button>
                    <button
                      onClick={() => {
                        if (!activeSession?.sessionId) { toast.error("Nenhuma sessão ativa"); return; }
                        syncContactsMut.mutate({ sessionId: activeSession.sessionId });
                        setShowHeaderMenu(false);
                      }}
                      disabled={syncContactsMut.isPending}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 transition-colors text-left text-[13px] text-foreground hover:bg-accent"
                    >
                      <RefreshCw className={`w-4 h-4 text-muted-foreground ${syncContactsMut.isPending ? "animate-spin" : ""}`} />
                      {syncContactsMut.isPending ? "Sincronizando..." : "Sincronizar contatos"}
                    </button>
                    <div className="mx-3 my-0.5 border-t border-border" />
                    <button
                      onClick={() => { setShowNewChat(true); setShowHeaderMenu(false); }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 transition-colors text-left text-[13px] text-foreground hover:bg-accent"
                    >
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                      Nova conversa
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Search Bar (glassmorphism) ── */}
        <div className="px-3 py-2 shrink-0">
          <div className="relative inbox-search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <input
              type="text"
              placeholder={activeTab === "contacts" ? "Buscar por nome ou telefone..." : "Pesquisar conversa..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full h-9 pl-10 pr-10 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none border-0"
            />
            {search ? (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-accent transition-colors">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            ) : (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/30 bg-white/[0.04] px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
            )}
          </div>
        </div>

        {/* ── Tabs (pill style like MKT) ── */}
        <div className="flex items-center gap-1 px-3 py-1.5 shrink-0 border-b border-border/50">
          {([
            { id: "mine" as InboxTab, label: "Meus", badge: myConvsCount, icon: InboxIcon },
            { id: "queue" as InboxTab, label: "Fila", badge: queueCount, icon: ListOrdered },
            { id: "all" as InboxTab, label: "Todos", badge: 0, icon: LayoutGrid },
            { id: "finished" as InboxTab, label: "Finalizados", badge: 0, icon: CheckCircle2 },
            { id: "contacts" as InboxTab, label: "Contatos", badge: 0, icon: Contact2 },
          ]).map((tab) => {
            const active = activeTab === tab.id;
            if (tab.id === "all" && !isAdmin) return null;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setFilter("all"); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.badge > 0 && (
                  <span className="inbox-unread-badge !h-[16px] !min-w-[16px] !text-[9px] !px-1">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Content List (depends on active tab) ── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ overscrollBehavior: "contain" }}>
          {/* MINE / ALL tabs: show conversations */}
          {(activeTab === "mine" || activeTab === "all") && (
            <>
              {conversationsQ.isLoading || sessionsQ.isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                  <div className="inbox-empty-icon">
                    <MessageSquare className="w-6 h-6 text-primary/60" />
                  </div>
                  <p className="text-[14px] font-medium">
                    {search ? "Nenhuma conversa encontrada" : activeTab === "mine" ? "Nenhuma conversa atribuída a você" : "Nenhuma conversa ainda"}
                  </p>
                  {activeTab === "mine" && !search && (
                    <p className="text-[12px] mt-1.5">Puxe conversas da Fila para começar a atender</p>
                  )}
                </div>
              ) : (
                filteredConvs.map((conv) => {
                  const ck = conv.conversationKey || makeConvKey(conv.sessionId || activeSession?.sessionId || "", conv.remoteJid);
                  return (
                  <ConversationItem
                    key={ck}
                    conv={conv}
                    isActive={selectedKey === ck}
                    contactName={getDisplayName(conv.remoteJid, conv)}
                    pictureUrl={profilePicMap[conv.remoteJid]}
                    onClick={() => handleSelectConv(conv.remoteJid)}
                    showTimer={activeTab === "mine"}
                    showFinish={activeTab === "mine"}
                    onFinish={() => handleFinishAttendance(conv.remoteJid)}
                    onTransfer={() => handleSelectConv(conv.remoteJid)}
                    onAssignClick={() => { handleSelectConv(conv.remoteJid); setAutoOpenAssign(true); }}
                  />
                  );
                })
              )}
            </>
          )}

          {/* QUEUE tab: show waiting conversations */}
          {activeTab === "queue" && (
            <>
              {queueQ.isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : filteredQueueConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                  <div className="inbox-empty-icon">
                    <Timer className="w-6 h-6 text-primary/60" />
                  </div>
                  <p className="text-[14px] font-medium">
                    {search ? "Nenhuma conversa encontrada na fila" : "Fila vazia"}
                  </p>
                  <p className="text-[12px] mt-1.5">Novas mensagens sem agente aparecerão aqui</p>
                </div>
              ) : (
                filteredQueueConvs.map((conv) => {
                  const waitTime = conv.queuedAt || conv.lastTimestamp;
                  const ck = makeConvKey(conv.sessionId || activeSession?.sessionId || "", conv.remoteJid);
                  const isActiveQueue = selectedKey === ck;
                  return (
                  <div
                    key={conv.remoteJid}
                    onClick={() => handleSelectQueueConv(conv.remoteJid)}
                    className={`inbox-conv-item flex items-center gap-3 px-3.5 py-3 cursor-pointer ${isActiveQueue ? "active" : ""}`}
                  >
                    <div className="relative shrink-0">
                      <div className="inbox-avatar-ring rounded-full">
                        <WaAvatar name={getDisplayName(conv.remoteJid, conv)} size={46} pictureUrl={profilePicMap[conv.remoteJid]} />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center ring-2 ring-background">
                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[15px] text-foreground truncate font-medium leading-tight">
                          {getDisplayName(conv.remoteJid, conv)}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {waitTime && (
                            <span className="flex items-center gap-1 text-[10px] font-medium tabular-nums text-emerald-400">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <UrgencyTimer since={waitTime} compact />
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-[13.5px] truncate leading-snug text-muted-foreground">
                          {getMessagePreview(conv.lastMessage, conv.lastMessageType) || "Sem mensagens"}
                        </span>
                        {Number(conv.unreadCount) > 0 && (
                          <span className="inbox-unread-badge shrink-0">
                            {Number(conv.unreadCount) > 99 ? "99+" : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeSession?.sessionId) {
                          claimMutation.mutate({ sessionId: activeSession.sessionId, remoteJid: conv.remoteJid });
                        }
                      }}
                      disabled={claimMutation.isPending}
                      className="shrink-0 px-2.5 py-1.5 text-[11px] font-medium bg-primary/15 text-primary rounded-md hover:bg-primary/25 transition-colors"
                      title="Atender conversa"
                    >
                      {claimMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  );
                })
              )}
            </>
          )}

          {/* FINISHED tab: show resolved/closed conversations */}
          {activeTab === "finished" && (
            <>
              {conversationsQ.isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : filteredFinishedConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                  <div className="inbox-empty-icon">
                    <CheckCircle2 className="w-6 h-6 text-primary/60" />
                  </div>
                  <p className="text-[14px] font-medium">
                    {search ? "Nenhuma conversa encontrada" : "Nenhuma conversa finalizada"}
                  </p>
                </div>
              ) : (
                filteredFinishedConvs.map((conv) => {
                  const ck = conv.conversationKey || makeConvKey(conv.sessionId || activeSession?.sessionId || "", conv.remoteJid);
                  return (
                    <ConversationItem
                      key={ck}
                      conv={conv}
                      isActive={selectedKey === ck}
                      contactName={getDisplayName(conv.remoteJid, conv)}
                      pictureUrl={profilePicMap[conv.remoteJid]}
                      onClick={() => handleSelectConv(conv.remoteJid)}
                    />
                  );
                })
              )}
            </>
          )}

          {/* CONTACTS tab: show WA contacts */}
          {activeTab === "contacts" && (
            <>
              {waContactsForTabQ.isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : filteredWaContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                  <div className="inbox-empty-icon">
                    <Contact2 className="w-6 h-6 text-primary/60" />
                  </div>
                  <p className="text-[14px] font-medium">
                    {search ? "Nenhum contato encontrado" : "Nenhum contato do WhatsApp"}
                  </p>
                  <p className="text-[12px] mt-1.5">Sincronize os contatos na página WhatsApp</p>
                </div>
              ) : (
                filteredWaContacts.map((contact) => (
                  <div
                    key={contact.jid}
                    className="flex items-center gap-3 px-3.5 py-3 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/30"
                    onClick={() => handleSelectConv(contact.jid)}
                  >
                    <div className="relative shrink-0">
                      <WaAvatar name={contact.displayName} size={42} pictureUrl={profilePicMap[contact.jid]} />
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#25D366] flex items-center justify-center ring-2 ring-background">
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-foreground truncate">{contact.displayName}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {contact.phoneNumber ? formatPhoneNumber(contact.phoneNumber) : formatPhoneNumber(contact.jid)}
                      </p>
                    </div>
                    <MessageSquare className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══ RIGHT PANEL: Chat Area ═══ */}
      <div className={`flex-1 flex flex-col bg-background min-w-0 ${!showMobileChat ? "hidden md:flex" : "flex"}`}>
        {!selectedKey || !activeSession ? (
          <EmptyChat />
        ) : (
          <div className="flex flex-col h-full w-full relative">
            {/* Mobile back button */}
            <button
              onClick={() => setShowMobileChat(false)}
              className="md:hidden absolute top-[14px] left-[8px] z-30 p-[6px] rounded-full backdrop-blur-sm"
              style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>

            {!detailsOpen && (
              <button
                onClick={() => { setDetailsOpen(true); try { localStorage.setItem(DETAILS_KEY, "true"); } catch {} }}
                className="hidden md:flex absolute top-[14px] right-[12px] z-30 p-[6px] rounded-full backdrop-blur-sm hover:bg-accent/40"
                style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
                title="Mostrar detalhes do contato"
              >
                <PanelRightOpen className="w-5 h-5 text-white" />
              </button>
            )}

            <WhatsAppChat
              contact={selectedContact}
              sessionId={activeSession.sessionId}
              remoteJid={selectedJid!}
              onCreateDeal={() => setShowCreateDeal(true)}
              onCreateContact={() => setShowCreateContact(true)}
              hasCrmContact={hasCrmContact}
              assignment={selectedAssignment}
              agents={agents}
              onAssign={handleAssign}
              onStatusChange={handleStatusChange}
              myAvatarUrl={activeSession.user?.imgUrl}
              waConversationId={selectedWaConversationId}
              autoOpenAssign={autoOpenAssign}
              onAutoOpenAssignConsumed={() => setAutoOpenAssign(false)}
              onOptimisticSend={(msg) => {
                if (!activeSession?.sessionId || !selectedJid) return;
                convStore.handleOptimisticSend({
                  sessionId: activeSession.sessionId,
                  remoteJid: selectedJid,
                  content: msg.content,
                  messageType: msg.messageType,
                });
              }}
            />
          </div>
        )}
      </div>

      {/* ═══ RIGHT SIDEBAR — Contact Details ═══ */}
      {selectedKey && activeSession && detailsOpen && (
        <div className="hidden md:flex">
          <ContactDetailsSidebar
            contactId={selectedContact?.id && selectedContact.id > 0 ? selectedContact.id : null}
            fallbackName={selectedContact?.name}
            fallbackPhone={selectedJid?.split("@")[0]}
            fallbackAvatarUrl={selectedContact?.avatarUrl}
            onCollapse={() => { setDetailsOpen(false); try { localStorage.setItem(DETAILS_KEY, "false"); } catch {} }}
            onCreateContact={() => setShowCreateContact(true)}
          />
        </div>
      )}

      {/* ═══ DIALOGS ═══ */}
      {selectedKey && activeSession && (
        <CreateDealDialog
          open={showCreateDeal}
          onClose={() => setShowCreateDeal(false)}
          contactName={selectedContact?.name || "Cliente"}
          contactPhone={selectedJid?.split("@")[0] || ""}
          contactJid={selectedJid || ""}
          sessionId={activeSession.sessionId}
        />
      )}
      {selectedKey && (
        <CreateContactDialog
          open={showCreateContact}
          onClose={() => setShowCreateContact(false)}
          phone={selectedJid?.split("@")[0] || ""}
          pushName={selectedContact?.name || ""}
          onCreated={() => { contactsQ.refetch(); setShowCreateContact(false); }}
        />
      )}
      </div>
    </div>
  );
}
