import { FadeIn } from "./FadeIn";
import { Play } from "lucide-react";

const MOCKUP_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663249817763/EKvcVicuVoUxTnzjSKzgdk/crm-dashboard-mockup-3YZmw47tu8PYFxqCzQyyib.webp";

export function DemoSection() {
  return (
    <section id="demo" className="py-20 sm:py-28 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-to-r from-violet-600/8 via-purple-600/6 to-indigo-600/8 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
              Veja o ENTUR OS funcionando na prática
            </h2>
            <p className="text-lg text-white/40">
              Assista uma demonstração rápida e veja como organizar suas vendas
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="relative group cursor-pointer">
            <div className="absolute -inset-4 bg-gradient-to-r from-violet-600/15 via-purple-600/10 to-indigo-600/15 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative bg-[#12121a] rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/40">
              <div className="flex items-center gap-1.5 px-5 py-3 bg-white/[0.03] border-b border-white/[0.06]">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="ml-4 text-xs text-white/25 font-mono">Demonstração do ENTUR OS</span>
              </div>
              <div className="relative">
                <img
                  src={MOCKUP_URL}
                  alt="Demonstração do CRM"
                  className="w-full opacity-80 group-hover:opacity-60 transition-opacity duration-300"
                  loading="lazy"
                />
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-violet-600/90 flex items-center justify-center shadow-xl shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Play className="w-8 h-8 text-white fill-white ml-1" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.3}>
          <p className="text-center text-sm text-white/30 mt-6">
            Vídeo demonstrativo em breve. Enquanto isso, solicite seu relatório gratuito acima.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
