import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, Check, RefreshCw, ExternalLink,
  CheckCircle2, Circle, AlertTriangle, BarChart3,
  Megaphone, Zap, Shield, Clock, ChevronDown, ChevronUp,
  FileText, Eye, EyeOff, XCircle, Loader2,
} from "lucide-react";
import { useTenantId } from "@/hooks/useTenantId";


export default function RDStationIntegration() {
  const TENANT_ID = useTenantId();
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<"success" | "failed" | "duplicate" | undefined>(undefined);

  // Queries
  const configQuery = trpc.rdStation.getConfig.useQuery({ tenantId: TENANT_ID });
  const statsQuery = trpc.rdStation.getStats.useQuery({ tenantId: TENANT_ID });
  const logsQuery = trpc.rdStation.getWebhookLogs.useQuery(
    { tenantId: TENANT_ID, status: logFilter, limit: 20 },
    { enabled: showLogs }
  );

  // Mutations
  const setupMutation = trpc.rdStation.setupIntegration.useMutation({
    onSuccess: () => {
      configQuery.refetch();
      toast.success("Integração ativada! Sua URL de webhook foi gerada com sucesso.");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const regenerateMutation = trpc.rdStation.regenerateToken.useMutation({
    onSuccess: () => {
      configQuery.refetch();
      toast.success("Token regenerado! Lembre-se de atualizar a URL no RD Station.");
    },
  });

  const toggleMutation = trpc.rdStation.toggleActive.useMutation({
    onSuccess: () => {
      configQuery.refetch();
    },
  });

  const config = configQuery.data;
  const stats = statsQuery.data;

  // Build webhook URL
  const getWebhookUrl = () => {
    if (!config?.webhookToken) return "";
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/webhooks/rdstation?token=${config.webhookToken}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("URL copiada para a área de transferência!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
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
          <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-500">
            <Megaphone className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              RD Station Marketing
            </h1>
            <p className="text-sm text-muted-foreground">
              Receba leads automaticamente do RD Station com dados de UTM
            </p>
          </div>
          {config && (
            <Badge
              variant={config.isActive ? "default" : "secondary"}
              className="ml-auto"
            >
              {config.isActive ? "Ativo" : "Inativo"}
            </Badge>
          )}
        </div>
      </div>

      {/* Status Cards */}
      {config && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total recebidos</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Sucesso</span>
              </div>
              <p className="text-2xl font-bold text-emerald-500">{stats.success}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Falhas</span>
              </div>
              <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">Duplicados</span>
              </div>
              <p className="text-2xl font-bold text-amber-500">{stats.duplicate}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Setup or Config */}
      {!config ? (
        /* ─── Initial Setup ─── */
        <Card className="mb-8 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Ativar Integração
            </CardTitle>
            <CardDescription>
              Conecte seu RD Station Marketing para receber leads automaticamente no CRM.
              Os dados de UTM (fonte, campanha, mídia) serão capturados junto com cada lead.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setupMutation.mutate({ tenantId: TENANT_ID })}
              disabled={setupMutation.isPending}
              className="gap-2"
            >
              {setupMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Ativar integração com RD Station
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* ─── Active Config ─── */
        <>
          {/* Webhook URL Card */}
          <Card className="mb-6 border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">URL do Webhook</CardTitle>
                  <CardDescription>
                    Cole esta URL no RD Station para receber leads automaticamente
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Ativo</span>
                  <Switch
                    checked={config.isActive}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ tenantId: TENANT_ID, isActive: checked })
                    }
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* URL Display */}
              <div className="relative">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border font-mono text-sm break-all">
                  <span className="flex-1 text-foreground/80">
                    {showToken ? getWebhookUrl() : getWebhookUrl().replace(/token=.*$/, "token=••••••••")}
                  </span>
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="shrink-0 p-1.5 rounded hover:bg-accent transition-colors"
                    title={showToken ? "Ocultar token" : "Mostrar token"}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(getWebhookUrl())}
                    className="shrink-0 p-1.5 rounded hover:bg-accent transition-colors"
                    title="Copiar URL"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("Tem certeza? Você precisará atualizar a URL no RD Station.")) {
                      regenerateMutation.mutate({ tenantId: TENANT_ID });
                    }
                  }}
                  disabled={regenerateMutation.isPending}
                  className="gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
                  Regenerar token
                </Button>
                {config.lastLeadReceivedAt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Último lead: {new Date(config.lastLeadReceivedAt).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ─── Mapeamento de Campos (Auto-captura) ─── */}
          <Card className="mb-6 border-border/50 bg-gradient-to-br from-orange-500/5 to-transparent">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      Mapeamento de Campos
                      <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200">
                        Auto-captura ativo
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Campos personalizados do RD Station são capturados automaticamente
                    </CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setLocation("/settings/rdstation/mappings")}>
                  Mapeamento avançado
                  <ExternalLink className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-200/30 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">Zero configuração necessária</h4>
                    <p className="text-sm text-muted-foreground">
                      Todos os campos personalizados do RD Station (identificadores que começam com <code className="text-xs bg-muted px-1 py-0.5 rounded">cf_</code>) são capturados automaticamente como texto aberto e exibidos na negociação.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border/50 p-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mapeamento automático (UTMs)</h4>
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-blue-500 shrink-0" />
                      <span><code className="text-xs bg-muted px-1 rounded">utm_source</code> → Origem</span>
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-blue-500 shrink-0" />
                      <span><code className="text-xs bg-muted px-1 rounded">utm_medium</code> → Mídia</span>
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-blue-500 shrink-0" />
                      <span><code className="text-xs bg-muted px-1 rounded">utm_campaign</code> → Campanha</span>
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-blue-500 shrink-0" />
                      <span><code className="text-xs bg-muted px-1 rounded">utm_term</code> → Termo</span>
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-blue-500 shrink-0" />
                      <span><code className="text-xs bg-muted px-1 rounded">utm_content</code> → Conteúdo</span>
                    </li>
                  </ul>
                </div>
                <div className="rounded-lg border border-border/50 p-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Auto-captura (campos cf_)</h4>
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-orange-500 shrink-0" />
                      <span>Todos os campos <code className="text-xs bg-muted px-1 rounded">cf_*</code> capturados como texto</span>
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-orange-500 shrink-0" />
                      <span>Exibidos na sidebar da negociação</span>
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-orange-500 shrink-0" />
                      <span>Nenhuma configuração manual necessária</span>
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-orange-500 shrink-0" />
                      <span>Novos campos detectados automaticamente</span>
                    </li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Ex: cf_voce_ja_tem_um_grupo, cf_fbc, cf_fbp...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Manual de Configuração */}
          <Card className="mb-6 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-blue-500" />
                Manual de Configuração — Passo a Passo
              </CardTitle>
              <CardDescription>
                Siga estes passos simples para conectar o RD Station ao seu CRM
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      1
                    </div>
                    <div className="w-0.5 flex-1 bg-border mt-2" />
                  </div>
                  <div className="pb-6">
                    <h3 className="font-semibold text-foreground mb-1">Copie a URL do Webhook</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Clique no botão de copiar (ícone 📋) ao lado da URL acima. Essa URL é exclusiva da sua conta
                      e será usada para o RD Station enviar os leads automaticamente.
                    </p>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                      <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                        <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          <strong>Importante:</strong> Não compartilhe esta URL publicamente. Ela contém um token
                          de segurança que autentica a conexão.
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      2
                    </div>
                    <div className="w-0.5 flex-1 bg-border mt-2" />
                  </div>
                  <div className="pb-6">
                    <h3 className="font-semibold text-foreground mb-1">Acesse o RD Station Marketing</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Entre na sua conta do RD Station Marketing. No canto superior direito, clique no
                      <strong> nome da sua conta</strong> e depois em <strong>"Integrações"</strong>.
                    </p>
                    <a
                      href="https://app.rdstation.com.br/integrations"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      Abrir RD Station Integrações
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      3
                    </div>
                    <div className="w-0.5 flex-1 bg-border mt-2" />
                  </div>
                  <div className="pb-6">
                    <h3 className="font-semibold text-foreground mb-1">Configure o Webhook</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Na tela de Integrações, procure por <strong>"Webhooks"</strong> e clique em <strong>"Configurar"</strong>.
                      Depois, clique em <strong>"Criar Webhook"</strong> e preencha:
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                      <div className="flex items-start gap-3">
                        <Circle className="h-2 w-2 mt-2 shrink-0 text-blue-500 fill-blue-500" />
                        <div>
                          <strong className="text-foreground">Nome:</strong>{" "}
                          <span className="text-muted-foreground">
                            Escolha um nome que identifique a integração (ex: "Enviar para CRM")
                          </span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Circle className="h-2 w-2 mt-2 shrink-0 text-blue-500 fill-blue-500" />
                        <div>
                          <strong className="text-foreground">URL:</strong>{" "}
                          <span className="text-muted-foreground">
                            Cole a URL que você copiou no Passo 1
                          </span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Circle className="h-2 w-2 mt-2 shrink-0 text-blue-500 fill-blue-500" />
                        <div>
                          <strong className="text-foreground">Gatilho:</strong>{" "}
                          <span className="text-muted-foreground">
                            Selecione <strong>"Conversão"</strong>. Deixe o campo de conversões específicas
                            <strong> em branco</strong> para receber todos os leads, ou selecione apenas as
                            conversões desejadas.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      4
                    </div>
                    <div className="w-0.5 flex-1 bg-border mt-2" />
                  </div>
                  <div className="pb-6">
                    <h3 className="font-semibold text-foreground mb-1">Salve e Verifique</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Clique em <strong>"Salvar Webhook"</strong>. O RD Station vai mostrar a opção de
                      <strong> "Verificar"</strong> — clique nela para testar se a conexão está funcionando.
                      Se aparecer uma mensagem de sucesso, está tudo certo!
                    </p>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          <strong>Pronto!</strong> A partir de agora, toda vez que um lead converter no RD Station
                          (formulário, landing page, pop-up), ele será criado automaticamente no seu CRM com todos
                          os dados de UTM (fonte, campanha, mídia, conteúdo e termo).
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 5 - Optional */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold shrink-0">
                      5
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      <span className="text-muted-foreground">(Opcional)</span> Enviar apenas oportunidades
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Se preferir receber apenas leads qualificados, crie um segundo webhook com o gatilho
                      <strong> "Oportunidade"</strong>. Assim, só os leads marcados como oportunidade no RD Station
                      serão enviados ao CRM.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What gets captured */}
          <Card className="mb-6 border-border/50">
            <CardHeader>
              <CardTitle className="text-base">O que é capturado automaticamente?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Dados do Lead</h4>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Nome completo
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> E-mail
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Telefone
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Empresa
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Cargo
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Cidade / Estado
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Tags do RD Station
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Campos personalizados
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Dados de Marketing (UTM)</h4>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" /> utm_source (fonte)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" /> utm_medium (mídia)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" /> utm_campaign (campanha)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" /> utm_content (conteúdo)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" /> utm_term (termo)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" /> Identificador da conversão
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" /> Canal de origem
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" /> Estágio do lead no RD
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Webhook Logs */}
          <Card className="mb-6 border-border/50">
            <CardHeader>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center justify-between w-full"
              >
                <div className="text-left">
                  <CardTitle className="text-base">Histórico de Recebimentos</CardTitle>
                  <CardDescription>
                    Veja todos os leads recebidos do RD Station
                  </CardDescription>
                </div>
                {showLogs ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            </CardHeader>
            {showLogs && (
              <CardContent>
                {/* Filter */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-muted-foreground">Filtrar:</span>
                  {[
                    { label: "Todos", value: undefined },
                    { label: "Sucesso", value: "success" as const },
                    { label: "Falha", value: "failed" as const },
                    { label: "Duplicado", value: "duplicate" as const },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setLogFilter(opt.value)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        logFilter === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Logs Table */}
                {logsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : logsQuery.data?.logs.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Nenhum lead recebido ainda. Configure o webhook no RD Station para começar.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Status</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Nome</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">E-mail</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Conversão</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">UTM Source</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">UTM Campaign</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logsQuery.data?.logs.map((log) => (
                          <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 px-2">
                              {log.status === "success" && (
                                <Badge variant="default" className="bg-emerald-500/20 text-emerald-600 border-0 text-[10px]">
                                  OK
                                </Badge>
                              )}
                              {log.status === "failed" && (
                                <Badge variant="destructive" className="text-[10px]">
                                  Falha
                                </Badge>
                              )}
                              {log.status === "duplicate" && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Dup.
                                </Badge>
                              )}
                            </td>
                            <td className="py-2 px-2 text-foreground">{log.name || "—"}</td>
                            <td className="py-2 px-2 text-muted-foreground">{log.email || "—"}</td>
                            <td className="py-2 px-2 text-muted-foreground text-xs">{log.conversionIdentifier || "—"}</td>
                            <td className="py-2 px-2 text-muted-foreground text-xs">{log.utmSource || "—"}</td>
                            <td className="py-2 px-2 text-muted-foreground text-xs">{log.utmCampaign || "—"}</td>
                            <td className="py-2 px-2 text-muted-foreground text-xs">
                              {log.createdAt ? new Date(log.createdAt).toLocaleString("pt-BR") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {logsQuery.data && logsQuery.data.total > 20 && (
                      <p className="text-xs text-muted-foreground text-center mt-3">
                        Exibindo 20 de {logsQuery.data.total} registros
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* FAQ */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Perguntas Frequentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Preciso de algum plano específico do RD Station?
                </h4>
                <p className="text-sm text-muted-foreground">
                  A funcionalidade de Webhooks está disponível nos planos Light, Basic e Pro do RD Station Marketing.
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Os leads existentes serão importados?
                </h4>
                <p className="text-sm text-muted-foreground">
                  Não. O webhook envia apenas leads que converterem <strong>após</strong> a configuração.
                  Leads importados manualmente ou já existentes no RD Station não ativam o webhook.
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  O que acontece se o mesmo lead converter duas vezes?
                </h4>
                <p className="text-sm text-muted-foreground">
                  O sistema detecta duplicatas automaticamente. Se o lead já existir no CRM (mesmo e-mail ou telefone),
                  o contato existente será atualizado e a nova conversão será registrada no histórico.
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Posso pausar a integração temporariamente?
                </h4>
                <p className="text-sm text-muted-foreground">
                  Sim! Use o botão "Ativo/Inativo" no topo desta página. Quando desativado, o webhook
                  continuará existindo no RD Station, mas os leads não serão processados.
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Preciso de um desenvolvedor para configurar?
                </h4>
                <p className="text-sm text-muted-foreground">
                  Não! Basta seguir o passo a passo acima. É literalmente copiar a URL e colar no RD Station.
                  Leva menos de 2 minutos.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
