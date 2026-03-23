import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import { useLocation } from "wouter";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DatePicker } from "@/components/ui/date-picker";
import { Target, Plus, Calendar, Pencil, Trash2, MoreVertical, Building2, User, TrendingUp, Hash, Percent } from "lucide-react";
import { formatDate } from "../../../shared/dateUtils";
import { toast } from "sonner";

// ── Metric definitions ──
const METRICS = [
  { key: "total_sold", label: "Valor Vendido (R$)", icon: TrendingUp, unit: "R$" },
  { key: "deals_count", label: "Qtd. de Negociações", icon: Hash, unit: "" },
  { key: "conversion_rate", label: "Taxa de Conversão (%)", icon: Percent, unit: "%" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

function getMetricLabel(key: string) {
  return METRICS.find((m) => m.key === key)?.label ?? key;
}
function getMetricUnit(key: string) {
  return METRICS.find((m) => m.key === key)?.unit ?? "";
}
function getMetricIcon(key: string) {
  return METRICS.find((m) => m.key === key)?.icon ?? Target;
}

function formatTargetValue(value: number, metricKey: string) {
  const unit = getMetricUnit(metricKey);
  if (unit === "R$") return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  if (unit === "%") return `${value}%`;
  return value.toLocaleString("pt-BR");
}

// ── Types ──
interface GoalFormData {
  name: string;
  scope: "user" | "company";
  periodStart: string;
  periodEnd: string;
  metricKey: MetricKey;
  targetValue: string;
  userId?: number;
  companyId?: number;
}

const INITIAL_FORM: GoalFormData = {
  name: "",
  scope: "user",
  periodStart: "",
  periodEnd: "",
  metricKey: "total_sold",
  targetValue: "",
};

export default function Goals() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [, setLocation] = useLocation();

  if (!adminLoading && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4 py-20">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">
          A gestão de Metas é exclusiva para administradores.
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

  const utils = trpc.useUtils();
  const goals = trpc.management.goals.list.useQuery();
  const users = trpc.rdStation.listTeamMembers.useQuery();
  const companies = trpc.management.companies.list.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<GoalFormData>(INITIAL_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // ── Mutations ──
  const createMutation = trpc.management.goals.create.useMutation({
    onSuccess: () => {
      toast.success("Meta criada com sucesso");
      utils.management.goals.list.invalidate();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.management.goals.update.useMutation({
    onSuccess: () => {
      toast.success("Meta atualizada");
      utils.management.goals.list.invalidate();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.management.goals.delete.useMutation({
    onSuccess: () => {
      toast.success("Meta excluída");
      utils.management.goals.list.invalidate();
      setDeleteConfirmId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Helpers ──
  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
  }

  function openCreate() {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setDialogOpen(true);
  }

  function openEdit(g: any) {
    setEditingId(g.id);
    setForm({
      name: g.name ?? "",
      scope: g.scope ?? "user",
      periodStart: g.periodStart ? new Date(g.periodStart).toISOString().slice(0, 10) : "",
      periodEnd: g.periodEnd ? new Date(g.periodEnd).toISOString().slice(0, 10) : "",
      metricKey: g.metricKey ?? "total_sold",
      targetValue: String(g.targetValue ?? ""),
      userId: g.userId ?? undefined,
      companyId: g.companyId ?? undefined,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.periodStart || !form.periodEnd) {
      toast.error("Selecione o período (início e fim)");
      return;
    }
    if (!form.targetValue || Number(form.targetValue) <= 0) {
      toast.error("Informe um valor-alvo maior que zero");
      return;
    }

    const payload = {
      name: form.name || undefined,
      scope: form.scope,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      metricKey: form.metricKey,
      targetValue: Number(form.targetValue),
      userId: form.scope === "user" ? form.userId : undefined,
      companyId: form.scope === "company" ? form.companyId : undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Scope badge ──
  function ScopeBadge({ scope, userId, companyId }: { scope: string; userId?: number | null; companyId?: number | null }) {
    if (scope === "company") {
      const company = companies.data?.find((c: any) => c.id === companyId);
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
          <Building2 className="h-3 w-3" />
          {company?.name ?? "Empresa"}
        </span>
      );
    }
    const user = users.data?.find((u: any) => u.id === userId);
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 font-medium">
        <User className="h-3 w-3" />
        {user?.name ?? "Usuário"}
      </span>
    );
  }

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Metas</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Defina e acompanhe metas da equipe e da empresa.</p>
        </div>
        <Button
          className="h-9 gap-2 px-5 rounded-lg bg-primary hover:bg-primary/90 shadow-sm text-[13px] font-medium transition-colors"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" />
          Nova Meta
        </Button>
      </div>

      {/* Goals grid */}
      {goals.isLoading ? (
        <p className="text-[13px] text-muted-foreground text-center py-12">Carregando...</p>
      ) : !goals.data?.length ? (
        <Card className="border border-border/40 shadow-none rounded-xl">
          <div className="p-12 text-center text-muted-foreground">
            <Target className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-[14px] font-medium text-muted-foreground/60">Nenhuma meta definida</p>
            <p className="text-[13px] text-muted-foreground/40 mt-1">Crie metas para acompanhar o desempenho da equipe.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.data.map((g: any) => {
            // For total_sold: currentValue comes as cents from DB, targetValue is in reais
            const currentVal = g.metricKey === 'total_sold' ? (g.currentValue ?? 0) / 100 : (g.currentValue ?? 0);
            const pct = g.targetValue > 0 ? Math.min(100, Math.round((currentVal / g.targetValue) * 100)) : 0;
            const isComplete = pct >= 100;
            const MetricIcon = getMetricIcon(g.metricKey);
            return (
              <Card key={g.id} className="border border-border/40 shadow-none rounded-xl hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${isComplete ? "bg-emerald-50 dark:bg-emerald-900/30" : "bg-primary/10"}`}>
                        <MetricIcon className={`h-4 w-4 ${isComplete ? "text-emerald-600" : "text-primary"}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate">{g.name || getMetricLabel(g.metricKey)}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3 shrink-0" />
                          {g.periodStart ? formatDate(g.periodStart) : "—"} — {g.periodEnd ? formatDate(g.periodEnd) : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[18px] font-bold tabular-nums ${isComplete ? "text-emerald-600" : "text-foreground"}`}>{pct}%</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(g)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirmId(g.id)}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <ScopeBadge scope={g.scope ?? "user"} userId={g.userId} companyId={g.companyId} />
                    <span className="text-[11px] text-muted-foreground">{getMetricLabel(g.metricKey)}</span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isComplete ? "bg-emerald-500" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-muted-foreground">
                      Atual: {formatTargetValue(currentVal, g.metricKey)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Alvo: {formatTargetValue(g.targetValue, g.metricKey)}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Meta" : "Nova Meta"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Altere os campos desejados e salve." : "Defina o escopo, período, métrica e valor-alvo."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-[13px]">Nome da meta (opcional)</Label>
              <Input
                placeholder="Ex: Meta de vendas Q1"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Scope */}
            <div className="space-y-1.5">
              <Label className="text-[13px]">Escopo</Label>
              <Select value={form.scope} onValueChange={(v) => setForm((f) => ({ ...f, scope: v as "user" | "company", userId: undefined, companyId: undefined }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <span className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> Usuário</span>
                  </SelectItem>
                  <SelectItem value="company">
                    <span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> Empresa</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* User or Company selector */}
            {form.scope === "user" && (
              <div className="space-y-1.5">
                <Label className="text-[13px]">Usuário responsável</Label>
                <Select
                  value={form.userId ? String(form.userId) : ""}
                  onValueChange={(v) => setForm((f) => ({ ...f, userId: Number(v) }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.data?.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.scope === "company" && (
              <div className="space-y-1.5">
                <Label className="text-[13px]">Empresa</Label>
                <Select
                  value={form.companyId ? String(form.companyId) : ""}
                  onValueChange={(v) => setForm((f) => ({ ...f, companyId: Number(v) }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.data?.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Period */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Início</Label>
                <DatePicker
                  value={form.periodStart}
                  onChange={(v) => setForm((f) => ({ ...f, periodStart: v }))}
                  placeholder="Data início"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Fim</Label>
                <DatePicker
                  value={form.periodEnd}
                  onChange={(v) => setForm((f) => ({ ...f, periodEnd: v }))}
                  placeholder="Data fim"
                />
              </div>
            </div>

            {/* Metric */}
            <div className="space-y-1.5">
              <Label className="text-[13px]">Métrica</Label>
              <Select value={form.metricKey} onValueChange={(v) => setForm((f) => ({ ...f, metricKey: v as MetricKey }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRICS.map((m) => {
                    const Icon = m.icon;
                    return (
                      <SelectItem key={m.key} value={m.key}>
                        <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {m.label}</span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Target value */}
            <div className="space-y-1.5">
              <Label className="text-[13px]">Valor-alvo</Label>
              <div className="relative">
                {getMetricUnit(form.metricKey) === "R$" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">R$</span>
                )}
                <Input
                  type="number"
                  min={0}
                  step={form.metricKey === "conversion_rate" ? "0.1" : "1"}
                  placeholder={form.metricKey === "total_sold" ? "100000" : form.metricKey === "conversion_rate" ? "25" : "50"}
                  value={form.targetValue}
                  onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                  className={getMetricUnit(form.metricKey) === "R$" ? "pl-9" : ""}
                />
                {getMetricUnit(form.metricKey) === "%" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">%</span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Salvando..." : editingId ? "Salvar" : "Criar Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Excluir meta</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate({ id: deleteConfirmId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
