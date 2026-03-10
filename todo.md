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

## Correções (v9)

### Bug: Mensagem cria conversa separada e não chega ao contato
- [x] Analisar formatação do JID no envio de mensagens (sendTextMessage/sendMediaMessage)
- [x] Corrigir formatação para números brasileiros — resolveJid() com onWhatsApp() + fallback 9º dígito
- [x] Garantir que o JID de envio corresponda ao JID das mensagens recebidas (resolveJid no frontend)
- [x] Testar envio e recebimento na mesma conversa — 77 testes passando

## Inbox WhatsApp Web (v10)

### Backend
- [x] Criar endpoint de lista de conversas agrupadas por remoteJid (última mensagem, contagem não lidas, nome)
- [x] Endpoint de marcar conversa como lida

### Frontend - Layout WhatsApp Web
- [x] Sidebar esquerda com lista de conversas (foto, nome, última mensagem, hora, badge não lidas)
- [x] Barra de busca para filtrar conversas
- [x] Painel direito com a conversa aberta (reutilizar WhatsAppChat)
- [x] Header do painel com info do contato
- [x] Estado vazio quando nenhuma conversa selecionada (estilo WhatsApp Web)
- [x] Responsivo: mobile mostra lista ou conversa, desktop mostra ambos
- [x] Indicador de conversa ativa/selecionada
- [x] Ordenação por última mensagem recebida
- [x] Match de nomes com contatos do CRM
- [x] Ticks de status na preview da última mensagem
- [x] Filtros (Todas, Não lidas, Grupos)
- [x] Testes unitários — 80 testes passando

## Correção UX Inbox (v10.1)

- [x] Lista de conversas sem header WhatsApp (falta avatar do usuário, ícones)
- [x] Faltam horas/datas à direita de cada conversa na lista
- [x] Painel de chat à direita não mostra mensagens, só barra de input
- [x] Números internacionais aparecem crus (sem formatação)
- [x] Lista ocupa toda a largura sem divisão clara com o chat
- [x] Falta separador visual (border) entre lista e chat
- [x] Falta o fundo padrão WhatsApp no painel de chat
- [x] Layout não está dividido corretamente — agora 440px fixo + flex-1

## Fotos de Perfil + Criar Negociação no Chat (v11)

### Fotos de perfil do WhatsApp
- [x] Backend: endpoint para buscar foto de perfil via Baileys profilePictureUrl
- [x] Backend: batch endpoint para buscar múltiplas fotos de perfil (staleTime 5min)
- [x] Frontend: exibir foto de perfil real na lista de conversas do Inbox
- [x] Frontend: exibir foto de perfil no header da conversa

### Criar negociação de dentro da conversa
- [x] Botão no header da conversa para criar negociação CRM
- [x] Dialog/modal para preencher dados da negociação (título, valor, pipeline, etapa)
- [x] Auto-vincular contato da conversa à negociação
- [x] Auto-criar contato no CRM se não existir
- [x] Navegar automaticamente para o deal após criação

## Notificação Sonora no Inbox (v12)

- [x] Gerar som de notificação WhatsApp (Web Audio API — dois tons sine wave)
- [x] Detectar novas mensagens recebidas via WebSocket no Inbox
- [x] Tocar som ao receber mensagem nova (apenas mensagens não enviadas por mim)
- [x] Botão de silenciar/ativar som no header da lista de conversas
- [x] Persistir preferência de mute no localStorage
- [x] Ícone visual indicando estado mudo/ativo (Volume2 verde / VolumeX vermelho + tooltip)
- [x] Não tocar som se a conversa da mensagem já estiver selecionada e visível

## Correção Inbox v12.1

- [x] Nomes de contatos salvos no CRM aparecem — matching melhorado com/sem 55
- [x] Nomes de grupos do WhatsApp — busca via groupMetadata do Baileys (endpoint groupNames)
- [x] Números formatados corretamente — formato BR (DDD) XXXXX-XXXX
- [x] Ordenação por timestamp da última mensagem DESC — já estava correto no SQL
- [x] pushName do WhatsApp como fallback — salvo no banco e retornado na query
- [x] Prioridade de nomes: CRM > pushName > número formatado (grupos: groupName > ID)

## Nova Conversa no Inbox (v13)

- [x] Botão "+" no header da lista de conversas para iniciar nova conversa
- [x] Painel slide-over estilo WhatsApp Web com busca de contatos do CRM (nome, telefone, empresa)
- [x] Input para digitar número de telefone novo manualmente com bandeira BR
- [x] Validação e formatação do número (código do país BR +55)
- [x] Ao selecionar contato ou digitar número, abrir a conversa no painel direito
- [x] Resolver JID real via onWhatsApp() (trpcUtils.fetch) antes de abrir a conversa
- [x] Feedback visual se o número não estiver registrado no WhatsApp
- [x] Animação slide-in da esquerda e overlay de loading durante verificação
- [x] Testes unitários para resolveJid — 83 testes passando

## Remover Grupos + Verificar Importação (v14)

### Remover grupos da Inbox e importação
- [x] Backend: filtrar mensagens de grupo (@g.us) na importação de histórico (messaging-history.set)
- [x] Backend: filtrar grupos na query de conversas (getConversationsList)
- [x] Backend: filtrar grupos no backup diário de conversas para deal_history (já usava phoneToJid @s.whatsapp.net)
- [x] Backend: não salvar mensagens de grupo no banco (messages.upsert handler)
- [x] Backend: remover endpoint groupNames do router
- [x] Frontend: remover filtro "Grupos" da Inbox (só "Todas" e "Não lidas")
- [x] Frontend: remover lógica de groupMetadata/groupNames/groupJids
- [x] Frontend: remover ícone/lógica de grupo do avatar e display name

### Verificar importação correta de dados
- [x] Verificar que nomes de contatos CRM aparecem corretamente na Inbox (contactNameMap com matching +55)
- [x] Verificar que pushName do WhatsApp é salvo e exibido como fallback (pushNameMap)
- [x] Verificar que histórico de conversa completo é carregado (messaging-history.set + messages.upsert)
- [x] Verificar que o endpoint de conversas retorna dados completos e ordenados (ORDER BY timestamp DESC)
- [x] Testes unitários — 83 testes passando, 0 erros TypeScript

## Reestruturação de Navegação + Cores (v15)

### Navegação Top Nav Apple 2026
- [x] Substituir sidebar por top nav horizontal com 5 itens: Início, Negociações, Contatos, Tarefas, Análises
- [x] Início → Dashboard com indicadores (Home.tsx)
- [x] Negociações → Pipeline (Pipeline.tsx)
- [x] Contatos → Contatos + Empresas integradas dentro (Contacts.tsx)
- [x] Tarefas → Página de tarefas (Tasks.tsx)
- [x] Análises → Insights + Metas (sem Alertas, que vai para Notificações)
- [x] Sino de notificação no header → direciona para /notifications (nova página) com dot vermelho
- [x] Engrenagem de configurações no header → direciona para /settings (nova página)

### Página de Configurações (/settings)
- [x] Menu Comunicação: Inbox, WhatsApp, Chatbot IA
- [x] Menu Comercial: Propostas, Portal, Viagens
- [x] Menu Plataforma: Academy, Integrações, Admin, API Docs

### Página de Notificações (/notifications)
- [x] Migrar conteúdo de Alertas para Notificações
- [x] Badge de contagem no sino (dot vermelho animado)

### Paleta de Cores Vibrante
- [x] Atualizar CSS variables para cores mais vibrantes e saturadas (indigo primary)
- [x] Adicionar gradientes e acentos coloridos nos cards e indicadores
- [x] Manter padrão Apple 2026 com cores ricas

### Testes e Verificação
- [x] TypeScript sem erros
- [x] Testes unitários passando — 83 testes, 0 falhas

## Dashboard com Dados Reais (v16)

### Backend - Endpoints de métricas
- [x] Criar helper getDashboardMetrics no db.ts (negociações ativas, contatos, viagens, tarefas pendentes)
- [x] Criar helpers getPipelineSummary, getRecentActivity, getUpcomingTasks no db.ts
- [x] Criar endpoints tRPC dashboard.metrics, pipelineSummary, recentActivity, upcomingTasks
- [x] Incluir variação percentual comparando período atual vs anterior (últimos 30 dias vs 30 dias anteriores)

### Frontend - Cards dinâmicos
- [x] Substituir valores estáticos dos MetricCards por dados reais via trpc.dashboard.metrics.useQuery
- [x] Exibir loading skeleton enquanto carrega
- [x] Exibir variação percentual real (up/down/neutral)
- [x] Foco do Dia com tarefas reais (upcomingTasks)
- [x] Atividade Recente com deal_history real
- [x] Pipeline Summary com dados reais de etapas
- [x] Card de Valor Total em Pipeline
- [x] Estados vazios para cada seção

### Testes
- [x] 9 testes unitários para dashboard (metrics, pipelineSummary, recentActivity, upcomingTasks)
- [x] TypeScript sem erros — 92 testes passando, 6 arquivos

## Busca Global ⌘K (v17)

### Backend - Endpoint de busca
- [x] Criar helper globalSearch no db.ts (busca em contatos, negociações e tarefas por LIKE)
- [x] Criar endpoint tRPC search.global (protectedProcedure) com input de query string + limit
- [x] Retornar resultados agrupados por tipo (contacts, deals, tasks) com limite por categoria

### Frontend - CommandPalette funcional
- [x] Substituir busca estática por busca real via trpc.search.global.useQuery
- [x] Debounce de 300ms no input para evitar queries excessivas
- [x] Exibir resultados agrupados com badges de contagem por categoria
- [x] Navegação para a página correta ao clicar no resultado
- [x] Estado de loading (spinner), estado vazio e navegação rápida de páginas
- [x] Manter atalho ⌘K funcional + navegação por teclado (↑↓ Enter Esc)
- [x] Footer com hints de atalhos de teclado

### Testes
- [x] 9 testes unitários para search.global (shape, limites, validação)
- [x] TypeScript sem erros — 101 testes passando, 7 arquivos

## Notificações em Tempo Real (v18)

### Backend - Schema e tabela
- [x] Criar tabela notifications no schema (id, tenantId, type, title, body, entityType, entityId, isRead, createdAt)
- [x] Gerar e aplicar migração SQL

### Backend - Helpers e endpoints
- [x] Criar helper createNotification no db.ts
- [x] Criar helper getNotifications (com filtro read/unread e paginação)
- [x] Criar helper getUnreadCount
- [x] Criar helper markNotificationRead e markAllRead
- [x] Criar endpoints tRPC notifications.list, notifications.unreadCount, notifications.markRead, notifications.markAllRead

### Backend - Emissão de notificações nos eventos
- [x] Nova mensagem WhatsApp recebida → notificação "Nova mensagem de {pushName}"
- [x] Deal movido de etapa → notificação "Negociação movida para {etapa}"
- [x] Deal criado → notificação "Nova negociação: {título}"
- [x] Novo contato criado → notificação "Novo contato: {nome}"
- [x] Nova tarefa criada → notificação "Nova tarefa: {título}"

### Frontend - Página de Notificações
- [x] Substituir dados estáticos por dados reais via trpc.notifications.list.useQuery
- [x] Botão "Marcar todas como lidas" com CheckCheck icon
- [x] Marcar individual como lida ao clicar (botão Check)
- [x] Navegação para a entidade ao clicar na notificação (deals, contacts, tasks, inbox)
- [x] Ícones e cores por tipo (WhatsApp verde, Pipeline indigo, Contato violet, Tarefa amber)
- [x] timeAgo relativo (agora, há Xmin, há Xh, há Xd)

### Frontend - Badge dinâmico no sino
- [x] trpc.notifications.unreadCount.useQuery com refetchInterval 30s
- [x] Badge com contagem real no sino do TopNav (99+ overflow)
- [x] Badge oculto quando 0 não lidas

### Testes
- [x] 9 testes unitários para endpoints de notificações (list, unreadCount, markRead, markAllRead, shape)
- [x] TypeScript sem erros — 110 testes passando, 8 arquivos

## Rebranding ENTUR OS (v19)

### Imagens e Favicon
- [x] Processar e fazer upload da logo ENTUR OS para S3 (CDN)
- [x] Processar e fazer upload do favicon/ícone para S3 (ICO + PNG 192/512)
- [x] Atualizar favicon no index.html (link rel icon + apple-touch-icon)
- [x] VITE_APP_TITLE/LOGO são built-in — título atualizado diretamente no HTML e componentes

### Paleta de Cores
- [x] Atualizar index.css com tema escuro baseado na identidade ENTUR OS
- [x] Gradiente primário: roxo → magenta → ciano (oklch 270→320→200)
- [x] Fundo escuro (oklch 0.14 dark navy) como na imagem da marca
- [x] Todas as variáveis CSS atualizadas (background, card, primary, accent, border, etc.)
- [x] Classes .entur-gradient e .entur-gradient-text criadas
- [x] ThemeProvider mudado de light para dark

### Substituição de Marca
- [x] Substituir "ASTRA" por "ENTUR OS" no TopNavLayout (logo real + texto gradiente)
- [x] Substituir "ASTRA" no DashboardLayout (login + sidebar)
- [x] Substituir "ASTRA" no Inbox (MUTE_KEY + header)
- [x] Substituir "ASTRA" no routers.ts (comentário)
- [x] Substituir ícone "A" por imagem real da marca em todos os locais
- [x] Atualizar título da aba do navegador para "ENTUR OS"
- [x] Atualizar cores de todas as páginas para tema dark (Home, Settings, Notifications)

### Verificação
- [x] TypeScript sem erros
- [x] 110 testes passando, 8 arquivos
- [x] Visual consistente com a identidade da marca (screenshot verificado)

## Correção Tema Dark + Toggle Dark/Light (v20)

### Correção de Tema
- [x] Corrigir variáveis CSS do tema light para funcionar com identidade ENTUR OS
- [x] Corrigir variáveis CSS do tema dark para consistência em todas as páginas
- [x] Garantir que Pipeline, Contatos, Tarefas, Análises usem cores semânticas (bg-background, bg-card, text-foreground)
- [x] Remover cores hardcoded (bg-gray-*, bg-white, text-gray-*) e substituir por variáveis semânticas
- [x] Cards do Pipeline usando bg-card
- [x] Colunas do Pipeline usando bg-muted
- [x] DealDetail actionColors usando /15 opacity
- [x] Deals.tsx summary cards usando bg-card
- [x] NotFound.tsx usando cores semânticas
- [x] ManusDialog.tsx usando cores semânticas
- [x] Inbox.tsx bg-white → bg-card (6 ocorrências)

### Toggle de Tema
- [x] Criar botão/switch de tema no dropdown do usuário (TopNavLayout)
- [x] Usar ThemeContext existente com switchable=true
- [x] Persistir preferência do usuário no localStorage
- [x] Ícone de sol (Tema Claro) / lua (Tema Escuro) no toggle

### Verificação
- [x] Dashboard dark theme consistente e bonito (screenshot verificado)
- [x] Variáveis light e dark definidas no index.css
- [x] TypeScript sem erros (LSP + tsc)
- [x] 110 testes passando, 8 arquivos

## Criar Contato CRM da Conversa (v21)

### Botão no header do chat
- [x] Detectar se o número da conversa ativa já tem contato CRM vinculado (hasCrmContact computed)
- [x] Exibir botão verde "Criar Contato" com ícone UserPlus no header do chat quando não há contato vinculado
- [x] Esconder botão automaticamente quando já existe contato CRM para o número
- [x] Props onCreateContact e hasCrmContact adicionadas ao WhatsAppChat

### Modal de criação de contato
- [x] CreateContactDialog com formulário completo
- [x] Telefone pré-preenchido e formatado (read-only) com o número da conversa
- [x] Campos: nome (pré-preenchido com pushName), email, observações
- [x] Usar mutation trpc.crm.contacts.create com source "whatsapp"
- [x] Após criar, refetch contactsQ para atualizar o nome exibido na conversa automaticamente
- [x] Toast de sucesso/erro e loading state

### Verificação
- [x] TypeScript sem erros (LSP + tsc)
- [x] 110 testes passando, 8 arquivos

## Correção Inbox - Nomes, Fotos, Sincronização (v22)

### Backend - Query de conversas
- [x] Filtrar tipos internos do Baileys (protocolMessage, senderKeyDistributionMessage, messageContextInfo, reactionMessage) na importação e tempo real
- [x] Filtrar tipos internos na query getConversationsList (WHERE NOT IN)
- [x] pushName salvo corretamente no messages.upsert e messaging-history.set
- [x] Preview de mensagens usa texto real, não tipos internos

### Backend - Fotos de perfil
- [x] Endpoint profilePictures já funciona para todos os contatos da lista
- [x] Fotos buscadas em batch por JID

### Backend - Sincronização em tempo real
- [x] Socket.IO emite newMessage que refetch a lista de conversas
- [x] refetchInterval 8s no messagesByContact + 15s no conversations

### Frontend - Exibição de nomes
- [x] Prioridade: 1) Nome CRM (contactNameMap), 2) pushName (pushNameMap), 3) Número formatado
- [x] pushName recuperado do banco via pushNameMap
- [x] Nome exibido na lista E no header do chat

### Frontend - Fotos de perfil
- [x] Fotos de perfil carregadas e exibidas na lista e no chat header
- [x] Fallback com iniciais do nome quando foto não disponível

### Frontend - Preview de mensagens
- [x] getMessagePreview traduz tipos para preview legível
- [x] Ícones para mídia (📷 Foto, 🎵 Áudio, 📄 Documento, 📹 Vídeo, 🔑 Chave, etc.)

### Frontend - Cores semânticas WhatsAppChat.tsx
- [x] Todas as 58 cores hardcoded substituídas por variáveis semânticas
- [x] Funciona em dark mode e light mode

### Verificação
- [x] Tipos internos filtrados na importação e query
- [x] Nomes e fotos aparecem corretamente
- [x] TypeScript sem erros (LSP + tsc)
- [x] 110 testes passando, 8 arquivos

## Reescrita Completa da Inbox WhatsApp Web (v23)

### Backend - Sincronização e Dados
- [x] Auditar message-handler.ts: verificar se pushName é salvo corretamente em TODOS os eventos
- [x] Auditar message-handler.ts: verificar filtro de mensagens de protocolo
- [x] Auditar whatsapp.ts router: verificar query getConversationsList retorna dados corretos
- [x] Corrigir query de conversas: incluir pushName, lastMessage real, timestamp correto
- [x] Corrigir importação de histórico: garantir pushName salvo por JID
- [x] Endpoint de fotos de perfil: garantir que funciona e retorna URLs válidas
- [x] Salvar pushName em tabela/campo dedicado para lookup rápido

### Frontend - Layout WhatsApp Web Autêntico
- [x] Reescrever Inbox.tsx com layout fiel ao WhatsApp Web
- [x] Sidebar esquerda: header com avatar do usuário, busca, filtros
- [x] Lista de conversas: avatar com foto real, nome, preview, hora, badge não lidas, ticks
- [x] Painel direito: chat completo com header (nome, foto, status), mensagens, input
- [x] Estado vazio: ilustração estilo WhatsApp Web quando nenhuma conversa selecionada
- [x] Responsivo: mobile mostra lista OU chat, desktop mostra ambos

### Frontend - Detalhes UX
- [x] Datas formatadas corretamente (hoje=hora, ontem="Ontem", antes=dd/mm/yyyy)
- [x] Ticks de status (✓ enviado, ✓✓ entregue, ✓✓ azul lido)
- [x] Preview de mensagens com ícones (📷 Foto, 🎵 Áudio, 📄 Documento, etc.)
- [x] Busca funcional filtrando conversas por nome/número
- [x] Animações suaves de transição entre conversas

### Frontend - Cores e Tema
- [x] ZERO cores hardcoded - todas via variáveis semânticas CSS
- [x] Dark mode e light mode perfeitos
- [x] Gradientes ENTUR OS nos elementos de destaque

### Verificação Final
- [x] Conversas sincronizadas corretamente com WhatsApp
- [x] Nomes aparecem (CRM > pushName > número)
- [x] Fotos de perfil carregam
- [x] Datas e horas corretas
- [x] Preview de mensagens legível
- [x] Testes passando — 116 testes, 8 arquivos
- [x] TypeScript sem erros

## Multi-Usuário / SaaS Ready (v24)

### Schema & Banco
- [x] Criar tabela conversation_assignments (tenantId, sessionId, remoteJid, assignedUserId, assignedTeamId, status, lastAssignedAt)
- [x] Adicionar tenantId à tabela whatsapp_sessions para isolamento multi-tenant
- [x] Adicionar tenantId à tabela messages para isolamento multi-tenant
- [x] Vincular whatsapp_sessions ao tenant (não apenas ao userId do Manus auth)

### Backend — Atribuição de Conversas
- [x] Procedure para atribuir conversa a um agente (crmUser)
- [x] Procedure para transferir conversa entre agentes
- [x] Procedure para listar conversas filtradas por agente/equipe/status
- [x] Procedure para listar agentes disponíveis no tenant
- [x] Atribuição automática round-robin quando nova conversa chega (opcional)
- [x] Filtro de conversas por: minhas, da equipe, não atribuídas, todas

### Backend — Isolamento Multi-Tenant
- [x] getConversationsList filtrado por tenantId
- [x] Sessões WhatsApp vinculadas ao tenant
- [x] Mensagens filtradas por tenant
- [x] Notificações direcionadas ao agente atribuído

### Frontend — Inbox Multi-Agente
- [x] Filtros no sidebar: Minhas, Equipe, Não atribuídas, Todas
- [x] Indicador de agente atribuído em cada conversa
- [x] Botão de atribuir/transferir no header do chat
- [x] Dropdown de seleção de agente com avatar e nome
- [x] Badge com iniciais do agente na lista de conversas

### Testes
- [x] Testes de atribuição de conversa
- [x] Testes de filtro por agente/equipe
- [x] Testes de isolamento multi-tenant — 131 testes, 8 arquivos, todos passando

## Página de Gestão de Agentes e Equipes

### Schema
- [x] Criar tabela teams (id, tenantId, name, description, color, createdAt) — expandida com description, color, maxMembers
- [x] Criar tabela team_members (teamId, crmUserId, role) — expandida com role enum (member/leader)
- [x] Criar tabela distribution_rules (id, tenantId, name, strategy, teamId, isActive, config JSON)
- [x] Adicionar campo teamId na tabela crmUsers para equipe padrão — já existia via team_members

### Backend
- [x] CRUD de equipes (create, list, update, delete)
- [x] CRUD de membros de equipe (add, remove, list)
- [x] CRUD de regras de distribuição (create, list, update, delete, toggle)
- [x] Endpoint para listar agentes com suas equipes e status
- [x] Endpoint para atualizar status do agente (online, ausente, offline)
- [x] Integrar regras de distribuição com autoAssign existente

### Frontend
- [x] Página /settings/agents com tabs: Agentes, Equipes, Distribuição
- [x] Tab Agentes: lista de agentes CRM com status, equipe, avatar, ações
- [x] Tab Agentes: modal para criar/editar agente
- [x] Tab Equipes: lista de equipes com membros, cor, descrição
- [x] Tab Equipes: modal para criar/editar equipe com adição/remoção de membros
- [x] Tab Distribuição: regras de distribuição com estratégia (round-robin, menos ocupado, manual, team round-robin)
- [x] Tab Distribuição: toggle ativar/desativar regra
- [x] Tab Distribuição: configuração de horários e prioridades
- [x] Registrar rota /settings/agents no App.tsx
- [x] Link na navegação de Configurações

### Testes
- [x] Testes CRUD de equipes
- [x] Testes CRUD de regras de distribuição — 139 testes, 8 arquivos, todos passando
- [ ] Testes de integração autoAssign com regras

## Perfil de Contato Completo + Campos Personalizados

### Schema
- [x] Criar tabela custom_fields (id, tenantId, entity, name, label, fieldType, options, isRequired, isVisibleOnForm, sortOrder, createdAt)
- [x] Criar tabela custom_field_values (id, tenantId, fieldId, entityId, value, createdAt, updatedAt)
- [x] Garantir que contacts e deals já possuem campos necessários para métricas

### Backend
- [x] Endpoint getContactProfile: dados do contato + métricas (cotações, fechamentos, total comprado, dias desde última compra)
- [x] Endpoint getContactDeals: listar todas as negociações do contato com status, valor, data
- [x] Endpoint updateContact: atualizar dados padrão do contato (nome, email, telefone) — já existia no crmRouter
- [x] CRUD custom_fields: create, list, update, delete, reorder
- [x] CRUD custom_field_values: get/set valores para um contato específico
- [x] Endpoint para listar campos personalizados visíveis no formulário

### Frontend - Perfil do Contato
- [x] Página /contact/:id com layout de perfil completo
- [x] Painel de métricas: cotações feitas, negociações fechadas, total comprado (R$), dias desde última compra
- [x] Seção de dados básicos: nome, email, telefone (editável inline)
- [x] Seção de campos personalizados com valores editáveis
- [x] Lista de negociações vinculadas com status, valor, data, pipeline
- [x] Histórico de atividades do contato — incluído via lista de deals com datas

### Frontend - Configuração de Campos Personalizados
- [x] Página /settings/custom-fields para gerenciar campos
- [x] Criar campo: nome, tipo (texto, número, data, select, checkbox, textarea, email, telefone, URL, moeda, multiselect)
- [x] Toggle de visibilidade no formulário de cadastro e no perfil
- [x] Reordenar campos por setas (up/down)
- [x] Editar/excluir campos existentes

### Testes
- [x] Testes de métricas do contato
- [x] Testes CRUD de campos personalizados
- [x] Testes de valores de campos personalizados — 154 testes, 8 arquivos, todos passando

## Página de Negociação Estilo RD Station CRM

### Layout Principal
- [x] Header: seta voltar, nome da negociação, badges (funil, fonte), botões Marcar Perda / Marcar Venda
- [x] Barra de estágios do funil clicável no topo (com dias em cada estágio)
- [x] Sidebar esquerda scrollável com seções colapsáveis
- [x] Painel direito com tarefas e timeline com tabs

### Sidebar Esquerda
- [x] Seção "Negociação": nome, qualificação, criada em, valor total, previsão fechamento, fonte, campanha
- [x] Seção "Contatos": contato vinculado com telefone, email, ícones de ação (copiar, WhatsApp, ligar)
- [x] Seção "Empresa": empresa vinculada ou botão "+ Adicionar empresa"
- [x] Seção "Responsável": agente responsável pela negociação
- [x] Seção "Campos Personalizados": campos custom da entidade deal
- [x] Seção "Informações adicionais" colapsável

### Painel Direito
- [x] Próximas tarefas com status, prazo, ações (editar, adiar, concluir)
- [x] Botão "+ Criar tarefa"
- [x] Tabs: Histórico, Tarefas, Produtos, Arquivos, Propostas
- [x] Timeline de histórico com eventos: criação, mudança de estágio, anotações, tarefas
- [x] Botão "+ Criar anotação" no histórico
- [x] Filtros no histórico (tipo de evento)

### Backend
- [x] Endpoint getDealDetail: dados completos da negociação com contato, empresa, responsável — já existia via crm.deals.get
- [x] Endpoint getDealTimeline: eventos de histórico da negociação — via crm.deals.history.list
- [x] Endpoint createDealNote: criar anotação na negociação — via crm.notes.create
- [x] Endpoint changeDealStage: mudar estágio do funil (com registro na timeline) — via crm.deals.moveStage
- [x] Endpoint markDealWon/markDealLost: marcar venda/perda — via crm.deals.update com status won/lost
- [x] Tabela deal_activities para timeline de eventos — usando deal_history existente

### Testes
- [x] Testes de getDealDetail
- [x] Testes de timeline e notas
- [x] Testes de mudança de estágio — 162 testes, 8 arquivos, todos passando

## Gestão de Funis, Automação e Pós-Venda

### Gestão de Funis (Pipelines)
- [x] CRUD de pipelines: criar, editar nome/descrição/cor/tipo, arquivar
- [x] CRUD de stages: criar, editar nome/cor/probabilidade, excluir com validação, reordenar
- [x] Página /settings/pipelines com lista de funis e editor de etapas
- [x] Setas para reordenar etapas (reorderStages endpoint)
- [x] Validação: não permitir excluir etapa com deals ativos (mover antes)

### Automação de Transição entre Funis
- [x] Tabela pipeline_automations (sourcePipelineId, triggerEvent, targetPipelineId, targetStageId, isActive, config)
- [x] Configuração: ao ganhar venda no funil X, criar deal automaticamente no funil Y na etapa Z
- [x] Backend: trigger automático no updateDeal quando status = won ou lost
- [x] UI: configuração de automações por funil (origem → destino)
- [x] Toggle ativar/desativar automação

### Viagens como Funil de Pós-Venda
- [x] Criar pipeline "Pós-Venda / Viagens" com etapas padrão (configurável via Settings)
- [x] Vincular deals de viagem ao funil pós-venda automaticamente após venda ganha
- [x] Página de Viagens usa o funil pós-venda como base (Kanban board)
- [x] Etapas configuráveis pelo usuário (via Settings > Funis & Etapas)

### Testes
- [x] Testes CRUD de pipelines e stages
- [x] Testes de automação de transição
- [x] Testes de funil pós-venda — 173 testes, 8 arquivos, todos passando

## Catálogo de Produtos Turísticos e Relatórios

### Schema
- [x] Criar tabela product_catalog (id, tenantId, name, categoryId, productType, basePriceCents, costPriceCents, currency, supplier, destination, duration, imageUrl, sku, isActive, detailsJson)
- [x] Criar tabela product_categories (id, tenantId, name, icon, color, parentId, sortOrder)
- [x] Expandir deal_products com catalogProductId para referenciar product_catalog

### Backend
- [x] CRUD de categorias de produtos turísticos
- [x] CRUD de produtos do catálogo (criar, editar, ativar/desativar, excluir)
- [x] Endpoint para vincular produto do catálogo a uma negociação (com quantidade, preço customizado, datas)
- [x] Query de relatórios: produtos mais vendidos (deals won)
- [x] Query de relatórios: produtos mais perdidos (deals lost)
- [x] Query de relatórios: produtos mais solicitados (todos os deals)
- [x] Query de relatórios: receita por produto, por categoria, por período
- [x] Query de relatórios: ticket médio por produto/categoria
- [x] Query de relatórios: taxa de conversão por produto

### Frontend - Catálogo
- [x] Página /settings/products com lista de produtos em grid/tabela
- [x] Filtros por categoria, status, faixa de preço, destino
- [x] Modal de criar/editar produto com campos completos
- [ ] Seletor de produto no DealDetail (tab Produtos) vinculando ao catálogo — futuro
- [ ] Precificação customizada por negociação (preço base vs preço negociado) — futuro

### Frontend - Relatórios
- [x] Página /analytics/products com dashboard de métricas
- [x] Card: Top 10 produtos mais vendidos (barras horizontais)
- [x] Card: Top 10 produtos mais perdidos (barras horizontais)
- [x] Card: Top 10 produtos mais solicitados (barras horizontais)
- [x] Card: Receita por categoria (donut chart)
- [ ] Card: Evolução de vendas por produto ao longo do tempo (line chart) — futuro
- [x] Card: Ticket médio por categoria (tabela detalhada)
- [x] Card: Taxa de conversão por produto (barras com %)
- [ ] Filtros: período, categoria, destino, fornecedor — futuro
- [x] Exportação dos dados (CSV)

### Navegação
- [x] Link na navegação principal (Settings) para Catálogo de Produtos
- [x] Rota /settings/products no App.tsx
- [x] Rota /analytics/products no App.tsx

### Testes
- [x] Testes CRUD de catálogo de produtos
- [x] Testes de vinculação produto-deal
- [x] Testes de queries de relatórios

## Melhoria de Contraste e UX (Referência: RD Station CRM)

### Pipeline
- [x] Cards de negociação com fundo branco/claro, bordas suaves e sombra leve
- [x] Cabeçalho de coluna com nome da etapa, contagem e valor total
- [x] Barra de status "Em andamento" com cor ciano/teal nos cards
- [x] Melhor espaçamento e tipografia nos cards (nome, data, tarefa)
- [x] Fundo geral mais claro (cinza suave) para contrastar com cards brancos

### DealDetail
- [x] Barra de etapas horizontal colorida (etapa atual destacada em ciano/teal)
- [x] Sidebar esquerda com informações da negociação (nome, qualificação, data, valor, fonte)
- [x] Área de tarefas próximas com badge de status e prazo
- [x] Tabs (Histórico, E-mail, Tarefas, Produtos, Arquivos, Propostas) com estilo limpo
- [x] Timeline de histórico com pontos e datas formatadas
- [x] Botões "Marcar perda" e "Marcar venda" destacados no header

### CSS Global
- [x] Ajustar variáveis de tema claro para melhor contraste (fundo cinza suave, cards brancos)
- [x] Ajustar variáveis de tema escuro para manter consistência
- [x] Melhorar contraste de texto (foreground vs background) em ambos os temas

## Correção de Cores — Reverter teal/ciano para padrão ENTUR OS

- [x] Reverter primary color no index.css de teal (195) para roxo/magenta original ENTUR OS
- [x] Reverter accent color no index.css de teal para padrão original
- [x] Reverter cores de status no Pipeline.tsx (teal → violet ENTUR OS)
- [x] Reverter cores de stage bar no DealDetail.tsx (usa primary CSS var)
- [x] Reverter cores de botões no DealDetail.tsx (usa primary CSS var)

## Conversa WhatsApp Completa no Histórico da Negociação

### Backend
- [x] Endpoint para buscar mensagens WhatsApp completas vinculadas a um deal (via sessão/contato)
- [x] Incluir todas as mensagens (enviadas e recebidas) com timestamp, remetente, conteúdo
- [x] Endpoint de contagem de mensagens por deal

### Frontend - DealDetail
- [x] Nova tab "WhatsApp" no DealDetail com visual de chat completo
- [x] Balões de mensagem estilo WhatsApp (enviadas à direita, recebidas à esquerda)
- [x] Timestamps formatados em cada mensagem
- [x] Indicação de quem enviou (agente vs contato)
- [x] Scroll automático para últimas mensagens
- [x] Paginação (carregar mensagens anteriores)
- [x] Agrupamento de mensagens por data (separadores de dia)
- [x] Suporte a mídias (imagem, áudio, vídeo, documento) com ícones
- [x] Status de entrega (enviado, entregue, lido) com check marks
- [x] Toggle entre Histórico Completo e Chat ao Vivo
- [x] Contagem de mensagens na tab WhatsApp
- [x] Renderização expandível de conversas nos itens whatsapp_backup do histórico

### Testes
- [x] Testes do endpoint dealWhatsApp (6 testes passando)

## Correção de Duplicação de Conversas WhatsApp no Inbox

### Problema
- [x] Conversas duplicadas para o mesmo contato (uma quando agente envia primeiro, outra quando contato responde)
- [x] Formato de telefone não normalizado (ex: +5584999838420 vs 5584999838420 vs 84999838420)

### Correções
- [x] Criar módulo centralizado phoneUtils.ts (normalizeBrazilianPhone, normalizeJid, getAllJidVariants, etc.)
- [x] Normalizar JID do WhatsApp para formato consistente (55DDNNNNNNNNN@s.whatsapp.net)
- [x] Corrigir fluxo de mensagens recebidas para normalizar JID antes de salvar
- [x] Corrigir fluxo de mensagens enviadas (resolveJid) para retornar JID normalizado
- [x] Unificar conversas no inbox via SQL normalization (getConversationsList + getConversationsListMultiAgent)
- [x] Normalizar getMessagesByContact para buscar todas as variantes de JID
- [x] Normalizar markConversationRead para marcar todas as variantes
- [x] Normalizar getOrCreateAssignment para evitar assignments duplicados
- [x] Normalizar telefones no cadastro de contatos (createContact, updateContact)
- [x] Normalizar phoneToJid no crmDb.ts e whatsappDailyBackup.ts
- [x] Testes unitários para phoneUtils (27 testes passando)
- [x] 226 testes passando no total (1 falha pré-existente no backup diário)

## Análise de Atendimento por IA

### Backend
- [x] Endpoint tRPC para análise de conversa WhatsApp por deal via LLM
- [x] Prompt estruturado para avaliar: tom, tempo de resposta, clareza, oportunidades perdidas
- [x] Retorno com nota geral, pontos fortes, pontos de melhoria e sugestões acionáveis
- [x] Cache de análise de 1h no banco para evitar chamadas repetidas ao LLM (com opção forceNew)
- [x] Tabela ai_conversation_analyses para armazenar análises
- [x] Migração SQL aplicada

### Frontend - DealDetail
- [x] Tab "Análise IA" no DealDetail com ícone Sparkles
- [x] Botão "Analisar Atendimento" com gradiente violet/purple
- [x] Score circles animados (geral, tom, responsividade, clareza, fechamento)
- [x] Cards de pontos fortes (verde), melhorias (laranja), sugestões (amarelo), oportunidades perdidas (vermelho)
- [x] Histórico de análises anteriores com scores resumidos
- [x] Estado de loading com animação durante análise
- [x] Estado vazio quando não há análise
- [x] Opção de re-analisar (forçar nova análise)

### Testes
- [x] Testes do endpoint de análise de atendimento (5 testes passando)
- [x] 231 testes passando no total (1 falha pré-existente no backup diário)

## Contatos Fantasma WhatsApp & Inbox Não Carrega

### Investigação
- [x] Verificar JIDs duplicados/fantasma na tabela messages (encontrados 87 JIDs com 13 dígitos duplicados)
- [x] Verificar se normalização de telefone está funcionando corretamente (phoneUtils.ts já aplicado)
- [x] Verificar se o Inbox está falhando ao carregar (query SQL com CASE WHEN normalização causava timeout >60s)
- [x] Identificar causa raiz: JIDs não migrados + query SQL pesada com subconsultas correlacionadas

### Correção
- [x] Migrar JIDs de 12 dígitos para 13 dígitos no banco (messages + conversation_assignments)
- [x] Simplificar query getConversationsList e getConversationsListMultiAgent (de >60s para ~1.6s)
- [x] Excluir status@broadcast e grupos (@g.us) do Inbox
- [x] Fallback para status do banco quando sessão não está em memória
- [x] Inbox carregando corretamente com 841 conversas sem duplicações
- [x] 231 testes passando (1 falha pré-existente no backup diário)

## Correção de Status de Conexão WhatsApp

- [x] Reverter fallback de status do banco — agora usa apenas status em memória (live)
- [x] Inbox funciona para ver histórico com sessão desconectada (banner amarelo "Reconectar")
- [x] Reconexão via QR code funciona normalmente quando sessão não está ativa

## Desativar Notificações por E-mail

- [x] Desativar todas as notificações por e-mail — zero notificações por email, manter apenas na área de notificações do app

## Conversation Identity Resolver (Solução Definitiva Anti-Duplicação)

### Schema & Migrações
- [x] Criar tabela wa_conversations (id, tenantId, sessionId, contactId, remoteJid, conversationKey, phoneE164, phoneDigits, phoneLast11, lastMessageAt, lastMessagePreview, lastMessageType, lastFromMe, unreadCount, status, contactPushName, createdAt, updatedAt)
- [x] Criar tabela wa_identities (id, tenantId, sessionId, contactId, remoteJid, waId, phoneE164, confidenceScore, firstSeenAt, lastSeenAt)
- [x] Adicionar coluna conversationId na tabela deals (FK para wa_conversations)
- [x] Adicionar coluna waConversationId na tabela messages
- [x] Criar constraints UNIQUE e índices otimizados
- [x] Migrar dados existentes: popular wa_conversations a partir de messages agrupados por remoteJid

### Módulo ConversationIdentityResolver
- [x] normalizePhone(input, defaultCountry) — retorna phone_e164, digits_only, last11BR, valid, reason
- [x] resolveContact(tenantId, phoneE164, name?) — upsert em contacts por (tenantId, phone_e164)
- [x] resolveIdentity(tenantId, sessionId, remoteJid, waId?, phoneE164?) — upsert em wa_identities
- [x] resolveConversation(tenantId, sessionId, contactId?, remoteJid, phoneE164?) — upsert em wa_conversations por conversationKey
- [x] reconcileGhostThreads(tenantId, sessionId) — deduplicar threads fantasma

### Integração nos Fluxos
- [x] Integrar resolver no webhook de mensagem recebida (messages.upsert)
- [x] Integrar resolver no envio de mensagens (sendTextMessage/sendMediaMessage)
- [x] Ajustar query da Inbox para usar wa_conversations
- [x] Ajustar chat da negociação para usar wa_conversations.id (conversation_id)
- [x] Inbox e Negociação exibem exatamente o mesmo thread

### Observabilidade
- [x] Logs de auditoria: conversation_resolved, message_ingested, message_sent, ghost_merge_performed
- [x] Painel de debug admin: dado um phone ou contact_id, mostrar identities, conversation_key, conversas mescladas

### Testes Obrigatórios
- [x] Envio outbound para contato novo cria 1 conversa e 1 identity
- [x] Recebimento inbound do mesmo número cai na mesma conversa
- [x] Variações de número (+55 (84) 99983-8420, 5584999838420, 08499838420) resultam no mesmo phone_e164
- [x] Reconcile migra mensagens de fantasma e mantém 1 thread
- [x] Inbox e negociação exibem o mesmo conversation_id para o mesmo contact_id

## Bug Crítico: Resposta vai para número fantasma
- [x] Corrigir envio de resposta: mensagem está sendo enviada para JID fantasma em vez do JID real do contato
- [x] Garantir que sendTextMessage/sendMediaMessage usem o JID real do WhatsApp (não o normalizado pelo resolver)

## Painel de Monitoramento em Tempo Real

- [x] Backend: endpoint de métricas de mensagens (total enviadas, recebidas, entregues, lidas, falhas)
- [x] Backend: endpoint de métricas por período (hoje, 7 dias, 30 dias) com agrupamento por hora/dia
- [x] Backend: endpoint de feed de atividade recente (últimas mensagens com status)
- [x] Backend: emitir eventos Socket.IO para atualizações de status em tempo real
- [x] Frontend: página de monitoramento com cards de métricas resumidas
- [x] Frontend: gráfico de mensagens por hora/dia (enviadas vs recebidas)
- [x] Frontend: indicadores de status de entrega (enviado, entregue, lido, falha)
- [x] Frontend: feed de atividade em tempo real com atualizações via Socket.IO
- [x] Frontend: filtros por período e sessão
- [x] Registrar rota no App.tsx e navegação
- [x] Testes automatizados para os endpoints de métricas

## Sistema de Captura de Leads (Webhook + Meta Lead Ads)

### Schema / Banco
- [x] Criar tabela lead_event_log (id, type, source, dedupe_key, payload, status, error, deal_id, created_at)
- [x] Criar tabela meta_integration_config (id, tenant_id, page_id, page_name, access_token, app_secret, forms, status, created_at)
- [x] Adicionar colunas source, utm_json, meta_json, raw_payload_json na tabela deals
- [x] Adicionar coluna dedupe_key na tabela lead_event_log com UNIQUE index

### Backend: Processamento
- [x] Implementar função process_inbound_lead(source, payload) com idempotência
- [x] Normalização: phone E164, email lower, remover espaços/acentos
- [x] Dedupe: source + (lead_id || hash(email+phone))
- [x] Upsert Contact: criar ou atualizar campos vazios + anexar origem
- [x] Create Deal: pipeline padrão, stage "Novo lead", title "{name} • {source}"
- [x] Round-robin owner assignment (fallback admin)
- [x] Event log: registrar success/failed com deal_id ou error

### Backend: Endpoints Webhook
- [x] POST /webhooks/leads — Landing Page webhook com Bearer token auth
- [x] POST /webhooks/meta — Meta Lead Ads webhook com X-Hub-Signature-256
- [x] GET /webhooks/meta — Meta verification challenge (hub.verify_token)
- [x] Buscar lead details via Graph API usando access_token

### Backend: Endpoints Admin (tRPC)
- [x] Meta connect/disconnect (salvar tokens/contas/forms)
- [x] Webhook config (gerar/regenerar token, mostrar URL)
- [x] Event log: listar com filtro source/status, reprocessar eventoFrontend: UI
- [x] Página de Integrações: Meta (conectar, selecionar page/forms)
- [x] Página de Integrações: Webhook (mostrar URL e token, copiar)
- [x] Página de Logs: lista de EventLog com filtro source/status + botão reprocessar
- [x] Registrar rotas no App.tsx

### Testes
- [x] Testes para process_inbound_lead (idempotência, upsert, dedupe)
- [x] Testes para endpoints webhook (auth, validação, processamento)
- [x] Testes para event log queries

## Notificação In-App ao Receber Lead

- [x] Adicionar notificação in-app automática quando novo lead entrar via webhook
- [x] Notificar o owner do deal (atribuído por round-robin) e o admin
- [x] Incluir nome do lead, origem e link para a negociação na notificação
- [x] Testes automatizados para a notificação de novo lead

## Exclusão em Massa de Negociações e Contatos

- [x] Backend: endpoint de exclusão em massa de negociações (soft-delete, sem apagar contatos)
- [x] Backend: endpoint de exclusão em massa de contatos (soft-delete)
- [x] Frontend: seleção múltipla na lista de negociações com checkbox
- [x] Frontend: botão "Excluir selecionados" na lista de negociações com confirmação
- [x] Frontend: seleção múltipla na lista de contatos com checkbox
- [x] Frontend: botão "Excluir selecionados" na lista de contatos com confirmação
- [x] Testes automatizados para exclusão em massa

## Bug: Criação Aleatória de Funis e Filtro de Funis Ativos

- [x] Corrigir bug de criação aleatória de funis e etapas
- [x] Filtrar apenas funis ativos (não arquivados) no seletor de pipeline

## Bug: Exclusão de negociações não funciona + Adicionar na visão de lista do Pipeline

- [x] Corrigir exclusão de negociações que não está funcionando
- [x] Adicionar seleção múltipla e exclusão em massa na visão de lista do Pipeline
- [x] Filtrar apenas funis ativos no seletor do Pipeline

## Integrar Monitor no Dashboard de Análises + Dados Reais

- [x] Mover painel de monitoramento de mensagens para dentro do dashboard de Análises
- [x] Deixar claro que são dados de mensagens WhatsApp no dashboard de Análises
- [x] Ativar captação de dados reais em todos os dashboards (Home, Análises)
- [x] Remover rota e link do Monitor antigo da navegação

## Bug Crítico: Criação Automática de Funis e Etapas

- [x] Investigar todas as fontes de criação automática de funis e etapas
- [x] Remover toda criação automática de funis/etapas (seeds, testes, leadProcessor, etc.)
- [x] Adicionar guards para impedir criação de funis/etapas sem ação explícita do usuário
- [x] Limpar funis e etapas fantasma do banco de dados
- [x] Garantir que testes não poluam o banco de produção com funis/etapas

## Bug: Testes Criando Negociações no Banco de Produção

- [x] Investigar todos os testes que criam deals, contacts e outros dados no banco real
- [x] Reescrever testes para usar mocks ou ser read-only, sem poluir o banco
- [x] Limpar negociações e dados de teste do banco de produção

## Endpoint Público WordPress Elementor — POST /webhooks/wp-leads

- [x] Criar endpoint Express POST /webhooks/wp-leads (fora do tRPC, stateless)
- [x] Validação de api_key no body contra env WP_SECRET (401 se inválida)
- [x] Rate limit 30 req/min por IP
- [x] Validação de campos obrigatórios (name, email, phone) com HTTP 400
- [x] Normalização de telefone para E.164
- [x] Criar/atualizar contato pelo email ou telefone
- [x] Criar negociação no pipeline padrão (source=wordpress, channel=elementor)
- [x] Salvar UTMs se existirem
- [x] Registrar EventLog (type=lead_created, origin=elementor_webhook)
- [x] Logar tentativas inválidas no EventLog
- [x] Testes unitários para o endpoint
- [x] Configurar secret WP_SECRET via webdev_request_secrets

## Tracking Script (estilo RD Station) — Captação Automática de Formulários

- [x] Criar tabela tracking_tokens no schema (token por tenant, domínios permitidos, status)
- [x] Migrar banco com a nova tabela
- [x] Implementar tracker.js (intercepta submit de todos os forms, identifica campos por heurística, envia para /api/collect)
- [x] Implementar endpoint GET /tracker.js?t=TOKEN para servir o script
- [x] Implementar endpoint POST /api/collect para receber dados do tracker (validação de token, CORS, rate limit)
- [x] Integrar com processInboundLead (source=tracking_script, channel=form_capture)
- [x] Criar tRPC procedures para gerenciar tokens (gerar, listar, revogar)
- [x] Criar página de Integrações no painel (snippet para copiar, token visível, domínios, instruções visuais)
- [x] Adicionar rota /integrations no App.tsx e link na navegação/configurações
- [x] Testes unitários para heurística de campos, endpoint /api/collect e token validation
- [x] Teste ponta a ponta com formulário HTML real

## Validação de Instalação do Tracking Script

- [x] Criar endpoint backend para verificar se o tracking script está instalado em uma URL
- [x] Criar UI de validação na aba Tracking Script (campo de URL + botão verificar + resultado visual)

## Bug: Tracking Script não capta leads de formulário pop-up Elementor

- [x] Investigar como o Elementor envia formulários pop-up (AJAX vs submit nativo)
- [x] Corrigir tracker.js para interceptar envios AJAX do Elementor
- [x] Testar e validar a correção

## Bug: Tracking Script não funciona no teste real do crienatal.com.br

- [x] Investigar o tracker.js carregado no site real e monitorar envio do formulário (causa: ERR_SSL_PROTOCOL_ERROR no domínio manus.space impede carregamento do script externo)
- [x] Identificar causa raiz e corrigir (snippet agora é inline completo, não depende de /tracker.js externo)
- [x] Testar e validar a correção (389 testes passando)

## Bug: Leads não chegam ao CRM via tracking script inline no crienatal.com.br

- [x] Investigar por que o tracker inline não envia dados ao /api/collect quando formulário Elementor é submetido (causa: WP Rocket muda type para rocketlazyloadscript, impedindo execução)
- [x] Corrigir: snippet agora usa bootstrap via document.createElement que contorna WP Rocket/LiteSpeed/Autoptimize

## Reformular Formulário Criar Negociação (com Empresa e Contato inline)

- [x] Criar tabela companies (empresas) se não existir no schema (tabela accounts já existia)
- [x] Criar procedures tRPC para CRUD de empresas (accounts.create, accounts.search)
- [x] Adicionar campo accountId ao deal (relacionamento deal → empresa) + leadSource, channelOrigin
- [x] Reformular formulário "Criar Negociação" com seções: Dados da Negociação, Informações da Empresa, Informações do Contato, Campos Personalizados
- [x] Seção Empresa: select de empresas existentes + botão "+ Adicionar empresa" com formulário inline
- [x] Seção Contato: select de contatos existentes + botão "+ Adicionar contato" com formulário inline
- [x] Adicionar campos Fonte e Campanha ao formulário de criação
- [x] Testes unitários para os novos procedures e formulário (403 testes passando)

## Reorganizar Página de Configurações (estilo RD Station CRM)

- [x] Analisar estrutura atual da página Settings e routers existentes
- [x] Criar tabelas lead_sources, campaigns e loss_reasons no schema
- [x] Migrar banco com as novas tabelas
- [x] Criar procedures tRPC para CRUD de fontes (lead_sources)
- [x] Criar procedures tRPC para CRUD de campanhas (campaigns)
- [x] Criar procedures tRPC para CRUD de motivos de perda (loss_reasons)
- [x] Redesenhar página de Configurações com cards de sugestões no topo e categorias em colunas
- [x] Criar página de CRUD para Fontes e Campanhas (adicionar, editar, excluir)
- [x] Criar página de CRUD para Motivos de Perda de Venda (adicionar, editar, excluir)
- [ ] Integrar fontes/campanhas no formulário de Criar Negociação (substituir inputs fixos)
- [x] Testes unitários para os novos procedures (35 testes adicionais, 438 total passando)

## Menu Principal — Inbox WhatsApp

- [x] Adicionar link do Inbox no menu principal entre Tarefas e Análises

## Integração RD Station Marketing via Webhook

- [x] Criar tabelas rd_station_config e rd_station_webhook_log no schema
- [x] UTMs já suportados via utmJson no deals (campo JSON existente)
- [x] Migrar banco com as novas tabelas
- [x] Criar endpoint POST /webhooks/rdstation com autenticação por token
- [x] Processar payload do RD Station: extrair leads, UTMs, criar contato + deal automaticamente
- [x] Criar procedures tRPC (getConfig, setupIntegration, regenerateToken, toggleActive, getWebhookLogs, getStats)
- [x] Criar página frontend com manual passo-a-passo simplificado para leigos
- [x] Exibir cards de estatísticas (total, sucesso, falha, duplicata)
- [x] Histórico de recebimentos com filtros e tabela
- [x] FAQ com perguntas frequentes
- [x] Registrar rota /settings/rdstation no App.tsx
- [x] Adicionar link na página de Configurações (seção Avançado com badge "Novo")
- [x] Testes unitários para o endpoint webhook e procedures (23 testes adicionais, 461 total passando)

## Edição Completa na Página de Negociação

- [x] Edição inline do nome da negociação (clique para editar)
- [x] Edição de todos os campos da negociação (valor, previsão de fechamento, fonte) exceto data de criação
- [x] Criar/adicionar novo contato diretamente da página de negociação
- [x] Vincular contato existente à negociação
- [x] Editar informações do contato vinculado (nome, telefone, email)
- [x] Desvincular contato da negociação
- [x] Criar/adicionar nova empresa diretamente da página de negociação
- [x] Vincular empresa existente à negociação
- [x] Editar nome da empresa vinculada
- [x] Desvincular empresa da negociação
- [x] Procedures tRPC para update de deal, contato e empresa (accounts.update adicionado)
- [x] Componente EditableSidebarField reutilizável para edição inline

## UTMs, Mapeamento de Campos RD Station e Correção do Webhook

### Diagnóstico e Correção do Webhook RD Station
- [x] Testar endpoint /webhooks/rdstation com curl para verificar se responde
- [x] Verificar logs de erro no servidor
- [x] Corrigir problemas: mover todas as rotas de webhook para /api/webhooks/ (proxy só encaminha /api/)

### Campos UTM Dedicados na Negociação
- [x] Adicionar campos utm_source, utm_medium, utm_campaign, utm_term, utm_content ao schema de deals
- [x] Migrar banco com os novos campos + migrar dados existentes do utmJson
- [ ] Atualizar processamento do webhook RD Station para gravar UTMs nos campos dedicados
- [ ] Exibir UTMs na sidebar da negociação (seção "Rastreamento")
- [ ] Permitir edição manual dos campos UTM na sidebar

### Mapeamento de Campos Personalizados RD Station ↔ Entur OS
- [ ] Criar tabela rd_field_mappings no schema (campo RD → campo Entur OS)
- [ ] Criar procedures tRPC para CRUD de mapeamentos
- [ ] Criar página/seção de configuração para mapear campos
- [ ] Aplicar mapeamentos ao processar webhook do RD Station

### Testes
- [x] Testes unitários para novos procedures e processamento de UTMs (480 testes passando)

## Unificação Catálogo de Produtos e Produtos da Negociação

### Schema e Migração
- [x] Analisar tabelas existentes (product_catalog, deal_products, product_categories)
- [x] Reestruturar Product (catálogo) — product_catalog já tem a estrutura ideal
- [x] Reestruturar DealItem com productId obrigatório (FK) + finalPriceCents (snapshot)
- [x] Migrar banco (0 registros existentes, sem dados para migrar)
- [x] Índice dp_prod_product_idx adicionado para integridade

### Backend
- [x] Procedures tRPC para CRUD de Product (catálogo) — já existiam no productCatalogRouter
- [x] Procedures tRPC para DealItem (adicionar/editar/remover com productId obrigatório)
- [x] Validação: impedir DealItem sem product_id válido (TRPCError NOT_FOUND)
- [x] Validação: impedir inserção de produto desativado (TRPCError BAD_REQUEST)
- [x] Snapshot de preço: copiar basePriceCents do catálogo ao criar DealItem
- [x] Recálculo automático de finalPriceCents (qty * unit - discount)

### Frontend- [x] Modal de busca no catálogo ao adicionar produto na negociação (com busca por nome/fornecedor/SKU)
- [x] Permitir editar preço apenas no DealItem (não no catálogo) via dialog de edição
- [x] Recálculo automático de total da negociação na UI (finalPriceCents)
- [x] Exibir badge de referência ao catálogo nos itens (Catálogo #id)gociações existentes

### UTMs e RD Station (pendentes da iteração anterior)
- [x] Atualizar processamento do webhook para gravar UTMs nos campos dedicados (leadProcessor.ts)
- [x] Exibir UTMs na sidebar da negociação (seção "Rastreamento" com badge RD Station)
- [x] Permitir edição manual dos campos UTM (via seção Rastreamento na sidebar)
- [x] Criar área de mapeamento de campos RD Station ↔ Entur OS (página dedicada com CRUD)

### Testes
- [x] Testes unitários para Product, DealItem, fieldMappings e RD Station (475 testes passando)

## Auto-captura de Campos RD Station e Reposicionamento

- [x] Adicionar campo rdCustomFields (JSON) ao schema de deals
- [x] Migrar banco com o novo campo
- [x] Atualizar webhook para detectar e capturar automaticamente campos cf_* do RD Station
- [x] Gravar todos os campos cf_* como texto aberto no rdCustomFields do deal
- [x] Exibir campos capturados na sidebar da negociação (seção "Campos RD Station" com badge Auto-captura)
- [x] Reposicionar mapeamento de campos abaixo do webhook na página RD Station (com card expandido e badge Auto-captura)
- [x] Testes unitários (auto-captura cf_*, 480 testes passando)

## Melhoria UX/Design da Página de Negociação

- [x] Redesenhar funil de etapas com design de setas (chevron/arrow steps) como RD Station (clip-path + SVG notch)
- [x] Melhorar espaçamento, tipografia e hierarquia visual da sidebar (13px, animação fade-in, avatar gradiente)
- [x] Melhorar tab bar (badges primary, indicador 2.5px, overflow-x-auto)
- [x] Melhorar seção Próximas Tarefas (empty state com ícone, melhor padding)
- [x] Melhorar botões Marcar perda/venda (emerald-600, ícones maiores, font-medium)
- [x] Melhorar header (botão voltar com borda, melhor espaçamento)
- [x] Todas as funções e cores existentes mantidas

## Tooltip de Tempo de Permanência nas Etapas do Funil

- [ ] Analisar como o histórico de etapas é armazenado (deal_history)
- [ ] Calcular tempo de permanência em cada etapa
- [x] Implementar tooltip nas etapas do funil com tempo formatado (ex: "2 dias", "3h 15min")

## Dashboard de Análise UTM (Rastreamento)

- [x] Analisar schema de deals e campos UTM disponíveis
- [x] Verificar lógica de status de vendas (won/lost/open) e retroação
- [x] Criar procedures tRPC para analytics UTM com queries SQL diretas ao banco
- [x] Métricas: total de deals, vendas ganhas, taxa de conversão, valor total por UTM
- [x] Filtros: período, utm_source, utm_medium, utm_campaign, utm_term, utm_content
- [x] Gráficos: barras por fonte, pizza por mídia, tabela detalhada com todas as métricas
- [x] Garantir que venda desmarcada retroaja corretamente (status open/lost reflete no dashboard)
- [x] Registrar rota em Análises e adicionar link no menu
- [x] Criar página de dashboard com design profissional

## Tooltip de Tempo de Permanência nas Etapas

- [x] Calcular tempo de permanência em cada etapa usando deal_history
- [x] Implementar tooltip nas etapas do funil com tempo formatado

## Valor da Negociação = Soma dos Produtos/Serviços

- [x] Tornar campo de valor da negociação read-only (calculado automaticamente pela soma dos deal_products)
- [x] Backend: recalcular valueCents do deal ao adicionar/remover/editar produtos
- [x] Frontend: remover edição direta do valor na sidebar, exibir como "calculado"
- [x] Frontend: indicação visual de que o valor vem dos produtos

## Atalho para Criar Produto/Categoria na Negociação

- [x] Botão "Criar Novo Produto" dentro do modal de busca de produtos na negociação
- [x] Dialog inline para criar produto rápido (nome, preço, categoria)
- [x] Botão "Criar Nova Categoria" dentro do dialog de criação de produto
- [x] Após criar produto, adicioná-lo automaticamente à negociação

## Filtro de Datas Global com Presets

- [x] Criar componente reutilizável DateRangeFilter com presets e data personalizada
- [x] Presets: Últimos 7 dias, Mês passado, Últimos 3 meses, Últimos 6 meses, Esse ano, Ano passado
- [x] Opção de data personalizada (de/até)
- [x] Aplicar filtro no Dashboard UTM (Análises)
- [x] Aplicar filtro no CRM Dashboard (Análises)
- [x] Aplicar filtro no Mensagens WhatsApp Dashboard (Análises)
- [x] Aplicar filtro na Home (Dashboard principal)
- [x] Aplicar filtro na lista de Negociações
- [x] Aplicar filtro na lista de Contatos
- [x] Aplicar filtro na lista de Tarefas

## Filtro de Data nas Listas + Variação Percentual nos KPIs

- [x] Backend: adicionar dateFrom/dateTo na listagem de deals (crm.deals.list)
- [x] Backend: adicionar dateFrom/dateTo na listagem de contacts (crm.contacts.list)
- [x] Backend: adicionar dateFrom/dateTo na listagem de tasks (crm.tasks.list)
- [x] Frontend: DateRangeFilter na página Negociações (Deals.tsx)
- [x] Frontend: DateRangeFilter na página Contatos (Contacts.tsx)
- [x] Frontend: DateRangeFilter na página Tarefas (Tasks.tsx)
- [x] KPIs: variação percentual entre período selecionado e período anterior na Home
- [x] KPIs: variação percentual entre período selecionado e período anterior no CRM Dashboard

## Painel de Filtros Avançados para Negociações

- [x] Criar componente DealFiltersPanel (drawer lateral estilo CRM profissional)
- [x] Toggle: Ver apenas negociações sem tarefa
- [x] Toggle: Ver apenas negociações esfriando (sem atividade recente)
- [x] Filtro: Status da negociação (aberto, ganho, perdido)
- [x] Filtro: Nome da negociação (busca por texto)
- [x] Filtro: Qualificação (quente, morno, frio)
- [x] Filtro: Valor total (de/até)
- [x] Filtro: Data de criação (com presets)
- [x] Filtro: Data de último contato (com presets)
- [x] Filtro: Data da próxima tarefa (com presets)
- [x] Filtro: Data de fechamento (com presets)
- [x] Filtro: Data de previsão de fechamento (com presets)
- [x] Filtro: Empresa (select com empresas do sistema)
- [x] Filtro: Campanha UTM (select com campanhas do sistema)
- [x] Filtro: Fonte/Lead Source (select com fontes do sistema)
- [x] Filtro: Produto ou serviço (select com produtos do catálogo)
- [x] Botões: Limpar filtros e Aplicar filtros
- [x] Backend: query avançada de deals com todos os filtros
- [x] Integrar no Pipeline Kanban
- [x] Integrar na lista de Deals
- [x] Integrar no Dashboard UTM (relatórios)
- [x] Contador de filtros ativos no botão de filtro

## Bug Fix — DealFiltersPanel Responsividade

- [x] Corrigir botão de confirmação cortado no DealFiltersPanel (não acessível em telas menores)
- [x] Garantir que os botões Limpar/Aplicar fiquem sempre visíveis (sticky no rodapé)
- [x] Área de filtros deve ter scroll independente sem cortar o rodapé

## Motivo de Perda Obrigatório + Gráfico no Dashboard

- [x] Ao marcar deal como perdido, exigir seleção de motivo de perda dos motivos cadastrados nas configurações
- [x] Dialog/modal de motivo de perda ao clicar em "Marcar como Perdida"
- [x] Backend: validar que lossReasonId é obrigatório ao mudar status para lost
- [x] Salvar motivo de perda no deal (campo loss_reason_id e loss_notes)
- [x] Backend: query de analytics para motivos de perda (contagem e valor por motivo)
- [x] Gráfico de motivos de perda no dashboard inicial (Home)

## Redesign Header Pipeline/Negociações (estilo RD Station adaptado Apple)

- [x] Linha 1: Toggle funil/lista à esquerda + botões à direita (indicadores, calendário, 3 pontos, + Criar)
- [x] Linha 2: Filtros inline (pipeline, usuário CRM, status, ordenação) + botão FILTROS destacado na cor do sistema
- [x] Filtro de usuário da conta CRM (listar usuários do sistema)
- [x] Botão indicadores: painel com métricas por etapa (em andamento, esfriando, sem tarefas, tarefas atrasadas, sem produtos)
- [x] Botão calendário: gestão de tarefas em calendário estilo Apple
- [x] Menu 3 pontos: exportar dados, atualizar (contextual)
- [x] Manter padrão visual Apple do sistema (cores, fontes, espaçamentos)
- [x] Selects flex-1 ocupando todo o espaço disponível (estilo RD Station)
- [x] Botão Filtros com destaque visual (cor primária quando filtros ativos)
- [x] Indicadores por etapa com breakdown (esfriando, sem tarefas, atrasadas)
- [x] 24 testes unitários adicionais para Pipeline Header (521 total)

## Correção Visual Header Pipeline

- [x] Remover retângulo/card de fundo (bg-card) do header do Pipeline
- [x] Toolbar deve ocupar toda a parte superior sem card separado, fluindo com o fundo
- [x] Botão Filtros na cor de destaque do sistema (sempre visível)

## Ajuste Layout Filtros Pipeline

- [x] Seletor de funil na ponta esquerda, botão Filtros na ponta direita (abaixo de Criar)
- [x] Selects expandindo proporcionalmente para ocupar todo o espaço disponível

## Integração Importar do RD Station CRM

- [x] Pesquisar API do RD Station CRM (endpoints, autenticação, estrutura)
- [x] Backend: procedure para validar token da API RD Station
- [x] Backend: importar contatos do RD Station CRM
- [x] Backend: importar empresas/organizações do RD Station CRM
- [x] Backend: importar negociações (deals) do RD Station CRM
- [x] Backend: importar etapas do pipeline do RD Station CRM
- [x] Backend: importar produtos do RD Station CRM
- [x] Backend: importar tarefas/atividades do RD Station CRM
- [x] Backend: importar fontes de leads do RD Station CRM
- [x] Backend: importar campanhas do RD Station CRM
- [x] Backend: importar motivos de perda do RD Station CRM
- [x] Frontend: página de configuração "Importar do RD Station CRM" com fluxo guiado (5 etapas)
- [x] Frontend: item no menu Configurações com badge (novo)
- [x] Frontend: progresso em tempo real da importação
- [x] Testes unitários para a integração (18 testes, 539 total)

## Correção Importação RD Station CRM

- [x] Corrigir erro "Unexpected token '<'" (API retornando HTML em vez de JSON)
- [x] Adicionar progresso em tempo real com percentual e contagem (X de Y registros)
- [x] Garantir importação fiel de funis com mesmas etapas do RD Station
- [x] Garantir negociações em andamento entrem no funil correto com etapa correta
- [x] Minimizar impacto da mudança de sistema para o usuário
- [x] Testar com token real: 645c346a88cd99000fa7b641

## SaaS Multi-Tenant + Landing Page + Planos + Hotmart

- [x] Schema multi-tenant: tabela subscriptions, plans
- [x] Sistema de login email/senha (registro, login, recuperação de senha)
- [x] Isolamento multi-tenant em todas as queries (tenantId já existe)
- [x] Sistema de planos: Freemium (12 meses default, mín 7 dias), Pro (R$97/mês), Enterprise (personalizado)
- [x] Integração Hotmart via webhook para pagamentos Pro
- [x] Landing page para agências de viagens com diferenciais do Entur OS
- [x] Painel admin geral (bruno@entur.com.br) para gerenciar tenants, alterar período freemium
- [x] Tela de bloqueio quando assinatura expira, com link de pagamento Hotmart
- [x] Fluxo completo: registro → freemium → expiração → cobrança → bloqueio/desbloqueio
- [x] Webhook Hotmart para processar pagamentos automaticamente
- [x] 19 testes unitários para SaaS Auth (558 total)

## Correção Importação RD Station CRM v2 — Paginação e Dados

- [x] Corrigir limite de 10.000 registros da API RD Station (page*limit <= 10000)
- [x] Implementar busca em duas janelas (default + asc) com deduplicação para contatos
- [x] Implementar busca de deals por pipeline (cada pipeline < 10.000 deals)
- [x] Implementar busca de tasks por tipo (call, email, meeting, task, whatsapp)
- [x] Garantir contatos importados com nome, email e telefone corretos
- [x] Garantir negociações vinculadas aos contatos e contas corretas
- [x] Garantir tarefas vinculadas às negociações corretas (mapa rdIdMap.deals)
- [x] Adicionar logging detalhado para diagnóstico de erros de importação
- [x] Aumentar timeout da API de 30s para 60s
- [x] Testar importação completa: 14.076 contatos, 13.815 deals, 17.817 tasks

## Redesign Página de Tarefas (estilo RD Station + Google Agenda)

- [x] Schema: tabela task_assignees para múltiplos responsáveis por tarefa
- [x] Backend: procedure para listar tarefas com filtros (responsável, período, tipo, status)
- [x] Backend: procedure para atribuir/remover responsáveis de tarefas
- [x] Frontend: filtros inline (Responsável, Período, Tipo de tarefa, Status)
- [x] Frontend: visão lista com colunas (Tarefa+ícone tipo, Status, Data/Hora, Responsáveis, Negociação, Valor Total)
- [x] Frontend: resumo das tarefas da semana (card expansível)
- [x] Frontend: toggle lista/calendário (mesmo padrão da página de negociações)
- [x] Frontend: visão calendário estilo Google Agenda (dia, semana, mês)
- [x] Frontend: ordenação por data e hora na lista
- [x] Backend: quem cria a tarefa é responsável por padrão, editável para adicionar outros
- [x] Frontend: badge de status (Completa, Atrasada, Em aberto)
- [x] Frontend: link para negociação vinculada com nome e valor

## Correção Dashboard - Números por Tenant

- [ ] Dashboard deve mostrar números reais do tenant do usuário logado
- [ ] Novos usuários/contas devem ver dashboard zerado (sem dados de outros tenants)
- [ ] Números devem atualizar em tempo real (adicionar/remover dados)
- [ ] Verificar conta da agência (bruno@boxtour.com.br) mostra dados corretos

## Destaque Tarefas Atrasadas no Kanban

- [x] Cards do Kanban com tarefas atrasadas devem ter borda/destaque vermelho
- [x] Indicador visual de alerta de atraso visível no card da negociação

## Formulário Completo de Tarefas (Criar/Editar) — Estilo RD Station

- [x] Componente TaskFormDialog reutilizável com campos: empresa, negociação, assunto, descrição, responsável(is), tipo de tarefa, data, horário, "marcar como concluída ao criar"
- [x] Responsável obrigatório desde a criação da tarefa (multi-select com usuários CRM)
- [x] Tipo de tarefa obrigatório (WhatsApp, telefone, email, vídeo, tarefa)
- [x] Data e horário obrigatórios
- [x] Modo edição: preencher campos com dados existentes da tarefa
- [x] Integrar TaskFormDialog na página Pipeline (criar/editar tarefa na negociação)
- [x] Integrar TaskFormDialog na página Tasks (tarefas gerais) com edição
- [x] Integrar TaskFormDialog no DealDetail (tarefas da negociação) com edição
- [x] Manter checkbox de conclusão em tarefas atrasadas na lista
- [x] Ícones de ação na lista de tarefas: editar (lápis), reagendar (relógio), concluir (check)
- [x] Corrigir erros TypeScript pendentes (DealDetail.tsx formato tasks)

- [x] Popup de ação ao tocar na tarefa no calendário: Finalizar / Editar / Adiar
- [x] Opções de adiar: 1h, 3h, 1 dia, 2 dias, 7 dias, tempo personalizado
- [x] Lógica unificada de tarefas em todos os contextos (Pipeline, DealDetail, Tasks, Calendário)
- [x] Formulário completo na criação dentro da negociação (todos os campos disponíveis)

## Kanban Cards — Destaque Tarefas Atrasadas + Popup Info + Unificar Status

- [x] Tarefa atrasada dentro do card do Kanban com fundo rosa/vermelho (linha da tarefa destacada)
- [x] Ícone "i" no card com popup "Sobre a Negociação" ao hover (Fonte, Campanha, Empresa, Data de criação, Último contato, Previsão de fechamento, Identificador, botão Abrir Negociação)
- [x] Unificar status "Em andamento" e "Aberto" no funil — tudo vira "Em andamento"

## Sistema de Classificação Estratégica de Contatos + Pipelines Automáticos

### Schema & Migração
- [x] Campo contact_stage_classification no schema de contatos (enum: desconhecido, seguidor, lead, oportunidade, cliente_primeira_compra, cliente_ativo, cliente_recorrente, ex_cliente, promotor)
- [x] Campo referral_window_start nos contatos (timestamp para janela de indicação 90 dias)
- [x] Campo referral_count nos contatos (número de indicações confirmadas)
- [x] Campo last_purchase_at nos contatos (data da última compra)
- [x] Campo total_purchases nos contatos (total de compras)
- [x] Migração SQL para adicionar os novos campos

### Pipelines Padrão por Tenant
- [x] Pipeline 1 — Funil de Vendas: Novo atendimento, Primeiro contato, Diagnóstico, Cotação, Apresentação, Acompanhamento, Reserva
- [x] Pipeline 2 — Funil de Pós-Venda: Novo cliente, Aguardando embarque, 30D para embarque, Pré embarque, Em viagem, Pós viagem, Viagem finalizada
- [x] Criação automática dos 2 pipelines no onboarding de novo tenant

### Motor de Regras Automatizadas
- [x] Regra DealMoved: etapas 1-2 → classificar contato como Lead; etapas 3-7 → classificar como Oportunidade
- [x] Regra DealWon: sem compras anteriores → Cliente Primeira Compra; com compras → Cliente Recorrente
- [x] Regra DealWon: iniciar janela de indicação 90 dias (Potencial Indicador)
- [x] Regra DealWon: criar negociação automática no Funil de Pós-Venda (etapa "Novo cliente")
- [x] Regra DealLost: se nunca comprou → classificar como Não Cliente (Desconhecido)
- [x] Regra Cliente Ativo: compra dentro de 360 dias (configurável)
- [x] Regra Ex-Cliente: inativo por 360 dias (configurável)
- [x] Regra Promotor: indicou pelo menos 1 cliente confirmado

### Badges Visuais nos Cards
- [x] Badge de classificação estratégica com cor distinta no card da negociação
- [x] Ícone visual correspondente ao estágio do contato
- [x] Indicador de "Janela de Indicação Ativa" (se aplicável)

## Página de Configuração do Motor de Regras

- [x] Backend: endpoint para ler configurações do motor de regras por tenant
- [x] Backend: endpoint para salvar configurações do motor de regras por tenant
- [x] Frontend: página ClassificationSettings com formulário de configuração
- [x] Campos configuráveis: threshold de inatividade (dias), janela de indicação (dias)
- [x] Visualização das 9 classificações com explicação de cada regra
- [x] Registrar rota /settings/classification no App.tsx
- [x] Link na página de configurações para acessar a nova página
- [ ] Testes unitários para os endpoints de configuração

## Correções e Melhorias — Onboarding, Pós-Venda, Badge Visual

- [x] Corrigir criação automática dos 2 funis padrão no onboarding de novo tenant
- [ ] Funil de Pós-Venda NÃO contabiliza dados de vendas (separar métricas)
- [x] Funil de Pós-Venda é para gerenciar entrega de viagem, não para vender
- [x] Badge de classificação estratégica mais visual e destacado no card do Kanban
- [x] Registrar rota /settings/classification no App.tsx
- [x] Adicionar link para classificação nas configurações
- [x] Seed dos funis padrão para o tenant existente

## Automação de Tarefas por Etapa do Funil

- [x] Campo dataEmbarque (date) nos deals
- [x] Campo dataRetorno (date) nos deals
- [x] Tabela task_automations (regras de automação de tarefas por etapa)
- [x] Migração SQL para novos campos e tabela
- [x] Motor de automação: ao mover deal para etapa, criar tarefas automaticamente
- [x] Regras de prazo: X dias antes/depois do dia atual, data de embarque ou data de retorno
- [x] Endpoint CRUD para task_automations no crmRouter
- [x] Página de configuração "Automação de Vendas" com UI para criar/editar regras
- [x] Integrar automação no moveStage do crmRouter
- [x] Seed funis padrão para tenants existentes (Aceleradora e Boxtour)

## Vincular Produtos/Serviços ao Formulário de Criação de Negociação

- [x] Adicionar seção de produtos/serviços no formulário de criação de negociação
- [x] Listar produtos cadastrados no sistema para seleção (com busca)
- [x] Permitir adicionar múltiplos produtos com quantidade e valor unitário
- [x] Calcular valor total da negociação automaticamente a partir dos produtos selecionados
- [x] Salvar produtos vinculados (deal_products) ao criar a negociação no backend
- [x] Atualizar valor total do deal (valueCents) com base nos produtos selecionados
- [x] Testes unitários para criação de negociação com produtos vinculados

## Data de Embarque e Data de Retorno nas Negociações

- [x] Adicionar colunas departure_date e return_date na tabela deals (schema + migração SQL)
- [x] Atualizar endpoints create/update deal para aceitar departure_date e return_date
- [x] Adicionar campos Data de Embarque e Data de Retorno no formulário de criação de negociação
- [x] Adicionar campos Data de Embarque e Data de Retorno na página de detalhes da negociação (editável)
- [x] Integrar datas de embarque/retorno no motor de automação de tarefas (calcular prazos com base nessas datas)
- [x] Atualizar página de configuração de automação para permitir regras baseadas em data de embarque/retorno
- [x] Testes unitários para criação/edição de deal com datas e automação integrada

## Reformulação do Dashboard Início - Sincronização em Tempo Real

- [x] KPI Negociações Ativas: contar apenas negociações em andamento do usuário logado
- [x] KPI Contatos: contatos únicos na carteira do usuário, com % de aumento do último mês
- [x] KPI Viagens em Andamento: deals no funil pós-venda exceto etapa "viagem finalizada"
- [x] Foco do Dia: tarefas abertas/atrasadas do dia, ordenadas por execução, sem finalizadas
- [x] Gráfico de Funil Visual: apenas funil de vendas, com cores das etapas, inspirado na imagem
- [x] Cada etapa do funil com cor configurada representada no gráfico
- [x] Percentual de conversão entre etapas no gráfico
- [x] Sincronização em tempo real de todas as informações do dashboard (refetchInterval)
- [x] Backend: endpoint dedicado para KPIs do dashboard com dados filtrados por usuário
- [x] Backend: endpoint para dados do funil de vendas com contagem por etapa
- [x] Testes unitários para os novos endpoints

## Landing Page Pública + Fluxo de Login + Painel Super Admin

- [x] Landing page pública dark no estilo Entur OS como página inicial (/)
- [x] Branding: logo, cores, tipografia do Entur OS na landing
- [x] Botão de Login na landing que redireciona para autenticação
- [x] Roteamento: / = landing pública, /dashboard = sistema autenticado
- [x] Backend: endpoints Super Admin para listar/gerenciar tenants (agências)
- [x] Backend: endpoints Super Admin para listar/gerenciar usuários por tenant
- [x] Frontend: Painel Super Admin com lista de agências e seus usuários
- [x] Acesso ao Super Admin via menu do usuário (dropdown no nome, abaixo de Configurações)
- [x] Apenas isSuperAdmin pode acessar o painel Super Admin
- [x] Testes unitários para endpoints Super Admin

## Funil Padrão + Filtro Em Atendimento + Bug Card Apagado

- [x] Backend: endpoint para salvar/ler funil padrão por usuário (user preferences)
- [x] Frontend: opção de marcar funil como padrão nas configurações ou no seletor de pipeline
- [x] Ao abrir /pipeline, carregar automaticamente o funil padrão do usuário
- [x] Filtro "Em atendimento" como padrão ao abrir a página de negociações
- [x] Otimizar carregamento do Kanban (performance)
- [x] Corrigir bug: card fica apagado/opaco após mover no Kanban (drag-and-drop)
- [x] Card deve ficar totalmente visível e pronto para próximo passo após mover
- [x] Testes unitários para funil padrão e preferências do usuário

## Configuração de Timezone UTC-3

- [x] Criar utilitário centralizado de formatação de datas com timezone America/Sao_Paulo
- [x] Atualizar todas as formatações de data no frontend para usar UTC-3
- [x] Atualizar formatações de data no backend (process.env.TZ = America/Sao_Paulo)
- [x] Garantir que novas datas criadas usem referência UTC-3
- [x] Testes unitários para formatação de datas com timezone (606 passando)

## Correção Card Kanban + Novo Layout
- [x] Corrigir bug: card fica apagado/opaco após mover no Kanban (persistente até refresh)
- [x] Redesenhar DealCard: nome da negociação em destaque
- [x] Redesenhar DealCard: data de criação com ícone de calendário
- [x] Redesenhar DealCard: tarefa pendente com ícone
- [x] Redesenhar DealCard: valor da negociação com ícone
- [x] Redesenhar DealCard: classificação do cliente mais discreta (badge pequeno)
- [x] Redesenhar DealCard: ícone de informação permanece como está
- [x] Layout inspirado na referência visual do CRM (compacto, limpo)

## Nome do Contato no DealCard
- [x] Exibir nome do contato abaixo do título da negociação no card do Kanban

## Funil Padrão em Settings + Dashboard Filtrado

- [x] Página /settings/pipelines: opção de definir um funil como principal/padrão
- [x] Dashboard (Início): gráfico de funil deve puxar apenas dados do funil padrão
- [x] Dashboard (Início): KPIs de pipeline devem usar apenas o funil padrão
- [x] Testes para garantir que dashboard filtra pelo funil padrão

## Correção: Gráficos do Dashboard não atualizam em tempo real com funil padrão

- [x] Diagnosticar por que gráficos não refletem dados do funil padrão em tempo real
- [x] Corrigir queries do dashboard para reagir à mudança de pipelineId
- [x] Garantir que backend retorna dados filtrados corretamente pelo pipelineId

## Filtro de Status no Dashboard + Padrão CRM
- [x] Adicionar filtro de status no Dashboard (Em andamento, Ganho, Perdido, Todos)
- [x] Backend: getDashboardMetrics aceitar parâmetro de status
- [x] Backend: getPipelineSummary aceitar parâmetro de status
- [x] Frontend: botões/tabs de filtro de status no Dashboard
- [x] Padrão: todos os filtros do CRM começam em "Em andamento"
- [x] Aplicar padrão "Em andamento" na página Pipeline/Kanban (já estava 'open')
- [x] Aplicar padrão "Em andamento" na página de Tarefas (alterado de 'all' para 'open')

## Funis Pré-Determinados + Automação Padrão
- [x] Criar funil "Funil de Vendas" com 7 etapas ao registrar novo tenant
- [x] Criar funil "Funil de Pós-Venda" com 7 etapas ao registrar novo tenant
- [x] Etapas do Funil de Vendas: Novo atendimento, Atendimento iniciado, Diagnóstico, Cotação, Apresentação, Acompanhamento, Reserva
- [x] Etapas do Funil de Pós-Venda: Nova venda, Aguardando embarque, 30D para embarque, Pré viagem, Em viagem, Pós viagem, Viagem finalizada
- [x] Automação padrão: ao marcar "ganho" no funil de vendas, criar card no pós-venda etapa 1
- [x] Definir funil de vendas como padrão do tenant

## Bug: Funis padrão não criados ao registrar conta nova
- [x] Investigar se createDefaultPipelines é chamado no fluxo de criação de tenant/conta
- [x] Corrigir para garantir que funis padrão são criados automaticamente (adicionado ao registerTenantAndUser)
- [x] Testar criando uma conta nova e verificar os funis (tenant 120003 criado com sucesso)

## E-mail de Convite + Recuperação de Senha
- [x] Enviar e-mail ao criar convite de novo usuário com link de acesso
- [x] Implementar fluxo de recuperação de senha (esqueci minha senha)
- [x] Backend: endpoint para solicitar reset de senha (gerar token + enviar e-mail)
- [x] Backend: endpoint para redefinir senha com token válido
- [x] Frontend: link "Esqueci minha senha" no formulário de login
- [x] Frontend: página de solicitar reset de senha
- [x] Frontend: página de redefinir senha com token

## Automações de Etapas por Data (Configuráveis)
- [x] Criar tabela date_automations no schema (regras configuráveis por tenant/pipeline)
- [x] Backend: CRUD de automações por data (criar, listar, atualizar, excluir)
- [x] Backend: scheduler/cron que verifica a cada hora e move cards conforme regras
- [x] Lógica: mover card para etapa X quando campo de data estiver a N dias (antes/depois)
- [x] Frontend: página de configuração de automações por data em /settings/date-automations
- [x] Frontend: formulário para criar/editar regras (selecionar pipeline, campo de data, condição, etapa destino)
- [x] Frontend: lista de automações ativas com toggle de ativar/desativar
- [ ] Criar automações padrão de pós-venda ao registrar novo tenant (pendente)
- [x] Testes para validar a lógica de movimentação automática

## Correções WhatsApp API
- [x] Bug: Área de chat na negociação não responsiva e some ao rolar a tela (fixar posição)
- [x] Bug: Status de mensagens não sincroniza enviada/recebida/lida com WhatsApp (adicionado lastStatusUpdate ao WhatsAppChat)
- [x] Bug: Inbox não sincronizado como WhatsApp Web (adicionado waContactsMap para resolver LIDs)
- [x] Bug: Contatos não salvos aparecem com números aleatórios (LID JIDs resolvidos via wa_contacts table + Baileys contacts.upsert)

## Botão Sincronizar Contatos WhatsApp
- [x] Criar endpoint backend para forçar sincronização de contatos do WhatsApp
- [x] Adicionar botão no Inbox para disparar a sincronização manualmente
- [x] Escrever testes unitários para o endpoint syncContacts (10 testes passando)
- [x] Testar visualmente no browser a sincronização de contatos
- [x] Garantir que contatos sincronizados resolvam LID JIDs corretamente (cross-reference por pushName)

## Correção: Rolagem e Responsividade do Chat na Negociação
- [x] Manter botões "Chat ao vivo" e "Histórico da conversa" sempre visíveis (sticky)
- [x] Corrigir rolagem da conversa ao vivo dentro da negociação
- [x] Garantir responsividade do painel de chat

## Super Admin: Exclusão Completa de Contas (Tenants)
- [x] Mapear todas as tabelas do banco vinculadas a tenant_id (71 tabelas com tenantId + 10 vinculadas por sessionId)
- [x] Criar endpoint backend protegido (super admin only) para deletar tenant e todos os dados
- [x] Implementar exclusão em cascata respeitando ordem de dependências (FKs) - 6 fases
- [x] Adicionar botão de exclusão na interface do super admin com confirmação dupla (nome da agência)
- [x] Escrever testes unitários para o endpoint de exclusão (10 testes passando)
- [x] Testar visualmente no browser a exclusão de conta (testado com agência Teste Funis Co)
- [x] Corrigir tabela activity_logs (usa sessionId, não tenantId)

## Matriz RFV — Classificação Automática de Contatos

### Schema & Banco de Dados
- [x] Criar tabela rfv_contacts com campos RFV, audience_type, flags, scores
- [x] Criar tabela contact_action_logs para histórico de ações
- [x] Executar migrações SQL

### Backend — Cálculos e Classificação
- [x] Implementar lógica de cálculo RFV (R, F, V scores)
- [x] Implementar regras de classificação em 9 públicos (ordem obrigatória)
- [x] Implementar flags visuais (Potencial Indicador, Risco Ex Cliente, Abordagem Não Cliente)
- [x] Endpoint tRPC: listar contatos RFV com paginação, busca, filtros e ordenação
- [x] Endpoint tRPC: dashboard KPIs (Total Contatos, Receita Total, Oportunidades, Conversão Média)
- [x] Endpoint tRPC: alerta dinheiro parado (contatos sem ação há 7+ dias)
- [x] Endpoint tRPC: recalcular RFV para todos os contatos de um tenant (batch insert otimizado)
- [x] Endpoint tRPC: reset agency data (deletar contatos por lotes)

### Frontend — Dashboard e Listagem
- [x] Página RFV com dashboard de KPIs no topo (2119 contatos, R$ 519.712,30)
- [x] Listagem paginada (50 por página) com busca por nome
- [x] Filtro por audience_type (clicável nos badges de distribuição)
- [x] Ordenação por valor, compras, recência, conversão, atendimentos
- [x] Badge de conversão (alta >= 50%, média >= 20%, baixa < 20%)
- [x] Link WhatsApp normalizado (55 + telefone)
- [x] Flags visuais nos cards/linhas dos contatos

### Importação CSV
- [x] Upload e parsing de CSV
- [x] Mapeamento de colunas (Nome, Email, Telefone, Valor, Estado, Data fechamento, Data criação)
- [x] Normalização de estados (em andamento/aberto/open, perdido/perdida/lost, vendido/ganho/won)
- [x] Agrupamento por pessoa (dedupe por phone > email > nome)
- [x] Upsert (buscar existente por email/phone/nome, update ou insert)
- [x] Recálculo RFV após importação

### Alerta Dinheiro Parado
- [x] Condição: last_action_date >= 7 dias
- [x] Mostrar quantidade contatos, valor potencial, distribuição por público

### Navegação
- [x] Adicionar item "RFV" no menu principal entre Inbox e Análises
- [x] Registrar rota /rfv no App.tsx

### Testes
- [x] Testes unitários para cálculos RFV e classificação (39 testes passando)
- [x] Testes unitários para endpoints tRPC
- [x] Teste visual no browser (2119 contatos carregados com sucesso)

## Ações em Massa — Envio de Mensagens Template WhatsApp
- [x] Analisar código existente de envio de mensagens e templates WhatsApp
- [x] Criar endpoint backend para envio em massa com fila e rate-limit (delay configurável 2-30s)
- [x] Implementar seleção múltipla de contatos na Matriz RFV (checkbox individual + selecionar todos)
- [x] Barra de ações flutuante com contagem de selecionados e botão "Enviar WhatsApp"
- [x] Modal de composição: campo de texto com 6 variáveis dinâmicas ({nome}, {primeiro_nome}, {email}, {telefone}, {publico}, {valor})
- [x] Pré-visualização da mensagem com dados de exemplo
- [x] Barra de progresso em tempo real durante o envio em massa
- [x] Relatório de envio: sucesso, falha, sem telefone
- [x] Escrever testes unitários para o endpoint de envio em massa (15 testes passando)
- [x] Testar visualmente no browser (modal, seleção, variáveis, pré-visualização)

## Filtros Inteligentes na Matriz RFV
### Filtros por Regra de Negócio
- [x] Potencial Ex Cliente: rScore BETWEEN 250-350 e fScore > 0
- [x] Potencial Indicador: lastPurchaseAt >= 30 dias atrás
- [x] Potencial Indicador Pós Viagem: JOIN com deals.returnDate, 30 dias após retorno
- [x] Potencial Indicador Fiel: fScore > 1 (mais de 1 compra)
- [x] Abordagem Não Cliente: JOIN com deals perdidos nos últimos 90 dias

### Filtros por Público
- [x] Filtro visual clicável para cada público na Matriz RFV (dropdown + badges de distribuição)

### Backend
- [x] Queries SQL com regras de data/compra para cada filtro inteligente (getSmartFilterCounts)
- [x] Endpoint tRPC para listar contatos por filtro inteligente (smartFilter param no list)
- [x] Contagem de contatos por filtro para exibição nos badges (smartFilterCounts endpoint)

### Frontend
- [x] Seção de filtros inteligentes com 5 cards coloridos e contagem
- [x] Integração com listagem existente (paginação, busca, ordenação mantidos)
- [x] Ícones e cores distintas para cada filtro (Clock/orange, Heart/green, Plane/sky, Award/purple, UserX/red)

### Testes
- [x] Testes unitários para as regras de cada filtro (20 testes passando)
- [x] Teste visual no browser (5 filtros renderizados corretamente, dados vazios pois deals foram limpos)

## Sistema de Notificações RFV

### Schema e Backend
- [x] Reutilizar sistema de notificações existente (tabela notifications com tipo rfv_filter_alert)
- [x] Criar tabela rfv_filter_snapshots para rastrear contagens anteriores dos filtros
- [x] Implementar lógica de detecção de novos contatos comparando snapshots (checkTenantRfvFilters)
- [x] Implementar job periódico a cada 6 horas (rfvNotificationScheduler)
- [x] Endpoint tRPC: checkNotifications (verificação manual)
- [x] Endpoint tRPC: filterSnapshots (estado atual dos snapshots)
- [x] Reutilizar endpoints existentes: notifications.list, markRead, unreadCount
- [x] Corrigir query tenants: usar status='active' em vez de isActive

### Frontend
- [x] Botão "Verificar Alertas" no header da página RFV
- [x] Tipo rfv_filter_alert na página de Notificações com ícone TrendingUp laranja
- [x] Cada notificação mostra: filtro, quantidade de novos contatos, descrição
- [x] Clique na notificação redireciona para /rfv?filter={filterKey}
- [x] Badge de notificações não lidas no sino da TopNav (sistema existente)

### Testes
- [x] Testes unitários para lógica de detecção de novos contatos (15 testes passando)
- [x] Testes unitários para geração de mensagens de notificação
- [x] Teste visual no browser (botão Verificar Alertas funcional, mutation retorna corretamente)

## Bug: Senha do Admin Master Resetada ao Alterar Sistema
- [x] Identificar causa: tenant e usuário foram excluídos durante teste de deleteTenantCompletely (não era bug de código, mas falta de proteção)
- [x] Recriar tenant Entur (id: 150002) com plano enterprise e status active
- [x] Recriar usuário Bruno (id: 150001) com email bruno@entur.com.br e senha Bruna2016*
- [x] Criar pipelines padrão (Funil de Vendas + Funil de Pós-Venda) com 14 etapas e automação
- [x] Criar subscription enterprise para o tenant
- [x] Testar login no browser com sucesso

## Proteção contra Exclusão do Super Admin
- [x] Adicionar verificação em deleteTenantCompletely: bloqueia exclusão se tenant contém super admin
- [x] Adicionar verificação no router: bloqueia exclusão do próprio tenant do super admin
- [x] 12 testes unitários passando em deleteTenant.test.ts (incluindo 2 novos testes de proteção)

## Reconstrução Completa da Landing Page — CRM Acelerador de Agências

### Seções 1-4
- [x] Hero Section: 2 colunas, headline sobre perda de vendas, mockup CRM, CTAs, prova social 8000 agentes
- [x] Diagnóstico Interativo (Quiz): 5 checkboxes, resultado dinâmico, CTA
- [x] Seção do Inimigo: desorganização comercial como vilão invisível
- [x] Seção de Revelação: padrão dos 8000 agentes, falta de processo

### Seções 5-8
- [x] Introdução da Solução: CRM Acelerador + mockup grande
- [x] Como Funciona: 3 cards (visualizar negociações, follow-up, transformar atendimentos)
- [x] Calculadora de Dinheiro Perdido: inputs + cálculo + valor estimado perdido
- [x] Mapa de Vazamento de Vendas: funil interativo com perdas entre etapas

### Seções 9-12
- [x] Benchmark Agência vs Mercado: gráfico de barras comparativo
- [x] Simulador de Crescimento 12 meses: gráfico linha dupla com/sem CRM
- [x] Relatório Automático: formulário lead capture (nome, email, WhatsApp)
- [x] Modo Auditoria (Score 0-100): 5 perguntas, gauge/velocímetro, classificação

### Seções 13-16
- [x] Prova Social: 3 depoimentos com foto, nome, cidade, resultado
- [x] Diferencial: turismo-específico (planejamento, família, datas, emoção)
- [x] Demonstração: seção com vídeo placeholder
- [x] CTA Final: "Pare de perder vendas silenciosas"

### Elementos de Conversão
- [x] CTA a cada 2 seções (SectionCTA entre cada 2 seções)
- [x] Sticky CTA mobile (StickyCTA component)
- [x] Scroll animations suaves (FadeIn + motion/react)
- [x] Cards com microinterações (hover effects, gradients)
- [x] Layout escaneável mobile-first (responsive design)
- [x] Design inspirado em Stripe/Linear/Apple (dark theme, tipografia grande, gradientes)

## Adaptação LP — ENTUR OS (alterações mínimas)
- [x] Ajustar headline do Hero para novo texto
- [x] Inserir simulador simples abaixo do Hero (1 input + 1 botão + resultado dinâmico)
- [x] Conectar resultado com texto sobre Matriz RFV do ENTUR OS
- [x] CTA final do simulador: "Quero recuperar essas vendas"
- [x] Substituir todas as referências "CRM Acelerador" / "CRM ACELERADOR" por "ENTUR OS"

## Remoção de Módulos da LP
- [x] Remover Diagnóstico rápido da sua agência (DiagnosticQuiz)
- [x] Remover Calculadora de Dinheiro Perdido (MoneyCalculator)
- [x] Remover Mapa de Vazamento de Vendas (FunnelMap)
- [x] Remover Benchmark Agência vs Mercado (BenchmarkSection)
- [x] Remover Simulador de Crescimento 12 meses (GrowthSimulator)
- [x] Remover Auditoria Comercial (AuditScore)
- [x] Remover CTAs intermediários associados aos módulos removidos

## Seção de Planos + Remoção do Formulário de Diagnóstico
- [x] Remover ReportForm (formulário de diagnóstico) da LP
- [x] Criar seção de Planos com 3 tiers: Basic (R$67), Pro (R$97), Enterprise (sob consulta)
- [x] Basic: tudo do Pro menos automações, 1 usuário
- [x] Pro: inclui automações, até 4 usuários, +R$97 por usuário adicional
- [x] Enterprise: popup com formulário para solicitar atendimento
- [x] Substituir FinalCTA pela seção de planos
- [x] Atualizar CTAs da LP para apontar para a seção de planos

## Layout Escuro nas Páginas de Login e Cadastro
- [x] Ajustar página de Login para fundo preto (#0a0a12) igual à LP
- [x] Ajustar página de Cadastro para fundo preto (#0a0a12) igual à LP

## Recurso: Negociações Esfriando (Cooling Deals)
- [x] Adicionar campos cooling_enabled e cooling_days na tabela pipeline_stages
- [x] Criar procedure para atualizar configuração de cooling por etapa
- [x] Retornar info de cooling nas queries de deals/pipeline
- [x] Criar UI de configuração nas settings do funil (toggle + input dias por etapa)
- [x] Implementar destaque visual amarelo nos cards do pipeline para deals esfriando
- [x] Testar configuração e destaque visual

## Celebração de Venda (Yabba-Dabba-Doo)
- [x] Encontrar o ponto de marcação de venda no pipeline (status "won")
- [x] Baixar áudio "Yabba-Dabba-Doo" estilo Flintstones
- [x] Upload do áudio para CDN
- [x] Criar componente SaleCelebration com popup, confetes canvas e áudio
- [x] Integrar ao DealDetail.tsx (handleMarkWon)
- [x] Integrar ao Pipeline.tsx DealDrawer (status change para won via custom event)
- [x] Testar celebração no browser — popup YABBA-DABBA-DOO aparece com confetes e áudio ao confirmar venda

## Estabilidade WhatsApp + Alerta API Não Oficial
- [x] Analisar motor Baileys: identificar causas de desconexão rápida
- [x] Implementar reconnect automático com backoff exponencial (15 tentativas, 3s-2min)
- [x] Melhorar config do socket: keepAlive 25s, connectTimeout 30s, queryTimeout 2min
- [x] Adicionar heartbeat/keepalive otimizado (keepAliveIntervalMs: 25000)
- [x] Tratar eventos de desconexão: loggedOut (limpa sessão), badSession (limpa auth), banned (403), max retries (notificação)
- [x] Adicionar alerta/disclaimer de API não oficial: no dialog de conexão + banner permanente na aba Sessões
- [x] Testar estabilidade da conexão — alerta visível na aba Sessões + no dialog de conexão

## Reverter Negociação Ganha/Perdida para Em Andamento
- [x] Adicionar botão "Reabrir negociação" quando deal status é won ou lost
- [x] Implementar lógica de reverter status para open (backend já suportava, limpa lossReasonId/lossNotes)
- [x] Testar reversão de venda ganha — deal voltou para "Aberta" com pipeline visível e histórico registrado (won → open)

## Reestruturação WhatsApp — Conexão Persistente (dias)
- [x] Analisar código completo do whatsapp.ts e identificar causas de desconexão
- [x] Persistir auth state no banco de dados (não apenas em memória/arquivo)
- [x] Implementar heartbeat robusto com health check periódico (5min) verificando WebSocket readyState
- [x] Reconnect inteligente com backoff exponencial infinito (1.5x, 3s-5min, jitter) — NUNCA desiste
- [x] Evitar reconexões desnecessárias (tratar connection.update parcial corretamente)
- [x] Implementar session recovery sem perder auth credentials (auto-restore no startup do servidor)
- [x] Adicionar logging detalhado de eventos de conexão para diagnóstico (uptime, health checks)
- [x] Tratar gracefully: network drops (428/408/503/515 = reconexão imediata), server restarts (auto-restore), fatal (401/403 = cleanup)
- [x] Otimizar config: keepAlive 30s, queryTimeout DISABLED, connectTimeout 45s, Desktop browser, markOnline false
- [x] Testar compilação e estabilidade (41 testes passando)

## Bug Fix: RFV Envio em Massa mostra "WhatsApp desconectado"
- [x] Investigar como o componente de envio em massa verifica o status do WhatsApp
- [x] Corrigir a lógica de detecção de status para funcionar corretamente com sessões conectadas
- [x] Implementar auto-reconnect quando DB diz "connected" mas memória não tem sessão
- [x] Adicionar estado "reconectando" com spinner no dialog
- [x] Adicionar polling automático (3s) enquanto dialog está aberto e sessão não conectada
- [x] Testar que o dialog mostra "conectado" quando há sessão ativa

## Bug Fix DEFINITIVO: RFV Envio em Massa — WhatsApp sempre desconectado (RESOLVIDO)
- [x] Rastrear fluxo completo: DB → getActiveSessionForTenant → tRPC → frontend
- [x] Causa raiz: tenantId mismatch (sessão salva com tenantId=1, query buscava tenantId=150002)
- [x] Corrigir connect() para aceitar e salvar tenantId correto
- [x] Corrigir updateSessionDb para persistir tenantId
- [x] Corrigir autoRestoreSessions para NÃO marcar como disconnected quando auth files não existem
- [x] Criar getSessionsByTenant() em db.ts
- [x] Corrigir sessions procedure em routers.ts para buscar por tenantId para SaaS users
- [x] Atualizar registro existente no DB para tenantId correto
- [x] Escrever 10 testes unitários para validar a correção (rfvActiveSession.test.ts)
- [x] Todos os testes passando (774 de 777, 3 falhas pré-existentes)
