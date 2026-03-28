import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, ShieldAlert, Activity, AlertTriangle, CheckCircle,
  Wifi, WifiOff, Zap, Server, Clock, XCircle, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";

function StatusCard({ title, value, status, icon: Icon }: {
  title: string; value: number; status: "ok" | "warning" | "critical"; icon: any;
}) {
  const colors = {
    ok: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
    warning: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
    critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  };
  const c = colors[status];
  return (
    <Card className={`border ${c.border}`}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${c.bg} shrink-0`}>
            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${c.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{title}</p>
            <p className={`text-lg sm:text-2xl font-bold ${c.text}`}>{value}</p>
          </div>
          <div className="shrink-0">
            {status === "ok" ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" /> :
             status === "warning" ? <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> :
             <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuperAdminHealth() {
  const meQuery = trpc.saasAuth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });

  const healthQ = trpc.superAdminDash.operationalHealth.useQuery(undefined, {
    enabled: !!meQuery.data?.isSuperAdmin,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (meQuery.isLoading || healthQ.isLoading) {
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

  const d = healthQ.data;
  if (!d) return null;

  const overallStatus = (d.jobsFailed24h > 5 || d.waDisconnected > 3 || d.integErrors > 3) ? "critical" :
    (d.jobsFailed24h > 0 || d.waDisconnected > 0 || d.integErrors > 0 || d.webhookErrors > 0) ? "warning" : "ok";

  const statusLabel = { ok: "Saudável", warning: "Atenção", critical: "Crítico" };
  const statusColor = { ok: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", warning: "bg-amber-500/20 text-amber-400 border-amber-500/30", critical: "bg-red-500/20 text-red-400 border-red-500/30" };

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      {/* Header — responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Saúde Operacional</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Monitoramento técnico-executivo</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Badge className={`${statusColor[overallStatus]} hover:${statusColor[overallStatus]}`}>
            {statusLabel[overallStatus]}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => healthQ.refetch()} disabled={healthQ.isFetching}>
            <RefreshCw className={`w-4 h-4 ${healthQ.isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Status Cards — 2 cols mobile, 4 desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <StatusCard
          title="Jobs Falha (24h)"
          value={d.jobsFailed24h}
          status={d.jobsFailed24h > 5 ? "critical" : d.jobsFailed24h > 0 ? "warning" : "ok"}
          icon={Server}
        />
        <StatusCard
          title="Jobs Pendentes"
          value={d.jobsPending}
          status={d.jobsPending > 50 ? "critical" : d.jobsPending > 10 ? "warning" : "ok"}
          icon={Clock}
        />
        <StatusCard
          title="Jobs DLQ"
          value={d.jobsDlq}
          status={d.jobsDlq > 10 ? "critical" : d.jobsDlq > 0 ? "warning" : "ok"}
          icon={AlertTriangle}
        />
        <StatusCard
          title="Integ. com Erro"
          value={d.integErrors}
          status={d.integErrors > 3 ? "critical" : d.integErrors > 0 ? "warning" : "ok"}
          icon={Zap}
        />
      </div>

      {/* WhatsApp Status — responsive */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="w-4 h-4" />
            WhatsApp Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <Wifi className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Conectadas</p>
                <p className="text-base sm:text-xl font-bold text-emerald-400">{d.waConnected}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <WifiOff className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Desconectadas</p>
                <p className="text-base sm:text-xl font-bold text-red-400">{d.waDisconnected}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/30 border border-border/50">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
                <p className="text-base sm:text-xl font-bold text-foreground">{d.waConnected + d.waDisconnected}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
          <div className="flex items-center gap-2">
            {d.webhookErrors > 0 ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="text-xs sm:text-sm text-foreground">
              {d.webhookErrors > 0 ? `${d.webhookErrors} webhook(s) com erro` : "Todos os webhooks operacionais"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {overallStatus === "ok" && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-medium text-foreground">Sistema operando normalmente</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Todos os indicadores dentro dos parâmetros esperados.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
