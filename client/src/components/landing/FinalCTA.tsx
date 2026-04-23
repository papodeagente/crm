import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { FadeIn } from "./FadeIn";


interface FinalCTAProps {
  onRegister: () => void;
}

export function FinalCTA({ onRegister }: FinalCTAProps) {
  return (
    <>
      {/* Final CTA */}
      <section className="py-24 sm:py-32 px-5 sm:px-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-r from-violet-600/15 via-fuchsia-600/10 to-purple-600/15 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight leading-tight">
              Seu negócio vai continuar{" "}
              <span className="bg-gradient-to-r from-[#FFC7AC] via-[#FF614C] to-[#FF2B61] bg-clip-text text-transparent">
                perdendo vendas
              </span>{" "}
              no WhatsApp?
            </h2>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className="text-lg text-white/45 mb-10 leading-relaxed max-w-2xl mx-auto">
              Configure o ENTUR OS em 15 minutos. Veja todas as suas
              negociações organizadas. Comece a recuperar vendas hoje.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <Button
              size="lg"
              className="h-14 px-10 text-base bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-0 shadow-xl shadow-violet-500/20 transition-all duration-300 hover:shadow-violet-500/30 hover:scale-[1.02] rounded-xl"
              onClick={onRegister}
            >
              Testar grátis por 7 dias <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </FadeIn>
          <FadeIn delay={0.4}>
            <p className="text-sm text-white/30 mt-6">
              7 dias grátis. Sem cartão. Sem compromisso.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-5 sm:px-8 border-t border-white/[0.05] bg-[#06060a]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663249817763/EKvcVicuVoUxTnzjSKzgdk/logo-light_c3efa809.webp" alt="enturOS CRM" className="h-6 object-contain" />
          </div>
          <p className="text-xs text-white/20">
            &copy; {new Date().getFullYear()} ENTUR OS. Todos os direitos reservados.
          </p>
          <div className="flex gap-5 text-xs text-white/20">
            <a href="#" className="hover:text-white/40 transition-colors">Termos</a>
            <a href="#" className="hover:text-white/40 transition-colors">Privacidade</a>
            <a href="#" className="hover:text-white/40 transition-colors">Suporte</a>
          </div>
        </div>
      </footer>
    </>
  );
}
