import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus, BookOpen, Clock } from "lucide-react";
import { toast } from "sonner";

const TENANT_ID = 1;

const courseStatusStyles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  draft: { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", label: "Rascunho" },
  published: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Publicado" },
  archived: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Arquivado" },
};

export default function Academy() {
  const courses = trpc.academy.courses.list.useQuery({ tenantId: TENANT_ID });

  return (
    <div className="p-5 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Academy</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Treinamentos e capacitação da equipe.</p>
        </div>
        <Button className="h-9 gap-2 px-5 rounded-xl shadow-soft bg-gradient-to-r from-primary to-[oklch(0.50_0.14_264)] hover:opacity-90 text-[13px] font-semibold" onClick={() => toast("Criação de curso em breve")}>
          <Plus className="h-4 w-4" />Novo Curso
        </Button>
      </div>

      {/* Courses grid */}
      {courses.isLoading ? (
        <p className="text-[13px] text-muted-foreground text-center py-12">Carregando...</p>
      ) : !courses.data?.length ? (
        <Card className="border-0 shadow-soft rounded-2xl">
          <div className="p-12 text-center text-muted-foreground">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-[14px] font-medium text-muted-foreground/60">Nenhum curso disponível</p>
            <p className="text-[13px] text-muted-foreground/40 mt-1">Crie o primeiro curso para começar a capacitar sua equipe.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.data.map((c: any) => {
            const ss = courseStatusStyles[c.status] || courseStatusStyles["draft"];
            return (
              <Card key={c.id} className="border-0 shadow-soft rounded-2xl hover:shadow-md transition-shadow cursor-pointer group">
                <div className="p-5">
                  <div className="flex items-start gap-3.5">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-50 to-blue-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <BookOpen className="h-5 w-5 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold group-hover:text-primary transition-colors">{c.title}</p>
                      <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2">{c.description || "Sem descrição"}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${ss.bg} ${ss.text}`}>
                          <span className={`h-1 w-1 rounded-full ${ss.dot}`} />
                          {ss.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
