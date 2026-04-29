import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  UserMinus,
  Search,
  Loader2,
  Mail,
  Calendar,
  Crown,
  Users,
  AlertTriangle,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";

function formatDate(d: string | Date | number | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SuperAdminManagement() {
  const utils = trpc.useUtils();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [demoteTarget, setDemoteTarget] = useState<{
    id: number;
    name: string | null;
    email: string | null;
  } | null>(null);

  // Queries
  const listQ = trpc.superAdminManagement.list.useQuery();
  const countQ = trpc.superAdminManagement.count.useQuery();

  // Mutations
  const promoteByEmailMut = trpc.superAdminManagement.promoteByEmail.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.name || data.email} promovido a Super Admin`);
      utils.superAdminManagement.list.invalidate();
      utils.superAdminManagement.count.invalidate();
      setShowAddDialog(false);
      setEmailInput("");
    },
    onError: (e) => toast.error(e.message),
  });

  const demoteMut = trpc.superAdminManagement.demote.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.name || data.email} removido de Super Admin`);
      utils.superAdminManagement.list.invalidate();
      utils.superAdminManagement.count.invalidate();
      setDemoteTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  // ─── Reset de senha manual ───
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetShowPwd, setResetShowPwd] = useState(false);
  const [resetConfirm, setResetConfirm] = useState<{ email: string; password: string } | null>(null);
  const resetPasswordMut = trpc.superAdminManagement.resetUserPassword.useMutation({
    onSuccess: (data) => {
      toast.success(`Senha de ${data.email} (tenant ${data.tenantId}) atualizada`);
      setResetEmail("");
      setResetPassword("");
      setResetShowPwd(false);
      setResetConfirm(null);
    },
    onError: (e) => {
      toast.error(e.message);
      setResetConfirm(null);
    },
  });

  const handleResetSubmit = () => {
    const email = resetEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Informe um email válido");
      return;
    }
    if (resetPassword.length < 8) {
      toast.error("Senha precisa ter pelo menos 8 caracteres");
      return;
    }
    setResetConfirm({ email, password: resetPassword });
  };

  // ─── Criar usuário em qualquer tenant ───
  const tenantsListQ = trpc.superAdminManagement.listTenants.useQuery();
  const [newUserTenantId, setNewUserTenantId] = useState<string>("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "user">("admin");
  const [newUserShowPwd, setNewUserShowPwd] = useState(false);
  const createUserMut = trpc.superAdminManagement.createUserInTenant.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.email} criado em ${data.tenantName} (tenant ${data.tenantId})`);
      setNewUserTenantId("");
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("admin");
      setNewUserShowPwd(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCreateUserSubmit = () => {
    const tid = Number(newUserTenantId);
    if (!tid) return toast.error("Escolha um tenant");
    if (!newUserName.trim()) return toast.error("Informe o nome");
    if (!newUserEmail.trim() || !newUserEmail.includes("@")) return toast.error("Email inválido");
    if (newUserPassword.length < 8) return toast.error("Senha precisa ter pelo menos 8 caracteres");
    createUserMut.mutate({
      tenantId: tid,
      name: newUserName.trim(),
      email: newUserEmail.trim().toLowerCase(),
      password: newUserPassword,
      role: newUserRole,
    });
  };

  const handlePromote = () => {
    if (!emailInput.trim()) {
      toast.error("Informe um email válido");
      return;
    }
    promoteByEmailMut.mutate({ email: emailInput.trim().toLowerCase() });
  };

  const handleDemote = () => {
    if (!demoteTarget) return;
    demoteMut.mutate({ userId: demoteTarget.id });
  };

  const superAdmins = listQ.data ?? [];
  const totalCount = countQ.data?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-400" />
            Administração de Super Admins
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie quem tem acesso ao painel de Super Admin do sistema
          </p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="gap-2 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Adicionar Super Admin
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  Total de Super Admins
                </p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {listQ.isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    totalCount
                  )}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/10 text-purple-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  Protegidos
                </p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {listQ.isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    superAdmins.filter((a) => a.isProtected).length
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Não podem ser removidos
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-400">
                <Crown className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  Removíveis
                </p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {listQ.isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    superAdmins.filter((a) => !a.isProtected).length
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Podem ser rebaixados
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Super Admins List */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-purple-400" />
            Super Admins Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listQ.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : listQ.error ? (
            <div className="flex items-center justify-center py-12 text-red-400 gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm">
                Erro ao carregar: {listQ.error.message}
              </span>
            </div>
          ) : superAdmins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Shield className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Nenhum super admin encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {superAdmins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border transition-colors bg-background/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        admin.isProtected
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-purple-500/10 text-purple-400"
                      }`}
                    >
                      {admin.isProtected ? (
                        <Crown className="w-4 h-4" />
                      ) : (
                        <Shield className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {admin.name || "Sem nome"}
                        </span>
                        {admin.isProtected && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-400 shrink-0"
                          >
                            Protegido
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 shrink-0" />
                          {admin.email}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 hidden sm:flex">
                          <Calendar className="w-3 h-3" />
                          {formatDate(admin.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 ml-2">
                    {admin.isProtected ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-2 py-1 cursor-not-allowed opacity-60"
                      >
                        Permanente
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5 text-xs"
                        onClick={() =>
                          setDemoteTarget({
                            id: admin.id,
                            name: admin.name,
                            email: admin.email,
                          })
                        }
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Remover</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-border/50 bg-amber-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Informações importantes
              </p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-1 list-disc list-inside">
                <li>
                  Super Admins possuem acesso total ao painel de administração
                  do sistema.
                </li>
                <li>
                  O email <strong>bruno@entur.com.br</strong> é protegido e não
                  pode ser removido como Super Admin.
                </li>
                <li>
                  Você não pode remover a si mesmo como Super Admin.
                </li>
                <li>
                  O usuário precisa ter feito login pelo menos uma vez no
                  sistema para ser promovido.
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Criar Usuário em Qualquer Tenant ─── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-400" />
            Criar usuário em qualquer tenant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Cria diretamente no banco com a senha informada — sem passar pelo fluxo de convite/email.
            O status já vai como <strong>active</strong>. Use para suporte ou onboarding manual.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-tenant">Tenant *</Label>
              <select
                id="new-tenant"
                value={newUserTenantId}
                onChange={(e) => setNewUserTenantId(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Selecione...</option>
                {(tenantsListQ.data || []).map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.id} — {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-role">Permissão</Label>
              <select
                id="new-role"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as "admin" | "user")}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="admin">Administrador</option>
                <option value="user">Usuário</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Nome *</Label>
              <Input
                id="new-name"
                placeholder="Nome completo"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-email">Email *</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="usuario@cliente.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="new-password">Senha (mín. 8 caracteres) *</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={newUserShowPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setNewUserShowPwd(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  title={newUserShowPwd ? "Ocultar" : "Mostrar"}
                >
                  {newUserShowPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleCreateUserSubmit}
              disabled={createUserMut.isPending}
              className="gap-2"
            >
              {createUserMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Criar usuário
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Reset Manual de Senha ─── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            Resetar senha de usuário
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Defina manualmente uma nova senha para qualquer usuário em qualquer tenant.
            Use apenas para suporte. A nova senha entra em vigor imediatamente — comunique pelo canal seguro.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reset-email">Email do usuário</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="usuario@cliente.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-password">Nova senha (mín. 8 caracteres)</Label>
              <div className="relative">
                <Input
                  id="reset-password"
                  type={resetShowPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setResetShowPwd(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  title={resetShowPwd ? "Ocultar" : "Mostrar"}
                >
                  {resetShowPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleResetSubmit}
              disabled={!resetEmail.trim() || !resetPassword || resetPasswordMut.isPending}
              className="gap-2"
            >
              {resetPasswordMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Definir nova senha
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmação de reset de senha */}
      <AlertDialog open={!!resetConfirm} onOpenChange={(o) => !o && setResetConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              Confirmar reset de senha
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você vai definir uma nova senha para <strong>{resetConfirm?.email}</strong>.
              O usuário perde acesso à senha atual no momento da confirmação. Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (resetConfirm) {
                  resetPasswordMut.mutate({ email: resetConfirm.email, newPassword: resetConfirm.password });
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Super Admin Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-purple-400" />
              Adicionar Super Admin
            </DialogTitle>
            <DialogDescription>
              Informe o email do usuário que deseja promover a Super Admin. O
              usuário precisa ter feito login no sistema pelo menos uma vez.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="email-input">Email do usuário</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email-input"
                  type="email"
                  placeholder="usuario@exemplo.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePromote();
                  }}
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setEmailInput("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePromote}
              disabled={
                !emailInput.trim() || promoteByEmailMut.isPending
              }
              className="gap-2"
            >
              {promoteByEmailMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              Promover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Demote Confirmation Dialog */}
      <AlertDialog
        open={!!demoteTarget}
        onOpenChange={(open) => {
          if (!open) setDemoteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserMinus className="w-5 h-5 text-red-400" />
              Remover Super Admin
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover{" "}
              <strong>{demoteTarget?.name || demoteTarget?.email}</strong> como
              Super Admin? Esta pessoa perderá acesso ao painel de
              administração.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDemote}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={demoteMut.isPending}
            >
              {demoteMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserMinus className="w-4 h-4 mr-2" />
              )}
              Confirmar Remoção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
