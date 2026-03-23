/**
 * Visibility Service — Entur OS
 * 
 * Applies per-user visibility rules for deals, contacts, and accounts.
 * Three modes:
 *   - "restrita" (personal): user sees only their own records
 *   - "equipe" (team): user sees records of all team members in their teams
 *   - "geral" (global): user sees all records in the tenant
 * 
 * Admin users always see everything (geral), regardless of preference.
 * Default for any user without a preference set: "geral" (backward compatible).
 */

import { getDb } from "../db";
import { getUserPreference } from "../db";
import { sql } from "drizzle-orm";

// Preference keys stored in user_preferences table
export const VISIBILITY_PREF_KEYS = {
  deals: "visibility_deals",
  contacts: "visibility_contacts",
  accounts: "visibility_accounts",
} as const;

export type VisibilityMode = "restrita" | "equipe" | "geral";
export type EntityType = "deals" | "contacts" | "accounts";

const VALID_MODES: VisibilityMode[] = ["restrita", "equipe", "geral"];

/**
 * Get the visibility mode for a specific entity type.
 * Returns "geral" if no preference is set (backward compatible).
 */
export async function getVisibilityMode(
  userId: number,
  tenantId: number,
  entity: EntityType
): Promise<VisibilityMode> {
  const prefKey = VISIBILITY_PREF_KEYS[entity];
  const value = await getUserPreference(userId, tenantId, prefKey);
  if (value && VALID_MODES.includes(value as VisibilityMode)) {
    return value as VisibilityMode;
  }
  return "geral"; // default
}

/**
 * Get all visibility modes for a user at once (reduces DB queries).
 */
export async function getAllVisibilityModes(
  userId: number,
  tenantId: number
): Promise<Record<EntityType, VisibilityMode>> {
  const db = await getDb();
  if (!db) return { deals: "geral", contacts: "geral", accounts: "geral" };

  const { userPreferences } = await import("../../drizzle/schema");
  const { eq, and, inArray } = await import("drizzle-orm");

  const keys = Object.values(VISIBILITY_PREF_KEYS);
  const rows = await db.select().from(userPreferences).where(
    and(
      eq(userPreferences.userId, userId),
      eq(userPreferences.tenantId, tenantId),
      inArray(userPreferences.prefKey, keys),
    )
  );

  const result: Record<EntityType, VisibilityMode> = {
    deals: "geral",
    contacts: "geral",
    accounts: "geral",
  };

  for (const row of rows) {
    if (row.prefKey === VISIBILITY_PREF_KEYS.deals && VALID_MODES.includes(row.prefValue as VisibilityMode)) {
      result.deals = row.prefValue as VisibilityMode;
    }
    if (row.prefKey === VISIBILITY_PREF_KEYS.contacts && VALID_MODES.includes(row.prefValue as VisibilityMode)) {
      result.contacts = row.prefValue as VisibilityMode;
    }
    if (row.prefKey === VISIBILITY_PREF_KEYS.accounts && VALID_MODES.includes(row.prefValue as VisibilityMode)) {
      result.accounts = row.prefValue as VisibilityMode;
    }
  }

  return result;
}

/**
 * Get all user IDs that share at least one team with the given user.
 * Returns an array of userIds (including the user themselves).
 */
export async function getTeamMateIds(
  userId: number,
  tenantId: number
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [userId];

  // Find all teams the user belongs to, then find all members of those teams
  const rows = await db.execute(sql`
    SELECT DISTINCT tm2.userId
    FROM team_members tm1
    JOIN team_members tm2 ON tm1.teamId = tm2.teamId AND tm2.tenantId = ${tenantId}
    WHERE tm1.userId = ${userId} AND tm1.tenantId = ${tenantId}
  `);

  const ids = (rows as unknown as any[][])[0]?.map((r: any) => Number(r.userId)) || [];
  // Always include the user themselves
  if (!ids.includes(userId)) ids.push(userId);
  return ids;
}

/**
 * Build a SQL condition for visibility filtering.
 * 
 * @param userId - Current user's CRM userId
 * @param tenantId - Current tenant
 * @param entity - Entity type (deals, contacts, accounts)
 * @param isAdmin - Whether the user is an admin
 * @param ownerColumn - The SQL column reference for ownerUserId (e.g., "deals.ownerUserId")
 * @returns Object with { mode, ownerUserIds } where ownerUserIds is undefined for "geral"
 */
export async function resolveVisibilityFilter(
  userId: number,
  tenantId: number,
  entity: EntityType,
  isAdmin: boolean
): Promise<{ mode: VisibilityMode; ownerUserIds: number[] | undefined }> {
  // Admins always see everything
  if (isAdmin) {
    return { mode: "geral", ownerUserIds: undefined };
  }

  const mode = await getVisibilityMode(userId, tenantId, entity);

  switch (mode) {
    case "restrita":
      return { mode, ownerUserIds: [userId] };

    case "equipe": {
      const teamMateIds = await getTeamMateIds(userId, tenantId);
      return { mode, ownerUserIds: teamMateIds };
    }

    case "geral":
    default:
      return { mode: "geral", ownerUserIds: undefined };
  }
}

/**
 * Set visibility mode for a specific entity type for a user.
 * Only admins should be able to call this (enforced at router level).
 */
export async function setVisibilityMode(
  userId: number,
  tenantId: number,
  entity: EntityType,
  mode: VisibilityMode
): Promise<void> {
  const { setUserPreference } = await import("../db");
  const prefKey = VISIBILITY_PREF_KEYS[entity];
  await setUserPreference(userId, tenantId, prefKey, mode);
}

/**
 * Set all visibility modes at once for a user.
 */
export async function setAllVisibilityModes(
  userId: number,
  tenantId: number,
  modes: Partial<Record<EntityType, VisibilityMode>>
): Promise<void> {
  const { setUserPreference } = await import("../db");
  for (const [entity, mode] of Object.entries(modes)) {
    if (VALID_MODES.includes(mode as VisibilityMode)) {
      const prefKey = VISIBILITY_PREF_KEYS[entity as EntityType];
      await setUserPreference(userId, tenantId, prefKey, mode as string);
    }
  }
}
