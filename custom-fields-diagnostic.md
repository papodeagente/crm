# Diagnóstico — Campos Personalizados

## Estrutura Atual (OK)
- Schema: `custom_fields` e `custom_field_values` existem com entity enum ["contact", "deal", "account", "trip"]
- Backend db.ts: CRUD completo (list, get, create, update, delete, reorder, getValues, setValues)
- Backend routers.ts: `customFields` router e `contactProfile.getCustomFieldValues/setCustomFieldValues`
- Frontend: CustomFieldsSettings.tsx — gestão de campos (CRUD) por entidade ✅

## Problemas Identificados

### 1. Contatos — Criação (Contacts.tsx)
- Dialog de "Novo Contato" NÃO inclui campos personalizados
- Apenas nome, email, telefone

### 2. Contatos — Perfil/Edição (ContactProfile.tsx)
- Campos personalizados APARECEM no perfil ✅
- Edição inline funciona ✅
- MAS: só mostra campos com `isVisibleOnProfile=true`, não mostra todos os campos na edição

### 3. Negociações — Criação (Pipeline.tsx CreateDealDialog)
- Campos personalizados de deal APARECEM na criação ✅
- Salva valores após criar deal ✅
- MAS: falta suporte a multiselect no form de criação
- MAS: campos ficam escondidos por padrão (toggle "Mostrar")

### 4. Negociações — Detalhe (DealDetail.tsx CustomFieldsSidebar)
- Campos aparecem na sidebar ✅
- MAS: edição inline é APENAS Input text — NÃO suporta select, multiselect, date, checkbox, textarea
- Problema grave: todos os tipos são editados como texto simples

### 5. Empresas (Accounts)
- NÃO existe página dedicada de empresa/account
- Empresas são criadas/editadas apenas via DealDetail (inline)
- Dialog de criação de empresa: apenas campo "nome"
- Dialog de edição de empresa: apenas campo "nome"
- NÃO há campos personalizados em nenhum lugar para empresas
- NÃO há rota /account/:id ou /empresa/:id

### 6. Regra de Empresa + Contato
- Criação de empresa NÃO exige contato atrelado
- Schema accounts tem `primaryContactId` (opcional)
- Router accounts.create aceita `primaryContactId` como opcional

### 7. Multi-tenant
- Todas as queries filtram por tenantId ✅
- Sem vazamento aparente ✅

## Plano de Correção

### Backend
- Nenhuma alteração de schema necessária (estrutura já suporta tudo)
- Adicionar índice composto em custom_field_values para filtros futuros (tenantId, fieldId, value)

### Frontend — Contatos
- Adicionar campos personalizados no dialog de criação de contato
- Garantir que edição no ContactProfile mostre TODOS os campos (não só visibleOnProfile)

### Frontend — Negociações
- Corrigir CustomFieldsSidebar para suportar todos os tipos de campo
- Adicionar multiselect no CreateDealDialog

### Frontend — Empresas
- Adicionar campos personalizados no dialog de criação de empresa (DealDetail)
- Adicionar campos personalizados no dialog de edição de empresa (DealDetail)
- Implementar regra: empresa deve ter contato atrelado

### Testes
- Testar ciclo completo: criar campo → preencher → salvar → reabrir → editar
