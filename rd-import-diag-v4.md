# RD Station Import Diagnostic v4

## RD Station Data (Source of Truth)
Total deals: 13,955
- Funil de Vendas 1: 9,140 deals (42 open, ~1500 won, ~7600 lost)
- Sucesso do Cliente: 1,972 deals
- Funil de Vendas 2: 998 deals
- Funil de Patrocínios: 128 deals
- Recuperação Workshop: 1,667 deals
- Funil de Vendas Simulação: 47 deals
- Funil de Avaliação ENTUR: 3 deals

Open deals total: 2,049
Won deals total: 1,650
Lost deals total: 10,256

## Current DB State (Legu Tour - tenant 240007)
Pipelines (8 total, 3 duplicated):
- 330012: "Funil de Vendas" (default, system-created, EMPTY)
- 330013: "Funil de Pós-Venda" (system-created, EMPTY)
- 330018: "Vendas" (from old import)
- 330019: "Pós vendas" (from old import)
- 330020: "Funil de Grupo" (from old import)
- 360011: "Vendas" (duplicate from 2nd import)
- 360012: "Pós vendas" (duplicate from 2nd import)
- 360013: "Funil de Grupo" (duplicate from 2nd import)

## Root Causes
1. Pipeline names don't match RD Station (old import used wrong names)
2. No rdExternalId tracking = duplicates on re-import
3. Deals went to wrong pipelines
4. limit=200 on deals query, limit=100 on contacts query
5. No pagination in frontend

## Fix Plan
1. Add "clean before import" option that deletes all imported data
2. Fix pipeline names to match RD Station exactly
3. Fix status mapping (win=null → open, win=true → won, win=false → lost)
4. Add rdExternalId to all tables
5. Increase limits / add server-side pagination
