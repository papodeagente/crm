/**
 * SidebarNotes — Notes list with inline creation
 */
import { useState } from "react";
import { Plus, Loader2, StickyNote } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function SidebarNotes({ contactId }: { contactId: number }) {
  const [showForm, setShowForm] = useState(false);
  const [body, setBody] = useState("");
  const [showAll, setShowAll] = useState(false);

  const notesQ = trpc.crm.notes.list.useQuery(
    { entityType: "contact", entityId: contactId },
    { enabled: !!contactId, staleTime: 60_000 }
  );
  const notes = (notesQ.data || []) as unknown as Array<{
    id: number; body: string; createdAt: string; authorName?: string;
  }>;

  const utils = trpc.useUtils();
  const createMut = trpc.crm.notes.create.useMutation({
    onSuccess: () => {
      utils.crm.notes.list.invalidate();
      setBody("");
      setShowForm(false);
      toast.success("Nota criada");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar nota"),
  });

  const handleCreate = () => {
    if (!body.trim()) return;
    createMut.mutate({
      entityType: "contact",
      entityId: contactId,
      body: body.trim(),
    });
  };

  const displayNotes = showAll ? notes : notes.slice(0, 5);

  return (
    <div className="px-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="sidebar-section-trigger !p-0">Notas ({notes.length})</span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-2 p-2 rounded-lg bg-accent/30 border border-border/50 space-y-2">
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escreva uma nota..."
            rows={3}
            className="w-full text-[13px] bg-background/50 border border-border/50 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <button
            onClick={handleCreate}
            disabled={!body.trim() || createMut.isPending}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {createMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Salvar nota"}
          </button>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 && !showForm ? (
        <div className="text-center py-3">
          <StickyNote className="w-6 h-6 text-muted-foreground/30 mx-auto mb-1" />
          <p className="text-[12px] text-muted-foreground">Nenhuma nota</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {displayNotes.map((note) => (
            <div key={note.id} className="p-2 rounded-lg bg-accent/20 border border-border/30">
              <p className="text-[12.5px] text-foreground line-clamp-3 whitespace-pre-wrap">{note.body}</p>
              <div className="flex items-center gap-2 mt-1">
                {note.authorName && (
                  <span className="text-[10px] text-muted-foreground">{note.authorName}</span>
                )}
                <span className="text-[10px] text-muted-foreground">{timeAgo(note.createdAt)}</span>
              </div>
            </div>
          ))}
          {notes.length > 5 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full text-[11px] text-primary font-medium hover:underline py-1"
            >
              Ver todas ({notes.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
