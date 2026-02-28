import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Loader2, Eye, EyeOff, Plane, Check } from "lucide-react";
import { toast } from "sonner";

export default function SaasRegister() {
  const [, navigate] = useLocation();
  const [companyName, setCompanyName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const registerMutation = trpc.saasAuth.register.useMutation({
    onSuccess: () => {
      toast.success("Conta criada com sucesso! Bem-vindo ao Entur OS!");
      window.location.href = "/";
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar conta");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    registerMutation.mutate({ companyName, userName, email, password, phone: phone || undefined });
  };

  const benefits = [
    "12 meses de acesso gratuito",
    "CRM completo para agências de viagens",
    "Pipeline de vendas ilimitado",
    "WhatsApp integrado com IA",
    "Gestão de contatos e empresas",
    "Relatórios e análises avançadas",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-100/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-5xl relative z-10 grid md:grid-cols-2 gap-8 items-center">
        {/* Left side - Benefits */}
        <div className="hidden md:block">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
              <Plane className="w-6 h-6 text-white" />
            </div>
            <span className="text-3xl font-bold text-slate-900">Entur OS</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            O CRM que sua agência precisa
          </h2>
          <p className="text-slate-500 mb-8">
            Comece agora com 12 meses grátis. Sem cartão de crédito.
          </p>
          <div className="space-y-3">
            {benefits.map((benefit, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-green-600" />
                </div>
                <span className="text-slate-700 text-sm">{benefit}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 p-4 bg-purple-50/80 rounded-xl border border-purple-100">
            <p className="text-sm text-purple-700 font-medium">Plano Pro — R$97/mês</p>
            <p className="text-xs text-purple-500 mt-1">
              Após o período gratuito, assine o plano Pro para continuar com acesso completo.
              Plano Enterprise disponível para grandes operações.
            </p>
          </div>
        </div>

        {/* Right side - Form */}
        <Card className="border-0 shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <div className="md:hidden text-center mb-4">
              <div className="inline-flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center">
                  <Plane className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">Entur OS</span>
              </div>
            </div>
            <CardTitle className="text-xl font-semibold text-center">Criar conta grátis</CardTitle>
            <CardDescription className="text-center">
              12 meses de acesso gratuito, sem cartão de crédito
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="companyName" className="text-sm font-medium text-slate-700">Nome da agência</Label>
                <Input
                  id="companyName"
                  placeholder="Minha Agência de Viagens"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  className="h-10 bg-slate-50/50 border-slate-200 focus:border-purple-400 focus:ring-purple-400/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="userName" className="text-sm font-medium text-slate-700">Seu nome</Label>
                <Input
                  id="userName"
                  placeholder="João Silva"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                  className="h-10 bg-slate-50/50 border-slate-200 focus:border-purple-400 focus:ring-purple-400/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-10 bg-slate-50/50 border-slate-200 focus:border-purple-400 focus:ring-purple-400/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-sm font-medium text-slate-700">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-10 bg-slate-50/50 border-slate-200 focus:border-purple-400 focus:ring-purple-400/20"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-10 bg-slate-50/50 border-slate-200 focus:border-purple-400 focus:ring-purple-400/20 pr-10"
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
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-10 bg-slate-50/50 border-slate-200 focus:border-purple-400 focus:ring-purple-400/20"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium shadow-lg shadow-purple-200/50 mt-2"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Criando conta...</>
                ) : (
                  "Criar conta grátis"
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-sm text-slate-500">
                Já tem uma conta?{" "}
                <button
                  onClick={() => navigate("/login")}
                  className="text-purple-600 hover:text-purple-700 font-medium hover:underline"
                >
                  Fazer login
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
