import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Users, DollarSign, Target, TrendingUp, Search,
  Upload, RefreshCw, Trash2, AlertTriangle, Phone,
  ArrowUpDown, ChevronLeft, ChevronRight, Star,
  ShieldAlert, UserCheck, MessageSquare, ExternalLink,
  BarChart3, FileSpreadsheet, XCircle, Send, X,
  CheckSquare, Square, Loader2, Ban, CheckCircle2,
  AlertCircle, SkipForward, Filter, Clock, Heart,
  Award, Plane, UserX, Bell, Download,
} from "lucide-react";
import { useExportDownload } from "@/hooks/useExport";

// ─── Smart Filter Config ───
const smartFilterConfig: Record<string, { label: string; description: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  potencial_ex_cliente: {
    label: "Potencial Ex-Cliente",
    description: "250–350 dias sem comprar",
    icon: <Clock className="w-4 h-4" />,
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-300 dark:border-orange-700",
  },
  potencial_indicador: {
    label: "Potencial Indicador",
    description: "Compra nos últimos 30 dias",
    icon: <Heart className="w-4 h-4" />,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-300 dark:border-emerald-700",
  },
  potencial_indicador_pos_viagem: {
    label: "Pos Servico",
    description: "30 dias após retorno",
    icon: <Plane className="w-4 h-4" />,
    color: "text-sky-600",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    border: "border-sky-300 dark:border-sky-700",
  },
  potencial_indicador_fiel: {
    label: "Indicador Fiel",
    description: "Mais de 1 compra",
    icon: <Award className="w-4 h-4" />,
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-300 dark:border-purple-700",
  },
  abordagem_nao_cliente: {
    label: "Abordagem Não Cliente",
    description: "Venda perdida em 90 dias",
    icon: <UserX className="w-4 h-4" />,
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-300 dark:border-red-700",
  },
};

// ─── Audience Config ───
const audienceConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  desconhecido: { label: "Desconhecido", color: "text-gray-500", bg: "bg-gray-100 dark:bg-gray-800", icon: <Users className="w-3.5 h-3.5" /> },
  seguidor: { label: "Seguidor", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950", icon: <UserCheck className="w-3.5 h-3.5" /> },
  lead: { label: "Lead", color: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-950", icon: <Target className="w-3.5 h-3.5" /> },
  oportunidade: { label: "Oportunidade", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950", icon: <Star className="w-3.5 h-3.5" /> },
  nao_cliente: { label: "Não Cliente", color: "text-red-500", bg: "bg-red-50 dark:bg-red-950", icon: <XCircle className="w-3.5 h-3.5" /> },
  cliente_primeira_compra: { label: "1a Compra", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950", icon: <DollarSign className="w-3.5 h-3.5" /> },
  cliente_recorrente: { label: "Recorrente", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  ex_cliente: { label: "Ex-Cliente", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950", icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  indicado: { label: "Indicado", color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-950", icon: <MessageSquare className="w-3.5 h-3.5" /> },
};

const flagConfig: Record<string, { label: string; color: string; bg: string }> = {
  potencial_indicador: { label: "Potencial Indicador", color: "text-emerald-700", bg: "bg-emerald-100 dark:bg-emerald-900" },
  risco_ex_cliente: { label: "Risco Ex-Cliente", color: "text-red-700", bg: "bg-red-100 dark:bg-red-900" },
  abordagem_nao_cliente: { label: "Abordagem Não Cliente", color: "text-amber-700", bg: "bg-amber-100 dark:bg-amber-900" },
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function conversionBadge(taxa: number): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (taxa >= 50) return { label: "Alta", variant: "default" };
  if (taxa >= 20) return { label: "Média", variant: "secondary" };
  return { label: "Baixa", variant: "outline" };
}

function normalizePhoneForWa(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://web.whatsapp.com/send?phone=${withCountry}`;
}

// ─── Sort options ───
const sortOptions = [
  { value: "updatedAt", label: "Mais recente" },
  { value: "valor", label: "Valor (R$)" },
  { value: "compras", label: "Compras" },
  { value: "recencia", label: "Recência" },
  { value: "conversao", label: "Conversão" },
  { value: "atendimentos", label: "Atendimentos" },
];

// ─── Template variables ───
const templateVars = [
  { var: "{nome}", desc: "Nome completo" },
  { var: "{primeiro_nome}", desc: "Primeiro nome" },
  { var: "{email}", desc: "Email" },
  { var: "{telefone}", desc: "Telefone" },
  { var: "{publico}", desc: "Público RFV" },
  { var: "{valor}", desc: "Valor total (R$)" },
];

function ExportRfvButton() {
  const { isExporting, handleExport } = useExportDownload();
  const exportMutation = trpc.export.rfv.useMutation();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isExporting}
      onClick={() => handleExport(() => exportMutation.mutateAsync(), "contatos RFV")}
    >
      {isExporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
      Exportar
    </Button>
  );
}

export default function RfvMatrix() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // ─── State ───
  const [search, setSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [smartFilter, setSmartFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Selection State ───
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);

  // ─── Bulk Send State ───
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(3);
  const [delayMode, setDelayMode] = useState<"fixed" | "random">("random"); // random is recommended
  const [delayMinSeconds, setDelayMinSeconds] = useState(3);
  const [delayMaxSeconds, setDelayMaxSeconds] = useState(8);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, []);

  // ─── Queries ───
  const dashboard = trpc.rfv.dashboard.useQuery(undefined, { enabled: true });
  const contacts = trpc.rfv.list.useQuery({ page,
    pageSize: 50,
    search: debouncedSearch || undefined,
    audienceType: audienceFilter !== "all" ? audienceFilter : undefined,
    smartFilter: smartFilter || undefined,
    sortBy,
    sortDir,
  }, { enabled: true });
  const smartCounts = trpc.rfv.smartFilterCounts.useQuery(undefined, { enabled: true });
  const alerta = trpc.rfv.alertaDinheiroParado.useQuery(undefined, { enabled: true });
  const activeSession = trpc.rfv.activeSession.useQuery(undefined,
    {
      enabled: true,
      // Poll every 3s while dialog is open and session is not yet connected
      refetchInterval: (query) => {
        if (!bulkDialogOpen) return false;
        const d = query.state?.data;
        if (d?.status === "connected") return false;
        return 3000;
      },
    },
  );

  // ─── Bulk Send Progress Polling ───
  const bulkProgress = trpc.rfv.bulkSendProgress.useQuery(undefined,
    { enabled: pollingEnabled , refetchInterval: pollingEnabled ? 1500 : false },
  );

  // Stop polling when completed
  useEffect(() => {
    if (bulkProgress.data && bulkProgress.data.status !== "running") {
      setPollingEnabled(false);
    }
  }, [bulkProgress.data]);

  // ─── Mutations ───
  const recalculate = trpc.rfv.recalculate.useMutation({
    onSuccess: (data) => {
      toast.success(`RFV recalculado: ${data.processed} contatos processados`);
      utils.rfv.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const checkNotifications = trpc.rfv.checkNotifications.useMutation({
    onSuccess: (data) => {
      if (data.notificationsCreated > 0) {
        toast.success(`${data.notificationsCreated} notificação(ões) criada(s) para ${data.changes.length} filtro(s) com novos contatos`);
        utils.notifications.invalidate();
      } else {
        toast.info("Nenhuma alteração detectada nos filtros RFV");
      }
      utils.rfv.filterSnapshots.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const importCsv = trpc.rfv.importCsv.useMutation({
    onSuccess: (data) => {
      toast.success(`Importação concluída: ${data.imported} contatos de ${data.totalRows} linhas`);
      setCsvDialogOpen(false);
      utils.rfv.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetData = trpc.rfv.resetData.useMutation({
    onSuccess: (data) => {
      toast.success(`Dados resetados: ${data.contactsDeleted} contatos e ${data.logsDeleted} logs removidos`);
      setResetDialogOpen(false);
      setResetConfirm("");
      utils.rfv.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkSend = trpc.rfv.bulkSend.useMutation({
    onSuccess: () => {
      setBulkDialogOpen(false);
      setProgressDialogOpen(true);
      setPollingEnabled(true);
      toast.info("Envio em massa iniciado!");
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelBulk = trpc.rfv.cancelBulkSend.useMutation({
    onSuccess: () => {
      toast.info("Envio em massa cancelado");
      setPollingEnabled(false);
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── CSV File handler ───
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        importCsv.mutate({ csvText: text });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ─── Selection helpers ───
  const currentPageIds = useMemo(() => {
    return (contacts.data?.contacts || []).map((c) => c.id);
  }, [contacts.data]);

  const allPageSelected = useMemo(() => {
    if (currentPageIds.length === 0) return false;
    return currentPageIds.every((id) => selectedIds.has(id));
  }, [currentPageIds, selectedIds]);

  const someSelected = selectedIds.size > 0;

  const toggleContact = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectAllPages(false);
  }, []);

  const togglePageAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        currentPageIds.forEach((id) => next.delete(id));
      } else {
        currentPageIds.forEach((id) => next.add(id));
      }
      return next;
    });
    setSelectAllPages(false);
  }, [allPageSelected, currentPageIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectAllPages(false);
  }, []);

  // ─── Bulk send handler ───
  const handleBulkSend = () => {
    if (!activeSession.data?.sessionId) {
      toast.error("Nenhuma sessão WhatsApp conectada. Conecte-se primeiro.");
      return;
    }
    if (!messageTemplate.trim()) {
      toast.error("Digite uma mensagem para enviar.");
      return;
    }
    const ids = Array.from(selectedIds);
    bulkSend.mutate({ contactIds: ids,
      messageTemplate: messageTemplate.trim(),
      sessionId: activeSession.data.sessionId,
      delayMs: delayMode === "fixed" ? delaySeconds * 1000 : Math.round((delayMinSeconds + delayMaxSeconds) / 2) * 1000,
      randomDelay: delayMode === "random",
      delayMinMs: delayMode === "random" ? delayMinSeconds * 1000 : undefined,
      delayMaxMs: delayMode === "random" ? delayMaxSeconds * 1000 : undefined,
    });
  };

  // ─── Insert variable into template ───
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const insertVariable = (varName: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setMessageTemplate((prev) => prev + varName);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = messageTemplate.substring(0, start);
    const after = messageTemplate.substring(end);
    setMessageTemplate(before + varName + after);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + varName.length;
    }, 0);
  };

  const d = dashboard.data;
  const a = alerta.data;
  const c = contacts.data;
  const bp = bulkProgress.data;
  const sessionConnected = activeSession.data?.status === "connected";
  const sessionConnecting = activeSession.data?.status === "connecting";
  const sessionExists = !!activeSession.data?.sessionId;

  // Refetch session status when dialog opens
  useEffect(() => {
    if (bulkDialogOpen) {
      activeSession.refetch();
    }
  }, [bulkDialogOpen]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* ─── Header ─── */}
      <div className="shrink-0 border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              Matriz RFV
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Classificação automática de contatos por Recência, Frequência e Valor
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => recalculate.mutate()}
                    disabled={recalculate.isPending}
                  >
                    <RefreshCw className={`w-4 h-4 mr-1.5 ${recalculate.isPending ? "animate-spin" : ""}`} />
                    Recalcular
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Recalcular RFV a partir das negociações do CRM</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCsvDialogOpen(true)}
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Importar CSV
            </Button>

            <ExportRfvButton />

            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/campaigns")}
            >
              <MessageSquare className="w-4 h-4 mr-1.5" />
              Campanhas
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => checkNotifications.mutate()}
                    disabled={checkNotifications.isPending}
                  >
                    <Bell className={`w-4 h-4 mr-1.5 ${checkNotifications.isPending ? "animate-pulse" : ""}`} />
                    Verificar Alertas
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Verificar novos contatos nos filtros e gerar notificações</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setResetDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Resetar
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Scrollable Content ─── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">

          {/* ─── KPI Cards ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Contatos</p>
                    <p className="text-2xl font-bold mt-1">{d?.totalContatos ?? "—"}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Receita Total</p>
                    <p className="text-2xl font-bold mt-1">{d ? formatCurrency(d.receitaTotal) : "—"}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-500/10">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Oportunidades</p>
                    <p className="text-2xl font-bold mt-1">{d?.oportunidades ?? "—"}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-500/10">
                    <Target className="w-5 h-5 text-amber-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-sky-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Conversão Média</p>
                    <p className="text-2xl font-bold mt-1">{d ? `${d.conversaoMedia.toFixed(1)}%` : "—"}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-sky-500/10">
                    <TrendingUp className="w-5 h-5 text-sky-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── Audience Distribution ─── */}
          {d && d.audienceDistribution && d.audienceDistribution.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Distribuição por Público</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.audienceDistribution.map((item) => {
                    const ac = audienceConfig[item.audienceType] || audienceConfig.desconhecido;
                    return (
                      <button
                        key={item.audienceType}
                        onClick={() => { setAudienceFilter(audienceFilter === item.audienceType ? "all" : item.audienceType); setPage(1); }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                          audienceFilter === item.audienceType
                            ? "ring-2 ring-primary border-primary"
                            : "border-transparent hover:border-border"
                        } ${ac.bg} ${ac.color}`}
                      >
                        {ac.icon}
                        {ac.label}
                        <span className="ml-1 font-bold">{item.count}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Smart Filters ─── */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtros Inteligentes</span>
                {smartFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs ml-auto"
                    onClick={() => { setSmartFilter(null); setPage(1); }}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Limpar filtro
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {Object.entries(smartFilterConfig).map(([key, cfg]) => {
                  const count = smartCounts.data?.[key as keyof typeof smartCounts.data] ?? 0;
                  const isActive = smartFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSmartFilter(isActive ? null : key);
                        setPage(1);
                        // Clear audience filter when using smart filter
                        if (!isActive) setAudienceFilter("all");
                      }}
                      className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all ${
                        isActive
                          ? `${cfg.bg} ${cfg.border} ring-2 ring-offset-1 ring-current ${cfg.color}`
                          : `border-border hover:${cfg.bg} hover:${cfg.border}`
                      }`}
                    >
                      <div className={`flex items-center gap-1.5 ${isActive ? cfg.color : "text-muted-foreground"}`}>
                        {cfg.icon}
                        <span className="text-xs font-semibold">{cfg.label}</span>
                      </div>
                      <span className="text-lg font-bold">{count}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{cfg.description}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ─── Alerta Dinheiro Parado ─── */}
          {a && a.totalContatos > 0 && (
            <Card className="border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-700 dark:text-red-400">Dinheiro Parado</h3>
                    <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-0.5">
                      <strong>{a.totalContatos}</strong> contatos sem ação há 7+ dias — valor potencial de <strong>{formatCurrency(a.valorPotencial)}</strong>
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {a.distribuicao.map((item) => {
                        const ac = audienceConfig[item.audienceType] || audienceConfig.desconhecido;
                        return (
                          <Badge key={item.audienceType} variant="outline" className={`text-[10px] ${ac.color}`}>
                            {ac.label}: {item.count}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Filters & Search ─── */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={audienceFilter} onValueChange={(v) => { setAudienceFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Público" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os públicos</SelectItem>
                {Object.entries(audienceConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <span className={config.color}>{config.icon}</span>
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
              className="shrink-0"
            >
              <ArrowUpDown className={`w-4 h-4 transition-transform ${sortDir === "asc" ? "rotate-180" : ""}`} />
            </Button>
          </div>

          {/* ─── Select All Header ─── */}
          {c && c.contacts.length > 0 && (
            <div className="flex items-center gap-3 px-1">
              <Checkbox
                checked={allPageSelected}
                onCheckedChange={togglePageAll}
                id="select-all"
              />
              <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                {allPageSelected ? "Desmarcar todos desta página" : "Selecionar todos desta página"}
              </label>
              {someSelected && (
                <span className="text-sm font-medium text-primary">
                  {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* ─── Contact List ─── */}
          {contacts.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : c && c.contacts.length > 0 ? (
            <div className="space-y-2">
              {c.contacts.map((contact) => {
                const ac = audienceConfig[contact.audienceType] || audienceConfig.desconhecido;
                const flag = contact.rfvFlag !== "none" ? flagConfig[contact.rfvFlag] : null;
                const conv = conversionBadge(Number(contact.taxaConversao));
                const waLink = normalizePhoneForWa(contact.phone);
                const isSelected = selectedIds.has(contact.id);

                return (
                  <Card
                    key={contact.id}
                    className={`hover:shadow-md transition-all cursor-pointer ${
                      isSelected ? "ring-2 ring-primary bg-primary/5" : ""
                    }`}
                    onClick={() => toggleContact(contact.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Checkbox */}
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleContact(contact.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        />

                        {/* Avatar / Audience icon */}
                        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${ac.bg}`}>
                          <span className={ac.color}>{ac.icon}</span>
                        </div>

                        {/* Name & contact info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate">{contact.name}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ac.color}`}>
                              {ac.label}
                            </Badge>
                            {flag && (
                              <Badge className={`text-[10px] px-1.5 py-0 ${flag.bg} ${flag.color} border-0`}>
                                {flag.label}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {contact.email && <span className="truncate max-w-[200px]">{contact.email}</span>}
                            {contact.phone && <span>{contact.phone}</span>}
                          </div>
                        </div>

                        {/* Metrics */}
                        <div className="hidden md:flex items-center gap-4 shrink-0 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground">Valor</p>
                            <p className="text-sm font-semibold">{formatCurrency(contact.vScore)}</p>
                          </div>
                          <Separator orientation="vertical" className="h-8" />
                          <div>
                            <p className="text-xs text-muted-foreground">Compras</p>
                            <p className="text-sm font-semibold">{contact.fScore}</p>
                          </div>
                          <Separator orientation="vertical" className="h-8" />
                          <div>
                            <p className="text-xs text-muted-foreground">Recência</p>
                            <p className="text-sm font-semibold">{contact.rScore === 9999 ? "—" : `${contact.rScore}d`}</p>
                          </div>
                          <Separator orientation="vertical" className="h-8" />
                          <div>
                            <p className="text-xs text-muted-foreground">Conversão</p>
                            <Badge variant={conv.variant} className="text-[10px]">{Number(contact.taxaConversao).toFixed(0)}% {conv.label}</Badge>
                          </div>
                          <Separator orientation="vertical" className="h-8" />
                          <div>
                            <p className="text-xs text-muted-foreground">Atend.</p>
                            <p className="text-sm font-semibold">{contact.totalAtendimentos}</p>
                          </div>
                        </div>

                        {/* Mobile metrics */}
                        <div className="flex md:hidden flex-col items-end gap-1 shrink-0">
                          <span className="text-sm font-semibold">{formatCurrency(contact.vScore)}</span>
                          <span className="text-xs text-muted-foreground">{contact.fScore} compras</span>
                        </div>

                        {/* WhatsApp link */}
                        {waLink && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Phone className="w-4 h-4 text-emerald-600" />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent>Abrir WhatsApp</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground/40" />
                <h3 className="mt-4 text-lg font-semibold">Nenhum contato encontrado</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Importe um CSV ou recalcule a partir das negociações do CRM para começar.
                </p>
                <div className="flex items-center justify-center gap-3 mt-4">
                  <Button variant="outline" onClick={() => setCsvDialogOpen(true)}>
                    <Upload className="w-4 h-4 mr-1.5" />
                    Importar CSV
                  </Button>
                  <Button onClick={() => recalculate.mutate()} disabled={recalculate.isPending}>
                    <RefreshCw className={`w-4 h-4 mr-1.5 ${recalculate.isPending ? "animate-spin" : ""}`} />
                    Recalcular do CRM
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Pagination ─── */}
          {c && c.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Mostrando {((c.page - 1) * c.pageSize) + 1}–{Math.min(c.page * c.pageSize, c.total)} de {c.total}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm px-3">
                  {c.page} / {c.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= c.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Floating Action Bar ─── */}
      {someSelected && (
        <div className="shrink-0 border-t bg-card px-6 py-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">
                {selectedIds.size} contato{selectedIds.size !== 1 ? "s" : ""} selecionado{selectedIds.size !== 1 ? "s" : ""}
              </span>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="w-3.5 h-3.5 mr-1" />
                Limpar
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      onClick={() => setBulkDialogOpen(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Send className="w-4 h-4 mr-1.5" />
                      Enviar WhatsApp
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {sessionConnected
                      ? `Enviar mensagem para ${selectedIds.size} contato(s)`
                      : "Conecte o WhatsApp primeiro"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bulk Send Compose Dialog ─── */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-600" />
              Envio em Massa — WhatsApp
            </DialogTitle>
            <DialogDescription>
              Envie uma mensagem personalizada para {selectedIds.size} contato{selectedIds.size !== 1 ? "s" : ""} selecionado{selectedIds.size !== 1 ? "s" : ""}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
            {/* WhatsApp session status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              sessionConnected
                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                : sessionConnecting
                  ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                  : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
            }`}>
              {sessionConnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <div className={`w-2 h-2 rounded-full ${sessionConnected ? "bg-emerald-500" : "bg-red-500"}`} />
              )}
              {sessionConnected
                ? "WhatsApp conectado"
                : sessionConnecting
                  ? "WhatsApp reconectando..."
                  : "WhatsApp desconectado"}
            </div>

            {/* Message template */}
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                ref={textareaRef}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Olá {primeiro_nome}, tudo bem? ..."
                rows={5}
                className="resize-none"
              />
              <div className="flex flex-wrap gap-1.5">
                {templateVars.map((tv) => (
                  <button
                    key={tv.var}
                    onClick={() => insertVariable(tv.var)}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                    title={tv.desc}
                  >
                    {tv.var}
                  </button>
                ))}
              </div>
            </div>

            {/* Delay setting */}
            <div className="space-y-3">
              <Label className="shrink-0">Intervalo entre mensagens:</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDelayMode("random")}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    delayMode === "random"
                      ? "bg-[#600FED] text-white border-[#600FED]"
                      : "bg-transparent text-muted-foreground border-border hover:border-[#600FED]/50"
                  }`}
                >
                  Aleatório (Recomendado)
                </button>
                <button
                  type="button"
                  onClick={() => setDelayMode("fixed")}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    delayMode === "fixed"
                      ? "bg-[#600FED] text-white border-[#600FED]"
                      : "bg-transparent text-muted-foreground border-border hover:border-[#600FED]/50"
                  }`}
                >
                  Fixo
                </button>
              </div>

              {/* Presets: Curto / Médio / Longo */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Velocidade:</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { label: "Rápido", desc: delayMode === "random" ? "3s – 10s" : "5s", icon: "⚡",
                      apply: () => delayMode === "random" ? (setDelayMinSeconds(3), setDelayMaxSeconds(10)) : setDelaySeconds(5) },
                    { label: "Moderado", desc: delayMode === "random" ? "15s – 60s" : "30s", icon: "⏱",
                      apply: () => delayMode === "random" ? (setDelayMinSeconds(15), setDelayMaxSeconds(60)) : setDelaySeconds(30) },
                    { label: "Seguro", desc: delayMode === "random" ? "60s – 300s" : "120s", icon: "🛡",
                      apply: () => delayMode === "random" ? (setDelayMinSeconds(60), setDelayMaxSeconds(300)) : setDelaySeconds(120) },
                  ] as const).map((preset) => {
                    const isActive = delayMode === "random"
                      ? (preset.label === "Rápido" && delayMinSeconds === 3 && delayMaxSeconds === 10)
                        || (preset.label === "Moderado" && delayMinSeconds === 15 && delayMaxSeconds === 60)
                        || (preset.label === "Seguro" && delayMinSeconds === 60 && delayMaxSeconds === 300)
                      : (preset.label === "Rápido" && delaySeconds === 5)
                        || (preset.label === "Moderado" && delaySeconds === 30)
                        || (preset.label === "Seguro" && delaySeconds === 120);
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => preset.apply()}
                        className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-xs border transition-colors ${
                          isActive
                            ? "bg-[#600FED]/10 border-[#600FED] text-[#600FED]"
                            : "bg-transparent border-border text-muted-foreground hover:border-[#600FED]/40"
                        }`}
                      >
                        <span className="text-base">{preset.icon}</span>
                        <span className="font-medium">{preset.label}</span>
                        <span className="text-[10px] opacity-70">{preset.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {delayMode === "random" ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Intervalo aleatório entre cada mensagem para simular comportamento humano e evitar bloqueios.
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Mínimo</Label>
                      <Select value={String(delayMinSeconds)} onValueChange={(v) => setDelayMinSeconds(Number(v))}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2s</SelectItem>
                          <SelectItem value="3">3s</SelectItem>
                          <SelectItem value="5">5s</SelectItem>
                          <SelectItem value="8">8s</SelectItem>
                          <SelectItem value="10">10s</SelectItem>
                          <SelectItem value="15">15s</SelectItem>
                          <SelectItem value="20">20s</SelectItem>
                          <SelectItem value="30">30s</SelectItem>
                          <SelectItem value="45">45s</SelectItem>
                          <SelectItem value="60">1 min</SelectItem>
                          <SelectItem value="120">2 min</SelectItem>
                          <SelectItem value="180">3 min</SelectItem>
                          <SelectItem value="300">5 min</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <span className="text-muted-foreground mt-5">—</span>
                    <div className="flex-1">
                      <Label className="text-xs">Máximo</Label>
                      <Select value={String(delayMaxSeconds)} onValueChange={(v) => setDelayMaxSeconds(Number(v))}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5s</SelectItem>
                          <SelectItem value="8">8s</SelectItem>
                          <SelectItem value="10">10s</SelectItem>
                          <SelectItem value="15">15s</SelectItem>
                          <SelectItem value="20">20s</SelectItem>
                          <SelectItem value="30">30s</SelectItem>
                          <SelectItem value="45">45s</SelectItem>
                          <SelectItem value="60">1 min</SelectItem>
                          <SelectItem value="90">1.5 min</SelectItem>
                          <SelectItem value="120">2 min</SelectItem>
                          <SelectItem value="180">3 min</SelectItem>
                          <SelectItem value="300">5 min</SelectItem>
                          <SelectItem value="420">7 min</SelectItem>
                          <SelectItem value="600">10 min</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Intervalo fixo entre cada mensagem.
                  </p>
                  <Select value={String(delaySeconds)} onValueChange={(v) => setDelaySeconds(Number(v))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 segundos</SelectItem>
                      <SelectItem value="3">3 segundos</SelectItem>
                      <SelectItem value="5">5 segundos</SelectItem>
                      <SelectItem value="8">8 segundos</SelectItem>
                      <SelectItem value="10">10 segundos</SelectItem>
                      <SelectItem value="15">15 segundos</SelectItem>
                      <SelectItem value="20">20 segundos</SelectItem>
                      <SelectItem value="30">30 segundos</SelectItem>
                      <SelectItem value="45">45 segundos</SelectItem>
                      <SelectItem value="60">1 minuto</SelectItem>
                      <SelectItem value="90">1 min 30s</SelectItem>
                      <SelectItem value="120">2 minutos</SelectItem>
                      <SelectItem value="180">3 minutos</SelectItem>
                      <SelectItem value="300">5 minutos</SelectItem>
                      <SelectItem value="420">7 minutos</SelectItem>
                      <SelectItem value="600">10 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Preview */}
            {messageTemplate.trim() && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Pré-visualização:</Label>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm whitespace-pre-wrap">
                  {messageTemplate
                    .replace(/\{nome\}/gi, "João da Silva")
                    .replace(/\{primeiro_nome\}/gi, "João")
                    .replace(/\{email\}/gi, "joao@email.com")
                    .replace(/\{telefone\}/gi, "(11) 99999-0000")
                    .replace(/\{publico\}/gi, "oportunidade")
                    .replace(/\{valor\}/gi, "R$ 1.500,00")}
                </div>
              </div>
            )}

            {/* Estimated time */}
            <div className="text-xs text-muted-foreground">
              {(() => {
                const avgDelay = delayMode === "random"
                  ? (delayMinSeconds + delayMaxSeconds) / 2
                  : delaySeconds;
                const totalSec = selectedIds.size * avgDelay;
                const hours = Math.floor(totalSec / 3600);
                const mins = Math.ceil((totalSec % 3600) / 60);
                const formatDelay = (s: number) => s >= 60 ? `${Math.round(s / 60)} min` : `${s}s`;
                const timeStr = hours > 0
                  ? `${hours}h ${mins > 0 ? `${mins}min` : ""}`
                  : mins > 0 ? `${mins} minuto${mins !== 1 ? "s" : ""}` : "< 1 minuto";
                return delayMode === "random"
                  ? <>Tempo estimado: ~{timeStr} (intervalo {formatDelay(delayMinSeconds)}–{formatDelay(delayMaxSeconds)})</>
                  : <>Tempo estimado: ~{timeStr}</>;
              })()}
            </div>
          </div>

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleBulkSend}
              disabled={!messageTemplate.trim() || !sessionConnected || sessionConnecting || bulkSend.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {bulkSend.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Iniciando...</>
              ) : (
                <><Send className="w-4 h-4 mr-1.5" /> Enviar para {selectedIds.size} contatos</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Bulk Send Progress Dialog ─── */}
      <Dialog open={progressDialogOpen} onOpenChange={(open) => {
        if (!open && bp?.status !== "running") {
          setProgressDialogOpen(false);
          clearSelection();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bp?.status === "running" ? (
                <><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /> Enviando mensagens...</>
              ) : bp?.status === "cancelled" ? (
                <><Ban className="w-5 h-5 text-amber-600" /> Envio cancelado</>
              ) : (
                <><CheckCircle2 className="w-5 h-5 text-emerald-600" /> Envio concluído</>
              )}
            </DialogTitle>
          </DialogHeader>

          {bp && (
            <div className="space-y-4">
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{bp.processed} / {bp.total}</span>
                </div>
                <Progress value={bp.total > 0 ? (bp.processed / bp.total) * 100 : 0} className="h-2" />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                  <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-600" />
                  <p className="text-lg font-bold mt-1 text-emerald-700 dark:text-emerald-400">{bp.sent}</p>
                  <p className="text-xs text-muted-foreground">Enviados</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-center">
                  <AlertCircle className="w-5 h-5 mx-auto text-red-600" />
                  <p className="text-lg font-bold mt-1 text-red-700 dark:text-red-400">{bp.failed}</p>
                  <p className="text-xs text-muted-foreground">Falhas</p>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
                  <SkipForward className="w-5 h-5 mx-auto text-amber-600" />
                  <p className="text-lg font-bold mt-1 text-amber-700 dark:text-amber-400">{bp.skipped}</p>
                  <p className="text-xs text-muted-foreground">Sem telefone</p>
                </div>
              </div>

              {/* Recent results */}
              {bp.results.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  <Label className="text-xs text-muted-foreground">Últimos resultados:</Label>
                  {bp.results.slice(-10).reverse().map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-muted/50">
                      {r.status === "sent" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                      {r.status === "failed" && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      {r.status === "skipped" && <SkipForward className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      <span className="truncate flex-1">{r.name}</span>
                      {r.error && <span className="text-muted-foreground truncate max-w-[150px]">{r.error}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {bp?.status === "running" ? (
              <Button
                variant="destructive"
                onClick={() => cancelBulk.mutate()}
                disabled={cancelBulk.isPending}
              >
                <Ban className="w-4 h-4 mr-1.5" />
                Cancelar Envio
              </Button>
            ) : (
              <Button onClick={() => { setProgressDialogOpen(false); clearSelection(); }}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── CSV Import Dialog ─── */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Importar CSV
            </DialogTitle>
            <DialogDescription>
              Faça upload de um arquivo CSV com suas negociações. O sistema irá agrupar por contato e calcular o RFV automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
              <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                Arraste um arquivo CSV ou clique para selecionar
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleCsvUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => fileInputRef.current?.click()}
                disabled={importCsv.isPending}
              >
                {importCsv.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                    Importando...
                  </>
                ) : (
                  "Selecionar arquivo"
                )}
              </Button>
            </div>

            <div className="rounded-lg bg-muted/50 p-4 text-xs space-y-1">
              <p className="font-medium text-sm mb-2">Colunas aceitas:</p>
              <div className="grid grid-cols-2 gap-1">
                <span><strong>Nome</strong> → name</span>
                <span><strong>Email</strong> → email</span>
                <span><strong>Telefone</strong> → phone</span>
                <span><strong>Valor</strong> → valor</span>
                <span><strong>Estado</strong> → estado</span>
                <span><strong>Data fechamento</strong> → data</span>
                <span><strong>Data criação</strong> → criação</span>
              </div>
              <p className="mt-2 text-muted-foreground">
                Estados aceitos: em andamento, aberto, open, perdido, perdida, lost, vendido, ganho, won
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Reset Dialog ─── */}
      <Dialog open={resetDialogOpen} onOpenChange={(open) => { setResetDialogOpen(open); if (!open) setResetConfirm(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Resetar Dados RFV
            </DialogTitle>
            <DialogDescription>
              Esta ação irá excluir permanentemente todos os contatos RFV e logs de ação desta conta.
              Os dados do CRM (contatos, negociações) não serão afetados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm">
              Digite <strong>RESETAR</strong> para confirmar:
            </p>
            <Input
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="RESETAR"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetDialogOpen(false); setResetConfirm(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={resetConfirm !== "RESETAR" || resetData.isPending}
              onClick={() => resetData.mutate()}
            >
              {resetData.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Resetando...</>
              ) : (
                "Excluir Tudo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
