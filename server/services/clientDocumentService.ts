/**
 * Client Document Service — Documentos categorizados do cliente
 * Manages categorized documents (receitas, atestados, imagens, contratos, exames)
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export interface CreateDocumentInput {
  tenantId: number;
  contactId: number;
  category: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedByUserId?: number;
}

export async function listDocuments(tenantId: number, contactId: number, category?: string) {
  const db = await getDb();
  if (!db) return [];

  if (category) {
    const result = await db.execute(sql`
      SELECT d.*, u.name as "uploadedByName"
      FROM client_documents d
      LEFT JOIN crm_users u ON u.id = d."uploadedByUserId" AND u."tenantId" = d."tenantId"
      WHERE d."tenantId" = ${tenantId} AND d."contactId" = ${contactId} AND d."category" = ${category}::"document_category"
      ORDER BY d."createdAt" DESC
    `);
    return result.rows;
  }

  const result = await db.execute(sql`
    SELECT d.*, u.name as "uploadedByName"
    FROM client_documents d
    LEFT JOIN crm_users u ON u.id = d."uploadedByUserId" AND u."tenantId" = d."tenantId"
    WHERE d."tenantId" = ${tenantId} AND d."contactId" = ${contactId}
    ORDER BY d."createdAt" DESC
  `);

  return result.rows;
}

export async function createDocument(input: CreateDocumentInput) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result = await db.execute(sql`
    INSERT INTO client_documents ("tenantId", "contactId", "category", "title", "description", "fileUrl", "fileName", "mimeType", "sizeBytes", "uploadedByUserId")
    VALUES (${input.tenantId}, ${input.contactId}, ${input.category}::"document_category", ${input.title}, ${input.description || null}, ${input.fileUrl}, ${input.fileName}, ${input.mimeType || null}, ${input.sizeBytes || null}, ${input.uploadedByUserId || null})
    RETURNING id
  `);

  return (result.rows as any[])[0];
}

export async function deleteDocument(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.execute(sql`
    DELETE FROM client_documents WHERE id = ${id} AND "tenantId" = ${tenantId}
  `);
}
