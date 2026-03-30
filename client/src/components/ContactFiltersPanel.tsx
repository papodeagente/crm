import { useState, useMemo, useCallback, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DateRangeFilter, { useDateFilter, getPresetDates, type DatePreset } from "@/components/DateRangeFilter";
import { Filter, X, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Types ───
export interface ContactFilters {
  nameSearch?: string;
  email?: string;
  phone?: string;
  stage?: string;
  dateFrom?: string;
  dateTo?: string;
  customFieldFilters?: { fieldId: number; value: string }[];
}

const EMPTY_FILTERS: ContactFilters = {};

// ─── Hook ───
export function useContactFilters() {
  const [filters, setFilters] = useState<ContactFilters>(() => {
    try {
      const saved = sessionStorage.getItem("contactFilters");
      return saved ? JSON.parse(saved) : EMPTY_FILTERS;
    } catch { return EMPTY_FILTERS; }
  });
  const [isOpen, setIsOpen] = useState(false);

  // Persist filters to sessionStorage whenever they change
  useEffect(() => {
    try {
      const hasFilters = Object.keys(filters).length > 0 && JSON.stringify(filters) !== '{}';
      if (hasFilters) {
        sessionStorage.setItem("contactFilters", JSON.stringify(filters));
      } else {
        sessionStorage.removeItem("contactFilters");
      }
    } catch { /* ignore */ }
  }, [filters]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.nameSearch) count++;
    if (filters.email) count++;
    if (filters.phone) count++;
    if (filters.stage) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.customFieldFilters?.length) count += filters.customFieldFilters.length;
    return count;
  }, [filters]);

  const clear = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    try { sessionStorage.removeItem("contactFilters"); } catch { /* ignore */ }
  }, []);

  return { filters, setFilters, isOpen, setIsOpen, activeCount, clear };
}

// ─── Filter Button ───
export function ContactFilterButton({ activeCount, onClick }: { activeCount: number; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="gap-2 relative h-9 rounded-lg text-[13px]">
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
export default function ContactFiltersPanel({
  open,
  onOpenChange,
  filters,
  onApply,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ContactFilters;
  onApply: (filters: ContactFilters) => void;
  onClear: () => void;
}) {
  // Local state for editing before applying
  const [local, setLocal] = useState<ContactFilters>(filters);

  // Sync when opened
  const handleOpenChange = (open: boolean) => {
    if (open) setLocal(filters);
    onOpenChange(open);
  };

  // Data for selects
  const contactCustomFields = trpc.customFields.list.useQuery({ entity: "contact" });

  const set = (key: keyof ContactFilters, value: any) => {
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

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[400px] sm:max-w-[400px] p-0 flex flex-col h-full overflow-hidden !gap-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Filtros de Passageiros</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5">
          <div className="space-y-5 py-4">

            {/* ─── Nome ─── */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome</Label>
              <Input
                placeholder="Buscar por nome..."
                className="h-9"
                value={local.nameSearch || ""}
                onChange={(e) => set("nameSearch", e.target.value)}
              />
            </div>

            {/* ─── Email ─── */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</Label>
              <Input
                placeholder="Buscar por email..."
                className="h-9"
                value={local.email || ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>

            {/* ─── Telefone ─── */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Telefone</Label>
              <Input
                placeholder="Buscar por telefone..."
                className="h-9"
                value={local.phone || ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>

            {/* ─── Estágio ─── */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estágio</Label>
              <Select value={local.stage || "all"} onValueChange={(v) => set("stage", v === "all" ? undefined : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="customer">Cliente</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t" />

            {/* ─── Data de Criação ─── */}
            <DateSection
              label="Data de Criação"
              fromValue={local.dateFrom}
              toValue={local.dateTo}
              onFromChange={(v) => set("dateFrom", v)}
              onToChange={(v) => set("dateTo", v)}
            />

            {/* ─── Campos Personalizados ─── */}
            {(contactCustomFields.data as any[])?.length > 0 && (
              <>
                <div className="border-t" />
                <div className="space-y-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Campos Personalizados</Label>
                  {(contactCustomFields.data as any[]).map((field: any) => {
                    const existing = (local.customFieldFilters || []).find((f) => f.fieldId === field.id);
                    const value = existing?.value || "";
                    const updateCF = (v: string) => {
                      const current = local.customFieldFilters || [];
                      if (!v) {
                        setLocal((prev) => ({ ...prev, customFieldFilters: current.filter((f) => f.fieldId !== field.id) }));
                      } else {
                        const idx = current.findIndex((f) => f.fieldId === field.id);
                        if (idx >= 0) {
                          const updated = [...current];
                          updated[idx] = { fieldId: field.id, value: v };
                          setLocal((prev) => ({ ...prev, customFieldFilters: updated }));
                        } else {
                          setLocal((prev) => ({ ...prev, customFieldFilters: [...current, { fieldId: field.id, value: v }] }));
                        }
                      }
                    };
                    if (field.type === "select" && field.options?.length > 0) {
                      return (
                        <div key={field.id} className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{field.label}</Label>
                          <Select value={value || "all"} onValueChange={(v) => updateCF(v === "all" ? "" : v)}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              {field.options.map((opt: string) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    }
                    if (field.type === "boolean") {
                      return (
                        <div key={field.id} className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{field.label}</Label>
                          <Select value={value || "all"} onValueChange={(v) => updateCF(v === "all" ? "" : v)}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              <SelectItem value="true">Sim</SelectItem>
                              <SelectItem value="false">Não</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    }
                    return (
                      <div key={field.id} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{field.label}</Label>
                        <Input
                          placeholder={`Filtrar por ${field.label.toLowerCase()}...`}
                          className="h-9"
                          value={value}
                          onChange={(e) => updateCF(e.target.value)}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            )}

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
