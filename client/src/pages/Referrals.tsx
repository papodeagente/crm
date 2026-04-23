import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SearchableCombobox,
  type ComboboxOption,
} from "@/components/ui/searchable-combobox";
import {
  Users,
  Plus,
  Gift,
  TrendingUp,
  CheckCircle2,
  Clock,
  Trophy,
  Phone,
  Star,
} from "lucide-react";

// ── Helpers ──

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  pending: { label: "Pendente", variant: "outline", className: "border-yellow-400 bg-yellow-50 text-yellow-700" },
  converted: { label: "Convertida", variant: "default", className: "border-green-400 bg-green-50 text-green-700" },
  expired: { label: "Expirada", variant: "destructive", className: "border-red-400 bg-red-50 text-red-700" },
};

const REWARD_TYPES: { value: string; label: string }[] = [
  { value: "discount", label: "Desconto" },
  { value: "cashback", label: "Cashback" },
  { value: "gift", label: "Brinde" },
  { value: "credit", label: "Crédito" },
  { value: "other", label: "Outro" },
];

function rewardTypeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return REWARD_TYPES.find((r) => r.value === type)?.label ?? type;
}

// ── Component ──

export default function Referrals() {
  const utils = trpc.useUtils();

  // ── State ──
  const [createOpen, setCreateOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertingId, setConvertingId] = useState<number | null>(null);
  const [convertDealId, setConvertDealId] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Form state
  const [formReferrerId, setFormReferrerId] = useState("");
  const [formReferredId, setFormReferredId] = useState("");
  const [formRewardType, setFormRewardType] = useState("");
  const [formRewardValue, setFormRewardValue] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // ── Queries ──
  const statsQuery = trpc.referrals.stats.useQuery();
  const referralsQuery = trpc.referrals.list.useQuery({
    status: filterStatus === "all" ? undefined : filterStatus,
  });
  const contactsQuery = trpc.crm.contacts.list.useQuery({});

  // ── Mutations ──
  const createMutation = trpc.referrals.create.useMutation({
    onSuccess: () => {
      utils.referrals.list.invalidate();
      utils.referrals.stats.invalidate();
      toast.success("Indicacao criada com sucesso!");
      resetForm();
      setCreateOpen(false);
    },
    onError: (err) => toast.error(err.message || "Erro ao criar indicacao"),
  });

  const convertMutation = trpc.referrals.convert.useMutation({
    onSuccess: () => {
      utils.referrals.list.invalidate();
      utils.referrals.stats.invalidate();
      toast.success("Indicacao convertida!");
      setConvertOpen(false);
      setConvertingId(null);
      setConvertDealId("");
    },
    onError: (err) => toast.error(err.message || "Erro ao converter indicacao"),
  });

  const rewardMutation = trpc.referrals.markRewardDelivered.useMutation({
    onSuccess: () => {
      utils.referrals.list.invalidate();
      utils.referrals.stats.invalidate();
      toast.success("Recompensa marcada como entregue!");
    },
    onError: (err) => toast.error(err.message || "Erro ao entregar recompensa"),
  });

  // ── Derived data ──
  const stats = statsQuery.data;
  const referrals = referralsQuery.data ?? [];
  const contacts = contactsQuery.data ?? [];

  const contactOptions: ComboboxOption[] = useMemo(
    () =>
      (Array.isArray(contacts) ? contacts : []).map((c: any) => ({
        value: String(c.id),
        label: c.name || c.phone || `#${c.id}`,
        sublabel: c.phone || c.email || undefined,
      })),
    [contacts],
  );

  // ── Handlers ──
  function resetForm() {
    setFormReferrerId("");
    setFormReferredId("");
    setFormRewardType("");
    setFormRewardValue("");
    setFormNotes("");
  }

  function handleCreate() {
    if (!formReferrerId || !formReferredId) {
      toast.error("Selecione o indicador e o indicado.");
      return;
    }
    createMutation.mutate({
      referrerId: Number(formReferrerId),
      referredId: Number(formReferredId),
      rewardType: formRewardType || undefined,
      rewardValue: formRewardValue ? Number(formRewardValue) : undefined,
      notes: formNotes || undefined,
    });
  }

  function handleConvert() {
    if (!convertingId || !convertDealId) {
      toast.error("Informe o ID da negociacao.");
      return;
    }
    convertMutation.mutate({
      referralId: convertingId,
      dealId: Number(convertDealId),
    });
  }

  function handleDeliverReward(referralId: number) {
    rewardMutation.mutate({ referralId });
  }

  // ── Render ──
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Indicacoes</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie indicacoes de clientes e recompensas
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nova Indicacao
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Indicacoes
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Convertidas
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.converted ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats?.pending ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recompensas Entregues
            </CardTitle>
            <Gift className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats?.rewardsDelivered ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Indicadores */}
      {stats?.topReferrers && stats.topReferrers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top Indicadores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stats.topReferrers.map((referrer: any, index: number) => (
                <div
                  key={referrer.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-sm font-bold text-yellow-700">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">
                      {referrer.name}
                    </p>
                    {referrer.phone && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {referrer.phone}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {referrer.referralCount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {referrer.convertedCount} conv.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter + Table */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Todas as Indicacoes</CardTitle>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="converted">Convertidas</SelectItem>
              <SelectItem value="expired">Expiradas</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Star className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Nenhuma indicacao encontrada.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indicador</TableHead>
                    <TableHead>Indicado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tipo Recompensa</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Entregue</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((ref: any) => {
                    const statusInfo = STATUS_MAP[ref.status] ?? STATUS_MAP.pending;
                    return (
                      <TableRow key={ref.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {ref.referrerName || "—"}
                            </p>
                            {ref.referrerPhone && (
                              <p className="text-xs text-muted-foreground">
                                {ref.referrerPhone}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {ref.referredName || "—"}
                            </p>
                            {ref.referredPhone && (
                              <p className="text-xs text-muted-foreground">
                                {ref.referredPhone}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={statusInfo.variant}
                            className={statusInfo.className}
                          >
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{rewardTypeLabel(ref.rewardType)}</TableCell>
                        <TableCell>{formatCurrency(ref.rewardValue)}</TableCell>
                        <TableCell>
                          {ref.rewardDelivered ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Nao
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(ref.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {ref.status === "pending" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setConvertingId(ref.id);
                                  setConvertDealId(ref.dealId ? String(ref.dealId) : "");
                                  setConvertOpen(true);
                                }}
                              >
                                Converter
                              </Button>
                            )}
                            {!ref.rewardDelivered &&
                              ref.rewardType && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  disabled={rewardMutation.isPending}
                                  onClick={() => handleDeliverReward(ref.id)}
                                >
                                  Entregar
                                </Button>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Nova Indicacao */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Nova Indicacao</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Indicador *</Label>
              <SearchableCombobox
                options={contactOptions}
                value={formReferrerId}
                onValueChange={setFormReferrerId}
                placeholder="Selecione o indicador"
                searchPlaceholder="Buscar contato..."
                emptyText="Nenhum contato encontrado"
                loading={contactsQuery.isLoading}
                clearable
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Indicado *</Label>
              <SearchableCombobox
                options={contactOptions}
                value={formReferredId}
                onValueChange={setFormReferredId}
                placeholder="Selecione o indicado"
                searchPlaceholder="Buscar contato..."
                emptyText="Nenhum contato encontrado"
                loading={contactsQuery.isLoading}
                clearable
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Tipo de Recompensa</Label>
                <Select value={formRewardType} onValueChange={setFormRewardType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {REWARD_TYPES.map((rt) => (
                      <SelectItem key={rt.value} value={rt.value}>
                        {rt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0,00"
                  value={formRewardValue}
                  onChange={(e) => setFormRewardValue(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Observacoes</Label>
              <Textarea
                placeholder="Anotacoes sobre esta indicacao..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Criando..." : "Criar Indicacao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Converter Indicacao */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Converter Indicacao</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>ID da Negociacao *</Label>
              <Input
                type="number"
                placeholder="Ex: 123"
                value={convertDealId}
                onChange={(e) => setConvertDealId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Informe o ID da negociacao vinculada a esta indicacao.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConvertOpen(false);
                setConvertingId(null);
                setConvertDealId("");
              }}
              disabled={convertMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConvert}
              disabled={convertMutation.isPending}
            >
              {convertMutation.isPending ? "Convertendo..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
