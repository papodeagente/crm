import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminOnlyGuard } from "@/components/AdminOnlyGuard";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Plus, Users, Building2, Key, Activity, Crown, Lock, Loader2 } from "lucide-react";
import { formatDate, formatFullDateTime } from "../../../shared/dateUtils";
import { useState } from "react";
import { toast } from "sonner";
import { useTenantId } from "@/hooks/useTenantId";

const actionColors: Record<string, { bg: string; text: string }> = {
  create: { bg: "bg-emerald-50", text: "text-emerald-700" },
  update: { bg: "bg-blue-50", text: "text-blue-700" },
  delete: { bg: "bg-red-50", text: "text-red-700" },
  move: { bg: "bg-amber-50", text: "text-amber-700" },
};

export default function Admin() {
  const TENANT_ID = useTenantId();
  const [openUser, setOpenUser] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<"admin" | "user">("user");
  const [openTeam, setOpenTeam] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [updatingRoleFor, setUpdatingRoleFor] = useState<number | null>(null);
  const utils = trpc.useUtils();

  // Check current user role
  const saasMe = trpc.saasAuth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const currentUserRole = saasMe.data?.role || "user";
  const currentUserId = saasMe.data?.userId;
  const isCurrentAdmin = currentUserRole === "admin";

  const users = trpc.admin.users.list.useQuery({ tenantId: TENANT_ID });
  const teams = trpc.admin.teams.list.useQuery({ tenantId: TENANT_ID });
  const roles = trpc.admin.roles.list.useQuery({ tenantId: TENANT_ID });
  const eventLog = trpc.admin.eventLog.list.useQuery({ tenantId: TENANT_ID, limit: 50 });

  const createUser = trpc.admin.users.create.useMutation({
    onSuccess: () => {
      utils.admin.users.list.invalidate();
      setOpenUser(false);
      setUserName("");
      setUserEmail("");
      setUserRole("user");
      toast.success("Usuário criado!");
    },
    onError: (err) => toast.error(err.message || "Erro ao criar usuário"),
  });

  const updateUser = trpc.admin.users.update.useMutation({
    onSuccess: (_data, variables) => {
      utils.admin.users.list.invalidate();
      setUpdatingRoleFor(null);
      const newRole = variables.role === "admin" ? "Administrador" : "Usuário";
      toast.success(`Permissão alterada para ${newRole}`);
    },
    onError: (err) => {
      setUpdatingRoleFor(null);
      toast.error(err.message || "Erro ao alterar permissão");
    },
  });

  const createTeam = trpc.admin.teams.create.useMutation({
    onSuccess: () => { utils.admin.teams.list.invalidate(); setOpenTeam(false); setTeamName(""); toast.success("Equipe criada!"); },
  });

  function handleRoleChange(userId: number, newRole: "admin" | "user") {
    if (userId === currentUserId) {
      toast.error("Você não pode alterar sua própria permissão");
      return;
    }
    setUpdatingRoleFor(userId);
    updateUser.mutate({ tenantId: TENANT_ID, id: userId, role: newRole });
  }

  // Non-admin users see a restricted view
  if (!isCurrentAdmin && !saasMe.isLoading) {
    return (
      <div className="p-5 lg:px-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
            <Lock className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Acesso Restrito</h2>
          <p className="text-muted-foreground text-sm max-w-md">
            Esta página é exclusiva para administradores do tenant. 
            Entre em contato com o administrador da sua conta para obter acesso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminOnlyGuard pageTitle="Administração">
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Administração</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Gerencie usuários, equipes, permissões e auditoria.</p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="bg-muted/30 border-0 rounded-lg p-1">
          <TabsTrigger value="users" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5"><Users className="h-3.5 w-3.5" />Usuários</TabsTrigger>
          <TabsTrigger value="teams" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5"><Building2 className="h-3.5 w-3.5" />Equipes</TabsTrigger>
          <TabsTrigger value="roles" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5"><Key className="h-3.5 w-3.5" />Perfis</TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5"><Activity className="h-3.5 w-3.5" />Auditoria</TabsTrigger>
        </TabsList>

        {/* Users */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openUser} onOpenChange={setOpenUser}>
              <DialogTrigger asChild>
                <Button className="h-9 gap-2 px-5 rounded-lg bg-primary hover:bg-primary/90 shadow-sm text-[13px] font-medium transition-colors"><Plus className="h-4 w-4" />Novo Usuário</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px] rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2.5 text-lg">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><Users className="h-4 w-4 text-primary" /></div>
                    Novo Usuário
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-3">
                  <div>
                    <Label className="text-[12px] font-medium">Nome *</Label>
                    <Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Nome completo" className="mt-1.5 h-10 rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-[12px] font-medium">Email *</Label>
                    <Input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="email@exemplo.com" type="email" className="mt-1.5 h-10 rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-[12px] font-medium">Permissão *</Label>
                    <Select value={userRole} onValueChange={(v) => setUserRole(v as "admin" | "user")}>
                      <SelectTrigger className="mt-1.5 h-10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">
                          <div className="flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5 text-blue-500" />
                            <span>Usuário</span>
                            <span className="text-[10px] text-muted-foreground ml-1">— Vê apenas seus próprios dados</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Crown className="h-3.5 w-3.5 text-amber-500" />
                            <span>Administrador</span>
                            <span className="text-[10px] text-muted-foreground ml-1">— Acesso total ao tenant</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="w-full h-11 rounded-lg text-[14px] font-medium bg-primary hover:bg-primary/90 shadow-sm transition-colors"
                    disabled={!userName || !userEmail || createUser.isPending}
                    onClick={() => createUser.mutate({ tenantId: TENANT_ID, name: userName, email: userEmail, role: userRole, origin: window.location.origin })}
                  >
                    {createUser.isPending ? "Criando..." : "Criar Usuário"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-border/30 bg-muted/20">
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Nome</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Email</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Permissão</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Status</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Criado em</th>
                </tr></thead>
                <tbody>
                  {users.isLoading ? <tr><td colSpan={5} className="p-12 text-center text-muted-foreground text-sm">Carregando...</td></tr>
                  : !users.data?.length ? (
                    <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm">Nenhum usuário CRM cadastrado.</p>
                    </td></tr>
                  ) : users.data.map((u: any) => {
                    const isSelf = u.id === currentUserId;
                    const isUpdating = updatingRoleFor === u.id;
                    return (
                      <tr key={u.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-[11px] font-bold text-primary">{(u.name || "?")[0]?.toUpperCase()}</div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{u.name}</span>
                              {isSelf && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">Você</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 text-muted-foreground">{u.email}</td>
                        <td className="p-3.5">
                          {isSelf ? (
                            /* Current user cannot change their own role - show static badge */
                            u.role === "admin" ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                <Crown className="h-3 w-3" /> Administrador
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                <Shield className="h-3 w-3" /> Usuário
                              </span>
                            )
                          ) : isUpdating ? (
                            /* Show loading spinner while updating */
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" /> Alterando...
                            </span>
                          ) : (
                            /* Editable role selector for other users */
                            <Select
                              value={u.role || "user"}
                              onValueChange={(newRole) => handleRoleChange(u.id, newRole as "admin" | "user")}
                            >
                              <SelectTrigger className="h-8 w-[180px] rounded-lg border-border/40 text-[12px] font-medium bg-transparent hover:bg-muted/30 transition-colors [&>span]:flex [&>span]:items-center [&>span]:gap-1.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">
                                  <div className="flex items-center gap-2">
                                    <Crown className="h-3.5 w-3.5 text-amber-500" />
                                    <span className="font-medium">Administrador</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="user">
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-3.5 w-3.5 text-blue-500" />
                                    <span className="font-medium">Usuário</span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${
                            u.status === "active" ? "bg-emerald-50 text-emerald-700" :
                            u.status === "invited" ? "bg-amber-50 text-amber-700" :
                            "bg-zinc-100 text-zinc-600"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              u.status === "active" ? "bg-emerald-500" :
                              u.status === "invited" ? "bg-amber-500" :
                              "bg-zinc-400"
                            }`} />
                            {u.status === "active" ? "Ativo" : u.status === "invited" ? "Convidado" : u.status === "inactive" ? "Inativo" : u.status || "Ativo"}
                          </span>
                        </td>
                        <td className="p-3.5 text-muted-foreground">{u.createdAt ? formatDate(u.createdAt) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Teams */}
        <TabsContent value="teams" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openTeam} onOpenChange={setOpenTeam}>
              <DialogTrigger asChild>
                <Button className="h-9 gap-2 px-5 rounded-lg bg-primary hover:bg-primary/90 shadow-sm text-[13px] font-medium transition-colors"><Plus className="h-4 w-4" />Nova Equipe</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px] rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2.5 text-lg">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><Building2 className="h-4 w-4 text-primary" /></div>
                    Nova Equipe
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-3">
                  <div><Label className="text-[12px] font-medium">Nome *</Label><Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Ex: Vendas" className="mt-1.5 h-10 rounded-xl" /></div>
                  <Button className="w-full h-11 rounded-lg text-[14px] font-medium bg-primary hover:bg-primary/90 shadow-sm transition-colors" disabled={!teamName || createTeam.isPending} onClick={() => createTeam.mutate({ tenantId: TENANT_ID, name: teamName })}>
                    {createTeam.isPending ? "Criando..." : "Criar Equipe"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-border/30 bg-muted/20">
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Nome</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Criada em</th>
                </tr></thead>
                <tbody>
                  {teams.isLoading ? <tr><td colSpan={2} className="p-12 text-center text-muted-foreground text-sm">Carregando...</td></tr>
                  : !teams.data?.length ? (
                    <tr><td colSpan={2} className="p-12 text-center text-muted-foreground">
                      <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm">Nenhuma equipe cadastrada.</p>
                    </td></tr>
                  ) : teams.data.map((t: any) => (
                    <tr key={t.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center"><Building2 className="h-4 w-4 text-blue-600" /></div>
                          <span className="font-semibold">{t.name}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-muted-foreground">{t.createdAt ? formatDate(t.createdAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Roles */}
        <TabsContent value="roles">
          <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-border/30 bg-muted/20">
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Perfil</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Slug</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Descrição</th>
                </tr></thead>
                <tbody>
                  {roles.isLoading ? <tr><td colSpan={3} className="p-12 text-center text-muted-foreground text-sm">Carregando...</td></tr>
                  : !roles.data?.length ? (
                    <tr><td colSpan={3} className="p-12 text-center text-muted-foreground">
                      <Key className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm">Nenhum perfil configurado.</p>
                    </td></tr>
                  ) : roles.data.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-xl bg-violet-50 flex items-center justify-center"><Shield className="h-4 w-4 text-violet-600" /></div>
                          <span className="font-semibold">{r.name}</span>
                        </div>
                      </td>
                      <td className="p-3.5"><span className="text-[11px] font-mono bg-muted/40 px-2 py-0.5 rounded-md">{r.slug}</span></td>
                      <td className="p-3.5 text-muted-foreground">{r.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Audit */}
        <TabsContent value="audit">
          <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-border/30 bg-muted/20">
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Ação</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Entidade</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Usuário</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Data</th>
                </tr></thead>
                <tbody>
                  {eventLog.isLoading ? <tr><td colSpan={4} className="p-12 text-center text-muted-foreground text-sm">Carregando...</td></tr>
                  : !eventLog.data?.length ? (
                    <tr><td colSpan={4} className="p-12 text-center text-muted-foreground">
                      <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm">Nenhum evento registrado.</p>
                    </td></tr>
                  ) : eventLog.data.map((e: any) => {
                    const ac = actionColors[e.action] || { bg: "bg-slate-50", text: "text-slate-600" };
                    return (
                      <tr key={e.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                        <td className="p-3.5"><span className={`inline-flex text-[11px] font-medium px-2.5 py-1 rounded-full ${ac.bg} ${ac.text}`}>{e.action}</span></td>
                        <td className="p-3.5">{e.entityType} <span className="text-muted-foreground">#{e.entityId}</span></td>
                        <td className="p-3.5 text-muted-foreground">User #{e.actorUserId}</td>
                        <td className="p-3.5 text-muted-foreground">{e.createdAt ? formatFullDateTime(e.createdAt) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </AdminOnlyGuard>
  );
}
