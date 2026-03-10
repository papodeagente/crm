import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { AdminOnlyGuard } from "@/components/AdminOnlyGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Key, Activity } from "lucide-react";
import { formatFullDateTime } from "../../../shared/dateUtils";
import { useTenantId } from "@/hooks/useTenantId";

const actionColors: Record<string, { bg: string; text: string }> = {
  create: { bg: "bg-emerald-50", text: "text-emerald-700" },
  update: { bg: "bg-blue-50", text: "text-blue-700" },
  delete: { bg: "bg-red-50", text: "text-red-700" },
  move: { bg: "bg-amber-50", text: "text-amber-700" },
};

export default function Admin() {
  const TENANT_ID = useTenantId();

  const roles = trpc.admin.roles.list.useQuery({ tenantId: TENANT_ID });
  const eventLog = trpc.admin.eventLog.list.useQuery({ tenantId: TENANT_ID, limit: 50 });

  return (
    <AdminOnlyGuard pageTitle="Administração">
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Administração</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Gerencie perfis de permissão e auditoria do sistema.</p>
      </div>

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList className="bg-muted/30 border-0 rounded-lg p-1">
          <TabsTrigger value="roles" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5"><Key className="h-3.5 w-3.5" />Perfis</TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5"><Activity className="h-3.5 w-3.5" />Auditoria</TabsTrigger>
        </TabsList>

        {/* Roles */}
        <TabsContent value="roles">
          <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-border/30 bg-muted/20">
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Perfil</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Slug</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Descrição</th>
                </tr></thead>
                <tbody>
                  {roles.isLoading ? <tr><td colSpan={3} className="p-12 text-center text-muted-foreground text-sm">Carregando...</td></tr>
                  : !roles.data?.length ? (
                    <tr><td colSpan={3} className="p-12 text-center text-muted-foreground">
                      <Key className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm">Nenhum perfil configurado.</p>
                    </td></tr>
                  ) : roles.data.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-xl bg-violet-50 flex items-center justify-center"><Shield className="h-4 w-4 text-violet-600" /></div>
                          <span className="font-semibold">{r.name}</span>
                        </div>
                      </td>
                      <td className="p-3.5"><span className="text-[11px] font-mono bg-muted/40 px-2 py-0.5 rounded-md">{r.slug}</span></td>
                      <td className="p-3.5 text-muted-foreground">{r.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Audit */}
        <TabsContent value="audit">
          <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-border/30 bg-muted/20">
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Ação</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Entidade</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Usuário</th>
                  <th className="text-left p-3.5 font-semibold text-muted-foreground">Data</th>
                </tr></thead>
                <tbody>
                  {eventLog.isLoading ? <tr><td colSpan={4} className="p-12 text-center text-muted-foreground text-sm">Carregando...</td></tr>
                  : !eventLog.data?.length ? (
                    <tr><td colSpan={4} className="p-12 text-center text-muted-foreground">
                      <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm">Nenhum evento registrado.</p>
                    </td></tr>
                  ) : eventLog.data.map((e: any) => {
                    const ac = actionColors[e.action] || { bg: "bg-slate-50", text: "text-slate-600" };
                    return (
                      <tr key={e.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                        <td className="p-3.5"><span className={`inline-flex text-[11px] font-medium px-2.5 py-1 rounded-full ${ac.bg} ${ac.text}`}>{e.action}</span></td>
                        <td className="p-3.5">{e.entityType} <span className="text-muted-foreground">#{e.entityId}</span></td>
                        <td className="p-3.5 text-muted-foreground">User #{e.actorUserId}</td>
                        <td className="p-3.5 text-muted-foreground">{e.createdAt ? formatFullDateTime(e.createdAt) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </AdminOnlyGuard>
  );
}
