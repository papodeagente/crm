import { Button } from "@/components/ui/button";
import { FadeIn } from "./FadeIn";
import {
  LayoutDashboard,
  MessageCircle,
  Zap,
  Users,
  Plane,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const differentials = [
  {
    icon: LayoutDashboard,
    title: "Funil de vendas específico",
    description:
      "O funil de vendas do Entur OS e pensado especificamente na rotina de negocios locais, por isso gera mais resultado.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp dentro do CRM",
    description:
      "Inbox completo: todas as conversas organizadas por cliente, com histórico, notas internas, transcrição de áudio por IA e atribuição de atendente.",
  },
  {
    icon: Zap,
    title: "Central de automações",
    description:
      "Quando o cliente avança no funil, o sistema cria tarefas, envia mensagens e muda o responsável. Configure uma vez.",
  },
  {
    icon: Users,
    title: "Matriz RFV",
    description:
      "Classifica clientes por recencia, frequencia e valor. Saiba quem pode indicar, quem esta esfriando e quem abordar agora.",
  },
  {
    icon: Plane,
    title: "Pós-venda automatizado",
    description:
      "A venda nao acaba no fechamento. Funil de pos-venda acompanha cada servico: do agendamento ao retorno do cliente.",
  },
  {
    icon: Sparkles,
    title: "Inteligência artificial",
    description:
      "Sugestão de resposta no WhatsApp, transcrição de áudios, análise de atendimento e resumo de conversa.",
  },
];

interface DifferentialsSectionProps {
  onRegister: () => void;
}

export function DifferentialsSection({ onRegister }: DifferentialsSectionProps) {
  return (
    <section
      id="como-funciona"
      className="py-24 sm:py-32 px-5 sm:px-8 relative overflow-hidden bg-[#08080f]"
    >
      <div className="max-w-6xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-14">
            <p className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">
              O que muda na sua operação
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
              Seis coisas que o ENTUR OS faz{" "}
              <br className="hidden sm:block" />
              e nenhum CRM genérico oferece
            </h2>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-14">
          {differentials.map((item, idx) => (
            <FadeIn key={idx} delay={0.08 * (idx + 1)}>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 h-full hover:border-white/[0.15] transition-colors duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex items-center justify-center mb-5 group-hover:bg-white/[0.10] transition-colors duration-300">
                  <item.icon className="w-6 h-6 text-white/70" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">
                  {item.title}
                </h3>
                <p className="text-sm text-white/45 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.6}>
          <div className="text-center">
            <Button
              size="lg"
              className="h-14 px-8 text-base bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-0 shadow-xl shadow-violet-500/20 transition-all duration-300 hover:shadow-violet-500/30 hover:scale-[1.02] rounded-xl"
              onClick={onRegister}
            >
              Testar grátis por 7 dias <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
