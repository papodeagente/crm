import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import {
  Building2, Users, Search, Loader2, ArrowRight, Wifi, WifiOff,
  Brain, Zap, ChevronLeft, ChevronRight, ShieldAlert, ArrowUpDown
} from "lucide-react";

const fmt = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const fmtNum = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

function billingBadge(s: string | null) {
  switch (s) {
    case "active": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] hover:bg-emerald-500/20">Ativo</Badge>;
    case "trialing": return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] hover:bg-purple-500/20">Trial</Badge>;
    case "past_due": return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] hover:bg-amber-500/20">Inadimplente</Badge>;
    case "restricted": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] hover:bg-red-500/20">Restrito</Badge>;
    case "cancelled": return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] hover:bg-orange-500/20">Cancelado</Badge>;
    case "expired": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] hover:bg-red-500/20">Expirado</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">{s || "—"}</Badge>;
  }
}

function planBadge(p: string) {
  switch (p) {
    case "pro": return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] hover:bg-purple-500/20">Pro</Badge>;
    case "enterprise": return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] hover:bg-blue-500/20">Enterprise</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">Free</Badge>;
  }
}

function healthIndicator(t: any) {
  let score = 0;
  if (t.userCount >= 2) score += 20;
  if (t.dealsMonth >= 3) score += 20;
  if (t.waConnected > 0) score += 20;
  if (t.conversionRate >= 20) score += 20;
  if (t.aiEnabled) score += 10;
  if (t.integCount > 0) score += 10;
  if (score >= 70) return <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="Saudável" />;
  if (score >= 40) return <span className="inline-block w-2 h-2 rounded-full bg-amber-400" title="Moderado" />;
  return <span className="inline-block w-2 h-2 rounded-full bg-red-400" title="Risco" />;
}

/** Mobile card view for a single tenant */
function TenantCard({ t, onClick }: { t: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border border-border/50 hover:border-border hover:bg-accent/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {t.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground truncate block">{t.name}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {planBadge(t.plan)}
              {billingBadge(t.billingStatus)}
              {healthIndicator(t)}
            </div>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
        <span><Users className="w-3 h-3 inline mr-0.5" />{t.userCount} users</span>
        <span>{t.dealsMonth} deals/mês</span>
        <span>{fmt(t.wonCentsMonth)}</span>
        <span>{t.conversionRate}% conv.</span>
        {t.waConnected > 0 && <span className="text-emerald-400"><Wifi className="w-3 h-3 inline mr-0.5" />WA</span>}
        {t.aiEnabled && <span className="text-pink-400"><Brain className="w-3 h-3 inline mr-0.5" />IA</span>}
      </div>
    </button>
  );
}

export default function SuperAdminTenants() {
  const [, navigate] = useLocation();
  const meQuery = trpc.saasAuth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [plan, setPlan] = useState("all");
  const [billingStatus, setBillingStatus] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Debounce search
  const [timer, setTimer] = useState<any>(null);
  const handleSearch = (v: string) => {
    setSearch(v);
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => { setSearchDebounced(v); setPage(1); }, 400);
    setTimer(t);
  };

  const queryInput = useMemo(() => ({
    page,
    pageSize: 25,
    search: searchDebounced || undefined,
    plan: plan !== "all" ? plan : undefined,
    billingStatus: billingStatus !== "all" ? billingStatus : undefined,
    sortBy,
    sortDir,
  }), [page, searchDebounced, plan, billingStatus, sortBy, sortDir]);

  const tenantsQ = trpc.superAdminDash.tenantsList.useQuery(queryInput, {
    enabled: !!meQuery.data?.isSuperAdmin,
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
  });

  if (!meQuery.data?.isSuperAdmin) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Card className="max-w-md border-border">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2 text-foreground">Acesso Restrito</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalPages = Math.ceil((tenantsQ.data?.total || 0) / 25);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
    setPage(1);
  };

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Gestão de Tenants</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Listagem completa com métricas e filtros</p>
      </div>

      {/* Filters — stack on mobile */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 sm:items-center">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={plan} onValueChange={v => { setPlan(v); setPage(1); }}>
            <SelectTrigger className="w-[120px] sm:w-[130px] h-9">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Planos</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
          <Select value={billingStatus} onValueChange={v => { setBillingStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] sm:w-[150px] h-9">
              <SelectValue placeholder="Billing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="trialing">Trial</SelectItem>
              <SelectItem value="past_due">Inadimplente</SelectItem>
              <SelectItem value="restricted">Restrito</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="expired">Expirado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground sm:ml-auto">
          {fmtNum(tenantsQ.data?.total || 0)} tenants
        </span>
      </div>

      {/* Loading state */}
      {tenantsQ.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (tenantsQ.data?.tenants || []).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum tenant encontrado</div>
      ) : (
        <>
          {/* Mobile card list — visible on small screens */}
          <div className="sm:hidden space-y-2">
            {(tenantsQ.data?.tenants || []).map((t: any) => (
              <TenantCard key={t.id} t={t} onClick={() => navigate(`/super-admin/tenant/${t.id}`)} />
            ))}
          </div>

          {/* Desktop table — hidden on small screens */}
          <Card className="border-border/50 overflow-hidden hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                        Tenant <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Plano</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">
                      <button onClick={() => toggleSort("userCount")} className="flex items-center gap-1 hover:text-foreground mx-auto">
                        <Users className="w-3 h-3" /> <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">
                      <button onClick={() => toggleSort("dealsMonth")} className="flex items-center gap-1 hover:text-foreground mx-auto">
                        Deals <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">
                      <button onClick={() => toggleSort("wonCentsMonth")} className="flex items-center gap-1 hover:text-foreground ml-auto">
                        Vendas <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Conv.</th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">WA</th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">IA</th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Integ.</th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Saúde</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {(tenantsQ.data?.tenants || []).map((t: any) => (
                    <tr
                      key={t.id}
                      className="border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/super-admin/tenant/${t.id}`)}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {t.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <span className="font-medium text-foreground truncate max-w-[180px]">{t.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{planBadge(t.plan)}</td>
                      <td className="px-3 py-2.5">{billingBadge(t.billingStatus)}</td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground">{t.userCount}</td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground">{t.dealsMonth}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground text-xs">{fmt(t.wonCentsMonth)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs font-medium ${t.conversionRate >= 30 ? "text-emerald-400" : t.conversionRate >= 15 ? "text-amber-400" : "text-muted-foreground"}`}>
                          {t.conversionRate}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {t.waConnected > 0 ? (
                          <Wifi className="w-3.5 h-3.5 text-emerald-400 mx-auto" />
                        ) : t.waTotal > 0 ? (
                          <WifiOff className="w-3.5 h-3.5 text-red-400 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {t.aiEnabled ? <Brain className="w-3.5 h-3.5 text-pink-400 mx-auto" /> : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground text-xs">{t.integCount || "—"}</td>
                      <td className="px-3 py-2.5 text-center">{healthIndicator(t)}</td>
                      <td className="px-3 py-2.5">
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
