/**
 * useConversationStore — Deterministic client-side conversation state
 *
 * Architecture:
 *   conversationMap: Map<remoteJid, Conversation>  — O(1) lookup
 *   sortedIds: string[]                             — pre-sorted, render-ready
 *
 * Update flow (on socket message):
 *   1. Update conversationMap entry (preview, timestamp, unread)
 *   2. Move conversationId to index 0 of sortedIds
 *   3. Create NEW state object so useSyncExternalStore detects the change
 *   4. React re-renders from sortedIds.map(id => conversationMap.get(id))
 *
 * CRITICAL: useSyncExternalStore uses Object.is to compare snapshots.
 * Every mutation MUST produce a new state object reference.
 *
 * NO refetch. NO polling. NO full sort.
 * Target: < 20ms per update.
 */

import { useCallback, useRef, useSyncExternalStore } from "react";

export interface ConvEntry {
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
}

interface StoreState {
  conversationMap: Map<string, ConvEntry>;
  sortedIds: string[];
  version: number;
}

type Listener = () => void;

class ConversationStore {
  private state: StoreState = {
    conversationMap: new Map(),
    sortedIds: [],
    version: 0,
  };
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /**
   * CRITICAL: Create a new state object reference so useSyncExternalStore
   * detects the change via Object.is comparison.
   */
  private commit(map: Map<string, ConvEntry>, ids: string[]) {
    this.state = {
      conversationMap: map,
      sortedIds: ids,
      version: this.state.version + 1,
    };
    // Notify all subscribers (triggers useSyncExternalStore re-render)
    this.listeners.forEach((l) => l());
  }

  getSnapshot = (): StoreState => this.state;

  /**
   * Initialize from server data (first load only).
   */
  hydrate(conversations: ConvEntry[]) {
    const map = new Map<string, ConvEntry>();
    const ids: string[] = [];

    for (const c of conversations) {
      const jid = c.remoteJid;
      if (!jid) continue;
      const existing = map.get(jid);
      if (!existing) {
        map.set(jid, c);
        ids.push(jid);
      } else {
        const existingTs = existing.lastTimestamp ? new Date(existing.lastTimestamp).getTime() : 0;
        const newTs = c.lastTimestamp ? new Date(c.lastTimestamp).getTime() : 0;
        if (newTs > existingTs) {
          map.set(jid, c);
        }
      }
    }

    ids.sort((a, b) => {
      const ta = map.get(a)?.lastTimestamp ? new Date(map.get(a)!.lastTimestamp!).getTime() : 0;
      const tb = map.get(b)?.lastTimestamp ? new Date(map.get(b)!.lastTimestamp!).getTime() : 0;
      return tb - ta;
    });

    this.commit(map, ids);
  }

  /**
   * Handle incoming socket message.
   * Creates NEW Map and NEW array references to trigger React re-render.
   */
  handleMessage(msg: {
    sessionId?: string;
    remoteJid: string;
    content: string;
    fromMe: boolean;
    messageType: string;
    timestamp: number;
    isSync?: boolean;
  }, activeJid: string | null): boolean {
    const jid = msg.remoteJid;
    if (!jid) return false;

    const oldMap = this.state.conversationMap;
    const oldIds = this.state.sortedIds;
    const existing = oldMap.get(jid);

    if (!existing) {
      return false; // new conversation — caller should fetch from server
    }

    // Only update if this message is newer
    const msgTimestamp = new Date(msg.timestamp);
    const existingTimestamp = existing.lastTimestamp ? new Date(existing.lastTimestamp).getTime() : 0;
    if (msgTimestamp.getTime() < existingTimestamp) {
      return true; // already have newer data
    }

    // Create updated entry
    const updated: ConvEntry = {
      ...existing,
      lastMessage: msg.content || existing.lastMessage,
      lastMessageType: msg.messageType,
      lastFromMe: msg.fromMe,
      lastTimestamp: msgTimestamp,
      lastStatus: msg.fromMe ? "sent" : "received",
      unreadCount: (!msg.fromMe && activeJid !== jid)
        ? (Number(existing.unreadCount) || 0) + 1
        : (activeJid === jid ? 0 : Number(existing.unreadCount) || 0),
    };

    // NEW Map reference with updated entry
    const newMap = new Map(oldMap);
    newMap.set(jid, updated);

    // NEW array reference with conversation moved to top
    let newIds: string[];
    const currentIdx = oldIds.indexOf(jid);
    if (currentIdx > 0) {
      newIds = oldIds.filter(id => id !== jid);
      newIds.unshift(jid);
    } else if (currentIdx === 0) {
      // Already at top — still need new array ref for React
      newIds = [...oldIds];
    } else {
      newIds = [jid, ...oldIds];
    }

    this.commit(newMap, newIds);
    return true;
  }

  /**
   * Handle status update (delivered, read, played)
   */
  handleStatusUpdate(update: { remoteJid: string; status: string }) {
    const jid = update.remoteJid;
    if (!jid) return;

    const existing = this.state.conversationMap.get(jid);
    if (!existing || !existing.lastFromMe) return;

    const newMap = new Map(this.state.conversationMap);
    newMap.set(jid, { ...existing, lastStatus: update.status });

    this.commit(newMap, [...this.state.sortedIds]);
  }

  /**
   * Mark conversation as read
   */
  markRead(jid: string) {
    const existing = this.state.conversationMap.get(jid);
    if (!existing || Number(existing.unreadCount) === 0) return;

    const newMap = new Map(this.state.conversationMap);
    newMap.set(jid, { ...existing, unreadCount: 0 });

    this.commit(newMap, [...this.state.sortedIds]);
  }

  /**
   * Update assignment fields for a conversation
   */
  updateAssignment(jid: string, fields: Partial<Pick<ConvEntry, 'assignedUserId' | 'assignedAgentName' | 'assignmentStatus' | 'assignmentPriority' | 'assignedAgentAvatar'>>) {
    const existing = this.state.conversationMap.get(jid);
    if (!existing) return;

    const newMap = new Map(this.state.conversationMap);
    newMap.set(jid, { ...existing, ...fields });

    this.commit(newMap, [...this.state.sortedIds]);
  }

  /**
   * Get a single conversation by JID
   */
  get(jid: string): ConvEntry | undefined {
    return this.state.conversationMap.get(jid);
  }

  /**
   * Get all conversations as sorted array (for rendering).
   */
  getSorted(): ConvEntry[] {
    const { conversationMap, sortedIds } = this.state;
    const result: ConvEntry[] = [];
    for (const id of sortedIds) {
      const entry = conversationMap.get(id);
      if (entry) result.push(entry);
    }
    return result;
  }

  get isHydrated(): boolean {
    return this.state.conversationMap.size > 0;
  }

  get size(): number {
    return this.state.conversationMap.size;
  }
}

/**
 * React hook that provides the conversation store.
 * Uses useSyncExternalStore for tear-free reads.
 */
export function useConversationStore() {
  const storeRef = useRef<ConversationStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new ConversationStore();
  }
  const store = storeRef.current;

  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );

  const hydrate = useCallback((conversations: ConvEntry[]) => {
    store.hydrate(conversations);
  }, [store]);

  const handleMessage = useCallback((msg: Parameters<ConversationStore['handleMessage']>[0], activeJid: string | null) => {
    return store.handleMessage(msg, activeJid);
  }, [store]);

  const handleStatusUpdate = useCallback((update: { remoteJid: string; status: string }) => {
    store.handleStatusUpdate(update);
  }, [store]);

  const markRead = useCallback((jid: string) => {
    store.markRead(jid);
  }, [store]);

  const updateAssignment = useCallback((jid: string, fields: Parameters<ConversationStore['updateAssignment']>[1]) => {
    store.updateAssignment(jid, fields);
  }, [store]);

  const getConversation = useCallback((jid: string) => {
    return store.get(jid);
  }, [store]);

  const getSorted = useCallback(() => {
    return store.getSorted();
  }, [store]);

  return {
    /** Current state version (triggers re-render on change) */
    version: state.version,
    /** Number of conversations in store */
    size: state.conversationMap.size,
    /** Whether store has been hydrated */
    isHydrated: store.isHydrated,
    /** Initialize from server data */
    hydrate,
    /** Handle incoming socket message. Returns false if conversation is new (needs server fetch). */
    handleMessage,
    /** Handle message status update */
    handleStatusUpdate,
    /** Mark conversation as read */
    markRead,
    /** Update assignment fields */
    updateAssignment,
    /** Get single conversation by JID */
    getConversation,
    /** Get all conversations sorted (for rendering) */
    getSorted,
    /** Direct access to the map for O(1) lookups */
    conversationMap: state.conversationMap,
    /** Direct access to sorted IDs */
    sortedIds: state.sortedIds,
  };
}
