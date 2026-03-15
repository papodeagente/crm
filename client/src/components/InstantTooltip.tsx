import { useState, useRef, useCallback, type ReactNode } from "react";

interface InstantTooltipProps {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

/**
 * Instant tooltip that appears immediately on hover (no delay).
 * Auto-adjusts horizontal position to prevent clipping at screen edges.
 */
export default function InstantTooltip({ label, children, side = "bottom", className = "" }: InstantTooltipProps) {
  const [show, setShow] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    setShow(true);
    // After render, check if tooltip is clipped and adjust
    requestAnimationFrame(() => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      const rect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      let adjust = 0;
      if (rect.left < 8) {
        adjust = 8 - rect.left; // push right
      } else if (rect.right > viewportWidth - 8) {
        adjust = (viewportWidth - 8) - rect.right; // push left
      }
      if (adjust !== 0) {
        setOffsetX(adjust);
      }
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShow(false);
    setOffsetX(0);
  }, []);

  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {show && (
        <div
          ref={tooltipRef}
          className={`absolute ${positionClasses[side]} z-[100] pointer-events-none`}
          style={offsetX !== 0 ? { transform: `translateX(calc(-50% + ${offsetX}px))` } : undefined}
        >
          <div className="bg-foreground text-background text-[11px] font-medium px-2.5 py-1 rounded-md whitespace-nowrap shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
            {label}
          </div>
        </div>
      )}
    </div>
  );
}
