import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Circle,
  AlertTriangle, Loader2, Database, Users, Building2,
  Package, ListTodo, GitBranch, Megaphone, XCircle,
  Target, Key, Eye, EyeOff, ShieldCheck, Download,
  BarChart3, Zap, RefreshCw, UserCog, FileSpreadsheet,
  Upload, Info, Clock, Link2, Shield, Sparkles,
} from "lucide-react";
type Step = "token" | "preview" | "configure" | "importing" | "done";

interface ImportConfig {
  importContacts: boolean;
  importDeals: boolean;
  importOrganizations: boolean;
  importProducts: boolean;
  importTasks: boolean;
  importPipelines: boolean;
  importSources: boolean;
  importCampaigns: boolean;
  importLossReasons: boolean;
  importUsers: boolean;
}

const defaultConfig: ImportConfig = {
  importContacts: true,
  importDeals: true,
  importOrganizations: true,
  importProducts: true,
  importTasks: true,
  importPipelines: true,
  importSources: true,
  importCampaigns: true,
  importLossReasons: true,
  importUsers: true,
};

const dataCategories = [
  { key: "importPipelines" as const, icon: GitBranch, label: "Funis de vendas", desc: "Funis e etapas do pipeline", summaryKey: "pipelines" },
  { key: "importUsers" as const, icon: UserCog, label: "Usuários", desc: "Usuários e responsáveis do RD", summaryKey: "users" },
  { key: "importContacts" as const, icon: Users, label: "Clientes", desc: "Pessoas e informacoes de clientes", summaryKey: "contacts" },
  { key: "importOrganizations" as const, icon: Building2, label: "Empresas", desc: "Organizações e contas", summaryKey: "organizations" },
  { key: "importDeals" as const, icon: Target, label: "Negociações", desc: "Deals com valores e status", summaryKey: "deals" },
  { key: "importProducts" as const, icon: Package, label: "Produtos", desc: "Catálogo de produtos/serviços", summaryKey: "products" },
  { key: "importTasks" as const, icon: ListTodo, label: "Tarefas", desc: "Tarefas e atividades", summaryKey: "tasks" },
  { key: "importSources" as const, icon: Zap, label: "Fontes", desc: "Fontes de leads", summaryKey: "sources" },
  { key: "importCampaigns" as const, icon: Megaphone, label: "Campanhas", desc: "Campanhas de marketing", summaryKey: "campaigns" },
  { key: "importLossReasons" as const, icon: XCircle, label: "Motivos de perda", desc: "Razões de perda de negociações", summaryKey: "lossReasons" },
];

const categoryLabels: Record<string, string> = {
  pipelines: "Funis",
  users: "Usuários",
  sources: "Fontes",
  campaigns: "Campanhas",
  lossReasons: "Motivos de Perda",
  products: "Produtos",
  organizations: "Empresas",
  contacts: "Clientes",
  deals: "Negociações",
  tasks: "Tarefas",
  validation: "Validação",
};

// ─── Spreadsheet types ───
type SpreadsheetStep = "upload" | "preview" | "importing" | "done";
interface SpreadsheetRow {
  nome: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  negociacao?: string;
  valor?: string;
  etapa?: string;
  fonte?: string;
  [key: string]: string | undefined;
}

export default function RDCrmImport() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"api" | "spreadsheet">("api");

  if (!adminLoading && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4 py-20">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">
          A importação de dados do RD Station CRM é exclusiva para administradores.
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

  // ─── API Import State ───
  const [step, setStep] = useState<Step>("token");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<ImportConfig>(defaultConfig);
  const [cleanBeforeImport, setCleanBeforeImport] = useState(false);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  // ─── Spreadsheet Import State ───
  const [ssStep, setSsStep] = useState<SpreadsheetStep>("upload");
  const [ssFile, setSsFile] = useState<File | null>(null);
  const [ssRows, setSsRows] = useState<SpreadsheetRow[]>([]);
  const [ssErrors, setSsErrors] = useState<string[]>([]);
  const [ssImporting, setSsImporting] = useState(false);
  const [ssResult, setSsResult] = useState<{ imported: number; skipped: number; errors: string[]; contactsCreated?: number; accountsCreated?: number; productsCreated?: number; customFieldsDetected?: number; totalRows?: number } | null>(null);
  const [ssProgressStarted, setSsProgressStarted] = useState(false);

  const validateMutation = trpc.rdCrmImport.validateToken.useMutation();
  const summaryMutation = trpc.rdCrmImport.fetchSummary.useMutation();
  const importMutation = trpc.rdCrmImport.importAll.useMutation();
  const spreadsheetImportMutation = trpc.rdCrmImport.importSpreadsheet?.useMutation?.();
  const progressQuery = trpc.rdCrmImport.getProgress.useQuery(undefined, {
    enabled: step === "importing",
    refetchInterval: step === "importing" ? 1500 : false,
  });
  const ssProgressQuery = trpc.rdCrmImport.getSpreadsheetProgress?.useQuery?.(undefined, {
    enabled: ssProgressStarted && ssStep === "importing",
    refetchInterval: ssProgressStarted && ssStep === "importing" ? 1500 : false,
  });
  const ssProgressData = ssProgressQuery?.data as any;

  const progress = progressQuery.data;

  // Watch for import completion via polling
  useEffect(() => {
    if (step !== "importing" || !progress) return;
    if (progress.status === "done") {
      setStep("done");
      const totalImported = Object.values(progress.results || {}).reduce((sum, r) => sum + r.imported, 0);
      const totalErrors = Object.values(progress.results || {}).reduce((sum, r) => sum + r.errors.length, 0);
      if (totalErrors === 0) {
        toast.success(`Importação concluída! ${totalImported.toLocaleString("pt-BR")} registros importados.`);
      } else {
        toast.warning(`Importação concluída com ${totalErrors} erros. ${totalImported.toLocaleString("pt-BR")} registros importados.`);
      }
    } else if (progress.status === "error") {
      toast.error(`Erro na importação: ${progress.error || "Erro desconhecido"}`);
      setStep("configure");
    }
  }, [progress?.status, step]);

  const handleValidateToken = async () => {
    if (!token.trim()) {
      toast.error("Insira o token da API do RD Station CRM");
      return;
    }
    try {
      const result = await validateMutation.mutateAsync({ token: token.trim() });
      if (result.valid) {
        toast.success("Token válido! Buscando dados...");
        const summaryData = await summaryMutation.mutateAsync({ token: token.trim() });
        setSummary(summaryData);
        setStep("preview");
      } else {
        toast.error(`Token inválido: ${result.error || "Verifique o token e tente novamente"}`);
      }
    } catch (e: any) {
      toast.error(`Erro ao validar: ${e.message}`);
    }
  };

  const handleStartImport = async () => {
    setStep("importing");
    try {
      await importMutation.mutateAsync({
        token: token.trim(),
        ...config,
        cleanBeforeImport,
      });
    } catch (e: any) {
      toast.error(`Erro ao iniciar importação: ${e.message}`);
      setStep("configure");
    }
  };

  const totalSelected = useMemo(() => {
    if (!summary) return 0;
    return dataCategories.reduce((sum, cat) => {
      if (config[cat.key]) return sum + (summary[cat.summaryKey] || 0);
      return sum;
    }, 0);
  }, [summary, config]);

  const isLoading = validateMutation.isPending || summaryMutation.isPending;

  const overallPercent = useMemo(() => {
    if (!progress || progress.totalSteps === 0) return 0;
    // Base: completed categories as percentage
    const basePercent = (progress.completedSteps / progress.totalSteps) * 100;
    // Current category progress (whether fetching or importing)
    const categoryPercent = progress.categoryTotal > 0
      ? (progress.categoryDone / progress.categoryTotal) * (100 / progress.totalSteps)
      : 0;
    const calculated = basePercent + categoryPercent;
    // During fetch phase with no category total yet, show at least 1% if import has started
    // to avoid the dreaded 0% freeze
    if (calculated === 0 && progress.status !== "idle") {
      // Show a small pulse to indicate activity
      const elapsed = Date.now() - progress.startedAt;
      if (elapsed > 2000) return 1; // After 2s, show at least 1%
    }
    return Math.min(Math.round(calculated), 99);
  }, [progress]);

  // Detect if the import is alive (heartbeat check)
  const isImportAlive = useMemo(() => {
    if (!progress || progress.status !== "importing") return true;
    const lastActivity = (progress as any).lastActivityAt || progress.startedAt;
    return (Date.now() - lastActivity) < 30000; // 30s timeout
  }, [progress]);

  const totalImportedSoFar = useMemo(() => {
    if (!progress?.results) return 0;
    return Object.values(progress.results).reduce((sum, r) => sum + r.imported, 0);
  }, [progress?.results]);

  const totalErrorsSoFar = useMemo(() => {
    if (!progress?.results) return 0;
    return Object.values(progress.results).reduce((sum, r) => sum + r.errors.length, 0);
  }, [progress?.results]);

  // ─── Spreadsheet Handlers ───
  const handleDownloadTemplate = useCallback(() => {
    const headers = ["nome", "email", "telefone", "empresa", "negociacao", "valor", "etapa", "fonte", "campanha", "notas"];
    const exampleRow = ["João Silva", "joao@email.com", "(11) 99999-0000", "Empresa ABC", "Pacote Europa 2026", "15000", "Novo atendimento", "Site", "Google Ads", "Lead qualificado"];
    const csv = [headers.join(";"), exampleRow.join(";")].join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_importacao_entur.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Planilha modelo baixada!");
  }, []);

  // ─── Proper CSV parser that handles quoted fields with commas/newlines ───
  function parseCsvLine(line: string, sep: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === sep) {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  }

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSsFile(file);
    setSsErrors([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        let lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
          setSsErrors(["A planilha precisa ter pelo menos um cabeçalho e uma linha de dados."]);
          return;
        }

        // RD Station CSV starts with "sep=," — skip it
        if (lines[0].trim().toLowerCase().startsWith("sep=")) {
          lines = lines.slice(1);
        }

        // Detect separator (semicolon or comma)
        const sep = lines[0].includes(";") ? ";" : ",";
        // Keep original case for RD Station headers ("Nome", "Empresa", etc.)
        const headers = parseCsvLine(lines[0], sep);
        // Also create lowercase version for validation
        const headersLower = headers.map(h => h.toLowerCase());

        // Detect if this is an RD Station export (has "Nome" and "Estado" columns)
        const isRdExport = headersLower.includes("nome") && (headersLower.includes("estado") || headersLower.includes("funil de vendas"));

        // Validate required columns
        const requiredCols = ["nome"];
        const missing = requiredCols.filter(c => !headersLower.includes(c));
        if (missing.length > 0) {
          setSsErrors([`Colunas obrigatórias não encontradas: ${missing.join(", ")}. Baixe o modelo para referência.`]);
          return;
        }

        const rows: SpreadsheetRow[] = [];
        const parseErrors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCsvLine(lines[i], sep);
          const row: SpreadsheetRow = { nome: "" };
          // Use ORIGINAL headers (preserving case) as keys
          headers.forEach((h, idx) => {
            row[h] = values[idx] || "";
          });
          // Also set lowercase "nome" for validation
          const nomeIdx = headersLower.indexOf("nome");
          if (nomeIdx >= 0) row.nome = values[nomeIdx] || "";

          if (!row.nome?.trim()) {
            parseErrors.push(`Linha ${i + 1}: campo "Nome" vazio — será ignorada.`);
            continue;
          }
          rows.push(row);
        }

        setSsRows(rows);
        setSsErrors(parseErrors);
        setSsStep("preview");

        if (isRdExport) {
          const colCount = headers.length;
          toast.success(`CSV do RD Station detectado! ${rows.length} negociações com ${colCount} colunas.`);
        } else {
          toast.success(`${rows.length} registros encontrados na planilha.`);
        }
      } catch (err: any) {
        setSsErrors([`Erro ao ler arquivo: ${err.message}`]);
      }
    };
    reader.readAsText(file, "utf-8");
  }, []);

  // Watch spreadsheet progress and transition to done when complete
  useEffect(() => {
    if (ssProgressData && ssStep === "importing") {
      if (ssProgressData.status === "done") {
        setSsResult({
          imported: ssProgressData.imported || 0,
          skipped: ssProgressData.skipped || 0,
          errors: ssProgressData.errorDetails || [],
          contactsCreated: ssProgressData.contactsCreated,
          accountsCreated: ssProgressData.accountsCreated,
          productsCreated: ssProgressData.productsCreated,
          customFieldsDetected: ssProgressData.customFieldsDetected,
          totalRows: ssProgressData.totalRows,
        });
        setSsStep("done");
        setSsImporting(false);
        setSsProgressStarted(false);
        toast.success("Importação por planilha concluída!");
      } else if (ssProgressData.status === "error") {
        toast.error(`Erro na importação: ${ssProgressData.phase}`);
        setSsStep("preview");
        setSsImporting(false);
        setSsProgressStarted(false);
      }
    }
  }, [ssProgressData, ssStep]);

  const handleSpreadsheetImport = useCallback(async () => {
    if (ssRows.length === 0) return;
    setSsImporting(true);
    setSsStep("importing");

    try {
      if (spreadsheetImportMutation) {
        // Send ALL columns as Record<string, string> — the backend handles mapping
        // This returns immediately, the import runs in background
        await spreadsheetImportMutation.mutateAsync({
          rows: ssRows as any, // rows already have all CSV columns as keys
        });
        // Start polling for progress
        setSsProgressStarted(true);
      } else {
        toast.error("Endpoint de importação por planilha não disponível. Será implementado em breve.");
        setSsStep("upload");
        setSsImporting(false);
        return;
      }
    } catch (e: any) {
      toast.error(`Erro na importação: ${e.message}`);
      setSsStep("preview");
      setSsImporting(false);
    }
  }, [ssRows, spreadsheetImportMutation]);

  return (
    <div className="page-content max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => setLocation("/settings")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Configurações
        </button>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{
            background: "linear-gradient(135deg, #e74c3c, #c0392b)"
          }}>
            <Database className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Migrar para o Clinilucro</h1>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Importe seus dados com máxima fidelidade e continue sua operação sem interrupção
            </p>
          </div>
        </div>
      </div>

      {/* Import Method Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "api" | "spreadsheet")} className="mb-6">
        <TabsList className="w-full">
          <TabsTrigger value="api" className="flex-1 gap-2">
            <Key className="h-4 w-4" />
            RD Station CRM (API)
          </TabsTrigger>
          <TabsTrigger value="spreadsheet" className="flex-1 gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Planilha (outros CRMs)
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TAB 1: API IMPORT */}
        {/* ═══════════════════════════════════════════════════════ */}
        <TabsContent value="api" className="mt-6">
          {/* Trust banner */}
          <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Migração inteligente do RD Station CRM</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A importação via API traz seus dados com máxima fidelidade: funis, etapas, negociações com valores e status,
                  contatos vinculados, empresas, tarefas, produtos, fontes, campanhas e motivos de perda.
                  Seus relacionamentos e estrutura operacional são preservados.
                </p>
                <div className="flex flex-wrap gap-3 mt-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5 text-primary" />
                    Vínculos preservados
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    Retries automáticos
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    Deduplicação inteligente
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    Reimportação segura
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mb-6">
            {[
              { id: "token", label: "Token" },
              { id: "preview", label: "Prévia" },
              { id: "configure", label: "Configurar" },
              { id: "importing", label: "Importando" },
              { id: "done", label: "Concluído" },
            ].map((s, i, arr) => {
              const steps: Step[] = ["token", "preview", "configure", "importing", "done"];
              const currentIdx = steps.indexOf(step);
              const stepIdx = steps.indexOf(s.id as Step);
              const isActive = stepIdx === currentIdx;
              const isDone = stepIdx < currentIdx;
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isDone ? "bg-green-500/10 text-green-500" :
                    isActive ? "bg-primary/10 text-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isDone ? <Check className="h-3 w-3" /> : <span className="text-[10px]">{i + 1}</span>}
                    {s.label}
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`w-6 h-px ${isDone ? "bg-green-500/30" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step 1: Token Input */}
          {step === "token" && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Key className="h-5 w-5 text-primary" />
                  Token da API do RD Station CRM
                </CardTitle>
                <CardDescription>
                  O token permite acesso somente leitura aos seus dados. Nenhuma alteração é feita no RD Station.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Token da API</label>
                  <div className="relative">
                    <input
                      type={showToken ? "text" : "password"}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Cole seu token aqui..."
                      className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 pr-10 font-mono"
                    />
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <ShieldCheck className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Segurança e privacidade</p>
                    <p>O token é usado apenas para leitura dos dados e não é armazenado permanentemente. A conexão é criptografada e os dados são processados diretamente no seu tenant isolado.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                  <Info className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Onde encontrar o token</p>
                    <p>No RD Station CRM, acesse <strong>Configurações → Integrações → Token da API</strong> e copie o token gerado. Se não encontrar, consulte a documentação do RD Station.</p>
                  </div>
                </div>

                {/* What will be imported */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs font-medium text-foreground mb-2">O que será importado:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      "Funis e etapas",
                      "Negociações com status",
                      "Contatos e empresas",
                      "Tarefas e atividades",
                      "Produtos do catálogo",
                      "Fontes e campanhas",
                      "Motivos de perda",
                      "Usuários e responsáveis",
                      "Vínculos entre entidades",
                      "Notas e observações",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleValidateToken}
                  disabled={!token.trim() || isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Validando token e buscando dados...
                    </>
                  ) : (
                    <>
                      Validar e continuar
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Preview */}
          {step === "preview" && summary && (
            <div className="space-y-4">
              <Card className="border-green-500/20 bg-green-500/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Conexão estabelecida com sucesso</p>
                      <p className="text-xs text-muted-foreground">Encontramos os seguintes dados na sua conta do RD Station CRM.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Resumo dos dados encontrados
                  </CardTitle>
                  <CardDescription>
                    Estes são os dados disponíveis para importação. Na próxima etapa você escolhe o que trazer.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {dataCategories.map((cat) => {
                      const count = summary[cat.summaryKey] || 0;
                      return (
                        <div
                          key={cat.key}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            count > 0 ? "border-border/50 bg-card" : "border-border/30 bg-muted/30 opacity-60"
                          }`}
                        >
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                            count > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          }`}>
                            <cat.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xl font-semibold text-foreground">{count.toLocaleString("pt-BR")}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{cat.label}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total summary */}
                  <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
                    <p className="text-sm text-muted-foreground">
                      Total disponível: <strong className="text-foreground">{Object.values(summary).reduce((a, b) => a + b, 0).toLocaleString("pt-BR")} registros</strong>
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("token")} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button onClick={() => setStep("configure")} className="flex-1">
                  Configurar importação
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Configure */}
          {step === "configure" && summary && (
            <div className="space-y-4">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Download className="h-5 w-5 text-primary" />
                    Selecione o que importar
                  </CardTitle>
                  <CardDescription>
                    Recomendamos importar tudo para manter a fidelidade da sua operação.
                    Total selecionado: <strong>{totalSelected.toLocaleString("pt-BR")} registros</strong>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dataCategories.map((cat) => {
                    const count = summary[cat.summaryKey] || 0;
                    const isEnabled = config[cat.key];
                    return (
                      <div
                        key={cat.key}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          isEnabled ? "border-primary/20 bg-primary/5" : "border-border/30 bg-card"
                        } ${count === 0 ? "opacity-40 pointer-events-none" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          }`}>
                            <cat.icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{cat.label}</p>
                            <p className="text-[11px] text-muted-foreground">{cat.desc} · {count.toLocaleString("pt-BR")} registros</p>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) => setConfig(prev => ({ ...prev, [cat.key]: checked }))}
                          disabled={count === 0}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* What happens during import */}
              <Card className="border-border/50">
                <CardContent className="py-4">
                  <p className="text-xs font-medium text-foreground mb-2">O que acontece durante a importação:</p>
                  <div className="space-y-1.5">
                    {[
                      "Funis e etapas são recriados com a mesma estrutura",
                      "Negociações são colocadas no funil e etapa corretos",
                      "Contatos são vinculados às negociações e empresas",
                      "Tarefas são associadas às negociações correspondentes",
                      "Fontes, campanhas e motivos de perda são preservados",
                      "Registros duplicados são detectados e ignorados automaticamente",
                      "Falhas em um registro não interrompem os demais",
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                        {item}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Clean before import option */}
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-destructive/10 text-destructive">
                        <RefreshCw className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Limpar dados anteriores</p>
                        <p className="text-[11px] text-muted-foreground">Remove todos os dados importados do RD Station antes de reimportar (importação limpa)</p>
                      </div>
                    </div>
                    <Switch
                      checked={cleanBeforeImport}
                      onCheckedChange={setCleanBeforeImport}
                    />
                  </div>
                  {cleanBeforeImport && (
                    <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <p className="text-[11px] text-destructive">Todos os dados previamente importados do RD Station serão removidos antes da nova importação. Os dados criados manualmente no Clinilucro não serão afetados.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("preview")} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button
                  onClick={handleStartImport}
                  className="flex-1"
                  disabled={totalSelected === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Importar {totalSelected.toLocaleString("pt-BR")} registros
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === "importing" && (
            <div className="space-y-4">
              <Card className="border-border/50">
                <CardContent className="py-10">
                  <div className="flex flex-col items-center text-center mb-8">
                    <div className="relative mb-4">
                      <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary">{overallPercent}%</span>
                      </div>
                      <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <RefreshCw className="h-3.5 w-3.5 text-primary-foreground animate-spin" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      {progress?.phase || "Preparando importação..."}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {totalImportedSoFar > 0 && (
                        <span className="text-primary font-medium">{totalImportedSoFar.toLocaleString("pt-BR")} registros importados</span>
                      )}
                      {totalErrorsSoFar > 0 && (
                        <span className="text-red-400 ml-2">{"\u00b7"} {totalErrorsSoFar} erros</span>
                      )}
                      {totalImportedSoFar === 0 && (progress as any)?.fetchPhase && (
                        <span className="text-amber-500 font-medium">Buscando dados do RD Station...</span>
                      )}
                      {totalImportedSoFar === 0 && !(progress as any)?.fetchPhase && "Conectando ao RD Station CRM..."}
                    </p>
                    {!isImportAlive && (
                      <p className="text-xs text-red-400 mt-1">A importa\u00e7\u00e3o parece estar inativa. Aguarde ou tente novamente.</p>
                    )}
                  </div>

                  {/* Overall progress bar */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Progresso geral</span>
                      <span>{progress?.completedSteps || 0} de {progress?.totalSteps || 0} categorias</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${overallPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Current category progress */}
                  {progress?.currentCategory && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          {(progress as any)?.fetchPhase ? "Buscando" : "Importando"}{" "}
                          {categoryLabels[progress.currentCategory] || progress.currentCategory}
                        </span>
                        {progress.categoryTotal > 0 ? (
                          <span>{progress.categoryDone.toLocaleString("pt-BR")} de {progress.categoryTotal.toLocaleString("pt-BR")}</span>
                        ) : (
                          <span className="text-amber-500">Aguardando...</span>
                        )}
                      </div>
                      {progress.categoryTotal > 0 ? (
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary/60 rounded-full transition-all duration-300"
                            style={{ width: `${Math.round((progress.categoryDone / progress.categoryTotal) * 100)}%` }}
                          />
                        </div>
                      ) : (
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary/40 rounded-full animate-pulse" style={{ width: '30%' }} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Completed categories */}
                  {progress?.results && Object.keys(progress.results).length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Categorias concluídas</p>
                      {Object.entries(progress.results).map(([key, value]) => {
                        const cat = dataCategories.find(c => c.summaryKey === key);
                        const Icon = cat?.icon || Circle;
                        return (
                          <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/10">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-medium text-foreground">{categoryLabels[key] || key}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-green-500 font-medium">{value.imported.toLocaleString("pt-BR")} importados</span>
                              {(value as any).skipped > 0 && (
                                <span className="text-xs text-yellow-500">{(value as any).skipped} já existiam</span>
                              )}
                              {value.errors.length > 0 && (
                                <span className="text-xs text-red-400">{value.errors.length} erros</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground text-center mt-6">
                    Não feche esta página. A importação pode levar vários minutos dependendo da quantidade de registros.
                    Falhas em registros individuais não interrompem o processo.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 5: Done */}
          {step === "done" && progress && (
            <div className="space-y-4">
              <Card className="border-green-500/20 bg-green-500/5">
                <CardContent className="pt-8 pb-6 flex flex-col items-center text-center">
                  <div className="h-16 w-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Migração concluída com sucesso!</h3>
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{totalImportedSoFar.toLocaleString("pt-BR")}</strong> registros importados
                    {totalErrorsSoFar > 0 && <span className="text-red-400"> · {totalErrorsSoFar} erros</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Sua operação do RD Station CRM foi transferida para o Clinilucro. Verifique seus funis e negociações.
                  </p>
                </CardContent>
              </Card>

              {/* Results breakdown */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Detalhes da importação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {progress.results && Object.entries(progress.results).map(([key, value]) => {
                    const cat = dataCategories.find(c => c.summaryKey === key);
                    const Icon = cat?.icon || Circle;
                    return (
                      <div key={key} className="flex items-center justify-between p-3 rounded-xl border border-border/30 bg-card">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="text-sm font-medium text-foreground">{categoryLabels[key] || key}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                            {value.imported.toLocaleString("pt-BR")} importados
                          </Badge>
                          {(value as any).skipped > 0 && (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                              {(value as any).skipped.toLocaleString("pt-BR")} já existiam
                            </Badge>
                          )}
                          {value.errors.length > 0 && (
                            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                              {value.errors.length} erros
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Validation Report */}
              {(progress as any).validation && (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Relatório de Validação
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(progress as any).validation.mismatches?.length > 0 ? (
                      <div className="space-y-2">
                        {(progress as any).validation.mismatches.map((m: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">{m}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-green-500">
                        <CheckCircle2 className="h-4 w-4" />
                        Todos os dados foram validados com sucesso
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Error details */}
              {totalErrorsSoFar > 0 && progress.results && (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                      Erros encontrados ({totalErrorsSoFar})
                    </CardTitle>
                    <CardDescription>Estes registros não puderam ser importados. Os demais dados foram importados normalmente.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {Object.entries(progress.results).map(([key, value]) =>
                        value.errors.map((err, i) => (
                          <div key={`${key}-${i}`} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                            <XCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                            <span><strong className="text-foreground">{categoryLabels[key]}:</strong> {err}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setLocation("/settings")} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar às configurações
                </Button>
                <Button onClick={() => setLocation("/pipeline")} className="flex-1">
                  Ver negociações
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TAB 2: SPREADSHEET IMPORT */}
        {/* ═══════════════════════════════════════════════════════ */}
        <TabsContent value="spreadsheet" className="mt-6">
          {/* Info banner */}
          <div className="mb-6 p-4 rounded-xl border border-border/50 bg-muted/30">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Importação por planilha</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Para quem vem de outros CRMs ou quer importar dados manualmente.
                  Baixe o modelo, preencha com seus dados e faça o upload.
                  Se você usa o RD Station CRM, recomendamos a importação via API (aba ao lado) para maior fidelidade.
                </p>
              </div>
            </div>
          </div>

          {/* Upload step */}
          {ssStep === "upload" && (
            <div className="space-y-4">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Download className="h-5 w-5 text-primary" />
                    1. Baixe o modelo
                  </CardTitle>
                  <CardDescription>
                    A planilha modelo contém os campos aceitos e um exemplo de preenchimento.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={handleDownloadTemplate} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Baixar planilha modelo (.csv)
                  </Button>
                  <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                    <p className="text-xs font-medium text-foreground mb-1.5">Campos aceitos:</p>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { name: "nome", req: true },
                        { name: "email", req: false },
                        { name: "telefone", req: false },
                        { name: "empresa", req: false },
                        { name: "negociacao", req: false },
                        { name: "valor", req: false },
                        { name: "etapa", req: false },
                        { name: "fonte", req: false },
                        { name: "campanha", req: false },
                        { name: "notas", req: false },
                      ].map((f) => (
                        <div key={f.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className={`font-mono ${f.req ? "text-primary font-medium" : ""}`}>{f.name}</span>
                          {f.req && <Badge variant="outline" className="text-[8px] px-1 py-0">obrigatório</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Upload className="h-5 w-5 text-primary" />
                    2. Faça o upload
                  </CardTitle>
                  <CardDescription>
                    Selecione o arquivo CSV preenchido. Separador aceito: ponto e vírgula (;) ou vírgula (,).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border/50 rounded-xl cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Clique para selecionar o arquivo CSV</span>
                    <span className="text-[11px] text-muted-foreground mt-1">ou arraste e solte aqui</span>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  {ssErrors.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {ssErrors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-red-400">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          {err}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Preview step */}
          {ssStep === "preview" && (
            <div className="space-y-4">
              <Card className="border-green-500/20 bg-green-500/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {ssRows.length} negociações encontradas em "{ssFile?.name}"
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {Object.keys(ssRows[0] || {}).length} colunas detectadas
                        {ssRows[0]?.["Estado"] && " · CSV do RD Station CRM"}
                      </p>
                      {ssErrors.length > 0 && (
                        <p className="text-xs text-yellow-500">{ssErrors.length} linhas ignoradas (campos obrigatórios vazios)</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary of detected data */}
              {ssRows.length > 0 && ssRows[0]?.["Estado"] && (
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Resumo do CSV
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(() => {
                        const stats = {
                          vendidas: ssRows.filter(r => r["Estado"] === "Vendida").length,
                          perdidas: ssRows.filter(r => r["Estado"] === "Perdida").length,
                          emAndamento: ssRows.filter(r => r["Estado"] === "Em Andamento").length,
                          comProdutos: ssRows.filter(r => (r["Produtos"] || "").trim()).length,
                          comEmail: ssRows.filter(r => (r["Email"] || r["email"] || "").trim()).length,
                          comTelefone: ssRows.filter(r => (r["Telefone"] || r["telefone"] || "").trim()).length,
                          multiTelefone: ssRows.filter(r => (r["Telefone"] || "").includes(";")).length,
                        };
                        return (
                          <>
                            <div className="p-2 rounded-lg bg-green-500/10 text-center">
                              <p className="text-lg font-bold text-green-500">{stats.vendidas}</p>
                              <p className="text-[10px] text-muted-foreground">Vendidas</p>
                            </div>
                            <div className="p-2 rounded-lg bg-red-500/10 text-center">
                              <p className="text-lg font-bold text-red-500">{stats.perdidas}</p>
                              <p className="text-[10px] text-muted-foreground">Perdidas</p>
                            </div>
                            <div className="p-2 rounded-lg bg-blue-500/10 text-center">
                              <p className="text-lg font-bold text-blue-500">{stats.emAndamento}</p>
                              <p className="text-[10px] text-muted-foreground">Em Andamento</p>
                            </div>
                            <div className="p-2 rounded-lg bg-purple-500/10 text-center">
                              <p className="text-lg font-bold text-purple-500">{stats.comProdutos}</p>
                              <p className="text-[10px] text-muted-foreground">Com Produtos</p>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/50 text-center">
                              <p className="text-lg font-bold text-foreground">{stats.comEmail}</p>
                              <p className="text-[10px] text-muted-foreground">Com Email</p>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/50 text-center">
                              <p className="text-lg font-bold text-foreground">{stats.comTelefone}</p>
                              <p className="text-[10px] text-muted-foreground">Com Telefone</p>
                            </div>
                            <div className="p-2 rounded-lg bg-orange-500/10 text-center">
                              <p className="text-lg font-bold text-orange-500">{stats.multiTelefone}</p>
                              <p className="text-[10px] text-muted-foreground">Multi-Telefone</p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Prévia dos dados</CardTitle>
                  <CardDescription>Primeiros {Math.min(ssRows.length, 10)} registros para conferência.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/30">
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">#</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Nome</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Contato</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Telefone</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Empresa</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Etapa</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Estado</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Valor</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Produtos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ssRows.slice(0, 10).map((row, i) => (
                          <tr key={i} className="border-b border-border/20">
                            <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                            <td className="py-2 px-2 text-foreground font-medium whitespace-nowrap max-w-[200px] truncate">{row["Nome"] || row.nome || "—"}</td>
                            <td className="py-2 px-2 text-muted-foreground whitespace-nowrap max-w-[150px] truncate">{row["Contatos"] || row["Email"] || row.email || "—"}</td>
                            <td className="py-2 px-2 text-muted-foreground whitespace-nowrap max-w-[150px] truncate">{row["Telefone"] || row.telefone || "—"}</td>
                            <td className="py-2 px-2 text-muted-foreground whitespace-nowrap max-w-[120px] truncate">{row["Empresa"] || row.empresa || "—"}</td>
                            <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">{row["Etapa"] || row.etapa || "—"}</td>
                            <td className="py-2 px-2 whitespace-nowrap">
                              {row["Estado"] === "Vendida" ? (
                                <Badge variant="outline" className="text-[9px] bg-green-500/10 text-green-500 border-green-500/30">Vendida</Badge>
                              ) : row["Estado"] === "Perdida" ? (
                                <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-500 border-red-500/30">Perdida</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px]">{row["Estado"] || "—"}</Badge>
                              )}
                            </td>
                            <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">{row["Valor Único"] || row.valor || "—"}</td>
                            <td className="py-2 px-2 text-muted-foreground whitespace-nowrap max-w-[150px] truncate">{row["Produtos"] || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {ssRows.length > 10 && (
                    <p className="text-[11px] text-muted-foreground text-center mt-2">
                      ... e mais {ssRows.length - 10} registros
                    </p>
                  )}
                </CardContent>
              </Card>

              {ssErrors.length > 0 && (
                <Card className="border-yellow-500/20 bg-yellow-500/5">
                  <CardContent className="py-4">
                    <p className="text-xs font-medium text-foreground mb-2">Avisos de validação:</p>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {ssErrors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] text-yellow-600">
                          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                          {err}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setSsStep("upload"); setSsRows([]); setSsFile(null); }} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button onClick={handleSpreadsheetImport} className="flex-1" disabled={ssImporting}>
                  {ssImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Importar {ssRows.length} registros
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Importing step with live progress */}
          {ssStep === "importing" && (
            <Card className="border-border/50">
              <CardContent className="py-8">
                <div className="flex flex-col items-center text-center mb-6">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                  <h3 className="text-lg font-semibold text-foreground mb-1">Importando dados da planilha...</h3>
                  <p className="text-sm text-muted-foreground">
                    {ssProgressData?.phase || `Processando ${ssRows.length} registros. Aguarde.`}
                  </p>
                </div>

                {ssProgressData && ssProgressData.totalRows > 0 && (
                  <div className="space-y-4">
                    {/* Progress bar */}
                    <div className="w-full">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{ssProgressData.processedRows || 0} de {ssProgressData.totalRows}</span>
                        <span>{Math.round(((ssProgressData.processedRows || 0) / ssProgressData.totalRows) * 100)}%</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${Math.round(((ssProgressData.processedRows || 0) / ssProgressData.totalRows) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Live stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-green-500/10 text-center">
                        <p className="text-xl font-bold text-green-500">{ssProgressData.imported || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Importadas</p>
                      </div>
                      <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                        <p className="text-xl font-bold text-blue-500">{ssProgressData.contactsCreated || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Contatos</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-500/10 text-center">
                        <p className="text-xl font-bold text-red-500">{ssProgressData.errors || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Erros</p>
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground text-center">
                      Tempo estimado: ~{Math.max(1, Math.round(((ssProgressData.totalRows - (ssProgressData.processedRows || 0)) / Math.max(1, ssProgressData.processedRows || 1)) * ((Date.now() - (ssProgressData.startedAt || Date.now())) / 1000 / 60)))} min restantes
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Done step */}
          {ssStep === "done" && ssResult && (
            <div className="space-y-4">
              <Card className="border-green-500/20 bg-green-500/5">
                <CardContent className="pt-8 pb-6 flex flex-col items-center text-center">
                  <div className="h-16 w-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Importação por planilha concluída!</h3>
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{ssResult.imported}</strong> negociações importadas
                    {ssResult.skipped > 0 && <span> · {ssResult.skipped} já existiam</span>}
                    {ssResult.errors.length > 0 && <span className="text-red-400"> · {ssResult.errors.length} erros</span>}
                  </p>
                  {(ssResult.contactsCreated || ssResult.accountsCreated || ssResult.productsCreated || ssResult.customFieldsDetected) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {ssResult.contactsCreated ? <Badge variant="outline" className="text-[10px]"><Users className="h-3 w-3 mr-1" />{ssResult.contactsCreated} contatos</Badge> : null}
                      {ssResult.accountsCreated ? <Badge variant="outline" className="text-[10px]"><Building2 className="h-3 w-3 mr-1" />{ssResult.accountsCreated} empresas</Badge> : null}
                      {ssResult.productsCreated ? <Badge variant="outline" className="text-[10px]"><Package className="h-3 w-3 mr-1" />{ssResult.productsCreated} produtos</Badge> : null}
                      {ssResult.customFieldsDetected ? <Badge variant="outline" className="text-[10px]"><Sparkles className="h-3 w-3 mr-1" />{ssResult.customFieldsDetected} campos personalizados</Badge> : null}
                    </div>
                  )}
                </CardContent>
              </Card>

              {ssResult.errors.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                      Erros ({ssResult.errors.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {ssResult.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                          <XCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                          {err}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setSsStep("upload"); setSsRows([]); setSsFile(null); setSsResult(null); }} className="flex-1">
                  Importar outra planilha
                </Button>
                <Button onClick={() => setLocation("/pipeline")} className="flex-1">
                  Ver negociações
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
