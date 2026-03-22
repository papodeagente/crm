import { FadeIn } from "./FadeIn";
import { Sparkles } from "lucide-react";

const MOCKUP_URL = "https://aceleradora.tur.br/teste/wp-content/uploads/2026/03/ChatGPT-Image-22-de-mar.-de-2026-14_07_25.png";

export function SolutionSection() {
  return (
    <section className="py-20 sm:py-28 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-to-r from-violet-600/10 via-purple-600/8 to-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-300 px-4 py-1.5 rounded-full text-sm font-medium mb-5 border border-emerald-500/15">
              <Sparkles className="w-4 h-4" />
              A solução
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
              ENTUR OS
            </h2>
            <p className="text-lg text-white/45 max-w-2xl mx-auto leading-relaxed">
              O sistema operacional que organiza vendas, WhatsApp, pós-venda e inteligência comercial da sua agência em um só lugar.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="relative">
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
      </div>
    </section>
  );
}
