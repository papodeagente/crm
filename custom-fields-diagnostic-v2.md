# Diagnóstico Completo — Campos Personalizados v2

## Causas Raiz Identificadas

### 1. Entidades incorretas no seletor
- **Schema (drizzle/schema.ts)**: enum entity = ["contact", "deal", "account", "trip"]
- **CustomFieldsSettings.tsx**: ENTITIES array inclui "account" (Contas) e "trip" (Viagens)
- **routers.ts**: z.enum(["contact", "deal", "account", "trip"]) em 5 locais
- **Correção**: Alterar para ["contact", "deal", "company"] em schema, routers e frontend
- **Nota**: "account" no banco precisa ser migrado para "company" ou manter compatibilidade

### 2. Campos não sincronizam após criação
- **CustomFieldsSettings.tsx usa tenantId = 1 hardcoded** (não usa useTenantId hook)
- **Inbox.tsx**: Criação de contato NÃO inclui campos personalizados
- **Inbox.tsx**: Criação de negociação NÃO inclui campos personalizados
- **Pipeline.tsx**: Tem campos personalizados na criação de deal ✓
- **Contacts.tsx**: Tem campos personalizados na criação de contato ✓
- **ContactProfile.tsx**: Tem campos personalizados na edição ✓
- **DealDetail.tsx**: Tem CustomFieldsSidebar mas só para "deal" entity ✓

### 3. Campos não separados por contexto na negociação
- **DealDetail.tsx**: Só carrega campos de "deal", não carrega campos de "contact" e "company"
- **Precisa**: Seções separadas para campos de contato, empresa e negociação

### 4. Filtros não implementados
- Nenhuma infraestrutura de filtro por campos personalizados existe

### 5. Campos padrão de contato (aniversário/casamento)
- Tabela contacts NÃO tem campos birthDate/weddingDate
- Opção: Usar como custom_fields padrão do sistema (isSystem flag)
- Ou: Adicionar colunas nativas à tabela contacts

### 6. Notificações
- Infraestrutura de notificações existe (createNotification em db.ts)
- Infraestrutura de e-mail existe (emailService.ts com Resend)
- Infraestrutura de scheduler existe (dateAutomationScheduler.ts)
- user_preferences existe para configurações por usuário

## Arquivos a Alterar

### Schema
- drizzle/schema.ts: Alterar enum entity, adicionar birthDate/weddingDate a contacts

### Backend
- server/routers.ts: Alterar z.enum em 5 locais
- server/db.ts: Adicionar funções de filtro por custom fields
- server/emailService.ts: Adicionar template de aniversariantes
- server/birthdayScheduler.ts: NOVO — scheduler para notificações

### Frontend
- client/src/pages/CustomFieldsSettings.tsx: Corrigir ENTITIES, usar useTenantId
- client/src/pages/Inbox.tsx: Adicionar campos personalizados na criação de contato e deal
- client/src/pages/DealDetail.tsx: Separar campos por contexto (contato, empresa, negociação)
- client/src/pages/Contacts.tsx: Adicionar filtros por campos personalizados
- client/src/pages/Pipeline.tsx: Adicionar filtros por campos personalizados
