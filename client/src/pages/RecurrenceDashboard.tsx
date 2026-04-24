import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Users, RefreshCw, Package, DollarSign, TrendingUp,
  Gift, Loader2, UserPlus, BarChart3, ArrowLeft,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatCompact(cents: number): string {
  const val = cents / 100;
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `R$ ${(val / 1_000).toFixed(1)}K`;
  return formatCurrency(cents);
}

function formatDate(d: string | null) {
  if (!d) return "--";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function formatMonth(m: string) {
  const [year, month] = m.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[Number(month) - 1]}/${year.slice(2)}`;
}

export default function RecurrenceDashboard() {
  const summaryQ = trpc.recurrenceAnalytics.summary.useQuery({ days: 90 });
  const monthlyQ = trpc.recurrenceAnalytics.monthlyRecurrence.useQuery({ months: 6 });
  const topClientsQ = trpc.recurrenceAnalytics.topRecurringClients.useQuery({ limit: 10 });

  const s = summaryQ.data;
  const monthly = monthlyQ.data || [];
  const topClients = topClientsQ.data || [];

  if (summaryQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-[#2E7D5B]" />
      </div>
    );
  }

  const chartData = monthly.map((m: any) => ({
    month: formatMonth(m.month),
    novos: m.uniqueClients - m.returningClients,
    recorrentes: m.returningClients,
    receita: m.revenue / 100,
  }));

  return (
    <div className="page-content max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/insights">
          <button className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
        </Link>
        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#2E7D5B]/20 to-[#2E7D5B]/10">
          <RefreshCw className="h-5 w-5 text-[#2E7D5B]" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Recorrencia e Fidelizacao</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Metricas de retorno, pacotes e indicacoes
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-400" />
              <p className="text-xs text-muted-foreground">Total Clientes</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{s?.totalClientes || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-4 w-4 text-emerald-400" />
              <p className="text-xs text-muted-foreground">Recorrentes</p>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{s?.clientesRecorrentes || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {s?.taxaRetorno || 0}% taxa de retorno
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-amber-400" />
              <p className="text-xs text-muted-foreground">Ticket Medio</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCompact(s?.ticketMedioCliente || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {s?.mediaComprasPorCliente || 0} compras/cliente
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-violet-400" />
              <p className="text-xs text-muted-foreground">Pacotes Ativos</p>
            </div>
            <p className="text-2xl font-bold text-violet-400">{s?.pacotesAtivos || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {s?.pacotesConcluidos || 0} concluidos · {s?.taxaUsoPacotes || 0}% uso
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="h-4 w-4 text-rose-400" />
              <p className="text-xs text-muted-foreground">Indicacoes</p>
            </div>
            <p className="text-2xl font-bold text-rose-400">{s?.totalIndicacoes || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {s?.indicacoesConvertidas || 0} convertidas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart + Top Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Chart */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#2E7D5B]" />
              Clientes por Mes (Novos vs Recorrentes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area type="monotone" dataKey="recorrentes" name="Recorrentes" stackId="1" stroke="#2E7D5B" fill="#2E7D5B" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="novos" name="Novos" stackId="1" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                Sem dados para o periodo selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Recurring Clients */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#2E7D5B]" />
              Top Clientes Recorrentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topClients.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Nenhum cliente recorrente ainda
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {topClients.map((client: any, i: number) => (
                  <Link key={client.id} href={`/contact/${client.id}`}>
                    <div className="px-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {client.totalPurchases} compras · {formatDate(client.lastPurchase)}
                              {client.referralCount > 0 && ` · ${client.referralCount} ind.`}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-[#2E7D5B] shrink-0 ml-2">
                          {formatCompact(client.totalSpent)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
