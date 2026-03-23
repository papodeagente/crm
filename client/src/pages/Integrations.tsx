import { trpc } from "@/lib/trpc";
import { useIsAdmin } from "@/components/AdminOnlyGuard";
import { useLocation } from "wouter";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plug, Plus, Webhook, Zap, Globe, Facebook, Copy, RefreshCw, Check,
  AlertCircle, CheckCircle2, Clock, XCircle, RotateCcw, Eye, EyeOff,
  Link2, ArrowRight, FileText, Filter, Code2, Trash2, Power, Edit2,
  ExternalLink, Shield, Brain,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { formatDateTimeShort } from "../../../shared/dateUtils";
import AiIntegrationsTab from "./AiIntegrationsTab";


function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: any; color: string; label: string }> = {
    success: { icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Sucesso" },
    failed: { icon: XCircle, color: "bg-red-500/10 text-red-600 border-red-500/20", label: "Falha" },
    processing: { icon: Clock, color: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "Processando" },
    pending: { icon: Clock, color: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Pendente" },
  };
  const s = map[status] || { icon: AlertCircle, color: "bg-slate-500/10 text-slate-600 border-slate-500/20", label: status };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${s.color}`}>
      <Icon className="h-3 w-3" />{s.label}
    </span>
  );
}

// ─── Webhook Config Tab ──────────────────────────────────

function WebhookConfigTab() {
  const config = trpc.leadCapture.getWebhookConfig.useQuery();
  const generateToken = trpc.leadCapture.generateWebhookToken.useMutation({
    onSuccess: () => {
      config.refetch();
      toast.success("Token gerado com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const webhookUrl = `${window.location.origin}/api/webhooks/leads`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copiado!`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-5">
      <Card className="border border-border/40 shadow-none rounded-xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center">
              <Webhook className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold">Webhook da Landing Page</h3>
              <p className="text-[12px] text-muted-foreground">Receba leads automaticamente da sua landing page.</p>
            </div>
          </div>

          {/* URL */}
          <div className="space-y-2">
            <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">URL do Webhook</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-[12px] bg-muted/30" />
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => copyToClipboard(webhookUrl, "URL")}>
                {copied === "URL" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Token */}
          <div className="space-y-2">
            <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Bearer Token</Label>
            {config.data?.webhookSecret ? (
              <div className="flex gap-2">
                <Input
                  value={showToken ? config.data.webhookSecret : "••••••••••••••••••••••••••••••••"}
                  readOnly
                  className="font-mono text-[12px] bg-muted/30"
                />
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setShowToken(!showToken)}>
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => copyToClipboard(config.data!.webhookSecret, "Token")}>
                  {copied === "Token" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground/60 italic">Nenhum token gerado ainda.</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 mt-1"
              onClick={() => generateToken.mutate()}
              disabled={generateToken.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${generateToken.isPending ? "animate-spin" : ""}`} />
              {config.data?.webhookSecret ? "Regenerar Token" : "Gerar Token"}
            </Button>
          </div>

          {/* Payload example */}
          <div className="space-y-2">
            <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Exemplo de Payload</Label>
            <pre className="bg-muted/30 border border-border/30 rounded-lg p-4 text-[11px] font-mono text-muted-foreground overflow-x-auto">
{`POST ${webhookUrl}
Authorization: Bearer <seu_token>
Content-Type: application/json

{
  "name": "João Silva",
  "email": "joao@email.com",
  "phone": "+5584999838420",
  "message": "Quero mais informações",
  "source": "landing",
  "lead_id": "optional-unique-id",
  "utm": {
    "source": "google",
    "medium": "cpc",
    "campaign": "verao-2026"
  },
  "meta": {
    "page_url": "https://meusite.com/promo",
    "form_id": "form-hero"
  }
}`}
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Meta Lead Ads Tab ───────────────────────────────────

function MetaLeadAdsTab() {
  const config = trpc.leadCapture.getMetaConfig.useQuery();
  const connectMeta = trpc.leadCapture.connectMeta.useMutation({
    onSuccess: () => {
      config.refetch();
      toast.success("Meta Lead Ads conectado!");
    },
    onError: (e) => toast.error(e.message),
  });
  const disconnectMeta = trpc.leadCapture.disconnectMeta.useMutation({
    onSuccess: () => {
      config.refetch();
      toast.success("Meta Lead Ads desconectado.");
    },
    onError: (e) => toast.error(e.message),
  });

  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [copied, setCopied] = useState(false);

  const isConnected = config.data?.status === "connected";
  const metaWebhookUrl = `${window.location.origin}/api/webhooks/meta`;

  const handleConnect = () => {
    if (!pageId || !accessToken) {
      toast.error("Page ID e Access Token são obrigatórios.");
      return;
    }
    connectMeta.mutate({
      pageId,
      pageName: pageName || undefined,
      accessToken,
      appSecret: appSecret || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <Card className="border border-border/40 shadow-none rounded-xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center">
                <Facebook className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold">Meta Lead Ads</h3>
                <p className="text-[12px] text-muted-foreground">Receba leads do Facebook/Instagram Lead Ads automaticamente.</p>
              </div>
            </div>
            {isConnected && (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Conectado
              </Badge>
            )}
          </div>

          {isConnected ? (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">Page ID:</span>
                  <span className="font-mono font-medium">{config.data?.pageId}</span>
                </div>
                {config.data?.pageName && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Página:</span>
                    <span className="font-medium">{config.data.pageName}</span>
                  </div>
                )}
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">Access Token:</span>
                  <span className="font-mono text-muted-foreground">{config.data?.accessToken}</span>
                </div>
                {config.data?.verifyToken && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Verify Token:</span>
                    <span className="font-mono text-[11px]">{config.data.verifyToken}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">URL do Webhook (Meta)</Label>
                <div className="flex gap-2">
                  <Input value={metaWebhookUrl} readOnly className="font-mono text-[12px] bg-muted/30" />
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => {
                    navigator.clipboard.writeText(metaWebhookUrl);
                    setCopied(true);
                    toast.success("URL copiada!");
                    setTimeout(() => setCopied(false), 2000);
                  }}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Configure esta URL no painel do Meta Business → Webhooks → Page → Leadgen.</p>
              </div>

              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => disconnectMeta.mutate()}
                disabled={disconnectMeta.isPending}
              >
                <XCircle className="h-3.5 w-3.5" />Desconectar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-4">
                <h4 className="text-[13px] font-semibold text-blue-600 mb-2 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />Como configurar
                </h4>
                <ol className="text-[12px] text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Acesse o <a href="https://business.facebook.com/settings" target="_blank" rel="noreferrer" className="text-blue-600 underline">Meta Business Suite</a></li>
                  <li>Vá em Configurações → Integrações → Lead Access</li>
                  <li>Copie o <strong>Page ID</strong> e gere um <strong>Page Access Token</strong> com permissão <code>leads_retrieval</code></li>
                  <li>Cole os dados abaixo e clique em "Conectar"</li>
                  <li>Configure o webhook no Meta usando a URL que será exibida após conectar</li>
                </ol>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Page ID *</Label>
                  <Input placeholder="123456789012345" value={pageId} onChange={(e) => setPageId(e.target.value)} className="text-[13px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Nome da Página</Label>
                  <Input placeholder="Minha Empresa" value={pageName} onChange={(e) => setPageName(e.target.value)} className="text-[13px]" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Page Access Token *</Label>
                <Input placeholder="EAABs..." value={accessToken} onChange={(e) => setAccessToken(e.target.value)} className="font-mono text-[12px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">App Secret (opcional, para validar assinatura)</Label>
                <Input placeholder="abc123..." value={appSecret} onChange={(e) => setAppSecret(e.target.value)} className="font-mono text-[12px]" />
              </div>

              <Button
                className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                onClick={handleConnect}
                disabled={connectMeta.isPending}
              >
                <Link2 className="h-4 w-4" />
                {connectMeta.isPending ? "Conectando..." : "Conectar Meta Lead Ads"}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}// ─── Tracking Script Tab ──────────────────────────────────────

function TrackingScriptTab() {
  const tokens = trpc.leadCapture.listTrackingTokens.useQuery();
  const createToken = trpc.leadCapture.createTrackingToken.useMutation({
    onSuccess: () => { tokens.refetch(); toast.success("Token criado!"); setShowCreate(false); setNewName(""); setNewDomains(""); },
    onError: (e) => toast.error(e.message),
  });
  const updateToken = trpc.leadCapture.updateTrackingToken.useMutation({
    onSuccess: () => { tokens.refetch(); toast.success("Atualizado!"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteToken = trpc.leadCapture.deleteTrackingToken.useMutation({
    onSuccess: () => { tokens.refetch(); toast.success("Token removido!"); },
    onError: (e) => toast.error(e.message),
  });

  const verifyInstallation = trpc.leadCapture.verifyTrackingInstallation.useMutation();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDomains, setNewDomains] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [verifyUrl, setVerifyUrl] = useState("");
  const [snippetCache, setSnippetCache] = useState<Record<number, string>>({});
  const [loadingSnippet, setLoadingSnippet] = useState<number | null>(null);

  const collectUrl = window.location.origin;
  const utils = trpc.useUtils();

  async function loadSnippet(tokenId: number) {
    if (snippetCache[tokenId]) return;
    setLoadingSnippet(tokenId);
    try {
      const result = await utils.client.leadCapture.getTrackingSnippet.query({
        tokenId,
        collectUrl,
      });
      setSnippetCache(prev => ({ ...prev, [tokenId]: result.snippet }));
    } catch (err) {
      toast.error("Erro ao carregar snippet");
    } finally {
      setLoadingSnippet(null);
    }
  }

  function handleExpand(tokenId: number) {
    if (expandedId === tokenId) {
      setExpandedId(null);
    } else {
      setExpandedId(tokenId);
      loadSnippet(tokenId);
    }
  }

  function copySnippet(tokenId: number) {
    const snippet = snippetCache[tokenId];
    if (!snippet) return;
    navigator.clipboard.writeText(snippet);
    setCopiedId(tokenId);
    toast.success("Código copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border border-border/40 shadow-none rounded-xl">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center shrink-0">
              <Code2 className="h-6 w-6 text-violet-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-foreground">Tracking Script</h3>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Instale um código no seu site para capturar automaticamente todos os formulários.
                Funciona com Elementor, Contact Form 7, Gravity Forms, ou qualquer formulário HTML.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-3.5 w-3.5" />Novo Token
            </Button>
          </div>

          {/* How it works */}
          <div className="bg-violet-500/5 border border-violet-500/10 rounded-lg p-4">
            <h4 className="text-[13px] font-semibold text-violet-600 mb-2 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />Como funciona
            </h4>
            <ol className="text-[12px] text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Crie um token para o seu site (botão acima)</li>
              <li>Copie o código de instalação gerado</li>
              <li>Cole no <code className="bg-muted px-1 rounded">&lt;head&gt;</code> ou <code className="bg-muted px-1 rounded">&lt;body&gt;</code> do seu site (via WordPress, GTM, ou direto no HTML)</li>
              <li>Pronto! Todos os formulários serão capturados automaticamente</li>
            </ol>
          </div>
        </div>
      </Card>

      {/* Token List */}
      {tokens.isLoading ? (
        <p className="text-[13px] text-muted-foreground text-center py-8">Carregando...</p>
      ) : !tokens.data?.length ? (
        <Card className="border border-border/40 shadow-none rounded-xl">
          <div className="p-12 text-center text-muted-foreground">
            <Code2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-[14px] font-medium text-muted-foreground/60">Nenhum token criado</p>
            <p className="text-[13px] text-muted-foreground/40 mt-1">Crie um token para começar a capturar leads do seu site.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {tokens.data.map((t: any) => (
            <Card key={t.id} className="border border-border/40 shadow-none rounded-xl">
              <div className="p-4 space-y-3">
                {/* Token header */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold">{t.name}</p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        t.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        <span className={`h-1 w-1 rounded-full ${t.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {t.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      <span>{t.totalLeads} lead(s) capturado(s)</span>
                      {t.lastSeenAt && <span>· Último acesso: {formatDateTimeShort(t.lastSeenAt)}</span>}
                      {t.allowedDomains && (t.allowedDomains as string[]).length > 0 && (
                        <span>· Domínios: {(t.allowedDomains as string[]).join(", ")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-[12px]"
                      onClick={() => copySnippet(t.id)}
                    >
                      {copiedId === t.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedId === t.id ? "Copiado!" : "Copiar Código"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title={expandedId === t.id ? "Recolher" : "Ver código"}
                      onClick={() => handleExpand(t.id)}
                    >
                      <Code2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title={t.isActive ? "Desativar" : "Ativar"}
                      onClick={() => updateToken.mutate({ tokenId: t.id, isActive: !t.isActive })}
                    >
                      <Power className={`h-3.5 w-3.5 ${t.isActive ? "text-emerald-600" : "text-muted-foreground"}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      title="Excluir token"
                      onClick={() => {
                        if (confirm("Tem certeza? O script parará de funcionar no site.")) {
                          deleteToken.mutate({ tokenId: t.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expanded: show snippet */}
                {expandedId === t.id && (
                  <div className="bg-slate-950 rounded-lg p-4 relative">
                    <p className="text-[11px] text-slate-400 mb-2">Cole este código no <code>&lt;head&gt;</code> ou <code>&lt;body&gt;</code> do seu site:</p>
                    {loadingSnippet === t.id ? (
                      <div className="text-[12px] text-slate-400 font-mono py-4 text-center">Carregando código...</div>
                    ) : snippetCache[t.id] ? (
                      <pre className="text-[12px] text-emerald-400 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-[300px] overflow-y-auto">{snippetCache[t.id]}</pre>
                    ) : (
                      <div className="text-[12px] text-slate-400 font-mono py-4 text-center">Erro ao carregar snippet</div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-7 text-[11px] text-slate-400 hover:text-white gap-1"
                      onClick={() => copySnippet(t.id)}
                      disabled={!snippetCache[t.id]}
                    >
                      <Copy className="h-3 w-3" />{copiedId === t.id ? "Copiado!" : "Copiar"}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Verify Installation */}
      <Card className="border border-border/40 shadow-none rounded-xl">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500/10 to-cyan-500/10 flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5 text-sky-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-[14px] font-semibold text-foreground">Verificar Instalação</h3>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Cole a URL do site onde você instalou o código para verificar se o tracking está ativo.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="https://meusite.com.br"
              value={verifyUrl}
              onChange={(e) => setVerifyUrl(e.target.value)}
              className="text-[13px] flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && verifyUrl.trim()) {
                  let url = verifyUrl.trim();
                  if (!url.startsWith("http")) url = "https://" + url;
                  setVerifyUrl(url);
                  verifyInstallation.mutate({ url });
                }
              }}
            />
            <Button
              size="sm"
              className="gap-1.5 px-4"
              disabled={verifyInstallation.isPending || !verifyUrl.trim()}
              onClick={() => {
                let url = verifyUrl.trim();
                if (!url.startsWith("http")) url = "https://" + url;
                setVerifyUrl(url);
                verifyInstallation.mutate({ url });
              }}
            >
              {verifyInstallation.isPending ? (
                <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Verificando...</>
              ) : (
                <><ExternalLink className="h-3.5 w-3.5" />Verificar</>
              )}
            </Button>
          </div>

          {/* Result */}
          {verifyInstallation.data && (
            <div className={`rounded-lg p-4 border ${
              verifyInstallation.data.status === "active"
                ? "bg-emerald-500/5 border-emerald-500/20"
                : verifyInstallation.data.status === "wrong_token"
                ? "bg-amber-500/5 border-amber-500/20"
                : "bg-red-500/5 border-red-500/20"
            }`}>
              <div className="flex items-start gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                  verifyInstallation.data.status === "active"
                    ? "bg-emerald-500/10"
                    : verifyInstallation.data.status === "wrong_token"
                    ? "bg-amber-500/10"
                    : "bg-red-500/10"
                }`}>
                  {verifyInstallation.data.status === "active" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : verifyInstallation.data.status === "wrong_token" ? (
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-semibold ${
                    verifyInstallation.data.status === "active"
                      ? "text-emerald-600"
                      : verifyInstallation.data.status === "wrong_token"
                      ? "text-amber-600"
                      : "text-red-600"
                  }`}>
                    {verifyInstallation.data.status === "active" ? "Script Ativo" 
                      : verifyInstallation.data.status === "wrong_token" ? "Token Incorreto"
                      : verifyInstallation.data.status === "not_found" ? "Script Não Encontrado"
                      : verifyInstallation.data.status === "no_tokens" ? "Nenhum Token"
                      : verifyInstallation.data.status === "timeout" ? "Timeout"
                      : verifyInstallation.data.status === "fetch_error" ? "Erro de Acesso"
                      : "Erro"}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {verifyInstallation.data.message}
                  </p>
                  {verifyInstallation.data.details && verifyInstallation.data.status === "active" && (
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          (verifyInstallation.data.details as any).isActive ? "bg-emerald-500" : "bg-slate-400"
                        }`} />
                        Token: {(verifyInstallation.data.details as any).tokenName}
                      </span>
                      <span>{(verifyInstallation.data.details as any).totalLeads} lead(s) capturado(s)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {verifyInstallation.error && (
            <div className="rounded-lg p-4 border bg-red-500/5 border-red-500/20">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-[12px] text-red-600">{verifyInstallation.error.message}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Create Token Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Token de Tracking</DialogTitle>
            <DialogDescription>
              Crie um token para capturar leads de um site específico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Nome do site *</Label>
              <Input
                placeholder="Ex: Meu Site Principal"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Domínios permitidos (opcional)</Label>
              <Input
                placeholder="Ex: meusite.com.br, lp.meusite.com.br"
                value={newDomains}
                onChange={(e) => setNewDomains(e.target.value)}
                className="text-[13px]"
              />
              <p className="text-[11px] text-muted-foreground">Separe por vírgula. Deixe vazio para aceitar de qualquer domínio.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!newName.trim()) { toast.error("Informe o nome do site"); return; }
                const domains = newDomains.split(",").map(d => d.trim()).filter(Boolean);
                createToken.mutate({
                  name: newName.trim(),
                  allowedDomains: domains.length > 0 ? domains : undefined,
                });
              }}
              disabled={createToken.isPending}
            >
              {createToken.isPending ? "Criando..." : "Criar Token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Event Logs Tab ──────────────────────────────────────────

function EventLogsTab() { const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const LIMIT = 20;

  const events = trpc.leadCapture.listEvents.useQuery({
    source: sourceFilter === "all" ? undefined : sourceFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: LIMIT,
  });

  const reprocess = trpc.leadCapture.reprocessEvent.useMutation({
    onSuccess: (result) => {
      events.refetch();
      if (result.success) {
        toast.success(`Lead reprocessado! Deal #${result.dealId}`);
      } else {
        toast.error(`Falha ao reprocessar: ${result.error}`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const total = events.data?.total || 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[12px] text-muted-foreground font-medium">Filtros:</span>
        </div>
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px] h-8 text-[12px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            <SelectItem value="landing">Landing Page</SelectItem>
            <SelectItem value="meta_lead_ads">Meta Lead Ads</SelectItem>
            <SelectItem value="wordpress">WordPress</SelectItem>
            <SelectItem value="tracking_script">Tracking Script</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px] h-8 text-[12px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="success">Sucesso</SelectItem>
            <SelectItem value="failed">Falha</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="processing">Processando</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[12px] text-muted-foreground ml-auto">{total} evento(s)</span>
      </div>

      {/* Table */}
      <Card className="border border-border/40 shadow-none rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="text-left p-3.5 font-semibold text-muted-foreground w-[80px]">ID</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Origem</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Dedupe Key</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Status</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Deal</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground">Data</th>
                <th className="text-left p-3.5 font-semibold text-muted-foreground w-[80px]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {events.isLoading ? (
                <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : !events.data?.events?.length ? (
                <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm">Nenhum evento encontrado.</p>
                </td></tr>
              ) : events.data.events.map((e: any) => (
                <tr key={e.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                  <td className="p-3.5 font-mono text-[11px] text-muted-foreground">#{e.id}</td>
                  <td className="p-3.5">
                    <Badge variant="outline" className={`text-[10px] ${
                      e.source === "meta_lead_ads" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                      "bg-violet-500/10 text-violet-600 border-violet-500/20"
                    }`}>
                      {e.source === "meta_lead_ads" ? "Meta" : e.source}
                    </Badge>
                  </td>
                  <td className="p-3.5 font-mono text-[11px] text-muted-foreground truncate max-w-[200px]" title={e.dedupeKey}>
                    {e.dedupeKey}
                  </td>
                  <td className="p-3.5"><StatusBadge status={e.status} /></td>
                  <td className="p-3.5">
                    {e.dealId ? (
                      <a href={`/deal/${e.dealId}`} className="text-primary hover:underline font-medium text-[12px] flex items-center gap-1">
                        #{e.dealId}<ArrowRight className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="p-3.5 text-muted-foreground text-[12px]">
                    {e.createdAt ? formatDateTimeShort(e.createdAt) : "—"}
                  </td>
                  <td className="p-3.5">
                    {e.status === "failed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Reprocessar"
                        onClick={() => reprocess.mutate({ eventId: e.id })}
                        disabled={reprocess.isPending}
                      >
                        <RotateCcw className={`h-3.5 w-3.5 ${reprocess.isPending ? "animate-spin" : ""}`} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-border/30">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)} className="text-[12px]">
              Anterior
            </Button>
            <span className="text-[12px] text-muted-foreground">
              Página {page + 1} de {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="text-[12px]">
              Próxima
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Main Integrations Page ──────────────────────────────

export default function Integrations() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [, setLocation] = useLocation();
  const integrations = trpc.integrationHub.integrations.list.useQuery(undefined, { enabled: isAdmin });

  if (!adminLoading && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4 py-20">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">
          As Integrações são exclusivas para administradores.
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

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Integrações</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Conecte serviços externos, capture leads e gerencie webhooks.</p>
        </div>
      </div>

      <Tabs defaultValue="webhook" className="space-y-4">
        <TabsList className="bg-muted/30 border-0 rounded-lg p-1">
          <TabsTrigger value="webhook" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
            <Webhook className="h-3.5 w-3.5" />Landing Page
          </TabsTrigger>
          <TabsTrigger value="meta" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
            <Facebook className="h-3.5 w-3.5" />Meta Lead Ads
          </TabsTrigger>
          <TabsTrigger value="logs" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
            <FileText className="h-3.5 w-3.5" />Event Logs
          </TabsTrigger>
          <TabsTrigger value="tracking" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
            <Code2 className="h-3.5 w-3.5" />Tracking Script
          </TabsTrigger>
          <TabsTrigger value="connectors" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
            <Zap className="h-3.5 w-3.5" />Conectores
          </TabsTrigger>
          <TabsTrigger value="ai" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
            <Brain className="h-3.5 w-3.5" />IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhook">
          <WebhookConfigTab />
        </TabsContent>

        <TabsContent value="meta">
          <MetaLeadAdsTab />
        </TabsContent>

        <TabsContent value="logs">
          <EventLogsTab />
        </TabsContent>

        <TabsContent value="tracking">
          <TrackingScriptTab />
        </TabsContent>

        <TabsContent value="connectors">
          {integrations.isLoading ? (
            <p className="text-[13px] text-muted-foreground text-center py-12">Carregando...</p>
          ) : !integrations.data?.length ? (
            <Card className="border border-border/40 shadow-none rounded-xl">
              <div className="p-12 text-center text-muted-foreground">
                <Plug className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                <p className="text-[14px] font-medium text-muted-foreground/60">Nenhuma integração configurada</p>
                <p className="text-[13px] text-muted-foreground/40 mt-1">Conecte serviços como Stripe, Google Calendar, etc.</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations.data.map((i: any) => (
                <Card key={i.id} className="border border-border/40 shadow-none rounded-xl hover:shadow-md transition-shadow cursor-pointer group">
                  <div className="p-5">
                    <div className="flex items-center gap-3.5">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Zap className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold group-hover:text-primary transition-colors">{i.name}</p>
                        <p className="text-[12px] text-muted-foreground">{i.provider}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${i.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600"}`}>
                        <span className={`h-1 w-1 rounded-full ${i.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {i.status === "active" ? "Ativo" : i.status || "—"}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai">
          <AiIntegrationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
