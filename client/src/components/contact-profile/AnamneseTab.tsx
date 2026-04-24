import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ClipboardList, Plus, Loader2, CheckCircle2, Edit2, Save } from "lucide-react";
import { toast } from "sonner";

interface AnamneseTabProps {
  contactId: number;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
}

export default function AnamneseTab({ contactId }: AnamneseTabProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [fillMode, setFillMode] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const templatesQ = trpc.anamnesis.templates.list.useQuery();
  const responsesQ = trpc.anamnesis.responses.list.useQuery({ contactId });
  const questionsQ = trpc.anamnesis.questions.list.useQuery(
    { templateId: selectedTemplateId! },
    { enabled: !!selectedTemplateId }
  );

  const utils = trpc.useUtils();
  const saveMut = trpc.anamnesis.responses.save.useMutation({
    onSuccess: () => {
      utils.anamnesis.responses.list.invalidate({ contactId });
      setFillMode(false);
      setSelectedTemplateId(null);
      toast.success("Anamnese salva");
    },
    onError: () => toast.error("Erro ao salvar anamnese"),
  });

  const templates = (templatesQ.data || []) as any[];
  const responses = (responsesQ.data || []) as any[];
  const questions = (questionsQ.data || []) as any[];

  function startFill(templateId: number, existingAnswers?: Record<string, string>) {
    setSelectedTemplateId(templateId);
    setAnswers(existingAnswers || {});
    setFillMode(true);
  }

  function handleSave() {
    if (!selectedTemplateId) return;
    saveMut.mutate({ contactId, templateId: selectedTemplateId, answers });
  }

  // Group questions by section
  const sections = questions.reduce((acc: Record<string, any[]>, q: any) => {
    const sec = q.section || "Geral";
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(q);
    return acc;
  }, {});

  if (responsesQ.isLoading || templatesQ.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#2E7D5B]" /></div>;
  }

  // Fill mode: show questionnaire form
  if (fillMode && selectedTemplateId) {
    const template = templates.find((t: any) => t.id === selectedTemplateId);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">{template?.name || "Anamnese"}</h3>
            <p className="text-xs text-muted-foreground">Preencha as informações abaixo</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setFillMode(false); setSelectedTemplateId(null); }} className="h-8 text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saveMut.isPending} className="h-8 text-xs bg-[#2E7D5B] hover:bg-[#256B4D] text-white">
              <Save className="h-3.5 w-3.5 mr-1" /> Salvar
            </Button>
          </div>
        </div>

        {questionsQ.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#2E7D5B]" /></div>
        ) : questions.length === 0 ? (
          <Card className="border-border/50 bg-card/80">
            <CardContent className="text-center py-8">
              <p className="text-sm text-muted-foreground">Nenhuma pergunta neste template</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(sections).map(([section, sQuestions]) => (
            <Card key={section} className="border-border/50 bg-card/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[#2E7D5B]">{section}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(sQuestions as any[]).map((q: any) => (
                  <div key={q.id}>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      {q.question} {q.isRequired && <span className="text-red-400">*</span>}
                    </label>
                    {q.questionType === "text" && (
                      <Input value={answers[String(q.id)] || ""} onChange={(e) => setAnswers({ ...answers, [String(q.id)]: e.target.value })} className="bg-background/50" />
                    )}
                    {q.questionType === "textarea" && (
                      <Textarea value={answers[String(q.id)] || ""} onChange={(e) => setAnswers({ ...answers, [String(q.id)]: e.target.value })} className="bg-background/50 min-h-[60px]" />
                    )}
                    {q.questionType === "boolean" && (
                      <div className="flex items-center gap-3">
                        <Button size="sm" variant={answers[String(q.id)] === "sim" ? "default" : "outline"} className={`h-8 text-xs ${answers[String(q.id)] === "sim" ? "bg-[#2E7D5B] text-white" : ""}`}
                          onClick={() => setAnswers({ ...answers, [String(q.id)]: "sim" })}>Sim</Button>
                        <Button size="sm" variant={answers[String(q.id)] === "nao" ? "default" : "outline"} className={`h-8 text-xs ${answers[String(q.id)] === "nao" ? "bg-red-500 text-white" : ""}`}
                          onClick={() => setAnswers({ ...answers, [String(q.id)]: "nao" })}>Não</Button>
                      </div>
                    )}
                    {q.questionType === "select" && (
                      <Select value={answers[String(q.id)] || ""} onValueChange={(v) => setAnswers({ ...answers, [String(q.id)]: v })}>
                        <SelectTrigger className="bg-background/50"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>
                          {(q.options || []).map((opt: string) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {q.questionType === "number" && (
                      <Input type="number" value={answers[String(q.id)] || ""} onChange={(e) => setAnswers({ ...answers, [String(q.id)]: e.target.value })} className="bg-background/50" />
                    )}
                    {q.questionType === "date" && (
                      <Input type="date" value={answers[String(q.id)] || ""} onChange={(e) => setAnswers({ ...answers, [String(q.id)]: e.target.value })} className="bg-background/50" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  }

  // List mode: show templates and existing responses
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Anamnese</h3>
      </div>

      {/* Existing responses */}
      {responses.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#2E7D5B] uppercase">Fichas Preenchidas</p>
          {responses.map((r: any) => (
            <Card key={r.id} className="border-border/50 bg-card/80">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <p className="font-medium text-sm">{r.templateName}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Preenchido em {formatDate(r.filledAt)}
                      {r.filledByName && ` por ${r.filledByName}`}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => startFill(r.templateId, r.answers)}>
                    <Edit2 className="h-3 w-3 mr-1" /> Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Available templates */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase">Templates Disponíveis</p>
        {templates.length === 0 ? (
          <Card className="border-border/50 bg-card/80">
            <CardContent className="text-center py-8">
              <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum template de anamnese configurado</p>
              <p className="text-xs text-muted-foreground mt-1">Configure templates na área de configurações</p>
            </CardContent>
          </Card>
        ) : (
          templates.map((t: any) => {
            const hasResponse = responses.some((r: any) => r.templateId === t.id);
            return (
              <Card key={t.id} className="border-border/50 bg-card/80">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-[#2E7D5B]" />
                        <p className="font-medium text-sm">{t.name}</p>
                        {t.isDefault && <Badge variant="outline" className="text-[10px]">Padrão</Badge>}
                        {hasResponse && <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Preenchido</Badge>}
                      </div>
                      {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                      <p className="text-xs text-muted-foreground">{t.questionCount || 0} perguntas</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => startFill(t.id, hasResponse ? responses.find((r: any) => r.templateId === t.id)?.answers : undefined)}>
                      {hasResponse ? <><Edit2 className="h-3 w-3 mr-1" /> Editar</> : <><Plus className="h-3 w-3 mr-1" /> Preencher</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
