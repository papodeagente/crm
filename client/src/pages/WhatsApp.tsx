import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone, Plus, Send, Wifi, WifiOff, QrCode, MessageSquare, AlertTriangle, ShieldAlert, Trash2, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";

export default function WhatsApp() {
  const [sessionName, setSessionName] = useState("");
  const [openConnect, setOpenConnect] = useState(false);
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const { qrData, waStatus } = useSocket();

  const sessions = trpc.whatsapp.sessions.useQuery(undefined, { refetchInterval: 5000 });
  const connect = trpc.whatsapp.connect.useMutation({
    onSuccess: (data) => {
      if (data.qrDataUrl) {
        setQrCode(data.qrDataUrl);
        setQrSessionId(data.sessionId);
      }
      utils.whatsapp.sessions.invalidate();
      toast.success("Sessão iniciada! Escaneie o QR Code.");
    },
    onError: (err) => toast.error(err.message),
  });
  const disconnect = trpc.whatsapp.disconnect.useMutation({
    onSuccess: () => { utils.whatsapp.sessions.invalidate(); toast.success("Sessão desconectada."); },
  });
  const deleteSession = trpc.whatsapp.deleteSession.useMutation({
    onSuccess: () => {
      utils.whatsapp.sessions.invalidate();
      toast.success("Sessão excluída com sucesso.");
      setDeleteConfirm(null);
    },
    onError: (err) => toast.error(err.message),
  });
  const sendMsg = trpc.whatsapp.sendMessage.useMutation({
    onSuccess: () => { setMessage(""); toast.success("Mensagem enviada!"); },
    onError: (err) => toast.error(err.message),
  });

  // Update QR code from WebSocket events
  useEffect(() => {
    if (qrData) {
      setQrCode(qrData.qrDataUrl);
      setQrSessionId(qrData.sessionId);
    }
  }, [qrData]);

  // Clear QR code when session connects
  useEffect(() => {
    if (waStatus) {
      utils.whatsapp.sessions.invalidate();
      if (waStatus.status === "connected" && waStatus.sessionId === qrSessionId) {
        setQrCode(null);
        setQrSessionId(null);
      }
    }
  }, [waStatus]);

  // Also poll QR code from the status endpoint as fallback
  const statusQuery = trpc.whatsapp.status.useQuery(
    { sessionId: qrSessionId || "" },
    {
      enabled: !!qrSessionId && !qrCode,
      refetchInterval: 3000,
    }
  );

  useEffect(() => {
    if (statusQuery.data?.qrDataUrl && !qrCode) {
      setQrCode(statusQuery.data.qrDataUrl);
    }
    if (statusQuery.data?.status === "connected") {
      setQrCode(null);
      setQrSessionId(null);
    }
  }, [statusQuery.data]);

  const connectedSessions = sessions.data?.filter((s: any) => s.liveStatus === "connected") || [];

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
          <DialogContent className="sm:max-w-[440px] rounded-2xl">
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
              <div><Label className="text-[12px] font-medium">Nome da Sessão *</Label><Input value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Ex: principal" className="mt-1.5 h-10 rounded-xl" /></div>
              <Button className="w-full h-11 rounded-xl text-[14px] font-semibold shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors" disabled={!sessionName || connect.isPending} onClick={() => { connect.mutate({ sessionId: sessionName }); setSelectedSession(sessionName); setQrSessionId(sessionName); setOpenConnect(false); }}>
                {connect.isPending ? "Conectando..." : "Conectar"}
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

          {/* QR Code */}
          {qrCode && (
            <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
              <div className="p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center"><QrCode className="h-4 w-4 text-emerald-600" /></div>
                  <div>
                    <p className="text-[14px] font-semibold">QR Code — Escaneie com seu WhatsApp</p>
                    {qrSessionId && <p className="text-[11px] text-muted-foreground">Sessão: {qrSessionId}</p>}
                  </div>
                </div>
                <div className="flex justify-center">
                  <img src={qrCode} alt="QR Code" className="max-w-[260px] rounded-2xl shadow-sm" />
                </div>
                <p className="text-[11px] text-muted-foreground text-center mt-3">
                  Abra o WhatsApp no celular &gt; Menu &gt; Aparelhos Conectados &gt; Conectar Aparelho
                </p>
              </div>
            </Card>
          )}

          {/* Session cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.isLoading ? (
              <p className="text-muted-foreground col-span-3 text-[13px]">Carregando...</p>
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
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${s.liveStatus === "connected" ? "bg-emerald-50" : "bg-slate-50"}`}>
                        <Smartphone className={`h-4 w-4 ${s.liveStatus === "connected" ? "text-emerald-600" : "text-slate-400"}`} />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold">{s.sessionId}</p>
                        {s.user && <p className="text-[11px] text-muted-foreground">{s.user.name || s.user.id}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${
                        s.liveStatus === "connected" ? "bg-emerald-50 text-emerald-700" :
                        s.liveStatus === "connecting" ? "bg-amber-50 text-amber-700" :
                        "bg-slate-50 text-slate-600"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          s.liveStatus === "connected" ? "bg-emerald-500 animate-pulse" :
                          s.liveStatus === "connecting" ? "bg-amber-500 animate-pulse" :
                          "bg-slate-400"
                        }`} />
                        {s.liveStatus === "connected" ? "Conectado" : s.liveStatus === "connecting" ? "Conectando..." : "Desconectado"}
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
                      <Button variant="outline" size="sm" className="flex-1 h-9 rounded-xl text-[12px] border-red-200 text-red-600 hover:bg-red-50" onClick={() => disconnect.mutate({ sessionId: s.sessionId })}>
                        <WifiOff className="h-3.5 w-3.5 mr-1.5" />Desconectar
                      </Button>
                    ) : (
                      <Button size="sm" className="flex-1 h-9 rounded-xl text-[12px] bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:opacity-90" onClick={() => { connect.mutate({ sessionId: s.sessionId }); setSelectedSession(s.sessionId); setQrSessionId(s.sessionId); }}>
                        <Wifi className="h-3.5 w-3.5 mr-1.5" />Reconectar
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
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
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
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteConfirm(null)}>
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
              {deleteSession.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
