import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  AlertTriangle, GitMerge, Loader2, ExternalLink, User
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface DuplicateAlertProps {
  contactId: number;
  email?: string;
  phone?: string;
}

export default function DuplicateAlert({ contactId, email, phone }: DuplicateAlertProps) {
  const [merging, setMerging] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const duplicatesQ = trpc.crm.contacts.findDuplicates.useQuery(
    { contactId, email: email || undefined, phone: phone || undefined },
    { enabled: !!contactId && !!(email || phone) }
  );

  const mergeMutation = trpc.crm.contacts.merge.useMutation({
    onSuccess: (result) => {
      utils.crm.contacts.get.invalidate({ id: contactId });
      utils.crm.contacts.mergeHistory.invalidate({ contactId });
      utils.crm.contacts.findDuplicates.invalidate({ contactId });
      toast.success(`Contatos unificados com sucesso. ${result.movedDeals} negociações e ${result.movedTasks} tarefas movidas.`);
      setMerging(null);
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao unificar contatos");
      setMerging(null);
    },
  });

  const duplicates = duplicatesQ.data || [];

  if (duplicatesQ.isLoading || duplicates.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-400">
            Possíveis Duplicatas Encontradas
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            O sistema encontrou {duplicates.length} contato{duplicates.length > 1 ? "s" : ""} com dados semelhantes.
            Você pode unificar os registros para manter os dados organizados.
          </p>

          <div className="space-y-2 mt-3">
            {duplicates.map((dup: any) => (
              <div
                key={dup.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-background/50 border border-border/30"
              >
                <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {dup.name || `Contato #${dup.id}`}
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      #{dup.id}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {dup.email && <span>{dup.email}</span>}
                    {dup.email && dup.phone && <span>•</span>}
                    {dup.phone && <span>{dup.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link href={`/contact/${dup.id}`}>
                    <Button size="sm" variant="ghost" className="h-7 text-xs">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={mergeMutation.isPending}
                      >
                        {mergeMutation.isPending && merging === dup.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <GitMerge className="h-3 w-3 mr-1" />
                        )}
                        Unificar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Unificar Contatos</AlertDialogTitle>
                        <AlertDialogDescription>
                          <span className="block mb-2">
                            O contato atual (#{contactId}) será mantido como <strong>principal</strong>.
                          </span>
                          <span className="block mb-2">
                            Os dados do contato #{dup.id} ({dup.name}) serão movidos para cá:
                            negociações, tarefas, conversões e conversas do WhatsApp.
                          </span>
                          <span className="block text-amber-400">
                            Esta ação pode ser revertida enquanto o merge estiver pendente de revisão.
                          </span>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            setMerging(dup.id);
                            mergeMutation.mutate({
                              primaryContactId: contactId,
                              secondaryContactId: dup.id,
                            });
                          }}
                        >
                          <GitMerge className="h-4 w-4 mr-2" />
                          Unificar Contatos
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
