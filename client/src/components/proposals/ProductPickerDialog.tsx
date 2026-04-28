/**
 * ProductPickerDialog — escolhe produtos do catálogo para importar como linhas da proposta.
 *
 * Lista pesquisável com checkbox + qty editável. Botão "Adicionar selecionados"
 * chama proposals.items.addFromCatalog em batch.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Package } from "lucide-react";
import { toast } from "sonner";

interface Props {
  proposalId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ProductPickerDialog({ proposalId, open, onOpenChange, onImported }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<number, number>>({}); // productId -> qty
  const productsQ = trpc.productCatalog.products.list.useQuery(
    { isActive: true, limit: 200 } as any,
    { enabled: open }
  );
  const addMut = trpc.proposals.items.addFromCatalog.useMutation({
    onSuccess: (data: any) => {
      toast.success(`${data.added} ite${data.added === 1 ? "m" : "ns"} importado${data.added === 1 ? "" : "s"}`);
      setSelected({});
      onOpenChange(false);
      onImported?.();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao importar"),
  });

  const products = (productsQ.data as any[]) || [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p: any) =>
      String(p.name || "").toLowerCase().includes(q) ||
      String(p.sku || "").toLowerCase().includes(q) ||
      String(p.description || "").toLowerCase().includes(q)
    );
  }, [search, products]);

  const selectedCount = Object.keys(selected).length;
  const selectedTotal = Object.entries(selected).reduce((acc, [pid, qty]) => {
    const p = products.find((p: any) => p.id === Number(pid));
    return acc + (p ? Number(p.basePriceCents ?? 0) * qty : 0);
  }, 0);

  function toggle(productId: number, defaultQty = 1) {
    setSelected(prev => {
      if (prev[productId]) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: defaultQty };
    });
  }

  function setQty(productId: number, qty: number) {
    setSelected(prev => ({ ...prev, [productId]: Math.max(1, qty | 0) }));
  }

  function handleImport() {
    const list = Object.entries(selected).map(([pid, qty]) => ({ productId: Number(pid), qty }));
    if (list.length === 0) return;
    addMut.mutate({ proposalId, products: list });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar produtos do catálogo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, SKU ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="border rounded-lg max-h-[420px] overflow-y-auto">
            {productsQ.isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando catálogo…
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                {search ? "Nenhum produto encontrado." : "Catálogo vazio. Cadastre produtos em /products."}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left px-3 py-2 w-8"></th>
                    <th className="text-left px-3 py-2">Produto</th>
                    <th className="text-right px-3 py-2 w-24">Preço</th>
                    <th className="text-center px-3 py-2 w-20">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p: any) => {
                    const checked = !!selected[p.id];
                    const qty = selected[p.id] ?? 1;
                    return (
                      <tr key={p.id} className={`border-t hover:bg-accent/30 ${checked ? "bg-primary/5" : ""}`}>
                        <td className="px-3 py-2">
                          <Checkbox checked={checked} onCheckedChange={() => toggle(p.id)} />
                        </td>
                        <td className="px-3 py-2 cursor-pointer" onClick={() => toggle(p.id)}>
                          <p className="font-medium truncate">{p.name}</p>
                          {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{brl(Number(p.basePriceCents ?? 0))}</td>
                        <td className="px-3 py-2">
                          {checked && (
                            <Input
                              type="number" min={1}
                              value={qty}
                              onChange={(e) => setQty(p.id, parseInt(e.target.value || "1", 10))}
                              className="h-7 text-center text-xs w-16 mx-auto"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {selectedCount > 0 && (
            <div className="flex items-center justify-between text-sm rounded-lg bg-primary/10 border border-primary/30 px-3 py-2">
              <span className="text-muted-foreground">
                <strong className="text-foreground">{selectedCount}</strong> selecionado{selectedCount === 1 ? "" : "s"}
              </span>
              <span className="font-bold tabular-nums">{brl(selectedTotal)}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleImport} disabled={selectedCount === 0 || addMut.isPending}>
            {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Adicionar {selectedCount > 0 ? `(${selectedCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
