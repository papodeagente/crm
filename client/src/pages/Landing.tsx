import { useLocation } from "wouter";
import { HeroSection } from "@/components/landing/HeroSection";
import { EnemySection } from "@/components/landing/EnemySection";
import { RevelationSection } from "@/components/landing/RevelationSection";
import { SolutionSection } from "@/components/landing/SolutionSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SocialProof } from "@/components/landing/SocialProof";
import { DifferentiatorSection } from "@/components/landing/DifferentiatorSection";
import { DemoSection } from "@/components/landing/DemoSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { SectionCTA } from "@/components/landing/SectionCTA";
import { StickyCTA } from "@/components/landing/StickyCTA";
import { SalesSimulator } from "@/components/landing/SalesSimulator";

export default function Landing() {
  const [, navigate] = useLocation();

  const scrollToPlanos = () => {
    document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" });
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
      <HeroSection onCTA={scrollToPlanos} onDemo={scrollToDemo} />

      {/* Simulador simples */}
      <SalesSimulator onCTA={scrollToPlanos} />

      {/* CTA between sections */}
      <SectionCTA text="Quero organizar minhas vendas" onClick={scrollToPlanos} variant="secondary" />

      {/* 2. Seção do Inimigo */}
      <EnemySection />

      {/* 3. Seção de Revelação */}
      <RevelationSection />

      {/* CTA between sections */}
      <SectionCTA text="Quero ver como funciona o ENTUR OS" onClick={scrollToPlanos} />

      {/* 4. Introdução da Solução */}
      <SolutionSection />

      {/* 5. Como Funciona */}
      <HowItWorks />

      {/* CTA between sections */}
      <SectionCTA text="Quero estruturar meu processo comercial" onClick={scrollToPlanos} variant="secondary" />

      {/* 6. Prova Social */}
      <SocialProof />

      {/* 7. Diferencial */}
      <DifferentiatorSection />

      {/* CTA between sections */}
      <SectionCTA text="Quero um sistema feito para turismo" onClick={scrollToPlanos} />

      {/* 8. Demonstração */}
      <DemoSection />

      {/* 9. Planos e Preços */}
      <PricingSection onSelectPlan={goToRegister} />

      {/* Sticky CTA Mobile */}
      <StickyCTA onClick={scrollToPlanos} />
    </div>
  );
}
