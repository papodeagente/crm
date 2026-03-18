# Inbox Audit — Complete Findings

## BACKEND ISSUES

### ISSUE B1: Socket emitted BEFORE conversation update completes (TIMING)
**Location:** messageWorker.ts lines 337-373
**Problem:** The socket emit at line 362 happens AFTER resolveInbound + updateConversationLastMessage.
**Status:** Actually CORRECT order. resolveInbound (337-358) runs first, then socket emit (361-373).
**Verdict:** NOT a bug. Backend order is correct.

### ISSUE B2: Status update has NO monotonic enforcement (CRITICAL)
**Location:** messageWorker.ts lines 507-512
**Problem:** Status is updated unconditionally with `set({ status: newStatus })`.
No check for regression (e.g., `delivered → sent`).
**Fix needed:** Add monotonic check: only update if newStatus > currentStatus.

### ISSUE B3: Status update on wa_conversations has no monotonic check
**Location:** messageWorker.ts lines 515-523
**Problem:** `lastStatus` is updated WHERE `lastFromMe=true` without checking if the status update
is for the LATEST message or if the new status is actually higher than current.
**Fix needed:** Add monotonic check + verify the status update is for the latest message.

### ISSUE B4: Reaction messages overwrite conversation preview (CRITICAL)
**Location:** messageWorker.ts line 345-352 calls updateConversationLastMessage with reaction content.
**Problem:** extractMessageContent returns reaction emoji text. updateConversationLastMessage stores it
as lastMessagePreview. This makes the preview show "👍" instead of the actual last message.
**Fix needed:** Skip updateConversationLastMessage for non-preview message types.

### ISSUE B5: Protocol messages can overwrite preview
**Location:** Same as B4 — protocol messages (typing, presence, etc.) should not update preview.
**Fix needed:** Filter non-preview types before calling updateConversationLastMessage.

### ISSUE B6: Auto-transcribe still has !fromMe filter (NOT SAVED)
**Location:** messageWorker.ts line 426
**Problem:** Previous fix was not saved in checkpoint. Still has `!fromMe &&`.
**Fix needed:** Remove `!fromMe` (already done in this session).

## FRONTEND ISSUES

### ISSUE F1: ConversationStore is correct architecture (GOOD)
- Single source of truth via ConversationStore class
- useSyncExternalStore for tear-free reads
- O(1) map lookup, O(n) splice for moveToTop
- Immutable updates (new Map, new array references)
- Status monotonic enforcement in handleStatusUpdate (lines 349-354)
**Verdict:** Architecture is sound.

### ISSUE F2: Socket message handler correctly updates store (GOOD)
- handleMessage updates preview, timestamp, unread, moves to top
- Webhook echo detection prevents double-sort
- Old messages arriving late are ignored
**Verdict:** Correct.

### ISSUE F3: Reaction messages pass through to store (CRITICAL)
**Location:** Inbox.tsx lines 1245-1252 — previewSkipTypes list
**Problem:** The list includes many types but may not include ALL non-preview types.
Need to verify reactionMessage is in the skip list.
**Fix needed:** Ensure reactionMessage is in previewSkipTypes.

### ISSUE F4: No socket event for assignment/ownership changes
**Location:** Inbox.tsx — no handler for assignment changes via socket
**Problem:** When a conversation is assigned/transferred, the frontend only knows via refetch.
**Fix needed:** Emit socket event on assignment change, handle in frontend.

### ISSUE F5: Queue stats rely on separate query (queueStatsQ)
**Location:** Inbox.tsx — queueStatsQ is a separate tRPC query
**Problem:** Queue/my chats tab counts may lag behind actual assignment changes.
**Fix needed:** Update queue counts from socket events.

## DB ISSUES

### ISSUE D1: No index on wa_conversations(lastMessageAt)
**Fix needed:** Add index.

### ISSUE D2: No index on wa_messages(sessionId, messageId) for dedup
**Fix needed:** Verify index exists.

### ISSUE D3: wa_conversations preview can be stale from reactions/protocol messages
**Fix needed:** DB repair script to rebuild from latest meaningful message.
