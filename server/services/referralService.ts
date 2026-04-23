/**
 * Referral Service — Sistema de Indicacoes
 *
 * Manages the referral lifecycle:
 * 1. Client completes a service → referralWindowStart is set on contact
 * 2. Within the window (30 days), WhatsApp notification encourages referrals
 * 3. New contact arrives with "referred by" → referral record created
 * 4. When referred contact purchases → status changes to "converted"
 */

import { getDb } from "../db";
import { referrals, contacts } from "../../drizzle/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export interface CreateReferralInput {
  tenantId: number;
  referrerId: number;
  referredId: number;
  dealId?: number;
  rewardType?: "discount" | "credit" | "gift" | "none";
  rewardValue?: number;
  notes?: string;
}

export async function createReferral(input: CreateReferralInput) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.insert(referrals).values({
    tenantId: input.tenantId,
    referrerId: input.referrerId,
    referredId: input.referredId,
    dealId: input.dealId || null,
    rewardType: input.rewardType || "none",
    rewardValue: input.rewardValue?.toString() || null,
    notes: input.notes || null,
  }).returning({ id: referrals.id });

  // Increment referralCount on the referrer contact
  await db.execute(sql`
    UPDATE contacts SET "referralCount" = COALESCE("referralCount", 0) + 1
    WHERE id = ${input.referrerId} AND "tenantId" = ${input.tenantId}
  `);

  return result[0];
}

export async function convertReferral(referralId: number, dealId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.execute(sql`
    UPDATE referrals SET status = 'converted', "dealId" = ${dealId}, "updatedAt" = NOW()
    WHERE id = ${referralId}
  `);
}

export async function markRewardDelivered(referralId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.execute(sql`
    UPDATE referrals SET "rewardDelivered" = true, "updatedAt" = NOW()
    WHERE id = ${referralId}
  `);
}

export async function listReferrals(tenantId: number, filters?: { referrerId?: number; status?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];

  const limit = filters?.limit || 50;

  const rows = await db.execute(sql`
    SELECT
      r.*,
      referrer.name as "referrerName", referrer.phone as "referrerPhone",
      referred.name as "referredName", referred.phone as "referredPhone",
      d.title as "dealTitle", d."totalValueCents" as "dealValue"
    FROM referrals r
    LEFT JOIN contacts referrer ON referrer.id = r."referrerId" AND referrer."tenantId" = r."tenantId"
    LEFT JOIN contacts referred ON referred.id = r."referredId" AND referred."tenantId" = r."tenantId"
    LEFT JOIN deals d ON d.id = r."dealId" AND d."tenantId" = r."tenantId"
    WHERE r."tenantId" = ${tenantId}
    ${filters?.referrerId ? sql`AND r."referrerId" = ${filters.referrerId}` : sql``}
    ${filters?.status ? sql`AND r.status = ${filters.status}` : sql``}
    ORDER BY r."createdAt" DESC
    LIMIT ${limit}
  `);

  return rows.rows;
}

export async function getReferralStats(tenantId: number) {
  const db = await getDb();
  if (!db) return null;

  const stats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'converted') as converted,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE "rewardDelivered" = true) as "rewardsDelivered"
    FROM referrals
    WHERE "tenantId" = ${tenantId}
  `);

  // Top referrers
  const topReferrers = await db.execute(sql`
    SELECT
      c.id, c.name, c.phone,
      COUNT(r.id) as "referralCount",
      COUNT(r.id) FILTER (WHERE r.status = 'converted') as "convertedCount"
    FROM referrals r
    JOIN contacts c ON c.id = r."referrerId" AND c."tenantId" = r."tenantId"
    WHERE r."tenantId" = ${tenantId}
    GROUP BY c.id, c.name, c.phone
    ORDER BY "referralCount" DESC
    LIMIT 10
  `);

  return {
    ...stats.rows[0],
    topReferrers: topReferrers.rows,
  };
}
