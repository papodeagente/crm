/**
 * Google Calendar Integration via MCP (Model Context Protocol)
 *
 * Uses the pre-configured google-calendar MCP server to interact with
 * Google Calendar API. This avoids the need for OAuth2 client credentials
 * since the MCP server handles authentication automatically.
 *
 * Available MCP tools:
 * - google_calendar_search_events: Search/list events
 * - google_calendar_create_events: Create new events
 * - google_calendar_get_event: Get a specific event
 * - google_calendar_update_events: Update existing events
 * - google_calendar_delete_events: Delete events
 */

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const MCP_CLI = "manus-mcp-cli";
const SERVER = "google-calendar";

interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start_time: string; // RFC3339
  end_time: string;   // RFC3339
  location?: string;
  attendees?: string[];
  reminders?: number[];
}

interface CalendarEventResult {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
  status?: string;
  location?: string;
}

/**
 * Execute an MCP tool call and return parsed JSON result
 */
async function callMcpTool(toolName: string, input: Record<string, any>): Promise<any> {
  try {
    const inputJson = JSON.stringify(input);
    const { stdout, stderr } = await execFileAsync(MCP_CLI, [
      "tool", "call", toolName,
      "--server", SERVER,
      "--input", inputJson,
    ], {
      timeout: 30_000,
      maxBuffer: 1024 * 1024, // 1MB
    });

    if (stderr && stderr.includes("Error")) {
      console.error(`[GCal MCP] stderr for ${toolName}:`, stderr);
    }

    // Parse the MCP response - it may contain JSON in the output
    const trimmed = stdout.trim();
    if (!trimmed) return null;

    // MCP CLI outputs the result as JSON or text
    try {
      return JSON.parse(trimmed);
    } catch {
      // If not JSON, return raw text
      return { raw: trimmed };
    }
  } catch (error: any) {
    console.error(`[GCal MCP] Error calling ${toolName}:`, error.message);
    throw new Error(`Google Calendar API error: ${error.message}`);
  }
}

/**
 * Create a Google Calendar event from a CRM task
 */
export async function createCalendarEvent(event: CalendarEvent): Promise<string | null> {
  try {
    const input: any = {
      events: [{
        summary: event.summary,
        start_time: event.start_time,
        end_time: event.end_time,
      }],
    };

    if (event.description) input.events[0].description = event.description;
    if (event.location) input.events[0].location = event.location;
    if (event.attendees?.length) input.events[0].attendees = event.attendees;
    if (event.reminders?.length) input.events[0].reminders = event.reminders;

    const result = await callMcpTool("google_calendar_create_events", input);
    console.log("[GCal] Event created:", JSON.stringify(result).slice(0, 200));

    // Extract event ID from result
    if (result?.created_events?.[0]?.id) {
      return result.created_events[0].id;
    }
    if (result?.events?.[0]?.id) {
      return result.events[0].id;
    }
    // Try to find ID in raw response
    if (result?.raw) {
      const match = result.raw.match(/"id"\s*:\s*"([^"]+)"/);
      if (match) return match[1];
    }
    // If result itself has an id
    if (result?.id) return result.id;
    if (Array.isArray(result) && result[0]?.id) return result[0].id;

    console.warn("[GCal] Could not extract event ID from result:", JSON.stringify(result).slice(0, 500));
    return null;
  } catch (error: any) {
    console.error("[GCal] Failed to create event:", error.message);
    return null;
  }
}

/**
 * Update an existing Google Calendar event
 */
export async function updateCalendarEvent(
  eventId: string,
  updates: Partial<CalendarEvent>
): Promise<boolean> {
  try {
    const eventUpdate: any = { event_id: eventId };
    if (updates.summary) eventUpdate.summary = updates.summary;
    if (updates.description !== undefined) eventUpdate.description = updates.description;
    if (updates.start_time) eventUpdate.start_time = updates.start_time;
    if (updates.end_time) eventUpdate.end_time = updates.end_time;
    if (updates.location !== undefined) eventUpdate.location = updates.location;
    if (updates.attendees) eventUpdate.attendees = updates.attendees;

    await callMcpTool("google_calendar_update_events", {
      events: [eventUpdate],
    });

    console.log("[GCal] Event updated:", eventId);
    return true;
  } catch (error: any) {
    console.error("[GCal] Failed to update event:", eventId, error.message);
    return false;
  }
}

/**
 * Delete a Google Calendar event
 */
export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  try {
    await callMcpTool("google_calendar_delete_events", {
      events: [{ event_id: eventId }],
    });

    console.log("[GCal] Event deleted:", eventId);
    return true;
  } catch (error: any) {
    console.error("[GCal] Failed to delete event:", eventId, error.message);
    return false;
  }
}

/**
 * Get a specific Google Calendar event
 */
export async function getCalendarEvent(eventId: string): Promise<CalendarEventResult | null> {
  try {
    const result = await callMcpTool("google_calendar_get_event", {
      event_id: eventId,
    });
    return result;
  } catch (error: any) {
    console.error("[GCal] Failed to get event:", eventId, error.message);
    return null;
  }
}

/**
 * Search/list Google Calendar events
 */
export async function searchCalendarEvents(params: {
  query?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}): Promise<CalendarEventResult[]> {
  try {
    const input: any = {};
    if (params.query) input.q = params.query;
    if (params.timeMin) input.time_min = params.timeMin;
    if (params.timeMax) input.time_max = params.timeMax;
    if (params.maxResults) input.max_results = params.maxResults;

    const result = await callMcpTool("google_calendar_search_events", input);

    // Extract events array from result
    if (Array.isArray(result)) return result;
    if (result?.events) return result.events;
    if (result?.items) return result.items;
    if (result?.raw) {
      try {
        const parsed = JSON.parse(result.raw);
        if (Array.isArray(parsed)) return parsed;
        if (parsed?.events) return parsed.events;
        if (parsed?.items) return parsed.items;
      } catch { /* ignore */ }
    }

    return [];
  } catch (error: any) {
    console.error("[GCal] Failed to search events:", error.message);
    return [];
  }
}

// ─── Task ↔ Event Conversion Helpers ───

/**
 * Convert a CRM task to a Google Calendar event format
 */
export function taskToCalendarEvent(task: {
  title: string;
  description?: string | null;
  dueAt?: Date | string | null;
  priority?: string;
  status?: string;
  entityType?: string;
  entityId?: number;
}): CalendarEvent {
  // If task has a due date, create a timed event; otherwise create an all-day event for today
  let startTime: string;
  let endTime: string;

  if (task.dueAt) {
    const dueDate = task.dueAt instanceof Date ? task.dueAt : new Date(task.dueAt);
    startTime = dueDate.toISOString();
    // Default duration: 1 hour
    endTime = new Date(dueDate.getTime() + 60 * 60 * 1000).toISOString();
  } else {
    // All-day event for today
    const today = new Date();
    startTime = today.toISOString().split("T")[0];
    endTime = startTime;
  }

  // Build description with CRM context
  const descParts: string[] = [];
  if (task.description) descParts.push(task.description);
  descParts.push("");
  descParts.push("---");
  descParts.push(`Tarefa do CRM ASTRA`);
  if (task.priority) descParts.push(`Prioridade: ${task.priority}`);
  if (task.status) descParts.push(`Status: ${task.status}`);
  if (task.entityType && task.entityId) {
    descParts.push(`Vinculada a: ${task.entityType} #${task.entityId}`);
  }

  // Priority emoji prefix
  const priorityEmoji = task.priority === "urgent" ? "🔴 "
    : task.priority === "high" ? "🟠 "
    : task.priority === "medium" ? "🟡 "
    : "";

  return {
    summary: `${priorityEmoji}${task.title}`,
    description: descParts.join("\n"),
    start_time: startTime,
    end_time: endTime,
    reminders: [30], // 30 minutes before
  };
}

/**
 * Check if the MCP Google Calendar integration is available
 */
export async function isGoogleCalendarAvailable(): Promise<boolean> {
  try {
    // Try a simple search to verify connectivity
    const result = await callMcpTool("google_calendar_search_events", {
      max_results: 1,
    });
    return true;
  } catch {
    return false;
  }
}
