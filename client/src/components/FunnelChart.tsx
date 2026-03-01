import { useMemo } from "react";

interface FunnelStage {
  stageId: number;
  stageName: string;
  stageColor: string | null;
  dealCount: number;
  totalValueCents: number;
  isWon: boolean;
  isLost: boolean;
}

interface FunnelChartProps {
  stages: FunnelStage[];
  loading?: boolean;
}

const DEFAULT_COLORS = [
  "#1e1b4b", "#312e81", "#3b82f6", "#06b6d4",
  "#10b981", "#eab308", "#f97316", "#ef4444",
  "#8b5cf6", "#ec4899",
];

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function FunnelChart({ stages, loading }: FunnelChartProps) {
  const funnelData = useMemo(() => {
    if (!stages || stages.length === 0) return [];
    const maxCount = Math.max(...stages.map(s => s.dealCount), 1);
    const firstCount = stages[0]?.dealCount || 1;

    return stages.map((stage, i) => {
      const pct = firstCount > 0 ? Math.round((stage.dealCount / firstCount) * 100) : 0;
      const widthPct = maxCount > 0 ? Math.max((stage.dealCount / maxCount) * 100, 15) : 15;
      const color = stage.stageColor || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      return { ...stage, pct, widthPct, color };
    });
  }, [stages]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="animate-pulse flex items-center gap-3">
            <div className="h-12 rounded-lg bg-muted/60" style={{ width: `${100 - i * 12}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (funnelData.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">Nenhuma etapa de vendas configurada</p>
      </div>
    );
  }

  // SVG-based funnel
  const svgWidth = 400;
  const stageHeight = 52;
  const gap = 3;
  const totalHeight = funnelData.length * (stageHeight + gap) - gap;
  const maxTrapWidth = svgWidth * 0.85;
  const minTrapWidth = svgWidth * 0.18;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${svgWidth} ${totalHeight + 10}`}
        className="w-full"
        style={{ maxHeight: `${Math.min(totalHeight + 10, 420)}px` }}
      >
        {funnelData.map((stage, i) => {
          const y = i * (stageHeight + gap);
          // Each stage narrows progressively
          const topWidth = maxTrapWidth - (i / Math.max(funnelData.length - 1, 1)) * (maxTrapWidth - minTrapWidth);
          const bottomWidth = i < funnelData.length - 1
            ? maxTrapWidth - ((i + 1) / Math.max(funnelData.length - 1, 1)) * (maxTrapWidth - minTrapWidth)
            : minTrapWidth;

          const cx = svgWidth / 2;
          const topLeft = cx - topWidth / 2;
          const topRight = cx + topWidth / 2;
          const bottomLeft = cx - bottomWidth / 2;
          const bottomRight = cx + bottomWidth / 2;

          // Trapezoid path
          const path = `M ${topLeft} ${y} L ${topRight} ${y} L ${bottomRight} ${y + stageHeight} L ${bottomLeft} ${y + stageHeight} Z`;

          return (
            <g key={stage.stageId}>
              {/* Trapezoid shape */}
              <path
                d={path}
                fill={stage.color}
                opacity={0.9}
                rx={4}
                className="transition-all duration-500 hover:opacity-100"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))" }}
              />
              {/* Percentage text centered */}
              <text
                x={cx}
                y={y + stageHeight / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="12"
                fontWeight="700"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
              >
                {stage.pct}%
              </text>
              {/* Stage name on the right */}
              <text
                x={topRight + 8}
                y={y + stageHeight / 2 - 6}
                textAnchor="start"
                dominantBaseline="middle"
                fill="currentColor"
                fontSize="11"
                fontWeight="500"
                className="fill-foreground"
              >
                {stage.stageName}
              </text>
              {/* Deal count + value below name */}
              <text
                x={topRight + 8}
                y={y + stageHeight / 2 + 10}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize="10"
                className="fill-muted-foreground"
              >
                {stage.dealCount} neg. · {formatCurrency(stage.totalValueCents)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
