import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plug, Plus, Webhook, Zap, Globe } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const TENANT_ID = 1;

export default function Integrations() {
  const integrations = trpc.integrationHub.integrations.list.useQuery({ tenantId: TENANT_ID });
  const webhooks = trpc.integrationHub.webhooks.list.useQuery({ tenantId: TENANT_ID });
  const jobs = trpc.integrationHub.jobs.list.useQuery({ tenantId: TENANT_ID });

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Integrações</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Conecte serviços externos e gerencie webhooks.</p>
        </div>
        <Button className="h-9 gap-2 px-5 rounded-lg bg-primary hover:bg-primary/90 shadow-sm text-[13px] font-medium transition-colors" onClick={() => toast("Criação de integração em breve")}>
          <Plus className="h-4 w-4" />Nova Integração
        </Button>
      </div>

      <Tabs defaultValue="integrations" className="space-y-4">
        <TabsList className="bg-muted/30 border-0 rounded-lg p-1">
          <TabsTrigger value="integrations" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5"><Zap className="h-3.5 w-3.5" />Conectores</TabsTrigger>
          <TabsTrigger value="webhooks" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5"><Webhook className="h-3.5 w-3.5" />Webhooks</TabsTrigger>
          <TabsTrigger value="jobs" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5"><Globe className="h-3.5 w-3.5" />Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations">
          {integrations.isLoading ? (
            <p className="text-[13px] text-muted-foreground text-center py-12">Carregando...</p>
          ) : !integrations.data?.length ? (
            <Card className="border border-border/40 shadow-none rounded-xl">
              <div className="p-12 text-center text-muted-foreground">
                <Plug className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                <p className="text-[14px] font-medium text-muted-foreground/60">Nenhuma integração configurada</p>
                <p className="text-[13px] text-muted-foreground/40 mt-1">Conecte serviços como Stripe, Google Calendar, etc.</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations.data.map((i: any) => (
                <Card key={i.id} className="border border-border/40 shadow-none rounded-xl hover:shadow-md transition-shadow cursor-pointer group">
                  <div className="p-5">
                    <div className="flex items-center gap-3.5">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Zap className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold group-hover:text-primary transition-colors">{i.name}</p>
                        <p className="text-[12px] text-muted-foreground">{i.provider}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${i.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600"}`}>
                        <span className={`h-1 w-1 rounded-full ${i.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {i.status === "active" ? "Ativo" : i.status || "—"}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="webhooks">
          <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-border/30 bg-muted/20">
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Provider</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Endpoint</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Status</th>
                </tr></thead>
                <tbody>
                  {!webhooks.data?.length ? (
                    <tr><td colSpan={3} className="p-12 text-center text-muted-foreground">
                      <Webhook className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm">Nenhum webhook configurado.</p>
                    </td></tr>
                  ) : webhooks.data.map((w: any) => (
                    <tr key={w.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="p-3.5 font-semibold">{w.provider}</td>
                      <td className="p-3.5 text-muted-foreground truncate max-w-[300px] font-mono text-[11px]">{w.endpoint}</td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${w.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${w.active ? "bg-emerald-500" : "bg-slate-400"}`} />
                          {w.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="jobs">
          <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-border/30 bg-muted/20">
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Tipo</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Status</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Criado em</th>
                </tr></thead>
                <tbody>
                  {!jobs.data?.length ? (
                    <tr><td colSpan={3} className="p-12 text-center text-muted-foreground">
                      <Globe className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm">Nenhum job encontrado.</p>
                    </td></tr>
                  ) : jobs.data.map((j: any) => (
                    <tr key={j.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="p-3.5 font-semibold">{j.type}</td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${
                          j.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                          j.status === "failed" ? "bg-red-50 text-red-700" :
                          j.status === "running" ? "bg-blue-50 text-blue-700" :
                          "bg-slate-50 text-slate-600"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            j.status === "completed" ? "bg-emerald-500" :
                            j.status === "failed" ? "bg-red-500" :
                            j.status === "running" ? "bg-blue-500 animate-pulse" :
                            "bg-slate-400"
                          }`} />
                          {j.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-muted-foreground">{j.createdAt ? new Date(j.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
