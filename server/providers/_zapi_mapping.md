# Z-API Endpoint Mapping

## Base URL Pattern
`https://api.z-api.io/instances/{INSTANCE_ID}/token/{TOKEN}/{endpoint}`

## Authentication
- Header: `Client-Token: {ACCOUNT_SECURITY_TOKEN}` (optional but recommended)
- Instance ID + Token in URL path

## Partner API (create instances)
- POST `https://api.z-api.io/instances/integrator/on-demand`
- Body: { name, sessionName?, webhooks..., callRejectAuto?, autoReadMessage?, isDevice?, businessDevice? }
- Response: { id, token, due }

## Instance Management
| Action | Method | Endpoint |
|--------|--------|----------|
| Status | GET | /status → { connected, error, smartphoneConnected } |
| QR Code (bytes) | GET | /qr-code |
| QR Code (image) | GET | /qr-code/image → base64 image |
| QR Code (phone) | GET | /phone-code/{phone} |
| Disconnect | GET | /disconnect |
| Restore Session | GET | /restore-session |
| Instance Data | GET | /me |

## Messaging - All return { zaapId, messageId }
| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| Send Text | POST | /send-text | { phone, message, delayMessage?, delayTyping?, editMessageId? } |
| Send Image | POST | /send-image | { phone, image (url/base64), caption?, messageId?, viewOnce? } |
| Send Video | POST | /send-video | { phone, video (url/base64), caption?, messageId?, viewOnce? } |
| Send Audio | POST | /send-audio | { phone, audio (url/base64), messageId?, viewOnce?, waveform? } |
| Send Document | POST | /send-document/{ext} | { phone, document (url/base64), fileName?, messageId? } |
| Send Sticker | POST | /send-sticker | { phone, sticker (url/base64), messageId?, stickerAuthor? } |
| Send Location | POST | /send-location | { phone, title, address, latitude, longitude, messageId? } |
| Send Contact | POST | /send-contact | { phone, contactName, contactPhone, contactBusinessDescription? } |
| Send Reaction | POST | /send-reaction | { phone, messageId, reaction (emoji) } |
| Send Buttons | POST | /send-button-list | { phone, message, buttons[], title?, footer? } |
| Send List | POST | /send-option-list | { phone, optionList: { title, buttonLabel, options[] } } |
| Delete Message | DELETE | /messages?messageId=X&phone=Y&owner=Z | (query params) |
| Read Message | POST | /read-message | { phone, messageId } |

## Chat Operations
| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| Get Chats | GET | /chats?page=X&pageSize=Y | - |
| Get Messages | GET | /chat-messages/{phone}?amount=X | - |
| Archive Chat | POST | /modify-chat | { phone, action: "archive"/"unarchive" } |

## Contacts
| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| Get Contacts | GET | /contacts | - |
| Block Contact | POST | /contacts/modify-blocked | { phone, action: "block"/"unblock" } |
| Check WhatsApp | GET | /phone-exists/{phone} | - |
| Profile Picture | GET | /profile-picture?phone=X | - |

## Groups
| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| Fetch Groups | GET | /groups?page=X&pageSize=Y | - |
| Create Group | POST | /create-group | { groupName, phones[] } |
| Group Metadata | GET | /group-metadata/{groupId} | - |
| Add Participant | POST | /add-participant | { groupId, phones[] } |
| Remove Participant | POST | /remove-participant | { groupId, phones[] } |
| Promote Admin | POST | /promote-participant | { groupId, phones[] } |
| Demote Admin | POST | /demote-participant | { groupId, phones[] } |
| Update Subject | PUT | /update-group-name | { groupId, groupName } |
| Update Description | PUT | /update-group-description | { groupId, groupDescription } |
| Group Invite Link | GET | /group-invite-link/{groupId} | - |
| Revoke Invite | GET | /revoke-group-invite-link/{groupId} | - |
| Leave Group | POST | /leave-group | { groupId } |

## Webhooks
| Webhook | Update Endpoint |
|---------|----------------|
| On Message Received | PUT /update-webhook-received |
| On Message Sent | PUT /update-webhook-delivery |
| On Received + Sent | PUT /update-webhook-received-delivery |
| On Disconnect | PUT /update-webhook-disconnected |
| On Connect | PUT /update-webhook-connected |
| Message Status | PUT /update-webhook-message-status |
| Chat Presence | PUT /update-webhook-presence-chat |
| Update ALL | PUT /update-every-webhooks { value: "url", notifySentByMe?: true } |

## Webhook Payload Formats

### On Message Received (ReceivedCallBack)
```json
{
  "phone": "5511999999999",
  "fromMe": false,
  "messageId": "3EB02A5A36C0103F231A",
  "momment": 1623008318000,
  "status": "RECEIVED",
  "chatName": "Contact Name",
  "senderPhoto": "url",
  "senderName": "Name",
  "participantPhone": null,
  "isGroup": false,
  "isNewsletter": false,
  "isEdit": false,
  "isStatusReply": false,
  "connectedPhone": "5511888888888",
  "type": "ReceivedCallBack",
  "text": { "message": "Hello" },
  "image": { "imageUrl": "url", "caption": "text", "mimeType": "image/jpeg" },
  "audio": { "audioUrl": "url", "mimeType": "audio/ogg" },
  "video": { "videoUrl": "url", "caption": "text", "mimeType": "video/mp4" },
  "document": { "documentUrl": "url", "mimeType": "...", "fileName": "...", "title": "..." },
  "sticker": { "stickerUrl": "url", "mimeType": "image/webp" },
  "location": { "latitude": -23.5, "longitude": -46.6, "name": "...", "address": "..." },
  "contact": { "displayName": "...", "vCard": "...", "phones": ["..."] }
}
```

### On Message Sent (DeliveryCallback)
```json
{
  "phone": "5511999999999",
  "zaapId": "...",
  "type": "DeliveryCallback"
}
```

### Message Status
```json
{
  "phone": "5511999999999",
  "status": "SENT|RECEIVED|READ|PLAYED",
  "messageId": "...",
  "momment": 1623008318000,
  "type": "MessageStatusCallback"
}
```

### Connection Status
```json
{
  "connected": true/false,
  "phone": "5511999999999",
  "type": "ConnectedCallback" | "DisconnectedCallback"
}
```

## Key Differences from Evolution API
1. URL pattern: Z-API uses /instances/{id}/token/{token}/ vs Evolution uses /instance/{name}/
2. Phone format: Z-API uses plain numbers (5511999999999) vs Evolution uses JID (5511999999999@s.whatsapp.net)
3. Send response: Z-API returns { zaapId, messageId } vs Evolution returns { key: { remoteJid, fromMe, id }, messageTimestamp, status }
4. Message format: Z-API uses { text: { message } } vs Evolution uses { message: { conversation } }
5. Webhook: Z-API has separate webhook URLs per event type vs Evolution has single webhook URL
6. Instance creation: Z-API uses partner API vs Evolution uses direct create endpoint
7. Chat list: Z-API uses phone numbers vs Evolution uses JIDs (remoteJid)
8. Media: Z-API provides direct URLs (imageUrl, audioUrl, etc.) vs Evolution requires getBase64FromMediaMessage
