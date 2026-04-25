import { useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowLeft, Mail, Phone, FileText, Calendar, DollarSign,
  Loader2, User, Activity, Plus,
  ClipboardList, CreditCard, XCircle, AlertCircle,
  MessageCircle,
  Save, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import DuplicateAlert from "@/components/DuplicateAlert";

// Tab components
import SobreTab from "@/components/contact-profile/SobreTab";
import AgendamentosTab from "@/components/contact-profile/AgendamentosTab";
import TratamentosTab from "@/components/contact-profile/TratamentosTab";
import OrcamentosTab from "@/components/contact-profile/OrcamentosTab";
import AnamneseTab from "@/components/contact-profile/AnamneseTab";
import DocumentosTab from "@/components/contact-profile/DocumentosTab";
import DebitosTab from "@/components/contact-profile/DebitosTab";
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

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  let year: number, month: number, day: number;
  if (birthDate.length <= 5) {
    // MM-DD format — no year, can't calculate age
    return null;
  }
  // Try YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY
  if (birthDate.includes("-") && birthDate.indexOf("-") === 4) {
    [year, month, day] = birthDate.split("-").map(Number);
  } else if (birthDate.includes("/")) {
    [day, month, year] = birthDate.split("/").map(Number);
  } else {
    return null;
  }
  if (!year || !month || !day) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) age--;
  return age >= 0 ? age : null;
}

function formatBirthDateDisplay(birthDate: string | null): string {
  if (!birthDate) return "Não informado";
  // MM-DD format
  if (birthDate.length <= 5 && birthDate.includes("-")) {
    const [mm, dd] = birthDate.split("-");
    return `${dd}/${mm}`;
  }
  // YYYY-MM-DD
  if (birthDate.includes("-") && birthDate.indexOf("-") === 4) {
    const [y, m, d] = birthDate.split("-");
    return `${d}/${m}/${y}`;
  }
  return birthDate;
}

// ─── Main Component ───
export default function ContactProfile() {
  const [, params] = useRoute("/contact/:id");
  const contactId = Number(params?.id);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("sobre");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: "", email: "", phone: "", birthDate: "", gender: "", referredBy: "",
  });
  const [convenioForm, setConvenioForm] = useState({ numero: "", nome: "" });

  // Queries
  const contactQ = trpc.crm.contacts.get.useQuery({ id: contactId }, { enabled: !!contactId });
  const metricsQ = trpc.contactProfile.getMetrics.useQuery({ contactId }, { enabled: !!contactId });
  const dealsQ = trpc.contactProfile.getDeals.useQuery({ contactId }, { enabled: !!contactId });
  const utils = trpc.useUtils();

  const updateContact = trpc.crm.contacts.update.useMutation({
    onSuccess: () => {
      utils.crm.contacts.get.invalidate({ id: contactId });
      setIsEditing(false);
      toast.success("Dados atualizados");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

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

  function startEdit() {
    setEditData({
      name: contact.name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      birthDate: contact.birthDate || "",
      gender: contact.gender || "",
      referredBy: contact.referredBy || "",
    });
    setIsEditing(true);
  }

  function saveEdit() {
    updateContact.mutate({
      id: contactId,
      name: editData.name || undefined,
      email: editData.email || undefined,
      phone: editData.phone || undefined,
      birthDate: editData.birthDate || null,
      gender: editData.gender || null,
      referredBy: editData.referredBy || null,
    });
  }

  function saveConvenio() {
    if (!convenioForm.numero && !convenioForm.nome) {
      toast.error("Preencha ao menos um campo");
      return;
    }
    updateContact.mutate({
      id: contactId,
      convenioNumero: convenioForm.numero || null,
      convenioNome: convenioForm.nome || null,
    });
    setConvenioForm({ numero: "", nome: "" });
  }

  const age = calculateAge(contact.birthDate);

  const tabItems = [
    { id: "sobre", label: "Sobre", icon: User },
    { id: "agendamentos", label: "Agendamentos", icon: Calendar },
    { id: "tratamentos", label: "Tratamentos", icon: Activity },
    { id: "orcamentos", label: "Orçamentos", icon: DollarSign },
    { id: "anamnese", label: "Anamnese", icon: ClipboardList },
    { id: "documentos", label: "Documentos", icon: FileText },
    { id: "debitos", label: "Débitos", icon: CreditCard },
    { id: "reprovados", label: "Orç. Reprovados", icon: XCircle },
  ];

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* ═══ LEFT SIDEBAR ═══ */}
      <aside className="w-72 border-r border-border/50 bg-card/50 flex flex-col shrink-0 overflow-y-auto">
        {/* Back button */}
        <div className="p-4 pb-2">
          <Link href="/contacts">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Contatos
            </Button>
          </Link>
        </div>

        {/* Avatar + Name */}
        <div className="px-4 pb-4 text-center space-y-2">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#2E7D5B]/30 to-[#2E7D5B]/10 border-2 border-[#2E7D5B]/30 flex items-center justify-center text-3xl font-bold text-[#2E7D5B] mx-auto">
            {(contact.name || "?")[0]?.toUpperCase()}
          </div>
          <h1 className="text-lg font-bold text-foreground truncate">{contact.name}</h1>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-3 border-[#2E7D5B]/50 text-[#2E7D5B] hover:bg-[#2E7D5B]/10"
          >
            ATUALIZAR AVATAR
          </Button>
        </div>

        <Separator />

        {/* Dados do Paciente */}
        <div className="p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados do Paciente</p>

          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground">Nome</label>
                <Input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">E-mail</label>
                <Input value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Telefone</label>
                <Input value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Data de Nascimento</label>
                <Input
                  type="date"
                  value={editData.birthDate.length > 5 ? editData.birthDate : ""}
                  onChange={e => setEditData({ ...editData, birthDate: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Sexo</label>
                <Select value={editData.gender || "_none"} onValueChange={v => setEditData({ ...editData, gender: v === "_none" ? "" : v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Não informado</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Indicado por</label>
                <Input value={editData.referredBy} onChange={e => setEditData({ ...editData, referredBy: e.target.value })} placeholder="Nome de quem indicou" className="h-8 text-xs" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-7 text-xs flex-1">
                  <X className="h-3 w-3 mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={updateContact.isPending} className="h-7 text-xs flex-1 bg-[#2E7D5B] hover:bg-[#256B4D] text-white">
                  <Save className="h-3 w-3 mr-1" /> Salvar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">E-mail:</span>
                <span className="font-medium truncate ml-2">{contact.email || "N/A"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline" className={`text-[10px] ${lifecycleColor(contact.lifecycleStage)}`}>
                  {lifecycleLabel(contact.lifecycleStage)}
                </Badge>
              </div>
              {age !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Idade:</span>
                  <span className="font-medium">{age}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Data de Nascimento:</span>
                <span className="font-medium">{formatBirthDateDisplay(contact.birthDate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Contato:</span>
                <div className="flex items-center gap-1.5">
                  {contact.phone && (
                    <a href={`https://wa.me/${contact.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-3.5 w-3.5 text-green-500 hover:text-green-400 cursor-pointer" />
                    </a>
                  )}
                  <span className="font-medium">{contact.phone || "N/A"}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plano:</span>
                <span className="font-medium">{contact.convenioNome || "Não informado"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sexo:</span>
                <span className="font-medium">{contact.gender || "Não informado"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Indicado por:</span>
                <span className="font-medium truncate ml-2">{contact.referredBy || "Não informado"}</span>
              </div>

              <div className="pt-2">
                <Button
                  size="sm"
                  onClick={startEdit}
                  className="w-full h-8 text-xs bg-[#2E7D5B] hover:bg-[#256B4D] text-white"
                >
                  EDITAR
                </Button>
              </div>
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

        <div className="flex-1" />

        {/* Cadastrar Convênio */}
        <div className="p-4 border-t border-border/50">
          <Card className="border-border/50 bg-muted/20">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-[#2E7D5B]" />
                <span className="text-xs font-semibold">Cadastrar Convênio</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Cadastre o convênio do seu paciente</p>
              {contact.convenioNumero && (
                <div className="text-[10px] text-muted-foreground bg-muted/30 rounded p-1.5">
                  Atual: {contact.convenioNome || "—"} ({contact.convenioNumero})
                </div>
              )}
              <div>
                <label className="text-[10px] text-muted-foreground">Número:</label>
                <Input
                  value={convenioForm.numero}
                  onChange={e => setConvenioForm({ ...convenioForm, numero: e.target.value })}
                  className="h-7 text-xs mt-0.5"
                  placeholder=""
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Nome:</label>
                <Input
                  value={convenioForm.nome}
                  onChange={e => setConvenioForm({ ...convenioForm, nome: e.target.value })}
                  className="h-7 text-xs mt-0.5"
                  placeholder=""
                />
              </div>
              <Button
                size="sm"
                onClick={saveConvenio}
                disabled={updateContact.isPending}
                className="w-full h-8 text-xs bg-[#2E7D5B] hover:bg-[#256B4D] text-white"
              >
                CADASTRAR
              </Button>
            </CardContent>
          </Card>
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
              <TratamentosTab contactId={contactId} contact={contact} />
            </TabsContent>

            <TabsContent value="orcamentos">
              <OrcamentosTab contactId={contactId} deals={deals} isLoading={dealsQ.isLoading} />
            </TabsContent>

            <TabsContent value="anamnese">
              <AnamneseTab contactId={contactId} />
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
