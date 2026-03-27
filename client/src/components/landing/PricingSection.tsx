import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "./FadeIn";
import { Check, ArrowRight, X, MessageSquare, Crown } from "lucide-react";
import { PLANS, PLAN_ORDER, FEATURE_DESCRIPTIONS, type PlanId, type PlanFeatures } from "../../../../shared/plans";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663249817763/EKvcVicuVoUxTnzjSKzgdk/OSICON_03b1c322.webp";
const SCALE_WHATSAPP_URL = "https://wa.me/551151982627?text=Quero%20conhecer%20o%20Plano%20Elite%20do%20Entur%20OS.%20Pode%20me%20ajudar%3F";

interface PricingSectionProps {
  onSelectPlan: (plan?: string) => void;
}

// Feature rows for comparison table
const COMPARISON_ROWS: { label: string; key?: keyof PlanFeatures; type: "feature" | "limit"; getValue?: (planId: PlanId) => string }[] = [
  { label: "CRM completo (contatos, negociações, funil, tarefas)", key: "crmCore", type: "feature" },
  { label: "Comunidade Acelera Turismo", key: "communityAccess", type: "feature" },
  { label: "Usuários", type: "limit", getValue: (id) => PLANS[id].maxUsers === -1 ? "Ilimitado" : `${PLANS[id].maxUsers}` },
  { label: "WhatsApp integrado ao CRM", key: "whatsappEmbedded", type: "feature" },
  { label: "Contas de WhatsApp", type: "limit", getValue: (id) => PLANS[id].maxWhatsAppAccounts === 0 ? "—" : `${PLANS[id].maxWhatsAppAccounts}` },
  { label: "Atendentes por conta", type: "limit", getValue: (id) => PLANS[id].maxAttendantsPerAccount === 0 ? "—" : `${PLANS[id].maxAttendantsPerAccount}` },
  { label: "Disparo segmentado de mensagens", key: "segmentedBroadcast", type: "feature" },
  { label: "Matriz RFV (Classificação Estratégica)", key: "rfvEnabled", type: "feature" },
  { label: "Automação de vendas", key: "salesAutomation", type: "feature" },
  { label: "Suporte prioritário", key: "prioritySupport", type: "feature" },
];

export function PricingSection({ onSelectPlan }: PricingSectionProps) {
  return (
    <>
      <section id="planos" className="py-24 sm:py-32 px-5 sm:px-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-violet-600/15 via-purple-600/10 to-transparent rounded-full blur-[120px]" />
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          <FadeIn>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight leading-tight">
                Escolha o plano ideal{" "}
                <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                  para sua agência
                </span>
              </h2>
              <p className="text-lg text-white/40 max-w-xl mx-auto">
                Todos os planos incluem CRM completo e acesso à Comunidade Acelera Turismo. Sem fidelidade.
              </p>
            </div>
          </FadeIn>

          {/* ─── Plan Cards ─── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {/* ESSENCIAL */}
            <FadeIn delay={0.1}>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 flex flex-col h-full backdrop-blur-sm">
                <div className="mb-6">
                  <p className="text-sm font-medium text-white/40 uppercase tracking-wider mb-2">Essencial</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">R$ 97</span>
                    <span className="text-white/30 text-sm">/mês</span>
                  </div>
                  <p className="text-sm text-white/50 mt-3">{PLANS.start.commercialCopy}</p>
                </div>

                <div className="border-t border-white/[0.06] pt-6 mb-6 flex-1">
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-4">Inclui:</p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2.5 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span>CRM completo (contatos, negociações, funil, tarefas)</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span>Histórico comercial</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span>Dashboard com indicadores</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span>Comunidade Acelera Turismo</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span>1 usuário</span>
                    </li>
                  </ul>
                  <div className="mt-4 pt-4 border-t border-white/[0.04]">
                    <p className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">Não inclui:</p>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2.5 text-sm text-white/25">
                        <X className="w-4 h-4 text-white/15 mt-0.5 shrink-0" />
                        <span>WhatsApp no CRM</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-white/25">
                        <X className="w-4 h-4 text-white/15 mt-0.5 shrink-0" />
                        <span>Disparo segmentado</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-white/25">
                        <X className="w-4 h-4 text-white/15 mt-0.5 shrink-0" />
                        <span>Matriz RFV</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-white/25">
                        <X className="w-4 h-4 text-white/15 mt-0.5 shrink-0" />
                        <span>Automação de vendas</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <Button
                  className="w-full h-12 bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.10] hover:border-white/[0.15] transition-all duration-300"
                  onClick={() => onSelectPlan("start")}
                >
                  Começar agora <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </FadeIn>

            {/* PRO */}
            <FadeIn delay={0.2}>
              <div className="bg-gradient-to-b from-violet-500/[0.08] to-purple-500/[0.03] border-2 border-violet-500/25 rounded-2xl p-6 sm:p-8 flex flex-col h-full relative backdrop-blur-sm shadow-xl shadow-violet-900/10">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg shadow-violet-500/25 flex items-center gap-1.5">
                    <Crown className="w-3 h-3" /> Mais popular
                  </span>
                </div>

                <div className="mb-6">
                  <p className="text-sm font-medium text-violet-400 uppercase tracking-wider mb-2">Pro</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">R$ 297</span>
                    <span className="text-white/30 text-sm">/mês</span>
                  </div>
                  <p className="text-sm text-white/50 mt-3">{PLANS.growth.commercialCopy}</p>
                </div>

                <div className="border-t border-violet-500/10 pt-6 mb-6 flex-1">
                  <p className="text-xs font-medium text-violet-400/70 uppercase tracking-wider mb-4">Tudo do Essencial, mais:</p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2.5 text-sm text-white/80">
                      <Check className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                      <span className="font-medium">WhatsApp integrado ao CRM</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span>1 conta WhatsApp com até 4 atendentes</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/80">
                      <Check className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                      <span className="font-medium">Disparo segmentado de mensagens</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/80">
                      <Check className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                      <span className="font-medium">Matriz RFV (Classificação Estratégica)</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/80">
                      <Check className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                      <span className="font-medium">Automação de vendas</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span>Até 4 usuários</span>
                    </li>
                  </ul>
                  <div className="mt-4 pt-4 border-t border-violet-500/[0.08]">
                    <p className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">Não inclui:</p>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2.5 text-sm text-white/25">
                        <X className="w-4 h-4 text-white/15 mt-0.5 shrink-0" />
                        <span>Suporte prioritário</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <Button
                  className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-violet-500/35"
                  onClick={() => onSelectPlan("growth")}
                >
                  Começar agora <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </FadeIn>

            {/* ELITE */}
            <FadeIn delay={0.3}>
              <div className="bg-gradient-to-b from-amber-500/[0.04] to-transparent border border-amber-500/10 rounded-2xl p-6 sm:p-8 flex flex-col h-full backdrop-blur-sm">
                <div className="mb-6">
                  <p className="text-sm font-medium text-amber-400/70 uppercase tracking-wider mb-2">Elite</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">Sob consulta</span>
                  </div>
                  <p className="text-sm text-white/50 mt-3">{PLANS.scale.commercialCopy}</p>
                </div>

                <div className="border-t border-amber-500/[0.08] pt-6 mb-6 flex-1">
                  <p className="text-xs font-medium text-amber-400/50 uppercase tracking-wider mb-4">Tudo do Pro, mais:</p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2.5 text-sm text-white/80">
                      <Check className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <span className="font-medium">Até 15 usuários</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/80">
                      <Check className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <span className="font-medium">Suporte prioritário</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span>Onboarding personalizado</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span>Consultoria comercial dedicada</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span>SLA de atendimento</span>
                    </li>
                  </ul>
                </div>

                <Button
                  className="w-full h-12 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/20 hover:border-amber-500/30 transition-all duration-300"
                  onClick={() => window.open(SCALE_WHATSAPP_URL, "_blank")}
                >
                  <MessageSquare className="w-4 h-4 mr-2" /> Falar com consultor
                </Button>
              </div>
            </FadeIn>
          </div>

          {/* ─── Comparison Table ─── */}
          <FadeIn delay={0.4}>
            <div className="mt-20">
              <div className="text-center mb-10">
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                  Compare os planos
                </h3>
                <p className="text-sm text-white/40 max-w-lg mx-auto">
                  Veja exatamente o que cada plano oferece para escolher o ideal para sua agência.
                </p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left py-4 px-5 text-white/40 font-medium w-[40%]">Recurso</th>
                        <th className="text-center py-4 px-4 w-[20%]">
                          <span className="text-white/60 font-semibold">Essencial</span>
                          <p className="text-xs text-white/25 mt-0.5">R$ 97/mês</p>
                        </th>
                        <th className="text-center py-4 px-4 w-[20%] bg-violet-500/[0.06]">
                          <span className="text-violet-400 font-bold">Pro</span>
                          <p className="text-xs text-violet-400/50 mt-0.5">R$ 297/mês</p>
                        </th>
                        <th className="text-center py-4 px-4 w-[20%]">
                          <span className="text-amber-400/80 font-semibold">Elite</span>
                          <p className="text-xs text-amber-400/30 mt-0.5">Sob consulta</p>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON_ROWS.map((row, i) => (
                        <tr key={i} className="border-b border-white/[0.04] last:border-0">
                          <td className="py-3.5 px-5 text-white/50">{row.label}</td>
                          {PLAN_ORDER.map((planId) => {
                            const isProCol = planId === "growth";
                            const cellBg = isProCol ? "bg-violet-500/[0.04]" : "";

                            if (row.type === "limit" && row.getValue) {
                              const val = row.getValue(planId);
                              return (
                                <td key={planId} className={`text-center py-3.5 px-4 ${cellBg}`}>
                                  <span className={val === "—" ? "text-white/20" : "text-white/70 font-medium"}>
                                    {val}
                                  </span>
                                </td>
                              );
                            }

                            const hasFeature = row.key ? PLANS[planId].features[row.key] : false;
                            return (
                              <td key={planId} className={`text-center py-3.5 px-4 ${cellBg}`}>
                                {hasFeature ? (
                                  <div className="flex items-center justify-center">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center">
                                    <div className="w-6 h-6 rounded-full bg-white/[0.03] flex items-center justify-center">
                                      <X className="w-3.5 h-3.5 text-white/15" />
                                    </div>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* CTA row */}
                <div className="border-t border-white/[0.06] grid grid-cols-[40%_20%_20%_20%]">
                  <div className="py-5 px-5" />
                  <div className="py-5 px-4 flex items-center justify-center">
                    <Button
                      size="sm"
                      className="bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.10] text-xs"
                      onClick={() => onSelectPlan("start")}
                    >
                      Assinar
                    </Button>
                  </div>
                  <div className="py-5 px-4 flex items-center justify-center bg-violet-500/[0.06]">
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs shadow-lg shadow-violet-500/20"
                      onClick={() => onSelectPlan("growth")}
                    >
                      Assinar Pro
                    </Button>
                  </div>
                  <div className="py-5 px-4 flex items-center justify-center">
                    <Button
                      size="sm"
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/15 text-xs"
                      onClick={() => window.open(SCALE_WHATSAPP_URL, "_blank")}
                    >
                      Consultar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-5 sm:px-8 border-t border-white/[0.05] bg-[#06060a]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={LOGO_URL} alt="ENTUR OS" className="h-7 w-7 rounded-lg" />
            <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663249817763/EKvcVicuVoUxTnzjSKzgdk/logo-dark-theme_021f3cb2.webp" alt="ENTUR OS" className="h-5 object-contain" />
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
