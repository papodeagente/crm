import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FadeIn } from "./FadeIn";
import { AlertTriangle, ArrowRight, Stethoscope } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const QUESTIONS = [
  "Envio orçamento e o cliente some",
  "Esqueço de fazer follow-up",
  "Conversas importantes se perdem no WhatsApp",
  "Não sei quantas negociações estão abertas",
  "Sinto que poderia vender mais",
];

interface DiagnosticQuizProps {
  onCTA: () => void;
}

export function DiagnosticQuiz({ onCTA }: DiagnosticQuizProps) {
  const [checked, setChecked] = useState<boolean[]>(new Array(5).fill(false));
  const [showResult, setShowResult] = useState(false);

  const checkedCount = checked.filter(Boolean).length;

  const toggle = (index: number) => {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
    setShowResult(false);
  };

  return (
    <section className="py-20 sm:py-28 px-5 sm:px-8 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/5 to-transparent pointer-events-none" />
      <div className="max-w-2xl mx-auto relative z-10">
        <FadeIn>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/15 mb-5">
              <Stethoscope className="w-7 h-7 text-violet-400" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
              Diagnóstico rápido do seu negócio
            </h2>
            <p className="text-lg text-white/40">
              Quantas dessas situações acontecem na sua rotina?
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="space-y-4 mb-8">
              {QUESTIONS.map((q, i) => (
                <label
                  key={i}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                    checked[i]
                      ? "bg-violet-500/10 border-violet-500/25"
                      : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]"
                  }`}
                >
                  <Checkbox
                    checked={checked[i]}
                    onCheckedChange={() => toggle(i)}
                    className="border-white/20 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                  />
                  <span className={`text-sm sm:text-base ${checked[i] ? "text-white" : "text-white/60"}`}>
                    {q}
                  </span>
                </label>
              ))}
            </div>

            <Button
              className="w-full h-13 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold border-0 shadow-lg shadow-violet-500/20"
              onClick={() => setShowResult(true)}
              disabled={checkedCount === 0}
            >
              Ver diagnóstico
            </Button>

            <AnimatePresence>
              {showResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4 }}
                  className="overflow-hidden"
                >
                  <div className="mt-6 p-5 rounded-xl bg-gradient-to-r from-amber-500/10 to-red-500/10 border border-amber-500/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white mb-1">
                          {checkedCount >= 2
                            ? "Seu negócio tem um vazamento silencioso de vendas."
                            : "Seu negócio pode estar perdendo oportunidades."}
                        </p>
                        <p className="text-sm text-white/50 mb-4">
                          {checkedCount >= 4
                            ? `Você marcou ${checkedCount} de 5 situações. Isso indica uma perda significativa de receita por falta de processo comercial.`
                            : checkedCount >= 2
                            ? `Você marcou ${checkedCount} de 5 situações. Cada uma delas representa vendas que estão escapando do seu negócio.`
                            : `Mesmo ${checkedCount} situação já pode representar milhares de reais perdidos por mês.`}
                        </p>
                        <Button
                          size="sm"
                          className="bg-white/10 hover:bg-white/15 text-white border border-white/10"
                          onClick={onCTA}
                        >
                          Descobrir como resolver <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
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
