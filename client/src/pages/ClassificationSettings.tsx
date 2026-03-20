import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { AdminOnlyGuard } from "@/components/AdminOnlyGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Settings2,
  Clock,
  Gift,
  Zap,
  ShieldCheck,
  Users,
  TrendingUp,
  UserX,
  UserPlus,
  Eye,
  Target,
  ShoppingBag,
  CheckCircle,
  Repeat,
  Megaphone,
  HelpCircle,
  Info,
} from "lucide-react";

// ═══════════════════════════════════════
// Classification descriptions for the rules panel
// ═══════════════════════════════════════

const CLASSIFICATION_RULES = [
  {
    key: "desconhecido",
    label: "Desconhecido",
    icon: HelpCircle,
    color: "#94a3b8",
    bgClass: "bg-slate-500/10 border-slate-500/20",
    textClass: "text-slate-400",
    description: "Contato sem interação significativa no funil. Estado inicial de todos os contatos.",
    rule: "Padrão ao criar contato",
  },
  {
    key: "seguidor",
    label: "Seguidor",
    icon: Eye,
    color: "#a78bfa",
    bgClass: "bg-violet-500/10 border-violet-500/20",
    textClass: "text-violet-400",
    description: "Contato que acompanha mas ainda não entrou no funil de vendas.",
    rule: "Atribuição manual",
  },
  {
    key: "lead",
    label: "Lead",
    icon: UserPlus,
    color: "#3b82f6",
    bgClass: "bg-blue-500/10 border-blue-500/20",
    textClass: "text-blue-400",
    description: "Entrou no funil de vendas nas etapas iniciais (Novo atendimento ou Atendimento iniciado).",
    rule: "Automático: etapas 1-2 do Funil de Vendas",
  },
  {
    key: "oportunidade",
    label: "Oportunidade",
    icon: Target,
    color: "#f59e0b",
    bgClass: "bg-amber-500/10 border-amber-500/20",
    textClass: "text-amber-400",
    description: "Avançou no funil para etapas de qualificação (Diagnóstico até Reserva).",
    rule: "Automático: etapas 3-7 do Funil de Vendas",
  },
  {
    key: "cliente_primeira_compra",
    label: "Cliente 1a Compra",
    icon: ShoppingBag,
    color: "#22c55e",
    bgClass: "bg-emerald-500/10 border-emerald-500/20",
    textClass: "text-emerald-400",
    description: "Realizou a primeira compra. Negociação marcada como ganha sem compras anteriores.",
    rule: "Automático: DealWon (sem compras anteriores)",
  },
  {
    key: "cliente_ativo",
    label: "Cliente Ativo",
    icon: CheckCircle,
    color: "#10b981",
    bgClass: "bg-teal-500/10 border-teal-500/20",
    textClass: "text-teal-400",
    description: "Possui compra e está dentro do ciclo operacional configurado.",
    rule: "Automático: compra dentro do período de inatividade",
  },
  {
    key: "cliente_recorrente",
    label: "Cliente Recorrente",
    icon: Repeat,
    color: "#0ea5e9",
    bgClass: "bg-sky-500/10 border-sky-500/20",
    textClass: "text-sky-400",
    description: "Realizou mais de uma compra. Cliente fidelizado com múltiplas transações.",
    rule: "Automático: DealWon (com compras anteriores)",
  },
  {
    key: "ex_cliente",
    label: "Ex-Cliente",
    icon: UserX,
    color: "#ef4444",
    bgClass: "bg-red-500/10 border-red-500/20",
    textClass: "text-red-400",
    description: "Já comprou, mas está inativo além do período configurado.",
    rule: "Automático: inativo por X dias (configurável)",
  },
  {
    key: "promotor",
    label: "Promotor",
    icon: Megaphone,
    color: "#ec4899",
    bgClass: "bg-pink-500/10 border-pink-500/20",
    textClass: "text-pink-400",
    description: "Indicou pelo menos 1 cliente confirmado. Embaixador da marca.",
    rule: "Automático: indicação confirmada",
  },
];

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════

export default function ClassificationSettings() {
  const [, navigate] = useLocation();


  // Fetch current settings
  const settingsQ = trpc.crm.classification.getSettings.useQuery();

  // Local form state
  const [inactivityDays, setInactivityDays] = useState(360);
  const [referralWindowDays, setReferralWindowDays] = useState(90);
  const [autoClassifyOnMove, setAutoClassifyOnMove] = useState(true);
  const [autoClassifyOnWon, setAutoClassifyOnWon] = useState(true);
  const [autoClassifyOnLost, setAutoClassifyOnLost] = useState(true);
  const [autoCreatePostSaleDeal, setAutoCreatePostSaleDeal] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Populate form when data loads
  useEffect(() => {
    if (settingsQ.data) {
      setInactivityDays(settingsQ.data.inactivityDays);
      setReferralWindowDays(settingsQ.data.referralWindowDays);
      setAutoClassifyOnMove(settingsQ.data.autoClassifyOnMove);
      setAutoClassifyOnWon(settingsQ.data.autoClassifyOnWon);
      setAutoClassifyOnLost(settingsQ.data.autoClassifyOnLost);
      setAutoCreatePostSaleDeal(settingsQ.data.autoCreatePostSaleDeal);
      setHasChanges(false);
    }
  }, [settingsQ.data]);

  // Save mutation
  const saveMutation = trpc.crm.classification.saveSettings.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso");
      setHasChanges(false);
      settingsQ.refetch();
    },
    onError: () => {
      toast.error("Não foi possível salvar as configurações.");
    },
  });

  // Process inactive mutation
  const processInactiveMutation = trpc.crm.classification.processInactive.useMutation({
    onSuccess: () => {
      toast.success("Clientes inativos e janelas de indicação foram atualizados.");
    },
    onError: () => {
      toast.error("Falha ao processar clientes inativos.");
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      inactivityDays,
      referralWindowDays,
      autoClassifyOnMove,
      autoClassifyOnWon,
      autoClassifyOnLost,
      autoCreatePostSaleDeal,
    });
  };

  const markChanged = () => setHasChanges(true);

  if (settingsQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <AdminOnlyGuard pageTitle="Classificação estratégica">
    <div className="container max-w-5xl py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} className="rounded-xl" style={{ pointerEvents: "auto" }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Motor de Regras</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure a classificação estratégica automática dos seus contatos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => processInactiveMutation.mutate({ inactivityDays })}
            disabled={processInactiveMutation.isPending}
            className="rounded-xl"
          >
            <Zap className="h-4 w-4 mr-2" />
            {processInactiveMutation.isPending ? "Processando..." : "Processar Agora"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            className="rounded-xl bg-primary"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>

      {/* Settings Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timing Settings */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base">Períodos de Tempo</CardTitle>
                <CardDescription>Defina os prazos para classificação automática</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-400" />
                Inatividade para Ex-Cliente
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={30}
                  max={3650}
                  value={inactivityDays}
                  onChange={(e) => { setInactivityDays(Number(e.target.value)); markChanged(); }}
                  className="w-28 rounded-xl"
                />
                <span className="text-sm text-muted-foreground">dias sem compra</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Após esse período sem novas compras, o cliente será reclassificado como Ex-Cliente.
                Valor padrão: 360 dias.
              </p>
            </div>

            <div className="border-t border-border/50 pt-6 space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Gift className="h-4 w-4 text-pink-400" />
                Janela de Indicação
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={7}
                  max={365}
                  value={referralWindowDays}
                  onChange={(e) => { setReferralWindowDays(Number(e.target.value)); markChanged(); }}
                  className="w-28 rounded-xl"
                />
                <span className="text-sm text-muted-foreground">dias após venda ganha</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Período em que o cliente é considerado "Potencial Indicador" após uma compra.
                Valor padrão: 90 dias.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Automation Toggles */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <Settings2 className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base">Automações</CardTitle>
                <CardDescription>Ative ou desative regras automáticas</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                <div>
                  <p className="text-sm font-medium">Classificar ao mover deal</p>
                  <p className="text-xs text-muted-foreground">Lead (etapas 1-2) ou Oportunidade (etapas 3-7)</p>
                </div>
              </div>
              <Switch
                checked={autoClassifyOnMove}
                onCheckedChange={(v) => { setAutoClassifyOnMove(v); markChanged(); }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium">Classificar ao ganhar venda</p>
                  <p className="text-xs text-muted-foreground">1a Compra ou Recorrente + janela de indicação</p>
                </div>
              </div>
              <Switch
                checked={autoClassifyOnWon}
                onCheckedChange={(v) => { setAutoClassifyOnWon(v); markChanged(); }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center gap-3">
                <UserX className="h-4 w-4 text-red-400" />
                <div>
                  <p className="text-sm font-medium">Classificar ao perder venda</p>
                  <p className="text-xs text-muted-foreground">Não Cliente (se nunca comprou)</p>
                </div>
              </div>
              <Switch
                checked={autoClassifyOnLost}
                onCheckedChange={(v) => { setAutoClassifyOnLost(v); markChanged(); }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-cyan-400" />
                <div>
                  <p className="text-sm font-medium">Criar deal no Pós-Venda</p>
                  <p className="text-xs text-muted-foreground">Ao ganhar venda, criar negociação no Funil de Pós-Venda</p>
                </div>
              </div>
              <Switch
                checked={autoCreatePostSaleDeal}
                onCheckedChange={(v) => { setAutoCreatePostSaleDeal(v); markChanged(); }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Classification Rules Reference */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10">
              <Info className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-base">9 Classificações Estratégicas</CardTitle>
              <CardDescription>Referência completa das classificações e suas regras de ativação</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CLASSIFICATION_RULES.map((cls) => {
              const Icon = cls.icon;
              return (
                <div
                  key={cls.key}
                  className={`p-4 rounded-xl border ${cls.bgClass} transition-all hover:scale-[1.02]`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${cls.color}20` }}>
                      <Icon className="h-4 w-4" style={{ color: cls.color }} />
                    </div>
                    <span className={`text-sm font-semibold ${cls.textClass}`}>{cls.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    {cls.description}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Zap className="h-3 w-3 text-muted-foreground/60" />
                    <span className="text-[11px] text-muted-foreground/80 font-medium">{cls.rule}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Funil de Vendas
            </CardTitle>
            <CardDescription>7 etapas com classificação automática</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { name: "Novo atendimento", cls: "Lead", color: "#3b82f6" },
                { name: "Atendimento iniciado", cls: "Lead", color: "#06b6d4" },
                { name: "Diagnóstico", cls: "Oportunidade", color: "#8b5cf6" },
                { name: "Cotação", cls: "Oportunidade", color: "#f59e0b" },
                { name: "Apresentação", cls: "Oportunidade", color: "#f97316" },
                { name: "Acompanhamento", cls: "Oportunidade", color: "#22c55e" },
                { name: "Reserva", cls: "Oportunidade", color: "#10b981" },
              ].map((stage, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/20">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-sm">{stage.name}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    stage.cls === "Lead" 
                      ? "bg-blue-500/10 text-blue-400" 
                      : "bg-amber-500/10 text-amber-400"
                  }`}>
                    {stage.cls}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              Funil de Pós-Venda
            </CardTitle>
            <CardDescription>7 etapas de acompanhamento do cliente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { name: "Nova venda", color: "#3b82f6" },
                { name: "Aguardando embarque", color: "#06b6d4" },
                { name: "30D para embarque", color: "#8b5cf6" },
                { name: "Pré viagem", color: "#f59e0b" },
                { name: "Em viagem", color: "#22c55e" },
                { name: "Pós viagem", color: "#f97316" },
                { name: "Viagem finalizada", color: "#10b981" },
              ].map((stage, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/20">
                  <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-sm">{stage.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </AdminOnlyGuard>
  );
}
