import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "./FadeIn";
import { Check, ArrowRight, X, MessageSquare, Crown, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { PublicPlan } from "../../../../server/services/publicPlansService";

const SCALE_WHATSAPP_URL = "https://wa.me/551151982627?text=Quero%20conhecer%20o%20Plano%20Elite%20do%20Entur%20OS.%20Pode%20me%20ajudar%3F";

interface PricingSectionProps {
  onSelectPlan: (plan?: string) => void;
}

// ─── Fallback plans (from shared/plans.ts shape) ─────────────────
const FALLBACK_PLANS: PublicPlan[] = [
  {
    slug: "start",
    name: "Essencial",
    description: "Estrutura e controle para começar",
    commercialCopy: "Ideal para agentes solo que querem organizar suas vendas.",
    priceCents: 9900,
    billingCycle: "monthly",
    isPopular: false,
    sortOrder: 0,
    checkoutUrl: null,
    color: null,
    limits: { maxUsers: 1, maxWhatsAppAccounts: 0, maxAttendantsPerAccount: 0 },
    features: [
      { key: "crmCore", label: "CRM completo (contatos, negociações, funil, tarefas)", isEnabled: true },
      { key: "communityAccess", label: "Comunidade Acelera Turismo", isEnabled: true },
      { key: "whatsappEmbedded", label: "WhatsApp integrado ao CRM", isEnabled: false },
      { key: "segmentedBroadcast", label: "Disparo segmentado de mensagens", isEnabled: false },
      { key: "rfvEnabled", label: "Matriz RFV (Classificação Estratégica)", isEnabled: false },
      { key: "salesAutomation", label: "Automação de vendas", isEnabled: false },
      { key: "prioritySupport", label: "Suporte prioritário", isEnabled: false },
    ],
  },
  {
    slug: "growth",
    name: "Pro",
    description: "Performance e automação para crescer",
    commercialCopy: "Para agências que querem escalar com WhatsApp e automação.",
    priceCents: 24900,
    billingCycle: "monthly",
    isPopular: true,
    sortOrder: 1,
    checkoutUrl: null,
    color: null,
    limits: { maxUsers: 5, maxWhatsAppAccounts: 1, maxAttendantsPerAccount: 3 },
    features: [
      { key: "crmCore", label: "CRM completo (contatos, negociações, funil, tarefas)", isEnabled: true },
      { key: "communityAccess", label: "Comunidade Acelera Turismo", isEnabled: true },
      { key: "whatsappEmbedded", label: "WhatsApp integrado ao CRM", isEnabled: true },
      { key: "segmentedBroadcast", label: "Disparo segmentado de mensagens", isEnabled: true },
      { key: "rfvEnabled", label: "Matriz RFV (Classificação Estratégica)", isEnabled: true },
      { key: "salesAutomation", label: "Automação de vendas", isEnabled: true },
      { key: "prioritySupport", label: "Suporte prioritário", isEnabled: false },
    ],
  },
  {
    slug: "scale",
    name: "Elite",
    description: "Escala e prioridade para operações robustas",
    commercialCopy: "Para operações com múltiplos atendentes e suporte dedicado.",
    priceCents: 0,
    billingCycle: "monthly",
    isPopular: false,
    sortOrder: 2,
    checkoutUrl: null,
    color: null,
    limits: { maxUsers: -1, maxWhatsAppAccounts: 3, maxAttendantsPerAccount: 10 },
    features: [
      { key: "crmCore", label: "CRM completo (contatos, negociações, funil, tarefas)", isEnabled: true },
      { key: "communityAccess", label: "Comunidade Acelera Turismo", isEnabled: true },
      { key: "whatsappEmbedded", label: "WhatsApp integrado ao CRM", isEnabled: true },
      { key: "segmentedBroadcast", label: "Disparo segmentado de mensagens", isEnabled: true },
      { key: "rfvEnabled", label: "Matriz RFV (Classificação Estratégica)", isEnabled: true },
      { key: "salesAutomation", label: "Automação de vendas", isEnabled: true },
      { key: "prioritySupport", label: "Suporte prioritário", isEnabled: true },
    ],
  },
];

// ─── Card styling per index ─────────────────────────────────────
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
    btnClass: "w-full h-12 bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.10] hover:border-white/[0.15] transition-all duration-300 rounded-xl",
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
    btnClass: "w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-0 shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-violet-500/35 rounded-xl",
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
    btnClass: "w-full h-12 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/20 hover:border-amber-500/30 transition-all duration-300 rounded-xl",
    isHighlighted: false,
    notIncludedDivider: "mt-4 pt-4 border-t border-amber-500/[0.06]",
  },
];

// ─── Feature comparison keys ─────────────────────────────────────
const COMPARISON_FEATURE_KEYS = [
  { key: "crmCore", label: "CRM completo (contatos, negociações, funil, tarefas)" },
  { key: "communityAccess", label: "Comunidade Acelera Turismo" },
  { key: "whatsappEmbedded", label: "WhatsApp integrado ao CRM" },
  { key: "segmentedBroadcast", label: "Disparo segmentado de mensagens" },
  { key: "rfvEnabled", label: "Matriz RFV (Classificação Estratégica)" },
  { key: "salesAutomation", label: "Automação de vendas" },
  { key: "prioritySupport", label: "Suporte prioritário" },
];

function formatPrice(priceCents: number): { main: string; suffix: string } {
  if (!priceCents || priceCents === 0) return { main: "Sob consulta", suffix: "" };
  return { main: `R$ ${(priceCents / 100).toFixed(0)}`, suffix: "/mês" };
}

function getIncludedFeatures(plan: PublicPlan): string[] {
  const items: string[] = [];
  const featureMap = new Map(plan.features.map((f) => [f.key, f.isEnabled]));

  if (featureMap.get("crmCore")) items.push("CRM completo (contatos, negociações, funil, tarefas)");
  if (featureMap.get("communityAccess")) items.push("Comunidade Acelera Turismo");

  const { maxUsers, maxWhatsAppAccounts, maxAttendantsPerAccount } = plan.limits;
  items.push(maxUsers === 1 ? "1 usuário" : maxUsers === -1 ? "Usuários ilimitados" : `Até ${maxUsers} usuários`);

  if (featureMap.get("whatsappEmbedded")) {
    items.push("WhatsApp integrado ao CRM");
    if (maxWhatsAppAccounts > 0) {
      items.push(`${maxWhatsAppAccounts} conta${maxWhatsAppAccounts > 1 ? "s" : ""} WhatsApp com até ${maxAttendantsPerAccount} atendentes`);
    }
  }
  if (featureMap.get("segmentedBroadcast")) items.push("Disparo segmentado de mensagens");
  if (featureMap.get("rfvEnabled")) items.push("Matriz RFV (Classificação Estratégica)");
  if (featureMap.get("salesAutomation")) items.push("Automação de vendas");
  if (featureMap.get("prioritySupport")) items.push("Suporte prioritário");
  return items;
}

function getNotIncludedFeatures(plan: PublicPlan, allPlans: PublicPlan[]): string[] {
  const topPlan = allPlans[allPlans.length - 1];
  if (!topPlan) return [];
  const planFeatureMap = new Map(plan.features.map((f) => [f.key, f.isEnabled]));
  const topFeatureMap = new Map(topPlan.features.map((f) => [f.key, f.isEnabled]));
  const missing: string[] = [];
  if (!planFeatureMap.get("whatsappEmbedded") && topFeatureMap.get("whatsappEmbedded")) missing.push("WhatsApp no CRM");
  if (!planFeatureMap.get("segmentedBroadcast") && topFeatureMap.get("segmentedBroadcast")) missing.push("Disparo segmentado");
  if (!planFeatureMap.get("rfvEnabled") && topFeatureMap.get("rfvEnabled")) missing.push("Matriz RFV");
  if (!planFeatureMap.get("salesAutomation") && topFeatureMap.get("salesAutomation")) missing.push("Automação de vendas");
  if (!planFeatureMap.get("prioritySupport") && topFeatureMap.get("prioritySupport")) missing.push("Suporte prioritário");
  return missing;
}

export function PricingSection({ onSelectPlan }: PricingSectionProps) {
  const plansQuery = trpc.plan.public.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const plans = useMemo(() => {
    const data = plansQuery.data;
    if (!data || !Array.isArray(data) || data.length === 0) return FALLBACK_PLANS;
    // Sort by sortOrder, limit to 4
    return [...data].sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 4);
  }, [plansQuery.data]);

  // Show skeleton while loading
  if (plansQuery.isLoading) {
    return (
      <section id="planos" className="py-24 sm:py-32 px-5 sm:px-8 relative overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="h-4 w-40 bg-white/5 rounded mx-auto mb-4 animate-pulse" />
            <div className="h-10 w-96 bg-white/5 rounded mx-auto mb-3 animate-pulse" />
            <div className="h-5 w-72 bg-white/5 rounded mx-auto animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 animate-pulse">
                <div className="h-4 w-20 bg-white/5 rounded mb-4" />
                <div className="h-8 w-32 bg-white/5 rounded mb-3" />
                <div className="h-3 w-full bg-white/5 rounded mb-6" />
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-3 w-full bg-white/5 rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="planos" className="py-24 sm:py-32 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-violet-600/15 via-purple-600/10 to-transparent rounded-full blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight leading-tight">
              Escolha o plano{" "}
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                da sua agência
              </span>
            </h2>
            <p className="text-lg text-white/40 max-w-xl mx-auto">
              Teste grátis por 7 dias. Sem cartão. Cancele quando quiser.
            </p>
          </div>
        </FadeIn>

        {/* ─── Plan Cards ─── */}
        <div className={`grid grid-cols-1 ${plans.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : plans.length >= 3 ? "md:grid-cols-3" : ""} gap-6 lg:gap-8`}>
          {plans.map((plan, idx) => {
            const style = cardStyles[Math.min(idx, cardStyles.length - 1)];
            const isPopular = plan.isPopular;
            const activeStyle = isPopular ? cardStyles[1] : style;
            const included = getIncludedFeatures(plan);
            const notIncluded = getNotIncludedFeatures(plan, plans);
            const isContactOnly = plan.priceCents === 0;
            const price = formatPrice(plan.priceCents);
            const prevPlan = idx > 0 ? plans[idx - 1] : null;

            return (
              <FadeIn key={plan.slug} delay={0.1 * (idx + 1)}>
                <div className={activeStyle.wrapper}>
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg shadow-violet-500/25 flex items-center gap-1.5">
                        <Crown className="w-3 h-3" /> Mais popular
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <p className={activeStyle.nameClass}>{plan.name}</p>
                    <div className="flex items-baseline gap-1">
                      <span className={activeStyle.priceClass}>{price.main}</span>
                      {price.suffix && <span className="text-white/30 text-sm">{price.suffix}</span>}
                    </div>
                    {plan.commercialCopy && <p className={activeStyle.copyClass}>{plan.commercialCopy}</p>}
                  </div>

                  <div className={activeStyle.divider}>
                    <p className={activeStyle.sectionLabel}>
                      {prevPlan ? `Tudo do ${prevPlan.name}, mais:` : "Inclui:"}
                    </p>
                    <ul className="space-y-3">
                      {included.map((item, i) => (
                        <li key={i} className={`flex items-start gap-2.5 ${activeStyle.itemColor}`}>
                          <Check className={`w-4 h-4 ${activeStyle.checkColor} mt-0.5 shrink-0`} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    {notIncluded.length > 0 && (
                      <div className={activeStyle.notIncludedDivider}>
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
                      className={activeStyle.btnClass}
                      onClick={() => window.open(SCALE_WHATSAPP_URL, "_blank")}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" /> Falar com consultor
                    </Button>
                  ) : plan.checkoutUrl ? (
                    <Button
                      className={activeStyle.btnClass}
                      onClick={() => window.open(plan.checkoutUrl!, "_blank")}
                    >
                      Começar agora <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      className={activeStyle.btnClass}
                      onClick={() => onSelectPlan(plan.slug)}
                    >
                      Testar grátis por 7 dias <ArrowRight className="w-4 h-4 ml-2" />
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
                      {plans.map((plan) => {
                        const isPopularCol = plan.isPopular;
                        const isLastCol = plan.slug === "scale";
                        return (
                          <th key={plan.slug} className={`text-center py-4 px-4 ${isPopularCol ? "bg-violet-500/[0.06]" : ""}`} style={{ width: `${60 / plans.length}%` }}>
                            <span className={isPopularCol ? "text-violet-400 font-bold" : isLastCol ? "text-amber-400/80 font-semibold" : "text-white/60 font-semibold"}>
                              {plan.name}
                            </span>
                            <p className={`text-xs mt-0.5 ${isPopularCol ? "text-violet-400/50" : isLastCol ? "text-amber-400/30" : "text-white/25"}`}>
                              {plan.priceCents > 0 ? `R$ ${(plan.priceCents / 100).toFixed(0)}/mês` : "Sob consulta"}
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
                      {plans.map((plan) => (
                        <td key={plan.slug} className={`text-center py-3.5 px-4 ${plan.isPopular ? "bg-violet-500/[0.04]" : ""}`}>
                          <span className="text-white/70 font-medium">
                            {plan.limits.maxUsers === -1 ? "Ilimitado" : `${plan.limits.maxUsers}`}
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-white/[0.04]">
                      <td className="py-3.5 px-5 text-white/50">Contas de WhatsApp</td>
                      {plans.map((plan) => (
                        <td key={plan.slug} className={`text-center py-3.5 px-4 ${plan.isPopular ? "bg-violet-500/[0.04]" : ""}`}>
                          <span className={plan.limits.maxWhatsAppAccounts === 0 ? "text-white/20" : "text-white/70 font-medium"}>
                            {plan.limits.maxWhatsAppAccounts === 0 ? "—" : `${plan.limits.maxWhatsAppAccounts}`}
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-white/[0.04]">
                      <td className="py-3.5 px-5 text-white/50">Atendentes por conta</td>
                      {plans.map((plan) => (
                        <td key={plan.slug} className={`text-center py-3.5 px-4 ${plan.isPopular ? "bg-violet-500/[0.04]" : ""}`}>
                          <span className={plan.limits.maxAttendantsPerAccount === 0 ? "text-white/20" : "text-white/70 font-medium"}>
                            {plan.limits.maxAttendantsPerAccount === 0 ? "—" : `${plan.limits.maxAttendantsPerAccount}`}
                          </span>
                        </td>
                      ))}
                    </tr>
                    {/* Feature rows */}
                    {COMPARISON_FEATURE_KEYS.map((row) => (
                      <tr key={row.key} className="border-b border-white/[0.04] last:border-0">
                        <td className="py-3.5 px-5 text-white/50">{row.label}</td>
                        {plans.map((plan) => {
                          const featureMap = new Map(plan.features.map((f) => [f.key, f.isEnabled]));
                          const hasFeature = featureMap.get(row.key) ?? false;
                          return (
                            <td key={plan.slug} className={`text-center py-3.5 px-4 ${plan.isPopular ? "bg-violet-500/[0.04]" : ""}`}>
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
              <div className="border-t border-white/[0.06] grid" style={{ gridTemplateColumns: `40% ${plans.map(() => `${60 / plans.length}%`).join(" ")}` }}>
                <div className="py-5 px-5" />
                {plans.map((plan) => {
                  const isContactOnly = plan.priceCents === 0;
                  const isPopularCol = plan.isPopular;
                  const isLastCol = plan.slug === "scale";
                  return (
                    <div key={plan.slug} className={`py-5 px-4 flex items-center justify-center ${isPopularCol ? "bg-violet-500/[0.06]" : ""}`}>
                      {isContactOnly ? (
                        <Button
                          size="sm"
                          className={isLastCol ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/15 text-xs" : "bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.10] text-xs"}
                          onClick={() => window.open(SCALE_WHATSAPP_URL, "_blank")}
                        >
                          Consultar
                        </Button>
                      ) : isPopularCol ? (
                        <Button
                          size="sm"
                          className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs shadow-lg shadow-violet-500/20"
                          onClick={() => plan.checkoutUrl ? window.open(plan.checkoutUrl, "_blank") : onSelectPlan(plan.slug)}
                        >
                          Assinar {plan.name}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.10] text-xs"
                          onClick={() => plan.checkoutUrl ? window.open(plan.checkoutUrl, "_blank") : onSelectPlan(plan.slug)}
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
  );
}
