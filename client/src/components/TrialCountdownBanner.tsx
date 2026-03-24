import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Clock, Zap, X } from "lucide-react";
import { Link } from "wouter";

/**
 * TrialCountdownBanner — Subtle, compact banner for trial tenants.
 * Shows days, hours, minutes, seconds remaining.
 * Only visible for non-legacy tenants with billingStatus "trialing".
 */
export default function TrialCountdownBanner() {
  const { data: billing, isLoading } = trpc.billing.myBilling.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Tick every second for live countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Don't show for legacy, non-trialing, or loading states
  if (isLoading || !billing || dismissed) return null;
  if (billing.isLegacy) return null;
  if (billing.billingStatus !== "trialing") return null;

  // Calculate trial end from billing data
  const trialEndsAt = billing.trialEndsAt
    ? new Date(billing.trialEndsAt).getTime()
    : billing.subscription?.trialEndsAt
      ? new Date(billing.subscription.trialEndsAt).getTime()
      : null;

  if (!trialEndsAt) return null;

  const diff = Math.max(0, trialEndsAt - now);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const isExpired = diff <= 0;
  const isUrgent = days <= 1;

  return (
    <div className={`relative rounded-lg mb-4 border ${
      isExpired
        ? "bg-muted/60 border-border"
        : "bg-muted/40 border-border"
    }`}>
      <div className="relative flex items-center justify-between gap-3 px-4 py-2.5">
        {/* Left: Icon + Message */}
        <div className="flex items-center gap-2.5 text-foreground min-w-0">
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Clock className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground leading-tight truncate">
            {isExpired
              ? "Seu período de teste expirou"
              : "Período de teste gratuito"
            }
          </p>
        </div>

        {/* Center: Countdown */}
        {!isExpired && (
          <div className="flex items-center gap-1.5 shrink-0">
            {[
              { value: days, label: "d" },
              { value: hours, label: "h" },
              { value: minutes, label: "m" },
              { value: seconds, label: "s" },
            ].map((unit, i) => (
              <div key={unit.label} className="flex items-center gap-1.5">
                <div className="flex items-baseline gap-px">
                  <span className={`text-sm font-semibold tabular-nums ${
                    isUrgent ? "text-orange-500 dark:text-orange-400" : "text-foreground"
                  }`}>
                    {String(unit.value).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {unit.label}
                  </span>
                </div>
                {i < 3 && (
                  <span className="text-xs text-muted-foreground/40">:</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Right: CTA Button + Dismiss */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Link href="/upgrade">
            <Button
              size="sm"
              variant="default"
              className="text-[11px] h-7 px-3 font-medium"
            >
              <Zap className="h-3 w-3 mr-1" />
              {isExpired ? "Assinar" : "Upgrade"}
            </Button>
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors"
            title="Fechar temporariamente"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
