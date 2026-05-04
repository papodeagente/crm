/**
 * DealProductsDialog — Manage products/budget for a deal
 */
import { useState, useMemo, useRef, useEffect } from "react";
import { Package, X, Search, Loader2, Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const fmt$ = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

interface DealProductsDialogProps {
  open: boolean;
  onClose: () => void;
  dealId: number;
}

export default function DealProductsDialog({ open, onClose, dealId }: DealProductsDialogProps) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Quando o usuário clica num produto "por mL/g/etc", abre prompt inline
  // para ele informar a quantidade aplicada antes de adicionar ao orçamento.
  const [pendingPerUnit, setPendingPerUnit] = useState<{ product: any; qtyStr: string } | null>(null);

  const productsQ = trpc.crm.deals.products.list.useQuery({ dealId }, { enabled: !!dealId && open });
  const items = (productsQ.data || []) as any[];

  const catalogQ = trpc.productCatalog.products.list.useQuery(
    { isActive: true, search: search || undefined, limit: 50 },
    { enabled: open }
  );
  const catalog = useMemo(() => (catalogQ.data as any)?.items || catalogQ.data || [], [catalogQ.data]);

  const existingIds = new Set(items.map((p: any) => p.productId));
  const filteredCatalog = useMemo(
    () => (catalog as any[]).filter((p: any) => !existingIds.has(p.id)),
    [catalog, existingIds]
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.crm.deals.products.list.invalidate({ dealId });
    utils.crm.deals.get.invalidate({ id: dealId });
    utils.contactProfile.getDeals.invalidate();
    utils.contactProfile.getMetrics.invalidate();
  };

  const addMut = trpc.crm.deals.products.create.useMutation({
    onSuccess: () => { invalidate(); setSearch(""); setShowDropdown(false); toast.success("Produto adicionado"); },
    onError: (err: any) => toast.error(err.message || "Erro"),
  });
  const updateMut = trpc.crm.deals.products.update.useMutation({
    onSuccess: () => invalidate(),
    onError: (err: any) => toast.error(err.message || "Erro"),
  });
  const deleteMut = trpc.crm.deals.products.delete.useMutation({
    onSuccess: () => { invalidate(); toast.success("Produto removido"); },
    onError: (err: any) => toast.error(err.message || "Erro"),
  });

  const addProduct = (product: any) => {
    if (product.pricingMode === "per_unit") {
      // Abre o prompt para informar quantos mL/g aplicar — pré-preenche
      // com a quantidade padrão configurada no produto (se houver).
      const defaultQty = product.defaultQuantityPerUnit
        ? String(Number(product.defaultQuantityPerUnit))
        : "1";
      setPendingPerUnit({ product, qtyStr: defaultQty });
      return;
    }
    addMut.mutate({ dealId, productId: product.id, quantity: 1 });
  };

  const confirmPerUnitAdd = () => {
    if (!pendingPerUnit) return;
    const qty = Number(pendingPerUnit.qtyStr.replace(",", "."));
    if (!qty || qty <= 0) {
      toast.error(`Informe a quantidade em ${pendingPerUnit.product.unitOfMeasure || "unidades"}`);
      return;
    }
    addMut.mutate(
      { dealId, productId: pendingPerUnit.product.id, quantity: 1, quantityPerUnit: qty },
      { onSuccess: () => setPendingPerUnit(null) },
    );
  };

  const updateQty = (item: any, delta: number) => {
    if (item.pricingMode === "per_unit") return; // per_unit edita via input dedicado, não com +/-
    const newQty = Math.max(1, (item.quantity || 1) + delta);
    updateMut.mutate({ id: item.id, dealId, quantity: newQty });
  };

  // finalPriceCents já vem calculado do backend (per_unit ou fixed) — só somar.
  const totalCents = items.reduce((sum: number, p: any) => sum + (p.finalPriceCents || 0), 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-border/50" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <Package className="w-[18px] h-[18px] text-white" />
            </div>
            <h3 className="text-[16px] font-semibold text-foreground">Produtos da Negociação</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-4">
          {/* Search to add */}
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Buscar produto do catálogo..."
                className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </div>
            {showDropdown && filteredCatalog.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-popover text-popover-foreground border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredCatalog.map((p: any) => {
                  const isPerUnit = p.pricingMode === "per_unit" && p.pricePerUnitCents;
                  const priceLabel = isPerUnit
                    ? `${fmt$(p.pricePerUnitCents)}/${p.unitOfMeasure || "un"}`
                    : fmt$(p.basePriceCents || 0);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      disabled={addMut.isPending}
                      className="w-full px-3 py-2 text-left hover:bg-muted/60 transition-colors flex items-center gap-2 text-sm"
                    >
                      {p.imageUrl && (
                        <img src={p.imageUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                      )}
                      <span className="truncate font-medium flex-1 min-w-0">{p.name}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{priceLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {showDropdown && filteredCatalog.length === 0 && search && (
              <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-xl shadow-lg p-3 text-sm text-muted-foreground text-center">
                Nenhum produto encontrado
              </div>
            )}
          </div>

          {/* Prompt inline: produto vendido por unidade (mL/g) — pede a
              quantidade aplicada antes de adicionar ao orçamento. */}
          {pendingPerUnit && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
              <p className="text-[12.5px] font-semibold text-foreground">
                {pendingPerUnit.product.name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Cobrado por {pendingPerUnit.product.unitOfMeasure || "unidade"} a {fmt$(pendingPerUnit.product.pricePerUnitCents)}/{pendingPerUnit.product.unitOfMeasure || "un"}.
              </p>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-[11px] text-muted-foreground">
                    Quantidade aplicada ({pendingPerUnit.product.unitOfMeasure || "un"}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={pendingPerUnit.qtyStr}
                    autoFocus
                    onChange={(e) => setPendingPerUnit({ ...pendingPerUnit, qtyStr: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmPerUnitAdd(); }}
                    placeholder="Ex.: 0.5 ou 2"
                    className="mt-1 w-full px-2 py-1.5 text-[13px] border border-border rounded-md bg-background focus:outline-none focus:border-emerald-500/40"
                  />
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Total</p>
                  <p className="text-[14px] font-bold text-emerald-600">
                    {fmt$(Math.max(0, Math.round(Number(pendingPerUnit.qtyStr.replace(",", ".")) * (pendingPerUnit.product.pricePerUnitCents || 0))))}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingPerUnit(null)}
                  className="flex-1 px-3 py-1.5 text-[12px] rounded-md bg-background border border-border hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmPerUnitAdd}
                  disabled={addMut.isPending}
                  className="flex-1 px-3 py-1.5 text-[12px] rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {addMut.isPending ? "Adicionando…" : "Adicionar"}
                </button>
              </div>
            </div>
          )}

          {/* Product list */}
          {items.length === 0 ? (
            <div className="text-center py-6">
              <Package className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-[12px] text-muted-foreground">Nenhum produto adicionado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item: any) => {
                const isPerUnit = item.pricingMode === "per_unit";
                const qpu = isPerUnit ? Number(item.quantityPerUnit ?? 1) : null;
                const ppu = item.pricePerUnitCents || 0;
                const subtitle = isPerUnit
                  ? `${qpu}${item.unitOfMeasure || ""} × ${fmt$(ppu)}`
                  : `${fmt$(item.unitPriceCents || 0)} × ${item.quantity || 1}`;
                return (
                  <div key={item.id} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{item.productName || item.name}</p>
                      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
                    </div>
                    {!isPerUnit && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(item, -1)}
                          className="w-6 h-6 rounded-md bg-background border border-border flex items-center justify-center text-xs hover:bg-muted"
                        >−</button>
                        <span className="text-xs w-6 text-center font-medium">{item.quantity || 1}</span>
                        <button
                          onClick={() => updateQty(item, 1)}
                          className="w-6 h-6 rounded-md bg-background border border-border flex items-center justify-center text-xs hover:bg-muted"
                        >+</button>
                      </div>
                    )}
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                      {fmt$(item.finalPriceCents || 0)}
                    </span>
                    <button
                      onClick={() => deleteMut.mutate({ id: item.id, dealId, productName: item.productName || "" })}
                      className="p-0.5 hover:bg-destructive/10 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                );
              })}
              <div className="flex justify-end pt-1 border-t border-border/40">
                <span className="text-sm font-semibold text-foreground">
                  Total: {fmt$(totalCents)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors">Fechar</button>
        </div>
      </div>
    </div>
  );
}
