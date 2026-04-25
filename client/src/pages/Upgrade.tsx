import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Lock, Check, ArrowRight, Crown, Building2, Zap, Rocket, Clock, ExternalLink, MessageSquare, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { StaticLogo } from "@/components/ThemedLogo";

const SCALE_WHATSAPP_URL = "https://wa.me/551151982627?text=Quero%20conhecer%20o%20Plano%20Elite%20do%20Clinilucro.%20Pode%20me%20ajudar%3F";

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

// ─── Styling per plan index ───
const planIconsByIndex = [Zap, Rocket, Building2];
const planColorsByIndex = [
  {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/15",
    text: "text-white/70",
    badge: "bg-white/10 text-white/70",
    btn: "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-lg shadow-emerald-900/30",
  },
  {
    border: "border-lime-500/40",
    bg: "bg-lime-500/15",
    text: "text-white/70",
    badge: "bg-white/10 text-white/70",
    btn: "bg-gradient-to-r from-emerald-600 to-lime-500 hover:from-emerald-500 hover:to-lime-400 shadow-lg shadow-lime-900/30",
  },
  {
    border: "border-amber-500/30",
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-400",
    btn: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-900/30",
  },
];

const COMPARISON_FEATURE_KEYS = [
  { key: "crmCore", label: "CRM completo" },
  { key: "communityAccess", label: "Comunidade exclusiva" },
  { key: "whatsappEmbedded", label: "WhatsApp integrado" },
  { key: "segmentedBroadcast", label: "Disparo segmentado" },
  { key: "rfvEnabled", label: "Matriz RFV" },
  { key: "salesAutomation", label: "Automação de vendas" },
  { key: "prioritySupport", label: "Suporte prioritário" },
];

// Hotmart checkout URLs mapped by plan slug
const hotmartUrls: Record<string, string> = {
  start: "https://pay.hotmart.com/S104799458W?off=axm3bvsz",
  growth: "https://pay.hotmart.com/S104799458W?off=pubryjat",
  scale: "",
};

function getFeatureList(plan: DynamicPlan): string[] {
  const items: string[] = [];
  items.push(plan.maxUsers === 1 ? "1 usuário" : plan.maxUsers === -1 ? "Usuários ilimitados" : `Até ${plan.maxUsers} usuários`);
  if (plan.features.whatsappEmbedded) {
    items.push(`WhatsApp integrado (${plan.maxAttendantsPerAccount} atendentes)`);
  } else {
    items.push("Sem WhatsApp integrado");
  }
  items.push("CRM completo (contatos, negociações, funil, tarefas)");
  if (plan.features.segmentedBroadcast) items.push("Disparo segmentado de mensagens");
  if (plan.features.rfvEnabled) items.push("Classificação Estratégica (Matriz RFV)");
  if (plan.features.salesAutomation) items.push("Central de Automação de vendas");
  if (plan.features.prioritySupport) items.push("Suporte prioritário");
  if (plan.features.communityAccess) items.push("Comunidade exclusiva");
  return items;
}

export default function Upgrade() {
  const [, navigate] = useLocation();
  const billingQuery = trpc.billing.myBilling.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const plansQuery = trpc.plan.active.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const billing = billingQuery.data;
  const isRestricted = billing?.level === "restricted";
  const isTrialing = billing?.billingStatus === "trialing";
  const currentPlan = billing?.plan || "start";

  const plans = useMemo(() => plansQuery.data?.plans ?? [], [plansQuery.data]);
  const featureDescriptions = useMemo(() => plansQuery.data?.featureDescriptions ?? {}, [plansQuery.data]);

  if (plansQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#06140F] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06140F] flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-700/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-lime-700/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-2 mb-4">
            <StaticLogo className="h-9" variant="dark" />
          </div>

          {isRestricted ? (
            <>
              <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 px-4 py-2 rounded-full text-sm font-medium mb-4 border border-red-500/20">
                <Lock className="w-4 h-4" />
                {billing?.billingStatus === "expired" ? "Sua assinatura expirou" : "Acesso restrito"}
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Continue usando o Clinilucro
              </h1>
              <p className="text-white/50 max-w-lg mx-auto">
                {billing?.message || "Assine um plano para continuar gerenciando suas vendas e clientes sem interrupção."}
              </p>
            </>
          ) : isTrialing ? (
            <>
              <div className="inline-flex items-center gap-2 bg-white/[0.06] text-white/70 px-4 py-2 rounded-full text-sm font-medium mb-4 border border-white/10">
                <Clock className="w-4 h-4" />
                Período de teste ativo
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Escolha o plano ideal para sua clínica
              </h1>
              <p className="text-white/50 max-w-lg mx-auto">
                Garanta acesso contínuo ao Clinilucro. Assine antes do fim do período de teste.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-white mb-2">
                Escolha o plano ideal
              </h1>
              <p className="text-white/50 max-w-lg mx-auto">
                Potencialize sua clínica com as ferramentas certas
              </p>
            </>
          )}
        </div>

        {/* Plans */}
        <div className={`grid ${plans.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : "md:grid-cols-3"} gap-5`}>
          {plans.map((plan: DynamicPlan, idx: number) => {
            const isCurrent = currentPlan === plan.id;
            const isPopular = idx === 1 && plans.length >= 3;
            const PlanIcon = planIconsByIndex[Math.min(idx, planIconsByIndex.length - 1)];
            const colors = planColorsByIndex[Math.min(idx, planColorsByIndex.length - 1)];
            const features = getFeatureList(plan);
            const isContactOnly = plan.priceInCents === 0;
            const checkoutUrl = plan.hotmartOfferCode
              ? `https://pay.hotmart.com/S104799458W?off=${plan.hotmartOfferCode}`
              : hotmartUrls[plan.id] || "";

            return (
              <Card
                key={plan.id}
                className={`${isPopular ? `border-2 ${colors.border} shadow-xl shadow-violet-900/10` : `border border-gray-800 shadow-lg shadow-black/20`} bg-[#12121e] relative overflow-hidden`}
              >
                {isPopular && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 ${colors.bg} rounded-lg flex items-center justify-center`}>
                      <PlanIcon className={`w-4 h-4 ${colors.text}`} />
                    </div>
                    <CardTitle className="text-lg text-white">{plan.name}</CardTitle>
                    {isPopular && (
                      <span className={`ml-auto ${colors.badge} text-xs font-medium px-2 py-0.5 rounded-full`}>
                        Mais popular
                      </span>
                    )}
                    {isCurrent && (
                      <span className="ml-auto bg-emerald-500/15 text-emerald-400 text-xs font-medium px-2 py-0.5 rounded-full">
                        Plano atual
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    {!isContactOnly ? (
                      <>
                        <span className="text-3xl font-bold text-white">R${(plan.priceInCents / 100).toFixed(0)}</span>
                        <span className="text-white/40">/mês</span>
                      </>
                    ) : (
                      <span className="text-3xl font-bold text-white">Sob consulta</span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-1">{plan.commercialCopy}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                          <Check className={`w-2.5 h-2.5 ${colors.text}`} />
                        </div>
                        <span className="text-sm text-white/70">{feature}</span>
                      </div>
                    ))}
                  </div>
                  {isContactOnly ? (
                    <Button
                      variant="outline"
                      className="w-full h-10 border-amber-500/30 text-amber-300 hover:bg-amber-900/20 hover:text-amber-200 font-medium"
                      onClick={() => window.open(SCALE_WHATSAPP_URL, "_blank")}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Falar com consultor <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      className={`w-full h-10 text-white font-medium ${colors.btn}`}
                      onClick={() => {
                        if (checkoutUrl) window.open(checkoutUrl, "_blank");
                        else navigate("/upgrade");
                      }}
                    >
                      {isCurrent ? "Renovar assinatura" : "Assinar agora"} <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Comparison table */}
        {plans.length > 0 && (
          <div className="mt-12 bg-[#12121e] border border-gray-800 rounded-xl p-6 overflow-x-auto">
            <h2 className="text-xl font-bold text-white mb-6 text-center">Compare os planos</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-2 text-white/50 font-medium">Recurso</th>
                  {plans.map((p: DynamicPlan) => (
                    <th key={p.id} className="text-center py-3 px-2 text-white/80 font-semibold">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800/50">
                  <td className="py-3 px-2 text-white/60">Usuários</td>
                  {plans.map((p: DynamicPlan) => (
                    <td key={p.id} className="text-center py-3 px-2 text-white/50">
                      {p.maxUsers === -1 ? "Ilimitado" : p.maxUsers}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="py-3 px-2 text-white/60">Atendentes WhatsApp</td>
                  {plans.map((p: DynamicPlan) => (
                    <td key={p.id} className="text-center py-3 px-2 text-white/50">
                      {p.maxAttendantsPerAccount === 0 ? "—" : p.maxAttendantsPerAccount}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="py-3 px-2 text-white/60">Preço</td>
                  {plans.map((p: DynamicPlan) => (
                    <td key={p.id} className="text-center py-3 px-2 text-white font-semibold">
                      {p.priceInCents > 0 ? `R$${(p.priceInCents / 100).toFixed(0)}/mês` : "Sob consulta"}
                    </td>
                  ))}
                </tr>
                {COMPARISON_FEATURE_KEYS.map((row) => (
                  <tr key={row.key} className="border-b border-gray-800/50">
                    <td className="py-3 px-2 text-white/60">
                      {(featureDescriptions as any)[row.key]?.title || row.label}
                    </td>
                    {plans.map((p: DynamicPlan) => (
                      <td key={p.id} className="text-center py-3 px-2">
                        {p.features[row.key] ? (
                          <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info text */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-xs text-white/30">
            Pagamento processado pela Hotmart. Você pode cancelar a qualquer momento.
          </p>
          {!isRestricted && (
            <button
              onClick={() => navigate("/dashboard")}
              className="text-sm text-white/40 hover:text-white/60 hover:underline"
            >
              Voltar para o dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
