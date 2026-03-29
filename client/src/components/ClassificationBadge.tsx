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
  borderClass: string;
  dotClass: string;
  Icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = {
  desconhecido: {
    label: "Desconhecido",
    color: "#94a3b8",
    bgClass: "bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
    borderClass: "border-slate-200 dark:border-slate-700",
    dotClass: "bg-slate-400",
    Icon: HelpCircle,
    description: "Sem classificação definida",
  },
  seguidor: {
    label: "Seguidor",
    color: "#a78bfa",
    bgClass: "bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    borderClass: "border-violet-200 dark:border-violet-700",
    dotClass: "bg-violet-500",
    Icon: Eye,
    description: "Acompanha a marca",
  },
  lead: {
    label: "Lead",
    color: "#3b82f6",
    bgClass: "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    borderClass: "border-blue-200 dark:border-blue-700",
    dotClass: "bg-blue-500",
    Icon: UserPlus,
    description: "Passageiro qualificado em prospecção",
  },
  oportunidade: {
    label: "Oportunidade",
    color: "#f59e0b",
    bgClass: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    borderClass: "border-amber-200 dark:border-amber-700",
    dotClass: "bg-amber-500",
    Icon: Target,
    description: "Em negociação ativa",
  },
  cliente_primeira_compra: {
    label: "1a Compra",
    color: "#22c55e",
    bgClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    borderClass: "border-emerald-200 dark:border-emerald-700",
    dotClass: "bg-emerald-500",
    Icon: ShoppingBag,
    description: "Realizou a primeira compra",
  },
  cliente_ativo: {
    label: "Ativo",
    color: "#10b981",
    bgClass: "bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    borderClass: "border-teal-200 dark:border-teal-700",
    dotClass: "bg-teal-500",
    Icon: CheckCircle,
    description: "Cliente com compra recente",
  },
  cliente_recorrente: {
    label: "Recorrente",
    color: "#0ea5e9",
    bgClass: "bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    borderClass: "border-sky-200 dark:border-sky-700",
    dotClass: "bg-sky-500",
    Icon: Repeat,
    description: "Comprou mais de uma vez",
  },
  ex_cliente: {
    label: "Ex-Cliente",
    color: "#ef4444",
    bgClass: "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    borderClass: "border-red-200 dark:border-red-700",
    dotClass: "bg-red-500",
    Icon: UserX,
    description: "Inativo há mais de 360 dias",
  },
  promotor: {
    label: "Promotor",
    color: "#ec4899",
    bgClass: "bg-pink-50 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
    borderClass: "border-pink-200 dark:border-pink-700",
    dotClass: "bg-pink-500",
    Icon: Megaphone,
    description: "Indicou clientes confirmados",
  },
};

interface ClassificationBadgeProps {
  classification: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  showLabel?: boolean;
  referralWindowActive?: boolean;
  variant?: "badge" | "strip";
}

export default function ClassificationBadge({
  classification,
  size = "sm",
  showIcon = true,
  showLabel = true,
  referralWindowActive = false,
  variant = "badge",
}: ClassificationBadgeProps) {
  const config = CLASSIFICATION_CONFIG[classification as StageClassification] || CLASSIFICATION_CONFIG.desconhecido;
  const { Icon } = config;

  if (variant === "strip") {
    // Full-width strip variant for cards — more visual
    return (
      <div className="space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${config.bgClass} ${config.borderClass}`}>
              <div className={`h-2 w-2 rounded-full shrink-0 ${config.dotClass}`} />
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] font-bold tracking-wide">{config.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs font-medium">{config.description}</p>
          </TooltipContent>
        </Tooltip>
        {referralWindowActive && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 px-2.5 py-1 text-amber-700 dark:text-amber-300">
                <Timer className="h-3 w-3 animate-pulse" />
                <span className="text-[10px] font-bold">Janela de Indicação Ativa</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Período de 90 dias para indicação</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  // Default badge variant
  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-[11px] px-2 py-1",
    lg: "text-[12px] px-2.5 py-1.5",
  };
  const iconSizes = {
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
    lg: "h-3.5 w-3.5",
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 rounded-md font-bold border ${config.bgClass} ${config.borderClass} ${sizeClasses[size]}`}>
            <span className={`rounded-full shrink-0 ${config.dotClass} ${size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2"}`} />
            {showIcon && <Icon className={iconSizes[size]} />}
            {showLabel && config.label}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs font-medium">{config.description}</p>
        </TooltipContent>
      </Tooltip>
      {referralWindowActive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[9px] px-1 py-0.5 font-bold">
              <Timer className="h-2.5 w-2.5 animate-pulse" />
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
