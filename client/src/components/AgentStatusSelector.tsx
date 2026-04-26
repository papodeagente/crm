import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Circle } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "auto", label: "Automático", color: "text-gray-400", dot: "bg-gray-400" },
  { value: "available", label: "Disponível", color: "text-green-600", dot: "bg-green-500" },
  { value: "away", label: "Ausente", color: "text-yellow-600", dot: "bg-yellow-500" },
  { value: "busy", label: "Ocupado", color: "text-red-600", dot: "bg-red-500" },
  { value: "offline", label: "Offline", color: "text-gray-500", dot: "bg-gray-400" },
] as const;

export function AgentStatusSelector({ sessionId }: { sessionId?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const availQ = trpc.whatsapp.supervision.getMyAvailability.useQuery(undefined, {
    enabled: !!sessionId,
  });
  const setMut = trpc.whatsapp.supervision.setAvailability.useMutation({
    onSuccess: () => availQ.refetch(),
  });

  const current = availQ.data?.availabilityStatus || "auto";
  const currentOpt = STATUS_OPTIONS.find(o => o.value === current) || STATUS_OPTIONS[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted transition-colors text-[12px]"
        title="Status de disponibilidade"
      >
        <span className={`w-2 h-2 rounded-full ${currentOpt.dot}`} />
        <span className={`${currentOpt.color} font-medium`}>{currentOpt.label}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[140px]">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                setMut.mutate({ status: opt.value });
                setOpen(false);
              }}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-[12px] hover:bg-muted transition-colors ${
                opt.value === current ? "bg-muted/50 font-semibold" : ""
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
              <span className={opt.color}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
