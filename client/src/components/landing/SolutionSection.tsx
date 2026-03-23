import { FadeIn } from "./FadeIn";
import { LayoutDashboard, MessageSquare, BarChart3, Users, Zap, Target } from "lucide-react";

const MOCKUP_URL = "https://aceleradora.tur.br/teste/wp-content/uploads/2026/03/ChatGPT-Image-22-de-mar.-de-2026-14_07_25.png";

const capabilities = [
  {
    icon: LayoutDashboard,
    title: "Pipeline visual",
    desc: "Veja todas as negociações em um funil Kanban. Saiba exatamente onde cada cliente está no processo de compra.",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp integrado",
    desc: "Converse com seus clientes direto do sistema. Histórico completo, sem perder mensagem, sem depender do celular pessoal.",
  },
  {
    icon: Zap,
    title: "Follow-up automático",
    desc: "O sistema lembra você de retornar para cada cliente no momento certo. Nenhuma negociação fica esquecida.",
  },
  {
    icon: Users,
    title: "Gestão de equipe",
    desc: "Distribua leads, acompanhe a performance de cada vendedor e padronize o processo comercial da agência.",
  },
  {
    icon: Target,
    title: "Metas e produtividade",
    desc: "Defina metas individuais e coletivas. Acompanhe em tempo real quem está batendo e quem precisa de apoio.",
  },
  {
    icon: BarChart3,
    title: "Relatórios inteligentes",
    desc: "Saiba quanto está vendendo, de onde vêm os clientes, quais destinos vendem mais e onde estão os gargalos.",
  },
];

export function SolutionSection() {
  return (
    <section id="solucao" className="relative py-24 sm:py-32">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-0 w-[600px] h-[600px] bg-violet-600/6 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 relative z-10">
        <FadeIn>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-sm font-medium text-violet-400/80 bg-violet-500/10 border border-violet-500/15 px-4 py-1.5 rounded-full mb-6">
              A solução
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-white mb-6 leading-tight">
              ENTUR OS: o sistema operacional comercial{" "}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                feito para agências de viagens.
              </span>
            </h2>
            <p className="text-lg text-white/50 leading-relaxed">
              Tudo que sua agência precisa para organizar vendas, acompanhar clientes e crescer com previsibilidade.
              Em um único lugar.
            </p>
          </div>
        </FadeIn>

        {/* Mockup */}
        <FadeIn delay={0.15}>
          <div className="relative mb-20">
            <div className="absolute -inset-6 bg-gradient-to-r from-violet-600/15 via-purple-600/10 to-indigo-600/15 rounded-3xl blur-3xl" />
            <div className="relative bg-[#12121a] rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/40">
              <div className="flex items-center gap-1.5 px-5 py-3 bg-white/[0.03] border-b border-white/[0.06]">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="ml-4 text-xs text-white/25 font-mono">entur.os/pipeline</span>
              </div>
              <img
                src={MOCKUP_URL}
                alt="ENTUR OS - Pipeline de Vendas"
                className="w-full"
                loading="lazy"
              />
            </div>
          </div>
        </FadeIn>

        {/* Capabilities grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {capabilities.map((cap, i) => (
            <FadeIn key={cap.title} delay={i * 0.08}>
              <div className="group bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:bg-violet-500/[0.04] hover:border-violet-500/15 transition-all duration-300 h-full">
                <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4 group-hover:bg-violet-500/15 transition-colors">
                  <cap.icon className="w-5 h-5 text-violet-400" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{cap.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{cap.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
