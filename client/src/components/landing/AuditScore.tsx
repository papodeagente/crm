import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "./FadeIn";
import { Shield, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const AUDIT_QUESTIONS = [
  { question: "Você usa um sistema para organizar negociações?", weight: 25 },
  { question: "Você faz follow-up estruturado?", weight: 25 },
  { question: "Você acompanha todas as propostas enviadas?", weight: 20 },
  { question: "Você mede taxa de conversão do negócio?", weight: 15 },
  { question: "Você possui processo de vendas definido?", weight: 15 },
];

const CLASSIFICATIONS = [
  { min: 0, max: 30, label: "Negócio desorganizado", color: "text-red-400", bgColor: "bg-red-500", description: "Seu negócio precisa urgentemente de um processo comercial estruturado." },
  { min: 31, max: 60, label: "Processo comercial inconsistente", color: "text-amber-400", bgColor: "bg-amber-500", description: "Você tem alguns processos, mas falta consistência e acompanhamento." },
  { min: 61, max: 80, label: "Processo estruturado", color: "text-blue-400", bgColor: "bg-blue-500", description: "Boa base! O Clinilucro pode potencializar seus resultados." },
  { min: 81, max: 100, label: "Alta maturidade comercial", color: "text-emerald-400", bgColor: "bg-emerald-500", description: "Excelente! O Clinilucro ajudará a escalar e manter essa performance." },
];

interface AuditScoreProps {
  onCTA: () => void;
}

export function AuditScore({ onCTA }: AuditScoreProps) {
  const [answers, setAnswers] = useState<Record<number, "sim" | "parcial" | "nao">>({});
  const [showResult, setShowResult] = useState(false);

  const score = useMemo(() => {
    let total = 0;
    AUDIT_QUESTIONS.forEach((q, i) => {
      const answer = answers[i];
      if (answer === "sim") total += q.weight;
      else if (answer === "parcial") total += q.weight * 0.5;
    });
    return Math.round(total);
  }, [answers]);

  const classification = CLASSIFICATIONS.find((c) => score >= c.min && score <= c.max) || CLASSIFICATIONS[0];
  const allAnswered = Object.keys(answers).length === AUDIT_QUESTIONS.length;

  // Gauge angle: 0 = -135deg, 100 = 135deg (270 degree arc)
  const gaugeAngle = -135 + (score / 100) * 270;

  return (
    <section className="py-20 sm:py-28 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-600/8 to-transparent rounded-full blur-[120px]" />
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/15 mb-5">
              <Shield className="w-7 h-7 text-indigo-400" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
              Auditoria Comercial do Negócio
            </h2>
            <p className="text-lg text-white/40">
              Descubra seu score de maturidade comercial de 0 a 100
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="space-y-4 mb-6">
              {AUDIT_QUESTIONS.map((q, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <p className="text-sm text-white/70 mb-3">{q.question}</p>
                  <div className="flex gap-2">
                    {(["sim", "parcial", "nao"] as const).map((opt) => {
                      const isSelected = answers[i] === opt;
                      const labels = { sim: "Sim", parcial: "Parcialmente", nao: "Não" };
                      const colors = {
                        sim: isSelected ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "",
                        parcial: isSelected ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "",
                        nao: isSelected ? "bg-red-500/20 border-red-500/40 text-red-300" : "",
                      };
                      return (
                        <button
                          key={opt}
                          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all duration-200 ${
                            isSelected
                              ? colors[opt]
                              : "border-white/[0.08] text-white/40 hover:border-white/[0.15] hover:text-white/60"
                          }`}
                          onClick={() => {
                            setAnswers((prev) => ({ ...prev, [i]: opt }));
                            setShowResult(false);
                          }}
                        >
                          {labels[opt]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <Button
              className="w-full h-13 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold border-0 shadow-lg shadow-indigo-500/20"
              onClick={() => setShowResult(true)}
              disabled={!allAnswered}
            >
              <Shield className="w-4 h-4 mr-2" /> Calcular meu score
            </Button>

            <AnimatePresence>
              {showResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.5 }}
                  className="overflow-hidden"
                >
                  <div className="mt-8 text-center">
                    {/* Gauge */}
                    <div className="relative w-48 h-28 mx-auto mb-6">
                      <svg viewBox="0 0 200 120" className="w-full h-full">
                        {/* Background arc */}
                        <path
                          d="M 20 100 A 80 80 0 0 1 180 100"
                          fill="none"
                          stroke="rgba(255,255,255,0.06)"
                          strokeWidth="12"
                          strokeLinecap="round"
                        />
                        {/* Colored arc */}
                        <path
                          d="M 20 100 A 80 80 0 0 1 180 100"
                          fill="none"
                          stroke="url(#gaugeGradient)"
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={`${(score / 100) * 251.2} 251.2`}
                        />
                        <defs>
                          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="33%" stopColor="#f59e0b" />
                            <stop offset="66%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#10b981" />
                          </linearGradient>
                        </defs>
                        {/* Needle */}
                        <line
                          x1="100"
                          y1="100"
                          x2="100"
                          y2="35"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          transform={`rotate(${gaugeAngle} 100 100)`}
                        />
                        <circle cx="100" cy="100" r="5" fill="white" />
                      </svg>
                    </div>

                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <p className="text-5xl font-bold text-white mb-2">{score}</p>
                      <p className={`text-lg font-semibold ${classification.color} mb-1`}>
                        {classification.label}
                      </p>
                      <p className="text-sm text-white/40 mb-6 max-w-sm mx-auto">
                        {classification.description}
                      </p>
                    </motion.div>

                    <Button
                      className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-violet-500/20"
                      onClick={onCTA}
                    >
                      Quero melhorar meu score comercial <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
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
