import { useLocation } from "wouter";
import { HeroSection } from "@/components/landing/HeroSection";
import { DiagnosticQuiz } from "@/components/landing/DiagnosticQuiz";
import { EnemySection } from "@/components/landing/EnemySection";
import { RevelationSection } from "@/components/landing/RevelationSection";
import { SolutionSection } from "@/components/landing/SolutionSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { MoneyCalculator } from "@/components/landing/MoneyCalculator";
import { FunnelMap } from "@/components/landing/FunnelMap";
import { BenchmarkSection } from "@/components/landing/BenchmarkSection";
import { GrowthSimulator } from "@/components/landing/GrowthSimulator";
import { ReportForm } from "@/components/landing/ReportForm";
import { AuditScore } from "@/components/landing/AuditScore";
import { SocialProof } from "@/components/landing/SocialProof";
import { DifferentiatorSection } from "@/components/landing/DifferentiatorSection";
import { DemoSection } from "@/components/landing/DemoSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { SectionCTA } from "@/components/landing/SectionCTA";
import { StickyCTA } from "@/components/landing/StickyCTA";
import { SalesSimulator } from "@/components/landing/SalesSimulator";

export default function Landing() {
  const [, navigate] = useLocation();

  const scrollToReport = () => {
    document.getElementById("report-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const goToRegister = () => {
    navigate("/register");
  };

  const scrollToDemo = () => {
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white overflow-x-hidden">
      {/* 1. Hero */}
      <HeroSection onCTA={scrollToReport} onDemo={scrollToDemo} />

      {/* Simulador simples */}
      <SalesSimulator onCTA={scrollToReport} />

      {/* 2. Diagnóstico Interativo (Quiz) */}
      <DiagnosticQuiz onCTA={scrollToReport} />

      {/* CTA between sections */}
      <SectionCTA text="Quero organizar minhas vendas" onClick={scrollToReport} variant="secondary" />

      {/* 3. Seção do Inimigo */}
      <EnemySection />

      {/* 4. Seção de Revelação */}
      <RevelationSection />

      {/* CTA between sections */}
      <SectionCTA text="Quero ver como funciona o ENTUR OS" onClick={scrollToReport} />

      {/* 5. Introdução da Solução */}
      <SolutionSection />

      {/* 6. Como Funciona */}
      <HowItWorks />

      {/* CTA between sections */}
      <SectionCTA text="Quero estruturar meu processo comercial" onClick={scrollToReport} variant="secondary" />

      {/* 7. Calculadora de Dinheiro Perdido */}
      <MoneyCalculator onCTA={scrollToReport} />

      {/* 8. Mapa de Vazamento de Vendas */}
      <FunnelMap />

      {/* CTA between sections */}
      <SectionCTA text="Quero parar de perder vendas" onClick={scrollToReport} />

      {/* 9. Benchmark Agência vs Mercado */}
      <BenchmarkSection onCTA={scrollToReport} />

      {/* 10. Simulador de Crescimento 12 Meses */}
      <GrowthSimulator onCTA={scrollToReport} />

      {/* CTA between sections */}
      <SectionCTA text="Quero crescer com processo estruturado" onClick={scrollToReport} variant="secondary" />

      {/* 11. Relatório Automático (Lead Capture) */}
      <ReportForm />

      {/* 12. Modo Auditoria (Score) */}
      <AuditScore onCTA={scrollToReport} />

      {/* CTA between sections */}
      <SectionCTA text="Quero melhorar minha agência" onClick={scrollToReport} />

      {/* 13. Prova Social */}
      <SocialProof />

      {/* 14. Diferencial */}
      <DifferentiatorSection />

      {/* CTA between sections */}
      <SectionCTA text="Quero um sistema feito para turismo" onClick={scrollToReport} variant="secondary" />

      {/* 15. Demonstração */}
      <DemoSection />

      {/* 16. CTA Final */}
      <FinalCTA onCTA={goToRegister} />

      {/* Sticky CTA Mobile */}
      <StickyCTA onClick={scrollToReport} />
    </div>
  );
}
