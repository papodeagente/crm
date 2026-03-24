import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Clock, Zap, X } from "lucide-react";
import { Link } from "wouter";

/**
 * TrialCountdownBanner — Red banner with live countdown for trial tenants.
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
    <div className={`relative overflow-hidden rounded-xl mb-5 ${
      isExpired
        ? "bg-gradient-to-r from-red-700 via-red-600 to-red-700"
        : isUrgent
          ? "bg-gradient-to-r from-red-600 via-red-500 to-rose-600"
          : "bg-gradient-to-r from-red-600 via-red-500 to-rose-500"
    }`}>
      {/* Animated pulse overlay for urgency */}
      {isUrgent && !isExpired && (
        <div className="absolute inset-0 bg-white/5 animate-pulse" />
      )}

      <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4">
        {/* Left: Icon + Message */}
        <div className="flex items-center gap-3 text-white">
          <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-white leading-tight">
              {isExpired
                ? "Seu período de teste expirou!"
                : "Período de teste gratuito"
              }
            </p>
            <p className="text-[11px] text-white/80 mt-0.5">
              {isExpired
                ? "Assine agora para continuar usando todas as funcionalidades"
                : "Aproveite ao máximo — seu acesso completo termina em breve"
              }
            </p>
          </div>
        </div>

        {/* Center: Countdown */}
        {!isExpired && (
          <div className="flex items-center gap-2">
            {[
              { value: days, label: "dias" },
              { value: hours, label: "hrs" },
              { value: minutes, label: "min" },
              { value: seconds, label: "seg" },
            ].map((unit, i) => (
              <div key={unit.label} className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <span className="text-[24px] sm:text-[28px] font-extrabold text-white leading-none tabular-nums min-w-[40px] text-center">
                    {String(unit.value).padStart(2, "0")}
                  </span>
                  <span className="text-[9px] text-white/70 font-medium uppercase tracking-wider mt-0.5">
                    {unit.label}
                  </span>
                </div>
                {i < 3 && (
                  <span className="text-[20px] font-bold text-white/40 -mt-3">:</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Right: CTA Button */}
        <div className="flex items-center gap-2">
          <Link href="/upgrade">
            <Button
              size="sm"
              className="bg-white text-red-600 hover:bg-white/90 font-bold text-[12px] px-5 py-2 h-auto shadow-lg shadow-black/20 hover:scale-105 transition-transform"
            >
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Assine Agora
            </Button>
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="h-7 w-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Fechar temporariamente"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
