import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  MessageSquare,
  Search,
  HandshakeIcon,
  RotateCcw,
  Share2,
  UserPlus,
  ShoppingCart,
  ShieldAlert,
  MoreHorizontal,
} from "lucide-react";

const CATEGORIES = [
  { value: "primeiro_contato", label: "Primeiro contato", icon: HandshakeIcon, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "reativacao", label: "Reativação de contato", icon: RotateCcw, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "pedir_indicacao", label: "Pedir indicação", icon: Share2, color: "bg-green-500/10 text-green-400 border-green-500/20" },
  { value: "receber_indicado", label: "Receber indicado", icon: UserPlus, color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { value: "recuperacao_vendas", label: "Recuperação de vendas", icon: ShoppingCart, color: "bg-red-500/10 text-red-400 border-red-500/20" },
  { value: "objecoes", label: "Objeções", icon: ShieldAlert, color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { value: "outros", label: "Outros", icon: MoreHorizontal, color: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
];

function getCategoryMeta(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

export default function CustomMessagesPage() {
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", content: "", category: "primeiro_contato" });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: messages = [], isLoading } = trpc.customMessages.list.useQuery();
  const createMut = trpc.customMessages.create.useMutation({
    onSuccess: () => {
      utils.customMessages.list.invalidate();
      toast.success("Mensagem criada com sucesso!");
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.customMessages.update.useMutation({
    onSuccess: () => {
      utils.customMessages.list.invalidate();
      toast.success("Mensagem atualizada!");
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.customMessages.delete.useMutation({
    onSuccess: () => {
      utils.customMessages.list.invalidate();
      toast.success("Mensagem removida!");
      setDeleteConfirmId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ title: "", content: "", category: "primeiro_contato" });
  }

  function openCreate() {
    setEditingId(null);
    setForm({ title: "", content: "", category: filterCategory !== "all" ? filterCategory : "primeiro_contato" });
    setDialogOpen(true);
  }

  function openEdit(msg: any) {
    setEditingId(msg.id);
    setForm({ title: msg.title, content: msg.content, category: msg.category });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Preencha o título e o conteúdo.");
      return;
    }
    if (editingId) {
      updateMut.mutate({ id: editingId, ...form });
    } else {
      createMut.mutate(form);
    }
  }

  const filtered = useMemo(() => {
    let list = messages;
    if (filterCategory !== "all") {
      list = list.filter((m: any) => m.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m: any) =>
          m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q),
      );
    }
    return list;
  }, [messages, filterCategory, searchQuery]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const msg of filtered) {
      const cat = (msg as any).category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(msg);
    }
    return map;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/settings")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Mensagens Personalizadas
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Crie mensagens prontas organizadas por categoria para usar em qualquer conversa do WhatsApp
              </p>
            </div>
          </div>
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nova mensagem
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar mensagens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-1">Nenhuma mensagem encontrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {messages.length === 0
                  ? "Crie sua primeira mensagem personalizada para agilizar seus atendimentos."
                  : "Nenhuma mensagem corresponde aos filtros selecionados."}
              </p>
              {messages.length === 0 && (
                <Button onClick={openCreate} size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Criar primeira mensagem
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="py-6">
                  <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Messages grouped by category */}
        {!isLoading &&
          Array.from(grouped.entries()).map(([category, msgs]) => {
            const meta = getCategoryMeta(category);
            const Icon = meta.icon;
            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`${meta.color} gap-1.5 text-xs font-medium`}>
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {msgs.length} {msgs.length === 1 ? "mensagem" : "mensagens"}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {msgs.map((msg: any) => (
                    <Card
                      key={msg.id}
                      className="group hover:border-primary/30 transition-colors"
                    >
                      <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                        <CardTitle className="text-sm font-medium leading-snug pr-2">
                          {msg.title}
                        </CardTitle>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(msg)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(msg.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
                          {msg.content}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar mensagem" : "Nova mensagem personalizada"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Categoria</label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Título</label>
              <Input
                placeholder="Ex: Boas-vindas ao novo cliente"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Conteúdo da mensagem</label>
              <Textarea
                placeholder="Escreva o texto da mensagem que será enviada pelo WhatsApp..."
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={6}
                className="resize-none"
              />
              <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-[11px] font-medium text-muted-foreground mb-2">Variáveis disponíveis (clique para inserir):</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { var: "{nome}", desc: "Nome completo" },
                    { var: "{primeiro_nome}", desc: "Primeiro nome" },
                    { var: "{email}", desc: "Email" },
                    { var: "{telefone}", desc: "Telefone" },
                    { var: "{negociacao}", desc: "Título da negociação" },
                    { var: "{valor}", desc: "Valor da negociação" },
                    { var: "{etapa}", desc: "Etapa do funil" },
                    { var: "{empresa}", desc: "Empresa/Conta" },
                    { var: "{nome_oportunidade}", desc: "Nome da oportunidade" },
                    { var: "{produto_principal}", desc: "Produto de maior valor" },
                  ].map((v) => (
                    <button
                      key={v.var}
                      type="button"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-mono hover:bg-primary/20 transition-colors cursor-pointer"
                      title={v.desc}
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          content: f.content + v.var,
                        }));
                      }}
                    >
                      {v.var}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {createMut.isPending || updateMut.isPending
                ? "Salvando..."
                : editingId
                  ? "Salvar alterações"
                  : "Criar mensagem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir mensagem?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação não pode ser desfeita. A mensagem será removida permanentemente.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMut.mutate({ id: deleteConfirmId })}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
