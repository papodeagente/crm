import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
  LayoutDashboard, LogOut, Settings, Users, Building2, Target, Inbox, Send, Bot,
  FileText, Globe, BarChart3, GraduationCap, Plug, Shield, Briefcase, Plane,
  ClipboardList, Bell, ChevronDown, Search, Calendar, TrendingUp, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

interface NavItem {
  icon: any;
  label: string;
  path: string;
}

interface NavGroup {
  label: string;
  icon: any;
  items: NavItem[];
}

const mainNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Início", path: "/" },
  { icon: Briefcase, label: "Negociações", path: "/pipeline" },
  { icon: Building2, label: "Empresas", path: "/deals" },
  { icon: Users, label: "Contatos", path: "/contacts" },
  { icon: ClipboardList, label: "Tarefas", path: "/tasks" },
];

const moreMenuGroups: NavGroup[] = [
  {
    label: "Comunicação",
    icon: Inbox,
    items: [
      { icon: Inbox, label: "Inbox", path: "/inbox" },
      { icon: Send, label: "WhatsApp", path: "/whatsapp" },
      { icon: Bot, label: "Chatbot IA", path: "/chatbot" },
    ],
  },
  {
    label: "Comercial",
    icon: FileText,
    items: [
      { icon: Plane, label: "Viagens", path: "/trips" },
      { icon: FileText, label: "Propostas", path: "/proposals" },
      { icon: Globe, label: "Portal Cliente", path: "/portal" },
    ],
  },
  {
    label: "Análises",
    icon: BarChart3,
    items: [
      { icon: BarChart3, label: "Insights", path: "/insights" },
      { icon: TrendingUp, label: "Metas", path: "/goals" },
      { icon: Bell, label: "Alertas", path: "/alerts" },
    ],
  },
  {
    label: "Plataforma",
    icon: Settings,
    items: [
      { icon: GraduationCap, label: "Academy", path: "/academy" },
      { icon: Plug, label: "Integrações", path: "/integrations" },
      { icon: Shield, label: "Admin", path: "/admin" },
      { icon: Settings, label: "API Docs", path: "/api-docs" },
    ],
  },
];

export default function TopNavLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-foreground">A</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-center">ASTRA CRM</h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Plataforma completa de CRM para agências de viagens. Faça login para acessar o painel.
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Entrar com Manus
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}

function TopNav() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border/60 shadow-sm">
      <div className="flex items-center h-14 px-4 gap-1">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mr-4 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-[#0A1628] flex items-center justify-center">
            <span className="text-sm font-bold text-white">A</span>
          </div>
          <span className="font-bold text-[15px] tracking-tight text-foreground hidden sm:inline">CRM</span>
        </Link>

        {/* Main nav items (desktop) */}
        <nav className="hidden md:flex items-center gap-0.5">
          {mainNavItems.map((item) => {
            const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`relative px-3 py-2 text-[13px] font-medium rounded-md transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full translate-y-[9px]" />
                )}
              </Link>
            );
          })}

          {/* More dropdown groups */}
          {moreMenuGroups.map((group) => (
            <DropdownMenu key={group.label} open={openDropdown === group.label} onOpenChange={(open) => setOpenDropdown(open ? group.label : null)}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors">
                  {group.label}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {group.items.map((item) => (
                  <DropdownMenuItem key={item.path} onClick={() => { setLocation(item.path); setOpenDropdown(null); }} className="cursor-pointer">
                    <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Bell className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Calendar className="h-4 w-4" />
          </Button>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted/50 transition-colors ml-1">
                <Avatar className="h-8 w-8 border">
                  <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                    {user?.name?.charAt(0).toUpperCase()}{user?.name?.split(" ")[1]?.charAt(0).toUpperCase() || ""}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-medium leading-none">{user?.name || "-"}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[120px]">{user?.email || "-"}</p>
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground hidden lg:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setLocation("/admin")} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile hamburger */}
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-white px-4 py-3 space-y-1 max-h-[70vh] overflow-y-auto">
          {mainNavItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted/50 transition-colors"
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              {item.label}
            </Link>
          ))}
          {moreMenuGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{group.label}</p>
              {group.items.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted/50 transition-colors"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
