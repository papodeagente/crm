import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Share2, Users, Loader2, XCircle, Wifi, WifiOff,
  Phone, UserPlus, Trash2, CheckCircle2, AlertTriangle
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

interface SessionSharingProps {
  tenantId: number;
}

export default function SessionSharing({ tenantId }: SessionSharingProps) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const utils = trpc.useUtils();

  // Queries
  const tenantSessions = trpc.whatsapp.tenantSessions.useQuery(
    { tenantId },
    { enabled: tenantId > 0, staleTime: 15_000 }
  );

  const shares = trpc.whatsapp.listShares.useQuery(
    { tenantId },
    { enabled: tenantId > 0, staleTime: 10_000 }
  );

  const agents = trpc.whatsapp.agents.useQuery(
    { tenantId },
    { enabled: tenantId > 0, staleTime: 60_000 }
  );

  // Mutations
  const shareSession = trpc.whatsapp.shareSession.useMutation({
    onSuccess: (data) => {
      toast.success(`Sessão compartilhada com ${data.created} usuário(s)!`);
      utils.whatsapp.listShares.invalidate();
      utils.whatsapp.tenantSessions.invalidate();
      setShareDialogOpen(false);
      setSelectedSessionId("");
      setSelectedUserIds([]);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const revokeShare = trpc.whatsapp.revokeShare.useMutation({
    onSuccess: () => {
      toast.success("Compartilhamento revogado.");
      utils.whatsapp.listShares.invalidate();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const revokeAll = trpc.whatsapp.revokeAllShares.useMutation({
    onSuccess: () => {
      toast.success("Todos os compartilhamentos revogados.");
      utils.whatsapp.listShares.invalidate();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  // Derived data
  const connectedSessions = useMemo(
    () => (tenantSessions.data || []).filter((s: any) => s.liveStatus === "connected"),
    [tenantSessions.data]
  );

  const activeShares = useMemo(
    () => (shares.data || []).filter((s: any) => s.status === "active"),
    [shares.data]
  );

  // Get the selected session's owner to exclude from target list
  const selectedSession = useMemo(
    () => connectedSessions.find((s: any) => s.sessionId === selectedSessionId),
    [connectedSessions, selectedSessionId]
  );

  const availableTargetUsers = useMemo(() => {
    if (!agents.data || !selectedSession) return [];
    return agents.data.filter((a: any) =>
      a.id !== selectedSession.userId && a.status === "active"
    );
  }, [agents.data, selectedSession]);

  const toggleUser = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleShare = () => {
    if (!selectedSessionId || selectedUserIds.length === 0) return;
    shareSession.mutate({
      tenantId,
      sourceSessionId: selectedSessionId,
      targetUserIds: selectedUserIds,
    });
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-[15px] font-semibold text-foreground">Compartilhamento de Sessão</h2>
        </div>
        <Dialog open={shareDialogOpen} onOpenChange={(open) => {
          setShareDialogOpen(open);
          if (!open) {
            setSelectedSessionId("");
            setSelectedUserIds([]);
          }
        }}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="h-8 px-3 rounded-lg text-[12px] gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
              disabled={connectedSessions.length === 0}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Compartilhar Sessão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[16px]">Compartilhar Sessão WhatsApp</DialogTitle>
              <DialogDescription className="text-[13px]">
                Selecione uma sessão conectada e os agentes que receberão acesso.
                Os agentes selecionados terão sua própria sessão desconectada e passarão a usar a sessão compartilhada.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Session selector */}
              <div>
                <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                  Sessão de origem
                </label>
                <Select value={selectedSessionId} onValueChange={(v) => {
                  setSelectedSessionId(v);
                  setSelectedUserIds([]);
                }}>
                  <SelectTrigger className="rounded-lg h-10">
                    <SelectValue placeholder="Selecione uma sessão conectada..." />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedSessions.map((s: any) => (
                      <SelectItem key={s.sessionId} value={s.sessionId}>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span>{s.ownerName || "Sem nome"}</span>
                          {s.phoneNumber && (
                            <span className="text-muted-foreground text-[11px]">({s.phoneNumber})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                    {connectedSessions.length === 0 && (
                      <div className="p-3 text-center text-[12px] text-muted-foreground">
                        Nenhuma sessão conectada disponível
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Target users */}
              {selectedSessionId && (
                <div>
                  <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                    Agentes que receberão acesso ({selectedUserIds.length} selecionado{selectedUserIds.length !== 1 ? "s" : ""})
                  </label>
                  <div className="border border-border/40 rounded-lg max-h-[240px] overflow-y-auto">
                    {availableTargetUsers.length === 0 ? (
                      <div className="p-4 text-center text-[12px] text-muted-foreground">
                        Nenhum agente disponível para compartilhar
                      </div>
                    ) : (
                      availableTargetUsers.map((agent: any) => {
                        const isSelected = selectedUserIds.includes(agent.id);
                        const hasExistingShare = activeShares.some(
                          (s: any) => s.targetUserId === agent.id && s.sourceSessionId === selectedSessionId
                        );
                        return (
                          <div
                            key={agent.id}
                            className={`flex items-center gap-3 px-3 py-2.5 border-b border-border/20 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors ${isSelected ? "bg-violet-50/50" : ""}`}
                            onClick={() => !hasExistingShare && toggleUser(agent.id)}
                          >
                            <Checkbox
                              checked={isSelected || hasExistingShare}
                              disabled={hasExistingShare}
                              onCheckedChange={() => !hasExistingShare && toggleUser(agent.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-foreground truncate">{agent.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{agent.email}</p>
                            </div>
                            {hasExistingShare && (
                              <Badge variant="outline" className="text-[10px] shrink-0 border-violet-200 text-violet-600">
                                Já compartilhado
                              </Badge>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Warning */}
              {selectedUserIds.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200/60 p-3">
                  <div className="flex gap-2 items-start">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      Os agentes selecionados terão sua sessão própria <strong>desconectada</strong> e
                      passarão a usar a sessão compartilhada. Eles poderão ver e responder conversas
                      da sessão de origem. Para reverter, revogue o compartilhamento.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" className="rounded-lg text-[13px]" onClick={() => setShareDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="rounded-lg text-[13px] bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
                disabled={!selectedSessionId || selectedUserIds.length === 0 || shareSession.isPending}
                onClick={handleShare}
              >
                {shareSession.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Compartilhando...</>
                ) : (
                  <><Share2 className="h-4 w-4" />Compartilhar com {selectedUserIds.length} agente{selectedUserIds.length !== 1 ? "s" : ""}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Shares List */}
      <Card className="border border-border/40 shadow-none rounded-xl">
        <div className="p-5">
          {shares.isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-[13px] text-muted-foreground">Carregando compartilhamentos...</span>
            </div>
          ) : activeShares.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="h-14 w-14 rounded-2xl bg-muted/30 flex items-center justify-center">
                <Share2 className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-medium text-foreground">Nenhum compartilhamento ativo</p>
                <p className="text-[12px] text-muted-foreground mt-1 max-w-sm">
                  Compartilhe uma sessão WhatsApp conectada com outros agentes da equipe para que
                  eles possam atender usando o mesmo número.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                  {activeShares.length} compartilhamento{activeShares.length !== 1 ? "s" : ""} ativo{activeShares.length !== 1 ? "s" : ""}
                </p>
              </div>

              {activeShares.map((share: any) => (
                <div
                  key={share.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-muted/10 hover:bg-muted/20 transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                    <Share2 className="h-4 w-4 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-foreground truncate">
                        {share.sourceUserName || "Sessão"}
                      </p>
                      <span className="text-[11px] text-muted-foreground">&rarr;</span>
                      <p className="text-[13px] font-medium text-violet-600 truncate">
                        {share.targetUserName || `Usuário #${share.targetUserId}`}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Sessão: {share.sourceSessionId}
                      {share.sharedByName && ` · Compartilhado por ${share.sharedByName}`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 rounded-md text-[11px] border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 shrink-0"
                    disabled={revokeShare.isPending}
                    onClick={() => revokeShare.mutate({ tenantId, shareId: share.id })}
                  >
                    {revokeShare.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" />Revogar</>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Connected Sessions Overview */}
      {tenantSessions.data && tenantSessions.data.length > 0 && (
        <div className="mt-4">
          <p className="text-[12px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Sessões do Tenant
          </p>
          <div className="grid gap-2">
            {tenantSessions.data.map((s: any) => (
              <div
                key={s.sessionId}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border/20 bg-background"
              >
                {s.liveStatus === "connected" ? (
                  <Wifi className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <WifiOff className="h-4 w-4 text-slate-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-foreground truncate">
                    {s.ownerName || s.sessionId}
                  </p>
                  {s.phoneNumber && (
                    <p className="text-[11px] text-muted-foreground">{s.phoneNumber}</p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${
                    s.liveStatus === "connected"
                      ? "border-emerald-200 text-emerald-600"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  {s.liveStatus === "connected" ? "Online" : "Offline"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
