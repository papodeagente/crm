import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FadeIn } from "./FadeIn";
import { TrendingUp, ArrowRight, Rocket } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface GrowthSimulatorProps {
  onCTA: () => void;
}

export function GrowthSimulator({ onCTA }: GrowthSimulatorProps) {
  const [leads, setLeads] = useState("");
  const [ticket, setTicket] = useState("");
  const [convRate, setConvRate] = useState("");
  const [showResult, setShowResult] = useState(false);

  const result = useMemo(() => {
    const l = parseInt(leads) || 0;
    const t = parseFloat(ticket) || 0;
    const c = parseFloat(convRate) || 0;
    if (l === 0 || t === 0 || c === 0) return null;

    // Growth improvements with CRM
    const improvements = [0, 0.05, 0.07, 0.10, 0.12, 0.14, 0.18, 0.20, 0.22, 0.25, 0.27, 0.30];

    const data = [];
    let totalWithout = 0;
    let totalWith = 0;

    for (let month = 0; month < 12; month++) {
      const baseConversion = c / 100;
      const withoutCRM = Math.round(l * baseConversion * t);
      const improvedConversion = Math.min(baseConversion + improvements[month], 0.95);
      const withCRM = Math.round(l * improvedConversion * t);

      totalWithout += withoutCRM;
      totalWith += withCRM;

      data.push({
        month: `Mês ${month + 1}`,
        semCRM: withoutCRM,
        comCRM: withCRM,
      });
    }

    return { data, totalWithout, totalWith, difference: totalWith - totalWithout };
  }, [leads, ticket, convRate]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  const formatAxisValue = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toString();
  };

  return (
    <section className="py-20 sm:py-28 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[500px] bg-gradient-to-tr from-emerald-600/8 to-transparent rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 mb-5">
              <TrendingUp className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
              Como sua agência pode crescer com processo comercial estruturado
            </h2>
            <p className="text-lg text-white/40">
              Simule o impacto do ENTUR OS nos próximos 12 meses
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
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 text-base focus:border-emerald-500/40"
                />
              </div>
              <div>
                <Label className="text-sm text-white/50 mb-2 block">Ticket médio (R$)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 5000"
                  value={ticket}
                  onChange={(e) => { setTicket(e.target.value); setShowResult(false); }}
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 text-base focus:border-emerald-500/40"
                />
              </div>
              <div>
                <Label className="text-sm text-white/50 mb-2 block">Taxa de conversão (%)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 12"
                  value={convRate}
                  onChange={(e) => { setConvRate(e.target.value); setShowResult(false); }}
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 text-base focus:border-emerald-500/40"
                />
              </div>
            </div>

            <Button
              className="w-full h-13 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold border-0 shadow-lg shadow-emerald-500/20"
              onClick={() => setShowResult(true)}
              disabled={!result}
            >
              <Rocket className="w-4 h-4 mr-2" /> Simular crescimento
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
                  <div className="mt-8 space-y-6">
                    {/* Chart */}
                    <div className="h-72 sm:h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={result.data}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis
                            dataKey="month"
                            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={formatAxisValue}
                            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1a1a2e",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "8px",
                              color: "white",
                              fontSize: "12px",
                            }}
                            formatter={(value: number) => formatCurrency(value)}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}
                          />
                          <Line
                            type="monotone"
                            dataKey="semCRM"
                            name="Sem ENTUR OS"
                            stroke="#ef4444"
                            strokeWidth={2}
                            dot={false}
                            strokeDasharray="5 5"
                          />
                          <Line
                            type="monotone"
                            dataKey="comCRM"
                            name="Com ENTUR OS"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Results */}
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                        <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Faturamento anual atual</p>
                        <p className="text-xl font-bold text-white/60">{formatCurrency(result.totalWithout)}</p>
                      </div>
                      <div className="bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl p-4 text-center">
                        <p className="text-xs text-emerald-300/70 uppercase tracking-wider mb-1">Faturamento com ENTUR OS</p>
                        <p className="text-xl font-bold text-emerald-400">{formatCurrency(result.totalWith)}</p>
                      </div>
                      <div className="bg-violet-500/[0.06] border border-violet-500/15 rounded-xl p-4 text-center">
                        <p className="text-xs text-violet-300/70 uppercase tracking-wider mb-1">Diferença em 12 meses</p>
                        <p className="text-xl font-bold text-violet-400">+{formatCurrency(result.difference)}</p>
                      </div>
                    </div>

                    <div className="text-center p-4 bg-gradient-to-r from-emerald-500/[0.06] to-violet-500/[0.06] border border-emerald-500/10 rounded-xl">
                      <p className="text-white/70 text-sm mb-1">
                        Com processo comercial estruturado, sua agência poderia gerar
                      </p>
                      <p className="text-2xl font-bold text-emerald-400 mb-3">
                        {formatCurrency(result.difference)} a mais em 12 meses
                      </p>
                      <Button
                        className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-violet-500/20"
                        onClick={onCTA}
                      >
                        Quero estruturar minhas vendas <ArrowRight className="w-4 h-4 ml-2" />
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
