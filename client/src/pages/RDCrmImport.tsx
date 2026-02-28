import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Circle,
  AlertTriangle, Loader2, Database, Users, Building2,
  Package, ListTodo, GitBranch, Megaphone, XCircle,
  Target, Key, Eye, EyeOff, ShieldCheck, Download,
  BarChart3, Zap, RefreshCw,
} from "lucide-react";

const TENANT_ID = 1;

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
};

const dataCategories = [
  { key: "importPipelines" as const, icon: GitBranch, label: "Funis de vendas", desc: "Funis e etapas do pipeline", summaryKey: "pipelines" },
  { key: "importContacts" as const, icon: Users, label: "Contatos", desc: "Pessoas e informações de contato", summaryKey: "contacts" },
  { key: "importOrganizations" as const, icon: Building2, label: "Empresas", desc: "Organizações e contas", summaryKey: "organizations" },
  { key: "importDeals" as const, icon: Target, label: "Negociações", desc: "Deals com valores e status", summaryKey: "deals" },
  { key: "importProducts" as const, icon: Package, label: "Produtos", desc: "Catálogo de produtos/serviços", summaryKey: "products" },
  { key: "importTasks" as const, icon: ListTodo, label: "Tarefas", desc: "Tarefas e atividades", summaryKey: "tasks" },
  { key: "importSources" as const, icon: Zap, label: "Fontes", desc: "Fontes de leads", summaryKey: "sources" },
  { key: "importCampaigns" as const, icon: Megaphone, label: "Campanhas", desc: "Campanhas de marketing", summaryKey: "campaigns" },
  { key: "importLossReasons" as const, icon: XCircle, label: "Motivos de perda", desc: "Razões de perda de negociações", summaryKey: "lossReasons" },
];

export default function RDCrmImport() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("token");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<ImportConfig>(defaultConfig);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const validateMutation = trpc.rdCrmImport.validateToken.useMutation();
  const summaryMutation = trpc.rdCrmImport.fetchSummary.useMutation();
  const importMutation = trpc.rdCrmImport.importAll.useMutation();

  const handleValidateToken = async () => {
    if (!token.trim()) {
      toast.error("Insira o token da API do RD Station CRM");
      return;
    }
    try {
      const result = await validateMutation.mutateAsync({ token: token.trim() });
      if (result.valid) {
        toast.success("Token válido! Buscando dados...");
        // Fetch summary
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
      const result = await importMutation.mutateAsync({
        tenantId: TENANT_ID,
        token: token.trim(),
        ...config,
      });
      setImportResult(result);
      setStep("done");
      if (result.totalErrors === 0) {
        toast.success(`Importação concluída! ${result.totalImported} registros importados.`);
      } else {
        toast.warning(`Importação concluída com ${result.totalErrors} erros. ${result.totalImported} registros importados.`);
      }
    } catch (e: any) {
      toast.error(`Erro na importação: ${e.message}`);
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
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Importar do RD Station CRM</h1>
              <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">NOVO</Badge>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Importe todos os dados do seu RD Station CRM usando o token de API
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
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
              Token da API
            </CardTitle>
            <CardDescription>
              Insira o token de API do RD Station CRM para iniciar a importação. Você pode encontrar o token em
              <span className="text-primary font-medium"> RD Station CRM → Configurações → Token da API</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Token da API do RD Station CRM</label>
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
                <p className="font-medium text-foreground mb-1">Segurança</p>
                <p>O token é usado apenas para leitura dos dados e não é armazenado permanentemente. A importação é feita uma única vez.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Como obter o token</p>
                <p>No RD Station CRM, vá em <strong>Configurações → Integrações → Token da API</strong> e copie o token gerado.</p>
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
                  Validando token...
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
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                Dados encontrados no RD Station CRM
              </CardTitle>
              <CardDescription>
                Encontramos os seguintes dados na sua conta. Na próxima etapa você pode escolher o que importar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
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
                Escolha quais dados deseja importar do RD Station CRM para o Entur OS.
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

          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Atenção</p>
              <p>A importação criará novos registros no Entur OS. Registros duplicados podem ser criados se você já tiver dados similares. Recomendamos fazer a importação em uma conta limpa.</p>
            </div>
          </div>

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
        <Card className="border-border/50">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                <RefreshCw className="h-3 w-3 text-primary-foreground animate-spin" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Importando dados...</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Estamos importando seus dados do RD Station CRM. Isso pode levar alguns minutos dependendo da quantidade de registros. Não feche esta página.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <div className="h-1.5 w-48 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Done */}
      {step === "done" && importResult && (
        <div className="space-y-4">
          <Card className="border-border/50">
            <CardContent className="pt-8 pb-6 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Importação concluída!</h3>
              <p className="text-sm text-muted-foreground">
                {importResult.totalImported.toLocaleString("pt-BR")} registros importados
                {importResult.totalErrors > 0 && ` · ${importResult.totalErrors} erros`}
              </p>
            </CardContent>
          </Card>

          {/* Results breakdown */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Detalhes da importação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(importResult.results as Record<string, { imported: number; skipped: number; errors: string[] }>).map(([key, value]) => {
                const cat = dataCategories.find(c => c.summaryKey === key || c.key === `import${key.charAt(0).toUpperCase()}${key.slice(1)}`);
                const Icon = cat?.icon || Circle;
                return (
                  <div key={key} className="flex items-center justify-between p-3 rounded-xl border border-border/30 bg-card">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-foreground capitalize">{key}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                        {value.imported} importados
                      </Badge>
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
    </div>
  );
}
