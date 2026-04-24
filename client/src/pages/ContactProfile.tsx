import { useState, useMemo, lazy, Suspense } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowLeft, Mail, Phone, FileText, Calendar, DollarSign,
  Clock, Edit2, Loader2, User, Activity,
  ClipboardList, Image, CreditCard, XCircle, AlertCircle,
  ChevronRight, Tag, Building2, MessageCircle, Stethoscope
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import ConversionHistory from "@/components/ConversionHistory";
import MergeHistory from "@/components/MergeHistory";
import DuplicateAlert from "@/components/DuplicateAlert";

// Tab components
import SobreTab from "@/components/contact-profile/SobreTab";
import AgendamentosTab from "@/components/contact-profile/AgendamentosTab";
import TratamentosTab from "@/components/contact-profile/TratamentosTab";
import OrcamentosTab from "@/components/contact-profile/OrcamentosTab";
import AnamneseTab from "@/components/contact-profile/AnamneseTab";
import DocumentosTab from "@/components/contact-profile/DocumentosTab";
import DebitosTab from "@/components/contact-profile/DebitosTab";
import EvolucoesTab from "@/components/contact-profile/EvolucoesTab";
import OrcReprovadosTab from "@/components/contact-profile/OrcReprovadosTab";

// ─── Types ───
interface ContactMetrics {
  totalDeals: number;
  wonDeals: number;
  totalSpentCents: number;
  daysSinceLastPurchase: number | null;
}

interface ContactDeal {
  id: number;
  title: string;
  status: string;
  valueCents: number;
  currency: string;
  probability: number;
  expectedCloseAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  stageName: string | null;
  pipelineName: string | null;
}

// ─── Helpers ───
function formatCurrency(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
}

function lifecycleLabel(stage: string) {
  switch (stage) {
    case "lead": return "Lead";
    case "prospect": return "Prospect";
    case "customer": return "Cliente";
    case "churned": return "Churned";
    default: return stage;
  }
}

function lifecycleColor(stage: string) {
  switch (stage) {
    case "lead": return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    case "prospect": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "customer": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "churned": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground";
  }
}

// ─── Main Component ───
export default function ContactProfile() {
  const [, params] = useRoute("/contact/:id");
  const contactId = Number(params?.id);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("sobre");

  // Queries
  const contactQ = trpc.crm.contacts.get.useQuery({ id: contactId }, { enabled: !!contactId });
  const metricsQ = trpc.contactProfile.getMetrics.useQuery({ contactId }, { enabled: !!contactId });
  const dealsQ = trpc.contactProfile.getDeals.useQuery({ contactId }, { enabled: !!contactId });

  const contact = contactQ.data as any;
  const metrics = (metricsQ.data || { totalDeals: 0, wonDeals: 0, totalSpentCents: 0, daysSinceLastPurchase: null }) as ContactMetrics;
  const deals = (dealsQ.data || []) as ContactDeal[];

  if (!contactId || contactQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-[#2E7D5B]" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Contato não encontrado</p>
        <Link href="/contacts">
          <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
        </Link>
      </div>
    );
  }

  const tabItems = [
    { id: "sobre", label: "Sobre", icon: User },
    { id: "agendamentos", label: "Agendamentos", icon: Calendar },
    { id: "tratamentos", label: "Tratamentos", icon: Activity },
    { id: "orcamentos", label: "Orçamentos", icon: DollarSign },
    { id: "anamnese", label: "Anamnese", icon: ClipboardList },
    { id: "evolucoes", label: "Evoluções", icon: Stethoscope },
    { id: "documentos", label: "Documentos", icon: FileText },
    { id: "debitos", label: "Débitos", icon: CreditCard },
    { id: "reprovados", label: "Orç. Reprovados", icon: XCircle },
  ];

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* ═══ LEFT SIDEBAR ═══ */}
      <aside className="w-72 border-r border-border/50 bg-card/50 flex flex-col shrink-0 overflow-y-auto">
        {/* Back button + Avatar */}
        <div className="p-4 space-y-4">
          <Link href="/contacts">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Contatos
            </Button>
          </Link>

          {/* Avatar + Name */}
          <div className="text-center space-y-2">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#2E7D5B]/30 to-[#2E7D5B]/10 border-2 border-[#2E7D5B]/30 flex items-center justify-center text-3xl font-bold text-[#2E7D5B] mx-auto">
              {(contact.name || "?")[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground truncate">{contact.name}</h1>
              <div className="flex items-center justify-center gap-2 mt-1">
                <Badge variant="outline" className={lifecycleColor(contact.lifecycleStage)}>
                  {lifecycleLabel(contact.lifecycleStage)}
                </Badge>
                {contact.type === "company" && (
                  <Badge variant="outline" className="text-[10px]">
                    <Building2 className="h-2.5 w-2.5 mr-0.5" /> Empresa
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Contact Info */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2.5 text-sm">
            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate text-xs">{contact.email || <span className="text-muted-foreground italic">Sem email</span>}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate text-xs">{contact.phone || <span className="text-muted-foreground italic">Sem telefone</span>}</span>
          </div>
          {contact.docId && (
            <div className="flex items-center gap-2.5 text-sm">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate text-xs">{contact.docId}</span>
            </div>
          )}
          {contact.source && (
            <div className="flex items-center gap-2.5 text-sm">
              <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate text-xs">{contact.source}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Quick metrics */}
        <div className="p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Negociações</p>
              <p className="text-sm font-bold text-foreground">{metrics.totalDeals}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Fechadas</p>
              <p className="text-sm font-bold text-emerald-400">{metrics.wonDeals}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-sm font-bold text-[#2E7D5B]">{formatCurrency(metrics.totalSpentCents)}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Última</p>
              <p className="text-sm font-bold text-foreground">
                {metrics.daysSinceLastPurchase !== null ? `${metrics.daysSinceLastPurchase}d` : "—"}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Quick actions */}
        <div className="p-4 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ações Rápidas</p>
          {contact.phone && (
            <a href={`https://wa.me/${contact.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-xs">
                <MessageCircle className="h-3.5 w-3.5 mr-2 text-green-500" /> WhatsApp
              </Button>
            </a>
          )}
          <Link href="/agenda">
            <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-xs">
              <Calendar className="h-3.5 w-3.5 mr-2 text-blue-400" /> Agendar
            </Button>
          </Link>
          <Link href="/pipeline">
            <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-xs">
              <DollarSign className="h-3.5 w-3.5 mr-2 text-purple-400" /> Novo Orçamento
            </Button>
          </Link>
        </div>

        <div className="flex-1" />

        {/* Created/Updated dates */}
        <div className="p-4 text-xs text-muted-foreground">
          <p>Criado: {formatDate(contact.createdAt)}</p>
          <p>Atualizado: {formatDate(contact.updatedAt)}</p>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 overflow-y-auto">
        {/* Duplicate Alert */}
        <div className="px-6 pt-4">
          <DuplicateAlert contactId={contactId} email={contact.email} phone={contact.phone} />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="px-6 pt-2 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <TabsList className="bg-transparent h-auto p-0 gap-0 w-full justify-start overflow-x-auto">
              {tabItems.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#2E7D5B] data-[state=active]:text-[#2E7D5B] rounded-none px-3 py-2.5 text-xs gap-1.5 border-b-2 border-transparent"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <div className="px-6 py-4 flex-1">
            <TabsContent value="sobre">
              <SobreTab contact={contact} contactId={contactId} metrics={metrics} />
            </TabsContent>

            <TabsContent value="agendamentos">
              <AgendamentosTab contactId={contactId} />
            </TabsContent>

            <TabsContent value="tratamentos">
              <TratamentosTab contactId={contactId} />
            </TabsContent>

            <TabsContent value="orcamentos">
              <OrcamentosTab contactId={contactId} deals={deals} isLoading={dealsQ.isLoading} />
            </TabsContent>

            <TabsContent value="anamnese">
              <AnamneseTab contactId={contactId} />
            </TabsContent>

            <TabsContent value="evolucoes">
              <EvolucoesTab contactId={contactId} />
            </TabsContent>

            <TabsContent value="documentos">
              <DocumentosTab contactId={contactId} />
            </TabsContent>

            <TabsContent value="debitos">
              <DebitosTab contactId={contactId} />
            </TabsContent>

            <TabsContent value="reprovados">
              <OrcReprovadosTab contactId={contactId} deals={deals} isLoading={dealsQ.isLoading} />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
