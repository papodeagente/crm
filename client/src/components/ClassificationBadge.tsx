import {
  HelpCircle, Eye, UserPlus, Target, ShoppingBag,
  CheckCircle, Repeat, UserX, Megaphone, Timer,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export type StageClassification =
  | "desconhecido"
  | "seguidor"
  | "lead"
  | "oportunidade"
  | "cliente_primeira_compra"
  | "cliente_ativo"
  | "cliente_recorrente"
  | "ex_cliente"
  | "promotor";

const CLASSIFICATION_CONFIG: Record<StageClassification, {
  label: string;
  color: string;
  bgClass: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  desconhecido: { label: "Desconhecido", color: "#94a3b8", bgClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", Icon: HelpCircle },
  seguidor: { label: "Seguidor", color: "#a78bfa", bgClass: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300", Icon: Eye },
  lead: { label: "Lead", color: "#3b82f6", bgClass: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", Icon: UserPlus },
  oportunidade: { label: "Oportunidade", color: "#f59e0b", bgClass: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300", Icon: Target },
  cliente_primeira_compra: { label: "1a Compra", color: "#22c55e", bgClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300", Icon: ShoppingBag },
  cliente_ativo: { label: "Ativo", color: "#10b981", bgClass: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300", Icon: CheckCircle },
  cliente_recorrente: { label: "Recorrente", color: "#0ea5e9", bgClass: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300", Icon: Repeat },
  ex_cliente: { label: "Ex-Cliente", color: "#ef4444", bgClass: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", Icon: UserX },
  promotor: { label: "Promotor", color: "#ec4899", bgClass: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300", Icon: Megaphone },
};

interface ClassificationBadgeProps {
  classification: string;
  size?: "sm" | "md";
  showIcon?: boolean;
  showLabel?: boolean;
  referralWindowActive?: boolean;
}

export default function ClassificationBadge({
  classification,
  size = "sm",
  showIcon = true,
  showLabel = true,
  referralWindowActive = false,
}: ClassificationBadgeProps) {
  const config = CLASSIFICATION_CONFIG[classification as StageClassification] || CLASSIFICATION_CONFIG.desconhecido;
  const { Icon } = config;
  const isSm = size === "sm";

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 rounded-md font-semibold ${config.bgClass} ${isSm ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-1"}`}>
            {showIcon && <Icon className={isSm ? "h-2.5 w-2.5" : "h-3 w-3"} />}
            {showLabel && config.label}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Classificação: {config.label}</p>
        </TooltipContent>
      </Tooltip>
      {referralWindowActive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[9px] px-1 py-0.5 font-semibold">
              <Timer className="h-2.5 w-2.5" />
              Indicação
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Janela de Indicação Ativa (90 dias)</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export { CLASSIFICATION_CONFIG };
