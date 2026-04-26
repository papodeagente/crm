import { trpc } from "@/lib/trpc";

/**
 * Hook to get the current user's tenantId.
 * For SaaS users (email/password login), returns the tenantId from the session.
 * Falls back to 1 for Manus OAuth users (owner).
 */
export function useTenantId(): number {
  const { data: user } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // Match useAuth — prevents stale observer divergence
    gcTime: 30 * 60 * 1000,
  });
  // SaaS users have tenantId injected by the auth.me procedure
  // Use || to also handle tenantId=0 (invalid), preventing queries with enabled:tenantId>0 from staying disabled
  return (user as any)?.tenantId || 1;
}
