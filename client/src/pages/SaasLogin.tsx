import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Loader2, Eye, EyeOff, Plane } from "lucide-react";
import { toast } from "sonner";

export default function SaasLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = trpc.saasAuth.login.useMutation({
    onSuccess: () => {
      toast.success("Login realizado com sucesso!");
      window.location.href = "/dashboard";
    },
    onError: (error) => {
      if (error.message === "SUBSCRIPTION_EXPIRED") {
        navigate("/upgrade");
        return;
      }
      toast.error(error.message || "Erro no login");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-100/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900">Entur OS</span>
          </div>
          <p className="text-sm text-slate-500">CRM inteligente para agências de viagens</p>
        </div>

        <Card className="border-0 shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold text-center">Entrar na sua conta</CardTitle>
            <CardDescription className="text-center">
              Digite seu email e senha para acessar
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  className="h-11 bg-slate-50/50 border-slate-200 focus:border-purple-400 focus:ring-purple-400/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 bg-slate-50/50 border-slate-200 focus:border-purple-400 focus:ring-purple-400/20 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-xs text-purple-600 hover:text-purple-700 hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium shadow-lg shadow-purple-200/50"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Entrando...</>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-500">
                Não tem uma conta?{" "}
                <button
                  onClick={() => navigate("/register")}
                  className="text-purple-600 hover:text-purple-700 font-medium hover:underline"
                >
                  Criar conta grátis
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          Ao entrar, você concorda com nossos{" "}
          <a href="#" className="underline hover:text-slate-600">Termos de Uso</a>{" "}
          e{" "}
          <a href="#" className="underline hover:text-slate-600">Política de Privacidade</a>
        </p>
      </div>
    </div>
  );
}
