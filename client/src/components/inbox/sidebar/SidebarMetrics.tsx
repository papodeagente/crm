/**
 * SidebarMetrics — Mini metric cards (deals, revenue, won, last purchase)
 */
import { Briefcase, DollarSign, TrendingUp, Calendar } from "lucide-react";
import { trpc } from "@/lib/trpc";

const fmt$ = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export default function SidebarMetrics({ contactId }: { contactId: number }) {
  const metricsQ = trpc.contactProfile.getMetrics.useQuery(
    { contactId },
    { enabled: !!contactId, staleTime: 120_000 }
  );

  const m = (metricsQ.data || { totalDeals: 0, wonDeals: 0, totalSpentCents: 0, daysSinceLastPurchase: null }) as {
    totalDeals: number; wonDeals: number; totalSpentCents: number; daysSinceLastPurchase: number | null;
  };

  if (metricsQ.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 px-4 py-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="sidebar-metric-card animate-pulse">
            <div className="h-3 bg-muted rounded w-16 mb-2" />
            <div className="h-5 bg-muted rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    { icon: Briefcase, label: "Negociações", value: String(m.totalDeals), color: "text-primary" },
    { icon: DollarSign, label: "Receita", value: fmt$(m.totalSpentCents), color: "text-emerald-500" },
    { icon: TrendingUp, label: "Ganhas", value: String(m.wonDeals), color: "text-blue-500" },
    {
      icon: Calendar, label: "Última compra",
      value: m.daysSinceLastPurchase !== null ? `${m.daysSinceLastPurchase}d` : "—",
      color: "text-orange-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 px-4 py-2">
      {cards.map((c) => (
        <div key={c.label} className="sidebar-metric-card">
          <div className="flex items-center gap-1.5 mb-1">
            <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{c.label}</span>
          </div>
          <p className="text-[15px] font-bold text-foreground tabular-nums">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
