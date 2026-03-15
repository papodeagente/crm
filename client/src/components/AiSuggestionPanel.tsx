import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Sparkles, X, Loader2, Copy, Send, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface AiSuggestionPanelProps {
  tenantId: number;
  sessionId: string;
  remoteJid: string;
  contactName?: string;
  onUseText: (text: string) => void;
  onSendBroken: (parts: string[]) => void;
  onClose: () => void;
}

// All available models per provider
const MODELS_BY_PROVIDER: Record<string, { id: string; name: string; desc: string }[]> = {
  openai: [
    { id: "gpt-4.1", name: "GPT-4.1", desc: "Melhor custo-benefício" },
    { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", desc: "Rápido e econômico" },
    { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", desc: "Ultra econômico" },
    { id: "gpt-5-mini", name: "GPT-5 Mini", desc: "Raciocínio rápido" },
    { id: "gpt-5.4", name: "GPT-5.4", desc: "Mais inteligente" },
    { id: "o4-mini", name: "o4-mini", desc: "Raciocínio avançado" },
  ],
  anthropic: [
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", desc: "Mais rápido" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", desc: "Equilíbrio" },
    { id: "claude-opus-4-6", name: "Claude Opus 4.6", desc: "Mais inteligente" },
  ],
};

export default function AiSuggestionPanel({
  tenantId,
  sessionId,
  remoteJid,
  contactName,
  onUseText,
  onSendBroken,
  onClose,
}: AiSuggestionPanelProps) {
  // State
  const [suggestion, setSuggestion] = useState("");
  const [editedText, setEditedText] = useState("");
  const [meta, setMeta] = useState<{ provider: string; model: string } | null>(null);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<number | undefined>();
  const [selectedModel, setSelectedModel] = useState<string | undefined>();
  const [phase, setPhase] = useState<"select" | "loading" | "result" | "error">("select");
  const [showModelList, setShowModelList] = useState(false);

  // Fetch messages directly inside this component
  const messagesQ = trpc.whatsapp.messagesByContact.useQuery(
    { sessionId, remoteJid, limit: 50 },
    { enabled: !!sessionId && !!remoteJid, staleTime: 30000 }
  );

  // Fetch available AI integrations
  const integrationsQ = trpc.ai.list.useQuery(
    { tenantId },
    { enabled: !!tenantId }
  );

  // Mutation
  const suggestMut = trpc.ai.suggest.useMutation({
    onSuccess: (data) => {
      setSuggestion(data.suggestion);
      setEditedText(data.suggestion);
      setMeta({ provider: data.provider, model: data.model });
      setPhase("result");
    },
    onError: (err) => {
      if (err.message === "NO_AI_CONFIGURED") {
        toast.error("Nenhuma IA configurada. Vá em Integrações > IA para conectar sua API.", { duration: 5000 });
        onClose();
      } else {
        toast.error(err.message || "Erro ao gerar sugestão", { duration: 5000 });
        setPhase("error");
      }
    },
  });

  const doGenerate = useCallback((overrideIntegrationId?: number, overrideModelId?: string) => {
    const rawMsgs = messagesQ.data;
    if (!rawMsgs || rawMsgs.length === 0) {
      toast.error("Sem mensagens para analisar.");
      return;
    }

    const msgs = rawMsgs
      .filter((m: any) => m.content)
      .map((m: any) => ({
        fromMe: m.fromMe,
        content: m.content || "",
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp ? String(m.timestamp) : undefined,
      }));

    if (msgs.length === 0) {
      toast.error("Sem mensagens com conteúdo para analisar.");
      return;
    }

    setSuggestion("");
    setEditedText("");
    setMeta(null);
    setPhase("loading");

    suggestMut.mutate({
      tenantId,
      messages: msgs,
      contactName,
      integrationId: overrideIntegrationId ?? selectedIntegrationId,
      overrideModel: overrideModelId ?? selectedModel,
    });
  }, [messagesQ.data, tenantId, contactName, selectedIntegrationId, selectedModel, suggestMut]);

  const activeIntegrations = (integrationsQ.data || []).filter((i: any) => i.isActive);
  const parts = editedText.split(/\n\n+/).map((p: string) => p.trim()).filter(Boolean);
  const hasMultipleParts = parts.length > 1;
  const providerLabel = meta?.provider === "openai" ? "OpenAI" : meta?.provider === "anthropic" ? "Anthropic" : "";

  // Auto-select first integration if none selected
  const effectiveIntegrationId = selectedIntegrationId ?? activeIntegrations[0]?.id;
  const effectiveIntegration = activeIntegrations.find((i: any) => i.id === effectiveIntegrationId);
  const effectiveProvider = effectiveIntegration?.provider || "openai";
  const effectiveModel = selectedModel || effectiveIntegration?.defaultModel || MODELS_BY_PROVIDER[effectiveProvider]?.[0]?.id;
  const providerModels = MODELS_BY_PROVIDER[effectiveProvider] || [];

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg shadow-xl z-50 overflow-hidden max-h-[400px] overflow-y-auto">
      {/* Header */}
      <div className="px-3 py-1.5 flex items-center justify-between border-b border-violet-200 dark:border-violet-800 sticky top-0 bg-violet-50 dark:bg-violet-950/30 z-10">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wider">
            Sugestão IA
          </span>
          {meta && (
            <span className="text-[10px] text-muted-foreground ml-1">
              {providerLabel} · {meta.model}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── PHASE: SELECT ── Show model selector first, user must click Generate */}
      {phase === "select" && (
        <div className="px-3 py-3">
          {activeIntegrations.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-[12px] text-muted-foreground mb-2">Nenhuma IA configurada.</p>
              <p className="text-[11px] text-muted-foreground">Vá em Integrações &gt; IA para conectar sua API OpenAI ou Anthropic.</p>
            </div>
          ) : (
            <>
              {/* Provider tabs */}
              {activeIntegrations.length > 1 && (
                <div className="flex gap-1.5 mb-2">
                  {activeIntegrations.map((integ: any) => (
                    <button
                      key={integ.id}
                      onClick={() => {
                        setSelectedIntegrationId(integ.id);
                        setSelectedModel(integ.defaultModel);
                      }}
                      className={`text-[11px] px-3 py-1 rounded-full border transition-colors ${
                        effectiveIntegrationId === integ.id
                          ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300 font-medium"
                          : "border-violet-200 dark:border-violet-700 text-muted-foreground hover:border-violet-400"
                      }`}
                    >
                      {integ.provider === "openai" ? "OpenAI" : "Anthropic"}
                    </button>
                  ))}
                </div>
              )}

              {/* Model selector */}
              <div className="mb-3">
                <button
                  onClick={() => setShowModelList(!showModelList)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-md text-[12px] hover:border-violet-400 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {providerModels.find(m => m.id === effectiveModel)?.name || effectiveModel}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {providerModels.find(m => m.id === effectiveModel)?.desc || ""}
                    </span>
                  </div>
                  {showModelList ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                </button>

                {showModelList && (
                  <div className="mt-1 bg-white dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 rounded-md overflow-hidden">
                    {providerModels.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setSelectedModel(m.id); setShowModelList(false); }}
                        className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-violet-100 dark:hover:bg-violet-800/30 transition-colors flex items-center justify-between ${
                          effectiveModel === m.id ? "bg-violet-100 dark:bg-violet-800/20 font-medium" : ""
                        }`}
                      >
                        <span className="text-foreground">{m.name}</span>
                        <span className="text-[10px] text-muted-foreground">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Generate button */}
              <button
                onClick={() => doGenerate(effectiveIntegrationId, effectiveModel)}
                disabled={messagesQ.isLoading}
                className="w-full text-[12px] font-medium bg-violet-500 hover:bg-violet-600 text-white rounded-md py-2 transition-colors flex items-center justify-center gap-2"
              >
                {messagesQ.isLoading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando conversa...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /> Gerar Sugestão de Resposta</>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── PHASE: LOADING ── */}
      {phase === "loading" && (
        <div className="px-4 py-6 flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          <span className="text-[12px] text-muted-foreground">Analisando conversa e gerando sugestão...</span>
          <span className="text-[10px] text-muted-foreground">
            {effectiveProvider === "openai" ? "OpenAI" : "Anthropic"} · {effectiveModel}
          </span>
        </div>
      )}

      {/* ── PHASE: ERROR ── */}
      {phase === "error" && (
        <div className="px-4 py-4 flex flex-col items-center gap-2">
          <span className="text-[12px] text-red-500">Erro ao gerar sugestão</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPhase("select")}
              className="text-[11px] font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1 px-3 py-1 border border-violet-200 rounded-md"
            >
              Trocar modelo
            </button>
            <button
              onClick={() => doGenerate(effectiveIntegrationId, effectiveModel)}
              className="text-[11px] font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1 px-3 py-1 border border-violet-200 rounded-md"
            >
              <RefreshCw className="h-3 w-3" /> Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE: RESULT ── Editable suggestion */}
      {phase === "result" && suggestion && (
        <>
          <div className="px-3 py-2">
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full text-[13px] text-foreground bg-white dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-md px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-violet-400 min-h-[60px] max-h-[180px] overflow-y-auto"
              rows={Math.min(6, editedText.split("\n").length + 1)}
              placeholder="Edite a sugestão antes de enviar..."
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Edite o texto acima. Separe parágrafos com Enter duplo para enviar como mensagens separadas.
            </p>
          </div>

          {/* Action buttons */}
          <div className="px-3 py-2 flex flex-wrap gap-2 border-t border-violet-200 dark:border-violet-800">
            <button
              onClick={() => onUseText(editedText.trim())}
              className="flex-1 text-[12px] font-medium bg-violet-500 hover:bg-violet-600 text-white rounded-md py-1.5 transition-colors flex items-center justify-center gap-1.5"
            >
              <Copy className="h-3 w-3" /> Usar no campo
            </button>
            {hasMultipleParts && (
              <button
                onClick={() => onSendBroken(parts)}
                className="flex-1 text-[12px] font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-md py-1.5 transition-colors flex items-center justify-center gap-1.5"
              >
                <Send className="h-3 w-3" /> Enviar separado ({parts.length} msgs)
              </button>
            )}
            <button
              onClick={() => setPhase("select")}
              className="text-[12px] font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 rounded-md px-3 py-1.5 transition-colors border border-violet-200 dark:border-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30 flex items-center gap-1.5"
            >
              <RefreshCw className="h-3 w-3" /> Gerar outra
            </button>
          </div>
        </>
      )}
    </div>
  );
}
