import { FadeIn } from "./FadeIn";
import { Quote } from "lucide-react";

const results = [
  {
    text: "Agência com 3 agentes recuperou 40% dos orçamentos parados nos primeiros 60 dias usando os alertas de follow-up.",
  },
  {
    text: "Operação solo organizou 180 negociações em funil e identificou R$ 47 mil em vendas esquecidas na primeira semana.",
  },
  {
    text: "Equipe de 5 pessoas reduziu tempo de resposta no WhatsApp de 4 horas para 12 minutos com o inbox integrado.",
  },
];

export function ResultsSection() {
  return (
    <section className="py-24 sm:py-32 px-5 sm:px-8 relative overflow-hidden bg-[#08080f]">
      <div className="max-w-5xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-14">
            <p className="text-sm font-medium text-violet-400 uppercase tracking-wider mb-4">
              Resultados
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
              O que muda quando a agência tem processo
            </h2>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {results.map((result, idx) => (
            <FadeIn key={idx} delay={0.1 * (idx + 1)}>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 h-full hover:border-white/[0.12] transition-colors duration-300 relative">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mb-5">
                  <Quote className="w-5 h-5 text-violet-400" />
                </div>
                <p className="text-base text-white/70 leading-relaxed italic">
                  "{result.text}"
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
