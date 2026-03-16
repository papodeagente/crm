import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Shield, Users, Building2, Calendar, CreditCard, Search,
  Plane, ArrowLeft, Loader2, Edit, Ban, CheckCircle, Clock,
  ChevronDown, ChevronRight, User, Mail, Phone, UserCheck, UserX,
  Trash2, AlertTriangle
} from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { formatDate } from "../../../shared/dateUtils";

export default function SuperAdmin() {
  const [, navigate] = useLocation();
  const meQuery = trpc.saasAuth.me.useQuery();
  const tenantsQuery = trpc.saasAuth.adminListTenants.useQuery(undefined, {
    enabled: !!meQuery.data?.isSuperAdmin,
  });

  const [search, setSearch] = useState("");
  const [editDialog, setEditDialog] = useState<{ tenantId: number; type: "freemium" | "plan" | "status" } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ tenantId: number; tenantName: string } | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [freemiumDays, setFreemiumDays] = useState("365");
  const [selectedPlan, setSelectedPlan] = useState<"free" | "pro" | "enterprise">("free");
  const [selectedStatus, setSelectedStatus] = useState<"active" | "suspended" | "cancelled">("active");
  const [expandedTenant, setExpandedTenant] = useState<number | null>(null);

  const updateFreemiumMutation = trpc.saasAuth.adminUpdateFreemium.useMutation({
    onSuccess: () => {
      toast.success("Período freemium atualizado!");
      tenantsQuery.refetch();
      setEditDialog(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updatePlanMutation = trpc.saasAuth.adminUpdatePlan.useMutation({
    onSuccess: () => {
      toast.success("Plano atualizado!");
      tenantsQuery.refetch();
      setEditDialog(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleStatusMutation = trpc.saasAuth.adminToggleTenantStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      tenantsQuery.refetch();
      setEditDialog(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateUserStatusMutation = trpc.saasAuth.adminUpdateUserStatus.useMutation({
    onSuccess: () => {
      toast.success("Status do usuário atualizado!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteTenantMutation = trpc.saasAuth.adminDeleteTenant.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Agência excluída com sucesso! ${data.deletedTables.length} tabelas limpas.`);
      } else {
        toast.warning(`Agência excluída com ${data.errors.length} erros. Verifique o console.`);
        console.warn("[Delete Tenant] Errors:", data.errors);
      }
      tenantsQuery.refetch();
      setDeleteDialog(null);
      setDeleteConfirmName("");
      setDeleteStep(1);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Auth check
  if (meQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!meQuery.data?.isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md border-border">
          <CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2 text-foreground">Acesso Restrito</h2>
            <p className="text-muted-foreground mb-4">Esta área é exclusiva para administradores do sistema.</p>
            <Button onClick={() => navigate("/dashboard")}>Voltar ao Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredTenants = (tenantsQuery.data || []).filter((t: any) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.hotmartEmail?.toLowerCase().includes(search.toLowerCase())
  );

  const planBadge = (plan: string) => {
    switch (plan) {
      case "pro": return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/20">Pro</Badge>;
      case "enterprise": return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/20">Enterprise</Badge>;
      default: return <Badge variant="secondary">Free</Badge>;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">Ativo</Badge>;
      case "suspended": return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">Suspenso</Badge>;
      case "cancelled": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20">Cancelado</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const userStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs hover:bg-emerald-500/20">Ativo</Badge>;
      case "inactive": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs hover:bg-red-500/20">Inativo</Badge>;
      case "invited": return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs hover:bg-blue-500/20">Convidado</Badge>;
      default: return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const getDaysLeft = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border sticky top-0 z-40 bg-card/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663249817763/XXuAsdiNIcgnwwra.png"
                alt="ENTUR OS"
                className="h-8 w-8 rounded-lg"
              />
              <span className="font-bold text-lg">Super Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4 text-purple-400" />
            {meQuery.data?.email}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: <Building2 className="w-5 h-5" />, label: "Total de Agências", value: filteredTenants.length, color: "text-purple-400 bg-purple-500/10" },
            { icon: <Users className="w-5 h-5" />, label: "Total de Usuários", value: filteredTenants.reduce((acc: number, t: any) => acc + t.userCount, 0), color: "text-blue-400 bg-blue-500/10" },
            { icon: <CheckCircle className="w-5 h-5" />, label: "Agências Ativas", value: filteredTenants.filter((t: any) => t.status === "active").length, color: "text-emerald-400 bg-emerald-500/10" },
            { icon: <CreditCard className="w-5 h-5" />, label: "Plano Pro", value: filteredTenants.filter((t: any) => t.plan === "pro").length, color: "text-amber-400 bg-amber-500/10" },
          ].map((stat, i) => (
            <Card key={i} className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tenants list */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-400" />
              Agências ({filteredTenants.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left p-4 font-medium w-8"></th>
                    <th className="text-left p-4 font-medium">Agência</th>
                    <th className="text-left p-4 font-medium">Email</th>
                    <th className="text-left p-4 font-medium">Plano</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Freemium</th>
                    <th className="text-left p-4 font-medium">Usuários</th>
                    <th className="text-left p-4 font-medium">Criado em</th>
                    <th className="text-right p-4 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((tenant: any) => {
                    const daysLeft = getDaysLeft(tenant.freemiumExpiresAt);
                    const isExpanded = expandedTenant === tenant.id;
                    return (
                      <>
                        <tr key={tenant.id} className={`border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer ${isExpanded ? "bg-accent/20" : ""}`}>
                          <td className="p-4" onClick={() => setExpandedTenant(isExpanded ? null : tenant.id)}>
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </td>
                          <td className="p-4 font-medium text-foreground" onClick={() => setExpandedTenant(isExpanded ? null : tenant.id)}>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-400 text-xs font-bold">
                                {tenant.name.charAt(0).toUpperCase()}
                              </div>
                              {tenant.name}
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">{tenant.hotmartEmail || "—"}</td>
                          <td className="p-4">{planBadge(tenant.plan)}</td>
                          <td className="p-4">{statusBadge(tenant.status)}</td>
                          <td className="p-4">
                            {tenant.plan === "free" && daysLeft !== null ? (
                              <span className={`text-sm font-medium ${daysLeft <= 30 ? "text-amber-400" : "text-emerald-400"}`}>
                                {daysLeft > 0 ? `${daysLeft} dias` : "Expirado"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-4 text-muted-foreground">{tenant.userCount}</td>
                          <td className="p-4 text-muted-foreground">
                            {formatDate(tenant.createdAt)}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="Alterar período freemium"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFreemiumDays(String(tenant.freemiumDays || 365));
                                  setEditDialog({ tenantId: tenant.id, type: "freemium" });
                                }}
                              >
                                <Clock className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="Alterar plano"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPlan(tenant.plan);
                                  setEditDialog({ tenantId: tenant.id, type: "plan" });
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="Alterar status"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStatus(tenant.status);
                                  setEditDialog({ tenantId: tenant.id, type: "status" });
                                }}
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                              {tenant.name.toLowerCase() === "entur" ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground/30 cursor-not-allowed"
                                  title="Tenant raiz — não pode ser excluído"
                                  disabled
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  title="Excluir agência permanentemente"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteDialog({ tenantId: tenant.id, tenantName: tenant.name });
                                    setDeleteConfirmName("");
                                    setDeleteStep(1);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${tenant.id}-users`}>
                            <td colSpan={9} className="p-0">
                              <TenantUsersPanel
                                tenantId={tenant.id}
                                tenantName={tenant.name}
                                userStatusBadge={userStatusBadge}
                                updateUserStatusMutation={updateUserStatusMutation}
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                  {filteredTenants.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        Nenhuma agência encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editDialog?.type === "freemium" && "Alterar Período Freemium"}
              {editDialog?.type === "plan" && "Alterar Plano"}
              {editDialog?.type === "status" && "Alterar Status"}
            </DialogTitle>
          </DialogHeader>

          {editDialog?.type === "freemium" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Dias de freemium (a partir de hoje)</Label>
                <Input
                  type="number"
                  min={7}
                  value={freemiumDays}
                  onChange={(e) => setFreemiumDays(e.target.value)}
                  placeholder="365"
                />
                <p className="text-xs text-muted-foreground">Mínimo: 7 dias. O período será recalculado a partir de hoje.</p>
              </div>
            </div>
          )}

          {editDialog?.type === "plan" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={selectedPlan} onValueChange={(v: any) => setSelectedPlan(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free (Freemium)</SelectItem>
                    <SelectItem value="pro">Pro (R$97/mês)</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {editDialog?.type === "status" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={selectedStatus} onValueChange={(v: any) => setSelectedStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancelar</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={updateFreemiumMutation.isPending || updatePlanMutation.isPending || toggleStatusMutation.isPending}
              onClick={() => {
                if (!editDialog) return;
                if (editDialog.type === "freemium") {
                  updateFreemiumMutation.mutate({ tenantId: editDialog.tenantId, days: parseInt(freemiumDays) });
                } else if (editDialog.type === "plan") {
                  updatePlanMutation.mutate({ tenantId: editDialog.tenantId, plan: selectedPlan });
                } else if (editDialog.type === "status") {
                  toggleStatusMutation.mutate({ tenantId: editDialog.tenantId, status: selectedStatus });
                }
              }}
            >
              {(updateFreemiumMutation.isPending || updatePlanMutation.isPending || toggleStatusMutation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Tenant Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) { setDeleteDialog(null); setDeleteConfirmName(""); setDeleteStep(1); } }}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              Excluir Agência Permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {deleteStep === 1 && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Você está prestes a excluir <strong className="text-foreground">{deleteDialog?.tenantName}</strong> e <strong className="text-red-400">TODOS os dados associados</strong>.
                    </p>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                      <p className="font-semibold mb-1">Esta ação irá excluir permanentemente:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li>Todos os contatos, negociações e pipelines</li>
                        <li>Todas as mensagens e conversas do WhatsApp</li>
                        <li>Todas as automações e configurações</li>
                        <li>Todos os usuários e permissões</li>
                        <li>Todos os produtos, propostas e tarefas</li>
                        <li>Todas as integrações e webhooks</li>
                        <li>A própria conta da agência</li>
                      </ul>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                      Esta ação é <strong className="text-red-400">irreversível</strong>. Se a agência for recriada, começará completamente do zero.
                    </p>
                  </>
                )}
                {deleteStep === 2 && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Para confirmar, digite o nome exato da agência:
                    </p>
                    <div className="bg-accent/50 rounded-lg p-3 text-center">
                      <code className="text-foreground font-bold text-lg">{deleteDialog?.tenantName}</code>
                    </div>
                    <Input
                      placeholder="Digite o nome da agência para confirmar"
                      value={deleteConfirmName}
                      onChange={(e) => setDeleteConfirmName(e.target.value)}
                      className="border-red-500/30 focus:border-red-500"
                      autoFocus
                    />
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteDialog(null); setDeleteConfirmName(""); setDeleteStep(1); }}>
              Cancelar
            </AlertDialogCancel>
            {deleteStep === 1 ? (
              <Button
                variant="destructive"
                onClick={() => setDeleteStep(2)}
              >
                Continuar
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={
                  deleteConfirmName.toLowerCase() !== deleteDialog?.tenantName.toLowerCase() ||
                  deleteTenantMutation.isPending
                }
                onClick={() => {
                  if (!deleteDialog) return;
                  deleteTenantMutation.mutate({
                    tenantId: deleteDialog.tenantId,
                    confirmName: deleteConfirmName,
                  });
                }}
              >
                {deleteTenantMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Excluindo...</>
                ) : (
                  <><Trash2 className="w-4 h-4 mr-2" /> Excluir Permanentemente</>
                )}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── Tenant Users Panel (expandable row) ─── */
function TenantUsersPanel({
  tenantId,
  tenantName,
  userStatusBadge,
  updateUserStatusMutation,
}: {
  tenantId: number;
  tenantName: string;
  userStatusBadge: (status: string) => React.ReactNode;
  updateUserStatusMutation: any;
}) {
  const usersQuery = trpc.saasAuth.adminListTenantUsers.useQuery(
    { tenantId },
    { enabled: true }
  );

  if (usersQuery.isLoading) {
    return (
      <div className="bg-accent/10 border-t border-border p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Carregando usuários...</span>
      </div>
    );
  }

  const users = usersQuery.data || [];

  return (
    <div className="bg-accent/10 border-t border-border">
      <div className="px-6 py-3 border-b border-border/50">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          Usuários de {tenantName} ({users.length})
        </h4>
      </div>
      {users.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground text-sm">
          Nenhum usuário cadastrado nesta agência
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {users.map((user: any) => (
            <div key={user.id} className="px-6 py-3 flex items-center gap-4 hover:bg-accent/20 transition-colors">
              <div className="w-9 h-9 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-400 text-sm font-bold shrink-0">
                {user.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground text-sm truncate">{user.name}</span>
                  {userStatusBadge(user.status)}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {user.email}
                  </span>
                  {user.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {user.phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Criado em {formatDate(user.createdAt)}
                  </span>
                  {user.lastLoginAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Último login: {formatDate(user.lastLoginAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {user.status === "active" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => {
                      updateUserStatusMutation.mutate(
                        { userId: user.id, status: "inactive" as const },
                        { onSuccess: () => usersQuery.refetch() }
                      );
                    }}
                    disabled={updateUserStatusMutation.isPending}
                  >
                    <UserX className="w-3.5 h-3.5 mr-1" />
                    Desativar
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                    onClick={() => {
                      updateUserStatusMutation.mutate(
                        { userId: user.id, status: "active" as const },
                        { onSuccess: () => usersQuery.refetch() }
                      );
                    }}
                    disabled={updateUserStatusMutation.isPending}
                  >
                    <UserCheck className="w-3.5 h-3.5 mr-1" />
                    Ativar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
