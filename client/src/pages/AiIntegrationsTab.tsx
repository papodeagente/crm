import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Brain, Plus, Eye, EyeOff, Trash2, Edit2, CheckCircle2, XCircle,
  Loader2, Sparkles, Cpu, TestTube, AlertTriangle,
} from "lucide-react";
// ── Provider icons ──────────────────────────────────────────
function ProviderIcon({ provider, size = 20 }: { provider: string; size?: number }) {
  if (provider === "openai") {
    return (
      <div className="flex items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/15 to-teal-500/15" style={{ width: size + 12, height: size + 12 }}>
        <Sparkles className="text-emerald-500" style={{ width: size, height: size }} />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/15 to-amber-500/15" style={{ width: size + 12, height: size + 12 }}>
      <Cpu className="text-orange-500" style={{ width: size, height: size }} />
    </div>
  );
}

function providerLabel(p: string) {
  return p === "openai" ? "OpenAI" : "Anthropic Claude";
}

// ── Main Component ──────────────────────────────────────────
export default function AiIntegrationsTab() {
  const utils = trpc.useUtils();

  // Queries
  const listQ = trpc.ai.list.useQuery();

  // Mutations
  const createMut = trpc.ai.create.useMutation({
    onSuccess: () => { utils.ai.list.invalidate(); toast.success("Integração criada com sucesso!"); setDialogOpen(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.ai.update.useMutation({
    onSuccess: () => { utils.ai.list.invalidate(); toast.success("Integração atualizada!"); setDialogOpen(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.ai.delete.useMutation({
    onSuccess: () => { utils.ai.list.invalidate(); toast.success("Integração removida."); },
    onError: (e) => toast.error(e.message),
  });
  const testMut = trpc.ai.testKey.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Chave API válida! Conexão bem-sucedida.");
        setTestResult("success");
      } else {
        toast.error(`Falha na validação: ${data.error}`);
        setTestResult("error");
      }
    },
    onError: (e) => { toast.error(e.message); setTestResult("error"); },
  });

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Form state — simple: provider, apiKey, model
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "success" | "error">("idle");
  const [maskedKey, setMaskedKey] = useState("");

  // Models query
  const modelsQ = trpc.ai.models.useQuery({ provider });

  const resetForm = () => {
    setProvider("openai");
    setApiKey("");
    setMaskedKey("");
    setModel("");
    setIsActive(true);
    setShowKey(false);
    setTestResult("idle");
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (integration: any) => {
    setEditingId(integration.id);
    setProvider(integration.provider);
    setApiKey("");
    setMaskedKey(integration.apiKey || "");
    setModel(integration.defaultModel);
    setIsActive(integration.isActive);
    setShowKey(false);
    setTestResult("idle");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!model) { toast.error("Selecione um modelo."); return; }
    if (editingId) {
      const data: any = { id: editingId, defaultModel: model, isActive };
      if (apiKey.length >= 10) data.apiKey = apiKey;
      updateMut.mutate(data);
    } else {
      if (!apiKey || apiKey.length < 10) { toast.error("Insira uma chave API válida (mínimo 10 caracteres)."); return; }
      createMut.mutate({
        provider,
        apiKey,
        defaultModel: model,
        isActive,
      });
    }
  };

  const handleTest = () => {
    if (!apiKey || apiKey.length < 10) { toast.error("Insira a chave API para testar."); return; }
    if (!model) { toast.error("Selecione um modelo para testar."); return; }
    setTestResult("idle");
    testMut.mutate({ provider, apiKey, model });
  };

  const integrations = listQ.data || [];
  const openaiIntegrations = integrations.filter((i: any) => i.provider === "openai");
  const anthropicIntegrations = integrations.filter((i: any) => i.provider === "anthropic");

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
        <div className="relative p-6">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-fuchsia-500/5" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                <Brain className="h-6 w-6 text-violet-500" />
              </div>
              <div>
                <h3 className="text-[16px] font-bold">Inteligência Artificial</h3>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Conecte sua API da OpenAI ou Anthropic Claude para usar IA no sistema.
                </p>
              </div>
            </div>
            <Button onClick={openCreate} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
              <Plus className="h-4 w-4" />
              Conectar IA
            </Button>
          </div>
        </div>
      </Card>

      {/* Integrations list */}
      {listQ.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : integrations.length === 0 ? (
        <Card className="border border-border/40 shadow-none rounded-xl">
          <div className="p-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <Brain className="h-8 w-8 text-violet-500/40" />
            </div>
            <p className="text-[15px] font-semibold text-muted-foreground/60">Nenhuma IA conectada</p>
            <p className="text-[13px] text-muted-foreground/40 mt-1.5 max-w-md mx-auto">
              Adicione sua chave API da OpenAI ou Anthropic para habilitar funcionalidades de IA.
            </p>
            <Button onClick={openCreate} variant="outline" className="mt-5 gap-2">
              <Plus className="h-4 w-4" />
              Conectar IA
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {openaiIntegrations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <h4 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">OpenAI</h4>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {openaiIntegrations.map((i: any) => (
                  <IntegrationCard key={i.id} integration={i} onEdit={() => openEdit(i)} onDelete={() => setDeleteConfirm(i.id)} onToggle={(active) => updateMut.mutate({ id: i.id, isActive: active })} />
                ))}
              </div>
            </div>
          )}

          {anthropicIntegrations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-orange-500" />
                <h4 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Anthropic Claude</h4>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {anthropicIntegrations.map((i: any) => (
                  <IntegrationCard key={i.id} integration={i} onEdit={() => openEdit(i)} onDelete={() => setDeleteConfirm(i.id)} onToggle={(active) => updateMut.mutate({ id: i.id, isActive: active })} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-[480px] bg-background border-border/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[16px]">
              <Brain className="h-5 w-5 text-violet-500" />
              {editingId ? "Editar Conexão de IA" : "Conectar IA"}
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              {editingId ? "Atualize a chave API ou modelo." : "Insira sua chave API para conectar."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Provider Selection */}
            {!editingId && (
              <div className="space-y-2">
                <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Provedor</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setProvider("openai"); setModel(""); }}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      provider === "openai"
                        ? "border-emerald-500/50 bg-emerald-500/5"
                        : "border-border/40 hover:border-border/60 bg-transparent"
                    }`}
                  >
                    <ProviderIcon provider="openai" size={18} />
                    <div className="text-left">
                      <p className="text-[13px] font-semibold">OpenAI</p>
                      <p className="text-[11px] text-muted-foreground">GPT-5.4, GPT-5 Mini</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProvider("anthropic"); setModel(""); }}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      provider === "anthropic"
                        ? "border-orange-500/50 bg-orange-500/5"
                        : "border-border/40 hover:border-border/60 bg-transparent"
                    }`}
                  >
                    <ProviderIcon provider="anthropic" size={18} />
                    <div className="text-left">
                      <p className="text-[13px] font-semibold">Anthropic</p>
                      <p className="text-[11px] text-muted-foreground">Claude Opus, Sonnet, Haiku</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* API Key */}
            <div className="space-y-2">
              <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                Chave API
              </Label>
              {editingId && maskedKey && !apiKey && (
                <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Chave atual: <span className="font-mono">{maskedKey}</span> — preencha apenas se quiser trocar
                </p>
              )}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setTestResult("idle"); }}
                    placeholder={editingId && maskedKey ? maskedKey : (provider === "openai" ? "sk-..." : "sk-ant-...")}
                    className="font-mono text-[12px] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5 h-9"
                  onClick={handleTest}
                  disabled={testMut.isPending || !apiKey}
                >
                  {testMut.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : testResult === "success" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : testResult === "error" ? (
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <TestTube className="h-3.5 w-3.5" />
                  )}
                  Testar
                </Button>
              </div>
              {testResult === "success" && (
                <p className="text-[11px] text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Conexão bem-sucedida
                </p>
              )}
              {testResult === "error" && (
                <p className="text-[11px] text-red-500 flex items-center gap-1">
                  <XCircle className="h-3 w-3" /> Falha na validação — verifique a chave
                </p>
              )}
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="text-[13px]">
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {(modelsQ.data || []).map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-[11px] text-muted-foreground">({m.contextWindow})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {model && modelsQ.data && (
                <p className="text-[11px] text-muted-foreground">
                  {modelsQ.data.find((m: any) => m.id === model)?.description}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
            >
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Salvar" : "Conectar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="sm:max-w-[400px] bg-background border-border/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px] text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Remover Conexão
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              Tem certeza que deseja remover esta conexão de IA? Funcionalidades que dependem dela podem parar de funcionar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteConfirm) { deleteMut.mutate({ id: deleteConfirm }); setDeleteConfirm(null); } }}
              disabled={deleteMut.isPending}
              className="gap-2"
            >
              {deleteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Integration Card ────────────────────────────────────────
function IntegrationCard({ integration, onEdit, onDelete, onToggle }: {
  integration: any;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (active: boolean) => void;
}) {
  return (
    <Card className="border border-border/40 shadow-none rounded-xl hover:shadow-md transition-all group">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <ProviderIcon provider={integration.provider} size={18} />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-semibold">{providerLabel(integration.provider)}</p>
                {integration.isActive ? (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1">
                    <span className="h-1 w-1 rounded-full bg-emerald-500" />Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-muted text-muted-foreground border-border/40 gap-1">
                    Desconectado
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Switch
            checked={integration.isActive}
            onCheckedChange={onToggle}
            className="scale-90"
          />
        </div>

        <div className="mt-4 space-y-2 bg-muted/30 rounded-lg p-3">
          <div className="flex justify-between text-[12px]">
            <span className="text-muted-foreground">Modelo:</span>
            <span className="font-mono font-medium">{integration.defaultModel}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-muted-foreground">Chave API:</span>
            <span className="font-mono text-muted-foreground/70">{integration.apiKey}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={onEdit}>
            <Edit2 className="h-3 w-3" /> Editar
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[12px] text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={onDelete}>
            <Trash2 className="h-3 w-3" /> Remover
          </Button>
        </div>
      </div>
    </Card>
  );
}
