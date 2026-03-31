import { Button } from "@/components/ui/button";
import { ArrowRight, Star } from "lucide-react";
import { motion } from "motion/react";

const MOCKUP_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663249817763/EKvcVicuVoUxTnzjSKzgdk/hero-pipeline_cbec88a2.png";
const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663249817763/EKvcVicuVoUxTnzjSKzgdk/logo-light_c3efa809.webp";

interface HeroSectionProps {
  onRegister: () => void;
}

export function HeroSection({ onRegister }: HeroSectionProps) {
  const scrollToComoFunciona = () => {
    document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[900px] h-[700px] bg-gradient-to-br from-violet-600/12 via-purple-600/8 to-transparent rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[500px] bg-gradient-to-tl from-indigo-600/8 via-blue-600/5 to-transparent rounded-full blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a12]/70 backdrop-blur-2xl border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img src={LOGO_URL} alt="enturOS CRM" className="h-5 sm:h-7 object-contain" />
          </div>
          <div className="flex items-center">
            <Button
              variant="ghost"
              className="text-sm text-white/60 hover:text-white hover:bg-white/5"
              onClick={() => window.location.href = "/login"}
            >
              Entrar
            </Button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pt-28 pb-16 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left - Copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="inline-flex items-center gap-2 bg-white/[0.06] text-white/80 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-white/10">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Criado pela Escola de Negócios do Turismo
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] mb-6 tracking-tight text-white">
              Sua agência perde vendas{" "}
              <span className="bg-gradient-to-r from-[#FFC7AC] via-[#FF614C] to-[#FF2B61] bg-clip-text text-transparent">
                toda semana.
              </span>{" "}
              <br className="hidden sm:block" />
              O problema não é preço.
            </h1>

            <p className="text-lg text-white/45 mb-8 leading-relaxed max-w-xl">
              É não ter um processo comercial. Orçamentos somem no WhatsApp,
              follow-ups não acontecem, e vendas morrem em silêncio.{" "}
              <span className="text-white/70 font-medium">O ENTUR OS resolve isso.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Button
                size="lg"
                className="h-14 px-8 text-base bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-0 shadow-xl shadow-violet-500/20 transition-all duration-300 hover:shadow-violet-500/30 hover:scale-[1.02] rounded-xl"
                onClick={onRegister}
              >
                Testar grátis por 7 dias <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-6 text-base border-white/10 text-white/70 hover:bg-white/5 hover:text-white bg-transparent rounded-xl"
                onClick={scrollToComoFunciona}
              >
                Ver como funciona
              </Button>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 border-2 border-[#0a0a12] flex items-center justify-center text-[10px] font-bold text-white"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-white/40">
                  Mais de <span className="text-white/60 font-medium">15.000 agentes</span> treinados pela Escola de Negócios do Turismo
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right - Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="hidden lg:block"
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-violet-600/20 via-purple-600/10 to-indigo-600/20 rounded-2xl blur-2xl" />
              <div className="relative bg-[#12121a] rounded-xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/50">
                <div className="flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  <span className="ml-3 text-[10px] text-white/25 font-mono">entur.os</span>
                </div>
                <img
                  src={MOCKUP_URL}
                  alt="ENTUR OS - Pipeline de Vendas"
                  className="w-full"
                  loading="eager"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
