import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import {
  Loader2, ShieldAlert, Lightbulb, Search, AlertTriangle,
  TrendingUp, Target, ArrowRight, Building2
} from "lucide-react";

export default function SuperAdminStrategicHelp() {
  const [, navigate] = useLocation();
  const meQuery = trpc.saasAuth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });

  const [search, setSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);

  const tenantsQ = trpc.superAdminDash.tenantsList.useQuery(
    useMemo(() => ({ page: 1, pageSize: 100, search: search || undefined }), [search]),
    { enabled: !!meQuery.data?.isSuperAdmin, staleTime: 60_000 }
  );

  const helpQ = trpc.superAdminDash.strategicHelp.useQuery(
    { tenantId: selectedTenantId! },
    { enabled: !!meQuery.data?.isSuperAdmin && !!selectedTenantId, staleTime: 60_000 }
  );

  if (meQuery.isLoading) {
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

  const typeIcon = (type: string) => {
    switch (type) {
      case "risk": return <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />;
      case "opportunity": return <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />;
      default: return <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "risk": return "Risco";
      case "opportunity": return "Oportunidade";
      default: return "Ação";
    }
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case "high": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "medium": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default: return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Central de Ajuda Estratégica</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Selecione um tenant para ver recomendações
        </p>
      </div>

      {/* On mobile: show tenant selector as collapsible, on desktop: side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Tenant Selector */}
        <Card className="border-border/50 lg:col-span-1">
          <CardHeader className="pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Selecionar Tenant
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
            <div className="relative mb-2 sm:mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tenant..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="space-y-0.5 sm:space-y-1 max-h-[250px] sm:max-h-[400px] overflow-y-auto">
              {tenantsQ.isLoading ? (
                <div className="flex items-center justify-center py-6 sm:py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (tenantsQ.data?.tenants || []).length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhum tenant encontrado</p>
              ) : (
                (tenantsQ.data?.tenants || []).map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTenantId(t.id)}
                    className={`w-full flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-left transition-colors ${
                      selectedTenantId === t.id ? "bg-primary/10 border border-primary/30" : "hover:bg-accent/30"
                    }`}
                  >
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-primary/10 flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-primary shrink-0">
                      {t.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs sm:text-sm text-foreground truncate block">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{t.plan}</span>
                    </div>
                    {selectedTenantId === t.id && <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {!selectedTenantId ? (
            <Card className="border-border/50">
              <CardContent className="p-8 sm:p-12 text-center">
                <Lightbulb className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400/30 mx-auto mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">Selecione um tenant</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Escolha um tenant na lista para ver recomendações estratégicas.
                </p>
              </CardContent>
            </Card>
          ) : helpQ.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : helpQ.data ? (
            <>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <h2 className="text-base sm:text-lg font-semibold text-foreground">{helpQ.data.tenantName}</h2>
                <Badge variant="secondary" className="capitalize">{helpQ.data.plan}</Badge>
              </div>

              {helpQ.data.recommendations.length === 0 ? (
                <Card className="border-emerald-500/20 bg-emerald-500/5">
                  <CardContent className="p-4 sm:p-6 text-center">
                    <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400 mx-auto mb-2 sm:mb-3" />
                    <p className="text-xs sm:text-sm font-medium text-foreground">Tenant bem posicionado</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Nenhuma recomendação crítica.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {helpQ.data.recommendations.map((rec: any, i: number) => (
                    <Card key={i} className={`border ${
                      rec.type === "risk" ? "border-red-500/20" :
                      rec.type === "opportunity" ? "border-emerald-500/20" :
                      "border-amber-500/20"
                    }`}>
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="mt-0.5 shrink-0">{typeIcon(rec.type)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                              <span className="text-xs sm:text-sm font-semibold text-foreground">{rec.title}</span>
                              <Badge className={`${priorityColor(rec.priority)} text-[9px] hover:${priorityColor(rec.priority)}`}>
                                {rec.priority === "high" ? "Alta" : rec.priority === "medium" ? "Média" : "Baixa"}
                              </Badge>
                              <Badge variant="secondary" className="text-[9px]">{typeLabel(rec.type)}</Badge>
                            </div>
                            <p className="text-[11px] sm:text-xs text-muted-foreground">{rec.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => navigate(`/super-admin/tenant/${selectedTenantId}`)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Ver diagnóstico completo <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
