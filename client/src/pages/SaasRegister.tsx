import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Eye, EyeOff, Check } from "lucide-react";
import { toast } from "sonner";
import { StaticLogo } from "@/components/ThemedLogo";

export default function SaasRegister() {
  const [, navigate] = useLocation();
  const [companyName, setCompanyName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [segment, setSegment] = useState("");

  const registerMutation = trpc.saasAuth.register.useMutation({
    onSuccess: () => {
      toast.success("Conta criada com sucesso! Bem-vindo ao Clinilucro!");
      window.location.href = "/dashboard";
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
    registerMutation.mutate({ companyName, userName, email, password, phone: phone || undefined, segment: segment || undefined });
  };

  const benefits = [
    "7 dias grátis para testar tudo",
    "CRM completo para clínicas",
    "Pipeline de vendas ilimitado",
    "WhatsApp integrado com IA",
    "Gestão de pacientes e fichas de anamnese",
    "Relatórios e análises avançadas",
  ];

  return (
    <div className="min-h-screen bg-[#06140F] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-lime-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-5xl relative z-10 grid md:grid-cols-2 gap-8 items-center">
        {/* Left side - Benefits */}
        <div className="hidden md:block">
          <div className="inline-flex items-center gap-2 mb-6">
            <StaticLogo className="h-10" variant="dark" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            O sistema que sua clínica precisa
          </h2>
          <p className="text-white/50 mb-8">
            Comece agora com 7 dias grátis. Sem cartão de crédito.
          </p>
          <div className="space-y-3">
            {benefits.map((benefit, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-white/70 text-sm">{benefit}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 p-4 bg-white/[0.04] rounded-xl border border-white/10">
            <p className="text-sm text-white/80 font-medium">Planos a partir de R$97/mês</p>
            <p className="text-xs text-white/50 mt-1">
              Após os 7 dias de teste, assine via Hotmart para continuar com acesso completo.
              Escolha entre Essencial, Pro ou Elite.
            </p>
          </div>
        </div>

        {/* Right side - Form */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          <div className="md:hidden text-center mb-4">
            <div className="inline-flex items-center gap-2">
              <StaticLogo className="h-7" variant="dark" />
            </div>
          </div>
          <div className="text-center mb-6">
            <h1 className="text-xl font-semibold text-white">Criar conta grátis</h1>
            <p className="text-sm text-white/50 mt-1">
              7 dias de acesso completo, sem cartão de crédito
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="companyName" className="text-sm font-medium text-white/70">Nome da clínica</Label>
              <Input
                id="companyName"
                placeholder="Minha Clínica"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="h-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:ring-emerald-500/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-white/70">Segmento da clínica</Label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger className="h-10 bg-white/5 border-white/10 text-white focus:border-emerald-500 focus:ring-emerald-500/20">
                  <SelectValue placeholder="Selecione seu segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="estetica">Estética / Beleza</SelectItem>
                  <SelectItem value="odontologia">Odontologia</SelectItem>
                  <SelectItem value="salao">Salão de Beleza</SelectItem>
                  <SelectItem value="clinica">Clínica / Saúde</SelectItem>
                  <SelectItem value="advocacia">Advocacia / Jurídico</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="userName" className="text-sm font-medium text-white/70">Seu nome</Label>
              <Input
                id="userName"
                placeholder="João Silva"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
                className="h-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:ring-emerald-500/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-white/70">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-sm font-medium text-white/70">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-white/70">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:ring-emerald-500/20 pr-10"
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
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-white/70">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:ring-emerald-500/20"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-emerald-600 to-lime-500 hover:from-emerald-500 hover:to-lime-400 text-white font-medium shadow-lg shadow-emerald-500/20 mt-2 transition-all"
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
            <p className="text-sm text-white/50">
              Já tem uma conta?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-white/70 hover:text-white font-medium hover:underline transition-colors"
              >
                Fazer login
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
