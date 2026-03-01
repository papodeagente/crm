import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { verifySaasSession, SAAS_COOKIE } from "../saasAuth";
import { parse as parseCookieHeader } from "cookie";

export type SaasUser = {
  userId: number;
  tenantId: number;
  email: string;
  name: string;
  role: string;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  saasUser: SaasUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let saasUser: SaasUser | null = null;

  // 1. Try SaaS session first (email/password login)
  try {
    const cookies = parseCookieHeader(opts.req.headers.cookie || "");
    const saasToken = cookies[SAAS_COOKIE];
    if (saasToken) {
      const session = await verifySaasSession(saasToken);
      if (session) {
        saasUser = {
          userId: session.userId,
          tenantId: session.tenantId,
          email: session.email,
          name: session.name,
          role: session.role,
        };
        // Create a synthetic User object so protectedProcedure works
        user = {
          id: session.userId,
          openId: `saas_${session.userId}`,
          name: session.name,
          email: session.email,
          loginMethod: "email",
          role: session.role === "admin" ? "admin" : "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as User;
      }
    }
  } catch (error) {
    // SaaS auth failed, try Manus OAuth next
  }

  // 2. If no SaaS session, try Manus OAuth
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    saasUser,
  };
}
