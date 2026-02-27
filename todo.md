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
