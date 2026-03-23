import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FadeIn } from "./FadeIn";
import { Check, ArrowRight, X, Phone, Star, Sparkles } from "lucide-react";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663249817763/XXuAsdiNIcgnwwra.png";

interface PricingSectionProps {
  onSelectPlan: () => void;
}

export function PricingSection({ onSelectPlan }: PricingSectionProps) {
  const [showEnterprise, setShowEnterprise] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", company: "", agents: "" });
  const [formSent, setFormSent] = useState(false);

  const handleEnterpriseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSent(true);
    setTimeout(() => {
      setShowEnterprise(false);
      setFormSent(false);
      setFormData({ name: "", email: "", phone: "", company: "", agents: "" });
    }, 3000);
  };

  return (
    <>
      <section id="planos" className="py-24 sm:py-32 px-5 sm:px-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-violet-600/15 via-purple-600/10 to-transparent rounded-full blur-[120px]" />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <FadeIn>
            <div className="text-center mb-14">
              <span className="inline-block text-sm font-medium text-violet-400/80 bg-violet-500/10 border border-violet-500/15 px-4 py-1.5 rounded-full mb-6">
                Planos e preços
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-white mb-4 tracking-tight leading-tight">
                Escolha o plano certo{" "}
                <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                  para o momento da sua agência
                </span>
              </h2>
              <p className="text-lg text-white/45 max-w-2xl mx-auto leading-relaxed">
                Cada plano foi pensado para um estágio diferente de maturidade comercial.
                Comece de onde faz sentido para você. Sem fidelidade.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-5 items-start">
            {/* SOLO */}
            <FadeIn delay={0.1}>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-7 flex flex-col h-full backdrop-blur-sm">
                <div className="mb-6">
                  <p className="text-sm font-bold text-white/50 uppercase tracking-wider mb-1">Solo</p>
                  <p className="text-sm text-white/35 mb-4">Para quem vende sozinho e quer organizar sua operação comercial de verdade.</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">R$ 97</span>
                    <span className="text-white/30 text-sm">/mês</span>
                  </div>
                  <p className="text-xs text-white/25 mt-1.5">1 usuário incluso</p>
                </div>

                <div className="border-t border-white/[0.06] pt-5 mb-6 flex-1">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">O que você ganha:</p>
                  <ul className="space-y-3">
                    {[
                      "Pipeline visual de negociações",
                      "Gestão completa de contatos e empresas",
                      "1 número de WhatsApp integrado",
                      "Follow-up e tarefas automáticas",
                      "Catálogo de produtos turísticos",
                      "Propostas comerciais",
                      "Dashboard com indicadores",
                      "Matriz RFV de clientes",
                      "Análise de conversas com IA",
                      "Funil de pós-venda",
                      "Campos personalizados",
                    ].map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-white/55">
                        <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                    <li className="flex items-start gap-2.5 text-sm text-white/25 mt-2">
                      <X className="w-4 h-4 text-white/15 mt-0.5 shrink-0" />
                      <span>Automações de vendas</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/25">
                      <X className="w-4 h-4 text-white/15 mt-0.5 shrink-0" />
                      <span>Automações de pós vendas</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/25">
                      <X className="w-4 h-4 text-white/15 mt-0.5 shrink-0" />
                      <span>Usuários adicionais</span>
                    </li>
                  </ul>
                </div>

                <Button
                  className="w-full h-12 bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.10] hover:border-white/[0.15] transition-all duration-300"
                  onClick={onSelectPlan}
                >
                  Começar agora <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </FadeIn>

            {/* GROWTH - HIGHLIGHTED */}
            <FadeIn delay={0.2}>
              <div className="relative bg-gradient-to-b from-violet-500/[0.10] to-purple-500/[0.04] border-2 border-violet-500/30 rounded-2xl p-7 flex flex-col h-full backdrop-blur-sm shadow-xl shadow-violet-500/10 md:-mt-4 md:mb-[-16px]">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold px-5 py-1.5 rounded-full shadow-lg shadow-violet-500/30">
                    <Star className="w-3.5 h-3.5" />
                    Melhor escolha
                  </span>
                </div>

                <div className="mb-6 mt-1">
                  <p className="text-sm font-bold text-violet-400 uppercase tracking-wider mb-1">Growth</p>
                  <p className="text-sm text-white/45 mb-4">Para agências que querem crescer com processo, equipe, automação e previsibilidade.</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">R$ 297</span>
                    <span className="text-white/30 text-sm">/mês</span>
                  </div>
                  <p className="text-xs text-white/25 mt-1.5">Até 5 usuários inclusos &middot; + R$ 97/mês por adicional</p>
                </div>

                <div className="border-t border-violet-500/15 pt-5 mb-6 flex-1">
                  <p className="text-xs font-semibold text-violet-400/60 uppercase tracking-wider mb-4">Tudo do Solo, mais:</p>
                  <ul className="space-y-3">
                    {[
                      "Pipeline visual de negociações",
                      "Gestão completa de contatos e empresas",
                      "1 número de WhatsApp integrado",
                      "Follow-up e tarefas automáticas",
                      "Catálogo de produtos turísticos",
                      "Propostas comerciais",
                      "Dashboard com indicadores",
                      "Matriz RFV de clientes",
                      "Análise de conversas com IA",
                      "Funil de pós-venda",
                      "Campos personalizados",
                    ].map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-white/55">
                        <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                    <li className="flex items-start gap-2.5 text-sm text-white/80 mt-2 pt-2 border-t border-violet-500/10">
                      <Sparkles className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                      <span className="font-medium">Automações de vendas</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/80">
                      <Sparkles className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                      <span className="font-medium">Automações de pós vendas</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-white/80">
                      <Sparkles className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                      <span className="font-medium">Até 5 usuários inclusos</span>
                    </li>
                  </ul>
                </div>

                <Button
                  className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-violet-500/40 font-semibold"
                  onClick={onSelectPlan}
                >
                  Começar com Growth <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </FadeIn>

            {/* SCALE */}
            <FadeIn delay={0.3}>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-7 flex flex-col h-full backdrop-blur-sm">
                <div className="mb-6">
                  <p className="text-sm font-bold text-amber-400/70 uppercase tracking-wider mb-1">Scale</p>
                  <p className="text-sm text-white/35 mb-4">Para operações estruturadas que precisam de suporte próximo e implantação consultiva.</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">Sob consulta</span>
                  </div>
                  <p className="text-xs text-white/25 mt-1.5">Usuários ilimitados</p>
                </div>

                <div className="border-t border-white/[0.06] pt-5 mb-6 flex-1">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Tudo do Growth, mais:</p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2.5 text-sm text-white/55">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span>Todas as funcionalidades do Growth</span>
                    </li>
                    {[
                      "Usuários ilimitados",
                      "Onboarding personalizado",
                      "Suporte prioritário dedicado",
                      "Consultoria comercial para sua agência",
                      "SLA de atendimento",
                      "Implantação orientada",
                    ].map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
                        <Check className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                        <span className="font-medium">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  className="w-full h-12 bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.10] hover:border-white/[0.15] transition-all duration-300"
                  onClick={() => setShowEnterprise(true)}
                >
                  <Phone className="w-4 h-4 mr-2" /> Falar com vendas
                </Button>
              </div>
            </FadeIn>
          </div>

          {/* Trust badges */}
          <FadeIn delay={0.4}>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-white/30">
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400/50" />
                Sem fidelidade
              </span>
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400/50" />
                Cancele quando quiser
              </span>
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400/50" />
                Suporte incluso em todos os planos
              </span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Final CTA Block */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-t from-violet-600/10 to-transparent rounded-full blur-[100px]" />
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight leading-tight">
              Sua agência merece vender com processo,{" "}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                não com improviso.
              </span>
            </h2>
            <p className="text-lg text-white/45 mb-8 leading-relaxed">
              Comece hoje. Organize suas vendas. Acompanhe cada cliente.
              E veja a diferença que um processo comercial de verdade faz no seu faturamento.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="h-13 px-8 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300 text-base font-semibold"
                onClick={onSelectPlan}
              >
                Começar agora <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-13 px-8 bg-transparent border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all duration-300 text-base"
                onClick={() => setShowEnterprise(true)}
              >
                <Phone className="w-4 h-4 mr-2" /> Falar com vendas
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-5 sm:px-8 border-t border-white/[0.05] bg-[#06060a]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={LOGO_URL} alt="ENTUR OS" className="h-7 w-7 rounded-lg" />
            <span className="font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent text-sm">
              ENTUR OS
            </span>
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

      {/* Enterprise Popup */}
      {showEnterprise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => { setShowEnterprise(false); setFormSent(false); }}
          />
          <div className="relative bg-[#12121a] border border-white/[0.10] rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl">
            <button
              className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition-colors"
              onClick={() => { setShowEnterprise(false); setFormSent(false); }}
            >
              <X className="w-5 h-5" />
            </button>

            {formSent ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Solicitação enviada!</h3>
                <p className="text-sm text-white/40">Nossa equipe entrará em contato em breve.</p>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold text-white mb-1">Plano Scale</h3>
                <p className="text-sm text-white/40 mb-6">
                  Preencha o formulário e nossa equipe entrará em contato para entender sua operação e montar a melhor proposta.
                </p>

                <form onSubmit={handleEnterpriseSubmit} className="space-y-4">
                  <div>
                    <Label className="text-sm text-white/50 mb-1.5 block">Nome completo</Label>
                    <Input
                      required
                      type="text"
                      placeholder="Seu nome"
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-11 focus:border-violet-500/40"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-white/50 mb-1.5 block">E-mail</Label>
                    <Input
                      required
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-11 focus:border-violet-500/40"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-white/50 mb-1.5 block">WhatsApp</Label>
                    <Input
                      required
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-11 focus:border-violet-500/40"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-white/50 mb-1.5 block">Nome da agência</Label>
                    <Input
                      required
                      type="text"
                      placeholder="Sua agência"
                      value={formData.company}
                      onChange={(e) => setFormData((p) => ({ ...p, company: e.target.value }))}
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-11 focus:border-violet-500/40"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-white/50 mb-1.5 block">Quantos agentes na equipe?</Label>
                    <Input
                      required
                      type="number"
                      placeholder="Ex: 10"
                      value={formData.agents}
                      onChange={(e) => setFormData((p) => ({ ...p, agents: e.target.value }))}
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-11 focus:border-violet-500/40"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-violet-500/25 mt-2"
                  >
                    Solicitar atendimento <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
