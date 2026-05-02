import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, UserPlus, Briefcase, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Caixa única de marcar consulta usada em toda a aplicação.
 *
 * Regra de produto invariante: TODA consulta criada no sistema precisa de
 * contato + negociação. Aqui o usuário pode SELECIONAR existente ou CRIAR
 * inline (passando para um sub-formulário simplificado), mas nunca seguir
 * sem ambos.
 *
 * Persiste em crm_appointments via agenda.createAppointment — única tabela
 * de agenda do tenant. Mesma fonte da página /agenda, do tab "Agendamentos"
 * do contato e do widget da home.
 */
interface AppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  defaultDate?: Date;
  /** Pré-seleciona contato (ex.: ao abrir do tab do contato ou do inbox). */
  defaultContactId?: number | null;
  /** Pré-seleciona negociação (ex.: ao abrir do detalhe da negociação). */
  defaultDealId?: number | null;
  /** Pré-preenche o formulário de "criar contato" (ex.: telefone do whatsapp). */
  defaultContactPhone?: string;
  defaultContactName?: string;
  onSaved?: (appointmentId?: number) => void;
}

type ContactMode = "select" | "create";
type DealMode = "select" | "create";

function toLocalDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AppointmentDialog({
  open,
  onClose,
  defaultDate,
  defaultContactId,
  defaultDealId,
  defaultContactPhone,
  defaultContactName,
  onSaved,
}: AppointmentDialogProps) {
  const utils = trpc.useUtils();

  // Form state
  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState<number | null>(null);
  const [dealId, setDealId] = useState<number | null>(null);
  const [dateStr, setDateStr] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [description, setDescription] = useState("");

  // Inline-create state
  const [contactMode, setContactMode] = useState<ContactMode>("select");
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [creatingContact, setCreatingContact] = useState(false);

  const [dealMode, setDealMode] = useState<DealMode>("select");
  const [newDealTitle, setNewDealTitle] = useState("");
  const [creatingDeal, setCreatingDeal] = useState(false);

  // Queries
  const contactsQ = trpc.crm.contacts.list.useQuery({ limit: 500 }, { enabled: open, staleTime: 60_000 });
  const dealsQ = trpc.crm.deals.list.useQuery({ limit: 500 }, { enabled: open, staleTime: 60_000 });
  const pipelinesQ = trpc.crm.pipelines.list.useQuery({}, { enabled: open && dealMode === "create", staleTime: 5 * 60_000 });
  const firstPipelineId = pipelinesQ.data?.[0]?.id;
  const stagesQ = trpc.crm.pipelines.stages.useQuery(
    { pipelineId: firstPipelineId! },
    { enabled: open && dealMode === "create" && !!firstPipelineId, staleTime: 5 * 60_000 }
  );

  const contacts = useMemo(() => {
    return ((contactsQ.data as any)?.items || contactsQ.data || []) as Array<{ id: number; name: string }>;
  }, [contactsQ.data]);

  const dealsForContact = useMemo(() => {
    const all = ((dealsQ.data as any)?.items || dealsQ.data || []) as Array<{ id: number; title: string; contactId: number | null }>;
    if (!contactId) return [];
    return all.filter(d => d.contactId === contactId);
  }, [dealsQ.data, contactId]);

  // Mutations
  const createContactMut = trpc.crm.contacts.create.useMutation();
  const createDealMut = trpc.crm.deals.create.useMutation();
  const createAppointmentMut = trpc.agenda.createAppointment.useMutation({
    onSuccess: (res: any) => {
      toast.success("Consulta marcada na agenda da clínica");
      utils.agenda.unified.invalidate();
      onSaved?.(res?.id);
      onClose();
    },
    onError: (err) => toast.error(err.message || "Erro ao marcar consulta"),
  });

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setContactMode("select");
    setDealMode("select");
    setNewContactName(defaultContactName || "");
    setNewContactPhone(defaultContactPhone || "");
    setNewDealTitle("");
    setContactId(defaultContactId || null);
    setDealId(defaultDealId || null);
    const base = defaultDate || new Date();
    setDateStr(toLocalDateStr(base));
    const startHour = base.getHours() >= 7 && base.getHours() <= 20 ? base.getHours() : 9;
    setStartTime(`${String(startHour).padStart(2, "0")}:00`);
    setEndTime(`${String(startHour + 1).padStart(2, "0")}:00`);
  }, [open, defaultDate, defaultContactId, defaultDealId, defaultContactPhone, defaultContactName]);

  // Reset deal quando o contato muda — exceto se o pai pré-selecionou
  // contato + deal vinculados (caso do botão "Marcar consulta" no DealDetail).
  useEffect(() => {
    if (defaultDealId && contactId === defaultContactId) return;
    setDealId(null);
    setDealMode("select");
  }, [contactId, defaultDealId, defaultContactId]);

  // Inline-create handlers
  const handleCreateContact = async () => {
    if (!newContactName.trim()) {
      toast.error("Informe o nome do contato");
      return;
    }
    setCreatingContact(true);
    try {
      const created: any = await createContactMut.mutateAsync({
        name: newContactName.trim(),
        phone: newContactPhone.trim() || undefined,
      });
      const newId = created?.id;
      if (!newId) throw new Error("ID não retornado");
      await utils.crm.contacts.list.invalidate();
      setContactId(newId);
      setContactMode("select");
      toast.success("Contato criado");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar contato");
    } finally {
      setCreatingContact(false);
    }
  };

  const handleCreateDeal = async () => {
    if (!newDealTitle.trim()) {
      toast.error("Informe o título da negociação");
      return;
    }
    if (!contactId) {
      toast.error("Selecione ou crie um contato primeiro");
      return;
    }
    if (!firstPipelineId || !stagesQ.data?.[0]?.id) {
      toast.error("Configure pelo menos uma pipeline com estágios antes de criar negociação");
      return;
    }
    setCreatingDeal(true);
    try {
      const created: any = await createDealMut.mutateAsync({
        title: newDealTitle.trim(),
        contactId,
        pipelineId: firstPipelineId,
        stageId: stagesQ.data[0].id,
      });
      const newId = created?.id;
      if (!newId) throw new Error("ID não retornado");
      await utils.crm.deals.list.invalidate();
      setDealId(newId);
      setDealMode("select");
      toast.success("Negociação criada");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar negociação");
    } finally {
      setCreatingDeal(false);
    }
  };

  // Submit
  const canSubmit =
    title.trim().length > 0 &&
    !!contactId &&
    !!dealId &&
    !!dateStr &&
    !!startTime &&
    !!endTime &&
    !createAppointmentMut.isPending &&
    contactMode === "select" &&
    dealMode === "select";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !contactId || !dealId) return;
    const startAt = new Date(`${dateStr}T${startTime}:00`).getTime();
    let endAt = new Date(`${dateStr}T${endTime}:00`).getTime();
    if (endAt <= startAt) endAt = startAt + 60 * 60 * 1000;
    createAppointmentMut.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      startAt,
      endAt,
      allDay: false,
      contactId,
      dealId,
    });
  };

  const selectedContactName = useMemo(() => {
    if (!contactId) return "";
    return contacts.find(c => c.id === contactId)?.name || "";
  }, [contactId, contacts]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold">Marcar consulta</DialogTitle>
          <DialogDescription className="text-[12px]">
            Toda consulta na agenda da clínica precisa estar atrelada a um contato e a uma negociação.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="appt-title" className="text-[12px] font-semibold">Título *</Label>
            <Input
              id="appt-title"
              placeholder="Ex.: Consulta inicial, Avaliação, Sessão de fisio"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 text-[13px]"
              autoFocus
              required
            />
          </div>

          {/* Contato — select OU create inline */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[12px] font-semibold">Contato *</Label>
              {contactMode === "select" ? (
                <button
                  type="button"
                  onClick={() => setContactMode("create")}
                  className="text-[11px] text-emerald-500 hover:underline inline-flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" />
                  Novo contato
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setContactMode("select")}
                  className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Selecionar existente
                </button>
              )}
            </div>

            {contactMode === "select" ? (
              <Select
                value={contactId ? String(contactId) : ""}
                onValueChange={(v) => setContactId(v ? Number(v) : null)}
                disabled={contactsQ.isLoading}
              >
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder={contactsQ.isLoading ? "Carregando…" : "Selecione um contato"} />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  {contacts.length === 0 ? (
                    <div className="py-6 px-3 text-[12px] text-center text-muted-foreground">
                      Nenhum contato cadastrado.<br />
                      <button type="button" onClick={() => setContactMode("create")} className="text-emerald-500 hover:underline mt-1">
                        Criar agora
                      </button>
                    </div>
                  ) : (
                    contacts.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <Input
                  placeholder="Nome do contato *"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="h-8 text-[12.5px]"
                  autoFocus
                />
                <Input
                  placeholder="Telefone (opcional)"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="h-8 text-[12.5px]"
                />
                <Button
                  type="button"
                  size="sm"
                  className="w-full h-8 text-[12px]"
                  onClick={handleCreateContact}
                  disabled={creatingContact || !newContactName.trim()}
                >
                  {creatingContact ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 mr-1" />}
                  Criar contato
                </Button>
              </div>
            )}
          </div>

          {/* Negociação — depende do contato */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[12px] font-semibold">Negociação *</Label>
              {contactId && dealMode === "select" && (
                <button
                  type="button"
                  onClick={() => setDealMode("create")}
                  className="text-[11px] text-emerald-500 hover:underline inline-flex items-center gap-1"
                >
                  <Briefcase className="w-3 h-3" />
                  Nova negociação
                </button>
              )}
              {dealMode === "create" && (
                <button
                  type="button"
                  onClick={() => setDealMode("select")}
                  className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Selecionar existente
                </button>
              )}
            </div>

            {!contactId ? (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-[12px] text-muted-foreground">
                Selecione ou crie um contato primeiro.
              </div>
            ) : dealMode === "select" ? (
              <Select
                value={dealId ? String(dealId) : ""}
                onValueChange={(v) => setDealId(v ? Number(v) : null)}
                disabled={dealsQ.isLoading}
              >
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder={dealsQ.isLoading ? "Carregando…" : `Selecione uma negociação de ${selectedContactName || "este contato"}`} />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  {dealsForContact.length === 0 ? (
                    <div className="py-6 px-3 text-[12px] text-center text-muted-foreground">
                      Esse contato ainda não tem negociação.<br />
                      <button type="button" onClick={() => setDealMode("create")} className="text-emerald-500 hover:underline mt-1">
                        Criar agora
                      </button>
                    </div>
                  ) : (
                    dealsForContact.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <Input
                  placeholder="Título da negociação *"
                  value={newDealTitle}
                  onChange={(e) => setNewDealTitle(e.target.value)}
                  className="h-8 text-[12.5px]"
                  autoFocus
                />
                <p className="text-[10.5px] text-muted-foreground">
                  Será criada na pipeline padrão · vinculada a {selectedContactName}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="w-full h-8 text-[12px]"
                  onClick={handleCreateDeal}
                  disabled={creatingDeal || !newDealTitle.trim() || !firstPipelineId}
                >
                  {creatingDeal ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Briefcase className="w-3.5 h-3.5 mr-1" />}
                  Criar negociação
                </Button>
              </div>
            )}
          </div>

          {/* Data + horários */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="appt-date" className="text-[12px] font-semibold">Data *</Label>
              <Input id="appt-date" type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="h-9 text-[13px]" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-start" className="text-[12px] font-semibold">Início *</Label>
              <Input id="appt-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-9 text-[13px]" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-end" className="text-[12px] font-semibold">Fim *</Label>
              <Input id="appt-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-9 text-[13px]" required />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="appt-desc" className="text-[12px] font-semibold">Observações</Label>
            <Textarea
              id="appt-desc"
              placeholder="Detalhes da consulta (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-[13px] min-h-[60px]"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={createAppointmentMut.isPending}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {createAppointmentMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Marcar consulta
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
