import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Trash2, RotateCcw, Archive, Briefcase, Users, Search,
  AlertTriangle, Loader2, DollarSign, Clock,
} from "lucide-react";

type Tab = "deals" | "contacts";

export default function Trash() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState<Tab>("deals");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [showHardDeleteDialog, setShowHardDeleteDialog] = useState(false);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<"selected" | "all">("selected");

  /* ── Queries ── */
  const deletedDeals = trpc.crm.deals.listDeleted.useQuery({ limit: 200 });
  const deletedContacts = trpc.crm.contacts.listDeleted.useQuery({ limit: 200 });

  /* ── Mutations - Deals ── */
  const restoreDeals = trpc.crm.deals.restore.useMutation({
    onSuccess: (data: any) => { toast.success(`${data.count} negociacao(oes) restaurada(s)`); setSelectedIds(new Set()); deletedDeals.refetch(); },
    onError: (err: any) => toast.error(err.message || "Erro ao restaurar"),
  });
  const hardDeleteDeals = trpc.crm.deals.hardDelete.useMutation({
    onSuccess: (data: any) => { toast.success(`${data.count} negociacao(oes) excluida(s) permanentemente`); setSelectedIds(new Set()); setShowHardDeleteDialog(false); deletedDeals.refetch(); },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir"),
  });

  /* ── Mutations - Contacts ── */
  const restoreContacts = trpc.crm.contacts.restore.useMutation({
    onSuccess: (data: any) => { toast.success(`${data.count} contato(s) restaurado(s)`); setSelectedIds(new Set()); deletedContacts.refetch(); },
    onError: (err: any) => toast.error(err.message || "Erro ao restaurar"),
  });
  const hardDeleteContacts = trpc.crm.contacts.hardDelete.useMutation({
    onSuccess: (data: any) => { toast.success(`${data.count} contato(s) excluido(s) permanentemente`); setSelectedIds(new Set()); setShowHardDeleteDialog(false); deletedContacts.refetch(); },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir"),
  });

  /* ── Filtered lists ── */
  const dealsList = useMemo(() => {
    const items = deletedDeals.data || [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((d: any) => d.title?.toLowerCase().includes(q));
  }, [deletedDeals.data, search]);

  const contactsList = useMemo(() => {
    const items = deletedContacts.data || [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((c: any) =>
      c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q)
    );
  }, [deletedContacts.data, search]);

  const currentList: any[] = activeTab === "deals" ? dealsList : contactsList;
  const isLoading = activeTab === "deals" ? deletedDeals.isLoading : deletedContacts.isLoading;
  const isPending = restoreDeals.isPending || hardDeleteDeals.isPending || restoreContacts.isPending || hardDeleteContacts.isPending;

  /* ── Selection ── */
  const toggleId = (id: number) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    selectedIds.size === currentList.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(currentList.map((i) => i.id)));
  };
  const allSelected = currentList.length > 0 && selectedIds.size === currentList.length;

  /* ── Actions ── */
  const handleRestore = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (activeTab === "deals") restoreDeals.mutate({ ids });
    else restoreContacts.mutate({ ids });
  };

  const handleHardDelete = () => {
    const ids = hardDeleteTarget === "all" ? currentList.map((i) => i.id) : Array.from(selectedIds);
    if (!ids.length) return;
    if (activeTab === "deals") hardDeleteDeals.mutate({ ids });
    else hardDeleteContacts.mutate({ ids });
  };

  const handleRestoreSingle = (id: number) => {
    if (activeTab === "deals") restoreDeals.mutate({ ids: [id] });
    else restoreContacts.mutate({ ids: [id] });
  };

  const switchTab = (tab: Tab) => { setActiveTab(tab); setSelectedIds(new Set()); setSearch(""); };

  const fmt = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
  const fmtCurrency = (c: number | null) => c ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100) : "-";

  /** Calculate days elapsed since deletion and days remaining until auto-purge (30 days) */
  const PURGE_AFTER_DAYS = 30;
  const getDaysInfo = (deletedAt: any) => {
    if (!deletedAt) return { elapsed: 0, remaining: PURGE_AFTER_DAYS, pct: 0 };
    const now = new Date();
    const deleted = new Date(deletedAt);
    const elapsed = Math.floor((now.getTime() - deleted.getTime()) / (1000 * 60 * 60 * 24));
    const remaining = Math.max(0, PURGE_AFTER_DAYS - elapsed);
    const pct = Math.min(100, Math.round((elapsed / PURGE_AFTER_DAYS) * 100));
    return { elapsed, remaining, pct };
  };
  const getUrgencyColor = (remaining: number) => {
    if (remaining <= 3) return "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800/40";
    if (remaining <= 7) return "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/40";
    if (remaining <= 14) return "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800/40";
    return "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/40";
  };

  const dealsCount = deletedDeals.data?.length || 0;
  const contactsCount = deletedContacts.data?.length || 0;

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Archive className="h-5 w-5 text-amber-600" />
            Lixeira
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Itens excluidos podem ser restaurados ou removidos permanentemente.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <Button
          variant={activeTab === "deals" ? "default" : "outline"}
          size="sm"
          onClick={() => switchTab("deals")}
          className="gap-1.5"
        >
          <Briefcase className="h-4 w-4" />
          Negociacoes
          {dealsCount > 0 && (
            <span className="ml-1 bg-white/20 text-[11px] px-1.5 py-0.5 rounded-full font-medium">
              {dealsCount}
            </span>
          )}
        </Button>
        <Button
          variant={activeTab === "contacts" ? "default" : "outline"}
          size="sm"
          onClick={() => switchTab("contacts")}
          className="gap-1.5"
        >
          <Users className="h-4 w-4" />
          Contatos
          {contactsCount > 0 && (
            <span className="ml-1 bg-white/20 text-[11px] px-1.5 py-0.5 rounded-full font-medium">
              {contactsCount}
            </span>
          )}
        </Button>
      </div>

      {/* Search + Actions bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={activeTab === "deals" ? "Buscar negociacoes excluidas..." : "Buscar contatos excluidos..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {selectedIds.size} selecionado(s)
            </span>
            <Button size="sm" variant="outline" onClick={handleRestore} disabled={isPending} className="gap-1.5 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-500/10">
              {(restoreDeals.isPending || restoreContacts.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Restaurar
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setHardDeleteTarget("selected"); setShowHardDeleteDialog(true); }}
                disabled={isPending}
                className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir permanentemente
              </Button>
            )}
          </div>
        )}
        {isAdmin && currentList.length > 0 && selectedIds.size === 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setHardDeleteTarget("all"); setShowHardDeleteDialog(true); }}
            disabled={isPending}
            className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Esvaziar lixeira
          </Button>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/40">
        <Archive className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-[13px] text-amber-800 dark:text-amber-300">
          Itens na lixeira sao excluidos automaticamente apos {PURGE_AFTER_DAYS} dias. Restaure antes do prazo para recupera-los.
        </span>
      </div>

      {/* Table */}
      <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="p-3.5 w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </th>
                {activeTab === "deals" ? (
                  <>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Titulo</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Valor</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Status</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Excluido em</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Expira em</th>
                    <th className="p-3.5 w-24"></th>
                  </>
                ) : (
                  <>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Nome</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Email</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Telefone</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Excluido em</th>
                    <th className="text-left p-3.5 font-semibold text-muted-foreground">Expira em</th>
                    <th className="p-3.5 w-24"></th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground text-sm">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Carregando...
                  </td>
                </tr>
              ) : currentList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    <Archive className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm font-medium">Lixeira vazia</p>
                    <p className="text-xs mt-1">
                      {search ? "Nenhum resultado para a busca." : `Nenhum ${activeTab === "deals" ? "negociacao" : "cliente"} na lixeira.`}
                    </p>
                  </td>
                </tr>
              ) : (
                currentList.map((item: any) => (
                  <tr
                    key={item.id}
                    className="border-b border-border/20 hover:bg-muted/10 transition-colors"
                  >
                    <td className="p-3.5">
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleId(item.id)}
                      />
                    </td>
                    {activeTab === "deals" ? (
                      <>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                            <span className="font-medium truncate max-w-[250px]">{item.title || "Sem titulo"}</span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <DollarSign className="h-3.5 w-3.5" />
                            {fmtCurrency(item.valueCents)}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            item.status === "won" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                            item.status === "lost" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                            "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          }`}>
                            {item.status === "won" ? "Ganha" : item.status === "lost" ? "Perdida" : "Aberta"}
                          </span>
                        </td>
                        <td className="p-3.5 text-muted-foreground">{fmt(item.deletedAt)}</td>
                        <td className="p-3.5">
                          {(() => {
                            const info = getDaysInfo(item.deletedAt);
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getUrgencyColor(info.remaining)}`}>
                                    <Clock className="h-3 w-3" />
                                    {info.remaining}d
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{info.elapsed} dia(s) na lixeira</p>
                                  <p>Sera excluido automaticamente em {info.remaining} dia(s)</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })()}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                            <span className="font-medium truncate max-w-[200px]">{item.name || "Sem nome"}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-muted-foreground truncate max-w-[200px]">{item.email || "-"}</td>
                        <td className="p-3.5 text-muted-foreground">{item.phone || "-"}</td>
                        <td className="p-3.5 text-muted-foreground">{fmt(item.deletedAt)}</td>
                        <td className="p-3.5">
                          {(() => {
                            const info = getDaysInfo(item.deletedAt);
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getUrgencyColor(info.remaining)}`}>
                                    <Clock className="h-3 w-3" />
                                    {info.remaining}d
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{info.elapsed} dia(s) na lixeira</p>
                                  <p>Sera excluido automaticamente em {info.remaining} dia(s)</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })()}
                        </td>
                      </>
                    )}
                    <td className="p-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                              onClick={() => handleRestoreSingle(item.id)}
                              disabled={isPending}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Restaurar</TooltipContent>
                        </Tooltip>
                        {isAdmin && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                                onClick={() => {
                                  setSelectedIds(new Set([item.id]));
                                  setHardDeleteTarget("selected");
                                  setShowHardDeleteDialog(true);
                                }}
                                disabled={isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir permanentemente</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Hard Delete Confirmation Dialog */}
      <Dialog open={showHardDeleteDialog} onOpenChange={setShowHardDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Exclusao permanente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {hardDeleteTarget === "all"
                ? `Tem certeza que deseja excluir permanentemente TODOS os ${currentList.length} ${activeTab === "deals" ? "negociacoes" : "clientes"} da lixeira?`
                : `Tem certeza que deseja excluir permanentemente ${selectedIds.size} ${activeTab === "deals" ? "negociacao(oes)" : "cliente(s)"}?`}
            </p>
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800/40">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-[12px] text-red-700 dark:text-red-300 font-medium">
                Esta acao e irreversivel. Os dados serao removidos permanentemente.
              </span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowHardDeleteDialog(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleHardDelete}
              disabled={isPending}
              className="gap-1.5"
            >
              {(hardDeleteDeals.isPending || hardDeleteContacts.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" /> Sim, excluir permanentemente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
