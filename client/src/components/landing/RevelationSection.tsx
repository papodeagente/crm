import { FadeIn } from "./FadeIn";
import { Lightbulb, ArrowRight } from "lucide-react";

export function RevelationSection() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="max-w-5xl mx-auto px-5 sm:px-8">
        <FadeIn>
          <div className="relative bg-gradient-to-br from-violet-500/[0.06] to-purple-500/[0.03] border border-violet-500/10 rounded-3xl p-8 sm:p-12 lg:p-16 overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/20 mb-6">
                <Lightbulb className="w-6 h-6 text-violet-400" />
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-6 leading-tight">
                A diferença entre agências que crescem e agências que sobrevivem{" "}
                <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  é processo comercial.
                </span>
              </h2>

              <div className="space-y-4 mb-8">
                <p className="text-base sm:text-lg text-white/50 leading-relaxed">
                  Depois de treinar mais de 8.000 agentes de viagens, a Escola de Negócios do Turismo
                  identificou um padrão claro: as agências que mais faturam não são as que têm mais leads.
                </p>
                <p className="text-base sm:text-lg text-white/70 font-medium leading-relaxed">
                  São as que têm processo. Acompanham cada negociação. Fazem follow-up no momento certo.
                  E nunca deixam um cliente cair no esquecimento.
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 mb-8">
                {[
                  { number: "3x", label: "mais conversão", sub: "com follow-up estruturado" },
                  { number: "40%", label: "menos tempo", sub: "em tarefas operacionais" },
                  { number: "2x", label: "mais recompra", sub: "com gestão de base ativa" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-violet-400 mb-1">{stat.number}</div>
                    <div className="text-sm font-medium text-white/70">{stat.label}</div>
                    <div className="text-xs text-white/40 mt-0.5">{stat.sub}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-violet-400 text-sm font-medium">
                <span>Foi por isso que criamos o ENTUR OS</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
