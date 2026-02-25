import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Bot, Save, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Chatbot() {
  const [sessionId, setSessionId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(
    "Você é um assistente virtual amigável e prestativo. Responda de forma concisa e educada em português."
  );
  const [maxTokens, setMaxTokens] = useState(500);

  const sessionsQuery = trpc.whatsapp.sessions.useQuery();
  const allSessions = sessionsQuery.data || [];

  const settingsQuery = trpc.whatsapp.getChatbotSettings.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const updateMutation = trpc.whatsapp.updateChatbotSettings.useMutation({
    onSuccess: () => {
      toast.success("Configurações do chatbot salvas!");
      settingsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setEnabled(settingsQuery.data.enabled);
      setSystemPrompt(settingsQuery.data.systemPrompt || "");
      setMaxTokens(settingsQuery.data.maxTokens || 500);
    } else if (sessionId) {
      setEnabled(false);
      setSystemPrompt(
        "Você é um assistente virtual amigável e prestativo. Responda de forma concisa e educada em português."
      );
      setMaxTokens(500);
    }
  }, [settingsQuery.data, sessionId]);

  const handleSave = () => {
    if (!sessionId) {
      toast.error("Selecione uma sessão");
      return;
    }
    updateMutation.mutate({ sessionId, enabled, systemPrompt, maxTokens });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chatbot Inteligente</h1>
          <p className="text-muted-foreground mt-1">
            Configure respostas automáticas com inteligência artificial
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Selecionar Sessão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma sessão para configurar o chatbot" />
              </SelectTrigger>
              <SelectContent>
                {allSessions.map((s) => (
                  <SelectItem key={s.sessionId} value={s.sessionId}>
                    {s.sessionId} ({s.pushName || s.phoneNumber || s.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {sessionId && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5" />
                      Configurações do Chatbot
                    </CardTitle>
                    <CardDescription>
                      Quando ativado, o chatbot responderá automaticamente às mensagens recebidas usando IA
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="chatbot-toggle" className="text-sm">
                      {enabled ? "Ativado" : "Desativado"}
                    </Label>
                    <Switch
                      id="chatbot-toggle"
                      checked={enabled}
                      onCheckedChange={setEnabled}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Prompt do Sistema</Label>
                  <Textarea
                    placeholder="Defina a personalidade e comportamento do chatbot..."
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este prompt define como o chatbot se comporta. Ele é enviado como instrução de sistema para o modelo de linguagem.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Máximo de Tokens na Resposta</Label>
                  <Input
                    type="number"
                    min={50}
                    max={4000}
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value) || 500)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Controla o tamanho máximo da resposta (50-4000 tokens). Valores maiores permitem respostas mais longas.
                  </p>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Como funciona</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  O chatbot utiliza um modelo de linguagem (LLM) para gerar respostas inteligentes e contextuais
                  para mensagens recebidas no WhatsApp.
                </p>
                <p>
                  Quando ativado, cada mensagem recebida é processada junto com o histórico recente da conversa,
                  permitindo respostas coerentes e contextualizadas.
                </p>
                <p>
                  O prompt do sistema define a "personalidade" do chatbot. Você pode personalizá-lo para
                  atendimento ao cliente, suporte técnico, vendas, ou qualquer outro cenário.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
