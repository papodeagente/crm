/**
 * SignaturePad — canvas simples para captura de assinatura.
 *
 * - Mouse e touch (mobile)
 * - Smooth drawing com quadraticCurveTo
 * - Botão "Limpar"
 * - Exporta PNG via dataURL
 *
 * Sem dependência externa.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Eraser } from "lucide-react";

interface Props {
  /** PNG data URL atual. Quando null, canvas começa vazio. */
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  primaryColor?: string;
  height?: number;
}

export default function SignaturePad({ value, onChange, primaryColor = "#0A0A0A", height = 140 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(!!value);

  // Resize canvas to container width on mount + resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const setSize = () => {
      const w = container.clientWidth;
      const h = height;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = primaryColor;
      // Restaurar valor anterior se houver
      if (value) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, w, h);
        img.src = value;
      }
    };
    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(container);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, primaryColor]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleStart(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    drawingRef.current = true;
    lastPointRef.current = getPos(e);
    canvasRef.current!.setPointerCapture(e.pointerId);
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    const last = lastPointRef.current!;
    const mid = { x: (last.x + pos.x) / 2, y: (last.y + pos.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
    ctx.stroke();
    lastPointRef.current = pos;
  }

  const persist = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    onChange(url);
    setHasDrawn(true);
  }, [onChange]);

  function handleEnd(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    try { canvasRef.current!.releasePointerCapture(e.pointerId); } catch {}
    persist();
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    onChange(null);
    setHasDrawn(false);
  }

  return (
    <div className="space-y-1.5">
      <div
        ref={containerRef}
        className="relative rounded-md border border-dashed bg-slate-50 dark:bg-slate-900 select-none touch-none"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handleStart}
          onPointerMove={handleMove}
          onPointerUp={handleEnd}
          onPointerCancel={handleEnd}
          className="cursor-crosshair block"
        />
        {!hasDrawn && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted-foreground/50 text-xs">
            Assine aqui (use o mouse, dedo ou caneta)
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Sua assinatura é registrada como imagem (PNG).</span>
        {hasDrawn && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Eraser className="h-3 w-3" /> Limpar
          </button>
        )}
      </div>
    </div>
  );
}
