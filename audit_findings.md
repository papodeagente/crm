# CRM Conversation Logic Hardening — Audit Findings

## Part 1: Channel Detection
- **whatsapp_sessions** table already has `phoneNumber` field
- **NO wa_channels table exists** — NEED TO CREATE
- Need: track phone number per instance, handle reconnect with different phone

## Part 2: Conversation Identity
- **wa_conversations** table uses `conversationKey` (phone-based canonical key)
- `conversationResolver.ts` already resolves by normalized phone
- **Channel ID is NOT part of conversation identity** — NEED TO ADD `channelId` column
- Rule: only apply for NEW messages, existing conversations untouched

## Part 3: Shared Inbox Compatibility
- **session_shares** table exists for sharing instances between users
- **waMessages** already has `senderAgentId` column (int, nullable)
- **wa_conversations** already has `assignedUserId` and `assignedTeamId`
- **BUT**: `senderAgentId` is NEVER set when sending from CRM — NEED TO FIX
- The sendMessage/sendMedia procedures don't pass ctx.user.id to the message insert

## Part 4: CRM History View
- **crmDb.ts** line 1275 already aggregates messages across sessions
- Uses `contact_id` to join across conversations
- **ALREADY WORKS** — just verify

## Part 5: Conversation Preview Protection
- **updateConversationLastMessage** in conversationResolver.ts line 384
- **ALREADY HAS** timestamp protection: `lastMessageAt IS NULL OR lastMessageAt <= newTimestamp`
- **ALREADY WORKS**

## Part 6: Internal Notes Timeline
- **ALREADY FIXED** in previous checkpoints
- Notes merge into timeline via groupedMessages useMemo
- Timestamp serialization fixed with 'Z' suffix

## Part 7: Message Deduplication
- **handleIncomingMessage** already checks for duplicate messageId before insert
- **handleOutgoingMessage** already checks for duplicate messageId before insert
- **INSERT IGNORE** used in sync operations
- **uniqueIndex** on (messageId, sessionId) in schema
- **ALREADY WORKS**

## Part 8: Agent Collision Prevention
- **NO conversation_locks table** — NEED TO CREATE
- **NO soft lock mechanism** — NEED TO IMPLEMENT
- Advisory only, doesn't block sending

## Part 9: Channel Change Safety
- **whatsapp_sessions** tracks phoneNumber
- **NO channel change detection** — NEED TO IMPLEMENT
- Need to detect when instance reconnects with different phone number

## Part 10: Sound Notification Filter
- **Inbox.tsx** line 1103: already filters by `!fromMe && !isMuted && !isSync`
- Already skips `protocolMessage`, `senderKeyDistributionMessage`, `internal_note`
- Already checks `selectedJid !== lastMessage.remoteJid`
- **WhatsAppChat.tsx** line 1425: plays sound for `!lastMsg.fromMe`
- **MOSTLY WORKS** — verify status@broadcast is excluded

## Part 11: Scale Safety
- messageId deduplication: YES (unique index + check before insert)
- Socket events: minimal (only on real messages)
- No polling loops: correct (uses socket.io)
- No heavy background jobs: media download is fire-and-forget

## Summary: What Needs Implementation
1. **wa_channels table** (Part 1 + 9)
2. **channelId on wa_conversations** (Part 2) — optional column for new convs
3. **senderAgentId population** (Part 3) — fix sendMessage/sendMedia to set it
4. **conversation_locks table + soft lock** (Part 8)
5. **Channel change detection** (Part 9) — on connection.update webhook
6. Minor verification on Parts 4, 5, 6, 7, 10, 11
