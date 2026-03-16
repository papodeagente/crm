import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar, ChevronDown, X } from "lucide-react";

// ─── Types ───
export type DatePreset =
  | "all"
  | "last7"
  | "last30"
  | "last3months"
  | "last6months"
  | "thisYear"
  | "lastYear"
  | "lastMonth"
  | "custom";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export interface DateFilterValue {
  preset: DatePreset;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Preset Labels ───
const PRESET_LABELS: Record<DatePreset, string> = {
  all: "Todo o período",
  last7: "Últimos 7 dias",
  last30: "Último mês",
  last3months: "Últimos 3 meses",
  last6months: "Últimos 6 meses",
  thisYear: "Esse ano",
  lastYear: "Ano passado",
  lastMonth: "Mês passado",
  custom: "Personalizado",
};

// ─── Preset Calculation ───
function getPresetDates(preset: DatePreset): DateRange | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "all":
      return null;
    case "last7": {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from: fmt(from), to: fmt(today) };
    }
    case "last30": {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from: fmt(from), to: fmt(today) };
    }
    case "last3months": {
      const from = new Date(today);
      from.setMonth(from.getMonth() - 3);
      return { from: fmt(from), to: fmt(today) };
    }
    case "last6months": {
      const from = new Date(today);
      from.setMonth(from.getMonth() - 6);
      return { from: fmt(from), to: fmt(today) };
    }
    case "thisYear": {
      const from = new Date(today.getFullYear(), 0, 1);
      return { from: fmt(from), to: fmt(today) };
    }
    case "lastYear": {
      const from = new Date(today.getFullYear() - 1, 0, 1);
      const to = new Date(today.getFullYear() - 1, 11, 31);
      return { from: fmt(from), to: fmt(to) };
    }
    case "lastMonth": {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmt(from), to: fmt(to) };
    }
    case "custom":
      return null;
    default:
      return null;
  }
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Hook for consuming the filter ───
export function useDateFilter(initial: DatePreset = "all") {
  const [preset, setPreset] = useState<DatePreset>(initial);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const dates = useMemo(() => {
    if (preset === "custom") {
      return {
        dateFrom: customFrom || undefined,
        dateTo: customTo || undefined,
      };
    }
    const range = getPresetDates(preset);
    return {
      dateFrom: range?.from,
      dateTo: range?.to,
    };
  }, [preset, customFrom, customTo]);

  const reset = useCallback(() => {
    setPreset("all");
    setCustomFrom("");
    setCustomTo("");
  }, []);

  const filterValue: DateFilterValue = {
    preset,
    ...dates,
  };

  return {
    preset,
    setPreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    dates,
    reset,
    filterValue,
  };
}

// ─── Component Props ───
interface DateRangeFilterProps {
  preset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  customFrom: string;
  onCustomFromChange: (v: string) => void;
  customTo: string;
  onCustomToChange: (v: string) => void;
  onReset: () => void;
  /** Compact mode for inline use */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

// ─── Component ───
export default function DateRangeFilter({
  preset,
  onPresetChange,
  customFrom,
  onCustomFromChange,
  customTo,
  onCustomToChange,
  onReset,
  compact = false,
  className = "",
}: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const isActive = preset !== "all";

  const displayLabel = useMemo(() => {
    if (preset === "custom" && customFrom && customTo) {
      return `${formatDisplayDate(customFrom)} — ${formatDisplayDate(customTo)}`;
    }
    if (preset === "custom" && customFrom) {
      return `A partir de ${formatDisplayDate(customFrom)}`;
    }
    if (preset === "custom" && customTo) {
      return `Até ${formatDisplayDate(customTo)}`;
    }
    return PRESET_LABELS[preset];
  }, [preset, customFrom, customTo]);

  const handlePresetSelect = (value: string) => {
    const p = value as DatePreset;
    onPresetChange(p);
    if (p !== "custom") {
      setOpen(false);
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Select value={preset} onValueChange={handlePresetSelect}>
          <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs gap-1.5">
            <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRESET_LABELS).filter(([k]) => k !== "custom").map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
            <SelectItem value="custom">Personalizado...</SelectItem>
          </SelectContent>
        </Select>
        {preset === "custom" && (
          <>
            <DatePicker
              value={customFrom}
              onChange={onCustomFromChange}
              placeholder="De"
              className="h-8 w-36 text-xs"
            />
            <DatePicker
              value={customTo}
              onChange={onCustomToChange}
              placeholder="Até"
              className="h-8 w-36 text-xs"
            />
          </>
        )}
        {isActive && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onReset} title="Limpar filtro">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  // Full popover mode
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 text-xs gap-1.5 ${isActive ? "border-primary/50 bg-primary/5 text-primary" : ""} ${className}`}
        >
          <Calendar className="h-3.5 w-3.5" />
          {displayLabel}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Período</p>

          {/* Preset buttons */}
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(PRESET_LABELS) as [DatePreset, string][])
              .filter(([k]) => k !== "custom")
              .map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handlePresetSelect(key)}
                  className={`text-left text-xs px-2.5 py-1.5 rounded-md transition-colors
                    ${preset === key
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-muted text-foreground"
                    }`}
                >
                  {label}
                </button>
              ))}
          </div>

          {/* Divider */}
          <div className="border-t border-border my-2" />

          {/* Custom date range */}
          <button
            onClick={() => onPresetChange("custom")}
            className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors
              ${preset === "custom"
                ? "bg-primary text-primary-foreground font-medium"
                : "hover:bg-muted text-foreground"
              }`}
          >
            Personalizado
          </button>

          {preset === "custom" && (
            <div className="space-y-2 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">De</label>
                <DatePicker
                  value={customFrom}
                  onChange={onCustomFromChange}
                  placeholder="Selecionar"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Até</label>
                <DatePicker
                  value={customTo}
                  onChange={onCustomToChange}
                  placeholder="Selecionar"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          {isActive && (
            <div className="pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground"
                onClick={() => { onReset(); setOpen(false); }}
              >
                <X className="h-3 w-3 mr-1" /> Limpar filtro
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Export preset labels for external use ───
export { PRESET_LABELS, getPresetDates };
