/**
 * ProposalEditor — editor visual de propostas (tabela inline + sidebar).
 *
 * Layout: header sticky · centro (tabela editável) · sidebar direita (validade, notas, totais).
 * Auto-save com debounce; indicação visual de "salvando..."/"salvo".
 */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Plus, Trash2, GripVertical, Eye, Send, Download,
  Loader2, Package, Copy, MessageCircle, CheckCircle2, FileText, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import ProductPickerDialog from "@/components/proposals/ProductPickerDialog";

interface Item {
  id: number;
  title: string;
  description: string | null;
  qty: number;
  unit: string | null;
  unitPriceCents: number;
  discountCents: number;
  totalCents: number;
  orderIndex: number;
}

function brl(cents: number | string | null | undefined, currency = "BRL") {
  return (Number(cents) / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function fmtDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

function statusLabel(s: string) {
  switch (s) {
    case "draft": return { label: "Rascunho", cls: "bg-slate-100 text-slate-700 border-slate-300" };
    case "sent": return { label: "Enviada", cls: "bg-blue-100 text-blue-700 border-blue-300" };
    case "viewed": return { label: "Visualizada", cls: "bg-violet-100 text-violet-700 border-violet-300" };
    case "accepted": return { label: "Aceita ✓", cls: "bg-emerald-100 text-emerald-700 border-emerald-300" };
    case "rejected": return { label: "Recusada", cls: "bg-red-100 text-red-700 border-red-300" };
    case "expired": return { label: "Vencida", cls: "bg-amber-100 text-amber-700 border-amber-300" };
    default: return { label: s, cls: "bg-slate-100" };
  }
}

export default function ProposalEditor() {
  const [, params] = useRoute("/proposals/:id");
  const proposalId = params?.id ? Number(params.id) : null;
  const [, navigate] = useLocation();

  const proposalQ = trpc.proposals.get.useQuery({ id: proposalId! }, { enabled: !!proposalId });
  const itemsQ = trpc.proposals.items.list.useQuery({ proposalId: proposalId! }, { enabled: !!proposalId });
  const utils = trpc.useUtils();

  const proposal = proposalQ.data as any;
  const items = (itemsQ.data || []) as Item[];

  const dealQ = trpc.crm.deals.get.useQuery(
    { id: proposal?.dealId ?? 0 },
    { enabled: !!proposal?.dealId }
  );
  const deal = dealQ.data as any;
  const contactQ = trpc.crm.contacts.get.useQuery(
    { id: deal?.contactId ?? 0 },
    { enabled: !!deal?.contactId }
  );
  const contact = contactQ.data as any;

  // Local sidebar state (auto-save with debounce)
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [discountCents, setDiscountCents] = useState(0);
  const [taxCents, setTaxCents] = useState(0);
  const initFromServerRef = useRef(false);

  useEffect(() => {
    if (!proposal || initFromServerRef.current) return;
    setValidUntil(fmtDateInput(proposal.validUntil));
    setNotes(proposal.notes || "");
    setDiscountCents(Number(proposal.discountCents ?? 0));
    setTaxCents(Number(proposal.taxCents ?? 0));
    initFromServerRef.current = true;
  }, [proposal]);

  const updateProposalMut = trpc.proposals.update.useMutation({
    onSuccess: () => { utils.proposals.get.invalidate({ id: proposalId! }); },
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!proposalId) return;
      updateProposalMut.mutate({
        id: proposalId,
        notes: notes || null,
        validUntil: validUntil || null,
        discountCents,
        taxCents,
      });
    }, 700);
  }, [proposalId, notes, validUntil, discountCents, taxCents, updateProposalMut]);

  // Items mutations
  const addItemMut = trpc.proposals.items.create.useMutation({
    onSuccess: () => { utils.proposals.items.list.invalidate({ proposalId: proposalId! }); utils.proposals.get.invalidate({ id: proposalId! }); },
  });
  const updateItemMut = trpc.proposals.items.update.useMutation({
    onSuccess: () => { utils.proposals.items.list.invalidate({ proposalId: proposalId! }); utils.proposals.get.invalidate({ id: proposalId! }); },
  });
  const deleteItemMut = trpc.proposals.items.delete.useMutation({
    onSuccess: () => { utils.proposals.items.list.invalidate({ proposalId: proposalId! }); utils.proposals.get.invalidate({ id: proposalId! }); },
  });
  const reorderItemsMut = trpc.proposals.items.reorder.useMutation({
    onSuccess: () => { utils.proposals.items.list.invalidate({ proposalId: proposalId! }); },
  });
  const publishMut = trpc.proposals.publish.useMutation({
    onSuccess: (data: any) => {
      utils.proposals.get.invalidate({ id: proposalId! });
      const url = `${window.location.origin}/p/${data.publicToken}`;
      navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Proposta publicada · Link copiado");
      setShowPublishDialog(true);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const sendWaMut = trpc.proposals.sendWhatsApp.useMutation({
    onSuccess: () => toast.success("Proposta enviada por WhatsApp ✓"),
    onError: (e: any) => toast.error(e.message),
  });

  const [showPicker, setShowPicker] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  // Drag-drop reorder
  const [draggedId, setDraggedId] = useState<number | null>(null);
  function handleDragStart(id: number) { setDraggedId(id); }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(targetId: number) {
    if (!draggedId || draggedId === targetId) return;
    const ids = items.map(i => i.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...ids];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, draggedId);
    setDraggedId(null);
    if (proposalId) reorderItemsMut.mutate({ proposalId, ids: reordered });
  }

  const subtotalCents = items.reduce((acc, i) => acc + Number(i.totalCents ?? 0), 0);
  const totalCents = Math.max(0, subtotalCents - discountCents + taxCents);

  if (!proposalId || proposalQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <p className="text-muted-foreground">Proposta não encontrada.</p>
        <Link href="/proposals"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button></Link>
      </div>
    );
  }

  const isReadOnly = proposal.status !== "draft";
  const status = statusLabel(proposal.status);

  async function handleDownloadPdf() {
    try {
      const r = await utils.proposals.getPdfBase64.fetch({ id: proposalId! });
      const blob = b64ToBlob(r.base64, "application/pdf");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = r.fileName; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar PDF");
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* ── Header sticky ── */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
        <Link href="/proposals">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Propostas
          </Button>
        </Link>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">Proposta #{proposal.id}</h1>
            <Badge variant="outline" className={`text-[11px] ${status.cls}`}>{status.label}</Badge>
            {updateProposalMut.isPending && (
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
              </span>
            )}
          </div>
          {(deal?.title || contact?.name) && (
            <p className="text-xs text-muted-foreground">
              {deal?.title} {contact?.name ? `· ${contact.name}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-2">
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          {!isReadOnly && (
            <Button
              size="sm"
              onClick={() => publishMut.mutate({ id: proposalId! })}
              disabled={publishMut.isPending || items.length === 0}
              className="gap-2"
            >
              {publishMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Publicar
            </Button>
          )}
          {proposal.publicToken && (
            <Button
              size="sm" variant="outline"
              onClick={() => sendWaMut.mutate({ id: proposalId! })}
              disabled={sendWaMut.isPending}
              className="gap-2"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

          {/* ── Centro: tabela de items ── */}
          <div className="space-y-4">
            {/* Cabeçalho da seção */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Itens da proposta</h2>
                <p className="text-xs text-muted-foreground/70">Adicione manualmente ou importe do catálogo</p>
              </div>
              {!isReadOnly && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowPicker(true)} className="gap-1.5">
                    <Package className="h-3.5 w-3.5" /> Importar do catálogo
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => addItemMut.mutate({
                      proposalId: proposalId!, title: "Novo item", qty: 1, unitPriceCents: 0, discountCents: 0,
                    })}
                    className="gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar linha
                  </Button>
                </div>
              )}
            </div>

            {/* Tabela */}
            <div className="border rounded-xl overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="w-8"></th>
                    <th className="text-left px-3 py-2">Item / Descrição</th>
                    <th className="text-center px-2 py-2 w-16">Qtd</th>
                    <th className="text-center px-2 py-2 w-16">Unid.</th>
                    <th className="text-right px-2 py-2 w-28">Preço un.</th>
                    <th className="text-right px-2 py-2 w-24">Desc.</th>
                    <th className="text-right px-3 py-2 w-28">Total</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        Nenhum item ainda. Adicione manualmente ou importe do catálogo.
                      </td>
                    </tr>
                  ) : items.map((item) => (
                    <tr
                      key={item.id}
                      draggable={!isReadOnly}
                      onDragStart={() => handleDragStart(item.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(item.id)}
                      className={`border-t hover:bg-accent/20 ${draggedId === item.id ? "opacity-50" : ""}`}
                    >
                      <td className="px-1 text-center cursor-grab text-muted-foreground/40">
                        {!isReadOnly && <GripVertical className="h-4 w-4" />}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Input
                          value={item.title}
                          onChange={(e) => updateItemMut.mutate({ id: item.id, proposalId: proposalId!, title: e.target.value })}
                          placeholder="Descrição do item"
                          disabled={isReadOnly}
                          className="h-7 text-sm border-0 px-1 focus-visible:ring-1"
                        />
                        <Textarea
                          rows={1}
                          value={item.description ?? ""}
                          onChange={(e) => updateItemMut.mutate({ id: item.id, proposalId: proposalId!, description: e.target.value || null })}
                          placeholder="Detalhes (opcional)"
                          disabled={isReadOnly}
                          className="text-xs text-muted-foreground border-0 px-1 mt-0.5 min-h-[18px] resize-none focus-visible:ring-1"
                        />
                      </td>
                      <td className="px-1 align-top">
                        <Input
                          type="number" min={1}
                          value={item.qty}
                          onChange={(e) => updateItemMut.mutate({ id: item.id, proposalId: proposalId!, qty: parseInt(e.target.value || "1", 10) })}
                          disabled={isReadOnly}
                          className="h-7 text-center text-xs border-0 focus-visible:ring-1"
                        />
                      </td>
                      <td className="px-1 align-top">
                        <Input
                          value={item.unit ?? ""}
                          onChange={(e) => updateItemMut.mutate({ id: item.id, proposalId: proposalId!, unit: e.target.value || null })}
                          placeholder="un"
                          maxLength={16}
                          disabled={isReadOnly}
                          className="h-7 text-center text-xs border-0 focus-visible:ring-1"
                        />
                      </td>
                      <td className="px-1 align-top">
                        <Input
                          type="number" min={0} step="0.01"
                          value={(item.unitPriceCents / 100).toFixed(2)}
                          onChange={(e) => updateItemMut.mutate({
                            id: item.id, proposalId: proposalId!,
                            unitPriceCents: Math.round((parseFloat(e.target.value || "0")) * 100),
                          })}
                          disabled={isReadOnly}
                          className="h-7 text-right text-xs border-0 tabular-nums focus-visible:ring-1"
                        />
                      </td>
                      <td className="px-1 align-top">
                        <Input
                          type="number" min={0} step="0.01"
                          value={(item.discountCents / 100).toFixed(2)}
                          onChange={(e) => updateItemMut.mutate({
                            id: item.id, proposalId: proposalId!,
                            discountCents: Math.round(parseFloat(e.target.value || "0") * 100),
                          })}
                          disabled={isReadOnly}
                          className="h-7 text-right text-xs border-0 tabular-nums focus-visible:ring-1"
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold align-top">
                        {brl(item.totalCents)}
                      </td>
                      <td className="px-1 text-center align-top">
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => deleteItemMut.mutate({ id: item.id, proposalId: proposalId! })}
                            className="p-1 hover:text-red-600 text-muted-foreground/40"
                            title="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notas */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Observações (aparecem no PDF)</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => { setNotes(e.target.value); queueSave(); }}
                placeholder="Condições, garantias, prazos de execução..."
                disabled={isReadOnly}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* ── Sidebar direita: validade + totais ── */}
          <aside className="space-y-4">
            <div className="border rounded-xl p-4 bg-card">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Detalhes</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Validade</Label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => { setValidUntil(e.target.value); queueSave(); }}
                    disabled={isReadOnly}
                    className="mt-1 h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="border rounded-xl p-4 bg-card">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Totais</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{brl(subtotalCents)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">Desconto</span>
                  <Input
                    type="number" min={0} step="0.01"
                    value={(discountCents / 100).toFixed(2)}
                    onChange={(e) => { setDiscountCents(Math.round(parseFloat(e.target.value || "0") * 100)); queueSave(); }}
                    disabled={isReadOnly}
                    className="h-7 text-right text-xs w-28 tabular-nums"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">Imposto / taxa</span>
                  <Input
                    type="number" min={0} step="0.01"
                    value={(taxCents / 100).toFixed(2)}
                    onChange={(e) => { setTaxCents(Math.round(parseFloat(e.target.value || "0") * 100)); queueSave(); }}
                    disabled={isReadOnly}
                    className="h-7 text-right text-xs w-28 tabular-nums"
                  />
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between items-center">
                  <span className="font-bold">Total</span>
                  <span className="text-lg font-bold tabular-nums text-primary">{brl(totalCents)}</span>
                </div>
              </div>
            </div>

            {proposal.publicToken && (
              <div className="border rounded-xl p-4 bg-primary/5 border-primary/30">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> Link público
                </h3>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/p/${proposal.publicToken}`}
                    className="text-xs font-mono h-8"
                  />
                  <Button
                    size="sm" variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/p/${proposal.publicToken}`);
                      toast.success("Link copiado");
                    }}
                    className="shrink-0 h-8 px-2"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {proposal.asaasPaymentId && (
              <div className="border rounded-xl p-4 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/50">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" /> Cobrança Asaas
                </h3>
                <p className="text-xs text-muted-foreground">Status: <strong>{proposal.asaasPaymentStatus || "—"}</strong></p>
                {proposal.asaasInvoiceUrl && (
                  <a href={proposal.asaasInvoiceUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline mt-1 inline-block">
                    Ver fatura Asaas →
                  </a>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Picker de produtos */}
      {proposalId && (
        <ProductPickerDialog
          proposalId={proposalId}
          open={showPicker}
          onOpenChange={setShowPicker}
          onImported={() => { utils.proposals.items.list.invalidate({ proposalId: proposalId! }); utils.proposals.get.invalidate({ id: proposalId! }); }}
        />
      )}

      {/* Publish dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proposta publicada 🎉</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Compartilhe o link abaixo com o cliente. Ele pode visualizar e aceitar online.</p>
            {proposal.publicToken && (
              <div className="flex gap-2">
                <Input readOnly value={`${window.location.origin}/p/${proposal.publicToken}`} className="text-xs font-mono" />
                <Button
                  size="sm" variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/p/${proposal.publicToken}`);
                    toast.success("Link copiado");
                  }}
                ><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            )}
            <Button
              className="w-full gap-2"
              onClick={() => sendWaMut.mutate({ id: proposalId! })}
              disabled={sendWaMut.isPending}
            >
              <MessageCircle className="h-4 w-4" /> Enviar PDF e link pelo WhatsApp
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowPublishDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function b64ToBlob(b64: string, mime: string): Blob {
  const byteChars = atob(b64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
