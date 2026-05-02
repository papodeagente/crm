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
  id: string;                  // "task-123" or "gcal-456" or "appt-789"
  source: "crm" | "google" | "appointment";
  title: string;
  description?: string | null;
  startAt: number;             // UTC timestamp ms
  endAt: number;               // UTC timestamp ms
  allDay: boolean;
  status: string;              // scheduled | confirmed | in_progress | completed | cancelled | no_show | pending | done
  priority?: string;           // low | medium | high | urgent  (CRM only)
  taskType?: string;           // whatsapp | phone | email | video | task  (CRM only)
  entityType?: string;         // deal | contact  (CRM only)
  entityId?: number;
  dealTitle?: string | null;
  contactName?: string | null;
  contactId?: number;
  isOverdue: boolean;
  isCompleted: boolean;
  location?: string | null;
  htmlLink?: string | null;    // Google Calendar link
  userId?: number;             // owner / assignee
  calendarEmail?: string | null;
  color?: string | null;       // appointment color
  participants?: Array<{ userId: number; name: string }>;  // appointment participants
  serviceType?: string;        // appointment service type
  notes?: string;              // appointment notes
  price?: number;              // appointment price
  professionalId?: number;     // appointment professional
  contactPhone?: string;       // appointment contact phone
}

export interface CreateAppointmentInput {
  title: string;
  description?: string;
  startAt: number;     // UTC timestamp ms
  endAt: number;       // UTC timestamp ms
  allDay?: boolean;
  location?: string;
  color?: string;
  dealId?: number;
  contactId?: number;
  participantIds?: number[];  // other users to include
  serviceType?: string;
  status?: string;
  recurrenceRule?: string;
  notes?: string;
  price?: number;
  professionalId?: number;
  contactPhone?: string;
}

export interface UpdateAppointmentInput extends Partial<CreateAppointmentInput> {
  id: number;
  isCompleted?: boolean;
  participantIds?: number[];  // replace all participants
}

export interface AgendaFilter {
  from: string;   // ISO date string YYYY-MM-DD
  to: string;     // ISO date string YYYY-MM-DD
  userId?: number;
  teamId?: number;
}

// ═══════════════════════════════════════
// HELPER: Extract rows from db.execute result
// ═══════════════════════════════════════

function extractRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

// ═══════════════════════════════════════
// HELPER: Resolve team → user IDs
// ═══════════════════════════════════════

async function getTeamMemberIds(tenantId: number, teamId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT "userId" FROM team_members WHERE "tenantId" = ${tenantId} AND "teamId" = ${teamId}
  `);
  return extractRows(rows).map((r: any) => Number(r.userId));
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
  const now = Date.now();

  // ── CRM Tasks (non-critical — failure should not block appointments) ──
  let crmItems: AgendaItem[] = [];
  try {
    const userFilter = buildTaskUserFilter(filter.userId, userIds);
    const taskRows = await db.execute(sql`
      SELECT t.id, t.title, t."dueAt", t.priority, t.status, t."taskType",
             t."entityType", t."entityId", t.description,
             t."assignedToUserId",
             d.title AS "dealTitle",
             c.name  AS "contactName"
      FROM crm_tasks t
      LEFT JOIN deals d ON t."entityType" = 'deal' AND d.id = t."entityId" AND d."tenantId" = ${tenantId}
      LEFT JOIN contacts c ON (
        (t."entityType" = 'contact' AND c.id = t."entityId")
        OR (t."entityType" = 'deal' AND d."contactId" IS NOT NULL AND c.id = d."contactId")
      ) AND c."tenantId" = ${tenantId}
      WHERE t."tenantId" = ${tenantId}
        ${userFilter}
        AND (
          (t."dueAt" IS NOT NULL AND t."dueAt" >= ${fromDate} AND t."dueAt" < ${toDate}::date + INTERVAL '1 day')
          OR (t."dueAt" IS NULL AND t."createdAt" >= ${fromDate} AND t."createdAt" < ${toDate}::date + INTERVAL '1 day')
        )
      ORDER BY t."dueAt" ASC, t.priority DESC
    `);
    crmItems = extractRows(taskRows).map((t: any) => {
      const dueMs = t.dueAt ? new Date(t.dueAt).getTime() : new Date(t.createdAt).getTime();
      const isCompleted = t.status === "done" || t.status === "cancelled";
      const isOverdue = !isCompleted && t.dueAt && new Date(t.dueAt).getTime() < now;
      return {
        id: `task-${t.id}`,
        source: "crm" as const,
        title: t.title,
        description: t.description,
        startAt: dueMs,
        endAt: dueMs + 60 * 60 * 1000,
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
  } catch (err: any) {
    console.error("[Agenda] CRM tasks query failed (non-fatal):", err.message);
  }

  // ── Google Calendar Events (non-critical) ──
  let gcalItems: AgendaItem[] = [];
  try {
    const gcalUserFilter = buildGcalUserFilter(filter.userId, userIds);
    const gcalRows = await db.execute(sql`
      SELECT id, title, description, "startAt", "endAt", "allDay", location, status, "htmlLink",
             "userId", "sourceCalendarId"
      FROM google_calendar_events
      WHERE "tenantId" = ${tenantId}
        ${gcalUserFilter}
        AND "startAt" < ${toDate}::date + INTERVAL '1 day'
        AND "endAt" >= ${fromDate}
      ORDER BY "startAt" ASC
    `);
    gcalItems = extractRows(gcalRows).map((e: any) => ({
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
  } catch (err: any) {
    console.error("[Agenda] Google Calendar query failed (non-fatal):", err.message);
  }

  // ── CRM Appointments ──
  const apptUserFilter = buildApptUserFilter(filter.userId, userIds);

  const apptRows = await db.execute(sql`
    SELECT DISTINCT a.id, a.title, a.description, a."startAt", a."endAt", a."allDay",
           a.location, a.color, a."dealId", a."contactId", a."isCompleted", a."completedAt",
           a."userId", a."serviceType", a.status, a.notes, a.price,
           a."professionalId", a."contactPhone",
           d.title AS "dealTitle",
           c.name  AS "contactName"
    FROM crm_appointments a
    LEFT JOIN crm_appointment_participants cap ON cap."appointmentId" = a.id
    LEFT JOIN deals d ON a."dealId" IS NOT NULL AND d.id = a."dealId" AND d."tenantId" = ${tenantId}
    LEFT JOIN contacts c ON a."contactId" IS NOT NULL AND c.id = a."contactId" AND c."tenantId" = ${tenantId}
    WHERE a."tenantId" = ${tenantId}
      AND a."deletedAt" IS NULL
      ${apptUserFilter}
      AND a."startAt" < ${toDate}::date + INTERVAL '1 day'
      AND a."endAt" >= ${fromDate}
    ORDER BY a."startAt" ASC
  `);

  // Fetch participants for each appointment
  const apptIds = extractRows(apptRows).map((a: any) => a.id);
  let participantsMap: Record<number, Array<{ userId: number; name: string }>> = {};
  if (apptIds.length > 0) {
    try {
      const inClause = apptIds.map((_: any, i: number) => sql`${apptIds[i]}`).reduce((acc: any, v: any) => sql`${acc}, ${v}`);
      const partRows = await db.execute(sql`
        SELECT cap."appointmentId", cap."userId", COALESCE(cu.name, u.name, 'Usuário') AS name
        FROM crm_appointment_participants cap
        LEFT JOIN crm_users cu ON cu.id = cap."userId" AND cu."tenantId" = ${tenantId}
        LEFT JOIN users u ON u.id = cap."userId"
        WHERE cap."appointmentId" IN (${inClause})
      `);
      for (const row of extractRows(partRows)) {
        if (!participantsMap[row.appointmentId]) participantsMap[row.appointmentId] = [];
        participantsMap[row.appointmentId].push({ userId: Number(row.userId), name: row.name });
      }
    } catch (err: any) {
      console.error("[Agenda] Participants query failed (non-fatal):", err.message);
    }
  }

  const apptItems: AgendaItem[] = extractRows(apptRows).map((a: any) => {
    const startMs = new Date(a.startAt).getTime();
    const endMs = new Date(a.endAt).getTime();
    const isCompleted = !!a.isCompleted || a.status === "completed";
    const isOverdue = !isCompleted && endMs < now;
    return {
      id: `appt-${a.id}`,
      source: "appointment" as const,
      title: a.title,
      description: a.description,
      startAt: startMs,
      endAt: endMs,
      allDay: !!a.allDay,
      status: a.status || (isCompleted ? "completed" : "scheduled"),
      isOverdue,
      isCompleted,
      location: a.location,
      dealTitle: a.dealTitle,
      contactName: a.contactName,
      contactId: a.contactId || undefined,
      entityType: a.dealId ? "deal" : a.contactId ? "contact" : undefined,
      entityId: a.dealId || a.contactId || undefined,
      userId: a.userId,
      color: a.color,
      participants: participantsMap[a.id] || [],
      serviceType: a.serviceType || undefined,
      notes: a.notes || undefined,
      price: a.price ? Number(a.price) : undefined,
      professionalId: a.professionalId || undefined,
      contactPhone: a.contactPhone || undefined,
    };
  });

  // ── Merge & sort by startAt ──
  const merged = [...crmItems, ...gcalItems, ...apptItems].sort((a, b) => a.startAt - b.startAt);
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
  const tokenRows = await db.execute(sql`
    SELECT id, "calendarEmail" FROM google_calendar_tokens
    WHERE "tenantId" = ${tenantId} AND "userId" = ${userId} AND "isActive" = true
    LIMIT 1
  `);
  const tokens = extractRows(tokenRows);
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

      // Upsert: INSERT ... ON CONFLICT DO UPDATE
      await db.execute(sql`
        INSERT INTO google_calendar_events
          ("tenantId", "userId", "googleEventId", title, description, "startAt", "endAt", "allDay", location, status, "htmlLink", "sourceCalendarId", "rawJson", "syncedAt")
        VALUES
          (${tenantId}, ${userId}, ${googleEventId}, ${evt.summary || "(Sem título)"}, ${evt.description || null},
           ${startAt}, ${endAt}, ${isAllDay}, ${evt.location || null}, ${evt.status || "confirmed"},
           ${evt.htmlLink || null}, ${calendarEmail}, ${JSON.stringify(evt)}, ${syncedAt})
        ON CONFLICT ("tenantId", "userId", "googleEventId") DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          "startAt" = EXCLUDED."startAt",
          "endAt" = EXCLUDED."endAt",
          "allDay" = EXCLUDED."allDay",
          location = EXCLUDED.location,
          status = EXCLUDED.status,
          "htmlLink" = EXCLUDED."htmlLink",
          "rawJson" = EXCLUDED."rawJson",
          "syncedAt" = EXCLUDED."syncedAt"
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
        WHERE "tenantId" = ${tenantId}
          AND "userId" = ${userId}
          AND "startAt" >= ${timeMin}
          AND "endAt" <= ${timeMax}
          AND "googleEventId" NOT IN (${sql.raw(fetchedIds.map(id => `'${id!.replace(/'/g, "''")}'`).join(","))})
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
    WHERE "tenantId" = ${tenantId} AND "userId" = ${userId}
  `);

  // Deactivate token
  await db.execute(sql`
    UPDATE google_calendar_tokens
    SET "isActive" = false
    WHERE "tenantId" = ${tenantId} AND "userId" = ${userId}
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

  const tokenRows = await db.execute(sql`
    SELECT "calendarEmail" FROM google_calendar_tokens
    WHERE "tenantId" = ${tenantId} AND "userId" = ${userId} AND "isActive" = true
    LIMIT 1
  `);
  const tokens = extractRows(tokenRows);
  if (tokens.length === 0) return { connected: false };

  // Get last sync time
  const syncRows = await db.execute(sql`
    SELECT MAX("syncedAt") AS lastSync FROM google_calendar_events
    WHERE "tenantId" = ${tenantId} AND "userId" = ${userId}
  `);
  const lastSync = extractRows(syncRows)[0]?.lastSync;

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
      t."assignedToUserId" = ${userId}
      OR t."createdByUserId" = ${userId}
      OR t.id IN (SELECT "taskId" FROM task_assignees WHERE "userId" = ${userId})
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
    return sql`AND "userId" = ${userId}`;
  }
  return sql``;
}

function buildApptUserFilter(userId?: number, userIds?: number[]) {
  if (userIds && userIds.length > 0) {
    const idList = userIds.join(",");
    return sql.raw(`AND (a."userId" IN (${idList}) OR cap."userId" IN (${idList}))`);
  }
  if (userId) {
    return sql`AND (a."userId" = ${userId} OR cap."userId" = ${userId})`;
  }
  return sql``;
}

// ═══════════════════════════════════════
// 5. CREATE APPOINTMENT
// ═══════════════════════════════════════

export async function createAppointment(
  tenantId: number,
  userId: number,
  input: CreateAppointmentInput,
): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  const result = await db.execute(sql`
    INSERT INTO crm_appointments
      ("tenantId", "userId", title, description, "startAt", "endAt", "allDay", location, color,
       "dealId", "contactId", "serviceType", status, "recurrenceRule", notes, price,
       "professionalId", "contactPhone")
    VALUES
      (${tenantId}, ${userId}, ${input.title}, ${input.description || null},
       ${startAt}, ${endAt}, ${input.allDay ?? false}, ${input.location || null},
       ${input.color || "emerald"}, ${input.dealId || null}, ${input.contactId || null},
       ${input.serviceType || null}, ${input.status || "scheduled"}, ${input.recurrenceRule || null},
       ${input.notes || null}, ${input.price?.toString() || null},
       ${input.professionalId || null}, ${input.contactPhone || null})
    RETURNING id
  `);

  const rows = extractRows(result);
  const insertId = rows[0].id;

  // Insert participants (always include creator)
  const participantSet = new Set(input.participantIds || []);
  participantSet.add(userId); // creator is always a participant
  for (const pid of Array.from(participantSet)) {
    await db.execute(sql`
      INSERT INTO crm_appointment_participants ("appointmentId", "userId", "tenantId")
      VALUES (${insertId}, ${pid}, ${tenantId})
      ON CONFLICT DO NOTHING
    `);
  }

  console.log(`[Agenda] Created appointment ${insertId} for user ${userId} (tenant ${tenantId}) with ${participantSet.size} participants`);
  return { id: insertId };
}

// ═══════════════════════════════════════
// 6. UPDATE APPOINTMENT
// ═══════════════════════════════════════

export async function updateAppointment(
  tenantId: number,
  userId: number,
  isAdmin: boolean,
  input: UpdateAppointmentInput,
): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify ownership (non-admin can only edit own)
  if (!isAdmin) {
    const checkResult = await db.execute(sql`
      SELECT id FROM crm_appointments
      WHERE id = ${input.id} AND "tenantId" = ${tenantId} AND "userId" = ${userId} AND "deletedAt" IS NULL
    `);
    const checkRows = extractRows(checkResult);
    if (checkRows.length === 0) {
      throw new Error("Appointment not found or access denied");
    }
  }

  const sets: string[] = [];
  const vals: any[] = [];

  if (input.title !== undefined) { sets.push('"title" = ?'); vals.push(input.title); }
  if (input.description !== undefined) { sets.push('"description" = ?'); vals.push(input.description || null); }
  if (input.startAt !== undefined) { sets.push('"startAt" = ?'); vals.push(new Date(input.startAt)); }
  if (input.endAt !== undefined) { sets.push('"endAt" = ?'); vals.push(new Date(input.endAt)); }
  if (input.allDay !== undefined) { sets.push('"allDay" = ?'); vals.push(input.allDay); }
  if (input.location !== undefined) { sets.push('"location" = ?'); vals.push(input.location || null); }
  if (input.color !== undefined) { sets.push('"color" = ?'); vals.push(input.color); }
  if (input.dealId !== undefined) { sets.push('"dealId" = ?'); vals.push(input.dealId || null); }
  if (input.contactId !== undefined) { sets.push('"contactId" = ?'); vals.push(input.contactId || null); }
  if (input.isCompleted !== undefined) {
    sets.push('"isCompleted" = ?');
    vals.push(input.isCompleted);
    sets.push('"completedAt" = ?');
    vals.push(input.isCompleted ? new Date() : null);
  }
  if (input.serviceType !== undefined) { sets.push('"serviceType" = ?'); vals.push(input.serviceType || null); }
  if (input.status !== undefined) { sets.push('"status" = ?'); vals.push(input.status); }
  if (input.recurrenceRule !== undefined) { sets.push('"recurrenceRule" = ?'); vals.push(input.recurrenceRule || null); }
  if (input.notes !== undefined) { sets.push('"notes" = ?'); vals.push(input.notes || null); }
  if (input.price !== undefined) { sets.push('"price" = ?'); vals.push(input.price); }
  if (input.professionalId !== undefined) { sets.push('"professionalId" = ?'); vals.push(input.professionalId || null); }
  if (input.contactPhone !== undefined) { sets.push('"contactPhone" = ?'); vals.push(input.contactPhone || null); }

  if (sets.length === 0 && input.participantIds === undefined) return { success: true };

  // Update participants if provided
  if (input.participantIds !== undefined) {
    // Get the appointment owner
    const ownerResult = await db.execute(sql`
      SELECT "userId" FROM crm_appointments WHERE id = ${input.id} AND "tenantId" = ${tenantId}
    `);
    const ownerArr = extractRows(ownerResult);
    const ownerId = ownerArr[0]?.userId;
    const participantSet = new Set(input.participantIds);
    if (ownerId) participantSet.add(ownerId); // owner always stays

    // Remove old participants
    await db.execute(sql`
      DELETE FROM crm_appointment_participants WHERE "appointmentId" = ${input.id}
    `);
    // Insert new participants
    for (const pid of Array.from(participantSet)) {
      await db.execute(sql`
        INSERT INTO crm_appointment_participants ("appointmentId", "userId", "tenantId")
        VALUES (${input.id}, ${pid}, ${tenantId})
        ON CONFLICT DO NOTHING
      `);
    }
  }

  if (sets.length === 0) return { success: true };

  // Build parameterized update using sql template
  const allVals = [...vals, input.id, tenantId];
  const setClause = sets.join(", ");
  const placeholders = allVals.map(v => {
    if (v === null) return "NULL";
    if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace("T", " ")}'`;
    if (typeof v === "boolean") return v ? "1" : "0";
    if (typeof v === "number") return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
  });
  // Replace ? placeholders with actual values
  let rawSql = `UPDATE crm_appointments SET ${setClause} WHERE id = ? AND "tenantId" = ?`;
  for (const pv of placeholders) {
    rawSql = rawSql.replace("?", pv);
  }
  await db.execute(sql.raw(rawSql));

  return { success: true };
}

// ═══════════════════════════════════════
// 7. DELETE APPOINTMENT (soft)
// ═══════════════════════════════════════

export async function deleteAppointment(
  tenantId: number,
  userId: number,
  isAdmin: boolean,
  appointmentId: number,
): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (!isAdmin) {
    const delCheck = await db.execute(sql`
      SELECT id FROM crm_appointments
      WHERE id = ${appointmentId} AND "tenantId" = ${tenantId} AND "userId" = ${userId} AND "deletedAt" IS NULL
    `);
    const delRows = extractRows(delCheck);
    if (delRows.length === 0) {
      throw new Error("Appointment not found or access denied");
    }
  }

  await db.execute(sql`
    UPDATE crm_appointments SET "deletedAt" = NOW()
    WHERE id = ${appointmentId} AND "tenantId" = ${tenantId}
  `);

  console.log(`[Agenda] Deleted appointment ${appointmentId} for user ${userId} (tenant ${tenantId})`);
  return { success: true };
}

// ═══════════════════════════════════════
// 8. GET APPOINTMENT PARTICIPANTS
// ═══════════════════════════════════════

export async function getAppointmentParticipants(
  tenantId: number,
  appointmentId: number,
): Promise<Array<{ userId: number; name: string }>> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.execute(sql`
    SELECT cap."userId", COALESCE(cu.name, u.name, 'Usuário') AS name
    FROM crm_appointment_participants cap
    LEFT JOIN crm_users cu ON cu.id = cap."userId" AND cu."tenantId" = ${tenantId}
    LEFT JOIN users u ON u.id = cap."userId"
    WHERE cap."appointmentId" = ${appointmentId} AND cap."tenantId" = ${tenantId}
    ORDER BY cap."createdAt" ASC
  `);

  return extractRows(rows).map((r: any) => ({
    userId: Number(r.userId),
    name: r.name,
  }));
}

// ═══════════════════════════════════════
// 9. SYNC: Datas do Serviço (deal) ↔ Agenda
// ═══════════════════════════════════════
// Mantém crm_appointments em sincronia com deal.appointmentDate / deal.followUpDate.
// Marcadores de serviceType isolam os auto-criados dos manuais (criados via dialog).
//
// Comportamentos:
//  - Data preenchida: insere se não existe, atualiza startAt/endAt se já existe.
//  - Data nula: soft-delete (deletedAt = NOW) do auto-criado correspondente.
//  - Status do appointment é preservado entre updates (ex.: se atendente já
//    confirmou, mudar a data não retrocede para "scheduled").
//
// Identificação por (tenantId, dealId, serviceType IN ('deal_appointment', 'deal_followup')).

const SERVICE_TYPE_APPT = "deal_appointment";
const SERVICE_TYPE_FOLLOWUP = "deal_followup";

interface SyncDealServiceDatesInput {
  dealId: number;
  contactId: number | null;
  ownerUserId: number;
  dealTitle: string;
  appointmentDate: Date | null | undefined; // undefined = não tocou no campo
  followUpDate: Date | null | undefined;
}

async function upsertDealServiceAppointment(
  tenantId: number,
  serviceType: string,
  defaultTitle: string,
  date: Date | null | undefined,
  ctx: { dealId: number; contactId: number | null; ownerUserId: number },
): Promise<void> {
  if (date === undefined) return; // campo não foi tocado nesta atualização
  const db = await getDb();
  if (!db) return;

  // Procura o appointment auto-gerado existente (não deletado).
  const existingRow = extractRows(await db.execute(sql`
    SELECT id FROM crm_appointments
    WHERE "tenantId" = ${tenantId}
      AND "dealId" = ${ctx.dealId}
      AND "serviceType" = ${serviceType}
      AND "deletedAt" IS NULL
    LIMIT 1
  `))[0] as any;

  if (date === null) {
    // Usuário limpou a data → soft-delete do auto-criado.
    if (existingRow?.id) {
      await db.execute(sql`
        UPDATE crm_appointments
        SET "deletedAt" = NOW(), "updatedAt" = NOW()
        WHERE id = ${Number(existingRow.id)}
      `);
    }
    return;
  }

  // Data preenchida — calcula startAt/endAt como dia inteiro (allDay=true).
  // Front passa só YYYY-MM-DD; agenda exibe na coluna do dia.
  const startAt = new Date(date);
  startAt.setHours(0, 0, 0, 0);
  const endAt = new Date(date);
  endAt.setHours(23, 59, 59, 999);

  if (existingRow?.id) {
    await db.execute(sql`
      UPDATE crm_appointments
      SET "startAt" = ${startAt},
          "endAt" = ${endAt},
          "allDay" = true,
          "title" = ${defaultTitle},
          "deletedAt" = NULL,
          "updatedAt" = NOW()
      WHERE id = ${Number(existingRow.id)}
    `);
    return;
  }

  // Insere novo auto-gerado.
  await db.execute(sql`
    INSERT INTO crm_appointments
      ("tenantId", "userId", "title", "startAt", "endAt", "allDay",
       "color", "dealId", "contactId", "serviceType", "status")
    VALUES
      (${tenantId}, ${ctx.ownerUserId}, ${defaultTitle},
       ${startAt}, ${endAt}, true,
       'emerald', ${ctx.dealId}, ${ctx.contactId},
       ${serviceType}, 'scheduled')
  `);
}

export async function syncDealServiceDates(
  tenantId: number,
  input: SyncDealServiceDatesInput,
): Promise<void> {
  const titleAppt = `Consulta — ${input.dealTitle}`.slice(0, 500);
  const titleFollowup = `Retorno/Revisão — ${input.dealTitle}`.slice(0, 500);

  await upsertDealServiceAppointment(
    tenantId,
    SERVICE_TYPE_APPT,
    titleAppt,
    input.appointmentDate,
    { dealId: input.dealId, contactId: input.contactId, ownerUserId: input.ownerUserId },
  );
  await upsertDealServiceAppointment(
    tenantId,
    SERVICE_TYPE_FOLLOWUP,
    titleFollowup,
    input.followUpDate,
    { dealId: input.dealId, contactId: input.contactId, ownerUserId: input.ownerUserId },
  );
}
