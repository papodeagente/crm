import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, Check, RefreshCw, Plus, Pencil, Trash2,
  CheckCircle2, Circle, AlertTriangle, Megaphone, Zap, Shield,
  ChevronDown, ChevronUp, Eye, EyeOff, Loader2, MessageSquare,
  Phone, XCircle, BarChart3, Settings2, FileText, Users,
} from "lucide-react";
import { formatFullDateTime } from "../../../shared/dateUtils";
// ─── Types ───────────────────────────────────────────────

interface ConfigFormData {
  name: string;
  defaultPipelineId: number | null;
  defaultStageId: number | null;
  defaultSource: string;
  defaultCampaign: string;
  defaultOwnerUserId: number | null;
  assignmentTeamId: number | null;
  assignmentMode: "specific_user" | "random_all" | "random_team";
  autoWhatsAppEnabled: boolean;
  autoWhatsAppMessageTemplate: string;
  dealNameTemplate: string;
  autoProductId: number | null;
}

const DEFAULT_FORM: ConfigFormData = {
  name: "",
  defaultPipelineId: null,
  defaultStageId: null,
  defaultSource: "",
  defaultCampaign: "",
  defaultOwnerUserId: null,
  assignmentTeamId: null,
  assignmentMode: "random_all",
  autoWhatsAppEnabled: false,
  autoWhatsAppMessageTemplate: "",
  dealNameTemplate: "",
  autoProductId: null,
};

const DEFAULT_TEMPLATE = `Olá {primeiro_nome}! 👋

Recebemos seu cadastro e estamos muito felizes em ter você conosco.

Um de nossos consultores entrará em contato em breve para te ajudar.

Enquanto isso, posso te ajudar com algo?`;

// ─── Template Preview ────────────────────────────────────

function interpolateTemplate(template: string): string {
  return template
    .replace(/\{nome\}/gi, "João Silva")
    .replace(/\{primeiro_nome\}/gi, "João")
    .replace(/\{telefone\}/gi, "+5511999887766")
    .replace(/\{email\}/gi, "joao@email.com")
    .replace(/\{origem\}/gi, "rdstation")
    .replace(/\{campanha\}/gi, "black-friday");
}

// ─── Main Component ──────────────────────────────────────

export default function RDStationIntegration() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [, setLocation] = useLocation();

  if (!adminLoading && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4 py-20">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">
          A integração com RD Station é exclusiva para administradores.
        </p>
        <button
          onClick={() => setLocation("/settings")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Voltar às Configurações
        </button>
      </div>
    );
  }

  // UI State
  const [showForm, setShowForm] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState<number | null>(null);
  const [form, setForm] = useState<ConfigFormData>(DEFAULT_FORM);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showTokenId, setShowTokenId] = useState<number | null>(null);
  const [expandedLogsId, setExpandedLogsId] = useState<number | null>(null);
  const [logFilter, setLogFilter] = useState<"success" | "failed" | "duplicate" | undefined>(undefined);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showDealNamePreview, setShowDealNamePreview] = useState(false);
  const [configTasksCache, setConfigTasksCache] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDays, setNewTaskDueDays] = useState(0);
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");

  // Queries
  const configsQuery = trpc.rdStation.listConfigs.useQuery();
  const statsQuery = trpc.rdStation.getStats.useQuery();
  const pipelinesQuery = trpc.rdStation.listPipelines.useQuery();
  const teamQuery = trpc.rdStation.listTeamMembers.useQuery();
  const teamsQuery = trpc.rdStation.listTeamsForAssignment.useQuery();
  const waStatusQuery = trpc.rdStation.getWhatsAppStatus.useQuery();
  const productsQuery = trpc.rdStation.listProducts.useQuery();

  const selectedPipelineId = form.defaultPipelineId;
  const stagesQuery = trpc.rdStation.listStages.useQuery(
    { pipelineId: selectedPipelineId! },
    { enabled: !!selectedPipelineId }
  );

  const logsQuery = trpc.rdStation.getConfigLogs.useQuery(
    { configId: expandedLogsId!, status: logFilter, limit: 20 },
    { enabled: !!expandedLogsId }
  );

  const utils = trpc.useUtils();

  // Mutations
  const createMutation = trpc.rdStation.createConfig.useMutation({
    onSuccess: () => {
      utils.rdStation.listConfigs.invalidate();
      setShowForm(false);
      setForm(DEFAULT_FORM);
      toast.success("Configuração criada com sucesso!");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.rdStation.updateConfig.useMutation({
    onSuccess: () => {
      utils.rdStation.listConfigs.invalidate();
      setShowForm(false);
      setEditingConfigId(null);
      setForm(DEFAULT_FORM);
      toast.success("Configuração atualizada!");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.rdStation.deleteConfig.useMutation({
    onSuccess: () => {
      utils.rdStation.listConfigs.invalidate();
      utils.rdStation.getStats.invalidate();
      setDeleteConfirmId(null);
      toast.success("Configuração excluída.");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.rdStation.updateConfig.useMutation({
    onSuccess: () => {
      utils.rdStation.listConfigs.invalidate();
    },
  });

  const regenTokenMutation = trpc.rdStation.regenerateConfigToken.useMutation({
    onSuccess: () => {
      utils.rdStation.listConfigs.invalidate();
      toast.success("Token regenerado! Atualize a URL no RD Station.");
    },
    onError: (err) => toast.error(err.message),
  });

  const configTasksQuery = trpc.rdStation.listConfigTasks.useQuery(
    { configId: editingConfigId!},
    { enabled: !!editingConfigId,
      onSuccess: (data: any) => setConfigTasksCache(data || []),
    } as any
  );

  const addTaskMutation = trpc.rdStation.addConfigTask.useMutation({
    onSuccess: (task) => {
      setConfigTasksCache((prev) => [...prev, task]);
      setNewTaskTitle("");
      setNewTaskDueDays(0);
      setNewTaskPriority("medium");
      toast.success("Tarefa adicionada!");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeTaskMutation = trpc.rdStation.removeConfigTask.useMutation({
    onSuccess: (_, vars) => {
      setConfigTasksCache((prev) => prev.filter((t) => t.id !== vars.taskId));
      toast.success("Tarefa removida.");
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── Helpers ───────────────────────────────────────────

  const configs = configsQuery.data || [];

  function openCreateForm() {
    setEditingConfigId(null);
    setForm({ ...DEFAULT_FORM, autoWhatsAppMessageTemplate: DEFAULT_TEMPLATE });
    setShowForm(true);
    setConfigTasksCache([]);
  }

  function openEditForm(config: any) {
    setEditingConfigId(config.id);
    setForm({
      name: config.name || `Configuração #${config.id}`,
      defaultPipelineId: config.defaultPipelineId ?? null,
      defaultStageId: config.defaultStageId ?? null,
      defaultSource: config.defaultSource || "",
      defaultCampaign: config.defaultCampaign || "",
      defaultOwnerUserId: config.defaultOwnerUserId ?? null,
      assignmentTeamId: config.assignmentTeamId ?? null,
      assignmentMode: config.assignmentMode || "random_all",
      autoWhatsAppEnabled: config.autoWhatsAppEnabled ?? false,
      autoWhatsAppMessageTemplate: config.autoWhatsAppMessageTemplate || DEFAULT_TEMPLATE,
      dealNameTemplate: config.dealNameTemplate || "",
      autoProductId: config.autoProductId ?? null,
    });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("Informe um nome para a configuração.");
      return;
    }
    if (editingConfigId) {
      updateMutation.mutate({
        configId: editingConfigId,
        name: form.name,
        defaultPipelineId: form.defaultPipelineId,
        defaultStageId: form.defaultStageId,
        defaultSource: form.defaultSource || null,
        defaultCampaign: form.defaultCampaign || null,
        defaultOwnerUserId: form.defaultOwnerUserId,
        assignmentTeamId: form.assignmentTeamId,
        assignmentMode: form.assignmentMode,
        autoWhatsAppEnabled: form.autoWhatsAppEnabled,
        autoWhatsAppMessageTemplate: form.autoWhatsAppMessageTemplate || null,
        dealNameTemplate: form.dealNameTemplate || null,
        autoProductId: form.autoProductId,
      });
    } else {
      createMutation.mutate({
        name: form.name,
        defaultPipelineId: form.defaultPipelineId ?? undefined,
        defaultStageId: form.defaultStageId ?? undefined,
        defaultSource: form.defaultSource || undefined,
        defaultCampaign: form.defaultCampaign || undefined,
        defaultOwnerUserId: form.defaultOwnerUserId ?? undefined,
        assignmentTeamId: form.assignmentTeamId ?? undefined,
        assignmentMode: form.assignmentMode,
        autoWhatsAppEnabled: form.autoWhatsAppEnabled,
        autoWhatsAppMessageTemplate: form.autoWhatsAppMessageTemplate || undefined,
        dealNameTemplate: form.dealNameTemplate || undefined,
        autoProductId: form.autoProductId ?? undefined,
      });
    }
  }

  function copyWebhookUrl(config: any) {
    const url = `${window.location.origin}/api/webhooks/rdstation?token=${config.webhookToken}`;
    navigator.clipboard.writeText(url);
    setCopiedId(config.id);
    toast.success("URL copiada!");
    setTimeout(() => setCopiedId(null), 2000);
  }

  const previewMessage = useMemo(
    () => interpolateTemplate(form.autoWhatsAppMessageTemplate || ""),
    [form.autoWhatsAppMessageTemplate]
  );

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-purple-500" />
            RD Station Marketing
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie múltiplas configurações de webhook para receber leads automaticamente.
          </p>
        </div>
        <Button onClick={openCreateForm} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Configuração
        </Button>
      </div>

      {/* Stats Summary */}
      {statsQuery.data && statsQuery.data.total > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total", value: statsQuery.data.total, color: "text-foreground" },
            { label: "Sucesso", value: statsQuery.data.success, color: "text-emerald-500" },
            { label: "Falha", value: statsQuery.data.failed, color: "text-red-500" },
            { label: "Duplicados", value: statsQuery.data.duplicate, color: "text-amber-500" },
          ].map((s) => (
            <Card key={s.label} className="border-border/50">
              <CardContent className="p-3 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* WhatsApp Status Banner */}
      {waStatusQuery.data && !waStatusQuery.data.connected && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-6 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="text-sm">
            <strong className="text-amber-600 dark:text-amber-400">WhatsApp não conectado.</strong>{" "}
            <span className="text-muted-foreground">
              Para envio automático de mensagens, conecte seu WhatsApp na página de{" "}
              <button onClick={() => setLocation("/whatsapp")} className="underline text-amber-600 dark:text-amber-400">
                Configurações do WhatsApp
              </button>.
            </span>
          </div>
        </div>
      )}

      {/* Configs List */}
      {configsQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : configs.length === 0 ? (
        <Card className="border-dashed border-2 border-border/50">
          <CardContent className="py-12 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-1">Nenhuma configuração criada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie sua primeira configuração para começar a receber leads do RD Station Marketing.
            </p>
            <Button onClick={openCreateForm} className="gap-2">
              <Plus className="h-4 w-4" /> Criar Configuração
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {configs.map((config) => (
            <Card key={config.id} className={`border-border/50 transition-all ${!config.isActive ? "opacity-60" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${config.isActive ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                    <CardTitle className="text-base">
                      {config.name || `Configuração #${config.id}`}
                    </CardTitle>
                    {config.autoWhatsAppEnabled && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <MessageSquare className="h-3 w-3" /> Auto-WhatsApp
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.isActive}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ configId: config.id, isActive: checked })
                      }
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditForm(config)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmId(config.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="ml-5 mt-1">
                  {config.totalLeadsReceived} leads recebidos
                  {config.lastLeadReceivedAt && (
                    <> · Último: {formatFullDateTime(config.lastLeadReceivedAt)}</>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {/* Webhook URL */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">URL do Webhook</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={() => setShowTokenId(showTokenId === config.id ? null : config.id)}
                      >
                        {showTokenId === config.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {showTokenId === config.id ? "Ocultar" : "Mostrar"}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => copyWebhookUrl(config)}>
                        {copiedId === config.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        {copiedId === config.id ? "Copiado!" : "Copiar"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={() => regenTokenMutation.mutate({ configId: config.id})}
                        disabled={regenTokenMutation.isPending}
                      >
                        <RefreshCw className={`h-3 w-3 ${regenTokenMutation.isPending ? "animate-spin" : ""}`} />
                        Regenerar
                      </Button>
                    </div>
                  </div>
                  <code className="text-xs text-muted-foreground break-all block">
                    {showTokenId === config.id
                      ? `${window.location.origin}/api/webhooks/rdstation?token=${config.webhookToken}`
                      : `${window.location.origin}/api/webhooks/rdstation?token=${"•".repeat(16)}`}
                  </code>
                </div>

                {/* Config Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {config.defaultPipelineId && (
                    <div className="bg-muted/30 rounded px-2 py-1.5">
                      <span className="text-muted-foreground">Pipeline:</span>{" "}
                      <span className="text-foreground font-medium">
                        {pipelinesQuery.data?.find((p) => p.id === config.defaultPipelineId)?.name || `#${config.defaultPipelineId}`}
                      </span>
                    </div>
                  )}
                  {config.defaultSource && (
                    <div className="bg-muted/30 rounded px-2 py-1.5">
                      <span className="text-muted-foreground">Origem:</span>{" "}
                      <span className="text-foreground font-medium">{config.defaultSource}</span>
                    </div>
                  )}
                  {config.defaultCampaign && (
                    <div className="bg-muted/30 rounded px-2 py-1.5">
                      <span className="text-muted-foreground">Campanha:</span>{" "}
                      <span className="text-foreground font-medium">{config.defaultCampaign}</span>
                    </div>
                  )}
                  {(config.assignmentMode === "specific_user" || (!config.assignmentMode && config.defaultOwnerUserId)) && (
                    <div className="bg-muted/30 rounded px-2 py-1.5">
                      <span className="text-muted-foreground">Distribuição:</span>{" "}
                      <span className="text-foreground font-medium">
                        Usuário específico: {teamQuery.data?.find((m) => m.id === config.defaultOwnerUserId)?.name || `#${config.defaultOwnerUserId}`}
                      </span>
                    </div>
                  )}
                  {(config.assignmentMode === "random_team" || (!config.assignmentMode && config.assignmentTeamId && !config.defaultOwnerUserId)) && (
                    <div className="bg-violet-500/10 rounded px-2 py-1.5">
                      <span className="text-muted-foreground">Distribuição:</span>{" "}
                      <span className="text-violet-400 font-medium">
                        <Users className="h-3 w-3 inline mr-1" />
                        {teamsQuery.data?.find((t: any) => t.id === config.assignmentTeamId)?.name || `Equipe #${config.assignmentTeamId}`}
                        {" "}(round-robin)
                      </span>
                    </div>
                  )}
                  {(config.assignmentMode === "random_all" || (!config.assignmentMode && !config.defaultOwnerUserId && !config.assignmentTeamId)) && (
                    <div className="bg-muted/30 rounded px-2 py-1.5">
                      <span className="text-muted-foreground">Distribuição:</span>{" "}
                      <span className="text-foreground font-medium">Automático (round-robin geral)</span>
                    </div>
                  )}
                </div>

                {/* Logs Toggle */}
                <button
                  onClick={() => {
                    setExpandedLogsId(expandedLogsId === config.id ? null : config.id);
                    setLogFilter(undefined);
                  }}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full pt-1"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Histórico de recebimentos</span>
                  {expandedLogsId === config.id ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
                </button>

                {/* Logs Table */}
                {expandedLogsId === config.id && (
                  <div className="pt-2">
                    <div className="flex items-center gap-2 mb-3">
                      {[
                        { label: "Todos", value: undefined },
                        { label: "Sucesso", value: "success" as const },
                        { label: "Falha", value: "failed" as const },
                        { label: "Duplicado", value: "duplicate" as const },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => setLogFilter(opt.value)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                            logFilter === opt.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {logsQuery.isLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : !logsQuery.data?.logs.length ? (
                      <div className="text-center py-6 text-xs text-muted-foreground">
                        Nenhum lead recebido nesta configuração.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Status</th>
                              <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Nome</th>
                              <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">E-mail</th>
                              <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">WhatsApp</th>
                              <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {logsQuery.data.logs.map((log) => (
                              <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                                <td className="py-1.5 px-2">
                                  {log.status === "success" && (
                                    <Badge variant="default" className="bg-emerald-500/20 text-emerald-600 border-0 text-[10px]">OK</Badge>
                                  )}
                                  {log.status === "failed" && (
                                    <Badge variant="destructive" className="text-[10px]">Falha</Badge>
                                  )}
                                  {log.status === "duplicate" && (
                                    <Badge variant="secondary" className="text-[10px]">Dup.</Badge>
                                  )}
                                </td>
                                <td className="py-1.5 px-2 text-foreground">{log.name || "—"}</td>
                                <td className="py-1.5 px-2 text-muted-foreground">{log.email || "—"}</td>
                                <td className="py-1.5 px-2">
                                  {log.autoWhatsAppStatus === "sent" && (
                                    <Badge variant="default" className="bg-emerald-500/20 text-emerald-600 border-0 text-[10px] gap-0.5">
                                      <Phone className="h-2.5 w-2.5" /> Enviado
                                    </Badge>
                                  )}
                                  {log.autoWhatsAppStatus === "failed" && (
                                    <Badge variant="destructive" className="text-[10px] gap-0.5">
                                      <Phone className="h-2.5 w-2.5" /> Falha
                                    </Badge>
                                  )}
                                  {log.autoWhatsAppStatus === "skipped" && (
                                    <Badge variant="secondary" className="text-[10px]">Pulado</Badge>
                                  )}
                                  {!log.autoWhatsAppStatus && (
                                    <span className="text-muted-foreground/50">—</span>
                                  )}
                                </td>
                                <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">
                                  {formatFullDateTime(log.createdAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Setup Guide (always visible below configs) */}
      <Card className="mt-6 border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            Como configurar no RD Station
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <p className="text-muted-foreground">
                Acesse <strong>RD Station → Integrações → Webhooks</strong> e clique em <strong>"Criar Webhook"</strong>.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <p className="text-muted-foreground">
                Cole a <strong>URL do Webhook</strong> copiada acima no campo de URL.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <p className="text-muted-foreground">
                Selecione o gatilho <strong>"Conversão"</strong>. Deixe em branco para receber todos os leads, ou selecione conversões específicas.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shrink-0">4</div>
              <p className="text-muted-foreground">
                Clique em <strong>"Salvar"</strong> e depois <strong>"Verificar"</strong> para testar a conexão.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Link to Field Mappings */}
      <div className="mt-4 text-center">
        <Button variant="link" className="text-sm gap-2" onClick={() => setLocation("/settings/rdstation/mappings")}>
          <Settings2 className="h-4 w-4" /> Configurar mapeamento de campos
        </Button>
      </div>

      {/* ─── Create/Edit Dialog ─────────────────────────── */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingConfigId(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{editingConfigId ? "Editar Configuração" : "Nova Configuração"}</DialogTitle>
            <DialogDescription>
              {editingConfigId
                ? "Atualize os parâmetros desta configuração de webhook."
                : "Crie uma nova configuração de webhook para receber leads do RD Station."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
            {/* Name */}
            <div>
              <Label htmlFor="cfg-name">Nome da configuração *</Label>
              <Input
                id="cfg-name"
                placeholder="Ex: Formulário Landing Page"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Pipeline */}
            <div>
              <Label>Pipeline de destino</Label>
              <Select
                value={form.defaultPipelineId ? String(form.defaultPipelineId) : "auto"}
                onValueChange={(v) => {
                  const pid = v === "auto" ? null : Number(v);
                  setForm({ ...form, defaultPipelineId: pid, defaultStageId: null });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pipeline padrão (automático)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático (pipeline padrão)</SelectItem>
                  {pipelinesQuery.data?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stage (depends on pipeline) */}
            {form.defaultPipelineId && (
              <div>
                <Label>Etapa de destino</Label>
                <Select
                  value={form.defaultStageId ? String(form.defaultStageId) : "auto"}
                  onValueChange={(v) => setForm({ ...form, defaultStageId: v === "auto" ? null : Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Primeira etapa (automático)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático (primeira etapa)</SelectItem>
                    {stagesQuery.data?.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Source & Campaign */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cfg-source">Origem padrão</Label>
                <Input
                  id="cfg-source"
                  placeholder="Ex: rdstation"
                  value={form.defaultSource}
                  onChange={(e) => setForm({ ...form, defaultSource: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="cfg-campaign">Campanha padrão</Label>
                <Input
                  id="cfg-campaign"
                  placeholder="Ex: black-friday"
                  value={form.defaultCampaign}
                  onChange={(e) => setForm({ ...form, defaultCampaign: e.target.value })}
                />
              </div>
            </div>

            {/* Assignment Mode */}
            <div className="border border-border/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-500" />
                <Label className="font-medium">Distribuição de leads</Label>
              </div>
              <div>
                <Label className="text-xs">Modo de atribuição</Label>
                <Select
                  value={form.assignmentMode}
                  onValueChange={(v) => {
                    const mode = v as "specific_user" | "random_all" | "random_team";
                    if (mode === "random_all") {
                      setForm({ ...form, assignmentMode: mode, defaultOwnerUserId: null, assignmentTeamId: null });
                    } else if (mode === "specific_user") {
                      setForm({ ...form, assignmentMode: mode, assignmentTeamId: null });
                    } else if (mode === "random_team") {
                      setForm({ ...form, assignmentMode: mode, defaultOwnerUserId: null });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o modo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random_all">Automático (round-robin geral)</SelectItem>
                    <SelectItem value="specific_user">Usuário específico</SelectItem>
                    <SelectItem value="random_team">Aleatório por equipe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Show user selector when mode is "specific_user" */}
              {form.assignmentMode === "specific_user" && (
                <div>
                  <Label className="text-xs">Responsável</Label>
                  <Select
                    value={form.defaultOwnerUserId ? String(form.defaultOwnerUserId) : ""}
                    onValueChange={(v) => setForm({ ...form, defaultOwnerUserId: v ? Number(v) : null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamQuery.data?.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Show team selector when mode is "random_team" */}
              {form.assignmentMode === "random_team" ? (
                <div>
                  <Label className="text-xs">Equipe</Label>
                  <Select
                    value={form.assignmentTeamId ? String(form.assignmentTeamId) : ""}
                    onValueChange={(v) => setForm({ ...form, assignmentTeamId: v ? Number(v) : null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a equipe" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamsQuery.data?.map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Os leads serão distribuídos aleatoriamente entre os membros ativos desta equipe.</p>
                </div>
              ) : null}
            </div>

            {/* Deal Name Template */}
            <div className="border border-border/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <Label className="font-medium">Nome personalizado da negociação</Label>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="cfg-dealname" className="text-xs">Template do nome</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setShowDealNamePreview(!showDealNamePreview)}>
                    <Eye className="h-3 w-3" /> {showDealNamePreview ? "Ocultar" : "Preview"}
                  </Button>
                </div>
                <Input
                  id="cfg-dealname"
                  placeholder="Ex: {primeiro_nome} - {campanha}"
                  value={form.dealNameTemplate}
                  onChange={(e) => setForm({ ...form, dealNameTemplate: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Variáveis: {"\u007Bnome\u007D"} {"\u007Bprimeiro_nome\u007D"} {"\u007Bemail\u007D"} {"\u007Btelefone\u007D"} {"\u007Borigem\u007D"} {"\u007Bcampanha\u007D"} &mdash; Deixe vazio para usar o nome padrão.
                </p>
              </div>
              {showDealNamePreview && form.dealNameTemplate && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground mb-1 font-medium">Preview:</div>
                  <div className="text-sm text-foreground">{interpolateTemplate(form.dealNameTemplate)}</div>
                </div>
              )}
            </div>

            {/* Auto Product */}
            <div className="border border-border/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <Label className="font-medium">Produto automático</Label>
              </div>
              <Select
                value={form.autoProductId ? String(form.autoProductId) : "none"}
                onValueChange={(v) => setForm({ ...form, autoProductId: v === "none" ? null : Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum (não vincular produto)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (não vincular produto)</SelectItem>
                  {productsQuery.data?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} {p.basePriceCents ? `— R$${(p.basePriceCents / 100).toFixed(2)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                O produto selecionado será vinculado automaticamente a cada negociação criada por este webhook.
              </p>
            </div>

            {/* Auto Tasks */}
            {editingConfigId && (
              <div className="border border-border/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-violet-500" />
                  <Label className="font-medium">Tarefas automáticas</Label>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Tarefas criadas automaticamente para cada lead recebido por este webhook.
                </p>

                {/* Existing tasks */}
                {configTasksCache.length > 0 && (
                  <div className="space-y-2">
                    {configTasksCache.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 bg-muted/30 rounded px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{task.title}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {task.dueDaysOffset === 0 ? "Mesmo dia" : `+${task.dueDaysOffset} dia(s)`}
                            {task.dueTime ? ` às ${task.dueTime}` : ""}
                            {" • "}
                            {task.priority === "urgent" ? "Urgente" : task.priority === "high" ? "Alta" : task.priority === "medium" ? "Média" : "Baixa"}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeTaskMutation.mutate({ taskId: task.id})}
                          disabled={removeTaskMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new task */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor="new-task-title" className="text-xs">Título da tarefa</Label>
                    <Input
                      id="new-task-title"
                      placeholder="Ex: Ligar para o lead"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                    />
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Dias</Label>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={newTaskDueDays}
                      onChange={(e) => setNewTaskDueDays(Number(e.target.value))}
                    />
                  </div>
                  <div className="w-28">
                    <Label className="text-xs">Prioridade</Label>
                    <Select value={newTaskPriority} onValueChange={(v: any) => setNewTaskPriority(v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    className="h-9 gap-1"
                    disabled={!newTaskTitle.trim() || addTaskMutation.isPending}
                    onClick={() => {
                      if (!newTaskTitle.trim() || !editingConfigId) return;
                      addTaskMutation.mutate({
                        configId: editingConfigId,
                        title: newTaskTitle.trim(),
                        dueDaysOffset: newTaskDueDays,
                        priority: newTaskPriority,
                      });
                    }}
                  >
                    {addTaskMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Adicionar
                  </Button>
                </div>
                {!editingConfigId && (
                  <p className="text-[10px] text-amber-500">Salve a configuração primeiro para adicionar tarefas.</p>
                )}
              </div>
            )}

            {/* Auto WhatsApp */}
            <div className="border border-border/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-500" />
                  <Label className="font-medium">Envio automático de WhatsApp</Label>
                </div>
                <Switch
                  checked={form.autoWhatsAppEnabled}
                  onCheckedChange={(checked) => setForm({ ...form, autoWhatsAppEnabled: checked })}
                />
              </div>

              {form.autoWhatsAppEnabled && (
                <>
                  {!waStatusQuery.data?.connected && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      WhatsApp não conectado. Conecte antes de ativar o envio automático.
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="cfg-template" className="text-xs">Template da mensagem</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={() => setShowPreview(!showPreview)}
                      >
                        <Eye className="h-3 w-3" /> {showPreview ? "Ocultar preview" : "Ver preview"}
                      </Button>
                    </div>
                    <Textarea
                      id="cfg-template"
                      rows={5}
                      placeholder="Olá {primeiro_nome}! Recebemos seu cadastro..."
                      value={form.autoWhatsAppMessageTemplate}
                      onChange={(e) => setForm({ ...form, autoWhatsAppMessageTemplate: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Variáveis: {"{nome}"} {"{primeiro_nome}"} {"{telefone}"} {"{email}"} {"{origem}"} {"{campanha}"}
                    </p>
                  </div>

                  {showPreview && form.autoWhatsAppMessageTemplate && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                      <div className="text-[10px] text-muted-foreground mb-1 font-medium">Preview (dados fictícios):</div>
                      <div className="text-sm text-foreground whitespace-pre-wrap">{previewMessage}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingConfigId(null); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingConfigId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─────────────────── */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir configuração?</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. A URL do webhook deixará de funcionar imediatamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate({ configId: deleteConfirmId})}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
