import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { FadeIn } from "./FadeIn";

interface SectionCTAProps {
  text: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

export function SectionCTA({ text, onClick, variant = "primary" }: SectionCTAProps) {
  if (variant === "secondary") {
    return (
      <FadeIn delay={0.2}>
        <div className="text-center py-12">
          <Button
            size="lg"
            variant="outline"
            className="h-13 px-8 text-base border-violet-500/30 text-violet-300 hover:bg-violet-500/10 hover:text-violet-200 bg-transparent"
            onClick={onClick}
          >
            {text} <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn delay={0.2}>
      <div className="text-center py-12">
        <Button
          size="lg"
          className="h-14 px-10 text-base bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0 shadow-xl shadow-violet-500/20 transition-all duration-300 hover:shadow-violet-500/30 hover:scale-[1.02]"
          onClick={onClick}
        >
          {text} <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </FadeIn>
  );
}
