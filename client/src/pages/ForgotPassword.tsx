import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { ClinilucroLogo } from "@/components/ClinilucroLogo";

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const requestReset = trpc.saasAuth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSent(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestReset.mutate({ email, origin: window.location.origin });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-100/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-lime-100/40 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8 flex justify-center">
          <ClinilucroLogo className="h-9" />
        </div>

        <Card className="border-0 shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold text-center">
              {sent ? "Email enviado" : "Esqueci minha senha"}
            </CardTitle>
            <CardDescription className="text-center">
              {sent
                ? "Verifique sua caixa de entrada"
                : "Digite seu email para receber o link de redefinição"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Se o email <strong>{email}</strong> estiver cadastrado, você receberá um link
                  para redefinir sua senha. O link expira em 60 minutos.
                </p>
                <p className="text-xs text-slate-400">
                  Não recebeu? Verifique a pasta de spam ou tente novamente.
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => { setSent(false); setEmail(""); }}
                    className="w-full"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Tentar outro email
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => navigate("/login")}
                    className="w-full text-emerald-600 hover:text-emerald-700"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar ao login
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 bg-slate-50/50 border-slate-200 focus:border-emerald-400 focus:ring-emerald-400/20"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-emerald-600 to-lime-500 hover:from-emerald-700 hover:to-lime-600 text-white font-medium shadow-lg shadow-emerald-200/50"
                  disabled={requestReset.isPending}
                >
                  {requestReset.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enviando...</>
                  ) : (
                    "Enviar link de redefinição"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate("/login")}
                  className="w-full text-slate-500 hover:text-slate-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao login
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
