import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemedLogo } from "@/components/ThemedLogo";
import { trpc } from "@/lib/trpc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, LogOut, PanelLeft, MessageSquare, Send, Bot, Settings,
  Users, Building2, Target, Inbox, FileText, Globe, BarChart3, GraduationCap,
  Plug, Activity, Shield, Briefcase, Plane, ClipboardList, Bell, Crown, Sparkles, Trash2,
  CalendarDays, Gift, RefreshCw,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { useIsAdmin } from "./AdminOnlyGuard";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

interface MenuSection {
  label: string;
  items: { icon: any; label: string; path: string; adminOnly?: boolean }[];
}

const menuSections: MenuSection[] = [
  {
    label: "Visão Geral",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: Bell, label: "Alertas", path: "/alerts" },
    ],
  },
  {
    label: "CRM",
    items: [
      { icon: Briefcase, label: "Negócios", path: "/deals" },
      { icon: Inbox, label: "Inbox", path: "/inbox" },
      { icon: Users, label: "Clientes", path: "/contacts" },
      { icon: Target, label: "Funil", path: "/pipeline" },
      { icon: CalendarDays, label: "Agenda", path: "/agenda" },
      { icon: ClipboardList, label: "Servicos", path: "/services" },
      { icon: Gift, label: "Indicações", path: "/referrals" },
      { icon: RefreshCw, label: "Recorrência", path: "/recurrence" },
      { icon: ClipboardList, label: "Tarefas", path: "/tasks" },
      { icon: Trash2, label: "Lixeira", path: "/trash" },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { icon: Send, label: "WhatsApp", path: "/whatsapp" },
      { icon: Bot, label: "Chatbot IA", path: "/chatbot" },
      { icon: Users, label: "Supervisão", path: "/supervision", adminOnly: true },
    ],
  },
  {
    label: "Comercial",
    items: [
      { icon: FileText, label: "Propostas", path: "/proposals" },
      { icon: Globe, label: "Portal Cliente", path: "/portal" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { icon: BarChart3, label: "Insights", path: "/insights" },
      { icon: Activity, label: "Metas", path: "/goals" },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { icon: GraduationCap, label: "Academy", path: "/academy" },
      { icon: Plug, label: "Integrações", path: "/integrations" },
      { icon: Shield, label: "Admin", path: "/admin" },
      { icon: Settings, label: "API Docs", path: "/api-docs" },
    ],
  },
];

const allMenuItems = menuSections.flatMap((s) => s.items);

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-3">
            <ThemedLogo className="h-10 object-contain" />
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Plataforma completa de CRM para clínicas. Faca login para acessar o painel.
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
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = allMenuItems.find((item) => item.path === location);
  const isMobile = useIsMobile();
  const { isAdmin } = useIsAdmin();

  // Plan & billing info for dropdown
  const planSummary = trpc.plan.summary.useQuery(undefined, {
    retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000,
  });
  const billingQuery = trpc.billing.myBilling.useQuery(undefined, {
    retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const billingData = billingQuery.data;
  const currentPlan = planSummary.data?.planName || (billingData?.plan === "growth" ? "Pro" : billingData?.plan === "scale" ? "Elite" : "Essencial");
  const isTrial = billingData?.billingStatus === "trialing";
  const trialDaysLeft = isTrial && billingData?.subscription?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(billingData.subscription.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0 ml-5">
                  <ThemedLogo className="h-4 object-contain" />
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 overflow-y-auto scrollbar-thin">
            {menuSections.map((section, idx) => (
              <div key={section.label}>
                {idx > 0 && <Separator className="my-1 bg-sidebar-border" />}
                {!isCollapsed && (
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground">
                    {section.label}
                  </p>
                )}
                <SidebarMenu className="px-2 py-0.5">
                  {section.items.filter(item => !item.adminOnly || isAdmin).map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className="h-9 transition-all font-normal text-[13px]"
                        >
                          <item.icon className={`h-4 w-4 ${isActive ? "text-sidebar-primary" : ""}`} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-sidebar-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none">
                  <Avatar className="h-9 w-9 border border-sidebar-border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-sidebar-primary text-sidebar-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-sidebar-foreground">
                      {user?.name || "-"}
                    </p>
                    <p className="text-[11px] text-sidebar-muted-foreground truncate mt-1">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2.5 border-b border-border mb-1">
                  <p className="text-[13px] font-semibold text-foreground">{user?.name || "Usu\u00e1rio"}</p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{user?.email || ""}</p>
                  {/* Plan badge */}
                  <div className="flex items-center gap-1.5 mt-2">
                    {isTrial ? (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                        <Sparkles className="h-3 w-3 text-amber-400" />
                        <span className="text-[10px] font-semibold text-amber-400">Trial</span>
                        {trialDaysLeft !== null && (
                          <span className="text-[10px] font-medium text-amber-300/80">
                            {trialDaysLeft <= 0 ? "(expira hoje)" : trialDaysLeft === 1 ? "(1 dia restante)" : `(${trialDaysLeft} dias restantes)`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                        currentPlan === "Elite" ? "bg-amber-500/15 border-amber-500/30" :
                        currentPlan === "Pro" ? "bg-violet-500/15 border-violet-500/30" :
                        "bg-purple-500/15 border-purple-500/30"
                      }`}>
                        <Crown className={`h-3 w-3 ${
                          currentPlan === "Elite" ? "text-amber-400" :
                          currentPlan === "Pro" ? "text-violet-400" :
                          "text-purple-400"
                        }`} />
                        <span className={`text-[10px] font-semibold ${
                          currentPlan === "Elite" ? "text-amber-400" :
                          currentPlan === "Pro" ? "text-violet-400" :
                          "text-purple-400"
                        }`}>Plano {currentPlan}</span>
                      </div>
                    )}
                  </div>
                </div>
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
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-sidebar-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="tracking-tight text-foreground font-medium">
                {activeMenuItem?.label ?? "Menu"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
