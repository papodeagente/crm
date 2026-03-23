import { FadeIn } from "./FadeIn";
import { CheckCircle2 } from "lucide-react";

const benefits = [
  {
    title: "Menos improviso, mais processo",
    desc: "Cada etapa da venda é clara. Sua equipe sabe exatamente o que fazer em cada momento.",
    highlight: "Processo",
  },
  {
    title: "Mais conversão, menos esquecimento",
    desc: "Follow-up automático garante que nenhum cliente fique sem resposta. Você fecha mais vendas com os mesmos leads.",
    highlight: "Conversão",
  },
  {
    title: "Controle total do pipeline",
    desc: "Veja em tempo real quantas negociações estão abertas, em qual etapa e qual o valor total em jogo.",
    highlight: "Controle",
  },
  {
    title: "Equipe alinhada e produtiva",
    desc: "Todos trabalham no mesmo sistema, com o mesmo processo. Gestores acompanham a performance sem precisar perguntar.",
    highlight: "Produtividade",
  },
  {
    title: "Clientes acompanhados até o fim",
    desc: "Do primeiro contato ao pós-venda. Histórico completo, tarefas automáticas e nenhum cliente esquecido.",
    highlight: "Acompanhamento",
  },
  {
    title: "Decisões baseadas em dados",
    desc: "Relatórios mostram onde estão os gargalos, quais vendedores performam melhor e quais destinos vendem mais.",
    highlight: "Clareza",
  },
];

export function HowItWorks() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <FadeIn>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-sm font-medium text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/15 px-4 py-1.5 rounded-full mb-6">
              O que muda na sua agência
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-white mb-6 leading-tight">
              Resultados que você percebe{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                desde a primeira semana.
              </span>
            </h2>
            <p className="text-lg text-white/50 leading-relaxed">
              Não é só tecnologia. É uma mudança real na forma como sua agência vende e acompanha cada cliente.
            </p>
          </div>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {benefits.map((benefit, i) => (
            <FadeIn key={benefit.title} delay={i * 0.08}>
              <div className="group bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:bg-emerald-500/[0.03] hover:border-emerald-500/10 transition-all duration-300 h-full">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-emerald-400/70 uppercase tracking-wider">{benefit.highlight}</span>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{benefit.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{benefit.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
