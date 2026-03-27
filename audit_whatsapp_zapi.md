# Auditoria WhatsApp Z-API — Análise Completa

## 1. Arquitetura Geral

### Arquivos Principais
| Arquivo | Linhas | Função |
|---------|--------|--------|
| server/providers/zapiProvider.ts | ~1200 | Provider Z-API: conexão, envio, webhook, fotos |
| server/providers/zapiWebhookNormalizer.ts | ~400 | Normaliza webhooks Z-API → formato Evolution |
| server/whatsappEvolution.ts | ~2700 | Manager central: sync, dedup, profile pics, chatbot |
| server/webhookRoutes.ts | ~1450 | Rotas de webhook (Z-API + Evolution + WP) |
| server/conversationResolver.ts | ~400 | Resolve/cria conversas com race condition handling |
| server/messageQueue.ts | ~290 | BullMQ queue para processamento async |
| client/src/pages/Inbox.tsx | ~2100 | Frontend Inbox com chat, lista, tabs |
| client/src/components/WhatsAppChat.tsx | ~1500 | Componente de chat individual |

## 2. Problemas Encontrados — Backend

### 2.1 CRÍTICO: Webhook sem idempotência a nível de evento
**Local:** `webhookRoutes.ts` handleZApiWebhook (L1325-1430)
**Problema:** O handler Z-API não tem dedup de webhook events. Se Z-API reenviar o mesmo evento (retry), ele será processado novamente. A dedup existe apenas no nível de mensagem (uniqueIndex no messageId+sessionId), mas eventos de status update e connection podem ser processados duplicados.
**Impacto:** Status updates duplicados, logs inflados, processamento desnecessário.
**Correção:** Adicionar cache in-memory (LRU) com TTL de 60s para dedup de eventos por hash(sessionId+eventType+messageId).

### 2.2 ALTO: zapiFetch sem retry automático
**Local:** `zapiProvider.ts` zapiFetch
**Problema:** A função zapiFetch faz uma única tentativa. Se a Z-API retornar 429 (rate limit) ou 5xx (erro temporário), a operação falha sem retry.
**Impacto:** Mensagens podem falhar em picos de tráfego ou instabilidade da Z-API.
**Correção:** Adicionar retry com backoff exponencial (3 tentativas, 1s/2s/4s) para status 429 e 5xx.

### 2.3 ALTO: Profile pictures sem refresh periódico
**Local:** `whatsappEvolution.ts` getProfilePictures (PROFILE_PIC_TTL = 24h)
**Problema:** O TTL de 24h é bom, mas não há job periódico para refresh em background. As fotos só são atualizadas quando o frontend faz a query. Se um contato muda a foto, ela fica desatualizada até o próximo acesso.
**Impacto:** Fotos desatualizadas por até 24h.
**Correção:** Baixa prioridade — o TTL de 24h é razoável. Poderia adicionar refresh em background durante sync, mas não é crítico.

### 2.4 MÉDIO: resolveConversation race condition parcialmente tratada
**Local:** `conversationResolver.ts` resolveConversation
**Problema:** Usa try/catch com duplicate key para lidar com race conditions, o que é correto. Porém, o retry após duplicate key faz um SELECT que pode falhar se a conversa foi criada por outro processo com dados ligeiramente diferentes.
**Impacto:** Raro, mas pode causar erro em alta concorrência.
**Status:** Já tratado com padrão INSERT-or-SELECT. Aceitável.

### 2.5 MÉDIO: Falta index composto em messages para query de chat
**Local:** `drizzle/schema.ts` waMessages
**Problema:** A query `messagesByContact` filtra por `sessionId + remoteJid + timestamp DESC LIMIT N`. O index existente `msg_session_jid_idx` cobre `(sessionId, remoteJid, timestamp)` — OK, está correto.
**Status:** Indexes adequados. Nenhuma ação necessária.

### 2.6 BAIXO: Webhook handler retorna 200 mesmo em erro
**Local:** `webhookRoutes.ts` L1424
**Problema:** O catch retorna `res.status(200).json({ received: true, error: error.message })`. Isso é intencional para evitar que Z-API faça retry infinito, mas dificulta debugging.
**Status:** Padrão correto para webhooks. O log de erro no console é suficiente.

### 2.7 BAIXO: BullMQ limiter pode ser agressivo
**Local:** `messageQueue.ts` L261-263
**Problema:** Limiter de 50 jobs/segundo com concurrency 5. Para alto volume, isso pode criar backlog.
**Status:** Adequado para o volume atual. Monitorar se crescer.

## 3. Problemas Encontrados — Frontend

### 3.1 ALTO: Lista de conversas sem virtualização
**Local:** `Inbox.tsx` L1884 — `filteredConvs.map(...)`
**Problema:** Todas as conversas são renderizadas no DOM. Com 500+ conversas, isso causa lag no scroll e re-renders lentos.
**Impacto:** Performance degradada com muitas conversas.
**Correção:** Implementar virtualização com `@tanstack/react-virtual` ou limitar a lista visível com "load more".

### 3.2 MÉDIO: ConversationItem já usa React.memo — OK
**Local:** `Inbox.tsx` L359
**Status:** Corretamente memoizado. Sem ação necessária.

### 3.3 MÉDIO: WaAvatar já usa React.memo — OK
**Local:** `Inbox.tsx` L208
**Status:** Corretamente memoizado com fallback de iniciais. Sem ação.

### 3.4 MÉDIO: Profile pics query pode ser otimizada
**Local:** `Inbox.tsx` — profilePictures query
**Problema:** Envia todos os JIDs visíveis de uma vez. Se houver 500 conversas, envia 500 JIDs na query.
**Correção:** Limitar a 50 JIDs por vez (os visíveis na viewport) ou usar intersection observer.

### 3.5 BAIXO: WhatsAppChat já tem paginação — OK
**Local:** `WhatsAppChat.tsx` L1375-1390
**Status:** Carrega 50 mensagens iniciais, load more por scroll up. Correto.

### 3.6 BAIXO: Socket reconexão configurada — OK
**Status:** Socket.IO tem reconexão automática built-in. Adequado.

## 4. Resumo de Ações Recomendadas

### Correções a Aplicar (por prioridade):

1. **Webhook dedup** — Adicionar LRU cache para dedup de eventos Z-API (CRÍTICO)
2. **zapiFetch retry** — Adicionar retry com backoff para 429/5xx (ALTO)
3. **Lista virtualizada** — Implementar virtualização na lista de conversas (ALTO)
4. **Profile pics batch** — Limitar batch de JIDs para profile pics (MÉDIO)

### Já Correto (sem ação):
- Indexes no banco adequados
- ConversationItem e WaAvatar memoizados
- Race condition em resolveConversation tratada
- Paginação de mensagens no chat
- BullMQ com retry e backoff
- Socket reconexão automática
- Webhook retorna 200 em erro (padrão correto)
