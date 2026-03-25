import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  GitMerge, Undo2, CheckCircle2, AlertTriangle,
  Loader2, ChevronDown, ChevronUp, Clock, Shield
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

function statusBadge(status: string) {
  switch (status) {
    case "pending_review":
      return <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30"><Clock className="h-2.5 w-2.5 mr-1" />Pendente</Badge>;
    case "confirmed":
      return <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30"><CheckCircle2 className="h-2.5 w-2.5 mr-1" />Confirmado</Badge>;
    case "reverted":
      return <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/30"><Undo2 className="h-2.5 w-2.5 mr-1" />Revertido</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
}

function matchLabel(matchType: string) {
  switch (matchType) {
    case "email": return "Email";
    case "phone": return "Telefone";
    case "email_and_phone": return "Email + Telefone";
    case "lead_id": return "Lead ID";
    case "manual": return "Manual";
    default: return matchType;
  }
}

function formatDate(d: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

interface MergeHistoryProps {
  contactId: number;
}

export default function MergeHistory({ contactId }: MergeHistoryProps) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const mergesQ = trpc.crm.contacts.mergeHistory.useQuery(
    { contactId },
    { enabled: !!contactId }
  );

  const confirmMerge = trpc.crm.contacts.confirmMerge.useMutation({
    onSuccess: () => {
      utils.crm.contacts.mergeHistory.invalidate({ contactId });
      toast.success("Merge confirmado com sucesso");
    },
    onError: (err) => toast.error(err.message || "Erro ao confirmar merge"),
  });

  const revertMerge = trpc.crm.contacts.revertMerge.useMutation({
    onSuccess: () => {
      utils.crm.contacts.mergeHistory.invalidate({ contactId });
      utils.crm.contacts.get.invalidate({ id: contactId });
      toast.success("Merge revertido com sucesso. Os contatos foram restaurados.");
    },
    onError: (err) => toast.error(err.message || "Erro ao reverter merge"),
  });

  const merges = mergesQ.data || [];
  const pendingMerges = merges.filter((m: any) => m.status === "pending_review");

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <GitMerge className="h-4 w-4 text-primary" />
          Unificações de Contato ({merges.length})
          {pendingMerges.length > 0 && (
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30 ml-1">
              {pendingMerges.length} pendente{pendingMerges.length > 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {mergesQ.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : merges.length === 0 ? (
          <div className="text-center py-8">
            <GitMerge className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma unificação registrada</p>
            <p className="text-xs text-muted-foreground mt-1">Unificações ocorrem automaticamente quando o sistema detecta contatos duplicados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Pending merges alert */}
            {pendingMerges.length > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium text-amber-400">Unificações pendentes de revisão</p>
                  <p className="text-muted-foreground mt-0.5">
                    O sistema detectou {pendingMerges.length} unificação{pendingMerges.length > 1 ? "ões" : ""} automática{pendingMerges.length > 1 ? "s" : ""}.
                    Revise e confirme ou reverta cada uma.
                  </p>
                </div>
              </div>
            )}

            {merges.map((merge: any) => {
              const isExpanded = expanded === merge.id;
              const isPrimary = merge.primaryContactId === contactId;
              const otherContactId = isPrimary ? merge.secondaryContactId : merge.primaryContactId;

              return (
                <div
                  key={merge.id}
                  className={`border rounded-lg overflow-hidden ${
                    merge.status === "pending_review"
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-border/30"
                  }`}
                >
                  <button
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => setExpanded(isExpanded ? null : merge.id)}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      merge.status === "pending_review"
                        ? "bg-amber-500/15"
                        : merge.status === "confirmed"
                        ? "bg-emerald-500/15"
                        : "bg-muted/50"
                    }`}>
                      <GitMerge className={`h-3.5 w-3.5 ${
                        merge.status === "pending_review"
                          ? "text-amber-400"
                          : merge.status === "confirmed"
                          ? "text-emerald-400"
                          : "text-muted-foreground"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {isPrimary
                            ? `Contato #${otherContactId} unificado aqui`
                            : `Unificado no contato #${otherContactId}`
                          }
                        </span>
                        {statusBadge(merge.status)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>{formatDate(merge.createdAt)}</span>
                        <span>•</span>
                        <span>Match: {matchLabel(merge.matchType)}</span>
                        {merge.createdBy && (
                          <>
                            <span>•</span>
                            <span>Por: {merge.createdBy === "system:lead_processor" ? "Sistema" : `Usuário #${merge.createdBy}`}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-border/20">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-2">
                        <div>
                          <span className="text-muted-foreground">Contato Principal</span>
                          <p className="text-foreground font-medium">#{merge.primaryContactId}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Contato Secundário</span>
                          <p className="text-foreground font-medium">#{merge.secondaryContactId}</p>
                        </div>
                        {merge.reason && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Motivo</span>
                            <p className="text-foreground font-medium">{merge.reason}</p>
                          </div>
                        )}
                        {merge.movedDealIds && (merge.movedDealIds as any[]).length > 0 && (
                          <div>
                            <span className="text-muted-foreground">Negociações movidas</span>
                            <p className="text-foreground font-medium">{(merge.movedDealIds as any[]).length}</p>
                          </div>
                        )}
                        {merge.movedTaskIds && (merge.movedTaskIds as any[]).length > 0 && (
                          <div>
                            <span className="text-muted-foreground">Tarefas movidas</span>
                            <p className="text-foreground font-medium">{(merge.movedTaskIds as any[]).length}</p>
                          </div>
                        )}
                        {merge.movedConversionEventIds && (merge.movedConversionEventIds as any[]).length > 0 && (
                          <div>
                            <span className="text-muted-foreground">Conversões movidas</span>
                            <p className="text-foreground font-medium">{(merge.movedConversionEventIds as any[]).length}</p>
                          </div>
                        )}
                        {merge.confirmedAt && (
                          <div>
                            <span className="text-muted-foreground">Confirmado em</span>
                            <p className="text-foreground font-medium">{formatDate(merge.confirmedAt)}</p>
                          </div>
                        )}
                        {merge.revertedAt && (
                          <div>
                            <span className="text-muted-foreground">Revertido em</span>
                            <p className="text-foreground font-medium">{formatDate(merge.revertedAt)}</p>
                          </div>
                        )}
                      </div>

                      {/* Actions for pending merges */}
                      {merge.status === "pending_review" && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/20">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                disabled={confirmMerge.isPending}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Confirmar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Unificação</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Ao confirmar, a unificação se torna permanente e não poderá mais ser revertida.
                                  Os dados do contato #{merge.secondaryContactId} foram movidos para o contato #{merge.primaryContactId}.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => confirmMerge.mutate({ mergeId: merge.id })}
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                  <Shield className="h-4 w-4 mr-2" />
                                  Confirmar Permanentemente
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
                                disabled={revertMerge.isPending}
                              >
                                <Undo2 className="h-3 w-3 mr-1" />
                                Reverter
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reverter Unificação</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Ao reverter, o contato #{merge.secondaryContactId} será restaurado com seus dados originais.
                                  Negociações, tarefas e conversões serão devolvidas ao contato original.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => revertMerge.mutate({ mergeId: merge.id })}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  <Undo2 className="h-4 w-4 mr-2" />
                                  Reverter Unificação
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
