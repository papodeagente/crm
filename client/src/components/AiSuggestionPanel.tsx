import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { getSocketInstance } from "@/hooks/useSocket";
import { toast } from "sonner";
import {
  Sparkles, X, Loader2, Copy, Send, RefreshCw,
  ChevronDown, ChevronUp, Settings2, Zap,
  MessageSquare, Target, UserCheck, Scissors,
  Info,
} from "lucide-react";

interface AiSuggestionPanelProps {
  tenantId: number;
  sessionId: string;
  remoteJid: string;
  contactName?: string;
  onUseText: (text: string) => void;
  onSendBroken: (parts: string[]) => void;
  onClose: () => void;
}

type ResponseStyle = "default" | "shorter" | "human" | "objective" | "consultive";
type PacingMode = "fast" | "normal" | "human";

const STYLE_OPTIONS: { id: ResponseStyle; label: string; icon: typeof Zap; desc: string }[] = [
  { id: "shorter", label: "Mais curta", icon: Scissors, desc: "1-2 frases" },
  { id: "human", label: "Mais humana", icon: UserCheck, desc: "Informal" },
  { id: "objective", label: "Objetiva", icon: Target, desc: "Direto ao ponto" },
  { id: "consultive", label: "Consultiva", icon: MessageSquare, desc: "Perguntas" },
];

const PACING_OPTIONS: { id: PacingMode; label: string; desc: string }[] = [
  { id: "fast", label: "Rápido", desc: "0.4-0.8s" },
  { id: "normal", label: "Normal", desc: "1-2s" },
  { id: "human", label: "Humano", desc: "2-4s" },
];

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

let requestCounter = 0;
function generateRequestId(sessionId: string, remoteJid: string): string {
  return `${sessionId}:${remoteJid}:${Date.now()}-${++requestCounter}`;
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
  // State
  const [suggestion, setSuggestion] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [editedText, setEditedText] = useState("");
  const [meta, setMeta] = useState<{
    provider: string; model: string;
    intentClassified?: string; durationMs?: number;
    contextMessageCount?: number; hasCrmContext?: boolean;
  } | null>(null);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<number | undefined>();
  const [selectedModel, setSelectedModel] = useState<string | undefined>();
  const [phase, setPhase] = useState<"idle" | "loading" | "streaming" | "result" | "error" | "sending">("idle");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showModelList, setShowModelList] = useState(false);
  const [pacing, setPacing] = useState<PacingMode>("normal");
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0 });

  // Refs for cleanup
  const currentRequestId = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch available AI integrations
  const integrationsQ = trpc.ai.list.useQuery(
    { tenantId },
    { enabled: !!tenantId }
  );

  // Async suggestion mutation (non-blocking)
  const suggestAsyncMut = trpc.ai.suggestAsync.useMutation({
    onSuccess: (data) => {
      if (data.status === "cached" && data.cachedResult) {
        // Use cached result immediately
        setSuggestion(data.cachedResult.suggestion);
        setEditedText(data.cachedResult.suggestion);
        setStreamingText("");
        setMeta({
          provider: data.cachedResult.provider,
          model: data.cachedResult.model,
          intentClassified: data.cachedResult.intentClassified,
          durationMs: data.cachedResult.durationMs,
          contextMessageCount: data.cachedResult.contextMessageCount,
          hasCrmContext: data.cachedResult.hasCrmContext,
        });
        setPhase("result");
      } else if (data.status === "rate_limited") {
        const seconds = Math.ceil((data.retryAfterMs || 10000) / 1000);
        toast.info(`Aguarde ${seconds}s antes de gerar nova sugestão.`, { duration: 3000 });
        setPhase("idle");
      }
      // status === "queued" — wait for socket events
    },
    onError: (err) => {
      if (err.message === "NO_AI_CONFIGURED") {
        toast.error("Nenhuma IA configurada. Vá em Integrações > IA para conectar sua API.", { duration: 5000 });
        onClose();
      } else {
        // Silent failure — just hide suggestion (requirement #9)
        console.error("[AiSuggestion] Error:", err.message);
        setPhase("idle");
      }
    },
  });

  // Cancel mutation
  const cancelMut = trpc.ai.cancel.useMutation();

  // Legacy mutations (kept for refine and send broken)
  const refineMut = trpc.ai.refine.useMutation({
    onSuccess: (data) => {
      setSuggestion(data.suggestion);
      setEditedText(data.suggestion);
      setMeta(prev => prev ? { ...prev, provider: data.provider, model: data.model } : null);
      toast.success("Sugestão refinada!");
    },
    onError: (err) => {
      // Silent failure (requirement #9)
      console.error("[AiSuggestion] Refine error:", err.message);
    },
  });

  const sendBrokenMut = trpc.whatsapp.sendBrokenMessage.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.sentParts} mensagens enviadas!`);
      setPhase("idle");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao enviar", { duration: 3000 });
      setPhase("result");
    },
  });

  // ─── Socket.IO listeners for streaming ───
  useEffect(() => {
    const socket = getSocketInstance();
    if (!socket) return;

    const onChunk = (data: { requestId: string; sessionId: string; remoteJid: string; text: string }) => {
      if (data.requestId === currentRequestId.current) {
        setStreamingText(data.text);
        setPhase("streaming");
      }
    };

    const onReady = (data: { requestId: string; sessionId: string; remoteJid: string; result: any; timedOut?: boolean }) => {
      if (data.requestId === currentRequestId.current) {
        const r = data.result;
        setSuggestion(r.suggestion);
        setEditedText(r.suggestion);
        setStreamingText("");
        setMeta({
          provider: r.provider,
          model: r.model,
          intentClassified: r.intentClassified,
          durationMs: r.durationMs,
          contextMessageCount: r.contextMessageCount,
          hasCrmContext: r.hasCrmContext,
        });
        setPhase("result");
        currentRequestId.current = null;
      }
    };

    const onError = (data: { requestId: string; error: string }) => {
      if (data.requestId === currentRequestId.current) {
        // Silent failure — just hide (requirement #9)
        console.error("[AiSuggestion] Socket error:", data.error);
        setPhase("idle");
        setStreamingText("");
        currentRequestId.current = null;
      }
    };

    socket.on("aiSuggestionChunk", onChunk);
    socket.on("aiSuggestionReady", onReady);
    socket.on("aiSuggestionError", onError);

    return () => {
      socket.off("aiSuggestionChunk", onChunk);
      socket.off("aiSuggestionReady", onReady);
      socket.off("aiSuggestionError", onError);
    };
  }, []);

  // ─── Cancel on unmount or conversation change ───
  useEffect(() => {
    return () => {
      // Cancel any active request when component unmounts (close chat, navigate away)
      if (currentRequestId.current) {
        cancelMut.mutate({ sessionId, remoteJid });
        currentRequestId.current = null;
      }
      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [sessionId, remoteJid]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeIntegrations = useMemo(
    () => (integrationsQ.data || []).filter((i: any) => i.isActive),
    [integrationsQ.data]
  );

  const effectiveIntegrationId = selectedIntegrationId ?? activeIntegrations[0]?.id;
  const effectiveIntegration = activeIntegrations.find((i: any) => i.id === effectiveIntegrationId);
  const effectiveProvider = effectiveIntegration?.provider || "openai";
  const effectiveModel = selectedModel || effectiveIntegration?.defaultModel || MODELS_BY_PROVIDER[effectiveProvider]?.[0]?.id;
  const providerModels = MODELS_BY_PROVIDER[effectiveProvider] || [];

  // ─── Generate suggestion (async, non-blocking) ───
  const doGenerate = useCallback((style?: ResponseStyle) => {
    // Cancel any previous request
    if (currentRequestId.current) {
      cancelMut.mutate({ sessionId, remoteJid });
    }

    // Reset state
    setSuggestion("");
    setEditedText("");
    setStreamingText("");
    setMeta(null);
    setPhase("loading");

    // Generate unique request ID
    const reqId = generateRequestId(sessionId, remoteJid);
    currentRequestId.current = reqId;

    // Fire async request (returns immediately)
    suggestAsyncMut.mutate({
      requestId: reqId,
      tenantId,
      sessionId,
      remoteJid,
      contactName,
      integrationId: effectiveIntegrationId,
      overrideModel: effectiveModel,
      style: style || "default",
    });
  }, [tenantId, sessionId, remoteJid, contactName, effectiveIntegrationId, effectiveModel, suggestAsyncMut, cancelMut]);

  // ─── Debounced generate (1.5s after last trigger) ───
  const doGenerateDebounced = useCallback((style?: ResponseStyle) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      doGenerate(style);
    }, 1500);
  }, [doGenerate]);

  // Refine with a different style
  const doRefine = useCallback((style: ResponseStyle) => {
    if (!editedText.trim()) return;
    refineMut.mutate({
      tenantId,
      originalText: editedText.trim(),
      style,
      integrationId: effectiveIntegrationId,
      overrideModel: effectiveModel,
    });
  }, [tenantId, editedText, effectiveIntegrationId, effectiveModel, refineMut]);

  // Server-side broken sending
  const doSendBroken = useCallback((partsToSend: string[]) => {
    if (partsToSend.length === 0) return;
    // Cancel any active AI generation before sending
    if (currentRequestId.current) {
      cancelMut.mutate({ sessionId, remoteJid });
      currentRequestId.current = null;
    }
    setPhase("sending");
    setSendingProgress({ current: 0, total: partsToSend.length });

    const number = remoteJid.replace(/@.*$/, "");
    sendBrokenMut.mutate({
      sessionId,
      number,
      parts: partsToSend,
      pacing,
    });
  }, [sessionId, remoteJid, pacing, sendBrokenMut, cancelMut]);

  const parts = useMemo(
    () => editedText.split(/\n\n+/).map((p: string) => p.trim()).filter(Boolean),
    [editedText]
  );
  const hasMultipleParts = parts.length > 1;
  const providerLabel = meta?.provider === "openai" ? "OpenAI" : meta?.provider === "anthropic" ? "Anthropic" : "";
  const hasNoIntegrations = activeIntegrations.length === 0;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg shadow-xl z-50 overflow-hidden max-h-[450px] overflow-y-auto">
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
              {meta.durationMs ? ` · ${(meta.durationMs / 1000).toFixed(1)}s` : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {phase !== "idle" && phase !== "loading" && phase !== "streaming" && phase !== "sending" && (
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`p-0.5 rounded transition-colors ${showAdvanced ? "text-violet-500" : "text-muted-foreground hover:text-foreground"}`}
              title="Configurações avançadas"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={() => {
            // Cancel on close
            if (currentRequestId.current) {
              cancelMut.mutate({ sessionId, remoteJid });
              currentRequestId.current = null;
            }
            onClose();
          }} className="text-muted-foreground hover:text-foreground p-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── PHASE: IDLE ── Quick generate or advanced */}
      {phase === "idle" && (
        <div className="px-3 py-3">
          {hasNoIntegrations ? (
            <div className="text-center py-4">
              <p className="text-[12px] text-muted-foreground mb-2">Nenhuma IA configurada.</p>
              <p className="text-[11px] text-muted-foreground">Vá em Integrações &gt; IA para conectar sua API OpenAI ou Anthropic.</p>
            </div>
          ) : (
            <>
              {/* Quick generate button (simple mode) */}
              <button
                onClick={() => doGenerate()}
                className="w-full text-[12px] font-medium bg-violet-500 hover:bg-violet-600 text-white rounded-md py-2.5 transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="h-3.5 w-3.5" /> Sugerir resposta
              </button>

              {/* Toggle advanced */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full mt-2 text-[10px] text-muted-foreground hover:text-violet-500 flex items-center justify-center gap-1 transition-colors"
              >
                <Settings2 className="h-3 w-3" />
                {showAdvanced ? "Ocultar opções" : "Opções avançadas"}
              </button>

              {/* Advanced options */}
              {showAdvanced && (
                <div className="mt-2 space-y-2 pt-2 border-t border-violet-200 dark:border-violet-800">
                  {/* Provider tabs */}
                  {activeIntegrations.length > 1 && (
                    <div className="flex gap-1.5">
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
                  <div>
                    <button
                      onClick={() => setShowModelList(!showModelList)}
                      className="w-full flex items-center justify-between px-3 py-1.5 bg-white dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-md text-[11px] hover:border-violet-400 transition-colors"
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

                  {/* Style-specific generate buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {STYLE_OPTIONS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => doGenerate(s.id)}
                        className="text-[10px] px-2.5 py-1 rounded-full border border-violet-200 dark:border-violet-700 text-muted-foreground hover:border-violet-400 hover:text-violet-600 transition-colors flex items-center gap-1"
                      >
                        <s.icon className="h-3 w-3" /> {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── PHASE: LOADING ── Waiting for AI to start */}
      {phase === "loading" && (
        <div className="px-4 py-6 flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          <span className="text-[12px] text-muted-foreground">Gerando sugestão...</span>
          <span className="text-[10px] text-muted-foreground">
            Contexto: últimas 10 mensagens + CRM
          </span>
        </div>
      )}

      {/* ── PHASE: STREAMING ── Real-time text appearing */}
      {phase === "streaming" && (
        <div className="px-3 py-2">
          <div className="text-[13px] text-foreground bg-white dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-md px-2.5 py-2 min-h-[60px] max-h-[180px] overflow-y-auto whitespace-pre-wrap">
            {streamingText}
            <span className="inline-block w-1.5 h-4 bg-violet-500 animate-pulse ml-0.5 align-text-bottom" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Recebendo resposta...
          </p>
        </div>
      )}

      {/* ── PHASE: ERROR ── */}
      {phase === "error" && (
        <div className="px-4 py-4 flex flex-col items-center gap-2">
          <span className="text-[12px] text-red-500">Erro ao gerar sugestão</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPhase("idle")}
              className="text-[11px] font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1 px-3 py-1 border border-violet-200 rounded-md"
            >
              Voltar
            </button>
            <button
              onClick={() => doGenerate()}
              className="text-[11px] font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1 px-3 py-1 border border-violet-200 rounded-md"
            >
              <RefreshCw className="h-3 w-3" /> Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE: SENDING ── */}
      {phase === "sending" && (
        <div className="px-4 py-6 flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          <span className="text-[12px] text-muted-foreground">
            Enviando mensagens com ritmo {pacing === "fast" ? "rápido" : pacing === "human" ? "humano" : "normal"}...
          </span>
          <span className="text-[10px] text-muted-foreground">
            Digitando e enviando {parts.length} partes
          </span>
        </div>
      )}

      {/* ── PHASE: RESULT ── Editable suggestion with refinement */}
      {phase === "result" && suggestion && (
        <>
          {/* Context info badge */}
          {meta && (meta.intentClassified || meta.hasCrmContext) && (
            <div className="px-3 pt-2 flex flex-wrap gap-1.5">
              {meta.intentClassified && meta.intentClassified !== "outro" && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700 flex items-center gap-1">
                  <Info className="h-2.5 w-2.5" />
                  Intenção: {meta.intentClassified.replace("_", " ")}
                </span>
              )}
              {meta.hasCrmContext && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700">
                  CRM enriquecido
                </span>
              )}
              {meta.contextMessageCount && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700">
                  {meta.contextMessageCount} msgs analisadas
                </span>
              )}
            </div>
          )}

          {/* Editable textarea */}
          <div className="px-3 py-2">
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full text-[13px] text-foreground bg-white dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-md px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-violet-400 min-h-[60px] max-h-[180px] overflow-y-auto"
              rows={Math.min(6, editedText.split("\n").length + 1)}
              placeholder="Edite a sugestão antes de enviar..."
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Separe parágrafos com Enter duplo para enviar como mensagens separadas.
            </p>
          </div>

          {/* Refinement buttons */}
          <div className="px-3 pb-1.5 flex flex-wrap gap-1.5">
            {STYLE_OPTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => doRefine(s.id)}
                disabled={refineMut.isPending}
                className="text-[10px] px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-700 text-muted-foreground hover:border-violet-400 hover:text-violet-600 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {refineMut.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <s.icon className="h-2.5 w-2.5" />}
                {s.label}
              </button>
            ))}
          </div>

          {/* Advanced settings (model, pacing) */}
          {showAdvanced && (
            <div className="px-3 pb-2 space-y-2 border-t border-violet-100 dark:border-violet-800 pt-2">
              {/* Pacing selector */}
              <div>
                <span className="text-[10px] text-muted-foreground block mb-1">Ritmo de envio:</span>
                <div className="flex gap-1.5">
                  {PACING_OPTIONS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPacing(p.id)}
                      className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                        pacing === p.id
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium"
                          : "border-violet-200 dark:border-violet-700 text-muted-foreground hover:border-emerald-400"
                      }`}
                    >
                      {p.label} <span className="text-[9px] opacity-70">({p.desc})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="px-3 py-2 flex flex-wrap gap-2 border-t border-violet-200 dark:border-violet-800">
            <button
              onClick={() => onUseText(editedText.trim())}
              className="flex-1 text-[12px] font-medium bg-violet-500 hover:bg-violet-600 text-white rounded-md py-1.5 transition-colors flex items-center justify-center gap-1.5"
            >
              <Copy className="h-3 w-3" /> Aceitar sugestão
            </button>
            {hasMultipleParts && (
              <button
                onClick={() => doSendBroken(parts)}
                disabled={sendBrokenMut.isPending}
                className="flex-1 text-[12px] font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-md py-1.5 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {sendBrokenMut.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Enviar separado ({parts.length} msgs)
              </button>
            )}
            <button
              onClick={() => doGenerate()}
              className="text-[12px] font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 rounded-md px-3 py-1.5 transition-colors border border-violet-200 dark:border-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30 flex items-center gap-1.5"
            >
              <RefreshCw className="h-3 w-3" /> Nova
            </button>
          </div>
        </>
      )}
    </div>
  );
}
