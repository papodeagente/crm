/**
 * Agentes IA — substitui /chatbot.
 *
 * UI mínima funcional: tabs Geral / Persona / Modelo / Tools / Horários / Runs.
 * Foco em editar a config tenant-default (sessionId=null) e visualizar runs.
 */

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bot, Save, Sparkles, Wrench, Clock, Activity, ShieldAlert, BookOpen, Plus, Trash2, Edit2, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useIsAdmin } from "@/components/AdminOnlyGuard";

const WEEKDAYS = [
  { value: "0", label: "Dom" },
  { value: "1", label: "Seg" },
  { value: "2", label: "Ter" },
  { value: "3", label: "Qua" },
  { value: "4", label: "Qui" },
  { value: "5", label: "Sex" },
  { value: "6", label: "Sáb" },
];

const ALL_TOOLS = [
  { id: "lookup_crm", label: "Buscar CRM", description: "Lê contato + deals ativos antes de responder." },
  { id: "qualify", label: "Qualificar lead", description: "Registra dados extraídos da conversa (destino, datas, pax, orçamento)." },
  { id: "deal", label: "Criar/mover deal", description: "Cria negociação no pipeline ou move para outra etapa." },
  { id: "handoff", label: "Transferir para humano", description: "Atribui via round-robin com summary do contexto." },
] as const;

export default function Agentes() {
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState("geral");

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="p-6 max-w-md text-center">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-semibold">Acesso restrito a administradores.</p>
        </Card>
      </div>
    );
  }

  const agentQ = trpc.agents.get.useQuery({ sessionId: null });
  const upsert = trpc.agents.upsert.useMutation({
    onSuccess: () => {
      agentQ.refetch();
      toast.success("Configuração salva");
    },
    onError: (e) => toast.error(e.message || "Erro ao salvar"),
  });

  const a = (agentQ.data as any) ?? {};

  const [form, setForm] = useState<any>(null);
  const current = form ?? a;
  function set(field: string, value: unknown) {
    setForm({ ...current, [field]: value });
  }
  function save() {
    const payload: any = {
      sessionId: null,
      name: current.name ?? "Agente IA",
      enabled: !!current.enabled,
      modeSwitch: current.modeSwitch ?? "off",
      systemPrompt: current.systemPrompt ?? null,
      provider: current.provider ?? "tenant_default",
      model: current.model ?? null,
      temperature: typeof current.temperature === "number" ? String(current.temperature) : (current.temperature ?? "0.50"),
      maxTokens: Number(current.maxTokens ?? 800),
      toolsAllowed: Array.isArray(current.toolsAllowed) ? current.toolsAllowed : ["lookup_crm", "qualify", "deal", "handoff"],
      respondGroups: !!current.respondGroups,
      respondPrivate: current.respondPrivate ?? true,
      onlyWhenMentioned: !!current.onlyWhenMentioned,
      greeting: current.greeting ?? null,
      away: current.away ?? null,
      businessHoursEnabled: !!current.businessHoursEnabled,
      businessHoursStart: current.businessHoursStart ?? "09:00",
      businessHoursEnd: current.businessHoursEnd ?? "18:00",
      businessHoursDays: current.businessHoursDays ?? "1,2,3,4,5",
      businessHoursTimezone: current.businessHoursTimezone ?? "America/Sao_Paulo",
      maxTurns: Number(current.maxTurns ?? 8),
      escalateConfidenceBelow: typeof current.escalateConfidenceBelow === "number" ? String(current.escalateConfidenceBelow) : (current.escalateConfidenceBelow ?? "0.60"),
      contextMessageCount: Number(current.contextMessageCount ?? 10),
      replyDelayMs: Number(current.replyDelayMs ?? 0),
      rateLimitPerContactPerHour: Number(current.rateLimitPerContactPerHour ?? 20),
      rateLimitPerTenantPerHour: Number(current.rateLimitPerTenantPerHour ?? 500),
    };
    upsert.mutate(payload);
  }

  const days = useMemo(() => String(current.businessHoursDays ?? "1,2,3,4,5").split(",").filter(Boolean), [current.businessHoursDays]);
  function toggleDay(d: string) {
    const set = new Set(days);
    if (set.has(d)) set.delete(d); else set.add(d);
    const arr = Array.from(set).sort();
    setForm({ ...current, businessHoursDays: arr.join(",") });
  }

  const toolsAllowed: string[] = Array.isArray(current.toolsAllowed) ? current.toolsAllowed : ["lookup_crm", "qualify", "deal", "handoff"];
  function toggleTool(id: string) {
    const next = toolsAllowed.includes(id) ? toolsAllowed.filter(t => t !== id) : [...toolsAllowed, id];
    setForm({ ...current, toolsAllowed: next });
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Agentes IA</h1>
            <p className="text-sm text-muted-foreground">Substitui o Chatbot Inteligente. Tools + multi-turn + handoff.</p>
          </div>
        </div>
        <Button onClick={save} disabled={upsert.isPending} className="gap-2">
          <Save className="h-4 w-4" />Salvar
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="geral"><Sparkles className="h-3.5 w-3.5 mr-1" />Geral</TabsTrigger>
          <TabsTrigger value="persona"><Bot className="h-3.5 w-3.5 mr-1" />Persona</TabsTrigger>
          <TabsTrigger value="tools"><Wrench className="h-3.5 w-3.5 mr-1" />Tools</TabsTrigger>
          <TabsTrigger value="horarios"><Clock className="h-3.5 w-3.5 mr-1" />Horários</TabsTrigger>
          <TabsTrigger value="runs"><Activity className="h-3.5 w-3.5 mr-1" />Runs</TabsTrigger>
          <TabsTrigger value="knowledge"><BookOpen className="h-3.5 w-3.5 mr-1" />Conhecimento</TabsTrigger>
        </TabsList>

        {/* Geral */}
        <TabsContent value="geral">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="font-semibold">Modo de operação</Label>
                <p className="text-xs text-muted-foreground">Off = não responde. Autônomo = responde sozinho enquanto não houver humano atribuído.</p>
              </div>
              <Select value={current.modeSwitch ?? "off"} onValueChange={(v) => set("modeSwitch", v)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="autonomous">Autônomo</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="font-semibold">Habilitado</Label>
                <p className="text-xs text-muted-foreground">Kill-switch global: desliga o agente de uma vez.</p>
              </div>
              <Switch checked={!!current.enabled} onCheckedChange={(v) => set("enabled", v)} />
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Responder em conversas privadas</Label>
              </div>
              <Switch checked={current.respondPrivate ?? true} onCheckedChange={(v) => set("respondPrivate", v)} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Responder em grupos</Label>
              </div>
              <Switch checked={!!current.respondGroups} onCheckedChange={(v) => set("respondGroups", v)} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Apenas quando for mencionado (em grupos)</Label>
              </div>
              <Switch checked={!!current.onlyWhenMentioned} onCheckedChange={(v) => set("onlyWhenMentioned", v)} />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Limite por contato/hora</Label>
                <Input type="number" min={0} value={current.rateLimitPerContactPerHour ?? 20} onChange={(e) => set("rateLimitPerContactPerHour", parseInt(e.target.value, 10) || 0)} />
              </div>
              <div>
                <Label>Limite total/hora (tenant)</Label>
                <Input type="number" min={0} value={current.rateLimitPerTenantPerHour ?? 500} onChange={(e) => set("rateLimitPerTenantPerHour", parseInt(e.target.value, 10) || 0)} />
              </div>
              <div>
                <Label>Máx. turnos por execução</Label>
                <Input type="number" min={1} max={20} value={current.maxTurns ?? 8} onChange={(e) => set("maxTurns", parseInt(e.target.value, 10) || 8)} />
              </div>
              <div>
                <Label>Mensagens de contexto</Label>
                <Input type="number" min={1} max={50} value={current.contextMessageCount ?? 10} onChange={(e) => set("contextMessageCount", parseInt(e.target.value, 10) || 10)} />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Persona */}
        <TabsContent value="persona">
          <Card className="p-5 space-y-4">
            <div>
              <Label>Nome do agente</Label>
              <Input value={current.name ?? "Agente IA"} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <Label>System prompt (manual de operação)</Label>
              <Textarea
                rows={12}
                value={current.systemPrompt ?? ""}
                onChange={(e) => set("systemPrompt", e.target.value)}
                placeholder="Ex.: Você é o atendente da agência X, especialista em viagens. Tom cordial. Sempre confirmar dados antes de criar deal..."
              />
              <p className="text-xs text-muted-foreground mt-1">Vazio = usa prompt padrão do sistema.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Saudação inicial (opcional)</Label>
                <Textarea rows={3} value={current.greeting ?? ""} onChange={(e) => set("greeting", e.target.value)} />
              </div>
              <div>
                <Label>Mensagem fora do horário (opcional)</Label>
                <Textarea rows={3} value={current.away ?? ""} onChange={(e) => set("away", e.target.value)} />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Tools */}
        <TabsContent value="tools">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground mb-4">Selecione quais ferramentas o agente pode usar:</p>
            <div className="space-y-3">
              {ALL_TOOLS.map(t => {
                const checked = toolsAllowed.includes(t.id);
                return (
                  <label key={t.id} className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                    <Switch checked={checked} onCheckedChange={() => toggleTool(t.id)} />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            <Separator className="my-4" />
            <div>
              <Label>Confiança mínima para responder (abaixo disso → handoff automático)</Label>
              <Input
                type="number" step="0.05" min={0} max={1}
                value={current.escalateConfidenceBelow ?? "0.60"}
                onChange={(e) => set("escalateConfidenceBelow", e.target.value)}
              />
            </div>
          </Card>
        </TabsContent>

        {/* Horários */}
        <TabsContent value="horarios">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Restringir a horário comercial</Label>
              <Switch checked={!!current.businessHoursEnabled} onCheckedChange={(v) => set("businessHoursEnabled", v)} />
            </div>
            {current.businessHoursEnabled && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Início</Label>
                    <Input type="time" value={current.businessHoursStart ?? "09:00"} onChange={(e) => set("businessHoursStart", e.target.value)} />
                  </div>
                  <div>
                    <Label>Fim</Label>
                    <Input type="time" value={current.businessHoursEnd ?? "18:00"} onChange={(e) => set("businessHoursEnd", e.target.value)} />
                  </div>
                  <div>
                    <Label>Fuso</Label>
                    <Select value={current.businessHoursTimezone ?? "America/Sao_Paulo"} onValueChange={(v) => set("businessHoursTimezone", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Sao_Paulo">SP/RJ (BRT)</SelectItem>
                        <SelectItem value="America/Manaus">Manaus (AMT)</SelectItem>
                        <SelectItem value="America/Belem">Belém</SelectItem>
                        <SelectItem value="America/Fortaleza">Fortaleza</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Dias ativos</Label>
                  <div className="flex gap-2 flex-wrap mt-2">
                    {WEEKDAYS.map(w => {
                      const active = days.includes(w.value);
                      return (
                        <Badge
                          key={w.value}
                          variant={active ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleDay(w.value)}
                        >
                          {w.label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        {/* Runs */}
        <TabsContent value="runs">
          <RunsTable />
        </TabsContent>

        {/* Knowledge */}
        <TabsContent value="knowledge">
          <KnowledgeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RunsTable() {
  const runsQ = trpc.agents.listRuns.useQuery({ limit: 50, offset: 0 });
  const metricsQ = trpc.agents.metrics.useQuery({});
  const m = (metricsQ.data as any) ?? {};
  const total = Number(m.replied ?? 0) + Number(m.handed_off ?? 0);
  const containment = total > 0 ? ((Number(m.replied) / total) * 100).toFixed(0) + "%" : "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3"><p className="text-xs text-muted-foreground">Respondidas (7d)</p><p className="text-2xl font-bold">{m.replied ?? 0}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Handoffs (7d)</p><p className="text-2xl font-bold">{m.handed_off ?? 0}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Containment</p><p className="text-2xl font-bold">{containment}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">p95 latência</p><p className="text-2xl font-bold">{m.p95_ms ? `${Math.round(Number(m.p95_ms))}ms` : "—"}</p></Card>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Quando</th>
              <th className="text-left p-2">JID</th>
              <th className="text-left p-2">Outcome</th>
              <th className="text-left p-2">Input</th>
              <th className="text-left p-2">Reply</th>
              <th className="text-right p-2">Tokens</th>
              <th className="text-right p-2">ms</th>
            </tr>
          </thead>
          <tbody>
            {(runsQ.data as any[] || []).map((r: any) => (
              <tr key={r.id} className="border-t hover:bg-accent/30">
                <td className="p-2 text-xs whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="p-2 text-xs font-mono">{String(r.remoteJid).split("@")[0]}</td>
                <td className="p-2"><OutcomeBadge outcome={r.outcome} /></td>
                <td className="p-2 max-w-[20ch] truncate text-xs">{r.inputText}</td>
                <td className="p-2 max-w-[30ch] truncate text-xs">{r.replyText ?? r.errorMessage ?? "—"}</td>
                <td className="p-2 text-right text-xs">{(r.inputTokens || 0) + (r.outputTokens || 0)}</td>
                <td className="p-2 text-right text-xs">{r.durationMs ?? "—"}</td>
              </tr>
            ))}
            {!(runsQ.data as any[])?.length && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground text-sm">Sem execuções ainda.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    replied: { label: "Respondeu", cls: "bg-emerald-100 text-emerald-700" },
    handed_off: { label: "Handoff", cls: "bg-amber-100 text-amber-700" },
    no_action: { label: "Skip", cls: "bg-slate-100 text-slate-600" },
    errored: { label: "Erro", cls: "bg-red-100 text-red-700" },
  };
  const m = map[outcome] || { label: outcome, cls: "bg-slate-100" };
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${m.cls}`}>{m.label}</span>;
}

function KnowledgeTab() {
  const listQ = trpc.agents.knowledge.list.useQuery();
  const utils = trpc.useUtils();
  const createMut = trpc.agents.knowledge.create.useMutation({
    onSuccess: () => { utils.agents.knowledge.list.invalidate(); toast.success("Item adicionado"); setEditingItem(null); setShowDialog(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = trpc.agents.knowledge.update.useMutation({
    onSuccess: () => { utils.agents.knowledge.list.invalidate(); toast.success("Atualizado"); setEditingItem(null); setShowDialog(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = trpc.agents.knowledge.delete.useMutation({
    onSuccess: () => { utils.agents.knowledge.list.invalidate(); toast.success("Removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceType, setSourceType] = useState<"faq" | "policy" | "product_info">("faq");
  const [tags, setTags] = useState("");

  function startNew() {
    setEditingItem(null);
    setTitle(""); setContent(""); setSourceType("faq"); setTags("");
    setShowDialog(true);
  }
  function startEdit(item: any) {
    setEditingItem(item);
    setTitle(item.title || "");
    setContent(item.content || "");
    setSourceType(item.sourceType || "faq");
    setTags(item.tags || "");
    setShowDialog(true);
  }
  function save() {
    if (!title.trim() || !content.trim()) { toast.error("Título e conteúdo são obrigatórios"); return; }
    if (editingItem) {
      updateMut.mutate({ id: editingItem.id, title: title.trim(), content: content.trim(), sourceType, tags: tags || null });
    } else {
      createMut.mutate({ title: title.trim(), content: content.trim(), sourceType, tags: tags || null });
    }
  }

  const items = (listQ.data as any[]) || [];
  const grouped = items.reduce((acc: Record<string, any[]>, item: any) => {
    const k = item.sourceType || "faq";
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});

  const groupLabel: Record<string, { label: string; description: string; cls: string }> = {
    faq: { label: "Perguntas frequentes", description: "Respostas para dúvidas comuns dos clientes.", cls: "border-blue-300 bg-blue-50/50 dark:bg-blue-950/20" },
    policy: { label: "Políticas e regras", description: "Regras da empresa que o agente deve seguir (cancelamento, desconto, etc).", cls: "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" },
    product_info: { label: "Informações de produtos/serviços", description: "Detalhes sobre os produtos e serviços oferecidos.", cls: "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20" },
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-start gap-3 bg-primary/5 border-primary/30">
          <BookOpen className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Como funciona</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tudo que você cadastrar aqui é injetado automaticamente no system prompt do agente.
              Use para FAQ, políticas (cancelamento, reembolso, horário), informações específicas de produtos/serviços que o agente deve saber.
              O agente prefere essas respostas em vez de recorrer a tools quando a pergunta é coberta.
            </p>
          </div>
          <Button size="sm" onClick={startNew} className="gap-2 shrink-0">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </CardContent>
      </Card>

      {listQ.isLoading ? (
        <div className="text-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
          Nenhum conhecimento cadastrado ainda. Comece adicionando uma FAQ ou política.
        </CardContent></Card>
      ) : (
        ["policy", "product_info", "faq"].map((type) => {
          const list = grouped[type];
          if (!list?.length) return null;
          const meta = groupLabel[type];
          return (
            <Card key={type} className={`border ${meta.cls}`}>
              <CardContent className="p-4">
                <div className="mb-3">
                  <p className="text-sm font-bold">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
                <div className="space-y-2">
                  {list.map((item: any) => (
                    <div key={item.id} className="bg-card rounded-lg border p-3 group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{item.content}</p>
                          {item.tags && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {item.tags.split(",").map((t: string, i: number) => (
                                <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{t.trim()}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => startEdit(item)} className="p-1.5 hover:bg-muted rounded" title="Editar">
                            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button type="button" onClick={() => { if (confirm(`Remover "${item.title}"?`)) deleteMut.mutate({ id: item.id }); }} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded" title="Remover">
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar conhecimento" : "Adicionar conhecimento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faq">Pergunta frequente</SelectItem>
                  <SelectItem value="policy">Política / regra</SelectItem>
                  <SelectItem value="product_info">Informação de produto/serviço</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Política de cancelamento" />
            </div>
            <div>
              <Label className="text-xs">Conteúdo</Label>
              <Textarea
                rows={6}
                value={content} onChange={(e) => setContent(e.target.value)}
                placeholder="Texto que será injetado no contexto do agente. Seja claro e direto."
              />
            </div>
            <div>
              <Label className="text-xs">Tags (opcional)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="cancelamento, reembolso, prazo" />
              <p className="text-[10px] text-muted-foreground mt-1">Separadas por vírgula. Para organização interna apenas.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={save} disabled={createMut.isPending || updateMut.isPending} className="gap-2">
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingItem ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
