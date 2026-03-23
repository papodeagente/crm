import { FadeIn } from "./FadeIn";
import { Lightbulb, TrendingUp, Users } from "lucide-react";

export function RevelationSection() {
  return (
    <section className="py-20 sm:py-28 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-violet-600/8 to-transparent rounded-full blur-[100px]" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <FadeIn>
          <div className="bg-gradient-to-br from-violet-500/[0.07] to-purple-500/[0.04] border border-violet-500/15 rounded-2xl p-8 sm:p-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-violet-400" />
              </div>
              <span className="text-sm font-medium text-violet-300/70 uppercase tracking-wider">Revelação</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6 tracking-tight leading-tight">
              Depois de treinar mais de{" "}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                8.000 agentes
              </span>
              , descobrimos um padrão.
            </h2>

            <div className="space-y-6 mb-8">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Users className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="text-white/70 text-lg leading-relaxed">
                    Agências que vendem pouco <span className="text-white font-medium">não têm falta de clientes</span>.
                  </p>
                  <p className="text-white/40 mt-1">
                    Elas têm falta de processo comercial.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white/70 text-lg leading-relaxed">
                    Agências que mais crescem{" "}
                    <span className="text-white font-medium">acompanham cada cliente até a decisão final</span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 pt-4 border-t border-white/[0.06]">
              <div className="text-center">
                <p className="text-2xl font-bold text-violet-400">3x</p>
                <p className="text-xs text-white/30">mais conversão</p>
              </div>
              <div className="w-px h-10 bg-white/[0.08]" />
              <div className="text-center">
                <p className="text-2xl font-bold text-violet-400">8.000+</p>
                <p className="text-xs text-white/30">agentes treinados</p>
              </div>
              <div className="w-px h-10 bg-white/[0.08]" />
              <div className="text-center">
                <p className="text-2xl font-bold text-violet-400">40%</p>
                <p className="text-xs text-white/30">vendas recuperadas</p>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
