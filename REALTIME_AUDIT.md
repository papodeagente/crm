# REALTIME CONSISTENCY AUDIT — Full Pipeline Trace

## ENTRY POINTS TRACED

### 1. INBOUND MESSAGE (messages.upsert)
- **Pipeline**: webhook → messageQueue → processNewMessage → DB insert → resolveInbound → updateConversationLastMessage → socket emit
- **wa_conversations update**: YES (synchronous, before socket emit) ✅
- **Socket emit**: YES (whatsapp:message) ✅
- **Frontend handler**: lastMessage → convStore.handleMessage() → immutable update + moveToTop ✅
- **Issues found**: 
  - Socket emit does NOT include conversationId or full preview payload (only raw message fields)
  - Frontend derives preview from socket message content, NOT from wa_conversations
  - This is CORRECT because the socket message IS the source event, and convStore updates atomically

### 2. OUTBOUND MESSAGE (send.message)
- **Pipeline**: same as inbound (both go through processNewMessage)
- **wa_conversations update**: YES ✅
- **Socket emit**: YES ✅
- **Frontend**: handleOptimisticSend() called BEFORE API call → instant preview + moveToTop ✅
- **Webhook echo**: detected via _optimistic + _localTimestamp → only updates status, no re-sort ✅

### 3. STATUS UPDATE (messages.update)
- **Pipeline**: webhook → messageQueue → processStatusUpdate → DB update → socket emit
- **wa_messages update**: YES with monotonic enforcement ✅
- **wa_conversations update**: YES with SQL-level monotonic check ✅
- **Socket emit**: YES (whatsapp:message:status) ✅
- **Frontend handler**: lastStatusUpdate → convStore.handleStatusUpdate() → monotonic check → immutable update ✅
- **Issues found**:
  - Status update only updates wa_conversations if lastFromMe=true AND remoteJid matches
  - This is CORRECT — only the latest fromMe message's status matters for preview tick

### 4. REACTION (reactionMessage)
- **Pipeline**: webhook → messageQueue → processNewMessage → DB insert → SKIP updateConversationLastMessage → socket emit
- **wa_conversations update**: NO (correctly skipped via NON_PREVIEW_TYPES) ✅
- **Socket emit**: YES but filtered by frontend previewSkipTypes ✅
- **Frontend**: previewSkipTypes includes 'reactionMessage' → no store update ✅

### 5. TEMPLATE (templateButtonReplyMessage)
- **Pipeline**: same as inbound message
- **wa_conversations update**: YES (treated as normal preview) ✅
- **Socket emit**: YES ✅

### 6. ASSIGNMENT (assignConversation, claim, enqueue, transfer, finish)
- **Pipeline**: tRPC mutation → DB update → socket emit (conversationUpdated)
- **wa_conversations update**: YES (via db functions) ✅
- **Socket emit**: YES (conversationUpdated with type field) ✅
- **Frontend handler**: lastConversationUpdate → convStore.updateAssignment() + queueStatsQ.refetch() ✅

### 7. MESSAGE DELETE (messages.delete)
- **Pipeline**: webhook → messageQueue → processMessageDelete → DB update → socket emit
- **wa_conversations update**: NO ❌ (deleted message may be the last message, preview becomes stale)
- **Socket emit**: YES (whatsapp:message:deleted) ✅
- **Frontend handler**: NOT handled in Inbox.tsx ❌

## ISSUES FOUND

### ISSUE 1: Message delete does NOT update wa_conversations preview
- When a message is deleted, the preview may still show the deleted message content
- Fix: After marking message as deleted, check if it was the last message and update preview

### ISSUE 2: Background sync refetch when socket disconnected
- Line 1020-1025: When socket is disconnected, a bgSync interval refetches and re-hydrates
- This is a FALLBACK but it's for disconnection recovery, not normal operation
- ACCEPTABLE for disconnection recovery only

### ISSUE 3: New conversation refetch
- Line 1278-1283: When a message arrives for a conversation NOT in the store, a refetch is triggered
- This is NECESSARY for first-time conversations
- ACCEPTABLE — not a fallback, it's a one-time initialization

### ISSUE 4: syncOnOpen refetch
- Line 1399-1403: When opening a conversation, if new messages were inserted during sync, refetch
- This is for catching messages that arrived while the conversation list was stale
- ACCEPTABLE — but should be minimized

### ISSUE 5: Queue/stats polling
- Lines 1039, 1043: queueQ and queueStatsQ have refetchInterval (30s/60s)
- These are for queue management, not inbox preview
- ACCEPTABLE — queue data is not part of the realtime preview pipeline

## HIDDEN FALLBACKS TO REMOVE

### FALLBACK 1: conversationsQ.refetch() in bgSync (line 1020-1025)
- Only active when socket is disconnected
- KEEP — this is legitimate disconnection recovery

### FALLBACK 2: conversationsQ.refetch() for new conversations (line 1278-1283)
- Only for conversations not yet in the store
- KEEP — necessary for first-time conversations

### FALLBACK 3: conversationsQ.refetch() after syncOnOpen (line 1399-1403)
- Only when new messages were inserted during sync
- KEEP — necessary for conversation open sync

### FALLBACK 4: queueQ.refetch() / queueStatsQ.refetch() in mutation onSuccess
- Used after claim, assign, finish mutations
- SHOULD BE REPLACED with socket-driven updates where possible

## CONCLUSION

The architecture is already mostly correct:
1. wa_conversations is updated BEFORE socket emit ✅
2. Socket emit happens for ALL entry points ✅ (except message delete preview)
3. Frontend uses immutable store with useSyncExternalStore ✅
4. Reorder happens on every message via moveToTop ✅
5. Status is monotonic on both backend and frontend ✅
6. No hidden refetch for normal message flow ✅

Remaining fixes needed:
1. Message delete → update wa_conversations preview
2. Add conversation:update socket event with FULL payload for all wa_conversations changes
3. Remove unnecessary queueQ.refetch() in mutation onSuccess (use socket instead)
