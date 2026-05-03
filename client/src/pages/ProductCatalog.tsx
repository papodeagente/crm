import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Plus, Pencil, Trash2, Search, Package,
  Plane, Hotel, Map, Bus, Shield, Ship, Stamp, Box, LayoutGrid, List,
  Filter, X, Eye, EyeOff, Loader2, Tag, MapPin, Clock, DollarSign,
  FolderOpen, MoreHorizontal, ChevronDown, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useTenantId } from "@/hooks/useTenantId";

/* ─── Types ─── */
interface CatalogProduct {
  id: number; tenantId: number; name: string; description: string | null;
  categoryId: number | null; productType: string; basePriceCents: number;
  costPriceCents: number | null; currency: string | null; supplier: string | null;
  location: string | null; durationMinutes: string | null; imageUrl: string | null;
  sku: string | null; isActive: boolean | number; detailsJson: any;
  createdAt: string | Date; updatedAt: string | Date;
}
interface ProductCategory {
  id: number; tenantId: number; name: string; icon: string | null;
  color: string | null; parentId: number | null; sortOrder: number;
  createdAt: string | Date;
}

const PRODUCT_TYPES: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  servico: { label: "Servico", icon: Package, color: "text-sky-400", bgColor: "bg-sky-500/15" },
  pacote: { label: "Pacote", icon: Package, color: "text-indigo-400", bgColor: "bg-indigo-500/15" },
  consulta: { label: "Consulta", icon: Map, color: "text-emerald-400", bgColor: "bg-emerald-500/15" },
  procedimento: { label: "Procedimento", icon: Shield, color: "text-rose-400", bgColor: "bg-rose-500/15" },
  assinatura: { label: "Assinatura", icon: Tag, color: "text-violet-400", bgColor: "bg-violet-500/15" },
  produto: { label: "Produto", icon: Box, color: "text-amber-400", bgColor: "bg-amber-500/15" },
  other: { label: "Outro", icon: Box, color: "text-slate-400", bgColor: "bg-slate-500/15" },
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/* ─── Category Manager Dialog ─── */
function CategoryManagerDialog({
  open, onClose, }: { open: boolean; onClose: () => void; tenantId: number }) {
  const utils = trpc.useUtils();
  const categoriesQ = trpc.productCatalog.categories.list.useQuery();
  const createCat = trpc.productCatalog.categories.create.useMutation({
    onSuccess: () => { utils.productCatalog.categories.list.invalidate(); toast.success("Categoria criada"); },
  });
  const deleteCat = trpc.productCatalog.categories.delete.useMutation({
    onSuccess: () => { utils.productCatalog.categories.list.invalidate(); toast.success("Categoria removida"); },
  });
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#8b5cf6");

  const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#f97316"];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Gerenciar Categorias
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Add new */}
          <div className="flex gap-2">
            <Input
              placeholder="Nome da categoria..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  createCat.mutate({ name: newName.trim(), color: newColor });
                  setNewName("");
                }
              }}
            />
            <Button
              size="sm"
              disabled={!newName.trim() || createCat.isPending}
              onClick={() => {
                createCat.mutate({ name: newName.trim(), color: newColor });
                setNewName("");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {/* Color picker */}
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`h-6 w-6 rounded-full border-2 transition-all ${newColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          {/* List */}
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {categoriesQ.data?.map((cat: ProductCategory) => (
              <div key={cat.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 group">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color || "#8b5cf6" }} />
                  <span className="text-sm font-medium text-foreground">{cat.name}</span>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Excluir categoria "${cat.name}"?`)) {
                      deleteCat.mutate({ id: cat.id });
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {categoriesQ.data?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria criada</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Product Form Dialog ─── */
function ProductFormDialog({
  open, onClose, product, categories,
}: {
  open: boolean; onClose: () => void; tenantId: number;
  product: CatalogProduct | null; categories: ProductCategory[];
}) {
  const utils = trpc.useUtils();
  const createProduct = trpc.productCatalog.products.create.useMutation({
    onSuccess: () => {
      utils.productCatalog.products.list.invalidate();
      toast.success("Produto criado com sucesso");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateProduct = trpc.productCatalog.products.update.useMutation({
    onSuccess: () => {
      utils.productCatalog.products.list.invalidate();
      toast.success("Produto atualizado");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    name: product?.name || "",
    description: product?.description || "",
    basePriceCents: product?.basePriceCents ? String(product.basePriceCents / 100) : "",
    costPriceCents: product?.costPriceCents ? String(product.costPriceCents / 100) : "",
    supplier: product?.supplier || "",
    // Treatment fields (estética)
    specialty: (product as any)?.specialty || "",
    contraindications: (product as any)?.contraindications || "",
    returnReminderDays: (product as any)?.returnReminderDays != null ? String((product as any).returnReminderDays) : "",
    complexity: (product as any)?.complexity || "",
    // Preserve existing values for edit mode (not shown in simplified create form)
    productType: product?.productType || "other",
    categoryId: product?.categoryId ? String(product.categoryId) : "",
    location: product?.location || "",
    durationMinutes: product?.durationMinutes || "",
    sku: product?.sku || "",
    isActive: product ? Boolean(product.isActive) : true,
    // Precificação por unidade (mL/g/etc) — produtos de estética vendidos por seringa
    pricingMode: ((product as any)?.pricingMode || "fixed") as "fixed" | "per_unit",
    unitOfMeasure: (product as any)?.unitOfMeasure || "mL",
    pricePerUnitCents: (product as any)?.pricePerUnitCents != null ? String((product as any).pricePerUnitCents / 100) : "",
    // Foto do produto (aparece no orçamento que vai pro cliente)
    imageUrl: (product as any)?.imageUrl || "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const uploadImageMut = trpc.productCatalog.products.uploadImage.useMutation();

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (JPG/PNG)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande — máximo 2 MB");
      return;
    }
    setUploadingImage(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const s = (r.result as string) || "";
          resolve(s.split(",")[1] || "");
        };
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await uploadImageMut.mutateAsync({
        fileName: file.name,
        fileBase64: base64,
        contentType: file.type,
      });
      setForm((f) => ({ ...f, imageUrl: res.url }));
      toast.success("Foto carregada");
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar foto");
    } finally {
      setUploadingImage(false);
    }
  };

  const isEditing = !!product;
  const isPending = createProduct.isPending || updateProduct.isPending;

  // Auto margin calculation
  const basePrice = Number(form.basePriceCents || 0);
  const costPrice = Number(form.costPriceCents || 0);
  const marginPercent = (basePrice > 0 && costPrice > 0) ? (((basePrice - costPrice) / costPrice) * 100) : null;

  function handleSubmit() {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (form.pricingMode === "per_unit" && (!form.pricePerUnitCents || Number(form.pricePerUnitCents) <= 0)) {
      toast.error("Informe o preço por " + (form.unitOfMeasure || "unidade"));
      return;
    }
    const data: any = {
      name: form.name.trim(),
      description: form.description || undefined,
      basePriceCents: Math.round(Number(form.basePriceCents || 0) * 100),
      costPriceCents: form.costPriceCents ? Math.round(Number(form.costPriceCents) * 100) : null,
      supplier: form.supplier || undefined,
      specialty: form.specialty.trim() || null,
      contraindications: form.contraindications.trim() || null,
      returnReminderDays: form.returnReminderDays ? Number(form.returnReminderDays) : null,
      complexity: form.complexity || null,
      pricingMode: form.pricingMode,
      unitOfMeasure: form.pricingMode === "per_unit" ? (form.unitOfMeasure || "mL") : null,
      pricePerUnitCents: form.pricingMode === "per_unit" && form.pricePerUnitCents
        ? Math.round(Number(form.pricePerUnitCents) * 100)
        : null,
      imageUrl: form.imageUrl || null,
    };
    if (isEditing) {
      // Preserve all existing fields on edit
      data.productType = form.productType as any;
      data.categoryId = form.categoryId ? Number(form.categoryId) : null;
      data.location = form.location || undefined;
      data.durationMinutes = form.durationMinutes ? Number(form.durationMinutes) : undefined;
      data.sku = form.sku || undefined;
      data.isActive = form.isActive;
      updateProduct.mutate({ ...data, id: product.id });
    } else {
      createProduct.mutate(data);
    }
  }

  // Opções pré-definidas para "Aviso de retorno"
  const RETURN_OPTIONS = [
    { value: "5", label: "5 dias" },
    { value: "15", label: "15 dias" },
    { value: "30", label: "1 mês" },
    { value: "60", label: "2 meses" },
    { value: "90", label: "3 meses" },
    { value: "120", label: "4 meses" },
    { value: "150", label: "5 meses" },
    { value: "180", label: "6 meses" },
    { value: "210", label: "7 meses" },
    { value: "240", label: "8 meses" },
    { value: "270", label: "9 meses" },
    { value: "300", label: "10 meses" },
    { value: "330", label: "11 meses" },
    { value: "365", label: "12 meses" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {isEditing ? "Editar Tratamento" : "Novo Tratamento"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Preencha as informações do procedimento ou serviço.</p>
        </DialogHeader>
        <div className="space-y-3">
          {/* Especialidade — campo livre */}
          <div>
            <Label>Especialidade</Label>
            <Input
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              placeholder="Ex: Estética facial, Harmonização, Tecnologia"
              maxLength={128}
              list="specialty-suggestions"
            />
            <datalist id="specialty-suggestions">
              <option value="Ativos" />
              <option value="Tecnologia" />
              <option value="Harmonização facial" />
              <option value="Estética facial" />
              <option value="Estética corporal" />
              <option value="Procedimentos injetáveis" />
              <option value="Skincare" />
              <option value="Outros" />
            </datalist>
          </div>
          {/* Nome */}
          <div>
            <Label>Nome do tratamento *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: SKINVIVE" autoFocus />
          </div>
          {/* Descrição */}
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes do procedimento" rows={2} />
          </div>
          {/* Contraindicações */}
          <div>
            <Label>Contraindicações</Label>
            <Textarea
              value={form.contraindications}
              onChange={(e) => setForm({ ...form, contraindications: e.target.value })}
              placeholder="Ex: gravidez, alergia a anestésico, isotretinoína em uso"
              rows={2}
            />
          </div>
          {/* Aviso de retorno */}
          <div>
            <Label>Aviso de retorno</Label>
            <Select value={form.returnReminderDays || "none"} onValueChange={(v) => setForm({ ...form, returnReminderDays: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Sem retorno automático" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem retorno automático</SelectItem>
                {RETURN_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">Tempo após a aplicação para a clínica enviar lembrete de retorno.</p>
          </div>
          {/* Complexidade + Custo + Valor */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Complexidade</Label>
              <Select value={form.complexity || "low"} onValueChange={(v) => setForm({ ...form, complexity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixo</SelectItem>
                  <SelectItem value="medium">Médio</SelectItem>
                  <SelectItem value="high">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Custo Estimado</Label>
              <Input type="number" step="0.01" min="0" value={form.costPriceCents} onChange={(e) => setForm({ ...form, costPriceCents: e.target.value })} placeholder="R$ 0,00" />
            </div>
            <div>
              <Label>{form.pricingMode === "per_unit" ? `Preço cheio (referência)` : "Valor/Preço"}</Label>
              <Input type="number" step="0.01" min="0" value={form.basePriceCents} onChange={(e) => setForm({ ...form, basePriceCents: e.target.value })} placeholder="R$ 0,00" />
            </div>
          </div>

          {/* Modo de precificação: fixo OU por mL/unidade. Para produtos de
              estética vendidos por seringa, usa-se "por mL" — o atendente
              informa quantos mL aplicou na hora de adicionar ao orçamento. */}
          <div className="rounded-lg border border-border/40 bg-muted/30 p-3 space-y-2">
            <div>
              <Label className="text-[12.5px] font-semibold">Como o produto é cobrado?</Label>
              <p className="text-[10.5px] text-muted-foreground">
                Use "por unidade" para seringas/cremes vendidos por mL ou g — o atendente informa a quantidade aplicada no orçamento.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, pricingMode: "fixed" })}
                className={`flex-1 px-3 py-2 rounded-md text-[12px] font-medium border transition-colors ${
                  form.pricingMode === "fixed"
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600"
                    : "bg-background border-border text-muted-foreground hover:border-border/60"
                }`}
              >
                Preço fixo
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, pricingMode: "per_unit" })}
                className={`flex-1 px-3 py-2 rounded-md text-[12px] font-medium border transition-colors ${
                  form.pricingMode === "per_unit"
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600"
                    : "bg-background border-border text-muted-foreground hover:border-border/60"
                }`}
              >
                Por unidade (mL/g/etc)
              </button>
            </div>
            {form.pricingMode === "per_unit" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <Label className="text-[11px]">Unidade</Label>
                  <Select value={form.unitOfMeasure || "mL"} onValueChange={(v) => setForm({ ...form, unitOfMeasure: v })}>
                    <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mL">mL (mililitro)</SelectItem>
                      <SelectItem value="g">g (grama)</SelectItem>
                      <SelectItem value="UI">UI (unidade internacional)</SelectItem>
                      <SelectItem value="sessão">sessão</SelectItem>
                      <SelectItem value="h">h (hora)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px]">Preço por {form.unitOfMeasure || "unidade"} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.pricePerUnitCents}
                    onChange={(e) => setForm({ ...form, pricePerUnitCents: e.target.value })}
                    placeholder="R$ 0,00"
                    className="h-9"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Foto do produto — aparece no orçamento enviado ao cliente */}
          <div className="rounded-lg border border-border/40 p-3 space-y-2">
            <div>
              <Label className="text-[12.5px] font-semibold">Foto do produto</Label>
              <p className="text-[10.5px] text-muted-foreground">
                Aparece no orçamento que o cliente recebe. JPG/PNG até 2 MB.
              </p>
            </div>
            <div className="flex items-start gap-3">
              {form.imageUrl ? (
                <div className="relative shrink-0">
                  <img src={form.imageUrl} alt="Produto" className="w-20 h-20 object-cover rounded-lg border border-border" />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, imageUrl: "" })}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center hover:bg-red-600"
                    aria-label="Remover foto"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground shrink-0">
                  <Package className="w-7 h-7 opacity-30" />
                </div>
              )}
              <div className="flex-1 flex flex-col gap-1.5">
                <input
                  type="file"
                  accept="image/*"
                  id="product-image-input"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageFile(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-[12px] w-full justify-start"
                  disabled={uploadingImage}
                  onClick={() => document.getElementById("product-image-input")?.click()}
                >
                  {uploadingImage ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Enviando…</>
                  ) : form.imageUrl ? "Trocar foto" : "Selecionar foto"}
                </Button>
                <p className="text-[10.5px] text-muted-foreground">
                  {uploadingImage ? "Salvando no servidor…" : "Recomendado: 800×800px"}
                </p>
              </div>
            </div>
          </div>
          {/* Margem auto-calculada */}
          {marginPercent !== null && (
            <div className={`text-xs px-3 py-1.5 rounded-md ${marginPercent >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              Margem: {marginPercent >= 0 ? '+' : ''}{marginPercent.toFixed(1)}%
              {basePrice > 0 && costPrice > 0 && (
                <span className="ml-2 text-muted-foreground">
                  (Lucro: R$ {(basePrice - costPrice).toFixed(2)})
                </span>
              )}
            </div>
          )}
          {/* Fornecedor (mantido em modo edit) */}
          {isEditing && (
            <div>
              <Label>Fornecedor</Label>
              <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Nome do fornecedor (opcional)" />
            </div>
          )}
          {/* Additional fields only in edit mode */}
          {isEditing && (
            <>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-3">Campos adicionais</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={form.productType} onValueChange={(v) => setForm({ ...form, productType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRODUCT_TYPES).map(([key, { label }]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem categoria</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Local</Label>
                    <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ex: Unidade Centro" />
                  </div>
                  <div>
                    <Label>Duração</Label>
                    <Input value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} placeholder="Ex: 30 minutos" />
                  </div>
                  <div>
                    <Label>SKU / Código</Label>
                    <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Ex: PKG-PAR-001" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">Produto Ativo</p>
                  <p className="text-xs text-muted-foreground">Produtos inativos não aparecem na seleção</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEditing ? "Salvar" : "Criar Produto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Product Card ─── */
function ProductCard({
  product, categories, onEdit, onToggle, onDelete,
}: {
  product: CatalogProduct; categories: ProductCategory[];
  onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const typeInfo = PRODUCT_TYPES[product.productType] || PRODUCT_TYPES.other;
  const TypeIcon = typeInfo.icon;
  const category = categories.find((c) => c.id === product.categoryId);
  const isActive = Boolean(product.isActive);
  const margin = product.costPriceCents
    ? ((product.basePriceCents - product.costPriceCents) / product.basePriceCents * 100).toFixed(0)
    : null;

  return (
    <div className={`group relative rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30 ${!isActive ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${typeInfo.bgColor}`}>
          <TypeIcon className={`h-4.5 w-4.5 ${typeInfo.color}`} />
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onToggle} className="p-1.5 rounded-md hover:bg-muted transition-colors" title={isActive ? "Desativar" : "Ativar"}>
            {isActive ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        </div>
      </div>

      {/* Name & Description */}
      <h3 className="text-sm font-semibold text-foreground mb-1 line-clamp-1">{product.name}</h3>
      {product.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{product.description}</p>
      )}

      {/* Meta info */}
      <div className="space-y-1.5 mb-3">
        {product.location && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{product.location}</span>
          </div>
        )}
        {product.durationMinutes && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{product.durationMinutes}</span>
          </div>
        )}
        {product.supplier && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span>{product.supplier}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${typeInfo.bgColor} ${typeInfo.color}`}>
          {typeInfo.label}
        </span>
        {category && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color || "#8b5cf6" }} />
            {category.name}
          </span>
        )}
        {!isActive && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-destructive/10 text-destructive">
            Inativo
          </span>
        )}
      </div>

      {/* Price */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div>
          <p className="text-lg font-bold text-foreground">{formatCurrency(product.basePriceCents)}</p>
          {product.costPriceCents != null && product.costPriceCents > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Custo: {formatCurrency(product.costPriceCents)}
              {margin && <span className="ml-1 text-emerald-500">({margin}% margem)</span>}
            </p>
          )}
        </div>
        {product.sku && (
          <span className="text-[11px] text-muted-foreground font-mono">{product.sku}</span>
        )}
      </div>
    </div>
  );
}

/* ─── Product Row (Table View) ─── */
function ProductRow({
  product, categories, onEdit, onToggle, onDelete,
}: {
  product: CatalogProduct; categories: ProductCategory[];
  onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const typeInfo = PRODUCT_TYPES[product.productType] || PRODUCT_TYPES.other;
  const TypeIcon = typeInfo.icon;
  const category = categories.find((c) => c.id === product.categoryId);
  const isActive = Boolean(product.isActive);

  return (
    <tr className={`group border-b border-border hover:bg-muted/30 transition-colors ${!isActive ? "opacity-60" : ""}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${typeInfo.bgColor}`}>
            <TypeIcon className={`h-4 w-4 ${typeInfo.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
            {product.location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />{product.location}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${typeInfo.bgColor} ${typeInfo.color}`}>
          {typeInfo.label}
        </span>
      </td>
      <td className="px-4 py-3">
        {category ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color || "#8b5cf6" }} />
            {category.name}
          </span>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-semibold text-foreground">{formatCurrency(product.basePriceCents)}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-muted-foreground">{product.supplier || "—"}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
          {isActive ? "Ativo" : "Inativo"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
          <button onClick={onToggle} className="p-1.5 rounded-md hover:bg-muted transition-colors" title={isActive ? "Desativar" : "Ativar"}>
            {isActive ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─── Main Page ─── */
export default function ProductCatalogPage() {
  const tenantId = useTenantId();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // State
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // Queries
  const productsQ = trpc.productCatalog.products.list.useQuery({ search: search || undefined,
    productType: filterType !== "all" ? filterType : undefined,
    categoryId: filterCategory !== "all" ? Number(filterCategory) : undefined,
    isActive: filterActive === "active" ? true : filterActive === "inactive" ? false : undefined,
  });
  const categoriesQ = trpc.productCatalog.categories.list.useQuery();
  const countQ = trpc.productCatalog.products.count.useQuery({});

  // Mutations
  const toggleProduct = trpc.productCatalog.products.update.useMutation({
    onSuccess: () => {
      utils.productCatalog.products.list.invalidate();
      toast.success("Status atualizado");
    },
  });
  const deleteProduct = trpc.productCatalog.products.delete.useMutation({
    onSuccess: () => {
      utils.productCatalog.products.list.invalidate();
      utils.productCatalog.products.count.invalidate();
      toast.success("Produto excluído");
    },
  });

  const products = (productsQ.data || []) as CatalogProduct[];
  const categories = (categoriesQ.data || []) as ProductCategory[];

  // Stats
  const activeCount = products.filter((p) => Boolean(p.isActive)).length;
  const totalValue = products.reduce((acc, p) => acc + p.basePriceCents, 0);

  const hasFilters = filterType !== "all" || filterCategory !== "all" || filterActive !== "all" || search.length > 0;

  return (
    <div className="page-content max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/settings")} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{
            background: "linear-gradient(135deg, oklch(0.55 0.25 270), oklch(0.60 0.25 320))"
          }}>
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Catálogo de Produtos</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {countQ.data ?? 0} produtos cadastrados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCategoryManager(true)}>
            <FolderOpen className="h-4 w-4 mr-1.5" />
            Categorias
          </Button>
          <Button size="sm" onClick={() => { setEditingProduct(null); setShowProductForm(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total de Produtos</p>
          <p className="text-2xl font-bold text-foreground">{countQ.data ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Ativos</p>
          <p className="text-2xl font-bold text-emerald-500">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Categorias</p>
          <p className="text-2xl font-bold text-violet-500">{categories.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Valor Total (Base)</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Type filter */}
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(PRODUCT_TYPES).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Category filter */}
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Status filter */}
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
        {/* Clear filters */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterType("all"); setFilterCategory("all"); setFilterActive("all"); }}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
        {/* View toggle */}
        <div className="flex items-center border border-border rounded-lg overflow-hidden ml-auto">
          <button
            className={`p-2 transition-colors ${viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            className={`p-2 transition-colors ${viewMode === "table" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
            onClick={() => setViewMode("table")}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {productsQ.isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            {hasFilters ? "Nenhum produto encontrado" : "Catálogo vazio"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {hasFilters ? "Tente ajustar os filtros de busca" : "Comece adicionando seus produtos e servicos"}
          </p>
          {!hasFilters && (
            <Button size="sm" onClick={() => { setEditingProduct(null); setShowProductForm(true); }}>
              <Plus className="h-4 w-4 mr-1.5" />
              Adicionar Produto
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categories={categories}
              onEdit={() => { setEditingProduct(product); setShowProductForm(true); }}
              onToggle={() => toggleProduct.mutate({ id: product.id, isActive: !Boolean(product.isActive) })}
              onDelete={() => {
                if (confirm(`Excluir "${product.name}"?`)) {
                  deleteProduct.mutate({ id: product.id });
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Produto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoria</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Preço</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fornecedor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  categories={categories}
                  onEdit={() => { setEditingProduct(product); setShowProductForm(true); }}
                  onToggle={() => toggleProduct.mutate({ id: product.id, isActive: !Boolean(product.isActive) })}
                  onDelete={() => {
                    if (confirm(`Excluir "${product.name}"?`)) {
                      deleteProduct.mutate({ id: product.id });
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialogs */}
      {showProductForm && (
        <ProductFormDialog
          open={showProductForm}
          onClose={() => { setShowProductForm(false); setEditingProduct(null); }}
          tenantId={tenantId}
          product={editingProduct}
          categories={categories}
        />
      )}
      <CategoryManagerDialog
        open={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        tenantId={tenantId}
      />
    </div>
  );
}
