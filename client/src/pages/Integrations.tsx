import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plug, Plus, Webhook, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const TENANT_ID = 1;

export default function Integrations() {
  const integrations = trpc.integrationHub.integrations.list.useQuery({ tenantId: TENANT_ID });
  const webhooks = trpc.integrationHub.webhooks.list.useQuery({ tenantId: TENANT_ID });
  const jobs = trpc.integrationHub.jobs.list.useQuery({ tenantId: TENANT_ID });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Integrações</h1><p className="text-muted-foreground">Conecte serviços externos e gerencie webhooks.</p></div>
        <Button onClick={() => toast("Criação de integração em breve")}><Plus className="h-4 w-4 mr-2" />Nova Integração</Button>
      </div>
      <Tabs defaultValue="integrations">
        <TabsList><TabsTrigger value="integrations">Conectores</TabsTrigger><TabsTrigger value="webhooks">Webhooks</TabsTrigger><TabsTrigger value="jobs">Jobs</TabsTrigger></TabsList>
        <TabsContent value="integrations" className="mt-4">
          {integrations.isLoading ? <p className="text-muted-foreground">Carregando...</p>
          : !integrations.data?.length ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground"><Plug className="h-12 w-12 mx-auto mb-4 opacity-40" /><p>Nenhuma integração configurada.</p></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations.data.map((i: any) => (
                <Card key={i.id}><CardContent className="p-4"><div className="flex items-center gap-3"><Zap className="h-5 w-5 text-primary" /><div><p className="font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{i.provider}</p></div></div><Badge variant="secondary" className="mt-2">{i.status || "active"}</Badge></CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="webhooks" className="mt-4">
          <Card><CardContent className="p-0"><table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/30"><th className="text-left p-3 font-medium">Provider</th><th className="text-left p-3 font-medium">Endpoint</th><th className="text-left p-3 font-medium">Status</th></tr></thead>
            <tbody>
              {!webhooks.data?.length ? <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Nenhum webhook configurado.</td></tr>
              : webhooks.data.map((w: any) => (
                <tr key={w.id} className="border-b hover:bg-muted/20"><td className="p-3">{w.provider}</td><td className="p-3 text-muted-foreground truncate max-w-[300px]">{w.endpoint}</td><td className="p-3"><Badge variant="secondary">{w.active ? "Ativo" : "Inativo"}</Badge></td></tr>
              ))}
            </tbody>
          </table></CardContent></Card>
        </TabsContent>
        <TabsContent value="jobs" className="mt-4">
          <Card><CardContent className="p-0"><table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/30"><th className="text-left p-3 font-medium">Tipo</th><th className="text-left p-3 font-medium">Status</th><th className="text-left p-3 font-medium">Criado em</th></tr></thead>
            <tbody>
              {!jobs.data?.length ? <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Nenhum job encontrado.</td></tr>
              : jobs.data.map((j: any) => (
                <tr key={j.id} className="border-b hover:bg-muted/20"><td className="p-3">{j.type}</td><td className="p-3"><Badge variant="secondary">{j.status}</Badge></td><td className="p-3 text-muted-foreground">{j.createdAt ? new Date(j.createdAt).toLocaleDateString("pt-BR") : "—"}</td></tr>
              ))}
            </tbody>
          </table></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
