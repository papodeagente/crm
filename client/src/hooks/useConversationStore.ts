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
 * STATUS TICK RULES (CRITICAL — NEVER VIOLATE):
 *   Status progression is STRICTLY MONOTONIC:
 *     error(0) → pending(1) → sending(2) → sent(3) → delivered(4) → read(5) → played(6)
 *   A status can ONLY move FORWARD, NEVER backward.
 *   This applies to:
 *     - Individual message status updates
 *     - Conversation lastStatus in the sidebar
 *     - Hydration from server (re-fetch must NOT overwrite a higher status)
 *     - Reconciliation polling
 *
 * CRITICAL: useSyncExternalStore uses Object.is to compare snapshots.
 * Every mutation MUST produce a new state object reference.
 */

import { useCallback, useRef, useSyncExternalStore } from "react";

// ── STATUS ORDER — Single source of truth ──
// This map defines the ONLY valid ordering for status progression.
// Used everywhere: hydrate, handleMessage, handleStatusUpdate, reconcile.
const STATUS_ORDER: Record<string, number> = {
  error: 0,
  pending: 1,
  sending: 2,
  sent: 3,
  server_ack: 3,  // alias for sent
  delivered: 4,
  delivery_ack: 4, // alias for delivered
  read: 5,
  played: 6,
  received: -1, // incoming messages — not comparable with outgoing statuses
};

/** Get numeric order for a status string. Returns -1 for unknown. */
function getStatusOrder(status: string | null | undefined): number {
  if (!status) return -1;
  return STATUS_ORDER[status.toLowerCase()] ?? -1;
}

/** Returns true if newStatus is strictly higher than currentStatus */
function isStatusHigher(currentStatus: string | null | undefined, newStatus: string | null | undefined): boolean {
  return getStatusOrder(newStatus) > getStatusOrder(currentStatus);
}

/** Pick the higher of two statuses (monotonic max) */
function maxStatus(a: string | null | undefined, b: string | null | undefined): string | null {
  const orderA = getStatusOrder(a);
  const orderB = getStatusOrder(b);
  if (orderB > orderA) return b || null;
  return a || null;
}

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
  /** The messageId of the last outgoing message — used to verify status updates belong to this message */
  _lastOutgoingMessageId?: string;
  /** Tracks if the last update was from an optimistic send (local, not yet confirmed) */
  _optimistic?: boolean;
  /** Local timestamp from optimistic send — takes priority over webhook timestamps */
  _localTimestamp?: number;
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

// Export for testing
export { STATUS_ORDER, getStatusOrder, isStatusHigher, maxStatus };

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
   * Initialize/reconcile from server data.
   * 
   * CRITICAL: When re-hydrating (reconciliation), we MERGE with existing data.
   * Status is NEVER overwritten with a lower value.
   * This prevents the 60s reconciliation from regressing status ticks.
   */
  hydrate(conversations: ConvEntry[], defaultSessionId?: string) {
    const existingMap = this.state.conversationMap;
    const isRehydration = existingMap.size > 0;
    
    const map = new Map<string, ConvEntry>();
    const ids: string[] = [];

    // Valid statuses for fromMe messages
    const validFromMeStatuses = new Set(["sent", "delivered", "read", "played"]);

    for (const c of conversations) {
      const jid = c.remoteJid;
      if (!jid) continue;
      const sid = c.sessionId || defaultSessionId || "";
      const key = makeConvKey(sid, jid);
      const isFromMe = c.lastFromMe === true || c.lastFromMe === 1;

      // Normalize lastStatus on hydration:
      // If the last message is fromMe and status is not a valid delivery status,
      // default to "sent" (the message is already in the DB, so it was sent).
      let normalizedStatus = c.lastStatus;
      if (isFromMe && (!normalizedStatus || !validFromMeStatuses.has(normalizedStatus))) {
        normalizedStatus = "sent";
      }

      let entry: ConvEntry = { ...c, conversationKey: key, sessionId: sid, lastStatus: normalizedStatus };

      // CRITICAL: On re-hydration, preserve the HIGHER status from the existing store.
      // The DB might lag behind socket events, so the store may have a more recent status.
      if (isRehydration) {
        const existing = existingMap.get(key);
        if (existing) {
          const existingIsFromMe = existing.lastFromMe === true || existing.lastFromMe === 1;
          
          // If the existing entry has a higher status, keep it
          if (existingIsFromMe && isFromMe) {
            const existingOrder = getStatusOrder(existing.lastStatus);
            const newOrder = getStatusOrder(normalizedStatus);
            if (existingOrder > newOrder) {
              // Keep the higher status from the existing store
              entry = { ...entry, lastStatus: existing.lastStatus };
            }
          }
          
          // If the existing entry is optimistic (user just sent a message),
          // preserve the optimistic state and local timestamp
          if (existing._optimistic) {
            entry = {
              ...entry,
              lastMessage: existing.lastMessage,
              lastMessageType: existing.lastMessageType,
              lastFromMe: existing.lastFromMe,
              lastTimestamp: existing.lastTimestamp,
              lastStatus: existing.lastStatus,
              _optimistic: existing._optimistic,
              _localTimestamp: existing._localTimestamp,
            };
          }
        }
      }

      const existingInBatch = map.get(key);
      if (!existingInBatch) {
        map.set(key, entry);
        ids.push(key);
      } else {
        // Keep the one with the latest timestamp
        const existingTs = existingInBatch.lastTimestamp ? new Date(existingInBatch.lastTimestamp).getTime() : 0;
        const newTs = c.lastTimestamp ? new Date(c.lastTimestamp).getTime() : 0;
        if (newTs > existingTs) {
          map.set(key, entry);
        }
      }
    }

    // Sort only during hydration
    ids.sort((a, b) => {
      const ta = map.get(a)?.lastTimestamp ? new Date(map.get(a)!.lastTimestamp!).getTime() : 0;
      const tb = map.get(b)?.lastTimestamp ? new Date(map.get(b)!.lastTimestamp!).getTime() : 0;
      return tb - ta;
    });

    this.commit(map, ids);
  }

  /**
   * OPTIMISTIC SEND — called immediately when user sends a message.
   * Updates conversation preview, timestamp, and moves to top.
   * Does NOT wait for Evolution API or webhook.
   */
  handleOptimisticSend(msg: {
    sessionId: string;
    remoteJid: string;
    content: string;
    messageType?: string;
  }): boolean {
    const key = makeConvKey(msg.sessionId, msg.remoteJid);
    if (!key || !msg.remoteJid) return false;

    const oldMap = this.state.conversationMap;
    const oldIds = this.state.sortedIds;
    const existing = oldMap.get(key);

    if (!existing) {
      return false; // conversation not in store
    }

    const now = Date.now();
    const nowISO = new Date(now).toISOString();

    // Create updated entry with optimistic data
    const updated: ConvEntry = {
      ...existing,
      lastMessage: msg.content,
      lastMessageType: msg.messageType || "conversation",
      lastFromMe: true,
      lastTimestamp: nowISO,
      lastStatus: "sending",
      _optimistic: true,
      _localTimestamp: now,
    };

    // NEW Map reference with updated entry
    const newMap = new Map(oldMap);
    newMap.set(key, updated);

    // Move conversation to top (index 0)
    const currentIdx = oldIds.indexOf(key);
    let newIds: string[];
    if (currentIdx === 0) {
      newIds = [...oldIds]; // already at top, just create new reference
    } else if (currentIdx > 0) {
      newIds = [key, ...oldIds.slice(0, currentIdx), ...oldIds.slice(currentIdx + 1)];
    } else {
      newIds = [key, ...oldIds]; // not found, add to top
    }

    this.commit(newMap, newIds);
    return true;
  }

  /**
   * Handle incoming socket message.
   * Creates NEW Map and NEW array references to trigger React re-render.
   *
   * STATUS RULE: When a new message arrives, the conversation's lastStatus
   * is set to the message's status. But if the existing status is HIGHER
   * (e.g., we already got "delivered" and now a "sent" echo arrives),
   * we keep the higher status.
   */
  handleMessage(msg: {
    sessionId: string;
    remoteJid: string;
    content: string;
    fromMe: boolean;
    messageType: string;
    timestamp: number;
    status?: string;
    isSync?: boolean;
    messageId?: string;
  }, activeKey: string | null): boolean {
    const key = makeConvKey(msg.sessionId, msg.remoteJid);
    if (!key || !msg.remoteJid) return false;

    const oldMap = this.state.conversationMap;
    const oldIds = this.state.sortedIds;
    const existing = oldMap.get(key);

    if (!existing) {
      return false; // new conversation — caller should fetch from server
    }

    const msgTimestamp = new Date(msg.timestamp).getTime();
    const existingTimestamp = existing.lastTimestamp ? new Date(existing.lastTimestamp).getTime() : 0;

    // STABLE ORDERING: If this is a fromMe message and we already have a local
    // optimistic timestamp that is >= this message's timestamp, this is the webhook
    // echo of our own sent message. Update preview + status, do NOT re-sort.
    const isWebhookEcho = msg.fromMe && existing._optimistic && existing._localTimestamp && existing._localTimestamp >= msgTimestamp;

    if (isWebhookEcho) {
      // Webhook echo: update preview to match DB (content from socket = content in DB)
      // STATUS RULE: Only update status if the new status is HIGHER than current.
      // The optimistic status is "sending" (order 2), webhook echo brings "sent" (order 3).
      // But if we already received "delivered" (order 4) via a fast status update, keep it.
      const resolvedStatus = maxStatus(existing.lastStatus, msg.status || "sent") || "sent";
      
      const updated: ConvEntry = {
        ...existing,
        lastMessage: msg.content || existing.lastMessage,
        lastMessageType: msg.messageType || existing.lastMessageType,
        lastStatus: resolvedStatus,
        // Track the messageId for status update verification
        _lastOutgoingMessageId: msg.messageId || existing._lastOutgoingMessageId,
        _optimistic: false, // confirmed by server
      };
      const newMap = new Map(oldMap);
      newMap.set(key, updated);
      this.commit(newMap, [...oldIds]);
      return true;
    }

    // For non-echo messages, check if this message is older than what we have
    if (msgTimestamp < existingTimestamp && !msg.fromMe) {
      return true;
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

    // CRITICAL: Determine the status for this conversation update.
    // For fromMe messages: this is a NEW outgoing message, so RESET lastStatus
    // to the message's actual status (typically "sent"). Do NOT use maxStatus here
    // because the previous lastStatus belongs to a DIFFERENT (older) message.
    // maxStatus is only used for webhook echoes (same message, faster status update).
    // For received messages: the status is "received" (not a delivery status).
    let newStatus: string | null;
    if (msg.fromMe) {
      // NEW outgoing message — reset to its actual status
      newStatus = msg.status || "sent";
    } else {
      // Incoming message — status is "received", not a delivery status
      newStatus = "received";
    }

    const newPreview = msg.content || existing.lastMessage;

    // Create updated entry (immutable)
    const updated: ConvEntry = {
      ...existing,
      lastMessage: newPreview,
      lastMessageType: msg.messageType,
      lastFromMe: msg.fromMe,
      lastTimestamp: new Date(msgTimestamp),
      lastStatus: newStatus,
      unreadCount: newUnread,
      // Track the messageId of the last outgoing message for status update verification
      _lastOutgoingMessageId: msg.fromMe && msg.messageId ? msg.messageId : existing._lastOutgoingMessageId,
      _optimistic: false,
      _localTimestamp: undefined,
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
   * RECONCILIATION: Only updates status field, never re-sorts.
   * 
   * CRITICAL: Status MUST only progress forward. NEVER backward.
   * This is the PRIMARY defense against status regression.
   */
  handleStatusUpdate(update: { sessionId: string; remoteJid: string; status: string; messageId?: string }) {
    const key = makeConvKey(update.sessionId, update.remoteJid);
    if (!key) return;

    const existing = this.state.conversationMap.get(key);
    if (!existing) return;

    // lastFromMe can be boolean (true) or number (1) from MySQL
    const isFromMe = existing.lastFromMe === true || existing.lastFromMe === 1;
    
    // If the last message is NOT fromMe, we don't update the conversation status.
    // Status ticks only apply to outgoing messages.
    if (!isFromMe) return;

    // CRITICAL: If we know the last outgoing messageId, only accept status updates
    // for THAT specific message. This prevents status updates for older messages
    // from corrupting the sidebar preview (e.g., old message's "read" overwriting
    // new message's "sent").
    if (existing._lastOutgoingMessageId && update.messageId && 
        existing._lastOutgoingMessageId !== update.messageId) {
      // Status update is for a DIFFERENT (older) message — ignore it
      return;
    }

    // MONOTONIC ENFORCEMENT — the core rule
    // Status can ONLY go forward: error → pending → sending → sent → delivered → read → played
    const currentOrder = getStatusOrder(existing.lastStatus);
    const newOrder = getStatusOrder(update.status);
    
    if (newOrder <= currentOrder) {
      // Would regress — SKIP silently
      return;
    }

    const newMap = new Map(this.state.conversationMap);
    newMap.set(key, {
      ...existing,
      lastStatus: update.status,
      _optimistic: false, // confirmed by server
    });

    // Do NOT change sortedIds — status updates never re-sort
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

  const handleOptimisticSend = useCallback((msg: Parameters<ConversationStore['handleOptimisticSend']>[0]) => {
    return store.handleOptimisticSend(msg);
  }, [store]);

  const handleMessage = useCallback((msg: Parameters<ConversationStore['handleMessage']>[0], activeKey: string | null) => {
    return store.handleMessage(msg, activeKey);
  }, [store]);

  const handleStatusUpdate = useCallback((update: { sessionId: string; remoteJid: string; status: string; messageId?: string }) => {
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
    /** Optimistic send: instantly update conversation preview and move to top */
    handleOptimisticSend,
    /** Handle incoming socket message. Returns false if conversation is new (needs server fetch). */
    handleMessage,
    /** Handle message status update (only updates status, never re-sorts) */
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
