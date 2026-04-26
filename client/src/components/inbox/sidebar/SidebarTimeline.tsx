/**
 * SidebarTimeline — Recent activity timeline for a contact's deals
 */
import { trpc } from "@/lib/trpc";
import {
  GitBranch, MessageCircle, ClipboardList, StickyNote, Package,
  UserCheck, Zap, FileText, ArrowRightLeft,
} from "lucide-react";

const categoryIcons: Record<string, any> = {
  funnel: GitBranch,
  whatsapp: MessageCircle,
  task: ClipboardList,
  note: StickyNote,
  product: Package,
  assignment: UserCheck,
  automation: Zap,
  audit: FileText,
  conversion: ArrowRightLeft,
  proposal: FileText,
  imported_data: FileText,
};

const categoryColors: Record<string, string> = {
  funnel: "text-primary bg-primary/10",
  whatsapp: "text-green-500 bg-green-500/10",
  task: "text-blue-500 bg-blue-500/10",
  note: "text-amber-500 bg-amber-500/10",
  product: "text-pink-500 bg-pink-500/10",
  assignment: "text-cyan-500 bg-cyan-500/10",
  automation: "text-purple-500 bg-purple-500/10",
  conversion: "text-orange-500 bg-orange-500/10",
};

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function SidebarTimeline({ contactId }: { contactId: number }) {
  // Get deals for this contact to fetch timeline
  const dealsQ = trpc.contactProfile.getDeals.useQuery(
    { contactId },
    { enabled: !!contactId, staleTime: 60_000 }
  );
  const deals = (dealsQ.data || []) as Array<{ id: number }>;
  const firstDealId = deals[0]?.id;

  // Timeline from first deal (simplified — shows most recent activity)
  const timelineQ = trpc.crm.deals.timeline.useQuery(
    { dealId: firstDealId!, limit: 10 },
    { enabled: !!firstDealId, staleTime: 60_000 }
  );
  const events = (timelineQ.data?.events || []) as Array<{
    id: string; type: string; category: string; description: string;
    createdAt: string; actorName?: string;
  }>;

  if (!firstDealId || events.length === 0) {
    return (
      <div className="px-4 py-2">
        <span className="sidebar-section-trigger !p-0">Atividade Recente</span>
        <p className="text-[12px] text-muted-foreground text-center py-3">Sem atividade registrada</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      <span className="sidebar-section-trigger !p-0 mb-2 block">Atividade Recente</span>
      <div className="space-y-0.5">
        {events.map((ev) => {
          const Icon = categoryIcons[ev.category] || FileText;
          const colorClass = categoryColors[ev.category] || "text-muted-foreground bg-muted";
          return (
            <div key={ev.id} className="flex items-start gap-2 py-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                <Icon className="w-3 h-3" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-foreground line-clamp-2">{ev.description}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {ev.actorName && <span className="text-[10px] text-muted-foreground">{ev.actorName}</span>}
                  <span className="text-[10px] text-muted-foreground">{timeAgo(ev.createdAt)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
