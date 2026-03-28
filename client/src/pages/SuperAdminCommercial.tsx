import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Loader2, ShieldAlert, TrendingUp, TrendingDown, AlertTriangle,
  ArrowRight, Users, Handshake, Clock, Wifi, Zap, Target
} from "lucide-react";

const fmt = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function TenantRow({ tenant, onClick, extra }: { tenant: any; onClick: () => void; extra?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/30 transition-colors text-left group"
    >
      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
        {tenant.name?.charAt(0)?.toUpperCase() || "?"}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground truncate block">{tenant.name}</span>
        <span className="text-xs text-muted-foreground capitalize">{tenant.plan}</span>
      </div>
      {extra}
      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!meQuery.data?.isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
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
  const trialsHighUsage = d.trials.filter((t: any) => t.highUsage);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comercial e Expansão</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão de crescimento do SaaS focada em retenção e expansão</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Em Trial</p>
            <p className="text-2xl font-bold text-purple-400">{d.trials.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Trial Expirando</p>
            <p className="text-2xl font-bold text-amber-400">{trialsExpiring.length}</p>
            <p className="text-[10px] text-muted-foreground">Próximos 7 dias</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Potencial Upgrade</p>
            <p className="text-2xl font-bold text-emerald-400">{d.upgradeCandidates.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Risco de Churn</p>
            <p className="text-2xl font-bold text-red-400">{d.churnRisk.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trials */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              Tenants em Trial
              <Badge variant="secondary" className="text-[10px] ml-auto">{d.trials.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3 max-h-80 overflow-y-auto">
            {d.trials.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center px-2">Nenhum tenant em trial</p>
            ) : (
              d.trials.map((t: any) => (
                <TenantRow
                  key={t.id}
                  tenant={t}
                  onClick={() => navigate(`/super-admin/tenant/${t.id}`)}
                  extra={
                    <div className="flex items-center gap-2 shrink-0">
                      {t.expiringsSoon && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] hover:bg-amber-500/20">Expirando</Badge>}
                      {t.highUsage && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] hover:bg-emerald-500/20">Alto uso</Badge>}
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
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
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Potencial de Upgrade
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] ml-auto hover:bg-emerald-500/20">{d.upgradeCandidates.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3 max-h-80 overflow-y-auto">
            {d.upgradeCandidates.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center px-2">Nenhum candidato identificado</p>
            ) : (
              d.upgradeCandidates.map((t: any) => (
                <TenantRow
                  key={t.id}
                  tenant={t}
                  onClick={() => navigate(`/super-admin/tenant/${t.id}`)}
                  extra={
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
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
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Risco de Churn
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] ml-auto hover:bg-red-500/20">{d.churnRisk.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3 max-h-60 overflow-y-auto">
            {d.churnRisk.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center px-2">Nenhum tenant com risco de churn identificado</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {d.churnRisk.map((t: any) => (
                  <TenantRow
                    key={t.id}
                    tenant={t}
                    onClick={() => navigate(`/super-admin/tenant/${t.id}`)}
                    extra={
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">
                          {t.lastActivity ? `Último: ${new Date(t.lastActivity).toLocaleDateString("pt-BR")}` : "Sem atividade"}
                        </span>
                      </div>
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
