# RD Import Diagnostic v3

## Root Cause Analysis

### Problem 1: Deals don't appear in Kanban
- Default pipeline is "Funil de Vendas" (id 330012) — this is the SYSTEM default, not from RD
- ALL imported deals are in pipelines 330018/330019/330020 (first import) and 360011/360012/360013 (second import = duplicates)
- The Kanban shows "Funil de Vendas 1" which is pipeline 330012 — it has ZERO deals
- The imported RD pipelines (Vendas, Pós vendas, Funil de Grupo) are separate pipelines
- User needs to select the correct pipeline in the dropdown to see deals

### Problem 2: Duplicate pipelines
- "Vendas" exists twice: 330018 and 360011
- "Pós vendas" exists twice: 330019 and 360012
- "Funil de Grupo" exists twice: 330020 and 360013
- Each has duplicate deals — the import ran twice without deduplication

### Problem 3: Open deals count
- "Vendas" pipeline: 24 open (330018) + 21 open (360011) = 45 total (but should be ~40 from RD)
- "Pós vendas": 1114 open in each copy = 2228 total open
- "Funil de Grupo": 71 + 60 = 131 open
- Dashboard shows 2049 = probably counting from one set of pipelines

### Solution Plan
1. Clean up duplicate pipelines and deals (keep one set, delete duplicates)
2. OR: Create fresh test tenant, import clean with new v2 code
3. Fix: Make the imported RD pipeline the default (or rename to match)
4. Fix: Kanban pipeline selector should show RD-imported pipelines
5. Fix: Remove pagination limits on contacts and deals list views

### Problem 4: Contacts limited to 100
- Backend query has LIMIT 100 hardcoded
- Need to increase or paginate properly

### Problem 5: Deals list limited
- Same pagination issue
