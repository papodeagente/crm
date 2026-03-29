import { FadeIn } from "./FadeIn";
import { MessageSquareX, BellOff, EyeOff } from "lucide-react";

const problems = [
  {
    icon: MessageSquareX,
    title: "Orçamentos que somem",
    description:
      "O cliente pede cotação pelo WhatsApp. Você envia. Ele some. Você esquece. A venda morre.",
  },
  {
    icon: BellOff,
    title: "Follow-up que não acontece",
    description:
      "Ninguém lembra quem precisa de retorno. Não tem alerta. Não tem fila. O cliente compra com outro.",
  },
  {
    icon: EyeOff,
    title: "Dinheiro invisível",
    description:
      "Você não sabe quantas vendas perdeu este mês, nem por quê. Sem dados, não tem como melhorar.",
  },
];

export function ProblemSection() {
  return (
    <section className="py-24 sm:py-32 px-5 sm:px-8 relative overflow-hidden bg-[#08080f]">
      <div className="max-w-5xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-14">
            <p className="text-sm font-medium text-violet-400 uppercase tracking-wider mb-4">
              O diagnóstico
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
              Toda agência tem clientes.{" "}
              <br className="hidden sm:block" />
              Poucas têm processo.
            </h2>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-14">
          {problems.map((problem, idx) => (
            <FadeIn key={idx} delay={0.1 * (idx + 1)}>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 h-full hover:border-white/[0.12] transition-colors duration-300">
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mb-5">
                  <problem.icon className="w-6 h-6 text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">
                  {problem.title}
                </h3>
                <p className="text-sm text-white/45 leading-relaxed">
                  {problem.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.5}>
          <p className="text-center text-base sm:text-lg text-violet-300/80 max-w-3xl mx-auto leading-relaxed font-medium">
            Depois de treinar mais de 8.000 agentes, a Escola de Negócios
            do Turismo construiu o sistema que resolve esses três problemas.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
