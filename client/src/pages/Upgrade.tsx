import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Plane, Lock, Check, ArrowRight, Crown, Building2, Zap, Rocket, Clock, ExternalLink, MessageSquare, Target, Headphones, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PLANS, PLAN_ORDER, FEATURE_DESCRIPTIONS, type PlanId, type PlanFeatures } from "../../../shared/plans";

const SCALE_WHATSAPP_URL = "https://wa.me/551151982627?text=Quero%20conhecer%20o%20Plano%20Elite%20do%20Entur%20OS.%20Pode%20me%20ajudar%3F";

const planIcons: Record<PlanId, any> = {
  start: Zap,
  growth: Rocket,
  scale: Building2,
};

const planColors: Record<PlanId, { border: string; bg: string; text: string; badge: string; btn: string }> = {
  start: {
    border: "border-purple-500/30",
    bg: "bg-purple-500/15",
    text: "text-purple-400",
    badge: "bg-purple-500/15 text-purple-400",
    btn: "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 shadow-lg shadow-purple-900/30",
  },
  growth: {
    border: "border-violet-500/40",
    bg: "bg-violet-500/15",
    text: "text-violet-400",
    badge: "bg-violet-500/15 text-violet-400",
    btn: "bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 shadow-lg shadow-violet-900/30",
  },
  scale: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-400",
    btn: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-900/30",
  },
};

function getFeatureList(planId: PlanId): string[] {
  const plan = PLANS[planId];
  const items: string[] = [];

  // Users
  items.push(plan.maxUsers === 1 ? "1 usuário" : `Até ${plan.maxUsers} usuários`);

  // WhatsApp
  if (plan.features.whatsappEmbedded) {
    items.push(`WhatsApp integrado (${plan.maxAttendantsPerAccount} atendentes)`);
  } else {
    items.push("Sem WhatsApp integrado");
  }

  // CRM
  items.push("CRM completo (contatos, negociações, funil, tarefas)");

  // Features específicas
  if (plan.features.segmentedBroadcast) items.push("Disparo segmentado de mensagens");
  if (plan.features.rfvEnabled) items.push("Classificação Estratégica (Matriz RFV)");
  if (plan.features.salesAutomation) items.push("Central de Automação de vendas");
  if (plan.features.prioritySupport) items.push("Suporte prioritário");
  if (plan.features.communityAccess) items.push("Comunidade Acelera Turismo");

  return items;
}

// Hotmart checkout URLs
const hotmartUrls: Record<PlanId, string> = {
  start: "https://pay.hotmart.com/S104799458W?off=axm3bvsz",
  growth: "https://pay.hotmart.com/S104799458W?off=pubryjat",
  scale: "",
};

export default function Upgrade() {
  const [, navigate] = useLocation();
  const billingQuery = trpc.billing.myBilling.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const billing = billingQuery.data;
  const isRestricted = billing?.level === "restricted";
  const isTrialing = billing?.billingStatus === "trialing";
  const currentPlan = billing?.plan || "start";

  return (
    <div className="min-h-screen bg-[#0a0a12] flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-900/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-900/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/30">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Entur OS</span>
          </div>

          {isRestricted ? (
            <>
              <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 px-4 py-2 rounded-full text-sm font-medium mb-4 border border-red-500/20">
                <Lock className="w-4 h-4" />
                {billing?.billingStatus === "expired" ? "Sua assinatura expirou" : "Acesso restrito"}
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Continue usando o Entur OS
              </h1>
              <p className="text-gray-400 max-w-lg mx-auto">
                {billing?.message || "Assine um plano para continuar gerenciando suas vendas e clientes sem interrupção."}
              </p>
            </>
          ) : isTrialing ? (
            <>
              <div className="inline-flex items-center gap-2 bg-purple-500/10 text-purple-400 px-4 py-2 rounded-full text-sm font-medium mb-4 border border-purple-500/20">
                <Clock className="w-4 h-4" />
                Período de teste ativo
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Escolha o plano ideal para sua agência
              </h1>
              <p className="text-gray-400 max-w-lg mx-auto">
                Garanta acesso contínuo ao Entur OS. Assine antes do fim do período de teste.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-white mb-2">
                Escolha o plano ideal
              </h1>
              <p className="text-gray-400 max-w-lg mx-auto">
                Potencialize sua agência de viagens com as ferramentas certas
              </p>
            </>
          )}
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-5">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            const isCurrent = currentPlan === planId;
            const isPopular = planId === "growth";
            const PlanIcon = planIcons[planId];
            const colors = planColors[planId];
            const features = getFeatureList(planId);

            return (
              <Card
                key={planId}
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
                    {plan.priceInCents > 0 ? (
                      <>
                        <span className="text-3xl font-bold text-white">R${(plan.priceInCents / 100).toFixed(0)}</span>
                        <span className="text-gray-500">/mês</span>
                      </>
                    ) : (
                      <span className="text-3xl font-bold text-white">Sob consulta</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{plan.commercialCopy}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                          <Check className={`w-2.5 h-2.5 ${colors.text}`} />
                        </div>
                        <span className="text-sm text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>
                  {planId === "scale" ? (
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
                      onClick={() => window.open(hotmartUrls[planId], "_blank")}
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
        <div className="mt-12 bg-[#12121e] border border-gray-800 rounded-xl p-6 overflow-x-auto">
          <h2 className="text-xl font-bold text-white mb-6 text-center">Compare os planos</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-2 text-gray-400 font-medium">Recurso</th>
                {PLAN_ORDER.map(id => (
                  <th key={id} className="text-center py-3 px-2 text-gray-300 font-semibold">
                    {PLANS[id].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800/50">
                <td className="py-3 px-2 text-gray-300">Usuários</td>
                {PLAN_ORDER.map(id => (
                  <td key={id} className="text-center py-3 px-2 text-gray-400">
                    {PLANS[id].maxUsers === -1 ? "Ilimitado" : PLANS[id].maxUsers}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="py-3 px-2 text-gray-300">Atendentes WhatsApp</td>
                {PLAN_ORDER.map(id => (
                  <td key={id} className="text-center py-3 px-2 text-gray-400">
                    {PLANS[id].maxAttendantsPerAccount === 0 ? "—" : PLANS[id].maxAttendantsPerAccount}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="py-3 px-2 text-gray-300">Preço</td>
                {PLAN_ORDER.map(id => (
                  <td key={id} className="text-center py-3 px-2 text-white font-semibold">
                    {PLANS[id].priceInCents > 0 ? `R$${(PLANS[id].priceInCents / 100).toFixed(0)}/mês` : "Sob consulta"}
                  </td>
                ))}
              </tr>
              {(Object.keys(FEATURE_DESCRIPTIONS) as (keyof PlanFeatures)[]).map(featureKey => (
                <tr key={featureKey} className="border-b border-gray-800/50">
                  <td className="py-3 px-2 text-gray-300">{FEATURE_DESCRIPTIONS[featureKey].title}</td>
                  {PLAN_ORDER.map(id => (
                    <td key={id} className="text-center py-3 px-2">
                      {PLANS[id].features[featureKey] ? (
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

        {/* Info text */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-xs text-gray-600">
            Pagamento processado pela Hotmart. Você pode cancelar a qualquer momento.
          </p>
          {!isRestricted && (
            <button
              onClick={() => navigate("/dashboard")}
              className="text-sm text-gray-500 hover:text-gray-300 hover:underline"
            >
              Voltar para o dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
