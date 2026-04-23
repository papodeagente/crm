import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "./FadeIn";
import { Check, ArrowRight, X, MessageSquare, Crown, Loader2, ChevronDown, User, Mail } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion } from "motion/react";
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
      { key: "crmCore", label: "CRM completo (clientes, negociações, funil, tarefas)", isEnabled: true },
      { key: "communityAccess", label: "Comunidade exclusiva", isEnabled: true },
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
    commercialCopy: "Para negócios que querem escalar com WhatsApp e automação.",
    priceCents: 24900,
    billingCycle: "monthly",
    isPopular: true,
    sortOrder: 1,
    checkoutUrl: "https://pay.hotmart.com/S104799458W?off=pubryjat",
    color: null,
    limits: { maxUsers: 5, maxWhatsAppAccounts: 1, maxAttendantsPerAccount: 3 },
    features: [
      { key: "crmCore", label: "CRM completo (clientes, negociações, funil, tarefas)", isEnabled: true },
      { key: "communityAccess", label: "Comunidade exclusiva", isEnabled: true },
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
    priceCents: 79700,
    billingCycle: "monthly",
    isPopular: false,
    sortOrder: 2,
    checkoutUrl: "https://pay.hotmart.com/S104799458W?off=1wkp05db",
    color: null,
    limits: { maxUsers: -1, maxWhatsAppAccounts: 3, maxAttendantsPerAccount: 10 },
    features: [
      { key: "crmCore", label: "CRM completo (clientes, negociações, funil, tarefas)", isEnabled: true },
      { key: "communityAccess", label: "Comunidade exclusiva", isEnabled: true },
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
    nameClass: "text-sm font-medium text-white/70 uppercase tracking-wider mb-2",
    priceClass: "text-4xl font-bold text-white",
    copyClass: "text-sm text-white/50 mt-3",
    divider: "border-t border-violet-500/10 pt-6 mb-6 flex-1",
    sectionLabel: "text-xs font-medium text-white/50 uppercase tracking-wider mb-4",
    checkColor: "text-emerald-400",
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
  { key: "crmCore", label: "CRM completo (clientes, negociações, funil, tarefas)" },
  { key: "communityAccess", label: "Comunidade exclusiva" },
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

  if (featureMap.get("crmCore")) items.push("CRM completo (clientes, negociações, funil, tarefas)");
  if (featureMap.get("communityAccess")) items.push("Comunidade exclusiva");

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

// ─── Helper: build Hotmart checkout URL with pre-filled data ────
function buildCheckoutUrl(baseUrl: string, name: string, email: string): string {
  const url = new URL(baseUrl);
  if (name.trim()) url.searchParams.set("name", name.trim());
  if (email.trim()) url.searchParams.set("email", email.trim());
  return url.toString();
}

// ─── Checkout Dialog Component ──────────────────────────────────
function CheckoutDialog({
  plan,
  onClose,
}: {
  plan: PublicPlan;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan.checkoutUrl) return;
    const url = buildCheckoutUrl(plan.checkoutUrl, name, email);
    window.open(url, "_blank");
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-[#12121e] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl"
      >
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white">
            Assinar plano {plan.name}
          </h3>
          <p className="text-sm text-white/50 mt-2">
            Preencha seus dados para agilizar o checkout
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white/60 mb-1.5 block">Seu nome</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="João Silva"
                className="w-full h-11 pl-10 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 outline-none transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-white/60 mb-1.5 block">Seu email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full h-11 pl-10 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 outline-none transition-all text-sm"
              />
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium shadow-lg shadow-violet-500/25 rounded-xl transition-all"
            >
              Ir para o checkout <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="w-full text-sm text-white/40 hover:text-white/60 transition-colors py-2"
            >
              Cancelar
            </button>
          </div>
        </form>

        <p className="text-xs text-white/25 text-center mt-4">
          Pagamento seguro via Hotmart. Você será redirecionado.
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export function PricingSection({ onSelectPlan }: PricingSectionProps) {
  const plansQuery = trpc.plan.public.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [showComparison, setShowComparison] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PublicPlan | null>(null);

  const plans = useMemo(() => {
    const data = plansQuery.data;
    if (!data || !Array.isArray(data) || data.length === 0) return FALLBACK_PLANS;
    return [...data].sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 4);
  }, [plansQuery.data]);

  // Determine CTA action per plan
  const handlePlanCTA = (plan: PublicPlan) => {
    // Basic/start plan → go to register (7-day trial)
    if (plan.slug === "start") {
      onSelectPlan(plan.slug);
      return;
    }
    // Scale/Elite with price 0 → WhatsApp
    if (plan.priceCents === 0 && plan.slug === "scale") {
      window.open(SCALE_WHATSAPP_URL, "_blank");
      return;
    }
    // Pro/Elite with checkout URL → open dialog to capture name/email
    if (plan.checkoutUrl) {
      setCheckoutPlan(plan);
      return;
    }
    // Fallback → register
    onSelectPlan(plan.slug);
  };

  // Get CTA label per plan
  const getCTALabel = (plan: PublicPlan) => {
    if (plan.slug === "start") return "Testar grátis por 7 dias";
    if (plan.priceCents === 0 && plan.slug === "scale") return "Falar com consultor";
    if (plan.checkoutUrl) return "Assinar agora";
    return "Testar grátis por 7 dias";
  };

  // Get CTA icon per plan
  const getCTAIcon = (plan: PublicPlan) => {
    if (plan.priceCents === 0 && plan.slug === "scale") return <MessageSquare className="w-4 h-4 mr-2" />;
    return <ArrowRight className="w-4 h-4 ml-2" />;
  };

  const isIconBefore = (plan: PublicPlan) => plan.priceCents === 0 && plan.slug === "scale";

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
              <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 animate-pulse">
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
    <>
      <section id="planos" className="py-24 sm:py-32 px-5 sm:px-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-violet-600/15 via-purple-600/10 to-transparent rounded-full blur-[120px]" />
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          <FadeIn>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight leading-tight">
                Escolha o plano{" "}
                <span className="bg-gradient-to-r from-[#FFC7AC] via-[#FF614C] to-[#FF2B61] bg-clip-text text-transparent">
                  do seu negócio
                </span>
              </h2>
              <p className="text-lg text-white/40 max-w-xl mx-auto">
                Teste grátis por 7 dias no plano Essencial. Sem cartão. Cancele quando quiser.
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
                      {plan.slug === "start" && (
                        <p className="text-xs text-emerald-400/80 mt-1.5 font-medium">7 dias grátis para testar</p>
                      )}
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

                    <Button
                      className={activeStyle.btnClass}
                      onClick={() => handlePlanCTA(plan)}
                    >
                      {isIconBefore(plan) && getCTAIcon(plan)}
                      {getCTALabel(plan)}
                      {!isIconBefore(plan) && getCTAIcon(plan)}
                    </Button>
                  </div>
                </FadeIn>
              );
            })}
          </div>

          {/* ─── Comparison Table (collapsible) ─── */}
          <FadeIn delay={0.4}>
            <div className="mt-16">
              <div className="text-center">
                <Button
                  variant="ghost"
                  className="text-white/60 hover:text-white hover:bg-white/5 gap-2 text-sm font-medium mx-auto"
                  onClick={() => setShowComparison((v) => !v)}
                >
                  Compare os planos
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showComparison ? "rotate-180" : ""}`} />
                </Button>
                <p className="text-xs text-white/30 mt-1">
                  Veja exatamente o que cada plano oferece
                </p>
              </div>

              <AnimatePresence>
              {showComparison && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="overflow-hidden"
              >
              <div className="mt-6 bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden backdrop-blur-sm">
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
                              <span className={isPopularCol ? "text-white font-bold" : isLastCol ? "text-amber-400/80 font-semibold" : "text-white/60 font-semibold"}>
                                {plan.name}
                              </span>
                              <p className={`text-xs mt-0.5 ${isPopularCol ? "text-white/40" : isLastCol ? "text-amber-400/30" : "text-white/25"}`}>
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
                    const isPopularCol = plan.isPopular;
                    const isLastCol = plan.slug === "scale";
                    return (
                      <div key={plan.slug} className={`py-5 px-4 flex items-center justify-center ${isPopularCol ? "bg-violet-500/[0.06]" : ""}`}>
                        {isPopularCol ? (
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs shadow-lg shadow-violet-500/20"
                            onClick={() => handlePlanCTA(plan)}
                          >
                            Assinar {plan.name}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className={isLastCol ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/15 text-xs" : "bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.10] text-xs"}
                            onClick={() => handlePlanCTA(plan)}
                          >
                            {plan.slug === "start" ? "Testar grátis" : plan.priceCents === 0 ? "Consultar" : `Assinar`}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              </motion.div>
              )}
              </AnimatePresence>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── Checkout Dialog (overlay) ─── */}
      <AnimatePresence>
        {checkoutPlan && (
          <CheckoutDialog
            plan={checkoutPlan}
            onClose={() => setCheckoutPlan(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
