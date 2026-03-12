import { trpc } from "@/lib/trpc";
import { Lock, ShieldAlert } from "lucide-react";

/**
 * AdminOnlyGuard — wraps a page so that:
 *  - Admins see the page normally (full editing)
 *  - Non-admins see the page content but with an overlay banner
 *    explaining they need to contact an admin to make changes.
 *    All interactive elements inside are disabled via CSS pointer-events.
 */

interface AdminOnlyGuardProps {
  children: React.ReactNode;
  /** Page title shown in the restriction banner */
  pageTitle?: string;
}

export function AdminOnlyGuard({ children, pageTitle }: AdminOnlyGuardProps) {
  const saasMe = trpc.saasAuth.me.useQuery(undefined, { retry: 1, refetchOnWindowFocus: false, refetchOnMount: false, staleTime: 5 * 60 * 1000 });
  const isAdmin = saasMe.data?.role === "admin";

  // While loading, show children normally (avoids flash)
  if (saasMe.isLoading) return <>{children}</>;

  // Admin — no restriction
  if (isAdmin) return <>{children}</>;

  // Non-admin — show banner + disable interactions
  return (
    <div className="relative">
      {/* Sticky banner at top */}
      <div className="sticky top-0 z-50 mb-4">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm">
          <div className="h-9 w-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-amber-600 dark:text-amber-400">
              Acesso somente para administradores
            </p>
            <p className="text-[12px] text-amber-600/80 dark:text-amber-400/70 mt-0.5">
              {pageTitle
                ? `A seção "${pageTitle}" pode ser visualizada, mas apenas administradores podem fazer alterações.`
                : "Esta seção pode ser visualizada, mas apenas administradores podem fazer alterações."}
              {" "}Solicite ao administrador da sua agência caso precise de alguma modificação.
            </p>
          </div>
          <ShieldAlert className="h-5 w-5 text-amber-500/50 shrink-0" />
        </div>
      </div>

      {/* Content with disabled interactions */}
      <div className="admin-only-readonly" style={{ pointerEvents: "none", opacity: 0.75, userSelect: "none" }}>
        {children}
      </div>
    </div>
  );
}

/**
 * useIsAdmin — simple hook to check if the current user is an admin.
 * Can be used inside pages for conditional rendering without the full guard.
 */
export function useIsAdmin() {
  const saasMe = trpc.saasAuth.me.useQuery(undefined, { retry: 1, refetchOnWindowFocus: false, refetchOnMount: false, staleTime: 5 * 60 * 1000 });
  return {
    isAdmin: saasMe.data?.role === "admin",
    isLoading: saasMe.isLoading,
    role: saasMe.data?.role,
  };
}
