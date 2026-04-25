import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ChevronRight, DollarSign, Loader2, Plus, ShoppingCart,
  Eye, EyeOff, Trash2, MousePointer, Pencil, PenTool, Eraser, Undo2
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

interface OrcamentosTabProps {
  contactId: number;
  deals: any[];
  isLoading: boolean;
  contact?: any;
}

function formatCurrency(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function statusConfig(s: string) {
  switch (s) {
    case "won": return { label: "Aprovado", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
    case "lost": return { label: "Reprovado", color: "bg-red-500/15 text-red-400 border-red-500/30" };
    case "open": return { label: "Em análise", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
    default: return { label: s, color: "bg-muted text-muted-foreground" };
  }
}

interface TreatmentItem {
  id: number;
  tratamento: string;
  profissional: string;
  valor: string;
  data: string;
  sessoes: number;
  unidade: string;
  quantidade: string;
}

// Face SVG regions
const FACE_REGIONS = [
  { id: "testa", label: "Testa", path: "M 100,25 Q 130,10 160,10 Q 190,10 220,25 L 215,55 Q 160,45 105,55 Z", cx: 160, cy: 35 },
  { id: "glabela", label: "Glabela", path: "M 140,55 L 180,55 L 175,75 L 145,75 Z", cx: 160, cy: 65 },
  { id: "olho_esq", label: "Olho E", path: "M 105,60 Q 130,55 145,65 Q 130,75 105,70 Z", cx: 125, cy: 65 },
  { id: "olho_dir", label: "Olho D", path: "M 175,65 Q 190,55 215,60 Q 215,70 190,75 Z", cx: 195, cy: 65 },
  { id: "nariz", label: "Nariz", path: "M 150,75 L 170,75 L 175,115 Q 160,120 145,115 Z", cx: 160, cy: 95 },
  { id: "bochecha_esq", label: "Bochecha E", path: "M 85,75 L 140,80 L 135,130 Q 100,135 85,115 Z", cx: 110, cy: 105 },
  { id: "bochecha_dir", label: "Bochecha D", path: "M 180,80 L 235,75 L 235,115 Q 220,135 185,130 Z", cx: 210, cy: 105 },
  { id: "labio_sup", label: "Lábio Sup.", path: "M 135,125 Q 160,115 185,125 Q 175,135 145,135 Z", cx: 160, cy: 128 },
  { id: "labio_inf", label: "Lábio Inf.", path: "M 140,135 Q 160,145 180,135 Q 175,150 145,150 Z", cx: 160, cy: 142 },
  { id: "queixo", label: "Queixo", path: "M 135,150 Q 160,165 185,150 Q 180,180 160,185 Q 140,180 135,150 Z", cx: 160, cy: 168 },
  { id: "mandibula_esq", label: "Mandíbula E", path: "M 85,120 Q 90,160 130,175 L 135,155 Q 100,140 85,120 Z", cx: 108, cy: 148 },
  { id: "mandibula_dir", label: "Mandíbula D", path: "M 185,155 L 190,175 Q 230,160 235,120 Q 220,140 185,155 Z", cx: 212, cy: 148 },
];

export default function OrcamentosTab({ contactId, deals, isLoading, contact }: OrcamentosTabProps) {
  // Form state
  const [descricao, setDescricao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [showValues, setShowValues] = useState(true);
  const [showTreatments, setShowTreatments] = useState(true);
  const [activeRegionTab, setActiveRegionTab] = useState<"regioes" | "corpo">("regioes");
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [showUnits, setShowUnits] = useState(false);

  // Add treatment form
  const [tratForm, setTratForm] = useState({
    plano: "", tratamento: "", data: todayStr(), valor: "",
    profissional: "", quantidade: "0", unidade: "UN", sessoes: "0",
    produto: "", prodUnidade: "", prodQtd: "",
  });
  const [treatments, setTreatments] = useState<TreatmentItem[]>([]);
  const [nextId, setNextId] = useState(1);

  // Injetáveis
  const [injetaveis, setInjetaveis] = useState({
    toxina: { valor: "0,0", unidades: "0.0" },
    acido: { valor: "0,0", unidades: "0.0" },
    fios: { valor: "0,0", unidades: "0.0" },
  });

  // Queries
  const usersQ = trpc.admin.users.list.useQuery();
  const productsQ = trpc.productCatalog.products.list.useQuery({});
  const users = (usersQ.data || []) as any[];
  const products = (productsQ.data || []) as any[];

  function addTreatment() {
    if (!tratForm.tratamento) {
      toast.error("Selecione um tratamento");
      return;
    }
    setTreatments(prev => [...prev, {
      id: nextId,
      tratamento: tratForm.tratamento,
      profissional: tratForm.profissional,
      valor: tratForm.valor,
      data: tratForm.data,
      sessoes: Number(tratForm.sessoes) || 0,
      unidade: tratForm.unidade,
      quantidade: tratForm.quantidade,
    }]);
    setNextId(n => n + 1);
    setTratForm(f => ({ ...f, tratamento: "", valor: "", quantidade: "0", sessoes: "0" }));
    toast.success("Tratamento adicionado");
  }

  function removeTreatment(id: number) {
    setTreatments(prev => prev.filter(t => t.id !== id));
  }

  function toggleRegion(regionId: string) {
    setSelectedRegions(prev =>
      prev.includes(regionId) ? prev.filter(r => r !== regionId) : [...prev, regionId]
    );
  }

  function handleSubmitOrcamento() {
    if (!descricao.trim()) {
      toast.error("Preencha a descrição do orçamento");
      return;
    }
    toast.success("Orçamento criado com sucesso!");
    // Reset
    setDescricao("");
    setObservacao("");
    setTreatments([]);
    setSelectedRegions([]);
    setInjetaveis({
      toxina: { valor: "0,0", unidades: "0.0" },
      acido: { valor: "0,0", unidades: "0.0" },
      fios: { valor: "0,0", unidades: "0.0" },
    });
  }

  // Existing deals
  const approvedDeals = deals.filter((d: any) => d.status === "won");
  const openDeals = deals.filter((d: any) => d.status === "open");
  const displayDeals = [...openDeals, ...approvedDeals];

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#2E7D5B]" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ═══ HEADER ═══ */}
      <h3 className="text-xl font-bold">Orçamento</h3>

      {/* ═══ DADOS DO PACIENTE ═══ */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Dados do paciente</label>
        <div className="grid grid-cols-2 gap-3">
          <Input value={contact?.name || ""} readOnly placeholder="Paciente" className="bg-muted/20 h-9 text-sm" />
          <Input value={contact?.phone || ""} readOnly placeholder="Telefone *" className="bg-muted/20 h-9 text-sm" />
        </div>
      </div>

      {/* ═══ PÁGINA DE ORÇAMENTO ═══ */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Página de Orçamento</label>
        <Input
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          placeholder="Descrição *"
          className="bg-background/50 h-9 text-sm"
        />
      </div>

      {/* ═══ ADICIONAR TRATAMENTO ═══ */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Adicionar tratamento</label>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4 space-y-3">
            {/* Row 1: Plano, Tratamento, Data, Valor */}
            <div className="grid grid-cols-4 gap-2">
              <Select value={tratForm.plano} onValueChange={v => setTratForm(f => ({ ...f, plano: v }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Plano" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="particular">Particular</SelectItem>
                  <SelectItem value="convenio">Convênio</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tratForm.tratamento} onValueChange={v => setTratForm(f => ({ ...f, tratamento: v }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Tratamento *" /></SelectTrigger>
                <SelectContent>
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                  <SelectItem value="Toxina Botulínica">Toxina Botulínica</SelectItem>
                  <SelectItem value="Ácido Hialurônico">Ácido Hialurônico</SelectItem>
                  <SelectItem value="Fios de PDO">Fios de PDO</SelectItem>
                  <SelectItem value="Limpeza de Pele">Limpeza de Pele</SelectItem>
                  <SelectItem value="Peeling">Peeling</SelectItem>
                  <SelectItem value="Microagulhamento">Microagulhamento</SelectItem>
                  <SelectItem value="Laser">Laser</SelectItem>
                </SelectContent>
              </Select>

              <div>
                <label className="text-[10px] text-muted-foreground">Data *</label>
                <input
                  type="date"
                  value={tratForm.data}
                  onChange={e => setTratForm(f => ({ ...f, data: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background/50 px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground">Valor *</label>
                <Input
                  value={tratForm.valor}
                  onChange={e => setTratForm(f => ({ ...f, valor: e.target.value }))}
                  placeholder="R$ 0,00"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Row 2: Profissional, Regiões, Qtd, ML/UN, Sessão */}
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3">
                <Select value={tratForm.profissional} onValueChange={v => setTratForm(f => ({ ...f, profissional: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Profissional *" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <label className="text-[10px] text-muted-foreground">Regiões Selecionadas</label>
                <div className="h-9 rounded-md border border-input bg-background/50 flex items-center px-2">
                  <div className="h-2 bg-[#2E7D5B]/30 rounded-full flex-1">
                    <div className="h-2 bg-[#2E7D5B] rounded-full" style={{ width: `${Math.min(100, (selectedRegions.length / FACE_REGIONS.length) * 100)}%` }} />
                  </div>
                </div>
              </div>
              <div className="col-span-1">
                <label className="text-[10px] text-muted-foreground">Qtd.</label>
                <Input value={tratForm.quantidade} onChange={e => setTratForm(f => ({ ...f, quantidade: e.target.value }))} className="h-9 text-xs text-center" />
              </div>
              <div className="col-span-2 flex items-center gap-3 pb-0.5">
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <Checkbox checked={tratForm.unidade === "ML"} onCheckedChange={() => setTratForm(f => ({ ...f, unidade: "ML" }))} />
                  ML
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <Checkbox checked={tratForm.unidade === "UN"} onCheckedChange={() => setTratForm(f => ({ ...f, unidade: "UN" }))} />
                  UN
                </label>
              </div>
              <div className="col-span-1">
                <label className="text-[10px] text-muted-foreground">Sessão</label>
                <Input value={tratForm.sessoes} onChange={e => setTratForm(f => ({ ...f, sessoes: e.target.value }))} className="h-9 text-xs text-center" />
              </div>
            </div>

            {/* Row 3: Produto, Unidade, Qtd p/ Baixa, + button */}
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4">
                <Select value={tratForm.produto} onValueChange={v => setTratForm(f => ({ ...f, produto: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Produto em Estoque" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <Select value={tratForm.prodUnidade} onValueChange={v => setTratForm(f => ({ ...f, prodUnidade: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Unidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="un">un</SelectItem>
                    <SelectItem value="amp">ampola</SelectItem>
                    <SelectItem value="fr">frasco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <Input value={tratForm.prodQtd} onChange={e => setTratForm(f => ({ ...f, prodQtd: e.target.value }))} placeholder="Qtd. p/ Baixa" className="h-9 text-xs" />
              </div>
              <div className="col-span-2">
                <Button size="sm" onClick={addTreatment} className="h-9 w-full bg-[#2E7D5B] hover:bg-[#256B4D] text-white">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ PRODUTOS UTILIZADOS ═══ */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Produtos utilizados ({treatments.length})</label>
        {treatments.length > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Tratamento</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground">Sessões</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground">Qtd</th>
                    {showValues && <th className="text-right px-2 py-2 font-semibold text-muted-foreground">Valor</th>}
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {treatments.map(t => (
                    <tr key={t.id} className="border-b border-border/30">
                      <td className="px-3 py-2 font-medium">{t.tratamento}</td>
                      <td className="text-center px-2 py-2">{t.sessoes}</td>
                      <td className="text-center px-2 py-2">{t.quantidade} {t.unidade}</td>
                      {showValues && <td className="text-right px-2 py-2">R$ {t.valor || "0,00"}</td>}
                      <td className="text-center px-2 py-2">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400" onClick={() => removeTreatment(t.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══ REGIÕES / FACE ═══ */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-4">
          {/* Tabs */}
          <div className="flex items-center justify-center gap-6 mb-4">
            <button
              onClick={() => setActiveRegionTab("regioes")}
              className={`text-sm font-medium pb-1 border-b-2 transition-colors ${activeRegionTab === "regioes" ? "border-[#2E7D5B] text-[#2E7D5B]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Regiões
            </button>
            <button
              onClick={() => setActiveRegionTab("corpo")}
              className={`text-sm font-medium pb-1 border-b-2 transition-colors ${activeRegionTab === "corpo" ? "border-[#2E7D5B] text-[#2E7D5B]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Corpo/Face IA
            </button>
          </div>

          {activeRegionTab === "regioes" ? (
            <div>
              {/* Injetáveis / HOF */}
              <div className="space-y-3 mb-4">
                <h4 className="text-sm font-semibold">Injetáveis / HOF</h4>
                {[
                  { key: "toxina" as const, label: "Toxina botulínica", color: "bg-blue-500" },
                  { key: "acido" as const, label: "Ácido hialurônico", color: "bg-emerald-500" },
                  { key: "fios" as const, label: "Fios de PDO", color: "bg-purple-500" },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${item.color} shrink-0`} />
                    <span className="text-xs w-32 shrink-0">{item.label}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">R$</span>
                      <Input
                        value={injetaveis[item.key].valor}
                        onChange={e => setInjetaveis(prev => ({ ...prev, [item.key]: { ...prev[item.key], valor: e.target.value } }))}
                        className="h-7 w-16 text-xs text-center"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">un</span>
                      <Input
                        value={injetaveis[item.key].unidades}
                        onChange={e => setInjetaveis(prev => ({ ...prev, [item.key]: { ...prev[item.key], unidades: e.target.value } }))}
                        className="h-7 w-16 text-xs text-center"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUnits(!showUnits)}
                className="text-xs h-7 mb-4"
              >
                {showUnits ? "OCULTAR UNIDADES" : "MOSTRAR UNIDADES"}
              </Button>

              {/* Face SVG Map */}
              <div className="flex gap-4">
                {/* Drawing tools */}
                <div className="flex flex-col gap-1.5 pt-2">
                  {[
                    { icon: MousePointer, title: "Selecionar" },
                    { icon: PenTool, title: "Caneta" },
                    { icon: Pencil, title: "Lápis" },
                    { icon: Eraser, title: "Borracha" },
                    { icon: Plus, title: "Adicionar" },
                    { icon: Undo2, title: "Desfazer" },
                  ].map((tool, i) => (
                    <button
                      key={i}
                      title={tool.title}
                      className="h-7 w-7 rounded border border-border/50 flex items-center justify-center hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <tool.icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>

                {/* Face diagram */}
                <div className="flex-1 flex justify-center">
                  <svg viewBox="0 0 320 210" className="w-full max-w-md" style={{ maxHeight: 340 }}>
                    {/* Face outline */}
                    <ellipse cx="160" cy="100" rx="85" ry="105" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.15" />
                    {/* Hair */}
                    <path d="M 75,60 Q 80,10 160,5 Q 240,10 245,60 Q 240,30 160,25 Q 80,30 75,60" fill="currentColor" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />

                    {/* Clickable regions */}
                    {FACE_REGIONS.map(region => {
                      const isSelected = selectedRegions.includes(region.id);
                      return (
                        <g key={region.id} onClick={() => toggleRegion(region.id)} className="cursor-pointer">
                          <path
                            d={region.path}
                            fill={isSelected ? "rgba(46, 125, 91, 0.3)" : "rgba(128, 128, 128, 0.08)"}
                            stroke={isSelected ? "#2E7D5B" : "rgba(128, 128, 128, 0.3)"}
                            strokeWidth={isSelected ? "1.5" : "0.5"}
                            className="transition-all hover:fill-[rgba(46,125,91,0.15)]"
                          />
                          {showUnits && (
                            <text x={region.cx} y={region.cy + 3} textAnchor="middle" fontSize="7" fill="currentColor" opacity="0.6">
                              {region.label}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Eyes detail */}
                    <ellipse cx="125" cy="65" rx="10" ry="5" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                    <ellipse cx="195" cy="65" rx="10" ry="5" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                    <circle cx="125" cy="65" r="2.5" fill="currentColor" opacity="0.2" />
                    <circle cx="195" cy="65" r="2.5" fill="currentColor" opacity="0.2" />

                    {/* Nose detail */}
                    <path d="M 155,100 Q 160,105 165,100" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />

                    {/* Mouth detail */}
                    <path d="M 145,132 Q 160,127 175,132" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                    <path d="M 148,132 Q 160,140 172,132" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />

                    {/* Guide lines */}
                    <line x1="85" y1="55" x2="235" y2="55" stroke="currentColor" strokeWidth="0.3" opacity="0.1" strokeDasharray="4,4" />
                    <line x1="85" y1="80" x2="235" y2="80" stroke="currentColor" strokeWidth="0.3" opacity="0.1" strokeDasharray="4,4" />
                    <line x1="85" y1="120" x2="235" y2="120" stroke="currentColor" strokeWidth="0.3" opacity="0.1" strokeDasharray="4,4" />
                    <line x1="160" y1="10" x2="160" y2="190" stroke="currentColor" strokeWidth="0.3" opacity="0.1" strokeDasharray="4,4" />
                  </svg>
                </div>
              </div>

              {/* Selected regions list */}
              {selectedRegions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedRegions.map(rId => {
                    const region = FACE_REGIONS.find(r => r.id === rId);
                    return (
                      <Badge key={rId} variant="outline" className="text-[10px] bg-[#2E7D5B]/10 text-[#2E7D5B] border-[#2E7D5B]/30 cursor-pointer" onClick={() => toggleRegion(rId)}>
                        {region?.label} ×
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Mapeamento corporal com IA em breve</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ BOTTOM ACTIONS ═══ */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowTreatments(!showTreatments)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showTreatments ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showTreatments ? "OCULTAR TRATAMENTO(S)" : "MOSTRAR TRATAMENTO(S)"}
        </button>

        <Button onClick={handleSubmitOrcamento} className="bg-[#2E7D5B] hover:bg-[#256B4D] text-white h-9 px-6 text-xs font-semibold uppercase">
          ADICIONAR TRATAMENTOS
        </Button>

        <button
          onClick={() => setShowValues(!showValues)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showValues ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showValues ? "OCULTAR VALORES" : "MOSTRAR VALORES"}
        </button>
      </div>

      {/* ═══ OBSERVAÇÃO ═══ */}
      <div>
        <Textarea
          value={observacao}
          onChange={e => setObservacao(e.target.value)}
          placeholder="Observação"
          className="min-h-[80px] bg-background/50"
        />
      </div>

      <Separator className="my-4" />

      {/* ═══ EXISTING DEALS / ORÇAMENTOS ═══ */}
      {displayDeals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Orçamentos anteriores ({displayDeals.length})
          </h3>
          {displayDeals.map((deal: any) => {
            const sc = statusConfig(deal.status);
            return (
              <Link key={deal.id} href={`/deal/${deal.id}`}>
                <Card className="border-border/50 bg-card/80 hover:bg-muted/30 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{deal.title}</p>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${sc.color}`}>{sc.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {deal.pipelineName && <span>{deal.pipelineName}</span>}
                          {deal.stageName && <><ChevronRight className="h-3 w-3" /><span>{deal.stageName}</span></>}
                          <span>• {formatDate(deal.createdAt)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-sm font-bold">{formatCurrency(deal.valueCents || 0, deal.currency)}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 ml-2" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
