import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Users, Mail, Phone, MoreHorizontal, Trash2, Edit, Eye, RotateCcw, AlertTriangle, Archive } from "lucide-react";
import { useState } from "react";
import DateRangeFilter, { useDateFilter } from "@/components/DateRangeFilter";
import { Link } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const TENANT_ID = 1;

const stageConfig: Record<string, { dot: string; label: string }> = {
  lead: { dot: "bg-blue-500", label: "Lead" },
  prospect: { dot: "bg-amber-500", label: "Prospect" },
  customer: { dot: "bg-emerald-500", label: "Cliente" },
  churned: { dot: "bg-red-500", label: "Churned" },
};

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showTrash, setShowTrash] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const dateFilter = useDateFilter("all");

  const contacts = trpc.crm.contacts.list.useQuery({ tenantId: TENANT_ID, search: search || undefined, limit: 100, dateFrom: dateFilter.dates.dateFrom, dateTo: dateFilter.dates.dateTo });
  const deletedContacts = trpc.crm.contacts.listDeleted.useQuery({ tenantId: TENANT_ID, limit: 100 }, { enabled: showTrash });

  const createContact = trpc.crm.contacts.create.useMutation({
    onSuccess: () => { utils.crm.contacts.list.invalidate(); setOpen(false); setName(""); setEmail(""); setPhone(""); toast.success("Contato criado!"); },
  });
  const deleteContact = trpc.crm.contacts.delete.useMutation({
    onSuccess: () => { utils.crm.contacts.list.invalidate(); utils.crm.contacts.listDeleted.invalidate(); toast.success("Contato movido para a lixeira."); },
  });
  const bulkDelete = trpc.crm.contacts.bulkDelete.useMutation({
    onSuccess: (data) => {
      utils.crm.contacts.list.invalidate();
      utils.crm.contacts.listDeleted.invalidate();
      setSelectedIds(new Set());
      setConfirmDelete(false);
      toast.success(`${data.count} contato(s) movido(s) para a lixeira`);
    },
    onError: (err) => toast.error(err.message),
  });
  const restoreContacts = trpc.crm.contacts.restore.useMutation({
    onSuccess: (data) => {
      utils.crm.contacts.list.invalidate();
      utils.crm.contacts.listDeleted.invalidate();
      setSelectedIds(new Set());
      toast.success(`${data.count} contato(s) restaurado(s)`);
    },
    onError: (err) => toast.error(err.message),
  });
  const hardDelete = trpc.crm.contacts.hardDelete.useMutation({
    onSuccess: (data) => {
      utils.crm.contacts.list.invalidate();
      utils.crm.contacts.listDeleted.invalidate();
      setSelectedIds(new Set());
      setConfirmHardDelete(false);
      toast.success(`${data.count} contato(s) excluído(s) permanentemente`);
    },
    onError: (err) => toast.error(err.message),
  });

  const currentList = showTrash ? (deletedContacts.data || []) : (contacts.data || []);
  const total = contacts.data?.length ?? 0;

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
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground">Contatos</h1>
          <p className="text-[13px] text-muted-foreground/70 mt-0.5">{total} contato{total !== 1 ? "s" : ""}</p>
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
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 gap-2 px-4 rounded-lg bg-primary hover:bg-primary/90 text-[13px] font-medium shadow-sm transition-colors">
                  <Plus className="h-4 w-4" />Novo Contato
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px] rounded-xl">
                <DialogHeader>
                  <DialogTitle className="text-[16px] font-semibold">Novo Contato</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label className="text-[12px] font-medium text-muted-foreground">Nome *</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="mt-1.5 h-10 rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-[12px] font-medium text-muted-foreground">Email</Label>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" type="email" className="mt-1.5 h-10 rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-[12px] font-medium text-muted-foreground">Telefone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11 99999-9999" className="mt-1.5 h-10 rounded-lg" />
                  </div>
                  <Button
                    className="w-full h-10 rounded-lg text-[13px] font-medium bg-primary hover:bg-primary/90 shadow-sm transition-colors"
                    disabled={!name || createContact.isPending}
                    onClick={() => createContact.mutate({ tenantId: TENANT_ID, name, email: email || undefined, phone: phone || undefined })}
                  >
                    {createContact.isPending ? "Criando..." : "Criar Contato"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Search */}
      {!showTrash && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            className="pl-9 h-9 rounded-lg bg-muted/30 border-0 text-[13px] placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/30"
            placeholder="Buscar contatos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border/40">
          <span className="text-[13px] font-medium text-foreground">{selectedIds.size} selecionado(s)</span>
          <div className="flex-1" />
          {showTrash ? (
            <>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px] rounded-lg" onClick={() => restoreContacts.mutate({ tenantId: TENANT_ID, ids: Array.from(selectedIds) })} disabled={restoreContacts.isPending}>
                <RotateCcw className="h-3.5 w-3.5" />Restaurar
              </Button>
              {isAdmin && (
                <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-[12px] rounded-lg" onClick={() => setConfirmHardDelete(true)} disabled={hardDelete.isPending}>
                  <Trash2 className="h-3.5 w-3.5" />Excluir Permanentemente
                </Button>
              )}
            </>
          ) : (
            <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-[12px] rounded-lg" onClick={() => setConfirmDelete(true)} disabled={bulkDelete.isPending}>
              <Trash2 className="h-3.5 w-3.5" />Excluir Selecionados
            </Button>
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
          <span className="text-[13px] font-medium text-amber-800 dark:text-amber-300">Lixeira de Contatos</span>
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
                    <p className="text-[13px]">Nenhum contato encontrado</p>
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
                      ? (c.deletedAt ? new Date(c.deletedAt).toLocaleDateString("pt-BR") : "—")
                      : (c.createdAt ? new Date(c.createdAt).toLocaleDateString("pt-BR") : "—")
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
                            <DropdownMenuItem className="text-[13px]" onClick={() => restoreContacts.mutate({ tenantId: TENANT_ID, ids: [c.id] })}>
                              <RotateCcw className="mr-2 h-3.5 w-3.5" />Restaurar
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem className="text-destructive text-[13px]" onClick={() => hardDelete.mutate({ tenantId: TENANT_ID, ids: [c.id] })}>
                                <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir Permanentemente
                              </DropdownMenuItem>
                            )}
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem className="text-[13px]" asChild><Link href={`/contact/${c.id}`}><Eye className="mr-2 h-3.5 w-3.5" />Ver Perfil</Link></DropdownMenuItem>
                            <DropdownMenuItem className="text-[13px]" asChild><Link href={`/contact/${c.id}`}><Edit className="mr-2 h-3.5 w-3.5" />Editar</Link></DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive text-[13px]" onClick={() => deleteContact.mutate({ tenantId: TENANT_ID, id: c.id })}>
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

      {/* Confirm bulk soft-delete dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir {selectedIds.size} contato(s)?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-[13px] text-muted-foreground">
              Os contatos serão movidos para a lixeira. As <strong>negociações vinculadas não serão afetadas</strong>. Você pode restaurá-los a qualquer momento.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" className="rounded-lg" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
              <Button variant="destructive" className="rounded-lg" disabled={bulkDelete.isPending} onClick={() => bulkDelete.mutate({ tenantId: TENANT_ID, ids: Array.from(selectedIds) })}>
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
              Esta ação é <strong>irreversível</strong>. Os contatos serão excluídos permanentemente do banco de dados.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" className="rounded-lg" onClick={() => setConfirmHardDelete(false)}>Cancelar</Button>
              <Button variant="destructive" className="rounded-lg" disabled={hardDelete.isPending} onClick={() => hardDelete.mutate({ tenantId: TENANT_ID, ids: Array.from(selectedIds) })}>
                {hardDelete.isPending ? "Excluindo..." : "Excluir Permanentemente"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
