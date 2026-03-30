import { eq, and, asc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { customMessages, type InsertCustomMessage } from "../../drizzle/schema";

export const CUSTOM_MESSAGE_CATEGORIES = [
  { value: "primeiro_contato", label: "Primeiro contato" },
  { value: "reativacao", label: "Reativação de contato" },
  { value: "pedir_indicacao", label: "Pedir indicação" },
  { value: "receber_indicado", label: "Receber indicado" },
  { value: "recuperacao_vendas", label: "Recuperação de vendas" },
  { value: "objecoes", label: "Objeções" },
  { value: "outros", label: "Outros" },
] as const;

export type CustomMessageCategory = typeof CUSTOM_MESSAGE_CATEGORIES[number]["value"];

export async function listCustomMessages(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(customMessages)
    .where(and(eq(customMessages.tenantId, tenantId), eq(customMessages.isActive, true)))
    .orderBy(asc(customMessages.category), asc(customMessages.orderIndex));
}

export async function listCustomMessagesByCategory(tenantId: number, category: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(customMessages)
    .where(and(
      eq(customMessages.tenantId, tenantId),
      eq(customMessages.category, category),
      eq(customMessages.isActive, true),
    ))
    .orderBy(asc(customMessages.orderIndex));
}

export async function createCustomMessage(data: InsertCustomMessage) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = new Date();
  const result = (await db.execute(sql`
    INSERT INTO custom_messages (tenantId, category, title, content, orderIndex, isActive, createdBy, createdAt, updatedAt)
    VALUES (${data.tenantId}, ${data.category}, ${data.title}, ${data.content}, ${data.orderIndex ?? 0}, ${data.isActive ? 1 : 0}, ${data.createdBy}, ${now}, ${now})
  `)) as any;
  return { id: result[0]?.insertId ?? 0 };
}

export async function updateCustomMessage(
  tenantId: number,
  id: number,
  data: Partial<Pick<InsertCustomMessage, "title" | "content" | "category" | "orderIndex">>,
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(customMessages)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(customMessages.id, id), eq(customMessages.tenantId, tenantId)));
  return { success: true };
}

export async function deleteCustomMessage(tenantId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Soft delete by setting isActive = false
  await db
    .update(customMessages)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(customMessages.id, id), eq(customMessages.tenantId, tenantId)));
  return { success: true };
}
