import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Smartphone, Wifi, WifiOff, QrCode, AlertTriangle,
  ShieldAlert, Loader2, RefreshCw, CheckCircle2
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";

export default function WhatsApp() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [isWaitingQr, setIsWaitingQr] = useState(false);

  const utils = trpc.useUtils();
  const { qrData, waStatus } = useSocket();

  const sessions = trpc.whatsapp.sessions.useQuery(undefined, { refetchInterval: 5000 });

  // The user's session (each user has exactly one)
  const mySession = sessions.data?.[0] || null;
  const isConnected = mySession?.liveStatus === "connected";
  const isConnecting = mySession?.liveStatus === "connecting" || mySession?.liveStatus === "reconnecting";

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
      refetchInterval: 2000,
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
                <p className="text-[16px] font-semibold text-foreground">WhatsApp Conectado</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[13px] text-emerald-600 font-medium">Online</span>
                </div>
              </div>
            </div>

            {/* Connection details */}
            <div className="rounded-xl bg-muted/30 p-4 space-y-2.5 mb-5">
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

            <Button
              variant="outline"
              className="w-full h-10 rounded-xl text-[13px] border-red-200 text-red-600 hover:bg-red-50"
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
    </div>
  );
}
