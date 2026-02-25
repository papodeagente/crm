import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const stageColors: Record<string, string> = { lead: "bg-blue-100 text-blue-700", prospect: "bg-amber-100 text-amber-700", customer: "bg-emerald-100 text-emerald-700", churned: "bg-red-100 text-red-700" };
  const stageLabels: Record<string, string> = { lead: "Lead", prospect: "Prospect", customer: "Cliente", churned: "Churned" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contatos</h1>
          <p className="text-muted-foreground">Gerencie seus contatos e leads.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Contato</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Contato</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" /></div>
              <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" type="email" /></div>
              <div><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11 99999-9999" /></div>
              <Button className="w-full" disabled={!name || createContact.isPending} onClick={() => createContact.mutate({ tenantId: TENANT_ID, name, email: email || undefined, phone: phone || undefined })}>
                {createContact.isPending ? "Criando..." : "Criar Contato"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar contatos..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Telefone</th>
                  <th className="text-left p-3 font-medium">Estágio</th>
                  <th className="text-left p-3 font-medium">Criado em</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.isLoading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
                ) : !contacts.data?.length ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2 opacity-40" />Nenhum contato encontrado.</td></tr>
                ) : contacts.data.map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 text-muted-foreground">{c.email || "—"}</td>
                    <td className="p-3 text-muted-foreground">{c.phone || "—"}</td>
                    <td className="p-3"><Badge variant="secondary" className={stageColors[c.lifecycleStage] || ""}>{stageLabels[c.lifecycleStage] || c.lifecycleStage}</Badge></td>
                    <td className="p-3 text-muted-foreground">{c.createdAt ? new Date(c.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toast("Edição em breve")}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteContact.mutate({ tenantId: TENANT_ID, id: c.id })}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
