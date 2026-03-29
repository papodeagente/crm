import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "./FadeIn";
import { Check, ArrowRight, X, MessageSquare, Crown, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

const SCALE_WHATSAPP_URL = "https://wa.me/551151982627?text=Quero%20conhecer%20o%20Plano%20Elite%20do%20Entur%20OS.%20Pode%20me%20ajudar%3F";

interface PricingSectionProps {
  onSelectPlan: (plan?: string) => void;
}

// ─── Types from dynamic plan service ─────────────────────────────
interface DynamicPlan {
  id: string;
  dbId: number;
  name: string;
  description: string;
  commercialCopy: string;
  priceInCents: number;
  billingCycle: string;
  isActive: boolean;
  isPublic: boolean;
  hotmartOfferCode: string | null;
  displayOrder: number;
  maxUsers: number;
  maxWhatsAppAccounts: number;
  maxAttendantsPerAccount: number;
  features: Record<string, boolean>;
}

// ─── Plan card styling per index (1st=subtle, 2nd=highlighted, 3rd=gold) ───
const cardStyles = [
  {
    wrapper: "bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 flex flex-col h-full backdrop-blur-sm",
    nameClass: "text-sm font-medium text-white/40 uppercase tracking-wider mb-2",
    priceClass: "text-4xl font-bold text-white",
    copyClass: "text-sm text-white/50 mt-3",
    divider: "border-t border-white/[0.06] pt-6 mb-6 flex-1",
    sectionLabel: "text-xs font-medium text-white/50 uppercase tracking-wider mb-4",
    checkColor: "text-emerald-400",
    itemColor: "text-sm text-white/60",
    btnClass: "w-full h-12 bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.10] hover:border-white/[0.15] transition-all duration-300",
    isHighlighted: false,
    notIncludedDivider: "mt-4 pt-4 border-t border-white/[0.04]",
  },
  {
    wrapper: "bg-gradient-to-b from-violet-500/[0.08] to-purple-500/[0.03] border-2 border-violet-500/25 rounded-2xl p-6 sm:p-8 flex flex-col h-full relative backdrop-blur-sm shadow-xl shadow-violet-900/10",
    nameClass: "text-sm font-medium text-violet-400 uppercase tracking-wider mb-2",
    priceClass: "text-4xl font-bold text-white",
    copyClass: "text-sm text-white/50 mt-3",
    divider: "border-t border-violet-500/10 pt-6 mb-6 flex-1",
    sectionLabel: "text-xs font-medium text-violet-400/70 uppercase tracking-wider mb-4",
    checkColor: "text-violet-400",
    itemColor: "text-sm text-white/80",
    btnClass: "w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-violet-500/35",
    isHighlighted: true,
    notIncludedDivider: "mt-4 pt-4 border-t border-violet-500/[0.08]",
  },
  {
    wrapper: "bg-gradient-to-b from-amber-500/[0.04] to-transparent border border-amber-500/10 rounded-2xl p-6 sm:p-8 flex flex-col h-full backdrop-blur-sm",
    nameClass: "text-sm font-medium text-amber-400/70 uppercase tracking-wider mb-2",
    priceClass: "text-4xl font-bold text-white",
    copyClass: "text-sm text-white/50 mt-3",
    divider: "border-t border-amber-500/[0.08] pt-6 mb-6 flex-1",
    sectionLabel: "text-xs font-medium text-amber-400/60 uppercase tracking-wider mb-4",
    checkColor: "text-amber-400",
    itemColor: "text-sm text-white/80",
    btnClass: "w-full h-12 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/20 hover:border-amber-500/30 transition-all duration-300",
    isHighlighted: false,
    notIncludedDivider: "mt-4 pt-4 border-t border-amber-500/[0.06]",
  },
];

function getIncludedFeatures(plan: DynamicPlan): string[] {
  const items: string[] = [];
  if (plan.features.crmCore) items.push("CRM completo (contatos, negociações, funil, tarefas)");
  if (plan.features.communityAccess) items.push("Comunidade Acelera Turismo");
  items.push(plan.maxUsers === 1 ? "1 usuário" : plan.maxUsers === -1 ? "Usuários ilimitados" : `Até ${plan.maxUsers} usuários`);
  if (plan.features.whatsappEmbedded) {
    items.push("WhatsApp integrado ao CRM");
    if (plan.maxWhatsAppAccounts > 0) items.push(`${plan.maxWhatsAppAccounts} conta${plan.maxWhatsAppAccounts > 1 ? "s" : ""} WhatsApp com até ${plan.maxAttendantsPerAccount} atendentes`);
  }
  if (plan.features.segmentedBroadcast) items.push("Disparo segmentado de mensagens");
  if (plan.features.rfvEnabled) items.push("Matriz RFV (Classificação Estratégica)");
  if (plan.features.salesAutomation) items.push("Automação de vendas");
  if (plan.features.prioritySupport) items.push("Suporte prioritário");
  return items;
}

function getNotIncludedFeatures(plan: DynamicPlan, allPlans: DynamicPlan[]): string[] {
  // Collect all features from the most complete plan
  const topPlan = allPlans[allPlans.length - 1];
  if (!topPlan) return [];
  const missing: string[] = [];
  if (!plan.features.whatsappEmbedded && topPlan.features.whatsappEmbedded) missing.push("WhatsApp no CRM");
  if (!plan.features.segmentedBroadcast && topPlan.features.segmentedBroadcast) missing.push("Disparo segmentado");
  if (!plan.features.rfvEnabled && topPlan.features.rfvEnabled) missing.push("Matriz RFV");
  if (!plan.features.salesAutomation && topPlan.features.salesAutomation) missing.push("Automação de vendas");
  if (!plan.features.prioritySupport && topPlan.features.prioritySupport) missing.push("Suporte prioritário");
  return missing;
}

// Feature comparison rows built dynamically
const COMPARISON_FEATURE_KEYS = [
  { key: "crmCore", label: "CRM completo (contatos, negociações, funil, tarefas)" },
  { key: "communityAccess", label: "Comunidade Acelera Turismo" },
  { key: "whatsappEmbedded", label: "WhatsApp integrado ao CRM" },
  { key: "segmentedBroadcast", label: "Disparo segmentado de mensagens" },
  { key: "rfvEnabled", label: "Matriz RFV (Classificação Estratégica)" },
  { key: "salesAutomation", label: "Automação de vendas" },
  { key: "prioritySupport", label: "Suporte prioritário" },
];

export function PricingSection({ onSelectPlan }: PricingSectionProps) {
  const plansQuery = trpc.plan.active.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const plans = useMemo(() => plansQuery.data?.plans ?? [], [plansQuery.data]);

  if (plansQuery.isLoading) {
    return (
      <section id="planos" className="py-24 sm:py-32 px-5 sm:px-8 relative overflow-hidden">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      </section>
    );
  }

  if (!plans.length) return null;

  const isLastPlanContactOnly = plans.length > 0 && plans[plans.length - 1].priceInCents === 0;

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
          <div className={`grid grid-cols-1 ${plans.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : plans.length >= 3 ? "md:grid-cols-3" : ""} gap-6 lg:gap-8`}>
            {plans.map((plan, idx) => {
              const style = cardStyles[Math.min(idx, cardStyles.length - 1)];
              const included = getIncludedFeatures(plan);
              const notIncluded = getNotIncludedFeatures(plan, plans);
              const isContactOnly = plan.priceInCents === 0;
              const prevPlan = idx > 0 ? plans[idx - 1] : null;

              return (
                <FadeIn key={plan.id} delay={0.1 * (idx + 1)}>
                  <div className={style.wrapper}>
                    {style.isHighlighted && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg shadow-violet-500/25 flex items-center gap-1.5">
                          <Crown className="w-3 h-3" /> Mais popular
                        </span>
                      </div>
                    )}

                    <div className="mb-6">
                      <p className={style.nameClass}>{plan.name}</p>
                      <div className="flex items-baseline gap-1">
                        {isContactOnly ? (
                          <span className={style.priceClass}>Sob consulta</span>
                        ) : (
                          <>
                            <span className={style.priceClass}>R$ {(plan.priceInCents / 100).toFixed(0)}</span>
                            <span className="text-white/30 text-sm">/mês</span>
                          </>
                        )}
                      </div>
                      {plan.commercialCopy && <p className={style.copyClass}>{plan.commercialCopy}</p>}
                    </div>

                    <div className={style.divider}>
                      <p className={style.sectionLabel}>
                        {prevPlan ? `Tudo do ${prevPlan.name}, mais:` : "Inclui:"}
                      </p>
                      <ul className="space-y-3">
                        {included.map((item, i) => (
                          <li key={i} className={`flex items-start gap-2.5 ${style.itemColor}`}>
                            <Check className={`w-4 h-4 ${style.checkColor} mt-0.5 shrink-0`} />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      {notIncluded.length > 0 && (
                        <div className={style.notIncludedDivider}>
                          <p className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">Não inclui:</p>
                          <ul className="space-y-2">
                            {notIncluded.map((item, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-sm text-white/25">
                                <X className="w-4 h-4 text-white/15 mt-0.5 shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {isContactOnly ? (
                      <Button
                        className={style.btnClass}
                        onClick={() => window.open(SCALE_WHATSAPP_URL, "_blank")}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" /> Falar com consultor
                      </Button>
                    ) : (
                      <Button
                        className={style.btnClass}
                        onClick={() => onSelectPlan(plan.id)}
                      >
                        Começar agora <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </FadeIn>
              );
            })}
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
                        {plans.map((plan, idx) => {
                          const isProCol = idx === 1;
                          return (
                            <th key={plan.id} className={`text-center py-4 px-4 ${isProCol ? "bg-violet-500/[0.06]" : ""}`} style={{ width: `${60 / plans.length}%` }}>
                              <span className={isProCol ? "text-violet-400 font-bold" : idx === plans.length - 1 ? "text-amber-400/80 font-semibold" : "text-white/60 font-semibold"}>
                                {plan.name}
                              </span>
                              <p className={`text-xs mt-0.5 ${isProCol ? "text-violet-400/50" : idx === plans.length - 1 ? "text-amber-400/30" : "text-white/25"}`}>
                                {plan.priceInCents > 0 ? `R$ ${(plan.priceInCents / 100).toFixed(0)}/mês` : "Sob consulta"}
                              </p>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Limit rows */}
                      <tr className="border-b border-white/[0.04]">
                        <td className="py-3.5 px-5 text-white/50">Usuários</td>
                        {plans.map((plan, idx) => (
                          <td key={plan.id} className={`text-center py-3.5 px-4 ${idx === 1 ? "bg-violet-500/[0.04]" : ""}`}>
                            <span className="text-white/70 font-medium">
                              {plan.maxUsers === -1 ? "Ilimitado" : `${plan.maxUsers}`}
                            </span>
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-white/[0.04]">
                        <td className="py-3.5 px-5 text-white/50">Contas de WhatsApp</td>
                        {plans.map((plan, idx) => (
                          <td key={plan.id} className={`text-center py-3.5 px-4 ${idx === 1 ? "bg-violet-500/[0.04]" : ""}`}>
                            <span className={plan.maxWhatsAppAccounts === 0 ? "text-white/20" : "text-white/70 font-medium"}>
                              {plan.maxWhatsAppAccounts === 0 ? "—" : `${plan.maxWhatsAppAccounts}`}
                            </span>
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-white/[0.04]">
                        <td className="py-3.5 px-5 text-white/50">Atendentes por conta</td>
                        {plans.map((plan, idx) => (
                          <td key={plan.id} className={`text-center py-3.5 px-4 ${idx === 1 ? "bg-violet-500/[0.04]" : ""}`}>
                            <span className={plan.maxAttendantsPerAccount === 0 ? "text-white/20" : "text-white/70 font-medium"}>
                              {plan.maxAttendantsPerAccount === 0 ? "—" : `${plan.maxAttendantsPerAccount}`}
                            </span>
                          </td>
                        ))}
                      </tr>
                      {/* Feature rows */}
                      {COMPARISON_FEATURE_KEYS.map((row) => (
                        <tr key={row.key} className="border-b border-white/[0.04] last:border-0">
                          <td className="py-3.5 px-5 text-white/50">{row.label}</td>
                          {plans.map((plan, idx) => {
                            const isProCol = idx === 1;
                            const hasFeature = plan.features[row.key] ?? false;
                            return (
                              <td key={plan.id} className={`text-center py-3.5 px-4 ${isProCol ? "bg-violet-500/[0.04]" : ""}`}>
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
                <div className={`border-t border-white/[0.06] grid`} style={{ gridTemplateColumns: `40% ${plans.map(() => `${60 / plans.length}%`).join(" ")}` }}>
                  <div className="py-5 px-5" />
                  {plans.map((plan, idx) => {
                    const isProCol = idx === 1;
                    const isContactOnly = plan.priceInCents === 0;
                    return (
                      <div key={plan.id} className={`py-5 px-4 flex items-center justify-center ${isProCol ? "bg-violet-500/[0.06]" : ""}`}>
                        {isContactOnly ? (
                          <Button
                            size="sm"
                            className={idx === plans.length - 1 ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/15 text-xs" : "bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.10] text-xs"}
                            onClick={() => window.open(SCALE_WHATSAPP_URL, "_blank")}
                          >
                            Consultar
                          </Button>
                        ) : isProCol ? (
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs shadow-lg shadow-violet-500/20"
                            onClick={() => onSelectPlan(plan.id)}
                          >
                            Assinar {plan.name}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.10] text-xs"
                            onClick={() => onSelectPlan(plan.id)}
                          >
                            Assinar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-5 sm:px-8 border-t border-white/[0.05] bg-[#06060a]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663249817763/EKvcVicuVoUxTnzjSKzgdk/logo-light_c3efa809.webp" alt="enturOS CRM" className="h-6 object-contain" />
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
