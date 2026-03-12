import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone, Plus, Send, Wifi, WifiOff, QrCode, MessageSquare, AlertTriangle, ShieldAlert, Trash2, MoreVertical, Loader2, RefreshCw, Phone, Hash } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";

type ConnectMethod = "qr" | "pairing";

export default function WhatsApp() {
  const [sessionName, setSessionName] = useState("");
  const [openConnect, setOpenConnect] = useState(false);
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isWaitingQr, setIsWaitingQr] = useState(false);
  // Pairing code state
  const [connectMethod, setConnectMethod] = useState<ConnectMethod>("qr");
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isPairingLoading, setIsPairingLoading] = useState(false);

  const utils = trpc.useUtils();
  const { qrData, waStatus } = useSocket();

  const sessions = trpc.whatsapp.sessions.useQuery(undefined, { refetchInterval: 5000 });

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
        toast.success("Sessão já conectada!");
      } else {
        // QR not ready yet — set the sessionId so polling kicks in
        setQrSessionId(data.sessionId);
        toast.info("Aguardando QR Code... Isso pode levar alguns segundos.");
      }
      utils.whatsapp.sessions.invalidate();
    },
    onError: (err) => {
      setIsWaitingQr(false);
      toast.error(`Erro ao conectar: ${err.message}`);
    },
  });

  const requestPairingCode = trpc.whatsapp.requestPairingCode.useMutation({
    onMutate: () => {
      setIsPairingLoading(true);
      setPairingCode(null);
    },
    onSuccess: (data) => {
      setIsPairingLoading(false);
      setPairingCode(data.code);
      setQrSessionId(data.phoneNumber); // Use phone as session tracking
      toast.success("Código de pareamento gerado! Digite no seu WhatsApp.");
    },
    onError: (err) => {
      setIsPairingLoading(false);
      toast.error(`Erro ao gerar código: ${err.message}`);
    },
  });

  const disconnect = trpc.whatsapp.disconnect.useMutation({
    onSuccess: () => {
      utils.whatsapp.sessions.invalidate();
      toast.success("Sessão desconectada.");
    },
    onError: (err) => toast.error(`Erro ao desconectar: ${err.message}`),
  });

  const deleteSession = trpc.whatsapp.deleteSession.useMutation({
    onSuccess: () => {
      utils.whatsapp.sessions.invalidate();
      toast.success("Sessão excluída com sucesso.");
      setDeleteConfirm(null);
      // If we were showing QR for this session, clear it
      if (qrSessionId === deleteConfirm) {
        setQrCode(null);
        setQrSessionId(null);
        setPairingCode(null);
      }
    },
    onError: (err) => {
      toast.error(`Erro ao excluir: ${err.message}`);
      setDeleteConfirm(null);
    },
  });

  const sendMsg = trpc.whatsapp.sendMessage.useMutation({
    onSuccess: () => { setMessage(""); toast.success("Mensagem enviada!"); },
    onError: (err) => toast.error(err.message),
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
        setPairingCode(null);
        toast.success("WhatsApp conectado com sucesso!");
      }
      if (waStatus.status === "deleted" && waStatus.sessionId) {
        utils.whatsapp.sessions.invalidate();
      }
    }
  }, [waStatus]);

  // Poll QR code from the status endpoint as fallback (when WebSocket doesn't deliver)
  const statusQuery = trpc.whatsapp.status.useQuery(
    { sessionId: qrSessionId || "" },
    {
      enabled: !!qrSessionId && connectMethod === "qr",
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
      setPairingCode(null);
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
      setPairingCode(null);
      setIsWaitingQr(false);
    }
  }, [sessions.data, qrSessionId]);

  const connectedSessions = useMemo(() =>
    sessions.data?.filter((s: any) => s.liveStatus === "connected") || [],
    [sessions.data]
  );

  const handleConnect = useCallback((sessionId: string) => {
    setQrCode(null);
    setPairingCode(null);
    setQrSessionId(sessionId);
    setSelectedSession(sessionId);
    connect.mutate({ sessionId });
  }, [connect]);

  const handleNewSession = useCallback(() => {
    if (!sessionName.trim()) return;
    setOpenConnect(false);
    if (connectMethod === "pairing") {
      // For pairing code: first start the connection, then request pairing code
      const sid = sessionName.trim();
      setQrSessionId(sid);
      connect.mutate({ sessionId: sid }, {
        onSuccess: () => {
          // After socket is created, request pairing code
          if (pairingPhone.trim()) {
            requestPairingCode.mutate({ sessionId: sid, phoneNumber: pairingPhone.trim() });
          }
        }
      });
    } else {
      handleConnect(sessionName.trim());
    }
    setSessionName("");
  }, [sessionName, handleConnect, connectMethod, pairingPhone, connect, requestPairingCode]);

  const handlePairingCodeRequest = useCallback((sessionId: string) => {
    if (!pairingPhone.trim()) {
      toast.error("Digite o número do telefone para gerar o código de pareamento.");
      return;
    }
    requestPairingCode.mutate({ sessionId, phoneNumber: pairingPhone.trim() });
  }, [pairingPhone, requestPairingCode]);

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">WhatsApp</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Gerencie conexões e envie mensagens.</p>
        </div>
        <Dialog open={openConnect} onOpenChange={setOpenConnect}>
          <DialogTrigger asChild>
            <Button className="h-9 gap-2 px-5 rounded-xl shadow-sm bg-emerald-600 hover:bg-emerald-700 text-[13px] font-medium text-white transition-colors">
              <Plus className="h-4 w-4" />Nova Sessão
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-lg">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center"><Smartphone className="h-4 w-4 text-emerald-600" /></div>
                Conectar WhatsApp
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-3">
              {/* Disclaimer API Não Oficial */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                <div className="flex gap-2.5">
                  <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-semibold text-amber-800">API Não Oficial do WhatsApp</p>
                    <p className="text-[12px] text-amber-700 mt-1 leading-relaxed">
                      Esta integração utiliza uma <strong>API não oficial</strong> do WhatsApp. 
                      Eventuais bloqueios ou restrições ao número conectado podem ocorrer por parte do WhatsApp/Meta. 
                      <strong>O ENTUR OS não se responsabiliza por bloqueios</strong> decorrentes do uso desta funcionalidade.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-[12px] font-medium">Nome da Sessão *</Label>
                <Input value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Ex: principal" className="mt-1.5 h-10 rounded-xl" onKeyDown={(e) => { if (e.key === "Enter" && connectMethod === "qr") handleNewSession(); }} />
              </div>

              {/* Connection method selector */}
              <div>
                <Label className="text-[12px] font-medium mb-2 block">Método de Conexão</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                      connectMethod === "qr"
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-border/40 hover:border-border"
                    }`}
                    onClick={() => setConnectMethod("qr")}
                  >
                    <QrCode className={`h-5 w-5 ${connectMethod === "qr" ? "text-emerald-600" : "text-muted-foreground"}`} />
                    <div>
                      <p className={`text-[13px] font-semibold ${connectMethod === "qr" ? "text-emerald-800" : "text-foreground"}`}>QR Code</p>
                      <p className="text-[11px] text-muted-foreground">Escaneie com a câmera</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                      connectMethod === "pairing"
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-border/40 hover:border-border"
                    }`}
                    onClick={() => setConnectMethod("pairing")}
                  >
                    <Hash className={`h-5 w-5 ${connectMethod === "pairing" ? "text-emerald-600" : "text-muted-foreground"}`} />
                    <div>
                      <p className={`text-[13px] font-semibold ${connectMethod === "pairing" ? "text-emerald-800" : "text-foreground"}`}>Código</p>
                      <p className="text-[11px] text-muted-foreground">Digite o código no celular</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Pairing code: phone number input */}
              {connectMethod === "pairing" && (
                <div>
                  <Label className="text-[12px] font-medium">Número do WhatsApp (com código do país) *</Label>
                  <Input
                    value={pairingPhone}
                    onChange={(e) => setPairingPhone(e.target.value)}
                    placeholder="5511999999999"
                    className="mt-1.5 h-10 rounded-xl"
                    onKeyDown={(e) => { if (e.key === "Enter") handleNewSession(); }}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Formato: código do país + DDD + número (sem espaços ou símbolos)</p>
                </div>
              )}

              <Button
                className="w-full h-11 rounded-xl text-[14px] font-semibold shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                disabled={!sessionName.trim() || connect.isPending || isWaitingQr || isPairingLoading || (connectMethod === "pairing" && !pairingPhone.trim())}
                onClick={handleNewSession}
              >
                {connect.isPending || isWaitingQr || isPairingLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{connectMethod === "pairing" ? "Gerando Código..." : "Gerando QR Code..."}</>
                ) : connectMethod === "pairing" ? "Gerar Código de Pareamento" : "Conectar via QR Code"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList className="bg-muted/30 border-0 rounded-lg p-1">
          <TabsTrigger value="sessions" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white">Sessões</TabsTrigger>
          <TabsTrigger value="send" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white">Enviar Mensagem</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          {/* Alerta permanente de API não oficial */}
          <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3.5">
            <div className="flex gap-2.5 items-start">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-700 leading-relaxed">
                <strong>Aviso:</strong> O WhatsApp integrado ao ENTUR OS utiliza uma API não oficial. Eventuais bloqueios ou restrições impostos pelo WhatsApp/Meta não são de responsabilidade do ENTUR OS. Use com moderação para evitar detecção.
              </p>
            </div>
          </div>

          {/* Loading state while waiting for QR */}
          {isWaitingQr && !qrCode && !pairingCode && (
            <Card className="border border-emerald-200/60 bg-emerald-50/30 shadow-none rounded-xl overflow-hidden">
              <div className="p-8 flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
                <p className="text-[14px] font-medium text-emerald-800">
                  {connectMethod === "pairing" ? "Gerando código de pareamento..." : "Gerando QR Code..."}
                </p>
                <p className="text-[12px] text-emerald-600">Aguarde, isso pode levar até 15 segundos.</p>
              </div>
            </Card>
          )}

          {/* Pairing Code display */}
          {pairingCode && (
            <Card className="border-2 border-emerald-200 bg-white shadow-sm rounded-xl overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <Hash className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold">Código de Pareamento</p>
                      {qrSessionId && <p className="text-[11px] text-muted-foreground">Sessão: {qrSessionId}</p>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[11px] text-muted-foreground gap-1"
                    onClick={() => { setPairingCode(null); setQrSessionId(null); }}
                  >
                    Fechar
                  </Button>
                </div>
                <div className="flex justify-center py-6">
                  <div className="bg-emerald-50 px-8 py-5 rounded-2xl border border-emerald-200">
                    <p className="text-4xl font-mono font-bold text-emerald-800 tracking-[0.3em] text-center select-all">
                      {pairingCode}
                    </p>
                  </div>
                </div>
                <div className="text-center mt-4 space-y-2">
                  <p className="text-[13px] font-medium text-foreground">
                    Digite este código no seu WhatsApp:
                  </p>
                  <ol className="text-[12px] text-muted-foreground space-y-1 text-left max-w-xs mx-auto">
                    <li>1. Abra o WhatsApp no celular</li>
                    <li>2. Vá em <strong>Configurações</strong> &rarr; <strong>Aparelhos Conectados</strong></li>
                    <li>3. Toque em <strong>Conectar Aparelho</strong></li>
                    <li>4. Toque em <strong>"Conectar com número de telefone"</strong></li>
                    <li>5. Digite o código acima</li>
                  </ol>
                  <p className="text-[11px] text-amber-600 mt-3">
                    O código expira em 60 segundos. Se expirar, gere um novo.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* QR Code display */}
          {qrCode && !pairingCode && (
            <Card className="border-2 border-emerald-200 bg-white shadow-sm rounded-xl overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <QrCode className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold">Escaneie o QR Code</p>
                      {qrSessionId && <p className="text-[11px] text-muted-foreground">Sessão: {qrSessionId}</p>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[11px] text-muted-foreground gap-1"
                    onClick={() => { setQrCode(null); setQrSessionId(null); }}
                  >
                    Fechar
                  </Button>
                </div>
                <div className="flex justify-center py-2">
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                    <img src={qrCode} alt="QR Code" className="w-[260px] h-[260px] rounded-xl" />
                  </div>
                </div>
                <div className="text-center mt-4 space-y-1.5">
                  <p className="text-[12px] text-muted-foreground">
                    Abra o WhatsApp no celular &rarr; Menu &rarr; <strong>Aparelhos Conectados</strong> &rarr; <strong>Conectar Aparelho</strong>
                  </p>
                  <p className="text-[11px] text-muted-foreground/70">
                    O QR Code atualiza automaticamente. Se não conectar, tente o método <strong>Código de Pareamento</strong>.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Session cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.isLoading ? (
              <div className="col-span-3 flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !sessions.data?.length ? (
              <Card className="col-span-3 border border-border/40 shadow-none rounded-xl">
                <div className="p-12 text-center text-muted-foreground">
                  <Smartphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                  <p className="text-[14px] font-medium text-muted-foreground/60">Nenhuma sessão</p>
                  <p className="text-[13px] text-muted-foreground/40 mt-1">Clique em "Nova Sessão" para conectar.</p>
                </div>
              </Card>
            ) : sessions.data.map((s: any) => (
              <Card key={s.sessionId} className="border border-border/40 shadow-none rounded-xl hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${s.liveStatus === "connected" ? "bg-emerald-50" : s.liveStatus === "connecting" || s.liveStatus === "reconnecting" ? "bg-amber-50" : "bg-slate-50"}`}>
                        {s.liveStatus === "connecting" || s.liveStatus === "reconnecting" ? (
                          <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
                        ) : (
                          <Smartphone className={`h-4 w-4 ${s.liveStatus === "connected" ? "text-emerald-600" : "text-slate-400"}`} />
                        )}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold">{s.sessionId}</p>
                        {s.user && <p className="text-[11px] text-muted-foreground">{s.user.name || s.user.id}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${
                        s.liveStatus === "connected" ? "bg-emerald-50 text-emerald-700" :
                        s.liveStatus === "connecting" || s.liveStatus === "reconnecting" ? "bg-amber-50 text-amber-700" :
                        "bg-slate-50 text-slate-600"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          s.liveStatus === "connected" ? "bg-emerald-500 animate-pulse" :
                          s.liveStatus === "connecting" || s.liveStatus === "reconnecting" ? "bg-amber-500 animate-pulse" :
                          "bg-slate-400"
                        }`} />
                        {s.liveStatus === "connected" ? "Conectado" :
                         s.liveStatus === "connecting" ? "Conectando..." :
                         s.liveStatus === "reconnecting" ? "Reconectando..." :
                         "Desconectado"}
                      </span>
                      {/* Dropdown menu with delete option */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50 rounded-lg text-[12px] gap-2"
                            onClick={() => setDeleteConfirm(s.sessionId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir Sessão
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {s.liveStatus === "connected" ? (
                      <Button variant="outline" size="sm" className="flex-1 h-9 rounded-xl text-[12px] border-red-200 text-red-600 hover:bg-red-50" disabled={disconnect.isPending} onClick={() => disconnect.mutate({ sessionId: s.sessionId })}>
                        {disconnect.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <WifiOff className="h-3.5 w-3.5 mr-1.5" />}
                        Desconectar
                      </Button>
                    ) : (
                      <Button size="sm" className="flex-1 h-9 rounded-xl text-[12px] bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:opacity-90" disabled={connect.isPending || isWaitingQr} onClick={() => handleConnect(s.sessionId)}>
                        {connect.isPending && qrSessionId === s.sessionId ? (
                          <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Conectando...</>
                        ) : (
                          <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Reconectar</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="send">
          <Card className="border border-border/40 shadow-none rounded-xl">
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><MessageSquare className="h-4 w-4 text-primary" /></div>
                <p className="text-[15px] font-semibold">Enviar Mensagem</p>
              </div>
              <div>
                <Label className="text-[12px] font-medium">Sessão</Label>
                <Select value={selectedSession} onValueChange={setSelectedSession}>
                  <SelectTrigger className="mt-1.5 h-10 rounded-xl"><SelectValue placeholder="Selecione uma sessão" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {connectedSessions.map((s: any) => <SelectItem key={s.sessionId} value={s.sessionId}>{s.sessionId}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[12px] font-medium">Número (com código do país)</Label>
                <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="5511999999999" className="mt-1.5 h-10 rounded-xl" />
              </div>
              <div>
                <Label className="text-[12px] font-medium">Mensagem</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite sua mensagem..." rows={4} className="mt-1.5 rounded-xl resize-none" />
              </div>
              <Button className="w-full h-11 rounded-lg text-[14px] font-medium bg-primary hover:bg-primary/90 shadow-sm transition-colors" disabled={!selectedSession || !number || !message || sendMsg.isPending} onClick={() => sendMsg.mutate({ sessionId: selectedSession, number, message })}>
                <Send className="h-4 w-4 mr-2" />{sendMsg.isPending ? "Enviando..." : "Enviar Mensagem"}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open && !deleteSession.isPending) setDeleteConfirm(null); }}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="h-9 w-9 rounded-xl bg-red-50 flex items-center justify-center"><Trash2 className="h-4 w-4 text-red-600" /></div>
              Excluir Sessão
            </DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground pt-2">
              Tem certeza que deseja excluir a sessão <strong className="text-foreground">"{deleteConfirm}"</strong>? 
              A sessão será desconectada e movida para a lixeira. Os dados de autenticação serão removidos e será necessário escanear o QR Code novamente caso queira reconectar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteConfirm(null)} disabled={deleteSession.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={deleteSession.isPending}
              onClick={() => {
                if (deleteConfirm) {
                  deleteSession.mutate({ sessionId: deleteConfirm });
                }
              }}
            >
              {deleteSession.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</>
              ) : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
