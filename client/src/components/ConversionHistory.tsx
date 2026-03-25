import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  ArrowDownToLine, ExternalLink, Globe, Megaphone,
  FileText, Loader2, ChevronDown, ChevronUp, Zap,
  RefreshCw, PlusCircle, RotateCcw, Link2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function sourceIcon(source: string) {
  switch (source) {
    case "rdstation": return <span className="text-[10px] font-bold text-orange-400">RD</span>;
    case "meta_lead_ads": return <Megaphone className="h-3.5 w-3.5 text-blue-400" />;
    case "wordpress": return <Globe className="h-3.5 w-3.5 text-sky-400" />;
    case "landing": return <FileText className="h-3.5 w-3.5 text-violet-400" />;
    default: return <Zap className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function sourceLabel(source: string) {
  switch (source) {
    case "rdstation": return "RD Station";
    case "meta_lead_ads": return "Meta Lead Ads";
    case "wordpress": return "WordPress";
    case "landing": return "Landing Page";
    default: return source;
  }
}

function matchBadge(matchType: string) {
  switch (matchType) {
    case "new_contact": return <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Novo</Badge>;
    case "email": return <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30">Email</Badge>;
    case "phone": return <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">Telefone</Badge>;
    case "email_and_phone": return <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30">Email+Tel</Badge>;
    case "lead_id": return <Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30">Lead ID</Badge>;
    default: return <Badge variant="outline" className="text-[10px]">{matchType}</Badge>;
  }
}

function dealDecisionBadge(decision: string | null | undefined) {
  if (!decision) return null;
  switch (decision) {
    case "reused_existing_deal":
      return (
        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1">
          <RefreshCw className="h-2.5 w-2.5" />
          Deal reutilizado
        </Badge>
      );
    case "created_new_deal":
      return (
        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1">
          <PlusCircle className="h-2.5 w-2.5" />
          Novo deal
        </Badge>
      );
    case "reopened_existing_context":
      return (
        <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30 gap-1">
          <RotateCcw className="h-2.5 w-2.5" />
          Deal reaberto
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-[10px]">{decision}</Badge>;
  }
}

function formatDate(d: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

interface ConversionHistoryProps {
  contactId: number;
}

export default function ConversionHistory({ contactId }: ConversionHistoryProps) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [, navigate] = useLocation();
  const conversionsQ = trpc.crm.contacts.conversionHistory.useQuery(
    { contactId },
    { enabled: !!contactId }
  );

  const conversions = conversionsQ.data || [];

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ArrowDownToLine className="h-4 w-4 text-primary" />
          Histórico de Conversões ({conversions.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {conversionsQ.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : conversions.length === 0 ? (
          <div className="text-center py-8">
            <ArrowDownToLine className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma conversão registrada</p>
            <p className="text-xs text-muted-foreground mt-1">Conversões são registradas automaticamente quando leads chegam via webhook</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversions.map((conv: any) => {
              const isExpanded = expanded === conv.id;
              return (
                <div
                  key={conv.id}
                  className="border border-border/30 rounded-lg overflow-hidden"
                >
                  <button
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => setExpanded(isExpanded ? null : conv.id)}
                  >
                    <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                      {sourceIcon(conv.integrationSource)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">
                          {conv.conversionName || conv.conversionIdentifier || sourceLabel(conv.integrationSource)}
                        </span>
                        {matchBadge(conv.dedupeMatchType)}
                        {dealDecisionBadge(conv.dealDecision)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>{formatDate(conv.receivedAt)}</span>
                        {conv.utmSource && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <ExternalLink className="h-2.5 w-2.5" />
                              {conv.utmSource}{conv.utmMedium ? ` / ${conv.utmMedium}` : ""}
                            </span>
                          </>
                        )}
                        {conv.dealId && (
                          <>
                            <span>•</span>
                            <button
                              className="flex items-center gap-1 text-primary hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/deals/${conv.dealId}`);
                              }}
                            >
                              <Link2 className="h-2.5 w-2.5" />
                              Deal #{conv.dealId}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-border/20">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-2">
                        {conv.integrationSource && (
                          <div>
                            <span className="text-muted-foreground">Fonte</span>
                            <p className="text-foreground font-medium">{sourceLabel(conv.integrationSource)}</p>
                          </div>
                        )}
                        {conv.externalLeadId && (
                          <div>
                            <span className="text-muted-foreground">Lead ID Externo</span>
                            <p className="text-foreground font-medium font-mono text-[11px]">{conv.externalLeadId}</p>
                          </div>
                        )}
                        {conv.eventType && (
                          <div>
                            <span className="text-muted-foreground">Tipo de Evento</span>
                            <p className="text-foreground font-medium">{conv.eventType}</p>
                          </div>
                        )}
                        {conv.conversionIdentifier && (
                          <div>
                            <span className="text-muted-foreground">Identificador</span>
                            <p className="text-foreground font-medium">{conv.conversionIdentifier}</p>
                          </div>
                        )}
                        {conv.assetName && (
                          <div>
                            <span className="text-muted-foreground">Material</span>
                            <p className="text-foreground font-medium">{conv.assetName}</p>
                          </div>
                        )}
                        {conv.formName && (
                          <div>
                            <span className="text-muted-foreground">Formulário</span>
                            <p className="text-foreground font-medium">{conv.formName}</p>
                          </div>
                        )}
                        {conv.landingPage && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Landing Page</span>
                            <p className="text-foreground font-medium truncate">{conv.landingPage}</p>
                          </div>
                        )}
                        {(conv.utmSource || conv.utmMedium || conv.utmCampaign) && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">UTM</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {conv.utmSource && <Badge variant="outline" className="text-[10px]">source: {conv.utmSource}</Badge>}
                              {conv.utmMedium && <Badge variant="outline" className="text-[10px]">medium: {conv.utmMedium}</Badge>}
                              {conv.utmCampaign && <Badge variant="outline" className="text-[10px]">campaign: {conv.utmCampaign}</Badge>}
                              {conv.utmContent && <Badge variant="outline" className="text-[10px]">content: {conv.utmContent}</Badge>}
                              {conv.utmTerm && <Badge variant="outline" className="text-[10px]">term: {conv.utmTerm}</Badge>}
                            </div>
                          </div>
                        )}
                        {conv.trafficSource && (
                          <div>
                            <span className="text-muted-foreground">Fonte de Tráfego</span>
                            <p className="text-foreground font-medium">{conv.trafficSource}</p>
                          </div>
                        )}
                        {/* Deal decision info */}
                        {conv.dealDecision && (
                          <div className="col-span-2 mt-1 p-2 rounded-md bg-muted/30 border border-border/20">
                            <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">Decisão do Sistema</span>
                            <div className="flex items-center gap-2 mt-1">
                              {dealDecisionBadge(conv.dealDecision)}
                              {conv.dealId && (
                                <button
                                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/deals/${conv.dealId}`);
                                  }}
                                >
                                  <Link2 className="h-3 w-3" />
                                  Abrir negociação #{conv.dealId}
                                </button>
                              )}
                            </div>
                            {conv.dealDecisionReason && (
                              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                                {conv.dealDecisionReason}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
