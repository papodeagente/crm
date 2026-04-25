import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

interface StickyCTAProps {
  onClick: () => void;
}

export function StickyCTA({ onClick }: StickyCTAProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 600);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#06140F]/95 backdrop-blur-xl border-t border-white/[0.08] p-3 safe-area-bottom">
      <Button
        className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold text-sm border-0 shadow-lg shadow-violet-500/25 rounded-xl"
        onClick={onClick}
      >
        Testar grátis <ArrowRight className="w-4 h-4 ml-1.5" />
      </Button>
    </div>
  );
}
