/**
 * Debit Service — Debitos Financeiros do Cliente
 * Manages financial debits, payments, and payment tracking
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export interface CreateDebitInput {
  tenantId: number;
  contactId: number;
  dealId?: number;
  treatmentId?: number;
  description: string;
  totalCents: number;
  dueDate?: Date;
  paymentMethod?: string;
  notes?: string;
}

export async function listDebits(tenantId: number, contactId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT d.*,
      t.name as "treatmentName"
    FROM client_debits d
    LEFT JOIN client_treatments t ON t.id = d."treatmentId" AND t."tenantId" = d."tenantId"
    WHERE d."tenantId" = ${tenantId} AND d."contactId" = ${contactId}
    ORDER BY d.status IN ('pending', 'partial', 'overdue') DESC, d."createdAt" DESC
  `);

  return result.rows;
}

export async function getDebitStats(tenantId: number, contactId: number) {
  const db = await getDb();
  if (!db) return { totalOwed: 0, totalPaid: 0, pendingCount: 0 };

  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM("totalCents"), 0)::int as "totalOwed",
      COALESCE(SUM("paidCents"), 0)::int as "totalPaid",
      COUNT(*) FILTER (WHERE status IN ('pending', 'partial', 'overdue'))::int as "pendingCount"
    FROM client_debits
    WHERE "tenantId" = ${tenantId} AND "contactId" = ${contactId} AND status != 'cancelled'
  `);

  return (result.rows as any[])[0] || { totalOwed: 0, totalPaid: 0, pendingCount: 0 };
}

export async function createDebit(input: CreateDebitInput) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.execute(sql`
    INSERT INTO client_debits ("tenantId", "contactId", "dealId", "treatmentId", "description", "totalCents", "paidCents", "dueDate", "paymentMethod", "notes")
    VALUES (${input.tenantId}, ${input.contactId}, ${input.dealId || null}, ${input.treatmentId || null}, ${input.description}, ${input.totalCents}, 0, ${input.dueDate || null}, ${input.paymentMethod || null}, ${input.notes || null})
    RETURNING id
  `);

  return (result.rows as any[])[0];
}

export async function addPayment(id: number, tenantId: number, amountCents: number, paymentMethod?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.execute(sql`
    UPDATE client_debits
    SET "paidCents" = LEAST("paidCents" + ${amountCents}, "totalCents"),
        "paymentMethod" = COALESCE(${paymentMethod || null}, "paymentMethod"),
        "status" = CASE
          WHEN "paidCents" + ${amountCents} >= "totalCents" THEN 'paid'::"debit_status"
          ELSE 'partial'::"debit_status"
        END,
        "paidAt" = CASE
          WHEN "paidCents" + ${amountCents} >= "totalCents" THEN NOW()
          ELSE "paidAt"
        END,
        "updatedAt" = NOW()
    WHERE id = ${id} AND "tenantId" = ${tenantId} AND status != 'cancelled'
    RETURNING id, "paidCents", "totalCents", status
  `);

  return (result.rows as any[])[0] || null;
}

export async function cancelDebit(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.execute(sql`
    UPDATE client_debits SET status = 'cancelled', "updatedAt" = NOW()
    WHERE id = ${id} AND "tenantId" = ${tenantId}
  `);
}
