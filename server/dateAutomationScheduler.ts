import { getAllActiveDateAutomations, executeDateAutomation, updateDateAutomationLastRun } from "./crmDb";

/**
 * Run all active date automations for a specific tenant
 */
export async function runDateAutomationsForTenant(tenantId: number): Promise<{ total: number; moved: number; errors: number }> {
  const allAutomations = await getAllActiveDateAutomations();
  const tenantAutomations = allAutomations.filter(a => a.tenantId === tenantId);
  
  let totalMoved = 0;
  let errors = 0;

  for (const auto of tenantAutomations) {
    try {
      const result = await executeDateAutomation({
        id: auto.id,
        tenantId: auto.tenantId,
        pipelineId: auto.pipelineId,
        dateField: auto.dateField as any,
        condition: auto.condition as any,
        offsetDays: auto.offsetDays,
        sourceStageId: auto.sourceStageId,
        targetStageId: auto.targetStageId,
        dealStatusFilter: auto.dealStatusFilter,
      });
      totalMoved += result.moved;
      await updateDateAutomationLastRun(auto.id);
      if (result.moved > 0) {
        console.log(`[DateAutomation] "${auto.name}" (id=${auto.id}): moved ${result.moved} deals`);
      }
    } catch (err) {
      errors++;
      console.error(`[DateAutomation] Error running "${auto.name}" (id=${auto.id}):`, err);
    }
  }

  return { total: tenantAutomations.length, moved: totalMoved, errors };
}

/**
 * Run all active date automations across all tenants
 */
export async function runAllDateAutomations(): Promise<{ total: number; moved: number; errors: number }> {
  const automations = await getAllActiveDateAutomations();
  
  let totalMoved = 0;
  let errors = 0;

  for (const auto of automations) {
    try {
      const result = await executeDateAutomation({
        id: auto.id,
        tenantId: auto.tenantId,
        pipelineId: auto.pipelineId,
        dateField: auto.dateField as any,
        condition: auto.condition as any,
        offsetDays: auto.offsetDays,
        sourceStageId: auto.sourceStageId,
        targetStageId: auto.targetStageId,
        dealStatusFilter: auto.dealStatusFilter,
      });
      totalMoved += result.moved;
      await updateDateAutomationLastRun(auto.id);
      if (result.moved > 0) {
        console.log(`[DateAutomation] "${auto.name}" (tenant=${auto.tenantId}, id=${auto.id}): moved ${result.moved} deals`);
      }
    } catch (err) {
      errors++;
      console.error(`[DateAutomation] Error running "${auto.name}" (id=${auto.id}):`, err);
    }
  }

  return { total: automations.length, moved: totalMoved, errors };
}

/**
 * Start the date automation scheduler — runs every hour
 */
export function startDateAutomationScheduler() {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  async function run() {
    try {
      const result = await runAllDateAutomations();
      if (result.moved > 0 || result.errors > 0) {
        console.log(`[DateAutomation Scheduler] Completed: ${result.total} automations, ${result.moved} deals moved, ${result.errors} errors`);
      }
    } catch (err) {
      console.error("[DateAutomation Scheduler] Fatal error:", err);
    }
  }

  // Run once on startup after a delay
  setTimeout(run, 30_000);

  // Then run every hour
  setInterval(run, INTERVAL_MS);

  console.log("[DateAutomation Scheduler] Started — runs every 1 hour");
}
