import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FadeIn } from "./FadeIn";
import { Filter, ArrowDown, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const STAGES = [
  { name: "Novo atendimento", color: "bg-blue-500" },
  { name: "Diagnóstico", color: "bg-violet-500" },
  { name: "Proposta enviada", color: "bg-amber-500" },
  { name: "Follow-up", color: "bg-orange-500" },
  { name: "Reserva", color: "bg-emerald-500" },
];

const CONVERSION_RATES: Record<string, number[]> = {
  baixo: [0.60, 0.40, 0.30, 0.25],
  medio: [0.75, 0.55, 0.50, 0.45],
  alto: [0.85, 0.70, 0.65, 0.60],
};

export function FunnelMap() {
  const [leads, setLeads] = useState("");
  const [ticket, setTicket] = useState("");
  const [level, setLevel] = useState("");
  const [showResult, setShowResult] = useState(false);

  const result = useMemo(() => {
    const l = parseInt(leads) || 0;
    const t = parseFloat(ticket) || 0;
    if (l === 0 || t === 0 || !level) return null;

    const rates = CONVERSION_RATES[level];
    const stages: { name: string; count: number; lost: number; lostValue: number; color: string }[] = [];

    let current = l;
    for (let i = 0; i < STAGES.length; i++) {
      if (i === 0) {
        stages.push({ name: STAGES[i].name, count: current, lost: 0, lostValue: 0, color: STAGES[i].color });
      } else {
        const next = Math.round(current * rates[i - 1]);
        const lost = current - next;
        stages.push({
          name: STAGES[i].name,
          count: next,
          lost,
          lostValue: lost * t,
          color: STAGES[i].color,
        });
        current = next;
      }
    }

    const totalLost = stages.reduce((sum, s) => sum + s.lostValue, 0);
    return { stages, totalLost };
  }, [leads, ticket, level]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  return (
    <section className="py-20 sm:py-28 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-tl from-orange-600/8 to-transparent rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/15 mb-5">
              <Filter className="w-7 h-7 text-orange-400" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
              Onde sua agência está perdendo vendas todos os meses
            </h2>
            <p className="text-lg text-white/40">
              Visualize o vazamento em cada etapa do seu funil comercial
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
                  placeholder="Ex: 100"
                  value={leads}
                  onChange={(e) => { setLeads(e.target.value); setShowResult(false); }}
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 text-base focus:border-orange-500/40"
                />
              </div>
              <div>
                <Label className="text-sm text-white/50 mb-2 block">Ticket médio (R$)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 5000"
                  value={ticket}
                  onChange={(e) => { setTicket(e.target.value); setShowResult(false); }}
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 text-base focus:border-orange-500/40"
                />
              </div>
              <div>
                <Label className="text-sm text-white/50 mb-2 block">Nível de organização</Label>
                <Select value={level} onValueChange={(v) => { setLevel(v); setShowResult(false); }}>
                  <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white h-12 focus:border-orange-500/40">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixo">Baixo</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full h-13 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-semibold border-0 shadow-lg shadow-orange-500/20"
              onClick={() => setShowResult(true)}
              disabled={!result}
            >
              <Filter className="w-4 h-4 mr-2" /> Visualizar mapa de vazamento
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
                  <div className="mt-8 space-y-3">
                    {result.stages.map((stage, i) => {
                      const maxCount = result.stages[0].count;
                      const widthPct = Math.max((stage.count / maxCount) * 100, 15);
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-36 sm:w-44 text-right">
                              <p className="text-sm font-medium text-white/70">{stage.name}</p>
                            </div>
                            <div className="flex-1 relative">
                              <div
                                className={`h-10 ${stage.color} rounded-lg flex items-center justify-end pr-3 transition-all duration-700`}
                                style={{ width: `${widthPct}%`, opacity: 0.8 }}
                              >
                                <span className="text-sm font-bold text-white">{stage.count}</span>
                              </div>
                            </div>
                          </div>
                          {stage.lost > 0 && (
                            <div className="flex items-center gap-4 mt-1 ml-36 sm:ml-44 pl-4">
                              <div className="flex items-center gap-1.5 text-xs text-red-400/70">
                                <ArrowDown className="w-3 h-3" />
                                <span>-{stage.lost} perdidos</span>
                                <span className="text-red-400/50">({formatCurrency(stage.lostValue)})</span>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}

                    <div className="mt-6 p-4 bg-red-500/[0.08] border border-red-500/15 rounded-xl flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-red-300">
                          Perda total estimada: {formatCurrency(result.totalLost)}/mês
                        </p>
                        <p className="text-xs text-white/30 mt-0.5">
                          {formatCurrency(result.totalLost * 12)} por ano em vendas que poderiam ser recuperadas
                        </p>
                      </div>
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
