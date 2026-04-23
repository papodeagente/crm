import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FadeIn } from "./FadeIn";
import { Calculator, ArrowRight, DollarSign, TrendingDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MoneyCalculatorProps {
  onCTA: () => void;
}

export function MoneyCalculator({ onCTA }: MoneyCalculatorProps) {
  const [leads, setLeads] = useState("");
  const [ticket, setTicket] = useState("");
  const [convRate, setConvRate] = useState("");
  const [showResult, setShowResult] = useState(false);

  const result = useMemo(() => {
    const l = parseInt(leads) || 0;
    const t = parseFloat(ticket) || 0;
    const c = parseFloat(convRate) || 0;
    if (l === 0 || t === 0 || c === 0) return null;

    // Assume 40% of leads don't get follow-up
    const leadsWithoutFollowup = Math.round(l * 0.4);
    // Of those, estimate 20% could have converted with proper follow-up
    const potentialConversions = Math.round(leadsWithoutFollowup * 0.2);
    const lostRevenue = potentialConversions * t;
    const yearlyLoss = lostRevenue * 12;

    return { leadsWithoutFollowup, potentialConversions, lostRevenue, yearlyLoss };
  }, [leads, ticket, convRate]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  return (
    <section className="py-20 sm:py-28 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[500px] bg-gradient-to-br from-amber-600/8 to-transparent rounded-full blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/15 mb-5">
              <Calculator className="w-7 h-7 text-amber-400" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
              Descubra quanto dinheiro pode estar parado no seu negócio
            </h2>
            <p className="text-lg text-white/40">
              Preencha os dados abaixo e veja uma estimativa das oportunidades perdidas
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="grid sm:grid-cols-3 gap-5 mb-6">
              <div>
                <Label className="text-sm text-white/50 mb-2 block">Atendimentos mensais</Label>
                <Input
                  type="number"
                  placeholder="Ex: 80"
                  value={leads}
                  onChange={(e) => { setLeads(e.target.value); setShowResult(false); }}
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 text-base focus:border-amber-500/40"
                />
              </div>
              <div>
                <Label className="text-sm text-white/50 mb-2 block">Ticket médio (R$)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 5000"
                  value={ticket}
                  onChange={(e) => { setTicket(e.target.value); setShowResult(false); }}
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 text-base focus:border-amber-500/40"
                />
              </div>
              <div>
                <Label className="text-sm text-white/50 mb-2 block">Taxa de fechamento (%)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 15"
                  value={convRate}
                  onChange={(e) => { setConvRate(e.target.value); setShowResult(false); }}
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 text-base focus:border-amber-500/40"
                />
              </div>
            </div>

            <Button
              className="w-full h-13 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold border-0 shadow-lg shadow-amber-500/20"
              onClick={() => setShowResult(true)}
              disabled={!result}
            >
              <Calculator className="w-4 h-4 mr-2" /> Calcular oportunidades perdidas
            </Button>

            <AnimatePresence>
              {showResult && result && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.5 }}
                  className="overflow-hidden"
                >
                  <div className="mt-6 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="bg-red-500/[0.06] border border-red-500/15 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingDown className="w-4 h-4 text-red-400" />
                          <span className="text-xs text-red-300/70 uppercase tracking-wider font-medium">Perda mensal estimada</span>
                        </div>
                        <p className="text-3xl font-bold text-red-400">{formatCurrency(result.lostRevenue)}</p>
                        <p className="text-xs text-white/30 mt-1">
                          ~{result.leadsWithoutFollowup} leads sem acompanhamento
                        </p>
                      </div>
                      <div className="bg-red-500/[0.06] border border-red-500/15 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4 text-red-400" />
                          <span className="text-xs text-red-300/70 uppercase tracking-wider font-medium">Perda anual estimada</span>
                        </div>
                        <p className="text-3xl font-bold text-red-400">{formatCurrency(result.yearlyLoss)}</p>
                        <p className="text-xs text-white/30 mt-1">
                          ~{result.potentialConversions * 12} vendas perdidas por ano
                        </p>
                      </div>
                    </div>

                    <div className="text-center pt-2">
                      <Button
                        className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-violet-500/20"
                        onClick={onCTA}
                      >
                        Quero recuperar essas vendas <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
