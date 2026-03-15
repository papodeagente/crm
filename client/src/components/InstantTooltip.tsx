import { useState, useRef, useEffect, type ReactNode } from "react";

interface InstantTooltipProps {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

/**
 * Instant tooltip that appears immediately on hover (no delay).
 * Lightweight alternative to Radix Tooltip for icon buttons.
 */
export default function InstantTooltip({ label, children, side = "bottom", className = "" }: InstantTooltipProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };

  return (
    <div
      ref={ref}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className={`absolute ${positionClasses[side]} z-[100] pointer-events-none`}
        >
          <div className="bg-foreground text-background text-[11px] font-medium px-2.5 py-1 rounded-md whitespace-nowrap shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
            {label}
          </div>
        </div>
      )}
    </div>
  );
}
