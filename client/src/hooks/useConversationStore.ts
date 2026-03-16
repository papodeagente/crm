/**
 * useConversationStore — Deterministic client-side conversation state (WhatsApp/Slack style)
 *
 * Architecture:
 *   conversationMap: Map<conversationKey, Conversation>  — O(1) lookup
 *   sortedIds: string[]                                   — pre-sorted, render-ready
 *
 * conversationKey = sessionId + ":" + remoteJid
 * Example: "instance1:558499445034@s.whatsapp.net"
 *
 * Update flow (on socket message):
 *   1. Build key = sessionId + ":" + remoteJid
 *   2. Update conversationMap entry (preview, timestamp, unread)
 *   3. Move conversationKey to index 0 of sortedIds
 *   4. Create NEW state object so useSyncExternalStore detects the change
 *   5. React re-renders from sortedIds.map(id => conversationMap.get(id))
 *
 * CRITICAL: useSyncExternalStore uses Object.is to compare snapshots.
 * Every mutation MUST produce a new state object reference.
 *
 * NO refetch. NO polling. NO full sort.
 * Target: < 20ms per update.
 */

import { useCallback, useRef, useSyncExternalStore } from "react";

export interface ConvEntry {
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
}

interface StoreState {
  conversationMap: Map<string, ConvEntry>;
  sortedIds: string[];
  version: number;
}

type Listener = () => void;

/** Build conversationKey from sessionId + remoteJid */
export function makeConvKey(sessionId: string, remoteJid: string): string {
  return `${sessionId}:${remoteJid}`;
}

/** Extract remoteJid from conversationKey */
export function getJidFromKey(key: string): string {
  const idx = key.indexOf(":");
  return idx >= 0 ? key.slice(idx + 1) : key;
}

/** Extract sessionId from conversationKey */
export function getSessionFromKey(key: string): string {
  const idx = key.indexOf(":");
  return idx >= 0 ? key.slice(0, idx) : "";
}

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
    this.listeners.forEach((l) => l());
  }

  getSnapshot = (): StoreState => this.state;

  /**
   * Initialize from server data (first load only).
   * Builds conversationKey from sessionId + remoteJid.
   */
  hydrate(conversations: ConvEntry[], defaultSessionId?: string) {
    const map = new Map<string, ConvEntry>();
    const ids: string[] = [];

    for (const c of conversations) {
      const jid = c.remoteJid;
      if (!jid) continue;
      const sid = c.sessionId || defaultSessionId || "";
      const key = makeConvKey(sid, jid);
      const entry: ConvEntry = { ...c, conversationKey: key, sessionId: sid };

      const existing = map.get(key);
      if (!existing) {
        map.set(key, entry);
        ids.push(key);
      } else {
        // Keep the one with the latest timestamp
        const existingTs = existing.lastTimestamp ? new Date(existing.lastTimestamp).getTime() : 0;
        const newTs = c.lastTimestamp ? new Date(c.lastTimestamp).getTime() : 0;
        if (newTs > existingTs) {
          map.set(key, entry);
        }
      }
    }

    // Sort only during hydration (initial load)
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
   *
   * @param msg - The incoming message (must include sessionId)
   * @param activeKey - The currently open conversationKey (or null)
   * @returns true if handled, false if conversation is new (needs server fetch)
   */
  handleMessage(msg: {
    sessionId: string;
    remoteJid: string;
    content: string;
    fromMe: boolean;
    messageType: string;
    timestamp: number;
    isSync?: boolean;
  }, activeKey: string | null): boolean {
    const key = makeConvKey(msg.sessionId, msg.remoteJid);
    if (!key || !msg.remoteJid) return false;

    const oldMap = this.state.conversationMap;
    const oldIds = this.state.sortedIds;
    const existing = oldMap.get(key);

    if (!existing) {
      return false; // new conversation — caller should fetch from server
    }

    // Only update if this message is newer
    const msgTimestamp = new Date(msg.timestamp);
    const existingTimestamp = existing.lastTimestamp ? new Date(existing.lastTimestamp).getTime() : 0;
    if (msgTimestamp.getTime() < existingTimestamp) {
      return true; // already have newer data
    }

    // Determine unread count
    let newUnread: number;
    if (msg.fromMe) {
      newUnread = activeKey === key ? 0 : Number(existing.unreadCount) || 0;
    } else if (activeKey === key) {
      newUnread = 0;
    } else {
      newUnread = (Number(existing.unreadCount) || 0) + 1;
    }

    // Create updated entry (immutable)
    const updated: ConvEntry = {
      ...existing,
      lastMessage: msg.content || existing.lastMessage,
      lastMessageType: msg.messageType,
      lastFromMe: msg.fromMe,
      lastTimestamp: msgTimestamp,
      lastStatus: msg.fromMe ? "sent" : "received",
      unreadCount: newUnread,
    };

    // NEW Map reference with updated entry
    const newMap = new Map(oldMap);
    newMap.set(key, updated);

    // NEW array reference with conversation moved to top
    const currentIdx = oldIds.indexOf(key);
    let newIds: string[];
    if (currentIdx === 0) {
      newIds = [...oldIds];
    } else if (currentIdx > 0) {
      newIds = [key, ...oldIds.slice(0, currentIdx), ...oldIds.slice(currentIdx + 1)];
    } else {
      newIds = [key, ...oldIds];
    }

    this.commit(newMap, newIds);
    return true;
  }

  /**
   * Handle status update (delivered, read, played).
   * Uses conversationKey for lookup.
   */
  handleStatusUpdate(update: { sessionId: string; remoteJid: string; status: string }) {
    const key = makeConvKey(update.sessionId, update.remoteJid);
    if (!key) return;

    const existing = this.state.conversationMap.get(key);
    if (!existing || !existing.lastFromMe) return;

    const newMap = new Map(this.state.conversationMap);
    newMap.set(key, { ...existing, lastStatus: update.status });

    this.commit(newMap, [...this.state.sortedIds]);
  }

  /**
   * Mark conversation as read using conversationKey.
   */
  markRead(conversationKey: string) {
    const existing = this.state.conversationMap.get(conversationKey);
    if (!existing || Number(existing.unreadCount) === 0) return;

    const newMap = new Map(this.state.conversationMap);
    newMap.set(conversationKey, { ...existing, unreadCount: 0 });

    this.commit(newMap, [...this.state.sortedIds]);
  }

  /**
   * Update assignment fields for a conversation using conversationKey.
   */
  updateAssignment(conversationKey: string, fields: Partial<Pick<ConvEntry, 'assignedUserId' | 'assignedAgentName' | 'assignmentStatus' | 'assignmentPriority' | 'assignedAgentAvatar'>>) {
    const existing = this.state.conversationMap.get(conversationKey);
    if (!existing) return;

    const newMap = new Map(this.state.conversationMap);
    newMap.set(conversationKey, { ...existing, ...fields });

    this.commit(newMap, [...this.state.sortedIds]);
  }

  /**
   * Get a single conversation by conversationKey (O(1)).
   */
  getConversation(key: string): ConvEntry | undefined {
    return this.state.conversationMap.get(key);
  }

  /**
   * Get a conversation by remoteJid (backward compat scan — O(n)).
   * Use getConversation(key) when possible.
   */
  getByJid(remoteJid: string): ConvEntry | undefined {
    const entries = Array.from(this.state.conversationMap.values());
    return entries.find(e => e.remoteJid === remoteJid);
  }

  /**
   * Get all conversations as sorted array (for rendering).
   * sortedIds.map(id => conversationMap.get(id))
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

  const hydrate = useCallback((conversations: ConvEntry[], defaultSessionId?: string) => {
    store.hydrate(conversations, defaultSessionId);
  }, [store]);

  const handleMessage = useCallback((msg: Parameters<ConversationStore['handleMessage']>[0], activeKey: string | null) => {
    return store.handleMessage(msg, activeKey);
  }, [store]);

  const handleStatusUpdate = useCallback((update: { sessionId: string; remoteJid: string; status: string }) => {
    store.handleStatusUpdate(update);
  }, [store]);

  const markRead = useCallback((conversationKey: string) => {
    store.markRead(conversationKey);
  }, [store]);

  const updateAssignment = useCallback((conversationKey: string, fields: Parameters<ConversationStore['updateAssignment']>[1]) => {
    store.updateAssignment(conversationKey, fields);
  }, [store]);

  const getConversation = useCallback((key: string) => {
    return store.getConversation(key);
  }, [store]);

  const getByJid = useCallback((remoteJid: string) => {
    return store.getByJid(remoteJid);
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
    /** Mark conversation as read (by conversationKey) */
    markRead,
    /** Update assignment fields (by conversationKey) */
    updateAssignment,
    /** Get single conversation by conversationKey (O(1)) */
    getConversation,
    /** Get single conversation by remoteJid (O(n) scan, backward compat) */
    getByJid,
    /** Get all conversations sorted (for rendering) */
    getSorted,
    /** Direct access to the map for O(1) lookups */
    conversationMap: state.conversationMap,
    /** Direct access to sorted IDs */
    sortedIds: state.sortedIds,
  };
}
