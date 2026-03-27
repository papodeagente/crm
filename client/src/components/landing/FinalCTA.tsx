import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { FadeIn } from "./FadeIn";


interface FinalCTAProps {
  onCTA: () => void;
}

export function FinalCTA({ onCTA }: FinalCTAProps) {
  return (
    <>
      {/* Final CTA */}
      <section className="py-24 sm:py-32 px-5 sm:px-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-violet-600/15 via-purple-600/10 to-transparent rounded-full blur-[120px]" />
        </div>

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-5 tracking-tight leading-tight">
              Pare de perder vendas silenciosas{" "}
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                todos os meses
              </span>
            </h2>
            <p className="text-lg text-white/45 mb-10 max-w-xl mx-auto leading-relaxed">
              Organize sua agência e transforme atendimentos em vendas previsíveis.
            </p>
            <Button
              size="lg"
              className="h-16 px-12 text-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-2xl shadow-violet-500/25 transition-all duration-300 hover:shadow-violet-500/35 hover:scale-[1.03]"
              onClick={onCTA}
            >
              Quero acessar o ENTUR OS <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-sm text-white/25 mt-5">
              Sem cartão de crédito. Comece a organizar suas vendas agora.
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
            &copy; {new Date().getFullYear()} Escola de Negócios do Turismo. Todos os direitos reservados.
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
