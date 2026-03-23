import { FadeIn } from "./FadeIn";
import { Plane, X, Check } from "lucide-react";

const comparisons = [
  { generic: "Funil genérico de vendas", entur: "Pipeline com etapas do turismo (orçamento, proposta, reserva, embarque)" },
  { generic: "Campos padrão (empresa, cargo)", entur: "Campos de viagem: destino, data, passageiros, tipo de pacote" },
  { generic: "Sem contexto do setor", entur: "Inteligência comercial baseada em 8.000+ agentes treinados" },
  { generic: "WhatsApp via integração terceira", entur: "WhatsApp nativo com histórico vinculado à negociação" },
  { generic: "Relatórios genéricos", entur: "Relatórios por destino, operadora, produto e sazonalidade" },
  { generic: "Suporte técnico padrão", entur: "Suporte + mentoria comercial para agências" },
];

export function DifferentiatorSection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-[600px] h-[500px] bg-gradient-to-tl from-fuchsia-600/8 to-transparent rounded-full blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto px-5 sm:px-8 relative z-10">
        <FadeIn>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 bg-fuchsia-500/10 text-fuchsia-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-fuchsia-500/15">
              <Plane className="w-4 h-4" />
              Feito para turismo
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-white mb-6 leading-tight">
              Por que um CRM genérico{" "}
              <span className="text-fuchsia-400">não funciona</span>{" "}
              para agências de viagens?
            </h2>
            <p className="text-lg text-white/50 leading-relaxed">
              Vender viagens não é vender software. O processo, os dados e o relacionamento são completamente diferentes.
              O ENTUR OS foi construído do zero para o turismo.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-2 border-b border-white/[0.06]">
              <div className="px-6 py-4 text-center">
                <span className="text-sm font-medium text-white/40">CRM Genérico</span>
              </div>
              <div className="px-6 py-4 text-center bg-violet-500/[0.06] border-l border-white/[0.06]">
                <span className="text-sm font-semibold text-violet-400">ENTUR OS</span>
              </div>
            </div>

            {/* Rows */}
            {comparisons.map((row, i) => (
              <div key={i} className={`grid grid-cols-2 ${i < comparisons.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
                <div className="px-6 py-4 flex items-start gap-3">
                  <X className="w-4 h-4 text-red-400/60 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-white/40 leading-relaxed">{row.generic}</span>
                </div>
                <div className="px-6 py-4 flex items-start gap-3 bg-violet-500/[0.03] border-l border-white/[0.06]">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-white/70 leading-relaxed">{row.entur}</span>
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
