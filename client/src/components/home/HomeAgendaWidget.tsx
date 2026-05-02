import { useMemo, useState } from "react";
import { Link } from "wouter";
import { CalendarDays, Plus, ArrowRight, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AppointmentDialog from "@/components/agenda/AppointmentDialog";

/**
 * Widget de agenda da clínica na página inicial.
 *
 * Lê de agenda.unified (mesma fonte da página /agenda) → impossível existir
 * "duas agendas". Mostra próximos 7 dias agrupados por data, com atalho para
 * /agenda (visão completa) e botão de criar consulta usando o dialog que
 * impõe contato + negociação.
 */
const SYSTEM_LOCALE = "pt-BR";
const SYSTEM_TZ = "America/Sao_Paulo";

function toLocalDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  return target.toLocaleDateString(SYSTEM_LOCALE, { weekday: "short", day: "2-digit", month: "short", timeZone: SYSTEM_TZ });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(SYSTEM_LOCALE, { hour: "2-digit", minute: "2-digit", timeZone: SYSTEM_TZ });
}

interface AgendaItem {
  id: string;
  source: "crm" | "google" | "appointment";
  title: string;
  startAt: number;
  endAt: number;
  allDay: boolean;
  contactName?: string | null;
  dealTitle?: string | null;
  isCompleted: boolean;
}

export default function HomeAgendaWidget() {
  const [showCreate, setShowCreate] = useState(false);

  const range = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 8); // +8 pra incluir o sétimo dia inteiro
    return { from: toLocalDateStr(from), to: toLocalDateStr(to) };
  }, []);

  const agendaQ = trpc.agenda.unified.useQuery(
    { from: range.from, to: range.to },
    { staleTime: 30_000, refetchInterval: 60_000, refetchIntervalInBackground: false }
  );

  // Agrupa por dia, mantendo ordem cronológica e limite de exibição.
  const groupedDays = useMemo(() => {
    const items = (agendaQ.data || []) as AgendaItem[];
    const sorted = [...items]
      .filter(i => !i.isCompleted)
      .sort((a, b) => a.startAt - b.startAt);
    const buckets = new Map<string, AgendaItem[]>();
    for (const it of sorted) {
      const d = new Date(it.startAt);
      d.setHours(0, 0, 0, 0);
      const k = String(d.getTime());
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(it);
    }
    return Array.from(buckets.entries()).map(([k, items]) => ({
      date: new Date(Number(k)),
      items,
    }));
  }, [agendaQ.data]);

  const totalUpcoming = groupedDays.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <section className="lg:col-span-4">
      <div className="surface p-5 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-emerald-500/10">
              <CalendarDays className="h-4.5 w-4.5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-foreground tracking-tight">Agenda da clínica</h2>
              <p className="text-[11px] text-muted-foreground">Próximos 7 dias · {totalUpcoming} {totalUpcoming === 1 ? "consulta" : "consultas"}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-8 text-[12px] px-2.5" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Marcar
          </Button>
        </div>

        {/* Lista */}
        <div className="flex-1 min-h-0 space-y-3 overflow-y-auto -mx-1 px-1">
          {agendaQ.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : groupedDays.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[13px] text-muted-foreground mb-3">Sem consultas agendadas</p>
              <Button size="sm" variant="default" className="h-8 text-[12px]" onClick={() => setShowCreate(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Marcar primeira consulta
              </Button>
            </div>
          ) : (
            groupedDays.map((group) => (
              <div key={group.date.getTime()}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {formatDayLabel(group.date)}
                </p>
                <div className="space-y-1.5">
                  {group.items.slice(0, 4).map((item) => (
                    <Link key={item.id} href="/agenda">
                      <div className="rounded-lg border border-border/40 bg-card hover:bg-accent/50 hover:border-emerald-500/30 transition-colors px-3 py-2 cursor-pointer">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-mono tabular-nums text-emerald-500 font-bold">
                            {item.allDay ? "—" : formatTime(item.startAt)}
                          </span>
                          {item.source === "google" && (
                            <span className="text-[8px] px-1.5 py-[1px] rounded bg-blue-500/10 text-blue-500 font-semibold uppercase tracking-wider">
                              Google
                            </span>
                          )}
                          {item.source === "crm" && (
                            <span className="text-[8px] px-1.5 py-[1px] rounded bg-amber-500/10 text-amber-500 font-semibold uppercase tracking-wider">
                              Tarefa
                            </span>
                          )}
                          <span className="text-[12.5px] font-medium text-foreground truncate">{item.title}</span>
                        </div>
                        {(item.contactName || item.dealTitle) && (
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate">
                            {item.contactName && <span className="truncate">{item.contactName}</span>}
                            {item.contactName && item.dealTitle && <span className="text-muted-foreground/50">·</span>}
                            {item.dealTitle && <span className="truncate">{item.dealTitle}</span>}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                  {group.items.length > 4 && (
                    <Link href="/agenda" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1">
                      <Clock className="w-3 h-3" />
                      mais {group.items.length - 4} no dia
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <Link href="/agenda" className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[12px] text-muted-foreground hover:text-foreground transition-colors group">
          <span>Ver agenda completa</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <AppointmentDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={() => agendaQ.refetch()}
      />
    </section>
  );
}
