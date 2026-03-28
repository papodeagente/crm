import { useLocation } from "wouter";
import {
  LayoutDashboard, Building2, BarChart3, Activity, TrendingUp,
  Lightbulb, ArrowLeft, Shield
} from "lucide-react";

const navItems = [
  { path: "/super-admin/dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { path: "/super-admin/tenants", label: "Gestão de Tenants", icon: Building2 },
  { path: "/super-admin/adoption", label: "Adoção de Produto", icon: BarChart3 },
  { path: "/super-admin/health", label: "Saúde Operacional", icon: Activity },
  { path: "/super-admin/commercial", label: "Comercial e Expansão", icon: TrendingUp },
  { path: "/super-admin/strategic-help", label: "Central de Ajuda", icon: Lightbulb },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-card/50 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-bold text-foreground">Super Admin</span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const isActive = location === item.path || (item.path === "/super-admin/tenants" && location.startsWith("/super-admin/tenant/"));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer links */}
        <div className="px-2 py-2 border-t border-border/50 space-y-0.5">
          <button
            onClick={() => navigate("/super-admin")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          >
            <Building2 className="w-4 h-4 shrink-0" />
            Admin Legado
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            Voltar ao CRM
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
