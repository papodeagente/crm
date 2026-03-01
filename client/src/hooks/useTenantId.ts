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
  });
  // SaaS users have tenantId injected by the auth.me procedure
  return (user as any)?.tenantId ?? 1;
}
