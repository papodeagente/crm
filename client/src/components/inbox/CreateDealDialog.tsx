import { useState, useEffect, useMemo, useRef } from "react"
import { trpc } from "@/lib/trpc"
import { Briefcase, X, Search } from "lucide-react"
import { toast } from "sonner"
import { useLocation } from "wouter"

function PriceInput({ cents, onChange }: { cents: number; onChange: (cents: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  const displayValue = (cents / 100).toFixed(2).replace(".", ",");

  return (
    <div className="flex items-center gap-0.5">
      <span className="text-xs text-muted-foreground">R$</span>
      {editing ? (
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const parsed = Math.round(parseFloat(text.replace(",", ".") || "0") * 100);
            if (!isNaN(parsed) && parsed >= 0) onChange(parsed);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-20 px-1.5 py-0.5 text-xs text-right border border-primary rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
        />
      ) : (
        <button
          type="button"
          onClick={() => { setText(displayValue); setEditing(true); }}
          className="w-20 px-1.5 py-0.5 text-xs text-right border border-border rounded-md bg-background hover:border-primary/50 transition-colors cursor-text"
        >
          {displayValue}
        </button>
      )}
    </div>
  );
}

interface CreateDealDialogProps {
  open: boolean;
  onClose: () => void;
  contactName: string;
  contactPhone: string;
  contactJid: string;
  sessionId: string;
  contactId?: number;
  skipNavigation?: boolean;
}

function CreateDealDialog({
  open, onClose, contactName, contactPhone, contactJid, sessionId, contactId, skipNavigation,
}: CreateDealDialogProps) {
  const [, navigate] = useLocation();
  const [title, setTitle] = useState(`Negociação - ${contactName}`);
  const [docId, setDocId] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Array<{ productId: number; name: string; basePriceCents: number; unitPriceCents: number; quantity: number }>>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const pipelinesQ = trpc.crm.pipelines.list.useQuery({});
  const pipelines = (pipelinesQ.data || []) as any[];
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);

  const stagesQ = trpc.crm.pipelines.stages.useQuery(
    { pipelineId: selectedPipelineId! },
    { enabled: !!selectedPipelineId }
  );
  const stages = (stagesQ.data || []) as any[];
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);

  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) setSelectedPipelineId(pipelines[0].id);
  }, [pipelines, selectedPipelineId]);

  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) setSelectedStageId(stages[0].id);
  }, [stages, selectedStageId]);

  useEffect(() => {
    if (open) {
      setTitle(`Negociação - ${contactName}`);
      setSelectedProducts([]);
      setProductSearch("");
      setShowProductDropdown(false);
    }
  }, [open, contactName]);

  // Close product dropdown on outside click
  const productDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showProductDropdown) return;
    const handler = (e: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProductDropdown]);

  const utils = trpc.useUtils();
  const createDeal = trpc.crm.deals.create.useMutation();
  const createContact = trpc.crm.contacts.create.useMutation();
  const updateContact = trpc.crm.contacts.update.useMutation();
  const contactsQ = trpc.crm.contacts.list.useQuery({ limit: 500 });

  // Product catalog query
  const catalogQ = trpc.productCatalog.products.list.useQuery(
    { isActive: true, search: productSearch || undefined, limit: 50 },
    { enabled: open }
  );
  const catalogProducts = useMemo(() => (catalogQ.data as any)?.items || catalogQ.data || [], [catalogQ.data]);

  const filteredCatalog = useMemo(() => {
    const selectedIds = new Set(selectedProducts.map(p => p.productId));
    return (catalogProducts as any[]).filter((p: any) => !selectedIds.has(p.id));
  }, [catalogProducts, selectedProducts]);

  const addProduct = (product: any) => {
    setSelectedProducts(prev => [...prev, {
      productId: product.id,
      name: product.name,
      basePriceCents: product.basePriceCents || 0,
      unitPriceCents: product.basePriceCents || 0,
      quantity: 1,
    }]);
    setProductSearch("");
    setShowProductDropdown(false);
  };

  const removeProduct = (productId: number) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
  };

  const updateProductQty = (productId: number, qty: number) => {
    setSelectedProducts(prev => prev.map(p => p.productId === productId ? { ...p, quantity: Math.max(1, qty) } : p));
  };

  const totalCents = useMemo(() => selectedProducts.reduce((sum, p) => sum + p.unitPriceCents * p.quantity, 0), [selectedProducts]);

  const handleCreate = async () => {
    if (!title.trim() || !selectedPipelineId || !selectedStageId) return;
    try {
      // Use existing contact ID if provided (from inbox contact panel)
      let resolvedContactId = contactId;

      if (!resolvedContactId) {
        const cleaned = contactPhone.replace(/\D/g, "");
        const formatted = cleaned.startsWith("55") ? `+${cleaned}` : `+55${cleaned}`;
        const contactsList = ((contactsQ.data as any)?.items || contactsQ.data || []) as any[];

        // 1. Busca local (rápida)
        resolvedContactId = contactsList.find((c: any) => {
          const cPhone = c.phone?.replace(/\D/g, "") || "";
          return cPhone === cleaned || cPhone === cleaned.replace(/^55/, "") || `55${cPhone}` === cleaned;
        })?.id;

        // 2. Se não encontrou localmente, buscar no servidor por telefone
        if (!resolvedContactId) {
          const serverResults = await utils.crm.contacts.list.fetch({ search: cleaned, limit: 5 });
          const serverContacts = ((serverResults as any)?.items || serverResults || []) as any[];
          resolvedContactId = serverContacts.find((c: any) => {
            const cPhone = c.phone?.replace(/\D/g, "") || "";
            return cPhone === cleaned || cPhone === cleaned.replace(/^55/, "") || `55${cPhone}` === cleaned;
          })?.id;
        }

        // 3. Só cria contato novo se realmente não existe
        if (!resolvedContactId) {
          const docDigits = docId.replace(/\D/g, "");
          const newContact = await createContact.mutateAsync({
            name: contactName,
            phone: formatted,
            docId: docDigits || undefined,
          });
          resolvedContactId = (newContact as any).id;
        } else if (docId.replace(/\D/g, "")) {
          // Contato já existe — se usuário preencheu CPF/CNPJ aqui, salva no contato.
          try {
            await updateContact.mutateAsync({
              id: resolvedContactId,
              docId: docId.replace(/\D/g, ""),
            } as any);
          } catch { /* não bloqueia criação da deal */ }
        }
      } else if (docId.replace(/\D/g, "")) {
        // contactId veio por prop (inbox) — também atualiza CPF/CNPJ se preenchido.
        try {
          await updateContact.mutateAsync({
            id: resolvedContactId!,
            docId: docId.replace(/\D/g, ""),
          } as any);
        } catch { /* idem */ }
      }

      const deal = await createDeal.mutateAsync({ title: title.trim(),
        pipelineId: selectedPipelineId, stageId: selectedStageId,
        contactId: resolvedContactId || undefined,
        products: selectedProducts.length > 0 ? selectedProducts.map(p => ({
          productId: p.productId,
          quantity: p.quantity,
          unitPriceCents: p.unitPriceCents,
        })) : undefined,
      });
      // Invalidate sidebar queries so they update immediately
      utils.contactProfile.getDeals.invalidate();
      utils.contactProfile.getMetrics.invalidate();
      utils.crm.contacts.list.invalidate();
      toast.success("Negociação criada com sucesso!");
      onClose();
      if (!skipNavigation) {
        navigate(`/deal/${(deal as any).id}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar negociação");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-border/50 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <Briefcase className="w-[18px] h-[18px] text-white" />
            </div>
            <h3 className="text-[16px] font-semibold text-foreground">Nova Negociação</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Título *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
          </div>
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">
              CPF / CNPJ <span className="text-muted-foreground/70 font-normal">(opcional — facilita cobranças futuras)</span>
            </label>
            <input
              type="text"
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              inputMode="numeric"
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </div>
          {/* Product Selection */}
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Produtos</label>
            <div className="relative" ref={productDropdownRef}>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                    onFocus={() => setShowProductDropdown(true)}
                    placeholder="Buscar produto do catálogo..."
                    className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
              </div>
              {showProductDropdown && filteredCatalog.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-popover text-popover-foreground border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredCatalog.map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="w-full px-3 py-2 text-left hover:bg-muted/60 transition-colors flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {((p.basePriceCents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {showProductDropdown && filteredCatalog.length === 0 && productSearch && (
                <div className="absolute z-50 mt-1 w-full bg-popover text-popover-foreground border border-border rounded-xl shadow-lg p-3 text-sm text-muted-foreground text-center">
                  Nenhum produto encontrado
                </div>
              )}
            </div>
            {/* Selected products */}
            {selectedProducts.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {selectedProducts.map((p) => (
                  <div key={p.productId} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-1.5">
                    <span className="text-sm flex-1 truncate">{p.name}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateProductQty(p.productId, p.quantity - 1)}
                        className="w-6 h-6 rounded-md bg-background border border-border flex items-center justify-center text-xs hover:bg-muted transition-colors">−</button>
                      <span className="text-xs w-6 text-center font-medium">{p.quantity}</span>
                      <button type="button" onClick={() => updateProductQty(p.productId, p.quantity + 1)}
                        className="w-6 h-6 rounded-md bg-background border border-border flex items-center justify-center text-xs hover:bg-muted transition-colors">+</button>
                    </div>
                    <PriceInput
                      cents={p.unitPriceCents}
                      onChange={(cents) => setSelectedProducts(prev => prev.map(sp => sp.productId === p.productId ? { ...sp, unitPriceCents: cents } : sp))}
                    />
                    {p.quantity > 1 && (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        = {((p.unitPriceCents * p.quantity) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    )}
                    <button type="button" onClick={() => removeProduct(p.productId)}
                      className="p-0.5 hover:bg-destructive/10 rounded transition-colors">
                      <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-end pt-1">
                  <span className="text-sm font-semibold text-foreground">
                    Total: {(totalCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              </div>
            )}
          </div>
          {pipelines.length > 0 && (
            <div>
              <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Pipeline</label>
              <select value={selectedPipelineId || ""} onChange={(e) => { setSelectedPipelineId(Number(e.target.value)); setSelectedStageId(null); }}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary">
                {pipelines.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          {stages.length > 0 && (
            <div>
              <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Etapa</label>
              <select value={selectedStageId || ""} onChange={(e) => setSelectedStageId(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary">
                {stages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors">Cancelar</button>
          <button onClick={handleCreate} disabled={!title.trim() || !selectedStageId}
            className="px-4 py-2 text-sm text-white bg-primary hover:opacity-90 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2">
            Criar Negociação
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateDealDialog;
