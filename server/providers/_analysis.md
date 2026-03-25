# Análise de Migração Evolution → Z-API

## Funções exportadas por evolutionApi.ts (contrato atual)

### Instance Management
- getInstanceName(tenantId, userId) → string
- createInstance(instanceName, opts?) → CreateInstanceResult
- connectInstance(instanceName) → QrCodeResult
- getConnectionState(instanceName) → ConnectionState
- fetchInstance(instanceName) → EvolutionInstance | null
- fetchAllInstances() → EvolutionInstance[]
- logoutInstance(instanceName) → any
- deleteInstance(instanceName) → any
- restartInstance(instanceName) → any

### Messaging
- sendText(instanceName, number, text) → SendMessageResult
- sendMedia(instanceName, number, mediaUrl, mediaType, opts?) → SendMessageResult
- sendAudio(instanceName, number, audioUrl) → SendMessageResult
- sendTextWithQuote(instanceName, number, text, quoted) → SendMessageResult

### Chat Sync
- findChats(instanceName) → any[]
- findContacts(instanceName) → Contact[]
- findMessages(instanceName, remoteJid, opts?) → any[]

### Chat Actions
- markMessageAsRead(instanceName, remoteJid, messageIds) → void
- markMessageAsUnread(instanceName, remoteJid, messageId) → void
- deleteMessageForEveryone(instanceName, remoteJid, messageId, fromMe) → any
- updateMessage(instanceName, number, messageId, text) → SendMessageResult
- sendPresence(instanceName, number, presence) → void
- archiveChat(instanceName, remoteJid, archive) → void
- updateBlockStatus(instanceName, number, status) → void
- checkIsWhatsApp(instanceName, numbers) → CheckResult[]

### Reactions & Rich Messages
- sendReaction(instanceName, key, reaction) → SendMessageResult
- sendSticker(instanceName, number, stickerUrl) → SendMessageResult
- sendLocation(instanceName, number, lat, lng, name, address) → SendMessageResult
- sendContact(instanceName, number, contact) → SendMessageResult
- sendPoll(instanceName, number, name, values, selectableCount) → SendMessageResult
- sendList(instanceName, number, title, desc, buttonText, footer, sections) → SendMessageResult
- sendButtons(instanceName, number, title, desc, footer, buttons) → SendMessageResult

### Profile
- getProfilePicture(instanceName, number) → string | null
- fetchProfile(instanceName, number) → any
- fetchBusinessProfile(instanceName, number) → any

### Groups
- createGroup(instanceName, subject, participants, description?) → any
- fetchAllGroups(instanceName) → any[]
- findGroupByJid(instanceName, groupJid) → any
- findGroupMembers(instanceName, groupJid) → any[]
- updateGroupMembers(instanceName, groupJid, action, participants) → any
- updateGroupSubject(instanceName, groupJid, subject) → any
- updateGroupDescription(instanceName, groupJid, description) → any
- fetchInviteCode(instanceName, groupJid) → string | null
- revokeInviteCode(instanceName, groupJid) → string | null
- updateGroupSetting(instanceName, groupJid, action) → any
- toggleEphemeral(instanceName, groupJid, expiration) → any
- leaveGroup(instanceName, groupJid) → any

### Media
- getBase64FromMediaMessage(instance, messageId, options?) → MediaResult | null

### Health & Webhooks
- healthCheck() → { ok, version?, error? }
- findWebhook(instanceName) → WebhookConfig | null
- setWebhook(instanceName, opts?) → boolean
- ensureWebhook(instanceName) → boolean

### Types
- EvolutionInstance
- CreateInstanceResult
- ConnectionState
- QrCodeResult
- SendMessageResult
- WebhookEventType
- WebhookPayload

## Consumers (arquivos que importam evolutionApi)
1. server/whatsappEvolution.ts - PRINCIPAL (usa quase tudo)
2. server/messageReconciliation.ts - findMessages
3. server/messageWorker.ts - getBase64FromMediaMessage
4. server/audioTranscriptionWorker.ts - getBase64FromMediaMessage
5. server/routers.ts - getBase64FromMediaMessage, ensureWebhook (dynamic imports)

## Webhook Route
- server/webhookRoutes.ts: POST /api/webhooks/evolution (+ /:eventType)

## DB Schema
- whatsapp_sessions: NÃO tem campo provider (precisa adicionar)
