import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Search,
  Shield,
  Wifi,
  WifiOff,
  Plus,
  Trash2,
  RefreshCw,
  Building2,
  Phone,
  Signal,
  SignalZero,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  ServerCrash,
} from "lucide-react";

export default function ZapiAdmin() {
  const [, navigate] = useLocation();
  const meQuery = trpc.saasAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const statsQuery = trpc.zapiAdmin.getStats.useQuery(undefined, {
    enabled: !!meQuery.data?.isSuperAdmin,
  });

  const instancesQuery = trpc.zapiAdmin.listInstances.useQuery(undefined, {
    enabled: !!meQuery.data?.isSuperAdmin,
  });

  const tenantsWithoutQuery = trpc.zapiAdmin.listTenantsWithoutZapi.useQuery(undefined, {
    enabled: !!meQuery.data?.isSuperAdmin,
  });

  const provisionMutation = trpc.zapiAdmin.provisionForTenant.useMutation({
    onSuccess: (data) => {
      if (data.alreadyProvisioned) {
        toast.info(`Tenant "${data.tenantName}" já possui instância Z-API ativa.`);
      } else {
        toast.success(`Z-API provisionado com sucesso para "${data.tenantName}"!`);
      }
      instancesQuery.refetch();
      tenantsWithoutQuery.refetch();
      statsQuery.refetch();
      setProvisionDialog(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deprovisionMutation = trpc.zapiAdmin.deprovisionForTenant.useMutation({
    onSuccess: () => {
      toast.success("Instância Z-API revogada com sucesso!");
      instancesQuery.refetch();
      tenantsWithoutQuery.refetch();
      statsQuery.refetch();
      setDeprovisionDialog(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [provisionDialog, setProvisionDialog] = useState<{ tenantId: number; tenantName: string } | null>(null);
  const [deprovisionDialog, setDeprovisionDialog] = useState<{ tenantId: number; tenantName: string } | null>(null);

  // Filter instances
  const filteredInstances = useMemo(() => {
    if (!instancesQuery.data) return [];
    return instancesQuery.data.filter((inst) => {
      const matchesSearch =
        !search ||
        inst.tenantName?.toLowerCase().includes(search.toLowerCase()) ||
        inst.instanceName?.toLowerCase().includes(search.toLowerCase()) ||
        inst.zapiInstanceId?.includes(search) ||
        String(inst.tenantId).includes(search);
      const matchesStatus = statusFilter === "all" || inst.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [instancesQuery.data, search, statusFilter]);

  // Filter tenants without Z-API for provision dialog
  const filteredTenantsWithout = useMemo(() => {
    if (!tenantsWithoutQuery.data) return [];
    return tenantsWithoutQuery.data.filter(
      (t) => t.status === "active"
    );
  }, [tenantsWithoutQuery.data]);

  const formatDate = (d: any) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30" variant="outline">
            <CheckCircle className="w-3 h-3 mr-1" /> Ativa
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-500/15 text-red-500 border-red-500/30" variant="outline">
            <XCircle className="w-3 h-3 mr-1" /> Cancelada
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30" variant="outline">
            <Clock className="w-3 h-3 mr-1" /> Pendente
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-gray-500/15 text-gray-500 border-gray-500/30" variant="outline">
            <AlertTriangle className="w-3 h-3 mr-1" /> Expirada
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const whatsappStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30" variant="outline">
            <Wifi className="w-3 h-3 mr-1" /> Conectado
          </Badge>
        );
      case "disconnected":
        return (
          <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/30" variant="outline">
            <WifiOff className="w-3 h-3 mr-1" /> Desconectado
          </Badge>
        );
      case "deleted":
        return (
          <Badge className="bg-red-500/15 text-red-400 border-red-500/30" variant="outline">
            <ServerCrash className="w-3 h-3 mr-1" /> Removido
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-500/15 text-gray-400 border-gray-500/30" variant="outline">
            <SignalZero className="w-3 h-3 mr-1" /> Desconhecido
          </Badge>
        );
    }
  };

  const billingBadge = (billingStatus: string | null) => {
    switch (billingStatus) {
      case "active":
        return <Badge className="bg-emerald-500/10 text-emerald-500 text-[10px]" variant="outline">Pago</Badge>;
      case "trialing":
        return <Badge className="bg-blue-500/10 text-blue-500 text-[10px]" variant="outline">Trial</Badge>;
      case "past_due":
        return <Badge className="bg-red-500/10 text-red-500 text-[10px]" variant="outline">Inadimplente</Badge>;
      case "restricted":
        return <Badge className="bg-amber-500/10 text-amber-500 text-[10px]" variant="outline">Restrito</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-500/10 text-gray-400 text-[10px]" variant="outline">Cancelado</Badge>;
      default:
        return <Badge className="bg-gray-500/10 text-gray-400 text-[10px]" variant="outline">{billingStatus || "—"}</Badge>;
    }
  };

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
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <h2 className="text-lg font-semibold mb-2">Acesso Negado</h2>
            <p className="text-muted-foreground text-sm">
              Apenas Super Administradores podem acessar esta página.
            </p>
            <Button className="mt-4" onClick={() => navigate("/dashboard")}>
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = statsQuery.data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border sticky top-0 z-40 bg-card/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/super-admin")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="font-bold text-lg">Z-API Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={() => setProvisionDialog({ tenantId: 0, tenantName: "" })}
            >
              <Plus className="w-4 h-4" />
              Liberar Z-API
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                instancesQuery.refetch();
                statsQuery.refetch();
                tenantsWithoutQuery.refetch();
                toast.info("Dados atualizados!");
              }}
              className="gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              icon: <Signal className="w-5 h-5" />,
              label: "Instâncias Ativas",
              value: stats?.active ?? "—",
              color: "text-emerald-400 bg-emerald-500/10",
            },
            {
              icon: <Wifi className="w-5 h-5" />,
              label: "WhatsApp Conectado",
              value: stats?.connected ?? "—",
              color: "text-blue-400 bg-blue-500/10",
            },
            {
              icon: <Clock className="w-5 h-5" />,
              label: "Pendentes",
              value: stats?.pending ?? "—",
              color: "text-amber-400 bg-amber-500/10",
            },
            {
              icon: <XCircle className="w-5 h-5" />,
              label: "Canceladas",
              value: stats?.cancelled ?? "—",
              color: "text-red-400 bg-red-500/10",
            },
          ].map((stat, i) => (
            <Card key={i} className="surface">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por tenant, instância, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
              <SelectItem value="expired">Expiradas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Instances Table */}
        <Card className="surface">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              Instâncias Z-API ({filteredInstances.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {instancesQuery.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredInstances.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <SignalZero className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">Nenhuma instância encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tenant</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Instância</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">WhatsApp</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Billing</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Criado em</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInstances.map((inst) => (
                      <tr
                        key={inst.id}
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {inst.tenantId}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate max-w-[200px]">{inst.tenantName || "—"}</p>
                              <p className="text-[10px] text-muted-foreground">ID: {inst.tenantId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <p className="font-mono text-xs truncate max-w-[180px]">{inst.instanceName}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{inst.zapiInstanceId}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">{statusBadge(inst.status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {whatsappStatusBadge(inst.whatsappStatus)}
                            {inst.whatsappPhone && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {inst.whatsappPhone}
                              </span>
                            )}
                            {inst.whatsappPushName && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                {inst.whatsappPushName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {billingBadge(inst.tenantBillingStatus)}
                            <span className="text-[10px] text-muted-foreground capitalize">{inst.tenantPlan}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-muted-foreground">
                            <p>{formatDate(inst.createdAt)}</p>
                            {inst.cancelledAt && (
                              <p className="text-red-400">Cancelada: {formatDate(inst.cancelledAt)}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {inst.status === "active" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 border-red-300 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-red-500/40 dark:hover:bg-red-500/10"
                                  onClick={() =>
                                    setDeprovisionDialog({
                                      tenantId: inst.tenantId,
                                      tenantName: inst.tenantName || `Tenant ${inst.tenantId}`,
                                    })
                                  }
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Revogar instância Z-API</TooltipContent>
                            </Tooltip>
                          ) : inst.status === "cancelled" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 border-emerald-300 text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 dark:border-emerald-500/40 dark:hover:bg-emerald-500/10"
                                  onClick={() =>
                                    setProvisionDialog({
                                      tenantId: inst.tenantId,
                                      tenantName: inst.tenantName || `Tenant ${inst.tenantId}`,
                                    })
                                  }
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Re-provisionar Z-API</TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tenants Without Z-API */}
        <Card className="surface mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              Tenants sem Z-API ({filteredTenantsWithout.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tenantsWithoutQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTenantsWithout.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CheckCircle className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">Todos os tenants ativos possuem Z-API</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tenant</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plano</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Billing</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Criado em</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTenantsWithout.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-xs font-bold text-amber-400">
                              {t.id}
                            </div>
                            <div>
                              <p className="font-medium">{t.name}</p>
                              <p className="text-[10px] text-muted-foreground">ID: {t.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {t.plan}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{billingBadge(t.billingStatus)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatDate(t.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                            onClick={() =>
                              setProvisionDialog({
                                tenantId: t.id,
                                tenantName: t.name,
                              })
                            }
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Liberar Z-API
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Provision Dialog */}
      <Dialog
        open={!!provisionDialog}
        onOpenChange={(open) => !open && setProvisionDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              Liberar Z-API
            </DialogTitle>
            <DialogDescription>
              {provisionDialog?.tenantId
                ? `Confirma a liberação de uma instância Z-API para "${provisionDialog.tenantName}" (ID: ${provisionDialog.tenantId})?`
                : "Selecione um tenant para liberar o Z-API."}
            </DialogDescription>
          </DialogHeader>

          {!provisionDialog?.tenantId ? (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {filteredTenantsWithout.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Todos os tenants ativos já possuem Z-API.
                </p>
              ) : (
                filteredTenantsWithout.map((t) => (
                  <button
                    key={t.id}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors text-left"
                    onClick={() =>
                      setProvisionDialog({ tenantId: t.id, tenantName: t.name })
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {t.id}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {t.plan} / {t.billingStatus}
                        </p>
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-emerald-400" />
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-400 mb-1">Atenção</p>
                    <p className="text-muted-foreground">
                      Isso criará uma nova instância Z-API via Partner API e ativará a assinatura.
                      O custo será cobrado na conta parceira Z-API.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-semibold">{provisionDialog.tenantName}</p>
                    <p className="text-xs text-muted-foreground">
                      Tenant ID: {provisionDialog.tenantId}
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setProvisionDialog(null)}
                  disabled={provisionMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  onClick={() =>
                    provisionMutation.mutate({ tenantId: provisionDialog.tenantId })
                  }
                  disabled={provisionMutation.isPending}
                >
                  {provisionMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  Confirmar Liberação
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deprovision Dialog */}
      <AlertDialog
        open={!!deprovisionDialog}
        onOpenChange={(open) => !open && setDeprovisionDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              Revogar Instância Z-API
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja revogar a instância Z-API de{" "}
              <strong>"{deprovisionDialog?.tenantName}"</strong> (ID:{" "}
              {deprovisionDialog?.tenantId})?
              <br />
              <br />
              Isso irá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Cancelar a assinatura na Z-API Partner API</li>
                <li>Desconectar o WhatsApp do tenant</li>
                <li>Marcar a instância como cancelada no banco</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deprovisionMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deprovisionDialog) {
                  deprovisionMutation.mutate({ tenantId: deprovisionDialog.tenantId });
                }
              }}
              disabled={deprovisionMutation.isPending}
            >
              {deprovisionMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1" />
              )}
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
