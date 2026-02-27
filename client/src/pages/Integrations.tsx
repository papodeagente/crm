import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plug, Plus, Webhook, Zap, Globe, Facebook, Copy, RefreshCw, Check,
  AlertCircle, CheckCircle2, Clock, XCircle, RotateCcw, Eye, EyeOff,
  Link2, ArrowRight, FileText, Filter,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState, useMemo } from "react";

const TENANT_ID = 1;

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
  const config = trpc.leadCapture.getWebhookConfig.useQuery({ tenantId: TENANT_ID });
  const generateToken = trpc.leadCapture.generateWebhookToken.useMutation({
    onSuccess: () => {
      config.refetch();
      toast.success("Token gerado com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const webhookUrl = `${window.location.origin}/webhooks/leads`;

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
              onClick={() => generateToken.mutate({ tenantId: TENANT_ID })}
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
  const config = trpc.leadCapture.getMetaConfig.useQuery({ tenantId: TENANT_ID });
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
  const metaWebhookUrl = `${window.location.origin}/webhooks/meta`;

  const handleConnect = () => {
    if (!pageId || !accessToken) {
      toast.error("Page ID e Access Token são obrigatórios.");
      return;
    }
    connectMeta.mutate({
      tenantId: TENANT_ID,
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
                onClick={() => disconnectMeta.mutate({ tenantId: TENANT_ID })}
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
}

// ─── Event Logs Tab ──────────────────────────────────────

function EventLogsTab() {
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const LIMIT = 20;

  const events = trpc.leadCapture.listEvents.useQuery({
    tenantId: TENANT_ID,
    source: sourceFilter === "all" ? undefined : sourceFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: LIMIT,
    offset: page * LIMIT,
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
                    {e.createdAt ? new Date(e.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  <td className="p-3.5">
                    {e.status === "failed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Reprocessar"
                        onClick={() => reprocess.mutate({ tenantId: TENANT_ID, eventId: e.id })}
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
  const integrations = trpc.integrationHub.integrations.list.useQuery({ tenantId: TENANT_ID });

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
          <TabsTrigger value="connectors" className="rounded-lg text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
            <Zap className="h-3.5 w-3.5" />Conectores
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
      </Tabs>
    </div>
  );
}
