import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Briefcase, MoreHorizontal, Trash2, TrendingUp, DollarSign, RotateCcw, AlertTriangle, Archive, Send, Download, Loader2 } from "lucide-react";
import { useExportDownload } from "@/hooks/useExport";
import BulkWhatsAppDialog from "@/components/BulkWhatsAppDialog";
import { useState, useMemo } from "react";
import DateRangeFilter, { useDateFilter } from "@/components/DateRangeFilter";
import { formatDate } from "../../../shared/dateUtils";
import DealFiltersPanel, { useDealFilters, DealFilterButton } from "@/components/DealFiltersPanel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
const statusStyles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  open: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Em andamento" },
  won: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Ganho" },
  lost: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Perdido" },
};

function ExportDealsButton() {
  const { isExporting, handleExport } = useExportDownload();
  const exportMutation = trpc.export.deals.useMutation();
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 gap-2 rounded-lg text-[13px]"
      disabled={isExporting}
      onClick={() => handleExport(() => exportMutation.mutateAsync(), "negociações")}
    >
      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Exportar
    </Button>
  );
}

export default function Deals() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showTrash, setShowTrash] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const dateFilter = useDateFilter("all");
  const dealFilters = useDealFilters();

  const [dealPage, setDealPage] = useState(0);
  const dealPageSize = 50;
  const deals = trpc.crm.deals.list.useQuery({
    limit: dealPageSize, offset: dealPage * dealPageSize,
    dateFrom: dateFilter.dates.dateFrom, dateTo: dateFilter.dates.dateTo,
    ...dealFilters.filters,
  });
  const deletedDeals = trpc.crm.deals.listDeleted.useQuery({ limit: 100 }, { enabled: showTrash });
  const pipelines = trpc.crm.pipelines.list.useQuery({});

  const createDeal = trpc.crm.deals.create.useMutation({
    onSuccess: () => { utils.crm.deals.list.invalidate(); setOpen(false); setTitle(""); setValue(""); toast.success("Negócio criado!"); },
  });
  const bulkDelete = trpc.crm.deals.bulkDelete.useMutation({
    onSuccess: (data) => {
      utils.crm.deals.list.invalidate();
      utils.crm.deals.listDeleted.invalidate();
      setSelectedIds(new Set());
      setConfirmDelete(false);
      toast.success(`${data.count} negociação(ões) movida(s) para a lixeira`);
    },
    onError: (err) => toast.error(err.message),
  });
  const restoreDeals = trpc.crm.deals.restore.useMutation({
    onSuccess: (data) => {
      utils.crm.deals.list.invalidate();
      utils.crm.deals.listDeleted.invalidate();
      setSelectedIds(new Set());
      toast.success(`${data.count} negociação(ões) restaurada(s)`);
    },
    onError: (err) => toast.error(err.message),
  });
  const hardDelete = trpc.crm.deals.hardDelete.useMutation({
    onSuccess: (data) => {
      utils.crm.deals.list.invalidate();
      utils.crm.deals.listDeleted.invalidate();
      setSelectedIds(new Set());
      setConfirmHardDelete(false);
      toast.success(`${data.count} negociação(ões) excluída(s) permanentemente`);
    },
    onError: (err) => toast.error(err.message),
  });

  // Bulk WhatsApp
  const activeSession = trpc.crm.deals.activeSession.useQuery(undefined, { enabled: bulkDialogOpen });
  const bulkSendDeals = trpc.crm.deals.bulkWhatsApp.useMutation({
    onSuccess: () => { setBulkDialogOpen(false); setProgressDialogOpen(true); toast.success("Disparo iniciado!"); },
    onError: (e: any) => toast.error(e.message || "Erro ao iniciar disparo"),
  });
  const bulkProgress = trpc.crm.deals.bulkProgress.useQuery(undefined, { enabled: progressDialogOpen, refetchInterval: progressDialogOpen ? 2000 : false });
  const cancelBulk = trpc.crm.deals.cancelBulk.useMutation({
    onSuccess: () => toast.info("Envio cancelado"),
    onError: (e: any) => toast.error(e.message),
  });
  const sessionConnected = activeSession.data?.status === "connected";
  const sessionConnecting = activeSession.data?.status === "connecting";
  const dealTemplateVars = [
    { var: "{nome}", desc: "Nome do contato principal" },
    { var: "{primeiro_nome}", desc: "Primeiro nome do contato" },
    { var: "{email}", desc: "E-mail do contato" },
    { var: "{telefone}", desc: "Telefone do contato" },
    { var: "{negociacao}", desc: "Título da negociação" },
    { var: "{valor}", desc: "Valor da negociação" },
    { var: "{etapa}", desc: "Etapa atual do funil" },
    { var: "{empresa}", desc: "Empresa do contato" },
    { var: "{nome_oportunidade}", desc: "Nome/título da oportunidade (deal)" },
    { var: "{produto_principal}", desc: "Produto de maior valor vinculado" },
  ];
  const dealPreviewReplacements: Record<string, string> = {
    "{nome}": "João da Silva",
    "{primeiro_nome}": "João",
    "{email}": "joao@email.com",
    "{telefone}": "(11) 99999-0000",
    "{negociacao}": "Pacote Europa 2026",
    "{valor}": "R$ 5.000,00",
    "{etapa}": "Cotação",
    "{empresa}": "Clinica Exemplo",
    "{nome_oportunidade}": "Limpeza de Pele - Joao",
    "{produto_principal}": "Limpeza de Pele Profunda",
  };

  const defaultPipeline = pipelines.data?.[0];
  const dealItems = (deals.data as any)?.items || deals.data || [];
  const currentList = showTrash ? (deletedDeals.data || []) : (Array.isArray(dealItems) ? dealItems : []);
  const totalValue = (Array.isArray(dealItems) ? dealItems : []).reduce((sum: number, d: any) => sum + (d.valueCents || 0), 0);
  const openCount = (Array.isArray(dealItems) ? dealItems : []).filter((d: any) => d.status === "open").length;
  const wonCount = (Array.isArray(dealItems) ? dealItems : []).filter((d: any) => d.status === "won").length;

  const allSelected = currentList.length > 0 && currentList.every((d: any) => selectedIds.has(d.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentList.map((d: any) => d.id)));
    }
  };

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Negócios</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {openCount} em andamento &bull; {wonCount} ganhos &bull; Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValue / 100)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter
            preset={dateFilter.preset}
            onPresetChange={dateFilter.setPreset}
            customFrom={dateFilter.customFrom}
            onCustomFromChange={dateFilter.setCustomFrom}
            customTo={dateFilter.customTo}
            onCustomToChange={dateFilter.setCustomTo}
            onReset={dateFilter.reset}
          />
          <DealFilterButton activeCount={dealFilters.activeCount} onClick={() => dealFilters.setIsOpen(true)} />
          <Button
            variant={showTrash ? "default" : "outline"}
            size="sm"
            className="h-9 gap-2 rounded-lg text-[13px]"
            onClick={() => { setShowTrash(!showTrash); setSelectedIds(new Set()); }}
          >
            <Archive className="h-4 w-4" />
            Lixeira{deletedDeals.data?.length ? ` (${deletedDeals.data.length})` : ""}
          </Button>
          {!showTrash && (
            <ExportDealsButton />
          )}
          {!showTrash && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 gap-2 px-5 rounded-lg bg-primary hover:bg-primary/90 shadow-sm text-[13px] font-medium transition-colors">
                  <Plus className="h-4 w-4" />Novo Negócio
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[460px] rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2.5 text-lg">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><Briefcase className="h-4 w-4 text-primary" /></div>
                    Novo Negócio
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-3">
                  <div><Label className="text-[12px] font-medium">Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Pacote Cancún - João" className="mt-1.5 h-10 rounded-xl" /></div>
                  <div><Label className="text-[12px] font-medium">Valor (R$)</Label><Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="5000.00" type="number" className="mt-1.5 h-10 rounded-xl" /></div>
                  <Button className="w-full h-11 rounded-lg text-[14px] font-medium bg-primary hover:bg-primary/90 shadow-sm transition-colors" disabled={!title || createDeal.isPending} onClick={() => {
                    if (!defaultPipeline) { toast.error("Crie um pipeline primeiro na seção Funil."); return; }
                    createDeal.mutate({ title, pipelineId: defaultPipeline.id, stageId: 1 });
                  }}>
                    {createDeal.isPending ? "Criando..." : "Criar Negócio"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {!showTrash && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-card border border-border/40 shadow-none p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><Briefcase className="h-5 w-5 text-blue-500" /></div>
            <div><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Em andamento</p><p className="text-lg font-bold">{openCount}</p></div>
          </div>
          <div className="rounded-xl bg-card border border-border/40 shadow-none p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-emerald-500" /></div>
            <div><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Ganhos</p><p className="text-lg font-bold">{wonCount}</p></div>
          </div>
          <div className="rounded-xl bg-card border border-border/40 shadow-none p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-violet-500" /></div>
            <div><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Valor Total</p><p className="text-lg font-bold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValue / 100)}</p></div>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border/40">
          <span className="text-[13px] font-medium text-foreground">{selectedIds.size} selecionado(s)</span>
          <div className="flex-1" />
          {showTrash ? (
            <>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px] rounded-lg" onClick={() => restoreDeals.mutate({ ids: Array.from(selectedIds) })} disabled={restoreDeals.isPending}>
                <RotateCcw className="h-3.5 w-3.5" />Restaurar
              </Button>
              {isAdmin && (
                <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-[12px] rounded-lg" onClick={() => setConfirmHardDelete(true)} disabled={hardDelete.isPending}>
                  <Trash2 className="h-3.5 w-3.5" />Excluir Permanentemente
                </Button>
              )}
            </>
          ) : (
            <>
              <Button size="sm" className="h-8 gap-1.5 text-[12px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setBulkDialogOpen(true)}>
                <Send className="h-3.5 w-3.5" />Disparar WhatsApp
              </Button>
              <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-[12px] rounded-lg" onClick={() => setConfirmDelete(true)} disabled={bulkDelete.isPending}>
                <Trash2 className="h-3.5 w-3.5" />Excluir Selecionados
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" className="h-8 text-[12px] rounded-lg" onClick={() => setSelectedIds(new Set())}>
            Limpar seleção
          </Button>
        </div>
      )}

      {/* Trash header */}
      {showTrash && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/40">
          <Archive className="h-4 w-4 text-amber-600" />
          <span className="text-[13px] font-medium text-amber-800 dark:text-amber-300">Lixeira de Negociações</span>
          <span className="text-[12px] text-amber-600 dark:text-amber-400 ml-1">Itens na lixeira podem ser restaurados ou excluídos permanentemente (admin).</span>
        </div>
      )}

      {/* Table */}
      <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="p-3.5 w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Título</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Contato</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Valor</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Etapa</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Status</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">{showTrash ? "Excluído em" : "Criado em"}</th>
                <th className="p-3.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {(showTrash ? deletedDeals.isLoading : deals.isLoading) ? (
                <tr><td colSpan={8} className="p-12 text-center text-muted-foreground text-sm">Carregando...</td></tr>
              ) : !currentList.length ? (
                <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">
                  {showTrash ? (
                    <>
                      <Archive className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm">Lixeira vazia.</p>
                    </>
                  ) : (
                    <>
                      <Briefcase className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm">Nenhum negócio encontrado.</p>
                    </>
                  )}
                </td></tr>
              ) : currentList.map((d: any) => {
                const ss = statusStyles[d.status] || statusStyles["open"];
                const isSelected = selectedIds.has(d.id);
                return (
                  <tr key={d.id} className={`border-b border-border/20 hover:bg-muted/20 transition-colors ${isSelected ? "bg-primary/5" : ""}`}>
                    <td className="p-3.5">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(d.id)} />
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-[12px] font-bold text-primary shrink-0">
                          {d.title?.charAt(0)?.toUpperCase() || "N"}
                        </div>
                        <span className={`font-semibold ${showTrash ? "text-muted-foreground line-through" : ""}`}>{d.title}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      {d.contactName ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                            {d.contactName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-[13px] font-medium">{d.contactName}</span>
                            {d.contactPhone && <p className="text-[11px] text-muted-foreground">{d.contactPhone}</p>}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[12px] italic">Sem contato</span>
                      )}
                    </td>
                    <td className="p-3.5 font-semibold">{d.valueCents ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(d.valueCents / 100) : "—"}</td>
                    <td className="p-3.5">
                      {d.stageName ? (
                        <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                          {d.stageName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${ss.bg} ${ss.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                        {ss.label}
                      </span>
                    </td>
                    <td className="p-3.5 text-muted-foreground">
                      {showTrash
                        ? (d.deletedAt ? formatDate(d.deletedAt) : "—")
                        : (d.createdAt ? formatDate(d.createdAt) : "—")
                      }
                    </td>
                    <td className="p-3.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          {showTrash ? (
                            <>
                              <DropdownMenuItem onClick={() => restoreDeals.mutate({ ids: [d.id] })}>
                                <RotateCcw className="mr-2 h-4 w-4" />Restaurar
                              </DropdownMenuItem>
                              {isAdmin && (
                                <DropdownMenuItem className="text-destructive" onClick={() => hardDelete.mutate({ ids: [d.id] })}>
                                  <Trash2 className="mr-2 h-4 w-4" />Excluir Permanentemente
                                </DropdownMenuItem>
                              )}
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem onClick={() => toast("Edição em breve")}>Editar</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => bulkDelete.mutate({ ids: [d.id] })}>
                                <Trash2 className="mr-2 h-4 w-4" />Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {!showTrash && (deals.data as any)?.totalCount > dealPageSize && (
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Mostrando {dealPage * dealPageSize + 1}–{Math.min((dealPage + 1) * dealPageSize, (deals.data as any)?.totalCount || 0)} de {(deals.data as any)?.totalCount || 0} negociações
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={dealPage === 0} onClick={() => setDealPage(p => p - 1)}>
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">Página {dealPage + 1} de {Math.ceil(((deals.data as any)?.totalCount || 0) / dealPageSize)}</span>
            <Button variant="outline" size="sm" disabled={dealPage >= Math.ceil(((deals.data as any)?.totalCount || 0) / dealPageSize) - 1} onClick={() => setDealPage(p => p + 1)}>
              Próximo
            </Button>
          </div>
        </div>
      )}

      {/* Confirm bulk soft-delete dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir {selectedIds.size} negociação(ões)?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-[13px] text-muted-foreground">
              As negociações serão movidas para a lixeira. Os <strong>contatos vinculados não serão afetados</strong>. Você pode restaurá-las a qualquer momento.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" className="rounded-lg" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
              <Button variant="destructive" className="rounded-lg" disabled={bulkDelete.isPending} onClick={() => bulkDelete.mutate({ ids: Array.from(selectedIds) })}>
                {bulkDelete.isPending ? "Excluindo..." : "Excluir"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm hard-delete dialog */}
      <Dialog open={confirmHardDelete} onOpenChange={setConfirmHardDelete}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir permanentemente {selectedIds.size} negociação(ões)?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-[13px] text-muted-foreground">
              Esta ação é <strong>irreversível</strong>. As negociações serão excluídas permanentemente do banco de dados. Os contatos vinculados não serão afetados.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" className="rounded-lg" onClick={() => setConfirmHardDelete(false)}>Cancelar</Button>
              <Button variant="destructive" className="rounded-lg" disabled={hardDelete.isPending} onClick={() => hardDelete.mutate({ ids: Array.from(selectedIds) })}>
                {hardDelete.isPending ? "Excluindo..." : "Excluir Permanentemente"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <DealFiltersPanel
        open={dealFilters.isOpen}
        onOpenChange={dealFilters.setIsOpen}
        filters={dealFilters.filters}
        onApply={(f) => { dealFilters.setFilters(f); }}
        onClear={dealFilters.clear}
      />

      {/* Bulk WhatsApp Dialog */}
      <BulkWhatsAppDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        selectedCount={selectedIds.size}
        sessionConnected={sessionConnected}
        sessionConnecting={sessionConnecting}
        templateVars={dealTemplateVars}
        previewReplacements={dealPreviewReplacements}
        onSend={(params) => {
          bulkSendDeals.mutate({
            dealIds: Array.from(selectedIds),
            messageTemplate: params.messageTemplate,
            sessionId: activeSession.data?.sessionId || "",
            delayMs: params.delayMs,
            randomDelay: params.randomDelay,
          });
        }}
        isSending={bulkSendDeals.isPending}
        progress={bulkProgress.data as any}
        progressOpen={progressDialogOpen}
        onProgressOpenChange={setProgressDialogOpen}
        onCancel={() => cancelBulk.mutate()}
        isCancelling={cancelBulk.isPending}
        onClearSelection={() => setSelectedIds(new Set())}
        entityLabel="negociações"
      />
    </div>
  );
}
