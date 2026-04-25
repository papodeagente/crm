import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FadeIn } from "./FadeIn";
import { ArrowRight, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SalesSimulatorProps {
  onCTA: () => void;
}

export function SalesSimulator({ onCTA }: SalesSimulatorProps) {
  const [atendimentos, setAtendimentos] = useState("");
  const [result, setResult] = useState<{
    vendasMensais: number;
    leadsNaoConvertidos: number;
    leadsRecuperaveis: number;
    faturamentoMensal: number;
    faturamentoAnual: number;
  } | null>(null);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  const handleSimulate = () => {
    const a = parseInt(atendimentos) || 0;
    if (a <= 0) return;

    const taxaFechamento = 0.15;
    const ticketMedio = 3500;

    const vendasMensais = Math.round(a * taxaFechamento);
    const leadsNaoConvertidos = a - vendasMensais;
    const leadsRecuperaveis = Math.round(leadsNaoConvertidos * 0.10);
    const faturamentoMensal = leadsRecuperaveis * ticketMedio;
    const faturamentoAnual = faturamentoMensal * 12;

    setResult({ vendasMensais, leadsNaoConvertidos, leadsRecuperaveis, faturamentoMensal, faturamentoAnual });
  };

  return (
    <section className="py-16 sm:py-20 px-5 sm:px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[400px] bg-gradient-to-bl from-violet-600/6 to-transparent rounded-full blur-[100px]" />
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        <FadeIn>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/15 mb-4">
                <TrendingUp className="w-6 h-6 text-violet-400" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
                Quantos atendimentos seu negócio faz por mês?
              </h3>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-2">
              <Input
                type="number"
                placeholder="Ex: 80"
                value={atendimentos}
                onChange={(e) => { setAtendimentos(e.target.value); setResult(null); }}
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 text-base focus:border-violet-500/40 flex-1"
              />
              <Button
                className="h-12 px-6 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold border-0 shadow-lg shadow-violet-500/20 whitespace-nowrap"
                onClick={handleSimulate}
                disabled={!atendimentos || parseInt(atendimentos) <= 0}
              >
                Simular recuperação de vendas
              </Button>
            </div>

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.5 }}
                  className="overflow-hidden"
                >
                  <div className="mt-6 space-y-5">
                    {/* Resultado dinâmico */}
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                      <p className="text-sm text-white/50 leading-relaxed">
                        Se seu negócio atende <span className="text-white font-semibold">{atendimentos} clientes</span> por mês
                        e fecha cerca de <span className="text-white font-semibold">15% das vendas</span>,
                        isso significa que <span className="text-amber-400 font-semibold">{result.leadsNaoConvertidos} clientes não compraram</span>.
                      </p>
                      <p className="text-sm text-white/50 leading-relaxed mt-3">
                        Se apenas <span className="text-white font-semibold">10% desses clientes</span> voltarem a negociar,
                        seu negócio pode gerar:
                      </p>

                      <div className="grid sm:grid-cols-2 gap-3 mt-4">
                        <div className="bg-emerald-500/[0.08] border border-emerald-500/15 rounded-lg p-4 text-center">
                          <p className="text-xs text-emerald-300/70 uppercase tracking-wider mb-1">Por mês</p>
                          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(result.faturamentoMensal)}</p>
                        </div>
                        <div className="bg-emerald-500/[0.08] border border-emerald-500/15 rounded-lg p-4 text-center">
                          <p className="text-xs text-emerald-300/70 uppercase tracking-wider mb-1">Por ano</p>
                          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(result.faturamentoAnual)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Conexão com Clinilucro */}
                    <div className="bg-violet-500/[0.05] border border-violet-500/15 rounded-xl p-5">
                      <p className="text-sm text-white/60 leading-relaxed">
                        <span className="text-white font-medium">Essas vendas não estão perdidas.</span>{" "}
                        Elas apenas ficaram esquecidas na sua base de clientes.
                      </p>
                      <p className="text-sm text-white/50 leading-relaxed mt-3">
                        O <span className="text-violet-300 font-semibold">Clinilucro</span> usa a{" "}
                        <span className="text-white/70 font-medium">Matriz RFV</span> (Recência, Frequência e Valor)
                        para identificar automaticamente quais clientes têm maior
                        probabilidade de comprar novamente.
                      </p>
                      <p className="text-sm text-white/50 leading-relaxed mt-2">
                        Isso permite recuperar oportunidades que normalmente seriam esquecidas.
                      </p>
                    </div>

                    {/* CTA Final */}
                    <div className="text-center pt-1">
                      <p className="text-sm text-white/40 mb-3">
                        Essas vendas já passaram pela seu negócio. Agora você precisa encontrá-las novamente.
                      </p>
                      <Button
                        className="h-12 px-8 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold border-0 shadow-lg shadow-violet-500/20"
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
