"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ─── Types ───────────────────────────────────────────────
export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SearchableComboboxProps {
  /** All available options (or server-filtered subset) */
  options: ComboboxOption[];
  /** Currently selected value */
  value: string;
  /** Callback when value changes */
  onValueChange: (value: string) => void;
  /** Placeholder text when nothing is selected */
  placeholder?: string;
  /** Placeholder for the search input */
  searchPlaceholder?: string;
  /** Text shown when no results match */
  emptyText?: string;
  /** Whether the combobox is disabled */
  disabled?: boolean;
  /** Whether data is loading */
  loading?: boolean;
  /** Optional className for the trigger button */
  className?: string;
  /** Optional className for the popover content */
  contentClassName?: string;
  /** Whether to allow clearing the selection */
  clearable?: boolean;
  /** Callback when search text changes (for server-side search) */
  onSearchChange?: (search: string) => void;
  /** Whether to filter client-side (default true). Set false for server-side filtering. */
  clientFilter?: boolean;
  /** Debounce delay in ms for onSearchChange (default 300) */
  debounceMs?: number;
  /** Whether this field is required (shows red asterisk) */
  required?: boolean;
  /** Label text */
  label?: string;
  /** Max height of the dropdown list */
  maxHeight?: string;
  /** Align popover */
  align?: "start" | "center" | "end";
  /** Side of the popover */
  side?: "top" | "bottom" | "left" | "right";
}

// ─── Highlight helper ────────────────────────────────────
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-primary">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Component ───────────────────────────────────────────
export function SearchableCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Selecionar...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum resultado encontrado.",
  disabled = false,
  loading = false,
  className,
  contentClassName,
  clearable = false,
  onSearchChange,
  clientFilter = true,
  debounceMs = 300,
  maxHeight = "240px",
  align = "start",
  side,
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Find selected option label
  const selectedOption = options.find((o) => o.value === value);

  // Client-side filtering
  const filteredOptions = React.useMemo(() => {
    if (!clientFilter || !search) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  }, [options, search, clientFilter]);

  // Handle search input change with debounce for server-side
  const handleSearchChange = React.useCallback(
    (val: string) => {
      setSearch(val);
      if (onSearchChange) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          onSearchChange(val);
        }, debounceMs);
      }
    },
    [onSearchChange, debounceMs]
  );

  // Focus input when popover opens
  React.useEffect(() => {
    if (open) {
      // Small delay to ensure the popover is rendered
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      setSearch("");
      if (onSearchChange) onSearchChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cleanup debounce on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-xl border border-border/60 bg-transparent px-3 py-2 text-[13px] ring-offset-background",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "hover:bg-accent/30 transition-colors",
            className
          )}
        >
          <span className={cn("truncate", !selectedOption && "text-muted-foreground")}>
            {selectedOption ? (
              <span className="flex items-center gap-2">
                {selectedOption.icon}
                {selectedOption.label}
              </span>
            ) : (
              placeholder
            )}
          </span>
          <span className="flex items-center gap-1 shrink-0 ml-2">
            {clearable && value && (
              <X
                className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onValueChange("");
                }}
              />
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("p-0 w-[var(--radix-popover-trigger-width)]", contentClassName)}
        align={align}
        side={side}
        sideOffset={4}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
        </div>

        {/* Options list */}
        <div
          className="overflow-y-auto overflow-x-hidden scroll-py-1"
          style={{ maxHeight }}
        >
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {loading ? "Buscando..." : emptyText}
            </div>
          ) : (
            <div className="p-1">
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  className={cn(
                    "relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none select-none",
                    "hover:bg-accent hover:text-accent-foreground transition-colors",
                    "focus:bg-accent focus:text-accent-foreground",
                    option.disabled && "pointer-events-none opacity-50",
                    value === option.value && "bg-accent/50"
                  )}
                  onClick={() => {
                    onValueChange(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === option.value ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col items-start gap-0 min-w-0">
                    <span className="truncate text-[13px]">
                      {option.icon && <span className="mr-1.5 inline-flex">{option.icon}</span>}
                      {highlightMatch(option.label, search)}
                    </span>
                    {option.sublabel && (
                      <span className="text-[11px] text-muted-foreground truncate">
                        {highlightMatch(option.sublabel, search)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Multi-select variant ────────────────────────────────
export interface SearchableMultiComboboxProps
  extends Omit<SearchableComboboxProps, "value" | "onValueChange" | "clearable"> {
  values: string[];
  onValuesChange: (values: string[]) => void;
  maxSelected?: number;
}

export function SearchableMultiCombobox({
  options,
  values,
  onValuesChange,
  placeholder = "Selecionar...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum resultado encontrado.",
  disabled = false,
  loading = false,
  className,
  contentClassName,
  onSearchChange,
  clientFilter = true,
  debounceMs = 300,
  maxHeight = "240px",
  maxSelected,
  align = "start",
  side,
}: SearchableMultiComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const selectedLabels = values
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean);

  const filteredOptions = React.useMemo(() => {
    if (!clientFilter || !search) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  }, [options, search, clientFilter]);

  const handleSearchChange = React.useCallback(
    (val: string) => {
      setSearch(val);
      if (onSearchChange) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          onSearchChange(val);
        }, debounceMs);
      }
    },
    [onSearchChange, debounceMs]
  );

  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      setSearch("");
      if (onSearchChange) onSearchChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const toggleValue = (val: string) => {
    if (values.includes(val)) {
      onValuesChange(values.filter((v) => v !== val));
    } else {
      if (maxSelected && values.length >= maxSelected) return;
      onValuesChange([...values, val]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-xl border border-border/60 bg-transparent px-3 py-2 text-[13px] ring-offset-background",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "hover:bg-accent/30 transition-colors",
            className
          )}
        >
          <span className={cn("truncate", selectedLabels.length === 0 && "text-muted-foreground")}>
            {selectedLabels.length > 0
              ? selectedLabels.length <= 2
                ? selectedLabels.join(", ")
                : `${selectedLabels.length} selecionados`
              : placeholder}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("p-0 w-[var(--radix-popover-trigger-width)]", contentClassName)}
        align={align}
        side={side}
        sideOffset={4}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
        </div>
        <div
          className="overflow-y-auto overflow-x-hidden scroll-py-1"
          style={{ maxHeight }}
        >
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {loading ? "Buscando..." : emptyText}
            </div>
          ) : (
            <div className="p-1">
              {filteredOptions.map((option) => {
                const isSelected = values.includes(option.value);
                const atMax = !isSelected && maxSelected ? values.length >= maxSelected : false;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled || atMax}
                    className={cn(
                      "relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none select-none",
                      "hover:bg-accent hover:text-accent-foreground transition-colors",
                      (option.disabled || atMax) && "pointer-events-none opacity-50",
                      isSelected && "bg-accent/50"
                    )}
                    onClick={() => toggleValue(option.value)}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isSelected ? "opacity-100 text-primary" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col items-start gap-0 min-w-0">
                      <span className="truncate text-[13px]">
                        {option.icon && <span className="mr-1.5 inline-flex">{option.icon}</span>}
                        {highlightMatch(option.label, search)}
                      </span>
                      {option.sublabel && (
                        <span className="text-[11px] text-muted-foreground truncate">
                          {highlightMatch(option.sublabel, search)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
