import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Sparkles, X, Loader2, Copy, Send, RefreshCw, ChevronDown } from "lucide-react";

interface AiSuggestionPanelProps {
  tenantId: number;
  sessionId: string;
  remoteJid: string;
  contactName?: string;
  onUseText: (text: string) => void;
  onSendBroken: (parts: string[]) => void;
  onClose: () => void;
}

export default function AiSuggestionPanel({
  tenantId,
  sessionId,
  remoteJid,
  contactName,
  onUseText,
  onSendBroken,
  onClose,
}: AiSuggestionPanelProps) {
  const [suggestion, setSuggestion] = useState("");
  const [editedText, setEditedText] = useState("");
  const [meta, setMeta] = useState<{ provider: string; model: string } | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<number | undefined>();
  const [selectedModel, setSelectedModel] = useState<string | undefined>();
  const didAutoGenerate = useRef(false);

  // Fetch messages directly inside this component - no prop dependency
  const messagesQ = trpc.whatsapp.messagesByContact.useQuery(
    { sessionId, remoteJid, limit: 50 },
    { enabled: !!sessionId && !!remoteJid, staleTime: 30000 }
  );

  // Fetch available AI integrations
  const integrationsQ = trpc.ai.list.useQuery(
    { tenantId },
    { enabled: !!tenantId }
  );

  // Models per provider
  const modelsByProvider: Record<string, { id: string; name: string }[]> = {
    openai: [
      { id: "gpt-5.4", name: "GPT-5.4" },
      { id: "gpt-5-mini", name: "GPT-5 Mini" },
    ],
    anthropic: [
      { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
    ],
  };

  // Mutation
  const suggestMut = trpc.ai.suggest.useMutation({
    onSuccess: (data) => {
      setSuggestion(data.suggestion);
      setEditedText(data.suggestion);
      setMeta({ provider: data.provider, model: data.model });
    },
    onError: (err) => {
      if (err.message === "NO_AI_CONFIGURED") {
        toast.error("Nenhuma IA configurada. Vá em Integrações > IA para conectar sua API.", { duration: 5000 });
        onClose();
      } else {
        toast.error(err.message || "Erro ao gerar sugestão", { duration: 5000 });
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

    suggestMut.mutate({
      tenantId,
      messages: msgs,
      contactName,
      integrationId: overrideIntegrationId ?? selectedIntegrationId,
      overrideModel: overrideModelId ?? selectedModel,
    });
  }, [messagesQ.data, tenantId, contactName, selectedIntegrationId, selectedModel, suggestMut]);

  // Auto-generate when messages are loaded for the first time
  useEffect(() => {
    if (!didAutoGenerate.current && messagesQ.data && messagesQ.data.length > 0) {
      didAutoGenerate.current = true;
      doGenerate();
    }
  }, [messagesQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeIntegrations = (integrationsQ.data || []).filter((i: any) => i.isActive);
  const parts = editedText.split(/\n\n+/).map((p: string) => p.trim()).filter(Boolean);
  const hasMultipleParts = parts.length > 1;
  const providerLabel = meta?.provider === "openai" ? "OpenAI" : meta?.provider === "anthropic" ? "Anthropic" : "";

  const isLoading = messagesQ.isLoading || suggestMut.isPending;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg shadow-xl z-50 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-1.5 flex items-center justify-between border-b border-violet-200 dark:border-violet-800">
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
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSelector(!showSelector)}
            className="text-[10px] text-violet-500 hover:text-violet-700 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-violet-100 dark:hover:bg-violet-900/30"
          >
            Trocar IA <ChevronDown className="h-2.5 w-2.5" />
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* AI Selector dropdown */}
      {showSelector && (
        <div className="px-3 py-2 border-b border-violet-200 dark:border-violet-800 bg-violet-100/50 dark:bg-violet-900/20">
          <div className="flex flex-wrap gap-2">
            {activeIntegrations.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Nenhuma IA ativa. Vá em Integrações &gt; IA.</p>
            ) : (
              activeIntegrations.map((integ: any) => {
                const isSelected = selectedIntegrationId === integ.id;
                const providerModels = modelsByProvider[integ.provider] || [];
                return (
                  <div key={integ.id} className="flex flex-col gap-1">
                    <button
                      onClick={() => {
                        setSelectedIntegrationId(integ.id);
                        setSelectedModel(integ.defaultModel);
                      }}
                      className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                        isSelected
                          ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                          : "border-violet-200 dark:border-violet-700 text-muted-foreground hover:border-violet-400"
                      }`}
                    >
                      {integ.provider === "openai" ? "OpenAI" : "Anthropic"}
                    </button>
                    {isSelected && providerModels.length > 0 && (
                      <select
                        value={selectedModel || integ.defaultModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="text-[10px] bg-white dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 rounded px-1 py-0.5"
                      >
                        {providerModels.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {activeIntegrations.length > 0 && (
            <button
              onClick={() => { setShowSelector(false); doGenerate(selectedIntegrationId, selectedModel); }}
              disabled={isLoading}
              className="mt-2 text-[11px] font-medium bg-violet-500 hover:bg-violet-600 text-white rounded px-3 py-1 transition-colors flex items-center gap-1"
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Gerar com esta IA
            </button>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="px-4 py-6 flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          <span className="text-[12px] text-muted-foreground">
            {messagesQ.isLoading ? "Carregando mensagens..." : "Gerando sugestão de resposta..."}
          </span>
        </div>
      )}

      {/* Error state */}
      {suggestMut.isError && !suggestMut.isPending && !suggestion && (
        <div className="px-4 py-4 flex flex-col items-center gap-2">
          <span className="text-[12px] text-red-500">Erro ao gerar sugestão</span>
          <button
            onClick={() => doGenerate()}
            className="text-[11px] font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" /> Tentar novamente
          </button>
        </div>
      )}

      {/* Editable suggestion */}
      {suggestion && !suggestMut.isPending && (
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
              onClick={() => doGenerate()}
              disabled={suggestMut.isPending}
              className="text-[12px] font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 rounded-md px-3 py-1.5 transition-colors border border-violet-200 dark:border-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30 flex items-center gap-1.5"
            >
              {suggestMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Gerar outra
            </button>
          </div>
        </>
      )}
    </div>
  );
}
