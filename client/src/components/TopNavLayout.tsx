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
  LayoutGrid, LogOut, Settings, Users, Inbox, Send, Bot,
  FileText, BarChart3, GraduationCap, Plug, Shield, Briefcase, Plane,
  CheckSquare, Bell, Search, TrendingUp, ChevronRight, MessageSquare,
  Globe, Zap, BookOpen, Layers, Home, PanelLeft,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

/* ─── Navigation structure ─── */
interface SidebarItem {
  icon: any;
  label: string;
  path: string;
}

interface SidebarSection {
  label: string;
  items: SidebarItem[];
}

const sidebarSections: SidebarSection[] = [
  {
    label: "",
    items: [
      { icon: Home, label: "Início", path: "/" },
      { icon: Search, label: "Buscar", path: "__search__" },
    ],
  },
  {
    label: "CRM",
    items: [
      { icon: Briefcase, label: "Negociações", path: "/pipeline" },
      { icon: Users, label: "Contatos", path: "/contacts" },
      { icon: Layers, label: "Empresas", path: "/deals" },
      { icon: Plane, label: "Viagens", path: "/trips" },
      { icon: CheckSquare, label: "Tarefas", path: "/tasks" },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { icon: Inbox, label: "Inbox", path: "/inbox" },
      { icon: MessageSquare, label: "WhatsApp", path: "/whatsapp" },
      { icon: Bot, label: "Chatbot IA", path: "/chatbot" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { icon: FileText, label: "Propostas", path: "/proposals" },
      { icon: Globe, label: "Portal", path: "/portal" },
    ],
  },
  {
    label: "Análises",
    items: [
      { icon: BarChart3, label: "Insights", path: "/insights" },
      { icon: TrendingUp, label: "Metas", path: "/goals" },
      { icon: Bell, label: "Alertas", path: "/alerts" },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { icon: GraduationCap, label: "Academy", path: "/academy" },
      { icon: Plug, label: "Integrações", path: "/integrations" },
      { icon: Shield, label: "Admin", path: "/admin" },
      { icon: BookOpen, label: "API", path: "/api-docs" },
    ],
  },
];

/* ─── Search Palette ─── */
function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
        else onClose(); // toggle handled by parent
      }
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const allItems = sidebarSections.flatMap((s) => s.items).filter((i) => i.path !== "__search__");
  const filtered = query
    ? allItems.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : allItems;

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative mx-auto mt-[15vh] w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="surface overflow-hidden" style={{ borderRadius: "0.875rem" }}>
          <div className="flex items-center gap-3 px-4 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar páginas, contatos, negociações..."
              className="flex-1 h-12 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>
          <div className="max-h-[320px] overflow-y-auto scrollbar-thin p-1.5">
            {filtered.length === 0 && (
              <p className="text-center text-[13px] text-muted-foreground py-8">Nenhum resultado encontrado</p>
            )}
            {filtered.map((item) => (
              <button
                key={item.path}
                onClick={() => { setLocation(item.path); onClose(); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left text-[13px] text-foreground hover:bg-accent transition-colors duration-100"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{item.label}</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 ml-auto" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Layout ─── */
export default function TopNavLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-10 max-w-sm w-full">
          <div className="flex flex-col items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-b from-primary to-[oklch(0.45_0.19_255)] flex items-center justify-center shadow-lg">
              <span className="text-xl font-bold text-white tracking-tight">A</span>
            </div>
            <div className="text-center">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">ASTRA CRM</h1>
              <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed max-w-[280px]">
                Plataforma de CRM para agências de viagens.
              </p>
            </div>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="w-full h-11 text-[14px] font-medium rounded-lg"
          >
            Entrar com Manus
          </Button>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}

/* ─── App Shell: Sidebar + Topbar + Content ─── */
function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} onSearchOpen={() => setSearchOpen(true)} />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar onSearchOpen={() => setSearchOpen(true)} onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} sidebarCollapsed={sidebarCollapsed} />
        <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>
      </div>

      {/* Search palette */}
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

/* ─── Sidebar — Finder-style ─── */
function Sidebar({ collapsed, onToggle, onSearchOpen }: { collapsed: boolean; onToggle: () => void; onSearchOpen: () => void }) {
  const [location] = useLocation();

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-border bg-sidebar shrink-0 transition-all duration-200 ease-in-out ${
        collapsed ? "w-[52px]" : "w-[220px]"
      }`}
    >
      {/* Logo area */}
      <div className={`flex items-center h-[52px] shrink-0 border-b border-sidebar-border ${collapsed ? "justify-center px-0" : "px-4 gap-3"}`}>
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-b from-primary to-[oklch(0.45_0.19_255)] flex items-center justify-center">
              <span className="text-[11px] font-bold text-white">A</span>
            </div>
            <span className="text-[13px] font-semibold text-foreground tracking-tight">ASTRA</span>
          </Link>
        )}
        {collapsed && (
          <div className="h-7 w-7 rounded-lg bg-gradient-to-b from-primary to-[oklch(0.45_0.19_255)] flex items-center justify-center">
            <span className="text-[11px] font-bold text-white">A</span>
          </div>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto scrollbar-none py-2">
        {sidebarSections.map((section, si) => (
          <div key={si} className={si > 0 ? "mt-4" : ""}>
            {section.label && !collapsed && (
              <p className="section-label mb-1">{section.label}</p>
            )}
            {collapsed && si > 0 && <div className="mx-2.5 my-2 h-px bg-sidebar-border" />}
            <div className="space-y-0.5 px-2">
              {section.items.map((item) => {
                if (item.path === "__search__") {
                  return (
                    <button
                      key="search"
                      onClick={onSearchOpen}
                      className={`flex items-center w-full rounded-md transition-colors duration-100 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                        collapsed ? "justify-center h-8 w-8 mx-auto" : "gap-2.5 px-2.5 h-8"
                      }`}
                      title={collapsed ? "Buscar (⌘K)" : undefined}
                    >
                      <item.icon className="h-[15px] w-[15px] shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="text-[13px] font-normal flex-1">{item.label}</span>
                          <kbd className="text-[10px] text-muted-foreground/60 font-medium">⌘K</kbd>
                        </>
                      )}
                    </button>
                  );
                }

                const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`flex items-center rounded-md transition-colors duration-100 ${
                      collapsed ? "justify-center h-8 w-8 mx-auto" : "gap-2.5 px-2.5 h-8"
                    } ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className={`h-[15px] w-[15px] shrink-0 ${isActive ? "text-sidebar-primary" : ""}`} />
                    {!collapsed && <span className="text-[13px]">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="shrink-0 border-t border-sidebar-border p-2">
        <button
          onClick={onToggle}
          className={`flex items-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-100 ${
            collapsed ? "justify-center h-8 w-8 mx-auto" : "gap-2.5 px-2.5 h-8 w-full"
          }`}
          title={collapsed ? "Expandir" : "Recolher"}
        >
          <PanelLeft className={`h-[15px] w-[15px] shrink-0 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} />
          {!collapsed && <span className="text-[13px]">Recolher</span>}
        </button>
      </div>
    </aside>
  );
}

/* ─── Topbar — minimal ─── */
function Topbar({ onSearchOpen, onToggleSidebar, sidebarCollapsed }: { onSearchOpen: () => void; onToggleSidebar: () => void; sidebarCollapsed: boolean }) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <header className="flex items-center h-[52px] shrink-0 border-b border-border bg-card/60 glass px-4 gap-3">
      {/* Mobile sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
        onClick={onToggleSidebar}
      >
        <PanelLeft className="h-4 w-4" />
      </Button>

      {/* Search bar — central */}
      <button
        onClick={onSearchOpen}
        className="hidden sm:flex items-center gap-2.5 h-8 px-3 rounded-lg bg-muted/60 border border-transparent hover:border-border text-muted-foreground text-[13px] transition-all duration-150 w-full max-w-[320px]"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Buscar...</span>
        <kbd className="ml-auto text-[10px] font-medium bg-background/80 border border-border rounded px-1.5 py-0.5">⌘K</kbd>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-100 relative"
          onClick={() => setLocation("/alerts")}
        >
          <Bell className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-100"
          onClick={() => setLocation("/admin")}
        >
          <Settings className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-border mx-1.5" />

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-accent transition-colors duration-100">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[11px] font-medium bg-muted text-muted-foreground">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden lg:block text-[13px] font-medium text-foreground max-w-[120px] truncate">
                {user?.name?.split(" ")[0] || "Usuário"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 p-1 rounded-lg">
            <div className="px-3 py-2 border-b border-border mb-1">
              <p className="text-[13px] font-medium text-foreground">{user?.name || "Usuário"}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email || ""}</p>
            </div>
            <DropdownMenuItem onClick={() => setLocation("/admin")} className="cursor-pointer rounded-md px-3 py-2 text-[13px] gap-2.5">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onClick={logout} className="cursor-pointer rounded-md px-3 py-2 text-[13px] gap-2.5 text-destructive focus:text-destructive">
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
