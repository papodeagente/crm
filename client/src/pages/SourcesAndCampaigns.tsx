import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, RotateCcw, Megaphone, Target,
  MoreHorizontal, Archive, AlertTriangle,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#eab308", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1",
];

export default function SourcesAndCampaigns() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"sources" | "campaigns">("sources");
  const [showDeleted, setShowDeleted] = useState(false);

  // Sources state
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<any>(null);
  const [sourceName, setSourceName] = useState("");
  const [sourceColor, setSourceColor] = useState(COLORS[0]);

  // Campaigns state
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [campaignName, setCampaignName] = useState("");
  const [campaignColor, setCampaignColor] = useState(COLORS[4]);
  const [campaignSourceId, setCampaignSourceId] = useState<string>("");

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{ type: "source" | "campaign"; id: number; name: string; hard?: boolean } | null>(null);

  // Queries
  const sourcesQuery = trpc.crm.leadSources.list.useQuery({ includeDeleted: showDeleted });
  const campaignsQuery = trpc.crm.campaigns.list.useQuery({ includeDeleted: showDeleted });
  const utils = trpc.useUtils();

  // Source mutations
  const createSource = trpc.crm.leadSources.create.useMutation({
    onSuccess: () => { utils.crm.leadSources.list.invalidate(); toast.success("Fonte criada com sucesso"); setSourceDialogOpen(false); },
    onError: () => toast.error("Erro ao criar fonte"),
  });
  const updateSource = trpc.crm.leadSources.update.useMutation({
    onSuccess: () => { utils.crm.leadSources.list.invalidate(); toast.success("Fonte atualizada"); setSourceDialogOpen(false); },
    onError: () => toast.error("Erro ao atualizar fonte"),
  });
  const deleteSource = trpc.crm.leadSources.delete.useMutation({
    onSuccess: () => { utils.crm.leadSources.list.invalidate(); toast.success("Fonte movida para lixeira"); setDeleteDialog(null); },
  });
  const restoreSource = trpc.crm.leadSources.restore.useMutation({
    onSuccess: () => { utils.crm.leadSources.list.invalidate(); toast.success("Fonte restaurada"); },
  });
  const hardDeleteSource = trpc.crm.leadSources.hardDelete.useMutation({
    onSuccess: () => { utils.crm.leadSources.list.invalidate(); toast.success("Fonte excluída permanentemente"); setDeleteDialog(null); },
  });

  // Campaign mutations
  const createCampaign = trpc.crm.campaigns.create.useMutation({
    onSuccess: () => { utils.crm.campaigns.list.invalidate(); toast.success("Campanha criada com sucesso"); setCampaignDialogOpen(false); },
    onError: () => toast.error("Erro ao criar campanha"),
  });
  const updateCampaign = trpc.crm.campaigns.update.useMutation({
    onSuccess: () => { utils.crm.campaigns.list.invalidate(); toast.success("Campanha atualizada"); setCampaignDialogOpen(false); },
    onError: () => toast.error("Erro ao atualizar campanha"),
  });
  const deleteCampaign = trpc.crm.campaigns.delete.useMutation({
    onSuccess: () => { utils.crm.campaigns.list.invalidate(); toast.success("Campanha movida para lixeira"); setDeleteDialog(null); },
  });
  const restoreCampaign = trpc.crm.campaigns.restore.useMutation({
    onSuccess: () => { utils.crm.campaigns.list.invalidate(); toast.success("Campanha restaurada"); },
  });
  const hardDeleteCampaign = trpc.crm.campaigns.hardDelete.useMutation({
    onSuccess: () => { utils.crm.campaigns.list.invalidate(); toast.success("Campanha excluída permanentemente"); setDeleteDialog(null); },
  });

  const activeSources = useMemo(() => (sourcesQuery.data || []).filter(s => !s.isDeleted), [sourcesQuery.data]);
  const deletedSources = useMemo(() => (sourcesQuery.data || []).filter(s => s.isDeleted), [sourcesQuery.data]);
  const activeCampaigns = useMemo(() => (campaignsQuery.data || []).filter(c => !c.isDeleted), [campaignsQuery.data]);
  const deletedCampaigns = useMemo(() => (campaignsQuery.data || []).filter(c => c.isDeleted), [campaignsQuery.data]);

  function openCreateSource() {
    setEditingSource(null);
    setSourceName("");
    setSourceColor(COLORS[0]);
    setSourceDialogOpen(true);
  }
  function openEditSource(source: any) {
    setEditingSource(source);
    setSourceName(source.name);
    setSourceColor(source.color || COLORS[0]);
    setSourceDialogOpen(true);
  }
  function handleSaveSource() {
    if (!sourceName.trim()) return;
    if (editingSource) {
      updateSource.mutate({ id: editingSource.id, name: sourceName.trim(), color: sourceColor });
    } else {
      createSource.mutate({ name: sourceName.trim(), color: sourceColor });
    }
  }

  function openCreateCampaign() {
    setEditingCampaign(null);
    setCampaignName("");
    setCampaignColor(COLORS[4]);
    setCampaignSourceId("");
    setCampaignDialogOpen(true);
  }
  function openEditCampaign(campaign: any) {
    setEditingCampaign(campaign);
    setCampaignName(campaign.name);
    setCampaignColor(campaign.color || COLORS[4]);
    setCampaignSourceId(campaign.sourceId ? String(campaign.sourceId) : "");
    setCampaignDialogOpen(true);
  }
  function handleSaveCampaign() {
    if (!campaignName.trim()) return;
    if (editingCampaign) {
      updateCampaign.mutate({
        id: editingCampaign.id,
        name: campaignName.trim(),
        color: campaignColor,
        sourceId: campaignSourceId ? Number(campaignSourceId) : null,
      });
    } else {
      createCampaign.mutate({ name: campaignName.trim(),
        color: campaignColor,
        sourceId: campaignSourceId ? Number(campaignSourceId) : undefined,
      });
    }
  }

  function handleDelete() {
    if (!deleteDialog) return;
    if (deleteDialog.hard) {
      if (deleteDialog.type === "source") hardDeleteSource.mutate({ id: deleteDialog.id });
      else hardDeleteCampaign.mutate({ id: deleteDialog.id });
    } else {
      if (deleteDialog.type === "source") deleteSource.mutate({ id: deleteDialog.id });
      else deleteCampaign.mutate({ id: deleteDialog.id });
    }
  }

  function getSourceName(sourceId: number | null) {
    if (!sourceId) return null;
    const source = (sourcesQuery.data || []).find(s => s.id === sourceId);
    return source?.name || null;
  }

  return (
    <div className="page-content max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => setLocation("/settings")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Megaphone className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Fontes e Campanhas</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">Gerencie de onde vêm seus leads e campanhas de marketing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab("sources")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "sources" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Megaphone className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Fontes ({activeSources.length})
        </button>
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "campaigns" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Target className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Campanhas ({activeCampaigns.length})
        </button>
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-xs text-muted-foreground mr-2">
          <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} className="rounded" />
          Mostrar excluídos
        </label>
      </div>

      {/* Sources Tab */}
      {activeTab === "sources" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">Fontes representam a origem dos seus leads (ex: Google, Indicação, Facebook Ads)</p>
            <Button size="sm" onClick={openCreateSource}><Plus className="h-4 w-4 mr-1" /> Nova Fonte</Button>
          </div>
          <div className="space-y-2">
            {activeSources.map(source => (
              <Card key={source.id} className="group">
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: source.color || "#6366f1" }} />
                  <span className="text-sm font-medium text-foreground flex-1">{source.name}</span>
                  {!source.isActive && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditSource(source)}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteDialog({ type: "source", id: source.id, name: source.name })} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))}
            {activeSources.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma fonte cadastrada</p>
                <p className="text-xs mt-1">Crie fontes para rastrear a origem dos seus leads</p>
              </div>
            )}
          </div>
          {showDeleted && deletedSources.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Archive className="h-3.5 w-3.5" /> Lixeira ({deletedSources.length})
              </p>
              <div className="space-y-2 opacity-60">
                {deletedSources.map(source => (
                  <Card key={source.id}>
                    <CardContent className="flex items-center gap-3 py-3 px-4">
                      <div className="h-3 w-3 rounded-full shrink-0 opacity-40" style={{ backgroundColor: source.color || "#6366f1" }} />
                      <span className="text-sm text-muted-foreground flex-1 line-through">{source.name}</span>
                      <Button variant="ghost" size="sm" onClick={() => restoreSource.mutate({ id: source.id })}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteDialog({ type: "source", id: source.id, name: source.name, hard: true })}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir definitivamente
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campaigns Tab */}
      {activeTab === "campaigns" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">Campanhas são ações de marketing vinculadas a uma fonte (ex: Black Friday, Webinar Março)</p>
            <Button size="sm" onClick={openCreateCampaign}><Plus className="h-4 w-4 mr-1" /> Nova Campanha</Button>
          </div>
          <div className="space-y-2">
            {activeCampaigns.map(campaign => (
              <Card key={campaign.id} className="group">
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: campaign.color || "#8b5cf6" }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">{campaign.name}</span>
                    {campaign.sourceId && (
                      <span className="text-xs text-muted-foreground ml-2">
                        via {getSourceName(campaign.sourceId)}
                      </span>
                    )}
                  </div>
                  {!campaign.isActive && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditCampaign(campaign)}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteDialog({ type: "campaign", id: campaign.id, name: campaign.name })} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))}
            {activeCampaigns.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Target className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma campanha cadastrada</p>
                <p className="text-xs mt-1">Crie campanhas para rastrear suas ações de marketing</p>
              </div>
            )}
          </div>
          {showDeleted && deletedCampaigns.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Archive className="h-3.5 w-3.5" /> Lixeira ({deletedCampaigns.length})
              </p>
              <div className="space-y-2 opacity-60">
                {deletedCampaigns.map(campaign => (
                  <Card key={campaign.id}>
                    <CardContent className="flex items-center gap-3 py-3 px-4">
                      <div className="h-3 w-3 rounded-full shrink-0 opacity-40" style={{ backgroundColor: campaign.color || "#8b5cf6" }} />
                      <span className="text-sm text-muted-foreground flex-1 line-through">{campaign.name}</span>
                      <Button variant="ghost" size="sm" onClick={() => restoreCampaign.mutate({ id: campaign.id })}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteDialog({ type: "campaign", id: campaign.id, name: campaign.name, hard: true })}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir definitivamente
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Source Dialog */}
      <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSource ? "Editar Fonte" : "Nova Fonte"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome da fonte *</label>
              <Input value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="Ex: Google Ads, Indicação, Instagram..." />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Cor</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setSourceColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${sourceColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSourceDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSource} disabled={!sourceName.trim() || createSource.isPending || updateSource.isPending}>
              {editingSource ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Dialog */}
      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCampaign ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome da campanha *</label>
              <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Ex: Black Friday 2026, Webinar Março..." />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Fonte vinculada (opcional)</label>
              <Select value={campaignSourceId} onValueChange={setCampaignSourceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar fonte..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {activeSources.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color || "#6366f1" }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Cor</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setCampaignColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${campaignColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCampaign} disabled={!campaignName.trim() || createCampaign.isPending || updateCampaign.isPending}>
              {editingCampaign ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleteDialog?.hard ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <Trash2 className="h-5 w-5" />}
              {deleteDialog?.hard ? "Excluir permanentemente" : "Mover para lixeira"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.hard
                ? `Tem certeza que deseja excluir permanentemente "${deleteDialog?.name}"? Esta ação não pode ser desfeita.`
                : `"${deleteDialog?.name}" será movido para a lixeira. Você poderá restaurá-lo depois.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={deleteDialog?.hard ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}>
              {deleteDialog?.hard ? "Excluir permanentemente" : "Mover para lixeira"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
