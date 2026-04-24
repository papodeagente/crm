/**
 * Anamnesis Service — Fichas de Anamnese
 * Manages questionnaire templates, questions, and client responses
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

// ─── Templates ───

export async function listTemplates(tenantId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT t.*,
      (SELECT COUNT(*) FROM anamnesis_questions WHERE "templateId" = t.id)::int as "questionCount"
    FROM anamnesis_templates t
    WHERE t."tenantId" = ${tenantId} AND t."isActive" = true
    ORDER BY t."isDefault" DESC, t."createdAt" DESC
  `);

  return result.rows;
}

export async function createTemplate(tenantId: number, name: string, description?: string, isDefault?: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.execute(sql`
    INSERT INTO anamnesis_templates ("tenantId", "name", "description", "isDefault")
    VALUES (${tenantId}, ${name}, ${description || null}, ${isDefault || false})
    RETURNING id
  `);

  return (result.rows as any[])[0];
}

export async function updateTemplate(id: number, tenantId: number, data: { name?: string; description?: string; isDefault?: boolean; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.execute(sql`
    UPDATE anamnesis_templates
    SET "name" = COALESCE(${data.name || null}, "name"),
        "description" = COALESCE(${data.description !== undefined ? data.description : null}, "description"),
        "isDefault" = COALESCE(${data.isDefault !== undefined ? data.isDefault : null}, "isDefault"),
        "isActive" = COALESCE(${data.isActive !== undefined ? data.isActive : null}, "isActive"),
        "updatedAt" = NOW()
    WHERE id = ${id} AND "tenantId" = ${tenantId}
  `);
}

// ─── Questions ───

export async function listQuestions(templateId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT * FROM anamnesis_questions
    WHERE "templateId" = ${templateId} AND "tenantId" = ${tenantId}
    ORDER BY "sortOrder" ASC, id ASC
  `);

  return result.rows;
}

export async function createQuestion(tenantId: number, templateId: number, data: {
  section?: string;
  question: string;
  questionType: string;
  options?: string[];
  isRequired?: boolean;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.execute(sql`
    INSERT INTO anamnesis_questions ("templateId", "tenantId", "section", "question", "questionType", "options", "isRequired", "sortOrder")
    VALUES (${templateId}, ${tenantId}, ${data.section || null}, ${data.question}, ${data.questionType}::"anamnesis_question_type", ${data.options ? JSON.stringify(data.options) : null}::json, ${data.isRequired || false}, ${data.sortOrder || 0})
    RETURNING id
  `);

  return (result.rows as any[])[0];
}

export async function updateQuestion(id: number, tenantId: number, data: {
  section?: string;
  question?: string;
  questionType?: string;
  options?: string[];
  isRequired?: boolean;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.execute(sql`
    UPDATE anamnesis_questions
    SET "section" = COALESCE(${data.section !== undefined ? data.section : null}, "section"),
        "question" = COALESCE(${data.question || null}, "question"),
        "questionType" = COALESCE(${data.questionType ? sql.raw(`'${data.questionType}'::"anamnesis_question_type"`) : sql.raw(`"questionType"`)}, "questionType"),
        "options" = COALESCE(${data.options ? JSON.stringify(data.options) : null}::json, "options"),
        "isRequired" = COALESCE(${data.isRequired !== undefined ? data.isRequired : null}, "isRequired"),
        "sortOrder" = COALESCE(${data.sortOrder !== undefined ? data.sortOrder : null}, "sortOrder")
    WHERE id = ${id} AND "tenantId" = ${tenantId}
  `);
}

export async function deleteQuestion(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.execute(sql`
    DELETE FROM anamnesis_questions WHERE id = ${id} AND "tenantId" = ${tenantId}
  `);
}

// ─── Responses ───

export async function getContactResponses(tenantId: number, contactId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT r.*, t.name as "templateName",
      u.name as "filledByName"
    FROM anamnesis_responses r
    JOIN anamnesis_templates t ON t.id = r."templateId"
    LEFT JOIN crm_users u ON u.id = r."filledByUserId" AND u."tenantId" = r."tenantId"
    WHERE r."tenantId" = ${tenantId} AND r."contactId" = ${contactId}
    ORDER BY r."filledAt" DESC
  `);

  return result.rows;
}

export async function saveResponse(tenantId: number, data: {
  contactId: number;
  templateId: number;
  answers: Record<string, string>;
  filledByUserId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Upsert: if response for this contact+template exists, update; otherwise insert
  const existing = await db.execute(sql`
    SELECT id FROM anamnesis_responses
    WHERE "tenantId" = ${tenantId} AND "contactId" = ${data.contactId} AND "templateId" = ${data.templateId}
    LIMIT 1
  `);

  if ((existing.rows as any[]).length > 0) {
    const id = (existing.rows as any[])[0].id;
    await db.execute(sql`
      UPDATE anamnesis_responses
      SET "answers" = ${JSON.stringify(data.answers)}::json,
          "filledByUserId" = ${data.filledByUserId || null},
          "updatedAt" = NOW()
      WHERE id = ${id}
    `);
    return { id };
  }

  const result = await db.execute(sql`
    INSERT INTO anamnesis_responses ("tenantId", "contactId", "templateId", "answers", "filledByUserId")
    VALUES (${tenantId}, ${data.contactId}, ${data.templateId}, ${JSON.stringify(data.answers)}::json, ${data.filledByUserId || null})
    RETURNING id
  `);

  return (result.rows as any[])[0];
}
