/**
 * Evolution Service — Evolucoes Clinicas
 * Clinical notes / evolution records for contacts
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export interface CreateEvolutionInput {
  tenantId: number;
  contactId: number;
  appointmentId?: number;
  treatmentId?: number;
  title: string;
  content: string;
  professionalId?: number;
  photos?: string[];
}

export async function listEvolutions(tenantId: number, contactId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT e.*, u.name as "professionalName"
    FROM client_evolutions e
    LEFT JOIN crm_users u ON u.id = e."professionalId" AND u."tenantId" = e."tenantId"
    WHERE e."tenantId" = ${tenantId} AND e."contactId" = ${contactId}
    ORDER BY e."createdAt" DESC
  `);

  return result.rows;
}

export async function createEvolution(input: CreateEvolutionInput) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.execute(sql`
    INSERT INTO client_evolutions ("tenantId", "contactId", "appointmentId", "treatmentId", "title", "content", "professionalId", "photos")
    VALUES (${input.tenantId}, ${input.contactId}, ${input.appointmentId || null}, ${input.treatmentId || null}, ${input.title}, ${input.content}, ${input.professionalId || null}, ${input.photos ? JSON.stringify(input.photos) : null}::json)
    RETURNING id
  `);

  return (result.rows as any[])[0];
}

export async function updateEvolution(id: number, tenantId: number, data: Partial<CreateEvolutionInput>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const sets: string[] = [];
  const values: any[] = [];

  if (data.title !== undefined) sets.push(`"title" = '${data.title.replace(/'/g, "''")}'`);
  if (data.content !== undefined) sets.push(`"content" = '${data.content.replace(/'/g, "''")}'`);
  if (data.photos !== undefined) sets.push(`"photos" = '${JSON.stringify(data.photos)}'::json`);

  if (sets.length === 0) return;

  await db.execute(sql.raw(`
    UPDATE client_evolutions SET ${sets.join(", ")}, "updatedAt" = NOW()
    WHERE id = ${id} AND "tenantId" = ${tenantId}
  `));
}

export async function deleteEvolution(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.execute(sql`
    DELETE FROM client_evolutions WHERE id = ${id} AND "tenantId" = ${tenantId}
  `);
}
