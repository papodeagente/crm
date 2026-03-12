# Research: messages.upsert not firing in Baileys v7

## Key findings:
1. Baileys v7.0.0-rc.9 has known issues with messages.upsert delays
2. The event IS firing (as shown in the GitHub issue logs), but the messages may not be processed correctly
3. The issue in #1924 shows messages DO arrive with `addressingMode: 'pn'` and `remoteJidAlt` fields
4. No mention of needing ev.process() - events fire normally via ev.on()

## Possible causes in our code:
1. The `!msg.message` check at line 639 might filter out messages wrapped in viewOnceMessage or other containers
2. The `SKIP_MESSAGE_TYPES` might be too aggressive
3. The DB write might be failing silently (the dbQueue swallows errors)
4. The Socket.IO emit might not reach the frontend if the socket is disconnected

## Action items:
1. Add detailed console.log at the START of messages.upsert to see if events fire at all
2. Add logging for each filter step (group check, skip type check, etc.)
3. Add logging for DB write success/failure
4. Add logging for Socket.IO emit
5. Check if the notification is being created in the DB
