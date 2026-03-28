import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2, Zap, ShieldCheck,
  Info, CheckCircle2, XCircle,
  CloudLightning, Package, Calendar, Clock
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ProviderManagerProps {
  session: {
    sessionId: string;
    provider?: string;
    providerInstanceId?: string | null;
    providerToken?: string | null;
    providerClientToken?: string | null;
    liveStatus?: string;
    phoneNumber?: string | null;
  };
}

export default function ProviderManager({ session }: ProviderManagerProps) {
  const utils = trpc.useUtils();

  // ─── Z-API Provisioning Status ───
  const provisioningQuery = trpc.monitoring.zapiProvisioningStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const provisionMut = trpc.monitoring.zapiProvision.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(data.alreadyProvisioned
          ? "Instância Z-API já provisionada para este tenant."
          : `Instância Z-API provisionada com sucesso! ID: ${data.instanceId}`);
        provisioningQuery.refetch();
        utils.whatsapp.sessions.invalidate();
      } else {
        toast.error(`Falha ao provisionar: ${data.error}`);
      }
    },
    onError: (err: any) => toast.error(`Erro ao provisionar: ${err.message}`),
  });
  const deprovisionMut = trpc.monitoring.zapiDeprovision.useMutation({
    onSuccess: () => {
      toast.success("Instância Z-API desprovisionada com sucesso.");
      provisioningQuery.refetch();
      utils.whatsapp.sessions.invalidate();
    },
    onError: (err: any) => toast.error(`Erro ao desprovisionar: ${err.message}`),
  });
  const [deprovisionDialogOpen, setDeprovisionDialogOpen] = useState(false);

  return (
    <div className="mt-8">
      {/* ─── CURRENT PROVIDER STATUS ─── */}
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-[15px] font-semibold text-foreground">Provedor de API</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[280px]">
              <p className="text-[12px]">
                Todas as sessões WhatsApp utilizam o provedor Z-API — serviço gerenciado com webhooks confiáveis.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card className="border border-border/40 shadow-none rounded-xl">
        <div className="p-5 space-y-5">
          {/* Current Provider Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-blue-50">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-semibold text-foreground">Z-API</p>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 border-blue-200 text-blue-700 bg-blue-50"
                  >
                    Ativo
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 border-purple-200 text-purple-700 bg-purple-50"
                  >
                    Automático
                  </Badge>
                </div>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Provisionado automaticamente — serviço gerenciado, webhooks confiáveis
                </p>
              </div>
            </div>
          </div>

          {/* Z-API Credentials */}
          <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-4 space-y-3">
            <p className="text-[12px] font-medium text-blue-800">Credenciais Z-API</p>
            <div className="grid gap-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-blue-600">Instance ID</span>
                <span className="text-[12px] font-mono text-blue-900">{session.providerInstanceId || "—"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-blue-600">Token</span>
                <span className="text-[12px] font-mono text-blue-900">
                  {session.providerToken ? "••••••••" : "—"}
                </span>
              </div>
              {session.providerClientToken && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-blue-600">Client Token</span>
                  <span className="text-[12px] font-mono text-blue-900">••••••••</span>
                </div>
              )}
            </div>
          </div>

          {/* Z-API Benefits */}
          <div className="rounded-xl border border-border/30 overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border/30">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Benefícios Z-API
              </p>
            </div>
            <div className="divide-y divide-border/20">
              {[
                { label: "Tipo", value: "Serviço gerenciado" },
                { label: "Webhooks", value: "Confiáveis e em tempo real" },
                { label: "Custo", value: "Incluído no plano" },
                { label: "Manutenção", value: "Baixa — gerenciado automaticamente" },
                { label: "Estabilidade", value: "Alta — SLA garantido" },
                { label: "Ativação", value: "Automática (pós-contratação)" },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-2 px-4 py-2">
                  <span className="text-[11px] text-muted-foreground font-medium">{row.label}</span>
                  <span className="text-[11px] font-semibold text-foreground">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* ─── Z-API PROVISIONING SECTION ─── */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-4">
          <CloudLightning className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-[15px] font-semibold text-foreground">Provisionamento Z-API</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[300px]">
                <p className="text-[12px]">
                  Ao ativar um plano pago, uma instância Z-API é provisionada
                  automaticamente via API de parceiro. Administradores também podem provisionar manualmente.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Card className="border border-border/40 shadow-none rounded-xl">
          <div className="p-5 space-y-4">
            {provisioningQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[13px]">Verificando provisionamento...</span>
              </div>
            ) : provisioningQuery.data?.provisioned && provisioningQuery.data.instance ? (
              <>
                {/* Instance Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-green-50">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-semibold text-foreground">
                          Instância Provisionada
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-5 ${
                            provisioningQuery.data.instance.status === "active"
                              ? "border-green-200 text-green-700 bg-green-50"
                              : provisioningQuery.data.instance.status === "pending"
                              ? "border-yellow-200 text-yellow-700 bg-yellow-50"
                              : "border-red-200 text-red-700 bg-red-50"
                          }`}
                        >
                          {provisioningQuery.data.instance.status === "active" ? "Ativa" :
                           provisioningQuery.data.instance.status === "pending" ? "Pendente" :
                           provisioningQuery.data.instance.status === "cancelled" ? "Cancelada" : "Expirada"}
                        </Badge>
                      </div>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        {provisioningQuery.data.instance.instanceName}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Instance Details */}
                <div className="rounded-xl bg-muted/30 border border-border/30 p-4 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Package className="h-3 w-3" /> Instance ID
                    </span>
                    <span className="text-[12px] font-mono text-foreground">
                      {provisioningQuery.data.instance.zapiInstanceId}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" /> Criada em
                    </span>
                    <span className="text-[12px] text-foreground">
                      {new Date(provisioningQuery.data.instance.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  {provisioningQuery.data.instance.subscribedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3" /> Assinada em
                      </span>
                      <span className="text-[12px] text-foreground">
                        {new Date(provisioningQuery.data.instance.subscribedAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  )}
                  {provisioningQuery.data.instance.expiresAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> Expira em
                      </span>
                      <span className="text-[12px] text-foreground">
                        {new Date(provisioningQuery.data.instance.expiresAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Deprovision Button */}
                <div className="pt-1">
                  <Button
                    variant="outline"
                    className="h-9 rounded-lg text-[12px] border-red-200 text-red-600 hover:bg-red-50 gap-1.5"
                    onClick={() => setDeprovisionDialogOpen(true)}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Desprovisionar Instância
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* No instance provisioned */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-muted/50">
                    <CloudLightning className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-foreground">
                      Nenhuma instância provisionada
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      Uma instância Z-API será criada automaticamente ao ativar um plano pago.
                    </p>
                  </div>
                </div>

                <Button
                  className="h-10 rounded-xl text-[13px] gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => provisionMut.mutate()}
                  disabled={provisionMut.isPending}
                >
                  {provisionMut.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Provisionando...</>
                  ) : (
                    <><CloudLightning className="h-4 w-4" />Provisionar Instância Z-API</>
                  )}
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* ─── DEPROVISION DIALOG ─── */}
      <AlertDialog open={deprovisionDialogOpen} onOpenChange={setDeprovisionDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px] flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Desprovisionar Instância Z-API
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-[13px]">
                  Esta ação irá cancelar e remover a instância Z-API provisionada para este tenant.
                </p>
                <div className="rounded-lg bg-red-50 border border-red-200/60 p-3">
                  <div className="flex gap-2 items-start">
                    <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-red-700 space-y-1">
                      <p className="font-medium">O que acontece:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>A instância Z-API será cancelada na plataforma</li>
                        <li>Sessões usando esta instância serão desconectadas</li>
                        <li>Uma nova instância pode ser provisionada depois</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg text-[13px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg text-[13px] bg-red-600 hover:bg-red-700 text-white gap-2"
              onClick={(e) => {
                e.preventDefault();
                deprovisionMut.mutate();
                setDeprovisionDialogOpen(false);
              }}
              disabled={deprovisionMut.isPending}
            >
              {deprovisionMut.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Removendo...</>
              ) : (
                <><XCircle className="h-4 w-4" />Confirmar Remoção</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
