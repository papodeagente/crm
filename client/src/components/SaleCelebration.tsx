import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PartyPopper } from "lucide-react";

const YABBA_AUDIO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663249817763/EKvcVicuVoUxTnzjSKzgdk/yabba-dabba-doo_a257ba33.mp3";

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  scale: number;
  speedX: number;
  speedY: number;
  rotationSpeed: number;
  shape: "square" | "circle" | "triangle";
}

const COLORS = [
  "#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE",
  "#FF9FF3", "#54A0FF", "#5F27CD", "#01A3A4", "#F368E0",
];

function ConfettiCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const piecesRef = useRef<ConfettiPiece[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!active || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Create confetti pieces
    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < 150; i++) {
      pieces.push({
        id: i,
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 400,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        scale: 0.5 + Math.random() * 1,
        speedX: -2 + Math.random() * 4,
        speedY: 2 + Math.random() * 5,
        rotationSpeed: -5 + Math.random() * 10,
        shape: (["square", "circle", "triangle"] as const)[Math.floor(Math.random() * 3)],
      });
    }
    piecesRef.current = pieces;

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let allDone = true;
      for (const p of piecesRef.current) {
        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;
        p.speedY += 0.05; // gravity

        if (p.y < canvas.height + 50) allDone = false;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.scale(p.scale, p.scale);
        ctx.fillStyle = p.color;

        if (p.shape === "square") {
          ctx.fillRect(-5, -5, 10, 10);
        } else if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(5, 5);
          ctx.lineTo(-5, 5);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      if (!allDone) {
        animRef.current = requestAnimationFrame(animate);
      }
    }

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9999 }}
    />
  );
}

interface SaleCelebrationProps {
  open: boolean;
  onClose: () => void;
  dealTitle?: string;
  dealValue?: string;
}

export default function SaleCelebration({ open, onClose, dealTitle, dealValue }: SaleCelebrationProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (open) {
      setShowConfetti(true);
      // Play audio
      try {
        const audio = new Audio(YABBA_AUDIO_URL);
        audio.volume = 0.7;
        audio.play().catch(() => {});
        audioRef.current = audio;
      } catch {}

      // Stop confetti after 5 seconds
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => {
        clearTimeout(timer);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      };
    } else {
      setShowConfetti(false);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setShowConfetti(false);
    onClose();
  }, [onClose]);

  return (
    <>
      <ConfettiCanvas active={showConfetti} />
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent
          className="sm:max-w-md border-0 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/80 dark:via-yellow-950/80 dark:to-orange-950/80 shadow-2xl"
          style={{ zIndex: 9998 }}
        >
          <div className="flex flex-col items-center text-center py-6 gap-5">
            {/* Animated celebration icon */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg animate-bounce">
                <PartyPopper className="w-12 h-12 text-white" />
              </div>
              {/* Sparkle effects */}
              <div className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-ping">✨</div>
              <div className="absolute -bottom-1 -left-3 w-5 h-5 text-orange-400 animate-ping" style={{ animationDelay: "0.3s" }}>🎉</div>
              <div className="absolute top-0 -left-4 w-5 h-5 text-yellow-500 animate-ping" style={{ animationDelay: "0.6s" }}>⭐</div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-600 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
                YABBA-DABBA-DOO!
              </h2>
              <p className="text-lg font-semibold text-foreground/80">
                Venda fechada com sucesso!
              </p>
            </div>

            {/* Deal info */}
            {(dealTitle || dealValue) && (
              <div className="bg-white/60 dark:bg-white/10 rounded-2xl px-6 py-4 space-y-1 w-full max-w-xs">
                {dealTitle && (
                  <p className="text-sm font-medium text-muted-foreground">Negociação</p>
                )}
                {dealTitle && (
                  <p className="text-base font-bold text-foreground">{dealTitle}</p>
                )}
                {dealValue && (
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                    {dealValue}
                  </p>
                )}
              </div>
            )}

            {/* Motivational text */}
            <p className="text-sm text-muted-foreground max-w-xs">
              Parabéns! Mais uma venda conquistada. Continue assim! 🚀
            </p>

            {/* Close button */}
            <Button
              onClick={handleClose}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold px-8 py-2 rounded-xl shadow-lg"
            >
              Fechar e continuar vendendo!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
