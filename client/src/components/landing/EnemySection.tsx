import { FadeIn } from "./FadeIn";
import { MessageSquareOff, Brain, TrendingDown, Clock, AlertTriangle, Users } from "lucide-react";

const painPoints = [
  {
    icon: MessageSquareOff,
    title: "Follow-up esquecido",
    desc: "O cliente pediu orçamento, disse que ia pensar e ninguém voltou a falar com ele. A venda morreu no silêncio.",
  },
  {
    icon: Brain,
    title: "Tudo na memória",
    desc: "Quem atendeu quem? Qual era o destino? Quando viaja? Sem sistema, a informação vive na cabeça de cada vendedor.",
  },
  {
    icon: Clock,
    title: "WhatsApp solto",
    desc: "Conversas espalhadas, sem histórico centralizado. Cada vendedor usa o próprio celular e a agência perde o controle.",
  },
  {
    icon: TrendingDown,
    title: "Sem visão do pipeline",
    desc: "Quantas negociações estão abertas? Qual o valor total em jogo? Sem pipeline, você não sabe o que está ganhando ou perdendo.",
  },
  {
    icon: AlertTriangle,
    title: "Sem previsibilidade",
    desc: "Não sabe quanto vai faturar no mês que vem. Cada semana é uma surpresa. Impossível planejar crescimento assim.",
  },
  {
    icon: Users,
    title: "Equipe sem processo",
    desc: "Cada vendedor trabalha de um jeito. Não existe padrão. Quando alguém sai, leva junto os clientes e o conhecimento.",
  },
];

export function EnemySection() {
  return (
    <section id="problema" className="relative py-24 sm:py-32">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-red-950/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 relative z-10">
        <FadeIn>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-sm font-medium text-red-400/80 bg-red-500/10 border border-red-500/15 px-4 py-1.5 rounded-full mb-6">
              O problema que ninguém fala
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-white mb-6 leading-tight">
              Sua agência está perdendo vendas{" "}
              <span className="text-red-400">todos os dias.</span>{" "}
              E o motivo não é preço.
            </h2>
            <p className="text-lg text-white/50 leading-relaxed">
              O cliente chegou, pediu orçamento, demonstrou interesse. Mas entre o primeiro contato e o fechamento,
              a negociação se perdeu. Sem processo, sem acompanhamento, sem controle.
            </p>
          </div>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {painPoints.map((point, i) => (
            <FadeIn key={point.title} delay={i * 0.08}>
              <div className="group relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:bg-red-500/[0.03] hover:border-red-500/10 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
                  <point.icon className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{point.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{point.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.5}>
          <div className="mt-16 text-center">
            <div className="inline-flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-8 py-5">
              <div className="text-4xl font-bold text-red-400">67%</div>
              <div className="text-left">
                <p className="text-sm font-medium text-white/70">dos orçamentos enviados</p>
                <p className="text-sm text-white/40">nunca recebem follow-up adequado</p>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
