# Enterprise Inbox Stability Fix — Audit Notes

## Current State Analysis

### Part 1-3: Preview System
**Current**: `updateConversationLastMessage()` stores preview in `wa_conversations` table columns (lastMessagePreview, lastMessageType, lastFromMe, lastStatus, lastMessageAt). The inbox query reads these cached columns.
**Problem**: Preview is a cached copy that can get stale. Status updates (line 1731-1739 in whatsappEvolution.ts) update `lastStatus` without checking if it's actually the last message — they just check `lastFromMe=true` which could match an older message's conversation.
**Fix needed**: 
- The `updateConversationLastMessage` already has a timestamp guard (`lastMessageAt <= newTimestamp`), which is correct for Part 3.
- For Part 1-2: The approach of querying the last message from DB each time would be expensive. Instead, we should ensure the cached fields are always correct by:
  1. Making status updates more precise (only update if the message IS the last message)
  2. The current approach is actually fine for preview text/type/timestamp — the issue is only with `lastStatus` being corrupted by status updates for non-last messages.

### Part 4-6: Notification Sounds
**Current**: Guards exist for fromMe, isSync, muted, suppressed, active conversation. 
**Issues found**:
1. Guard 7 checks `selectedJid === lastMessage.remoteJid` — this is correct
2. The `isSync` flag is set in `_core/index.ts` line 69
3. Sound suppression on conversation open (2s) exists
4. Debounce in `createNotificationSound()` exists
5. The `processedMsgRef` dedup set exists
**Status**: Mostly correct. Need to verify the debounce timer in createNotificationSound and ensure the guards are comprehensive.

### Part 7: Optimistic Send
**Current**: Already implemented in WhatsAppChat.tsx lines 1316-1397. Uses `addOptimisticMessage` with negative ID, updates on success, removes on error.
**Status**: Already implemented correctly.

### Part 8: Inbox Performance
**Current**: Every socket message triggers `conversationsQ.refetch()`, `queueQ.refetch()`, `queueStatsQ.refetch()` (line 1115-1117). This is a full refetch of all conversations on EVERY message.
**Problem**: This is the main performance issue. Should use optimistic cache update instead.
**Fix needed**: Replace full refetch with targeted cache update for the affected conversation.

### Part 9-15: Reconciliation
**Current**: Already implemented in `messageReconciliation.ts` with:
- 3-minute interval (spec says 5 min)
- Max 20 conversations per cycle (spec says 10)
- Max 10 messages per conversation (spec says 15)
- 24h window (spec says 48h)
- CPU check at 70%
- Queue length check at 500
- Dedup by messageId (INSERT IGNORE)
- syncOnConversationOpen exists
**Fix needed**: Adjust constants to match spec (5min, 10 convs, 15 msgs, 48h)

### Part 16: Debug Logging
**Current**: Some console.logs exist in the notification handler.
**Fix needed**: Add structured debug logging for all key events.
