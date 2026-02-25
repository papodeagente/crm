import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Send, Image, FileAudio, FileText, Upload, CheckCircle2, AlertCircle } from "lucide-react";
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
    onSuccess: () => {
      toast.success("Mensagem enviada com sucesso!");
      setMessage("");
    },
    onError: (error) => {
      toast.error(`Erro ao enviar: ${error.message}`);
    },
  });

  const uploadMediaMutation = trpc.whatsapp.uploadMedia.useMutation();
  const sendMediaMutation = trpc.whatsapp.sendMedia.useMutation({
    onSuccess: () => {
      toast.success("Mídia enviada com sucesso!");
      setCaption("");
    },
    onError: (error) => {
      toast.error(`Erro ao enviar mídia: ${error.message}`);
    },
  });

  const handleSendText = () => {
    if (!sessionId || !number || !message) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    sendMessageMutation.mutate({ sessionId, number, message });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const result = await uploadMediaMutation.mutateAsync({
          fileName: file.name,
          fileBase64: base64,
          contentType: file.type,
        });
        setFileName(file.name);

        if (!sessionId || !number) {
          toast.error("Selecione uma sessão e informe o número antes de enviar");
          return;
        }

        sendMediaMutation.mutate({
          sessionId,
          number,
          mediaUrl: result.url,
          mediaType,
          caption: caption || undefined,
          fileName: file.name,
        });
      } catch (error: any) {
        toast.error(`Erro no upload: ${error.message}`);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enviar Mensagem</h1>
          <p className="text-muted-foreground mt-1">Envie mensagens de texto ou mídia pelo WhatsApp</p>
        </div>

        {/* Session & Number Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Destinatário</CardTitle>
            <CardDescription>Selecione a sessão e informe o número do destinatário</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sessão</Label>
                <Select value={sessionId} onValueChange={setSessionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma sessão" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedSessions.map((s) => (
                      <SelectItem key={s.sessionId} value={s.sessionId}>
                        {s.sessionId} ({s.pushName || s.phoneNumber || "Conectado"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {connectedSessions.length === 0 && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Nenhuma sessão conectada. Conecte-se no Dashboard primeiro.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Número do Destinatário</Label>
                <Input
                  placeholder="5511999999999"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Código do país + DDD + número (sem espaços ou +)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="text">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text" className="flex items-center gap-2">
              <Send className="h-4 w-4" /> Texto
            </TabsTrigger>
            <TabsTrigger value="media" className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> Mídia
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text">
            <Card>
              <CardHeader>
                <CardTitle>Mensagem de Texto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Digite sua mensagem aqui..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                />
                <Button
                  onClick={handleSendText}
                  disabled={sendMessageMutation.isPending || !sessionId || !number || !message}
                  className="w-full"
                >
                  {sendMessageMutation.isPending ? "Enviando..." : "Enviar Mensagem"}
                  <Send className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="media">
            <Card>
              <CardHeader>
                <CardTitle>Enviar Mídia</CardTitle>
                <CardDescription>Envie imagens, áudios ou documentos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Mídia</Label>
                  <Select value={mediaType} onValueChange={(v) => setMediaType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">
                        <span className="flex items-center gap-2"><Image className="h-4 w-4" /> Imagem</span>
                      </SelectItem>
                      <SelectItem value="audio">
                        <span className="flex items-center gap-2"><FileAudio className="h-4 w-4" /> Áudio</span>
                      </SelectItem>
                      <SelectItem value="document">
                        <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Documento</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Legenda (opcional)</Label>
                  <Input
                    placeholder="Legenda da mídia..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Arquivo</Label>
                  <Input
                    type="file"
                    onChange={handleFileUpload}
                    accept={
                      mediaType === "image"
                        ? "image/*"
                        : mediaType === "audio"
                        ? "audio/*"
                        : "*"
                    }
                    disabled={uploadMediaMutation.isPending || sendMediaMutation.isPending || !sessionId || !number}
                  />
                  {(uploadMediaMutation.isPending || sendMediaMutation.isPending) && (
                    <p className="text-xs text-muted-foreground">Enviando...</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
