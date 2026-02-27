import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Users, Mail, Phone, MoreHorizontal, Trash2, Edit, Eye } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

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
  const utils = trpc.useUtils();

  const contacts = trpc.crm.contacts.list.useQuery({ tenantId: TENANT_ID, search: search || undefined, limit: 100 });
  const createContact = trpc.crm.contacts.create.useMutation({
    onSuccess: () => { utils.crm.contacts.list.invalidate(); setOpen(false); setName(""); setEmail(""); setPhone(""); toast.success("Contato criado!"); },
  });
  const deleteContact = trpc.crm.contacts.delete.useMutation({
    onSuccess: () => { utils.crm.contacts.list.invalidate(); toast.success("Contato removido."); },
  });

  const total = contacts.data?.length ?? 0;

  return (
    <div className="p-6 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground">Contatos</h1>
          <p className="text-[13px] text-muted-foreground/70 mt-0.5">{total} contato{total !== 1 ? "s" : ""}</p>
        </div>
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
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
        <Input
          className="pl-9 h-9 rounded-lg bg-muted/30 border-0 text-[13px] placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/30"
          placeholder="Buscar contatos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground/70 text-[12px]">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground/70 text-[12px]">Email</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground/70 text-[12px]">Telefone</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground/70 text-[12px]">Estágio</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground/70 text-[12px]">Criado em</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {contacts.isLoading ? (
              <tr><td colSpan={6} className="py-16 text-center">
                <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              </td></tr>
            ) : !contacts.data?.length ? (
              <tr><td colSpan={6} className="py-16 text-center text-muted-foreground/50">
                <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                <p className="text-[13px]">Nenhum contato encontrado</p>
              </td></tr>
            ) : contacts.data.map((c: any) => {
              const stage = stageConfig[c.lifecycleStage] || stageConfig["lead"];
              return (
                <tr key={c.id} className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors duration-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center text-[12px] font-semibold text-muted-foreground shrink-0">
                        {c.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <Link href={`/contact/${c.id}`} className="font-medium text-foreground hover:text-primary transition-colors cursor-pointer">{c.name}</Link>
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
                  <td className="px-4 py-3 text-muted-foreground text-[12px]">{c.createdAt ? new Date(c.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground/50 hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-lg min-w-[140px]">
                        <DropdownMenuItem className="text-[13px]" asChild><Link href={`/contact/${c.id}`}><Eye className="mr-2 h-3.5 w-3.5" />Ver Perfil</Link></DropdownMenuItem>
                        <DropdownMenuItem className="text-[13px]" asChild><Link href={`/contact/${c.id}`}><Edit className="mr-2 h-3.5 w-3.5" />Editar</Link></DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive text-[13px]" onClick={() => deleteContact.mutate({ tenantId: TENANT_ID, id: c.id })}><Trash2 className="mr-2 h-3.5 w-3.5" />Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
