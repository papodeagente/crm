import { trpc } from "@/lib/trpc";
import { useTenantId } from "@/hooks/useTenantId";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Cake, Heart, ChevronLeft, ChevronRight, Settings2, Phone, User, Calendar } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function BirthdayCalendar() {
  const TENANT_ID = useTenantId();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [daysAhead, setDaysAhead] = useState(7);
  const [tab, setTab] = useState<"upcoming" | "month">("upcoming");

  // Preferences
  const prefQ = trpc.preferences.get.useQuery({ tenantId: TENANT_ID, key: "birthdayDaysAhead" });
  const setPref = trpc.preferences.set.useMutation({
    onSuccess: () => toast.success("Preferência salva"),
  });

  // Use saved preference if available
  const effectiveDaysAhead = useMemo(() => {
    if (prefQ.data?.value) return Number(prefQ.data.value);
    return daysAhead;
  }, [prefQ.data, daysAhead]);

  // Queries
  const upcomingBirthdaysQ = trpc.dateCelebrations.upcoming.useQuery(
    { tenantId: TENANT_ID, dateType: "birthDate", daysAhead: effectiveDaysAhead },
    { enabled: tab === "upcoming" }
  );
  const upcomingWeddingsQ = trpc.dateCelebrations.upcoming.useQuery(
    { tenantId: TENANT_ID, dateType: "weddingDate", daysAhead: effectiveDaysAhead },
    { enabled: tab === "upcoming" }
  );
  const monthBirthdaysQ = trpc.dateCelebrations.inMonth.useQuery(
    { tenantId: TENANT_ID, month: selectedMonth, dateType: "birthDate" },
    { enabled: tab === "month" }
  );
  const monthWeddingsQ = trpc.dateCelebrations.inMonth.useQuery(
    { tenantId: TENANT_ID, month: selectedMonth, dateType: "weddingDate" },
    { enabled: tab === "month" }
  );

  const todayBirthdaysQ = trpc.dateCelebrations.today.useQuery({ tenantId: TENANT_ID, dateType: "birthDate" });
  const todayWeddingsQ = trpc.dateCelebrations.today.useQuery({ tenantId: TENANT_ID, dateType: "weddingDate" });

  function saveDaysAhead() {
    setPref.mutate({ tenantId: TENANT_ID, key: "birthdayDaysAhead", value: String(daysAhead) });
  }

  return (
    <div className="p-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Datas Comemorativas
          </h1>
          <p className="text-[13px] text-muted-foreground/70 mt-0.5">
            Aniversários e datas de casamento dos seus contatos
          </p>
        </div>
      </div>

      {/* Today's celebrations */}
      {((todayBirthdaysQ.data as any[])?.length > 0 || (todayWeddingsQ.data as any[])?.length > 0) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              🎉 Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {(todayBirthdaysQ.data as any[] || []).map((c: any) => (
                <Link key={`b-${c.id}`} href={`/contact/${c.id}`}>
                  <Badge variant="secondary" className="gap-1.5 py-1.5 px-3 cursor-pointer hover:bg-secondary/80">
                    <Cake className="h-3.5 w-3.5 text-pink-500" />
                    {c.name}
                  </Badge>
                </Link>
              ))}
              {(todayWeddingsQ.data as any[] || []).map((c: any) => (
                <Link key={`w-${c.id}`} href={`/contact/${c.id}`}>
                  <Badge variant="secondary" className="gap-1.5 py-1.5 px-3 cursor-pointer hover:bg-secondary/80">
                    <Heart className="h-3.5 w-3.5 text-red-500" />
                    {c.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <Button
          variant={tab === "upcoming" ? "default" : "outline"}
          size="sm"
          className="h-8 text-[12px]"
          onClick={() => setTab("upcoming")}
        >
          Próximos {effectiveDaysAhead} dias
        </Button>
        <Button
          variant={tab === "month" ? "default" : "outline"}
          size="sm"
          className="h-8 text-[12px]"
          onClick={() => setTab("month")}
        >
          Por mês
        </Button>
        <div className="flex-1" />
        {/* Days ahead config */}
        <div className="flex items-center gap-1.5">
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">Antecedência:</span>
          <Input
            type="number"
            min={1}
            max={90}
            value={daysAhead}
            onChange={(e) => setDaysAhead(Number(e.target.value) || 7)}
            className="h-7 w-16 text-[12px]"
          />
          <span className="text-[11px] text-muted-foreground">dias</span>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={saveDaysAhead}>
            Salvar
          </Button>
        </div>
      </div>

      {/* Upcoming view */}
      {tab === "upcoming" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Cake className="h-4 w-4 text-pink-500" />
                Aniversários ({(upcomingBirthdaysQ.data as any[])?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(upcomingBirthdaysQ.data as any[])?.length === 0 ? (
                <p className="text-[12px] text-muted-foreground italic">Nenhum aniversário nos próximos {effectiveDaysAhead} dias</p>
              ) : (
                <div className="space-y-2">
                  {(upcomingBirthdaysQ.data as any[] || []).map((c: any) => (
                    <Link key={c.id} href={`/contact/${c.id}`}>
                      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                        <div className="h-8 w-8 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                          <User className="h-4 w-4 text-pink-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground">{c.birthDate}</p>
                        </div>
                        {c.phone && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />{c.phone}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                Casamentos ({(upcomingWeddingsQ.data as any[])?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(upcomingWeddingsQ.data as any[])?.length === 0 ? (
                <p className="text-[12px] text-muted-foreground italic">Nenhum aniversário de casamento nos próximos {effectiveDaysAhead} dias</p>
              ) : (
                <div className="space-y-2">
                  {(upcomingWeddingsQ.data as any[] || []).map((c: any) => (
                    <Link key={c.id} href={`/contact/${c.id}`}>
                      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                        <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                          <User className="h-4 w-4 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground">{c.weddingDate}</p>
                        </div>
                        {c.phone && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />{c.phone}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monthly view */}
      {tab === "month" && (
        <>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedMonth(m => m <= 1 ? 12 : m - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="h-8 w-40 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedMonth(m => m >= 12 ? 1 : m + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Cake className="h-4 w-4 text-pink-500" />
                  Aniversários em {MONTH_NAMES[selectedMonth - 1]} ({(monthBirthdaysQ.data as any[])?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(monthBirthdaysQ.data as any[])?.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground italic">Nenhum aniversário em {MONTH_NAMES[selectedMonth - 1]}</p>
                ) : (
                  <div className="space-y-2">
                    {(monthBirthdaysQ.data as any[] || []).map((c: any) => (
                      <Link key={c.id} href={`/contact/${c.id}`}>
                        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                          <div className="h-8 w-8 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                            <User className="h-4 w-4 text-pink-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-foreground truncate">{c.name}</p>
                            <p className="text-[11px] text-muted-foreground">Dia {c.birthDate?.split("-")[1]}</p>
                          </div>
                          {c.phone && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />{c.phone}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  Casamentos em {MONTH_NAMES[selectedMonth - 1]} ({(monthWeddingsQ.data as any[])?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(monthWeddingsQ.data as any[])?.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground italic">Nenhum aniversário de casamento em {MONTH_NAMES[selectedMonth - 1]}</p>
                ) : (
                  <div className="space-y-2">
                    {(monthWeddingsQ.data as any[] || []).map((c: any) => (
                      <Link key={c.id} href={`/contact/${c.id}`}>
                        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                          <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <User className="h-4 w-4 text-red-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-foreground truncate">{c.name}</p>
                            <p className="text-[11px] text-muted-foreground">Dia {c.weddingDate?.split("-")[1]}</p>
                          </div>
                          {c.phone && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />{c.phone}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
