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
