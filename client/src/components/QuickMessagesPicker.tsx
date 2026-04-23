import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BookOpen,
  Search,
  HandshakeIcon,
  RotateCcw,
  Share2,
  UserPlus,
  ShoppingCart,
  ShieldAlert,
  MoreHorizontal,
  ChevronRight,
  ArrowLeft,
  FileText,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ─── Variable definitions ─── */
export const MESSAGE_VARIABLES = [
  { key: "{nome}", label: "Nome completo", description: "Nome completo do cliente" },
  { key: "{primeiro_nome}", label: "Primeiro nome", description: "Primeiro nome do cliente" },
  { key: "{email}", label: "Email", description: "Email do cliente" },
  { key: "{telefone}", label: "Telefone", description: "Telefone do cliente" },
  { key: "{negociacao}", label: "Negociação", description: "Título da negociação" },
  { key: "{valor}", label: "Valor", description: "Valor da negociação (R$)" },
  { key: "{etapa}", label: "Etapa", description: "Etapa atual do funil" },
  { key: "{empresa}", label: "Empresa", description: "Nome da empresa vinculada" },
  { key: "{nome_oportunidade}", label: "Oportunidade", description: "Nome da oportunidade/deal" },
  { key: "{produto_principal}", label: "Produto principal", description: "Produto de maior valor na negociação" },
] as const;

export type MessageVariableKey = typeof MESSAGE_VARIABLES[number]["key"];

/** Context data for variable substitution */
export interface MessageContext {
  /** Contact/passenger data */
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  /** Deal data */
  dealId?: number | null;
  dealTitle?: string | null;
  dealValueCents?: number | null;
  dealStageName?: string | null;
  /** Company/account data */
  companyName?: string | null;
}

/** Substitute all variables in a message template using the provided context + products */
export function substituteVariables(
  content: string,
  ctx: MessageContext,
  products?: Array<{ name: string; unitPriceCents: number; quantity: number }>,
): string {
  const firstName = ctx.contactName?.split(" ")[0] || "";
  const fmtValue = ctx.dealValueCents != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ctx.dealValueCents / 100)
    : "";

  // Find the product with the highest total value (unitPrice * quantity)
  let mainProduct = "";
  if (products && products.length > 0) {
    const sorted = [...products].sort(
      (a, b) => (b.unitPriceCents * b.quantity) - (a.unitPriceCents * a.quantity),
    );
    mainProduct = sorted[0].name;
  }

  const replacements: Record<string, string> = {
    "{nome}": ctx.contactName || "",
    "{primeiro_nome}": firstName,
    "{email}": ctx.contactEmail || "",
    "{telefone}": ctx.contactPhone || "",
    "{negociacao}": ctx.dealTitle || "",
    "{valor}": fmtValue,
    "{etapa}": ctx.dealStageName || "",
    "{empresa}": ctx.companyName || "",
    "{nome_oportunidade}": ctx.dealTitle || "",
    "{produto_principal}": mainProduct,
  };

  let result = content;
  for (const [variable, value] of Object.entries(replacements)) {
    result = result.replaceAll(variable, value);
  }
  return result;
}

/* ─── Category definitions ─── */
const CATEGORIES = [
  { value: "primeiro_contato", label: "Primeiro contato", icon: HandshakeIcon, color: "text-blue-400" },
  { value: "reativacao", label: "Reativação", icon: RotateCcw, color: "text-amber-400" },
  { value: "pedir_indicacao", label: "Pedir indicação", icon: Share2, color: "text-green-400" },
  { value: "receber_indicado", label: "Receber indicado", icon: UserPlus, color: "text-purple-400" },
  { value: "recuperacao_vendas", label: "Recuperação", icon: ShoppingCart, color: "text-red-400" },
  { value: "objecoes", label: "Objeções", icon: ShieldAlert, color: "text-orange-400" },
  { value: "outros", label: "Outros", icon: MoreHorizontal, color: "text-gray-400" },
];

interface QuickMessagesPickerProps {
  onSelect: (content: string) => void;
  /** Render as icon-only button (default) or text button */
  variant?: "icon" | "text";
  /** Optional class name for the trigger button */
  className?: string;
  /** Side of the popover */
  side?: "top" | "bottom" | "left" | "right";
  /** Alignment of the popover */
  align?: "start" | "center" | "end";
  /** Context for variable substitution */
  context?: MessageContext;
}

export default function QuickMessagesPicker({
  onSelect,
  variant = "icon",
  className = "",
  side = "top",
  align = "start",
  context,
}: QuickMessagesPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: messages = [] } = trpc.customMessages.list.useQuery(undefined, {
    enabled: open,
    staleTime: 30_000,
  });

  // Fetch deal products when dealId is available (for {produto_principal})
  const dealId = context?.dealId;
  const { data: dealProducts } = trpc.crm.deals.products.list.useQuery(
    { dealId: dealId! },
    { enabled: open && !!dealId, staleTime: 60_000 },
  );

  const filtered = useMemo(() => {
    let list = messages as any[];
    if (selectedCategory) {
      list = list.filter((m) => m.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) => m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q),
      );
    }
    return list;
  }, [messages, selectedCategory, search]);

  // Group by category for the category view
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const msg of messages as any[]) {
      counts[msg.category] = (counts[msg.category] || 0) + 1;
    }
    return counts;
  }, [messages]);

  function handleSelect(content: string) {
    // Substitute variables if context is provided
    const products = (dealProducts as any[])?.map((p: any) => ({
      name: p.name,
      unitPriceCents: p.unitPriceCents || 0,
      quantity: p.quantity || 1,
    }));
    const substituted = context
      ? substituteVariables(content, context, products)
      : content;
    onSelect(substituted);
    setOpen(false);
    setSearch("");
    setSelectedCategory(null);
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setSearch("");
      setSelectedCategory(null);
    }
  }

  /** Preview a message content with variable substitution applied */
  function previewContent(content: string): string {
    if (!context) return content;
    const products = (dealProducts as any[])?.map((p: any) => ({
      name: p.name,
      unitPriceCents: p.unitPriceCents || 0,
      quantity: p.quantity || 1,
    }));
    return substituteVariables(content, context, products);
  }

  /** Check if content has variables */
  function hasVariables(content: string): boolean {
    return MESSAGE_VARIABLES.some((v) => content.includes(v.key));
  }

  const hasMessages = messages.length > 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            {variant === "icon" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`h-8 w-8 shrink-0 ${className}`}
              >
                <BookOpen className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`gap-1.5 ${className}`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Mensagens
              </Button>
            )}
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Mensagens personalizadas</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        side={side}
        align={align}
        className="w-80 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {!hasMessages ? (
          <div className="p-4 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-1">Nenhuma mensagem cadastrada</p>
            <p className="text-xs text-muted-foreground">
              Acesse Configurações &gt; Mensagens personalizadas para criar.
            </p>
          </div>
        ) : (
          <>
            {/* Search bar */}
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar mensagem..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>

            <ScrollArea className="max-h-72">
              {/* Category navigation or message list */}
              {!selectedCategory && !search.trim() ? (
                <div className="py-1">
                  <div className="px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Categorias
                    </span>
                  </div>
                  {CATEGORIES.filter((c) => categoryCounts[c.value]).map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.value}
                        onClick={() => setSelectedCategory(cat.value)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent/50 transition-colors text-left"
                      >
                        <Icon className={`h-4 w-4 ${cat.color} shrink-0`} />
                        <span className="text-sm flex-1">{cat.label}</span>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                          {categoryCounts[cat.value]}
                        </Badge>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-1">
                  {/* Back button when in category view */}
                  {selectedCategory && (
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 transition-colors text-left border-b border-border mb-1"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Voltar às categorias</span>
                    </button>
                  )}
                  {filtered.length === 0 ? (
                    <div className="px-3 py-4 text-center">
                      <p className="text-xs text-muted-foreground">Nenhuma mensagem encontrada</p>
                    </div>
                  ) : (
                    filtered.map((msg: any) => {
                      const hasVars = hasVariables(msg.content);
                      const preview = previewContent(msg.content);
                      return (
                        <button
                          key={msg.id}
                          onClick={() => handleSelect(msg.content)}
                          className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors group"
                        >
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors flex-1">
                              {msg.title}
                            </p>
                            {hasVars && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0 border-blue-500/30 text-blue-400">
                                variáveis
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {hasVars && context ? preview : msg.content}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
