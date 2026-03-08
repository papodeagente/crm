import { useLocation } from "wouter";
import { HeroSection } from "@/components/landing/HeroSection";
import { EnemySection } from "@/components/landing/EnemySection";
import { RevelationSection } from "@/components/landing/RevelationSection";
import { SolutionSection } from "@/components/landing/SolutionSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ReportForm } from "@/components/landing/ReportForm";
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

      {/* CTA between sections */}
      <SectionCTA text="Quero organizar minhas vendas" onClick={scrollToReport} variant="secondary" />

      {/* 2. Seção do Inimigo */}
      <EnemySection />

      {/* 3. Seção de Revelação */}
      <RevelationSection />

      {/* CTA between sections */}
      <SectionCTA text="Quero ver como funciona o ENTUR OS" onClick={scrollToReport} />

      {/* 4. Introdução da Solução */}
      <SolutionSection />

      {/* 5. Como Funciona */}
      <HowItWorks />

      {/* CTA between sections */}
      <SectionCTA text="Quero estruturar meu processo comercial" onClick={scrollToReport} variant="secondary" />

      {/* 6. Relatório Automático (Lead Capture) */}
      <ReportForm />

      {/* CTA between sections */}
      <SectionCTA text="Quero melhorar minha agência" onClick={scrollToReport} />

      {/* 7. Prova Social */}
      <SocialProof />

      {/* 8. Diferencial */}
      <DifferentiatorSection />

      {/* CTA between sections */}
      <SectionCTA text="Quero um sistema feito para turismo" onClick={scrollToReport} variant="secondary" />

      {/* 9. Demonstração */}
      <DemoSection />

      {/* 10. CTA Final */}
      <FinalCTA onCTA={goToRegister} />

      {/* Sticky CTA Mobile */}
      <StickyCTA onClick={scrollToReport} />
    </div>
  );
}
