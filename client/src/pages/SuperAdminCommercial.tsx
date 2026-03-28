import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Loader2, ShieldAlert, TrendingUp, AlertTriangle,
  ArrowRight, Users, Handshake, Clock, Wifi
} from "lucide-react";

const fmt = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function TenantRow({ tenant, onClick, extra }: { tenant: any; onClick: () => void; extra?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg hover:bg-accent/30 transition-colors text-left group"
    >
      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-primary/10 flex items-center justify-center text-[10px] sm:text-xs font-bold text-primary shrink-0">
        {tenant.name?.charAt(0)?.toUpperCase() || "?"}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs sm:text-sm font-medium text-foreground truncate block">{tenant.name}</span>
        <span className="text-[10px] sm:text-xs text-muted-foreground capitalize">{tenant.plan}</span>
      </div>
      {extra}
      <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

export default function SuperAdminCommercial() {
  const [, navigate] = useLocation();
  const meQuery = trpc.saasAuth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });

  const commercialQ = trpc.superAdminDash.commercialExpansion.useQuery(undefined, {
    enabled: !!meQuery.data?.isSuperAdmin,
    staleTime: 60_000,
  });

  if (meQuery.isLoading || commercialQ.isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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

  const d = commercialQ.data;
  if (!d) return null;

  const trialsExpiring = d.trials.filter((t: any) => t.expiringsSoon);

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Comercial e Expansão</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Retenção, trials e oportunidades de upgrade</p>
      </div>

      {/* Summary Cards — 2 cols on all sizes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="border-border/50">
          <CardContent className="p-2.5 sm:p-3">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Em Trial</p>
            <p className="text-lg sm:text-2xl font-bold text-purple-400">{d.trials.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-2.5 sm:p-3">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Trial Expirando</p>
            <p className="text-lg sm:text-2xl font-bold text-amber-400">{trialsExpiring.length}</p>
            <p className="text-[10px] text-muted-foreground">Próximos 7 dias</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-2.5 sm:p-3">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Potencial Upgrade</p>
            <p className="text-lg sm:text-2xl font-bold text-emerald-400">{d.upgradeCandidates.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-2.5 sm:p-3">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Risco de Churn</p>
            <p className="text-lg sm:text-2xl font-bold text-red-400">{d.churnRisk.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Trials */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
              <span>Tenants em Trial</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">{d.trials.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-1.5 sm:px-2 pb-2 sm:pb-3 max-h-72 sm:max-h-80 overflow-y-auto">
            {d.trials.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center px-2">Nenhum tenant em trial</p>
            ) : (
              d.trials.map((t: any) => (
                <TenantRow
                  key={t.id}
                  tenant={t}
                  onClick={() => navigate(`/super-admin/tenant/${t.id}`)}
                  extra={
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0 flex-wrap justify-end">
                      {t.expiringsSoon && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] hover:bg-amber-500/20">Expirando</Badge>}
                      {t.highUsage && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] hover:bg-emerald-500/20">Alto uso</Badge>}
                      <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Users className="w-3 h-3" />{t.userCount}
                        <Handshake className="w-3 h-3 ml-1" />{t.dealsCount}
                        {t.waConnected > 0 && <Wifi className="w-3 h-3 ml-1 text-emerald-400" />}
                      </div>
                    </div>
                  }
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Upgrade Candidates */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              <span>Potencial de Upgrade</span>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] ml-auto hover:bg-emerald-500/20">{d.upgradeCandidates.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-1.5 sm:px-2 pb-2 sm:pb-3 max-h-72 sm:max-h-80 overflow-y-auto">
            {d.upgradeCandidates.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center px-2">Nenhum candidato identificado</p>
            ) : (
              d.upgradeCandidates.map((t: any) => (
                <TenantRow
                  key={t.id}
                  tenant={t}
                  onClick={() => navigate(`/super-admin/tenant/${t.id}`)}
                  extra={
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Users className="w-3 h-3" />{t.userCount}
                        <Handshake className="w-3 h-3 ml-1" />{t.dealsCount}
                      </div>
                      {t.totalWonCents > 0 && (
                        <span className="text-[10px] text-emerald-400 font-medium">{fmt(t.totalWonCents)}</span>
                      )}
                    </div>
                  }
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Churn Risk */}
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
              <span>Risco de Churn</span>
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] ml-auto hover:bg-red-500/20">{d.churnRisk.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-1.5 sm:px-2 pb-2 sm:pb-3 max-h-52 sm:max-h-60 overflow-y-auto">
            {d.churnRisk.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center px-2">Nenhum tenant com risco de churn</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0.5 sm:gap-1">
                {d.churnRisk.map((t: any) => (
                  <TenantRow
                    key={t.id}
                    tenant={t}
                    onClick={() => navigate(`/super-admin/tenant/${t.id}`)}
                    extra={
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {t.lastActivity ? new Date(t.lastActivity).toLocaleDateString("pt-BR") : "Sem atividade"}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
