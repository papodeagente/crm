import { getDb } from "../db";
import { eventLog } from "../../drizzle/schema";

export interface EventLogPayload {
  tenantId: number;
  actorUserId?: number | null;
  actorType?: "user" | "system" | "api" | "webhook";
  entityType: string;
  entityId?: number | null;
  action: string;
  beforeJson?: any;
  afterJson?: any;
  metadataJson?: any;
}

export async function emitEvent(payload: EventLogPayload): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(eventLog).values({
      tenantId: payload.tenantId,
      actorUserId: payload.actorUserId ?? null,
      actorType: payload.actorType || "user",
      entityType: payload.entityType,
      entityId: payload.entityId ?? null,
      action: payload.action,
      beforeJson: payload.beforeJson ? JSON.parse(JSON.stringify(payload.beforeJson)) : null,
      afterJson: payload.afterJson ? JSON.parse(JSON.stringify(payload.afterJson)) : null,
      metadataJson: payload.metadataJson ? JSON.parse(JSON.stringify(payload.metadataJson)) : null,
    });
  } catch (e) {
    console.error("[EventLog] Failed to emit event:", e);
  }
}

export async function getEventLog(
  tenantId: number,
  options?: {
    entityType?: string;
    entityId?: number;
    limit?: number;
    offset?: number;
  }
) {
  const db = await getDb();
  if (!db) return [];

  const { eq, and, desc } = await import("drizzle-orm");
  let query = db.select().from(eventLog).where(eq(eventLog.tenantId, tenantId));

  if (options?.entityType) {
    query = db.select().from(eventLog).where(
      and(
        eq(eventLog.tenantId, tenantId),
        eq(eventLog.entityType, options.entityType),
        ...(options.entityId ? [eq(eventLog.entityId, options.entityId)] : [])
      )
    );
  }

  const results = await query
    .orderBy(desc(eventLog.occurredAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);

  return results;
}
