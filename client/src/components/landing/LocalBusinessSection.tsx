import { FadeIn } from "./FadeIn";
import { CalendarCheck, MessageCircle, UserPlus, Heart } from "lucide-react";

const cards = [
  {
    icon: CalendarCheck,
    title: "Agendamento inteligente",
    description:
      "Controle datas de procedimento, retorno e revisão de cada paciente. Saiba exatamente quem atender e quando.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp integrado",
    description:
      "Converse com seus pacientes direto pelo CRM. Histórico completo, mensagens rápidas e follow-up automático.",
  },
  {
    icon: UserPlus,
    title: "Indicações e captação",
    description:
      "Rastreie a origem de cada paciente — indicação, Instagram, Google. Saiba de onde vêm seus melhores resultados.",
  },
  {
    icon: Heart,
    title: "Fidelização e recorrência",
    description:
      "Classifique pacientes, acompanhe frequência de retorno e crie campanhas para manter sua base ativa.",
  },
];

const segments = [
  "Estética",
  "Odontologia",
  "Dermatologia",
  "Fisioterapia",
  "Clínicas Médicas",
];

export function LocalBusinessSection() {
  return (
    <section className="py-24 sm:py-32 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-0 w-[600px] h-[500px] bg-gradient-to-l from-emerald-600/8 via-lime-500/5 to-transparent rounded-full blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-14">
            <p className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">
              Feito para clínicas
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
              CRM feito para clínicas.{" "}
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-[#A7F3D0] via-[#10B981] to-[#84CC16] bg-clip-text text-transparent">
                Agendamento, WhatsApp, indicações e fidelização.
              </span>
            </h2>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 mb-14">
          {cards.map((card, idx) => (
            <FadeIn key={idx} delay={0.1 * (idx + 1)}>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 h-full hover:border-white/[0.12] transition-colors duration-300">
                <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex items-center justify-center mb-5">
                  <card.icon className="w-6 h-6 text-white/70" />
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
          <div className="text-center">
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {segments.map((seg) => (
                <span
                  key={seg}
                  className="px-4 py-1.5 rounded-full text-sm font-medium bg-white/[0.06] text-white/60 border border-white/[0.08]"
                >
                  {seg}
                </span>
              ))}
            </div>
            <p className="text-base text-white/40 max-w-2xl mx-auto leading-relaxed">
              Ideal para qualquer clínica que precisa de agenda,
              relacionamento e vendas organizadas.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
