/**
 * Package Service — Pacotes de Sessoes / Venda Recorrente
 *
 * Manages client session packages:
 * - Create packages (e.g., "10 sessoes de limpeza de pele")
 * - Track session usage
 * - Alert when package is running low
 * - Auto-suggest renewal
 */

import { getDb } from "../db";
import { clientPackages } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

export interface CreatePackageInput {
  tenantId: number;
  contactId: number;
  productId?: number;
  name: string;
  totalSessions: number;
  priceTotal?: number;
  expiresAt?: Date;
}

export async function createPackage(input: CreatePackageInput) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.insert(clientPackages).values({
    tenantId: input.tenantId,
    contactId: input.contactId,
    productId: input.productId || null,
    name: input.name,
    totalSessions: input.totalSessions,
    usedSessions: 0,
    priceTotal: input.priceTotal?.toString() || null,
    expiresAt: input.expiresAt || null,
  }).returning({ id: clientPackages.id });

  return result[0];
}

export async function useSession(packageId: number, tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.execute(sql`
    UPDATE client_packages
    SET "usedSessions" = "usedSessions" + 1,
        "updatedAt" = NOW(),
        status = CASE
          WHEN "usedSessions" + 1 >= "totalSessions" THEN 'completed'
          ELSE status
        END
    WHERE id = ${packageId} AND "tenantId" = ${tenantId} AND status = 'active'
    RETURNING id, "usedSessions", "totalSessions", status
  `);

  return result.rows[0] || null;
}

export async function getContactPackages(tenantId: number, contactId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT cp.*, pc.name as "productName"
    FROM client_packages cp
    LEFT JOIN product_catalog pc ON pc.id = cp."productId" AND pc."tenantId" = cp."tenantId"
    WHERE cp."tenantId" = ${tenantId} AND cp."contactId" = ${contactId}
    ORDER BY cp.status = 'active' DESC, cp."createdAt" DESC
  `);

  return result.rows;
}

export async function getExpiringPackages(tenantId: number) {
  const db = await getDb();
  if (!db) return [];

  // Packages with <= 2 sessions remaining or expiring within 7 days
  const result = await db.execute(sql`
    SELECT cp.*, c.name as "contactName", c.phone as "contactPhone"
    FROM client_packages cp
    JOIN contacts c ON c.id = cp."contactId" AND c."tenantId" = cp."tenantId"
    WHERE cp."tenantId" = ${tenantId}
      AND cp.status = 'active'
      AND (
        cp."totalSessions" - cp."usedSessions" <= 2
        OR (cp."expiresAt" IS NOT NULL AND cp."expiresAt" < NOW() + INTERVAL '7 days')
      )
    ORDER BY cp."totalSessions" - cp."usedSessions" ASC
  `);

  return result.rows;
}

export async function cancelPackage(packageId: number, tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.execute(sql`
    UPDATE client_packages SET status = 'cancelled', "updatedAt" = NOW()
    WHERE id = ${packageId} AND "tenantId" = ${tenantId}
  `);
}
