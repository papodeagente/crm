import { FadeIn } from "./FadeIn";
import { Star, Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Ana Souza",
    city: "São Paulo, SP",
    photo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663249817763/EKvcVicuVoUxTnzjSKzgdk/testimonial-woman-1_42afe008.jpg",
    result: "Aumentou conversão em 35%",
    text: "Antes do CRM, eu perdia clientes porque esquecia de fazer follow-up. Agora tenho visão completa de cada negociação e minha conversão subiu de 12% para 35% em 6 meses.",
  },
  {
    name: "Carlos Mendes",
    city: "Belo Horizonte, MG",
    photo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663249817763/EKvcVicuVoUxTnzjSKzgdk/testimonial-man-1_14ea59a3.jpg",
    result: "Recuperou R$180k em vendas",
    text: "Descobri que 40% dos meus orçamentos ficavam sem resposta. Com o pipeline e os alertas automáticos, recuperei vendas que estavam perdidas. Resultado: R$180 mil a mais no ano.",
  },
  {
    name: "Juliana Costa",
    city: "Florianópolis, SC",
    photo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663249817763/EKvcVicuVoUxTnzjSKzgdk/testimonial-woman-2_c8a09ffc.jpg",
    result: "Triplicou o faturamento",
    text: "Minha equipe de 5 agentes agora trabalha com processo definido. Cada um sabe exatamente o que fazer e quando. O faturamento triplicou em 12 meses.",
  },
];

export function SocialProof() {
  return (
    <section className="py-20 sm:py-28 px-5 sm:px-8">
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
              Resultados reais de agências reais
            </h2>
            <p className="text-lg text-white/40">
              Veja o que agências como a sua conquistaram com processo comercial estruturado
            </p>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <FadeIn key={i} delay={0.1 * (i + 1)}>
              <div className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:border-violet-500/20 hover:bg-white/[0.05] transition-all duration-300 h-full flex flex-col">
                <Quote className="w-8 h-8 text-violet-500/20 mb-4" />

                <p className="text-sm text-white/50 leading-relaxed mb-6 flex-1">
                  "{t.text}"
                </p>

                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                  <img
                    src={t.photo}
                    alt={t.name}
                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{t.name}</p>
                    <p className="text-xs text-white/30">{t.city}</p>
                  </div>
                </div>

                <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-medium border border-emerald-500/15 w-fit">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  {t.result}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
