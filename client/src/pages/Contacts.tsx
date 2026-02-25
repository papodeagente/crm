import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Users, Mail, Phone, MoreHorizontal, Trash2, Edit } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const TENANT_ID = 1;

const stageStyles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  lead: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Lead" },
  prospect: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Prospect" },
  customer: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Cliente" },
  churned: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Churned" },
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

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Contatos</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Gerencie seus contatos e leads.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-9 gap-2 px-5 rounded-xl shadow-soft bg-gradient-to-r from-primary to-[oklch(0.50_0.14_264)] hover:opacity-90 text-[13px] font-semibold">
              <Plus className="h-4 w-4" />Novo Contato
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[460px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-lg">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><Users className="h-4 w-4 text-primary" /></div>
                Novo Contato
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-3">
              <div><Label className="text-[12px] font-medium">Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="mt-1.5 h-10 rounded-xl" /></div>
              <div><Label className="text-[12px] font-medium">Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" type="email" className="mt-1.5 h-10 rounded-xl" /></div>
              <div><Label className="text-[12px] font-medium">Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11 99999-9999" className="mt-1.5 h-10 rounded-xl" /></div>
              <Button className="w-full h-11 rounded-xl text-[14px] font-semibold shadow-soft bg-gradient-to-r from-primary to-[oklch(0.50_0.14_264)] hover:opacity-90" disabled={!name || createContact.isPending} onClick={() => createContact.mutate({ tenantId: TENANT_ID, name, email: email || undefined, phone: phone || undefined })}>
                {createContact.isPending ? "Criando..." : "Criar Contato"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10 h-10 rounded-xl border-border/50 bg-white text-[13px]" placeholder="Buscar contatos..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card className="border-0 shadow-soft rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Nome</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Email</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Telefone</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Estágio</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Criado em</th>
                <th className="p-3.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {contacts.isLoading ? (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground text-sm">Carregando...</td></tr>
              ) : !contacts.data?.length ? (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm">Nenhum contato encontrado.</p>
                </td></tr>
              ) : contacts.data.map((c: any) => {
                const style = stageStyles[c.lifecycleStage] || stageStyles["lead"];
                return (
                  <tr key={c.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-[12px] font-bold text-primary shrink-0">
                          {c.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span className="font-semibold">{c.name}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-muted-foreground">
                      {c.email ? <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{c.email}</span> : "—"}
                    </td>
                    <td className="p-3.5 text-muted-foreground">
                      {c.phone ? <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{c.phone}</span> : "—"}
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {style.label}
                      </span>
                    </td>
                    <td className="p-3.5 text-muted-foreground">{c.createdAt ? new Date(c.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => toast("Edição em breve")}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteContact.mutate({ tenantId: TENANT_ID, id: c.id })}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
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
    </div>
  );
}
