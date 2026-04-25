import { FadeIn } from "./FadeIn";
import { StaticLogo } from "@/components/ThemedLogo";

const MOCKUP_URL = "https://aceleradora.tur.br/teste/wp-content/uploads/2026/03/ChatGPT-Image-22-de-mar.-de-2026-14_07_25.png";

export function SolutionSection() {
  return (
    <section className="py-24 sm:py-32 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-to-r from-emerald-600/10 via-emerald-500/8 to-lime-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="text-sm font-medium text-white/60 uppercase tracking-wider mb-5">
              A solução
            </p>
            <div className="flex justify-center mb-5">
              <StaticLogo className="h-12 sm:h-14 lg:h-16" variant="dark" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
              CRM de verdade para clínicas.
            </h2>
            <p className="text-lg text-white/45 max-w-2xl mx-auto leading-relaxed">
              Funil de vendas, WhatsApp integrado, automação comercial
              e inteligência de dados — tudo num sistema feito exclusivamente
              para clínicas que querem faturar mais.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-r from-emerald-600/15 via-emerald-500/10 to-lime-500/15 rounded-3xl blur-3xl" />
            <div className="relative bg-[#0B1F18] rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/40">
              <div className="flex items-center gap-1.5 px-5 py-3 bg-white/[0.03] border-b border-white/[0.06]">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="ml-4 text-xs text-white/25 font-mono">clinilucro.app/pipeline</span>
              </div>
              <img
                src={MOCKUP_URL}
                alt="Clinilucro — Pipeline de Vendas"
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
