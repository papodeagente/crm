import { trpc } from "@/lib/trpc";
import { AlertTriangle, Clock, CreditCard, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

/**
 * BillingBanner — shows contextual billing alerts at the top of the app.
 * 
 * - Legacy tenants: never shown
 * - Trialing: shows days remaining when <= 3 days
 * - Past due: yellow warning
 * - Restricted/expired: red blocking banner
 * - Cancelled with active period: orange info
 */
export function BillingBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [, navigate] = useLocation();

  const billingQuery = trpc.billing.myBilling.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  if (dismissed || !billingQuery.data) return null;

  const { level, isLegacy, billingStatus, subscription, message } = billingQuery.data;

  // Legacy tenants never see billing banners
  if (isLegacy) return null;

  // Calculate trial days remaining
  let trialDaysLeft: number | null = null;
  if (billingStatus === "trialing" && subscription?.trialEndsAt) {
    const now = new Date();
    const trialEnd = new Date(subscription.trialEndsAt);
    trialDaysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  }

  // Active with no issues — no banner
  if (billingStatus === "active") return null;

  // Trialing with more than 3 days left — no banner
  if (billingStatus === "trialing" && trialDaysLeft !== null && trialDaysLeft > 3) return null;

  // Determine banner style and content
  let bgClass = "";
  let textClass = "";
  let icon = <AlertTriangle className="w-4 h-4 shrink-0" />;
  let bannerMessage = "";
  let showCTA = false;
  let canDismiss = true;

  if (level === "restricted") {
    // Red: blocked
    bgClass = "bg-red-500/15 border-red-500/30";
    textClass = "text-red-300";
    icon = <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />;
    bannerMessage = message || "Seu acesso está restrito. Assine um plano para continuar usando o sistema.";
    showCTA = true;
    canDismiss = false;
  } else if (billingStatus === "past_due") {
    // Yellow: warning
    bgClass = "bg-amber-500/15 border-amber-500/30";
    textClass = "text-amber-300";
    icon = <CreditCard className="w-4 h-4 shrink-0 text-amber-400" />;
    bannerMessage = message || "Seu pagamento está pendente. Regularize para evitar a suspensão.";
    showCTA = true;
    canDismiss = true;
  } else if (billingStatus === "cancelled") {
    // Orange: cancelled but still active
    bgClass = "bg-orange-500/15 border-orange-500/30";
    textClass = "text-orange-300";
    icon = <Clock className="w-4 h-4 shrink-0 text-orange-400" />;
    const periodEnd = subscription?.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR")
      : null;
    bannerMessage = periodEnd
      ? `Sua assinatura foi cancelada. Acesso disponível até ${periodEnd}.`
      : (message || "Sua assinatura foi cancelada.");
    showCTA = true;
    canDismiss = true;
  } else if (billingStatus === "trialing" && trialDaysLeft !== null) {
    // Purple: trial ending soon
    bgClass = "bg-purple-500/15 border-purple-500/30";
    textClass = "text-purple-300";
    icon = <Clock className="w-4 h-4 shrink-0 text-purple-400" />;
    bannerMessage = trialDaysLeft <= 0
      ? "Seu período de teste termina hoje! Assine para continuar usando o sistema."
      : trialDaysLeft === 1
        ? "Seu período de teste termina amanhã! Assine para continuar usando o sistema."
        : `Seu período de teste termina em ${trialDaysLeft} dias. Assine para continuar usando o sistema.`;
    showCTA = true;
    canDismiss = true;
  }

  if (!bannerMessage) return null;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b ${bgClass} ${textClass} text-sm`}>
      {icon}
      <span className="flex-1">{bannerMessage}</span>
      {showCTA && (
        <button
          onClick={() => navigate("/upgrade")}
          className="shrink-0 px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors"
        >
          Ver planos
        </button>
      )}
      {canDismiss && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
