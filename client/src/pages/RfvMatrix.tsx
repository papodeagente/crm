import { useState, useRef, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useTenantId } from "@/hooks/useTenantId";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Users, DollarSign, Target, TrendingUp, Search,
  Upload, RefreshCw, Trash2, AlertTriangle, Phone,
  ArrowUpDown, ChevronLeft, ChevronRight, Star,
  ShieldAlert, UserCheck, MessageSquare, ExternalLink,
  BarChart3, FileSpreadsheet, XCircle,
} from "lucide-react";

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

export default function RfvMatrix() {
  const tenantId = useTenantId();
  const utils = trpc.useUtils();

  // ─── State ───
  const [search, setSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const dashboard = trpc.rfv.dashboard.useQuery({ tenantId }, { enabled: !!tenantId });
  const contacts = trpc.rfv.list.useQuery({
    tenantId,
    page,
    pageSize: 50,
    search: debouncedSearch || undefined,
    audienceType: audienceFilter !== "all" ? audienceFilter : undefined,
    sortBy,
    sortDir,
  }, { enabled: !!tenantId });
  const alerta = trpc.rfv.alertaDinheiroParado.useQuery({ tenantId }, { enabled: !!tenantId });

  // ─── Mutations ───
  const recalculate = trpc.rfv.recalculate.useMutation({
    onSuccess: (data) => {
      toast.success(`RFV recalculado: ${data.processed} contatos processados`);
      utils.rfv.invalidate();
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

  // ─── CSV File handler ───
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        importCsv.mutate({ tenantId, csvText: text });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const d = dashboard.data;
  const a = alerta.data;
  const c = contacts.data;

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
                    onClick={() => recalculate.mutate({ tenantId })}
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

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Conversão Média</p>
                    <p className="text-2xl font-bold mt-1">{d ? `${d.conversaoMedia.toFixed(1)}%` : "—"}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-purple-500/10">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── Audience Distribution ─── */}
          {d && d.audienceDistribution.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Distribuição por Público</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {d.audienceDistribution.map((item) => {
                    const config = audienceConfig[item.audienceType] || audienceConfig.desconhecido;
                    return (
                      <button
                        key={item.audienceType}
                        onClick={() => {
                          setAudienceFilter(audienceFilter === item.audienceType ? "all" : item.audienceType);
                          setPage(1);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${
                          audienceFilter === item.audienceType
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <span className={config.color}>{config.icon}</span>
                        <span className="font-medium">{config.label}</span>
                        <Badge variant="secondary" className="text-xs">{item.count}</Badge>
                        <span className="text-xs text-muted-foreground">{formatCurrency(item.totalValue)}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Alerta Dinheiro Parado ─── */}
          {a && a.totalContatos > 0 && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-800 dark:text-amber-200">Dinheiro Parado</h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                      <strong>{a.totalContatos}</strong> contatos sem ação há mais de 7 dias com valor potencial de{" "}
                      <strong>{formatCurrency(a.valorPotencial)}</strong>
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {a.distribuicao.map((item) => {
                        const config = audienceConfig[item.audienceType] || audienceConfig.desconhecido;
                        return (
                          <span key={item.audienceType} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${config.bg} ${config.color}`}>
                            {config.label}: {item.count} ({formatCurrency(item.valorPotencial)})
                          </span>
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

                return (
                  <Card key={contact.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
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
                  <Button onClick={() => recalculate.mutate({ tenantId })} disabled={recalculate.isPending}>
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
              Esta ação irá excluir permanentemente todos os contatos RFV e logs de ação desta agência.
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
              onClick={() => resetData.mutate({ tenantId })}
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
