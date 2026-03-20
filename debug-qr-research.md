# QR Code Research Findings

## Key Issue: Baileys QR not connecting on VPS/production
- GitHub issue openclaw/openclaw#15614 reports SAME problem: QR displays but WhatsApp mobile doesn't recognize it
- Works locally but NOT on VPS/remote servers
- This is likely a Baileys version issue or protocol change by WhatsApp

## Possible causes:
1. **Baileys version 7.0.0-rc.9 is a release candidate** - may have bugs
2. **WhatsApp protocol changes** - WhatsApp frequently changes protocols
3. **Network/proxy issues in production** - production server may have different network config
4. **Pairing code as alternative** - Baileys supports `requestPairingCode()` as alternative to QR

## Solution: Add pairing code support
- `requestPairingCode(phoneNumber)` generates an 8-digit code
- User enters the code on their phone instead of scanning QR
- This is more reliable on remote/VPS environments
- WhatsApp Settings > Linked Devices > Link a Device > Link with phone number instead

## Also try:
- Update Baileys to latest version
- Try different browser config (Chrome instead of macOS Desktop)
