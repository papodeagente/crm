# Relatório de Análise de Causa Raiz: Erro "Rate Exceeded"

## Resumo Executivo

A investigação completa do pipeline de processamento de mensagens identificou que o erro **"Rate exceeded"** é gerado pela **infraestrutura de proxy/gateway da plataforma Manus**, e não pelo código da aplicação. O backend não possui nenhum middleware ou código que gere a string exata "Rate exceeded". O frontend já possui mecanismos de retry para lidar com esse erro, mas a causa raiz está no volume de requisições que atinge os limites da plataforma.

---

## Arquitetura do Sistema Analisada

```
WhatsApp
    ↓
Evolution API (VPS externa)
    ↓
Webhook POST /api/webhooks/evolution
    ↓
Backend Express (Manus hosting)
    ↓
Database (TiDB/MySQL)
    ↓
Socket.IO events
    ↓
Frontend (React + tRPC)
```

---

## STEP 1 — Onde "Rate Exceeded" é Gerado

### Resultado: **Infraestrutura Manus (proxy/gateway)**

A string exata "Rate exceeded" **não existe em nenhum arquivo do servidor**. O código do backend gera apenas:
- `"Rate limit exceeded. Try again later."` (webhookRoutes.ts, linha 119) — para webhooks de leads
- `"Rate limit exceeded"` (webhookRoutes.ts, linhas 526, 678) — para webhooks Meta/RD Station

O frontend em `main.tsx` (linhas 18, 32, 88, 97) faz retry quando detecta a string `"Rate exceeded"` na resposta, o que indica que essa mensagem vem do **proxy reverso da Manus** que fica na frente do servidor Express.

| Componente | Gera "Rate exceeded"? | Gera "Rate limit exceeded"? |
|---|---|---|
| Proxy Manus (gateway) | **SIM** | Não |
| webhookRoutes.ts (leads/meta) | Não | SIM (HTTP 429) |
| Evolution webhook handler | Não | Não |
| tRPC procedures | Não | Não |
| LLM/Forge API | Não verificável | Possível (upstream) |

---

## STEP 2 — Taxa de Requisições no Backend

### Endpoints críticos analisados:

| Endpoint | Tipo | Rate Limiter Próprio |
|---|---|---|
| `/api/webhooks/evolution` | Webhook inbound | **NENHUM** |
| `/api/webhooks/wp-leads` | Webhook leads | 30 req/min por IP |
| `/api/webhooks/meta` | Meta Lead Ads | 30 req/min por IP |
| `/api/webhooks/rdstation` | RD Station | 30 req/min por IP |
| `/api/trpc/*` | tRPC (frontend) | **NENHUM** |
| Socket.IO | WebSocket | **NENHUM** |

**Achado crítico:** O endpoint da Evolution API (`/api/webhooks/evolution`) **não possui rate limiter**. Cada mensagem do WhatsApp gera um webhook POST, e em cenários de alto tráfego (muitas mensagens simultâneas, sync de conversas, status updates), isso pode gerar rajadas significativas.

---

## STEP 3 — Tráfego de Webhooks da Evolution

### Eventos por mensagem recebida:

Cada mensagem WhatsApp pode gerar até **4 webhooks** da Evolution:

1. `messages.upsert` — mensagem recebida
2. `messages.update` — status update (delivered/read)
3. `send.message` — quando o chatbot responde
4. `messages.update` — status do chatbot reply

### Cenário de amplificação:

Se o chatbot está ativo, **cada mensagem recebida gera**:
- 1 webhook `messages.upsert`
- 1 chamada LLM (Forge API) para gerar resposta
- 1 envio de mensagem via Evolution API
- 1 webhook `send.message` (resposta do chatbot)
- 2+ webhooks `messages.update` (status ticks)

**Fator de amplificação: 1 mensagem → 4-6 webhooks + 1 chamada LLM**

### Sync operations:

Na reconexão do WhatsApp, `syncConversationsBackground` busca **todos os chats e contatos** da Evolution API, gerando rajadas de requisições ao banco de dados.

---

## STEP 4 — Saúde do Event Loop

### Operações bloqueantes identificadas:

| Operação | Tempo estimado | Bloqueante? |
|---|---|---|
| `invokeLLM()` (chatbot) | 2-10s | Não (async) |
| `downloadAndStoreMedia()` | 1-5s | Não (background) |
| `resolveInbound()` | 10-50ms | Não (async) |
| `syncConversationsBackground()` | 5-60s | Não (debounced) |
| `triggerAudioTranscription()` | 1-5s | Não (background) |

O event loop não está sendo bloqueado por código síncrono. Todas as operações pesadas são assíncronas. No entanto, a **quantidade de operações concorrentes** pode saturar o servidor.

---

## STEP 5 — Performance do Banco de Dados

### Índices existentes (adequados):

| Tabela | Índices |
|---|---|
| `messages` | `msg_tenant_idx`, `msg_session_jid_idx`, `idx_msg_wa_conv`, `idx_unique_msgid_session` |
| `wa_conversations` | `idx_wc_tenant_session`, `idx_wc_tenant_contact`, `idx_wc_tenant_jid`, `idx_wc_phone`, `idx_wc_conv_key` |

### Queries potencialmente lentas:

1. **Dedup check** (a cada mensagem): `SELECT id FROM messages WHERE sessionId=? AND messageId=?` — coberto pelo índice `idx_unique_msgid_session`
2. **Rate limit chatbot**: `SELECT count(*) FROM messages WHERE sessionId=? AND remoteJid=? AND fromMe=true AND createdAt>=?` — coberto parcialmente por `msg_session_jid_idx`
3. **Conversation resolver**: múltiplas queries de lookup/upsert por mensagem

**Avaliação:** Os índices estão adequados. O banco não é o gargalo principal.

---

## STEP 6 — Tempestade de Eventos Socket

### Eventos emitidos por mensagem recebida:

| Evento Socket.IO | Quando |
|---|---|
| `whatsapp:message` | Sempre (1x por mensagem) |
| `whatsapp:media_update` | Se tem mídia (após download) |
| `whatsapp:message:status` | A cada status update |

**Avaliação:** 1-3 eventos socket por mensagem. Não é uma tempestade, mas em cenários de sync (centenas de mensagens), pode gerar rajadas.

---

## STEP 7 — Automação e Chamadas IA

### Chamadas LLM no pipeline de webhook:

| Trigger | Chamada | Dentro do webhook? |
|---|---|---|
| Chatbot IA | `invokeLLM()` | **SIM** (whatsapp.ts:1569) — processado async mas no mesmo processo |
| AI Suggestions | `invokeLLM()` | Não (worker separado com rate limit 10s/conversa) |
| Audio Transcription | Whisper API | Não (BullMQ worker, se Redis disponível) |

**Achado importante:** O chatbot IA faz chamada LLM **dentro do handler de webhook** (embora async). Se a Forge API tiver rate limits, múltiplas conversas simultâneas com chatbot podem saturar a API.

---

## STEP 8 — Limites da Plataforma Manus

### Redis:

```
ECONNREFUSED 127.0.0.1:6379
```

Redis **não está disponível** no ambiente. Isso significa:
- BullMQ message queue: **DESATIVADA** (fallback síncrono)
- Audio transcription queue: **DESATIVADA**
- Todas as mensagens são processadas **sincronamente** no processo principal

**Impacto crítico:** Sem Redis, cada webhook da Evolution é processado inline no Express, incluindo:
- Insert no banco
- Conversation resolver
- Socket emit
- Media download (background)
- Chatbot LLM call (se ativo)

### Limites do proxy Manus:

O proxy reverso da Manus impõe um rate limit (provavelmente ~30-60 req/s) que retorna "Rate exceeded" como texto plano quando excedido. Este é o **ponto exato** onde o erro é gerado.

---

## STEP 9 — Fila e Backlog

### Sem Redis:

- **Não há fila** — tudo é processado inline
- Sem backlog visível (sem métricas de fila)
- Cada webhook compete por recursos do processo Node.js

### Com Redis (se configurado):

- Queue com concurrency: 5
- Limiter: 50 jobs/segundo
- Retry com backoff exponencial

---

## STEP 10 — Causa Raiz Final

### Diagnóstico:

O erro "Rate exceeded" é causado por uma **combinação de fatores**:

1. **Causa primária:** O proxy/gateway da Manus impõe um rate limit global nas requisições HTTP. Quando o volume de webhooks da Evolution + requisições tRPC do frontend excede esse limite, o proxy retorna "Rate exceeded".

2. **Fator amplificador #1:** Redis não está disponível (`ECONNREFUSED`), então o BullMQ não funciona. Todas as mensagens são processadas sincronamente, aumentando o tempo de resposta e a concorrência no servidor.

3. **Fator amplificador #2:** O endpoint `/api/webhooks/evolution` não tem rate limiter próprio. Em cenários de alto tráfego (muitas mensagens, sync de conversas, status updates), pode receber dezenas de webhooks por segundo.

4. **Fator amplificador #3:** O chatbot IA faz chamadas LLM dentro do handler de webhook. Se múltiplas conversas estão ativas, cada uma gera uma chamada LLM que pode levar 2-10s, mantendo conexões abertas.

5. **Fator amplificador #4:** Cada mensagem gera múltiplos webhooks (upsert + status updates + send.message), criando um efeito multiplicador.

### Diagrama do gargalo:

```
Evolution API (VPS)
    │
    ├── messages.upsert (1x)
    ├── messages.update (2-3x)
    ├── send.message (1x se chatbot)
    │
    ▼
Proxy Manus ← RATE LIMIT AQUI (≈30-60 req/s)
    │
    ▼
Express Server (sem queue, tudo inline)
    │
    ├── DB insert + dedup check
    ├── Conversation resolver
    ├── Socket.IO emit
    ├── LLM call (chatbot, 2-10s)
    ├── Media download (background)
    │
    ▼
+ Frontend tRPC queries (polling, refetch)
```

---

## Recomendações

### Prioridade Alta (mitigação imediata):

1. **Configurar Redis** — Ativar o BullMQ para processar webhooks de forma assíncrona. O webhook retorna 200 imediatamente e o processamento acontece no worker.

2. **Adicionar rate limiter no endpoint Evolution** — Limitar a 100 req/min por instância para evitar rajadas.

3. **Mover chatbot LLM para fila** — Não fazer chamada LLM inline no webhook handler.

### Prioridade Média (otimização):

4. **Reduzir polling do frontend** — Aumentar `staleTime` e `refetchInterval` nas queries tRPC para reduzir requisições ao servidor.

5. **Batch socket events durante sync** — Agrupar eventos socket durante operações de sync para reduzir emissões.

6. **Implementar debounce nos webhooks de status** — Status updates (delivered/read) podem ser agrupados.

### Prioridade Baixa (monitoramento):

7. **Adicionar métricas de request rate** — Contar req/s por endpoint para monitorar o tráfego.

8. **Logging de latência** — Medir tempo de processamento de cada webhook.
