# Enterprise Inbox Stability — Verification Report

## Point 1: Preview Source

**STATUS: PARTIALLY COMPLIANT — REQUIRES FIX**

The **server-side query** (`getWaConversationsList` at `server/db.ts:1628-1705`) still reads from **cached fields** in `wa_conversations`:

```sql
-- server/db.ts:1666-1670
wc.lastMessagePreview AS lastMessage,
wc.lastMessageType,
wc.lastFromMe,
wc.lastMessageAt AS lastTimestamp,
wc.lastStatus,
```

This means the **initial page load** uses cached fields. However, the **real-time updates** (via socket) now use the actual message data directly via optimistic cache update (`Inbox.tsx:1130-1142`).

**Root cause**: The SQL query should JOIN `wa_messages` to derive the preview from the actual last message, not from cached columns.

**Fix needed**: Rewrite `getWaConversationsList` to derive preview from `wa_messages` via a subquery/JOIN.

---

## Point 2: Optimistic Message Send

**STATUS: COMPLIANT**

- `WhatsAppChat.tsx:1317-1341` — `addOptimisticMessage()` creates a message with `id: -Date.now()`, `status: "pending"`, and inserts it into the tRPC cache immediately.
- `WhatsAppChat.tsx:1348-1372` — `sendMessage` mutation uses `onMutate` to call `addOptimisticMessage`, then `onSuccess` updates the optimistic message with the real `messageId` and `status: "sent"`.
- `WhatsAppChat.tsx:1363-1371` — `onError` removes the optimistic message and shows a toast.

---

## Point 3: Notification Sound Trigger

**STATUS: COMPLIANT**

- `useSocket.ts:131-134` — `whatsapp:message` event sets `_lastMessage` (messages.upsert)
- `useSocket.ts:137-139` — `whatsapp:message:status` event sets `_lastStatusUpdate` (messages.update)
- `Inbox.tsx:1238` — `playNotification()` is ONLY called inside the `useEffect` that depends on `lastMessage` (line 1240)
- `Inbox.tsx:1242-1256` — The `lastStatusUpdate` useEffect does NOT call `playNotification()`

---

## Point 4: Inbox Refetch Behavior

**STATUS: COMPLIANT (with edge cases)**

- `Inbox.tsx:1111-1150` — On socket message, uses `trpcUtils.whatsapp.waConversations.setData()` to update only the affected conversation in cache.
- `Inbox.tsx:1119` — Full refetch ONLY triggered when the conversation is **new** (not in the current list).
- `Inbox.tsx:1292` — Full refetch ONLY triggered when `syncOnOpen` inserts new messages.
- Other `conversationsQ.refetch()` calls (lines 931, 940, 950, 983, 987, 1020) are for **explicit user actions** (claim, assign, transfer) — not for incoming messages.

---

## Point 5: Preview Timestamp

**STATUS: COMPLIANT (real-time), PARTIALLY COMPLIANT (initial load)**

- Real-time: `Inbox.tsx:1125-1137` — Uses `lastMessage.timestamp` directly from the socket event.
- Initial load: `server/db.ts:1669` — Uses `wc.lastMessageAt` from cached field (same issue as Point 1).

---

## Point 6: Reconciliation Constants

**STATUS: COMPLIANT**

- `messageReconciliation.ts:26` — `MAX_CONVERSATIONS_PER_CYCLE = 10`
- `messageReconciliation.ts:27` — `MAX_MESSAGES_PER_CONVERSATION = 15`
- `messageReconciliation.ts:29` — `RECONCILIATION_INTERVAL_MS = 5 * 60 * 1000` (5 minutes)
- `messageReconciliation.ts:34` — `RECENT_WINDOW_HOURS = 48`
- `messageReconciliation.ts:31-32` — CPU threshold 70%, queue threshold 500
