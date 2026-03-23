import { FadeIn } from "./FadeIn";
import { Ghost, MessageCircleX, FileX, TrendingDown } from "lucide-react";

const ENEMIES = [
  { icon: <MessageCircleX className="w-6 h-6" />, text: "Clientes ficam perdidos em conversas" },
  { icon: <FileX className="w-6 h-6" />, text: "Orçamentos esquecidos" },
  { icon: <TrendingDown className="w-6 h-6" />, text: "Vendas desaparecem sem explicação" },
];

export function EnemySection() {
  return (
    <section className="py-20 sm:py-28 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-950/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/15 mb-5">
              <Ghost className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
              O maior inimigo das vendas na agência{" "}
              <span className="text-red-400">é invisível</span>
            </h2>
            <div className="max-w-2xl mx-auto space-y-2">
              <p className="text-lg text-white/40">
                Não é concorrência. Não é preço.
              </p>
              <p className="text-xl text-white/70 font-medium">
                É desorganização comercial.
              </p>
            </div>
          </div>
        </FadeIn>

        <div className="grid sm:grid-cols-3 gap-4">
          {ENEMIES.map((enemy, i) => (
            <FadeIn key={i} delay={0.1 * (i + 1)}>
              <div className="group bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 text-center hover:border-red-500/20 hover:bg-red-500/[0.03] transition-all duration-300">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform duration-300">
                  {enemy.icon}
                </div>
                <p className="text-sm sm:text-base text-white/60 group-hover:text-white/80 transition-colors">
                  {enemy.text}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
