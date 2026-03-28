import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, BarChart3, TrendingUp, AlertTriangle } from "lucide-react";

function AdoptionBar({ name, tenants, total, rate }: { name: string; tenants: number; total: number; rate: number }) {
  const color = rate >= 60 ? "bg-emerald-400" : rate >= 30 ? "bg-amber-400" : "bg-red-400";
  const textColor = rate >= 60 ? "text-emerald-400" : rate >= 30 ? "text-amber-400" : "text-red-400";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm font-medium text-foreground truncate">{name}</span>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="text-[10px] sm:text-xs text-muted-foreground">{tenants}/{total}</span>
          <span className={`text-[10px] sm:text-xs font-bold ${textColor}`}>{rate}%</span>
        </div>
      </div>
      <div className="h-2 sm:h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

function InsightCard({ title, icon: Icon, color, items, emptyText, footnote }: {
  title: string; icon: any; color: string;
  items: { key: string; name: string; adoptionRate: number }[];
  emptyText: string; footnote?: string;
}) {
  const badgeColor = color === "emerald" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" :
    color === "amber" ? "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20" :
    "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20";

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
        <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
          <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-${color}-400`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">{emptyText}</p>
        ) : (
          <div className="space-y-1.5 sm:space-y-2">
            {items.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm text-foreground truncate">{f.name}</span>
                <Badge className={`${badgeColor} text-[10px] shrink-0`}>{f.adoptionRate}%</Badge>
              </div>
            ))}
          </div>
        )}
        {footnote && (
          <p className="text-[10px] text-muted-foreground mt-2 sm:mt-3 border-t border-border/30 pt-2">
            {footnote}
          </p>
        )}
      </CardContent>
    </Card>
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

  const data = adoptionQ.data;
  if (!data) return null;

  const sorted = [...data.features].sort((a, b) => b.adoptionRate - a.adoptionRate);
  const highAdoption = sorted.filter(f => f.adoptionRate >= 50);
  const lowAdoption = sorted.filter(f => f.adoptionRate < 30);
  const medAdoption = sorted.filter(f => f.adoptionRate >= 30 && f.adoptionRate < 50);

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Adoção de Produto</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Features em uso — {data.totalActive} tenants ativos
        </p>
      </div>

      {/* Main adoption chart */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Taxa de Adoção por Feature
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3 sm:space-y-4">
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

      {/* Insights — stack on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <InsightCard
          title="Alta Adoção"
          icon={TrendingUp}
          color="emerald"
          items={highAdoption}
          emptyText="Nenhuma feature com alta adoção"
        />
        <InsightCard
          title="Adoção Moderada"
          icon={BarChart3}
          color="amber"
          items={medAdoption}
          emptyText="—"
        />
        <InsightCard
          title="Baixa Adoção"
          icon={AlertTriangle}
          color="red"
          items={lowAdoption}
          emptyText="Todas as features têm boa adoção"
          footnote="Features com baixa adoção podem indicar necessidade de onboarding, treinamento ou revisão de UX."
        />
      </div>
    </div>
  );
}
