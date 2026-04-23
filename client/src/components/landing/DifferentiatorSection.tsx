import { FadeIn } from "./FadeIn";
import { Plane, Heart, Calendar, Users, MapPin, Sparkles } from "lucide-react";

const DIFFERENTIALS = [
  { icon: <MapPin className="w-6 h-6" />, title: "Agendamento", description: "Controle de datas, horarios e locais que CRMs genericos nao oferecem" },
  { icon: <Users className="w-6 h-6" />, title: "Clientes", description: "Gestao de clientes, dependentes e historico de atendimentos" },
  { icon: <Calendar className="w-6 h-6" />, title: "Recorrencia", description: "Acompanhe retornos, revisoes e janelas de reativacao" },
  { icon: <Heart className="w-6 h-6" />, title: "Relacionamento", description: "Fidelizacao, indicacoes e acompanhamento personalizado" },
];

export function DifferentiatorSection() {
  return (
    <section className="py-20 sm:py-28 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-[600px] h-[500px] bg-gradient-to-tl from-fuchsia-600/8 to-transparent rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-fuchsia-500/10 text-fuchsia-300 px-4 py-1.5 rounded-full text-sm font-medium mb-5 border border-fuchsia-500/15">
              <Plane className="w-4 h-4" />
              Feito para negocios locais
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
              Não é um CRM genérico
            </h2>
            <p className="text-lg text-white/45 max-w-2xl mx-auto leading-relaxed">
              Foi criado especificamente para negocios locais.
              Porque atender clientes envolve:
            </p>
          </div>
        </FadeIn>

        <div className="grid sm:grid-cols-2 gap-5">
          {DIFFERENTIALS.map((d, i) => (
            <FadeIn key={i} delay={0.1 * (i + 1)}>
              <div className="group flex items-start gap-5 bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 hover:border-fuchsia-500/20 hover:bg-white/[0.05] transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400 flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                  {d.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{d.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{d.description}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.5}>
          <div className="mt-10 text-center">
            <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-6 py-3">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-white/50">
                Criado especificamente para <span className="text-white/70 font-medium">negócios locais</span> que querem crescer com processo
              </span>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
