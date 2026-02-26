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

## Redesign UX/UI Completo (v4)
- [x] Auditar todas as páginas e documentar problemas de corte/layout
- [x] Redesenhar tema global (index.css): cores modernas, sombras suaves, tipografia refinada
- [x] Corrigir cortes nas laterais em todas as páginas (padding/margin global)
- [x] Redesenhar TopNavLayout: espaçamentos, responsividade, micro-interações
- [x] Redesenhar Home/Dashboard: cards modernos, gradientes sutis, melhor hierarquia visual
- [x] Redesenhar Pipeline/Kanban: cards mais elegantes, drop zones visuais, animações
- [x] Redesenhar Drawer de detalhes: melhor organização, tipografia, espaçamento
- [x] Redesenhar Contatos: tabela moderna, avatares, ações inline
- [x] Redesenhar Deals: visual consistente com Pipeline
- [x] Redesenhar Tarefas: layout limpo, status visuais
- [x] Redesenhar Inbox: 3 colunas com melhor separação visual
- [x] Redesenhar páginas restantes (Trips, Proposals, Portal, Insights, Goals, Academy, Integrations, Admin, Logs, Messages, SendMessage, ApiDocs, Chatbot, Alerts)
- [x] Micro-interações: hover states, transições, feedback visual
- [ ] Verificar responsividade em todas as páginas — pendente

## Redesign Apple/macOS Premium (v5)

### Design System
- [x] Sistema de cores Apple-inspired (#F5F5F7 fundo, sidebar mais escura, azul macOS primário)
- [x] Tipografia SF Pro / Inter com hierarquia clara (600 títulos, 400 corpo)
- [x] Glassmorphism leve e sombreamento sutil
- [x] Transições suaves (ease-in-out 150-200ms)
- [x] Eliminar poluição visual, bordas pesadas, cards exagerados

### Layout Global
- [x] Sidebar fixa estilo Finder (ícones monocromáticos, labels discretos, hover cinza neutro)
- [x] Top bar minimalista com busca central inteligente
- [x] Layout em camadas com profundidade suave

### Dashboard
- [x] Blocos organizados (estratégicos vs operacionais)
- [x] Área de foco do dia
- [x] Métricas com clareza, sem excesso de cards

### Pipeline
- [x] Cards simples com informações essenciais apenas
- [x] Indicadores discretos de urgência
- [x] Drag-and-drop fluido
- [x] Visual limpo e respirável

### Inbox/Conversa
- [x] Layout estilo iMessage com bolhas suaves
- [x] Espaçamento confortável
- [x] Área lateral com dados do cliente em abas (Info, Negociações, Tarefas)
- [ ] Sugestões de IA discretas — futuro

### Tela de Cliente (Contatos)
- [x] Visual estilo painel de perfil (avatar + info organizada)
- [x] Linha do tempo clara (tabela limpa)
- [ ] Abas (Histórico, Propostas, Tarefas, Financeiro)

### Microinterações
- [x] Feedback visual suave ao clicar
- [x] Hover states elegantes
- [x] Skeleton loading minimalista (spinner circular)
- [x] Transições de página com fade leve

### Páginas Secundárias
- [x] Redesenhar todas as páginas com o novo design system Apple (18 páginas atualizadas)

## Página Dedicada de Negociação + WhatsApp Integrado

- [x] Criar página DealDetail.tsx com layout completo (não drawer)
- [x] Seção de informações do deal (título, valor, etapa, contato, empresa)
- [x] Seção de orçamento (produtos, totais)
- [x] Seção de participantes
- [x] Seção de histórico de movimentações
- [x] Conversa WhatsApp integrada — mensagens em tempo real do contato via Baileys
- [x] Envio de mensagens WhatsApp direto da página do deal
- [x] Botão de voltar para o Pipeline
- [x] Atualizar Pipeline para navegar para /deal/:id ao clicar no card
- [x] Registrar rota /deal/:id no App.tsx
- [x] Testes unitários para endpoints da página DealDetail (20 testes adicionais, 51 total)

## Experiência WhatsApp Web na Página de Negociação (v6)

### Visual & Layout
- [x] Redesenhar aba WhatsApp com visual idêntico ao WhatsApp Web (fundo com padrão, bolhas verdes/brancas)
- [x] Header da conversa com avatar, nome, status online/offline e último acesso
- [x] Footer com barra de input estilo WhatsApp (emoji, anexo, texto, áudio)

### Envio de Mídia & Arquivos
- [x] Botão de anexar com menu (Fotos/Vídeos, Câmera, Documento)
- [x] Preview de imagem/vídeo antes de enviar
- [x] Upload de arquivos via S3 e envio pelo Baileys
- [x] Exibição de imagens, vídeos, documentos e áudios inline nas bolhas

### Gravação de Áudio
- [x] Botão de microfone para gravar áudio (hold ou toggle)
- [x] Visualização de onda sonora durante gravação
- [x] Envio de áudio como mensagem de voz (PTT)
- [x] Player de áudio inline nas bolhas de mensagem

### Indicadores de Status (Ticks)
- [x] Ícone de relógio (⏱) para mensagem pendente/enviando
- [x] Um tick (✓) para mensagem enviada ao servidor
- [x] Dois ticks (✓✓) para mensagem entregue ao destinatário
- [x] Dois ticks azuis (✓✓) para mensagem lida pelo destinatário
- [x] Backend: capturar eventos de receipt (delivered/read) do Baileys
- [x] Backend: armazenar status de entrega/leitura no banco de dados

### Performance
- [x] Virtualização da lista de mensagens (renderizar apenas mensagens visíveis)
- [x] Lazy loading de mídia (carregar imagens/vídeos sob demanda)
- [x] Paginação eficiente com scroll infinito para cima (mensagens antigas)
- [x] Otimizar re-renders com React.memo e useCallback

### Testes
- [x] Testes unitários para novos endpoints (mídia, áudio, status) — 58 testes passando

## Painel de Configurações de IA no WhatsApp (v7)

### Schema & Backend
- [x] Atualizar schema chatbotSettings com campos granulares (modo, whitelist, blacklist, horários, etc.)
- [x] Criar tabela chatbotRules para regras por contato/grupo
- [x] Endpoints CRUD para configurações de IA
- [x] Endpoints para regras de whitelist/blacklist por contato/grupo

### Página de Configurações
- [x] Toggle global ativar/desativar IA por sessão
- [x] Seletor de modo: responder todos, apenas whitelist, exceto blacklist
- [x] Editor de prompt do sistema (system prompt) com preview
- [x] Configuração de max tokens, temperatura, modelo
- [x] Horário de funcionamento (ativar IA apenas em horário comercial)
- [x] Mensagem de ausência quando IA está desativada
- [x] Delay de resposta configurável (simular digitação)
- [x] Whitelist de contatos/grupos que a IA deve responder
- [x] Blacklist de contatos/grupos que a IA NÃO deve responder
- [x] Toggle para responder em grupos vs apenas conversas privadas
- [x] Toggle para responder apenas quando mencionado em grupos
- [x] Palavras-chave de ativação (trigger words)
- [x] Limite de mensagens por contato por hora/dia
- [x] Mensagem de boas-vindas automática para novos contatos
- [x] Configuração de contexto/memória (quantas mensagens anteriores incluir)

### Integração no Motor Baileys
- [x] Aplicar regras de whitelist/blacklist antes de processar mensagem
- [x] Respeitar horário de funcionamento
- [x] Aplicar delay de resposta
- [x] Verificar limites de mensagens
- [x] Enviar mensagem de ausência quando IA desativada

### Testes
- [x] Testes unitários para novos endpoints de configuração — 70 testes passando

## Correções e Melhorias (v8)

### Bug: Mensagens Duplicadas
- [x] Identificar causa da duplicação (sendMessage salva + messages.upsert salva novamente)
- [x] Corrigir para que mensagens enviadas pelo sistema não sejam salvas 2x
- [x] Testar envio de mensagem sem duplicação

### Sincronização de Histórico Anterior
- [x] Implementar sync de mensagens anteriores do WhatsApp ao conectar sessão
- [x] Importar conversas existentes entre contatos vinculados a deals (via messaging-history.set)

### Backup Diário Automático no Histórico do Atendimento
- [x] Criar job diário que copia conversas WhatsApp para o histórico do deal (00:05 São Paulo)
- [x] Incluir dia, hora, quem falou e conteúdo da mensagem no histórico
- [x] Registrar no deal_history como evento de tipo "whatsapp_backup"

### Testes
- [x] Testes unitários para as correções e novos endpoints — 77 testes passando
