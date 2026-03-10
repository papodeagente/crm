/**
 * Google Calendar Sync Service
 *
 * Handles bidirectional synchronization between CRM tasks and Google Calendar events.
 * - When a task is created/updated with a due date → create/update Google Calendar event
 * - When a task is completed/cancelled → update the event description
 * - When a task is deleted → delete the Google Calendar event
 * - Manual sync: push all pending tasks to Google Calendar
 */

import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  searchCalendarEvents,
  taskToCalendarEvent,
  isGoogleCalendarAvailable,
} from "./googleCalendar";

// ─── Sync a single task to Google Calendar ───

export async function syncTaskToCalendar(task: {
  id: number;
  title: string;
  description?: string | null;
  dueAt?: Date | string | null;
  priority?: string;
  status?: string;
  entityType?: string;
  entityId?: number;
  googleEventId?: string | null;
}): Promise<{ eventId: string | null; synced: boolean }> {
  try {
    const calEvent = taskToCalendarEvent(task);

    if (task.googleEventId) {
      // Update existing event
      const success = await updateCalendarEvent(task.googleEventId, calEvent);
      return { eventId: task.googleEventId, synced: success };
    } else {
      // Create new event
      const eventId = await createCalendarEvent(calEvent);
      return { eventId, synced: !!eventId };
    }
  } catch (error: any) {
    console.error(`[GCal Sync] Failed to sync task ${task.id}:`, error.message);
    return { eventId: null, synced: false };
  }
}

// ─── Mark a task as completed in Google Calendar ───

export async function markTaskCompletedInCalendar(task: {
  id: number;
  title: string;
  googleEventId?: string | null;
  status: string;
}): Promise<boolean> {
  if (!task.googleEventId) return false;

  try {
    const statusEmoji = task.status === "done" ? "✅" : "❌";
    const success = await updateCalendarEvent(task.googleEventId, {
      summary: `${statusEmoji} ${task.title}`,
      description: `Tarefa ${task.status === "done" ? "concluída" : "cancelada"} no CRM ASTRA`,
    });
    return success;
  } catch (error: any) {
    console.error(`[GCal Sync] Failed to mark task ${task.id} as completed:`, error.message);
    return false;
  }
}

// ─── Remove a task from Google Calendar ───

export async function removeTaskFromCalendar(googleEventId: string): Promise<boolean> {
  try {
    return await deleteCalendarEvent(googleEventId);
  } catch (error: any) {
    console.error(`[GCal Sync] Failed to remove event:`, error.message);
    return false;
  }
}

// ─── Bulk sync: push all unsynced tasks to Google Calendar ───

export async function bulkSyncTasksToCalendar(tasks: Array<{
  id: number;
  title: string;
  description?: string | null;
  dueAt?: Date | string | null;
  priority?: string;
  status?: string;
  entityType?: string;
  entityId?: number;
  googleEventId?: string | null;
}>): Promise<{ synced: number; failed: number; results: Array<{ taskId: number; eventId: string | null; success: boolean }> }> {
  let synced = 0;
  let failed = 0;
  const results: Array<{ taskId: number; eventId: string | null; success: boolean }> = [];

  for (const task of tasks) {
    // Skip completed/cancelled tasks
    if (task.status === "done" || task.status === "cancelled") {
      continue;
    }

    const result = await syncTaskToCalendar(task);
    if (result.synced) {
      synced++;
      results.push({ taskId: task.id, eventId: result.eventId, success: true });
    } else {
      failed++;
      results.push({ taskId: task.id, eventId: null, success: false });
    }

    // Small delay between API calls to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return { synced, failed, results };
}

// ─── Fetch events from Google Calendar for import ───

export async function fetchCalendarEventsForImport(params: {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}): Promise<Array<{
  eventId: string;
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
}>> {
  try {
    const events = await searchCalendarEvents({
      timeMin: params.timeMin || new Date().toISOString(),
      timeMax: params.timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      maxResults: params.maxResults || 50,
    });

    return events.map((e: any) => ({
      eventId: e.id || "",
      summary: e.summary || e.title || "(Sem título)",
      description: e.description || "",
      startTime: e.start?.dateTime || e.start?.date || e.start_time || "",
      endTime: e.end?.dateTime || e.end?.date || e.end_time || "",
      location: e.location || "",
    }));
  } catch (error: any) {
    console.error("[GCal Sync] Failed to fetch events for import:", error.message);
    return [];
  }
}

// ─── Check Google Calendar connectivity ───

export async function checkGoogleCalendarStatus(): Promise<{
  available: boolean;
  message: string;
}> {
  try {
    const available = await isGoogleCalendarAvailable();
    return {
      available,
      message: available
        ? "Google Calendar conectado e funcionando"
        : "Google Calendar não disponível",
    };
  } catch {
    return {
      available: false,
      message: "Erro ao verificar conexão com Google Calendar",
    };
  }
}
