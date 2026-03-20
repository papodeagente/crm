# Diagnóstico: WhatsApp/Evolution API após Blindagem de Tenant

## Causa Raiz

A blindagem de tenant anterior fez **duas coisas corretas** e **uma incorreta**:

### Correto
1. Removeu `input.tenantId` e `default(1)` / `|| 1` de todos os endpoints
2. Adicionou `getTenantId(ctx)` para extrair tenantId do JWT/sessão SaaS

### Problema
3. **NÃO migrou `protectedProcedure` para `tenantProcedure`** nos endpoints WhatsApp.
   - `protectedProcedure` apenas exige `ctx.user` (Manus OAuth) — NÃO exige `ctx.saasUser`
   - `getTenantId(ctx)` exige `ctx.saasUser?.tenantId` — se `saasUser` não existe, **lança UNAUTHORIZED**
   - Resultado: endpoints WhatsApp que usam `protectedProcedure` + `getTenantId(ctx)` **funcionam** quando o usuário tem sessão SaaS, mas **falham** se o contexto SaaS não estiver presente

### Situação Atual (estado real)
- **104 endpoints** usam `protectedProcedure` + `getTenantId(ctx)` — potencialmente vulneráveis
- **25 endpoints** usam `sessionProtectedProcedure` + `getTenantId(ctx)` — mesma vulnerabilidade
- **17 endpoints** usam `tenantProcedure` (dashboard) — corretos
- **70 endpoints** usam `sessionProtectedProcedure` sem getTenantId — OK (session validation)

### Fluxos Afetados

| Fluxo | Status | Problema |
|-------|--------|----------|
| **connect** (criar sessão) | protectedProcedure + getTenantId | Funciona se saasUser existe, falha se não |
| **sessions** (listar) | protectedProcedure + getTenantId | Idem |
| **sendMessage** | sessionProtectedProcedure (sem getTenantId) | OK — session validation cuida |
| **Evolution webhook** | Express route (sem tRPC) | OK — resolve tenant por instanceName |
| **messageWorker** | Background job | OK — resolve tenant por instanceName |
| **Inbox endpoints** | protectedProcedure + getTenantId | Funciona se saasUser existe |

### Webhooks (webhookRoutes.ts)
- **Evolution webhook**: OK — resolve tenant via `loadSessionByInstanceName()` que parseia `crm-{tenantId}-{userId}`
- **Lead webhooks**: OK — resolve tenant via `resolveLeadsTenantId()`, `resolveWpTenantId()`, `resolveMetaTenantByVerifyToken()`

### Workers (messageWorker.ts)
- **OK** — resolve tenant via `getSessionInfo()` que consulta in-memory sessions ou DB
- Erro TS pré-existente: `waReactions` não exportado do schema (não relacionado à blindagem)

## Solução

### Estratégia: Migrar `protectedProcedure` → `tenantProcedure` nos endpoints WhatsApp

Todos os endpoints que usam `protectedProcedure` + `getTenantId(ctx)` devem ser migrados para `tenantProcedure`, que:
1. Garante `ctx.saasUser` existe
2. Injeta `ctx.tenantId` automaticamente
3. Bloqueia se não houver sessão SaaS válida

Isso é seguro porque:
- Todos os usuários do CRM fazem login via SaaS auth (não via Manus OAuth)
- `tenantProcedure` é mais restritivo que `protectedProcedure`
- `sessionProtectedProcedure` já valida ownership da sessão, mas precisa de tenant para cross-tenant check

### Para `sessionProtectedProcedure`
Criar `sessionTenantProcedure` que combina:
1. Validação de tenant (como tenantProcedure)
2. Validação de ownership da sessão (como sessionProtectedProcedure)
