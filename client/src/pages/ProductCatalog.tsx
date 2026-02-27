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

/* ─── Types ─── */
interface CatalogProduct {
  id: number; tenantId: number; name: string; description: string | null;
  categoryId: number | null; productType: string; basePriceCents: number;
  costPriceCents: number | null; currency: string | null; supplier: string | null;
  destination: string | null; duration: string | null; imageUrl: string | null;
  sku: string | null; isActive: boolean | number; detailsJson: any;
  createdAt: string | Date; updatedAt: string | Date;
}
interface ProductCategory {
  id: number; tenantId: number; name: string; icon: string | null;
  color: string | null; parentId: number | null; sortOrder: number;
  createdAt: string | Date;
}

const PRODUCT_TYPES: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  flight: { label: "Aéreo", icon: Plane, color: "text-sky-400", bgColor: "bg-sky-500/15" },
  hotel: { label: "Hospedagem", icon: Hotel, color: "text-amber-400", bgColor: "bg-amber-500/15" },
  tour: { label: "Passeio", icon: Map, color: "text-emerald-400", bgColor: "bg-emerald-500/15" },
  transfer: { label: "Transfer", icon: Bus, color: "text-violet-400", bgColor: "bg-violet-500/15" },
  insurance: { label: "Seguro", icon: Shield, color: "text-rose-400", bgColor: "bg-rose-500/15" },
  cruise: { label: "Cruzeiro", icon: Ship, color: "text-cyan-400", bgColor: "bg-cyan-500/15" },
  visa: { label: "Visto", icon: Stamp, color: "text-orange-400", bgColor: "bg-orange-500/15" },
  package: { label: "Pacote", icon: Package, color: "text-indigo-400", bgColor: "bg-indigo-500/15" },
  other: { label: "Outro", icon: Box, color: "text-slate-400", bgColor: "bg-slate-500/15" },
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/* ─── Category Manager Dialog ─── */
function CategoryManagerDialog({
  open, onClose, tenantId,
}: { open: boolean; onClose: () => void; tenantId: number }) {
  const utils = trpc.useUtils();
  const categoriesQ = trpc.productCatalog.categories.list.useQuery({ tenantId });
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
                  createCat.mutate({ tenantId, name: newName.trim(), color: newColor });
                  setNewName("");
                }
              }}
            />
            <Button
              size="sm"
              disabled={!newName.trim() || createCat.isPending}
              onClick={() => {
                createCat.mutate({ tenantId, name: newName.trim(), color: newColor });
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
                      deleteCat.mutate({ tenantId, id: cat.id });
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
  open, onClose, tenantId, product, categories,
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
    productType: product?.productType || "other",
    categoryId: product?.categoryId ? String(product.categoryId) : "",
    basePriceCents: product?.basePriceCents ? String(product.basePriceCents / 100) : "",
    costPriceCents: product?.costPriceCents ? String(product.costPriceCents / 100) : "",
    supplier: product?.supplier || "",
    destination: product?.destination || "",
    duration: product?.duration || "",
    sku: product?.sku || "",
    isActive: product ? Boolean(product.isActive) : true,
  });

  const isEditing = !!product;
  const isPending = createProduct.isPending || updateProduct.isPending;

  function handleSubmit() {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    const data = {
      tenantId,
      name: form.name.trim(),
      description: form.description || undefined,
      productType: form.productType as any,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      basePriceCents: Math.round(Number(form.basePriceCents || 0) * 100),
      costPriceCents: form.costPriceCents ? Math.round(Number(form.costPriceCents) * 100) : undefined,
      supplier: form.supplier || undefined,
      destination: form.destination || undefined,
      duration: form.duration || undefined,
      sku: form.sku || undefined,
      isActive: form.isActive,
    };
    if (isEditing) {
      updateProduct.mutate({ ...data, id: product.id });
    } else {
      createProduct.mutate(data);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {isEditing ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name */}
          <div className="sm:col-span-2">
            <Label>Nome do Produto *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Pacote Paris 7 noites" />
          </div>
          {/* Description */}
          <div className="sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes do produto..." rows={3} />
          </div>
          {/* Type */}
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
          {/* Category */}
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
          {/* Base Price */}
          <div>
            <Label>Preço Base (R$)</Label>
            <Input type="number" step="0.01" min="0" value={form.basePriceCents} onChange={(e) => setForm({ ...form, basePriceCents: e.target.value })} placeholder="0,00" />
          </div>
          {/* Cost Price */}
          <div>
            <Label>Preço de Custo (R$)</Label>
            <Input type="number" step="0.01" min="0" value={form.costPriceCents} onChange={(e) => setForm({ ...form, costPriceCents: e.target.value })} placeholder="0,00" />
          </div>
          {/* Supplier */}
          <div>
            <Label>Fornecedor</Label>
            <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Nome do fornecedor" />
          </div>
          {/* Destination */}
          <div>
            <Label>Destino</Label>
            <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Ex: Paris, França" />
          </div>
          {/* Duration */}
          <div>
            <Label>Duração</Label>
            <Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="Ex: 7 noites" />
          </div>
          {/* SKU */}
          <div>
            <Label>SKU / Código</Label>
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Ex: PKG-PAR-001" />
          </div>
          {/* Active */}
          <div className="sm:col-span-2 flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium text-foreground">Produto Ativo</p>
              <p className="text-xs text-muted-foreground">Produtos inativos não aparecem na seleção de negociações</p>
            </div>
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
          </div>
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
        {product.destination && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{product.destination}</span>
          </div>
        )}
        {product.duration && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{product.duration}</span>
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
            {product.destination && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />{product.destination}
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
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const tenantId = 1;
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
  const productsQ = trpc.productCatalog.products.list.useQuery({
    tenantId,
    search: search || undefined,
    productType: filterType !== "all" ? filterType : undefined,
    categoryId: filterCategory !== "all" ? Number(filterCategory) : undefined,
    isActive: filterActive === "active" ? true : filterActive === "inactive" ? false : undefined,
  });
  const categoriesQ = trpc.productCatalog.categories.list.useQuery({ tenantId });
  const countQ = trpc.productCatalog.products.count.useQuery({ tenantId });

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
            {hasFilters ? "Tente ajustar os filtros de busca" : "Comece adicionando seus produtos turísticos"}
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
              onToggle={() => toggleProduct.mutate({ tenantId, id: product.id, isActive: !Boolean(product.isActive) })}
              onDelete={() => {
                if (confirm(`Excluir "${product.name}"?`)) {
                  deleteProduct.mutate({ tenantId, id: product.id });
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
                  onToggle={() => toggleProduct.mutate({ tenantId, id: product.id, isActive: !Boolean(product.isActive) })}
                  onDelete={() => {
                    if (confirm(`Excluir "${product.name}"?`)) {
                      deleteProduct.mutate({ tenantId, id: product.id });
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
