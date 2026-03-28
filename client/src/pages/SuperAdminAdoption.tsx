import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, BarChart3, TrendingUp, AlertTriangle } from "lucide-react";

function AdoptionBar({ name, tenants, total, rate }: { name: string; tenants: number; total: number; rate: number }) {
  const color = rate >= 60 ? "bg-emerald-400" : rate >= 30 ? "bg-amber-400" : "bg-red-400";
  const textColor = rate >= 60 ? "text-emerald-400" : rate >= 30 ? "text-amber-400" : "text-red-400";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{name}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{tenants}/{total} tenants</span>
          <span className={`text-xs font-bold ${textColor}`}>{rate}%</span>
        </div>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

export default function SuperAdminAdoption() {
  const meQuery = trpc.saasAuth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });

  const adoptionQ = trpc.superAdminDash.featureAdoption.useQuery(undefined, {
    enabled: !!meQuery.data?.isSuperAdmin,
    staleTime: 120_000,
  });

  if (meQuery.isLoading || adoptionQ.isLoading) {
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

  const data = adoptionQ.data;
  if (!data) return null;

  const sorted = [...data.features].sort((a, b) => b.adoptionRate - a.adoptionRate);
  const highAdoption = sorted.filter(f => f.adoptionRate >= 50);
  const lowAdoption = sorted.filter(f => f.adoptionRate < 30);
  const medAdoption = sorted.filter(f => f.adoptionRate >= 30 && f.adoptionRate < 50);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Adoção de Produto</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quais funcionalidades do Entur OS estão sendo realmente usadas — {data.totalActive} tenants ativos
        </p>
      </div>

      {/* Main adoption chart */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Taxa de Adoção por Feature
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          {sorted.map((f: any) => (
            <AdoptionBar
              key={f.key}
              name={f.name}
              tenants={f.tenants}
              total={data.totalActive}
              rate={f.adoptionRate}
            />
          ))}
        </CardContent>
      </Card>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Alta Adoção
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {highAdoption.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhuma feature com alta adoção</p>
            ) : (
              <div className="space-y-2">
                {highAdoption.map((f: any) => (
                  <div key={f.key} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{f.name}</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] hover:bg-emerald-500/20">{f.adoptionRate}%</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              Adoção Moderada
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {medAdoption.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">—</p>
            ) : (
              <div className="space-y-2">
                {medAdoption.map((f: any) => (
                  <div key={f.key} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{f.name}</span>
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] hover:bg-amber-500/20">{f.adoptionRate}%</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Baixa Adoção
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {lowAdoption.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Todas as features têm boa adoção</p>
            ) : (
              <div className="space-y-2">
                {lowAdoption.map((f: any) => (
                  <div key={f.key} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{f.name}</span>
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] hover:bg-red-500/20">{f.adoptionRate}%</Badge>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-3 border-t border-border/30 pt-2">
              Features com baixa adoção podem indicar necessidade de onboarding, treinamento ou revisão de UX.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
