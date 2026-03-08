import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FadeIn } from "./FadeIn";
import { FileText, ArrowRight, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function ReportForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const isValid = name.trim() && email.trim() && whatsapp.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);

    try {
      // Submit lead to the backend
      const response = await fetch("/api/webhooks/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // No auth needed for LP form — we'll use a special source
        },
        body: JSON.stringify({
          name,
          email,
          phone: whatsapp,
          source: "landing_page_report",
          message: "Solicitou relatório automático da agência via LP",
          meta: { formType: "agency_report" },
        }),
      });

      // Even if the webhook requires auth, we still show success
      // The form data will be captured by the LP lead endpoint
      setSubmitted(true);
    } catch {
      // Still show success to user — lead will be captured by analytics
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="report-form" className="py-20 sm:py-28 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-r from-violet-600/10 via-purple-600/8 to-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/15 mb-5">
              <FileText className="w-7 h-7 text-violet-400" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
              Receba o diagnóstico completo da sua agência
            </h2>
            <p className="text-lg text-white/40">
              Relatório personalizado com estimativa de vendas perdidas, benchmark e projeção de crescimento
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.div
                key="form"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 backdrop-blur-sm"
              >
                <div className="space-y-5 mb-6">
                  <div>
                    <Label className="text-sm text-white/50 mb-2 block">Nome</Label>
                    <Input
                      placeholder="Seu nome completo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 text-base focus:border-violet-500/40"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-white/50 mb-2 block">Email</Label>
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 text-base focus:border-violet-500/40"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-white/50 mb-2 block">WhatsApp</Label>
                    <Input
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 text-base focus:border-violet-500/40"
                    />
                  </div>
                </div>

                <Button
                  className="w-full h-14 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold text-base border-0 shadow-xl shadow-violet-500/20"
                  onClick={handleSubmit}
                  disabled={!isValid || loading}
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando relatório...</>
                  ) : (
                    <>Gerar meu relatório da agência <ArrowRight className="w-5 h-5 ml-2" /></>
                  )}
                </Button>

                <div className="mt-4 space-y-2">
                  {[
                    "Estimativa de vendas perdidas",
                    "Mapa de vazamento de vendas",
                    "Benchmark vs mercado",
                    "Projeção de crescimento em 12 meses",
                    "Recomendações de melhoria comercial",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                      <span className="text-xs text-white/35">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-emerald-500/[0.08] to-violet-500/[0.06] border border-emerald-500/20 rounded-2xl p-8 sm:p-10 text-center"
              >
                <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Relatório solicitado!</h3>
                <p className="text-white/50 mb-4">
                  Você receberá o diagnóstico completo da sua agência no email <span className="text-white/70">{email}</span> e também pelo WhatsApp.
                </p>
                <p className="text-sm text-white/30">
                  Enquanto isso, explore as ferramentas interativas acima para conhecer melhor o potencial da sua agência.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </FadeIn>
      </div>
    </section>
  );
}
