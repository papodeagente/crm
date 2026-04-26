/**
 * NewsletterManager — Manage WhatsApp Channels/Newsletters via Z-API
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Trash2, Newspaper, Send, Edit3, X } from "lucide-react";
import { toast } from "sonner";

interface NewsletterManagerProps {
  sessionId: string;
}

export default function NewsletterManager({ sessionId }: NewsletterManagerProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const listQ = trpc.whatsapp.getNewsletterList.useQuery({ sessionId }, { retry: 1, staleTime: 60_000 });

  const createMut = trpc.whatsapp.createNewsletter.useMutation({
    onSuccess: () => { toast.success("Canal criado!"); listQ.refetch(); setShowCreate(false); setNewName(""); setNewDesc(""); },
    onError: (e) => toast.error(e.message || "Erro ao criar canal"),
  });
  const deleteMut = trpc.whatsapp.deleteNewsletter.useMutation({
    onSuccess: () => { toast.success("Canal excluído"); listQ.refetch(); },
    onError: (e) => toast.error(e.message || "Erro ao excluir"),
  });
  const updateMut = trpc.whatsapp.updateNewsletter.useMutation({
    onSuccess: () => { toast.success("Canal atualizado"); listQ.refetch(); setEditingId(null); },
    onError: (e) => toast.error(e.message || "Erro ao atualizar"),
  });

  const newsletters = (listQ.data as any[]) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Newspaper className="w-4 h-4" /> Canais WhatsApp</h3>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-wa-tint text-white rounded-lg hover:opacity-90">
          <Plus className="w-3.5 h-3.5" /> Novo Canal
        </button>
      </div>

      {showCreate && (
        <div className="border border-border rounded-lg p-3 space-y-2">
          <input type="text" placeholder="Nome do canal *" value={newName} onChange={e => setNewName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
          <textarea placeholder="Descrição (opcional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs rounded-lg hover:bg-muted">Cancelar</button>
            <button onClick={() => { if (newName.trim()) createMut.mutate({ sessionId, name: newName.trim(), description: newDesc.trim() || undefined }); }}
              disabled={!newName.trim() || createMut.isPending}
              className="px-3 py-1.5 text-xs bg-wa-tint text-white rounded-lg hover:opacity-90 disabled:opacity-50">
              {createMut.isPending ? "Criando..." : "Criar"}
            </button>
          </div>
        </div>
      )}

      {listQ.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando canais...</div>
      ) : newsletters.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum canal encontrado</p>
      ) : (
        <div className="space-y-2">
          {newsletters.map((nl: any) => (
            <div key={nl.id} className="border border-border rounded-lg p-3">
              {editingId === nl.id ? (
                <div className="space-y-2">
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
                    className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-wa-tint resize-none" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(null)} className="px-2 py-1 text-xs rounded hover:bg-muted">Cancelar</button>
                    <button onClick={() => updateMut.mutate({ sessionId, newsletterId: nl.id, name: editName.trim() || undefined, description: editDesc.trim() || undefined })}
                      disabled={updateMut.isPending}
                      className="px-2 py-1 text-xs bg-wa-tint text-white rounded hover:opacity-90 disabled:opacity-50">Salvar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{nl.name}</p>
                    {nl.description && <p className="text-xs text-muted-foreground mt-0.5">{nl.description}</p>}
                    {nl.subscribersCount != null && <p className="text-[11px] text-muted-foreground mt-1">{nl.subscribersCount} inscritos</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingId(nl.id); setEditName(nl.name || ""); setEditDesc(nl.description || ""); }}
                      className="p-1 hover:bg-muted rounded" title="Editar"><Edit3 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    <button onClick={() => { if (confirm(`Excluir canal "${nl.name}"?`)) deleteMut.mutate({ sessionId, newsletterId: nl.id }); }}
                      className="p-1 hover:bg-red-50 rounded" title="Excluir"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
