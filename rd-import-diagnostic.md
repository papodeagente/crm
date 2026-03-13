# Diagnóstico da Importação RD Station CRM

## Estado Atual

### Dados Importados
- **Contatos RD**: 8.855 (total no banco: 8.871)
- **Negociações RD**: 12.008 (total: 12.031)
- **Tarefas**: 11.954 (maioria do tenant Legu Tour)
- **Contas/Empresas**: 5.059
- **Funis**: 41
- **Etapas**: 275
- **Fontes de Leads**: 104
- **Campanhas**: 23
- **Motivos de Perda**: 54

### Distribuição por Tenant
- Legu Tour (240007): 8.762 contatos, 11.914 negociações, 11.658 tarefas
- ELEVETOUR (240011): 88 contatos, 79 negociações, 52 tarefas
- Boxtour (210002): 5 contatos, 15 negociações, 6 tarefas

## PROBLEMAS IDENTIFICADOS

### 1. FUNIS DUPLICADOS (CRÍTICO)
Legu Tour (240007) tem funis duplicados:
- "Vendas" aparece 2x (IDs 330018 e 360011)
- "Pós vendas" aparece 2x (IDs 330019 e 360012)
- "Funil de Grupo" aparece 2x (IDs 330020 e 360013)

**Causa**: A importação não verifica se o funil já existe antes de criar. Cada re-importação cria novos funis duplicados.

ELEVETOUR (240011) também tem "Funil de Vendas" duplicado.

### 2. NEGOCIAÇÕES DUPLICADAS (CRÍTICO)
Legu Tour tem negociações distribuídas entre funis duplicados:
- Vendas: 2.532 + 2.533 = ~5.065 (metade duplicada)
- Pós vendas: 1.125 + 1.125 = ~2.250 (metade duplicada)
- Funil de Grupo: 2.296 + 2.303 = ~4.599 (metade duplicada)

**Causa**: Sem verificação de duplicidade (por rdExternalId), cada re-importação cria tudo de novo.

### 3. CONTATOS DUPLICADOS (CRÍTICO)
Existem contatos com o mesmo email aparecendo até 6 vezes:
- marialeandro1234@gmail.com: 6 duplicatas
- carolinecouto.s@hotmail.com: 6 duplicatas
- Vários com 4 duplicatas

**Causa**: createContact não verifica se já existe contato com mesmo email/telefone.

### 4. NEGOCIAÇÕES SEM CONTATO (256)
256 negociações do RD Station não têm contato vinculado.
**Causa**: O matching por email/nome falha quando o contato inline da negociação não tem email e o nome não corresponde exatamente.

### 5. SEM RASTREABILIDADE (rdExternalId)
Não existe campo para armazenar o ID original do RD Station nas entidades importadas. Isso impede:
- Verificar duplicidade
- Reprocessar apenas itens com erro
- Validar integridade pós-importação

### 6. TAREFAS ÓRFÃS
Tarefas que não encontram deal/contato correspondente são simplesmente ignoradas (skipped) sem log claro.

### 7. USUÁRIOS NÃO IMPORTADOS
A importação atual não importa usuários do RD Station CRM. Todas as tarefas e negociações ficam atribuídas ao usuário que executou a importação, não ao responsável original.

### 8. SEM VALIDAÇÃO PÓS-IMPORTAÇÃO
Não existe comparação entre quantidade de registros no RD Station vs quantidade importada no Entur OS.

## PLANO DE CORREÇÃO

1. Adicionar campo `rdExternalId` em contacts, deals, pipelines, pipeline_stages, accounts, crm_tasks
2. Implementar deduplicação por rdExternalId em todas as entidades
3. Importar usuários do RD Station e mapear para CRM users
4. Corrigir matching de contatos em negociações (usar rdExternalId)
5. Preservar responsável original (user) nas negociações e tarefas
6. Implementar validação pós-importação com relatório detalhado
7. Implementar logs detalhados por etapa
8. Implementar retry e reprocessamento parcial
9. Limpar dados duplicados existentes
