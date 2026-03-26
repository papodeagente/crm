/**
 * Bulk Deal Actions Service
 * 
 * Handles bulk operations on deals with:
 * - Multi-tenant isolation
 * - RBAC permission checks
 * - Hybrid selection model (selectedIds or allMatchingFilter + exclusionIds)
 * - Audit logging via EventLog and DealHistory
 */
import * as crm from "../crmDb";
import { emitEvent } from "../middleware/eventLog";
import { createNotification } from "../db";
import { resolveVisibilityFilter } from "./visibilityService";

// ─── Selection Resolution ───

export interface BulkSelectionInput {
  selectedIds?: number[];
  allMatchingFilter?: boolean;
  exclusionIds?: number[];
  // Filter snapshot (used when allMatchingFilter=true)
  filterSnapshot?: {
    pipelineId?: number;
    stageId?: number;
    status?: string;
    titleSearch?: string;
    accountId?: number;
    leadSource?: string;
    ownerUserId?: number;
    dateFrom?: string;
    dateTo?: string;
    valueMin?: number;
    valueMax?: number;
  };
}

export interface BulkActionContext {
  tenantId: number;
  userId: number;
  userName: string;
  isAdmin: boolean;
  saasUserId?: number;
}

export interface BulkActionResult {
  success: boolean;
  totalSelected: number;
  totalProcessed: number;
  totalSkipped: number;
  errors: Array<{ dealId: number; reason: string }>;
}

/**
 * Resolves the final set of deal IDs from the hybrid selection model.
 * Always validates tenant ownership and RBAC.
 */
export async function resolveSelection(
  input: BulkSelectionInput,
  ctx: BulkActionContext
): Promise<number[]> {
  let dealIds: number[] = [];

  if (input.allMatchingFilter && input.filterSnapshot) {
    // Mode 2: Fetch all IDs matching the filter
    const { ownerUserIds } = await resolveVisibilityFilter(
      ctx.saasUserId || ctx.userId,
      ctx.tenantId,
      "deals",
      ctx.isAdmin
    );
    const filterOpts: any = {
      ...input.filterSnapshot,
      limit: 10000, // Safety cap
    };
    if (ownerUserIds) {
      if (input.filterSnapshot.ownerUserId && ownerUserIds.includes(input.filterSnapshot.ownerUserId)) {
        filterOpts.ownerUserId = input.filterSnapshot.ownerUserId;
      } else {
        filterOpts.ownerUserIds = ownerUserIds;
        delete filterOpts.ownerUserId;
      }
    }
    const allDeals = await crm.listDeals(ctx.tenantId, filterOpts);
    dealIds = allDeals.map((d: any) => d.id);

    // Remove exclusion IDs
    if (input.exclusionIds && input.exclusionIds.length > 0) {
      const exclusionSet = new Set(input.exclusionIds);
      dealIds = dealIds.filter(id => !exclusionSet.has(id));
    }
  } else if (input.selectedIds && input.selectedIds.length > 0) {
    // Mode 1: Explicit IDs — validate each belongs to tenant
    dealIds = input.selectedIds;
  } else {
    return [];
  }

  // Validate all IDs belong to the tenant and are not deleted
  if (dealIds.length === 0) return [];
  const validDeals = await crm.listDeals(ctx.tenantId, { limit: 10000 });
  const validIdSet = new Set(validDeals.map((d: any) => d.id));

  // For non-admin, also filter by visibility
  if (!ctx.isAdmin) {
    const { ownerUserIds } = await resolveVisibilityFilter(
      ctx.saasUserId || ctx.userId,
      ctx.tenantId,
      "deals",
      false
    );
    if (ownerUserIds) {
      const ownedSet = new Set(validDeals.filter((d: any) => ownerUserIds.includes(d.ownerUserId)).map((d: any) => d.id));
      return dealIds.filter(id => ownedSet.has(id));
    }
  }

  return dealIds.filter(id => validIdSet.has(id));
}

// ─── Bulk Transfer ───

export async function bulkTransfer(
  dealIds: number[],
  newOwnerUserId: number,
  ctx: BulkActionContext
): Promise<BulkActionResult> {
  const result: BulkActionResult = { success: true, totalSelected: dealIds.length, totalProcessed: 0, totalSkipped: 0, errors: [] };

  for (const dealId of dealIds) {
    try {
      const deal = await crm.getDealById(ctx.tenantId, dealId);
      if (!deal) { result.totalSkipped++; result.errors.push({ dealId, reason: "Não encontrada" }); continue; }
      const oldOwner = deal.ownerUserId;
      await crm.updateDeal(ctx.tenantId, dealId, { ownerUserId: newOwnerUserId, updatedBy: ctx.userId });
      await crm.createDealHistory({
        tenantId: ctx.tenantId, dealId, action: "field_changed",
        description: `Responsável transferido em lote`,
        fieldChanged: "ownerUserId",
        oldValue: String(oldOwner || ""),
        newValue: String(newOwnerUserId),
        actorUserId: ctx.userId, actorName: ctx.userName,
      });
      await emitEvent({ tenantId: ctx.tenantId, actorUserId: ctx.userId, entityType: "deal", entityId: dealId, action: "bulk_transfer" });
      result.totalProcessed++;
    } catch (e: any) {
      result.totalSkipped++;
      result.errors.push({ dealId, reason: e.message || "Erro desconhecido" });
    }
  }
  return result;
}

// ─── Bulk Change Status ───

export async function bulkChangeStatus(
  dealIds: number[],
  newStatus: "open" | "won" | "lost",
  lossReasonId: number | undefined,
  lossNotes: string | undefined,
  ctx: BulkActionContext
): Promise<BulkActionResult> {
  const result: BulkActionResult = { success: true, totalSelected: dealIds.length, totalProcessed: 0, totalSkipped: 0, errors: [] };

  for (const dealId of dealIds) {
    try {
      const deal = await crm.getDealById(ctx.tenantId, dealId);
      if (!deal) { result.totalSkipped++; result.errors.push({ dealId, reason: "Não encontrada" }); continue; }
      const oldStatus = deal.status;
      const updateData: any = { status: newStatus, updatedBy: ctx.userId };
      if (newStatus === "lost" && lossReasonId) updateData.lossReasonId = lossReasonId;
      if (newStatus === "lost" && lossNotes) updateData.lossNotes = lossNotes;
      await crm.updateDeal(ctx.tenantId, dealId, updateData);
      await crm.createDealHistory({
        tenantId: ctx.tenantId, dealId, action: "field_changed",
        description: `Status alterado em lote de "${oldStatus}" para "${newStatus}"`,
        fieldChanged: "status",
        oldValue: oldStatus,
        newValue: newStatus,
        actorUserId: ctx.userId, actorName: ctx.userName,
      });
      await emitEvent({ tenantId: ctx.tenantId, actorUserId: ctx.userId, entityType: "deal", entityId: dealId, action: "bulk_status_change" });
      result.totalProcessed++;
    } catch (e: any) {
      result.totalSkipped++;
      result.errors.push({ dealId, reason: e.message || "Erro desconhecido" });
    }
  }
  return result;
}

// ─── Bulk Move Stage ───

export async function bulkMoveStage(
  dealIds: number[],
  toStageId: number,
  toStageName: string,
  ctx: BulkActionContext
): Promise<BulkActionResult> {
  const result: BulkActionResult = { success: true, totalSelected: dealIds.length, totalProcessed: 0, totalSkipped: 0, errors: [] };

  for (const dealId of dealIds) {
    try {
      const deal = await crm.getDealById(ctx.tenantId, dealId);
      if (!deal) { result.totalSkipped++; result.errors.push({ dealId, reason: "Não encontrada" }); continue; }
      if (deal.stageId === toStageId) { result.totalSkipped++; continue; }
      
      const stages = await crm.listStages(ctx.tenantId, deal.pipelineId);
      const fromStage = stages.find((s: any) => s.id === deal.stageId);
      const fromStageName = fromStage?.name || `Etapa #${deal.stageId}`;

      await crm.updateDeal(ctx.tenantId, dealId, { stageId: toStageId, updatedBy: ctx.userId });
      await crm.createDealHistory({
        tenantId: ctx.tenantId, dealId, action: "stage_moved",
        description: `Movido em lote de "${fromStageName}" para "${toStageName}"`,
        fromStageId: deal.stageId, toStageId,
        fromStageName, toStageName,
        actorUserId: ctx.userId, actorName: ctx.userName,
      });
      await emitEvent({ tenantId: ctx.tenantId, actorUserId: ctx.userId, entityType: "deal", entityId: dealId, action: "bulk_stage_move" });
      result.totalProcessed++;
    } catch (e: any) {
      result.totalSkipped++;
      result.errors.push({ dealId, reason: e.message || "Erro desconhecido" });
    }
  }
  return result;
}

// ─── Bulk Update Fields ───

export async function bulkUpdateFields(
  dealIds: number[],
  fields: {
    leadSource?: string;
    channelOrigin?: string;
    accountId?: number | null;
  },
  ctx: BulkActionContext
): Promise<BulkActionResult> {
  const result: BulkActionResult = { success: true, totalSelected: dealIds.length, totalProcessed: 0, totalSkipped: 0, errors: [] };

  for (const dealId of dealIds) {
    try {
      const deal = await crm.getDealById(ctx.tenantId, dealId);
      if (!deal) { result.totalSkipped++; result.errors.push({ dealId, reason: "Não encontrada" }); continue; }
      
      const updateData: any = { updatedBy: ctx.userId };
      const changedFields: string[] = [];
      
      if (fields.leadSource !== undefined) {
        updateData.leadSource = fields.leadSource;
        changedFields.push("leadSource");
      }
      if (fields.channelOrigin !== undefined) {
        updateData.channelOrigin = fields.channelOrigin;
        changedFields.push("channelOrigin");
      }
      if (fields.accountId !== undefined) {
        updateData.accountId = fields.accountId;
        changedFields.push("accountId");
      }

      if (changedFields.length === 0) { result.totalSkipped++; continue; }

      await crm.updateDeal(ctx.tenantId, dealId, updateData);
      await crm.createDealHistory({
        tenantId: ctx.tenantId, dealId, action: "field_changed",
        description: `Campos alterados em lote: ${changedFields.join(", ")}`,
        fieldChanged: changedFields.join(","),
        actorUserId: ctx.userId, actorName: ctx.userName,
      });
      await emitEvent({ tenantId: ctx.tenantId, actorUserId: ctx.userId, entityType: "deal", entityId: dealId, action: "bulk_update" });
      result.totalProcessed++;
    } catch (e: any) {
      result.totalSkipped++;
      result.errors.push({ dealId, reason: e.message || "Erro desconhecido" });
    }
  }
  return result;
}

// ─── Bulk Create Task ───

export async function bulkCreateTask(
  dealIds: number[],
  taskData: {
    title: string;
    taskType?: string;
    dueAt?: Date;
    priority?: "low" | "medium" | "high" | "urgent";
    description?: string;
    assignToOwner?: boolean;
  },
  ctx: BulkActionContext
): Promise<BulkActionResult> {
  const result: BulkActionResult = { success: true, totalSelected: dealIds.length, totalProcessed: 0, totalSkipped: 0, errors: [] };

  for (const dealId of dealIds) {
    try {
      const deal = await crm.getDealById(ctx.tenantId, dealId);
      if (!deal) { result.totalSkipped++; result.errors.push({ dealId, reason: "Não encontrada" }); continue; }

      const assignedTo = taskData.assignToOwner && deal.ownerUserId ? deal.ownerUserId : ctx.userId;
      
      await crm.createTask({
        tenantId: ctx.tenantId,
        entityType: "deal",
        entityId: dealId,
        title: taskData.title,
        taskType: taskData.taskType || "task",
        dueAt: taskData.dueAt,
        assignedToUserId: assignedTo,
        createdByUserId: ctx.userId,
        priority: taskData.priority || "medium",
        description: taskData.description,
      });
      await crm.createDealHistory({
        tenantId: ctx.tenantId, dealId, action: "task_created",
        description: `Tarefa "${taskData.title}" criada em lote`,
        actorUserId: ctx.userId, actorName: ctx.userName,
      });
      await emitEvent({ tenantId: ctx.tenantId, actorUserId: ctx.userId, entityType: "deal", entityId: dealId, action: "bulk_create_task" });
      result.totalProcessed++;
    } catch (e: any) {
      result.totalSkipped++;
      result.errors.push({ dealId, reason: e.message || "Erro desconhecido" });
    }
  }
  return result;
}

// ─── Bulk Export ───

export async function bulkExport(
  dealIds: number[],
  ctx: BulkActionContext
): Promise<{ deals: any[]; totalExported: number }> {
  const deals: any[] = [];
  for (const dealId of dealIds) {
    const deal = await crm.getDealById(ctx.tenantId, dealId);
    if (deal) deals.push(deal);
  }
  await emitEvent({ tenantId: ctx.tenantId, actorUserId: ctx.userId, entityType: "deal", entityId: 0, action: "bulk_export", details: `Exported ${deals.length} deals` } as any);
  return { deals, totalExported: deals.length };
}
