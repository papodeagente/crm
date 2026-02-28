import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import {
  Plane, ArrowRight, Check, BarChart3, Users, MessageSquare,
  Zap, Shield, Globe, Star, ChevronRight, Sparkles,
  PieChart, Target, Calendar, FileText, Bot
} from "lucide-react";

export default function Landing() {
  const [, navigate] = useLocation();

  const features = [
    {
      icon: <Target className="w-6 h-6" />,
      title: "Pipeline de Vendas Inteligente",
      description: "Gerencie suas negociações com funis personalizáveis, automações e indicadores em tempo real. Visualize cada etapa da venda.",
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: "WhatsApp Integrado com IA",
      description: "Atenda seus clientes direto pelo WhatsApp com chatbot inteligente, respostas automáticas e histórico completo de conversas.",
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Gestão de Contatos 360°",
      description: "Perfil completo do cliente com histórico de compras, cotações, viagens e campos personalizáveis para cada agência.",
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Propostas e Contratos Digitais",
      description: "Crie propostas profissionais com assinatura digital. Envie cotações e feche vendas mais rápido.",
    },
    {
      icon: <PieChart className="w-6 h-6" />,
      title: "Relatórios e Análises",
      description: "Dashboards com métricas de vendas, performance da equipe, análise de fontes e campanhas de marketing.",
    },
    {
      icon: <Bot className="w-6 h-6" />,
      title: "Automações Inteligentes",
      description: "Automatize tarefas repetitivas, distribua leads, envie follow-ups e mova negociações entre funis automaticamente.",
    },
  ];

  const differentials = [
    { icon: <Plane className="w-5 h-5" />, text: "Feito exclusivamente para agências de viagens" },
    { icon: <Globe className="w-5 h-5" />, text: "Funil de pós-venda para gestão de viagens" },
    { icon: <Zap className="w-5 h-5" />, text: "Importação direta do RD Station CRM" },
    { icon: <Shield className="w-5 h-5" />, text: "Dados seguros e isolados por agência" },
    { icon: <Calendar className="w-5 h-5" />, text: "Gestão de tarefas com calendário integrado" },
    { icon: <Sparkles className="w-5 h-5" />, text: "IA para análise de atendimento e vendas" },
  ];

  const testimonials = [
    {
      name: "Ana Souza",
      role: "Diretora — Viagens & Sonhos",
      text: "O Entur OS transformou nossa operação. Antes perdíamos clientes por falta de follow-up, agora tudo é automatizado.",
      rating: 5,
    },
    {
      name: "Carlos Mendes",
      role: "Gerente Comercial — TripMaster",
      text: "A integração com WhatsApp e o pipeline visual nos deram uma visão clara de cada negociação. Vendas aumentaram 40%.",
      rating: 5,
    },
    {
      name: "Juliana Costa",
      role: "CEO — Destinos Premium",
      text: "Migrar do RD Station foi simples. Importamos tudo em minutos e a equipe se adaptou rapidamente ao novo sistema.",
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center">
              <Plane className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold">Entur OS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Recursos</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Preços</a>
            <a href="#testimonials" className="hover:text-slate-900 transition-colors">Depoimentos</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-sm" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button
              className="text-sm bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-200/50"
              onClick={() => navigate("/register")}
            >
              Começar grátis
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-purple-50 rounded-full blur-3xl opacity-60" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-50 rounded-full blur-3xl opacity-40" />
        </div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-purple-100">
              <Sparkles className="w-4 h-4" />
              CRM inteligente para agências de viagens
            </div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6 tracking-tight">
              Venda mais viagens com{" "}
              <span className="bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                inteligência
              </span>
            </h1>
            <p className="text-xl text-slate-500 mb-8 max-w-2xl leading-relaxed">
              O Entur OS é o CRM completo feito para agências de viagens. Pipeline de vendas,
              WhatsApp integrado, automações e IA — tudo em uma plataforma.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="h-13 px-8 text-base bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-xl shadow-purple-200/50"
                onClick={() => navigate("/register")}
              >
                Começar grátis por 12 meses <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-13 px-8 text-base border-slate-300"
                onClick={() => {
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Ver recursos
              </Button>
            </div>
            <p className="text-sm text-slate-400 mt-4">
              Sem cartão de crédito. Cancele quando quiser.
            </p>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-12 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: "500+", label: "Agências ativas" },
            { value: "50k+", label: "Negociações gerenciadas" },
            { value: "R$2M+", label: "Em vendas processadas" },
            { value: "4.9/5", label: "Satisfação dos clientes" },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que sua agência precisa em um só lugar
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Do primeiro contato à viagem realizada, o Entur OS acompanha cada etapa
              da jornada do seu cliente.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Card key={i} className="border-slate-100 hover:border-purple-200 transition-colors group bg-white">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mb-4 group-hover:bg-purple-100 transition-colors">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Differentials */}
      <section className="py-20 px-6 bg-gradient-to-br from-purple-600 to-purple-800 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Por que agências escolhem o Entur OS
            </h2>
            <p className="text-lg text-purple-200 max-w-2xl mx-auto">
              Não somos um CRM genérico. Somos especialistas no mercado de turismo.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {differentials.map((diff, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  {diff.icon}
                </div>
                <span className="text-sm font-medium">{diff.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Planos simples e transparentes</h2>
            <p className="text-lg text-slate-500">Comece grátis, escale quando precisar</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Pro */}
            <Card className="border-2 border-purple-200 shadow-xl relative overflow-hidden bg-white">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 to-purple-700" />
              <CardContent className="p-8">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold text-lg">Pro</span>
                  <span className="ml-auto bg-purple-100 text-purple-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    Mais popular
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-bold">R$97</span>
                  <span className="text-slate-500">/mês</span>
                </div>
                <p className="text-sm text-green-600 font-medium mb-6">
                  Com 12 meses de avaliação grátis
                </p>
                <div className="space-y-3 mb-8">
                  {[
                    "Pipeline de vendas ilimitado",
                    "WhatsApp integrado com IA",
                    "Gestão completa de contatos",
                    "Relatórios e dashboards",
                    "Automações de funil",
                    "Importação do RD Station",
                    "Propostas digitais",
                    "Suporte por email",
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{f}</span>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium shadow-lg shadow-purple-200/50"
                  onClick={() => navigate("/register")}
                >
                  Começar grátis <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise */}
            <Card className="border border-slate-200 bg-white">
              <CardContent className="p-8">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-slate-600" />
                  <span className="font-semibold text-lg">Enterprise</span>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold">Personalizado</span>
                </div>
                <p className="text-sm text-slate-500 mb-6">
                  Para redes e grandes operações
                </p>
                <div className="space-y-3 mb-8">
                  {[
                    "Tudo do plano Pro",
                    "Usuários ilimitados",
                    "API de integração",
                    "Onboarding personalizado",
                    "Suporte prioritário",
                    "SLA garantido",
                    "Customizações sob medida",
                    "Treinamento da equipe",
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{f}</span>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full h-12 border-slate-300 font-medium"
                  onClick={() => window.open("https://wa.me/5511999999999?text=Olá! Gostaria de saber mais sobre o plano Enterprise do Entur OS.", "_blank")}
                >
                  Falar com vendas <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">O que nossos clientes dizem</h2>
            <p className="text-lg text-slate-500">Agências que transformaram suas vendas com o Entur OS</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <Card key={i} className="border-slate-100 bg-white">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed italic">"{t.text}"</p>
                  <div>
                    <p className="font-medium text-sm text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para vender mais viagens?
          </h2>
          <p className="text-lg text-slate-500 mb-8">
            Comece agora com 12 meses grátis. Sem cartão de crédito, sem compromisso.
          </p>
          <Button
            size="lg"
            className="h-14 px-10 text-base bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-xl shadow-purple-200/50"
            onClick={() => navigate("/register")}
          >
            Criar minha conta grátis <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Plane className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-white">Entur OS</span>
          </div>
          <p className="text-sm">
            &copy; {new Date().getFullYear()} Entur OS. Todos os direitos reservados.
          </p>
          <div className="flex gap-6 text-sm">
            <a href="#" className="hover:text-white transition-colors">Termos</a>
            <a href="#" className="hover:text-white transition-colors">Privacidade</a>
            <a href="#" className="hover:text-white transition-colors">Suporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
