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
  LayoutDashboard, LogOut, Settings, Users, Building2, Inbox, Send, Bot,
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[oklch(0.96_0.02_264)] via-background to-[oklch(0.96_0.02_180)]">
        <div className="flex flex-col items-center gap-8 p-10 max-w-md w-full glass-card rounded-2xl">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-soft-lg">
              <span className="text-2xl font-extrabold text-white tracking-tight">A</span>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight gradient-text">ASTRA CRM</h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
                Plataforma completa de CRM para agências de viagens. Gerencie contatos, negociações e viagens em um só lugar.
              </p>
            </div>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full h-12 text-[15px] font-semibold shadow-soft-lg hover:shadow-xl transition-all duration-200 rounded-xl bg-gradient-to-r from-primary to-[oklch(0.50_0.14_264)] hover:opacity-90"
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
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-border/40 shadow-[0_1px_3px_oklch(0_0_0/0.04)]">
      <div className="flex items-center h-[56px] px-5 lg:px-8 gap-1">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 mr-6 shrink-0 group">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-200">
            <span className="text-sm font-extrabold text-white">A</span>
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
                className={`relative px-3.5 py-2 text-[13px] font-medium rounded-lg transition-all duration-150 ${
                  isActive
                    ? "text-primary bg-primary/[0.06]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-primary rounded-full translate-y-[12px]" />
                )}
              </Link>
            );
          })}

          {/* Dropdown groups */}
          {moreMenuGroups.map((group) => (
            <DropdownMenu key={group.label} open={openDropdown === group.label} onOpenChange={(open) => setOpenDropdown(open ? group.label : null)}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-3.5 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-all duration-150">
                  {group.label}
                  <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${openDropdown === group.label ? "rotate-180" : ""}`} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 p-1.5 shadow-soft-lg border-border/50 rounded-xl">
                {group.items.map((item) => (
                  <DropdownMenuItem
                    key={item.path}
                    onClick={() => { setLocation(item.path); setOpenDropdown(null); }}
                    className="cursor-pointer rounded-lg px-3 py-2.5 text-[13px] font-medium gap-3"
                  >
                    <div className="h-7 w-7 rounded-md bg-muted/80 flex items-center justify-center shrink-0">
                      <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150 relative">
            <Bell className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150">
            <Calendar className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border/60 mx-2 hidden lg:block" />

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 hover:bg-muted/60 transition-all duration-150 ml-0.5">
                <Avatar className="h-8 w-8 ring-2 ring-border/40 ring-offset-1 ring-offset-background">
                  <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
                    {user?.name?.charAt(0).toUpperCase()}{user?.name?.split(" ")[1]?.charAt(0).toUpperCase() || ""}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:block text-left">
                  <p className="text-[13px] font-semibold leading-none text-foreground">{user?.name || "-"}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[140px]">{user?.email || "-"}</p>
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground hidden lg:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-1.5 shadow-soft-lg border-border/50 rounded-xl">
              <DropdownMenuItem onClick={() => setLocation("/admin")} className="cursor-pointer rounded-lg px-3 py-2.5 text-[13px] font-medium gap-3">
                <div className="h-7 w-7 rounded-md bg-muted/80 flex items-center justify-center shrink-0">
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem onClick={logout} className="cursor-pointer rounded-lg px-3 py-2.5 text-[13px] font-medium gap-3 text-destructive focus:text-destructive">
                <div className="h-7 w-7 rounded-md bg-destructive/10 flex items-center justify-center shrink-0">
                  <LogOut className="h-3.5 w-3.5" />
                </div>
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile hamburger */}
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/40 bg-white/95 backdrop-blur-xl px-5 py-4 space-y-1 max-h-[75vh] overflow-y-auto scrollbar-thin">
          {mainNavItems.map((item) => {
            const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 ${
                  isActive ? "bg-primary/[0.06] text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {moreMenuGroups.map((group) => (
            <div key={group.label} className="pt-3">
              <p className="px-3.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">{group.label}</p>
              {group.items.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl hover:bg-muted/60 transition-all duration-150 text-muted-foreground hover:text-foreground"
                >
                  <item.icon className="h-4 w-4" />
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
