# Timeline Analysis - Current State

## Existing Tables
- `deal_history` — basic action log (action, description, fromStage, toStage, fieldChanged, oldValue, newValue, actorUserId, actorName, metadataJson)
- `event_log` — generic audit log (actorType, entityType, entityId, action, beforeJson, afterJson, metadataJson)
- `wa_messages` (messages) — individual WhatsApp messages with full metadata
- `rd_station_webhook_log` — RD Station conversion logs with full payload
- `lead_event_log` — generic lead capture events
- `crm_notes` — notes on entities
- `wa_audit_log` — WhatsApp identity audit

## Actions Already Logged in deal_history
- created, stage_moved, field_changed (title, owner, contact, account)
- status_changed, deleted, restored
- product_added, product_updated, product_removed
- participant_added, participant_removed
- whatsapp_backup (daily backup)
- import (RD Station)

## What's Missing for Full Timeline
1. **Task events** — not logged (create, edit, postpone, complete, cancel, delete, reopen)
2. **WhatsApp messages individually** — only daily backup blob, not individual messages
3. **Conversion events** — RD Station logs exist but not in deal_history
4. **RD Station imported data** — payload exists in rd_station_webhook_log but not visible in timeline
5. **Proposal events** — not logged (create, send, accept, reject)
6. **Note events** — notes are merged in frontend but not as timeline events
7. **Assignment/transfer events** — partially logged as field_changed
8. **Automation events** — not logged

## Strategy: Extend deal_history (NOT create new table)
The `deal_history` table already has the right structure and is already being used.
Adding a new table would require migrating all existing data and changing all queries.
Instead, we'll:
1. Add new `action` types to deal_history for all missing events
2. Use `metadataJson` for structured payload (RD data, message details, etc.)
3. Add new fields: `eventCategory`, `eventSource` for filtering
4. Create a unified timeline endpoint that merges deal_history + wa_messages for the deal

## Event Categories for Filters
- conversion — lead capture events
- imported_data — RD Station data
- whatsapp — individual messages
- task — task lifecycle
- funnel — stage moves, status changes
- proposal — proposal lifecycle
- product — product changes
- note — annotations
- assignment — owner/transfer changes
- automation — system/automation events
- audit — integration/system changes

## Frontend Approach
- Replace current HistoryPanel with new DealTimeline component
- Checkbox filters for categories
- Pagination/virtualization for large timelines
- Expandable details for rich payloads
- WhatsApp messages rendered as chat bubbles inline
