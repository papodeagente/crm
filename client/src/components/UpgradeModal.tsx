/**
 * UpgradeModal — Modal de upgrade exibido quando o usuário tenta acessar
 * uma feature bloqueada pelo plano atual.
 *
 * Agora consome planos dinamicamente do banco via trpc.plan.active.
 *
 * Uso:
 *   <UpgradeModal
 *     open={showUpgrade}
 *     onClose={() => setShowUpgrade(false)}
 *     feature="whatsappEmbedded"
 *   />
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Crown, Rocket, Zap, MessageSquare, Target, BarChart3,
  Users, Headphones, ArrowRight, Check, Lock, ExternalLink, Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState, useCallback, useMemo } from "react";

// ─── Types ───
interface DynamicPlan {
  id: string;
  dbId: number;
  name: string;
  description: string;
  commercialCopy: string;
  priceInCents: number;
  billingCycle: string;
  isActive: boolean;
  isPublic: boolean;
  hotmartOfferCode: string | null;
  displayOrder: number;
  maxUsers: number;
  maxWhatsAppAccounts: number;
  maxAttendantsPerAccount: number;
  features: Record<string, boolean>;
}

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  /** Feature key that triggered the modal */
  feature?: string;
  /** Custom title override */
  title?: string;
  /** Custom description override */
  description?: string;
}

const featureIcons: Record<string, any> = {
  whatsappEmbedded: MessageSquare,
  segmentedBroadcast: Zap,
  rfvEnabled: Target,
  salesAutomation: Rocket,
  prioritySupport: Headphones,
  communityAccess: Users,
  crmCore: BarChart3,
};

const SCALE_WHATSAPP_URL = "https://wa.me/551151982627?text=Quero%20conhecer%20o%20Plano%20Elite%20do%20Entur%20OS.%20Pode%20me%20ajudar%3F";

export function UpgradeModal({ open, onClose, feature, title, description }: UpgradeModalProps) {
  const [, setLocation] = useLocation();

  const planSummary = trpc.plan.summary.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const plansQuery = trpc.plan.active.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: open, // Only fetch when modal is open
  });

  const plans = useMemo(() => plansQuery.data?.plans ?? [], [plansQuery.data]);
  const featureDescriptions = useMemo(() => plansQuery.data?.featureDescriptions ?? {} as Record<string, { title: string; description: string; benefit: string }>, [plansQuery.data]);

  const currentPlanId = planSummary.data?.planId || "start";

  // Find the minimum plan that has the required feature
  const minPlan = useMemo<DynamicPlan | null>(() => {
    if (!feature || !plans.length) return plans[1] ?? plans[0] ?? null;
    for (const p of plans) {
      if (p.features[feature]) return p;
    }
    return plans[plans.length - 1] ?? null;
  }, [feature, plans]);

  // Find current plan from dynamic plans
  const currentPlanDynamic = useMemo(() => {
    return plans.find((p) => p.id === currentPlanId) ?? null;
  }, [plans, currentPlanId]);

  const featureInfo = feature ? (featureDescriptions as any)[feature] : null;
  const FeatureIcon = feature ? (featureIcons[feature] || Lock) : Lock;

  const displayTitle = title || featureInfo?.title || "Recurso Premium";
  const displayDescription = description || featureInfo?.description || "Este recurso não está disponível no seu plano atual.";
  const displayBenefit = featureInfo?.benefit || "";

  const isScaleRequired = minPlan ? minPlan.priceInCents === 0 : false;

  const handleUpgrade = () => {
    if (isScaleRequired) {
      window.open(SCALE_WHATSAPP_URL, "_blank");
    } else {
      setLocation("/upgrade");
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        {plansQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200/50">
                  <FeatureIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg">{displayTitle}</DialogTitle>
                  {minPlan && (
                    <Badge variant="outline" className="mt-1 text-xs border-amber-300 text-amber-700 bg-amber-50">
                      <Crown className="h-3 w-3 mr-1" />
                      Plano {minPlan.name}
                    </Badge>
                  )}
                </div>
              </div>
              <DialogDescription className="text-sm text-muted-foreground pt-2">
                {displayDescription}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Benefit highlight */}
              {displayBenefit && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-900 flex items-start gap-2">
                    <Zap className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                    {displayBenefit}
                  </p>
                </div>
              )}

              {/* What you get with the upgrade */}
              {minPlan && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    O que você ganha com o plano {minPlan.name}
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(minPlan.features)
                      .filter(([, enabled]) => enabled)
                      .filter(([key]) => {
                        // Only show features not in current plan
                        if (!currentPlanDynamic) return true;
                        return !currentPlanDynamic.features[key];
                      })
                      .slice(0, 5)
                      .map(([key]) => {
                        const info = (featureDescriptions as any)[key];
                        return (
                          <div key={key} className="flex items-center gap-2 text-sm">
                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span className="text-foreground">{info?.title || key}</span>
                          </div>
                        );
                      })}
                    {minPlan.maxUsers > 1 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="text-foreground">Até {minPlan.maxUsers} usuários</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Price info */}
              {minPlan && minPlan.priceInCents > 0 && (
                <div className="text-center py-1">
                  <p className="text-2xl font-bold text-foreground">
                    R$ {(minPlan.priceInCents / 100).toFixed(0)}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                </div>
              )}
              {minPlan && minPlan.priceInCents === 0 && (
                <div className="text-center py-1">
                  <p className="text-sm text-muted-foreground">Sob consulta</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={handleUpgrade}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg"
              >
                {isScaleRequired ? (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Falar com consultor
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4 mr-2" />
                    Fazer upgrade{minPlan ? ` para ${minPlan.name}` : ""}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={onClose} className="w-full text-muted-foreground">
                Agora não
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook para detectar erros de PLAN_FEATURE_BLOCKED e abrir o modal de upgrade.
 * Uso:
 *   const { upgradeModal, handlePlanError } = useUpgradeGuard();
 *   // Em mutations:
 *   onError: (err) => handlePlanError(err) || toast.error(err.message)
 *   // No JSX:
 *   {upgradeModal}
 */
export function useUpgradeGuard() {
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);

  const handlePlanError = useCallback((error: any): boolean => {
    const msg = error?.message || error?.data?.message || "";
    if (typeof msg === "string" && msg.startsWith("PLAN_FEATURE_BLOCKED:")) {
      const parts = msg.split(":");
      const feature = parts[1];
      setUpgradeFeature(feature);
      return true; // error handled
    }
    return false; // not a plan error
  }, []);

  const upgradeModal = (
    <UpgradeModal
      open={upgradeFeature !== null}
      onClose={() => setUpgradeFeature(null)}
      feature={upgradeFeature || undefined}
    />
  );

  return { upgradeModal, handlePlanError, setUpgradeFeature };
}
