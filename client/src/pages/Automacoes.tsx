import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, Cake, Heart, ClipboardCheck, Plus, Pencil, Trash2, Loader2, Bell, PlayCircle, Clock } from "lucide-react";

const TRIGGER_OPTIONS = [
  { value: "birthDate", label: "Aniversário do contato", icon: Cake, recurring: true },
  { value: "weddingDate", label: "Data de casamento", icon: Heart, recurring: true },
  { value: "appointmentDate", label: "Data de agendamento (negociação)", icon: Calendar, recurring: false },
  { value: "followUpDate", label: "Data de retorno/revisão (negociação)", icon: ClipboardCheck, recurring: false },
] as const;

const PLACEHOLDERS = [
  { token: "{primeiroNome}", desc: "Primeiro nome do contato" },
  { token: "{nome}", desc: "Nome completo do contato" },
  { token: "{clinica}", desc: "Nome da clínica/empresa" },
  { token: "{data}", desc: "Data alvo (DD/MM)" },
  { token: "{dealTitle}", desc: "Título da negociação (apenas em agendamento/retorno)" },
];

interface Rule {
  id: number;
  name: string;
  triggerField: "birthDate" | "weddingDate" | "appointmentDate" | "followUpDate";
  offsetDays: number;
  timeOfDay: string;
  messageTemplate: string;
  isActive: boolean;
}

function offsetLabel(d: number): string {
  if (d === 0) return "no dia";
  if (d < 0) return `${Math.abs(d)} dia${Math.abs(d) > 1 ? "s" : ""} antes`;
  return `${d} dia${d > 1 ? "s" : ""} depois`;
}

export default function Automacoes() {
  const utils = trpc.useUtils();
  const listQ = trpc.automation.list.useQuery();
  const recentQ = trpc.automation.recentRuns.useQuery(undefined);
  const rules = (listQ.data || []) as Rule[];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [name, setName] = useState("");
  const [triggerField, setTriggerField] = useState<Rule["triggerField"]>("birthDate");
  const [offsetDays, setOffsetDays] = useState<number>(0);
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [isActive, setIsActive] = useState(true);

  const createMut = trpc.automation.create.useMutation({
    onSuccess: () => { utils.automation.list.invalidate(); toast.success("Automação criada"); reset(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.automation.update.useMutation({
    onSuccess: () => { utils.automation.list.invalidate(); toast.success("Automação atualizada"); reset(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.automation.delete.useMutation({
    onSuccess: () => { utils.automation.list.invalidate(); toast.success("Automação removida"); },
    onError: (e) => toast.error(e.message),
  });
  const runNowMut = trpc.automation.runNow.useMutation({
    onSuccess: () => { utils.automation.recentRuns.invalidate(); toast.success("Sweep executado — confira os agendamentos"); },
    onError: (e) => toast.error(e.message),
  });

  function reset() {
    setDialogOpen(false);
    setEditing(null);
    setName(""); setTriggerField("birthDate"); setOffsetDays(0); setTimeOfDay("09:00");
    setMessageTemplate(""); setIsActive(true);
  }

  function openCreate() {
    setEditing(null);
    setName(""); setTriggerField("birthDate"); setOffsetDays(0); setTimeOfDay("09:00");
    setMessageTemplate("Olá {primeiroNome}! Lembrança especial pra você 🎉");
    setIsActive(true);
    setDialogOpen(true);
  }

  function openEdit(r: Rule) {
    setEditing(r);
    setName(r.name); setTriggerField(r.triggerField); setOffsetDays(r.offsetDays); setTimeOfDay(r.timeOfDay);
    setMessageTemplate(r.messageTemplate); setIsActive(r.isActive);
    setDialogOpen(true);
  }

  function submit() {
    if (!name.trim()) return toast.error("Informe um nome");
    if (!messageTemplate.trim()) return toast.error("Informe a mensagem");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeOfDay)) return toast.error("Horário deve ser HH:MM");
    const payload = { name: name.trim(), triggerField, offsetDays, timeOfDay, messageTemplate: messageTemplate.trim(), isActive };
    if (editing) updateMut.mutate({ id: editing.id, ...payload });
    else createMut.mutate(payload);
  }

  function insertPlaceholder(token: string) {
    setMessageTemplate(t => t + token);
  }

  const triggerInfo = (f: string) => TRIGGER_OPTIONS.find(t => t.value === f);

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Automações de WhatsApp por data
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agende mensagens automáticas N dias antes ou depois de aniversário, casamento, agendamento ou retorno.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => runNowMut.mutate()} disabled={runNowMut.isPending}>
            {runNowMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1" />}
            Executar agora
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Nova automação
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Regras configuradas</CardTitle>
        </CardHeader>
        <CardContent>
          {listQ.isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhuma automação ainda. Clique em "Nova automação" para começar.
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map(r => {
                const info = triggerInfo(r.triggerField);
                const Icon = info?.icon || Bell;
                return (
                  <div key={r.id} className={`flex items-center gap-3 p-3 rounded-lg border ${r.isActive ? "border-border bg-card" : "border-border/50 bg-muted/20 opacity-70"}`}>
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{r.name}</span>
                        {!r.isActive && <Badge variant="secondary" className="text-[10px]">Pausada</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {info?.label} · {offsetLabel(r.offsetDays)} · às {r.timeOfDay}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 truncate italic">"{r.messageTemplate.slice(0, 100)}{r.messageTemplate.length > 100 ? "…" : ""}"</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => {
                        if (confirm(`Remover automação "${r.name}"?`)) deleteMut.mutate({ id: r.id });
                      }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Últimos disparos</CardTitle>
        </CardHeader>
        <CardContent>
          {recentQ.isLoading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !recentQ.data?.length ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum disparo ainda. As mensagens serão registradas aqui após o sweep diário.</p>
          ) : (
            <div className="space-y-1.5">
              {(recentQ.data as any[]).map((run: any) => (
                <div key={run.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/50">
                  <span className="text-muted-foreground w-20">{run.runDate}</span>
                  <span className="font-medium flex-1 truncate">{run.ruleName || `Regra #${run.ruleId}`}</span>
                  <Badge variant="outline" className="text-[10px]">{run.targetType} #{run.targetId}</Badge>
                  <span className={`text-[10px] ${run.messageStatus === "sent" ? "text-emerald-600" : run.messageStatus === "failed" ? "text-red-600" : "text-amber-600"}`}>
                    {run.messageStatus || "pendente"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) reset(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar automação" : "Nova automação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Felicitação de aniversário" />
            </div>
            <div>
              <Label>Gatilho</Label>
              <Select value={triggerField} onValueChange={(v: any) => setTriggerField(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quando enviar</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    value={Math.abs(offsetDays)}
                    onChange={e => {
                      const n = Math.max(0, Math.min(365, Number(e.target.value) || 0));
                      const sign = offsetDays < 0 ? -1 : 1;
                      setOffsetDays(n === 0 ? 0 : n * sign);
                    }}
                    className="w-24"
                  />
                  <Select
                    value={offsetDays < 0 ? "before" : offsetDays > 0 ? "after" : "same"}
                    onValueChange={(v) => {
                      const n = Math.abs(offsetDays);
                      if (v === "before") setOffsetDays(n === 0 ? -1 : -n);
                      else if (v === "after") setOffsetDays(n === 0 ? 1 : n);
                      else setOffsetDays(0);
                    }}
                  >
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">dias antes</SelectItem>
                      <SelectItem value="same">no dia</SelectItem>
                      <SelectItem value="after">dias depois</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Hora de envio</Label>
                <Input type="time" value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea
                value={messageTemplate}
                onChange={e => setMessageTemplate(e.target.value)}
                rows={5}
                placeholder="Olá {primeiroNome}! ..."
                className="font-mono text-xs"
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {PLACEHOLDERS.map(p => (
                  <button
                    key={p.token}
                    type="button"
                    onClick={() => insertPlaceholder(p.token)}
                    className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/70 transition-colors font-mono"
                    title={p.desc}
                  >
                    {p.token}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <Label className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                {isActive ? "Ativa" : "Pausada"}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={reset}>Cancelar</Button>
            <Button onClick={submit} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
