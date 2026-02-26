import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  Briefcase, Users, Plane, CheckSquare, MessageSquare,
  TrendingUp, ArrowUpRight, ArrowDownRight, Clock, Calendar,
  ChevronRight, Plus, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

/* ─── Metric Card ─── */
function MetricCard({ label, value, change, changeType, icon: Icon }: {
  label: string; value: string; change?: string; changeType?: "up" | "down"; icon: any;
}) {
  return (
    <div className="surface p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className="h-8 w-8 rounded-lg bg-primary/[0.06] flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-semibold tracking-tight text-foreground">{value}</span>
        {change && (
          <span className={`flex items-center gap-0.5 text-[12px] font-medium mb-0.5 ${
            changeType === "up" ? "text-emerald-600" : "text-red-500"
          }`}>
            {changeType === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {change}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Activity Item ─── */
function ActivityItem({ title, subtitle, time, icon: Icon, color }: {
  title: string; subtitle: string; time: string; icon: any; color: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 group">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground leading-snug">{title}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <span className="text-[11px] text-muted-foreground/70 shrink-0 mt-0.5">{time}</span>
    </div>
  );
}

/* ─── Task Item ─── */
function TaskItem({ title, dueTime, priority }: {
  title: string; dueTime: string; priority: "high" | "medium" | "low";
}) {
  const priorityColors = {
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-emerald-500",
  };

  return (
    <div className="flex items-center gap-3 py-2.5 group">
      <div className={`h-2 w-2 rounded-full shrink-0 ${priorityColors[priority]}`} />
      <span className="text-[13px] text-foreground flex-1 truncate">{title}</span>
      <span className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {dueTime}
      </span>
    </div>
  );
}

/* ─── Quick Action ─── */
function QuickAction({ label, icon: Icon, href }: { label: string; icon: any; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/80 border border-transparent hover:border-border transition-all duration-150 group"
    >
      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-150" />
      <span className="text-[13px] font-medium text-foreground">{label}</span>
      <ChevronRight className="h-3 w-3 text-muted-foreground/40 ml-auto group-hover:text-muted-foreground transition-colors duration-150" />
    </Link>
  );
}

/* ─── Main Dashboard ─── */
export default function Home() {
  const { user } = useAuth();

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  })();

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="page-content">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {greeting}, {user?.name?.split(" ")[0] || "Usuário"}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1 capitalize">{today}</p>
        </div>
        <Link href="/pipeline">
          <Button size="sm" className="h-8 rounded-lg text-[13px] font-medium gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nova Negociação
          </Button>
        </Link>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Negociações Ativas" value="24" change="+12%" changeType="up" icon={Briefcase} />
        <MetricCard label="Contatos" value="156" change="+8%" changeType="up" icon={Users} />
        <MetricCard label="Viagens em Andamento" value="7" change="-3%" changeType="down" icon={Plane} />
        <MetricCard label="Tarefas Pendentes" value="12" icon={CheckSquare} />
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left — 3 cols */}
        <div className="lg:col-span-3 space-y-6">
          {/* Focus of the day */}
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <h2 className="text-[14px] font-semibold text-foreground">Foco do Dia</h2>
              </div>
              <Link href="/tasks" className="text-[12px] text-primary font-medium hover:underline">
                Ver todas
              </Link>
            </div>
            <div className="divide-y divide-border">
              <TaskItem title="Retornar contato — Ana Cembrani (Tz Viagens)" dueTime="10:00" priority="high" />
              <TaskItem title="Enviar proposta — Pacote Cancún família Silva" dueTime="14:00" priority="high" />
              <TaskItem title="Follow-up — Renovação contrato Victory Travel" dueTime="16:30" priority="medium" />
              <TaskItem title="Revisar orçamento — Grupo corporativo Techcorp" dueTime="17:00" priority="low" />
            </div>
          </div>

          {/* Recent Activity */}
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold text-foreground">Atividade Recente</h2>
              <Link href="/insights" className="text-[12px] text-primary font-medium hover:underline">
                Ver mais
              </Link>
            </div>
            <div className="divide-y divide-border">
              <ActivityItem
                icon={MessageSquare}
                color="bg-emerald-50 text-emerald-600"
                title="Nova mensagem de Flavia Medeiros"
                subtitle="WhatsApp — Consulta sobre pacote Europa"
                time="há 5 min"
              />
              <ActivityItem
                icon={Briefcase}
                color="bg-blue-50 text-blue-600"
                title="Negociação movida para Sondagem"
                subtitle="Sondagem — Maicon · Kairos Destinos"
                time="há 23 min"
              />
              <ActivityItem
                icon={TrendingUp}
                color="bg-purple-50 text-purple-600"
                title="Proposta visualizada"
                subtitle="Acelera 10x — Victory · R$ 4.997,00"
                time="há 1h"
              />
              <ActivityItem
                icon={Users}
                color="bg-amber-50 text-amber-600"
                title="Novo contato adicionado"
                subtitle="Bruna Loippo — via formulário do site"
                time="há 2h"
              />
              <ActivityItem
                icon={Plane}
                color="bg-cyan-50 text-cyan-600"
                title="Viagem confirmada"
                subtitle="Família Santos — Maldivas · 15-22 Mar"
                time="há 3h"
              />
            </div>
          </div>
        </div>

        {/* Right — 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <div className="surface p-5">
            <h2 className="text-[14px] font-semibold text-foreground mb-4">Ações Rápidas</h2>
            <div className="space-y-2">
              <QuickAction label="Nova Negociação" icon={Briefcase} href="/pipeline" />
              <QuickAction label="Novo Contato" icon={Users} href="/contacts" />
              <QuickAction label="Enviar Mensagem" icon={MessageSquare} href="/whatsapp" />
              <QuickAction label="Criar Proposta" icon={Plane} href="/proposals" />
            </div>
          </div>

          {/* Pipeline Summary */}
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold text-foreground">Pipeline</h2>
              <Link href="/pipeline" className="text-[12px] text-primary font-medium hover:underline">
                Abrir
              </Link>
            </div>
            <div className="space-y-3">
              {[
                { stage: "Pré-venda", count: 15, value: "R$ 231.710", pct: 85 },
                { stage: "Atendimento", count: 14, value: "R$ 90.923", pct: 65 },
                { stage: "Sondagem", count: 28, value: "R$ 496.735", pct: 100 },
                { stage: "Apresentação", count: 7, value: "R$ 766.746", pct: 45 },
                { stage: "Fechamento", count: 4, value: "R$ 189.400", pct: 25 },
              ].map((s) => (
                <div key={s.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-foreground">{s.stage}</span>
                    <span className="text-[11px] text-muted-foreground">{s.count} · {s.value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all duration-500"
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming */}
          <div className="surface p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[14px] font-semibold text-foreground">Próximos Eventos</h2>
            </div>
            <div className="space-y-3">
              {[
                { title: "Reunião — Kairos Destinos", time: "Hoje, 15:00", type: "meeting" },
                { title: "Embarque — Família Santos", time: "Amanhã, 06:30", type: "trip" },
                { title: "Vencimento proposta — Victory", time: "28 Fev", type: "deadline" },
              ].map((e, i) => (
                <div key={i} className="flex items-center gap-3 py-1">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${
                    e.type === "meeting" ? "bg-primary" : e.type === "trip" ? "bg-emerald-500" : "bg-amber-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-foreground truncate">{e.title}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{e.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
