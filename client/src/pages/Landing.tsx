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
      {/* 1. Hero — promessa principal */}
      <HeroSection onCTA={scrollToPlanos} onDemo={scrollToDemo} />

      {/* 2. Simulador de vendas — engajamento imediato */}
      <SalesSimulator onCTA={scrollToPlanos} />

      {/* 3. Bloco de problema — dor real */}
      <EnemySection />

      {/* CTA de transição */}
      <SectionCTA text="Quero parar de perder vendas" onClick={scrollToPlanos} variant="secondary" />

      {/* 4. Revelação — dados e padrão */}
      <RevelationSection />

      {/* 5. Solução — apresentação do ENTUR OS */}
      <SolutionSection />

      {/* CTA de transição */}
      <SectionCTA text="Quero conhecer o ENTUR OS" onClick={scrollToPlanos} />

      {/* 6. Benefícios percebidos */}
      <HowItWorks />

      {/* 7. Diferencial — por que não usar CRM genérico */}
      <DifferentiatorSection />

      {/* CTA de transição */}
      <SectionCTA text="Quero um sistema feito para turismo" onClick={scrollToPlanos} variant="secondary" />

      {/* 8. Prova social — resultados e credibilidade */}
      <SocialProof />

      {/* 9. Demonstração visual */}
      <DemoSection />

      {/* 10. Planos, preços e CTA final */}
      <PricingSection onSelectPlan={goToRegister} />

      {/* Sticky CTA Mobile */}
      <StickyCTA onClick={scrollToPlanos} />
    </div>
  );
}
