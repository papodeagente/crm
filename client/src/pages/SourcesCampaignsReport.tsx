import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import DateRangeFilter, { useDateFilter } from "@/components/DateRangeFilter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ArrowLeft, Filter, RotateCcw, TrendingUp, DollarSign, Hash, Target,
  Trophy, XCircle, Clock, ChevronRight, Loader2, ExternalLink, SlidersHorizontal,
  Megaphone, Globe, Search,
} from "lucide-react";
import { useLocation } from "wouter";

// ─── Helpers ───
function fmt(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function fmtPct(v: number): string { return `${v.toFixed(1)}%`; }
function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

const CHART_COLORS = [
  "#7c3aed", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#84cc16", "#f97316", "#ec4899",
  "#6366f1", "#14b8a6", "#eab308", "#e11d48", "#0ea5e9",
];

const VIEW_MODES = [
  { value: "won" as const, label: "Vendas", icon: Trophy, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { value: "lost" as const, label: "Perdas", icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
  { value: "open" as const, label: "Ativas", icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10" },
];

// ─── Advanced Filters State ───
interface AdvancedFilters {
  pipelineId?: number;
  stageId?: number;
  ownerUserId?: number;
  teamId?: number;
  accountId?: number;
  lossReasonId?: number;
  productId?: number;
  titleSearch?: string;
  valueMin?: number;
  valueMax?: number;
  channelOrigin?: string;
  probabilityMin?: number;
  probabilityMax?: number;
  lastActivityDateFrom?: string;
  lastActivityDateTo?: string;
  expectedCloseDateFrom?: string;
  expectedCloseDateTo?: string;
}

const EMPTY_ADV: AdvancedFilters = {};

// ─── Main Component ───
export default function SourcesCampaignsReport() {
  const [, navigate] = useLocation();

  // ─── State ───
  const [viewMode, setViewMode] = useState<"won" | "lost" | "open">("won");
  const [activeTab, setActiveTab] = useState<"fontes" | "campanhas">("fontes");
  const dateFilter = useDateFilter("last30");

  // UTM Filters (top bar)
  const [utmSource, setUtmSource] = useState<string>("");
  const [utmMedium, setUtmMedium] = useState<string>("");
  const [utmCampaign, setUtmCampaign] = useState<string>("");
  const [utmContent, setUtmContent] = useState<string>("");
  const [utmTerm, setUtmTerm] = useState<string>("");
  const [leadSource, setLeadSource] = useState<string>("");
  const [campaignName, setCampaignName] = useState<string>("");

  // Advanced filters (side panel)
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>(EMPTY_ADV);
  const [advOpen, setAdvOpen] = useState(false);
  const [localAdv, setLocalAdv] = useState<AdvancedFilters>(EMPTY_ADV);

  // Deal list page
  const [dealPage, setDealPage] = useState(1);

  // Count active advanced filters
  const advCount = useMemo(() => {
    let c = 0;
    if (advFilters.pipelineId) c++;
    if (advFilters.stageId) c++;
    if (advFilters.ownerUserId) c++;
    if (advFilters.teamId) c++;
    if (advFilters.accountId) c++;
    if (advFilters.lossReasonId) c++;
    if (advFilters.productId) c++;
    if (advFilters.titleSearch) c++;
    if (advFilters.valueMin || advFilters.valueMax) c++;
    if (advFilters.channelOrigin) c++;
    if (advFilters.probabilityMin !== undefined || advFilters.probabilityMax !== undefined) c++;
    if (advFilters.lastActivityDateFrom || advFilters.lastActivityDateTo) c++;
    if (advFilters.expectedCloseDateFrom || advFilters.expectedCloseDateTo) c++;
    return c;
  }, [advFilters]);

  // Count active UTM filters
  const utmCount = useMemo(() => {
    let c = 0;
    if (utmSource) c++;
    if (utmMedium) c++;
    if (utmCampaign) c++;
    if (utmContent) c++;
    if (utmTerm) c++;
    if (leadSource) c++;
    if (campaignName) c++;
    return c;
  }, [utmSource, utmMedium, utmCampaign, utmContent, utmTerm, leadSource, campaignName]);

  // ─── Build filter input ───
  const filterInput = useMemo(() => ({
    dateFrom: dateFilter.dates.dateFrom,
    dateTo: dateFilter.dates.dateTo,
    viewMode,
    utmSource: utmSource || undefined,
    utmMedium: utmMedium || undefined,
    utmCampaign: utmCampaign || undefined,
    utmContent: utmContent || undefined,
    utmTerm: utmTerm || undefined,
    leadSource: leadSource || undefined,
    campaignName: campaignName || undefined,
    ...advFilters,
  }), [dateFilter.dates, viewMode, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, leadSource, campaignName, advFilters]);

  // ─── Queries ───
  const optionsQ = trpc.sourcesCampaigns.filterOptions.useQuery();
  const overviewQ = trpc.sourcesCampaigns.overview.useQuery(filterInput);
  const sourcesQ = trpc.sourcesCampaigns.bySources.useQuery(filterInput);
  const campaignsQ = trpc.sourcesCampaigns.byCampaigns.useQuery(filterInput);
  const dealListQ = trpc.sourcesCampaigns.dealList.useQuery({
    ...filterInput,
    page: dealPage,
    limit: 25,
  });

  const opts = optionsQ.data;
  const overview = overviewQ.data;
  const isLoading = overviewQ.isLoading || sourcesQ.isLoading || campaignsQ.isLoading;

  // ─── Handlers ───
  const clearUtmFilters = useCallback(() => {
    setUtmSource(""); setUtmMedium(""); setUtmCampaign("");
    setUtmContent(""); setUtmTerm(""); setLeadSource(""); setCampaignName("");
  }, []);

  const openAdvPanel = useCallback(() => {
    setLocalAdv(advFilters);
    setAdvOpen(true);
  }, [advFilters]);

  const applyAdv = useCallback(() => {
    setAdvFilters(localAdv);
    setAdvOpen(false);
    setDealPage(1);
  }, [localAdv]);

  const clearAdv = useCallback(() => {
    setLocalAdv(EMPTY_ADV);
    setAdvFilters(EMPTY_ADV);
    setAdvOpen(false);
  }, []);

  const setAdv = useCallback((key: keyof AdvancedFilters, value: any) => {
    setLocalAdv(prev => ({ ...prev, [key]: value || undefined }));
  }, []);

  // ─── View mode info ───
  const currentView = VIEW_MODES.find(v => v.value === viewMode)!;

  // ─── Render ───
  return (
    <div className="page-content space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/analytics")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Fontes e Campanhas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Análise de origem de resultados por fonte, campanha e rastreamento UTM
          </p>
        </div>
      </div>

      {/* ─── View Mode Toggle + Date ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
          {VIEW_MODES.map(vm => (
            <Button
              key={vm.value}
              variant={viewMode === vm.value ? "default" : "ghost"}
              size="sm"
              onClick={() => { setViewMode(vm.value); setDealPage(1); }}
              className={`gap-2 ${viewMode === vm.value ? "" : "text-muted-foreground"}`}
            >
              <vm.icon className={`h-4 w-4 ${viewMode === vm.value ? "" : vm.color}`} />
              {vm.label}
            </Button>
          ))}
        </div>
        <div className="flex-1" />
        <DateRangeFilter
          preset={dateFilter.preset}
          onPresetChange={dateFilter.setPreset}
          customFrom={dateFilter.customFrom}
          onCustomFromChange={dateFilter.setCustomFrom}
          customTo={dateFilter.customTo}
          onCustomToChange={dateFilter.setCustomTo}
          onReset={dateFilter.reset}
        />
        <Button variant="outline" size="sm" onClick={openAdvPanel} className="gap-2 relative">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros Avançados
          {advCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-violet-600 text-white">
              {advCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* ─── UTM Filters Bar ─── */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtros de Rastreamento</span>
            {utmCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{utmCount} ativo{utmCount > 1 ? "s" : ""}</Badge>
            )}
            {utmCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearUtmFilters} className="ml-auto text-xs text-red-500 hover:text-red-600 h-7 px-2">
                <RotateCcw className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {/* UTM Source */}
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground uppercase">UTM Source</Label>
              <Select value={utmSource || "_all"} onValueChange={v => { setUtmSource(v === "_all" ? "" : v); setDealPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas</SelectItem>
                  {(opts?.utmSources || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* UTM Medium */}
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground uppercase">UTM Medium</Label>
              <Select value={utmMedium || "_all"} onValueChange={v => { setUtmMedium(v === "_all" ? "" : v); setDealPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas</SelectItem>
                  {(opts?.utmMediums || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* UTM Campaign */}
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground uppercase">UTM Campaign</Label>
              <Select value={utmCampaign || "_all"} onValueChange={v => { setUtmCampaign(v === "_all" ? "" : v); setDealPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas</SelectItem>
                  {(opts?.utmCampaigns || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* UTM Content */}
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground uppercase">UTM Content</Label>
              <Select value={utmContent || "_all"} onValueChange={v => { setUtmContent(v === "_all" ? "" : v); setDealPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas</SelectItem>
                  {(opts?.utmContents || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* UTM Term */}
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground uppercase">UTM Term</Label>
              <Select value={utmTerm || "_all"} onValueChange={v => { setUtmTerm(v === "_all" ? "" : v); setDealPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas</SelectItem>
                  {(opts?.utmTerms || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Fonte Padrão Clinilucro */}
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground uppercase">Fonte (Entur)</Label>
              <Select value={leadSource || "_all"} onValueChange={v => { setLeadSource(v === "_all" ? "" : v); setDealPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas</SelectItem>
                  {(opts?.leadSources || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Campanha Padrão Clinilucro */}
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground uppercase">Campanha (Entur)</Label>
              <Select value={campaignName || "_all"} onValueChange={v => { setCampaignName(v === "_all" ? "" : v); setDealPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas</SelectItem>
                  {(opts?.utmCampaigns || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${currentView.bg}`}>
              <Hash className={`h-5 w-5 ${currentView.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {viewMode === "won" ? "Negociações Ganhas" : viewMode === "lost" ? "Negociações Perdidas" : "Negociações Ativas"}
              </p>
              <p className="text-2xl font-bold mt-0.5">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (overview?.totalDeals ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${currentView.bg}`}>
              <DollarSign className={`h-5 w-5 ${currentView.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor Total</p>
              <p className="text-2xl font-bold mt-0.5">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : fmt(overview?.totalValueCents ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${currentView.bg}`}>
              <Target className={`h-5 w-5 ${currentView.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Ticket Médio</p>
              <p className="text-2xl font-bold mt-0.5">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : fmt(overview?.avgTicket ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Tabs: Fontes / Campanhas ─── */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="fontes" className="gap-2">
            <Globe className="h-4 w-4" /> Fontes
          </TabsTrigger>
          <TabsTrigger value="campanhas" className="gap-2">
            <Megaphone className="h-4 w-4" /> Campanhas
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Fontes ─── */}
        <TabsContent value="fontes" className="space-y-4 mt-4">
          <SourcesTab data={sourcesQ.data || []} isLoading={sourcesQ.isLoading} viewMode={viewMode} />
        </TabsContent>

        {/* ─── Tab: Campanhas ─── */}
        <TabsContent value="campanhas" className="space-y-4 mt-4">
          <CampaignsTab data={campaignsQ.data || []} isLoading={campaignsQ.isLoading} viewMode={viewMode} />
        </TabsContent>
      </Tabs>

      {/* ─── Deal List Table ─── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Negociações ({dealListQ.data?.total ?? 0})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {dealListQ.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !dealListQ.data?.deals.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhuma negociação encontrada com os filtros aplicados.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Negociação</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>UTM Source</TableHead>
                      <TableHead>UTM Campaign</TableHead>
                      <TableHead>UTM Medium</TableHead>
                      <TableHead>UTM Content</TableHead>
                      <TableHead>UTM Term</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Data</TableHead>
                      {viewMode === "lost" && <TableHead>Motivo Perda</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dealListQ.data.deals.map(deal => (
                      <TableRow
                        key={deal.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/deal/${deal.id}`)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[200px]">{deal.title}</p>
                            <p className="text-xs text-muted-foreground">{deal.contactName || deal.accountName || "—"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-sm whitespace-nowrap">{fmt(deal.valueCents)}</TableCell>
                        <TableCell className="text-xs">{deal.leadSource || "—"}</TableCell>
                        <TableCell className="text-xs">{deal.utmSource || "—"}</TableCell>
                        <TableCell className="text-xs">{deal.utmCampaign || "—"}</TableCell>
                        <TableCell className="text-xs">{deal.utmMedium || "—"}</TableCell>
                        <TableCell className="text-xs">{deal.utmContent || "—"}</TableCell>
                        <TableCell className="text-xs">{deal.utmTerm || "—"}</TableCell>
                        <TableCell className="text-xs">{deal.ownerName || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] whitespace-nowrap">{deal.stageName || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(deal.createdAt)}</TableCell>
                        {viewMode === "lost" && <TableCell className="text-xs">{deal.lossReasonName || "—"}</TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              {dealListQ.data.total > 25 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Mostrando {((dealPage - 1) * 25) + 1}–{Math.min(dealPage * 25, dealListQ.data.total)} de {dealListQ.data.total}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={dealPage <= 1} onClick={() => setDealPage(p => p - 1)}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={dealPage * 25 >= dealListQ.data.total} onClick={() => setDealPage(p => p + 1)}>
                      Próximo
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Advanced Filters Side Panel ─── */}
      <Sheet open={advOpen} onOpenChange={setAdvOpen}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px] p-0 flex flex-col h-full overflow-hidden !gap-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b">
            <SheetTitle className="text-base">Filtros Avançados</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 px-5">
            <div className="space-y-5 py-4">
              {/* Funil */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Funil</Label>
                <Select value={localAdv.pipelineId ? String(localAdv.pipelineId) : "_all"} onValueChange={v => setAdv("pipelineId", v === "_all" ? undefined : Number(v))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos</SelectItem>
                    {(opts?.pipelines || []).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Etapa */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Etapa</Label>
                <Select value={localAdv.stageId ? String(localAdv.stageId) : "_all"} onValueChange={v => setAdv("stageId", v === "_all" ? undefined : Number(v))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todas</SelectItem>
                    {(opts?.stages || [])
                      .filter(s => !localAdv.pipelineId || s.pipelineId === localAdv.pipelineId)
                      .map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Responsável */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Responsável</Label>
                <Select value={localAdv.ownerUserId ? String(localAdv.ownerUserId) : "_all"} onValueChange={v => setAdv("ownerUserId", v === "_all" ? undefined : Number(v))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos</SelectItem>
                    {(opts?.owners || []).map(o => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Equipe */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Equipe</Label>
                <Select value={localAdv.teamId ? String(localAdv.teamId) : "_all"} onValueChange={v => setAdv("teamId", v === "_all" ? undefined : Number(v))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todas</SelectItem>
                    {(opts?.teams || []).map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Empresa */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Empresa</Label>
                <Select value={localAdv.accountId ? String(localAdv.accountId) : "_all"} onValueChange={v => setAdv("accountId", v === "_all" ? undefined : Number(v))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todas</SelectItem>
                    {(opts?.accounts || []).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Canal de Origem */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Canal de Origem</Label>
                <Select value={localAdv.channelOrigin || "_all"} onValueChange={v => setAdv("channelOrigin", v === "_all" ? undefined : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos</SelectItem>
                    {(opts?.channels || []).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Motivo de Perda */}
              {viewMode === "lost" && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Motivo de Perda</Label>
                  <Select value={localAdv.lossReasonId ? String(localAdv.lossReasonId) : "_all"} onValueChange={v => setAdv("lossReasonId", v === "_all" ? undefined : Number(v))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Todos</SelectItem>
                      {(opts?.lossReasons || []).map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Nome da Negociação */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome da Negociação</Label>
                <Input placeholder="Buscar por nome..." className="h-9" value={localAdv.titleSearch || ""} onChange={e => setAdv("titleSearch", e.target.value)} />
              </div>
              {/* Valor */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor Total</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" placeholder="R$ 0" className="h-9" value={localAdv.valueMin ? localAdv.valueMin / 100 : ""} onChange={e => setAdv("valueMin", e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined)} />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input type="number" placeholder="R$ 0" className="h-9" value={localAdv.valueMax ? localAdv.valueMax / 100 : ""} onChange={e => setAdv("valueMax", e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined)} />
                </div>
              </div>
              {/* Qualificação (Probabilidade) */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Qualificação (%)</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" placeholder="0" className="h-9" min={0} max={100} value={localAdv.probabilityMin ?? ""} onChange={e => setAdv("probabilityMin", e.target.value ? Number(e.target.value) : undefined)} />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input type="number" placeholder="100" className="h-9" min={0} max={100} value={localAdv.probabilityMax ?? ""} onChange={e => setAdv("probabilityMax", e.target.value ? Number(e.target.value) : undefined)} />
                </div>
              </div>
              {/* Data do Último Contato */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data do Último Contato</Label>
                <div className="flex items-center gap-2">
                  <Input type="date" className="h-9 text-xs" value={localAdv.lastActivityDateFrom || ""} onChange={e => setAdv("lastActivityDateFrom", e.target.value)} />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input type="date" className="h-9 text-xs" value={localAdv.lastActivityDateTo || ""} onChange={e => setAdv("lastActivityDateTo", e.target.value)} />
                </div>
              </div>
              {/* Data Previsão de Fechamento */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Previsão de Fechamento</Label>
                <div className="flex items-center gap-2">
                  <Input type="date" className="h-9 text-xs" value={localAdv.expectedCloseDateFrom || ""} onChange={e => setAdv("expectedCloseDateFrom", e.target.value)} />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input type="date" className="h-9 text-xs" value={localAdv.expectedCloseDateTo || ""} onChange={e => setAdv("expectedCloseDateTo", e.target.value)} />
                </div>
              </div>
              <div className="h-6" />
            </div>
          </ScrollArea>
          <SheetFooter className="border-t px-5 py-4 flex-row gap-3 shrink-0">
            <Button variant="outline" onClick={clearAdv} className="flex-1 gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
              <RotateCcw className="h-4 w-4" /> Limpar
            </Button>
            <Button onClick={applyAdv} className="flex-1 gap-2 bg-violet-600 hover:bg-violet-700 text-white">
              <Filter className="h-4 w-4" /> Aplicar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Sources Tab ───
function SourcesTab({ data, isLoading, viewMode }: {
  data: { source: string; count: number; valueCents: number; avgValueCents: number; percentage: number }[];
  isLoading: boolean;
  viewMode: string;
}) {
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data.length) return <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma fonte encontrada com os filtros aplicados.</div>;

  const chartData = data.slice(0, 10);
  const statusLabel = viewMode === "won" ? "Vendas" : viewMode === "lost" ? "Perdas" : "Ativas";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Bar Chart */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top Fontes por Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 40)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis type="number" tickFormatter={v => String(v)} />
              <YAxis type="category" dataKey="source" width={140} tick={{ fontSize: 11 }} />
              <RechartsTooltip
                formatter={(value: number) => [value, statusLabel]}
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)" }}
              />
              <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      {/* Pie Chart */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Distribuição por Fonte</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={chartData} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={100} label={({ source, percentage }) => `${source} (${percentage}%)`} labelLine={false}>
                {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <RechartsTooltip formatter={(value: number, name: string) => [value, name]} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      {/* Table */}
      <Card className="border-border/50 xl:col-span-2">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fonte</TableHead>
                <TableHead className="text-right">Negociações</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-right">Participação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={row.source}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="font-medium text-sm">{row.source}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{row.count}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(row.valueCents)}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(row.avgValueCents)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${row.percentage}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">{fmtPct(row.percentage)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Campaigns Tab ───
function CampaignsTab({ data, isLoading, viewMode }: {
  data: { campaign: string; count: number; valueCents: number; avgValueCents: number; percentage: number }[];
  isLoading: boolean;
  viewMode: string;
}) {
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data.length) return <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma campanha encontrada com os filtros aplicados.</div>;

  const chartData = data.slice(0, 10);
  const statusLabel = viewMode === "won" ? "Vendas" : viewMode === "lost" ? "Perdas" : "Ativas";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Bar Chart */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top Campanhas por Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 40)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis type="number" tickFormatter={v => String(v)} />
              <YAxis type="category" dataKey="campaign" width={140} tick={{ fontSize: 11 }} />
              <RechartsTooltip
                formatter={(value: number) => [value, statusLabel]}
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)" }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      {/* Pie Chart */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Distribuição por Campanha</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={chartData} dataKey="count" nameKey="campaign" cx="50%" cy="50%" outerRadius={100} label={({ campaign, percentage }) => `${campaign} (${percentage}%)`} labelLine={false}>
                {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <RechartsTooltip formatter={(value: number, name: string) => [value, name]} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      {/* Table */}
      <Card className="border-border/50 xl:col-span-2">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead className="text-right">Negociações</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-right">Participação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={row.campaign}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="font-medium text-sm">{row.campaign}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{row.count}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(row.valueCents)}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(row.avgValueCents)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${row.percentage}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">{fmtPct(row.percentage)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
