import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DateRangeFilter, { useDateFilter } from "@/components/DateRangeFilter";
import DealFiltersPanel, { useDealFilters, DealFilterButton } from "@/components/DealFiltersPanel";
import {
  TrendingUp, DollarSign, Target, Trophy, BarChart3, Filter, ExternalLink,
  ArrowUpRight, ArrowDownRight, Percent, Hash, Eye, ChevronDown, ChevronUp,
  Calendar, RefreshCw, Info, Loader2, Download, Search
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area, ComposedChart, Line
} from "recharts";
import { useLocation } from "wouter";

const TENANT_ID = 1;

// ─── Helpers ───
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

const COLORS = {
  won: "#22c55e",
  lost: "#ef4444",
  open: "#3b82f6",
  total: "#8b5cf6",
  primary: "#8b5cf6",
  secondary: "#06b6d4",
};

const CHART_PALETTE = ["#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#f97316", "#14b8a6", "#6366f1", "#84cc16"];

const DIMENSION_LABELS: Record<string, string> = {
  utmSource: "UTM Source",
  utmMedium: "UTM Medium",
  utmCampaign: "UTM Campaign",
  utmTerm: "UTM Term",
  utmContent: "UTM Content",
  leadSource: "Origem do Lead",
  channelOrigin: "Canal de Origem",
};

// ─── KPI Card ───
function KPICard({ title, value, subtitle, icon, trend, color }: {
  title: string; value: string; subtitle?: string; icon: React.ReactNode; trend?: "up" | "down" | "neutral"; color?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold tracking-tight" style={color ? { color } : {}}>{value}</p>
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted/50">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Custom Tooltip for Recharts ───
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-sm">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">
            {entry.name.includes("Valor") || entry.name.includes("R$")
              ? formatCurrency(entry.value)
              : entry.name.includes("Taxa") || entry.name.includes("%")
                ? formatPercent(entry.value)
                : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main UTM Dashboard ───
export default function UTMDashboard() {
  const [, navigate] = useLocation();
  const dateFilter = useDateFilter("all");
  const [pipelineId, setPipelineId] = useState<number | undefined>(undefined);
  const [dimension, setDimension] = useState<"utmSource" | "utmMedium" | "utmCampaign" | "utmTerm" | "utmContent" | "leadSource" | "channelOrigin">("utmSource");
  const [detailTab, setDetailTab] = useState("chart");
  const [dealListStatus, setDealListStatus] = useState<"all" | "open" | "won" | "lost">("all");
  const [dealListSource, setDealListSource] = useState<string>("");
  const [dealListMedium, setDealListMedium] = useState<string>("");
  const [dealListCampaign, setDealListCampaign] = useState<string>("");
  const [expandedCross, setExpandedCross] = useState(false);
  const dealFilters = useDealFilters();

  const filterInput = useMemo(() => ({
    tenantId: TENANT_ID,
    dateFrom: dealFilters.filters.dateFrom || dateFilter.dates.dateFrom,
    dateTo: dealFilters.filters.dateTo || dateFilter.dates.dateTo,
    pipelineId,
    utmSource: dealFilters.filters.utmSource,
    utmMedium: dealFilters.filters.utmMedium,
    utmCampaign: dealFilters.filters.utmCampaign,
    leadSource: dealFilters.filters.leadSource,
    status: dealFilters.filters.status,
    accountId: dealFilters.filters.accountId,
    productId: dealFilters.filters.productId,
    valueMin: dealFilters.filters.valueMin,
    valueMax: dealFilters.filters.valueMax,
  }), [dateFilter.dates.dateFrom, dateFilter.dates.dateTo, pipelineId, dealFilters.filters]);

  // ─── Queries ───
  const overview = trpc.utmAnalytics.overview.useQuery(filterInput);
  const byDimension = trpc.utmAnalytics.byDimension.useQuery({ ...filterInput, dimension });
  const crossTable = trpc.utmAnalytics.crossTable.useQuery(filterInput);
  const timeline = trpc.utmAnalytics.timeline.useQuery(filterInput);
  const filterValues = trpc.utmAnalytics.filterValues.useQuery({ tenantId: TENANT_ID });
  const dealList = trpc.utmAnalytics.dealList.useQuery({
    ...filterInput,
    status: dealListStatus,
    utmSource: dealListSource || undefined,
    utmMedium: dealListMedium || undefined,
    utmCampaign: dealListCampaign || undefined,
    limit: 50,
  });

  // Pipeline list for filter
  const pipelines = trpc.crm.pipelines.list.useQuery({ tenantId: TENANT_ID });

  const ov = overview.data;
  const dimData = byDimension.data || [];
  const crossData = crossTable.data || [];
  const timelineData = timeline.data || [];
  const fv = filterValues.data;
  const isLoading = overview.isLoading;

  // ─── Derived chart data ───
  const pieData = useMemo(() => {
    if (!ov) return [];
    return [
      { name: "Ganhos", value: ov.wonDeals, color: COLORS.won },
      { name: "Perdidos", value: ov.lostDeals, color: COLORS.lost },
      { name: "Abertos", value: ov.openDeals, color: COLORS.open },
    ].filter(d => d.value > 0);
  }, [ov]);

  const topDimensions = useMemo(() => dimData.slice(0, 10), [dimData]);

  // Cross table limited
  const crossDisplay = expandedCross ? crossData : crossData.slice(0, 10);

  return (
    <div className="space-y-5">
      {/* ─── Filters ─── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <DateRangeFilter
              preset={dateFilter.preset}
              onPresetChange={dateFilter.setPreset}
              customFrom={dateFilter.customFrom}
              onCustomFromChange={dateFilter.setCustomFrom}
              customTo={dateFilter.customTo}
              onCustomToChange={dateFilter.setCustomTo}
              onReset={() => { dateFilter.reset(); setPipelineId(undefined); }}
            />
            <Select value={pipelineId ? String(pipelineId) : "all"} onValueChange={(v) => setPipelineId(v === "all" ? undefined : Number(v))}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Pipeline" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os pipelines</SelectItem>
                {(pipelines.data || []).map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dimension} onValueChange={(v: any) => setDimension(v)}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DIMENSION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DealFilterButton activeCount={dealFilters.activeCount} onClick={() => dealFilters.setIsOpen(true)} />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ─── KPI Cards ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KPICard
              title="Total de Negociações"
              value={String(ov?.totalDeals ?? 0)}
              subtitle={`${ov?.dealsWithUtm ?? 0} com UTM rastreado`}
              icon={<Hash className="h-4 w-4 text-muted-foreground" />}
            />
            <KPICard
              title="Vendas Ganhas"
              value={String(ov?.wonDeals ?? 0)}
              subtitle={formatCurrency(ov?.wonValueCents ?? 0)}
              icon={<Trophy className="h-4 w-4 text-emerald-500" />}
              color={COLORS.won}
            />
            <KPICard
              title="Taxa de Conversão"
              value={formatPercent(ov?.conversionRate ?? 0)}
              subtitle={`${ov?.wonDeals ?? 0} de ${ov?.totalDeals ?? 0}`}
              icon={<Target className="h-4 w-4 text-violet-500" />}
              color={COLORS.primary}
            />
            <KPICard
              title="Valor Total"
              value={formatCurrency(ov?.totalValueCents ?? 0)}
              subtitle={`Aberto: ${formatCurrency(ov?.openValueCents ?? 0)}`}
              icon={<DollarSign className="h-4 w-4 text-blue-500" />}
            />
            <KPICard
              title="Perdidos"
              value={String(ov?.lostDeals ?? 0)}
              subtitle={formatCurrency(ov?.lostValueCents ?? 0)}
              icon={<ArrowDownRight className="h-4 w-4 text-red-500" />}
              color={COLORS.lost}
            />
          </div>

          {/* ─── Main Charts Row ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Bar chart by dimension */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Vendas por {DIMENSION_LABELS[dimension]}
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      <p>Dados diretos do banco de dados. "Ganho" = status <strong>won</strong> na negociação.</p>
                      <p className="mt-1">Se uma venda for desmarcada, ela volta para "Aberto" ou "Perdido" automaticamente.</p>
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {topDimensions.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                    Nenhum dado encontrado para os filtros selecionados
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={topDimensions} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="dimension" width={120} tick={{ fontSize: 11 }} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Bar dataKey="wonDeals" name="Ganhos" fill={COLORS.won} radius={[0, 4, 4, 0]} stackId="stack" />
                      <Bar dataKey="lostDeals" name="Perdidos" fill={COLORS.lost} radius={[0, 0, 0, 0]} stackId="stack" />
                      <Bar dataKey="openDeals" name="Abertos" fill={COLORS.open} radius={[0, 4, 4, 0]} stackId="stack" />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Pie chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Distribuição de Status</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {pieData.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Sem dados</div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" paddingAngle={3}>
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── Timeline Chart ─── */}
          {timelineData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Evolução Mensal
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={timelineData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar yAxisId="left" dataKey="wonDeals" name="Ganhos" fill={COLORS.won} radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="lostDeals" name="Perdidos" fill={COLORS.lost} radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="openDeals" name="Abertos" fill={COLORS.open} radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="wonValueCents" name="Valor Ganho (R$)" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ─── Conversion Rate by Dimension ─── */}
          {topDimensions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Percent className="h-4 w-4 text-primary" />
                  Taxa de Conversão por {DIMENSION_LABELS[dimension]}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topDimensions} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="dimension" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar dataKey="conversionRate" name="Taxa de Conversão (%)" fill={COLORS.primary} radius={[4, 4, 0, 0]}>
                      {topDimensions.map((_, i) => (
                        <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ─── Detailed Table by Dimension ─── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                Detalhamento por {DIMENSION_LABELS[dimension]}
                <Badge variant="outline" className="text-[10px] ml-auto">{dimData.length} registros</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">{DIMENSION_LABELS[dimension]}</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Ganhos</TableHead>
                      <TableHead className="text-xs text-right">Perdidos</TableHead>
                      <TableHead className="text-xs text-right">Abertos</TableHead>
                      <TableHead className="text-xs text-right">Conversão</TableHead>
                      <TableHead className="text-xs text-right">Valor Total</TableHead>
                      <TableHead className="text-xs text-right">Valor Ganho</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dimData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum dado encontrado</TableCell>
                      </TableRow>
                    ) : (
                      dimData.map((row, i) => (
                        <TableRow key={i} className="text-xs">
                          <TableCell className="font-medium max-w-[200px] truncate">{row.dimension}</TableCell>
                          <TableCell className="text-right font-semibold">{row.totalDeals}</TableCell>
                          <TableCell className="text-right text-emerald-600 font-semibold">{row.wonDeals}</TableCell>
                          <TableCell className="text-right text-red-500">{row.lostDeals}</TableCell>
                          <TableCell className="text-right text-blue-500">{row.openDeals}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={row.conversionRate >= 50 ? "default" : "outline"} className={`text-[10px] ${row.conversionRate >= 50 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : ""}`}>
                              {formatPercent(row.conversionRate)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(row.totalValueCents)}</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(row.wonValueCents)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ─── Cross Table: Source × Medium × Campaign ─── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Tabela Cruzada: Source × Medium × Campaign
                <Badge variant="outline" className="text-[10px] ml-auto">{crossData.length} combinações</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Source</TableHead>
                      <TableHead className="text-xs">Medium</TableHead>
                      <TableHead className="text-xs">Campaign</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Ganhos</TableHead>
                      <TableHead className="text-xs text-right">Conversão</TableHead>
                      <TableHead className="text-xs text-right">Valor Ganho</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {crossDisplay.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum dado encontrado</TableCell>
                      </TableRow>
                    ) : (
                      crossDisplay.map((row, i) => (
                        <TableRow key={i} className="text-xs">
                          <TableCell className="font-medium">{row.source}</TableCell>
                          <TableCell>{row.medium}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{row.campaign}</TableCell>
                          <TableCell className="text-right font-semibold">{row.totalDeals}</TableCell>
                          <TableCell className="text-right text-emerald-600 font-semibold">{row.wonDeals}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className={`text-[10px] ${row.conversionRate >= 50 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : ""}`}>
                              {formatPercent(row.conversionRate)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(row.wonValueCents)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {crossData.length > 10 && (
                  <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => setExpandedCross(!expandedCross)}>
                    {expandedCross ? <><ChevronUp className="h-3 w-3 mr-1" /> Mostrar menos</> : <><ChevronDown className="h-3 w-3 mr-1" /> Ver todas ({crossData.length})</>}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ─── Deal List ─── */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary" />
                  Lista de Negociações
                  <Badge variant="outline" className="text-[10px]">{dealList.data?.total ?? 0} resultados</Badge>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={dealListStatus} onValueChange={(v: any) => setDealListStatus(v)}>
                    <SelectTrigger className="h-7 w-28 text-[11px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="won">Ganhos</SelectItem>
                      <SelectItem value="lost">Perdidos</SelectItem>
                      <SelectItem value="open">Abertos</SelectItem>
                    </SelectContent>
                  </Select>
                  {fv && fv.sources.length > 0 && (
                    <Select value={dealListSource || "all"} onValueChange={(v) => setDealListSource(v === "all" ? "" : v)}>
                      <SelectTrigger className="h-7 w-32 text-[11px]"><SelectValue placeholder="Source" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas Sources</SelectItem>
                        {fv.sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {fv && fv.mediums.length > 0 && (
                    <Select value={dealListMedium || "all"} onValueChange={(v) => setDealListMedium(v === "all" ? "" : v)}>
                      <SelectTrigger className="h-7 w-32 text-[11px]"><SelectValue placeholder="Medium" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos Mediums</SelectItem>
                        {fv.mediums.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Negociação</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Valor</TableHead>
                      <TableHead className="text-xs">Source</TableHead>
                      <TableHead className="text-xs">Medium</TableHead>
                      <TableHead className="text-xs">Campaign</TableHead>
                      <TableHead className="text-xs">Origem</TableHead>
                      <TableHead className="text-xs">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dealList.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell>
                      </TableRow>
                    ) : (dealList.data?.deals || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma negociação encontrada</TableCell>
                      </TableRow>
                    ) : (
                      (dealList.data?.deals || []).map((deal: any) => (
                        <TableRow key={deal.id} className="text-xs cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/deal/${deal.id}`)}>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            <div className="flex items-center gap-1.5">
                              {deal.title}
                              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${
                              deal.status === "won" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                              deal.status === "lost" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                              "bg-blue-500/10 text-blue-500 border-blue-500/20"
                            }`}>
                              {deal.status === "won" ? "Ganho" : deal.status === "lost" ? "Perdido" : "Aberto"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{deal.valueCents ? formatCurrency(deal.valueCents) : "—"}</TableCell>
                          <TableCell>{deal.utmSource || "—"}</TableCell>
                          <TableCell>{deal.utmMedium || "—"}</TableCell>
                          <TableCell className="max-w-[120px] truncate">{deal.utmCampaign || "—"}</TableCell>
                          <TableCell>{deal.leadSource || deal.channelOrigin || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{new Date(deal.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ─── Data Integrity Notice ─── */}
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Target className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Integridade dos Dados</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Este dashboard consulta <strong>diretamente o banco de dados</strong> em tempo real. Uma negociação é contada como "venda ganha" apenas quando seu status é <code className="bg-muted px-1 rounded text-[10px]">won</code>.
                    Se o status for alterado de volta para <code className="bg-muted px-1 rounded text-[10px]">open</code> ou <code className="bg-muted px-1 rounded text-[10px]">lost</code>, os números são atualizados automaticamente — sem cache, sem atraso.
                    Os dados de UTM são capturados no momento da criação da negociação e não podem ser alterados posteriormente.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      <DealFiltersPanel
        open={dealFilters.isOpen}
        onOpenChange={dealFilters.setIsOpen}
        filters={dealFilters.filters}
        onApply={(f) => { dealFilters.setFilters(f); }}
        onClear={dealFilters.clear}
      />
    </div>
  );
}
