import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Smartphone, Wifi, WifiOff, QrCode,
  ShieldAlert, Loader2, RefreshCw, CheckCircle2,
  Settings2, Trash2, Users, Info, Share2, Mic, Brain, AlertTriangle,
  Zap, Server
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import SessionSharing from "@/components/SessionSharing";
import ProviderManager from "@/components/ProviderManager";
import { useTenantId } from "@/hooks/useTenantId";

export default function WhatsApp() {
  const tenantId = useTenantId();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [isWaitingQr, setIsWaitingQr] = useState(false);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<{
    contactsToDelete: number;
    sample: Array<{ id: number; name: string; phone: string }>;
  } | null>(null);

  const utils = trpc.useUtils();
  const { qrData, waStatus } = useSocket();
  const { isAdmin } = useIsAdmin();

  const sessions = trpc.whatsapp.sessions.useQuery(undefined, { refetchInterval: 15000, staleTime: 10000, refetchIntervalInBackground: false });

  // The user's session (each user has exactly one)
  const mySession = sessions.data?.[0] || null;
  const isConnected = mySession?.liveStatus === "connected";
  const isConnecting = mySession?.liveStatus === "connecting" || mySession?.liveStatus === "reconnecting";

  // ─── AI Settings (transcription) ───
  const aiSettingsQ = trpc.ai.getSettings.useQuery(undefined,
    { enabled: tenantId > 0, staleTime: 30_000 }
  );
  const updateAiSettingsMut = trpc.ai.updateSettings.useMutation({
    onSuccess: () => {
      utils.ai.getSettings.invalidate();
      toast.success("Configuração salva com sucesso!");
    },
    onError: (err: any) => toast.error(`Erro ao salvar: ${err.message}`),
  });

  // ─── Contact Import Settings ───
  const contactSettings = trpc.whatsapp.getContactImportSettings.useQuery(undefined,
    { enabled: tenantId > 0, staleTime: 30_000 }
  );

  const saveSettings = trpc.whatsapp.saveContactImportSettings.useMutation({
    onSuccess: () => {
      utils.whatsapp.getContactImportSettings.invalidate();
      toast.success("Configuração salva com sucesso!");
    },
    onError: (err) => toast.error(`Erro ao salvar: ${err.message}`),
  });

  const cleanupMutation = trpc.whatsapp.cleanupSyncedContacts.useMutation({
    onSuccess: (data) => {
      if (data.dryRun) {
        setDryRunResult({
          contactsToDelete: data.contactsToDelete ?? 0,
          sample: (data.sample as any) ?? [],
        });
      } else {
        setDryRunResult(null);
        setCleanupDialogOpen(false);
        toast.success(`${data.contactsDeleted} contato(s) removido(s) com sucesso!`);
      }
    },
    onError: (err) => toast.error(`Erro na limpeza: ${err.message}`),
  });

  const handleToggleImport = (checked: boolean) => {
    saveSettings.mutate({ importContactsFromAgenda: checked });
  };

  const handleCleanupDryRun = () => {
    setDryRunResult(null);
    cleanupMutation.mutate({ dryRun: true });
  };

  const handleCleanupConfirm = () => {
    cleanupMutation.mutate({ dryRun: false });
  };

  // ─── WhatsApp Connection Logic ───
  const connect = trpc.whatsapp.connect.useMutation({
    onMutate: () => {
      setIsWaitingQr(true);
    },
    onSuccess: (data) => {
      setIsWaitingQr(false);
      if (data.qrDataUrl) {
        setQrCode(data.qrDataUrl);
        setQrSessionId(data.sessionId);
        toast.success("QR Code gerado! Escaneie com seu WhatsApp.");
      } else if (data.status === "connected") {
        setQrCode(null);
        setQrSessionId(null);
        toast.success("WhatsApp já conectado!");
      } else {
        setQrSessionId(data.sessionId);
        toast.info("Aguardando QR Code...");
      }
      utils.whatsapp.sessions.invalidate();
    },
    onError: (err) => {
      setIsWaitingQr(false);
      toast.error(`Erro ao conectar: ${err.message}`);
    },
  });

  const disconnect = trpc.whatsapp.disconnect.useMutation({
    onSuccess: () => {
      utils.whatsapp.sessions.invalidate();
      setQrCode(null);
      setQrSessionId(null);
      toast.success("WhatsApp desconectado.");
    },
    onError: (err) => toast.error(`Erro ao desconectar: ${err.message}`),
  });

  const fixWebhooks = trpc.monitoring.fixWebhooks.useMutation({
    onSuccess: (data) => {
      toast.success(`Webhooks verificados: ${data.results.filter((r: any) => r.success).length}/${data.results.length} corrigidos`);
    },
    onError: (err) => toast.error(`Erro ao corrigir webhooks: ${err.message}`),
  });

  // Update QR code from WebSocket events (real-time)
  useEffect(() => {
    if (qrData?.qrDataUrl) {
      setQrCode(qrData.qrDataUrl);
      setQrSessionId(qrData.sessionId);
      setIsWaitingQr(false);
    }
  }, [qrData]);

  // Clear QR code when session connects (via WebSocket)
  useEffect(() => {
    if (waStatus) {
      utils.whatsapp.sessions.invalidate();
      if (waStatus.status === "connected" && waStatus.sessionId === qrSessionId) {
        setQrCode(null);
        setQrSessionId(null);
        toast.success("WhatsApp conectado com sucesso!");
      }
    }
  }, [waStatus]);

  // Poll QR code from the status endpoint as fallback
  const statusQuery = trpc.whatsapp.status.useQuery(
    { sessionId: qrSessionId || "" },
    {
      enabled: !!qrSessionId,
      refetchInterval: 15000, refetchIntervalInBackground: false,
    }
  );

  useEffect(() => {
    if (!statusQuery.data) return;
    if (statusQuery.data.qrDataUrl) {
      setQrCode(statusQuery.data.qrDataUrl);
      setIsWaitingQr(false);
    }
    if (statusQuery.data.status === "connected") {
      setQrCode(null);
      setQrSessionId(null);
      setIsWaitingQr(false);
      utils.whatsapp.sessions.invalidate();
    }
  }, [statusQuery.data]);

  // Also check sessions list for connection status changes
  useEffect(() => {
    if (!sessions.data || !qrSessionId) return;
    const session = sessions.data.find((s: any) => s.sessionId === qrSessionId);
    if (session?.liveStatus === "connected") {
      setQrCode(null);
      setQrSessionId(null);
      setIsWaitingQr(false);
    }
  }, [sessions.data, qrSessionId]);

  const handleConnect = () => {
    setQrCode(null);
    connect.mutate();
  };

  return (
    <div className="p-5 lg:px-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground">WhatsApp</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Conecte seu WhatsApp para enviar e receber mensagens pelo sistema.</p>
      </div>

      {/* Disclaimer API Não Oficial */}
      <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3.5 mb-6">
        <div className="flex gap-2.5 items-start">
          <ShieldAlert className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] text-amber-700 leading-relaxed">
              <strong>Aviso:</strong> Esta integração utiliza uma API não oficial do WhatsApp.
              Eventuais bloqueios ou restrições ao número conectado podem ocorrer por parte do WhatsApp/Meta.
              O sistema não se responsabiliza por bloqueios decorrentes do uso desta funcionalidade.
            </p>
          </div>
        </div>
      </div>

      {/* Loading sessions */}
      {sessions.isLoading && (
        <Card className="border border-border/40 shadow-none rounded-xl">
          <div className="p-12 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-[13px] text-muted-foreground">Verificando conexão...</p>
          </div>
        </Card>
      )}

      {/* CONNECTED STATE */}
      {!sessions.isLoading && isConnected && (
        <Card className="border border-emerald-200/60 shadow-none rounded-xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[16px] font-semibold text-foreground">WhatsApp Conectado</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 h-5 gap-1 ${
                      (mySession?.provider || 'evolution') === 'zapi'
                        ? 'border-blue-200 text-blue-700 bg-blue-50'
                        : 'border-emerald-200 text-emerald-700 bg-emerald-50'
                    }`}
                  >
                    {(mySession?.provider || 'evolution') === 'zapi' ? (
                      <><Zap className="h-3 w-3" />Z-API</>
                    ) : (
                      <><Server className="h-3 w-3" />Evolution</>
                    )}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[13px] text-emerald-600 font-medium">Online</span>
                </div>
              </div>
            </div>

            {/* Connection details */}
            <div className="rounded-xl bg-muted/30 p-4 space-y-2.5 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-muted-foreground">Provedor</span>
                <span className="text-[13px] font-medium">
                  {(mySession?.provider || 'evolution') === 'zapi' ? 'Z-API' : 'Evolution API'}
                </span>
              </div>
              {mySession?.phoneNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-muted-foreground">Número</span>
                  <span className="text-[13px] font-medium">{mySession.phoneNumber}</span>
                </div>
              )}
              {mySession?.user?.name && (
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-muted-foreground">Nome</span>
                  <span className="text-[13px] font-medium">{mySession.user.name}</span>
                </div>
              )}
              {mySession?.pushName && !mySession?.user?.name && (
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-muted-foreground">Nome</span>
                  <span className="text-[13px] font-medium">{mySession.pushName}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {isAdmin && (
                <Button
                  variant="outline"
                  className="flex-1 h-10 rounded-xl text-[13px]"
                  disabled={fixWebhooks.isPending}
                  onClick={() => fixWebhooks.mutate()}
                >
                  {fixWebhooks.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verificando...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" />Corrigir Webhooks</>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                className={`${isAdmin ? 'flex-1' : 'w-full'} h-10 rounded-xl text-[13px] border-red-200 text-red-600 hover:bg-red-50`}
                disabled={disconnect.isPending}
                onClick={() => {
                  if (mySession) disconnect.mutate({ sessionId: mySession.sessionId });
                }}
              >
                {disconnect.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Desconectando...</>
                ) : (
                  <><WifiOff className="h-4 w-4 mr-2" />Desconectar WhatsApp</>
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* CONNECTING / WAITING QR STATE */}
      {!sessions.isLoading && (isConnecting || isWaitingQr) && !qrCode && !isConnected && (
        <Card className="border border-emerald-200/60 bg-emerald-50/30 shadow-none rounded-xl overflow-hidden">
          <div className="p-8 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
            <p className="text-[14px] font-medium text-emerald-800">Gerando QR Code...</p>
            <p className="text-[12px] text-emerald-600">Aguarde, isso pode levar até 15 segundos.</p>
          </div>
        </Card>
      )}

      {/* QR CODE STATE */}
      {qrCode && !isConnected && (
        <Card className="border border-emerald-200/60 shadow-none rounded-xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <QrCode className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[15px] font-semibold">Escaneie o QR Code</p>
                <p className="text-[12px] text-muted-foreground">Abra o WhatsApp no celular para conectar</p>
              </div>
            </div>
            <div className="flex justify-center py-3">
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                <img src={qrCode} alt="QR Code" className="w-[260px] h-[260px] rounded-xl" />
              </div>
            </div>
            <div className="text-center mt-4 space-y-1.5">
              <p className="text-[12px] text-muted-foreground">
                Abra o WhatsApp no celular &rarr; Menu &rarr; <strong>Aparelhos Conectados</strong> &rarr; <strong>Conectar Aparelho</strong>
              </p>
              <p className="text-[11px] text-muted-foreground/70">
                O QR Code atualiza automaticamente a cada 20 segundos.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* NOT CONNECTED STATE — Show connect button */}
      {!sessions.isLoading && !isConnected && !isConnecting && !isWaitingQr && !qrCode && (
        <Card className="border border-border/40 shadow-none rounded-xl">
          <div className="p-8 flex flex-col items-center gap-5">
            <div className="h-20 w-20 rounded-3xl bg-muted/40 flex items-center justify-center">
              <Smartphone className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-foreground">WhatsApp não conectado</p>
              <p className="text-[13px] text-muted-foreground mt-1.5 max-w-sm">
                Conecte seu WhatsApp para enviar e receber mensagens diretamente pelo sistema.
                Será gerado um QR Code para você escanear com seu celular.
              </p>
            </div>
            <Button
              className="h-11 px-8 rounded-xl text-[14px] font-semibold shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors gap-2"
              disabled={connect.isPending || isWaitingQr}
              onClick={handleConnect}
            >
              {connect.isPending || isWaitingQr ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Conectando...</>
              ) : (
                <><Wifi className="h-4 w-4" />Conectar WhatsApp</>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* DISCONNECTED STATE — Session exists but not connected */}
      {!sessions.isLoading && mySession && !isConnected && !isConnecting && !isWaitingQr && !qrCode && mySession.liveStatus === "disconnected" && (
        <Card className="border border-border/40 shadow-none rounded-xl mt-4">
          <div className="p-6 flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center">
              <WifiOff className="h-7 w-7 text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-foreground">Sessão desconectada</p>
              {mySession.phoneNumber && (
                <p className="text-[13px] text-muted-foreground mt-1">Número: {mySession.phoneNumber}</p>
              )}
              <p className="text-[12px] text-muted-foreground mt-1">
                Clique abaixo para reconectar ao seu WhatsApp.
              </p>
            </div>
            <Button
              className="h-10 px-6 rounded-xl text-[13px] font-medium shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors gap-2"
              disabled={connect.isPending || isWaitingQr}
              onClick={handleConnect}
            >
              {connect.isPending || isWaitingQr ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Reconectando...</>
              ) : (
                <><RefreshCw className="h-4 w-4" />Reconectar</>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* ─── SHARED SESSION BANNER (for non-admin users) ─── */}
      {!sessions.isLoading && mySession && (mySession as any).isShared && (
        <Card className="border border-violet-200/60 bg-violet-50/30 shadow-none rounded-xl overflow-hidden mb-4">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <Share2 className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-violet-800">Sessão Compartilhada</p>
                <p className="text-[12px] text-violet-600 mt-0.5">
                  Você está usando a sessão de <strong>{(mySession as any).sharedByName || 'outro usuário'}</strong>.
                  {mySession.phoneNumber && ` Número: ${mySession.phoneNumber}`}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ─── SESSION SHARING (Admin only) ─── */}
      {isAdmin && <SessionSharing tenantId={tenantId} />}

      {/* ─── PROVIDER MANAGEMENT (Admin only) ─── */}
      {isAdmin && mySession && <ProviderManager session={mySession as any} />}

      {/* ─── CONFIGURAÇÕES DE CONTATOS ─── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-[15px] font-semibold text-foreground">Configurações de Contatos</h2>
        </div>

        <Card className="border border-border/40 shadow-none rounded-xl">
          <div className="p-5 space-y-5">
            {/* Toggle: Import contacts from WhatsApp agenda */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3 items-start">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Users className="h-4.5 w-4.5 text-blue-600" />
                </div>
                <div>
                  <Label htmlFor="import-contacts-toggle" className="text-[13px] font-medium text-foreground cursor-pointer">
                    Importar contatos da agenda do WhatsApp
                  </Label>
                  <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed max-w-md">
                    Quando ativado, os contatos salvos na agenda do seu WhatsApp serão automaticamente
                    importados para o CRM durante a sincronização. Quando desativado, apenas contatos
                    de conversas ativas serão criados.
                  </p>
                </div>
              </div>
              <Switch
                id="import-contacts-toggle"
                checked={contactSettings.data?.importContactsFromAgenda ?? false}
                onCheckedChange={handleToggleImport}
                disabled={saveSettings.isPending || contactSettings.isLoading}
                className="shrink-0 mt-1"
              />
            </div>

            {/* Divider */}
            <div className="border-t border-border/40" />

            {/* Cleanup synced contacts */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3 items-start">
                <div className="h-9 w-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Trash2 className="h-4.5 w-4.5 text-red-500" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-foreground">
                    Limpar contatos sincronizados
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed max-w-md">
                    Remove contatos que foram importados automaticamente da agenda do WhatsApp e que
                    <strong> não possuem negociações</strong> associadas. Contatos criados manualmente
                    e contatos com negociações serão preservados.
                  </p>
                </div>
              </div>

              <AlertDialog open={cleanupDialogOpen} onOpenChange={(open) => {
                setCleanupDialogOpen(open);
                if (!open) setDryRunResult(null);
              }}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 mt-1 h-9 px-4 rounded-lg text-[12px] border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 gap-1.5"
                    onClick={() => {
                      setCleanupDialogOpen(true);
                      handleCleanupDryRun();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Limpar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-[16px]">Limpar contatos sincronizados</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        {cleanupMutation.isPending && !dryRunResult && (
                          <div className="flex items-center gap-2 py-4 justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            <span className="text-[13px] text-muted-foreground">Analisando contatos...</span>
                          </div>
                        )}

                        {dryRunResult && (
                          <>
                            {dryRunResult.contactsToDelete === 0 ? (
                              <div className="rounded-lg bg-emerald-50 border border-emerald-200/60 p-3.5">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                  <p className="text-[13px] text-emerald-700 font-medium">
                                    Nenhum contato para remover!
                                  </p>
                                </div>
                                <p className="text-[12px] text-emerald-600 mt-1.5 ml-6">
                                  Todos os contatos sincronizados já possuem negociações associadas
                                  ou foram criados manualmente.
                                </p>
                              </div>
                            ) : (
                              <>
                                <div className="rounded-lg bg-red-50 border border-red-200/60 p-3.5">
                                  <p className="text-[13px] text-red-700 font-medium">
                                    {dryRunResult.contactsToDelete} contato(s) será(ão) removido(s)
                                  </p>
                                  <p className="text-[12px] text-red-600 mt-1">
                                    Estes contatos foram importados da agenda do WhatsApp e não possuem
                                    negociações no CRM.
                                  </p>
                                </div>

                                {dryRunResult.sample.length > 0 && (
                                  <div className="rounded-lg border border-border/40 overflow-hidden">
                                    <div className="px-3 py-2 bg-muted/30 border-b border-border/40">
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                        Amostra dos contatos a remover
                                      </p>
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto">
                                      {dryRunResult.sample.map((c) => (
                                        <div key={c.id} className="px-3 py-2 border-b border-border/20 last:border-0 flex justify-between items-center">
                                          <span className="text-[12px] text-foreground">{c.name || "Sem nome"}</span>
                                          <span className="text-[11px] text-muted-foreground font-mono">{c.phone}</span>
                                        </div>
                                      ))}
                                      {dryRunResult.contactsToDelete > dryRunResult.sample.length && (
                                        <div className="px-3 py-2 text-center">
                                          <span className="text-[11px] text-muted-foreground">
                                            ... e mais {dryRunResult.contactsToDelete - dryRunResult.sample.length} contato(s)
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                <div className="rounded-lg bg-amber-50 border border-amber-200/60 p-3">
                                  <div className="flex gap-2 items-start">
                                    <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-amber-700 leading-relaxed">
                                      Esta ação <strong>não pode ser desfeita</strong>. Contatos com negociações
                                      e contatos criados manualmente serão preservados.
                                    </p>
                                  </div>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-lg text-[13px]">Cancelar</AlertDialogCancel>
                    {dryRunResult && dryRunResult.contactsToDelete > 0 && (
                      <AlertDialogAction
                        className="rounded-lg text-[13px] bg-red-600 hover:bg-red-700 text-white"
                        onClick={(e) => {
                          e.preventDefault();
                          handleCleanupConfirm();
                        }}
                        disabled={cleanupMutation.isPending}
                      >
                        {cleanupMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Removendo...</>
                        ) : (
                          <>Confirmar remoção</>
                        )}
                      </AlertDialogAction>
                    )}
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── TRANSCRIÇÃO DE ÁUDIOS COM IA ─── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-[15px] font-semibold text-foreground">Transcrição de Áudios com IA</h2>
        </div>

        <Card className="border border-border/40 shadow-none rounded-xl">
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3 items-start">
                <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Mic className="h-4.5 w-4.5 text-violet-600" />
                </div>
                <div>
                  <Label htmlFor="transcription-toggle" className="text-[13px] font-medium text-foreground cursor-pointer">
                    Transcrever áudios automaticamente
                  </Label>
                  <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed max-w-md">
                    Quando ativado, todos os áudios recebidos nas conversas serão automaticamente
                    transcritos para texto usando a API da OpenAI (Whisper).
                  </p>
                </div>
              </div>
              <Switch
                id="transcription-toggle"
                checked={aiSettingsQ.data?.audioTranscriptionEnabled ?? false}
                onCheckedChange={(checked) => {
                  updateAiSettingsMut.mutate({ audioTranscriptionEnabled: checked });
                }}
                disabled={updateAiSettingsMut.isPending || aiSettingsQ.isLoading}
                className="shrink-0 mt-1"
              />
            </div>

            {/* Warning about OpenAI requirement */}
            <div className="rounded-lg bg-amber-50 border border-amber-200/60 p-3">
              <div className="flex gap-2 items-start">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Esta funcionalidade requer uma <strong>API da OpenAI</strong> conectada.
                  Configure em <strong>Integrações &gt; IA</strong> para que a transcrição funcione.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
