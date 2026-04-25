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
  Eye, EyeOff, Trash2
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import FaceMap, { FACE_REGIONS } from "./FaceMap";

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

// FACE_REGIONS imported from FaceMap component

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

              {/* Face Map */}
              <FaceMap
                selectedRegions={selectedRegions}
                onToggleRegion={toggleRegion}
                showUnits={showUnits}
              />

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
