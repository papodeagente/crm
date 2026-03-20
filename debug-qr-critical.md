# CRITICAL FINDING FROM BAILEYS DOCS

## After scanning QR, WhatsApp FORCIBLY DISCONNECTS the socket
From the official Baileys wiki:
> "After scanning the code, WhatsApp will **forcibly disconnect you**, forcing a reconnect 
> such that we can present the authentication credentials. Don't worry, this is not an error."

## The REQUIRED handler:
```ts
if (connection === 'close' && (lastDisconnect?.error as Boom)?.output?.statusCode === DisconnectReason.restartRequired) {
  // create a new socket, this socket is now useless
}
```

## Current code issue:
The current `connection === "close"` handler treats `restartRequired` as a reconnectable error
and calls `scheduleReconnect()` with exponential backoff. But the Baileys docs say we need to
**create a new socket immediately** — not schedule a reconnect with delay.

## The fix:
When statusCode === DisconnectReason.restartRequired (515):
1. Do NOT use exponential backoff
2. Immediately create a new socket (call _doConnect again)
3. The auth state should be saved from the first connection attempt

## Also: useMultiFileAuthState warning
Baileys docs say: "DONT EVER USE useMultiFileAuthState IN PROD"
It consumes too much IO. But this is a secondary concern.

## Also: Pairing Code as alternative
requestPairingCode(phoneNumber) can be used as alternative to QR.
Phone number must be in E.164 format without plus sign.
