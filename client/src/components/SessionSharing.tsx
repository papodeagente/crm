import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Share2, Loader2, XCircle, Wifi, WifiOff,
  UserPlus, Check, AlertTriangle, ChevronRight
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
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
      toast.success(`Sessão compartilhada com ${data.created} agente(s)!`);
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
      toast.success("Acesso revogado.");
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

  // Toggle user selection — memoized to avoid re-renders
  const toggleUser = useCallback((userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  }, []);

  const handleShare = () => {
    if (!selectedSessionId || selectedUserIds.length === 0) return;
    shareSession.mutate({
      tenantId,
      sourceSessionId: selectedSessionId,
      targetUserIds: selectedUserIds,
    });
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name?.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase() || "?";
  };

  // Group shares by source session
  const sharesBySession = useMemo(() => {
    const map = new Map<string, any[]>();
    activeShares.forEach((s: any) => {
      const key = s.sourceSessionId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [activeShares]);

  return (
    <div className="mt-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <Share2 className="h-4.5 w-4.5 text-violet-500" />
            Compartilhar Sessão
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Permita que agentes atendam usando o mesmo número WhatsApp
          </p>
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
              Compartilhar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[16px]">Compartilhar Sessão</DialogTitle>
              <DialogDescription className="text-[13px]">
                Escolha a sessão e selecione os agentes que terão acesso.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Step 1: Session selector */}
              <div>
                <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                  1. Sessão WhatsApp
                </label>
                <Select value={selectedSessionId} onValueChange={(v) => {
                  setSelectedSessionId(v);
                  setSelectedUserIds([]);
                }}>
                  <SelectTrigger className="rounded-lg h-10">
                    <SelectValue placeholder="Selecione a sessão..." />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedSessions.map((s: any) => (
                      <SelectItem key={s.sessionId} value={s.sessionId}>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                          <span>{s.ownerName || "Sem nome"}</span>
                          {s.phoneNumber && (
                            <span className="text-muted-foreground text-[11px]">({s.phoneNumber})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Step 2: Agent selection */}
              {selectedSessionId && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[12px] font-medium text-muted-foreground">
                      2. Selecione os agentes
                    </label>
                    {availableTargetUsers.length > 0 && (
                      <button
                        type="button"
                        className="text-[11px] text-violet-500 hover:text-violet-400 font-medium transition-colors"
                        onClick={() => {
                          const allAvailable = availableTargetUsers
                            .filter((a: any) => !activeShares.some(
                              (s: any) => s.targetUserId === a.id && s.sourceSessionId === selectedSessionId
                            ))
                            .map((a: any) => a.id);
                          setSelectedUserIds(prev =>
                            prev.length === allAvailable.length ? [] : allAvailable
                          );
                        }}
                      >
                        {selectedUserIds.length === availableTargetUsers.filter((a: any) => !activeShares.some(
                          (s: any) => s.targetUserId === a.id && s.sourceSessionId === selectedSessionId
                        )).length ? "Desmarcar todos" : "Selecionar todos"}
                      </button>
                    )}
                  </div>
                  <div className="border border-border/40 rounded-lg max-h-[260px] overflow-y-auto divide-y divide-border/20">
                    {availableTargetUsers.length === 0 ? (
                      <div className="p-6 text-center text-[12px] text-muted-foreground">
                        Nenhum agente disponível
                      </div>
                    ) : (
                      availableTargetUsers.map((agent: any) => {
                        const isSelected = selectedUserIds.includes(agent.id);
                        const hasExistingShare = activeShares.some(
                          (s: any) => s.targetUserId === agent.id && s.sourceSessionId === selectedSessionId
                        );
                        return (
                          <button
                            type="button"
                            key={agent.id}
                            disabled={hasExistingShare}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all
                              ${hasExistingShare
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer hover:bg-violet-500/5 active:bg-violet-500/10"
                              }
                              ${isSelected ? "bg-violet-500/10" : ""}
                            `}
                            onClick={() => !hasExistingShare && toggleUser(agent.id)}
                          >
                            {/* Custom checkbox */}
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all
                              ${isSelected
                                ? "bg-violet-600 border-violet-600"
                                : hasExistingShare
                                  ? "bg-violet-600/30 border-violet-600/30"
                                  : "border-border/60 hover:border-violet-400"
                              }
                            `}>
                              {(isSelected || hasExistingShare) && (
                                <Check className="h-3 w-3 text-white" strokeWidth={3} />
                              )}
                            </div>

                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
                              <span className="text-[11px] font-bold text-violet-400">
                                {getInitials(agent.name)}
                              </span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-foreground truncate">{agent.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{agent.email}</p>
                            </div>

                            {hasExistingShare && (
                              <span className="text-[10px] text-violet-400 font-medium shrink-0">
                                Já tem acesso
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Info notice */}
              {selectedUserIds.length > 0 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex gap-2 items-start">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    Os agentes selecionados passarão a usar esta sessão compartilhada.
                    Você pode revogar o acesso a qualquer momento.
                  </p>
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
                  <>
                    <Share2 className="h-3.5 w-3.5" />
                    Compartilhar com {selectedUserIds.length} agente{selectedUserIds.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Shares — grouped by session */}
      <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
        {shares.isLoading ? (
          <div className="flex items-center justify-center py-10 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-[13px] text-muted-foreground">Carregando...</span>
          </div>
        ) : activeShares.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-3">
            <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Share2 className="h-6 w-6 text-violet-500/40" />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-medium text-foreground">Nenhum compartilhamento ativo</p>
              <p className="text-[12px] text-muted-foreground mt-1">
                Compartilhe uma sessão para que agentes atendam pelo mesmo número.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {Array.from(sharesBySession.entries()).map(([sessionId, sessionShares]) => {
              const session = (tenantSessions.data || []).find((s: any) => s.sessionId === sessionId);
              return (
                <div key={sessionId}>
                  {/* Session header */}
                  <div className="px-4 py-2.5 bg-muted/20 flex items-center gap-2">
                    {session?.liveStatus === "connected" ? (
                      <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-[12px] font-medium text-foreground">
                      {session?.ownerName || sessionId}
                    </span>
                    {session?.phoneNumber && (
                      <span className="text-[11px] text-muted-foreground">({session.phoneNumber})</span>
                    )}
                    <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />
                    <span className="text-[11px] text-muted-foreground">
                      {sessionShares.length} agente{sessionShares.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Shared agents */}
                  {sessionShares.map((share: any) => (
                    <div
                      key={share.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/10 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-violet-400">
                          {getInitials(share.targetUserName || "")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">
                          {share.targetUserName || `Usuário #${share.targetUserId}`}
                        </p>
                        {share.sharedByName && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            Adicionado por {share.sharedByName}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 rounded-md text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                        disabled={revokeShare.isPending}
                        onClick={() => revokeShare.mutate({ tenantId, shareId: share.id })}
                      >
                        {revokeShare.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <><XCircle className="h-3.5 w-3.5 mr-1" />Revogar</>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Connected Sessions — compact */}
      {tenantSessions.data && tenantSessions.data.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Sessões disponíveis
          </p>
          <div className="flex flex-wrap gap-2">
            {tenantSessions.data.map((s: any) => (
              <div
                key={s.sessionId}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/30 bg-muted/10 text-[12px]"
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${
                  s.liveStatus === "connected" ? "bg-emerald-500" : "bg-muted-foreground/30"
                }`} />
                <span className="text-foreground font-medium">{s.ownerName || s.sessionId}</span>
                {s.phoneNumber && (
                  <span className="text-muted-foreground text-[11px]">{s.phoneNumber}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
