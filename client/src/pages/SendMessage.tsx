import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Send, Image, FileAudio, FileText, Upload, AlertCircle, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function SendMessage() {
  const [sessionId, setSessionId] = useState("");
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "audio" | "document">("image");
  const [caption, setCaption] = useState("");
  const [fileName, setFileName] = useState("");

  const sessionsQuery = trpc.whatsapp.sessions.useQuery();
  const connectedSessions = sessionsQuery.data?.filter((s) => s.liveStatus === "connected") || [];

  const sendMessageMutation = trpc.whatsapp.sendMessage.useMutation({
    onSuccess: () => { toast.success("Mensagem enviada com sucesso!"); setMessage(""); },
    onError: (error) => { toast.error(`Erro ao enviar: ${error.message}`); },
  });

  const uploadMediaMutation = trpc.whatsapp.uploadMedia.useMutation();
  const sendMediaMutation = trpc.whatsapp.sendMedia.useMutation({
    onSuccess: () => { toast.success("Mídia enviada com sucesso!"); setCaption(""); },
    onError: (error) => { toast.error(`Erro ao enviar mídia: ${error.message}`); },
  });

  const handleSendText = () => {
    if (!sessionId || !number || !message) { toast.error("Preencha todos os campos obrigatórios"); return; }
    sendMessageMutation.mutate({ sessionId, number, message });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const result = await uploadMediaMutation.mutateAsync({ fileName: file.name, fileBase64: base64, contentType: file.type });
        setFileName(file.name);
        if (!sessionId || !number) { toast.error("Selecione uma sessão e informe o número"); return; }
        sendMediaMutation.mutate({ sessionId, number, mediaUrl: result.url, mediaType, caption: caption || undefined, fileName: file.name });
      } catch (error: any) { toast.error(`Erro no upload: ${error.message}`); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-5 lg:px-8 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Enviar Mensagem</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Envie mensagens de texto ou mídia pelo WhatsApp.</p>
      </div>

      {/* Destinatário */}
      <Card className="border border-border/40 shadow-none rounded-xl">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><Phone className="h-4 w-4 text-primary" /></div>
            <div>
              <p className="text-[14px] font-semibold">Destinatário</p>
              <p className="text-[12px] text-muted-foreground">Selecione a sessão e informe o número</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-[12px] font-medium">Sessão</Label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger className="mt-1.5 h-10 rounded-xl"><SelectValue placeholder="Selecione uma sessão" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {connectedSessions.map((s) => (
                    <SelectItem key={s.sessionId} value={s.sessionId}>{s.sessionId} ({s.pushName || s.phoneNumber || "Conectado"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {connectedSessions.length === 0 && (
                <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1.5"><AlertCircle className="h-3 w-3" />Nenhuma sessão conectada.</p>
              )}
            </div>
            <div>
              <Label className="text-[12px] font-medium">Número do Destinatário</Label>
              <Input placeholder="5511999999999" value={number} onChange={(e) => setNumber(e.target.value)} className="mt-1.5 h-10 rounded-xl" />
              <p className="text-[11px] text-muted-foreground mt-1">Código do país + DDD + número</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="text" className="space-y-4">
        <TabsList className="bg-muted/30 border-0 rounded-lg p-1">
          <TabsTrigger value="text" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5"><Send className="h-3.5 w-3.5" />Texto</TabsTrigger>
          <TabsTrigger value="media" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5"><Upload className="h-3.5 w-3.5" />Mídia</TabsTrigger>
        </TabsList>

        <TabsContent value="text">
          <Card className="border border-border/40 shadow-none rounded-xl">
            <div className="p-5 space-y-4">
              <Textarea placeholder="Digite sua mensagem aqui..." value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="rounded-xl resize-none text-[13px]" />
              <Button onClick={handleSendText} disabled={sendMessageMutation.isPending || !sessionId || !number || !message} className="w-full h-11 rounded-lg text-[14px] font-medium bg-primary hover:bg-primary/90 shadow-sm transition-colors">
                {sendMessageMutation.isPending ? "Enviando..." : "Enviar Mensagem"}
                <Send className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="media">
          <Card className="border border-border/40 shadow-none rounded-xl">
            <div className="p-5 space-y-4">
              <div>
                <Label className="text-[12px] font-medium">Tipo de Mídia</Label>
                <Select value={mediaType} onValueChange={(v) => setMediaType(v as any)}>
                  <SelectTrigger className="mt-1.5 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="image"><span className="flex items-center gap-2"><Image className="h-4 w-4" />Imagem</span></SelectItem>
                    <SelectItem value="audio"><span className="flex items-center gap-2"><FileAudio className="h-4 w-4" />Áudio</span></SelectItem>
                    <SelectItem value="document"><span className="flex items-center gap-2"><FileText className="h-4 w-4" />Documento</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[12px] font-medium">Legenda (opcional)</Label>
                <Input placeholder="Legenda da mídia..." value={caption} onChange={(e) => setCaption(e.target.value)} className="mt-1.5 h-10 rounded-xl" />
              </div>
              <div>
                <Label className="text-[12px] font-medium">Arquivo</Label>
                <Input type="file" onChange={handleFileUpload} accept={mediaType === "image" ? "image/*" : mediaType === "audio" ? "audio/*" : "*"} disabled={uploadMediaMutation.isPending || sendMediaMutation.isPending || !sessionId || !number} className="mt-1.5 h-10 rounded-xl" />
                {(uploadMediaMutation.isPending || sendMediaMutation.isPending) && <p className="text-[11px] text-muted-foreground mt-1">Enviando...</p>}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
