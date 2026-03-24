/**
 * Task Due Soon Scheduler — Creates notifications for tasks due within 3 hours.
 * Runs periodically and checks for pending tasks approaching their due date.
 * Uses a tracking set to avoid duplicate notifications for the same task.
 */
import { getDb } from "./db";
import { tasks, tenants } from "../drizzle/schema";
import { sql, and, eq, gte, lte, inArray } from "drizzle-orm";
import { createNotification } from "./db";

const HOURS_AHEAD = 3;
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // Check every 15 minutes

// Track which tasks we've already notified about (in-memory, resets on server restart)
const notifiedTaskIds = new Set<number>();

/**
 * Check all tenants for tasks due within the next 3 hours and create notifications.
 */
export async function checkTasksDueSoon(): Promise<{ notificationsCreated: number }> {
  const db = await getDb();
  if (!db) return { notificationsCreated: 0 };

  const now = new Date();
  const threeHoursLater = new Date(now.getTime() + HOURS_AHEAD * 60 * 60 * 1000);

  let notificationsCreated = 0;

  try {
    // Find all pending/in_progress tasks due within the next 3 hours
    const dueTasks = await db.select({
      id: tasks.id,
      tenantId: tasks.tenantId,
      title: tasks.title,
      dueAt: tasks.dueAt,
      entityType: tasks.entityType,
      entityId: tasks.entityId,
      status: tasks.status,
    })
    .from(tasks)
    .where(
      and(
        inArray(tasks.status, ["pending", "in_progress"]),
        gte(tasks.dueAt, now),
        lte(tasks.dueAt, threeHoursLater),
      )
    );

    for (const task of dueTasks) {
      // Skip if already notified
      if (notifiedTaskIds.has(task.id)) continue;

      // Calculate time remaining
      const diffMs = task.dueAt!.getTime() - now.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;

      let timeStr: string;
      if (hours > 0 && mins > 0) {
        timeStr = `${hours}h ${mins}min`;
      } else if (hours > 0) {
        timeStr = `${hours}h`;
      } else {
        timeStr = `${mins}min`;
      }

      await createNotification(task.tenantId, {
        type: "task_due_soon",
        title: `⏰ Tarefa vencendo em ${timeStr}: ${task.title}`,
        body: `A tarefa "${task.title}" vence em ${timeStr}. Não deixe passar!`,
        entityType: "task",
        entityId: String(task.id),
      });

      notifiedTaskIds.add(task.id);
      notificationsCreated++;
    }

    // Clean up old entries from the tracking set (tasks that are now past due)
    if (notifiedTaskIds.size > 5000) {
      const activeDueTaskIds = new Set(dueTasks.map(t => t.id));
      Array.from(notifiedTaskIds).forEach(id => {
        if (!activeDueTaskIds.has(id)) {
          notifiedTaskIds.delete(id);
        }
      });
    }
  } catch (err) {
    console.error("[TaskDueScheduler] Error:", err);
  }

  return { notificationsCreated };
}

/**
 * Start the task due notification scheduler.
 * Checks every 15 minutes for tasks due within 3 hours.
 */
export function startTaskDueScheduler() {
  async function tick() {
    try {
      const result = await checkTasksDueSoon();
      if (result.notificationsCreated > 0) {
        console.log(`[TaskDueScheduler] Created ${result.notificationsCreated} task due notifications`);
      }
    } catch (err) {
      console.error("[TaskDueScheduler] Tick error:", err);
    }
  }

  // Run once after startup delay
  setTimeout(tick, 90_000);
  // Then every 15 minutes
  setInterval(tick, CHECK_INTERVAL_MS);
  console.log("[TaskDueScheduler] Started — checking every 15min for tasks due within 3h");
}
