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
  Loader2, User, Building2, ListTodo, Phone, Mail, Sun, Moon, MessageSquare,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Link, useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { trpc } from "@/lib/trpc";

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
  { icon: MessageSquare, label: "Inbox", path: "/inbox", matchPaths: ["/inbox"] },
  { icon: BarChart3, label: "Análises", path: "/insights", matchPaths: ["/insights", "/goals"] },
];

/* ─── Quick Nav Pages ─── */
const quickNavPages = [
  { icon: Home, label: "Início", path: "/" },
  { icon: Briefcase, label: "Negociações", path: "/pipeline" },
  { icon: Users, label: "Contatos", path: "/contacts" },
  { icon: CheckSquare, label: "Tarefas", path: "/tasks" },
  { icon: MessageSquare, label: "Inbox", path: "/inbox" },
  { icon: BarChart3, label: "Análises", path: "/insights" },
  { icon: Bell, label: "Notificações", path: "/notifications" },
  { icon: Settings, label: "Configurações", path: "/settings" },
];

const priorityColors: Record<string, string> = {
  urgent: "text-red-600",
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-emerald-500",
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [, setLocation] = useLocation();
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Debounce 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // tRPC search query
  const searchQ = trpc.search.global.useQuery(
    { tenantId: 1, query: debouncedQuery, limit: 5 },
    { enabled: open && debouncedQuery.length >= 1 }
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setDebouncedQuery("");
      setSelectedIdx(0);
    }
  }, [open]);

  // Reset selection when results change
  useEffect(() => { setSelectedIdx(0); }, [searchQ.data, debouncedQuery]);

  // Build flat list of all navigable results
  const allResults = useCallback(() => {
    const items: { type: string; label: string; sublabel: string; path: string; icon: any; iconColor: string }[] = [];

    if (!debouncedQuery) {
      // Show quick nav pages
      quickNavPages.forEach(p => items.push({
        type: "page", label: p.label, sublabel: "Página", path: p.path,
        icon: p.icon, iconColor: "text-muted-foreground",
      }));
      return items;
    }

    // Also filter pages
    const matchedPages = quickNavPages.filter(p =>
      p.label.toLowerCase().includes(debouncedQuery.toLowerCase())
    );
    matchedPages.forEach(p => items.push({
      type: "page", label: p.label, sublabel: "Página", path: p.path,
      icon: p.icon, iconColor: "text-muted-foreground",
    }));

    if (searchQ.data) {
      const { contacts, deals, tasks } = searchQ.data;
      contacts.forEach(c => items.push({
        type: "contact",
        label: c.name,
        sublabel: [c.phone, c.email].filter(Boolean).join(" · ") || c.lifecycleStage,
        path: `/contacts/${c.id}`,
        icon: c.type === "company" ? Building2 : User,
        iconColor: "text-emerald-600",
      }));
      deals.forEach(d => items.push({
        type: "deal",
        label: d.title,
        sublabel: [d.stageName, d.valueCents ? formatCurrency(d.valueCents) : null].filter(Boolean).join(" · "),
        path: `/deals/${d.id}`,
        icon: Briefcase,
        iconColor: "text-indigo-600",
      }));
      tasks.forEach(t => items.push({
        type: "task",
        label: t.title,
        sublabel: t.priority.charAt(0).toUpperCase() + t.priority.slice(1) + (t.dueAt ? " · " + new Date(t.dueAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) : ""),
        path: t.entityType === "deal" ? `/deals/${t.entityId}` : "/tasks",
        icon: ListTodo,
        iconColor: priorityColors[t.priority] || "text-muted-foreground",
      }));
    }

    return items;
  }, [debouncedQuery, searchQ.data]);

  const results = allResults();

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      e.preventDefault();
      setLocation(results[selectedIdx].path);
      onClose();
    }
  }, [results, selectedIdx, setLocation, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const hasRealResults = debouncedQuery && searchQ.data;
  const contactCount = searchQ.data?.contacts.length ?? 0;
  const dealCount = searchQ.data?.deals.length ?? 0;
  const taskCount = searchQ.data?.tasks.length ?? 0;
  const totalDbResults = contactCount + dealCount + taskCount;

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div className="relative mx-auto mt-[12vh] w-full max-w-lg px-4" onClick={(e) => e.stopPropagation()}>
        <div className="surface overflow-hidden shadow-2xl" style={{ borderRadius: "1rem" }}>
          {/* Input */}
          <div className="flex items-center gap-3 px-4 border-b border-border">
            {searchQ.isFetching ? (
              <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar contatos, negociações, tarefas..."
              className="flex-1 h-12 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[380px] overflow-y-auto scrollbar-thin">
            {/* Category badges when searching */}
            {hasRealResults && totalDbResults > 0 && (
              <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
                {contactCount > 0 && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {contactCount} contato{contactCount > 1 ? "s" : ""}
                  </span>
                )}
                {dealCount > 0 && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {dealCount} negociaç{dealCount > 1 ? "ões" : "ão"}
                  </span>
                )}
                {taskCount > 0 && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    {taskCount} tarefa{taskCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}

            <div className="p-1.5">
              {/* No results */}
              {debouncedQuery && !searchQ.isFetching && results.length === 0 && (
                <div className="py-10 text-center">
                  <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-[13px] text-muted-foreground">Nenhum resultado para "{debouncedQuery}"</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">Tente buscar por nome, título ou telefone</p>
                </div>
              )}

              {/* Quick nav header when no query */}
              {!debouncedQuery && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-2 pb-1">
                  Navegação Rápida
                </p>
              )}

              {/* Result items */}
              {results.map((item, i) => (
                <button
                  key={`${item.type}-${item.path}-${i}`}
                  onClick={() => { setLocation(item.path); onClose(); }}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors duration-75 ${
                    i === selectedIdx ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    item.type === "contact" ? "bg-emerald-50" :
                    item.type === "deal" ? "bg-indigo-50" :
                    item.type === "task" ? "bg-amber-50" :
                    "bg-muted/60"
                  }`}>
                    <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-foreground block truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-[11px] text-muted-foreground block truncate">{item.sublabel}</span>
                    )}
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Footer hint */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="bg-background border border-border rounded px-1 py-0.5 font-medium">↑↓</kbd>
                navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-background border border-border rounded px-1 py-0.5 font-medium">↵</kbd>
                abrir
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-background border border-border rounded px-1 py-0.5 font-medium">esc</kbd>
                fechar
              </span>
            </div>
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
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663249817763/XXuAsdiNIcgnwwra.png"
              alt="ENTUR OS"
              className="h-16 w-16 rounded-2xl shadow-lg"
            />
            <div className="text-center">
              <h1 className="text-xl font-semibold tracking-tight entur-gradient-text">ENTUR OS</h1>
              <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed max-w-[280px]">
                Plataforma de CRM para agências de viagens.
              </p>
            </div>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="w-full h-11 text-[14px] font-medium rounded-xl"
            style={{ background: "linear-gradient(135deg, oklch(0.55 0.25 270), oklch(0.60 0.25 320), oklch(0.65 0.20 200))" }}
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
  const themeCtx = useTheme();
  const unreadCount = trpc.notifications.unreadCount.useQuery(
    { tenantId: 1 },
    { refetchInterval: 30000 }
  );

  return (
    <>
      <header className="shrink-0 glass z-50 sticky top-0 border-b border-border">
        <div className="flex items-center h-[56px] px-4 lg:px-6 gap-2">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 mr-2">
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663249817763/XXuAsdiNIcgnwwra.png"
              alt="ENTUR OS"
              className="h-8 w-8 rounded-lg"
            />
            <span className="hidden sm:block text-[15px] font-semibold tracking-tight entur-gradient-text">ENTUR OS</span>
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
                      ? "bg-primary/15 text-primary font-semibold border-b-2 border-primary"
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
              {(unreadCount.data ?? 0) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{
                  background: "linear-gradient(135deg, oklch(0.65 0.24 25), oklch(0.58 0.24 15))"
                }}>
                  {(unreadCount.data ?? 0) > 99 ? "99+" : unreadCount.data}
                </span>
              )}
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
                      background: "linear-gradient(135deg, oklch(0.55 0.25 270), oklch(0.60 0.25 320), oklch(0.65 0.20 200))"
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
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); themeCtx.toggleTheme?.(); }} className="cursor-pointer rounded-lg px-3 py-2 text-[13px] gap-2.5">
                  {themeCtx.theme === "dark" ? <Sun className="h-3.5 w-3.5 text-amber-500" /> : <Moon className="h-3.5 w-3.5 text-indigo-500" />}
                  {themeCtx.theme === "dark" ? "Tema Claro" : "Tema Escuro"}
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
