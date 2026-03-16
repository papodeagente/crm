# Diagnóstico: Campos Personalizados de Contato Não Aparecem

## Causa Raiz Identificada

### Problema 1: DealDetail — seções contactCustom e companyCustom colapsadas por padrão
- Linha 215: `contactCustom: false, companyCustom: false` — as seções começam fechadas
- Linha 914: `{deal?.contactId && (contactCustomFieldsQ.data as any[])?.length > 0 && (` — condição correta, mas seção começa fechada
- **Correção**: Mudar `contactCustom: true` e `companyCustom: true` para abrir por padrão

### Problema 2: DealDetail — seção "custom" (deal fields) também começa fechada
- Linha 215: `custom: false` — seção de campos personalizados da negociação começa fechada
- **Correção**: Mudar `custom: true`

### Problema 3: ContactProfile — a query `customFieldsQ` pode retornar array aninhado
- Linha 305: `trpc.customFields.list.useQuery({ tenantId, entity: "contact" })`
- A função `listCustomFields` em db.ts (linha 1535) retorna `rows?.[0] || []`
- O mysql2 retorna `[rows, fields]`, então `rows[0]` é o array de resultados
- MAS se o resultado vier como `[[{...}, {...}], fields]`, então `rows[0]` seria o array correto
- Preciso verificar se o resultado está sendo parseado corretamente

### Problema 4: ContactProfile — visibleFields pode estar vazio se isVisibleOnProfile não está setado
- Linha 344-346: `customFields.filter((f) => f.isVisibleOnProfile)` 
- Se o campo foi criado sem isVisibleOnProfile=true, não aparece
- Mas o schema tem `default(true)`, então deveria estar OK

### Problema 5: getCustomFieldValues retorna apenas campos COM valor
- Linha 1624-1629 em db.ts: JOIN entre custom_field_values e custom_fields
- Se um campo não tem valor salvo, ele NÃO aparece no resultado
- No ContactProfile isso é tratado: usa `customFieldsQ` para listar todos os campos e `customValuesQ` para os valores
- No DealDetail CustomFieldsSidebar: usa `fields` (todos) e `values` (com valor)
- Linha 1623: `const visibleFields = allFields.filter((f: any) => f.isVisibleOnProfile || valuesMap[f.id]);`
- Isso está CORRETO — mostra campos visíveis OU com valor

## Conclusão
O código parece correto em termos de lógica. As causas mais prováveis são:
1. Seções colapsadas por padrão (UX issue — usuário não vê os campos)
2. Possível problema com o retorno da query (array aninhado do mysql2)
3. Preciso verificar no browser se as queries retornam dados
