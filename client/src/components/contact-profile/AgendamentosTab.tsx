import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, User, CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

interface AgendamentosTabProps {
  contactId: number;
}

function formatDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function statusConfig(s: string) {
  switch (s) {
    case "scheduled": return { label: "Agendado", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
    case "confirmed": return { label: "Confirmado", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
    case "in_progress": return { label: "Em Andamento", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
    case "completed": return { label: "Concluído", color: "bg-green-500/15 text-green-400 border-green-500/30" };
    case "cancelled": return { label: "Cancelado", color: "bg-red-500/15 text-red-400 border-red-500/30" };
    case "no_show": return { label: "Não compareceu", color: "bg-orange-500/15 text-orange-400 border-orange-500/30" };
    default: return { label: s, color: "bg-muted text-muted-foreground" };
  }
}

export default function AgendamentosTab({ contactId }: AgendamentosTabProps) {
  const now = new Date();
  const from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const agendaQ = trpc.agenda.unified.useQuery({ from, to });

  const utils = trpc.useUtils();
  const confirmMut = trpc.agenda.confirmAppointment.useMutation({
    onSuccess: () => { utils.agenda.unified.invalidate(); toast.success("Confirmado"); },
  });
  const completeMut = trpc.agenda.completeAppointment.useMutation({
    onSuccess: () => { utils.agenda.unified.invalidate(); toast.success("Concluído"); },
  });

  // Filter only appointments for this contact
  const allItems = (agendaQ.data || []) as any[];
  const appointments = useMemo(() =>
    allItems.filter((a: any) => a.source === "appointment" && a.contactId === contactId),
    [allItems, contactId]
  );

  const upcoming = appointments.filter((a: any) => new Date(a.startAt) >= now && a.status !== "cancelled");
  const past = appointments.filter((a: any) => new Date(a.startAt) < now || a.status === "cancelled");

  if (agendaQ.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#2E7D5B]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Agendamentos ({appointments.length})</h3>
        <Link href="/agenda">
          <Button size="sm" className="bg-[#2E7D5B] hover:bg-[#256B4D] text-white h-8 text-xs">
            <Calendar className="h-3.5 w-3.5 mr-1" /> Agendar
          </Button>
        </Link>
      </div>

      {appointments.length === 0 ? (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="text-center py-12">
            <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#2E7D5B] uppercase">Próximos</p>
              {upcoming.map((appt: any) => {
                const sc = statusConfig(appt.status || "scheduled");
                return (
                  <Card key={appt.id} className="border-border/50 bg-card/80">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{appt.title}</p>
                            <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDateTime(appt.startAt)}</span>
                            {appt.serviceType && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {appt.serviceType}</span>}
                            {appt.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {appt.location}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {(appt.status === "scheduled" || !appt.status) && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400" onClick={() => confirmMut.mutate({ id: appt.id })}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirmar
                            </Button>
                          )}
                          {(appt.status === "scheduled" || appt.status === "confirmed" || !appt.status) && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400" onClick={() => completeMut.mutate({ id: appt.id })}>
                              Concluir
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Histórico</p>
              {past.map((appt: any) => {
                const sc = statusConfig(appt.status || "completed");
                return (
                  <Card key={appt.id} className="border-border/50 bg-card/60 opacity-75">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{appt.title}</p>
                            <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatDateTime(appt.startAt)}
                            {appt.serviceType && <> · {appt.serviceType}</>}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
