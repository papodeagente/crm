/**
 * CustomFieldRenderer — Componente reutilizável para renderizar campos personalizados.
 * Usado em criação, edição e detalhe de Contatos, Negociações e Empresas.
 *
 * Suporta todos os tipos: text, number, date, select, multiselect, checkbox, textarea, email, phone, url, currency
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export type CustomFieldDef = {
  id: number;
  name: string;
  label: string;
  fieldType: string;
  optionsJson?: string[] | null;
  defaultValue?: string | null;
  placeholder?: string | null;
  isRequired?: boolean;
  isVisibleOnForm?: boolean;
  isVisibleOnProfile?: boolean;
  groupName?: string | null;
};

type Props = {
  fields: CustomFieldDef[];
  values: Record<number, string>;
  onChange: (fieldId: number, value: string) => void;
  /** "form" shows fields with isVisibleOnForm, "profile" shows all fields, "all" shows all */
  mode?: "form" | "profile" | "all";
  /** compact mode for sidebars */
  compact?: boolean;
  /** read-only mode */
  readOnly?: boolean;
};

export default function CustomFieldRenderer({ fields, values, onChange, mode = "form", compact = false, readOnly = false }: Props) {
  const visibleFields = fields.filter((f) => {
    if (mode === "all") return true;
    if (mode === "form") return f.isVisibleOnForm;
    if (mode === "profile") return true; // show all in profile/detail
    return true;
  });

  if (visibleFields.length === 0) return null;

  // Group fields by groupName
  const groups = new Map<string, CustomFieldDef[]>();
  for (const field of visibleFields) {
    const group = field.groupName || "";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(field);
  }

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {Array.from(groups.entries()).map(([groupName, groupFields]) => (
        <div key={groupName || "__default"} className="space-y-3">
          {groupName && (
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em]">
              {groupName}
            </p>
          )}
          {groupFields.map((field) => (
            <CustomFieldInput
              key={field.id}
              field={field}
              value={values[field.id] ?? ""}
              onChange={(val) => onChange(field.id, val)}
              compact={compact}
              readOnly={readOnly}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
  compact,
  readOnly,
}: {
  field: CustomFieldDef;
  value: string;
  onChange: (val: string) => void;
  compact?: boolean;
  readOnly?: boolean;
}) {
  const labelSize = compact ? "text-[11px]" : "text-[12px]";
  const inputHeight = compact ? "h-8" : "h-10";

  const options: string[] = Array.isArray(field.optionsJson)
    ? field.optionsJson
    : typeof field.optionsJson === "string"
      ? (() => { try { return JSON.parse(field.optionsJson); } catch { return []; } })()
      : [];

  switch (field.fieldType) {
    case "select":
      return (
        <div>
          <Label className={cn(labelSize, "font-medium")}>
            {field.label} {field.isRequired && <span className="text-destructive">*</span>}
          </Label>
          {readOnly ? (
            <p className="text-sm mt-1">{value || "—"}</p>
          ) : (
            <Select value={value || ""} onValueChange={onChange}>
              <SelectTrigger className={cn("mt-1.5 rounded-xl", inputHeight)}>
                <SelectValue placeholder={field.placeholder || "Selecionar"} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="__clear__">
                  <span className="text-muted-foreground">Limpar</span>
                </SelectItem>
                {options.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      );

    case "multiselect": {
      const selected: string[] = value ? value.split("|||").filter(Boolean) : [];
      const toggleOption = (opt: string) => {
        if (readOnly) return;
        const newSelected = selected.includes(opt)
          ? selected.filter((s) => s !== opt)
          : [...selected, opt];
        onChange(newSelected.join("|||"));
      };
      return (
        <div>
          <Label className={cn(labelSize, "font-medium")}>
            {field.label} {field.isRequired && <span className="text-destructive">*</span>}
          </Label>
          {readOnly ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {selected.length > 0 ? selected.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              )) : <span className="text-sm text-muted-foreground">—</span>}
            </div>
          ) : (
            <div className="mt-1.5 space-y-1">
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {selected.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs gap-1 pr-1">
                      {s}
                      <button onClick={() => toggleOption(s)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <Select
                value=""
                onValueChange={(val) => {
                  if (val && !selected.includes(val)) toggleOption(val);
                }}
              >
                <SelectTrigger className={cn("rounded-xl", inputHeight)}>
                  <SelectValue placeholder={field.placeholder || "Adicionar..."} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {options
                    .filter((opt) => !selected.includes(opt))
                    .map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      );
    }

    case "checkbox":
      return (
        <div>
          <Label className={cn(labelSize, "font-medium")}>
            {field.label} {field.isRequired && <span className="text-destructive">*</span>}
          </Label>
          <div className="mt-1.5 flex items-center gap-2">
            <Checkbox
              checked={value === "true"}
              onCheckedChange={(checked) => {
                if (!readOnly) onChange(String(!!checked));
              }}
              disabled={readOnly}
            />
            <span className="text-sm">{field.placeholder || "Sim"}</span>
          </div>
        </div>
      );

    case "textarea":
      return (
        <div>
          <Label className={cn(labelSize, "font-medium")}>
            {field.label} {field.isRequired && <span className="text-destructive">*</span>}
          </Label>
          {readOnly ? (
            <p className="text-sm mt-1 whitespace-pre-wrap">{value || "—"}</p>
          ) : (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || ""}
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              readOnly={readOnly}
            />
          )}
        </div>
      );

    case "number":
    case "currency":
      return (
        <div>
          <Label className={cn(labelSize, "font-medium")}>
            {field.label} {field.isRequired && <span className="text-destructive">*</span>}
          </Label>
          {readOnly ? (
            <p className="text-sm mt-1">
              {value ? (field.fieldType === "currency" ? `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : value) : "—"}
            </p>
          ) : (
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || ""}
              type="number"
              step={field.fieldType === "currency" ? "0.01" : "any"}
              className={cn("mt-1.5 rounded-xl", inputHeight)}
              readOnly={readOnly}
            />
          )}
        </div>
      );

    case "date":
      return (
        <div>
          <Label className={cn(labelSize, "font-medium")}>
            {field.label} {field.isRequired && <span className="text-destructive">*</span>}
          </Label>
          {readOnly ? (
            <p className="text-sm mt-1">
              {value ? new Date(value).toLocaleDateString("pt-BR") : "—"}
            </p>
          ) : (
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              type="date"
              className={cn("mt-1.5 rounded-xl", inputHeight)}
              readOnly={readOnly}
            />
          )}
        </div>
      );

    case "email":
      return (
        <div>
          <Label className={cn(labelSize, "font-medium")}>
            {field.label} {field.isRequired && <span className="text-destructive">*</span>}
          </Label>
          {readOnly ? (
            <p className="text-sm mt-1">{value || "—"}</p>
          ) : (
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || "email@exemplo.com"}
              type="email"
              className={cn("mt-1.5 rounded-xl", inputHeight)}
              readOnly={readOnly}
            />
          )}
        </div>
      );

    case "phone":
      return (
        <div>
          <Label className={cn(labelSize, "font-medium")}>
            {field.label} {field.isRequired && <span className="text-destructive">*</span>}
          </Label>
          {readOnly ? (
            <p className="text-sm mt-1">{value || "—"}</p>
          ) : (
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || "(00) 00000-0000"}
              type="tel"
              className={cn("mt-1.5 rounded-xl", inputHeight)}
              readOnly={readOnly}
            />
          )}
        </div>
      );

    case "url":
      return (
        <div>
          <Label className={cn(labelSize, "font-medium")}>
            {field.label} {field.isRequired && <span className="text-destructive">*</span>}
          </Label>
          {readOnly ? (
            <p className="text-sm mt-1">
              {value ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{value}</a> : "—"}
            </p>
          ) : (
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || "https://"}
              type="url"
              className={cn("mt-1.5 rounded-xl", inputHeight)}
              readOnly={readOnly}
            />
          )}
        </div>
      );

    default: // text
      return (
        <div>
          <Label className={cn(labelSize, "font-medium")}>
            {field.label} {field.isRequired && <span className="text-destructive">*</span>}
          </Label>
          {readOnly ? (
            <p className="text-sm mt-1">{value || "—"}</p>
          ) : (
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || ""}
              className={cn("mt-1.5 rounded-xl", inputHeight)}
              readOnly={readOnly}
            />
          )}
        </div>
      );
  }
}

/**
 * Hook helper to manage custom field values state
 */
export function useCustomFieldValues(initialValues?: Array<{ fieldId: number; value: string | null }>) {
  const map: Record<number, string> = {};
  if (initialValues) {
    for (const v of initialValues) {
      map[v.fieldId] = v.value || "";
    }
  }
  return map;
}

/**
 * Convert custom field values record to array for API submission
 */
export function customFieldValuesToArray(values: Record<number, string>): Array<{ fieldId: number; value: string | null }> {
  return Object.entries(values)
    .filter(([, v]) => v !== undefined)
    .map(([fid, val]) => ({
      fieldId: Number(fid),
      value: val.trim() || null,
    }));
}

/**
 * Initialize custom field values from API response
 */
export function initCustomFieldValues(
  fields: CustomFieldDef[],
  existingValues?: Array<{ fieldId: number; value: string | null }>
): Record<number, string> {
  const map: Record<number, string> = {};
  for (const f of fields) {
    map[f.id] = f.defaultValue || "";
  }
  if (existingValues) {
    for (const v of existingValues) {
      map[v.fieldId] = v.value || "";
    }
  }
  return map;
}
