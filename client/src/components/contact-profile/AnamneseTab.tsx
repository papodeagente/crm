import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ClipboardList, Loader2, CheckCircle2, ChevronLeft, Save,
  Stethoscope, UserRound, Pencil, Eye, Plus, FileSearch, Cloud, CloudOff,
} from "lucide-react";
import { toast } from "sonner";

interface AnamneseTabProps {
  contactId: number;
}

type FillMode = "professional" | "patient";

type Question = {
  id: number;
  templateId: number;
  section: string | null;
  question: string;
  questionType: "text" | "textarea" | "boolean" | "select" | "multiselect" | "number" | "date";
  options: string[] | null;
  hasExtraField: boolean;
  extraFieldLabel: string | null;
  isRequired: boolean;
  sortOrder: number;
};

type Template = {
  id: number;
  slug: string | null;
  name: string;
  description: string | null;
  isDefault: boolean;
  questionCount: number;
};

type Response = {
  id: number;
  templateId: number;
  templateName: string;
  answers: Record<string, string>;
  observation: string | null;
  filledByMode: FillMode | null;
  filledByName: string | null;
  filledAt: string;
  updatedAt: string;
};

const ACCENT = "#2E7D5B";

function formatDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });
}

function templateAccent(slug: string | null) {
  if (slug === "hof") return { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", icon: Stethoscope };
  if (slug === "estetica") return { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/30", icon: ClipboardList };
  if (slug === "co2") return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", icon: FileSearch };
  return { bg: "bg-muted/30", text: "text-muted-foreground", border: "border-border/50", icon: ClipboardList };
}

export default function AnamneseTab({ contactId }: AnamneseTabProps) {
  const utils = trpc.useUtils();
  const templatesQ = trpc.anamnesis.templates.list.useQuery();
  const responsesQ = trpc.anamnesis.responses.list.useQuery({ contactId });

  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<{ id: number; existing?: Response } | null>(null);
  const [fillMode, setFillMode] = useState<FillMode>("professional");

  const templates = (templatesQ.data || []) as unknown as Template[];
  const responses = (responsesQ.data || []) as unknown as Response[];

  const isLoading = templatesQ.isLoading || responsesQ.isLoading;

  // ─────────────────────────────────────────────────────────
  // SELECTION VIEW
  // ─────────────────────────────────────────────────────────
  if (activeTemplateId === null) {
    return (
      <div className="space-y-5">
        <header className="flex items-end justify-between">
          <div>
            <h3 className="text-xl font-bold">Anamnese</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fichas clínicas do paciente. Selecione um modelo para iniciar ou continuar.
            </p>
          </div>
          {responses.length > 0 && (
            <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              {responses.length} ficha{responses.length > 1 ? "s" : ""} preenchida{responses.length > 1 ? "s" : ""}
            </Badge>
          )}
        </header>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: ACCENT }} /></div>
        ) : templates.length === 0 ? (
          <Card className="border-border/50 bg-card/80">
            <CardContent className="text-center py-12">
              <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum template de anamnese disponível.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {templates.map((t) => {
              const existing = responses.find((r) => r.templateId === t.id);
              const isPending = pendingTemplate?.id === t.id;
              const accent = templateAccent(t.slug);
              const Icon = accent.icon;
              return (
                <Card
                  key={t.id}
                  className={`border-border/50 bg-card/80 transition-all hover:border-border ${isPending ? "ring-1 ring-emerald-500/40" : ""}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-lg ${accent.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-4 w-4 ${accent.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-sm truncate">{t.name}</p>
                          {existing && (
                            <Badge variant="outline" className="text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30 px-1.5 py-0">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Preenchida
                            </Badge>
                          )}
                        </div>
                        {t.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">{t.questionCount} perguntas</p>
                      </div>
                    </div>

                    {existing && (
                      <div className="rounded-md bg-muted/30 px-2.5 py-1.5 text-[10px] text-muted-foreground space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          {existing.filledByMode === "patient" ? <UserRound className="h-3 w-3" /> : <Stethoscope className="h-3 w-3" />}
                          <span className="font-medium text-foreground/80">
                            {existing.filledByMode === "patient" ? "Paciente" : "Profissional"}
                          </span>
                          {existing.filledByName && <span>· {existing.filledByName}</span>}
                        </div>
                        <p>Atualizada {formatDateTime(existing.updatedAt || existing.filledAt)}</p>
                      </div>
                    )}

                    {isPending ? (
                      <div className="space-y-2 border-t border-border/50 pt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quem está preenchendo?</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => setFillMode("professional")}
                            className={`flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-medium border transition-all ${
                              fillMode === "professional"
                                ? "bg-[#2E7D5B] text-white border-[#2E7D5B]"
                                : "bg-background/40 text-muted-foreground border-border/60 hover:border-border"
                            }`}
                          >
                            <Stethoscope className="h-3.5 w-3.5" /> Profissional
                          </button>
                          <button
                            onClick={() => setFillMode("patient")}
                            className={`flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-medium border transition-all ${
                              fillMode === "patient"
                                ? "bg-[#2E7D5B] text-white border-[#2E7D5B]"
                                : "bg-background/40 text-muted-foreground border-border/60 hover:border-border"
                            }`}
                          >
                            <UserRound className="h-3.5 w-3.5" /> Paciente
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 pt-1">
                          <Button
                            size="sm" variant="ghost" className="h-8 text-xs flex-1"
                            onClick={() => setPendingTemplate(null)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm" className="h-8 text-xs flex-1 text-white"
                            style={{ backgroundColor: ACCENT }}
                            onClick={() => {
                              setActiveTemplateId(t.id);
                              setPendingTemplate(null);
                            }}
                          >
                            {existing ? "Continuar" : "Iniciar"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm" variant="outline" className="h-8 text-xs flex-1"
                          onClick={() => {
                            setFillMode((existing?.filledByMode as FillMode) || "professional");
                            setPendingTemplate({ id: t.id, existing });
                          }}
                        >
                          {existing ? <><Pencil className="h-3 w-3 mr-1" /> Editar</> : <><Plus className="h-3 w-3 mr-1" /> Iniciar</>}
                        </Button>
                        {existing && (
                          <Button
                            size="sm" variant="ghost" className="h-8 text-xs"
                            onClick={() => {
                              setFillMode((existing.filledByMode as FillMode) || "professional");
                              setActiveTemplateId(t.id);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // FILL VIEW
  // ─────────────────────────────────────────────────────────
  return (
    <FillView
      contactId={contactId}
      templateId={activeTemplateId}
      template={templates.find((t) => t.id === activeTemplateId)!}
      existingResponse={responses.find((r) => r.templateId === activeTemplateId)}
      initialMode={fillMode}
      onClose={() => {
        setActiveTemplateId(null);
        utils.anamnesis.responses.list.invalidate({ contactId });
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Fill view (separated for cleaner state lifecycle)
// ─────────────────────────────────────────────────────────────

interface FillViewProps {
  contactId: number;
  templateId: number;
  template: Template;
  existingResponse?: Response;
  initialMode: FillMode;
  onClose: () => void;
}

function FillView({ contactId, templateId, template, existingResponse, initialMode, onClose }: FillViewProps) {
  const utils = trpc.useUtils();
  const questionsQ = trpc.anamnesis.questions.list.useQuery({ templateId });
  const questions = useMemo(() => (questionsQ.data || []) as unknown as Question[], [questionsQ.data]);

  const [answers, setAnswers] = useState<Record<string, string>>(existingResponse?.answers || {});
  const [observation, setObservation] = useState<string>(existingResponse?.observation || "");
  const [filledByMode, setFilledByModeState] = useState<FillMode>(initialMode);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "dirty">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const saveMut = trpc.anamnesis.responses.save.useMutation({
    onSuccess: () => {
      setSaveState("saved");
      setLastSavedAt(new Date());
      utils.anamnesis.responses.list.invalidate({ contactId });
    },
    onError: () => {
      setSaveState("dirty");
      toast.error("Erro ao salvar — tente novamente.");
    },
  });

  // Group questions by section preserving sortOrder
  const sectionedQuestions = useMemo(() => {
    const groups: { section: string; items: Question[] }[] = [];
    const order: string[] = [];
    const map = new Map<string, Question[]>();
    for (const q of questions) {
      const sec = q.section || "Geral";
      if (!map.has(sec)) {
        map.set(sec, []);
        order.push(sec);
      }
      map.get(sec)!.push(q);
    }
    for (const sec of order) groups.push({ section: sec, items: map.get(sec)! });
    return groups;
  }, [questions]);

  // Set initial active section once questions load
  useEffect(() => {
    if (sectionedQuestions.length > 0 && !activeSection) {
      setActiveSection(sectionedQuestions[0]!.section);
    }
  }, [sectionedQuestions, activeSection]);

  // Progress: questions with non-empty primary answer
  const { answered, total } = useMemo(() => {
    const total = questions.length;
    let answered = 0;
    for (const q of questions) {
      const v = answers[String(q.id)];
      if (v !== undefined && v !== null && v !== "") answered++;
    }
    return { answered, total };
  }, [answers, questions]);

  const sectionStats = useMemo(() => {
    const out: Record<string, { answered: number; total: number }> = {};
    for (const g of sectionedQuestions) {
      let a = 0;
      for (const q of g.items) {
        const v = answers[String(q.id)];
        if (v !== undefined && v !== null && v !== "") a++;
      }
      out[g.section] = { answered: a, total: g.items.length };
    }
    return out;
  }, [answers, sectionedQuestions]);

  // Auto-save (debounced)
  const dirtyRef = useRef(false);
  useEffect(() => {
    if (saveState === "idle") return;
    if (saveState !== "dirty") return;
    dirtyRef.current = true;
    const timer = setTimeout(() => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      setSaveState("saving");
      saveMut.mutate({ contactId, templateId, answers, observation, filledByMode });
    }, 1500);
    return () => clearTimeout(timer);
  }, [answers, observation, filledByMode, saveState, contactId, templateId, saveMut]);

  function setAnswer(qid: number, value: string) {
    setAnswers((prev) => ({ ...prev, [String(qid)]: value }));
    setSaveState("dirty");
  }
  function setExtra(qid: number, value: string) {
    setAnswers((prev) => ({ ...prev, [`${qid}_extra`]: value }));
    setSaveState("dirty");
  }
  function setObs(value: string) {
    setObservation(value);
    setSaveState("dirty");
  }
  function setMode(m: FillMode) {
    setFilledByModeState(m);
    setSaveState("dirty");
  }

  function handleManualSave() {
    setSaveState("saving");
    saveMut.mutate(
      { contactId, templateId, answers, observation, filledByMode },
      {
        onSuccess: () => {
          toast.success("Anamnese salva.");
        },
      }
    );
  }

  function jumpToSection(sec: string) {
    setActiveSection(sec);
    const el = sectionRefs.current[sec];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const accent = templateAccent(template?.slug ?? null);
  const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* ═══ STICKY HEADER ═══ */}
      <div className="sticky top-0 z-20 -mx-1 px-1 pb-1 bg-background/95 backdrop-blur-sm border-b border-border/40">
        <div className="flex items-center gap-3 py-2">
          <Button size="sm" variant="ghost" className="h-8 -ml-1 text-xs gap-1" onClick={onClose}>
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold truncate">{template?.name || "Anamnese"}</h3>
              <SaveIndicator state={saveState} lastSavedAt={lastSavedAt} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {answered}/{total} respondidas · {progressPct}%
            </p>
          </div>

          <Button
            size="sm" className="h-8 text-xs text-white"
            style={{ backgroundColor: ACCENT }}
            onClick={handleManualSave}
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Salvar
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-muted/40 overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progressPct}%`, backgroundColor: ACCENT }}
          />
        </div>

        {/* Mode chips */}
        <div className="flex items-center gap-2 pt-2 pb-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Preenchido por:</span>
          <button
            onClick={() => setMode("professional")}
            className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium border transition ${
              filledByMode === "professional"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                : "bg-transparent text-muted-foreground border-border/60 hover:border-border"
            }`}
          >
            <Stethoscope className="h-3 w-3" /> Profissional
          </button>
          <button
            onClick={() => setMode("patient")}
            className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium border transition ${
              filledByMode === "patient"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                : "bg-transparent text-muted-foreground border-border/60 hover:border-border"
            }`}
          >
            <UserRound className="h-3 w-3" /> Paciente
          </button>
        </div>

        {/* Section navigation chips */}
        {sectionedQuestions.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto py-1.5 -mx-1 px-1 scrollbar-thin">
            {sectionedQuestions.map((g) => {
              const stats = sectionStats[g.section]!;
              const complete = stats.answered === stats.total;
              const isActive = activeSection === g.section;
              return (
                <button
                  key={g.section}
                  onClick={() => jumpToSection(g.section)}
                  className={`shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium border transition whitespace-nowrap ${
                    isActive
                      ? `${accent.bg} ${accent.text} ${accent.border}`
                      : "bg-transparent text-muted-foreground border-border/40 hover:border-border"
                  }`}
                >
                  {complete && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                  <span>{g.section}</span>
                  <span className="text-[9px] opacity-70">{stats.answered}/{stats.total}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ QUESTIONS BODY ═══ */}
      {questionsQ.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: ACCENT }} /></div>
      ) : questions.length === 0 ? (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="text-center py-12">
            <p className="text-sm text-muted-foreground">Esta anamnese ainda não tem perguntas configuradas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sectionedQuestions.map((group, idx) => (
            <div
              key={group.section}
              ref={(el) => { sectionRefs.current[group.section] = el; }}
              data-section={group.section}
              className="scroll-mt-44"
            >
              <Card className="border-border/50 bg-card/80 overflow-hidden">
                <CardHeader className="pb-2 pt-3 border-b border-border/30 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground/60">{String(idx + 1).padStart(2, "0")}</span>
                      <CardTitle className="text-sm font-semibold" style={{ color: ACCENT }}>
                        {group.section}
                      </CardTitle>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {sectionStats[group.section]!.answered}/{sectionStats[group.section]!.total}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border/20">
                  {group.items.map((q, qIdx) => (
                    <QuestionRow
                      key={q.id}
                      idx={qIdx + 1}
                      q={q}
                      value={answers[String(q.id)] || ""}
                      extra={answers[`${q.id}_extra`] || ""}
                      onChange={(v) => setAnswer(q.id, v)}
                      onExtraChange={(v) => setExtra(q.id, v)}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}

          {/* Observation field */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2 pt-3 border-b border-border/30 bg-muted/10">
              <CardTitle className="text-sm font-semibold" style={{ color: ACCENT }}>Observações</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <Textarea
                placeholder="Anote qualquer observação clínica relevante…"
                value={observation}
                onChange={(e) => setObs(e.target.value)}
                className="min-h-[100px] bg-background/50 text-sm"
              />
            </CardContent>
          </Card>

          {/* Bottom action */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-muted-foreground">
              {answered === total && total > 0
                ? "Todas as perguntas foram respondidas."
                : `${total - answered} pergunta${total - answered === 1 ? "" : "s"} pendente${total - answered === 1 ? "" : "s"}.`}
            </p>
            <Button
              size="sm" className="h-9 text-xs px-6 text-white"
              style={{ backgroundColor: ACCENT }}
              onClick={handleManualSave}
              disabled={saveMut.isPending}
            >
              {saveMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar anamnese
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Question row
// ─────────────────────────────────────────────────────────────

interface QuestionRowProps {
  idx: number;
  q: Question;
  value: string;
  extra: string;
  onChange: (v: string) => void;
  onExtraChange: (v: string) => void;
}

function QuestionRow({ idx, q, value, extra, onChange, onExtraChange }: QuestionRowProps) {
  const answered = value !== undefined && value !== null && value !== "";

  return (
    <div className="px-4 py-3 space-y-2 hover:bg-muted/10 transition-colors">
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-mono text-muted-foreground/50 mt-1 shrink-0">{String(idx).padStart(2, "0")}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground/90 leading-snug">
            {q.question}
            {q.isRequired && <span className="text-red-400 ml-1">*</span>}
          </p>
        </div>
        {answered && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/70 mt-1 shrink-0" />}
      </div>

      <div className="ml-6 space-y-2">
        {q.questionType === "select" && q.options && (
          <div className="flex flex-wrap gap-1.5">
            {q.options.map((opt) => {
              const selected = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange(selected ? "" : opt)}
                  className={`inline-flex items-center justify-center h-7 px-3 rounded-full text-[11px] font-medium border transition-all ${
                    selected
                      ? optionStyle(opt).activeClass
                      : "bg-background/50 text-foreground/70 border-border/60 hover:border-border"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {q.questionType === "textarea" && (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-background/50 min-h-[64px] text-sm"
            placeholder="Resposta…"
          />
        )}

        {q.questionType === "text" && (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-background/50 h-8 text-sm"
            placeholder="Resposta"
          />
        )}

        {q.questionType === "number" && (
          <Input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-background/50 h-8 text-sm w-32"
            placeholder="0"
          />
        )}

        {q.questionType === "date" && (
          <Input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-background/50 h-8 text-sm w-40"
          />
        )}

        {q.questionType === "boolean" && (
          <div className="flex gap-1.5">
            {["sim", "nao"].map((opt) => {
              const selected = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange(selected ? "" : opt)}
                  className={`inline-flex items-center justify-center h-7 px-3 rounded-full text-[11px] font-medium border transition-all ${
                    selected
                      ? opt === "sim"
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-red-500 text-white border-red-500"
                      : "bg-background/50 text-foreground/70 border-border/60 hover:border-border"
                  }`}
                >
                  {opt === "sim" ? "Sim" : "Não"}
                </button>
              );
            })}
          </div>
        )}

        {q.hasExtraField && (
          <Input
            value={extra}
            onChange={(e) => onExtraChange(e.target.value)}
            placeholder={q.extraFieldLabel || "Informações adicionais"}
            className="bg-background/30 h-8 text-xs border-border/40"
          />
        )}
      </div>
    </div>
  );
}

function optionStyle(opt: string) {
  const lower = opt.toLowerCase();
  if (lower === "sim") {
    return { activeClass: "bg-emerald-500 text-white border-emerald-500" };
  }
  if (lower === "não" || lower === "nao") {
    return { activeClass: "bg-red-500 text-white border-red-500" };
  }
  if (lower.includes("sei")) {
    return { activeClass: "bg-amber-500/80 text-white border-amber-500/80" };
  }
  return { activeClass: `bg-[${ACCENT}] text-white border-[${ACCENT}]` };
}

// ─────────────────────────────────────────────────────────────
// Save indicator
// ─────────────────────────────────────────────────────────────

function SaveIndicator({ state, lastSavedAt }: { state: "idle" | "saving" | "saved" | "dirty"; lastSavedAt: Date | null }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
      </span>
    );
  }
  if (state === "saved" && lastSavedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/80">
        <Cloud className="h-3 w-3" /> Salvo {lastSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  }
  if (state === "dirty") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-amber-400/80">
        <CloudOff className="h-3 w-3" /> Alterações não salvas
      </span>
    );
  }
  return null;
}
