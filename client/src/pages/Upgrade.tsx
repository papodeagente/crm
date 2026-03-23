import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Plane, Lock, Check, ArrowRight, Crown, Building2, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Upgrade() {
  const [, navigate] = useLocation();
  const meQuery = trpc.saasAuth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });

  const isExpired = meQuery.data?.access?.reason === "FREEMIUM_EXPIRED" ||
    meQuery.data?.access?.reason === "SUBSCRIPTION_EXPIRED" ||
    meQuery.data?.access?.reason === "SUSPENDED";

  const hotmartCheckoutUrl = "https://pay.hotmart.com/SEU_PRODUTO_HOTMART"; // Will be configured via env

  const proFeatures = [
    "Pipeline de vendas ilimitado",
    "WhatsApp integrado com IA",
    "Gestão completa de contatos",
    "Relatórios e dashboards",
    "Automações de funil",
    "Importação de dados (RD Station)",
    "Catálogo de produtos turísticos",
    "Propostas e contratos digitais",
    "Suporte por email",
  ];

  const enterpriseFeatures = [
    "Tudo do plano Pro",
    "Múltiplos usuários ilimitados",
    "API de integração",
    "Onboarding personalizado",
    "Suporte prioritário",
    "SLA garantido",
    "Customizações sob medida",
    "Treinamento da equipe",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-100/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900">Entur OS</span>
          </div>

          {isExpired ? (
            <>
              <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-full text-sm font-medium mb-4 border border-amber-200">
                <Lock className="w-4 h-4" />
                Seu período gratuito expirou
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Continue usando o Entur OS
              </h1>
              <p className="text-slate-500 max-w-lg mx-auto">
                Seu período de avaliação gratuita terminou. Assine o plano Pro para continuar
                gerenciando suas vendas e clientes sem interrupção.
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
        <div className="grid md:grid-cols-2 gap-6">
          {/* Pro Plan */}
          <Card className="border-2 border-purple-200 shadow-xl shadow-purple-100/50 bg-white relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-purple-700" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-purple-600" />
                </div>
                <CardTitle className="text-lg">Pro</CardTitle>
                <span className="ml-auto bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  Mais popular
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-slate-900">R$97</span>
                <span className="text-slate-500">/mês</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Com avaliação gratuita inclusa
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2.5">
                {proFeatures.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-purple-600" />
                    </div>
                    <span className="text-sm text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>
              <Button
                className="w-full h-11 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium shadow-lg shadow-purple-200/50"
                onClick={() => window.open(hotmartCheckoutUrl, "_blank")}
              >
                Assinar agora <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Enterprise Plan */}
          <Card className="border border-slate-200 shadow-lg bg-white">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-slate-600" />
                </div>
                <CardTitle className="text-lg">Enterprise</CardTitle>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-slate-900">Personalizado</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Para grandes operações e redes de agências
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2.5">
                {enterpriseFeatures.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-slate-600" />
                    </div>
                    <span className="text-sm text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full h-11 border-slate-300 hover:bg-slate-50 font-medium"
                onClick={() => window.open("https://wa.me/5511999999999?text=Olá! Gostaria de saber mais sobre o plano Enterprise do Entur OS.", "_blank")}
              >
                Falar com vendas <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Back link */}
        {!isExpired && (
          <div className="text-center mt-6">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-sm text-slate-500 hover:text-slate-700 hover:underline"
            >
              Voltar para o dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
