/**
 * Campaigns — Registro de Campanhas de Envio em Massa
 * Lista todas as campanhas com status, progresso e link para detalhes.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Send, CheckCircle2, XCircle, Clock, Ban, Loader2,
  ChevronLeft, ChevronRight, BarChart3, MessageSquare,
  Users, Calendar, ArrowRight, Filter, SkipForward,
  Eye, AlertTriangle,
} from "lucide-react";

// ─── Status Config ───
const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  running: { label: "Em andamento", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30", icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
  completed: { label: "Concluída", color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  cancelled: { label: "Cancelada", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", icon: <Ban className="w-3.5 h-3.5" /> },
  failed: { label: "Falhou", color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30", icon: <XCircle className="w-3.5 h-3.5" /> },
};

function formatDate(d: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function formatDuration(start: string | Date, end: string | Date | null) {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

export default function Campaigns() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const pageSize = 15;

  const campaignsQ = trpc.rfv.campaigns.useQuery({ page,
    pageSize,
    status: statusFilter === "all" ? undefined : statusFilter,
  }, { refetchInterval: 10000 });

  const campaigns = campaignsQ.data?.campaigns || [];
  const total = campaignsQ.data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // Summary stats
  const summary = useMemo(() => {
    if (!campaigns.length) return { total: 0, running: 0, completed: 0, totalSent: 0, totalFailed: 0 };
    return {
      total,
      running: campaigns.filter((c: any) => c.status === "running").length,
      completed: campaigns.filter((c: any) => c.status === "completed").length,
      totalSent: campaigns.reduce((acc: number, c: any) => acc + (c.sentCount || 0), 0),
      totalFailed: campaigns.reduce((acc: number, c: any) => acc + (c.failedCount || 0), 0),
    };
  }, [campaigns, total]);

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campanhas de Envio em Massa</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registro completo de todas as campanhas WhatsApp com status detalhado de cada mensagem.
          </p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/rfv")} className="gap-2">
          <Send className="w-4 h-4" />
          Nova Campanha
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Campanhas</p>
                <p className="text-xl font-semibold">{total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Loader2 className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em Andamento</p>
                <p className="text-xl font-semibold">{summary.running}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mensagens Enviadas</p>
                <p className="text-xl font-semibold">{summary.totalSent.toLocaleString("pt-BR")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Falhas</p>
                <p className="text-xl font-semibold">{summary.totalFailed.toLocaleString("pt-BR")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="running">Em andamento</SelectItem>
            <SelectItem value="completed">Concluídas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
            <SelectItem value="failed">Falhas</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">
          {total} campanha{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Campaign List */}
      {campaignsQ.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="bg-card/50">
          <CardContent className="py-16 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Nenhuma campanha encontrada</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Inicie um envio em massa pela Matriz RFV para criar sua primeira campanha.
            </p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setLocation("/rfv")}>
              <Send className="w-4 h-4" />
              Ir para Matriz RFV
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign: any) => {
            const sc = statusConfig[campaign.status] || statusConfig.completed;
            const progressPct = campaign.totalContacts > 0
              ? Math.round(((campaign.sentCount + campaign.failedCount + campaign.skippedCount) / campaign.totalContacts) * 100)
              : 0;
            const successRate = (campaign.sentCount + campaign.failedCount) > 0
              ? Math.round((campaign.sentCount / (campaign.sentCount + campaign.failedCount)) * 100)
              : 0;

            return (
              <Card
                key={campaign.id}
                className="bg-card/50 hover:bg-card/80 transition-colors cursor-pointer group"
                onClick={() => setLocation(`/campaigns/${campaign.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm truncate">{campaign.name}</h3>
                        <Badge variant="outline" className={`${sc.bg} ${sc.color} border-0 text-xs gap-1`}>
                          {sc.icon}
                          {sc.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(campaign.startedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {campaign.totalContacts} contatos
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(campaign.startedAt, campaign.completedAt)}
                        </span>
                        {campaign.audienceFilter && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4">
                            {campaign.audienceFilter}
                          </Badge>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3 flex items-center gap-3">
                        <Progress value={progressPct} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-10 text-right">{progressPct}%</span>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" />
                          {campaign.sentCount} enviadas
                        </span>
                        {campaign.failedCount > 0 && (
                          <span className="flex items-center gap-1 text-red-500">
                            <XCircle className="w-3 h-3" />
                            {campaign.failedCount} falhas
                          </span>
                        )}
                        {campaign.skippedCount > 0 && (
                          <span className="flex items-center gap-1 text-amber-500">
                            <SkipForward className="w-3 h-3" />
                            {campaign.skippedCount} ignoradas
                          </span>
                        )}
                        {successRate > 0 && (
                          <span className="text-muted-foreground">
                            Taxa: {successRate}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Action */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="gap-1 text-xs">
                        <Eye className="w-3.5 h-3.5" />
                        Detalhes
                      </Button>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
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
