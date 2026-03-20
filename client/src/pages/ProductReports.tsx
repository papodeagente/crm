import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Package, TrendingUp, TrendingDown, BarChart3,
  DollarSign, ShoppingCart, Target, MapPin, Loader2, Download,
  Plane, Hotel, Map, Bus, Shield, Ship, Stamp, Box, PieChart,
  Award, XCircle, Star,
} from "lucide-react";

/* ─── Types ─── */
interface AnalyticsRow {
  name: string; category: string; catalogProductId: number | null;
  dealCount: number; totalQuantity: number;
  totalRevenueCents?: number; totalValueCents?: number;
}
interface ConversionRow {
  name: string; category: string; catalogProductId: number | null;
  totalDeals: number; wonDeals: number; conversionRate: number;
}
interface RevenueByTypeRow {
  category: string; dealCount: number; totalQuantity: number; totalRevenueCents: number;
}
interface DestinationRow {
  destination: string; productCount: number; totalBasePriceCents: number;
}

const PRODUCT_TYPES: Record<string, { label: string; icon: any; color: string; bgColor: string; chartColor: string }> = {
  flight: { label: "Aéreo", icon: Plane, color: "text-sky-400", bgColor: "bg-sky-500/15", chartColor: "#38bdf8" },
  hotel: { label: "Hospedagem", icon: Hotel, color: "text-amber-400", bgColor: "bg-amber-500/15", chartColor: "#fbbf24" },
  tour: { label: "Passeio", icon: Map, color: "text-emerald-400", bgColor: "bg-emerald-500/15", chartColor: "#34d399" },
  transfer: { label: "Transfer", icon: Bus, color: "text-violet-400", bgColor: "bg-violet-500/15", chartColor: "#a78bfa" },
  insurance: { label: "Seguro", icon: Shield, color: "text-rose-400", bgColor: "bg-rose-500/15", chartColor: "#fb7185" },
  cruise: { label: "Cruzeiro", icon: Ship, color: "text-cyan-400", bgColor: "bg-cyan-500/15", chartColor: "#22d3ee" },
  visa: { label: "Visto", icon: Stamp, color: "text-orange-400", bgColor: "bg-orange-500/15", chartColor: "#fb923c" },
  package: { label: "Pacote", icon: Package, color: "text-indigo-400", bgColor: "bg-indigo-500/15", chartColor: "#818cf8" },
  other: { label: "Outro", icon: Box, color: "text-slate-400", bgColor: "bg-slate-500/15", chartColor: "#94a3b8" },
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatCompact(cents: number): string {
  const value = cents / 100;
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}K`;
  return formatCurrency(cents);
}

/* ─── Horizontal Bar Chart ─── */
function HorizontalBarChart({
  data, valueKey, labelKey, colorFn, formatValue,
}: {
  data: any[]; valueKey: string; labelKey: string;
  colorFn: (item: any, idx: number) => string;
  formatValue: (val: number) => string;
}) {
  const maxVal = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);

  return (
    <div className="space-y-2.5">
      {data.map((item, idx) => {
        const val = Number(item[valueKey]) || 0;
        const pct = (val / maxVal) * 100;
        const typeInfo = PRODUCT_TYPES[item.category] || PRODUCT_TYPES.other;
        const TypeIcon = typeInfo.icon;
        return (
          <div key={idx}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className={`h-6 w-6 rounded flex items-center justify-center shrink-0 ${typeInfo.bgColor}`}>
                  <TypeIcon className={`h-3 w-3 ${typeInfo.color}`} />
                </div>
                <span className="text-xs font-medium text-foreground truncate">{item[labelKey]}</span>
              </div>
              <span className="text-xs font-semibold text-foreground ml-2 shrink-0">{formatValue(val)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: colorFn(item, idx) }}
              />
            </div>
          </div>
        );
      })}
      {data.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">Sem dados disponíveis</p>
      )}
    </div>
  );
}

/* ─── Donut Chart (CSS-based) ─── */
function DonutChart({ data }: { data: RevenueByTypeRow[] }) {
  const total = data.reduce((acc, d) => acc + Number(d.totalRevenueCents || 0), 0);
  if (total === 0) return <p className="text-sm text-muted-foreground text-center py-6">Sem dados disponíveis</p>;

  let cumulative = 0;
  const segments = data.map((d) => {
    const pct = (Number(d.totalRevenueCents || 0) / total) * 100;
    const start = cumulative;
    cumulative += pct;
    const typeInfo = PRODUCT_TYPES[d.category] || PRODUCT_TYPES.other;
    return { ...d, pct, start, color: typeInfo.chartColor, label: typeInfo.label };
  });

  const gradientStops = segments.map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(", ");

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0">
        <div
          className="h-36 w-36 rounded-full"
          style={{ background: `conic-gradient(${gradientStops})` }}
        />
        <div className="absolute inset-4 rounded-full bg-card flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{formatCompact(total)}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
        </div>
      </div>
      <div className="space-y-2 flex-1 min-w-0">
        {segments.map((s, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-foreground truncate flex-1">{s.label}</span>
            <span className="text-xs font-medium text-muted-foreground shrink-0">{s.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Conversion Rate Chart ─── */
function ConversionChart({ data }: { data: ConversionRow[] }) {
  return (
    <div className="space-y-3">
      {data.map((item, idx) => {
        const rate = Number(item.conversionRate) || 0;
        const typeInfo = PRODUCT_TYPES[item.category] || PRODUCT_TYPES.other;
        return (
          <div key={idx}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-foreground truncate flex-1">{item.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground">{Number(item.wonDeals)}/{Number(item.totalDeals)}</span>
                <span className={`text-xs font-bold ${rate >= 50 ? "text-emerald-500" : rate >= 25 ? "text-amber-500" : "text-rose-500"}`}>
                  {rate.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${rate}%`,
                  backgroundColor: rate >= 50 ? "#34d399" : rate >= 25 ? "#fbbf24" : "#fb7185",
                }}
              />
            </div>
          </div>
        );
      })}
      {data.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">Sem dados disponíveis</p>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function ProductReportsPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  // Queries
  const summaryQ = trpc.productCatalog.analytics.summary.useQuery();
  const mostSoldQ = trpc.productCatalog.analytics.mostSold.useQuery({ limit: 10 });
  const mostLostQ = trpc.productCatalog.analytics.mostLost.useQuery({ limit: 10 });
  const mostRequestedQ = trpc.productCatalog.analytics.mostRequested.useQuery({ limit: 10 });
  const revenueByTypeQ = trpc.productCatalog.analytics.revenueByType.useQuery();
  const conversionQ = trpc.productCatalog.analytics.conversionRate.useQuery({ limit: 10 });
  const topDestQ = trpc.productCatalog.analytics.topDestinations.useQuery({ limit: 10 });

  const summary = summaryQ.data;
  const isLoading = summaryQ.isLoading;

  // Export CSV
  function exportCSV() {
    const rows = (mostSoldQ.data || []) as AnalyticsRow[];
    if (rows.length === 0) { return; }
    const header = "Produto,Categoria,Quantidade,Receita\n";
    const csv = rows.map((r) =>
      `"${r.name}","${PRODUCT_TYPES[r.category]?.label || r.category}",${Number(r.totalQuantity)},${Number(r.totalRevenueCents || 0) / 100}`
    ).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "produtos-mais-vendidos.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-content max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/insights")} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{
            background: "linear-gradient(135deg, oklch(0.55 0.20 200), oklch(0.60 0.25 270))"
          }}>
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Relatórios de Produtos</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Análise de desempenho do catálogo turístico</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocation("/settings/products")}>
            <Package className="h-4 w-4 mr-1.5" />
            Catálogo
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-violet-500/15">
                  <Package className="h-4 w-4 text-violet-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{summary?.totalProducts ?? 0}</p>
              <p className="text-xs text-muted-foreground">Produtos no Catálogo</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-500/15">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-emerald-500">{summary?.activeProducts ?? 0}</p>
              <p className="text-xs text-muted-foreground">Produtos Ativos</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-sky-500/15">
                  <DollarSign className="h-4 w-4 text-sky-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatCompact(summary?.avgPriceCents ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Preço Médio</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-amber-500/15">
                  <ShoppingCart className="h-4 w-4 text-amber-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatCompact(summary?.totalRevenueCents ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Receita Total</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-rose-500/15">
                  <Target className="h-4 w-4 text-rose-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{summary?.dealsWithProducts ?? 0}</p>
              <p className="text-xs text-muted-foreground">Negociações com Produtos</p>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Most Sold */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-500/15">
                  <Award className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Mais Vendidos</h3>
                  <p className="text-[11px] text-muted-foreground">Produtos em negociações ganhas</p>
                </div>
              </div>
              <HorizontalBarChart
                data={(mostSoldQ.data || []) as AnalyticsRow[]}
                valueKey="totalQuantity"
                labelKey="name"
                colorFn={(item) => (PRODUCT_TYPES[item.category] || PRODUCT_TYPES.other).chartColor}
                formatValue={(v) => `${v} un.`}
              />
            </div>

            {/* Most Lost */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-rose-500/15">
                  <XCircle className="h-4 w-4 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Mais Perdidos</h3>
                  <p className="text-[11px] text-muted-foreground">Produtos em negociações perdidas</p>
                </div>
              </div>
              <HorizontalBarChart
                data={(mostLostQ.data || []) as AnalyticsRow[]}
                valueKey="totalQuantity"
                labelKey="name"
                colorFn={(item) => (PRODUCT_TYPES[item.category] || PRODUCT_TYPES.other).chartColor}
                formatValue={(v) => `${v} un.`}
              />
            </div>

            {/* Most Requested */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-amber-500/15">
                  <Star className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Mais Solicitados</h3>
                  <p className="text-[11px] text-muted-foreground">Produtos em todas as negociações</p>
                </div>
              </div>
              <HorizontalBarChart
                data={(mostRequestedQ.data || []) as AnalyticsRow[]}
                valueKey="totalQuantity"
                labelKey="name"
                colorFn={(item) => (PRODUCT_TYPES[item.category] || PRODUCT_TYPES.other).chartColor}
                formatValue={(v) => `${v} un.`}
              />
            </div>

            {/* Revenue by Type (Donut) */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-indigo-500/15">
                  <PieChart className="h-4 w-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Receita por Categoria</h3>
                  <p className="text-[11px] text-muted-foreground">Distribuição de receita por tipo de produto</p>
                </div>
              </div>
              <DonutChart data={(revenueByTypeQ.data || []) as RevenueByTypeRow[]} />
            </div>

            {/* Conversion Rate */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-sky-500/15">
                  <Target className="h-4 w-4 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Taxa de Conversão</h3>
                  <p className="text-[11px] text-muted-foreground">Percentual de vendas ganhas por produto</p>
                </div>
              </div>
              <ConversionChart data={(conversionQ.data || []) as ConversionRow[]} />
            </div>

            {/* Top Destinations */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-cyan-500/15">
                  <MapPin className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Top Destinos</h3>
                  <p className="text-[11px] text-muted-foreground">Destinos com mais produtos no catálogo</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {((topDestQ.data || []) as DestinationRow[]).map((dest, idx) => {
                  const maxCount = Math.max(...((topDestQ.data || []) as DestinationRow[]).map((d) => Number(d.productCount)), 1);
                  const pct = (Number(dest.productCount) / maxCount) * 100;
                  return (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <MapPin className="h-3 w-3 text-cyan-400 shrink-0" />
                          <span className="text-xs font-medium text-foreground truncate">{dest.destination}</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground ml-2 shrink-0">{Number(dest.productCount)} produtos</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                        <div className="h-full rounded-full bg-cyan-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {(topDestQ.data || []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Sem dados disponíveis</p>
                )}
              </div>
            </div>
          </div>

          {/* Revenue Table */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-violet-500/15">
                <DollarSign className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Receita Detalhada por Categoria</h3>
                <p className="text-[11px] text-muted-foreground">Negociações ganhas agrupadas por tipo de produto</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Categoria</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Negociações</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Quantidade</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Receita</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Ticket Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {((revenueByTypeQ.data || []) as RevenueByTypeRow[]).map((row, idx) => {
                    const typeInfo = PRODUCT_TYPES[row.category] || PRODUCT_TYPES.other;
                    const TypeIcon = typeInfo.icon;
                    const avgTicket = Number(row.dealCount) > 0 ? Number(row.totalRevenueCents) / Number(row.dealCount) : 0;
                    return (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className={`h-6 w-6 rounded flex items-center justify-center ${typeInfo.bgColor}`}>
                              <TypeIcon className={`h-3 w-3 ${typeInfo.color}`} />
                            </div>
                            <span className="text-sm font-medium text-foreground">{typeInfo.label}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm text-foreground">{Number(row.dealCount)}</td>
                        <td className="px-3 py-2.5 text-right text-sm text-foreground">{Number(row.totalQuantity)}</td>
                        <td className="px-3 py-2.5 text-right text-sm font-semibold text-foreground">{formatCurrency(Number(row.totalRevenueCents))}</td>
                        <td className="px-3 py-2.5 text-right text-sm text-muted-foreground">{formatCurrency(avgTicket)}</td>
                      </tr>
                    );
                  })}
                  {(revenueByTypeQ.data || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-sm text-muted-foreground">Sem dados disponíveis</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
