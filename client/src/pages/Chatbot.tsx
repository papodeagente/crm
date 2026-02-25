import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Bot, Save, Sparkles, Cpu, MessageCircle } from "lucide-react";
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
    onSuccess: () => { toast.success("Configurações do chatbot salvas!"); settingsQuery.refetch(); },
    onError: (error) => { toast.error(`Erro ao salvar: ${error.message}`); },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setEnabled(settingsQuery.data.enabled);
      setSystemPrompt(settingsQuery.data.systemPrompt || "");
      setMaxTokens(settingsQuery.data.maxTokens || 500);
    } else if (sessionId) {
      setEnabled(false);
      setSystemPrompt("Você é um assistente virtual amigável e prestativo. Responda de forma concisa e educada em português.");
      setMaxTokens(500);
    }
  }, [settingsQuery.data, sessionId]);

  const handleSave = () => {
    if (!sessionId) { toast.error("Selecione uma sessão"); return; }
    updateMutation.mutate({ sessionId, enabled, systemPrompt, maxTokens });
  };

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Chatbot Inteligente</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Configure respostas automáticas com inteligência artificial.</p>
      </div>

      {/* Session selector */}
      <Card className="border-0 shadow-soft rounded-2xl">
        <div className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-9 w-9 rounded-xl bg-violet-50 flex items-center justify-center"><Sparkles className="h-4 w-4 text-violet-600" /></div>
            <p className="text-[14px] font-semibold">Selecionar Sessão</p>
          </div>
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Selecione uma sessão para configurar o chatbot" /></SelectTrigger>
            <SelectContent className="rounded-xl">
              {allSessions.map((s) => (
                <SelectItem key={s.sessionId} value={s.sessionId}>
                  {s.sessionId} ({s.pushName || s.phoneNumber || s.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {sessionId && (
        <>
          {/* Settings */}
          <Card className="border-0 shadow-soft rounded-2xl">
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><Bot className="h-4 w-4 text-primary" /></div>
                  <div>
                    <p className="text-[14px] font-semibold">Configurações do Chatbot</p>
                    <p className="text-[12px] text-muted-foreground">Quando ativado, responde automaticamente usando IA</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className={`text-[12px] font-medium ${enabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {enabled ? "Ativado" : "Desativado"}
                  </span>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </div>

              <div>
                <Label className="text-[12px] font-medium">Prompt do Sistema</Label>
                <Textarea
                  placeholder="Defina a personalidade e comportamento do chatbot..."
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={6}
                  className="mt-1.5 rounded-xl font-mono text-[12px] resize-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Este prompt define como o chatbot se comporta. Ele é enviado como instrução de sistema para o modelo de linguagem.
                </p>
              </div>

              <div>
                <Label className="text-[12px] font-medium">Máximo de Tokens na Resposta</Label>
                <Input
                  type="number"
                  min={50}
                  max={4000}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 500)}
                  className="mt-1.5 h-10 rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Controla o tamanho máximo da resposta (50-4000 tokens).
                </p>
              </div>

              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="w-full h-11 rounded-xl text-[14px] font-semibold shadow-soft bg-gradient-to-r from-primary to-[oklch(0.50_0.14_264)] hover:opacity-90"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateMutation.isPending ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </Card>

          {/* How it works */}
          <Card className="border-0 shadow-soft rounded-2xl">
            <div className="p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center"><Cpu className="h-4 w-4 text-blue-600" /></div>
                <p className="text-[14px] font-semibold">Como funciona</p>
              </div>
              <div className="space-y-3">
                {[
                  { icon: MessageCircle, text: "Cada mensagem recebida é processada junto com o histórico recente da conversa, permitindo respostas coerentes." },
                  { icon: Bot, text: "O prompt do sistema define a \"personalidade\" do chatbot. Personalize para atendimento, suporte ou vendas." },
                  { icon: Sparkles, text: "O modelo de linguagem gera respostas inteligentes e contextuais automaticamente." },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                    <item.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-[13px] text-muted-foreground">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
