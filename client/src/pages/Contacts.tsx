import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Users, Mail, Phone, MoreHorizontal, Trash2, Edit, Eye, RotateCcw, AlertTriangle, Archive, RefreshCw, X, Send, Download, Loader2 } from "lucide-react";
import { useExportDownload } from "@/hooks/useExport";
import BulkWhatsAppDialog from "@/components/BulkWhatsAppDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { useState, useMemo } from "react";
import CustomFieldRenderer, { customFieldValuesToArray, initCustomFieldValues } from "@/components/CustomFieldRenderer";
import ContactFiltersPanel, { useContactFilters, ContactFilterButton } from "@/components/ContactFiltersPanel";
import { formatDate } from "../../../shared/dateUtils";
import { Link } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const stageConfig: Record<string, { dot: string; label: string }> = {
  lead: { dot: "bg-blue-500", label: "Lead" },
  prospect: { dot: "bg-amber-500", label: "Prospect" },
  customer: { dot: "bg-emerald-500", label: "Cliente" },
  churned: { dot: "bg-red-500", label: "Churned" },
};

function ExportContactsButton() {
  const { isExporting, handleExport } = useExportDownload();
  const exportMutation = trpc.export.contacts.useMutation();
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 gap-2 rounded-lg text-[13px]"
      disabled={isExporting}
      onClick={() => handleExport(() => exportMutation.mutateAsync(), "passageiros")}
    >
      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Exportar
    </Button>
  );
}

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showTrash, setShowTrash] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const contactFilters = useContactFilters();

  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Build query params from filters
  const queryParams = useMemo(() => {
    const f = contactFilters.filters;
    return {
      search: f.nameSearch || search || undefined,
      email: f.email || undefined,
      phone: f.phone || undefined,
      limit: pageSize,
      offset: page * pageSize,
      dateFrom: f.dateFrom || undefined,
      dateTo: f.dateTo || undefined,
      customFieldFilters: f.customFieldFilters?.length ? f.customFieldFilters : undefined,
    };
  }, [contactFilters.filters, search, page, pageSize]);

  const contacts = trpc.crm.contacts.list.useQuery(queryParams);
  const deletedContacts = trpc.crm.contacts.listDeleted.useQuery({ limit: 100 }, { enabled: showTrash });

  // Bulk WhatsApp
  const activeSession = trpc.crm.contacts.activeSession.useQuery(undefined, { enabled: bulkDialogOpen });
  const bulkSend = trpc.crm.contacts.bulkWhatsApp.useMutation({
    onSuccess: () => { setBulkDialogOpen(false); setProgressDialogOpen(true); toast.success("Disparo iniciado!"); },
    onError: (e: any) => toast.error(e.message || "Erro ao iniciar disparo"),
  });
  const bulkProgress = trpc.crm.contacts.bulkProgress.useQuery(undefined, { enabled: progressDialogOpen, refetchInterval: progressDialogOpen ? 2000 : false });
  const cancelBulk = trpc.crm.contacts.cancelBulk.useMutation({
    onSuccess: () => toast.info("Envio cancelado"),
    onError: (e: any) => toast.error(e.message),
  });
  const sessionConnected = activeSession.data?.status === "connected";
  const sessionConnecting = activeSession.data?.status === "connecting";
  const contactTemplateVars = [
    { var: "{nome}", desc: "Nome completo do passageiro" },
    { var: "{primeiro_nome}", desc: "Primeiro nome" },
    { var: "{email}", desc: "E-mail do passageiro" },
    { var: "{telefone}", desc: "Telefone do passageiro" },
  ];
  const contactPreviewReplacements: Record<string, string> = {
    "{nome}": "João da Silva",
    "{primeiro_nome}": "João",
    "{email}": "joao@email.com",
    "{telefone}": "(11) 99999-0000",
  };

  // Custom fields for contacts
  const contactCustomFields = trpc.customFields.list.useQuery({ entity: "contact" as const });
  const visibleFormFields = useMemo(() => (contactCustomFields.data || []).filter((f: any) => f.isVisibleOnForm), [contactCustomFields.data]);
  const setFieldValues = trpc.contactProfile.setCustomFieldValues.useMutation();

  const createContact = trpc.crm.contacts.create.useMutation({
    onSuccess: async (result) => {
      // Save custom field values after contact creation
      const cfEntries = customFieldValuesToArray(customFieldValues).filter(v => v.value);
      if (result?.id && cfEntries.length > 0) {
        try {
          await setFieldValues.mutateAsync({
            entityType: "contact",
            entityId: result.id,
            values: cfEntries,
          });
        } catch (e) { console.error("Error saving custom fields:", e); }
      }
      utils.crm.contacts.list.invalidate();
      setOpen(false); setName(""); setEmail(""); setPhone(""); setCustomFieldValues({});
      toast.success("Passageiro criado!");
    },
  });
  const deleteContact = trpc.crm.contacts.delete.useMutation({
    onSuccess: () => { utils.crm.contacts.list.invalidate(); utils.crm.contacts.listDeleted.invalidate(); toast.success("Passageiro movido para a lixeira."); },
  });
  const bulkDelete = trpc.crm.contacts.bulkDelete.useMutation({
    onSuccess: (data) => {
      utils.crm.contacts.list.invalidate();
      utils.crm.contacts.listDeleted.invalidate();
      setSelectedIds(new Set());
      setConfirmDelete(false);
      toast.success(`${data.count} passageiro(s) movido(s) para a lixeira`);
    },
    onError: (err) => toast.error(err.message),
  });
  const restoreContacts = trpc.crm.contacts.restore.useMutation({
    onSuccess: (data) => {
      utils.crm.contacts.list.invalidate();
      utils.crm.contacts.listDeleted.invalidate();
      setSelectedIds(new Set());
      toast.success(`${data.count} passageiro(s) restaurado(s)`);
    },
    onError: (err) => toast.error(err.message),
  });
  const hardDelete = trpc.crm.contacts.hardDelete.useMutation({
    onSuccess: (data) => {
      utils.crm.contacts.list.invalidate();
      utils.crm.contacts.listDeleted.invalidate();
      setSelectedIds(new Set());
      setConfirmHardDelete(false);
      toast.success(`${data.count} passageiro(s) excluído(s) permanentemente`);
    },
    onError: (err) => toast.error(err.message),
  });

  const contactItems = contacts.data?.items || [];
  const totalCount = contacts.data?.totalCount ?? 0;
  const currentList = showTrash ? (deletedContacts.data || []) : contactItems;
  const total = totalCount;
  const totalPages = Math.ceil(totalCount / pageSize);

  const allSelected = currentList.length > 0 && currentList.every((c: any) => selectedIds.has(c.id));
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
      setSelectedIds(new Set(currentList.map((c: any) => c.id)));
    }
  };

  return (
    <div className="p-6 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground">Passageiros</h1>
          <p className="text-[13px] text-muted-foreground/70 mt-0.5">{total} passageiro{total !== 1 ? "s" : ""}{contactFilters.activeCount > 0 ? ` (filtrado)` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <ContactFilterButton
            activeCount={contactFilters.activeCount}
            onClick={() => contactFilters.setIsOpen(true)}
          />
          <Button
            variant={showTrash ? "default" : "outline"}
            size="sm"
            className="h-9 gap-2 rounded-lg text-[13px]"
            onClick={() => { setShowTrash(!showTrash); setSelectedIds(new Set()); }}
          >
            <Archive className="h-4 w-4" />
            Lixeira{deletedContacts.data?.length ? ` (${deletedContacts.data.length})` : ""}
          </Button>
          {!showTrash && (
            <ExportContactsButton />
          )}
          {!showTrash && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 gap-2 px-4 rounded-lg bg-primary hover:bg-primary/90 text-[13px] font-medium shadow-sm transition-colors">
                  <Plus className="h-4 w-4" />Novo Passageiro
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px] rounded-xl">
                <DialogHeader>
                  <DialogTitle className="text-[16px] font-semibold">Novo Passageiro</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label className="text-[12px] font-medium text-muted-foreground">Nome *</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="mt-1.5 h-10 rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-[12px] font-medium text-muted-foreground">Email</Label>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className="mt-1.5 h-10 rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-[12px] font-medium text-muted-foreground">Telefone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11 99999-9999" className="mt-1.5 h-10 rounded-lg" />
                  </div>
                  {/* Campos Personalizados */}
                  {visibleFormFields.length > 0 && (
                    <div className="border border-border/40 rounded-xl p-4 bg-muted/20 space-y-3">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em] flex items-center gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" /> Campos Personalizados
                      </p>
                      <CustomFieldRenderer
                        fields={visibleFormFields}
                        values={customFieldValues}
                        onChange={(fieldId, val) => setCustomFieldValues(prev => ({ ...prev, [fieldId]: val }))}
                        mode="form"
                      />
                    </div>
                  )}
                  <Button
                    className="w-full h-10 rounded-lg text-[13px] font-medium bg-primary hover:bg-primary/90 shadow-sm transition-colors"
                    disabled={!name || createContact.isPending}
                    onClick={() => createContact.mutate({ name, email: email || undefined, phone: phone || undefined })}
                  >
                    {createContact.isPending ? "Criando..." : "Criar Passageiro"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Search bar */}
      {!showTrash && (
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              className="pl-9 h-9 rounded-lg bg-muted/30 border-0 text-[13px] placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/30"
              placeholder="Buscar passageiros..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          {/* Active filter badges */}
          {contactFilters.activeCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {contactFilters.filters.nameSearch && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md text-[11px]">
                  Nome: {contactFilters.filters.nameSearch}
                  <button onClick={() => contactFilters.setFilters(prev => { const n = { ...prev }; delete n.nameSearch; return n; })} className="hover:bg-blue-500/20 rounded-sm p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {contactFilters.filters.email && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md text-[11px]">
                  Email: {contactFilters.filters.email}
                  <button onClick={() => contactFilters.setFilters(prev => { const n = { ...prev }; delete n.email; return n; })} className="hover:bg-blue-500/20 rounded-sm p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {contactFilters.filters.phone && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md text-[11px]">
                  Telefone: {contactFilters.filters.phone}
                  <button onClick={() => contactFilters.setFilters(prev => { const n = { ...prev }; delete n.phone; return n; })} className="hover:bg-blue-500/20 rounded-sm p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {(contactFilters.filters.dateFrom || contactFilters.filters.dateTo) && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md text-[11px]">
                  Período: {contactFilters.filters.dateFrom || "..."} — {contactFilters.filters.dateTo || "..."}
                  <button onClick={() => contactFilters.setFilters(prev => { const n = { ...prev }; delete n.dateFrom; delete n.dateTo; return n; })} className="hover:bg-blue-500/20 rounded-sm p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {contactFilters.filters.customFieldFilters?.map((cf, idx) => (
                <span key={`cf-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-md text-[11px]">
                  Campo #{cf.fieldId}: {cf.value}
                  <button onClick={() => contactFilters.setFilters(prev => ({
                    ...prev,
                    customFieldFilters: (prev.customFieldFilters || []).filter((_, i) => i !== idx),
                  }))} className="hover:bg-violet-500/20 rounded-sm p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button onClick={() => { contactFilters.clear(); setPage(0); }} className="text-[11px] text-muted-foreground hover:text-foreground ml-1">
                Limpar todos
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border/40">
          <span className="text-[13px] font-medium text-foreground">{selectedIds.size} selecionado(s)</span>
          <div className="flex-1" />
          {showTrash ? (
            <>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px] rounded-lg" onClick={() => restoreContacts.mutate({ ids: Array.from(selectedIds) })} disabled={restoreContacts.isPending}>
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
          <span className="text-[13px] font-medium text-amber-800 dark:text-amber-300">Lixeira de Passageiros</span>
          <span className="text-[12px] text-amber-600 dark:text-amber-400 ml-1">Itens na lixeira podem ser restaurados ou excluídos permanentemente (admin).</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border/40">
              <th className="px-4 py-3 w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground/70 text-[12px]">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground/70 text-[12px]">Email</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground/70 text-[12px]">Telefone</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground/70 text-[12px]">Estágio</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground/70 text-[12px]">{showTrash ? "Excluído em" : "Criado em"}</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {(showTrash ? deletedContacts.isLoading : contacts.isLoading) ? (
              <tr><td colSpan={7} className="py-16 text-center">
                <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              </td></tr>
            ) : !currentList.length ? (
              <tr><td colSpan={7} className="py-16 text-center text-muted-foreground/50">
                {showTrash ? (
                  <>
                    <Archive className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                    <p className="text-[13px]">Lixeira vazia</p>
                  </>
                ) : (
                  <>
                    <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                    <p className="text-[13px]">Nenhum passageiro encontrado</p>
                    {contactFilters.activeCount > 0 && (
                      <p className="text-[12px] text-muted-foreground/40 mt-1">Tente ajustar os filtros</p>
                    )}
                  </>
                )}
              </td></tr>
            ) : currentList.map((c: any) => {
              const stage = stageConfig[c.lifecycleStage] || stageConfig["lead"];
              const isSelected = selectedIds.has(c.id);
              return (
                <tr key={c.id} className={`border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors duration-100 ${isSelected ? "bg-primary/5" : ""}`}>
                  <td className="px-4 py-3">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(c.id)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center text-[12px] font-semibold text-muted-foreground shrink-0">
                        {c.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      {showTrash ? (
                        <span className="font-medium text-muted-foreground line-through">{c.name}</span>
                      ) : (
                        <Link href={`/contact/${c.id}`} className="font-medium text-foreground hover:text-primary transition-colors cursor-pointer">{c.name}</Link>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.email ? <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground/40" />{c.email}</span> : <span className="text-muted-foreground/30">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.phone ? <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground/40" />{c.phone}</span> : <span className="text-muted-foreground/30">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                      {stage.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-[12px]">
                    {showTrash
                      ? (c.deletedAt ? formatDate(c.deletedAt) : "—")
                      : (c.createdAt ? formatDate(c.createdAt) : "—")
                    }
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground/50 hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-lg min-w-[140px]">
                        {showTrash ? (
                          <>
                            <DropdownMenuItem className="text-[13px]" onClick={() => restoreContacts.mutate({ ids: [c.id] })}>
                              <RotateCcw className="mr-2 h-3.5 w-3.5" />Restaurar
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem className="text-destructive text-[13px]" onClick={() => hardDelete.mutate({ ids: [c.id] })}>
                                <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir Permanentemente
                              </DropdownMenuItem>
                            )}
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem className="text-[13px]" asChild><Link href={`/contact/${c.id}`}><Eye className="mr-2 h-3.5 w-3.5" />Ver Perfil</Link></DropdownMenuItem>
                            <DropdownMenuItem className="text-[13px]" asChild><Link href={`/contact/${c.id}`}><Edit className="mr-2 h-3.5 w-3.5" />Editar</Link></DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive text-[13px]" onClick={() => deleteContact.mutate({ id: c.id })}>
                              <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir
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

      {/* Pagination */}
      {!showTrash && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            Mostrando {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} de {totalCount} passageiros
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
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
              Excluir {selectedIds.size} passageiro(s)?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-[13px] text-muted-foreground">
              Os passageiros serão movidos para a lixeira. As <strong>negociações vinculadas não serão afetadas</strong>. Você pode restaurá-los a qualquer momento.
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
              Excluir permanentemente {selectedIds.size} contato(s)?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-[13px] text-muted-foreground">
              Esta ação é <strong>irreversível</strong>. Os passageiros serão excluídos permanentemente do banco de dados.
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

      {/* Contact Filters Panel (Sheet) */}
      <ContactFiltersPanel
        open={contactFilters.isOpen}
        onOpenChange={contactFilters.setIsOpen}
        filters={contactFilters.filters}
        onApply={(f) => { contactFilters.setFilters(f); setPage(0); }}
        onClear={() => { contactFilters.clear(); setPage(0); }}
      />

      {/* Bulk WhatsApp Dialog */}
      <BulkWhatsAppDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        selectedCount={selectedIds.size}
        sessionConnected={sessionConnected}
        sessionConnecting={sessionConnecting}
        templateVars={contactTemplateVars}
        previewReplacements={contactPreviewReplacements}
        onSend={(params) => {
          bulkSend.mutate({
            contactIds: Array.from(selectedIds),
            messageTemplate: params.messageTemplate,
            sessionId: activeSession.data?.sessionId || "",
            delayMs: params.delayMs,
            randomDelay: params.randomDelay,
          });
        }}
        isSending={bulkSend.isPending}
        progress={bulkProgress.data as any}
        progressOpen={progressDialogOpen}
        onProgressOpenChange={setProgressDialogOpen}
        onCancel={() => cancelBulk.mutate()}
        isCancelling={cancelBulk.isPending}
        onClearSelection={() => setSelectedIds(new Set())}
        entityLabel="passageiros"
      />
    </div>
  );
}
