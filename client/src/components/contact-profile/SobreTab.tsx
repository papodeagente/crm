import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  FileText, Plus, Loader2, Trash2, Calendar, Image, Mic, X
} from "lucide-react";
import { toast } from "sonner";

interface SobreTabProps {
  contact: any;
  contactId: number;
  metrics: { totalDeals: number; wonDeals: number; totalSpentCents: number; daysSinceLastPurchase: number | null };
}

type EvoType = "resumo" | "nota_pessoal" | "alerta" | "retorno";

const EVO_TYPES: { key: EvoType; label: string; color: string; bgColor: string }[] = [
  { key: "resumo", label: "Resumo", color: "text-white", bgColor: "bg-[#2E7D5B]" },
  { key: "nota_pessoal", label: "Nota Pessoal", color: "text-white", bgColor: "bg-[#2E7D5B]" },
  { key: "alerta", label: "Alerta", color: "text-white", bgColor: "bg-[#D97706]" },
  { key: "retorno", label: "Retorno", color: "text-white", bgColor: "bg-[#6366F1]" },
];

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

export default function SobreTab({ contact, contactId, metrics }: SobreTabProps) {
  const [selectedType, setSelectedType] = useState<EvoType>("resumo");
  const [content, setContent] = useState("");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [evoDate, setEvoDate] = useState(todayStr());
  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const evolutionsQ = trpc.evolutions.list.useQuery({ contactId });
  const usersQ = trpc.admin.users.list.useQuery();

  const createMut = trpc.evolutions.create.useMutation({
    onSuccess: () => {
      utils.evolutions.list.invalidate({ contactId });
      setContent("");
      setPhotos([]);
      toast.success("Evolução registrada");
    },
    onError: () => toast.error("Erro ao registrar evolução"),
  });

  const deleteMut = trpc.evolutions.delete.useMutation({
    onSuccess: () => {
      utils.evolutions.list.invalidate({ contactId });
      toast.success("Evolução removida");
    },
  });

  const evolutions = (evolutionsQ.data || []) as any[];
  const users = (usersQ.data || []) as any[];

  function handleCreate() {
    if (!content.trim()) {
      toast.error("Digite o conteúdo da evolução");
      return;
    }
    const typeLabel = EVO_TYPES.find(t => t.key === selectedType)?.label || "Resumo";
    createMut.mutate({
      contactId,
      title: `${typeLabel} — ${evoDate}`,
      content: content.trim(),
      professionalId: professionalId ? Number(professionalId) : undefined,
      photos: photos.length > 0 ? photos : undefined,
    });
  }

  function handleClear() {
    setContent("");
    setPhotos([]);
    setProfessionalId("");
    setEvoDate(todayStr());
    setSelectedType("resumo");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    if (photos.length + files.length > 5) {
      toast.error("Máximo de 5 imagens");
      return;
    }
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = () => {
        setPhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  }

  function getTypeBadge(title: string) {
    if (title.startsWith("Alerta")) return { label: "Alerta", color: "bg-amber-500/20 text-amber-500 border-amber-500/30" };
    if (title.startsWith("Retorno")) return { label: "Retorno", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" };
    if (title.startsWith("Nota Pessoal")) return { label: "Nota Pessoal", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    return { label: "Resumo", color: "bg-[#2E7D5B]/20 text-[#2E7D5B] border-[#2E7D5B]/30" };
  }

  return (
    <div className="space-y-6">
      {/* ═══ Adicionar Evolução ═══ */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Adicionar Evolução</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Type buttons */}
          <div className="flex flex-wrap gap-2">
            {EVO_TYPES.map(t => (
              <Button
                key={t.key}
                size="sm"
                variant={selectedType === t.key ? "default" : "outline"}
                onClick={() => setSelectedType(t.key)}
                className={
                  selectedType === t.key
                    ? `${t.bgColor} ${t.color} border-transparent h-8 text-xs font-medium`
                    : "h-8 text-xs font-medium"
                }
              >
                {t.label} {selectedType === t.key ? "✓" : ""}
              </Button>
            ))}
          </div>

          {/* Professional + Date row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Profissional</label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger className="bg-background/50 h-9">
                  <SelectValue placeholder="Selecionar profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data da Evolução</label>
              <input
                type="date"
                value={evoDate.split("-").reverse().join("-")}
                onChange={e => {
                  const parts = e.target.value.split("-");
                  setEvoDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
                }}
                className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Content textarea */}
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Digite a Evolução do Paciente aqui..."
            className="min-h-[140px] bg-background/50"
          />

          {/* Photos preview */}
          {photos.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {photos.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt={`Foto ${i + 1}`} className="h-16 w-16 object-cover rounded-lg border border-border/50" />
                  <button
                    onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-xs gap-1.5"
                disabled={photos.length >= 5}
              >
                <Image className="h-3.5 w-3.5" /> ANEXAR IMAGENS (MAX. 5)
              </Button>
              <Button size="sm" variant="ghost" onClick={handleClear} className="h-8 text-xs text-muted-foreground">
                LIMPAR
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground">
                <Mic className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={createMut.isPending || !content.trim()}
              className="h-8 text-xs bg-[#2E7D5B] hover:bg-[#256B4D] text-white px-4"
            >
              {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "ADICIONAR EVOLUÇÃO"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Evoluções List ═══ */}
      <div>
        <h3 className="text-base font-semibold mb-4">Evoluções</h3>

        {evolutionsQ.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#2E7D5B]" />
          </div>
        ) : evolutions.length === 0 ? (
          <Card className="border-border/50 bg-card/80">
            <CardContent className="text-center py-10">
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma evolução registrada para este paciente.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {evolutions.map((evo: any) => {
              const badge = getTypeBadge(evo.title);
              return (
                <Card key={evo.id} className="border-border/50 bg-card/80">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.color}`}>
                            {badge.label}
                          </span>
                          <p className="font-semibold text-sm">{evo.title}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(evo.createdAt)}</span>
                          {evo.professionalName && <span>• {evo.professionalName}</span>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-500"
                        onClick={() => deleteMut.mutate({ id: evo.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div
                      className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3"
                      dangerouslySetInnerHTML={{ __html: evo.content }}
                    />
                    {evo.photos && evo.photos.length > 0 && (
                      <div className="flex gap-2 pt-2">
                        {evo.photos.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt={`Foto ${i + 1}`} className="h-16 w-16 object-cover rounded-lg border border-border/50" />
                          </a>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
