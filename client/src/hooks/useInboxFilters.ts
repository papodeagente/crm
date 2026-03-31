import { useState, useMemo } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

export type InboxTab = "mine" | "queue" | "contacts" | "all" | "finished";
export type AgentFilter = "all" | "unread" | "mine" | "unassigned";

export interface ConvItem {
  conversationKey?: string;
  sessionId?: string;
  remoteJid: string;
  lastMessage: string | null;
  lastMessageType: string | null;
  lastFromMe: boolean | number;
  lastTimestamp: string | Date | null;
  lastStatus: string | null;
  contactPushName: string | null;
  unreadCount: number | string;
  totalMessages?: number | string;
  assignedUserId?: number | null;
  assignedTeamId?: number | null;
  assignmentStatus?: string | null;
  assignmentPriority?: string | null;
  assignedAgentName?: string | null;
  assignedAgentAvatar?: string | null;
  lastSenderAgentId?: number | null;
  conversationId?: number;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  queuedAt?: string | Date | null;
  isPinned?: boolean | number;
  isArchived?: boolean | number;
}

export interface WaContact {
  jid: string;
  phoneNumber: string | null;
  pushName: string | null;
  savedName: string | null;
  verifiedName: string | null;
  displayName: string;
}

// ── Options / Result ────────────────────────────────────────────────────────

interface UseInboxFiltersOptions {
  conversations: ConvItem[];
  queueConversations: ConvItem[];
  finishedConversations?: ConvItem[];
  waContacts?: WaContact[];
  myUserId: number;
  isAdmin: boolean;
  getDisplayName: (jid: string, conv?: ConvItem) => string;
}

interface UseInboxFiltersResult {
  activeTab: InboxTab;
  setActiveTab: (tab: InboxTab) => void;
  filter: AgentFilter;
  setFilter: (f: AgentFilter) => void;
  search: string;
  setSearch: (s: string) => void;
  filteredConvs: ConvItem[];
  filteredQueueConvs: ConvItem[];
  filteredFinishedConvs: ConvItem[];
  filteredWaContacts: WaContact[];
  myConvsCount: number;
  queueCount: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function matchesSearch(
  conv: ConvItem,
  term: string,
  getDisplayName: (jid: string, conv?: ConvItem) => string,
): boolean {
  const name = getDisplayName(conv.remoteJid, conv).toLowerCase();
  const phone = conv.remoteJid.split("@")[0];
  return name.includes(term) || phone.includes(term);
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useInboxFilters(opts: UseInboxFiltersOptions): UseInboxFiltersResult {
  const {
    conversations,
    queueConversations,
    waContacts = [],
    myUserId,
    getDisplayName,
  } = opts;

  const [activeTab, setActiveTab] = useState<InboxTab>("mine");
  const [filter, setFilter] = useState<AgentFilter>("all");
  const [search, setSearch] = useState("");

  // Main conversation list (mine / all tabs)
  const filteredConvs = useMemo(() => {
    let convs = conversations;

    // Tab-based primary filter
    if (activeTab === "mine") {
      convs = convs.filter((c) => c.assignedUserId === myUserId);
    } else if (activeTab === "queue" || activeTab === "contacts" || activeTab === "finished") {
      return [];
    }
    // "all" tab shows everything

    // Secondary filter
    if (filter === "unread") convs = convs.filter((c) => Number(c.unreadCount) > 0);

    // Hide archived
    convs = convs.filter((c) => !(c.isArchived === true || (c.isArchived as number) === 1));

    // Search
    if (search) {
      const s = search.toLowerCase();
      convs = convs.filter((c) => matchesSearch(c, s, getDisplayName));
    }

    // Sort: pinned first, preserve existing timestamp order
    convs.sort((a, b) => {
      const aPinned = a.isPinned === true || a.isPinned === 1 ? 1 : 0;
      const bPinned = b.isPinned === true || b.isPinned === 1 ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return 0;
    });

    return convs;
  }, [conversations, search, filter, activeTab, getDisplayName, myUserId]);

  // Queue conversations filtered by search
  const filteredQueueConvs = useMemo(() => {
    if (activeTab !== "queue") return [];
    if (!search) return queueConversations;
    const s = search.toLowerCase();
    return queueConversations.filter((c) => matchesSearch(c, s, getDisplayName));
  }, [queueConversations, search, activeTab, getDisplayName]);

  // Finished conversations (resolved / closed)
  const filteredFinishedConvs = useMemo(() => {
    if (activeTab !== "finished") return [];
    let convs = conversations.filter(
      (c) => c.assignmentStatus === "resolved" || c.assignmentStatus === "closed",
    );
    if (search) {
      const s = search.toLowerCase();
      convs = convs.filter((c) => matchesSearch(c, s, getDisplayName));
    }
    return convs;
  }, [conversations, search, activeTab, getDisplayName]);

  // WA Contacts filtered by search
  const filteredWaContacts = useMemo(() => {
    if (activeTab !== "contacts") return [];
    if (!search) return waContacts;
    const s = search.toLowerCase();
    return waContacts.filter(
      (c) =>
        c.displayName.toLowerCase().includes(s) ||
        (c.phoneNumber && c.phoneNumber.includes(s)) ||
        c.jid.split("@")[0].includes(s),
    );
  }, [waContacts, search, activeTab]);

  // Badge counts
  const myConvsCount = useMemo(
    () => conversations.filter((c) => c.assignedUserId === myUserId).length,
    [conversations, myUserId],
  );

  const queueCount = queueConversations.length;

  return {
    activeTab,
    setActiveTab,
    filter,
    setFilter,
    search,
    setSearch,
    filteredConvs,
    filteredQueueConvs,
    filteredFinishedConvs,
    filteredWaContacts,
    myConvsCount,
    queueCount,
  };
}
