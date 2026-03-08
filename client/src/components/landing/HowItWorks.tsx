import { FadeIn } from "./FadeIn";
import { Eye, Bell, Zap } from "lucide-react";

const STEPS = [
  {
    icon: <Eye className="w-7 h-7" />,
    title: "Visualize todas as negociações",
    description: "Pipeline visual com todas as propostas organizadas por etapa. Saiba exatamente onde cada cliente está no processo de compra.",
    color: "violet",
    gradient: "from-violet-500/15 to-purple-500/15",
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-400",
    borderHover: "hover:border-violet-500/25",
    number: "01",
  },
  {
    icon: <Bell className="w-7 h-7" />,
    title: "Saiba quando fazer follow-up",
    description: "Alertas automáticos de acompanhamento. Nunca mais esqueça de retornar para um cliente que pediu orçamento.",
    color: "emerald",
    gradient: "from-emerald-500/15 to-teal-500/15",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    borderHover: "hover:border-emerald-500/25",
    number: "02",
  },
  {
    icon: <Zap className="w-7 h-7" />,
    title: "Transforme atendimentos em vendas",
    description: "Converta mais clientes com processos estruturados. Acompanhe métricas de conversão e identifique gargalos.",
    color: "amber",
    gradient: "from-amber-500/15 to-orange-500/15",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
    borderHover: "hover:border-amber-500/25",
    number: "03",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 sm:py-28 px-5 sm:px-8">
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
              Como funciona
            </h2>
            <p className="text-lg text-white/40">
              Três passos para transformar sua operação comercial
            </p>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((step, i) => (
            <FadeIn key={i} delay={0.1 * (i + 1)}>
              <div className={`group relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-7 ${step.borderHover} transition-all duration-300 hover:bg-white/[0.05] h-full`}>
                <span className="absolute top-5 right-5 text-4xl font-bold text-white/[0.04] group-hover:text-white/[0.08] transition-colors">
                  {step.number}
                </span>
                <div className={`w-14 h-14 rounded-2xl ${step.iconBg} flex items-center justify-center ${step.iconColor} mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  {step.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{step.description}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
