import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard, Building2, BarChart3, Activity, TrendingUp,
  Lightbulb, ArrowLeft, Shield, DollarSign, Phone, Users,
  Menu, X, ChevronDown, ChevronRight, Package
} from "lucide-react";

type NavItem = {
  path: string;
  label: string;
  icon: any;
  matchPaths?: string[];
};

type NavGroup = {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
};

const navGroups: NavGroup[] = [
  {
    title: "Painel Executivo",
    defaultOpen: true,
    items: [
      { path: "/super-admin/dashboard", label: "Visão Geral", icon: LayoutDashboard },
      { path: "/super-admin/tenants", label: "Tenants", icon: Building2, matchPaths: ["/super-admin/tenant/"] },
      { path: "/super-admin/adoption", label: "Adoção de Produto", icon: BarChart3 },
      { path: "/super-admin/health", label: "Saúde Operacional", icon: Activity },
      { path: "/super-admin/commercial", label: "Comercial e Expansão", icon: TrendingUp },
      { path: "/super-admin/strategic-help", label: "Central de Ajuda", icon: Lightbulb },
    ],
  },
  {
    title: "Operações",
    defaultOpen: true,
    items: [
      { path: "/super-admin/billing", label: "Financeiro / MRR", icon: DollarSign },
      { path: "/super-admin/plans", label: "Gestão de Planos", icon: Package },
      { path: "/super-admin/zapi", label: "Gestão Z-API", icon: Phone },
      { path: "/super-admin", label: "Gestão de Tenants", icon: Users },
    ],
  },
];

function NavGroupSection({
  group,
  location,
  navigate,
  collapsed,
  onToggle,
  onNavClick,
}: {
  group: NavGroup;
  location: string;
  navigate: (path: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  onNavClick: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
      >
        {group.title}
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>
      {!collapsed && (
        <div className="space-y-0.5 mt-0.5">
          {group.items.map((item) => {
            const isActive =
              location === item.path ||
              (item.matchPaths?.some((p) => location.startsWith(p)) ?? false);
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  onNavClick();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <item.icon
                  className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : ""}`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [groupState, setGroupState] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      state[g.title] = !(g.defaultOpen ?? true);
    });
    return state;
  });

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const toggleGroup = (title: string) => {
    setGroupState((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-bold text-foreground">Super Admin</span>
        </div>
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 rounded-md hover:bg-accent/50 text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 py-3 px-2 space-y-3 overflow-y-auto">
        {navGroups.map((group) => (
          <NavGroupSection
            key={group.title}
            group={group}
            location={location}
            navigate={navigate}
            collapsed={groupState[group.title] ?? false}
            onToggle={() => toggleGroup(group.title)}
            onNavClick={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-border/50">
        <button
          onClick={() => {
            navigate("/dashboard");
            setMobileOpen(false);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          Voltar ao CRM
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Mobile header bar */}
      <div className="lg:hidden fixed top-[56px] left-0 right-0 z-30 bg-background/95 backdrop-blur border-b border-border px-3 py-2 flex items-center gap-2">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md hover:bg-accent/50 text-muted-foreground"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Shield className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-semibold text-foreground">Super Admin</span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop: static, mobile: slide-in drawer */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-60 shrink-0 border-r border-border bg-card/95 backdrop-blur-sm
          flex flex-col
          transition-transform duration-200 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pt-12 lg:pt-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
