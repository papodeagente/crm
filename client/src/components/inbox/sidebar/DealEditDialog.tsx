/**
 * DealEditDialog — Full deal editing: title, dates, probability, pipeline, lead source, custom fields
 */
import { useState, useEffect, useMemo } from "react";
import { Pencil, X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import CustomFieldRenderer, { customFieldValuesToArray } from "@/components/CustomFieldRenderer";
import type { CustomFieldDef } from "@/components/CustomFieldRenderer";

interface DealEditDialogProps {
  open: boolean;
  onClose: () => void;
  dealId: number;
}

export default function DealEditDialog({ open, onClose, dealId }: DealEditDialogProps) {
  const dealQ = trpc.crm.deals.get.useQuery({ id: dealId }, { enabled: !!dealId && open });
  const deal = dealQ.data as any;

  const pipelinesQ = trpc.crm.pipelines.list.useQuery({}, { enabled: open });
  const pipelines = (pipelinesQ.data || []) as any[];

  const leadSourcesQ = trpc.crm.leadSources.list.useQuery({}, { enabled: open });
  const leadSources = (leadSourcesQ.data || []) as any[];

  const productsQ = trpc.crm.deals.products.list.useQuery({ dealId }, { enabled: !!dealId && open });
  const hasProducts = ((productsQ.data || []) as any[]).length > 0;

  const [form, setForm] = useState<Record<string, any>>({});
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);

  const stagesQ = trpc.crm.pipelines.stages.useQuery(
    { pipelineId: selectedPipelineId! },
    { enabled: !!selectedPipelineId }
  );
  const stages = (stagesQ.data || []) as any[];

  // Custom fields for deals
  const dealFieldsQ = trpc.customFields.list.useQuery({ entity: "deal" as const }, { enabled: open });
  const dealFields = useMemo(() => ((dealFieldsQ.data || []) as CustomFieldDef[]).filter(f => f.isVisibleOnForm || f.isVisibleOnProfile), [dealFieldsQ.data]);

  const cfValuesQ = trpc.contactProfile.getCustomFieldValues.useQuery(
    { entityType: "deal", entityId: dealId },
    { enabled: !!dealId && open }
  );
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({});

  useEffect(() => {
    if (deal) {
      setForm({
        title: deal.title || "",
        probability: deal.probability ?? 0,
        valueReais: deal.valueCents ? (Number(deal.valueCents) / 100).toFixed(2) : "",
        expectedCloseAt: deal.expectedCloseAt ? String(deal.expectedCloseAt).substring(0, 10) : "",
        boardingDate: deal.boardingDate ? String(deal.boardingDate).substring(0, 10) : "",
        returnDate: deal.returnDate ? String(deal.returnDate).substring(0, 10) : "",
        leadSource: deal.leadSource || "",
        channelOrigin: deal.channelOrigin || "",
      });
      setSelectedPipelineId(deal.pipelineId);
    }
  }, [deal]);

  useEffect(() => {
    if (cfValuesQ.data) {
      const map: Record<number, string> = {};
      (cfValuesQ.data as any[]).forEach((v: any) => { map[v.fieldId] = v.value || ""; });
      setCustomFieldValues(map);
    }
  }, [cfValuesQ.data]);

  const utils = trpc.useUtils();
  const updateMut = trpc.crm.deals.update.useMutation({
    onSuccess: () => {
      utils.crm.deals.get.invalidate({ id: dealId });
      utils.contactProfile.getDeals.invalidate();
      utils.contactProfile.getMetrics.invalidate();
      toast.success("Negociação atualizada");
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar"),
  });

  const changePipelineMut = trpc.crm.deals.changePipeline.useMutation({
    onSuccess: () => {
      utils.crm.deals.get.invalidate({ id: dealId });
      utils.contactProfile.getDeals.invalidate();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao trocar pipeline"),
  });

  const setFieldValuesMut = trpc.contactProfile.setCustomFieldValues.useMutation();

  const handleSave = async () => {
    try {
      // If pipeline changed, use changePipeline first
      if (selectedPipelineId && deal && selectedPipelineId !== deal.pipelineId) {
        const firstStage = stages.sort((a: any, b: any) => a.orderIndex - b.orderIndex)[0];
        if (firstStage) {
          await changePipelineMut.mutateAsync({
            dealId,
            newPipelineId: selectedPipelineId,
            newStageId: firstStage.id,
            newPipelineName: pipelines.find((p: any) => p.id === selectedPipelineId)?.name || "",
            newStageName: firstStage.name,
          });
        }
      }

      const parsedValue = form.valueReais !== "" && form.valueReais !== undefined
        ? Math.round(Number(String(form.valueReais).replace(",", ".")) * 100)
        : undefined;

      await (updateMut.mutateAsync as any)({
        id: dealId,
        title: form.title || undefined,
        probability: form.probability !== undefined ? Number(form.probability) : undefined,
        // Valor sempre editável — mesmo com produtos, aceita override manual.
        // Ver specs/domains/ai-deal-intelligence.spec.md (regra de valor).
        valueCents: parsedValue !== undefined && !Number.isNaN(parsedValue) ? parsedValue : undefined,
        expectedCloseAt: form.expectedCloseAt || null,
        boardingDate: form.boardingDate || null,
        returnDate: form.returnDate || null,
        leadSource: form.leadSource || null,
        channelOrigin: form.channelOrigin || null,
      });

      // Save custom field values
      const cfEntries = customFieldValuesToArray(customFieldValues).filter(v => v.value);
      if (cfEntries.length > 0) {
        await setFieldValuesMut.mutateAsync({
          entityType: "deal",
          entityId: dealId,
          values: cfEntries,
        });
      }
    } catch {}
  };

  const set = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  if (!open) return null;

  const inputCls = "w-full px-3 py-2 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors";
  const labelCls = "text-[12px] text-muted-foreground mb-1 block font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-border/50" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <Pencil className="w-[18px] h-[18px] text-white" />
            </div>
            <h3 className="text-[16px] font-semibold text-foreground">Editar Negociação</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-4">
          {!deal ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div>
                <label className={labelCls}>Título</label>
                <input value={form.title} onChange={e => set("title", e.target.value)} className={inputCls} />
              </div>

              {pipelines.length > 0 && (
                <div>
                  <label className={labelCls}>Pipeline</label>
                  <select
                    value={selectedPipelineId || ""}
                    onChange={e => setSelectedPipelineId(Number(e.target.value))}
                    className={inputCls}
                  >
                    {pipelines.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className={labelCls}>Valor (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.valueReais ?? ""}
                  onChange={e => set("valueReais", e.target.value)}
                  placeholder="0,00"
                  className={inputCls}
                />
                {hasProducts && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Normalmente calculado pela soma dos produtos — editar aqui sobrescreve o cálculo.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Probabilidade (%)</label>
                  <input type="number" min={0} max={100} value={form.probability} onChange={e => set("probability", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Previsão de Fechamento</label>
                  <input type="date" value={form.expectedCloseAt} onChange={e => set("expectedCloseAt", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Data de Embarque</label>
                  <input type="date" value={form.boardingDate} onChange={e => set("boardingDate", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Data de Retorno</label>
                  <input type="date" value={form.returnDate} onChange={e => set("returnDate", e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Lead Source</label>
                  <select value={form.leadSource} onChange={e => set("leadSource", e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    {leadSources.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Canal de Origem</label>
                  <input value={form.channelOrigin} onChange={e => set("channelOrigin", e.target.value)} placeholder="WhatsApp, Site..." className={inputCls} />
                </div>
              </div>

              {/* Deal Custom Fields */}
              {dealFields.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="text-[13px] text-muted-foreground mb-2 font-medium">Campos Personalizados</p>
                  <CustomFieldRenderer
                    fields={dealFields}
                    values={customFieldValues}
                    onChange={(fieldId, value) => setCustomFieldValues(prev => ({ ...prev, [fieldId]: value }))}
                    mode="form"
                    compact
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={updateMut.isPending || changePipelineMut.isPending}
            className="px-4 py-2 text-sm text-white bg-primary hover:opacity-90 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {(updateMut.isPending || changePipelineMut.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
