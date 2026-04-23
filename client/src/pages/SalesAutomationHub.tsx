import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { AdminOnlyGuard } from "@/components/AdminOnlyGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Zap, ArrowRight, CheckSquare, MessageCircle, ArrowRightLeft,
  UserCog, Clock, CalendarClock, Trophy, Plane, Heart, RotateCcw,
  Search, Filter, ChevronRight, ExternalLink, Play, Pause,
  Settings2, Layers, Sparkles, Target, GitBranch, Bot,
  Phone, Mail, Video, AlertTriangle, Megaphone, Package,
  ArrowLeft, LayoutGrid, List,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface AutomationTemplate {
  id: string;
  title: string;
  description: string;
  trigger: string;
  action: string;
  category: string;
  icon: any;
  actionIcon: any;
  color: string;
  bgGradient: string;
  path: string;
  badge?: string;
}

interface AutomationCategory {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  templates: AutomationTemplate[];
}

// ═══════════════════════════════════════════════════════════
// TEMPLATE DEFINITIONS (static — no backend needed)
// ═══════════════════════════════════════════════════════════

const AUTOMATION_CATEGORIES: AutomationCategory[] = [
  {
    id: "deal_created",
    title: "Para negociações criadas",
    description: "Automações disparadas quando uma nova negociação é criada no funil",
    icon: Sparkles,
    color: "text-emerald-400",
    templates: [
      {
        id: "deal_created_task",
        title: "Criar tarefa ao criar negociação",
        description: "Crie tarefas automaticamente quando uma negociação entrar em uma etapa específica do funil.",
        trigger: "Negociação criada",
        action: "Criar tarefa",
        category: "deal_created",
        icon: Sparkles,
        actionIcon: CheckSquare,
        color: "text-emerald-400",
        bgGradient: "from-emerald-500/10 to-emerald-500/5",
        path: "/settings/automations",
      },
      {
        id: "deal_created_whatsapp",
        title: "Enviar WhatsApp ao receber lead",
        description: "Envie uma mensagem automática de WhatsApp quando um lead chegar via RD Station, formulário ou integração.",
        trigger: "Lead recebido",
        action: "Enviar WhatsApp",
        category: "deal_created",
        icon: Sparkles,
        actionIcon: MessageCircle,
        color: "text-emerald-400",
        bgGradient: "from-emerald-500/10 to-green-500/5",
        path: "/settings/rdstation",
        badge: "RD Station",
      },
      {
        id: "deal_created_product",
        title: "Vincular produto automaticamente",
        description: "Vincule um produto do catálogo automaticamente a cada negociação criada por um webhook específico.",
        trigger: "Lead recebido",
        action: "Vincular produto",
        category: "deal_created",
        icon: Sparkles,
        actionIcon: Package,
        color: "text-emerald-400",
        bgGradient: "from-emerald-500/10 to-teal-500/5",
        path: "/settings/rdstation",
        badge: "RD Station",
      },
    ],
  },
  {
    id: "deal_moved",
    title: "Para negociações movidas",
    description: "Automações disparadas quando uma negociação avança ou retrocede no funil",
    icon: ArrowRightLeft,
    color: "text-blue-400",
    templates: [
      {
        id: "deal_moved_task",
        title: "Criar tarefa ao mover etapa",
        description: "Crie tarefas automaticamente quando uma negociação for movida para uma etapa específica.",
        trigger: "Etapa alterada",
        action: "Criar tarefa",
        category: "deal_moved",
        icon: ArrowRightLeft,
        actionIcon: CheckSquare,
        color: "text-blue-400",
        bgGradient: "from-blue-500/10 to-blue-500/5",
        path: "/settings/automations",
      },
      {
        id: "deal_moved_owner",
        title: "Mudar responsável ao mover etapa",
        description: "Reatribua automaticamente o responsável da negociação quando ela chegar em determinada etapa.",
        trigger: "Etapa alterada",
        action: "Mudar responsável",
        category: "deal_moved",
        icon: ArrowRightLeft,
        actionIcon: UserCog,
        color: "text-blue-400",
        bgGradient: "from-blue-500/10 to-indigo-500/5",
        path: "/settings/stage-owner-rules",
      },
    ],
  },
  {
    id: "deal_stale",
    title: "Para negociações paradas",
    description: "Automações para negociações que ficaram estagnadas em uma etapa",
    icon: Clock,
    color: "text-amber-400",
    templates: [
      {
        id: "deal_stale_task",
        title: "Criar tarefa para negociação parada",
        description: "Crie uma tarefa de follow-up quando a negociação ficar parada por X dias em uma etapa.",
        trigger: "Negociação parada",
        action: "Criar tarefa",
        category: "deal_stale",
        icon: Clock,
        actionIcon: CheckSquare,
        color: "text-amber-400",
        bgGradient: "from-amber-500/10 to-amber-500/5",
        path: "/settings/pipelines",
        badge: "Cooling",
      },
      {
        id: "deal_stale_alert",
        title: "Alerta de negociação estagnada",
        description: "Configure alertas visuais no funil para negociações que ficaram paradas além do prazo configurado.",
        trigger: "Negociação parada",
        action: "Exibir alerta",
        category: "deal_stale",
        icon: Clock,
        actionIcon: AlertTriangle,
        color: "text-amber-400",
        bgGradient: "from-amber-500/10 to-orange-500/5",
        path: "/settings/pipelines",
        badge: "Cooling",
      },
    ],
  },
  {
    id: "deal_status",
    title: "Para negociações com status alterado",
    description: "Automações disparadas quando uma negociação é ganha ou perdida",
    icon: Trophy,
    color: "text-purple-400",
    templates: [
      {
        id: "deal_won_pipeline",
        title: "Criar negociação em outro funil ao ganhar",
        description: "Quando uma venda for ganha, crie automaticamente uma negociação no funil de pós-venda.",
        trigger: "Venda ganha",
        action: "Criar em outro funil",
        category: "deal_status",
        icon: Trophy,
        actionIcon: GitBranch,
        color: "text-purple-400",
        bgGradient: "from-purple-500/10 to-purple-500/5",
        path: "/settings/pipelines",
      },
      {
        id: "deal_won_tasks",
        title: "Criar tarefas operacionais ao ganhar",
        description: "Crie automaticamente tarefas operacionais (documentação, reservas, etc.) quando uma venda for concluída.",
        trigger: "Venda ganha",
        action: "Criar tarefas",
        category: "deal_status",
        icon: Trophy,
        actionIcon: CheckSquare,
        color: "text-purple-400",
        bgGradient: "from-purple-500/10 to-violet-500/5",
        path: "/settings/automations",
      },
      {
        id: "deal_won_classify",
        title: "Classificar contato ao ganhar venda",
        description: "Atualize automaticamente a classificação do contato (cliente ativo, recorrente, etc.) com base nas vendas.",
        trigger: "Venda ganha",
        action: "Classificar contato",
        category: "deal_status",
        icon: Trophy,
        actionIcon: Target,
        color: "text-purple-400",
        bgGradient: "from-purple-500/10 to-fuchsia-500/5",
        path: "/settings/classification",
      },
      {
        id: "deal_lost_pipeline",
        title: "Mover para funil de retomada ao perder",
        description: "Quando uma venda for perdida, crie automaticamente uma negociação em um funil de retomada.",
        trigger: "Venda perdida",
        action: "Criar em outro funil",
        category: "deal_status",
        icon: Trophy,
        actionIcon: RotateCcw,
        color: "text-purple-400",
        bgGradient: "from-purple-500/10 to-rose-500/5",
        path: "/settings/pipelines",
      },
    ],
  },
  {
    id: "travel_dates",
    title: "Para datas do servico",
    description: "Automacoes baseadas em datas de agendamento, retorno e fechamento",
    icon: Plane,
    color: "text-cyan-400",
    templates: [
      {
        id: "boarding_move",
        title: "Mover etapa proximo ao agendamento",
        description: "Mova automaticamente a negociacao para uma etapa especifica quando estiver proximo da data de agendamento.",
        trigger: "Proximo ao agendamento",
        action: "Mover etapa",
        category: "travel_dates",
        icon: Plane,
        actionIcon: ArrowRightLeft,
        color: "text-cyan-400",
        bgGradient: "from-cyan-500/10 to-cyan-500/5",
        path: "/settings/date-automations",
      },
      {
        id: "return_move",
        title: "Mover etapa apos retorno",
        description: "Mova a negociacao para pos-servico automaticamente quando a data de retorno chegar.",
        trigger: "Data de retorno",
        action: "Mover etapa",
        category: "travel_dates",
        icon: Plane,
        actionIcon: ArrowRightLeft,
        color: "text-cyan-400",
        bgGradient: "from-cyan-500/10 to-sky-500/5",
        path: "/settings/date-automations",
      },
      {
        id: "deadline_task",
        title: "Criar tarefa por data de referência",
        description: "Crie tarefas com prazo relativo a data de agendamento, retorno ou fechamento previsto.",
        trigger: "Data de referência",
        action: "Criar tarefa",
        category: "travel_dates",
        icon: CalendarClock,
        actionIcon: CheckSquare,
        color: "text-cyan-400",
        bgGradient: "from-cyan-500/10 to-teal-500/5",
        path: "/settings/automations",
      },
    ],
  },
  {
    id: "post_sale",
    title: "Para pós-venda",
    description: "Automações para acompanhamento após a venda ser concluída",
    icon: Heart,
    color: "text-rose-400",
    templates: [
      {
        id: "post_sale_task",
        title: "Criar tarefa de pós-venda",
        description: "Crie tarefas de acompanhamento pos-servico para garantir a satisfacao do cliente.",
        trigger: "Servico finalizado",
        action: "Criar tarefa",
        category: "post_sale",
        icon: Heart,
        actionIcon: CheckSquare,
        color: "text-rose-400",
        bgGradient: "from-rose-500/10 to-rose-500/5",
        path: "/settings/automations",
      },
      {
        id: "post_sale_classify",
        title: "Classificar cliente apos servico",
        description: "Atualize a classificacao do contato automaticamente com base no historico de servicos e compras.",
        trigger: "Servico finalizado",
        action: "Classificar contato",
        category: "post_sale",
        icon: Heart,
        actionIcon: Target,
        color: "text-rose-400",
        bgGradient: "from-rose-500/10 to-pink-500/5",
        path: "/settings/classification",
      },
    ],
  },
  {
    id: "relationship",
    title: "Para relacionamento e retomada",
    description: "Automações para reengajar leads inativos e manter relacionamento",
    icon: RotateCcw,
    color: "text-teal-400",
    templates: [
      {
        id: "inactive_alert",
        title: "Alertar sobre clientes inativos",
        description: "Receba alertas quando clientes ficarem inativos por muito tempo, baseado na classificação estratégica.",
        trigger: "Cliente inativo",
        action: "Gerar alerta",
        category: "relationship",
        icon: RotateCcw,
        actionIcon: AlertTriangle,
        color: "text-teal-400",
        bgGradient: "from-teal-500/10 to-teal-500/5",
        path: "/settings/classification",
      },
      {
        id: "referral_window",
        title: "Janela de indicação pós-venda",
        description: "Identifique automaticamente o momento ideal para pedir indicacoes apos um servico bem-sucedido.",
        trigger: "Pos-servico",
        action: "Abrir janela de indicação",
        category: "relationship",
        icon: RotateCcw,
        actionIcon: Megaphone,
        color: "text-teal-400",
        bgGradient: "from-teal-500/10 to-emerald-500/5",
        path: "/settings/classification",
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// TRIGGER/ACTION LABEL MAPS
// ═══════════════════════════════════════════════════════════

const TRIGGER_LABELS: Record<string, string> = {
  deal_won: "Venda ganha",
  deal_lost: "Venda perdida",
  stage_reached: "Etapa alcançada",
};

const TASK_TYPE_LABELS: Record<string, { label: string; icon: any }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  phone: { label: "Telefone", icon: Phone },
  email: { label: "E-mail", icon: Mail },
  video: { label: "Vídeo", icon: Video },
  task: { label: "Tarefa", icon: CheckSquare },
};

const DATE_FIELD_LABELS: Record<string, string> = {
  appointmentDate: "Data do agendamento",
  followUpDate: "Data de retorno/revisao",
  expectedCloseAt: "Fechamento previsto",
  createdAt: "Data de criação",
};

const CONDITION_LABELS: Record<string, string> = {
  days_before: "dias antes",
  days_after: "dias depois",
  on_date: "no dia exato",
};

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

export default function SalesAutomationHub() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"templates" | "my">("templates");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // ─── Queries for "Minhas Automações" tab ───────────────
  const taskAutomationsQ = trpc.crm.taskAutomations.list.useQuery({},
    { enabled: activeTab === "my" }
  );
  const pipelineAutomationsQ = trpc.crm.pipelineAutomations.list.useQuery({},
    { enabled: activeTab === "my" }
  );
  const dateAutomationsQ = trpc.crm.dateAutomations.list.useQuery({},
    { enabled: activeTab === "my" }
  );
  const stageOwnerRulesQ = trpc.crm.stageOwnerRules.list.useQuery({},
    { enabled: activeTab === "my" }
  );
  const pipelinesQ = trpc.crm.pipelines.list.useQuery({},
    { enabled: activeTab === "my" }
  );
  // ─── Pipeline/Stage lookup helpers ─────────────────────
  const pipelineMap = useMemo(() => {
    const map = new Map<number, string>();
    (pipelinesQ.data || []).forEach((p: any) => {
      map.set(p.id, p.name);
    });
    return map;
  }, [pipelinesQ.data]);

  // Build stage map from pipeline stages (each pipeline has stages embedded or we query per pipeline)
  const pipelineIds = useMemo(() => (pipelinesQ.data || []).map((p: any) => p.id), [pipelinesQ.data]);

  // Query stages for each pipeline (we'll use the first pipeline's stages query pattern)
  // Since stages endpoint requires pipelineId, we build the map from task/date automations themselves
  const stageMap = useMemo(() => {
    const map = new Map<number, string>();
    // Extract stage names from task automations (they have stageId but not name)
    // We'll resolve names lazily — for now use pipeline stages from the pipeline list if available
    (pipelinesQ.data || []).forEach((p: any) => {
      if (p.stages) {
        p.stages.forEach((s: any) => map.set(s.id, s.name));
      }
    });
    return map;
  }, [pipelinesQ.data]);

  // ─── Unified automation list ───────────────────────────
  type UnifiedAutomation = {
    id: string;
    type: "task" | "pipeline" | "date" | "stage_owner";
    name: string;
    description: string;
    trigger: string;
    action: string;
    pipeline: string;
    isActive: boolean;
    icon: any;
    actionIcon: any;
    color: string;
    editPath: string;
    category: string;
  };

  const unifiedAutomations = useMemo<UnifiedAutomation[]>(() => {
    const list: UnifiedAutomation[] = [];

    // Task automations
    (taskAutomationsQ.data || []).forEach((a: any) => {
      const typeInfo = TASK_TYPE_LABELS[a.taskType] || TASK_TYPE_LABELS.task;
      list.push({
        id: `task-${a.id}`,
        type: "task",
        name: a.taskTitle,
        description: `Criar ${typeInfo.label.toLowerCase()} ao mover para "${stageMap.get(a.stageId) || "..."}"`,
        trigger: `Etapa: ${stageMap.get(a.stageId) || "..."}`,
        action: `Criar ${typeInfo.label.toLowerCase()}`,
        pipeline: pipelineMap.get(a.pipelineId) || "...",
        isActive: a.isActive,
        icon: ArrowRightLeft,
        actionIcon: typeInfo.icon,
        color: "text-blue-400",
        editPath: "/settings/automations",
        category: "Automação por etapa",
      });
    });

    // Pipeline automations
    (pipelineAutomationsQ.data || []).forEach((a: any) => {
      const triggerLabel = TRIGGER_LABELS[a.triggerEvent] || a.triggerEvent;
      list.push({
        id: `pipeline-${a.id}`,
        type: "pipeline",
        name: a.name,
        description: `${triggerLabel} no funil "${pipelineMap.get(a.sourcePipelineId) || "..."}" → criar em "${pipelineMap.get(a.targetPipelineId) || "..."}"`,
        trigger: triggerLabel,
        action: "Criar em outro funil",
        pipeline: pipelineMap.get(a.sourcePipelineId) || "...",
        isActive: a.isActive,
        icon: Trophy,
        actionIcon: GitBranch,
        color: "text-purple-400",
        editPath: "/settings/pipelines",
        category: "Automação entre funis",
      });
    });

    // Date automations
    (dateAutomationsQ.data || []).forEach((a: any) => {
      const dateLabel = DATE_FIELD_LABELS[a.dateField] || a.dateField;
      const condLabel = CONDITION_LABELS[a.condition] || a.condition;
      list.push({
        id: `date-${a.id}`,
        type: "date",
        name: a.name,
        description: `${a.offsetDays} ${condLabel} da ${dateLabel.toLowerCase()} → mover para "${stageMap.get(a.targetStageId) || "..."}"`,
        trigger: `${dateLabel}: ${a.offsetDays}d ${condLabel}`,
        action: `Mover para ${stageMap.get(a.targetStageId) || "..."}`,
        pipeline: pipelineMap.get(a.pipelineId) || "...",
        isActive: a.isActive,
        icon: CalendarClock,
        actionIcon: ArrowRightLeft,
        color: "text-cyan-400",
        editPath: "/settings/date-automations",
        category: "Automação por data",
      });
    });

    // Stage owner rules
    (stageOwnerRulesQ.data || []).forEach((a: any) => {
      list.push({
        id: `stage-owner-${a.id}`,
        type: "stage_owner",
        name: `Mudar responsável na etapa "${stageMap.get(a.stageId) || "..."}"`,
        description: `Reatribuir responsável automaticamente ao mover para "${stageMap.get(a.stageId) || "..."}"`,
        trigger: `Etapa: ${stageMap.get(a.stageId) || "..."}`,
        action: "Mudar responsável",
        pipeline: pipelineMap.get(a.pipelineId) || "...",
        isActive: a.isActive,
        icon: ArrowRightLeft,
        actionIcon: UserCog,
        color: "text-blue-400",
        editPath: "/settings/stage-owner-rules",
        category: "Automação por etapa",
      });
    });

    return list;
  }, [taskAutomationsQ.data, pipelineAutomationsQ.data, dateAutomationsQ.data, stageOwnerRulesQ.data, pipelineMap, stageMap]);

  // ─── Filtered templates ────────────────────────────────
  const filteredCategories = useMemo(() => {
    if (!searchQuery && categoryFilter === "all") return AUTOMATION_CATEGORIES;

    return AUTOMATION_CATEGORIES
      .map((cat) => ({
        ...cat,
        templates: cat.templates.filter((t) => {
          const matchesSearch = !searchQuery ||
            t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesCategory = categoryFilter === "all" || cat.id === categoryFilter;
          return matchesSearch && matchesCategory;
        }),
      }))
      .filter((cat) => cat.templates.length > 0);
  }, [searchQuery, categoryFilter]);

  // ─── Filtered my automations ───────────────────────────
  const filteredMyAutomations = useMemo(() => {
    if (!searchQuery) return unifiedAutomations;
    return unifiedAutomations.filter(
      (a) =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [unifiedAutomations, searchQuery]);

  const totalTemplates = AUTOMATION_CATEGORIES.reduce((sum, cat) => sum + cat.templates.length, 0);
  const activeCount = unifiedAutomations.filter((a) => a.isActive).length;
  const totalCount = unifiedAutomations.length;

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <AdminOnlyGuard>
      <div className="min-h-screen bg-background">
        {/* ─── Hero Header ─── */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative max-w-6xl mx-auto px-6 pt-8 pb-6">
            <div className="flex items-center gap-3 mb-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setLocation("/settings")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                  <Zap className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground tracking-tight">Automação de Vendas</h1>
                  <p className="text-[12px] text-muted-foreground">Automatize seu processo comercial e ganhe produtividade</p>
                </div>
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-6 mt-5 ml-11">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-500" />
                <span className="text-[12px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{totalTemplates}</span> modelos disponíveis
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-[12px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{activeCount}</span> ativas de {totalCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Tabs ─── */}
        <div className="max-w-6xl mx-auto px-6">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setSearchQuery(""); setCategoryFilter("all"); }}>
            <div className="flex items-center justify-between mb-6">
              <TabsList className="bg-muted/30 p-1 rounded-xl">
                <TabsTrigger
                  value="templates"
                  className="rounded-lg text-[13px] px-5 py-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Modelos de automação
                </TabsTrigger>
                <TabsTrigger
                  value="my"
                  className="rounded-lg text-[13px] px-5 py-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Minhas automações
                  {totalCount > 0 && (
                    <Badge variant="secondary" className="ml-1 text-[10px] h-5 px-1.5">{totalCount}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Search */}
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar automações..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-[13px] bg-muted/20 border-border/50"
                />
              </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* TAB 1: MODELOS DE AUTOMAÇÃO               */}
            {/* ═══════════════════════════════════════════ */}
            <TabsContent value="templates" className="space-y-8 pb-12">
              {/* Category filter chips */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setCategoryFilter("all")}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                    categoryFilter === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  Todos
                </button>
                {AUTOMATION_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all flex items-center gap-1.5 ${
                      categoryFilter === cat.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <cat.icon className="h-3 w-3" />
                    {cat.title.replace("Para ", "")}
                  </button>
                ))}
              </div>

              {/* Category sections */}
              {filteredCategories.map((category) => (
                <div key={category.id}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center ${category.color}`}>
                      <category.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-foreground">{category.title}</h3>
                      <p className="text-[11px] text-muted-foreground">{category.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {category.templates.map((template) => (
                      <Card
                        key={template.id}
                        className={`group cursor-pointer border-border/40 hover:border-border/80 transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/5 bg-gradient-to-br ${template.bgGradient} overflow-hidden`}
                        onClick={() => {
                          if (template.badge === "Em breve") {
                            toast.info("Essa automação estará disponível em breve!");
                            return;
                          }
                          setLocation(template.path);
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className={`h-7 w-7 rounded-lg bg-background/60 flex items-center justify-center ${template.color}`}>
                                <template.icon className="h-3.5 w-3.5" />
                              </div>
                              <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                              <div className="h-7 w-7 rounded-lg bg-background/60 flex items-center justify-center text-foreground/70">
                                <template.actionIcon className="h-3.5 w-3.5" />
                              </div>
                            </div>
                            {template.badge && (
                              <Badge
                                variant={template.badge === "Em breve" ? "outline" : "secondary"}
                                className="text-[9px] h-5 px-1.5"
                              >
                                {template.badge}
                              </Badge>
                            )}
                          </div>

                          <h4 className="text-[13px] font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                            {template.title}
                          </h4>
                          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                            {template.description}
                          </p>

                          <div className="flex items-center gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[11px] text-primary font-medium">Configurar</span>
                            <ChevronRight className="h-3 w-3 text-primary" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}

              {filteredCategories.length === 0 && (
                <div className="text-center py-16">
                  <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-[14px] text-muted-foreground">Nenhum modelo encontrado para "{searchQuery}"</p>
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearchQuery(""); setCategoryFilter("all"); }}>
                    Limpar filtros
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ═══════════════════════════════════════════ */}
            {/* TAB 2: MINHAS AUTOMAÇÕES                  */}
            {/* ═══════════════════════════════════════════ */}
            <TabsContent value="my" className="space-y-6 pb-12">
              {/* View mode toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[11px] gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {activeCount} ativas
                  </Badge>
                  <Badge variant="outline" className="text-[11px] gap-1 text-muted-foreground">
                    {totalCount - activeCount} inativas
                  </Badge>
                </div>
                <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Loading state */}
              {(taskAutomationsQ.isLoading || pipelineAutomationsQ.isLoading || dateAutomationsQ.isLoading || stageOwnerRulesQ.isLoading) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Card key={i} className="border-border/30 animate-pulse">
                      <CardContent className="p-4 space-y-3">
                        <div className="h-4 bg-muted/30 rounded w-3/4" />
                        <div className="h-3 bg-muted/20 rounded w-full" />
                        <div className="h-3 bg-muted/20 rounded w-1/2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!taskAutomationsQ.isLoading && !pipelineAutomationsQ.isLoading && !dateAutomationsQ.isLoading && !stageOwnerRulesQ.isLoading && filteredMyAutomations.length === 0 && (
                <div className="text-center py-16">
                  <div className="h-16 w-16 rounded-2xl bg-muted/20 flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-foreground mb-1">Nenhuma automação configurada</h3>
                  <p className="text-[12px] text-muted-foreground mb-4 max-w-sm mx-auto">
                    Explore os modelos de automação para configurar seu primeiro fluxo automatizado.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setActiveTab("templates")}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Ver modelos
                  </Button>
                </div>
              )}

              {/* Automation cards */}
              {filteredMyAutomations.length > 0 && (
                <>
                  {/* Group by category */}
                  {(() => {
                    const grouped = new Map<string, UnifiedAutomation[]>();
                    filteredMyAutomations.forEach((a) => {
                      const key = a.category;
                      if (!grouped.has(key)) grouped.set(key, []);
                      grouped.get(key)!.push(a);
                    });

                    return Array.from(grouped.entries()).map(([category, automations]) => (
                      <div key={category}>
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="text-[13px] font-semibold text-foreground">{category}</h3>
                          <Badge variant="secondary" className="text-[10px] h-5">{automations.length}</Badge>
                        </div>

                        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-2"}>
                          {automations.map((automation) => (
                            viewMode === "grid" ? (
                              <Card
                                key={automation.id}
                                className={`group cursor-pointer border-border/40 hover:border-border/80 transition-all duration-200 ${
                                  !automation.isActive ? "opacity-50" : ""
                                }`}
                                onClick={() => setLocation(automation.editPath)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <div className={`h-7 w-7 rounded-lg bg-muted/30 flex items-center justify-center ${automation.color}`}>
                                        <automation.icon className="h-3.5 w-3.5" />
                                      </div>
                                      <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                                      <div className="h-7 w-7 rounded-lg bg-muted/30 flex items-center justify-center text-foreground/70">
                                        <automation.actionIcon className="h-3.5 w-3.5" />
                                      </div>
                                    </div>
                                    <Badge
                                      variant={automation.isActive ? "default" : "outline"}
                                      className={`text-[9px] h-5 px-1.5 ${
                                        automation.isActive
                                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                          : "text-muted-foreground"
                                      }`}
                                    >
                                      {automation.isActive ? "Ativa" : "Inativa"}
                                    </Badge>
                                  </div>

                                  <h4 className="text-[13px] font-semibold text-foreground mb-0.5 truncate group-hover:text-primary transition-colors">
                                    {automation.name}
                                  </h4>
                                  <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">
                                    {automation.description}
                                  </p>

                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="text-[9px] h-5 px-1.5 text-muted-foreground">
                                      {automation.pipeline}
                                    </Badge>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <span className="text-[10px] text-primary font-medium">Editar</span>
                                      <ExternalLink className="h-2.5 w-2.5 text-primary" />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ) : (
                              <div
                                key={automation.id}
                                className={`flex items-center gap-4 p-3 rounded-lg border border-border/30 hover:border-border/60 cursor-pointer transition-all group ${
                                  !automation.isActive ? "opacity-50" : ""
                                }`}
                                onClick={() => setLocation(automation.editPath)}
                              >
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className={`h-7 w-7 rounded-lg bg-muted/30 flex items-center justify-center ${automation.color}`}>
                                    <automation.icon className="h-3.5 w-3.5" />
                                  </div>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                                  <div className="h-7 w-7 rounded-lg bg-muted/30 flex items-center justify-center text-foreground/70">
                                    <automation.actionIcon className="h-3.5 w-3.5" />
                                  </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-[13px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                      {automation.name}
                                    </h4>
                                    <Badge variant="outline" className="text-[9px] h-5 px-1.5 text-muted-foreground shrink-0">
                                      {automation.pipeline}
                                    </Badge>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground truncate">{automation.description}</p>
                                </div>

                                <Badge
                                  variant={automation.isActive ? "default" : "outline"}
                                  className={`text-[9px] h-5 px-1.5 shrink-0 ${
                                    automation.isActive
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {automation.isActive ? "Ativa" : "Inativa"}
                                </Badge>

                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminOnlyGuard>
  );
}
