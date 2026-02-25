import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TENANT_ID = 1;

export default function Pipeline() {
  const [openPipeline, setOpenPipeline] = useState(false);
  const [pipelineName, setPipelineName] = useState("");
  const [openStage, setOpenStage] = useState(false);
  const [stageName, setStageName] = useState("");
  const [selectedPipeline, setSelectedPipeline] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const pipelines = trpc.crm.pipelines.list.useQuery({ tenantId: TENANT_ID });
  const deals = trpc.crm.deals.list.useQuery({ tenantId: TENANT_ID, limit: 200 });
  const createPipeline = trpc.crm.pipelines.create.useMutation({
    onSuccess: () => { utils.crm.pipelines.list.invalidate(); setOpenPipeline(false); setPipelineName(""); toast.success("Pipeline criado!"); },
  });
  const createStage = trpc.crm.pipelines.createStage.useMutation({
    onSuccess: () => { utils.crm.pipelines.stages.invalidate(); setOpenStage(false); setStageName(""); toast.success("Etapa criada!"); },
  });

  const activePipeline = selectedPipeline ? pipelines.data?.find((p: any) => p.id === selectedPipeline) : pipelines.data?.[0];
  const stages = trpc.crm.pipelines.stages.useQuery({ tenantId: TENANT_ID, pipelineId: activePipeline?.id ?? 0 }, { enabled: !!activePipeline });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funil de Vendas</h1>
          <p className="text-muted-foreground">Visualize e gerencie seus pipelines.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openStage} onOpenChange={setOpenStage}>
            <DialogTrigger asChild><Button variant="outline" disabled={!activePipeline}><Plus className="h-4 w-4 mr-2" />Nova Etapa</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Etapa</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Nome da Etapa *</Label><Input value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="Ex: Qualificação" /></div>
                <Button className="w-full" disabled={!stageName} onClick={() => createStage.mutate({ tenantId: TENANT_ID, pipelineId: activePipeline!.id, name: stageName, orderIndex: (stages.data?.length ?? 0) + 1 })}>Criar Etapa</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={openPipeline} onOpenChange={setOpenPipeline}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Pipeline</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Pipeline</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Nome *</Label><Input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} placeholder="Ex: Vendas Principal" /></div>
                <Button className="w-full" disabled={!pipelineName} onClick={() => createPipeline.mutate({ tenantId: TENANT_ID, name: pipelineName })}>Criar Pipeline</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {pipelines.data && pipelines.data.length > 1 && (
        <div className="flex gap-2">
          {pipelines.data.map((p: any) => (
            <Button key={p.id} variant={activePipeline?.id === p.id ? "default" : "outline"} size="sm" onClick={() => setSelectedPipeline(p.id)}>{p.name}</Button>
          ))}
        </div>
      )}

      {!activePipeline ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><Target className="h-12 w-12 mx-auto mb-4 opacity-40" /><p>Nenhum pipeline criado. Crie seu primeiro pipeline para começar.</p></CardContent></Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.isLoading ? (
            <p className="text-muted-foreground p-4">Carregando etapas...</p>
          ) : !stages.data?.length ? (
            <Card className="min-w-[300px]"><CardContent className="p-8 text-center text-muted-foreground">Nenhuma etapa criada. Adicione etapas ao pipeline.</CardContent></Card>
          ) : stages.data.map((stage: any) => {
            const stageDeals = deals.data?.filter((d: any) => d.stageId === stage.id) || [];
            return (
              <div key={stage.id} className="min-w-[280px] max-w-[320px] flex-shrink-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="font-semibold text-sm">{stage.name}</h3>
                  <Badge variant="secondary" className="text-xs">{stageDeals.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[200px] bg-muted/30 rounded-lg p-2">
                  {stageDeals.map((deal: any) => (
                    <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <p className="font-medium text-sm">{deal.title}</p>
                        {deal.valueCents && <p className="text-xs text-muted-foreground mt-1">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(deal.valueCents / 100)}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
