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
  Home, Briefcase, Users, CheckSquare, BarChart3,
  Bell, Settings, Search, ChevronRight, LogOut, Menu, X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

/* ─── Top Nav Items ─── */
interface NavItem {
  icon: any;
  label: string;
  path: string;
  matchPaths?: string[];
}

const navItems: NavItem[] = [
  { icon: Home, label: "Início", path: "/", matchPaths: ["/"] },
  { icon: Briefcase, label: "Negociações", path: "/pipeline", matchPaths: ["/pipeline", "/deal"] },
  { icon: Users, label: "Contatos", path: "/contacts", matchPaths: ["/contacts"] },
  { icon: CheckSquare, label: "Tarefas", path: "/tasks", matchPaths: ["/tasks"] },
  { icon: BarChart3, label: "Análises", path: "/insights", matchPaths: ["/insights", "/goals"] },
];

/* ─── Search Palette ─── */
const allSearchItems = [
  { icon: Home, label: "Início", path: "/" },
  { icon: Briefcase, label: "Negociações", path: "/pipeline" },
  { icon: Users, label: "Contatos", path: "/contacts" },
  { icon: CheckSquare, label: "Tarefas", path: "/tasks" },
  { icon: BarChart3, label: "Insights", path: "/insights" },
  { icon: BarChart3, label: "Metas", path: "/goals" },
  { icon: Bell, label: "Notificações", path: "/notifications" },
  { icon: Settings, label: "Configurações", path: "/settings" },
];

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
        onClose();
      }
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = query
    ? allSearchItems.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : allSearchItems;

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div className="relative mx-auto mt-[15vh] w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="surface overflow-hidden" style={{ borderRadius: "1rem" }}>
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
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg" style={{
              background: "linear-gradient(135deg, oklch(0.50 0.22 265), oklch(0.45 0.20 290))"
            }}>
              <span className="text-2xl font-bold text-white tracking-tight">A</span>
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
            className="w-full h-11 text-[14px] font-medium rounded-xl"
            style={{ background: "linear-gradient(135deg, oklch(0.50 0.22 265), oklch(0.45 0.20 290))" }}
          >
            Entrar com Manus
          </Button>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}

/* ─── App Shell: Top Nav + Content ─── */
function AppShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <TopBar
        onSearchOpen={() => setSearchOpen(true)}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobile={() => setMobileMenuOpen(!mobileMenuOpen)}
      />
      <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

/* ─── Top Bar — Apple 2026 style ─── */
function TopBar({ onSearchOpen, mobileMenuOpen, onToggleMobile }: {
  onSearchOpen: () => void;
  mobileMenuOpen: boolean;
  onToggleMobile: () => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  return (
    <>
      <header className="shrink-0 glass z-50 sticky top-0">
        <div className="flex items-center h-[56px] px-4 lg:px-6 gap-2">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 mr-2">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{
              background: "linear-gradient(135deg, oklch(0.50 0.22 265), oklch(0.45 0.20 290))"
            }}>
              <span className="text-[12px] font-bold text-white">A</span>
            </div>
            <span className="hidden sm:block text-[15px] font-semibold text-foreground tracking-tight">ASTRA</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-0.5 ml-2">
            {navItems.map((item) => {
              const isActive = item.path === "/"
                ? location === "/"
                : (item.matchPaths || [item.path]).some((p) => location.startsWith(p));
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13.5px] font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <button
            onClick={onSearchOpen}
            className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg bg-muted/60 border border-transparent hover:border-border text-muted-foreground text-[13px] transition-all duration-150 w-full max-w-[220px]"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Buscar...</span>
            <kbd className="ml-auto text-[10px] font-medium bg-background/80 border border-border rounded px-1.5 py-0.5">⌘K</kbd>
          </button>

          {/* Right actions */}
          <div className="flex items-center gap-0.5 ml-2">
            {/* Notifications bell */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150 relative"
              onClick={() => setLocation("/notifications")}
            >
              <Bell className="h-[18px] w-[18px]" />
              {/* Notification dot */}
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full" style={{
                background: "linear-gradient(135deg, oklch(0.65 0.24 25), oklch(0.58 0.24 15))"
              }} />
            </Button>

            {/* Settings gear */}
            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-9 rounded-xl transition-all duration-150 ${
                location.startsWith("/settings")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              onClick={() => setLocation("/settings")}
            >
              <Settings className="h-[18px] w-[18px]" />
            </Button>

            <div className="w-px h-6 bg-border mx-1.5 hidden sm:block" />

            {/* User avatar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-accent transition-all duration-150">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-[12px] font-semibold text-white" style={{
                      background: "linear-gradient(135deg, oklch(0.55 0.20 265), oklch(0.50 0.18 290))"
                    }}>
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden lg:block text-[13px] font-medium text-foreground max-w-[120px] truncate">
                    {user?.name?.split(" ")[0] || "Usuário"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 p-1.5 rounded-xl">
                <div className="px-3 py-2.5 border-b border-border mb-1">
                  <p className="text-[13px] font-semibold text-foreground">{user?.name || "Usuário"}</p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{user?.email || ""}</p>
                </div>
                <DropdownMenuItem onClick={() => setLocation("/settings")} className="cursor-pointer rounded-lg px-3 py-2 text-[13px] gap-2.5">
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem onClick={logout} className="cursor-pointer rounded-lg px-3 py-2 text-[13px] gap-2.5 text-destructive focus:text-destructive">
                  <LogOut className="h-3.5 w-3.5" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
              onClick={onToggleMobile}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-[56px] z-40 bg-card/95 backdrop-blur-xl border-b border-border shadow-lg animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col p-3 gap-1">
            {navItems.map((item) => {
              const isActive = item.path === "/"
                ? location === "/"
                : (item.matchPaths || [item.path]).some((p) => location.startsWith(p));
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={onToggleMobile}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-medium transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="h-px bg-border my-1" />
            <Link
              href="/notifications"
              onClick={onToggleMobile}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <Bell className="h-5 w-5" />
              <span>Notificações</span>
            </Link>
            <Link
              href="/settings"
              onClick={onToggleMobile}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <Settings className="h-5 w-5" />
              <span>Configurações</span>
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
