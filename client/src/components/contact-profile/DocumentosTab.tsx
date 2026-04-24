import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Upload, Loader2, Trash2, ExternalLink, Image, File, FileCheck } from "lucide-react";
import { toast } from "sonner";

interface DocumentosTabProps {
  contactId: number;
}

const CATEGORIES = [
  { value: "receita", label: "Receitas", icon: FileCheck },
  { value: "atestado", label: "Atestados", icon: FileText },
  { value: "imagem", label: "Imagens", icon: Image },
  { value: "contrato", label: "Contratos", icon: File },
  { value: "exame", label: "Exames", icon: FileText },
  { value: "consentimento", label: "Consentimento", icon: FileCheck },
  { value: "outro", label: "Outros", icon: File },
];

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentosTab({ contactId }: DocumentosTabProps) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ category: "outro" as string, title: "", description: "", fileUrl: "", fileName: "" });

  const documentsQ = trpc.clientDocuments.list.useQuery({
    contactId,
    category: activeCategory === "all" ? undefined : activeCategory,
  });

  const utils = trpc.useUtils();
  const createMut = trpc.clientDocuments.create.useMutation({
    onSuccess: () => {
      utils.clientDocuments.list.invalidate();
      setCreateOpen(false);
      setForm({ category: "outro", title: "", description: "", fileUrl: "", fileName: "" });
      toast.success("Documento adicionado");
    },
    onError: () => toast.error("Erro ao adicionar documento"),
  });

  const deleteMut = trpc.clientDocuments.delete.useMutation({
    onSuccess: () => {
      utils.clientDocuments.list.invalidate();
      toast.success("Documento removido");
    },
  });

  const documents = (documentsQ.data || []) as any[];

  function handleCreate() {
    if (!form.title || !form.fileUrl) return;
    createMut.mutate({
      contactId,
      category: form.category as any,
      title: form.title,
      description: form.description || undefined,
      fileUrl: form.fileUrl,
      fileName: form.fileName || form.title,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Documentos ({documents.length})</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#2E7D5B] hover:bg-[#256B4D] text-white h-8 text-xs">
              <Upload className="h-3.5 w-3.5 mr-1" /> Novo Documento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar Documento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Categoria *</label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Título *</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nome do documento" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Notas sobre o documento..." className="min-h-[60px]" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">URL do Arquivo *</label>
                <Input value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome do Arquivo</label>
                <Input value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} placeholder="documento.pdf" />
              </div>
              <Button onClick={handleCreate} disabled={createMut.isPending || !form.title || !form.fileUrl} className="w-full bg-[#2E7D5B] hover:bg-[#256B4D] text-white">
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant={activeCategory === "all" ? "default" : "outline"} className={`h-7 text-xs ${activeCategory === "all" ? "bg-[#2E7D5B] text-white" : ""}`}
          onClick={() => setActiveCategory("all")}>Todos</Button>
        {CATEGORIES.map((c) => (
          <Button key={c.value} size="sm" variant={activeCategory === c.value ? "default" : "outline"} className={`h-7 text-xs ${activeCategory === c.value ? "bg-[#2E7D5B] text-white" : ""}`}
            onClick={() => setActiveCategory(c.value)}>{c.label}</Button>
        ))}
      </div>

      {documentsQ.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#2E7D5B]" /></div>
      ) : documents.length === 0 ? (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="text-center py-12">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum documento encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map((doc: any) => {
            const cat = CATEGORIES.find((c) => c.value === doc.category);
            const CatIcon = cat?.icon || File;
            return (
              <Card key={doc.id} className="border-border/50 bg-card/80">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#2E7D5B]/10">
                      <CatIcon className="h-4 w-4 text-[#2E7D5B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{doc.title}</p>
                        <Badge variant="outline" className="text-[10px]">{cat?.label || doc.category}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(doc.createdAt)}</span>
                        {doc.sizeBytes && <span>• {formatSize(doc.sizeBytes)}</span>}
                        {doc.uploadedByName && <span>• {doc.uploadedByName}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={() => deleteMut.mutate({ id: doc.id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
