import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft, Sparkles, MessageSquare, FileText, BarChart3,
  Save, Loader2, Trash2, Info, Brain,
} from "lucide-react";

// ─── Feature config definitions ───
const FEATURES = [
  {
    key: "suggestion" as const,
    label: "Sugestão de Resposta",
    icon: MessageSquare,
    description: "Instruções personalizadas para quando a IA sugere respostas no chat do WhatsApp.",
    placeholder: `Exemplo de instruções:\n\n- Sempre cumprimente o cliente pelo nome\n- Use linguagem informal e amigável\n- Mencione pacotes promocionais quando o cliente perguntar sobre destinos\n- Nunca prometa descontos sem aprovação do gestor\n- Priorize pacotes com saída nos próximos 30 dias`,
    gradient: "from-blue-500/15 to-cyan-500/15",
    iconColor: "text-blue-500",
  },
  {
    key: "summary" as const,
    label: "Resumo de Conversa",
    icon: FileText,
    description: "Instruções para quando a IA gera resumos de conversas do WhatsApp.",
    placeholder: `Exemplo de instrucoes:\n\n- Destaque o servico de interesse do cliente\n- Inclua datas de agendamento mencionadas\n- Mencione o orcamento informado pelo cliente\n- Identifique se ha urgencia na decisao\n- Liste dependentes mencionados (conjuge, filhos, etc.)`,
    gradient: "from-violet-500/15 to-purple-500/15",
    iconColor: "text-violet-500",
  },
  {
    key: "analysis" as const,
    label: "Análise de Negociação & Previsão",
    icon: BarChart3,
    description: "Instruções para análise de atendimento, relatório de metas e previsão inteligente na Home.",
    placeholder: `Exemplo de instrucoes:\n\n- Considere que nosso ciclo medio de fechamento e de 15 dias\n- Procedimentos premium tem margem maior, priorize na analise\n- Avalie se o atendente ofereceu servicos complementares\n- Considere sazonalidade (alta temporada: dez-fev, jul)\n- Nosso ticket medio ideal e R$ 500 por cliente`,
    gradient: "from-amber-500/15 to-orange-500/15",
    iconColor: "text-amber-500",
  },
];

type ConfigType = "suggestion" | "summary" | "analysis";

export default function AiTrainingSettings() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<ConfigType>("suggestion");
  const [instructions, setInstructions] = useState<Record<ConfigType, string>>({
    suggestion: "",
    summary: "",
    analysis: "",
  });
  const [dirty, setDirty] = useState<Record<ConfigType, boolean>>({
    suggestion: false,
    summary: false,
    analysis: false,
  });

  const utils = trpc.useUtils();

  // Fetch all training configs
  const listQ = trpc.ai.trainingConfigs.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  // Upsert mutation
  const upsertMut = trpc.ai.trainingConfigs.upsert.useMutation({
    onSuccess: () => {
      utils.ai.trainingConfigs.list.invalidate();
      toast.success("Instruções salvas com sucesso!");
      setDirty(prev => ({ ...prev, [activeTab]: false }));
    },
    onError: (e) => toast.error(`Erro ao salvar: ${e.message}`),
  });

  // Delete mutation
  const deleteMut = trpc.ai.trainingConfigs.delete.useMutation({
    onSuccess: () => {
      utils.ai.trainingConfigs.list.invalidate();
      toast.success("Instruções removidas.");
      setInstructions(prev => ({ ...prev, [activeTab]: "" }));
      setDirty(prev => ({ ...prev, [activeTab]: false }));
    },
    onError: (e) => toast.error(`Erro ao remover: ${e.message}`),
  });

  // Load existing configs into state
  useEffect(() => {
    if (listQ.data) {
      const newInstructions: Record<ConfigType, string> = { suggestion: "", summary: "", analysis: "" };
      for (const config of listQ.data) {
        if (config.configType === "suggestion" || config.configType === "summary" || config.configType === "analysis") {
          newInstructions[config.configType] = config.instructions || "";
        }
      }
      setInstructions(newInstructions);
      setDirty({ suggestion: false, summary: false, analysis: false });
    }
  }, [listQ.data]);

  const handleSave = (configType: ConfigType) => {
    const text = instructions[configType].trim();
    if (!text) {
      toast.error("Escreva as instruções antes de salvar.");
      return;
    }
    upsertMut.mutate({ configType, instructions: text });
  };

  const handleDelete = (configType: ConfigType) => {
    deleteMut.mutate({ configType });
  };

  const handleChange = (configType: ConfigType, value: string) => {
    setInstructions(prev => ({ ...prev, [configType]: value }));
    setDirty(prev => ({ ...prev, [configType]: true }));
  };

  const activeFeature = FEATURES.find(f => f.key === activeTab)!;
  const hasExisting = (key: ConfigType) => {
    return listQ.data?.some(c => c.configType === key && c.instructions);
  };

  return (
    <div className="page-content max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => setLocation("/settings")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Configurações
        </button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-purple-500/20">
            <Brain className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Treinamento de IA</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Personalize como a IA se comporta em cada funcionalidade do sistema
            </p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <Card className="mb-6 p-4 border-blue-500/20 bg-blue-500/5">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Como funciona o treinamento?</p>
            <p>
              As instruções que você definir aqui serão adicionadas automaticamente ao contexto da IA em cada funcionalidade.
              Isso permite que a IA entenda o seu negócio, seus produtos e seu processo de venda, gerando respostas e análises
              muito mais relevantes e personalizadas.
            </p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ConfigType)}>
        <TabsList className="mb-6 w-full justify-start">
          {FEATURES.map(f => (
            <TabsTrigger key={f.key} value={f.key} className="flex items-center gap-2">
              <f.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{f.label}</span>
              {hasExisting(f.key) && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  Configurado
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {FEATURES.map(f => (
          <TabsContent key={f.key} value={f.key}>
            <Card className="p-6">
              {/* Feature header */}
              <div className="flex items-start gap-4 mb-6">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${f.gradient} shrink-0`}>
                  <f.icon className={`h-6 w-6 ${f.iconColor}`} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{f.label}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{f.description}</p>
                </div>
              </div>

              {/* Instructions textarea */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Instruções personalizadas
                </label>
                <Textarea
                  value={instructions[f.key]}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={12}
                  className="font-mono text-sm resize-y min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  {instructions[f.key].length}/5000 caracteres
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <div>
                  {hasExisting(f.key) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(f.key)}
                      disabled={deleteMut.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Remover instruções
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {dirty[f.key] && (
                    <span className="text-xs text-amber-500 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Alterações não salvas
                    </span>
                  )}
                  <Button
                    onClick={() => handleSave(f.key)}
                    disabled={upsertMut.isPending || !dirty[f.key]}
                  >
                    {upsertMut.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1.5" />
                    )}
                    Salvar instruções
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
