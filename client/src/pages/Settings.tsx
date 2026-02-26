import { useState } from "react";
import { useLocation } from "wouter";
import {
  Settings, Inbox, MessageSquare, Bot,
  FileText, Globe, Plane,
  GraduationCap, Plug, Shield, BookOpen,
  ChevronRight, ArrowLeft,
} from "lucide-react";

/* ─── Settings Menu Structure ─── */
interface SettingsItem {
  icon: any;
  label: string;
  description: string;
  path: string;
  color: string;
  bgColor: string;
}

interface SettingsSection {
  title: string;
  description: string;
  items: SettingsItem[];
}

const settingsSections: SettingsSection[] = [
  {
    title: "Comunicação",
    description: "Gerencie seus canais de comunicação com clientes",
    items: [
      {
        icon: Inbox,
        label: "Inbox",
        description: "Caixa de entrada unificada de mensagens",
        path: "/inbox",
        color: "text-blue-600",
        bgColor: "bg-blue-50",
      },
      {
        icon: MessageSquare,
        label: "WhatsApp",
        description: "Conexão e gerenciamento de sessões WhatsApp",
        path: "/whatsapp",
        color: "text-emerald-600",
        bgColor: "bg-emerald-50",
      },
      {
        icon: Bot,
        label: "Chatbot IA",
        description: "Configurações do assistente inteligente",
        path: "/chatbot",
        color: "text-violet-600",
        bgColor: "bg-violet-50",
      },
    ],
  },
  {
    title: "Comercial",
    description: "Ferramentas para gestão comercial e vendas",
    items: [
      {
        icon: FileText,
        label: "Propostas",
        description: "Modelos e propostas comerciais",
        path: "/proposals",
        color: "text-amber-600",
        bgColor: "bg-amber-50",
      },
      {
        icon: Globe,
        label: "Portal do Cliente",
        description: "Portal de acesso para seus clientes",
        path: "/portal",
        color: "text-cyan-600",
        bgColor: "bg-cyan-50",
      },
      {
        icon: Plane,
        label: "Viagens",
        description: "Gestão de pacotes e roteiros de viagem",
        path: "/trips",
        color: "text-sky-600",
        bgColor: "bg-sky-50",
      },
    ],
  },
  {
    title: "Plataforma",
    description: "Administração e configurações do sistema",
    items: [
      {
        icon: GraduationCap,
        label: "Academy",
        description: "Central de aprendizado e tutoriais",
        path: "/academy",
        color: "text-indigo-600",
        bgColor: "bg-indigo-50",
      },
      {
        icon: Plug,
        label: "Integrações",
        description: "Conecte ferramentas e serviços externos",
        path: "/integrations",
        color: "text-orange-600",
        bgColor: "bg-orange-50",
      },
      {
        icon: Shield,
        label: "Administração",
        description: "Usuários, permissões e segurança",
        path: "/admin",
        color: "text-rose-600",
        bgColor: "bg-rose-50",
      },
      {
        icon: BookOpen,
        label: "Documentação API",
        description: "Referência técnica e endpoints",
        path: "/api-docs",
        color: "text-slate-600",
        bgColor: "bg-slate-50",
      },
    ],
  },
];

export default function SettingsPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="page-content max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{
            background: "linear-gradient(135deg, oklch(0.50 0.22 265), oklch(0.45 0.20 290))"
          }}>
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configurações</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Gerencie todas as configurações do sistema</p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {settingsSections.map((section) => (
          <div key={section.title}>
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold text-foreground">{section.title}</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">{section.description}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {section.items.map((item) => (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className="surface flex items-center gap-4 p-4 text-left group hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                >
                  <div className={`h-11 w-11 rounded-xl ${item.bgColor} flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105`}>
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-foreground">{item.label}</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{item.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
