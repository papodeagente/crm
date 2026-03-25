import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowRightLeft, Loader2, Zap, Server, ShieldCheck,
  RotateCcw, Activity, Eye, EyeOff, Info, CheckCircle2, XCircle
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ProviderManagerProps {
  session: {
    sessionId: string;
    provider?: string;
    providerInstanceId?: string | null;
    providerToken?: string | null;
    providerClientToken?: string | null;
    liveStatus?: string;
    phoneNumber?: string | null;
  };
}

export default function ProviderManager({ session }: ProviderManagerProps) {
  const utils = trpc.useUtils();
  const currentProvider = session.provider || "evolution";

  // ─── State ───
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false);
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [zapiInstanceId, setZapiInstanceId] = useState(session.providerInstanceId || "");
  const [zapiToken, setZapiToken] = useState(session.providerToken || "");
  const [zapiClientToken, setZapiClientToken] = useState(session.providerClientToken || "");
  const [showToken, setShowToken] = useState(false);
  const [showClientToken, setShowClientToken] = useState(false);

  // ─── Mutations ───
  const migrateMut = trpc.monitoring.migrateProvider.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Sessão migrada para ${data.provider === "zapi" ? "Z-API" : "Evolution API"} com sucesso!`);
      setMigrateDialogOpen(false);
      utils.whatsapp.sessions.invalidate();
    },
    onError: (err: any) => toast.error(`Erro ao migrar: ${err.message}`),
  });

  const rollbackMut = trpc.monitoring.rollbackProvider.useMutation({
    onSuccess: () => {
      toast.success("Sessão restaurada para Evolution API com sucesso!");
      setRollbackDialogOpen(false);
      utils.whatsapp.sessions.invalidate();
    },
    onError: (err: any) => toast.error(`Erro ao restaurar: ${err.message}`),
  });

  // ─── Handlers ───
  const handleMigrate = () => {
    if (currentProvider === "evolution") {
      // Migrating to Z-API — need credentials
      if (!zapiInstanceId.trim() || !zapiToken.trim()) {
        toast.error("Preencha o Instance ID e o Token da Z-API.");
        return;
      }
      migrateMut.mutate({
        sessionId: session.sessionId,
        toProvider: "zapi",
        zapiInstanceId: zapiInstanceId.trim(),
        zapiToken: zapiToken.trim(),
        zapiClientToken: zapiClientToken.trim() || undefined,
      });
    } else {
      // Migrating back to Evolution
      migrateMut.mutate({
        sessionId: session.sessionId,
        toProvider: "evolution",
      });
    }
  };

  const handleRollback = () => {
    rollbackMut.mutate({ sessionId: session.sessionId });
  };

  const isZapi = currentProvider === "zapi";
  const targetProvider = isZapi ? "Evolution API" : "Z-API";

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-[15px] font-semibold text-foreground">Provedor de API</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[280px]">
              <p className="text-[12px]">
                Escolha qual API de WhatsApp será usada para esta sessão.
                A migração pode ser revertida a qualquer momento.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card className="border border-border/40 shadow-none rounded-xl">
        <div className="p-5 space-y-5">
          {/* Current Provider Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                isZapi ? "bg-blue-50" : "bg-emerald-50"
              }`}>
                {isZapi ? (
                  <Zap className="h-5 w-5 text-blue-600" />
                ) : (
                  <Server className="h-5 w-5 text-emerald-600" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-semibold text-foreground">
                    {isZapi ? "Z-API" : "Evolution API"}
                  </p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 h-5 ${
                      isZapi
                        ? "border-blue-200 text-blue-700 bg-blue-50"
                        : "border-emerald-200 text-emerald-700 bg-emerald-50"
                    }`}
                  >
                    Ativo
                  </Badge>
                </div>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {isZapi
                    ? "Serviço gerenciado — webhooks confiáveis, sem servidor próprio"
                    : "Self-hosted — controle total, requer manutenção"}
                </p>
              </div>
            </div>
          </div>

          {/* Z-API Credentials (shown when Z-API is active) */}
          {isZapi && (
            <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-4 space-y-3">
              <p className="text-[12px] font-medium text-blue-800">Credenciais Z-API</p>
              <div className="grid gap-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-blue-600">Instance ID</span>
                  <span className="text-[12px] font-mono text-blue-900">{session.providerInstanceId || "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-blue-600">Token</span>
                  <span className="text-[12px] font-mono text-blue-900">
                    {session.providerToken ? "••••••••" : "—"}
                  </span>
                </div>
                {session.providerClientToken && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-blue-600">Client Token</span>
                    <span className="text-[12px] font-mono text-blue-900">••••••••</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border/40" />

          {/* Action Buttons */}
          <div className="flex gap-2">
            {/* Migrate Button */}
            <Button
              variant="outline"
              className={`flex-1 h-10 rounded-xl text-[13px] gap-2 ${
                isZapi
                  ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  : "border-blue-200 text-blue-700 hover:bg-blue-50"
              }`}
              onClick={() => setMigrateDialogOpen(true)}
            >
              <ArrowRightLeft className="h-4 w-4" />
              Migrar para {targetProvider}
            </Button>

            {/* Emergency Rollback (only when on Z-API) */}
            {isZapi && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-10 px-3 rounded-xl text-[13px] border-amber-200 text-amber-700 hover:bg-amber-50"
                      onClick={() => setRollbackDialogOpen(true)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-[12px]">Rollback de emergência para Evolution</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Provider Comparison */}
          <div className="rounded-xl border border-border/30 overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border/30">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Comparação de Provedores
              </p>
            </div>
            <div className="divide-y divide-border/20">
              {[
                { label: "Tipo", evo: "Self-hosted", zapi: "Serviço gerenciado" },
                { label: "Webhooks", evo: "Instáveis (requer polling)", zapi: "Confiáveis" },
                { label: "Custo", evo: "Gratuito", zapi: "Pago por instância" },
                { label: "Manutenção", evo: "Alta", zapi: "Baixa" },
                { label: "Estabilidade", evo: "Variável", zapi: "Alta" },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-3 px-4 py-2">
                  <span className="text-[11px] text-muted-foreground font-medium">{row.label}</span>
                  <span className={`text-[11px] ${currentProvider === "evolution" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {row.evo}
                  </span>
                  <span className={`text-[11px] ${currentProvider === "zapi" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {row.zapi}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* ─── MIGRATE DIALOG ─── */}
      <Dialog open={migrateDialogOpen} onOpenChange={setMigrateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px] flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Migrar para {targetProvider}
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              {isZapi
                ? "A sessão será migrada de volta para a Evolution API. As credenciais Z-API serão removidas."
                : "Preencha as credenciais da Z-API para migrar esta sessão. Você pode obter essas informações no painel da Z-API."}
            </DialogDescription>
          </DialogHeader>

          {/* Z-API Credentials Form (when migrating TO Z-API) */}
          {!isZapi && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="zapi-instance" className="text-[13px] font-medium">
                  Instance ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="zapi-instance"
                  placeholder="Ex: 3C7A1B2D9E4F..."
                  value={zapiInstanceId}
                  onChange={(e) => setZapiInstanceId(e.target.value)}
                  className="h-10 rounded-lg text-[13px] font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Encontre no painel Z-API &rarr; Sua instância &rarr; ID
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zapi-token" className="text-[13px] font-medium">
                  Token <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="zapi-token"
                    type={showToken ? "text" : "password"}
                    placeholder="Token da instância"
                    value={zapiToken}
                    onChange={(e) => setZapiToken(e.target.value)}
                    className="h-10 rounded-lg text-[13px] font-mono pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Encontre no painel Z-API &rarr; Sua instância &rarr; Token
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zapi-client-token" className="text-[13px] font-medium">
                  Client Token <span className="text-muted-foreground text-[11px]">(opcional)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="zapi-client-token"
                    type={showClientToken ? "text" : "password"}
                    placeholder="Token de segurança do cliente"
                    value={zapiClientToken}
                    onChange={(e) => setZapiClientToken(e.target.value)}
                    className="h-10 rounded-lg text-[13px] font-mono pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowClientToken(!showClientToken)}
                  >
                    {showClientToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Usado para validar webhooks recebidos. Recomendado para segurança.
                </p>
              </div>

              {/* Info box */}
              <div className="rounded-lg bg-blue-50 border border-blue-200/60 p-3">
                <div className="flex gap-2 items-start">
                  <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    As credenciais são armazenadas de forma segura e usadas apenas para comunicação com a Z-API.
                    A migração pode ser revertida a qualquer momento.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation when migrating back to Evolution */}
          {isZapi && (
            <div className="py-2">
              <div className="rounded-lg bg-amber-50 border border-amber-200/60 p-3.5">
                <div className="flex gap-2 items-start">
                  <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="text-[12px] text-amber-700 font-medium">
                      Ao migrar de volta para Evolution API:
                    </p>
                    <ul className="text-[11px] text-amber-600 space-y-1 list-disc list-inside">
                      <li>As credenciais Z-API serão removidas</li>
                      <li>A sessão voltará a usar polling para sincronização</li>
                      <li>Pode ser necessário reconectar o QR Code</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-lg text-[13px]"
              onClick={() => setMigrateDialogOpen(false)}
              disabled={migrateMut.isPending}
            >
              Cancelar
            </Button>
            <Button
              className={`rounded-lg text-[13px] text-white gap-2 ${
                isZapi
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
              onClick={handleMigrate}
              disabled={migrateMut.isPending}
            >
              {migrateMut.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Migrando...</>
              ) : (
                <><ArrowRightLeft className="h-4 w-4" />Confirmar Migração</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── ROLLBACK DIALOG ─── */}
      <AlertDialog open={rollbackDialogOpen} onOpenChange={setRollbackDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px] flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              Rollback de Emergência
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-[13px]">
                  Esta ação irá restaurar imediatamente a sessão para a <strong>Evolution API</strong>.
                  Use apenas em caso de problemas com a Z-API.
                </p>
                <div className="rounded-lg bg-red-50 border border-red-200/60 p-3">
                  <div className="flex gap-2 items-start">
                    <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-red-700 space-y-1">
                      <p className="font-medium">O que acontece no rollback:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Provider volta para Evolution API</li>
                        <li>Credenciais Z-API são removidas</li>
                        <li>Pode ser necessário reconectar via QR Code</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg text-[13px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg text-[13px] bg-amber-600 hover:bg-amber-700 text-white gap-2"
              onClick={(e) => {
                e.preventDefault();
                handleRollback();
              }}
              disabled={rollbackMut.isPending}
            >
              {rollbackMut.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Restaurando...</>
              ) : (
                <><RotateCcw className="h-4 w-4" />Confirmar Rollback</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
