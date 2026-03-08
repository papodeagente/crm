import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FadeIn } from "./FadeIn";
import { BarChart3, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BenchmarkSectionProps {
  onCTA: () => void;
}

const BENCHMARKS = [
  { label: "Conversão baixa", value: 8, color: "bg-red-500", textColor: "text-red-400" },
  { label: "Média do mercado", value: 15, color: "bg-amber-500", textColor: "text-amber-400" },
  { label: "Agência estruturada", value: 25, color: "bg-emerald-500", textColor: "text-emerald-400" },
];

export function BenchmarkSection({ onCTA }: BenchmarkSectionProps) {
  const [userRate, setUserRate] = useState("");
  const [showResult, setShowResult] = useState(false);

  const parsedRate = parseFloat(userRate) || 0;

  const classification = useMemo(() => {
    if (parsedRate <= 0) return null;
    if (parsedRate <= 10) return { label: "Abaixo do mercado", color: "text-red-400", message: "Sua agência está convertendo abaixo da média. Com processo estruturado, você pode triplicar essa taxa." };
    if (parsedRate <= 18) return { label: "Na média do mercado", color: "text-amber-400", message: "Sua agência está na média, mas há espaço significativo para crescimento com processos melhores." };
    return { label: "Acima da média", color: "text-emerald-400", message: "Boa performance! Um CRM pode ajudar a manter e escalar esses resultados." };
  }, [parsedRate]);

  return (
    <section className="py-20 sm:py-28 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-bl from-blue-600/8 to-transparent rounded-full blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/15 mb-5">
              <BarChart3 className="w-7 h-7 text-blue-400" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
              Como sua agência se compara ao mercado
            </h2>
            <p className="text-lg text-white/40">
              Informe sua taxa de conversão atual e veja onde você está
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="max-w-xs mx-auto mb-6">
              <Label className="text-sm text-white/50 mb-2 block text-center">Sua taxa de conversão atual (%)</Label>
              <Input
                type="number"
                placeholder="Ex: 12"
                value={userRate}
                onChange={(e) => { setUserRate(e.target.value); setShowResult(false); }}
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 text-base text-center focus:border-blue-500/40"
              />
            </div>

            <Button
              className="w-full h-13 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold border-0 shadow-lg shadow-blue-500/20"
              onClick={() => setShowResult(true)}
              disabled={parsedRate <= 0}
            >
              <BarChart3 className="w-4 h-4 mr-2" /> Comparar com o mercado
            </Button>

            <AnimatePresence>
              {showResult && classification && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.5 }}
                  className="overflow-hidden"
                >
                  <div className="mt-8 space-y-6">
                    {/* Bar chart */}
                    <div className="space-y-4">
                      {/* User bar */}
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                      >
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="text-sm text-white/70 w-40">Sua agência</span>
                          <span className="text-sm font-bold text-violet-400">{parsedRate}%</span>
                        </div>
                        <div className="w-full bg-white/[0.04] rounded-lg h-8 overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((parsedRate / 30) * 100, 100)}%` }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                          />
                        </div>
                      </motion.div>

                      {BENCHMARKS.map((b, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + i * 0.1 }}
                        >
                          <div className="flex items-center gap-3 mb-1.5">
                            <span className="text-sm text-white/50 w-40">{b.label}</span>
                            <span className={`text-sm font-bold ${b.textColor}`}>{b.value}%</span>
                          </div>
                          <div className="w-full bg-white/[0.04] rounded-lg h-8 overflow-hidden">
                            <motion.div
                              className={`h-full ${b.color} rounded-lg opacity-60`}
                              initial={{ width: 0 }}
                              animate={{ width: `${(b.value / 30) * 100}%` }}
                              transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
                            />
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Classification */}
                    <div className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                      <p className={`font-semibold ${classification.color} mb-1`}>{classification.label}</p>
                      <p className="text-sm text-white/40">{classification.message}</p>
                    </div>

                    <p className="text-center text-sm text-white/50">
                      Agências com processo estruturado convertem até <span className="text-white font-semibold">3x mais</span>.
                    </p>

                    <div className="text-center">
                      <Button
                        className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-violet-500/20"
                        onClick={onCTA}
                      >
                        Quero melhorar minha conversão <ArrowRight className="w-4 h-4 ml-2" />
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
