import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Plus, Users, Building2, Key, Activity } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TENANT_ID = 1;

export default function Admin() {
  const [openUser, setOpenUser] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [openTeam, setOpenTeam] = useState(false);
  const [teamName, setTeamName] = useState("");
  const utils = trpc.useUtils();

  const users = trpc.admin.users.list.useQuery({ tenantId: TENANT_ID });
  const teams = trpc.admin.teams.list.useQuery({ tenantId: TENANT_ID });
  const roles = trpc.admin.roles.list.useQuery({ tenantId: TENANT_ID });
  const eventLog = trpc.admin.eventLog.list.useQuery({ tenantId: TENANT_ID, limit: 50 });

  const createUser = trpc.admin.users.create.useMutation({
    onSuccess: () => { utils.admin.users.list.invalidate(); setOpenUser(false); setUserName(""); setUserEmail(""); toast.success("Usuário criado!"); },
  });
  const createTeam = trpc.admin.teams.create.useMutation({
    onSuccess: () => { utils.admin.teams.list.invalidate(); setOpenTeam(false); setTeamName(""); toast.success("Equipe criada!"); },
  });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Administração</h1><p className="text-muted-foreground">Gerencie usuários, equipes, permissões e auditoria.</p></div>
      <Tabs defaultValue="users">
        <TabsList><TabsTrigger value="users">Usuários</TabsTrigger><TabsTrigger value="teams">Equipes</TabsTrigger><TabsTrigger value="roles">Perfis</TabsTrigger><TabsTrigger value="audit">Auditoria</TabsTrigger></TabsList>

        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={openUser} onOpenChange={setOpenUser}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Usuário</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Usuário</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div><Label>Nome *</Label><Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Nome completo" /></div>
                  <div><Label>Email *</Label><Input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="email@exemplo.com" type="email" /></div>
                  <Button className="w-full" disabled={!userName || !userEmail} onClick={() => createUser.mutate({ tenantId: TENANT_ID, name: userName, email: userEmail })}>Criar Usuário</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card><CardContent className="p-0"><table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/30"><th className="text-left p-3 font-medium">Nome</th><th className="text-left p-3 font-medium">Email</th><th className="text-left p-3 font-medium">Status</th><th className="text-left p-3 font-medium">Criado em</th></tr></thead>
            <tbody>
              {users.isLoading ? <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
              : !users.data?.length ? <tr><td colSpan={4} className="p-8 text-center text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2 opacity-40" />Nenhum usuário CRM cadastrado.</td></tr>
              : users.data.map((u: any) => (
                <tr key={u.id} className="border-b hover:bg-muted/20"><td className="p-3 font-medium">{u.name}</td><td className="p-3 text-muted-foreground">{u.email}</td><td className="p-3"><Badge variant="secondary">{u.status || "active"}</Badge></td><td className="p-3 text-muted-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("pt-BR") : "—"}</td></tr>
              ))}
            </tbody>
          </table></CardContent></Card>
        </TabsContent>

        <TabsContent value="teams" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={openTeam} onOpenChange={setOpenTeam}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Equipe</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Equipe</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div><Label>Nome *</Label><Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Ex: Vendas" /></div>
                  <Button className="w-full" disabled={!teamName} onClick={() => createTeam.mutate({ tenantId: TENANT_ID, name: teamName })}>Criar Equipe</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card><CardContent className="p-0"><table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/30"><th className="text-left p-3 font-medium">Nome</th><th className="text-left p-3 font-medium">Criada em</th></tr></thead>
            <tbody>
              {teams.isLoading ? <tr><td colSpan={2} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
              : !teams.data?.length ? <tr><td colSpan={2} className="p-8 text-center text-muted-foreground"><Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />Nenhuma equipe cadastrada.</td></tr>
              : teams.data.map((t: any) => (
                <tr key={t.id} className="border-b hover:bg-muted/20"><td className="p-3 font-medium">{t.name}</td><td className="p-3 text-muted-foreground">{t.createdAt ? new Date(t.createdAt).toLocaleDateString("pt-BR") : "—"}</td></tr>
              ))}
            </tbody>
          </table></CardContent></Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <Card><CardContent className="p-0"><table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/30"><th className="text-left p-3 font-medium">Perfil</th><th className="text-left p-3 font-medium">Slug</th><th className="text-left p-3 font-medium">Descrição</th></tr></thead>
            <tbody>
              {roles.isLoading ? <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
              : !roles.data?.length ? <tr><td colSpan={3} className="p-8 text-center text-muted-foreground"><Key className="h-8 w-8 mx-auto mb-2 opacity-40" />Nenhum perfil configurado.</td></tr>
              : roles.data.map((r: any) => (
                <tr key={r.id} className="border-b hover:bg-muted/20"><td className="p-3 font-medium">{r.name}</td><td className="p-3"><Badge variant="secondary">{r.slug}</Badge></td><td className="p-3 text-muted-foreground">{r.description || "—"}</td></tr>
              ))}
            </tbody>
          </table></CardContent></Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card><CardContent className="p-0"><table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/30"><th className="text-left p-3 font-medium">Ação</th><th className="text-left p-3 font-medium">Entidade</th><th className="text-left p-3 font-medium">Usuário</th><th className="text-left p-3 font-medium">Data</th></tr></thead>
            <tbody>
              {eventLog.isLoading ? <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
              : !eventLog.data?.length ? <tr><td colSpan={4} className="p-8 text-center text-muted-foreground"><Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />Nenhum evento registrado.</td></tr>
              : eventLog.data.map((e: any) => (
                <tr key={e.id} className="border-b hover:bg-muted/20"><td className="p-3"><Badge variant="secondary">{e.action}</Badge></td><td className="p-3">{e.entityType} #{e.entityId}</td><td className="p-3 text-muted-foreground">User #{e.actorUserId}</td><td className="p-3 text-muted-foreground">{e.createdAt ? new Date(e.createdAt).toLocaleString("pt-BR") : "—"}</td></tr>
              ))}
            </tbody>
          </table></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
