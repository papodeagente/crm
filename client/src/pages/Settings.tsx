import { useLocation } from "wouter";
import {
  Settings, Inbox, MessageSquare, Bot, Headphones,
  FileText, Globe, Plane,
  GraduationCap, Plug, Shield, BookOpen,
  ChevronRight, Users, Tag, GitBranch,
  Megaphone, Target, XCircle, Package,
  Sparkles, UserPlus, Layers, Database, CalendarClock, Zap,
  Lock, Crown, ShieldAlert, Cake,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/* ─── Suggestion Cards (top banners) ─── */
interface SuggestionCard {
  title: string;
  description: string;
  buttonLabel: string;
  path: string;
  gradient: string;
  icon: any;
}

const suggestionCards: SuggestionCard[] = [
  {
    title: "Convide sua equipe para usar o CRM",
    description: "Adicione agentes e defina permissões",
    buttonLabel: "Convidar usuários",
    path: "/settings/agents",
    gradient: "from-blue-500/20 to-cyan-500/20",
    icon: UserPlus,
  },
  {
    title: "Crie campos personalizados de acordo com seu processo",
    description: "Adapte o CRM ao seu negócio",
    buttonLabel: "Criar campos personalizados",
    path: "/settings/custom-fields",
    gradient: "from-violet-500/20 to-purple-500/20",
    icon: Layers,
  },
  {
    title: "Configure fontes e campanhas para rastrear leads",
    description: "Saiba de onde vêm seus clientes",
    buttonLabel: "Configurar fontes",
    path: "/settings/sources",
    gradient: "from-amber-500/20 to-orange-500/20",
    icon: Sparkles,
  },
];

/* ─── Category columns (RD Station style) ─── */
interface SettingsLink {
  icon: any;
  label: string;
  path: string;
  badge?: string;
  adminOnly?: boolean;
  comingSoon?: boolean;
  requiredFeature?: string;
}

interface SettingsCategory {
  title: string;
  links: SettingsLink[];
}

const settingsCategories: SettingsCategory[] = [
  {
    title: "SEU TIME",
    links: [
      { icon: Users, label: "Agentes & Equipes", path: "/settings/agents" },
      { icon: Shield, label: "Administração", path: "/admin", badge: "Perfis & Auditoria" },
    ],
  },
  {
    title: "CONFIGURE SEU PROCESSO DE VENDA",
    links: [
      { icon: GitBranch, label: "Funis de vendas", path: "/settings/pipelines" },
      { icon: Tag, label: "Campos personalizados", path: "/settings/custom-fields" },
      { icon: Zap, label: "Central de Automações", path: "/settings/automation-hub", badge: "Novo", requiredFeature: "salesAutomation" },
      { icon: Target, label: "Classificação estratégica", path: "/settings/classification", requiredFeature: "rfvEnabled" },
    ],
  },
  {
    title: "COMUNICAÇÃO",
    links: [
      { icon: Inbox, label: "Inbox", path: "/inbox" },
      { icon: Headphones, label: "Supervisão", path: "/supervision", adminOnly: true },
      { icon: MessageSquare, label: "WhatsApp", path: "/whatsapp" },
      { icon: Bot, label: "Chatbot IA", path: "/chatbot", adminOnly: true },
      { icon: Cake, label: "Datas Comemorativas", path: "/birthdays" },
    ],
  },
  {
    title: "AVANÇADO",
    links: [
      { icon: Plug, label: "Integrações", path: "/integrations", adminOnly: true },
      { icon: Database, label: "Importar do RD Station CRM", path: "/settings/import-rd-crm", badge: "Novo", adminOnly: true },
      { icon: Megaphone, label: "RD Station Marketing", path: "/settings/rdstation", adminOnly: true },
      { icon: BookOpen, label: "Documentação API", path: "/api-docs", adminOnly: true },
    ],
  },
  {
    title: "AJUSTES DE SUA CONTA",
    links: [
      { icon: Megaphone, label: "Fontes e campanhas", path: "/settings/sources" },
      { icon: Package, label: "Produtos e serviços", path: "/settings/products" },
      { icon: XCircle, label: "Motivos de perda", path: "/settings/loss-reasons" },
      { icon: Target, label: "Metas", path: "/goals", adminOnly: true },
    ],
  },
  {
    title: "MÓDULOS",
    links: [
      { icon: Plane, label: "Viagens", path: "/trips", comingSoon: true },
      { icon: FileText, label: "Propostas", path: "/proposals", comingSoon: true },
      { icon: Globe, label: "Portal do Cliente", path: "/portal", comingSoon: true },
      { icon: GraduationCap, label: "Academy", path: "/academy", comingSoon: true },
    ],
  },
];

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const saasMe = trpc.saasAuth.me.useQuery(undefined, { retry: 1, refetchOnWindowFocus: false, refetchOnMount: false, staleTime: 5 * 60 * 1000 });
  const planSummary = trpc.plan.summary.useQuery(undefined, { retry: 1, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });
  const isAdmin = saasMe.data?.role === "admin";
  const planFeatures = planSummary.data?.features;

  const handleLinkClick = (link: SettingsLink) => {
    if (link.comingSoon) {
      toast.info(`${link.label} estará disponível em breve!`);
      return;
    }
    if (link.adminOnly && !isAdmin) {
      toast.error("Acesso restrito a administradores.");
      return;
    }
    if (link.requiredFeature && planFeatures && !(planFeatures as any)[link.requiredFeature]) {
      toast.error(`Recurso disponível a partir do plano Pro. Faça upgrade para acessar.`);
      return;
    }
    setLocation(link.path);
  };

  return (
    <div className="page-content max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{
            background: "linear-gradient(135deg, oklch(0.55 0.25 270), oklch(0.60 0.25 320), oklch(0.65 0.20 200))"
          }}>
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configurações</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Gerencie todas as configurações do sistema</p>
          </div>
        </div>
      </div>

      {/* Suggestion Cards */}
      <div className="mb-10">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Sugestões para você</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {suggestionCards.map((card) => (
            <div
              key={card.path}
              className={`surface relative overflow-hidden rounded-xl p-5 bg-gradient-to-br ${card.gradient} border border-border/50`}
            >
              <div className="relative z-10">
                <p className="text-[13px] font-medium text-foreground leading-snug mb-1">{card.title}</p>
                <p className="text-[11px] text-muted-foreground mb-4">{card.description}</p>
                <button
                  onClick={() => setLocation(card.path)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-[12px] font-medium hover:opacity-90 transition-opacity"
                >
                  {card.buttonLabel}
                </button>
              </div>
              <div className="absolute top-3 right-3 opacity-20">
                <card.icon className="h-12 w-12 text-foreground" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Grid (3 columns like RD Station) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-8">
        {settingsCategories.map((category) => {
          // For non-admin: hide entire "AVANÇADO" category
          const visibleLinks = category.links.filter((link) => {
            // "Em breve" items always show
            if (link.comingSoon) return true;
            // Admin-only items: hide for non-admin users
            if (link.adminOnly && !isAdmin) return false;
            return true;
          });
          if (visibleLinks.length === 0) return null;
          return (
            <div key={category.title}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {category.title}
              </p>
              <div className="space-y-0.5">
                {visibleLinks.map((link) => (
                  <button
                    key={link.path + link.label}
                    onClick={() => handleLinkClick(link)}
                    className={`w-full flex items-center gap-2.5 py-2 px-1 -mx-1 rounded-lg text-left group transition-colors ${
                      link.comingSoon
                        ? "opacity-60 cursor-default hover:bg-transparent"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <span className={`text-[14px] transition-colors ${
                      link.comingSoon
                        ? "text-muted-foreground"
                        : "text-foreground group-hover:text-primary"
                    }`}>
                      {link.label}
                    </span>
                    {link.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary uppercase">
                        {link.badge}
                      </span>
                    )}
                    {link.comingSoon && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                        Em breve
                      </span>
                    )}
                    {link.adminOnly && isAdmin && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 uppercase">
                        <Lock className="h-2.5 w-2.5" /> Admin
                      </span>
                    )}
                    {link.requiredFeature && planFeatures && !(planFeatures as any)[link.requiredFeature] && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 uppercase">
                        <Crown className="h-2.5 w-2.5" /> Growth
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
