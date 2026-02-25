# Project TODO — ASTRA CRM SaaS

## Fase anterior (WhatsApp API) — Concluído
- [x] Configurar banco de dados (tabelas de sessões, mensagens, logs)
- [x] Instalar Baileys e dependências no backend
- [x] Implementar motor Baileys com gerenciamento de sessão persistente
- [x] Criar endpoint de conexão/desconexão do WhatsApp
- [x] Gerar e exibir QR Code em tempo real na interface
- [x] Painel de status mostrando estado da conexão e info do usuário autenticado
- [x] Formulário para envio de mensagens via interface web
- [x] Histórico de mensagens enviadas e recebidas com timestamps
- [x] API REST completa para integração externa (status, envio, webhooks)
- [x] Logs de atividades e eventos do WhatsApp em tempo real
- [x] Autenticação de usuários via Manus OAuth para controle de acesso
- [x] WebSocket para atualização automática do status de conexão
- [x] Notificações automáticas ao proprietário
- [x] Upload e armazenamento de mídia para envio via WhatsApp
- [x] Chatbot com respostas automáticas usando LLM
- [x] Design funcional e claro do dashboard

## ASTRA CRM — Schema & Banco de Dados
- [x] Tabelas Core: tenants, users, teams, team_members, roles, permissions, role_permissions, user_roles, api_keys
- [x] Tabelas CRM (M2): contacts, accounts, deals, deal_participants, pipelines, pipeline_stages
- [x] Tabelas Viagem: trips, trip_items
- [x] Tabelas Atividades: tasks, notes, attachments
- [x] Tabelas Inbox (M1): channels, conversations, messages (CRM)
- [x] Tabelas Propostas (M3): proposal_templates, proposals, proposal_items, proposal_signatures
- [x] Tabelas Portal (M4): portal_users, portal_sessions, portal_tickets
- [x] Tabelas Insights (M6): metrics_daily, alerts
- [x] Tabelas Gestão (M5): goals, performance_snapshots
- [x] Tabelas Academy (M7): courses, lessons, enrollments
- [x] Tabelas Integration Hub (M8): integrations, integration_connections, integration_credentials, webhooks, jobs, job_dlq
- [x] Tabela EventLog transversal

## ASTRA CRM — Backend (Middlewares & Routers)
- [x] Middleware AuthContext com tenant_id, user_id, role, permissions, scope
- [x] Middleware EventLog emitter para auditoria
- [x] Permission guard (RBAC com 3 perfis mínimos)
- [x] DB helpers para todas as entidades
- [x] Router M0: Admin/IAM (users, teams, roles, permissions, auditoria)
- [x] Router M2: CRM (contacts, deals, pipelines, trips)
- [x] Router M1: Inbox (conversations, messages, channels)
- [x] Router M3: Propostas (templates, proposals, envio, tracking)
- [x] Router M4: Portal do Cliente
- [x] Router M5: Gestão (metas, forecast, produtividade)
- [x] Router M6: Insights (dashboard, alertas, métricas)
- [x] Router M7: Academy (cursos, lições, matrículas)
- [x] Router M8: Integration Hub (conectores, webhooks, jobs, DLQ)

## ASTRA CRM — Frontend
- [x] Design system: tema, cores, tipografia, componentes base
- [x] Layout global: sidebar + topbar + conteúdo principal
- [ ] Command Palette (Cmd+K) — futuro
- [ ] Drawer de contexto (Contact/Deal/Trip) — futuro
- [x] M0: Telas Admin (Users, Teams, Roles, Auditoria)
- [x] M2: Contatos (lista + filtros + CRUD)
- [x] M2: Funil Kanban (pipelines + stages)
- [x] M2: Deals (lista + CRUD)
- [x] M2: Viagens/Trips
- [x] M1: Inbox 3 colunas (lista, conversa, detalhes)
- [x] M3: Propostas (lista, status, tracking)
- [x] M3: Propostas versões — integrado na lista
- [x] M4: Portal do Cliente (tickets)
- [x] M5: Gestão (metas)
- [x] M6: Insights (dashboard, métricas, alertas)
- [x] M7: Academy (cursos, cards)
- [x] M8: Integration Hub (conectores, webhooks, jobs)

## ASTRA CRM — Seeds & Integração
- [x] Seeds: roles padrão (Admin, Gestor, Vendedor)
- [x] Seeds: permissions granulares
- [x] Seeds: pipeline default com stages
- [x] Seeds: templates de propostas básicos — futuro
- [x] Integração WhatsApp API existente (motor Baileys integrado ao backend)
- [x] Testes unitários (31 testes passando: auth, CRM routers, WhatsApp) — verificado após redesign

## Redesign — Funil Kanban & Navegação (v2)
- [x] Menu horizontal superior (Início, Negociações, Empresas, Contatos, Tarefas, Análises, Marketing)
- [x] Layout global com topbar em vez de sidebar
- [x] Funil Kanban com colunas scrolláveis (header: nome etapa, contagem, valor total)
- [x] Cards de deal detalhados (status badge, contato, empresa, data, valor, tarefas)
- [x] Barra de filtros (pipeline selector, responsável, status, ordenação)
- [x] Botão "+ Criar" para nova negociação
- [x] Modal de criação de negociação com campos de agência de viagens (destino, datas, passageiros, valor pacote)
- [x] Toggle Kanban/Lista na página de negociações
- [x] Botão "Criar Tarefa" em cada card de deal

## Drawer de Deal + Drag-and-Drop + Histórico (v3)
- [x] Tabela deal_products (produtos/itens do orçamento vinculados ao deal)
- [x] Tabela deal_history (histórico de movimentações e alterações)
- [x] Backend: CRUD de deal_products (add, edit, remove, list)
- [x] Backend: Registro automático de histórico ao mover deal de etapa
- [x] Backend: Endpoint para mover deal entre stages
- [x] Backend: Associação de contato e empresa ao deal
- [x] Frontend: Drag-and-drop no Kanban para mover cards entre colunas
- [x] Frontend: Drawer lateral ao clicar no card com informações completas
- [x] Frontend: Aba de associação de contato e empresa dentro do drawer
- [x] Frontend: Aba de produtos/orçamento com add/edit/remove e totais
- [x] Frontend: Aba de histórico de movimentações dentro do drawer
- [x] Testes unitários atualizados (31 passando)
