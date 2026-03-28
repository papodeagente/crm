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
