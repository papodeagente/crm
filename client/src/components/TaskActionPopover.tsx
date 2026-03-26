import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Clock, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatTime } from "../../../shared/dateUtils";

const postponeOptions = [
  { label: "1 hora", hours: 1 },
  { label: "3 horas", hours: 3 },
  { label: "1 dia", hours: 24 },
  { label: "2 dias", hours: 48 },
  { label: "7 dias", hours: 168 },
];

interface TaskActionPopoverProps {
  task: {
    id: number;
    title: string;
    dueAt?: string | Date | null;
    status?: string;
  };
  children: React.ReactNode;
  onEdit?: () => void;
  onComplete?: () => void;
  onPostpone?: () => void;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

export default function TaskActionPopover({
  task,
  children,
  onEdit,
  onComplete,
  onPostpone,
  side = "bottom",
  align = "center",
}: TaskActionPopoverProps) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");

  const updateTask = trpc.crm.tasks.update.useMutation({
    onSuccess: () => {
      utils.crm.tasks.list.invalidate();
      utils.crm.tasks.overdueSummary.invalidate();
      utils.crm.tasks.pendingCounts.invalidate();
    },
  });

  const handlePostpone = async (hours: number) => {
    const currentDue = task.dueAt ? new Date(task.dueAt) : new Date();
    const newDue = new Date(currentDue.getTime() + hours * 60 * 60 * 1000);
    await updateTask.mutateAsync({
      id: task.id,
      dueAt: newDue.toISOString(),
    });
    toast.success(`Tarefa adiada para ${formatDate(newDue)} ${formatTime(newDue)}`);
    setOpen(false);
    onPostpone?.();
  };

  const handleCustomPostpone = async () => {
    if (!customDate || !customTime) {
      toast.error("Informe data e horário");
      return;
    }
    const newDue = new Date(`${customDate}T${customTime}:00`);
    await updateTask.mutateAsync({
      id: task.id,
      dueAt: newDue.toISOString(),
    });
    toast.success(`Tarefa adiada para ${formatDate(newDue)} ${formatTime(newDue)}`);
    setOpen(false);
    setShowCustom(false);
    onPostpone?.();
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setShowCustom(false);
    }
  };

  const isDone = task.status === "done";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-[260px] p-0 rounded-xl shadow-xl border border-border/60"
      >
        {/* Postpone menu — shown directly (no main menu) */}
        {!showCustom && (
          <div className="py-1.5">
            <div className="px-3 py-2">
              <p className="text-[13px] font-semibold text-foreground truncate">{task.title}</p>
              {task.dueAt && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Prazo: {formatDate(task.dueAt)} {formatTime(task.dueAt)}
                </p>
              )}
            </div>
            <Separator className="my-1" />
            {postponeOptions.map(opt => (
              <button
                key={opt.hours}
                onClick={() => handlePostpone(opt.hours)}
                disabled={updateTask.isPending}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-foreground hover:bg-muted/60 transition-colors"
              >
                <Clock className="h-4 w-4 text-muted-foreground" />
                {opt.label}
              </button>
            ))}
            <Separator className="my-1" />
            <button
              onClick={() => {
                const now = new Date();
                setCustomDate(now.toISOString().split("T")[0]);
                setCustomTime(
                  String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0")
                );
                setShowCustom(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-primary font-medium hover:bg-muted/60 transition-colors"
            >
              <Clock className="h-4 w-4" />
              Tempo personalizado
            </button>
          </div>
        )}

        {/* Custom postpone */}
        {showCustom && (
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setShowCustom(false)} className="hover:bg-muted/60 rounded-lg p-1 transition-colors">
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <p className="text-[13px] font-semibold text-foreground">Data personalizada</p>
            </div>
            <div className="space-y-2">
              <Label className="text-[12px] font-medium">Data</Label>
              <DatePicker
                value={customDate}
                onChange={setCustomDate}
                placeholder="Selecionar data"
                className="h-9 rounded-lg text-[13px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[12px] font-medium">Horário</Label>
              <Input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="h-9 rounded-lg text-[13px]"
              />
            </div>
            <Button
              size="sm"
              className="w-full h-9 rounded-lg text-[13px]"
              onClick={handleCustomPostpone}
              disabled={updateTask.isPending}
            >
              {updateTask.isPending ? "Adiando..." : "Confirmar"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
