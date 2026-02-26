import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  Briefcase, Users, Plane, CheckSquare, MessageSquare,
  TrendingUp, ArrowUpRight, ArrowDownRight, Clock, Calendar,
  ChevronRight, Plus, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

/* ─── Metric Card with gradient accent ─── */
function MetricCard({ label, value, change, changeType, icon: Icon, gradient, iconBg, iconColor }: {
  label: string; value: string; change?: string; changeType?: "up" | "down"; icon: any; gradient: string; iconBg: string; iconColor: string;
}) {
  return (
    <div className="surface p-5 flex flex-col gap-3 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-200">
      {/* Subtle gradient accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: gradient }} />
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-[28px] font-bold tracking-tight text-foreground leading-none">{value}</span>
        {change && (
          <span className={`flex items-center gap-0.5 text-[12px] font-semibold mb-1 ${
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
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="h-4 w-4" />
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
      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${priorityColors[priority]}`} />
      <span className="text-[13px] text-foreground flex-1 truncate">{title}</span>
      <span className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {dueTime}
      </span>
    </div>
  );
}

/* ─── Quick Action ─── */
function QuickAction({ label, icon: Icon, href, iconColor }: { label: string; icon: any; href: string; iconColor: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border/50 transition-all duration-200 group"
    >
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-[13px] font-medium text-foreground">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 ml-auto group-hover:text-muted-foreground transition-colors duration-150" />
    </Link>
  );
}

/* ─── Pipeline Stage Bar ─── */
const stageColors = [
  "bg-indigo-500",
  "bg-blue-500",
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-amber-500",
];

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
          <h1 className="text-[26px] font-bold tracking-tight text-foreground">
            {greeting}, {user?.name?.split(" ")[0] || "Usuário"}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1 capitalize">{today}</p>
        </div>
        <Link href="/pipeline">
          <Button size="sm" className="h-9 rounded-xl text-[13px] font-medium gap-1.5 shadow-sm" style={{
            background: "linear-gradient(135deg, oklch(0.50 0.22 265), oklch(0.45 0.20 290))"
          }}>
            <Plus className="h-3.5 w-3.5" />
            Nova Negociação
          </Button>
        </Link>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Negociações Ativas"
          value="24"
          change="+12%"
          changeType="up"
          icon={Briefcase}
          gradient="linear-gradient(135deg, oklch(0.50 0.22 265), oklch(0.55 0.20 290))"
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        />
        <MetricCard
          label="Contatos"
          value="156"
          change="+8%"
          changeType="up"
          icon={Users}
          gradient="linear-gradient(135deg, oklch(0.55 0.22 160), oklch(0.60 0.20 145))"
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <MetricCard
          label="Viagens em Andamento"
          value="7"
          change="-3%"
          changeType="down"
          icon={Plane}
          gradient="linear-gradient(135deg, oklch(0.58 0.24 25), oklch(0.62 0.22 40))"
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
        />
        <MetricCard
          label="Tarefas Pendentes"
          value="12"
          icon={CheckSquare}
          gradient="linear-gradient(135deg, oklch(0.55 0.20 290), oklch(0.50 0.22 310))"
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left — 3 cols */}
        <div className="lg:col-span-3 space-y-6">
          {/* Focus of the day */}
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <h2 className="text-[14px] font-semibold text-foreground">Foco do Dia</h2>
              </div>
              <Link href="/tasks" className="text-[12px] text-primary font-medium hover:underline">
                Ver todas
              </Link>
            </div>
            <div className="divide-y divide-border/50">
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
            <div className="divide-y divide-border/50">
              <ActivityItem
                icon={MessageSquare}
                color="bg-emerald-50 text-emerald-600"
                title="Nova mensagem de Flavia Medeiros"
                subtitle="WhatsApp — Consulta sobre pacote Europa"
                time="há 5 min"
              />
              <ActivityItem
                icon={Briefcase}
                color="bg-indigo-50 text-indigo-600"
                title="Negociação movida para Sondagem"
                subtitle="Sondagem — Maicon · Kairos Destinos"
                time="há 23 min"
              />
              <ActivityItem
                icon={TrendingUp}
                color="bg-violet-50 text-violet-600"
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
              <QuickAction label="Nova Negociação" icon={Briefcase} href="/pipeline" iconColor="bg-indigo-50 text-indigo-600" />
              <QuickAction label="Novo Contato" icon={Users} href="/contacts" iconColor="bg-emerald-50 text-emerald-600" />
              <QuickAction label="Enviar Mensagem" icon={MessageSquare} href="/inbox" iconColor="bg-blue-50 text-blue-600" />
              <QuickAction label="Criar Proposta" icon={Plane} href="/proposals" iconColor="bg-amber-50 text-amber-600" />
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
            <div className="space-y-3.5">
              {[
                { stage: "Pré-venda", count: 15, value: "R$ 231.710", pct: 85, color: "bg-indigo-500" },
                { stage: "Atendimento", count: 14, value: "R$ 90.923", pct: 65, color: "bg-blue-500" },
                { stage: "Sondagem", count: 28, value: "R$ 496.735", pct: 100, color: "bg-cyan-500" },
                { stage: "Apresentação", count: 7, value: "R$ 766.746", pct: 45, color: "bg-emerald-500" },
                { stage: "Fechamento", count: 4, value: "R$ 189.400", pct: 25, color: "bg-amber-500" },
              ].map((s) => (
                <div key={s.stage}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12.5px] font-medium text-foreground">{s.stage}</span>
                    <span className="text-[11px] text-muted-foreground font-medium">{s.count} · {s.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.color} transition-all duration-700`}
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
              <div className="h-6 w-6 rounded-lg bg-blue-50 flex items-center justify-center">
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <h2 className="text-[14px] font-semibold text-foreground">Próximos Eventos</h2>
            </div>
            <div className="space-y-3">
              {[
                { title: "Reunião — Kairos Destinos", time: "Hoje, 15:00", type: "meeting" },
                { title: "Embarque — Família Santos", time: "Amanhã, 06:30", type: "trip" },
                { title: "Vencimento proposta — Victory", time: "28 Fev", type: "deadline" },
              ].map((e, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                    e.type === "meeting" ? "bg-indigo-500" : e.type === "trip" ? "bg-emerald-500" : "bg-amber-500"
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
