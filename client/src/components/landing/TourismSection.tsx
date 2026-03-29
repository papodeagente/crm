import { FadeIn } from "./FadeIn";
import { MapPin, Package, GitBranch, BarChart3 } from "lucide-react";

const cards = [
  {
    icon: MapPin,
    title: "Destinos, datas, passageiros",
    description:
      "Cada negociação tem campos de embarque, retorno, destino e passageiros. Não é um formulário genérico.",
  },
  {
    icon: Package,
    title: "Catálogo de produtos turísticos",
    description:
      "Cadastre pacotes, passeios e serviços com preço base e custo. Vincule direto à negociação.",
  },
  {
    icon: GitBranch,
    title: "Múltiplos funis por contexto",
    description:
      "Vendas para converter. Pós-venda para entregar. Suporte para resolver. Cada um com automações próprias.",
  },
  {
    icon: BarChart3,
    title: "Relatórios que fazem sentido",
    description:
      "Conversão por etapa, motivos de perda, fontes de leads, ticket médio por produto, rastreamento UTM.",
  },
];

export function TourismSection() {
  return (
    <section className="py-24 sm:py-32 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-0 w-[600px] h-[500px] bg-gradient-to-l from-violet-600/8 via-purple-600/5 to-transparent rounded-full blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-14">
            <p className="text-sm font-medium text-violet-400 uppercase tracking-wider mb-4">
              Feito para turismo
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
              Não é um CRM adaptado.{" "}
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                Foi construído para vender viagens.
              </span>
            </h2>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 mb-14">
          {cards.map((card, idx) => (
            <FadeIn key={idx} delay={0.1 * (idx + 1)}>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 h-full hover:border-white/[0.12] transition-colors duration-300">
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mb-5">
                  <card.icon className="w-6 h-6 text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">
                  {card.title}
                </h3>
                <p className="text-sm text-white/45 leading-relaxed">
                  {card.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.6}>
          <p className="text-center text-base text-white/40 max-w-2xl mx-auto leading-relaxed">
            Criado pela Escola de Negócios do Turismo
            com base em 15.000 agentes treinados.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
