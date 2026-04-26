import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { normalizeForSearch } from "@/utils/searchUtils";
import { useLocation } from "wouter";
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
} from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import { Inbox as InboxIcon, ListOrdered, Headphones } from "lucide-react";
import { AgentStatusSelector } from "@/components/AgentStatusSelector";

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
import CrmSidebar from "@/components/inbox/sidebar/CrmSidebar";

/* ═══════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   MAIN INBOX PAGE
   ═══════════════════════════════════════════════════════ */

type InboxTab = "mine" | "queue" | "contacts" | "all" | "finished";
type AgentFilter = "all" | "unread" | "mine" | "unassigned";

export default function InboxPage() {
  const [, setLocation] = useLocation();
  const trpcUtils = trpc.useUtils();
  const { lastMessage, lastStatusUpdate, lastConversationUpdate, lastEditedMessage, isConnected: socketConnected } = useSocket();
  // selectedKey = conversationKey (sessionId:remoteJid) — primary selection state
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // selectedJid = remoteJid only — derived for API calls that need just the JID
  const selectedJid = selectedKey ? getJidFromKey(selectedKey) : null;
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [activeTab, setActiveTab] = useState<InboxTab>("mine");
  const [filter, setFilter] = useState<AgentFilter>("all");
  const { isAdmin } = useIsAdmin();
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragOverJid, setDragOverJid] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem("inbox-sidebar-open") !== "false"; } catch { return true; }
  });
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => {
      const next = !prev;
      try { localStorage.setItem("inbox-sidebar-open", String(next)); } catch {}
      return next;
    });
  }, []);
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) === "true"; } catch { return false; }
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
  // Debounced refetch for conversation list sync after new messages
  const debouncedMsgRefetchRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ─── Data queries ───
  const assignmentQ = trpc.whatsapp.hasInstanceAssignment.useQuery(undefined, { staleTime: 30_000 });
  const canConnect = isAdmin || assignmentQ.data?.hasAssignment || assignmentQ.data?.hasActiveShare;
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
    const interval = socketConnected ? 120000 : 15000;
    bgSyncRef.current = setInterval(() => {
      conversationsQ.refetch().then((result) => {
        if (result.data) {
          convStore.hydrate(result.data as ConvEntry[]);
        }
      }).catch(() => {});
    }, interval);

    return () => { if (bgSyncRef.current) clearInterval(bgSyncRef.current); };
  }, [activeSession?.sessionId, socketConnected]);

  // Agents list for assignment
  const agentsQ = trpc.whatsapp.agents.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const agents = useMemo(() => (agentsQ.data || []) as Array<{ id: number; name: string; email: string; avatarUrl?: string | null; status: string }>, [agentsQ.data]);

  // Queue conversations
  const queueQ = trpc.whatsapp.queue.list.useQuery(
    { sessionId: activeSession?.sessionId || "", limit: 100 },
    { enabled: !!activeSession?.sessionId && (activeTab === "queue" || activeTab === "all"), refetchInterval: socketConnected ? 30000 : 10000, staleTime: 10000, refetchIntervalInBackground: false }
  );
  const queueStatsQ = trpc.whatsapp.queue.stats.useQuery(
    { sessionId: activeSession?.sessionId || "" },
    { enabled: !!activeSession?.sessionId, refetchInterval: socketConnected ? 60000 : 15000, staleTime: 15000, refetchIntervalInBackground: false }
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
      // Refetch + rehydrate so the claimed conversation lands in the store
      // (when claimed from queue, it may not exist in convStore yet — updateAssignment
      // would silently no-op in that case).
      setTimeout(() => {
        conversationsQ.refetch().then((result) => {
          if (result.data) convStore.hydrate(result.data as ConvEntry[]);
        }).catch(() => {});
      }, 500);
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
    { limit: 5000 },
    { enabled: true, staleTime: 5 * 60 * 1000 }
  );

  const linkConversationsMut = trpc.crm.contacts.linkConversations.useMutation();

  // Profile pictures — derive from store (no dependency on conversationsQ.data)
  const convJids = useMemo(() => {
    const storeJids = convStore.sortedIds.map(key => getJidFromKey(key));
    // Include queue conversation JIDs so their profile pics are also loaded
    const queueJids = ((queueQ.data || []) as ConvItem[]).map(c => c.remoteJid).filter(Boolean);
    const set = new Set([...storeJids, ...queueJids]);
    return Array.from(set);
  }, [convStore.sortedIds, queueQ.data]);

  // Fetch profile pics from DB (fast query, no API calls) — can handle more
  const visibleJids = useMemo(() => convJids.slice(0, 150), [convJids]);
  const profilePicsQ = trpc.whatsapp.profilePictures.useQuery(
    { sessionId: activeSession?.sessionId || "", jids: visibleJids },
    { enabled: !!activeSession?.sessionId && visibleJids.length > 0, staleTime: 60_000, refetchInterval: 60_000, refetchIntervalInBackground: false }
  );

  // CUMULATIVE profile pic map — accumulates fetched photos across query key changes.
  // Also accepts null to clear expired/removed photos from the accumulator.
  const profilePicAccumRef = useRef<Record<string, string | null>>({});
  const profilePicMap = useMemo(() => {
    const incoming = (profilePicsQ.data || {}) as Record<string, string | null>;
    for (const [jid, url] of Object.entries(incoming)) {
      profilePicAccumRef.current[jid] = url; // Accept null too — clears expired URLs
    }
    return { ...profilePicAccumRef.current };
  }, [profilePicsQ.data]);

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
  // Handles Brazilian 9th digit: stores both 12-digit (without 9) and 13-digit (with 9) variants
  const contactNameMap = useMemo(() => {
    const map = new Map<string, { id: number; name: string; phone: string; email?: string; avatarUrl?: string }>();
    for (const c of (((contactsQ.data as any)?.items || contactsQ.data || []) as any[])) {
      if (c.phone) {
        const cleaned = c.phone.replace(/\D/g, "");
        const entry = { id: c.id, name: c.name, phone: c.phone, email: c.email || undefined, avatarUrl: undefined };
        map.set(cleaned, entry);
        if (cleaned.startsWith("55")) {
          map.set(cleaned.substring(2), entry);
          // Brazilian 9th digit variants: 5584999838420 ↔ 558499838420
          const afterCC = cleaned.substring(2); // e.g. "84999838420"
          if (afterCC.length === 11 && afterCC[2] === "9") {
            // Has 9th digit → also store without it (remove 3rd char)
            const without9 = `55${afterCC.substring(0, 2)}${afterCC.substring(3)}`;
            map.set(without9, entry);
            map.set(without9.substring(2), entry);
          } else if (afterCC.length === 10) {
            // Missing 9th digit → also store with it
            const with9 = `55${afterCC.substring(0, 2)}9${afterCC.substring(2)}`;
            map.set(with9, entry);
            map.set(with9.substring(2), entry);
          }
        } else {
          map.set(`55${cleaned}`, entry);
        }
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
    // Prioridade alinhada com identityResolver.NAME_PRIORITY:
    // 1. CRM (edição manual no CRM — nameSource='crm')  — vence TUDO
    // 2. WA profile (senderName, nome do perfil WA do remetente)
    // 3. Agenda do dono (chatName) / WA contacts local — último fallback
    //
    // conv.contactName vem de contacts.name que já respeita NAME_PRIORITY no backend,
    // então se foi editado manual no CRM ele vence; se não, foi populado via
    // senderName (whatsapp_profile) — em ambos os casos esse valor é o correto.
    //
    // Ver specs/domains/inbox.spec.md e specs/domains/whatsapp.spec.md.

    // 1. contactName — contacts.name (CRM-owned, respeita NAME_PRIORITY).
    if (conv?.contactName && isRealName(conv.contactName)) return conv.contactName;
    // 2. Contato CRM via cache client-side (mesma fonte).
    const contact = getContactForJid(jid);
    if (contact && isRealName(contact.name)) return contact.name;
    // 3. pushName — webhook.senderName (perfil WA real do remetente).
    const pushName = pushNameMap.get(jid);
    if (isRealName(pushName)) return pushName!;
    // 4. WA Contacts map local (agenda do dono — último recurso antes de LID/phone).
    const waContact = waContactsMap[jid];
    if (waContact) {
      if (isRealName(waContact.savedName)) return waContact.savedName!;
      if (isRealName(waContact.verifiedName)) return waContact.verifiedName!;
      if (isRealName(waContact.pushName)) return waContact.pushName!;
    }
    // 5. Para LID JIDs, mostra telefone resolvido em vez do LID cru.
    if (jid.endsWith("@lid")) {
      if (conv?.resolvedPhone) return formatPhoneNumber(conv.resolvedPhone);
      if (waContact?.phoneNumber) return formatPhoneNumber(waContact.phoneNumber);
      return "Contato WhatsApp";
    }
    // 6. Último recurso: formato do número.
    if (contact) return contact.name;
    return formatPhoneNumber(jid);
  }, [getContactForJid, pushNameMap, waContactsMap, isRealName]);

  // ─── Socket → Deterministic Store (instant updates) ───
  // Socket is the ONLY source of truth for conversation list updates.
  // No refetch, no polling, no full sort. Target: < 20ms per update.
  useEffect(() => {
    if (!lastMessage) return;

    // Validation — ignore events without required fields
    if (!lastMessage.remoteJid || !lastMessage.timestamp) {
      prevMessageRef.current = lastMessage;
      return;
    }

    // Strict Message Ownership — validate sessionId matches active session
    // With Socket.IO tenant rooms, only events from our tenant arrive here,
    // but we still validate sessionId for correctness (multi-session within same tenant)
    const currentSessionId = activeSession?.sessionId || "";
    if (lastMessage.sessionId && currentSessionId && lastMessage.sessionId !== currentSessionId) {
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
    const handled = convStore.handleMessage({
      sessionId: lastMessage.sessionId || currentSessionId,
      remoteJid: lastMessage.remoteJid,
      content: lastMessage.content || getMessagePreview(null, lastMessage.messageType),
      fromMe: lastMessage.fromMe,
      messageType: lastMessage.messageType,
      timestamp: lastMessage.timestamp,
      status: (lastMessage as any).status,
      isSync: (lastMessage as any).isSync,
      messageId: lastMessage.messageId || undefined,
      pushName: (lastMessage as any).pushName || undefined,
    }, selectedKeyRef.current);

    // If conversation is new (not in store), do a one-time fetch
    if (!handled) {
      conversationsQ.refetch().then((result) => {
        if (result.data) convStore.hydrate(result.data as ConvEntry[]);
      }).catch(() => {});
      // Refresh contacts map so new contact name/picture show immediately
      waContactsMapQ.refetch().catch(() => {});
      // Fetch profile pic for the new contact immediately
      profilePicsQ.refetch().catch(() => {});
      // New conversation likely goes to queue — refresh it immediately
      queueQ.refetch().catch(() => {});
      queueStatsQ.refetch().catch(() => {});
    } else {
      // Debounced refetch to sync sidebar with DB (ensures preview, status, timestamp are accurate)
      if (debouncedMsgRefetchRef.current) clearTimeout(debouncedMsgRefetchRef.current);
      debouncedMsgRefetchRef.current = setTimeout(() => {
        conversationsQ.refetch().then((result) => {
          if (result.data) convStore.hydrate(result.data as ConvEntry[]);
        }).catch(() => {});
      }, 500);
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
  // No refetch needed: store updates instantly, background sync handles drift
  useEffect(() => {
    if (!lastStatusUpdate) return;
    const remoteJid = lastStatusUpdate.remoteJid;
    const sid = lastStatusUpdate.sessionId || activeSession?.sessionId || "";

    if (remoteJid) {
      convStore.handleStatusUpdate({ sessionId: sid, remoteJid, status: lastStatusUpdate.status, messageId: lastStatusUpdate.messageId });
    } else if (lastStatusUpdate.messageId) {
      convStore.handleStatusUpdateByMessageId({ sessionId: sid, messageId: lastStatusUpdate.messageId, status: lastStatusUpdate.status });
    }
  }, [lastStatusUpdate]);

  // ── Edited message → update sidebar preview if it was the last message ──
  useEffect(() => {
    if (!lastEditedMessage || !lastEditedMessage.remoteJid) return;
    const sid = lastEditedMessage.sessionId || activeSession?.sessionId || "";
    (convStore as any).updateEditedPreview(sid, lastEditedMessage.remoteJid, lastEditedMessage.newText);
  }, [lastEditedMessage]);

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
        assignedUserId: assignedUserId ?? null,
        assignmentStatus: "open",
      });
    } else if (type === "status_change") {
      convStore.updateAssignment(key, {
        assignmentStatus: status || null,
      });
    }

    // Invalidate queue for instant update
    queueQ.refetch();
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

  // ─── Auto-open conversation from ?phone= query param (e.g. from RFV page) ───
  const phoneParamHandled = useRef(false);
  useEffect(() => {
    if (phoneParamHandled.current) return;
    if (!activeSession?.sessionId) return;
    const params = new URLSearchParams(window.location.search);
    const phone = params.get("phone");
    if (!phone) return;
    phoneParamHandled.current = true;
    // Clear query params from URL
    setLocation("/inbox", { replace: true });
    // Resolve phone → JID and open conversation
    trpcUtils.whatsapp.resolveJid.fetch({ sessionId: activeSession.sessionId, phone })
      .then((result) => {
        if (result.jid) {
          handleSelectConv(result.jid);
        } else {
          toast.error("Número não encontrado no WhatsApp");
        }
      })
      .catch(() => {
        toast.error("Erro ao verificar número no WhatsApp");
      });
  }, [activeSession?.sessionId, handleSelectConv, trpcUtils, setLocation]);

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
      convs = convs.filter((c) =>
        c.assignedUserId === myUserId &&
        c.assignmentStatus !== "resolved" &&
        c.assignmentStatus !== "closed"
      );
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
    const s = normalizeForSearch(search);
    return waContactsList.filter((c) => {
      return normalizeForSearch(c.displayName).includes(s) ||
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

  // CRM contact ID for sidebar — prefer DB-linked contactId, fallback to client-side phone matching
  const selectedCrmContactId = useMemo(() => {
    if (!selectedKey) return null;
    // 1. DB-linked contactId (authoritative — set by server-side linking)
    const conv = convStore.getConversation(selectedKey) as ConvItem | undefined;
    if (conv?.contactId) return conv.contactId;
    // 2. Fallback: client-side phone matching
    const jid = getJidFromKey(selectedKey);
    const c = getContactForJid(jid);
    return c?.id || null;
  }, [selectedKey, getContactForJid, convStore.version]);

  // Auto-link: if frontend matched a contact via phone fallback but the DB conversation
  // has no contactId, persist the link so it works in future sessions
  useEffect(() => {
    if (!selectedKey || !selectedCrmContactId) return;
    const conv = convStore.getConversation(selectedKey) as ConvItem | undefined;
    if (conv && !conv.contactId) {
      const jid = getJidFromKey(selectedKey);
      const phone = jid.split("@")[0];
      if (phone && !/^lid:/.test(phone)) {
        linkConversationsMut.mutate({ contactId: selectedCrmContactId, phone });
      }
    }
  }, [selectedCrmContactId, selectedKey]);

  // Push name for sidebar — prefer real WhatsApp pushName over saved contact name
  const selectedPushName = useMemo(() => {
    if (!selectedKey) return null;
    const jid = getJidFromKey(selectedKey);
    // 1. waContactsMap has pushName from Z-API /contacts (the real WhatsApp profile name)
    const waContact = waContactsMap[jid];
    if (waContact?.pushName) return waContact.pushName;
    // 2. Fallback to contactPushName from conversation (webhook notify field)
    const conv = convStore.getConversation(selectedKey) as ConvItem | undefined;
    return conv?.contactPushName || null;
  }, [selectedKey, convStore.version, waContactsMap]);

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
    return <div className="h-full"><NoSession canConnect={canConnect} /></div>;
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
        className={`w-full md:w-[360px] lg:w-[380px] flex flex-col border-r border-border shrink-0 inbox-glass inbox-panel-glass ${showMobileChat ? "hidden md:flex" : "flex"}`}
      >
        {/* New Chat Panel (slide-over) */}
        <NewChatPanel
          open={showNewChat}
          onClose={() => setShowNewChat(false)}
          onSelectJid={(jid, _name, contactId) => {
            handleSelectConv(jid);
            setShowNewChat(false);
            // Vincular conversa ao contato selecionado imediatamente
            if (contactId) {
              const phone = jid.split("@")[0];
              if (phone && !/^lid:/.test(phone)) {
                linkConversationsMut.mutate({ contactId, phone });
              }
            }
          }}
          sessionId={activeSession?.sessionId || ""}
        />

        {/* ── Header (glassmorphism) ── */}
        <div className="h-14 flex items-center justify-between px-4 shrink-0 inbox-header-glass">
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setLocation("/supervision")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-lg shadow-sm shadow-violet-500/25 transition-all"
              >
                <Headphones className="w-3.5 h-3.5" />
                Supervisão
              </button>
            )}
            <AgentStatusSelector sessionId={activeSession?.sessionId} />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setShowNewChat(true); }}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Nova conversa"
            >
              <Plus className="w-4 h-4" />
            </button>
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

        {/* ── Tabs ── */}
        <div className="grid grid-cols-4 gap-1 mx-3 my-2 p-1 bg-muted/40 dark:bg-white/[0.04] rounded-xl shrink-0" style={{ gridTemplateColumns: isAdmin ? "repeat(5, 1fr)" : "repeat(4, 1fr)" }}>
          {([
            { id: "mine" as InboxTab, label: "Meus", badge: myConvsCount, icon: InboxIcon },
            { id: "queue" as InboxTab, label: "Fila", badge: queueCount, icon: ListOrdered },
            { id: "all" as InboxTab, label: "Todos", badge: 0, icon: LayoutGrid },
            { id: "finished" as InboxTab, label: "Fin.", badge: 0, icon: CheckCircle2 },
            { id: "contacts" as InboxTab, label: "Contatos", badge: 0, icon: Contact2 },
          ]).map((tab) => {
            const active = activeTab === tab.id;
            if (tab.id === "all" && !isAdmin) return null;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setFilter("all"); }}
                className={`inbox-tab flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 text-[11px] font-medium rounded-lg transition-all min-w-0 ${
                  active ? "active" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="relative flex items-center justify-center">
                  <TabIcon className="w-4 h-4 shrink-0" />
                  {tab.badge > 0 && (
                    <span className="inbox-unread-badge absolute -top-1.5 -right-3 !h-[14px] !min-w-[14px] !text-[8px] !px-0.5">
                      {tab.badge > 99 ? "99+" : tab.badge}
                    </span>
                  )}
                </span>
                <span className="truncate max-w-full leading-tight">{tab.label}</span>
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
                    // Cascade: profilePicturesQ (Z-API live) > contacts.avatarUrl (persistido).
                    // Evita avatar sumir quando cache Z-API vence (24h).
                    pictureUrl={profilePicMap[conv.remoteJid] ?? (conv as any).contactAvatarUrl ?? null}
                    onClick={() => handleSelectConv(conv.remoteJid)}
                    showTimer={activeTab === "mine"}
                    showFinish={activeTab === "mine"}
                    onFinish={() => handleFinishAttendance(conv.remoteJid)}
                    onTransfer={() => handleSelectConv(conv.remoteJid)}
                    onAssignClick={() => { handleSelectConv(conv.remoteJid); setAutoOpenAssign(true); }}
                    isDragTarget={dragOverJid === conv.remoteJid}
                    onFileDrop={(file) => { handleSelectConv(conv.remoteJid); setPendingFile(file); setDragOverJid(null); }}
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
                    onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
                    onDragEnter={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { handleSelectQueueConv(conv.remoteJid); setPendingFile(f); } }}
                    className={`inbox-conv-item flex items-center gap-3 px-3.5 py-3 cursor-pointer ${isActiveQueue ? "active" : ""}`}
                  >
                    <div className="relative shrink-0">
                      <div className="inbox-avatar-ring rounded-full">
                        <WaAvatar name={getDisplayName(conv.remoteJid, conv)} size={46} pictureUrl={profilePicMap[conv.remoteJid] ?? (conv as any).contactAvatarUrl ?? null} />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center ring-2 ring-background">
                        <svg className="w-3 h-3 text-white" viewBox="0 0 308 308" fill="currentColor">
                          <path d="M227.904 176.981c-.6-.288-23.054-11.345-26.693-12.637-3.629-1.303-6.277-1.938-8.917 1.944-2.641 3.886-10.233 12.637-12.547 15.246-2.313 2.598-4.627 2.914-8.582.926-3.955-1.999-16.697-6.13-31.811-19.546-11.747-10.442-19.67-23.338-21.984-27.296-2.313-3.948-.243-6.09 1.74-8.053 1.782-1.764 3.955-4.6 5.932-6.899 1.977-2.31 2.63-3.957 3.955-6.555 1.303-2.609.652-4.897-.326-6.866-.976-1.957-8.917-21.426-12.222-29.34-3.218-7.704-6.488-6.665-8.917-6.787-2.314-.109-4.954-.131-7.595-.131-2.641 0-6.928.976-10.557 4.897-3.629 3.909-13.862 13.49-13.862 32.903 0 19.413 14.188 38.174 16.166 40.804 1.977 2.609 27.92 42.532 67.63 59.644 9.447 4.063 16.826 6.494 22.576 8.313 9.486 3.003 18.12 2.581 24.94 1.563 7.605-1.13 23.053-9.403 26.318-18.492 3.264-9.089 3.264-16.882 2.314-18.492-.976-1.631-3.629-2.598-7.595-4.568zM156.734 0C73.318 0 5.454 67.354 5.454 150.143c0 26.777 7.166 52.988 20.741 75.928L.045 308l84.047-25.65c21.886 11.683 46.583 17.83 71.642 17.83h.065c83.349 0 151.213-67.354 151.213-150.143C307.012 67.354 240.083 0 156.734 0zm0 275.631h-.054c-22.646 0-44.84-6.082-64.154-17.563l-4.605-2.729-47.71 12.456 12.73-46.318-3.004-4.762C36.327 196.123 29.7 173.574 29.7 150.143 29.7 80.575 86.57 24.214 156.8 24.214c34.013 0 65.955 13.203 90.004 37.18 24.049 23.978 37.296 55.853 37.282 89.749-.065 69.568-56.935 125.488-127.352 125.488z"/>
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
                      className="inbox-claim-btn shrink-0 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors"
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
                      isDragTarget={dragOverJid === conv.remoteJid}
                      onFileDrop={(file) => { handleSelectConv(conv.remoteJid); setPendingFile(file); setDragOverJid(null); }}
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
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 308 308" fill="currentColor">
                          <path d="M227.904 176.981c-.6-.288-23.054-11.345-26.693-12.637-3.629-1.303-6.277-1.938-8.917 1.944-2.641 3.886-10.233 12.637-12.547 15.246-2.313 2.598-4.627 2.914-8.582.926-3.955-1.999-16.697-6.13-31.811-19.546-11.747-10.442-19.67-23.338-21.984-27.296-2.313-3.948-.243-6.09 1.74-8.053 1.782-1.764 3.955-4.6 5.932-6.899 1.977-2.31 2.63-3.957 3.955-6.555 1.303-2.609.652-4.897-.326-6.866-.976-1.957-8.917-21.426-12.222-29.34-3.218-7.704-6.488-6.665-8.917-6.787-2.314-.109-4.954-.131-7.595-.131-2.641 0-6.928.976-10.557 4.897-3.629 3.909-13.862 13.49-13.862 32.903 0 19.413 14.188 38.174 16.166 40.804 1.977 2.609 27.92 42.532 67.63 59.644 9.447 4.063 16.826 6.494 22.576 8.313 9.486 3.003 18.12 2.581 24.94 1.563 7.605-1.13 23.053-9.403 26.318-18.492 3.264-9.089 3.264-16.882 2.314-18.492-.976-1.631-3.629-2.598-7.595-4.568zM156.734 0C73.318 0 5.454 67.354 5.454 150.143c0 26.777 7.166 52.988 20.741 75.928L.045 308l84.047-25.65c21.886 11.683 46.583 17.83 71.642 17.83h.065c83.349 0 151.213-67.354 151.213-150.143C307.012 67.354 240.083 0 156.734 0zm0 275.631h-.054c-22.646 0-44.84-6.082-64.154-17.563l-4.605-2.729-47.71 12.456 12.73-46.318-3.004-4.762C36.327 196.123 29.7 173.574 29.7 150.143 29.7 80.575 86.57 24.214 156.8 24.214c34.013 0 65.955 13.203 90.004 37.18 24.049 23.978 37.296 55.853 37.282 89.749-.065 69.568-56.935 125.488-127.352 125.488z"/>
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
              onToggleSidebar={toggleSidebar}
              sidebarOpen={sidebarOpen}
              onOptimisticSend={(msg) => {
                if (!activeSession?.sessionId || !selectedJid) return;
                convStore.handleOptimisticSend({
                  sessionId: activeSession.sessionId,
                  remoteJid: selectedJid,
                  content: msg.content,
                  messageType: msg.messageType,
                });
              }}
              onStatusConfirmed={(data) => {
                if (!activeSession?.sessionId || !selectedJid) return;
                const key = makeConvKey(activeSession.sessionId, selectedJid);
                convStore.confirmSentMessageId(key, data.messageId);
              }}
              pendingFile={pendingFile}
              onClearPendingFile={() => setPendingFile(null)}
            />
          </div>
        )}
      </div>

      {/* ═══ CRM SIDEBAR ═══ */}
      {selectedKey && activeSession && (
        <CrmSidebar
          open={sidebarOpen}
          onToggle={toggleSidebar}
          selectedJid={selectedJid}
          crmContactId={selectedCrmContactId}
          pushName={selectedPushName}
          avatarUrl={selectedContact?.avatarUrl || null}
          onCreateContact={() => setShowCreateContact(true)}
          onCreateDeal={() => setShowCreateDeal(true)}
        />
      )}

      {/* ═══ DIALOGS ═══ */}
      {selectedKey && activeSession && (
        <CreateDealDialog
          open={showCreateDeal}
          onClose={() => setShowCreateDeal(false)}
          contactName={selectedContact?.name || "Passageiro"}
          contactPhone={selectedJid?.split("@")[0] || ""}
          contactJid={selectedJid || ""}
          sessionId={activeSession.sessionId}
          contactId={selectedCrmContactId || undefined}
          skipNavigation
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
