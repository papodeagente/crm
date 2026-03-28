import { useState, useCallback, useRef, useEffect } from "react";
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
  Package, Settings2, Puzzle, Plus, Pencil, Loader2,
  ToggleLeft, ToggleRight, DollarSign, Users, Hash,
  Link2, History, AlertTriangle,
} from "lucide-react";

const fmt = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

type Tab = "plans" | "features" | "addons";

// ─── Main Component ────────────────────────────────────────────────

export default function SuperAdminPlans() {
  const [tab, setTab] = useState<Tab>("plans");
  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "plans", label: "Planos", icon: Package },
    { key: "features", label: "Features por Plano", icon: Settings2 },
    { key: "addons", label: "Add-ons", icon: Puzzle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gestão de Planos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie planos, features e add-ons do sistema
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "plans" && <PlansTab />}
      {tab === "features" && <FeaturesTab />}
      {tab === "addons" && <AddonsTab />}
    </div>
  );
}

// ─── ABA 1: Planos ─────────────────────────────────────────────────

function PlansTab() {
  const utils = trpc.useUtils();
  const plansQ = trpc.superAdminPlans.plans.list.useQuery();
  const createMut = trpc.superAdminPlans.plans.create.useMutation({
    onSuccess: () => { utils.superAdminPlans.plans.list.invalidate(); setShowCreate(false); toast.success("Plano criado"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.superAdminPlans.plans.update.useMutation({
    onSuccess: () => { utils.superAdminPlans.plans.list.invalidate(); setEditPlan(null); toast.success("Plano atualizado"); },
    onError: (e) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<any>(null);

  // Create form
  const [cName, setCName] = useState("");
  const [cSlug, setCSlug] = useState("");
  const [cPrice, setCPrice] = useState("");
  const [cCycle, setCCycle] = useState<"monthly" | "annual">("monthly");

  // Edit form
  const [eName, setEName] = useState("");
  const [ePrice, setEPrice] = useState("");
  const [eCycle, setECycle] = useState<"monthly" | "annual">("monthly");
  const [eOffer, setEOffer] = useState("");
  const [eDesc, setEDesc] = useState("");

  const openEdit = (plan: any) => {
    setEditPlan(plan);
    setEName(plan.name);
    setEPrice(String(plan.priceCents ?? 0));
    setECycle((plan.billingCycle ?? "monthly") as "monthly" | "annual");
    setEOffer(plan.hotmartOfferCode ?? "");
    setEDesc(plan.description ?? "");
  };

  if (plansQ.isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const plans = plansQ.data ?? [];

  return (
    <>
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{plans.length} plano(s) cadastrado(s)</p>
        <Button size="sm" onClick={() => { setCName(""); setCSlug(""); setCPrice(""); setCCycle("monthly"); setShowCreate(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Novo Plano
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan: any) => (
          <Card key={plan.id} className={`relative ${!plan.isActive ? "opacity-60" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{plan.slug}</p>
                </div>
                <div className="flex gap-1">
                  <Badge className={plan.isActive ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] hover:bg-emerald-500/20" : "bg-red-500/20 text-red-400 border-red-500/30 text-[10px] hover:bg-red-500/20"}>
                    {plan.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-lg font-bold">{fmt(plan.priceCents ?? 0)}</span>
                <span className="text-xs text-muted-foreground">/{plan.billingCycle === "annual" ? "ano" : "mês"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{plan.tenantCount ?? 0} tenant(s)</span>
              </div>
              {plan.hotmartOfferCode && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Link2 className="w-3 h-3" />
                  <span className="font-mono">{plan.hotmartOfferCode}</span>
                </div>
              )}
              {plan.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{plan.description}</p>
              )}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(plan)}>
                  <Pencil className="w-3 h-3 mr-1" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (plan.isActive && (plan.tenantCount ?? 0) > 0) {
                      setConfirmDeactivate(plan);
                    } else {
                      updateMut.mutate({ planId: plan.id, isActive: !plan.isActive });
                    }
                  }}
                >
                  {plan.isActive ? <ToggleRight className="w-3 h-3 mr-1" /> : <ToggleLeft className="w-3 h-3 mr-1" />}
                  {plan.isActive ? "Desativar" : "Ativar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Plano</DialogTitle>
            <DialogDescription>Crie um novo plano com features padrão desabilitadas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Ex: Premium" /></div>
            <div><Label>Slug (imutável)</Label><Input value={cSlug} onChange={(e) => setCSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="Ex: premium" /></div>
            <div><Label>Preço (centavos)</Label><Input type="number" value={cPrice} onChange={(e) => setCPrice(e.target.value)} placeholder="29700" /></div>
            <div>
              <Label>Ciclo</Label>
              <Select value={cCycle} onValueChange={(v) => setCCycle(v as "monthly" | "annual")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate({ name: cName, slug: cSlug, priceCents: Number(cPrice) || 0, billingCycle: cCycle as "monthly" | "annual" })} disabled={!cName || !cSlug || createMut.isPending}>
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editPlan} onOpenChange={(o) => !o && setEditPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Plano — {editPlan?.slug}</DialogTitle>
            <DialogDescription>O slug não pode ser alterado após a criação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={eName} onChange={(e) => setEName(e.target.value)} /></div>
            <div><Label>Preço (centavos)</Label><Input type="number" value={ePrice} onChange={(e) => setEPrice(e.target.value)} /></div>
            <div>
              <Label>Ciclo</Label>
              <Select value={eCycle} onValueChange={(v) => setECycle(v as "monthly" | "annual")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Hotmart Offer Code</Label><Input value={eOffer} onChange={(e) => setEOffer(e.target.value)} placeholder="axm3bvsz" /></div>
            <div><Label>Descrição</Label><Textarea value={eDesc} onChange={(e) => setEDesc(e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlan(null)}>Cancelar</Button>
            <Button onClick={() => editPlan && updateMut.mutate({ planId: editPlan.id, name: eName, priceCents: Number(ePrice) || 0, billingCycle: eCycle as "monthly" | "annual", hotmartOfferCode: eOffer || undefined, description: eDesc || undefined, isActive: editPlan.isActive })} disabled={updateMut.isPending}>
              {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Deactivate Dialog */}
      <Dialog open={!!confirmDeactivate} onOpenChange={(o) => !o && setConfirmDeactivate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" /> Desativar Plano
            </DialogTitle>
            <DialogDescription>
              O plano <strong>{confirmDeactivate?.name}</strong> possui <strong>{confirmDeactivate?.tenantCount}</strong> tenant(s) ativo(s).
              Desativar o plano impedirá novas assinaturas, mas os tenants existentes manterão o acesso.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeactivate(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => {
              updateMut.mutate({ planId: confirmDeactivate.id, isActive: false, forceDeactivate: true });
              setConfirmDeactivate(null);
            }}>
              Confirmar Desativação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── ABA 2: Features por Plano ─────────────────────────────────────

function FeaturesTab() {
  const utils = trpc.useUtils();
  const plansQ = trpc.superAdminPlans.plans.list.useQuery();
  const featureKeysQ = trpc.superAdminPlans.plans.listFeatureKeys.useQuery();
  const setFeatureMut = trpc.superAdminPlans.plans.setFeature.useMutation({
    onSuccess: () => utils.superAdminPlans.plans.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const debounceRef = useRef<Record<string, NodeJS.Timeout>>({});

  const handleToggle = useCallback((planId: number, featureKey: string, isEnabled: boolean) => {
    setFeatureMut.mutate({ planId, featureKey, isEnabled });
  }, [setFeatureMut]);

  const handleLimitChange = useCallback((planId: number, featureKey: string, value: string) => {
    const key = `${planId}-${featureKey}`;
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(() => {
      const feat = featureMap[planId]?.[featureKey];
      setFeatureMut.mutate({ planId, featureKey, isEnabled: feat?.isEnabled ?? false, limitValue: value === "" ? undefined : Number(value) });
    }, 800);
  }, [setFeatureMut]);

  if (plansQ.isLoading || featureKeysQ.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const plans = (plansQ.data ?? []).filter((p: any) => p.isActive);
  const featureKeys = featureKeysQ.data ?? [];

  // Build feature map: planId → featureKey → { isEnabled, limitValue }
  const featureMap: Record<number, Record<string, { isEnabled: boolean; limitValue: number | null }>> = {};
  for (const plan of plans) {
    featureMap[plan.id] = {};
    for (const f of (plan.features ?? [])) {
      featureMap[plan.id][f.featureKey] = { isEnabled: f.isEnabled, limitValue: f.limitValue };
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Matriz de Features</CardTitle>
        <p className="text-xs text-muted-foreground">Edite inline — toggles salvam imediatamente, limites com debounce de 800ms</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground min-w-[200px]">Feature</th>
                {plans.map((p: any) => (
                  <th key={p.id} className="text-center py-2 px-3 text-xs font-medium text-muted-foreground min-w-[140px]">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {featureKeys.map((fk: any) => (
                <tr key={fk.key} className="border-b border-border/30 hover:bg-muted/30">
                  <td className="py-2 px-3">
                    <div className="text-foreground text-sm">{fk.label}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{fk.key}</div>
                  </td>
                  {plans.map((p: any) => {
                    const feat = featureMap[p.id]?.[fk.key];
                    const isEnabled = feat?.isEnabled ?? false;
                    const limitValue = feat?.limitValue;
                    return (
                      <td key={p.id} className="py-2 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(v) => handleToggle(p.id, fk.key, v)}
                          />
                          {fk.hasLimit && (
                            <Input
                              type="number"
                              className="w-20 h-7 text-xs text-center"
                              defaultValue={limitValue ?? ""}
                              placeholder="∞"
                              onChange={(e) => handleLimitChange(p.id, fk.key, e.target.value)}
                            />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 p-3 bg-muted/30 rounded-lg">
          <p className="text-xs text-muted-foreground font-medium mb-1">Legenda</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-[10px] text-muted-foreground">
            {featureKeys.map((fk: any) => (
              <span key={fk.key}><span className="font-mono">{fk.key}</span> — {fk.label}</span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── ABA 3: Add-ons ────────────────────────────────────────────────

function AddonsTab() {
  const utils = trpc.useUtils();
  const addonTypesQ = trpc.superAdminPlans.addons.listTypes.useQuery();
  const recentAddonsQ = trpc.superAdminPlans.addons.recentActivations.useQuery();
  const linkOfferMut = trpc.superAdminPlans.addons.linkOfferCode.useMutation({
    onSuccess: () => { utils.superAdminPlans.addons.listTypes.invalidate(); toast.success("Offer code vinculado"); },
    onError: (e) => toast.error(e.message),
  });

  const [linkDialog, setLinkDialog] = useState<any>(null);
  const [offerCode, setOfferCode] = useState("");
  const [offerPrice, setOfferPrice] = useState("");

  if (addonTypesQ.isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const addonTypes = addonTypesQ.data ?? [];
  const recentAddons = recentAddonsQ.data ?? [];

  return (
    <div className="space-y-6">
      {/* Addon Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipos de Add-on</CardTitle>
          <p className="text-xs text-muted-foreground">Vincule códigos de oferta Hotmart a cada tipo de add-on</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {addonTypes.map((at: any) => (
              <div key={at.type} className="border border-border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{at.label}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{at.type}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{at.unit}</Badge>
                </div>
                {at.offerCodes?.length > 0 ? (
                  <div className="space-y-1">
                    {at.offerCodes.map((oc: any) => (
                      <div key={oc.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Link2 className="w-3 h-3" />
                        <span className="font-mono">{oc.hotmartOfferCode}</span>
                        {oc.priceCents > 0 && <span>({fmt(oc.priceCents)})</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Nenhum offer code vinculado</p>
                )}
                <Button size="sm" variant="outline" className="w-full" onClick={() => { setLinkDialog(at); setOfferCode(""); setOfferPrice(""); }}>
                  <Link2 className="w-3 h-3 mr-1" /> Vincular Offer Code
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activations */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Últimas Ativações</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {recentAddons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma ativação recente</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Tenant</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Qtd</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Origem</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAddons.map((a: any) => (
                    <tr key={a.id} className="border-b border-border/30">
                      <td className="py-2 px-2 text-foreground">{a.tenantName ?? `#${a.tenantId}`}</td>
                      <td className="py-2 px-2 text-muted-foreground">{a.addonType}</td>
                      <td className="py-2 px-2 text-muted-foreground">{a.quantity}</td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-[10px]">
                          {a.hotmartTransactionId ? "Hotmart" : "Manual"}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        <Badge className={a.status === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] hover:bg-emerald-500/20" : "bg-red-500/20 text-red-400 border-red-500/30 text-[10px] hover:bg-red-500/20"}>
                          {a.status === "active" ? "Ativo" : "Cancelado"}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString("pt-BR") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link Offer Code Dialog */}
      <Dialog open={!!linkDialog} onOpenChange={(o) => !o && setLinkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Offer Code — {linkDialog?.label}</DialogTitle>
            <DialogDescription>Vincule um código de oferta Hotmart a este tipo de add-on.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Hotmart Offer Code</Label><Input value={offerCode} onChange={(e) => setOfferCode(e.target.value)} placeholder="abc123xyz" /></div>
            <div><Label>Preço (centavos, informativo)</Label><Input type="number" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} placeholder="4900" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(null)}>Cancelar</Button>
            <Button onClick={() => {
              linkOfferMut.mutate({ addonType: linkDialog.type, hotmartOfferCode: offerCode, priceCents: Number(offerPrice) || 0 });
              setLinkDialog(null);
            }} disabled={!offerCode || linkOfferMut.isPending}>
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
