import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Plane, Lock, Check, ArrowRight, Crown, Building2, Zap, Rocket, Clock, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";

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

  // Hotmart checkout URLs
  const hotmartUrls = {
    start: "https://pay.hotmart.com/S104799458W?off=axm3bvsz",
    growth: "https://pay.hotmart.com/S104799458W?off=pubryjat",
    scale: "", // sob consulta
  };

  const plans = [
    {
      id: "start" as const,
      name: "Start",
      price: "R$97",
      period: "/mês",
      description: "Para agências que estão começando a organizar suas vendas",
      icon: Zap,
      color: "purple",
      popular: false,
      features: [
        "1 usuário",
        "1 instância WhatsApp",
        "CRM completo",
        "Pipeline de vendas",
        "Gestão de contatos e empresas",
        "Relatórios básicos",
        "Suporte por email",
      ],
    },
    {
      id: "growth" as const,
      name: "Growth",
      price: "R$297",
      period: "/mês",
      description: "Para agências em crescimento que precisam de automação e equipe",
      icon: Rocket,
      color: "violet",
      popular: true,
      features: [
        "Até 5 usuários",
        "1 instância WhatsApp (5 agentes)",
        "Tudo do Start",
        "Centro de Automação completo",
        "Classificação Estratégica (RFV)",
        "Campanhas de WhatsApp",
        "Suporte prioritário",
      ],
    },
    {
      id: "scale" as const,
      name: "Scale",
      price: "Sob consulta",
      period: "",
      description: "Para agências que precisam de escala total e suporte dedicado",
      icon: Building2,
      color: "slate",
      popular: false,
      features: [
        "Usuários ilimitados",
        "Instâncias WhatsApp ilimitadas",
        "Tudo do Growth",
        "API de integração",
        "Onboarding personalizado",
        "SLA garantido",
        "Treinamento da equipe",
      ],
    },
  ];

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
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const isPopular = plan.popular;
            const colorMap: Record<string, { border: string; bg: string; text: string; badge: string; btn: string }> = {
              purple: {
                border: "border-purple-500/30",
                bg: "bg-purple-500/15",
                text: "text-purple-400",
                badge: "bg-purple-500/15 text-purple-400",
                btn: "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 shadow-lg shadow-purple-900/30",
              },
              violet: {
                border: "border-violet-500/40",
                bg: "bg-violet-500/15",
                text: "text-violet-400",
                badge: "bg-violet-500/15 text-violet-400",
                btn: "bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 shadow-lg shadow-violet-900/30",
              },
              slate: {
                border: "border-gray-700",
                bg: "bg-gray-500/15",
                text: "text-gray-400",
                badge: "bg-gray-500/15 text-gray-400",
                btn: "bg-gray-700 hover:bg-gray-600",
              },
            };
            const colors = colorMap[plan.color] || colorMap.purple;

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
                      <plan.icon className={`w-4 h-4 ${colors.text}`} />
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
                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                    {plan.period && <span className="text-gray-500">{plan.period}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                          <Check className={`w-2.5 h-2.5 ${colors.text}`} />
                        </div>
                        <span className="text-sm text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>
                  {plan.id === "scale" ? (
                    <Button
                      variant="outline"
                      className="w-full h-10 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white font-medium"
                      onClick={() => window.open("https://wa.me/551151982627?text=" + encodeURIComponent("Quero conhecer o Plano Scale do Entur OS. Pode me ajudar?"), "_blank")}
                    >
                      Falar com vendas <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      className={`w-full h-10 text-white font-medium ${colors.btn}`}
                      onClick={() => window.open(hotmartUrls[plan.id], "_blank")}
                    >
                      {isCurrent ? "Renovar assinatura" : "Assinar agora"} <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
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
