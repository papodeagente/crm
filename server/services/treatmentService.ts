/**
 * Treatment Service — Tratamentos do Cliente
 * Manages ongoing treatments, sessions, and progress tracking
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export interface CreateTreatmentInput {
  tenantId: number;
  contactId: number;
  dealId?: number;
  name: string;
  description?: string;
  totalSessions?: number;
  startDate?: Date;
  endDate?: Date;
  valueCents?: number;
  professionalId?: number;
  notes?: string;
}

export async function listTreatments(tenantId: number, contactId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT t.*, u.name as "professionalName"
    FROM client_treatments t
    LEFT JOIN crm_users u ON u.id = t."professionalId" AND u."tenantId" = t."tenantId"
    WHERE t."tenantId" = ${tenantId} AND t."contactId" = ${contactId}
    ORDER BY t.status = 'active' DESC, t."createdAt" DESC
  `);

  return result.rows;
}

export async function createTreatment(input: CreateTreatmentInput) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.execute(sql`
    INSERT INTO client_treatments ("tenantId", "contactId", "dealId", "name", "description", "totalSessions", "startDate", "endDate", "valueCents", "professionalId", "notes")
    VALUES (${input.tenantId}, ${input.contactId}, ${input.dealId || null}, ${input.name}, ${input.description || null}, ${input.totalSessions || null}, ${input.startDate || null}, ${input.endDate || null}, ${input.valueCents || null}, ${input.professionalId || null}, ${input.notes || null})
    RETURNING id
  `);

  return (result.rows as any[])[0];
}

export async function updateTreatment(id: number, tenantId: number, data: Partial<CreateTreatmentInput> & { status?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.execute(sql`
    UPDATE client_treatments
    SET "name" = COALESCE(${data.name || null}, "name"),
        "description" = COALESCE(${data.description !== undefined ? (data.description || null) : null}, "description"),
        "status" = COALESCE(${data.status || null}::"treatment_status", "status"),
        "totalSessions" = COALESCE(${data.totalSessions || null}, "totalSessions"),
        "valueCents" = COALESCE(${data.valueCents || null}, "valueCents"),
        "notes" = COALESCE(${data.notes !== undefined ? (data.notes || null) : null}, "notes"),
        "updatedAt" = NOW()
    WHERE id = ${id} AND "tenantId" = ${tenantId}
  `);
}

export async function addSession(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.execute(sql`
    UPDATE client_treatments
    SET "completedSessions" = "completedSessions" + 1,
        "status" = CASE
          WHEN "totalSessions" IS NOT NULL AND "completedSessions" + 1 >= "totalSessions" THEN 'completed'::"treatment_status"
          ELSE "status"
        END,
        "updatedAt" = NOW()
    WHERE id = ${id} AND "tenantId" = ${tenantId} AND status = 'active'
    RETURNING id, "completedSessions", "totalSessions", status
  `);

  return (result.rows as any[])[0] || null;
}
