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
  Plane, ArrowLeft, Loader2, Edit, Ban, CheckCircle, Clock
} from "lucide-react";

export default function SuperAdmin() {
  const [, navigate] = useLocation();
  const meQuery = trpc.saasAuth.me.useQuery();
  const tenantsQuery = trpc.saasAuth.adminListTenants.useQuery(undefined, {
    enabled: !!meQuery.data?.isSuperAdmin,
  });

  const [search, setSearch] = useState("");
  const [editDialog, setEditDialog] = useState<{ tenantId: number; type: "freemium" | "plan" | "status" } | null>(null);
  const [freemiumDays, setFreemiumDays] = useState("365");
  const [selectedPlan, setSelectedPlan] = useState<"free" | "pro" | "enterprise">("free");
  const [selectedStatus, setSelectedStatus] = useState<"active" | "suspended" | "cancelled">("active");

  const updateFreemiumMutation = trpc.saasAuth.adminUpdateFreemium.useMutation({
    onSuccess: () => {
      toast.success("Período freemium atualizado!");
      tenantsQuery.refetch();
      setEditDialog(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const updatePlanMutation = trpc.saasAuth.adminUpdatePlan.useMutation({
    onSuccess: () => {
      toast.success("Plano atualizado!");
      tenantsQuery.refetch();
      setEditDialog(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleStatusMutation = trpc.saasAuth.adminToggleTenantStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      tenantsQuery.refetch();
      setEditDialog(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Auth check
  if (meQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!meQuery.data?.isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-slate-500 mb-4">Esta área é exclusiva para administradores do sistema.</p>
            <Button onClick={() => navigate("/login")}>Fazer login</Button>
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
      case "pro": return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Pro</Badge>;
      case "enterprise": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Enterprise</Badge>;
      default: return <Badge variant="secondary">Free</Badge>;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Ativo</Badge>;
      case "suspended": return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Suspenso</Badge>;
      case "cancelled": return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelado</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDaysLeft = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="text-slate-400 hover:text-slate-600">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center">
                <Plane className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg">Super Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Shield className="w-4 h-4" />
            {meQuery.data?.email}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: <Building2 className="w-5 h-5" />, label: "Total de Tenants", value: filteredTenants.length },
            { icon: <Users className="w-5 h-5" />, label: "Total de Usuários", value: filteredTenants.reduce((acc: number, t: any) => acc + t.userCount, 0) },
            { icon: <CheckCircle className="w-5 h-5" />, label: "Ativos", value: filteredTenants.filter((t: any) => t.status === "active").length },
            { icon: <CreditCard className="w-5 h-5" />, label: "Plano Pro", value: filteredTenants.filter((t: any) => t.plan === "pro").length },
          ].map((stat, i) => (
            <Card key={i} className="bg-white">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
                  {stat.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
        </div>

        {/* Tenants table */}
        <Card className="bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Tenants ({filteredTenants.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
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
                    return (
                      <tr key={tenant.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="p-4 font-medium">{tenant.name}</td>
                        <td className="p-4 text-slate-500">{tenant.hotmartEmail || "—"}</td>
                        <td className="p-4">{planBadge(tenant.plan)}</td>
                        <td className="p-4">{statusBadge(tenant.status)}</td>
                        <td className="p-4">
                          {tenant.plan === "free" && daysLeft !== null ? (
                            <span className={`text-sm font-medium ${daysLeft <= 30 ? "text-amber-600" : "text-green-600"}`}>
                              {daysLeft > 0 ? `${daysLeft} dias` : "Expirado"}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-500">{tenant.userCount}</td>
                        <td className="p-4 text-slate-500">
                          {new Date(tenant.createdAt).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Alterar período freemium"
                              onClick={() => {
                                setFreemiumDays(String(tenant.freemiumDays || 365));
                                setEditDialog({ tenantId: tenant.id, type: "freemium" });
                              }}
                            >
                              <Clock className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Alterar plano"
                              onClick={() => {
                                setSelectedPlan(tenant.plan);
                                setEditDialog({ tenantId: tenant.id, type: "plan" });
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Alterar status"
                              onClick={() => {
                                setSelectedStatus(tenant.status);
                                setEditDialog({ tenantId: tenant.id, type: "status" });
                              }}
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTenants.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        Nenhum tenant encontrado
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
                <p className="text-xs text-slate-500">Mínimo: 7 dias. O período será recalculado a partir de hoje.</p>
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
    </div>
  );
}
