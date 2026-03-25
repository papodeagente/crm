import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { AdminOnlyGuard } from "@/components/AdminOnlyGuard";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTenantId } from "@/hooks/useTenantId";
import {
  ArrowLeft, UserCog, ArrowRightLeft, Plus, Trash2,
  ChevronRight, Users, Zap, Shield,
} from "lucide-react";

export default function StageOwnerRuleSettings() {
  const tenantId = useTenantId();
  const [, setLocation] = useLocation();
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);

  // Queries
  const pipelinesQ = trpc.crm.pipelines.list.useQuery({}, { enabled: true });
  const stagesQ = trpc.crm.pipelines.stages.useQuery(
    { pipelineId: selectedPipelineId! },
    { enabled: !!selectedPipelineId }
  );
  const rulesQ = trpc.crm.stageOwnerRules.list.useQuery(
    { pipelineId: selectedPipelineId ?? undefined },
    { enabled: true }
  );
  const usersQ = trpc.admin.users.list.useQuery(undefined as never, { enabled: true });

  const utils = trpc.useUtils();

  // Mutations
  const createMut = trpc.crm.stageOwnerRules.create.useMutation({
    onSuccess: () => {
      utils.crm.stageOwnerRules.list.invalidate();
      toast.success("Regra criada com sucesso");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMut = trpc.crm.stageOwnerRules.update.useMutation({
    onSuccess: () => {
      utils.crm.stageOwnerRules.list.invalidate();
      toast.success("Regra atualizada com sucesso");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMut = trpc.crm.stageOwnerRules.delete.useMutation({
    onSuccess: () => {
      utils.crm.stageOwnerRules.list.invalidate();
      toast.success("Regra removida com sucesso");
    },
    onError: (err) => toast.error(err.message),
  });

  const pipelines = pipelinesQ.data ?? [];
  const stages = stagesQ.data ?? [];
  const rules = rulesQ.data ?? [];
  const users = (usersQ.data ?? []) as Array<{ id: number; name: string; email: string; status: string }>;
  const activeUsers = users.filter((u) => u.status === "active");

  // Auto-select first pipeline
  if (pipelines.length > 0 && !selectedPipelineId) {
    setSelectedPipelineId(pipelines[0].id);
  }

  // Map rules by stageId for quick lookup
  const ruleByStage = useMemo(() => {
    const map = new Map<number, typeof rules[0]>();
    for (const r of rules) {
      if (selectedPipelineId && r.pipelineId === selectedPipelineId) {
        map.set(r.stageId, r);
      }
    }
    return map;
  }, [rules, selectedPipelineId]);

  // Map users by id
  const userMap = useMemo(() => {
    const map = new Map<number, typeof users[0]>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  function handleAssignUser(stageId: number, userId: number) {
    if (!selectedPipelineId) return;
    const existingRule = ruleByStage.get(stageId);
    if (existingRule) {
      updateMut.mutate({ id: existingRule.id, assignToUserId: userId });
    } else {
      createMut.mutate({ pipelineId: selectedPipelineId, stageId, assignToUserId: userId });
    }
  }

  function handleToggleActive(rule: typeof rules[0]) {
    updateMut.mutate({ id: rule.id, isActive: !rule.isActive });
  }

  function handleDelete(rule: typeof rules[0]) {
    deleteMut.mutate({ id: rule.id });
  }

  function handleRemoveRule(stageId: number) {
    const rule = ruleByStage.get(stageId);
    if (rule) deleteMut.mutate({ id: rule.id });
  }

  const configuredCount = Array.from(ruleByStage.values()).filter((r) => r.isActive).length;

  return (
    <AdminOnlyGuard>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setLocation("/settings/automation-hub")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <UserCog className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Mudar responsável ao mover etapa</h1>
              <p className="text-sm text-muted-foreground">
                Configure qual membro da equipe será automaticamente atribuído como responsável quando uma negociação chegar em determinada etapa.
              </p>
            </div>
          </div>
        </div>

        {/* Info card */}
        <Card className="mb-6 border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Como funciona</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Quando uma negociação for movida (arrastada) para uma etapa que tenha uma regra configurada,
                  o sistema automaticamente altera o responsável da negociação para o membro definido.
                  Isso é registrado no histórico da negociação como "Automação de etapa".
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline selector */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Funil</label>
            <Select
              value={selectedPipelineId ? String(selectedPipelineId) : ""}
              onValueChange={(v) => setSelectedPipelineId(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um funil" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Badge variant="outline" className="text-[11px] gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {configuredCount} etapas configuradas
            </Badge>
          </div>
        </div>

        {/* Stages list */}
        {!selectedPipelineId ? (
          <div className="text-center py-16">
            <ArrowRightLeft className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Selecione um funil para configurar as regras</p>
          </div>
        ) : stagesQ.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse border-border/30">
                <CardContent className="p-4">
                  <div className="h-5 bg-muted/30 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-muted/20 rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stages.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma etapa encontrada neste funil</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(stages as Array<{ id: number; name: string; color: string | null; orderIndex: number; isWon: boolean; isLost: boolean }>)
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((stage) => {
                const rule = ruleByStage.get(stage.id);
                const assignedUser = rule ? userMap.get(rule.assignToUserId) : null;
                const isConfigured = !!rule;

                return (
                  <Card
                    key={stage.id}
                    className={`border-border/40 transition-all ${
                      isConfigured ? "border-blue-500/30 bg-blue-500/5" : ""
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Stage indicator */}
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: stage.color || "#6b7280" }}
                          />
                          <div>
                            <span className="text-sm font-medium text-foreground">{stage.name}</span>
                            {(stage.isWon || stage.isLost) && (
                              <Badge
                                variant="outline"
                                className={`ml-2 text-[9px] h-4 px-1 ${
                                  stage.isWon ? "text-emerald-400 border-emerald-500/30" : "text-red-400 border-red-500/30"
                                }`}
                              >
                                {stage.isWon ? "Ganhou" : "Perdeu"}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />

                        {/* User selector */}
                        <div className="flex-1">
                          <Select
                            value={rule ? String(rule.assignToUserId) : "none"}
                            onValueChange={(v) => {
                              if (v === "none") {
                                handleRemoveRule(stage.id);
                              } else {
                                handleAssignUser(stage.id, Number(v));
                              }
                            }}
                          >
                            <SelectTrigger className={`w-full ${isConfigured ? "border-blue-500/30" : ""}`}>
                              <SelectValue placeholder="Sem regra (manter responsável atual)">
                                {rule && assignedUser ? (
                                  <div className="flex items-center gap-2">
                                    <Users className="h-3.5 w-3.5 text-blue-400" />
                                    <span>{assignedUser.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Sem regra (manter responsável atual)</span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                <span className="text-muted-foreground">Sem regra (manter responsável atual)</span>
                              </SelectItem>
                              {activeUsers.map((u) => (
                                <SelectItem key={u.id} value={String(u.id)}>
                                  <div className="flex items-center gap-2">
                                    <Users className="h-3.5 w-3.5" />
                                    <span>{u.name}</span>
                                    <span className="text-muted-foreground text-xs">({u.email})</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Toggle & Delete */}
                        {isConfigured && rule && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Switch
                              checked={rule.isActive}
                              onCheckedChange={() => handleToggleActive(rule)}
                              className="data-[state=checked]:bg-blue-500"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-400"
                              onClick={() => handleDelete(rule)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        )}

        {/* Footer info */}
        <div className="mt-8 p-4 rounded-lg bg-muted/10 border border-border/30">
          <div className="flex items-start gap-3">
            <Shield className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p className="mb-1">
                <strong className="text-foreground">Dica:</strong> A reatribuição acontece automaticamente ao arrastar a negociação no Kanban
                ou ao mover via botão. O responsável anterior é substituído e a mudança fica registrada no histórico.
              </p>
              <p>
                Se uma etapa não tiver regra configurada, o responsável da negociação permanece inalterado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminOnlyGuard>
  );
}
