# Especificação: Compartilhamento de Sessão WhatsApp

**Autor:** Manus AI  
**Data:** 14 de Março de 2026  
**Versão:** 1.0

---

## 1. Visão Geral

O compartilhamento de sessão WhatsApp permite que um **administrador** do tenant compartilhe sua sessão WhatsApp conectada com outros usuários do mesmo tenant. O usuário que recebe a sessão compartilhada passa a operar no **Inbox** usando a mesma conexão WhatsApp do administrador, sem precisar escanear QR Code ou criar uma instância própria na Evolution API.

Esta funcionalidade é essencial para cenários onde uma agência de viagens possui um único número de WhatsApp corporativo e múltiplos atendentes precisam responder mensagens através desse mesmo número.

---

## 2. Arquitetura Atual

A arquitetura atual do sistema funciona da seguinte forma:

Cada **CRM user** (crmUsers) pertence a um **tenant** e pode ter **uma sessão WhatsApp** própria na tabela `whatsapp_sessions`. A sessão é identificada pelo `sessionId` no formato `crm-{tenantId}-{userId}`, que corresponde a uma instância na Evolution API. As conversas (`wa_conversations`) e mensagens (`messages`) são vinculadas ao `sessionId`, e o Inbox filtra tudo por esse `sessionId`.

| Componente | Descrição |
|---|---|
| `whatsapp_sessions` | Tabela com sessionId, userId, tenantId, status, phoneNumber |
| `wa_conversations` | Conversas canônicas vinculadas a sessionId + remoteJid |
| `messages` | Mensagens vinculadas a sessionId + remoteJid |
| `conversation_assignments` | Atribuição de conversas a agentes (assignedUserId) |
| `validateSessionOwnership` | Middleware que valida: owner tem acesso total, admin acessa qualquer sessão do tenant, user só acessa a própria |
| Evolution API | Cada instância (`crm-{tenantId}-{userId}`) é uma conexão WhatsApp independente |

O endpoint `whatsapp.sessions` retorna apenas as sessões do usuário logado (filtrado por `userId`). O Inbox usa a primeira sessão retornada como `activeSession` e carrega conversas/mensagens desse `sessionId`.

---

## 3. Modelo de Dados Proposto

### 3.1 Nova Tabela: `session_shares`

```
session_shares
├── id (PK, autoincrement)
├── tenantId (int, NOT NULL)
├── sourceSessionId (varchar 128, NOT NULL) → sessão do admin que está sendo compartilhada
├── sourceUserId (int, NOT NULL) → userId do admin dono da sessão
├── targetUserId (int, NOT NULL) → userId que recebe o compartilhamento
├── status (enum: 'active', 'revoked') → controle de ativação
├── sharedBy (int, NOT NULL) → userId do admin que criou o compartilhamento
├── createdAt (timestamp)
├── updatedAt (timestamp)
├── revokedAt (timestamp, nullable)
└── UNIQUE(tenantId, sourceSessionId, targetUserId)
```

Esta tabela registra que o `targetUserId` tem acesso à sessão `sourceSessionId`. Quando o compartilhamento é revogado, o `status` muda para `'revoked'` e `revokedAt` é preenchido.

---

## 4. Regras de Negócio

### 4.1 Quem Pode Compartilhar

Apenas usuários com `role = 'admin'` no tenant podem criar, revogar ou gerenciar compartilhamentos de sessão. O admin pode compartilhar **qualquer sessão conectada do tenant** (não apenas a sua própria) com qualquer outro usuário do mesmo tenant.

### 4.2 Sessão Efetiva do Usuário

A **sessão efetiva** de um usuário é determinada pela seguinte prioridade:

1. **Sessão compartilhada ativa** (`session_shares` com `status = 'active'`) — tem prioridade máxima
2. **Sessão própria** (`whatsapp_sessions` com `userId = currentUser`) — fallback se não houver compartilhamento

Quando um usuário tem uma sessão compartilhada ativa, ele **não precisa**:
- Escanear QR Code
- Criar instância na Evolution API
- Ter uma sessão própria

### 4.3 Cenários de Transição

| Cenário | Comportamento |
|---|---|
| **Usuário sem sessão própria + admin compartilha sessão** | Usuário passa a ver o Inbox com as conversas da sessão compartilhada imediatamente. Não precisa fazer login no WhatsApp. |
| **Usuário com sessão própria conectada + admin compartilha sessão** | Usuário é **desconectado** da sessão própria (a instância na Evolution API é desconectada, mas não deletada). O Inbox passa a mostrar as conversas da sessão compartilhada. |
| **Usuário com sessão compartilhada + admin revoga compartilhamento** | Usuário perde acesso à sessão compartilhada. Se tiver sessão própria, volta a usá-la. Se não tiver, vê a tela "Conecte seu WhatsApp". |
| **Usuário com sessão compartilhada + admin compartilha outra sessão** | A sessão compartilhada anterior é revogada automaticamente. O usuário passa a usar a nova sessão compartilhada. |
| **Admin desconecta sua sessão WhatsApp** | Todos os usuários que compartilham essa sessão perdem a conexão (ficam em modo "desconectado — visualizando histórico"). O compartilhamento permanece ativo — quando o admin reconectar, todos voltam a ter acesso. |
| **Admin deleta sua sessão WhatsApp** | Todos os compartilhamentos dessa sessão são revogados automaticamente. |

### 4.4 Regras de Envio de Mensagens

Quando um usuário envia uma mensagem através de uma sessão compartilhada:
- A mensagem é enviada pela instância da Evolution API do **dono da sessão** (o número que aparece é o do admin)
- O campo `senderAgentId` na tabela `messages` registra o userId do **agente que enviou** (não o dono da sessão)
- No Inbox, as mensagens enviadas por diferentes agentes podem ser diferenciadas pelo `senderAgentId`

### 4.5 Atribuição de Conversas (Multi-Agent)

O sistema de `conversation_assignments` já suporta múltiplos agentes na mesma sessão. Com o compartilhamento:
- Cada conversa pode ser atribuída a um agente específico via `assignedUserId`
- Agentes veem todas as conversas da sessão compartilhada, mas podem filtrar pelas atribuídas a eles
- A atribuição funciona exatamente como já funciona hoje — sem mudanças

### 4.6 Limites e Restrições

- Um usuário pode ter **no máximo 1 sessão compartilhada ativa** por vez
- Um admin pode compartilhar a mesma sessão com **múltiplos usuários**
- O compartilhamento é **intra-tenant** — nunca entre tenants diferentes
- O admin que compartilha a sessão **continua tendo acesso** à mesma sessão normalmente
- Webhooks da Evolution API continuam sendo processados normalmente — as mensagens chegam vinculadas ao `sessionId` original

---

## 5. Fluxo de Dados

### 5.1 Endpoint `whatsapp.sessions` (Modificado)

O endpoint que retorna as sessões do usuário precisa ser modificado para incluir sessões compartilhadas:

```
1. Buscar sessões próprias do userId (como hoje)
2. Buscar session_shares ativas onde targetUserId = userId
3. Para cada share ativo, buscar a sessão fonte (sourceSessionId)
4. Marcar sessões compartilhadas com flag isShared = true
5. Se há sessão compartilhada ativa, ela tem prioridade na lista
6. Retornar: [sessão compartilhada (se existir), ...sessões próprias]
```

### 5.2 Endpoint `whatsapp.connect` (Modificado)

Quando o usuário tem sessão compartilhada ativa, o botão "Conectar" deve ser **desabilitado** ou **oculto** na UI. Se o usuário tentar conectar:
- Verificar se existe compartilhamento ativo
- Se sim, retornar erro: "Você está usando uma sessão compartilhada. Para conectar seu próprio WhatsApp, peça ao administrador para revogar o compartilhamento."

### 5.3 Middleware `validateSessionOwnership` (Modificado)

O middleware precisa ser atualizado para permitir acesso a sessões compartilhadas:

```
1. Verificar se o userId é o dono da sessão (como hoje)
2. Se não for dono, verificar se existe session_share ativo para (sessionId, targetUserId)
3. Se sim, permitir acesso
4. Se não, verificar se é admin do tenant (como hoje)
```

### 5.4 Inbox — Seleção de Sessão Ativa

O `activeSession` no Inbox.tsx precisa priorizar a sessão compartilhada:

```
1. Buscar sessões via whatsapp.sessions (já inclui compartilhadas)
2. Priorizar sessão compartilhada conectada
3. Fallback: sessão própria conectada
4. Fallback: qualquer sessão para visualizar histórico
```

---

## 6. Endpoints Novos (Admin)

| Endpoint | Tipo | Descrição |
|---|---|---|
| `whatsapp.admin.listShares` | query | Lista todos os compartilhamentos do tenant (ativos e revogados) |
| `whatsapp.admin.shareSession` | mutation | Cria compartilhamento: admin escolhe sessão + usuário(s) destino |
| `whatsapp.admin.revokeShare` | mutation | Revoga compartilhamento por ID |
| `whatsapp.admin.revokeAllShares` | mutation | Revoga todos os compartilhamentos de uma sessão |

Todos esses endpoints devem ser protegidos por `adminProcedure` (verificação de `role === 'admin'`).

---

## 7. Interface do Usuário

### 7.1 Painel do Admin (Página WhatsApp)

Na página de configuração do WhatsApp, o admin verá uma nova seção **"Compartilhamento de Sessão"** abaixo da sessão conectada:

- Lista de sessões conectadas do tenant
- Para cada sessão: botão "Compartilhar" que abre um dialog
- No dialog: lista de usuários do tenant com checkbox para selecionar quem recebe
- Indicador visual de quem já tem compartilhamento ativo
- Botão "Revogar" ao lado de cada compartilhamento ativo

### 7.2 Experiência do Usuário Compartilhado

Quando um usuário tem sessão compartilhada:
- **Inbox**: Funciona normalmente, mostrando as conversas da sessão compartilhada
- **Página WhatsApp**: Mostra um banner informativo: "Você está usando a sessão compartilhada de [Nome do Admin] ([número]). Para conectar seu próprio WhatsApp, peça ao administrador para revogar o compartilhamento."
- **Botão Conectar**: Desabilitado enquanto houver compartilhamento ativo
- **Envio de mensagens**: Funciona normalmente — as mensagens saem pelo número do admin

### 7.3 Notificações em Tempo Real

Quando um admin cria ou revoga um compartilhamento, o sistema deve notificar o usuário afetado via Socket.IO:
- `session:shared` — sessão compartilhada com o usuário (refetch sessions)
- `session:unshared` — compartilhamento revogado (refetch sessions, redirecionar se necessário)

---

## 8. Impacto nos Componentes Existentes

| Componente | Mudança Necessária |
|---|---|
| `drizzle/schema.ts` | Adicionar tabela `session_shares` |
| `server/db.ts` | Adicionar funções: `getActiveShareForUser`, `getSharesForSession`, `createShare`, `revokeShare` |
| `server/db.ts` → `validateSessionOwnership` | Adicionar verificação de `session_shares` ativa |
| `server/db.ts` → `getSessionsByUser` | Incluir sessões compartilhadas no resultado |
| `server/routers.ts` → `whatsapp.sessions` | Incluir sessões compartilhadas com flag `isShared` |
| `server/routers.ts` → `whatsapp.connect` | Bloquear conexão se há compartilhamento ativo |
| `server/routers.ts` | Adicionar endpoints admin de compartilhamento |
| `client/src/pages/Inbox.tsx` | Priorizar sessão compartilhada no `activeSession` |
| `client/src/pages/WhatsApp.tsx` | Adicionar seção de compartilhamento para admin, banner para user |
| `client/src/hooks/useSocket.ts` | Adicionar listeners para `session:shared` e `session:unshared` |

---

## 9. Cenários de Teste

| # | Cenário | Resultado Esperado |
|---|---|---|
| 1 | Admin compartilha sessão com user sem sessão própria | User vê Inbox com conversas da sessão compartilhada |
| 2 | Admin compartilha sessão com user que tem sessão própria conectada | Sessão própria é desconectada, user vê Inbox da sessão compartilhada |
| 3 | Admin revoga compartilhamento de user sem sessão própria | User vê tela "Conecte seu WhatsApp" |
| 4 | Admin revoga compartilhamento de user com sessão própria | User volta a ver sua sessão própria (precisa reconectar) |
| 5 | Admin desconecta sua sessão que está compartilhada | Users compartilhados veem banner "desconectado" mas mantêm histórico |
| 6 | Admin reconecta sua sessão após desconexão | Users compartilhados voltam a ter acesso em tempo real |
| 7 | Admin deleta sua sessão que está compartilhada | Todos os compartilhamentos são revogados automaticamente |
| 8 | Admin compartilha sessão A, depois sessão B com mesmo user | Sessão A é revogada, user passa a usar sessão B |
| 9 | User com compartilhamento tenta conectar WhatsApp próprio | Erro: "Revogue o compartilhamento primeiro" |
| 10 | User envia mensagem via sessão compartilhada | Mensagem sai pelo número do admin, senderAgentId = userId do user |
| 11 | Dois users compartilham mesma sessão, ambos enviam mensagens | Ambas mensagens saem pelo mesmo número, senderAgentId diferencia |
| 12 | Admin de outro tenant tenta compartilhar sessão cross-tenant | Erro: FORBIDDEN |

---

## 10. Considerações de Segurança

O compartilhamento de sessão opera dentro dos limites de segurança existentes do sistema. A verificação de tenant é mantida em todos os endpoints — um admin nunca pode compartilhar sessões de outro tenant. O middleware `validateSessionOwnership` é estendido (não substituído) para incluir a verificação de `session_shares`, mantendo todas as proteções existentes. A tabela `session_shares` inclui `sharedBy` para auditoria completa de quem criou cada compartilhamento.

---

## 11. Ordem de Implementação

1. **Schema**: Criar tabela `session_shares` + migração SQL
2. **DB helpers**: `getActiveShareForUser`, `getSharesForSession`, `createSessionShare`, `revokeSessionShare`
3. **Middleware**: Atualizar `validateSessionOwnership` para verificar shares
4. **Router sessions**: Atualizar `whatsapp.sessions` para incluir sessões compartilhadas
5. **Router admin**: Criar endpoints `admin.listShares`, `admin.shareSession`, `admin.revokeShare`
6. **Router connect**: Bloquear conexão se há compartilhamento ativo
7. **Socket.IO**: Emitir eventos `session:shared` e `session:unshared`
8. **Frontend WhatsApp.tsx**: Seção de compartilhamento para admin + banner para user
9. **Frontend Inbox.tsx**: Priorizar sessão compartilhada
10. **Testes**: Cobrir todos os 12 cenários listados
