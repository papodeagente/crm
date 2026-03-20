# Auditoria de Blindagem de Tenant - Achados

## VULNERABILIDADES CRÍTICAS

### V1: routers.ts - ~30 procedures com `tenantId: z.number().default(1)`
- Linhas: 687, 702, 731, 756, 781, 804, 830, 840, 844, 849, 1007, 1013, 1232, 1872, 1875, 1879, 1891, 1903, 1911, 1919, 1929, 1973, 1977, 2013, 2017, 2033, 2049, 2055
- **Risco**: Se frontend não enviar tenantId, default(1) é usado. Tenant 1 não existe, mas dados podem ser criados/lidos no tenant errado.
- **Fix**: Remover default(1), usar ctx.saasUser.tenantId obrigatoriamente

### V2: routers.ts - ~25 procedures com `ctx.saasUser?.tenantId || 1`
- Linhas: 1419, 1434, 1464, 1475, 1482, 1492, 1502, 1508, 1526, 1543, 1559, 1573, 1579, 1585, 1596, 1617, 1638, 1650, 1657
- **Risco**: Se saasUser for null, fallback para tenantId=1
- **Fix**: Throw UNAUTHORIZED se saasUser não existir

### V3: routers.ts - ~6 procedures com `(ctx as any).saasUser?.tenantId || input.tenantId || 1`
- Linhas: 738, 763, 787, 811, 835, 854
- **Risco**: Triplo fallback inseguro - aceita input do cliente como tenant
- **Fix**: Usar apenas ctx.saasUser.tenantId

### V4: crmRouter.ts - 113 usos de `input.tenantId` sem validação contra ctx
- **Risco**: Cliente pode enviar qualquer tenantId e acessar dados de outro tenant
- **Fix**: Ignorar input.tenantId, usar ctx.saasUser.tenantId

### V5: webhookRoutes.ts - 4 endpoints com `const tenantId = 1` hardcoded
- Linhas: 105, 241, 299, 321
- **Risco**: Todos os dados de webhook vão para tenant 1
- **Fix**: Resolver tenant a partir do token/config do webhook

### V6: aiAnalysisRouter.ts - `(ctx.user as any).tenantId ?? 1`
- Linhas: 20, 28, 39
- **Risco**: ctx.user não tem tenantId, sempre cai no fallback 1
- **Fix**: Usar ctx.saasUser.tenantId

### V7: utmAnalyticsRouter.ts - `tenantId: z.number().default(1)` em todos endpoints
- Linhas: 14, 210, 373
- **Risco**: Mesmo que V1
- **Fix**: Usar ctx.saasUser.tenantId

### V8: featureRouters.ts - 21 usos de input.tenantId, 0 validação saasUser
- **Risco**: Mesmo que V4
- **Fix**: Usar ctx.saasUser.tenantId

### V9: inboxRouter.ts - 8 usos de input.tenantId, 0 validação saasUser
- **Risco**: Mesmo que V4
- **Fix**: Usar ctx.saasUser.tenantId

### V10: productCatalogRouter.ts - 14 usos de input.tenantId, 0 validação saasUser
- **Risco**: Mesmo que V4
- **Fix**: Usar ctx.saasUser.tenantId

### V11: rfvRouter.ts - 15 usos de input.tenantId, 1 saasUser ref
- **Risco**: Mesmo que V4
- **Fix**: Usar ctx.saasUser.tenantId

### V12: routers.ts - `ctx.saasUser?.tenantId || 0` em 5 procedures
- Linhas: 240, 327, 595, 603, 611
- **Risco**: Fallback para 0 - dados podem ser criados com tenantId=0
- **Fix**: Throw se saasUser não existir

## ESTRATÉGIA DE CORREÇÃO

### Abordagem: tenantProcedure middleware
Criar um novo middleware `tenantProcedure` que:
1. Exige ctx.saasUser (throw UNAUTHORIZED se null)
2. Injeta tenantId no ctx automaticamente
3. Ignora qualquer input.tenantId do cliente
4. Todos os procedures que acessam dados de tenant usam esse middleware

### Benefícios:
- Uma única mudança no middleware protege TODOS os endpoints
- Não precisa alterar cada procedure individualmente
- Impossível esquecer a validação
