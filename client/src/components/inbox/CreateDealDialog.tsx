import { useState, useEffect, useMemo, useRef } from "react"
import { trpc } from "@/lib/trpc"
import { Briefcase, X, Search, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useLocation } from "wouter"
import CustomFieldRenderer, { customFieldValuesToArray } from "@/components/CustomFieldRenderer"
import type { CustomFieldDef } from "@/components/CustomFieldRenderer"

interface CreateDealDialogProps {
  open: boolean;
  onClose: () => void;
  contactName: string;
  contactPhone: string;
  contactJid: string;
  sessionId: string;
}

function CreateDealDialog({
  open, onClose, contactName, contactPhone, contactJid, sessionId,
}: CreateDealDialogProps) {
  const [, navigate] = useLocation();
  const [title, setTitle] = useState(`Negociação - ${contactName}`);
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({});
  const [selectedProducts, setSelectedProducts] = useState<Array<{ productId: number; name: string; basePriceCents: number; quantity: number }>>([]);
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

  const createDeal = trpc.crm.deals.create.useMutation();
  const createContact = trpc.crm.contacts.create.useMutation();
  const contactsQ = trpc.crm.contacts.list.useQuery({ limit: 500 });
  const setFieldValues = trpc.contactProfile.setCustomFieldValues.useMutation();

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

  const totalCents = useMemo(() => selectedProducts.reduce((sum, p) => sum + p.basePriceCents * p.quantity, 0), [selectedProducts]);

  // Load custom fields for deals
  const dealCustomFields = trpc.customFields.list.useQuery(
    { entity: "deal" as const },
    { enabled: open }
  );
  const formFields = useMemo(() => {
    return ((dealCustomFields.data || []) as CustomFieldDef[]).filter(f => f.isVisibleOnForm);
  }, [dealCustomFields.data]);

  const handleCreate = async () => {
    if (!title.trim() || !selectedPipelineId || !selectedStageId) return;
    try {
      const cleaned = contactPhone.replace(/\D/g, "");
      const formatted = cleaned.startsWith("55") ? `+${cleaned}` : `+55${cleaned}`;
      const contacts = ((contactsQ.data as any)?.items || contactsQ.data || []) as any[];
      let contactId = contacts.find((c: any) => {
        const cPhone = c.phone?.replace(/\D/g, "") || "";
        return cPhone === cleaned || cPhone === cleaned.replace(/^55/, "") || `55${cPhone}` === cleaned;
      })?.id;

      if (!contactId) {
        const newContact = await createContact.mutateAsync({ name: contactName, phone: formatted,
        });
        contactId = (newContact as any).id;
      }

      const deal = await createDeal.mutateAsync({ title: title.trim(),
        pipelineId: selectedPipelineId, stageId: selectedStageId,
        contactId: contactId || undefined,
        products: selectedProducts.length > 0 ? selectedProducts.map(p => ({
          productId: p.productId,
          quantity: p.quantity,
        })) : undefined,
      });
      // Save custom field values for the deal
      const cfEntries = customFieldValuesToArray(customFieldValues).filter(v => v.value);
      if (cfEntries.length > 0 && (deal as any)?.id) {
        await setFieldValues.mutateAsync({ entityType: "deal",
          entityId: (deal as any).id,
          values: cfEntries,
        });
      }
      toast.success("Negociação criada com sucesso!");
      onClose();
      navigate(`/deal/${(deal as any).id}`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar negociação");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-border/50" onClick={(e) => e.stopPropagation()}>
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
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block font-medium">Título *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
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
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {((p.basePriceCents * p.quantity) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
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
          {/* Custom Fields */}
          {formFields.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-[13px] text-muted-foreground mb-2 font-medium">Campos Personalizados</p>
              <CustomFieldRenderer
                fields={formFields}
                values={customFieldValues}
                onChange={(fieldId, value) => setCustomFieldValues(prev => ({ ...prev, [fieldId]: value }))}
                mode="form"
                compact
              />
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
