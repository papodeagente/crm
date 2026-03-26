import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { Loader2, Eye, EyeOff, Plane } from "lucide-react";
import { toast } from "sonner";

export default function SaasLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check if user already has an active session
  const meQuery = trpc.saasAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (meQuery.isLoading) return;
    if (meQuery.data) {
      // User already has an active session — redirect to dashboard
      window.location.href = "/dashboard";
      return;
    }
    // No session, show login form
    setCheckingSession(false);
  }, [meQuery.isLoading, meQuery.data]);

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
      // Friendly message for rate limit errors
      if (error.message?.includes("Rate exceeded") || error.message?.includes("RATE_LIMITED")) {
        toast.error("Servidor ocupado. Aguarde alguns segundos e tente novamente.");
        return;
      }
      toast.error(error.message || "Erro no login");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  // Show loading while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          <p className="text-sm text-gray-400">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-800/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663249817763/EKvcVicuVoUxTnzjSKzgdk/OSICON_03b1c322.webp" alt="ENTUR OS" className="w-10 h-10 rounded-xl shadow-lg" />
            <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663249817763/EKvcVicuVoUxTnzjSKzgdk/OSVBRANCA_ea41014a.webp" alt="ENTUR OS" className="h-7 object-contain" />
          </div>
          <p className="text-sm text-gray-400">Sistema operacional para agências de viagens</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-xl font-semibold text-white">Entrar na sua conta</h1>
            <p className="text-sm text-gray-400 mt-1">
              Digite seu email e senha para acessar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-300">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-xs text-purple-400 hover:text-purple-300 hover:underline transition-colors"
              >
                Esqueci minha senha
              </button>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-medium shadow-lg shadow-purple-500/20 transition-all"
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
            <p className="text-sm text-gray-400">
              Não tem uma conta?{" "}
              <button
                onClick={() => navigate("/register")}
                className="text-purple-400 hover:text-purple-300 font-medium hover:underline transition-colors"
              >
                Criar conta grátis
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Ao entrar, você concorda com nossos{" "}
          <a href="#" className="underline hover:text-gray-400 transition-colors">Termos de Uso</a>{" "}
          e{" "}
          <a href="#" className="underline hover:text-gray-400 transition-colors">Política de Privacidade</a>
        </p>
      </div>
    </div>
  );
}
