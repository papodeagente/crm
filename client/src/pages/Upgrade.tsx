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

  // Hotmart checkout URLs — will be configured via env or hardcoded
  const hotmartUrls = {
    start: "https://pay.hotmart.com/SEU_PRODUTO_START",
    growth: "https://pay.hotmart.com/SEU_PRODUTO_GROWTH",
    scale: "https://pay.hotmart.com/SEU_PRODUTO_SCALE",
  };

  const plans = [
    {
      id: "start" as const,
      name: "Start",
      price: "R$67",
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
      price: "R$97",
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-100/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900">Entur OS</span>
          </div>

          {isRestricted ? (
            <>
              <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-full text-sm font-medium mb-4 border border-red-200">
                <Lock className="w-4 h-4" />
                {billing?.billingStatus === "expired" ? "Sua assinatura expirou" : "Acesso restrito"}
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Continue usando o Entur OS
              </h1>
              <p className="text-slate-500 max-w-lg mx-auto">
                {billing?.message || "Assine um plano para continuar gerenciando suas vendas e clientes sem interrupção."}
              </p>
            </>
          ) : isTrialing ? (
            <>
              <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-4 border border-purple-200">
                <Clock className="w-4 h-4" />
                Período de teste ativo
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Escolha o plano ideal para sua agência
              </h1>
              <p className="text-slate-500 max-w-lg mx-auto">
                Garanta acesso contínuo ao Entur OS. Assine antes do fim do período de teste.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Escolha o plano ideal
              </h1>
              <p className="text-slate-500 max-w-lg mx-auto">
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
                border: "border-purple-200",
                bg: "bg-purple-100",
                text: "text-purple-600",
                badge: "bg-purple-100 text-purple-700",
                btn: "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-200/50",
              },
              violet: {
                border: "border-violet-300",
                bg: "bg-violet-100",
                text: "text-violet-600",
                badge: "bg-violet-100 text-violet-700",
                btn: "bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 shadow-lg shadow-violet-200/50",
              },
              slate: {
                border: "border-slate-200",
                bg: "bg-slate-100",
                text: "text-slate-600",
                badge: "bg-slate-100 text-slate-700",
                btn: "bg-slate-800 hover:bg-slate-900",
              },
            };
            const colors = colorMap[plan.color] || colorMap.purple;

            return (
              <Card
                key={plan.id}
                className={`${isPopular ? `border-2 ${colors.border} shadow-xl` : "border border-slate-200 shadow-lg"} bg-white relative overflow-hidden`}
              >
                {isPopular && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 ${colors.bg} rounded-lg flex items-center justify-center`}>
                      <plan.icon className={`w-4 h-4 ${colors.text}`} />
                    </div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {isPopular && (
                      <span className={`ml-auto ${colors.badge} text-xs font-medium px-2 py-0.5 rounded-full`}>
                        Mais popular
                      </span>
                    )}
                    {isCurrent && (
                      <span className="ml-auto bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        Plano atual
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                    {plan.period && <span className="text-slate-500">{plan.period}</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{plan.description}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                          <Check className={`w-2.5 h-2.5 ${colors.text}`} />
                        </div>
                        <span className="text-sm text-slate-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                  {plan.id === "scale" ? (
                    <Button
                      variant="outline"
                      className="w-full h-10 border-slate-300 hover:bg-slate-50 font-medium"
                      onClick={() => window.open("https://wa.me/5511999999999?text=Olá! Gostaria de saber mais sobre o plano Scale do Entur OS.", "_blank")}
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
          <p className="text-xs text-slate-400">
            Pagamento processado pela Hotmart. Você pode cancelar a qualquer momento.
          </p>
          {!isRestricted && (
            <button
              onClick={() => navigate("/dashboard")}
              className="text-sm text-slate-500 hover:text-slate-700 hover:underline"
            >
              Voltar para o dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
