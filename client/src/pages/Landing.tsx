import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import {
  Plane, ArrowRight, Check, BarChart3, Users, MessageSquare,
  Zap, Shield, Globe, Star, ChevronRight, Sparkles,
  PieChart, Target, Calendar, FileText, Bot
} from "lucide-react";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663249817763/XXuAsdiNIcgnwwra.png";

export default function Landing() {
  const [, navigate] = useLocation();

  const features = [
    {
      icon: <Target className="w-6 h-6" />,
      title: "Pipeline de Vendas Inteligente",
      description: "Gerencie suas negociações com funis personalizáveis, automações e indicadores em tempo real.",
      gradient: "from-purple-500/20 to-violet-500/20",
      iconColor: "text-purple-400",
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: "WhatsApp Integrado com IA",
      description: "Atenda seus clientes direto pelo WhatsApp com chatbot inteligente e histórico completo.",
      gradient: "from-emerald-500/20 to-teal-500/20",
      iconColor: "text-emerald-400",
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Gestão de Contatos 360°",
      description: "Perfil completo do cliente com histórico de compras, cotações e campos personalizáveis.",
      gradient: "from-blue-500/20 to-cyan-500/20",
      iconColor: "text-blue-400",
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Propostas e Contratos Digitais",
      description: "Crie propostas profissionais com assinatura digital. Envie cotações e feche vendas mais rápido.",
      gradient: "from-amber-500/20 to-orange-500/20",
      iconColor: "text-amber-400",
    },
    {
      icon: <PieChart className="w-6 h-6" />,
      title: "Relatórios e Análises",
      description: "Dashboards com métricas de vendas, performance da equipe e análise de fontes.",
      gradient: "from-rose-500/20 to-pink-500/20",
      iconColor: "text-rose-400",
    },
    {
      icon: <Bot className="w-6 h-6" />,
      title: "Automações Inteligentes",
      description: "Automatize tarefas repetitivas, distribua leads e envie follow-ups automaticamente.",
      gradient: "from-indigo-500/20 to-purple-500/20",
      iconColor: "text-indigo-400",
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
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={LOGO_URL} alt="Entur OS" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold bg-gradient-to-r from-purple-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              ENTUR OS
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/50">
            <a href="#features" className="hover:text-white transition-colors">Recursos</a>
            <a href="#pricing" className="hover:text-white transition-colors">Preços</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Depoimentos</a>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="text-sm text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => navigate("/login")}
            >
              Entrar
            </Button>
            <Button
              className="text-sm bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white border-0 shadow-lg shadow-purple-500/25"
              onClick={() => navigate("/register")}
            >
              Começar grátis
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-purple-600/15 via-violet-600/10 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-fuchsia-600/8 rounded-full blur-3xl" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px"
          }} />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/[0.06] text-purple-300 px-4 py-1.5 rounded-full text-sm font-medium mb-8 border border-white/[0.08]">
              <Sparkles className="w-4 h-4" />
              CRM inteligente para agências de viagens
            </div>
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] mb-6 tracking-tight">
              Venda mais viagens{" "}
              <br className="hidden md:block" />
              com{" "}
              <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                inteligência
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/50 mb-10 max-w-2xl mx-auto leading-relaxed">
              O Entur OS é o CRM completo feito para agências de viagens. Pipeline de vendas,
              WhatsApp integrado, automações e IA — tudo em uma plataforma.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="h-14 px-8 text-base bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white border-0 shadow-xl shadow-purple-500/25"
                onClick={() => navigate("/register")}
              >
                Começar grátis por 12 meses <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-base border-white/10 text-white/80 hover:bg-white/5 hover:text-white bg-transparent"
                onClick={() => {
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Ver recursos
              </Button>
            </div>
            <p className="text-sm text-white/30 mt-5">
              Sem cartão de crédito. Cancele quando quiser.
            </p>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-12 border-y border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: "500+", label: "Agências ativas" },
            { value: "50k+", label: "Negociações gerenciadas" },
            { value: "R$2M+", label: "Em vendas processadas" },
            { value: "4.9/5", label: "Satisfação dos clientes" },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-white/40 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo que sua agência precisa em um só lugar
            </h2>
            <p className="text-lg text-white/40 max-w-2xl mx-auto">
              Do primeiro contato à viagem realizada, o Entur OS acompanha cada etapa
              da jornada do seu cliente.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <Card key={i} className="bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 group hover:bg-white/[0.05]">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center ${feature.iconColor} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white">{feature.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Differentials */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-600/10 via-violet-600/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Por que agências escolhem o Entur OS
            </h2>
            <p className="text-lg text-white/40 max-w-2xl mx-auto">
              Não somos um CRM genérico. Somos especialistas no mercado de turismo.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {differentials.map((diff, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/[0.04] backdrop-blur-sm rounded-xl p-5 border border-white/[0.08] hover:border-purple-500/30 transition-colors">
                <div className="w-10 h-10 bg-purple-500/15 rounded-lg flex items-center justify-center flex-shrink-0 text-purple-400">
                  {diff.icon}
                </div>
                <span className="text-sm font-medium text-white/80">{diff.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Planos simples e transparentes</h2>
            <p className="text-lg text-white/40">Comece grátis, escale quando precisar</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Pro */}
            <Card className="bg-white/[0.04] border-purple-500/30 shadow-xl shadow-purple-500/10 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-violet-500" />
              <CardContent className="p-8">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold text-lg text-white">Pro</span>
                  <span className="ml-auto bg-purple-500/20 text-purple-300 text-xs font-medium px-2.5 py-1 rounded-full border border-purple-500/20">
                    Mais popular
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">R$97</span>
                  <span className="text-white/40">/mês</span>
                </div>
                <p className="text-sm text-emerald-400 font-medium mb-6">
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
                      <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span className="text-sm text-white/60">{f}</span>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium shadow-lg shadow-purple-500/25 border-0"
                  onClick={() => navigate("/register")}
                >
                  Começar grátis <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise */}
            <Card className="bg-white/[0.03] border-white/[0.08]">
              <CardContent className="p-8">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-white/50" />
                  <span className="font-semibold text-lg text-white">Enterprise</span>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">Personalizado</span>
                </div>
                <p className="text-sm text-white/40 mb-6">
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
                      <Check className="w-4 h-4 text-white/30 flex-shrink-0" />
                      <span className="text-sm text-white/60">{f}</span>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full h-12 border-white/10 text-white/80 hover:bg-white/5 font-medium bg-transparent"
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
      <section id="testimonials" className="py-24 px-6 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">O que nossos clientes dizem</h2>
            <p className="text-lg text-white/40">Agências que transformaram suas vendas com o Entur OS</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <Card key={i} className="bg-white/[0.03] border-white/[0.06]">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-white/50 mb-4 leading-relaxed italic">"{t.text}"</p>
                  <div>
                    <p className="font-medium text-sm text-white">{t.name}</p>
                    <p className="text-xs text-white/30">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-purple-600/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para vender mais viagens?
          </h2>
          <p className="text-lg text-white/40 mb-8">
            Comece agora com 12 meses grátis. Sem cartão de crédito, sem compromisso.
          </p>
          <Button
            size="lg"
            className="h-14 px-10 text-base bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white shadow-xl shadow-purple-500/25 border-0"
            onClick={() => navigate("/register")}
          >
            Criar minha conta grátis <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/[0.06] bg-[#06060a]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={LOGO_URL} alt="Entur OS" className="h-7 w-7 rounded-lg" />
            <span className="font-bold bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
              ENTUR OS
            </span>
          </div>
          <p className="text-sm text-white/30">
            &copy; {new Date().getFullYear()} Entur OS. Todos os direitos reservados.
          </p>
          <div className="flex gap-6 text-sm text-white/30">
            <a href="#" className="hover:text-white/60 transition-colors">Termos</a>
            <a href="#" className="hover:text-white/60 transition-colors">Privacidade</a>
            <a href="#" className="hover:text-white/60 transition-colors">Suporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
