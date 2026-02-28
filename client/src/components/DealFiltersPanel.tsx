import { useState, useMemo, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DateRangeFilter, { useDateFilter, getPresetDates, type DatePreset } from "@/components/DateRangeFilter";
import { Filter, X, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc";

const TENANT_ID = 1;

// ─── Types ───
export interface DealFilters {
  status?: string;
  titleSearch?: string;
  accountId?: number;
  leadSource?: string;
  utmCampaign?: string;
  utmSource?: string;
  utmMedium?: string;
  productId?: number;
  valueMin?: number;
  valueMax?: number;
  dateFrom?: string;
  dateTo?: string;
  expectedCloseDateFrom?: string;
  expectedCloseDateTo?: string;
  lastActivityDateFrom?: string;
  lastActivityDateTo?: string;
  noTasks?: boolean;
  cooling?: boolean;
  coolingDays?: number;
}

const EMPTY_FILTERS: DealFilters = {};

// ─── Hook ───
export function useDealFilters() {
  const [filters, setFilters] = useState<DealFilters>(EMPTY_FILTERS);
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.titleSearch) count++;
    if (filters.accountId) count++;
    if (filters.leadSource) count++;
    if (filters.utmCampaign) count++;
    if (filters.utmSource) count++;
    if (filters.utmMedium) count++;
    if (filters.productId) count++;
    if (filters.valueMin || filters.valueMax) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.expectedCloseDateFrom || filters.expectedCloseDateTo) count++;
    if (filters.lastActivityDateFrom || filters.lastActivityDateTo) count++;
    if (filters.noTasks) count++;
    if (filters.cooling) count++;
    return count;
  }, [filters]);

  const clear = useCallback(() => setFilters(EMPTY_FILTERS), []);

  return { filters, setFilters, isOpen, setIsOpen, activeCount, clear };
}

// ─── Filter Button ───
export function DealFilterButton({ activeCount, onClick }: { activeCount: number; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="gap-2 relative">
      <Filter className="h-4 w-4" />
      <span>Filtros</span>
      {activeCount > 0 && (
        <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-blue-600 text-white">
          {activeCount}
        </Badge>
      )}
    </Button>
  );
}

// ─── Date Section (mini) ───
function DateSection({ label, fromValue, toValue, onFromChange, onToChange }: {
  label: string;
  fromValue?: string;
  toValue?: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  const df = useDateFilter("all");

  // Sync local useDateFilter with parent state
  const handlePresetChange = (p: DatePreset) => {
    df.setPreset(p);
    if (p === "custom") return;
    if (p === "all") {
      onFromChange("");
      onToChange("");
      return;
    }
    const range = getPresetDates(p);
    if (range) {
      onFromChange(range.from || "");
      onToChange(range.to || "");
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      <DateRangeFilter
        preset={df.preset}
        onPresetChange={handlePresetChange}
        customFrom={fromValue || ""}
        onCustomFromChange={onFromChange}
        customTo={toValue || ""}
        onCustomToChange={onToChange}
        onReset={() => { df.setPreset("all"); onFromChange(""); onToChange(""); }}
        compact
      />
    </div>
  );
}

// ─── Main Panel ───
export default function DealFiltersPanel({
  open,
  onOpenChange,
  filters,
  onApply,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: DealFilters;
  onApply: (filters: DealFilters) => void;
  onClear: () => void;
}) {
  // Local state for editing before applying
  const [local, setLocal] = useState<DealFilters>(filters);

  // Sync when opened
  const handleOpenChange = (open: boolean) => {
    if (open) setLocal(filters);
    onOpenChange(open);
  };

  // Data for selects
  const accounts = trpc.crm.accounts.list.useQuery({ tenantId: TENANT_ID });
  const leadSources = trpc.crm.leadSources.list.useQuery({ tenantId: TENANT_ID });
  const campaigns = trpc.crm.campaigns.list.useQuery({ tenantId: TENANT_ID });
  const products = trpc.productCatalog.products.list.useQuery({ tenantId: TENANT_ID });
  const utmValues = trpc.utmAnalytics.filterValues.useQuery({ tenantId: TENANT_ID });

  const set = (key: keyof DealFilters, value: any) => {
    setLocal((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const handleApply = () => {
    onApply(local);
    onOpenChange(false);
  };

  const handleClear = () => {
    setLocal(EMPTY_FILTERS);
    onClear();
    onOpenChange(false);
  };

  // Value formatting helpers
  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 flex flex-col h-full overflow-hidden !gap-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Filtros</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5">
          <div className="space-y-5 py-4">

            {/* ─── Toggles ─── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Ver apenas negociações sem tarefa</Label>
                <Switch checked={!!local.noTasks} onCheckedChange={(v) => set("noTasks", v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Ver apenas negociações esfriando</Label>
                <Switch checked={!!local.cooling} onCheckedChange={(v) => set("cooling", v)} />
              </div>
              {local.cooling && (
                <div className="flex items-center gap-2 pl-4">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Dias sem atividade:</Label>
                  <Input
                    type="number"
                    className="h-7 w-20 text-xs"
                    value={local.coolingDays || 7}
                    onChange={(e) => set("coolingDays", parseInt(e.target.value) || 7)}
                    min={1}
                  />
                </div>
              )}
            </div>

            <div className="border-t" />

            {/* ─── Status ─── */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status da Negociação</Label>
              <Select value={local.status || "all"} onValueChange={(v) => set("status", v === "all" ? undefined : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Em andamento</SelectItem>
                  <SelectItem value="won">Ganhas</SelectItem>
                  <SelectItem value="lost">Perdidas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ─── Nome da Negociação ─── */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome da Negociação</Label>
              <Input
                placeholder="Buscar por nome..."
                className="h-9"
                value={local.titleSearch || ""}
                onChange={(e) => set("titleSearch", e.target.value)}
              />
            </div>

            {/* ─── Valor Total ─── */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor Total</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="R$ 0,00"
                  className="h-9"
                  value={local.valueMin ? local.valueMin / 100 : ""}
                  onChange={(e) => set("valueMin", e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined)}
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="number"
                  placeholder="R$ 0,00"
                  className="h-9"
                  value={local.valueMax ? local.valueMax / 100 : ""}
                  onChange={(e) => set("valueMax", e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined)}
                />
              </div>
            </div>

            {/* ─── Data de Criação ─── */}
            <DateSection
              label="Data de Criação"
              fromValue={local.dateFrom}
              toValue={local.dateTo}
              onFromChange={(v) => set("dateFrom", v)}
              onToChange={(v) => set("dateTo", v)}
            />

            {/* ─── Data de Último Contato ─── */}
            <DateSection
              label="Data de Último Contato"
              fromValue={local.lastActivityDateFrom}
              toValue={local.lastActivityDateTo}
              onFromChange={(v) => set("lastActivityDateFrom", v)}
              onToChange={(v) => set("lastActivityDateTo", v)}
            />

            {/* ─── Data de Previsão de Fechamento ─── */}
            <DateSection
              label="Data de Previsão de Fechamento"
              fromValue={local.expectedCloseDateFrom}
              toValue={local.expectedCloseDateTo}
              onFromChange={(v) => set("expectedCloseDateFrom", v)}
              onToChange={(v) => set("expectedCloseDateTo", v)}
            />

            {/* ─── Empresa ─── */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Empresa</Label>
              <Select value={local.accountId ? String(local.accountId) : "all"} onValueChange={(v) => set("accountId", v === "all" ? undefined : parseInt(v))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(accounts.data || []).map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ─── Campanha UTM ─── */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Campanha</Label>
              <Select value={local.utmCampaign || "all"} onValueChange={(v) => set("utmCampaign", v === "all" ? undefined : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(utmValues.data?.campaigns || []).map((c: string) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ─── Fonte (Lead Source) ─── */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fonte</Label>
              <Select value={local.leadSource || "all"} onValueChange={(v) => set("leadSource", v === "all" ? undefined : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(leadSources.data || []).map((s: any) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ─── UTM Source ─── */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">UTM Source</Label>
              <Select value={local.utmSource || "all"} onValueChange={(v) => set("utmSource", v === "all" ? undefined : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(utmValues.data?.sources || []).map((s: string) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ─── UTM Medium ─── */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">UTM Medium</Label>
              <Select value={local.utmMedium || "all"} onValueChange={(v) => set("utmMedium", v === "all" ? undefined : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(utmValues.data?.mediums || []).map((m: string) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ─── Produto ou Serviço ─── */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Produto ou Serviço</Label>
              <Select value={local.productId ? String(local.productId) : "all"} onValueChange={(v) => set("productId", v === "all" ? undefined : parseInt(v))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {(products.data || []).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Spacer for footer */}
            <div className="h-6" />
          </div>
        </div>

        <SheetFooter className="border-t px-5 py-4 flex-row gap-3 shrink-0">
          <Button variant="outline" onClick={handleClear} className="flex-1 gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
            <RotateCcw className="h-4 w-4" />
            Limpar filtros
          </Button>
          <Button onClick={handleApply} className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Filter className="h-4 w-4" />
            Aplicar filtros
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
