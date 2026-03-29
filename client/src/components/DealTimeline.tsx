import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowRight, MessageSquare, StickyNote, CheckSquare, Target,
  ArrowDownUp, Package, UserPlus, UserMinus, Pencil, Trash2,
  RotateCcw, Clock, Bot, Globe, ChevronDown, Filter,
  MessageCircle, Zap, FileText, MessageSquarePlus, Send,
  Sparkles, Loader2, RefreshCw, Award, BarChart3, TrendingUp,
  TrendingDown, Star, AlertCircle, Lightbulb, History, X,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ─── Category config ───
const CATEGORIES = [
  { key: "funnel", label: "Funil", icon: ArrowDownUp, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-green-500", bgColor: "bg-green-500/10" },
  { key: "task", label: "Tarefas", icon: CheckSquare, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  { key: "note", label: "Anotações", icon: StickyNote, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  { key: "product", label: "Produtos", icon: Package, color: "text-orange-500", bgColor: "bg-orange-500/10" },
  { key: "assignment", label: "Participantes", icon: UserPlus, color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
  { key: "conversion", label: "Conversões", icon: Target, color: "text-pink-500", bgColor: "bg-pink-500/10" },
  { key: "audit", label: "Auditoria", icon: FileText, color: "text-gray-500", bgColor: "bg-gray-500/10" },
  { key: "automation", label: "Automação", icon: Zap, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
] as const;

function getActionIcon(action: string, eventCategory?: string) {
  switch (action) {
    case "created": return <Globe className="h-4 w-4" />;
    case "stage_moved": return <ArrowRight className="h-4 w-4" />;
    case "status_changed": return <ArrowDownUp className="h-4 w-4" />;
    case "field_changed": return <Pencil className="h-4 w-4" />;
    case "product_added": case "product_updated": case "product_removed": return <Package className="h-4 w-4" />;
    case "participant_added": return <UserPlus className="h-4 w-4" />;
    case "participant_removed": return <UserMinus className="h-4 w-4" />;
    case "deleted": return <Trash2 className="h-4 w-4" />;
    case "restored": return <RotateCcw className="h-4 w-4" />;
    case "whatsapp_message": return <MessageCircle className="h-4 w-4" />;
    case "note": return <StickyNote className="h-4 w-4" />;
    case "task_created": return <CheckSquare className="h-4 w-4" />;
    case "task_completed": return <CheckSquare className="h-4 w-4" />;
    case "task_cancelled": return <Trash2 className="h-4 w-4" />;
    case "task_reopened": return <RotateCcw className="h-4 w-4" />;
    case "task_edited": return <Pencil className="h-4 w-4" />;
    case "task_postponed": return <Clock className="h-4 w-4" />;
    case "conversion": return <Target className="h-4 w-4" />;
    case "import": return <Globe className="h-4 w-4" />;
    case "whatsapp_backup": return <MessageSquare className="h-4 w-4" />;
    default:
      if (eventCategory === "automation") return <Bot className="h-4 w-4" />;
      return <FileText className="h-4 w-4" />;
  }
}

function getCategoryConfig(category: string) {
  return CATEGORIES.find(c => c.key === category) || CATEGORIES[CATEGORIES.length - 1];
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: diffDays > 365 ? "numeric" : undefined });
}

function formatFullDate(date: Date): string {
  return date.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function groupEventsByDate(events: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  for (const event of events) {
    const date = new Date(event.occurredAt);
    const key = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
    if (!groups[key]) groups[key] = [];
    groups[key].push(event);
  }
  return groups;
}

function getDateLabel(dateStr: string): string {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  if (dateStr === today) return "Hoje";
  if (dateStr === yesterday) return "Ontem";
  return dateStr;
}

// ─── WhatsApp message bubble ───
function WhatsAppBubble({ event }: { event: any }) {
  const meta = event.metadataJson || {};
  const isFromMe = meta.fromMe;
  const truncated = (event.description || "").length > 200
    ? event.description.substring(0, 200) + "..."
    : event.description;

  return (
    <div className={`flex ${isFromMe ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
        isFromMe
          ? "bg-green-600/20 text-green-100 rounded-br-none"
          : "bg-muted text-muted-foreground rounded-bl-none"
      }`}>
        {!isFromMe && meta.pushName && (
          <p className="text-xs font-medium text-green-400 mb-0.5">{meta.pushName}</p>
        )}
        <p className="whitespace-pre-wrap break-words">{truncated || `[${meta.messageType || "mensagem"}]`}</p>
        <p className="text-[10px] opacity-60 mt-1 text-right">
          {formatRelativeTime(new Date(event.occurredAt))}
        </p>
      </div>
    </div>
  );
}

// ─── Standard timeline event ───
function TimelineEvent({ event }: { event: any }) {
  const cat = getCategoryConfig(event.eventCategory || "audit");
  const icon = getActionIcon(event.action, event.eventCategory);
  const date = new Date(event.occurredAt);
  const isNote = event.action === "note" || event.type === "note";

  return (
    <div className="flex gap-3 group">
      {/* Icon column */}
      <div className="flex flex-col items-center">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${cat.bgColor} ${cat.color} shrink-0`}>
          {icon}
        </div>
        <div className="w-px flex-1 bg-border/50 group-last:hidden" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {isNote ? (
              <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-lg">
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {event.description}
                </p>
              </div>
            ) : (
              <p className="text-sm text-foreground leading-snug">
                {event.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {event.actorName && (
                <span className="text-xs text-muted-foreground">
                  {event.actorName}
                </span>
              )}
              {event.action === "stage_moved" && event.fromStageName && event.toStageName && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {event.fromStageName} → {event.toStageName}
                </Badge>
              )}
              {event.action === "field_changed" && event.fieldChanged && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {event.fieldChanged}
                </Badge>
              )}
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0" title={formatFullDate(date)}>
            {formatRelativeTime(date)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Collapsed WhatsApp group ───
function WhatsAppGroup({ events }: { events: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const preview = events.slice(0, 3);
  const remaining = events.length - 3;

  return (
    <div className="flex gap-3">
      {/* Icon column */}
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10 text-green-500 shrink-0">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div className="w-px flex-1 bg-border/50" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm text-green-400 hover:text-green-300 transition-colors mb-2">
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{events.length} mensagens WhatsApp</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>

          {/* Always show preview */}
          {!expanded && (
            <div className="space-y-1.5">
              {preview.map(ev => (
                <WhatsAppBubble key={ev.id} event={ev} />
              ))}
              {remaining > 0 && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  +{remaining} mensagens...
                </p>
              )}
            </div>
          )}

          <CollapsibleContent>
            <div className="space-y-1.5">
              {events.map(ev => (
                <WhatsAppBubble key={ev.id} event={ev} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

// ─── Main Timeline Component ───
export function DealTimeline({ dealId }: { dealId: number }) {
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [limit, setLimit] = useState(50);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);

  const utils = trpc.useUtils();
  const createNote = trpc.crm.notes.create.useMutation({
    onSuccess: () => {
      setNewNote("");
      toast.success("Anotação criada");
      utils.crm.deals.timeline.invalidate({ dealId });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar anotação"),
  });

  const handleCreateNote = () => {
    if (!newNote.trim()) return;
    createNote.mutate({ entityType: "deal", entityId: dealId, body: newNote.trim() });
  };

  const { data, isLoading, isFetching } = trpc.crm.deals.timeline.useQuery(
    {
      dealId,
      categories: activeCategories.length > 0 ? activeCategories : undefined,
      limit,
      includeWhatsApp: activeCategories.length === 0 || activeCategories.includes("whatsapp"),
    },
    { refetchInterval: 30000 }
  );

  const toggleCategory = (key: string) => {
    setActiveCategories(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Group consecutive WhatsApp messages together
  const processedEvents = useMemo(() => {
    if (!data?.events) return [];
    const result: Array<{ type: "event" | "wa_group"; events: any[] }> = [];
    let waBuffer: any[] = [];

    for (const event of data.events) {
      if (event.type === "whatsapp") {
        waBuffer.push(event);
      } else {
        if (waBuffer.length > 0) {
          result.push({ type: "wa_group", events: [...waBuffer] });
          waBuffer = [];
        }
        result.push({ type: "event", events: [event] });
      }
    }
    if (waBuffer.length > 0) {
      result.push({ type: "wa_group", events: waBuffer });
    }
    return result;
  }, [data?.events]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Array<{ date: string; items: typeof processedEvents }> = [];
    let currentDate = "";
    let currentItems: typeof processedEvents = [];

    for (const item of processedEvents) {
      const eventDate = new Date(item.events[0].occurredAt).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo",
      });
      if (eventDate !== currentDate) {
        if (currentItems.length > 0) {
          groups.push({ date: currentDate, items: currentItems });
        }
        currentDate = eventDate;
        currentItems = [item];
      } else {
        currentItems.push(item);
      }
    }
    if (currentItems.length > 0) {
      groups.push({ date: currentDate, items: currentItems });
    }
    return groups;
  }, [processedEvents]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7">
              <Filter className="h-3.5 w-3.5" />
              Filtros
              {activeCategories.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {activeCategories.length}
                </Badge>
              )}
              <ChevronDown className={`h-3 w-3 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-1">
            {activeCategories.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground"
                onClick={() => setActiveCategories([])}>
                Limpar
              </Button>
            )}
            <Button
              variant={showAiAnalysis ? "default" : "ghost"}
              size="sm"
              className={`gap-1.5 text-xs h-7 ${showAiAnalysis ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white" : ""}`}
              onClick={() => setShowAiAnalysis(!showAiAnalysis)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Análise IA</span>
            </Button>
          </div>
        </div>
        <CollapsibleContent>
          <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => {
                const isActive = activeCategories.includes(cat.key);
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    onClick={() => toggleCategory(cat.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                      isActive
                        ? `${cat.bgColor} ${cat.color} border-current`
                        : "bg-transparent text-muted-foreground border-border/50 hover:border-border"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* AI Analysis Panel */}
      {showAiAnalysis && (
        <div className="border-b border-border/50">
          <AiAnalysisInline dealId={dealId} onClose={() => setShowAiAnalysis(false)} />
        </div>
      )}

      {/* Create note */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Criar anotação..."
              className="min-h-[52px] max-h-[120px] text-sm resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleCreateNote();
                }
              }}
            />
          </div>
          <Button
            size="sm"
            disabled={!newNote.trim() || createNote.isPending}
            onClick={handleCreateNote}
            className="shrink-0 mt-0.5 gap-1.5"
          >
            {createNote.isPending ? (
              <Clock className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Anotar</span>
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Ctrl+Enter para enviar</p>
      </div>

      {/* Timeline content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {groupedByDate.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Nenhum evento encontrado</p>
              {activeCategories.length > 0 && (
                <p className="text-xs mt-1">Tente remover os filtros</p>
              )}
            </div>
          ) : (
            <>
              {groupedByDate.map((group, gi) => (
                <div key={group.date}>
                  {/* Date separator */}
                  <div className="flex items-center gap-3 mb-4 mt-2">
                    <div className="h-px flex-1 bg-border/50" />
                    <span className="text-xs font-medium text-muted-foreground px-2">
                      {getDateLabel(group.date)}
                    </span>
                    <div className="h-px flex-1 bg-border/50" />
                  </div>

                  {/* Events */}
                  {group.items.map((item, i) => {
                    if (item.type === "wa_group") {
                      return <WhatsAppGroup key={`wag-${gi}-${i}`} events={item.events} />;
                    }
                    return <TimelineEvent key={item.events[0].id} event={item.events[0]} />;
                  })}
                </div>
              ))}

              {/* Load more */}
              {data?.hasMore && (
                <div className="flex justify-center pt-4 pb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setLimit(prev => prev + 50)}
                    disabled={isFetching}
                  >
                    {isFetching ? "Carregando..." : "Carregar mais"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Score Circle ───
function ScoreCircle({ score, label, size = "md" }: { score: number; label: string; size?: "sm" | "md" | "lg" }) {
  const radius = size === "lg" ? 40 : size === "sm" ? 16 : 28;
  const stroke = size === "lg" ? 6 : size === "sm" ? 3 : 4;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 10) * circumference;
  const dim = (radius + stroke) * 2;
  const color = score >= 8 ? "text-emerald-500" : score >= 6 ? "text-yellow-500" : score >= 4 ? "text-orange-500" : "text-red-500";
  const fontSize = size === "lg" ? "text-2xl" : size === "sm" ? "text-[10px]" : "text-sm";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg className="transform -rotate-90" width={dim} height={dim}>
          <circle cx={radius + stroke} cy={radius + stroke} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-border" />
          <circle cx={radius + stroke} cy={radius + stroke} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className={color} style={{ transition: "stroke-dashoffset 0.8s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${fontSize} ${color}`}>{score.toFixed(1)}</span>
        </div>
      </div>
      {label && <span className="text-[10px] text-muted-foreground text-center leading-tight">{label}</span>}
    </div>
  );
}

function formatFullDateTime(ts: number | string) {
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── AI Analysis Inline Component ───
function AiAnalysisInline({ dealId, onClose }: { dealId: number; onClose: () => void }) {
  const [showHistory, setShowHistory] = useState(false);

  const latestQ = trpc.aiAnalysis.getLatest.useQuery({ dealId });
  const historyQ = trpc.aiAnalysis.getHistory.useQuery({ dealId }, { enabled: showHistory });
  const analyzeMut = trpc.aiAnalysis.analyze.useMutation({
    onSuccess: () => {
      latestQ.refetch();
      historyQ.refetch();
      toast.success("Análise concluída!");
    },
    onError: (err) => toast.error(err.message),
  });

  const analysis = latestQ.data;

  return (
    <div className="p-4 space-y-4 bg-gradient-to-b from-violet-500/5 to-transparent">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Análise de IA</h3>
            <p className="text-[10px] text-muted-foreground">Avaliação automática do atendimento</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {analysis && (
            <Button size="sm" variant="ghost" onClick={() => setShowHistory(!showHistory)} className="text-xs h-7 gap-1">
              <History className="h-3 w-3" />
              <span className="hidden sm:inline">Anteriores</span>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => analyzeMut.mutate({ dealId, forceNew: !!analysis })}
            disabled={analyzeMut.isPending}
            className="h-7 text-xs bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white gap-1"
          >
            {analyzeMut.isPending ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Analisando...</>
            ) : analysis ? (
              <><RefreshCw className="h-3 w-3" /> Re-analisar</>
            ) : (
              <><Sparkles className="h-3 w-3" /> Analisar</>
            )}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Loading */}
      {analyzeMut.isPending && (
        <div className="flex flex-col items-center py-8">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center animate-pulse">
            <Sparkles className="h-6 w-6 text-violet-500 animate-spin" style={{ animationDuration: "3s" }} />
          </div>
          <p className="text-xs font-medium mt-3">Analisando conversa...</p>
        </div>
      )}

      {/* Empty */}
      {!analysis && !analyzeMut.isPending && (
        <div className="flex flex-col items-center py-6 text-muted-foreground">
          <Sparkles className="h-8 w-8 opacity-40 mb-2" />
          <p className="text-xs">Clique em "Analisar" para avaliar o atendimento</p>
        </div>
      )}

      {/* Results */}
      {analysis && !analyzeMut.isPending && (
        <div className="space-y-3">
          {/* Scores */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-3.5 w-3.5 text-primary" />
              <h4 className="text-xs font-semibold">Pontuação</h4>
              <span className="text-[9px] text-muted-foreground ml-auto">
                {analysis.messagesAnalyzed} msgs · {analysis.createdAt ? formatFullDateTime(analysis.createdAt) : ""}
              </span>
            </div>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <ScoreCircle score={analysis.overallScore || 0} label="Geral" size="md" />
              <div className="flex gap-3 flex-wrap justify-center">
                <ScoreCircle score={analysis.toneScore || 0} label="Tom" size="sm" />
                <ScoreCircle score={analysis.responsivenessScore || 0} label="Resposta" size="sm" />
                <ScoreCircle score={analysis.clarityScore || 0} label="Clareza" size="sm" />
                <ScoreCircle score={analysis.closingScore || 0} label="Fechamento" size="sm" />
              </div>
            </div>
            {analysis.responseTimeAvg && (
              <div className="flex items-center justify-center gap-1 mt-3 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                Tempo médio: <strong className="text-foreground">{analysis.responseTimeAvg}</strong>
              </div>
            )}
          </div>

          {/* Summary */}
          {analysis.summary && (
            <div className="bg-card rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-semibold">Resumo</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{analysis.summary}</p>
            </div>
          )}

          {/* Strengths & Improvements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(analysis.strengths as string[] | null)?.length ? (
              <div className="bg-card rounded-lg border border-border p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Pontos Fortes</h4>
                </div>
                <ul className="space-y-1">
                  {(analysis.strengths as string[]).map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px]">
                      <Star className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {(analysis.improvements as string[] | null)?.length ? (
              <div className="bg-card rounded-lg border border-border p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="h-3.5 w-3.5 text-orange-500" />
                  <h4 className="text-xs font-semibold text-orange-600 dark:text-orange-400">Melhorias</h4>
                </div>
                <ul className="space-y-1">
                  {(analysis.improvements as string[]).map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px]">
                      <AlertCircle className="h-3 w-3 text-orange-500 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {/* Suggestions */}
          {(analysis.suggestions as string[] | null)?.length ? (
            <div className="bg-card rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                <h4 className="text-xs font-semibold">Sugestões</h4>
              </div>
              <div className="space-y-1.5">
                {(analysis.suggestions as string[]).map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="h-4 w-4 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-yellow-600 dark:text-yellow-400">{i + 1}</span>
                    </span>
                    <span className="text-muted-foreground">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Missed Opportunities */}
          {(analysis.missedOpportunities as string[] | null)?.length ? (
            <div className="bg-card rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="h-3.5 w-3.5 text-red-500" />
                <h4 className="text-xs font-semibold text-red-600 dark:text-red-400">Oportunidades Perdidas</h4>
              </div>
              <ul className="space-y-1">
                {(analysis.missedOpportunities as string[]).map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px]">
                    <Target className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {/* History */}
      {showHistory && (historyQ.data || []).length > 1 && (
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <History className="h-3.5 w-3.5 text-primary" />
            <h4 className="text-xs font-semibold">Análises Anteriores</h4>
          </div>
          <div className="space-y-1.5">
            {(historyQ.data || []).map((a: any) => (
              <div key={a.id} className="flex items-center gap-2 p-2 rounded-md border border-border/50 hover:bg-muted/30 transition-colors">
                <ScoreCircle score={a.overallScore || 0} label="" size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium truncate">{a.summary?.slice(0, 60)}...</p>
                  <p className="text-[9px] text-muted-foreground">
                    {a.messagesAnalyzed} msgs · {a.createdAt ? formatFullDateTime(a.createdAt) : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
