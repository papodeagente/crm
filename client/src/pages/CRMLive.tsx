/**
 * CRM Live — Relatório em tempo real do CRM.
 * Duas abas: Finalizadas (capa executiva) e Em Andamento (operação pipeline).
 * Acessível via /analytics/crm-live. Não altera nenhum módulo existente.
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, Target,
  Trophy, XCircle, Clock, Briefcase, Filter, Star,
  Loader2, AlertTriangle, Users as UsersIcon, BarChart3,
  CheckCircle2, Phone, MessageSquare, ChevronRight,
} from "lucide-react";
import DateRangeFilter, { useDateFilter } from "@/components/DateRangeFilter";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
} from "recharts";

/* ─── Helpers ─── */
function fmt(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function fmtShort(cents: number): string {
  const val = cents / 100;
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `R$ ${(val / 1_000).toFixed(1)}K`;
  return fmt(cents);
}

function pctChange(current: number, previous: number): { value: number; direction: "up" | "down" | "neutral" } {
  if (previous === 0 && current === 0) return { value: 0, direction: "neutral" };
  if (previous === 0) return { value: 100, direction: "up" };
  const pct = ((current - previous) / previous) * 100;
  return { value: Math.abs(Math.round(pct)), direction: pct > 0 ? "up" : pct < 0 ? "down" : "neutral" };
}

const PIE_COLORS = ["#4A90D9", "#22c55e", "#ef4444", "#f59e0b", "#8b5cf6", "#06b6d4"];

/* ─── Skeleton Components ─── */
function HighlightSkeleton() {
  return (
    <Card className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur">
      <CardContent className="p-6 flex flex-col items-center gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16" />
      </CardContent>
    </Card>
  );
}

function KPISkeleton() {
  return (
    <Card className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur">
      <CardContent className="p-5">
        <Skeleton className="h-4 w-24 mb-3" />
        <div className="flex items-end gap-4">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Performance Highlight Card ─── */
function HighlightCard({ title, name, avatarUrl, value, valueLabel, color }: {
  title: string; name: string; avatarUrl: string | null;
  value: string; valueLabel?: string; color: string;
}) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
        <span className="text-sm font-semibold" style={{ color }}>{title}</span>
        <div className="relative">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="w-16 h-16 rounded-full object-cover border-2 border-gray-100" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xl font-bold text-gray-500">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 bg-yellow-400 rounded-full p-1">
            <Star className="w-3 h-3 text-white fill-white" />
          </div>
        </div>
        <span className="text-sm text-muted-foreground">{name}</span>
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {valueLabel && <span className="text-xs text-muted-foreground">{valueLabel}</span>}
      </CardContent>
    </Card>
  );
}

/* ─── KPI Card with Comparison ─── */
function KPICard({ label, current, previous, isCurrency, color, subLabel }: {
  label: string; current: number; previous: number;
  isCurrency?: boolean; color: string; subLabel?: string;
}) {
  const change = pctChange(current, previous);
  const displayCurrent = isCurrency ? fmt(current) : current.toLocaleString("pt-BR");
  const displayPrevious = isCurrency ? fmt(previous) : previous.toLocaleString("pt-BR");

  return (
    <Card className="bg-white dark:bg-zinc-900 border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-1">
          <span className="text-sm font-semibold" style={{ color }}>{label}</span>
          <span className="text-sm font-semibold" style={{ color }}>Período anterior</span>
        </div>
        {subLabel && <span className="text-xs text-muted-foreground">{subLabel}</span>}
        <div className="flex items-end justify-between mt-2">
          <div className="flex flex-col">
            <span className="text-3xl font-bold text-foreground">{displayCurrent}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-2xl font-semibold text-muted-foreground">{displayPrevious}</span>
          </div>
        </div>
        {change.direction !== "neutral" && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${change.direction === "up" ? "text-emerald-600" : "text-red-500"}`}>
            {change.direction === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{change.value}% vs período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Stage Distribution Row ─── */
function StageRow({ name, count, valueCents, maxCount }: {
  name: string; count: number; valueCents: number; maxCount: number;
}) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-zinc-800 last:border-0">
      <span className="w-40 text-sm font-medium text-foreground truncate">{name}</span>
      <div className="flex-1 flex items-center gap-3">
        <span className="text-2xl font-bold text-foreground w-12 text-center">{count}</span>
        <div className="flex-1 bg-gray-100 dark:bg-zinc-800 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="text-right min-w-[120px]">
        <div className="text-sm text-muted-foreground">{fmt(valueCents)}</div>
      </div>
    </div>
  );
}

/* ─── Probability Stars ─── */
function ProbabilityCard({ label, stars, dealCount, valueCents }: {
  label: string; stars: number; dealCount: number; valueCents: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-zinc-900 rounded-xl shadow-sm">
      <span className="text-3xl font-bold text-foreground">{dealCount}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`w-4 h-4 ${i < stars ? "text-blue-500 fill-blue-500" : "text-gray-300"}`} />
        ))}
      </div>
      <div className="text-xs text-muted-foreground text-center">
        <div>{fmt(valueCents)}</div>
      </div>
    </div>
  );
}

/* ─── Task Feed Item ─── */
function TaskFeedRow({ task }: { task: { id: number; title: string; taskType: string; status: string; assignedUserName: string | null; updatedAt: Date } }) {
  const iconMap: Record<string, React.ReactNode> = {
    call: <Phone className="w-4 h-4 text-blue-500" />,
    whatsapp: <MessageSquare className="w-4 h-4 text-green-500" />,
    done: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    task: <Briefcase className="w-4 h-4 text-gray-500" />,
  };
  const icon = task.status === "done" ? iconMap.done : (iconMap[task.taskType] || iconMap.task);
  const date = new Date(task.updatedAt);
  const dateStr = `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-zinc-800 last:border-0">
      {icon}
      <span className="text-sm text-foreground truncate flex-1">{task.title}</span>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{task.assignedUserName || "—"}, {dateStr}</span>
    </div>
  );
}

/* ─── Main Component ─── */
export default function CRMLive() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Tab state
  const [activeTab, setActiveTab] = useState<"finalized" | "in_progress">("finalized");

  // Filters
  const dateFilter = useDateFilter("last30");
  const [selectedPipeline, setSelectedPipeline] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");

  // Data queries
  const pipelinesQ = trpc.crm.pipelines.list.useQuery({});
  const usersQ = trpc.admin.users.list.useQuery();

  const filterInput = useMemo(() => ({
    tab: activeTab as "finalized" | "in_progress",
    dateFrom: dateFilter.dates.dateFrom,
    dateTo: dateFilter.dates.dateTo,
    ...(selectedPipeline !== "all" ? { pipelineId: Number(selectedPipeline) } : {}),
    ...(selectedUser !== "all" ? { ownerUserId: Number(selectedUser) } : {}),
  }), [activeTab, dateFilter.dates, selectedPipeline, selectedUser]);

  const coverQ = trpc.crmAnalytics.crmLiveCover.useQuery(filterInput);
  const operationQ = trpc.crmAnalytics.crmLiveOperation.useQuery(filterInput);

  const cover = coverQ.data;
  const operation = operationQ.data;
  const isLoading = coverQ.isLoading || operationQ.isLoading;

  // Derived data for loss reasons pie chart
  const lossReasonsPieData = useMemo(() => {
    if (!cover?.topLossReasons?.length) return [];
    return cover.topLossReasons.map((r, i) => ({
      name: r.name,
      value: r.count,
      percentage: r.percentage,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [cover?.topLossReasons]);

  const maxStageCount = useMemo(() => {
    if (!operation?.stages?.length) return 0;
    return Math.max(...operation.stages.map(s => s.dealCount));
  }, [operation?.stages]);

  // Default pipeline selection
  const defaultPipeline = pipelinesQ.data?.find((p: any) => p.isDefault);
  if (defaultPipeline && selectedPipeline === "all" && pipelinesQ.isSuccess) {
    // Auto-select default pipeline on first load
  }

  return (
    <div className="page-content">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/analytics")} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">CRM Live</h1>
            <p className="text-sm text-muted-foreground">Visão em tempo real da operação comercial</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-6 border-b border-gray-200 dark:border-zinc-700">
          <button
            onClick={() => setActiveTab("finalized")}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === "finalized"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            FINALIZADAS
          </button>
          <button
            onClick={() => setActiveTab("in_progress")}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === "in_progress"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            EM ANDAMENTO
          </button>

          {/* Filters on the right */}
          <div className="ml-auto flex items-center gap-3 pb-3">
            <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder="Funil de vendas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os funis</SelectItem>
                {pipelinesQ.data?.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DateRangeFilter
              compact
              preset={dateFilter.preset}
              onPresetChange={dateFilter.setPreset}
              customFrom={dateFilter.customFrom}
              onCustomFromChange={dateFilter.setCustomFrom}
              customTo={dateFilter.customTo}
              onCustomToChange={dateFilter.setCustomTo}
              onReset={dateFilter.reset}
            />

            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda a empresa</SelectItem>
                {usersQ.data?.map((u: any) => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Content ── */}
        {activeTab === "finalized" ? (
          /* ═══════════ FINALIZADAS (Capa Executiva) ═══════════ */
          <div className="space-y-6">

            {/* Performance Highlights */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <HighlightSkeleton /><HighlightSkeleton /><HighlightSkeleton />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {cover?.topDealCreator ? (
                  <HighlightCard
                    title="Quem mais criou negociações"
                    name={cover.topDealCreator.userName}
                    avatarUrl={cover.topDealCreator.avatarUrl}
                    value={String(cover.topDealCreator.value)}
                    color="#22c55e"
                  />
                ) : (
                  <Card className="bg-white dark:bg-zinc-900 border-0 shadow-sm">
                    <CardContent className="p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground min-h-[180px]">
                      <UsersIcon className="w-8 h-8 opacity-40" />
                      <span className="text-sm">Sem dados no período</span>
                    </CardContent>
                  </Card>
                )}

                {cover?.topSellerByUnits ? (
                  <HighlightCard
                    title="Quem mais vendeu (un)"
                    name={cover.topSellerByUnits.userName}
                    avatarUrl={cover.topSellerByUnits.avatarUrl}
                    value={String(cover.topSellerByUnits.value)}
                    color="#f59e0b"
                  />
                ) : (
                  <Card className="bg-white dark:bg-zinc-900 border-0 shadow-sm">
                    <CardContent className="p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground min-h-[180px]">
                      <Trophy className="w-8 h-8 opacity-40" />
                      <span className="text-sm">Sem vendas no período</span>
                    </CardContent>
                  </Card>
                )}

                {cover?.topSellerByValue ? (
                  <HighlightCard
                    title="Quem mais vendeu (R$)"
                    name={cover.topSellerByValue.userName}
                    avatarUrl={cover.topSellerByValue.avatarUrl}
                    value={fmt(cover.topSellerByValue.value)}
                    color="#ef4444"
                  />
                ) : (
                  <Card className="bg-white dark:bg-zinc-900 border-0 shadow-sm">
                    <CardContent className="p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground min-h-[180px]">
                      <DollarSign className="w-8 h-8 opacity-40" />
                      <span className="text-sm">Sem vendas no período</span>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* KPI Cards with Period Comparison */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KPISkeleton /><KPISkeleton /><KPISkeleton />
              </div>
            ) : cover ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KPICard
                  label="Negociações novas"
                  current={cover.newDeals.current}
                  previous={cover.newDeals.previous}
                  color="#4A90D9"
                />
                <KPICard
                  label="Vendas no período"
                  subLabel="(un)"
                  current={cover.salesUnits.current}
                  previous={cover.salesUnits.previous}
                  color="#22c55e"
                />
                <KPICard
                  label="Vendas no período"
                  subLabel="(R$)"
                  current={cover.salesValueCents.current}
                  previous={cover.salesValueCents.previous}
                  isCurrency
                  color="#8b5cf6"
                />
              </div>
            ) : null}

            {/* Conversion + Losses + Top Loss Reasons */}
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3"><KPISkeleton /></div>
                <div className="lg:col-span-2"><KPISkeleton /></div>
              </div>
            ) : cover ? (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Left: Conversion + Losses */}
                <div className="lg:col-span-3 space-y-4">
                  <Card className="bg-white dark:bg-zinc-900 border-0 shadow-sm">
                    <CardContent className="p-5">
                      <span className="text-sm font-semibold text-emerald-600">Conversão:</span>
                      <p className="text-xs text-muted-foreground">(Criados no período / Vendas no período)</p>
                      <span className="text-4xl font-bold text-foreground mt-2 block">
                        {cover.conversionRate.toFixed(2)}%
                      </span>
                    </CardContent>
                  </Card>

                  <KPICard
                    label="Negociações Perdidas"
                    current={cover.lostDeals.current}
                    previous={cover.lostDeals.previous}
                    color="#ef4444"
                  />
                </div>

                {/* Right: Top 3 Loss Reasons Pie */}
                <div className="lg:col-span-2">
                  <Card className="bg-white dark:bg-zinc-900 border-0 shadow-sm h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-red-500">Top 3 motivos de perda</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      {lossReasonsPieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={lossReasonsPieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              dataKey="value"
                              nameKey="name"
                              paddingAngle={2}
                            >
                              {lossReasonsPieData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              formatter={(value: number, name: string) => [`${value} negociações`, name]}
                            />
                            <Legend
                              verticalAlign="bottom"
                              iconType="circle"
                              iconSize={8}
                              formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                          Sem perdas no período
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          /* ═══════════ EM ANDAMENTO (Operação Pipeline) ═══════════ */
          <div className="space-y-6">

            {/* Summary + Task Feed */}
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <KPISkeleton /><KPISkeleton />
                <div className="lg:col-span-1"><KPISkeleton /></div>
              </div>
            ) : operation ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Deals in progress */}
                <Card className="bg-white dark:bg-zinc-900 border-0 shadow-sm">
                  <CardContent className="p-5">
                    <span className="text-sm font-semibold text-red-500">Negociações em andamento</span>
                    <span className="text-5xl font-bold text-foreground mt-2 block">{operation.totalDeals}</span>
                  </CardContent>
                </Card>

                {/* Values in progress */}
                <Card className="bg-white dark:bg-zinc-900 border-0 shadow-sm">
                  <CardContent className="p-5">
                    <span className="text-sm font-semibold text-emerald-600">Valores em andamento</span>
                    <div className="mt-2 space-y-1">
                      <div className="text-lg font-bold text-foreground">{fmt(operation.totalValueCents)}</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Task Feed */}
                <Card className="bg-white dark:bg-zinc-900 border-0 shadow-sm">
                  <CardContent className="p-5">
                    <span className="text-sm font-semibold text-red-500">Feed de tarefas</span>
                    <div className="mt-2 max-h-[200px] overflow-y-auto">
                      {operation.taskFeed.length > 0 ? (
                        operation.taskFeed.map(task => (
                          <TaskFeedRow key={task.id} task={task} />
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground py-4 text-center">
                          Nenhuma atividade recente
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {/* Stage Distribution */}
            {isLoading ? (
              <Card className="bg-white dark:bg-zinc-900 border-0 shadow-sm">
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-48 mb-4" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full mb-2" />
                  ))}
                </CardContent>
              </Card>
            ) : operation?.stages && operation.stages.length > 0 ? (
              <Card className="bg-white dark:bg-zinc-900 border-0 shadow-sm">
                <CardContent className="p-6">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-4">Distribuição por Etapa</h3>
                  {operation.stages.map(stage => (
                    <StageRow
                      key={stage.stageId}
                      name={stage.stageName}
                      count={stage.dealCount}
                      valueCents={stage.valueCents}
                      maxCount={maxStageCount}
                    />
                  ))}
                </CardContent>
              </Card>
            ) : selectedPipeline === "all" ? (
              <Card className="bg-white dark:bg-zinc-900 border-0 shadow-sm">
                <CardContent className="p-6 text-center text-muted-foreground">
                  <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Selecione um funil de vendas para ver a distribuição por etapa</p>
                </CardContent>
              </Card>
            ) : null}

            {/* Probability Grouping */}
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : operation?.probabilityGroups ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {operation.probabilityGroups.map((pg, i) => (
                  <ProbabilityCard
                    key={i}
                    label={pg.label}
                    stars={pg.stars}
                    dealCount={pg.dealCount}
                    valueCents={pg.valueCents}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
