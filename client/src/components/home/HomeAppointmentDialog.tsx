import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Dialog para marcar uma consulta a partir da Agenda Geral (Home).
 *
 * Regra de produto: nesta entrada, marcar consulta exige contato + negociação
 * já cadastrados. Garante que a agenda da clínica nunca fica órfã do CRM.
 * Dá atalho explícito para /contatos e /negociacoes quando faltar um deles.
 *
 * Persiste em crm_appointments (mesma tabela que a página /agenda usa) →
 * impossível existir "duas agendas" no sistema.
 */
interface HomeAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  defaultDate?: Date;
  onSaved?: () => void;
}

function toLocalDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function HomeAppointmentDialog({ open, onClose, defaultDate, onSaved }: HomeAppointmentDialogProps) {
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState<number | null>(null);
  const [dealId, setDealId] = useState<number | null>(null);
  const [dateStr, setDateStr] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [description, setDescription] = useState("");

  const contactsQ = trpc.crm.contacts.list.useQuery({ limit: 500 }, { enabled: open, staleTime: 60_000 });
  const dealsQ = trpc.crm.deals.list.useQuery({ limit: 500 }, { enabled: open, staleTime: 60_000 });

  const contacts = useMemo(() => {
    return ((contactsQ.data as any)?.items || contactsQ.data || []) as Array<{ id: number; name: string }>;
  }, [contactsQ.data]);

  const dealsForContact = useMemo(() => {
    const all = ((dealsQ.data as any)?.items || dealsQ.data || []) as Array<{ id: number; title: string; contactId: number | null }>;
    if (!contactId) return [];
    return all.filter(d => d.contactId === contactId);
  }, [dealsQ.data, contactId]);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setContactId(null);
    setDealId(null);
    setDescription("");
    const base = defaultDate || new Date();
    setDateStr(toLocalDateStr(base));
    const startHour = base.getHours() >= 7 && base.getHours() <= 20 ? base.getHours() : 9;
    setStartTime(`${String(startHour).padStart(2, "0")}:00`);
    setEndTime(`${String(startHour + 1).padStart(2, "0")}:00`);
  }, [open, defaultDate]);

  // Reset deal when contact changes
  useEffect(() => {
    setDealId(null);
  }, [contactId]);

  const createMut = trpc.agenda.createAppointment.useMutation({
    onSuccess: () => {
      toast.success("Consulta marcada na agenda da clínica");
      utils.agenda.unified.invalidate();
      onSaved?.();
      onClose();
    },
    onError: (err) => toast.error(err.message || "Erro ao marcar consulta"),
  });

  const canSubmit =
    title.trim().length > 0 &&
    !!contactId &&
    !!dealId &&
    !!dateStr &&
    !!startTime &&
    !!endTime &&
    !createMut.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !contactId || !dealId) return;

    const startAt = new Date(`${dateStr}T${startTime}:00`).getTime();
    let endAt = new Date(`${dateStr}T${endTime}:00`).getTime();
    if (endAt <= startAt) endAt = startAt + 60 * 60 * 1000;

    createMut.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      startAt,
      endAt,
      allDay: false,
      contactId,
      dealId,
    });
  };

  const noContacts = !contactsQ.isLoading && contacts.length === 0;
  const contactSelected = !!contactId;
  const noDealsForContact = contactSelected && !dealsQ.isLoading && dealsForContact.length === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold">Marcar consulta</DialogTitle>
          <DialogDescription className="text-[12px]">
            Toda consulta na agenda da clínica precisa estar atrelada a um contato e a uma negociação.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
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

          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold">Contato *</Label>
            {noContacts ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[12px]">
                Nenhum contato cadastrado.{" "}
                <Link href="/contatos" className="text-emerald-500 font-medium inline-flex items-center gap-1">
                  Cadastrar contato <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <Select
                value={contactId ? String(contactId) : ""}
                onValueChange={(v) => setContactId(v ? Number(v) : null)}
                disabled={contactsQ.isLoading}
              >
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder={contactsQ.isLoading ? "Carregando…" : "Selecione um contato"} />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold">Negociação *</Label>
            {!contactSelected ? (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-[12px] text-muted-foreground">
                Selecione um contato primeiro.
              </div>
            ) : noDealsForContact ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[12px]">
                Esse contato ainda não tem negociação.{" "}
                <Link href="/negociacoes" className="text-emerald-500 font-medium inline-flex items-center gap-1">
                  Criar negociação <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <Select
                value={dealId ? String(dealId) : ""}
                onValueChange={(v) => setDealId(v ? Number(v) : null)}
                disabled={dealsQ.isLoading}
              >
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder={dealsQ.isLoading ? "Carregando…" : "Selecione uma negociação"} />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  {dealsForContact.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

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
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={createMut.isPending}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {createMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Marcar consulta
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
