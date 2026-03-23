import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import {
  Bot, Save, Sparkles, MessageCircle, Shield, Clock, Users, Zap,
  Plus, Trash2, Info, Globe, Volume2, Brain, Filter, AlertTriangle,
  ToggleLeft, Settings2, UserPlus, UserMinus, Hash, Timer, Gauge,
  MessageSquare, Send, Moon, Sun, Calendar, ChevronDown,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import { useLocation } from "wouter";
import { ShieldAlert } from "lucide-react";

/* ─── Types ─── */
interface ChatbotSettingsData {
  enabled: boolean;
  systemPrompt: string | null;
  maxTokens: number | null;
  mode: string | null;
  respondGroups: boolean;
  respondPrivate: boolean;
  onlyWhenMentioned: boolean;
  triggerWords: string | null;
  welcomeMessage: string | null;
  awayMessage: string | null;
  businessHoursEnabled: boolean;
  businessHoursStart: string | null;
  businessHoursEnd: string | null;
  businessHoursDays: string | null;
  businessHoursTimezone: string | null;
  replyDelay: number | null;
  contextMessageCount: number | null;
  rateLimitPerHour: number | null;
  rateLimitPerDay: number | null;
  temperature: string | null;
}

interface ChatbotRule {
  id: number;
  sessionId: string;
  remoteJid: string;
  contactName: string | null;
  ruleType: "whitelist" | "blacklist";
  createdAt: Date;
}

const WEEKDAYS = [
  { value: "0", label: "Dom" },
  { value: "1", label: "Seg" },
  { value: "2", label: "Ter" },
  { value: "3", label: "Qua" },
  { value: "4", label: "Qui" },
  { value: "5", label: "Sex" },
  { value: "6", label: "Sáb" },
];

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Fortaleza",
  "America/Manaus",
  "America/Rio_Branco",
  "America/Noronha",
  "America/Belem",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Maceio",
  "America/Recife",
  "America/Bahia",
  "America/Araguaina",
];

export default function Chatbot() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState("");
  const [activeTab, setActiveTab] = useState("general");

  if (!adminLoading && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4 py-20">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">
          A configuração do Chatbot IA é exclusiva para administradores.
        </p>
        <button
          onClick={() => setLocation("/settings")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Voltar às Configurações
        </button>
      </div>
    );
  }

  // ─── Form state ───
  const [enabled, setEnabled] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [maxTokens, setMaxTokens] = useState(500);
  const [mode, setMode] = useState<"all" | "whitelist" | "blacklist">("all");
  const [respondGroups, setRespondGroups] = useState(true);
  const [respondPrivate, setRespondPrivate] = useState(true);
  const [onlyWhenMentioned, setOnlyWhenMentioned] = useState(false);
  const [triggerWords, setTriggerWords] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [awayMessage, setAwayMessage] = useState("");
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(false);
  const [businessHoursStart, setBusinessHoursStart] = useState("09:00");
  const [businessHoursEnd, setBusinessHoursEnd] = useState("18:00");
  const [businessHoursDays, setBusinessHoursDays] = useState("1,2,3,4,5");
  const [businessHoursTimezone, setBusinessHoursTimezone] = useState("America/Sao_Paulo");
  const [replyDelay, setReplyDelay] = useState(0);
  const [contextMessageCount, setContextMessageCount] = useState(10);
  const [rateLimitPerHour, setRateLimitPerHour] = useState(0);
  const [rateLimitPerDay, setRateLimitPerDay] = useState(0);
  const [temperature, setTemperature] = useState(0.7);

  // ─── Rules dialog ───
  const [newJid, setNewJid] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [addRuleType, setAddRuleType] = useState<"whitelist" | "blacklist">("whitelist");

  // ─── Queries ───
  const sessionsQuery = trpc.whatsapp.sessions.useQuery();
  const allSessions = sessionsQuery.data || [];

  const settingsQuery = trpc.whatsapp.getChatbotSettings.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const rulesQuery = trpc.whatsapp.getChatbotRules.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const utils = trpc.useUtils();

  const updateMutation = trpc.whatsapp.updateChatbotSettings.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
      utils.whatsapp.getChatbotSettings.invalidate({ sessionId });
    },
    onError: (error) => toast.error(`Erro ao salvar: ${error.message}`),
  });

  const addRuleMutation = trpc.whatsapp.addChatbotRule.useMutation({
    onSuccess: () => {
      toast.success("Regra adicionada!");
      utils.whatsapp.getChatbotRules.invalidate({ sessionId });
      setNewJid("");
      setNewContactName("");
      setAddRuleOpen(false);
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const removeRuleMutation = trpc.whatsapp.removeChatbotRule.useMutation({
    onSuccess: () => {
      toast.success("Regra removida!");
      utils.whatsapp.getChatbotRules.invalidate({ sessionId });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // ─── Load settings into form ───
  useEffect(() => {
    if (settingsQuery.data) {
      const s = settingsQuery.data as ChatbotSettingsData;
      setEnabled(s.enabled);
      setSystemPrompt(s.systemPrompt || "Você é um assistente virtual amigável e prestativo. Responda de forma concisa e educada em português.");
      setMaxTokens(s.maxTokens || 500);
      setMode((s.mode as "all" | "whitelist" | "blacklist") || "all");
      setRespondGroups(s.respondGroups);
      setRespondPrivate(s.respondPrivate);
      setOnlyWhenMentioned(s.onlyWhenMentioned);
      setTriggerWords(s.triggerWords || "");
      setWelcomeMessage(s.welcomeMessage || "");
      setAwayMessage(s.awayMessage || "");
      setBusinessHoursEnabled(s.businessHoursEnabled);
      setBusinessHoursStart(s.businessHoursStart || "09:00");
      setBusinessHoursEnd(s.businessHoursEnd || "18:00");
      setBusinessHoursDays(s.businessHoursDays || "1,2,3,4,5");
      setBusinessHoursTimezone(s.businessHoursTimezone || "America/Sao_Paulo");
      setReplyDelay(s.replyDelay || 0);
      setContextMessageCount(s.contextMessageCount || 10);
      setRateLimitPerHour(s.rateLimitPerHour || 0);
      setRateLimitPerDay(s.rateLimitPerDay || 0);
      setTemperature(parseFloat(s.temperature || "0.70"));
    } else if (sessionId) {
      // Reset to defaults
      setEnabled(false);
      setSystemPrompt("Você é um assistente virtual amigável e prestativo. Responda de forma concisa e educada em português.");
      setMaxTokens(500);
      setMode("all");
      setRespondGroups(true);
      setRespondPrivate(true);
      setOnlyWhenMentioned(false);
      setTriggerWords("");
      setWelcomeMessage("");
      setAwayMessage("");
      setBusinessHoursEnabled(false);
      setBusinessHoursStart("09:00");
      setBusinessHoursEnd("18:00");
      setBusinessHoursDays("1,2,3,4,5");
      setBusinessHoursTimezone("America/Sao_Paulo");
      setReplyDelay(0);
      setContextMessageCount(10);
      setRateLimitPerHour(0);
      setRateLimitPerDay(0);
      setTemperature(0.7);
    }
  }, [settingsQuery.data, sessionId]);

  // ─── Save handler ───
  const handleSave = useCallback(() => {
    if (!sessionId) { toast.error("Selecione uma sessão"); return; }
    updateMutation.mutate({
      sessionId,
      enabled,
      systemPrompt,
      maxTokens,
      mode,
      respondGroups,
      respondPrivate,
      onlyWhenMentioned,
      triggerWords: triggerWords || null,
      welcomeMessage: welcomeMessage || null,
      awayMessage: awayMessage || null,
      businessHoursEnabled,
      businessHoursStart,
      businessHoursEnd,
      businessHoursDays,
      businessHoursTimezone,
      replyDelay,
      contextMessageCount,
      rateLimitPerHour,
      rateLimitPerDay,
      temperature: temperature.toFixed(2),
    });
  }, [sessionId, enabled, systemPrompt, maxTokens, mode, respondGroups, respondPrivate, onlyWhenMentioned, triggerWords, welcomeMessage, awayMessage, businessHoursEnabled, businessHoursStart, businessHoursEnd, businessHoursDays, businessHoursTimezone, replyDelay, contextMessageCount, rateLimitPerHour, rateLimitPerDay, temperature, updateMutation]);

  // ─── Derived data ───
  const whitelistRules = useMemo(() => (rulesQuery.data || []).filter((r: ChatbotRule) => r.ruleType === "whitelist"), [rulesQuery.data]);
  const blacklistRules = useMemo(() => (rulesQuery.data || []).filter((r: ChatbotRule) => r.ruleType === "blacklist"), [rulesQuery.data]);
  const selectedDays = useMemo(() => businessHoursDays.split(",").filter(Boolean), [businessHoursDays]);

  const toggleDay = useCallback((day: string) => {
    const days = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day].sort();
    setBusinessHoursDays(days.join(","));
  }, [selectedDays]);

  return (
    <div className="p-5 lg:px-8 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Bot className="h-4.5 w-4.5 text-white" />
            </div>
            Chatbot Inteligente
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">Configure respostas automáticas com inteligência artificial para cada sessão do WhatsApp.</p>
        </div>
      </div>

      {/* Session selector */}
      <Card className="border border-border/40 shadow-none rounded-xl">
        <div className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[14px] font-semibold">Sessão WhatsApp</p>
              <p className="text-[11px] text-muted-foreground">Selecione a sessão para configurar o chatbot</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger className="h-10 rounded-xl flex-1">
                <SelectValue placeholder="Selecione uma sessão" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {allSessions.map((s) => (
                  <SelectItem key={s.sessionId} value={s.sessionId}>
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${s.liveStatus === "connected" ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {s.sessionId}
                      <span className="text-muted-foreground text-[11px]">
                        ({s.pushName || s.phoneNumber || s.status})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sessionId && (
              <div className="flex items-center gap-2">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                <span className={`text-[12px] font-medium whitespace-nowrap ${enabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {enabled ? "IA Ativa" : "IA Inativa"}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {sessionId && (
        <>
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-muted/30 border-0 rounded-lg p-1 h-auto flex-wrap">
              <TabsTrigger value="general" className="rounded-lg text-[12px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
                <Brain className="h-3.5 w-3.5" />Modelo & Prompt
              </TabsTrigger>
              <TabsTrigger value="filters" className="rounded-lg text-[12px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
                <Filter className="h-3.5 w-3.5" />Filtros
              </TabsTrigger>
              <TabsTrigger value="rules" className="rounded-lg text-[12px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
                <Shield className="h-3.5 w-3.5" />Whitelist / Blacklist
              </TabsTrigger>
              <TabsTrigger value="schedule" className="rounded-lg text-[12px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
                <Clock className="h-3.5 w-3.5" />Horários
              </TabsTrigger>
              <TabsTrigger value="messages" className="rounded-lg text-[12px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />Mensagens Auto
              </TabsTrigger>
              <TabsTrigger value="limits" className="rounded-lg text-[12px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
                <Gauge className="h-3.5 w-3.5" />Limites
              </TabsTrigger>
            </TabsList>

            {/* ═══ TAB: Modelo & Prompt ═══ */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <Card className="border border-border/40 shadow-none rounded-xl">
                <div className="p-5 space-y-5">
                  <SectionHeader icon={Brain} title="Modelo de IA" subtitle="Configure o comportamento do modelo de linguagem" />

                  {/* System Prompt */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-[12px] font-medium">Prompt do Sistema</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-[12px]">Define a personalidade e comportamento do chatbot. Seja específico sobre tom, idioma e regras de negócio.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Textarea
                      placeholder="Ex: Você é um assistente de vendas da empresa X. Responda sempre em português, de forma educada e objetiva. Não forneça informações sobre preços, direcione para o vendedor."
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={8}
                      className="rounded-xl font-mono text-[12px] resize-none leading-relaxed"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {systemPrompt.length} caracteres — Este prompt é enviado como instrução de sistema em cada interação.
                    </p>
                  </div>

                  <Separator />

                  {/* Temperature */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <Label className="text-[12px] font-medium">Temperatura</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Controla a criatividade das respostas</p>
                      </div>
                      <Badge variant="outline" className="text-[12px] font-mono">{temperature.toFixed(2)}</Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">Preciso</span>
                      <Slider
                        value={[temperature]}
                        onValueChange={([v]) => setTemperature(v)}
                        min={0}
                        max={1}
                        step={0.05}
                        className="flex-1"
                      />
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">Criativo</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Max Tokens */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <Label className="text-[12px] font-medium">Máximo de Tokens</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Tamanho máximo da resposta gerada</p>
                      </div>
                      <Badge variant="outline" className="text-[12px] font-mono">{maxTokens}</Badge>
                    </div>
                    <Slider
                      value={[maxTokens]}
                      onValueChange={([v]) => setMaxTokens(v)}
                      min={50}
                      max={4000}
                      step={50}
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">50 (curto)</span>
                      <span className="text-[10px] text-muted-foreground">4000 (longo)</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Context Messages */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <Label className="text-[12px] font-medium">Mensagens de Contexto</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Quantas mensagens anteriores incluir como contexto</p>
                      </div>
                      <Badge variant="outline" className="text-[12px] font-mono">{contextMessageCount}</Badge>
                    </div>
                    <Slider
                      value={[contextMessageCount]}
                      onValueChange={([v]) => setContextMessageCount(v)}
                      min={1}
                      max={50}
                      step={1}
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">1 (sem contexto)</span>
                      <span className="text-[10px] text-muted-foreground">50 (conversa longa)</span>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* ═══ TAB: Filtros ═══ */}
            <TabsContent value="filters" className="space-y-4 mt-4">
              <Card className="border border-border/40 shadow-none rounded-xl">
                <div className="p-5 space-y-5">
                  <SectionHeader icon={Filter} title="Filtros de Conversa" subtitle="Defina onde e quando a IA deve responder" />

                  {/* Mode */}
                  <div>
                    <Label className="text-[12px] font-medium mb-2 block">Modo de Operação</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { value: "all", label: "Responder Todos", desc: "A IA responde a todos os contatos", icon: Globe, color: "emerald" },
                        { value: "whitelist", label: "Apenas Whitelist", desc: "Responde apenas contatos na lista", icon: UserPlus, color: "blue" },
                        { value: "blacklist", label: "Exceto Blacklist", desc: "Responde todos exceto os listados", icon: UserMinus, color: "amber" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setMode(opt.value as any)}
                          className={`p-4 rounded-xl border-2 text-left transition-all duration-150 ${
                            mode === opt.value
                              ? `border-${opt.color}-500 bg-${opt.color}-50/50`
                              : "border-border/40 hover:border-border"
                          }`}
                        >
                          <opt.icon className={`h-5 w-5 mb-2 ${mode === opt.value ? `text-${opt.color}-600` : "text-muted-foreground"}`} />
                          <p className={`text-[13px] font-semibold ${mode === opt.value ? "text-foreground" : "text-muted-foreground"}`}>{opt.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Chat type toggles */}
                  <div className="space-y-4">
                    <p className="text-[12px] font-medium text-foreground">Tipos de Conversa</p>

                    <ToggleRow
                      icon={MessageCircle}
                      label="Conversas Privadas"
                      description="Responder mensagens em conversas individuais"
                      checked={respondPrivate}
                      onChange={setRespondPrivate}
                    />

                    <ToggleRow
                      icon={Users}
                      label="Grupos"
                      description="Responder mensagens em grupos do WhatsApp"
                      checked={respondGroups}
                      onChange={setRespondGroups}
                    />

                    {respondGroups && (
                      <div className="ml-10 p-3 rounded-lg bg-muted/30 border border-border/30">
                        <ToggleRow
                          icon={Hash}
                          label="Apenas Quando Mencionado"
                          description="Em grupos, responder apenas quando o bot for mencionado (@)"
                          checked={onlyWhenMentioned}
                          onChange={setOnlyWhenMentioned}
                        />
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Trigger Words */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <Label className="text-[12px] font-medium">Palavras-Chave de Ativação</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Se preenchido, a IA só responde quando a mensagem contém uma dessas palavras (separadas por vírgula)</p>
                      </div>
                    </div>
                    <Input
                      value={triggerWords}
                      onChange={(e) => setTriggerWords(e.target.value)}
                      placeholder="Ex: ajuda, suporte, orçamento, preço, informação"
                      className="h-10 rounded-xl text-[13px]"
                    />
                    {triggerWords && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {triggerWords.split(",").map((w, i) => w.trim() && (
                          <Badge key={i} variant="secondary" className="text-[11px]">{w.trim()}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Reply Delay */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <Label className="text-[12px] font-medium">Delay de Resposta</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Tempo de espera antes de enviar a resposta (simula digitação)</p>
                      </div>
                      <Badge variant="outline" className="text-[12px] font-mono">
                        {replyDelay === 0 ? "Instantâneo" : `${replyDelay}s`}
                      </Badge>
                    </div>
                    <Slider
                      value={[replyDelay]}
                      onValueChange={([v]) => setReplyDelay(v)}
                      min={0}
                      max={60}
                      step={1}
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">Instantâneo</span>
                      <span className="text-[10px] text-muted-foreground">60 segundos</span>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* ═══ TAB: Whitelist / Blacklist ═══ */}
            <TabsContent value="rules" className="space-y-4 mt-4">
              {/* Info banner */}
              {mode === "all" && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[13px] font-medium text-amber-800">Modo "Responder Todos" ativo</p>
                    <p className="text-[12px] text-amber-700 mt-0.5">
                      As regras abaixo só serão aplicadas quando o modo for alterado para "Apenas Whitelist" ou "Exceto Blacklist" na aba Filtros.
                    </p>
                  </div>
                </div>
              )}

              {/* Whitelist */}
              <Card className="border border-border/40 shadow-none rounded-xl">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <SectionHeader icon={UserPlus} title="Whitelist" subtitle="Contatos/grupos que a IA DEVE responder" color="emerald" />
                    <Button
                      size="sm"
                      className="h-8 rounded-lg text-[12px] gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => { setAddRuleType("whitelist"); setAddRuleOpen(true); }}
                    >
                      <Plus className="h-3.5 w-3.5" />Adicionar
                    </Button>
                  </div>
                  <RulesList rules={whitelistRules} onRemove={(id) => removeRuleMutation.mutate({ id })} emptyText="Nenhum contato na whitelist" />
                </div>
              </Card>

              {/* Blacklist */}
              <Card className="border border-border/40 shadow-none rounded-xl">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <SectionHeader icon={UserMinus} title="Blacklist" subtitle="Contatos/grupos que a IA NÃO deve responder" color="red" />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-[12px] gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => { setAddRuleType("blacklist"); setAddRuleOpen(true); }}
                    >
                      <Plus className="h-3.5 w-3.5" />Adicionar
                    </Button>
                  </div>
                  <RulesList rules={blacklistRules} onRemove={(id) => removeRuleMutation.mutate({ id })} emptyText="Nenhum contato na blacklist" />
                </div>
              </Card>

              {/* Add Rule Dialog */}
              <Dialog open={addRuleOpen} onOpenChange={setAddRuleOpen}>
                <DialogContent className="sm:max-w-[440px] rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2.5 text-lg">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${addRuleType === "whitelist" ? "bg-emerald-50" : "bg-red-50"}`}>
                        {addRuleType === "whitelist" ? <UserPlus className="h-4 w-4 text-emerald-600" /> : <UserMinus className="h-4 w-4 text-red-600" />}
                      </div>
                      Adicionar à {addRuleType === "whitelist" ? "Whitelist" : "Blacklist"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label className="text-[12px] font-medium">Número ou JID do Grupo *</Label>
                      <Input
                        value={newJid}
                        onChange={(e) => setNewJid(e.target.value)}
                        placeholder="Ex: 5511999999999 ou 120363xxx@g.us"
                        className="mt-1.5 h-10 rounded-xl"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Para contatos: número com código do país. Para grupos: JID completo (ex: 120363xxx@g.us).
                      </p>
                    </div>
                    <div>
                      <Label className="text-[12px] font-medium">Nome (opcional)</Label>
                      <Input
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        placeholder="Ex: João Silva, Grupo Vendas"
                        className="mt-1.5 h-10 rounded-xl"
                      />
                    </div>
                  </div>
                  <DialogFooter className="mt-4">
                    <DialogClose asChild>
                      <Button variant="outline" className="rounded-lg">Cancelar</Button>
                    </DialogClose>
                    <Button
                      className={`rounded-lg ${addRuleType === "whitelist" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"} text-white`}
                      disabled={!newJid || addRuleMutation.isPending}
                      onClick={() => {
                        const jid = newJid.includes("@") ? newJid : `${newJid}@s.whatsapp.net`;
                        addRuleMutation.mutate({ sessionId, remoteJid: jid, ruleType: addRuleType, contactName: newContactName || undefined });
                      }}
                    >
                      {addRuleMutation.isPending ? "Adicionando..." : "Adicionar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* ═══ TAB: Horários ═══ */}
            <TabsContent value="schedule" className="space-y-4 mt-4">
              <Card className="border border-border/40 shadow-none rounded-xl">
                <div className="p-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <SectionHeader icon={Clock} title="Horário de Funcionamento" subtitle="A IA só responde durante o horário configurado" />
                    <Switch checked={businessHoursEnabled} onCheckedChange={setBusinessHoursEnabled} />
                  </div>

                  {businessHoursEnabled && (
                    <>
                      <Separator />

                      {/* Time range */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-[12px] font-medium mb-1.5 block">Início</Label>
                          <div className="relative">
                            <Sun className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                            <Input
                              type="time"
                              value={businessHoursStart}
                              onChange={(e) => setBusinessHoursStart(e.target.value)}
                              className="h-10 rounded-xl pl-10"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-[12px] font-medium mb-1.5 block">Fim</Label>
                          <div className="relative">
                            <Moon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500" />
                            <Input
                              type="time"
                              value={businessHoursEnd}
                              onChange={(e) => setBusinessHoursEnd(e.target.value)}
                              className="h-10 rounded-xl pl-10"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Days */}
                      <div>
                        <Label className="text-[12px] font-medium mb-2 block">Dias da Semana</Label>
                        <div className="flex gap-2">
                          {WEEKDAYS.map((day) => (
                            <button
                              key={day.value}
                              onClick={() => toggleDay(day.value)}
                              className={`h-10 w-10 rounded-lg text-[12px] font-medium transition-all duration-150 ${
                                selectedDays.includes(day.value)
                                  ? "bg-primary text-white shadow-sm"
                                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Timezone */}
                      <div>
                        <Label className="text-[12px] font-medium mb-1.5 block">Fuso Horário</Label>
                        <Select value={businessHoursTimezone} onValueChange={setBusinessHoursTimezone}>
                          <SelectTrigger className="h-10 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl max-h-[200px]">
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz} value={tz}>{tz.replace("America/", "").replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Preview */}
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                        <p className="text-[12px] text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                          A IA responderá das <strong>{businessHoursStart}</strong> às <strong>{businessHoursEnd}</strong> ({businessHoursTimezone.replace("America/", "").replace(/_/g, " ")}), nos dias: <strong>{selectedDays.map((d) => WEEKDAYS.find((w) => w.value === d)?.label).join(", ")}</strong>.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </TabsContent>

            {/* ═══ TAB: Mensagens Automáticas ═══ */}
            <TabsContent value="messages" className="space-y-4 mt-4">
              {/* Welcome Message */}
              <Card className="border border-border/40 shadow-none rounded-xl">
                <div className="p-5 space-y-4">
                  <SectionHeader icon={Send} title="Mensagem de Boas-Vindas" subtitle="Enviada automaticamente para novos contatos na primeira interação" />
                  <Textarea
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    placeholder="Ex: Olá! 👋 Bem-vindo(a)! Sou o assistente virtual da empresa X. Como posso ajudar?"
                    rows={4}
                    className="rounded-xl text-[13px] resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Deixe em branco para desativar. A mensagem é enviada apenas uma vez por contato.
                  </p>
                </div>
              </Card>

              {/* Away Message */}
              <Card className="border border-border/40 shadow-none rounded-xl">
                <div className="p-5 space-y-4">
                  <SectionHeader icon={Moon} title="Mensagem de Ausência" subtitle="Enviada quando a IA está desativada ou fora do horário comercial" />
                  <Textarea
                    value={awayMessage}
                    onChange={(e) => setAwayMessage(e.target.value)}
                    placeholder="Ex: Obrigado pela mensagem! Nosso horário de atendimento é de segunda a sexta, das 9h às 18h. Retornaremos em breve!"
                    rows={4}
                    className="rounded-xl text-[13px] resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Deixe em branco para não enviar nada quando fora do horário. Enviada no máximo 1x por contato a cada 4 horas.
                  </p>
                </div>
              </Card>
            </TabsContent>

            {/* ═══ TAB: Limites ═══ */}
            <TabsContent value="limits" className="space-y-4 mt-4">
              <Card className="border border-border/40 shadow-none rounded-xl">
                <div className="p-5 space-y-5">
                  <SectionHeader icon={Gauge} title="Limites de Uso" subtitle="Controle a quantidade de respostas automáticas" />

                  {/* Rate limit per hour */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <Label className="text-[12px] font-medium">Limite por Hora (por contato)</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Máximo de respostas da IA por contato por hora</p>
                      </div>
                      <Badge variant="outline" className="text-[12px] font-mono">
                        {rateLimitPerHour === 0 ? "Ilimitado" : `${rateLimitPerHour}/h`}
                      </Badge>
                    </div>
                    <Slider
                      value={[rateLimitPerHour]}
                      onValueChange={([v]) => setRateLimitPerHour(v)}
                      min={0}
                      max={100}
                      step={1}
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">Ilimitado</span>
                      <span className="text-[10px] text-muted-foreground">100/hora</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Rate limit per day */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <Label className="text-[12px] font-medium">Limite por Dia (por contato)</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Máximo de respostas da IA por contato por dia</p>
                      </div>
                      <Badge variant="outline" className="text-[12px] font-mono">
                        {rateLimitPerDay === 0 ? "Ilimitado" : `${rateLimitPerDay}/dia`}
                      </Badge>
                    </div>
                    <Slider
                      value={[rateLimitPerDay]}
                      onValueChange={([v]) => setRateLimitPerDay(v)}
                      min={0}
                      max={500}
                      step={5}
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">Ilimitado</span>
                      <span className="text-[10px] text-muted-foreground">500/dia</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Info */}
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <p className="text-[12px] text-blue-700">
                      <Info className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                      Quando o limite é atingido, a IA para de responder aquele contato até o próximo período. O valor 0 significa ilimitado.
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Save button — sticky */}
          <div className="sticky bottom-4 z-10">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="w-full h-12 rounded-xl text-[14px] font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg transition-all duration-200"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? "Salvando..." : "Salvar Todas as Configurações"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══ Helper Components ═══ */

function SectionHeader({ icon: Icon, title, subtitle, color }: { icon: any; title: string; subtitle: string; color?: string }) {
  const bgColor = color === "emerald" ? "bg-emerald-50" : color === "red" ? "bg-red-50" : "bg-primary/10";
  const iconColor = color === "emerald" ? "text-emerald-600" : color === "red" ? "text-red-600" : "text-primary";
  return (
    <div className="flex items-center gap-2.5">
      <div className={`h-8 w-8 rounded-lg ${bgColor} flex items-center justify-center`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div>
        <p className="text-[14px] font-semibold">{title}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, description, checked, onChange }: { icon: any; label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div>
          <p className="text-[13px] font-medium">{label}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function RulesList({ rules, onRemove, emptyText }: { rules: ChatbotRule[]; onRemove: (id: number) => void; emptyText: string }) {
  if (!rules.length) {
    return (
      <div className="py-8 text-center">
        <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
        <p className="text-[13px] text-muted-foreground/60">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30 group">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${rule.ruleType === "whitelist" ? "bg-emerald-50" : "bg-red-50"}`}>
              {rule.remoteJid.includes("@g.us") ? (
                <Users className={`h-3.5 w-3.5 ${rule.ruleType === "whitelist" ? "text-emerald-600" : "text-red-600"}`} />
              ) : (
                <MessageCircle className={`h-3.5 w-3.5 ${rule.ruleType === "whitelist" ? "text-emerald-600" : "text-red-600"}`} />
              )}
            </div>
            <div>
              <p className="text-[13px] font-medium">{rule.contactName || rule.remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", " (grupo)")}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{rule.remoteJid}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onRemove(rule.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
