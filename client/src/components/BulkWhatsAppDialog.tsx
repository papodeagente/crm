/**
 * BulkWhatsAppDialog — Componente reutilizável para disparo em massa via WhatsApp.
 * Usado nas páginas de Contatos, Negociações e RFV.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, CheckCircle2, AlertCircle, SkipForward, Ban } from "lucide-react";

interface TemplateVar {
  var: string;
  desc: string;
}

interface BulkProgress {
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  status: string;
  results: Array<{ contactId: number; name: string; phone: string | null; status: string; error?: string }>;
}

interface PreviewReplacements {
  [key: string]: string;
}

interface BulkWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  sessionConnected: boolean;
  sessionConnecting: boolean;
  templateVars: TemplateVar[];
  previewReplacements: PreviewReplacements;
  onSend: (params: {
    messageTemplate: string;
    delayMs: number;
    randomDelay: boolean;
    delayMinMs?: number;
    delayMaxMs?: number;
  }) => void;
  isSending: boolean;
  // Progress
  progress: BulkProgress | null;
  progressOpen: boolean;
  onProgressOpenChange: (open: boolean) => void;
  onCancel: () => void;
  isCancelling: boolean;
  onClearSelection: () => void;
  /** Label for the entity type (e.g., "contatos", "negociações") */
  entityLabel?: string;
}

export default function BulkWhatsAppDialog({
  open,
  onOpenChange,
  selectedCount,
  sessionConnected,
  sessionConnecting,
  templateVars,
  previewReplacements,
  onSend,
  isSending,
  progress,
  progressOpen,
  onProgressOpenChange,
  onCancel,
  isCancelling,
  onClearSelection,
  entityLabel = "contatos",
}: BulkWhatsAppDialogProps) {
  const [messageTemplate, setMessageTemplate] = useState("");
  const [delayMode, setDelayMode] = useState<"random" | "fixed">("random");
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [delayMinSeconds, setDelayMinSeconds] = useState(3);
  const [delayMaxSeconds, setDelayMaxSeconds] = useState(10);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = useCallback((varName: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setMessageTemplate((prev) => prev + varName);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = messageTemplate.substring(0, start);
    const after = messageTemplate.substring(end);
    setMessageTemplate(before + varName + after);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + varName.length;
    }, 0);
  }, [messageTemplate]);

  const handleSend = () => {
    if (!messageTemplate.trim() || !sessionConnected) return;
    onSend({
      messageTemplate: messageTemplate.trim(),
      delayMs: delayMode === "fixed" ? delaySeconds * 1000 : Math.round((delayMinSeconds + delayMaxSeconds) / 2) * 1000,
      randomDelay: delayMode === "random",
      delayMinMs: delayMode === "random" ? delayMinSeconds * 1000 : undefined,
      delayMaxMs: delayMode === "random" ? delayMaxSeconds * 1000 : undefined,
    });
  };

  // Preview
  const previewText = messageTemplate.trim()
    ? Object.entries(previewReplacements).reduce(
        (text, [pattern, replacement]) => text.replace(new RegExp(pattern.replace(/[{}]/g, "\\$&"), "gi"), replacement),
        messageTemplate
      )
    : "";

  const bp = progress;

  return (
    <>
      {/* ─── Send Dialog ─── */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-600" />
              Envio em Massa — WhatsApp
            </DialogTitle>
            <DialogDescription>
              Envie uma mensagem personalizada para {selectedCount} {entityLabel} selecionado{selectedCount !== 1 ? "s" : ""}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* WhatsApp session status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              sessionConnected
                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                : sessionConnecting
                  ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                  : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
            }`}>
              {sessionConnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <div className={`w-2 h-2 rounded-full ${sessionConnected ? "bg-emerald-500" : "bg-red-500"}`} />
              )}
              {sessionConnected
                ? "WhatsApp conectado"
                : sessionConnecting
                  ? "WhatsApp reconectando..."
                  : "WhatsApp desconectado"}
            </div>

            {/* Message template */}
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                ref={textareaRef}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder={`Olá {primeiro_nome}, tudo bem? ...`}
                rows={5}
                className="resize-none"
              />
              <div className="flex flex-wrap gap-1.5">
                {templateVars.map((tv) => (
                  <button
                    key={tv.var}
                    onClick={() => insertVariable(tv.var)}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                    title={tv.desc}
                  >
                    {tv.var}
                  </button>
                ))}
              </div>
            </div>

            {/* Delay setting */}
            <div className="space-y-3">
              <Label className="shrink-0">Intervalo entre mensagens:</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDelayMode("random")}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    delayMode === "random"
                      ? "bg-[#600FED] text-white border-[#600FED]"
                      : "bg-transparent text-muted-foreground border-border hover:border-[#600FED]/50"
                  }`}
                >
                  Aleatório (Recomendado)
                </button>
                <button
                  type="button"
                  onClick={() => setDelayMode("fixed")}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    delayMode === "fixed"
                      ? "bg-[#600FED] text-white border-[#600FED]"
                      : "bg-transparent text-muted-foreground border-border hover:border-[#600FED]/50"
                  }`}
                >
                  Fixo
                </button>
              </div>

              {/* Speed Presets */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Velocidade:</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { label: "Rápido", desc: delayMode === "random" ? "3s – 10s" : "5s", icon: "⚡",
                      apply: () => delayMode === "random" ? (setDelayMinSeconds(3), setDelayMaxSeconds(10)) : setDelaySeconds(5) },
                    { label: "Moderado", desc: delayMode === "random" ? "15s – 60s" : "30s", icon: "⏱",
                      apply: () => delayMode === "random" ? (setDelayMinSeconds(15), setDelayMaxSeconds(60)) : setDelaySeconds(30) },
                    { label: "Seguro", desc: delayMode === "random" ? "60s – 300s" : "120s", icon: "🛡",
                      apply: () => delayMode === "random" ? (setDelayMinSeconds(60), setDelayMaxSeconds(300)) : setDelaySeconds(120) },
                  ] as const).map((preset) => {
                    const isActive = delayMode === "random"
                      ? (preset.label === "Rápido" && delayMinSeconds === 3 && delayMaxSeconds === 10)
                        || (preset.label === "Moderado" && delayMinSeconds === 15 && delayMaxSeconds === 60)
                        || (preset.label === "Seguro" && delayMinSeconds === 60 && delayMaxSeconds === 300)
                      : (preset.label === "Rápido" && delaySeconds === 5)
                        || (preset.label === "Moderado" && delaySeconds === 30)
                        || (preset.label === "Seguro" && delaySeconds === 120);
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => preset.apply()}
                        className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-xs border transition-colors ${
                          isActive
                            ? "bg-[#600FED]/10 border-[#600FED] text-[#600FED]"
                            : "bg-transparent border-border text-muted-foreground hover:border-[#600FED]/40"
                        }`}
                      >
                        <span className="text-base">{preset.icon}</span>
                        <span className="font-medium">{preset.label}</span>
                        <span className="text-[10px] opacity-70">{preset.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {delayMode === "random" ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Intervalo aleatório entre cada mensagem para simular comportamento humano e evitar bloqueios.
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Mínimo</Label>
                      <Select value={String(delayMinSeconds)} onValueChange={(v) => setDelayMinSeconds(Number(v))}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[2,3,5,8,10,15,20,30,45,60,120,180,300].map(v => (
                            <SelectItem key={v} value={String(v)}>{v >= 60 ? `${Math.round(v/60)} min` : `${v}s`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <span className="text-muted-foreground mt-5">—</span>
                    <div className="flex-1">
                      <Label className="text-xs">Máximo</Label>
                      <Select value={String(delayMaxSeconds)} onValueChange={(v) => setDelayMaxSeconds(Number(v))}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[5,8,10,15,20,30,45,60,90,120,180,300,420,600].map(v => (
                            <SelectItem key={v} value={String(v)}>{v >= 60 ? `${Math.round(v/60)} min` : `${v}s`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Intervalo fixo entre cada mensagem.</p>
                  <Select value={String(delaySeconds)} onValueChange={(v) => setDelaySeconds(Number(v))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2,3,5,8,10,15,20,30,45,60,90,120,180,300,420,600].map(v => (
                        <SelectItem key={v} value={String(v)}>
                          {v >= 60 ? `${Math.floor(v/60)} minuto${Math.floor(v/60) > 1 ? "s" : ""}${v%60 ? ` ${v%60}s` : ""}` : `${v} segundos`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Preview */}
            {previewText && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Pré-visualização:</Label>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm whitespace-pre-wrap">
                  {previewText}
                </div>
              </div>
            )}

            {/* Estimated time */}
            <div className="text-xs text-muted-foreground">
              {(() => {
                const avgDelay = delayMode === "random"
                  ? (delayMinSeconds + delayMaxSeconds) / 2
                  : delaySeconds;
                const totalSec = selectedCount * avgDelay;
                const hours = Math.floor(totalSec / 3600);
                const mins = Math.ceil((totalSec % 3600) / 60);
                const formatDelay = (s: number) => s >= 60 ? `${Math.round(s / 60)} min` : `${s}s`;
                const timeStr = hours > 0
                  ? `${hours}h ${mins > 0 ? `${mins}min` : ""}`
                  : mins > 0 ? `${mins} minuto${mins !== 1 ? "s" : ""}` : "< 1 minuto";
                return delayMode === "random"
                  ? <>Tempo estimado: ~{timeStr} (intervalo {formatDelay(delayMinSeconds)}–{formatDelay(delayMaxSeconds)})</>
                  : <>Tempo estimado: ~{timeStr}</>;
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={handleSend}
              disabled={!messageTemplate.trim() || !sessionConnected || sessionConnecting || isSending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSending ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Iniciando...</>
              ) : (
                <><Send className="w-4 h-4 mr-1.5" /> Enviar para {selectedCount} {entityLabel}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Progress Dialog ─── */}
      <Dialog open={progressOpen} onOpenChange={(o) => {
        if (!o && bp?.status !== "running") {
          onProgressOpenChange(false);
          onClearSelection();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bp?.status === "running" ? (
                <><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /> Enviando mensagens...</>
              ) : bp?.status === "cancelled" ? (
                <><Ban className="w-5 h-5 text-amber-600" /> Envio cancelado</>
              ) : (
                <><CheckCircle2 className="w-5 h-5 text-emerald-600" /> Envio concluído</>
              )}
            </DialogTitle>
          </DialogHeader>

          {bp && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{bp.processed} / {bp.total}</span>
                </div>
                <Progress value={bp.total > 0 ? (bp.processed / bp.total) * 100 : 0} className="h-2" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                  <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-600" />
                  <p className="text-lg font-bold mt-1 text-emerald-700 dark:text-emerald-400">{bp.sent}</p>
                  <p className="text-xs text-muted-foreground">Enviados</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-center">
                  <AlertCircle className="w-5 h-5 mx-auto text-red-600" />
                  <p className="text-lg font-bold mt-1 text-red-700 dark:text-red-400">{bp.failed}</p>
                  <p className="text-xs text-muted-foreground">Falhas</p>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
                  <SkipForward className="w-5 h-5 mx-auto text-amber-600" />
                  <p className="text-lg font-bold mt-1 text-amber-700 dark:text-amber-400">{bp.skipped}</p>
                  <p className="text-xs text-muted-foreground">Sem telefone</p>
                </div>
              </div>

              {bp.results.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  <Label className="text-xs text-muted-foreground">Últimos resultados:</Label>
                  {bp.results.slice(-10).reverse().map((r: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-muted/50">
                      {r.status === "sent" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                      {r.status === "failed" && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      {r.status === "skipped" && <SkipForward className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      <span className="truncate flex-1">{r.name}</span>
                      {r.error && <span className="text-muted-foreground truncate max-w-[150px]">{r.error}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {bp?.status === "running" ? (
              <Button variant="destructive" onClick={onCancel} disabled={isCancelling}>
                <Ban className="w-4 h-4 mr-1.5" />
                Cancelar Envio
              </Button>
            ) : (
              <Button onClick={() => { onProgressOpenChange(false); onClearSelection(); }}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
