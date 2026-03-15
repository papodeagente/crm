# Auditoria — Integração RD Station Marketing

**Projeto:** ENTUR OS (WhatsApp Automation App)
**Data:** 15/03/2026
**Escopo:** Mapeamento completo do código existente, análise de reaproveitamento e plano de evolução para múltiplas configurações com envio automático de WhatsApp.

---

## 1. O que já existe

A integração RD Station Marketing atual é funcional e está em produção com **6 configurações ativas** distribuídas em 6 tenants diferentes. Abaixo, o mapeamento completo dos componentes envolvidos.

### 1.1 Arquivos Mapeados

| Camada | Arquivo | Linhas | Função |
|--------|---------|--------|--------|
| **Schema** | `drizzle/schema.ts` (L1352-1393) | ~42 | Tabelas `rd_station_config` e `rd_station_webhook_log` |
| **Schema** | `drizzle/schema.ts` (L1400-1416) | ~17 | Tabela `rd_field_mappings` (mapeamento de campos) |
| **Webhook** | `server/webhookRoutes.ts` (L668-893) | ~225 | Endpoint `POST /api/webhooks/rdstation` — recebe leads do RD Station |
| **Processador** | `server/leadProcessor.ts` | 543 | `processInboundLead()` — idempotência, upsert contact, criação de deal |
| **Router tRPC** | `server/routers.ts` (L2225-2369) | ~145 | Endpoints: `getConfig`, `setupIntegration`, `regenerateToken`, `toggleActive`, `getWebhookLogs`, `getStats` |
| **Frontend** | `client/src/pages/RDStationIntegration.tsx` | 757 | Painel de configuração e logs do webhook |
| **Frontend** | `client/src/pages/RDFieldMappings.tsx` | 490 | Mapeamento avançado de campos |
| **CRM Import** | `server/rdStationCrmImport.ts` | 438 | Importação de dados do RD Station CRM (separado) |
| **CRM Import** | `server/routers/rdCrmImportRouter.ts` | 1244 | Router de importação CRM |
| **Frontend** | `client/src/pages/RDCrmImport.tsx` | 649 | UI de importação CRM |
| **Testes** | `server/rdStation.test.ts` | 421 | Testes unitários do fluxo RD Station |
| **Rota** | `client/src/App.tsx` (L125-127) | 3 | Rotas: `/settings/rdstation`, `/settings/rdstation/mappings`, `/settings/import-rd-crm` |

### 1.2 Fluxo Atual do Webhook

O fluxo atual funciona da seguinte forma:

1. O RD Station envia `POST /api/webhooks/rdstation?token=<TOKEN>` com payload `{ leads: [...] }`.
2. O endpoint busca **todas** as configurações ativas na tabela `rd_station_config` e faz match pelo `webhookToken`.
3. O `tenantId` é resolvido a partir da configuração encontrada (multi-tenant correto).
4. Para cada lead no array, extrai dados (nome, email, telefone, UTMs, campos `cf_*`).
5. Chama `processInboundLead(tenantId, payload)` que:
   - Normaliza dados (email, telefone E164, nome)
   - Gera `dedupeKey` para idempotência
   - Verifica duplicidade via `leadEventLog`
   - Faz upsert do contato (busca por email/telefone)
   - Cria deal no **pipeline padrão** do tenant (não usa `defaultPipelineId` da config!)
   - Atribui responsável via round-robin
   - Cria notificação in-app
6. Registra log na tabela `rd_station_webhook_log`.
7. Atualiza contadores na `rd_station_config`.

### 1.3 Schema Atual da Tabela `rd_station_config`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | int (PK) | Auto-incremento |
| `tenantId` | int | Tenant proprietário |
| `webhookToken` | varchar(128) | Token de autenticação do webhook |
| `isActive` | boolean | Ativo/inativo |
| `autoCreateDeal` | boolean | Criar deal automaticamente |
| `defaultPipelineId` | int (nullable) | Pipeline de destino (**não usado atualmente**) |
| `defaultStageId` | int (nullable) | Etapa de destino (**não usada atualmente**) |
| `totalLeadsReceived` | int | Contador de leads |
| `lastLeadReceivedAt` | timestamp | Último lead recebido |
| `createdAt` | timestamp | Data de criação |
| `updatedAt` | timestamp | Última atualização |

### 1.4 Dados em Produção

Existem **6 configurações ativas** com **16 leads processados** no total:

| Tenant | Leads Recebidos | Último Lead | Status |
|--------|----------------|-------------|--------|
| 150002 | 1 | 10/03/2026 | Ativo |
| 1 | 1 | 10/03/2026 | Ativo |
| 210002 | 2 | 13/03/2026 | Ativo |
| 240006 | 9 | 15/03/2026 | Ativo (mais ativo) |
| 240003 | 0 | — | Ativo (sem leads) |
| 240010 | 1 | 14/03/2026 | Ativo |

---

## 2. O que pode ser reaproveitado

A base existente é sólida e a maior parte do código pode ser reaproveitada diretamente:

| Componente | Reaproveitamento | Observação |
|------------|-----------------|------------|
| Tabela `rd_station_config` | **Expandir** | Já suporta 1 config por tenant; precisa de novos campos para múltiplas configs |
| Tabela `rd_station_webhook_log` | **100%** | Já funciona perfeitamente, só adicionar `configId` |
| `processInboundLead()` | **Expandir** | Precisa aceitar `pipelineId` e `stageId` opcionais como parâmetro |
| Webhook endpoint | **Expandir** | Já resolve tenant por token; precisa vincular à config específica |
| Idempotência | **100%** | `dedupeKey` + `leadEventLog` funcionam bem |
| Upsert Contact | **100%** | Normalização e busca por email/telefone |
| Round-robin owner | **100%** | Atribuição de responsável |
| Frontend `RDStationIntegration.tsx` | **Reescrever parcialmente** | Precisa virar lista de configs com CRUD |
| Testes `rdStation.test.ts` | **Expandir** | Base de testes pode ser ampliada |
| `rd_field_mappings` | **100%** | Independente, continua funcionando |
| `rdStationCrmImport` | **100%** | Módulo separado, não afetado |

---

## 3. O que precisa ser criado/alterado

### 3.1 Alterações no Schema (`drizzle/schema.ts`)

A tabela `rd_station_config` precisa de **5 novos campos**:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `name` | varchar(255) | Nome da configuração (ex: "Formulário Landing Page") |
| `defaultSource` | varchar(255) | Origem/fonte padrão opcional |
| `defaultCampaign` | varchar(255) | Campanha padrão opcional |
| `defaultOwnerUserId` | int (nullable) | Responsável padrão opcional |
| `autoWhatsAppEnabled` | boolean | Habilitar envio automático de WhatsApp |
| `autoWhatsAppMessageTemplate` | text | Template da mensagem automática |

A tabela `rd_station_webhook_log` precisa de **1 novo campo**:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `configId` | int (nullable) | FK para `rd_station_config.id` — qual config processou |
| `autoWhatsAppStatus` | varchar(32) | Status do envio automático: `sent`, `failed`, `skipped`, `disabled` |
| `autoWhatsAppError` | text | Erro do envio automático, se houver |

### 3.2 Alterações no `processInboundLead()`

A função `processInboundLead()` atualmente **ignora** os campos `defaultPipelineId` e `defaultStageId` da config e sempre usa o pipeline padrão do tenant. Precisa aceitar parâmetros opcionais:

```typescript
// Assinatura atual:
processInboundLead(tenantId: number, payload: InboundLeadPayload): Promise<ProcessResult>

// Assinatura proposta:
processInboundLead(tenantId: number, payload: InboundLeadPayload, options?: {
  pipelineId?: number;
  stageId?: number;
  ownerUserId?: number;
  source?: string;
  campaign?: string;
}): Promise<ProcessResult>
```

### 3.3 Alterações no Webhook (`webhookRoutes.ts`)

Após `processInboundLead()` retornar com sucesso e a config ter `autoWhatsAppEnabled = true`:

1. Buscar sessão WhatsApp conectada do tenant via `whatsappSessions` no banco.
2. Se houver sessão conectada, interpolar variáveis na mensagem template.
3. Enviar via `whatsappManager.sendTextMessage()`.
4. Registrar resultado no log.
5. Se falhar, **não** desfazer a criação do lead/deal.

### 3.4 Novos Endpoints tRPC

| Endpoint | Tipo | Descrição |
|----------|------|-----------|
| `rdStation.listConfigs` | query | Listar todas as configs do tenant |
| `rdStation.createConfig` | mutation | Criar nova config com token gerado |
| `rdStation.updateConfig` | mutation | Atualizar config existente (nome, pipeline, stage, mensagem, etc.) |
| `rdStation.deleteConfig` | mutation | Excluir/desativar config |
| `rdStation.getConfigLogs` | query | Logs filtrados por configId |

Os endpoints existentes (`getConfig`, `setupIntegration`, `regenerateToken`, `toggleActive`) podem ser mantidos para retrocompatibilidade e gradualmente substituídos.

### 3.5 Frontend

A página `RDStationIntegration.tsx` precisa evoluir de uma **visão de config única** para uma **lista de configs com CRUD**:

- Listagem de configurações (cards ou tabela)
- Botão "Nova Configuração"
- Modal/formulário de criação/edição com:
  - Nome da configuração
  - Seletor de pipeline
  - Seletor de stage (filtrado pelo pipeline selecionado)
  - Origem/campanha padrão
  - Responsável padrão
  - Toggle de envio automático de WhatsApp
  - Textarea para template da mensagem
  - Preview da mensagem com variáveis interpoladas
- Ações por config: ativar/desativar, copiar URL, ver logs, editar, excluir

---

## 4. Riscos de Regressão

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| Alterar `processInboundLead()` pode afetar outros webhooks (Landing Page, Meta, WordPress, Tracking Script) | **Média** | Parâmetros opcionais com fallback para comportamento atual |
| Adicionar colunas na `rd_station_config` pode quebrar queries existentes | **Baixa** | Todos os novos campos são nullable ou com default |
| Frontend precisa manter retrocompatibilidade com configs existentes sem `name` | **Baixa** | Fallback: `name || "Configuração #${id}"` |
| Envio automático de WhatsApp pode falhar silenciosamente | **Baixa** | Logs detalhados + fallback seguro (lead entra mesmo sem WhatsApp) |
| Múltiplas configs com mesmo token (colisão) | **Nula** | Token é gerado com `randomBytes(32)` — 256 bits de entropia |
| Isolamento por tenant | **Nula** | Token resolve tenant; pipeline/stage validados contra tenantId |

### 4.1 Resolução de Sessão WhatsApp por Tenant

Para o envio automático de WhatsApp, a sessão será resolvida da seguinte forma:

1. Consultar `whatsapp_sessions` no banco: `WHERE tenantId = ? AND status = 'connected' LIMIT 1`.
2. Usar o `sessionId` retornado para chamar `whatsappManager.sendTextMessage()`.
3. O `whatsappManager` mantém sessões em memória (`Map<string, EvolutionSessionState>`), então a sessão precisa estar carregada.
4. Se não houver sessão conectada no banco, registrar falha e prosseguir sem envio.

Atualmente, **5 dos 6 tenants com RD Station configurado** possuem sessão WhatsApp conectada:

| Tenant | RD Station Config | WhatsApp Conectado |
|--------|------------------|--------------------|
| 150002 | Sim | Sim (crm-150002-150001) |
| 1 | Sim | Não |
| 210002 | Sim | Sim (crm-210002-240001) |
| 240006 | Sim | Sim (crm-240006-240006) |
| 240003 | Sim | Não |
| 240010 | Sim | Sim (crm-240010-240010) |

---

## 5. Plano de Implementação

A implementação será feita em **5 etapas incrementais**, cada uma testável independentemente:

### Etapa 1 — Schema Migration
Adicionar novos campos na `rd_station_config` e `rd_station_webhook_log`. Todos com defaults/nullable para não quebrar dados existentes.

### Etapa 2 — Backend: `processInboundLead()` com parâmetros opcionais
Expandir a função para aceitar `pipelineId`, `stageId`, `ownerUserId`, `source`, `campaign` opcionais. Fallback para comportamento atual quando não fornecidos.

### Etapa 3 — Backend: Webhook + Auto-WhatsApp
Expandir o webhook handler para:
- Usar `defaultPipelineId`/`defaultStageId` da config
- Após criação do deal, tentar envio automático de WhatsApp se habilitado
- Registrar resultado no log

### Etapa 4 — Backend: Novos endpoints tRPC
Criar endpoints para CRUD de múltiplas configurações, mantendo retrocompatibilidade.

### Etapa 5 — Frontend: Painel de múltiplas configurações
Evoluir a UI para listar, criar, editar e excluir configurações.

### Etapa 6 — Testes
Expandir `rdStation.test.ts` com testes para:
- Múltiplas configs por tenant
- Roteamento para pipeline/stage corretos
- Envio automático de WhatsApp (mock)
- Fallback sem sessão conectada
- Idempotência
- Isolamento por tenant

---

## 6. Estimativa de Impacto

| Métrica | Valor |
|---------|-------|
| Arquivos a alterar | 4 (schema.ts, webhookRoutes.ts, leadProcessor.ts, routers.ts) |
| Arquivos a criar | 0 (tudo expandido nos existentes) |
| Arquivo frontend a reescrever parcialmente | 1 (RDStationIntegration.tsx) |
| Testes a adicionar | ~15-20 novos testes |
| Tabelas novas | 0 |
| Colunas novas | ~8 |
| Endpoints novos | ~4-5 |
| Risco de regressão | Baixo (parâmetros opcionais com fallback) |

---

## 7. Variáveis Dinâmicas Suportadas na Mensagem

O template de mensagem automática suportará as seguintes variáveis:

| Variável | Fonte | Exemplo |
|----------|-------|---------|
| `{nome}` | `payload.name` (normalizado) | "João Silva" |
| `{primeiro_nome}` | Primeiro token de `payload.name` | "João" |
| `{telefone}` | `payload.phone` (E164) | "+5511999887766" |
| `{email}` | `payload.email` | "joao@email.com" |
| `{origem}` | Config `defaultSource` ou `payload.source` | "rdstation" |
| `{campanha}` | Config `defaultCampaign` ou `payload.utm.campaign` | "black-friday" |

Exemplo de template:
```
Olá {primeiro_nome}! 👋

Recebemos seu cadastro e estamos muito felizes em ter você conosco.

Um de nossos consultores entrará em contato em breve para te ajudar.

Enquanto isso, posso te ajudar com algo?
```

---

**Conclusão:** A base existente é robusta e bem estruturada. A evolução para múltiplas configurações com envio automático de WhatsApp pode ser feita com alterações incrementais e baixo risco de regressão. O maior trabalho está na UI (reescrever parcialmente o painel) e na lógica de envio automático de WhatsApp (novo, mas simples de implementar usando os métodos já existentes).
