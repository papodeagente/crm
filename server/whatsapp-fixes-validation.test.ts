/**
 * Suite E2E de validação dos fixes recentes (Fase 2 do plano).
 *
 * Escopo: provar que as correções aplicadas estão presentes no código E
 * que a lógica está correta. Cada teste cobre um sintoma reportado pelo
 * Bruno e o fix correspondente.
 *
 * NÃO chama Z-API real (isso é a Fase 3). Aqui validamos o código.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf-8");

describe("[T1] Webhook inbound → mensagem + entra na fila", () => {
  const normalizer = read("server/providers/zapiWebhookNormalizer.ts");
  const resolver = read("server/conversationResolver.ts");
  const dbFile = read("server/db.ts");

  it("normalizer mapeia on-message-received → messages.upsert", () => {
    expect(normalizer).toMatch(/case "on-message-received":\s*\{[\s\S]*?event:\s*"messages\.upsert"/);
  });

  it("resolveConversation no INSERT seta queuedAt = NOW para nova conversa", () => {
    expect(resolver).toMatch(/db\.insert\(waConversations\)\.values\(\{[\s\S]*?queuedAt:\s*new Date\(\)/);
  });

  it("getQueueConversations NÃO exige unreadCount>0 (bug antigo)", () => {
    const queueFn = dbFile.match(/export async function getQueueConversations[\s\S]*?^\}/m)?.[0] || "";
    expect(queueFn).toBeTruthy();
    // Não pode ter o filtro restritivo antigo
    expect(queueFn).not.toMatch(/unreadCount"\s*>\s*0\s+OR\s+wc\."queuedAt"\s+IS\s+NOT\s+NULL/);
    // Deve ter EXISTS messages como filtro anti-ghost
    expect(queueFn).toMatch(/EXISTS\s*\(\s*SELECT 1 FROM messages m/);
  });

  it("getQueueConversations filtra por assignedUserId IS NULL e status open/pending", () => {
    const queueFn = dbFile.match(/export async function getQueueConversations[\s\S]*?^\}/m)?.[0] || "";
    expect(queueFn).toMatch(/wc\."assignedUserId"\s+IS\s+NULL/);
    expect(queueFn).toMatch(/wc\.status\s+IN\s*\(\s*'open',\s*'pending'\s*\)/);
  });

  it("getQueueConversations exclui archived e merged", () => {
    const queueFn = dbFile.match(/export async function getQueueConversations[\s\S]*?^\}/m)?.[0] || "";
    expect(queueFn).toMatch(/"isArchived"\s*=\s*false/);
    expect(queueFn).toMatch(/"mergedIntoId"\s+IS\s+NULL/);
  });
});

describe("[T2] Status update — RECEIVED, READ, READ-SELF mapeados", () => {
  const worker = read("server/messageWorker.ts");

  it("STRING_STATUS_MAP mapeia RECEIVED → delivered (Z-API real)", () => {
    expect(worker).toMatch(/"RECEIVED":\s*"delivered"/);
  });

  it("STRING_STATUS_MAP mapeia READ-SELF → read (multi-device)", () => {
    expect(worker).toMatch(/"READ-SELF":\s*"read"/);
  });

  it("STRING_STATUS_MAP mapeia VIEWED e PLAYED-SELF (variantes Z-API)", () => {
    expect(worker).toMatch(/"VIEWED":\s*"read"/);
    expect(worker).toMatch(/"PLAYED-SELF":\s*"played"/);
  });

  it("Loga aviso quando status string desconhecido aparece", () => {
    expect(worker).toMatch(/Unknown status string/);
  });

  it("Mantém enforcement monotônico (não permite regressão de status)", () => {
    expect(worker).toMatch(/STATUS_ORDER:\s*Record<string,\s*number>\s*=\s*\{[\s\S]*?error:\s*0[\s\S]*?played:\s*5/);
    expect(worker).toMatch(/Status update SKIPPED \(monotonic\)/);
  });

  it("Numeric status map preserva equivalência", () => {
    expect(worker).toMatch(/0:\s*"error"[\s\S]*?5:\s*"played"/);
  });
});

describe("[T3] Envio outbound + identificação do atendente (negrito acima da msg)", () => {
  const evo = read("server/whatsappEvolution.ts");
  const routers = read("server/routers.ts");

  it("applyAgentNamePrefix faz lookup do nome do agente em crm_users", () => {
    expect(evo).toMatch(/private async applyAgentNamePrefix/);
    expect(evo).toMatch(/SELECT name FROM crm_users WHERE id = \$\{senderAgentId\}/);
  });

  it("applyAgentNamePrefix gera formato '*Nome*\\nmensagem' (negrito + linha nova)", () => {
    // Formato WhatsApp: *texto* = negrito; \n = quebra de linha → nome em linha própria.
    expect(evo).toMatch(/return\s+`\*\$\{fullName\}\*\\n\$\{text\}`/);
  });

  it("applyAgentNamePrefix NÃO usa mais template de tags ({nome}/{primeiroNome})", () => {
    const fn = evo.match(/private async applyAgentNamePrefix[\s\S]*?\n  \}/)?.[0] || "";
    expect(fn).not.toMatch(/\{nome\}/);
    expect(fn).not.toMatch(/\{primeiroNome\}/);
    expect(fn).not.toMatch(/agentNameTemplate/);
  });

  it("sendTextMessage chama applyAgentNamePrefix antes de enviar", () => {
    const fn = evo.match(/async sendTextMessage[\s\S]*?const number = this\.jidToNumber/m)?.[0] || "";
    expect(fn).toMatch(/applyAgentNamePrefix\(sessionId,\s*text,\s*senderAgentId\)/);
  });

  it("sendMediaMessage aplica prefixo na caption (não cria caption se vazia)", () => {
    expect(evo).toMatch(/if \(caption\)\s*\{\s*caption = await this\.applyAgentNamePrefix/);
  });

  it("sendTextWithQuote também aplica prefixo", () => {
    const fn = evo.match(/async sendTextWithQuote[\s\S]*?zapiProvider\.sendTextWithQuote/)?.[0] || "";
    expect(fn).toMatch(/applyAgentNamePrefix\(sessionId,\s*text,\s*senderAgentId\)/);
  });

  it("Endpoint tRPC saveAgentNameSettings persiste apenas showAgentNamePrefix (sem template)", () => {
    expect(routers).toMatch(/saveAgentNameSettings:[\s\S]*?showAgentNamePrefix:\s*input\.showAgentNamePrefix/);
    // Não pode mais aceitar/persistir template
    const fn = routers.match(/saveAgentNameSettings:[\s\S]*?return\s*\{\s*success:\s*true\s*\}/)?.[0] || "";
    expect(fn).not.toMatch(/agentNameTemplate/);
  });

  it("Endpoint tRPC getAgentNameSettings retorna apenas showAgentNamePrefix", () => {
    expect(routers).toMatch(/getAgentNameSettings:[\s\S]*?return\s*\{\s*showAgentNamePrefix:\s*row\?\.showAgentNamePrefix\s*\?\?\s*false/);
    const fn = routers.match(/getAgentNameSettings:[\s\S]*?\}\),/)?.[0] || "";
    expect(fn).not.toMatch(/agentNameTemplate:\s*row/);
  });
});

describe("[T4] Merge LID ↔ phone (dedup proativo)", () => {
  const identity = read("server/identityResolver.ts");

  it("backgroundResolveExtras procura conversas LID pendentes", () => {
    expect(identity).toMatch(/SELECT id, "sessionId", "remoteJid"[\s\S]*?FROM wa_conversations[\s\S]*?"remoteJid"\s*=\s*\$\{lidJid\}\s+OR\s+"chatLid"\s*=\s*\$\{lidJid\}/);
  });

  it("Merge: reatribui mensagens da LID conv para canônica", () => {
    expect(identity).toMatch(/UPDATE messages SET "waConversationId" = \$\{canonical\.id\} WHERE "waConversationId" = \$\{lidRow\.id\}/);
  });

  it("Merge: marca conversa LID como mergedIntoId apontando pra canônica", () => {
    expect(identity).toMatch(/SET "mergedIntoId" = \$\{canonical\.id\}, status = 'closed'/);
  });

  it("Reatribui também deals (waConversationId)", () => {
    expect(identity).toMatch(/UPDATE deals SET "waConversationId" = \$\{canonical\.id\}/);
  });

  it("Caso sem canônica: popula phoneE164 na própria LID conv", () => {
    expect(identity).toMatch(/UPDATE wa_conversations SET "phoneE164" = \$\{phoneE164\}\s+WHERE id = \$\{lidRow\.id\}/);
  });

  it("normalizeChatLid garante sufixo @lid", () => {
    const resolver = read("server/conversationResolver.ts");
    expect(resolver).toMatch(/chatLid\.includes\("@"\)\s*\?\s*chatLid\s*:\s*`\$\{chatLid\.replace\(\/\\D\/g,\s*""\)\}@lid`/);
  });
});

describe("[T5] Health check + reconciliation Z-API", () => {
  const sched = read("server/whatsappSessionStatusScheduler.ts");

  it("Scheduler polla Z-API a cada 2 min", () => {
    expect(sched).toMatch(/CHECK_INTERVAL_MS\s*=\s*2\s*\*\s*60\s*\*\s*1000/);
  });

  it("Reconcile dispara notification em qualquer transição", () => {
    expect(sched).toMatch(/createNotification\([\s\S]*?type:\s*"whatsapp_disconnected"/);
    expect(sched).toMatch(/createNotification\([\s\S]*?type:\s*"whatsapp_connected"/);
  });

  it("Não toca DB se Z-API não responder (timeout 10s)", () => {
    expect(sched).toMatch(/setTimeout\(\(\)\s*=>\s*controller\.abort\(\),\s*10_000\)/);
    expect(sched).toMatch(/if \(!live\) return;/);
  });

  it("Considera apenas online se ambos connected E smartphoneConnected", () => {
    expect(sched).toMatch(/const isLiveConnected = live\.connected && live\.smartphoneConnected/);
  });

  it("Boot inicia worker com delay (deixa app subir antes)", () => {
    expect(sched).toMatch(/setTimeout\(\(\)\s*=>\s*runWhatsAppStatusSweep[\s\S]*?30_000\)/);
  });
});

describe("[Bonus] Conformidade Z-API aplicada", () => {
  const provider = read("server/providers/zapiProvider.ts");
  const queue = read("server/messageQueue.ts");
  const webhooks = read("server/webhookRoutes.ts");

  it("zapiFetch usa HTTPS keep-alive Agent", () => {
    expect(provider).toMatch(/zapiHttpsAgent\s*=\s*new HttpsAgent/);
    expect(provider).toMatch(/keepAlive:\s*true/);
    expect(provider).toMatch(/agent:\s*zapiHttpsAgent/);
  });

  it("messageQueue concorrência aumentada para 15", () => {
    expect(queue).toMatch(/concurrency:\s*15/);
  });

  it("PII redact em logs (telefone reduzido)", () => {
    expect(webhooks).toMatch(/safePhone\s*=\s*body\?\.phone\s*\?\s*`\$\{String\(body\.phone\)\.substring\(0,\s*4\)\}\*\*\*`/);
  });

  it("zapiFetch redact tokens em mensagens de erro", () => {
    expect(provider).toMatch(/REDACTED/);
    expect(provider).toMatch(/rawText\.replace/);
  });

  it("UNIQUE constraint impede sessão duplicada por (tenant,user)", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toMatch(/uniqueIndex\("ws_tenant_user_unique"\)\.on\(t\.tenantId,\s*t\.userId\)/);
  });
});

describe("[Inbox] Badge da Fila bate com a lista (mesmos filtros)", () => {
  const dbFile = read("server/db.ts");

  // Conjunto de filtros que define "estar na fila" — fonte única de verdade.
  // Se algum dia for preciso mudar, mude TUDO de uma vez (count + list +
  // este teste). Evita o bug do "99+" com lista vazia (ghost rows).
  const requiredFilters = [
    /AND wc\."mergedIntoId" IS NULL/,
    /AND wc\."isArchived" = false/,
    /AND wc\."assignedUserId" IS NULL/,
    /AND wc\.status IN \('open', 'pending'\)/,
    /AND EXISTS \(\s*SELECT 1 FROM messages m\s*WHERE m\."sessionId" = wc\."sessionId"\s*AND m\."remoteJid" = wc\."remoteJid"\s*\)/,
  ];

  it("getQueueConversations (LIST) usa todos os filtros canônicos", () => {
    const fn = dbFile.match(/export async function getQueueConversations[\s\S]*?^}/m)?.[0] || "";
    expect(fn).toBeTruthy();
    for (const re of requiredFilters) {
      expect(fn).toMatch(re);
    }
  });

  it("getQueueStats (COUNT + items) usa todos os filtros canônicos", () => {
    const fn = dbFile.match(/export async function getQueueStats[\s\S]*?^}/m)?.[0] || "";
    expect(fn).toBeTruthy();
    // O count e a lista de items dentro de getQueueStats devem ambos satisfazer.
    // Cada filtro precisa aparecer pelo menos 2x (count + items).
    for (const re of requiredFilters) {
      const matches = fn.match(new RegExp(re.source, "g"));
      expect(matches, `filtro ${re} deve aparecer 2x em getQueueStats (count + items)`).toBeTruthy();
      expect(matches!.length, `filtro ${re} aparece ${matches?.length}x em getQueueStats — esperado 2`).toBeGreaterThanOrEqual(2);
    }
  });

  it("getQueueStats NÃO usa o filtro legado restritivo que causava o bug do 99+", () => {
    const fn = dbFile.match(/export async function getQueueStats[\s\S]*?^}/m)?.[0] || "";
    // Filtro antigo: '(wc."unreadCount" > 0 OR wc."queuedAt" IS NOT NULL)'.
    // Foi removido da list em fix anterior; o stats ficou pra trás.
    expect(fn).not.toMatch(/wc\."unreadCount" > 0 OR wc\."queuedAt" IS NOT NULL/);
  });
});

describe("[DealDetail] Datas do Serviço espelham na agenda (sem botão redundante)", () => {
  const dealDetail = read("client/src/pages/DealDetail.tsx");
  const crmRouter = read("server/routers/crmRouter.ts");
  const agendaSvc = read("server/services/agendaService.ts");

  it("Botão 'Consulta' foi removido do DealDetail (redundância eliminada)", () => {
    expect(dealDetail).not.toMatch(/<span>Consulta<\/span>/);
    expect(dealDetail).not.toMatch(/AppointmentDialog/);
    expect(dealDetail).not.toMatch(/appointmentDialogOpen/);
  });

  it("Service: syncDealServiceDates upsert/soft-delete por dealId+serviceType", () => {
    expect(agendaSvc).toMatch(/export async function syncDealServiceDates/);
    // Identificadores que distinguem auto-criados dos manuais
    expect(agendaSvc).toMatch(/SERVICE_TYPE_APPT\s*=\s*"deal_appointment"/);
    expect(agendaSvc).toMatch(/SERVICE_TYPE_FOLLOWUP\s*=\s*"deal_followup"/);
    // Soft-delete quando data é nula
    expect(agendaSvc).toMatch(/SET "deletedAt" = NOW\(\)/);
    // Upsert
    expect(agendaSvc).toMatch(/INSERT INTO crm_appointments/);
  });

  it("Router crm.deals.update chama syncDealServiceDates ao tocar nas datas", () => {
    // Não dá pra confundir com outros 'update:' do arquivo: a string só
    // aparece no bloco da deals.update (única referência no router).
    expect(crmRouter).toMatch(/appointmentDate !== undefined \|\| followUpDate !== undefined/);
    expect(crmRouter).toMatch(/syncDealServiceDates\(tenantId,/);
  });

  it("Router crm.deals.create também sincroniza quando há datas", () => {
    expect(crmRouter).toMatch(/Se a negociação nasceu já com Datas do Serviço[\s\S]{0,500}syncDealServiceDates/);
  });
});

describe("[Agenda] 4 gatilhos de status (Confirmar/Concluir/Falta/Cancelar) + relatório", () => {
  const routers = read("server/routers.ts");
  const analyticsRouter = read("server/routers/analyticsRouter.ts");
  const analyticsSvc = read("server/crmAnalytics.ts");
  const tab = read("client/src/components/contact-profile/AgendamentosTab.tsx");
  const agendaPage = read("client/src/pages/Agenda.tsx");
  const reportPage = read("client/src/pages/AppointmentAnalytics.tsx");
  const app = read("client/src/App.tsx");

  it("Servidor: mutation agenda.markNoShowAppointment cria status no_show", () => {
    expect(routers).toMatch(/markNoShowAppointment:\s*tenantWriteProcedure[\s\S]*?status:\s*"no_show"/);
  });

  it("AgendamentosTab tem os 4 botões: Confirmar / Concluir / Falta / Cancelar", () => {
    expect(tab).toMatch(/confirmMut/);
    expect(tab).toMatch(/completeMut/);
    expect(tab).toMatch(/cancelMut/);
    expect(tab).toMatch(/noShowMut/);
    expect(tab).toMatch(/markNoShowAppointment/);
    // Botões na UI
    expect(tab).toMatch(/Confirmar/);
    expect(tab).toMatch(/Concluir/);
    expect(tab).toMatch(/Falta/);
    expect(tab).toMatch(/Cancelar/);
  });

  it("Página /agenda modal tem botão Falta além dos 3 existentes", () => {
    expect(agendaPage).toMatch(/noShowMut\s*=\s*trpc\.agenda\.markNoShowAppointment/);
    expect(agendaPage).toMatch(/Falta/);
  });

  it("Servidor: procedure crmAnalytics.appointmentVendings exposta", () => {
    expect(analyticsRouter).toMatch(/appointmentVendings:\s*tenantProcedure/);
    expect(analyticsRouter).toMatch(/getAppointmentsAnalytics/);
  });

  it("Service: getAppointmentsAnalytics correlaciona crm_appointments e deals (won/lost) via dealId", () => {
    expect(analyticsSvc).toMatch(/export async function getAppointmentsAnalytics/);
    expect(analyticsSvc).toMatch(/LEFT JOIN deals d ON d\.id = ca\."dealId"/);
    expect(analyticsSvc).toMatch(/d\.status = 'won'/);
    expect(analyticsSvc).toMatch(/noShowRecoveredCount/);
    // KPIs operacionais e comerciais
    expect(analyticsSvc).toMatch(/attendanceRate/);
    expect(analyticsSvc).toMatch(/noShowRate/);
    expect(analyticsSvc).toMatch(/conversionRate/);
    expect(analyticsSvc).toMatch(/wonRevenueCents/);
    expect(analyticsSvc).toMatch(/potentialLossCents/);
  });

  it("Front: página AppointmentAnalytics consome a procedure e tem narrativa de gestor sênior", () => {
    expect(reportPage).toMatch(/trpc\.crmAnalytics\.appointmentVendings\.useQuery/);
    expect(reportPage).toMatch(/Diagnóstico do gestor/);
    expect(reportPage).toMatch(/Próximas ações/);
    // KPIs presentes
    expect(reportPage).toMatch(/Comparecimento/);
    expect(reportPage).toMatch(/No-show/);
    expect(reportPage).toMatch(/Conversão pós-consulta/);
    expect(reportPage).toMatch(/Recovery de no-show/);
  });

  it("App.tsx registra rota /analytics/appointments", () => {
    expect(app).toMatch(/Route path="\/analytics\/appointments"/);
  });
});

describe("[Agenda] Caixa única (AppointmentDialog) com inline-create em todos os pontos", () => {
  const home = read("client/src/pages/Home.tsx");
  const widget = read("client/src/components/home/HomeAgendaWidget.tsx");
  const dialog = read("client/src/components/agenda/AppointmentDialog.tsx");
  const calendar = read("client/src/components/AgendaCalendar.tsx");
  const tab = read("client/src/components/contact-profile/AgendamentosTab.tsx");
  const header = read("client/src/components/chat/ChatHeader.tsx");
  const chat = read("client/src/components/WhatsAppChat.tsx");

  it("Home substitui RFV pelo widget de agenda", () => {
    expect(home).toMatch(/import\s+HomeAgendaWidget\s+from/);
    expect(home).toMatch(/<HomeAgendaWidget\s*\/>/);
    expect(home).not.toMatch(/trpc\.home\.rfv\.useQuery/);
    expect(home).not.toMatch(/Oportunidades RFV/);
  });

  it("Widget e dialog consomem mesma fonte (agenda.unified / agenda.createAppointment)", () => {
    expect(widget).toMatch(/trpc\.agenda\.unified\.useQuery/);
    expect(dialog).toMatch(/trpc\.agenda\.createAppointment\.useMutation/);
  });

  it("AppointmentDialog exige contato + negociação para 'Salvar'", () => {
    expect(dialog).toMatch(/canSubmit\s*=\s*[\s\S]*?!!contactId[\s\S]*?!!dealId/);
    // E NÃO permite submeter enquanto está no modo de inline-create.
    expect(dialog).toMatch(/contactMode\s*===\s*"select"/);
    expect(dialog).toMatch(/dealMode\s*===\s*"select"/);
  });

  it("AppointmentDialog suporta inline-create de contato e negociação", () => {
    expect(dialog).toMatch(/handleCreateContact/);
    expect(dialog).toMatch(/handleCreateDeal/);
    expect(dialog).toMatch(/trpc\.crm\.contacts\.create\.useMutation/);
    expect(dialog).toMatch(/trpc\.crm\.deals\.create\.useMutation/);
    // Pipeline + estágio default vêm da primeira pipeline cadastrada.
    expect(dialog).toMatch(/pipelinesQ\.data\?\.\[0\]\?\.id/);
  });

  it("AppointmentDialog aceita defaults de contato (uso pelo Inbox/Tab)", () => {
    expect(dialog).toMatch(/defaultContactId\?:\s*number\s*\|\s*null/);
    expect(dialog).toMatch(/defaultContactPhone\?:\s*string/);
    expect(dialog).toMatch(/defaultContactName\?:\s*string/);
  });

  it("AgendaCalendar usa AppointmentDialog no fluxo de CREATE (mantém modal antigo só para EDIT)", () => {
    expect(calendar).toMatch(/import\s+AppointmentDialog\s+from\s+"@\/components\/agenda\/AppointmentDialog"/);
    expect(calendar).toMatch(/editItem\s*\?\s*\(\s*<AppointmentModal/);
    expect(calendar).toMatch(/<AppointmentDialog/);
  });

  it("AgendamentosTab abre o dialog inline com contactId pré-preenchido", () => {
    expect(tab).toMatch(/import\s+AppointmentDialog\s+from\s+"@\/components\/agenda\/AppointmentDialog"/);
    expect(tab).toMatch(/<AppointmentDialog[\s\S]*?defaultContactId=\{contactId\}/);
  });

  it("Inbox (ChatHeader + WhatsAppChat) tem botão 'Marcar Consulta' que abre o dialog", () => {
    expect(header).toMatch(/onScheduleAppointment\?:\s*\(\)\s*=>\s*void/);
    expect(header).toMatch(/Marcar Consulta/);
    expect(chat).toMatch(/showAppointmentDialog/);
    expect(chat).toMatch(/<AppointmentDialog[\s\S]*?defaultContactId=\{contact\?\.id\}/);
  });
});

describe("[Orçamentos] Integração Produtos × Propostas + Aceitar/Rejeitar", () => {
  const schema = read("drizzle/schema.ts");
  const featureRouters = read("server/routers/featureRouters.ts");
  const orcTab = read("client/src/components/contact-profile/OrcamentosTab.tsx");
  const publicProposal = read("client/src/pages/PublicProposal.tsx");
  const crmDb = read("server/crmDb.ts");

  it("Schema declara campos de rejeição em proposals", () => {
    const block = schema.match(/export const proposals = pgTable[\s\S]*?\]\)/m)?.[0] || "";
    expect(block).toMatch(/rejectedAt:\s*timestamp\("rejectedAt"\)/);
    expect(block).toMatch(/rejectionReason:\s*text\("rejectionReason"\)/);
    expect(block).toMatch(/rejectedClientName:\s*varchar/);
    expect(block).toMatch(/rejectedClientEmail:\s*varchar/);
    expect(block).toMatch(/rejectedClientIp:\s*varchar/);
  });

  it("Backend: proposals.accept (back-office) limpa rejeição prévia", () => {
    const acceptBlock = featureRouters.match(/accept:\s*tenantWriteProcedure[\s\S]*?\n    \}\),/m)?.[0] || "";
    expect(acceptBlock).toBeTruthy();
    expect(acceptBlock).toMatch(/status:\s*"accepted"/);
    expect(acceptBlock).toMatch(/rejectedAt:\s*null/);
  });

  it("Backend: proposals.reject (back-office) limpa aceite prévio", () => {
    const rejectBlock = featureRouters.match(/reject:\s*tenantWriteProcedure[\s\S]*?\n    \}\),/m)?.[0] || "";
    expect(rejectBlock).toBeTruthy();
    expect(rejectBlock).toMatch(/status:\s*"rejected"/);
    expect(rejectBlock).toMatch(/acceptedAt:\s*null/);
  });

  it("Backend: publicProposal.reject (cliente via /p/:token) com IP + nome opcional", () => {
    expect(featureRouters).toMatch(/reject:\s*publicProcedure[\s\S]{0,500}token:\s*z\.string/);
    expect(featureRouters).toMatch(/findProposalByPublicToken/);
    expect(featureRouters).toMatch(/rejectedClientIp/);
  });

  it("Backend: proposals.createFromDeal importa dealProducts como itens", () => {
    expect(featureRouters).toMatch(/createFromDeal:\s*tenantWriteProcedure/);
    expect(featureRouters).toMatch(/listDealProducts/);
    expect(featureRouters).toMatch(/createProposalItem/);
    // Preserva pricingMode per_unit (qty real em quantityPerUnit)
    expect(featureRouters).toMatch(/isPerUnit\s*=\s*dp\.pricingMode === "per_unit"/);
  });

  it("Backend: listProposals aceita dealIds (lista por contato)", () => {
    expect(crmDb).toMatch(/dealIds\?:\s*number\[\]/);
    expect(featureRouters).toMatch(/dealIds:\s*z\.array\(z\.number\(\)\)\.optional\(\)/);
  });

  it("Front: PublicProposal tem botão 'Orçamento rejeitado' e dialog", () => {
    expect(publicProposal).toMatch(/publicProposal\.reject\.useMutation/);
    expect(publicProposal).toMatch(/Orçamento rejeitado/);
    expect(publicProposal).toMatch(/Orçamento aceito/);
    expect(publicProposal).toMatch(/showReject/);
    expect(publicProposal).toMatch(/handleReject/);
  });

  it("Front: OrcamentosTab tem ProposalsSection com Aceitar/Rejeitar e Gerar do deal", () => {
    expect(orcTab).toMatch(/function ProposalsSection/);
    expect(orcTab).toMatch(/proposals\.list\.useQuery/);
    expect(orcTab).toMatch(/proposals\.createFromDeal\.useMutation/);
    expect(orcTab).toMatch(/proposals\.accept\.useMutation/);
    expect(orcTab).toMatch(/proposals\.reject\.useMutation/);
    expect(orcTab).toMatch(/Gerar orçamento/);
  });

  it("Front: DealDetail também tem botão Gerar orçamento no ProductsPanel", () => {
    const dealDetail = read("client/src/pages/DealDetail.tsx");
    expect(dealDetail).toMatch(/function GenerateProposalFromDealButton/);
    expect(dealDetail).toMatch(/proposals\.createFromDeal\.useMutation/);
    expect(dealDetail).toMatch(/<GenerateProposalFromDealButton/);
    expect(dealDetail).toMatch(/Gerar or\u00e7amento/);
  });
});

describe("[Pipeline] Card mostra produto acima do valor", () => {
  const crmDb = read("server/crmDb.ts");
  const pipeline = read("client/src/pages/Pipeline.tsx");

  it("listDeals expõe firstProductName e productsCount via subquery", () => {
    expect(crmDb).toMatch(/firstProductName/);
    expect(crmDb).toMatch(/SELECT name FROM deal_products WHERE "dealId" =/);
    expect(crmDb).toMatch(/productsCount/);
    expect(crmDb).toMatch(/SELECT COUNT\(\*\)::int FROM deal_products WHERE "dealId" =/);
  });

  it("Pipeline DealCard renderiza firstProductName ANTES da row de valor", () => {
    // Bloco do produto deve aparecer antes do bloco "Row 3: Value + Date"
    const cardChunk = pipeline.match(/firstProductName[\s\S]{0,1000}?Row 3: Value/)?.[0] || "";
    expect(cardChunk).toBeTruthy();
    expect(cardChunk).toMatch(/<Package/);
    // Indicador de "+N" quando há mais de um produto
    expect(cardChunk).toMatch(/Number\(deal\.productsCount[\s\S]{0,200}>\s*1/);
  });
});

describe("[Produtos] Precificação por mL/g + foto no orçamento", () => {
  const schema = read("drizzle/schema.ts");
  const crmDb = read("server/crmDb.ts");
  const crmRouter = read("server/routers/crmRouter.ts");
  const productRouter = read("server/routers/productCatalogRouter.ts");
  const featureRouters = read("server/routers/featureRouters.ts");
  const dialog = read("client/src/components/inbox/sidebar/DealProductsDialog.tsx");
  const productCatalog = read("client/src/pages/ProductCatalog.tsx");
  const proposalView = read("client/src/components/proposals/ProposalView.tsx");

  it("Schema declara pricingMode/unitOfMeasure/pricePerUnitCents em productCatalog", () => {
    const block = schema.match(/export const productCatalog[\s\S]*?\]\)/m)?.[0] || "";
    expect(block).toMatch(/pricingMode:\s*varchar\("pricingMode"/);
    expect(block).toMatch(/unitOfMeasure:\s*varchar\("unitOfMeasure"/);
    expect(block).toMatch(/pricePerUnitCents:\s*bigint\("pricePerUnitCents"/);
  });

  it("Schema declara pricingMode + quantityPerUnit + imageUrl em dealProducts", () => {
    const block = schema.match(/export const dealProducts[\s\S]*?\]\)/m)?.[0] || "";
    expect(block).toMatch(/imageUrl:\s*text\("imageUrl"\)/);
    expect(block).toMatch(/pricingMode:\s*varchar\("pricingMode"/);
    expect(block).toMatch(/quantityPerUnit:\s*numeric\("quantityPerUnit"/);
    expect(block).toMatch(/pricePerUnitCents:\s*bigint\("pricePerUnitCents"/);
  });

  it("Schema declara imageUrl + quantityPerUnit em proposalItems", () => {
    const block = schema.match(/export const proposalItems[\s\S]*?\]\)/m)?.[0] || "";
    expect(block).toMatch(/imageUrl:\s*text\("imageUrl"\)/);
    expect(block).toMatch(/quantityPerUnit:\s*numeric\("quantityPerUnit"/);
  });

  it("Backend: createDealProduct calcula final por (qty × pricePerUnit) quando per_unit", () => {
    expect(crmDb).toMatch(/data\.pricingMode === "per_unit"/);
    expect(crmDb).toMatch(/Math\.round\(totalUnits \* data\.pricePerUnitCents\)/);
  });

  it("Backend: deals.products.create aceita quantityPerUnit e copia imageUrl do catálogo", () => {
    expect(crmRouter).toMatch(/quantityPerUnit:\s*z\.number\(\)\.positive\(\)\.optional\(\)/);
    expect(crmRouter).toMatch(/isPerUnit\s*=\s*catalogProduct\.pricingMode === "per_unit"/);
    expect(crmRouter).toMatch(/imageUrl:\s*catalogProduct\.imageUrl/);
  });

  it("Backend: productCatalog.uploadImage existe e valida tipo + tamanho", () => {
    expect(productRouter).toMatch(/uploadImage:\s*tenantWriteProcedure/);
    expect(productRouter).toMatch(/contentType:\s*z\.string\(\)\.regex\(\/\^image\\\//);
    expect(productRouter).toMatch(/2 \* 1024 \* 1024/);
    expect(productRouter).toMatch(/storagePut\(fileKey/);
  });

  it("Backend: proposals.addFromCatalog copia imageUrl + usa pricePerUnit pra produtos per_unit", () => {
    expect(featureRouters).toMatch(/isPerUnit\s*=\s*product\.pricingMode === "per_unit"/);
    expect(featureRouters).toMatch(/imageUrl:\s*product\.imageUrl/);
  });

  it("Front: ProductCatalog form tem pricingMode + upload de foto", () => {
    expect(productCatalog).toMatch(/pricingMode:\s*\(\(product as any\)\?\.pricingMode \|\| "fixed"\)/);
    expect(productCatalog).toMatch(/uploadImageMut\s*=\s*trpc\.productCatalog\.products\.uploadImage\.useMutation/);
    expect(productCatalog).toMatch(/Como o produto é cobrado\?/);
    expect(productCatalog).toMatch(/Foto do produto/);
  });

  it("Front: ProductCatalog form tem custo/un + quantidade default + cálculo de margem", () => {
    expect(productCatalog).toMatch(/costPerUnitCents:/);
    expect(productCatalog).toMatch(/defaultQuantityPerUnit:/);
    // UI inputs
    expect(productCatalog).toMatch(/Custo por \{form\.unitOfMeasure/);
    expect(productCatalog).toMatch(/Venda por \{form\.unitOfMeasure/);
    expect(productCatalog).toMatch(/Quantidade padrão por serviço/);
    // Margem por mL exibida
    expect(productCatalog).toMatch(/Margem por \{form\.unitOfMeasure/);
  });

  it("Front: campos Custo Estimado/Valor base só aparecem em pricingMode='fixed'", () => {
    // Custo Estimado wrapped in pricingMode === "fixed" condition
    expect(productCatalog).toMatch(/form\.pricingMode === "fixed"\s*&&\s*\([\s\S]{0,400}Custo Estimado/);
    // Margem (modo fixo) também só aparece em fixed
    expect(productCatalog).toMatch(/form\.pricingMode === "fixed"\s*&&\s*marginPercent !== null/);
    // Grid muda pra 1 col quando per_unit
    expect(productCatalog).toMatch(/form\.pricingMode === "per_unit"\s*\?\s*"grid grid-cols-1/);
  });

  it("Front: ProductCatalog removeu o bloco 'Campos adicionais'", () => {
    expect(productCatalog).not.toMatch(/Campos adicionais/);
    // Os campos individuais não aparecem mais (só permanece o toggle Ativo).
    const editingChunk = productCatalog.match(/\{isEditing && \([\s\S]*?\)\}\s*<\/div>\s*<DialogFooter/)?.[0] || "";
    expect(editingChunk).not.toMatch(/SKU \/ Código/);
    expect(editingChunk).not.toMatch(/durationMinutes/);
  });

  it("Backend: createCatalogProduct aceita costPerUnitCents + defaultQuantityPerUnit", () => {
    const crmDbFile = read("server/crmDb.ts");
    expect(crmDbFile).toMatch(/costPerUnitCents\?:\s*number \| null/);
    expect(crmDbFile).toMatch(/defaultQuantityPerUnit\?:\s*number \| null/);
    expect(crmDbFile).toMatch(/insertData\.defaultQuantityPerUnit\s*=\s*String/);
  });

  it("Front: DealProductsDialog pré-preenche prompt com defaultQuantityPerUnit", () => {
    const dlg = read("client/src/components/inbox/sidebar/DealProductsDialog.tsx");
    expect(dlg).toMatch(/product\.defaultQuantityPerUnit/);
  });

  it("Front: DealProductsDialog tem prompt inline de quantidade pra produtos per_unit", () => {
    expect(dialog).toMatch(/pendingPerUnit/);
    expect(dialog).toMatch(/product\.pricingMode === "per_unit"/);
    expect(dialog).toMatch(/quantityPerUnit:\s*qty/);
  });

  it("Front: ProposalView renderiza imagem do produto quando presente", () => {
    expect(proposalView).toMatch(/imageUrl\s*=\s*\(item as any\)\.imageUrl/);
    expect(proposalView).toMatch(/<img[\s\S]{0,200}src=\{imageUrl\}/);
  });
});

describe("[Inbox] Preview da última mensagem é fonte-de-verdade messages table", () => {
  const dbFile = read("server/db.ts");
  const evo = read("server/whatsappEvolution.ts");

  it("getWaConversationsList deriva lastMessage da tabela messages (LEFT JOIN), não só do denorm", () => {
    const fn = dbFile.match(/export async function getWaConversationsList[\s\S]*?^}/m)?.[0] || "";
    expect(fn).toBeTruthy();
    // JOIN com a última mensagem por remoteJid
    expect(fn).toMatch(/LEFT JOIN \(\s*--[\s\S]*?SELECT m1\."sessionId"[\s\S]*?MAX\(timestamp\) AS maxTs/);
    // Exclui non-preview types
    expect(fn).toMatch(/messageType" NOT IN \(\$\{sql\.raw\(NON_PREVIEW_TYPES_SQL\)\}\)/);
    // Campos de "última mensagem" usam COALESCE com lm.* primeiro
    expect(fn).toMatch(/COALESCE\(lm\.content,\s*NULLIF\(wc\."lastMessagePreview"/);
    expect(fn).toMatch(/COALESCE\(lm\."messageType",\s*wc\."lastMessageType"\)/);
    expect(fn).toMatch(/COALESCE\(lm\.timestamp,\s*wc\."lastMessageAt"\)/);
    // ORDER BY usa o timestamp REAL (lm) com fallback
    expect(fn).toMatch(/ORDER BY wc\."isPinned" DESC,\s*COALESCE\(lm\.timestamp,\s*wc\."lastMessageAt"\) DESC/);
  });

  it("Lista de NON_PREVIEW_TYPES_SQL inclui reactions/protocol/edits", () => {
    const decl = dbFile.match(/NON_PREVIEW_TYPES_SQL\s*=\s*`[^`]+`/)?.[0] || "";
    expect(decl).toBeTruthy();
    expect(decl).toContain("reactionMessage");
    expect(decl).toContain("protocolMessage");
    expect(decl).toContain("editedMessage");
    expect(decl).toContain("messageContextInfo");
  });

  it("handleIncomingMessage filtra non-preview types antes de chamar updateConversationLastMessage", () => {
    expect(evo).toMatch(/const NON_PREVIEW_TYPES = new Set\(\[[\s\S]{0,300}reactionMessage/);
    expect(evo).toMatch(/const isPreviewWorthy = !NON_PREVIEW_TYPES\.has\(messageType\)/);
    // Só chama updateConversationLastMessage com preview se isPreviewWorthy
    expect(evo).toMatch(/if\s*\(resolved\s*&&\s*isPreviewWorthy\)\s*\{[\s\S]{0,400}updateConversationLastMessage/);
    // Fallback: incrementa unread sem tocar em preview
    expect(evo).toMatch(/else if\s*\(resolved\s*&&\s*!isPreviewWorthy\s*&&\s*!fromMe\)\s*\{[\s\S]{0,200}incrementUnread:\s*true/);
  });
});

describe("[Inbox] Ciclo de vida — auditoria das 4 transições", () => {
  const dbFile = read("server/db.ts");
  const evo = read("server/whatsappEvolution.ts");
  const resolver = read("server/conversationResolver.ts");

  // 1) Mensagem nova → Fila
  it("Conversa nova nasce na fila (queuedAt=NOW, status=open, assignedUserId=null)", () => {
    expect(resolver).toMatch(/db\.insert\(waConversations\)\.values\(\{[\s\S]*?queuedAt:\s*new Date\(\)/);
    // Não pode auto-atribuir ninguém ao criar.
    const insertBlock = resolver.match(/db\.insert\(waConversations\)\.values\(\{[\s\S]*?\}\)\.returning/)?.[0] || "";
    expect(insertBlock).not.toMatch(/assignedUserId:\s*\d/);
  });

  // 2) Atribuir → Meus (com status alinhado)
  it("assignConversation força status='open' e zera queuedAt ao atribuir", () => {
    const fn = dbFile.match(/export async function assignConversation[\s\S]*?^\}/m)?.[0] || "";
    expect(fn).toBeTruthy();
    expect(fn).toMatch(/queuedAt:\s*assignedUserId\s*\?\s*null\s*:\s*undefined/);
    // Status forçado a open quando há agente — fix da race com auto-reopen.
    expect(fn).toMatch(/if\s*\(assignedUserId\)\s*wcUpdate\.status\s*=\s*"open"/);
    // conversation_assignments também sobe pra open + resolvedAt=null.
    expect(fn).toMatch(/conversationAssignments[\s\S]*?status:\s*"open",\s*resolvedAt:\s*null/);
  });

  // 3) Finalizar → Fin
  it("finishAttendance limpa wa_conversations + conversation_assignments completos", () => {
    const fn = dbFile.match(/export async function finishAttendance[\s\S]*?^\}/m)?.[0] || "";
    expect(fn).toBeTruthy();
    expect(fn).toMatch(/assignedUserId:\s*null,\s*assignedTeamId:\s*null,\s*status:\s*"resolved",\s*queuedAt:\s*null/);
    expect(fn).toMatch(/conversationAssignments[\s\S]*?status:\s*"resolved",\s*resolvedAt:\s*new Date\(\)/);
  });

  it("finishAttendance fallback ignora mergedIntoId e arquivadas (não finaliza errado)", () => {
    const fn = dbFile.match(/export async function finishAttendance[\s\S]*?^\}/m)?.[0] || "";
    expect(fn).toMatch(/isNull\(waConversations\.mergedIntoId\)/);
    expect(fn).toMatch(/eq\(waConversations\.isArchived,\s*false\)/);
  });

  // 4) Cliente volta a falar → Fila (atômico)
  it("Auto-reopen é ATÔMICO (UPDATE só se status ainda resolved/closed)", () => {
    const reopenBlock = evo.match(/AUTO-REOPEN[\s\S]*?Error checking\/reopening/)?.[0] || "";
    expect(reopenBlock).toBeTruthy();
    // wa_conversations: WHERE id=X AND status IN ('resolved','closed')
    expect(reopenBlock).toMatch(/eq\(waConversations\.id,\s*resolved\.conversationId\)[\s\S]{0,200}?waConversations\.status[\s\S]{0,80}?IN \('resolved',\s*'closed'\)/);
    // conversation_assignments: mesma trava
    expect(reopenBlock).toMatch(/conversationAssignments\.status[\s\S]{0,80}?IN \('resolved',\s*'closed'\)/);
  });

  it("Auto-reopen vai sempre pra FILA (não tracking de last agent)", () => {
    const reopenBlock = evo.match(/AUTO-REOPEN[\s\S]*?Error checking\/reopening/)?.[0] || "";
    // Sempre seta assignedUserId=null e queuedAt=NOW.
    expect(reopenBlock).toMatch(/assignedUserId:\s*null,\s*assignedTeamId:\s*null,\s*queuedAt:\s*new Date\(\)/);
    // Não restaura nenhum lastAssignedUserId (decisão de produto).
    expect(reopenBlock).not.toMatch(/lastAssignedUserId/);
  });

  it("Auto-reopen só dispara para mensagens inbound (!fromMe)", () => {
    // O comentário AUTO-REOPEN vem ANTES do if (!fromMe).
    expect(evo).toMatch(/AUTO-REOPEN[\s\S]{0,400}?if\s*\(!fromMe\)\s*\{/);
  });
});

describe("[Inbox] Política de reabertura: cliente volta a falar → cai na FILA", () => {
  const dbFile = read("server/db.ts");
  const evo = read("server/whatsappEvolution.ts");

  it("finishAttendance limpa assignedUserId (sem persistir último atendente)", () => {
    // O atendimento foi feito pela equipe — não atrelado a uma pessoa.
    expect(dbFile).toMatch(/finishAttendance[\s\S]*?assignedUserId:\s*null,\s*assignedTeamId:\s*null,\s*status:\s*"resolved"/);
    // E NÃO pode introduzir tracking de lastAssignedUserId.
    expect(dbFile).not.toMatch(/lastAssignedUserId/);
  });

  it("reopen ao receber inbound em conversa resolved/closed → manda pra fila", () => {
    const reopenBlock = evo.match(/AUTO-REOPEN[\s\S]*?Error checking\/reopening/)?.[0] || "";
    expect(reopenBlock).toMatch(/reopening to queue/);
    // Sempre limpa assignedUserId e seta queuedAt.
    expect(reopenBlock).toMatch(/assignedUserId:\s*null,\s*assignedTeamId:\s*null,\s*queuedAt:\s*new Date\(\)/);
    // Não pode rotear pra "último atendente".
    expect(reopenBlock).not.toMatch(/lastAssignedUserId/);
  });
});

describe("[F5] zapiProvider.findMessages — short-circuit para Z-API multi-device", () => {
  const provider = read("server/providers/zapiProvider.ts");

  it("findMessages NÃO chama mais zapiFetch('chat-messages/...')", () => {
    const fn = provider.match(/async findMessages\([\s\S]*?\n  \}/)?.[0] || "";
    expect(fn).toBeTruthy();
    expect(fn).not.toMatch(/zapiFetch\(/);
    expect(fn).not.toMatch(/chat-messages\//);
  });

  it("findMessages retorna [] (vazio) para evitar 400 em multi-device", () => {
    const fn = provider.match(/async findMessages\([\s\S]*?\n  \}/)?.[0] || "";
    expect(fn).toMatch(/return \[\];/);
  });

  it("emite métrica zapi_findmessages_skipped pra observabilidade", () => {
    const fn = provider.match(/async findMessages\([\s\S]*?\n  \}/)?.[0] || "";
    expect(fn).toMatch(/zapi_findmessages_skipped/);
  });
});
