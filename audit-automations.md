# Audit: Sales Automation Features in ENTUR OS

## Existing Automation Types (Backend)

### 1. Task Automations (taskAutomations)
- **Schema:** task_automations table
- **Trigger:** Deal moves to a specific stage
- **Action:** Create a task (WhatsApp, phone, email, video, generic task)
- **Config:** pipeline, stage, task type, deadline reference (current_date, boarding_date, return_date), offset days, time, assign to owner
- **Page:** /settings/automations (TaskAutomationSettings.tsx)
- **tRPC:** crm.taskAutomations.list/create/update/delete

### 2. Pipeline Automations (pipelineAutomations)
- **Schema:** pipeline_automations table
- **Trigger:** deal_won, deal_lost, or stage_reached
- **Action:** Create a new deal in another pipeline/stage (with optional copy of products, participants, custom fields)
- **Page:** /settings/pipelines (PipelineSettings.tsx, "Automações" tab)
- **tRPC:** crm.pipelineAutomations.list/create/update/delete

### 3. Date-Based Automations (dateAutomations)
- **Schema:** date_automations table
- **Trigger:** N days before/after/on a date field (boardingDate, returnDate, expectedCloseAt, createdAt)
- **Action:** Move deal to a target stage
- **Config:** pipeline, date field, condition, offset days, source stage filter, deal status filter
- **Page:** /settings/date-automations (DateAutomationSettings.tsx)
- **tRPC:** crm.dateAutomations.list/create/update/delete/runNow

### 4. Classification Engine (classificationEngine)
- **Location:** server/classificationEngine.ts
- **Trigger:** Deal won/lost/moved events
- **Action:** Classify contacts (desconhecido, novo_lead, cliente_ativo, etc.), process referral windows, process inactive clients
- **Page:** /settings/classification (ClassificationSettings.tsx)
- **tRPC:** crm.classification.getConfig/updateConfig/updateContactClassification/runNow

### 5. RD Station Marketing Config (per-config automations)
- **Schema:** rd_station_config + rd_station_config_tasks
- **Trigger:** Lead received via webhook
- **Action:** Create deal (custom name), link product, create tasks, send WhatsApp
- **Page:** /settings/rdstation (RDStationIntegration.tsx)
- **tRPC:** rdStation.* (multiple endpoints)

### 6. Cooling/Stale Deal Detection
- **Schema:** pipelineStages.coolingEnabled + coolingDays
- **Trigger:** Deal inactive for N days in a stage
- **Action:** Visual indicator (cooling badge) in pipeline view
- **Page:** Pipeline view + PipelineSettings (stage config)
- **No separate page** — embedded in stage settings

## Current Navigation Structure

### Settings Page (/settings)
- "CONFIGURE SEU PROCESSO DE VENDA" section:
  - Funis de vendas → /settings/pipelines (includes pipeline automations tab)
  - Campos personalizados → /settings/custom-fields
  - **Automação de vendas** → /settings/automations (task automations only)
  - **Automações por data** → /settings/date-automations
  - Classificação estratégica → /settings/classification
- "AVANÇADO" section:
  - RD Station Marketing → /settings/rdstation

### Sidebar (DashboardLayout)
- No direct link to automations
- Settings accessible via gear icon

## What Can Be Centralized (Frontend Only)

| Automation | Current Location | Can Centralize? |
|---|---|---|
| Task automations | /settings/automations | Yes — redirect/embed |
| Pipeline automations | /settings/pipelines (tab) | Yes — redirect |
| Date automations | /settings/date-automations | Yes — redirect/embed |
| Classification engine | /settings/classification | Yes — redirect |
| RD Station auto-tasks/WhatsApp | /settings/rdstation | Yes — redirect |
| Cooling/stale detection | Pipeline stage settings | Yes — redirect |

## Pages That Must Continue Existing
All existing pages must remain accessible. The new hub is an overlay/portal, not a replacement.
