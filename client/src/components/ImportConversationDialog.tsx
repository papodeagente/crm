import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, CheckCircle2, AlertCircle, Briefcase } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

interface ImportConversationDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  remoteJid: string;
  dealId?: number | null;
  waConversationId?: number | null;
  contactName?: string;
  contactId?: number;
}

type Period = "all" | "last50" | "24h" | "48h";

const PERIOD_OPTIONS: { value: Period; label: string; description: string }[] = [
  { value: "last50", label: "Últimas 50 mensagens", description: "As 50 mensagens mais recentes da conversa" },
  { value: "24h", label: "Últimas 24 horas", description: "Todas as mensagens das últimas 24 horas" },
  { value: "48h", label: "Últimas 48 horas", description: "Todas as mensagens das últimas 48 horas" },
  { value: "all", label: "Todas as mensagens", description: "Histórico completo da conversa (pode ser extenso)" },
];

export default function ImportConversationDialog({
  open,
  onClose,
  sessionId,
  remoteJid,
  dealId,
  waConversationId,
  contactName,
  contactId,
}: ImportConversationDialogProps) {
  const [period, setPeriod] = useState<Period>("last50");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<{ messageCount?: number; title?: string; error?: string } | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string>("");

  // Whether we need a deal selector (Inbox context: no dealId provided)
  const needsDealSelector = !dealId;

  // Fetch deals list only when we need the selector
  const deals = trpc.crm.deals.list.useQuery(
    { limit: 200 },
    { enabled: open && needsDealSelector }
  );

  const dealOptions = useMemo(() => {
    const items = (deals.data as any)?.items || (Array.isArray(deals.data) ? deals.data : []);
    return items.map((d: any) => ({
      value: String(d.id),
      label: d.title || `Negociação #${d.id}`,
      sublabel: [d.contactName, d.accountName].filter(Boolean).join(" · ") || undefined,
    }));
  }, [deals.data]);

  // Effective deal ID: prop or selected from combobox
  const effectiveDealId = dealId || (selectedDealId ? Number(selectedDealId) : null);

  const importMutation = trpc.inbox.importConversationAsNote.useMutation();

  const handleImport = async () => {
    // Validate: must have either dealId or waConversationId
    if (!effectiveDealId && !waConversationId) {
      toast.error("Selecione uma negociação para vincular a anotação.");
      return;
    }

    setStatus("loading");
    setResult(null);
    try {
      const res = await importMutation.mutateAsync({
        sessionId,
        remoteJid,
        period,
        dealId: effectiveDealId ?? null,
        waConversationId: waConversationId ?? null,
      });
      if (res.success) {
        setStatus("success");
        setResult({ messageCount: res.messageCount, title: res.title });
        toast.success(`${res.messageCount} mensagens importadas como anotação.`);
      } else {
        setStatus("error");
        setResult({ error: res.error || "Erro desconhecido." });
      }
    } catch (err: any) {
      setStatus("error");
      setResult({ error: err?.message || "Erro ao importar conversa." });
    }
  };

  const handleClose = () => {
    setStatus("idle");
    setResult(null);
    setPeriod("last50");
    setSelectedDealId("");
    onClose();
  };

  const destinationLabel = effectiveDealId
    ? "anotação na negociação"
    : waConversationId
    ? "nota interna da conversa"
    : "anotação";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Importar Conversa como Anotação
          </DialogTitle>
          <DialogDescription>
            {contactName
              ? `Importar mensagens de ${contactName} como ${destinationLabel}.`
              : `Importar mensagens como ${destinationLabel}.`}
          </DialogDescription>
        </DialogHeader>

        {status === "idle" || status === "loading" ? (
          <>
            {/* Deal selector when no dealId is provided (Inbox context) */}
            {needsDealSelector && (
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" />
                  Vincular à negociação
                </Label>
                <SearchableCombobox
                  options={dealOptions}
                  value={selectedDealId}
                  onValueChange={setSelectedDealId}
                  placeholder="Buscar negociação..."
                  searchPlaceholder="Digite o nome da negociação..."
                  emptyText="Nenhuma negociação encontrada."
                  loading={deals.isLoading}
                  clearable
                />
                {!selectedDealId && waConversationId && (
                  <p className="text-[11px] text-muted-foreground">
                    Se nenhuma negociação for selecionada, a conversa será salva como nota interna.
                  </p>
                )}
                {!selectedDealId && !waConversationId && (
                  <p className="text-[11px] text-destructive">
                    Selecione uma negociação para vincular a anotação.
                  </p>
                )}
              </div>
            )}

            <div className="py-2">
              <Label className="text-sm font-medium text-foreground mb-3 block">
                Selecione o período:
              </Label>
              <RadioGroup
                value={period}
                onValueChange={(v) => setPeriod(v as Period)}
                className="space-y-2"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      period === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                    }`}
                  >
                    <RadioGroupItem value={opt.value} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="rounded-lg bg-muted/50 border border-border p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                As mensagens serão formatadas no padrão WhatsApp com data, hora e remetente, e salvas como
                {effectiveDealId ? " anotação na negociação" : waConversationId ? " nota interna da conversa" : " anotação"}.
                Mensagens de sistema serão ignoradas automaticamente.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} disabled={status === "loading"}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={status === "loading" || (needsDealSelector && !selectedDealId && !waConversationId)}
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Importar
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : status === "success" ? (
          <>
            <div className="flex flex-col items-center py-6 gap-3">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-sm font-medium text-foreground text-center">
                {result?.messageCount} mensagens importadas com sucesso!
              </p>
              {result?.title && (
                <p className="text-xs text-muted-foreground text-center">{result.title}</p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center py-6 gap-3">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-sm font-medium text-foreground text-center">
                Erro ao importar conversa
              </p>
              <p className="text-xs text-muted-foreground text-center">{result?.error}</p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>Fechar</Button>
              <Button onClick={() => { setStatus("idle"); setResult(null); }}>Tentar novamente</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
