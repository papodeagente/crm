/**
 * Agenda Service — Unified Calendar for CRM Dashboard
 *
 * Merges CRM tasks (crm_tasks + task_assignees) with Google Calendar events
 * (google_calendar_events) into a single timeline for the Home dashboard.
 *
 * Supports:
 *  - Date range queries (day / week / month)
 *  - User / team filtering with admin override
 *  - Google Calendar sync (pull events from MCP → persist locally)
 *  - Disconnect Google Calendar (remove cached events)
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface AgendaItem {
  id: string;                  // "task-123" or "gcal-456"
  source: "crm" | "google";
  title: string;
  description?: string | null;
  startAt: number;             // UTC timestamp ms
  endAt: number;               // UTC timestamp ms
  allDay: boolean;
  status: string;              // pending | in_progress | done | cancelled | confirmed | tentative
  priority?: string;           // low | medium | high | urgent  (CRM only)
  taskType?: string;           // whatsapp | phone | email | video | task  (CRM only)
  entityType?: string;         // deal | contact  (CRM only)
  entityId?: number;
  dealTitle?: string | null;
  contactName?: string | null;
  isOverdue: boolean;
  isCompleted: boolean;
  location?: string | null;
  htmlLink?: string | null;    // Google Calendar link
  userId?: number;             // owner / assignee
  calendarEmail?: string | null;
}

export interface AgendaFilter {
  from: string;   // ISO date string YYYY-MM-DD
  to: string;     // ISO date string YYYY-MM-DD
  userId?: number;
  teamId?: number;
}

// ═══════════════════════════════════════
// HELPER: Resolve team → user IDs
// ═══════════════════════════════════════

async function getTeamMemberIds(tenantId: number, teamId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const [rows] = await db.execute(sql`
    SELECT userId FROM team_members WHERE tenantId = ${tenantId} AND teamId = ${teamId}
  `);
  return (rows as unknown as any[]).map((r: any) => Number(r.userId));
}

// ═══════════════════════════════════════
// 1. GET UNIFIED AGENDA
// ═══════════════════════════════════════

export async function getUnifiedAgenda(
  tenantId: number,
  filter: AgendaFilter,
): Promise<AgendaItem[]> {
  const db = await getDb();
  if (!db) return [];

  // Resolve team to user IDs
  let userIds: number[] | undefined;
  if (filter.teamId) {
    userIds = await getTeamMemberIds(tenantId, filter.teamId);
    if (userIds.length === 0) return [];
  }

  const fromDate = filter.from;
  const toDate = filter.to;

  // ── CRM Tasks ──
  const userFilter = buildTaskUserFilter(filter.userId, userIds);

  const [taskRows] = await db.execute(sql`
    SELECT t.id, t.title, t.dueAt, t.priority, t.status, t.taskType,
           t.entityType, t.entityId, t.description,
           t.assignedToUserId,
           d.title AS dealTitle,
           c.name  AS contactName
    FROM crm_tasks t
    LEFT JOIN deals d ON t.entityType = 'deal' AND d.id = t.entityId AND d.tenantId = ${tenantId}
    LEFT JOIN contacts c ON (
      (t.entityType = 'contact' AND c.id = t.entityId)
      OR (t.entityType = 'deal' AND d.contactId IS NOT NULL AND c.id = d.contactId)
    ) AND c.tenantId = ${tenantId}
    WHERE t.tenantId = ${tenantId}
      ${userFilter}
      AND (
        (t.dueAt IS NOT NULL AND t.dueAt >= ${fromDate} AND t.dueAt < DATE_ADD(${toDate}, INTERVAL 1 DAY))
        OR (t.dueAt IS NULL AND t.createdAt >= ${fromDate} AND t.createdAt < DATE_ADD(${toDate}, INTERVAL 1 DAY))
      )
    ORDER BY t.dueAt ASC, t.priority DESC
  `);

  const now = Date.now();
  const crmItems: AgendaItem[] = (taskRows as unknown as any[]).map((t: any) => {
    const dueMs = t.dueAt ? new Date(t.dueAt).getTime() : new Date(t.createdAt).getTime();
    const isCompleted = t.status === "done" || t.status === "cancelled";
    const isOverdue = !isCompleted && t.dueAt && new Date(t.dueAt).getTime() < now;
    return {
      id: `task-${t.id}`,
      source: "crm" as const,
      title: t.title,
      description: t.description,
      startAt: dueMs,
      endAt: dueMs + 60 * 60 * 1000, // default 1h duration
      allDay: !t.dueAt,
      status: t.status,
      priority: t.priority,
      taskType: t.taskType,
      entityType: t.entityType,
      entityId: t.entityId,
      dealTitle: t.dealTitle,
      contactName: t.contactName,
      isOverdue: !!isOverdue,
      isCompleted,
      userId: t.assignedToUserId,
    };
  });

  // ── Google Calendar Events ──
  const gcalUserFilter = buildGcalUserFilter(filter.userId, userIds);

  const [gcalRows] = await db.execute(sql`
    SELECT id, title, description, startAt, endAt, allDay, location, status, htmlLink,
           userId, sourceCalendarId
    FROM google_calendar_events
    WHERE tenantId = ${tenantId}
      ${gcalUserFilter}
      AND startAt < DATE_ADD(${toDate}, INTERVAL 1 DAY)
      AND endAt >= ${fromDate}
    ORDER BY startAt ASC
  `);

  const gcalItems: AgendaItem[] = (gcalRows as unknown as any[]).map((e: any) => ({
    id: `gcal-${e.id}`,
    source: "google" as const,
    title: e.title,
    description: e.description,
    startAt: new Date(e.startAt).getTime(),
    endAt: new Date(e.endAt).getTime(),
    allDay: !!e.allDay,
    status: e.status || "confirmed",
    isOverdue: false,
    isCompleted: false,
    location: e.location,
    htmlLink: e.htmlLink,
    userId: e.userId,
    calendarEmail: e.sourceCalendarId,
  }));

  // ── Merge & sort by startAt ──
  const merged = [...crmItems, ...gcalItems].sort((a, b) => a.startAt - b.startAt);
  return merged;
}

// ═══════════════════════════════════════
// 2. SYNC GOOGLE CALENDAR → local DB
// ═══════════════════════════════════════

export async function syncGoogleCalendar(
  tenantId: number,
  userId: number,
): Promise<{ synced: number; error?: string }> {
  const db = await getDb();
  if (!db) return { synced: 0, error: "Database not available" };

  // Check if user has Google Calendar token
  const [tokenRows] = await db.execute(sql`
    SELECT id, calendarEmail FROM google_calendar_tokens
    WHERE tenantId = ${tenantId} AND userId = ${userId} AND isActive = 1
    LIMIT 1
  `);
  const tokens = tokenRows as unknown as any[];
  if (tokens.length === 0) {
    return { synced: 0, error: "NO_GOOGLE_TOKEN" };
  }

  const calendarEmail = tokens[0].calendarEmail || "primary";

  // Fetch events from Google Calendar via MCP
  try {
    const { searchCalendarEvents } = await import("../googleCalendar");

    // Sync window: 30 days back → 90 days forward
    const now = new Date();
    const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const events = await searchCalendarEvents({
      timeMin,
      timeMax,
      maxResults: 250,
    });

    if (!events || events.length === 0) {
      return { synced: 0 };
    }

    const syncedAt = new Date();
    let syncCount = 0;

    for (const evt of events) {
      const googleEventId = evt.id;
      if (!googleEventId) continue;

      const startDateTime = evt.start?.dateTime || evt.start?.date;
      const endDateTime = evt.end?.dateTime || evt.end?.date;
      if (!startDateTime) continue;

      const isAllDay = !evt.start?.dateTime;
      const startAt = new Date(startDateTime);
      const endAt = endDateTime ? new Date(endDateTime) : new Date(startAt.getTime() + 60 * 60 * 1000);

      // Upsert: INSERT ... ON DUPLICATE KEY UPDATE
      await db.execute(sql`
        INSERT INTO google_calendar_events
          (tenantId, userId, googleEventId, title, description, startAt, endAt, allDay, location, status, htmlLink, sourceCalendarId, rawJson, syncedAt)
        VALUES
          (${tenantId}, ${userId}, ${googleEventId}, ${evt.summary || "(Sem título)"}, ${evt.description || null},
           ${startAt}, ${endAt}, ${isAllDay}, ${evt.location || null}, ${evt.status || "confirmed"},
           ${evt.htmlLink || null}, ${calendarEmail}, ${JSON.stringify(evt)}, ${syncedAt})
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          description = VALUES(description),
          startAt = VALUES(startAt),
          endAt = VALUES(endAt),
          allDay = VALUES(allDay),
          location = VALUES(location),
          status = VALUES(status),
          htmlLink = VALUES(htmlLink),
          rawJson = VALUES(rawJson),
          syncedAt = VALUES(syncedAt)
      `);
      syncCount++;
    }

    // Remove events that were deleted on Google (not in the fetched set)
    const fetchedIds = events.filter(e => e.id).map(e => e.id);
    if (fetchedIds.length > 0) {
      // Build a safe IN clause
      const placeholders = fetchedIds.map(() => "?").join(",");
      await db.execute(sql`
        DELETE FROM google_calendar_events
        WHERE tenantId = ${tenantId}
          AND userId = ${userId}
          AND startAt >= ${timeMin}
          AND endAt <= ${timeMax}
          AND googleEventId NOT IN (${sql.raw(fetchedIds.map(id => `'${id!.replace(/'/g, "''")}'`).join(","))})
      `);
    }

    console.log(`[Agenda] Synced ${syncCount} Google Calendar events for user ${userId} (tenant ${tenantId})`);
    return { synced: syncCount };
  } catch (err: any) {
    console.error("[Agenda] Google Calendar sync error:", err.message);
    return { synced: 0, error: err.message };
  }
}

// ═══════════════════════════════════════
// 3. DISCONNECT GOOGLE CALENDAR
// ═══════════════════════════════════════

export async function disconnectGoogleCalendar(
  tenantId: number,
  userId: number,
): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) return { success: false };

  // Remove cached events
  await db.execute(sql`
    DELETE FROM google_calendar_events
    WHERE tenantId = ${tenantId} AND userId = ${userId}
  `);

  // Deactivate token
  await db.execute(sql`
    UPDATE google_calendar_tokens
    SET isActive = 0
    WHERE tenantId = ${tenantId} AND userId = ${userId}
  `);

  console.log(`[Agenda] Disconnected Google Calendar for user ${userId} (tenant ${tenantId})`);
  return { success: true };
}

// ═══════════════════════════════════════
// 4. CHECK GOOGLE CALENDAR CONNECTION
// ═══════════════════════════════════════

export async function getGoogleCalendarStatus(
  tenantId: number,
  userId: number,
): Promise<{ connected: boolean; calendarEmail?: string; lastSyncedAt?: number }> {
  const db = await getDb();
  if (!db) return { connected: false };

  const [tokenRows] = await db.execute(sql`
    SELECT calendarEmail FROM google_calendar_tokens
    WHERE tenantId = ${tenantId} AND userId = ${userId} AND isActive = 1
    LIMIT 1
  `);
  const tokens = tokenRows as unknown as any[];
  if (tokens.length === 0) return { connected: false };

  // Get last sync time
  const [syncRows] = await db.execute(sql`
    SELECT MAX(syncedAt) AS lastSync FROM google_calendar_events
    WHERE tenantId = ${tenantId} AND userId = ${userId}
  `);
  const lastSync = (syncRows as unknown as any[])[0]?.lastSync;

  return {
    connected: true,
    calendarEmail: tokens[0].calendarEmail,
    lastSyncedAt: lastSync ? new Date(lastSync).getTime() : undefined,
  };
}

// ═══════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════

function buildTaskUserFilter(userId?: number, userIds?: number[]) {
  if (userIds && userIds.length > 0) {
    const idList = userIds.join(",");
    return sql.raw(`AND (
      t.assignedToUserId IN (${idList})
      OR t.createdByUserId IN (${idList})
      OR t.id IN (SELECT taskId FROM task_assignees WHERE userId IN (${idList}))
    )`);
  }
  if (userId) {
    return sql`AND (
      t.assignedToUserId = ${userId}
      OR t.createdByUserId = ${userId}
      OR t.id IN (SELECT taskId FROM task_assignees WHERE userId = ${userId})
    )`;
  }
  return sql``;
}

function buildGcalUserFilter(userId?: number, userIds?: number[]) {
  if (userIds && userIds.length > 0) {
    const idList = userIds.join(",");
    return sql.raw(`AND userId IN (${idList})`);
  }
  if (userId) {
    return sql`AND userId = ${userId}`;
  }
  return sql``;
}
