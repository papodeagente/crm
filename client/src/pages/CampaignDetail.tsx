/**
 * CampaignDetail — Detalhes de uma campanha de envio em massa
 * Mostra estatísticas, template da mensagem e status de cada mensagem individual.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTenantId } from "@/hooks/useTenantId";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Ban, Loader2,
  ChevronLeft, ChevronRight, Send, Users, Calendar,
  MessageSquare, SkipForward, Filter, Eye, AlertTriangle,
  Phone, User, Mail, FileText,
} from "lucide-react";

// ─── Status Config ───
const campaignStatusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  running: { label: "Em andamento", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30", icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  completed: { label: "Concluída", color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", icon: <CheckCircle2 className="w-4 h-4" /> },
  cancelled: { label: "Cancelada", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", icon: <Ban className="w-4 h-4" /> },
  failed: { label: "Falhou", color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30", icon: <XCircle className="w-4 h-4" /> },
};

const msgStatusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { label: "Pendente", color: "text-gray-500", bg: "bg-gray-100 dark:bg-gray-800", icon: <Clock className="w-3 h-3" /> },
  sending: { label: "Enviando", color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  sent: { label: "Enviada", color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", icon: <CheckCircle2 className="w-3 h-3" /> },
  delivered: { label: "Entregue", color: "text-emerald-700", bg: "bg-emerald-100 dark:bg-emerald-900/30", icon: <CheckCircle2 className="w-3 h-3" /> },
  read: { label: "Lida", color: "text-blue-700", bg: "bg-blue-100 dark:bg-blue-900/30", icon: <Eye className="w-3 h-3" /> },
  failed: { label: "Falhou", color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30", icon: <XCircle className="w-3 h-3" /> },
  skipped: { label: "Ignorada", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", icon: <SkipForward className="w-3 h-3" /> },
};

function formatDate(d: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDuration(start: string | Date, end: string | Date | null) {
  if (!end) return "em andamento";
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

export default function CampaignDetail() {
  const tenantId = useTenantId();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/campaigns/:id");
  const campaignId = Number(params?.id);
  const [msgPage, setMsgPage] = useState(1);
  const [msgStatusFilter, setMsgStatusFilter] = useState<string>("all");
  const msgPageSize = 50;

  const detailQ = trpc.rfv.campaignDetail.useQuery(
    { campaignId, tenantId },
    { enabled: !!campaignId, refetchInterval: (query) => query.state.data?.status === "running" ? 3000 : false },
  );

  const messagesQ = trpc.rfv.campaignMessages.useQuery(
    {
      campaignId,
      tenantId,
      page: msgPage,
      pageSize: msgPageSize,
      status: msgStatusFilter === "all" ? undefined : msgStatusFilter,
    },
    { enabled: !!campaignId, refetchInterval: (query) => detailQ.data?.status === "running" ? 5000 : false },
  );

  const campaign = detailQ.data;
  const messages = messagesQ.data?.messages || [];
  const msgTotal = messagesQ.data?.total || 0;
  const msgTotalPages = Math.ceil(msgTotal / msgPageSize);

  if (!campaignId || isNaN(campaignId)) {
    return (
      <div className="container max-w-6xl py-6">
        <p className="text-muted-foreground">Campanha não encontrada.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => setLocation("/campaigns")}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
      </div>
    );
  }

  if (detailQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container max-w-6xl py-6">
        <p className="text-muted-foreground">Campanha não encontrada.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => setLocation("/campaigns")}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
      </div>
    );
  }

  const sc = campaignStatusConfig[campaign.status] || campaignStatusConfig.completed;
  const progressPct = campaign.totalContacts > 0
    ? Math.round(((campaign.sentCount + campaign.failedCount + campaign.skippedCount) / campaign.totalContacts) * 100)
    : 0;
  const successRate = (campaign.sentCount + campaign.failedCount) > 0
    ? Math.round((campaign.sentCount / (campaign.sentCount + campaign.failedCount)) * 100)
    : 0;

  const breakdown = campaign.breakdown || {};

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* Back button + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/campaigns")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{campaign.name}</h1>
            <Badge variant="outline" className={`${sc.bg} ${sc.color} border-0 gap-1`}>
              {sc.icon}
              {sc.label}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(campaign.startedAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Duração: {formatDuration(campaign.startedAt, campaign.completedAt)}
            </span>
            {campaign.userName && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {campaign.userName}
              </span>
            )}
            {campaign.source && (
              <Badge variant="outline" className="text-xs py-0 h-5">{campaign.source}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-card/50">
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{campaign.totalContacts}</p>
            <p className="text-xs text-muted-foreground">Total Contatos</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-emerald-600">{campaign.sentCount}</p>
            <p className="text-xs text-muted-foreground">Enviadas</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4 text-center">
            <XCircle className="w-5 h-5 text-red-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-red-600">{campaign.failedCount}</p>
            <p className="text-xs text-muted-foreground">Falhas</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4 text-center">
            <SkipForward className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-amber-600">{campaign.skippedCount}</p>
            <p className="text-xs text-muted-foreground">Ignoradas</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4 text-center">
            <Send className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-blue-600">{successRate}%</p>
            <p className="text-xs text-muted-foreground">Taxa de Sucesso</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      {campaign.status === "running" && (
        <Card className="bg-card/50 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso do envio</span>
              <span className="text-sm text-muted-foreground">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Message Template */}
      <Card className="bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Template da Mensagem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap font-mono">
            {campaign.messageTemplate}
          </div>
          <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
            <span>Intervalo: {(campaign.intervalMs / 1000).toFixed(0)}s</span>
            <span>Sessão: {campaign.sessionId}</span>
            {campaign.audienceFilter && <span>Filtro: {campaign.audienceFilter}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      {Object.keys(breakdown).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(breakdown).map(([status, cnt]) => {
            const mc = msgStatusConfig[status] || msgStatusConfig.pending;
            return (
              <Badge
                key={status}
                variant="outline"
                className={`${mc.bg} ${mc.color} border-0 gap-1 cursor-pointer hover:opacity-80`}
                onClick={() => { setMsgStatusFilter(status); setMsgPage(1); }}
              >
                {mc.icon}
                {mc.label}: {cnt as number}
              </Badge>
            );
          })}
        </div>
      )}

      <Separator />

      {/* Messages Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Mensagens Individuais</h2>
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={msgStatusFilter} onValueChange={(v) => { setMsgStatusFilter(v); setMsgPage(1); }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sent">Enviadas</SelectItem>
                <SelectItem value="delivered">Entregues</SelectItem>
                <SelectItem value="read">Lidas</SelectItem>
                <SelectItem value="failed">Falhas</SelectItem>
                <SelectItem value="skipped">Ignoradas</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="sending">Enviando</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{msgTotal} mensagens</span>
          </div>
        </div>

        {messagesQ.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <Card className="bg-card/50">
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma mensagem encontrada com este filtro.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Table */}
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Contato</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Telefone</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Enviada em</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((msg: any, idx: number) => {
                      const mc = msgStatusConfig[msg.status] || msgStatusConfig.pending;
                      return (
                        <tr key={msg.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="p-3 text-muted-foreground text-xs">
                            {(msgPage - 1) * msgPageSize + idx + 1}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                {msg.contactName?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                              <span className="font-medium truncate max-w-[200px]">{msg.contactName}</span>
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {msg.contactPhone ? (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {msg.contactPhone}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className={`${mc.bg} ${mc.color} border-0 text-xs gap-1`}>
                              {mc.icon}
                              {mc.label}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">
                            {formatDate(msg.sentAt)}
                          </td>
                          <td className="p-3">
                            {msg.errorMessage ? (
                              <span className="text-xs text-red-500 flex items-center gap-1 max-w-[200px] truncate" title={msg.errorMessage}>
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                {msg.errorMessage}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {msgTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Página {msgPage} de {msgTotalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={msgPage <= 1} onClick={() => setMsgPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={msgPage >= msgTotalPages} onClick={() => setMsgPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
