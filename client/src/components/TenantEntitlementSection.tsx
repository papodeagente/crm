import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Package, Shield, Puzzle, Plus, Trash2, Loader2,
  Calendar, AlertCircle,
} from "lucide-react";

const fmt = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

interface Props {
  tenantId: number;
  tenantName: string;
}

export default function TenantEntitlementSection({ tenantId, tenantName }: Props) {
  const utils = trpc.useUtils();

  const entitlementQ = trpc.superAdminPlans.tenants.getEntitlement.useQuery({ tenantId });
  const plansQ = trpc.superAdminPlans.plans.list.useQuery();
  const addonTypesQ = trpc.superAdminPlans.addons.listTypes.useQuery();
  const featureKeysQ = trpc.superAdminPlans.plans.listFeatureKeys.useQuery();

  const assignPlanMut = trpc.superAdminPlans.tenants.assignPlan.useMutation({
    onSuccess: () => { utils.superAdminPlans.tenants.getEntitlement.invalidate(); toast.success("Plano alterado"); setShowChangePlan(false); },
    onError: (e) => toast.error(e.message),
  });
  const setOverrideMut = trpc.superAdminPlans.tenants.setOverride.useMutation({
    onSuccess: () => { utils.superAdminPlans.tenants.getEntitlement.invalidate(); toast.success("Override salvo"); setShowAddOverride(false); },
    onError: (e) => toast.error(e.message),
  });
  const removeOverrideMut = trpc.superAdminPlans.tenants.removeOverride.useMutation({
    onSuccess: () => { utils.superAdminPlans.tenants.getEntitlement.invalidate(); toast.success("Override removido"); },
    onError: (e) => toast.error(e.message),
  });
  const grantAddonMut = trpc.superAdminPlans.tenants.grantAddon.useMutation({
    onSuccess: () => { utils.superAdminPlans.tenants.getEntitlement.invalidate(); toast.success("Add-on concedido"); setShowGrantAddon(false); },
    onError: (e) => toast.error(e.message),
  });
  const revokeAddonMut = trpc.superAdminPlans.tenants.revokeAddon.useMutation({
    onSuccess: () => { utils.superAdminPlans.tenants.getEntitlement.invalidate(); toast.success("Add-on revogado"); },
    onError: (e) => toast.error(e.message),
  });

  // Dialogs
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [ovKey, setOvKey] = useState("");
  const [ovEnabled, setOvEnabled] = useState(true);
  const [ovLimit, setOvLimit] = useState("");
  const [ovReason, setOvReason] = useState("");
  const [ovExpires, setOvExpires] = useState("");
  const [showGrantAddon, setShowGrantAddon] = useState(false);
  const [adType, setAdType] = useState("");
  const [adQty, setAdQty] = useState("1");
  const [adReason, setAdReason] = useState("");
  const [adExpires, setAdExpires] = useState("");

  if (entitlementQ.isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const ent = entitlementQ.data;
  if (!ent) return null;

  const activePlans = (plansQ.data ?? []).filter((p: any) => p.isActive);
  const addonTypes = addonTypesQ.data ?? [];
  const featureKeys = featureKeysQ.data ?? [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Shield className="w-5 h-5" /> Entitlement
      </h3>

      {/* Current Plan */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4" /> Plano Atual
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setSelectedPlan(ent.planSlug ?? ""); setShowChangePlan(true); }}>
              Alterar Plano
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/20">
              {ent.planSlug}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Máx. usuários: {ent.entitlement.features.maxUsers?.limitValue ?? "N/A"} |
              Máx. WhatsApp: {ent.entitlement.features.maxWhatsAppAccounts?.limitValue ?? "N/A"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Active Add-ons */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Puzzle className="w-4 h-4" /> Add-ons Ativos
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setAdType(""); setAdQty("1"); setAdReason(""); setAdExpires(""); setShowGrantAddon(true); }}>
              <Plus className="w-3 h-3 mr-1" /> Conceder Add-on
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(ent.addons ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhum add-on ativo</p>
          ) : (
            <div className="space-y-2">
              {(ent.addons ?? []).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <div>
                    <span className="text-sm font-medium">{a.addonType}</span>
                    <span className="text-xs text-muted-foreground ml-2">×{a.quantity}</span>
                    {a.expiresAt && (
                      <span className="text-xs text-amber-400 ml-2 flex items-center gap-1 inline-flex">
                        <Calendar className="w-3 h-3" />
                        Expira: {new Date(a.expiresAt).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px] ml-2">
                      {a.hotmartTransactionId ? "Hotmart" : "Manual"}
                    </Badge>
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => {
                    if (confirm("Revogar este add-on?")) {
                      revokeAddonMut.mutate({ addonId: a.id, reason: "Revogado manualmente pelo super admin" });
                    }
                  }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Overrides */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Overrides Ativos
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setOvKey(""); setOvEnabled(true); setOvLimit(""); setOvReason(""); setOvExpires(""); setShowAddOverride(true); }}>
              <Plus className="w-3 h-3 mr-1" /> Adicionar Override
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(ent.overrides ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhum override ativo</p>
          ) : (
            <div className="space-y-2">
              {(ent.overrides ?? []).map((o: any) => (
                <div key={o.featureKey} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <div>
                    <span className="text-sm font-medium font-mono">{o.featureKey}</span>
                    <Badge className={`ml-2 text-[10px] ${o.isEnabled ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" : "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20"}`}>
                      {o.isEnabled ? "Habilitado" : "Desabilitado"}
                    </Badge>
                    {o.limitValue != null && <span className="text-xs text-muted-foreground ml-2">Limite: {o.limitValue}</span>}
                    {o.expiresAt && (
                      <span className="text-xs text-amber-400 ml-2">
                        Expira: {new Date(o.expiresAt).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    {o.reason && <p className="text-[10px] text-muted-foreground mt-0.5">{o.reason}</p>}
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => {
                    removeOverrideMut.mutate({ tenantId, featureKey: o.featureKey });
                  }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Plan Dialog */}
      <Dialog open={showChangePlan} onOpenChange={setShowChangePlan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Plano — {tenantName}</DialogTitle>
            <DialogDescription>Altera apenas o campo plan. Não afeta billingStatus nem subscription.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Novo Plano</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {activePlans.map((p: any) => (
                    <SelectItem key={p.slug} value={p.slug}>{p.name} ({p.slug})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePlan(false)}>Cancelar</Button>
            <Button onClick={() => assignPlanMut.mutate({ tenantId, planSlug: selectedPlan })} disabled={!selectedPlan || assignPlanMut.isPending}>
              {assignPlanMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Alterar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Override Dialog */}
      <Dialog open={showAddOverride} onOpenChange={setShowAddOverride}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Override</DialogTitle>
            <DialogDescription>Sobrescreve a feature do plano para este tenant específico.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Feature</Label>
              <Select value={ovKey} onValueChange={setOvKey}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {featureKeys.map((fk: any) => (
                    <SelectItem key={fk.key} value={fk.key}>{fk.label} ({fk.key})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Label>Habilitado</Label>
              <Switch checked={ovEnabled} onCheckedChange={setOvEnabled} />
            </div>
            <div><Label>Limite (opcional)</Label><Input type="number" value={ovLimit} onChange={(e) => setOvLimit(e.target.value)} placeholder="Deixe vazio para sem limite" /></div>
            <div><Label>Motivo (min. 10 caracteres)</Label><Textarea value={ovReason} onChange={(e) => setOvReason(e.target.value)} placeholder="Explique o motivo do override..." rows={2} /></div>
            <div><Label>Expira em (opcional)</Label><Input type="date" value={ovExpires} onChange={(e) => setOvExpires(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddOverride(false)}>Cancelar</Button>
            <Button onClick={() => setOverrideMut.mutate({
              tenantId,
              featureKey: ovKey,
              isEnabled: ovEnabled,
              limitValue: ovLimit ? Number(ovLimit) : undefined,
              reason: ovReason,
              expiresAt: ovExpires || undefined,
            })} disabled={!ovKey || ovReason.length < 10 || setOverrideMut.isPending}>
              {setOverrideMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant Addon Dialog */}
      <Dialog open={showGrantAddon} onOpenChange={setShowGrantAddon}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conceder Add-on — {tenantName}</DialogTitle>
            <DialogDescription>Concede manualmente um add-on a este tenant.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Add-on</Label>
              <Select value={adType} onValueChange={setAdType}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {addonTypes.map((at: any) => (
                    <SelectItem key={at.type} value={at.type}>{at.label} ({at.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Quantidade</Label><Input type="number" value={adQty} onChange={(e) => setAdQty(e.target.value)} min={1} /></div>
            <div><Label>Motivo (min. 10 caracteres)</Label><Textarea value={adReason} onChange={(e) => setAdReason(e.target.value)} placeholder="Explique o motivo da concessão..." rows={2} /></div>
            <div><Label>Expira em (opcional)</Label><Input type="date" value={adExpires} onChange={(e) => setAdExpires(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrantAddon(false)}>Cancelar</Button>
            <Button onClick={() => grantAddonMut.mutate({
              tenantId,
              addonType: adType as "whatsapp_number" | "extra_user" | "extra_storage_gb",
              quantity: Number(adQty) || 1,
              reason: adReason,
              expiresAt: adExpires || undefined,
            })} disabled={!adType || adReason.length < 10 || grantAddonMut.isPending}>
              {grantAddonMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Conceder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
