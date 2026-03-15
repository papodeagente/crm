# Auditoria — Importação RD Station CRM via API

## Arquivos do módulo
| Arquivo | Linhas | Função |
|---------|--------|--------|
| server/rdStationCrmImport.ts | 438 | Tipos + fetch helpers (pagination, API calls) |
| server/routers/rdCrmImportRouter.ts | 1245 | Orquestração completa (progress, import, validation) |
| client/src/pages/RDCrmImport.tsx | 650 | Frontend wizard (token → preview → config → import → done) |
| server/rdCrmImport.test.ts | 311 | Testes do serviço de fetch |
| server/rdCrmImportRouter.test.ts | 277 | Testes do router |

## O que já funciona bem
1. **Paginação com janela dupla**: busca até 10k desc + 10k asc, deduplica por _id
2. **Deduplicação via rdExternalId**: coluna adicionada em runtime em 11 tabelas + índices
3. **Mapeamento de entidades**: rdIdMap com 10 mapas (contacts, orgs, pipelines, stages, products, deals, sources, campaigns, lossReasons, users)
4. **Resolução de contato em 4 níveis**: rdExternalId → email → nome → criação on-the-fly
5. **Resolução de organização**: rdExternalId → criação on-the-fly
6. **Resolução de owner**: RD user → CRM user via rdIdMap.users
7. **Status correto**: win=true→won, win=false→lost, else→open
8. **Deal products**: importados com product_id mapeado ou criação on-the-fly
9. **Tasks**: vinculadas a deal ou contact, com tipo mapeado (call→phone, etc)
10. **Validação pós-import**: conta registros, detecta duplicatas, deals sem contato
11. **Clean before import**: remove tudo com rdExternalId antes de reimportar
12. **Progress polling**: frontend faz polling a cada 1.5s

## Problemas identificados

### Lentidão
1. **Sem retry**: rdFetch não tem retry — qualquer erro 429/500/timeout falha permanentemente
2. **Sem batch insert**: cada registro é inserido individualmente (1 query por contato/deal/task)
3. **findByRdExternalId usa SQL raw**: cada lookup é uma query individual, sem cache local
4. **setRdExternalId é outra query**: 2 queries por registro (insert + update rdExternalId)
5. **Tasks sem deal_id são skippadas**: se deal_id não está no rdIdMap, a task é ignorada silenciosamente

### Fidelidade
1. **Contatos sem campos extras**: birthday, title, linkedin, facebook, skype, custom_fields não importados
2. **Empresas sem campos extras**: address, city, state, country, url, segments não importados
3. **Deals sem source/campaign/lossReason**: deal_source, campaign mapeados no RD mas NÃO vinculados no ENTUR
4. **Deals sem prediction_date**: campo ignorado
5. **Deals sem rating**: campo ignorado
6. **Deals sem closed_at**: data de fechamento ignorada
7. **Tasks sem notes**: campo notes da task RD não importado
8. **Tasks sem hora**: campo hour ignorado (só usa date)
9. **Pipelines sem order**: campo order do pipeline ignorado

### Divergência
1. **Deals sem source linkado**: deal_source._id existe no RD mas não é mapeado para leadSourceId no ENTUR
2. **Deals sem campaign linkado**: campaign._id existe no RD mas não é mapeado para campaignId no ENTUR
3. **Deals sem lossReason linkado**: quando win=false, o motivo de perda não é importado
4. **Contact-Account link perdido**: organization_id do contato RD não é usado para vincular contact→account no ENTUR
5. **Multiple contacts per deal**: só o primeiro contato é vinculado

## Melhorias planejadas (mínimo impacto)
1. Adicionar retry com backoff exponencial no rdFetch
2. Vincular source, campaign, lossReason nos deals
3. Importar campos extras de contatos e empresas (onde o schema ENTUR suporta)
4. Vincular contato→account via organization_id
5. Importar notes das tasks
6. Importar closed_at e prediction_date dos deals
7. Melhorar estatísticas finais com breakdown detalhado
8. Melhorar UX da página com explicação mais profissional
9. Adicionar importação por planilha como rota secundária
