import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Smartphone, Plus, Send, Wifi, WifiOff, QrCode, MessageSquare } from "lucide-react";
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
  const utils = trpc.useUtils();
  const { qrData, waStatus } = useSocket();

  const sessions = trpc.whatsapp.sessions.useQuery(undefined, { refetchInterval: 5000 });
  const connect = trpc.whatsapp.connect.useMutation({
    onSuccess: (data) => { if (data.qrDataUrl) setQrCode(data.qrDataUrl); utils.whatsapp.sessions.invalidate(); toast.success("Sessão iniciada! Escaneie o QR Code."); },
  });
  const disconnect = trpc.whatsapp.disconnect.useMutation({
    onSuccess: () => { utils.whatsapp.sessions.invalidate(); toast.success("Sessão desconectada."); },
  });
  const sendMsg = trpc.whatsapp.sendMessage.useMutation({
    onSuccess: () => { setMessage(""); toast.success("Mensagem enviada!"); },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (qrData && qrData.sessionId === selectedSession) setQrCode(qrData.qrDataUrl);
  }, [qrData, selectedSession]);

  useEffect(() => {
    if (waStatus) utils.whatsapp.sessions.invalidate();
  }, [waStatus]);

  const connectedSessions = sessions.data?.filter((s: any) => s.liveStatus === "connected") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1><p className="text-muted-foreground">Gerencie conexões e envie mensagens.</p></div>
        <Dialog open={openConnect} onOpenChange={setOpenConnect}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Sessão</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Conectar WhatsApp</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Nome da Sessão *</Label><Input value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Ex: principal" /></div>
              <Button className="w-full" disabled={!sessionName || connect.isPending} onClick={() => { connect.mutate({ sessionId: sessionName }); setSelectedSession(sessionName); }}>
                {connect.isPending ? "Conectando..." : "Conectar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList><TabsTrigger value="sessions">Sessões</TabsTrigger><TabsTrigger value="send">Enviar Mensagem</TabsTrigger></TabsList>

        <TabsContent value="sessions" className="space-y-4 mt-4">
          {qrCode && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><QrCode className="h-4 w-4" />QR Code — Escaneie com seu WhatsApp</CardTitle></CardHeader>
              <CardContent className="flex justify-center"><img src={qrCode} alt="QR Code" className="max-w-[280px] rounded-lg" /></CardContent>
            </Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.isLoading ? <p className="text-muted-foreground col-span-3">Carregando...</p>
            : !sessions.data?.length ? (
              <Card className="col-span-3"><CardContent className="p-12 text-center text-muted-foreground"><Smartphone className="h-12 w-12 mx-auto mb-4 opacity-40" /><p>Nenhuma sessão. Clique em "Nova Sessão" para conectar.</p></CardContent></Card>
            ) : sessions.data.map((s: any) => (
              <Card key={s.sessionId}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-sm">{s.sessionId}</p>
                    <Badge variant={s.liveStatus === "connected" ? "default" : "secondary"} className={s.liveStatus === "connected" ? "bg-emerald-100 text-emerald-700" : ""}>
                      {s.liveStatus === "connected" ? <><Wifi className="h-3 w-3 mr-1" />Conectado</> : <><WifiOff className="h-3 w-3 mr-1" />Desconectado</>}
                    </Badge>
                  </div>
                  {s.user && <p className="text-xs text-muted-foreground mb-3">{s.user.name || s.user.id}</p>}
                  <div className="flex gap-2">
                    {s.liveStatus === "connected" ? (
                      <Button variant="destructive" size="sm" className="w-full" onClick={() => disconnect.mutate({ sessionId: s.sessionId })}>Desconectar</Button>
                    ) : (
                      <Button size="sm" className="w-full" onClick={() => { connect.mutate({ sessionId: s.sessionId }); setSelectedSession(s.sessionId); }}>Reconectar</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="send" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" />Enviar Mensagem</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Sessão</Label>
                <select className="w-full border rounded-md p-2 text-sm bg-background" value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}>
                  <option value="">Selecione uma sessão</option>
                  {connectedSessions.map((s: any) => <option key={s.sessionId} value={s.sessionId}>{s.sessionId}</option>)}
                </select>
              </div>
              <div><Label>Número (com código do país)</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="5511999999999" /></div>
              <div><Label>Mensagem</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite sua mensagem..." rows={4} /></div>
              <Button className="w-full" disabled={!selectedSession || !number || !message || sendMsg.isPending} onClick={() => sendMsg.mutate({ sessionId: selectedSession, number, message })}>
                <Send className="h-4 w-4 mr-2" />{sendMsg.isPending ? "Enviando..." : "Enviar"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
