import { useEffect } from "react";
import { useLocation } from "wouter";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { SolutionSection } from "@/components/landing/SolutionSection";
import { DifferentialsSection } from "@/components/landing/DifferentialsSection";
import { LocalBusinessSection } from "@/components/landing/LocalBusinessSection";
import { ResultsSection } from "@/components/landing/ResultsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { StickyCTA } from "@/components/landing/StickyCTA";

export default function Landing() {
  const [, navigate] = useLocation();

  useEffect(() => {
    document.title = "Clinilucro — CRM para Clínicas";
  }, []);

  const goToRegister = (plan?: string) => {
    navigate(plan ? `/register?plan=${plan}` : "/register");
  };

  return (
    <div className="min-h-screen bg-[#06140F] text-white overflow-x-hidden">
      {/* SEÇÃO 1 — Hero */}
      <HeroSection onRegister={() => goToRegister()} />

      {/* SEÇÃO 2 — O Problema */}
      <ProblemSection />

      {/* SEÇÃO 3 — A Solução */}
      <SolutionSection />

      {/* SEÇÃO 4 — Diferenciais (id=como-funciona) */}
      <DifferentialsSection onRegister={() => goToRegister()} />

      {/* SECAO 5 — Feito para Clínicas */}
      <LocalBusinessSection />

      {/* SEÇÃO 6 — Resultados */}
      <ResultsSection />

      {/* SEÇÃO 7 — Planos (dinâmicos do banco) */}
      <PricingSection onSelectPlan={goToRegister} />

      {/* SEÇÃO 8 — CTA Final + Footer */}
      <FinalCTA onRegister={() => goToRegister()} />

      {/* Sticky CTA Mobile */}
      <StickyCTA onClick={() => goToRegister()} />
    </div>
  );
}
