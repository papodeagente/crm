import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Plus, BookOpen } from "lucide-react";
import { toast } from "sonner";

const TENANT_ID = 1;

export default function Academy() {
  const courses = trpc.academy.courses.list.useQuery({ tenantId: TENANT_ID });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Academy</h1><p className="text-muted-foreground">Treinamentos e capacitação da equipe.</p></div>
        <Button onClick={() => toast("Criação de curso em breve")}><Plus className="h-4 w-4 mr-2" />Novo Curso</Button>
      </div>
      {courses.isLoading ? <p className="text-muted-foreground">Carregando...</p>
      : !courses.data?.length ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-40" /><p>Nenhum curso disponível. Crie o primeiro curso para começar.</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.data.map((c: any) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><BookOpen className="h-5 w-5 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{c.title}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description || "Sem descrição"}</p>
                    <Badge variant="secondary" className="mt-2">{c.status || "draft"}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
