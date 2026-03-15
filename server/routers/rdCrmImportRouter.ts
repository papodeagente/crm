/**
 * RD Station CRM Import Router — v2 (Rewritten)
 *
 * Key improvements over v1:
 * 1. rdExternalId column added to all relevant tables for deduplication
 * 2. Upsert logic: if rdExternalId already exists, skip (no duplicates)
 * 3. Users from RD Station are imported as CRM users and mapped as deal/task owners
 * 4. Contact matching uses rdExternalId (contact._id) instead of email/name heuristics
 * 5. Original RD Station owner preserved in deals and tasks
 * 6. Post-import validation report
 * 7. Detailed logging throughout
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as rdCrm from "../rdStationCrmImport";
import * as crm from "../crmDb";
import { getDb } from "../db";
import {
  contacts, accounts, deals, pipelines, pipelineStages,
  tasks as crmTasks, productCatalog, leadSources, campaigns, lossReasons, crmUsers,
} from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// ─── In-memory progress store ───
interface ImportProgress {
  status: "idle" | "fetching" | "importing" | "done" | "error";
  phase: string;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  currentCategory: string;
  categoryTotal: number;
  categoryDone: number;
  results: Record<string, { imported: number; skipped: number; updated: number; errors: string[] }>;
  error?: string;
  startedAt: number;
  validation?: ImportValidation;
}

interface ImportValidation {
  rdCounts: Record<string, number>;
  enturCounts: Record<string, number>;
  mismatches: string[];
  duplicatesRemoved: Record<string, number>;
}

const progressStore = new Map<string, ImportProgress>();

function getProgressKey(userId: number): string {
  return `import_${userId}`;
}

function initProgress(userId: number): ImportProgress {
  const p: ImportProgress = {
    status: "idle",
    phase: "Preparando...",
    currentStep: "",
    totalSteps: 0,
    completedSteps: 0,
    currentCategory: "",
    categoryTotal: 0,
    categoryDone: 0,
    results: {},
    startedAt: Date.now(),
  };
  progressStore.set(getProgressKey(userId), p);
  return p;
}

function updateProgress(userId: number, update: Partial<ImportProgress>) {
  const key = getProgressKey(userId);
  const current = progressStore.get(key);
  if (current) {
    Object.assign(current, update);
  }
}

// ─── Schema migration: ensure rdExternalId columns exist ───
async function ensureRdExternalIdColumns() {
  const db = await getDb();
  if (!db) return;

  const tables = [
    "contacts", "accounts", "deals", "pipelines", "pipeline_stages",
    "crm_tasks", "product_catalog", "lead_sources", "campaigns",
    "loss_reasons", "crm_users",
  ];

  for (const table of tables) {
    try {
      await db.execute(sql.raw(
        `ALTER TABLE \`${table}\` ADD COLUMN \`rdExternalId\` VARCHAR(64) NULL`
      ));
      console.log(`[RD Import] Added rdExternalId column to ${table}`);
    } catch (e: any) {
      // Column already exists — ignore
      if (!e.message?.includes("Duplicate column")) {
        console.log(`[RD Import] rdExternalId on ${table}: ${e.message?.substring(0, 80)}`);
      }
    }
  }

  // Add indexes for deduplication lookups
  const indexPairs = [
    ["contacts", "idx_contacts_rd_ext", "tenantId, rdExternalId"],
    ["accounts", "idx_accounts_rd_ext", "tenantId, rdExternalId"],
    ["deals", "idx_deals_rd_ext", "tenantId, rdExternalId"],
    ["pipelines", "idx_pipelines_rd_ext", "tenantId, rdExternalId"],
    ["pipeline_stages", "idx_stages_rd_ext", "tenantId, rdExternalId"],
    ["crm_tasks", "idx_tasks_rd_ext", "tenantId, rdExternalId"],
    ["product_catalog", "idx_products_rd_ext", "tenantId, rdExternalId"],
    ["lead_sources", "idx_ls_rd_ext", "tenantId, rdExternalId"],
    ["campaigns", "idx_camp_rd_ext", "tenantId, rdExternalId"],
    ["loss_reasons", "idx_lr_rd_ext", "tenantId, rdExternalId"],
    ["crm_users", "idx_crm_users_rd_ext", "tenantId, rdExternalId"],
  ];

  for (const [table, indexName, cols] of indexPairs) {
    try {
      await db.execute(sql.raw(`CREATE INDEX \`${indexName}\` ON \`${table}\` (${cols})`));
    } catch {}
  }
}

// ─── Helper: find existing record by rdExternalId ───
async function findByRdExternalId(table: string, tenantId: number, rdExternalId: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [rows]: any = await db.execute(
      sql.raw(`SELECT id FROM \`${table}\` WHERE tenantId = ${tenantId} AND rdExternalId = '${rdExternalId.replace(/'/g, "''")}' LIMIT 1`)
    );
    if (rows && rows.length > 0) return rows[0].id;
  } catch {}
  return null;
}

// ─── Helper: set rdExternalId on a record ───
async function setRdExternalId(table: string, id: number, rdExternalId: string) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(
      sql.raw(`UPDATE \`${table}\` SET rdExternalId = '${rdExternalId.replace(/'/g, "''")}' WHERE id = ${id}`)
    );
  } catch {}
}

export const rdCrmImportRouter = router({
  // ─── Validate Token ───
  validateToken: protectedProcedure
    .input(z.object({ token: z.string().min(10) }))
    .mutation(async ({ input }) => {
      return rdCrm.validateRdCrmToken(input.token);
    }),

  // ─── Fetch Summary (preview before import) ───
  fetchSummary: protectedProcedure
    .input(z.object({ token: z.string().min(10) }))
    .mutation(async ({ input }) => {
      return rdCrm.fetchRdCrmSummary(input.token);
    }),

  // ─── Get Import Progress ───
  getProgress: protectedProcedure.query(({ ctx }) => {
    const key = getProgressKey(ctx.user.id);
    return progressStore.get(key) || null;
  }),

  // ─── Import All Data (runs in background, progress via polling) ───
  importAll: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      token: z.string().min(10),
      importContacts: z.boolean().default(true),
      importDeals: z.boolean().default(true),
      importOrganizations: z.boolean().default(true),
      importProducts: z.boolean().default(true),
      importTasks: z.boolean().default(true),
      importPipelines: z.boolean().default(true),
      importSources: z.boolean().default(true),
      importCampaigns: z.boolean().default(true),
      importLossReasons: z.boolean().default(true),
      importUsers: z.boolean().default(true),
      cleanBeforeImport: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = (ctx as any).saasUser?.tenantId ?? input.tenantId;
      const { token } = input;
      const userId = ctx.user.id;
      const userName = ctx.user.name || "Sistema";

      const progress = initProgress(userId);
      progress.status = "fetching";

      const enabledCategories: string[] = [];
      if (input.importPipelines) enabledCategories.push("pipelines");
      if (input.importUsers) enabledCategories.push("users");
      if (input.importSources) enabledCategories.push("sources");
      if (input.importCampaigns) enabledCategories.push("campaigns");
      if (input.importLossReasons) enabledCategories.push("lossReasons");
      if (input.importProducts) enabledCategories.push("products");
      if (input.importOrganizations) enabledCategories.push("organizations");
      if (input.importContacts) enabledCategories.push("contacts");
      if (input.importDeals) enabledCategories.push("deals");
      if (input.importTasks) enabledCategories.push("tasks");
      enabledCategories.push("validation"); // Always run validation at the end
      progress.totalSteps = enabledCategories.length;

      runImport(userId, tenantId, token, userName, input, enabledCategories).catch((err) => {
        console.error("[RD Import] FATAL ERROR:", err);
        updateProgress(userId, {
          status: "error",
          error: err.message || "Erro desconhecido na importação",
        });
      });

      return { started: true, categories: enabledCategories.length };
    }),

  // ─── Import from Spreadsheet (synchronous, rows already parsed by frontend) ───
  importSpreadsheet: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      rows: z.array(z.object({
        nome: z.string().min(1),
        email: z.string().optional(),
        telefone: z.string().optional(),
        empresa: z.string().optional(),
        negociacao: z.string().optional(),
        valor: z.string().optional(),
        etapa: z.string().optional(),
        fonte: z.string().optional(),
        campanha: z.string().optional(),
        notas: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = (ctx as any).saasUser?.tenantId ?? input.tenantId;
      const userId = ctx.user.id;
      const userName = ctx.user.name || "Sistema";
      const { rows } = input;

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Ensure rdExternalId columns exist (reuse existing helper)
      await ensureRdExternalIdColumns();

      // Pre-fetch tenant pipelines and stages for matching
      const allPipelines = await crm.listPipelines(tenantId);
      const defaultPipeline = allPipelines.find((p: any) => p.isDefault) || allPipelines[0];
      if (!defaultPipeline) {
        throw new Error("Nenhum funil encontrado. Crie um funil antes de importar.");
      }
      const allStagesMap = new Map<number, any[]>();
      for (const p of allPipelines) {
        const stages = await crm.listStages(tenantId, p.id);
        allStagesMap.set(p.id, stages);
      }
      const defaultStages = allStagesMap.get(defaultPipeline.id) || [];
      const defaultStage = defaultStages[0];
      if (!defaultStage) {
        throw new Error("Nenhuma etapa encontrada no funil padrão.");
      }

      // Pre-fetch existing sources and campaigns for matching
      const existingSources = await crm.listLeadSources(tenantId);
      const existingCampaigns = await crm.listCampaigns(tenantId);
      const sourceMap = new Map(existingSources.map((s: any) => [s.name.toLowerCase().trim(), s.id]));
      const campaignMap = new Map(existingCampaigns.map((c: any) => [c.name.toLowerCase().trim(), c.id]));

      // Cache for contacts by email (dedup within batch)
      const contactByEmail = new Map<string, number>();
      // Cache for accounts by name (dedup within batch)
      const accountByName = new Map<string, number>();

      // Pre-fetch existing contacts by email for dedup
      const db = await getDb();
      if (db) {
        try {
          const [existingContacts]: any = await db.execute(
            sql.raw(`SELECT id, email FROM contacts WHERE tenantId = ${tenantId} AND email IS NOT NULL AND email != '' AND deletedAt IS NULL`)
          );
          if (existingContacts) {
            for (const c of existingContacts) {
              if (c.email) contactByEmail.set(c.email.toLowerCase().trim(), c.id);
            }
          }
        } catch {}
        // Pre-fetch existing accounts by name
        try {
          const [existingAccounts]: any = await db.execute(
            sql.raw(`SELECT id, name FROM accounts WHERE tenantId = ${tenantId} AND deletedAt IS NULL`)
          );
          if (existingAccounts) {
            for (const a of existingAccounts) {
              if (a.name) accountByName.set(a.name.toLowerCase().trim(), a.id);
            }
          }
        } catch {}
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          // 1. Find or create contact
          let contactId: number | undefined;
          const emailKey = row.email?.toLowerCase().trim();
          if (emailKey && contactByEmail.has(emailKey)) {
            contactId = contactByEmail.get(emailKey);
          } else {
            const contact = await crm.createContact({
              tenantId,
              name: row.nome.trim(),
              email: row.email?.trim() || undefined,
              phone: row.telefone?.trim() || undefined,
              source: row.fonte?.trim() || "Planilha",
              createdBy: userId,
            });
            if (contact) {
              contactId = (contact as any).insertId ?? (contact as any).id;
              if (emailKey && contactId) contactByEmail.set(emailKey, contactId);
            }
          }

          // 2. Find or create account (empresa)
          let accountId: number | undefined;
          if (row.empresa?.trim()) {
            const empresaKey = row.empresa.trim().toLowerCase();
            if (accountByName.has(empresaKey)) {
              accountId = accountByName.get(empresaKey);
            } else {
              const account = await crm.createAccount({
                tenantId,
                name: row.empresa.trim(),
                primaryContactId: contactId,
                createdBy: userId,
              });
              if (account) {
                accountId = (account as any).insertId ?? (account as any).id;
                if (accountId) accountByName.set(empresaKey, accountId);
              }
            }
          }

          // 3. Resolve pipeline stage by name
          let targetPipelineId = defaultPipeline.id;
          let targetStageId = defaultStage.id;
          if (row.etapa?.trim()) {
            const etapaName = row.etapa.trim().toLowerCase();
            let found = false;
            for (const [pId, stages] of Array.from(allStagesMap.entries())) {
              const match = stages.find((s: any) => s.name.toLowerCase() === etapaName);
              if (match) {
                targetPipelineId = pId;
                targetStageId = match.id;
                found = true;
                break;
              }
            }
          }

          // 4. Parse value
          let valueCents: number | undefined;
          if (row.valor?.trim()) {
            const cleaned = row.valor.replace(/[R$\s.]/g, "").replace(",", ".");
            const parsed = parseFloat(cleaned);
            if (!isNaN(parsed)) valueCents = Math.round(parsed * 100);
          }

          // 5. Resolve source
          let leadSource: string | undefined;
          if (row.fonte?.trim()) {
            leadSource = row.fonte.trim();
            if (!sourceMap.has(leadSource.toLowerCase())) {
              const src = await crm.createLeadSource({ tenantId, name: leadSource });
              if (src) sourceMap.set(leadSource.toLowerCase(), (src as any).insertId ?? (src as any).id);
            }
          }

          // 6. Create deal
          const dealTitle = row.negociacao?.trim() || `${row.nome.trim()} — Importação Planilha`;
          const deal = await crm.createDeal({
            tenantId,
            title: dealTitle,
            contactId,
            accountId,
            pipelineId: targetPipelineId,
            stageId: targetStageId,
            valueCents,
            ownerUserId: userId,
            createdBy: userId,
            leadSource: leadSource || "Planilha",
          });

          if (deal) {
            const dealId = (deal as any).insertId ?? (deal as any).id;

            // 7. Set utmCampaign if provided
            if (row.campanha?.trim()) {
              await crm.updateDeal(tenantId, dealId, { utmCampaign: row.campanha.trim() });
              if (!campaignMap.has(row.campanha.trim().toLowerCase())) {
                const camp = await crm.createCampaign({ tenantId, name: row.campanha.trim() });
                if (camp) campaignMap.set(row.campanha.trim().toLowerCase(), (camp as any).insertId ?? (camp as any).id);
              }
            }

            // 8. Add notes if provided
            if (row.notas?.trim()) {
              await crm.createNote({
                tenantId,
                entityType: "deal",
                entityId: dealId,
                body: row.notas.trim(),
                createdByUserId: userId,
              });
            }

            // 9. History
            await crm.createDealHistory({
              tenantId,
              dealId,
              action: "created",
              description: `Negociação importada via planilha por ${userName}`,
              actorUserId: userId,
              actorName: userName,
            });
          }

          imported++;
        } catch (e: any) {
          errors.push(`Linha ${i + 1} (${row.nome}): ${e.message || "Erro desconhecido"}`);
        }
      }

      return { imported, skipped, errors };
    }),
});

// ─── Background import function ───
async function runImport(
  userId: number,
  tenantId: number,
  token: string,
  userName: string,
  input: {
    importPipelines: boolean;
    importUsers: boolean;
    importSources: boolean;
    importCampaigns: boolean;
    importLossReasons: boolean;
    importProducts: boolean;
    importOrganizations: boolean;
    importContacts: boolean;
    importDeals: boolean;
    importTasks: boolean;
    cleanBeforeImport: boolean;
  },
  enabledCategories: string[],
) {
  const db = await getDb();
  if (!db) {
    updateProgress(userId, { status: "error", error: "Database unavailable" });
    return;
  }

  // Ensure rdExternalId columns exist
  console.log("[RD Import] Ensuring rdExternalId columns exist...");
  updateProgress(userId, { phase: "Preparando banco de dados..." });
  await ensureRdExternalIdColumns();

  // ─── Clean before import: remove all RD-imported data ───
  if (input.cleanBeforeImport) {
    console.log("[RD Import] Cleaning all previously imported RD Station data...");
    updateProgress(userId, { phase: "Limpando dados importados anteriormente..." });
    try {
      // Delete in order: tasks → deal_products → deal_history → deals → contacts → accounts → stages → pipelines → products → sources → campaigns → loss_reasons → crm_users (with rdExternalId)
      await db.execute(sql.raw(`DELETE FROM crm_tasks WHERE tenantId = ${tenantId} AND rdExternalId IS NOT NULL`));
      await db.execute(sql.raw(`DELETE FROM deal_products WHERE tenantId = ${tenantId} AND dealId IN (SELECT id FROM deals WHERE tenantId = ${tenantId} AND rdExternalId IS NOT NULL)`));
      await db.execute(sql.raw(`DELETE FROM deal_history WHERE tenantId = ${tenantId} AND dealId IN (SELECT id FROM deals WHERE tenantId = ${tenantId} AND rdExternalId IS NOT NULL)`));
      await db.execute(sql.raw(`DELETE FROM deals WHERE tenantId = ${tenantId} AND rdExternalId IS NOT NULL`));
      // Also delete deals that were imported via leadSource but don't have rdExternalId (from old imports)
      await db.execute(sql.raw(`DELETE FROM deal_products WHERE tenantId = ${tenantId} AND dealId IN (SELECT id FROM deals WHERE tenantId = ${tenantId} AND leadSource = 'rd_station_crm')`));
      await db.execute(sql.raw(`DELETE FROM deal_history WHERE tenantId = ${tenantId} AND dealId IN (SELECT id FROM deals WHERE tenantId = ${tenantId} AND leadSource = 'rd_station_crm')`));
      await db.execute(sql.raw(`DELETE FROM deals WHERE tenantId = ${tenantId} AND leadSource = 'rd_station_crm'`));
      await db.execute(sql.raw(`DELETE FROM contacts WHERE tenantId = ${tenantId} AND rdExternalId IS NOT NULL`));
      await db.execute(sql.raw(`DELETE FROM contacts WHERE tenantId = ${tenantId} AND source = 'rd_station_crm'`));
      await db.execute(sql.raw(`DELETE FROM accounts WHERE tenantId = ${tenantId} AND rdExternalId IS NOT NULL`));
      await db.execute(sql.raw(`DELETE FROM pipeline_stages WHERE tenantId = ${tenantId} AND rdExternalId IS NOT NULL`));
      // Delete non-default pipelines that have rdExternalId or were created by old imports (not the system defaults)
      await db.execute(sql.raw(`DELETE FROM pipeline_stages WHERE tenantId = ${tenantId} AND pipelineId IN (SELECT id FROM pipelines WHERE tenantId = ${tenantId} AND rdExternalId IS NOT NULL)`));
      await db.execute(sql.raw(`DELETE FROM pipelines WHERE tenantId = ${tenantId} AND rdExternalId IS NOT NULL`));
      // Also delete pipelines that match RD Station names but don't have rdExternalId (old imports)
      await db.execute(sql.raw(`DELETE FROM pipeline_stages WHERE tenantId = ${tenantId} AND pipelineId IN (SELECT id FROM pipelines WHERE tenantId = ${tenantId} AND isDefault = 0 AND name NOT IN ('Funil de Vendas', 'Funil de Pós-Venda'))`));
      await db.execute(sql.raw(`DELETE FROM pipelines WHERE tenantId = ${tenantId} AND isDefault = 0 AND name NOT IN ('Funil de Vendas', 'Funil de Pós-Venda')`));
      await db.execute(sql.raw(`DELETE FROM product_catalog WHERE tenantId = ${tenantId} AND rdExternalId IS NOT NULL`));
      await db.execute(sql.raw(`DELETE FROM lead_sources WHERE tenantId = ${tenantId} AND rdExternalId IS NOT NULL`));
      await db.execute(sql.raw(`DELETE FROM campaigns WHERE tenantId = ${tenantId} AND rdExternalId IS NOT NULL`));
      await db.execute(sql.raw(`DELETE FROM loss_reasons WHERE tenantId = ${tenantId} AND rdExternalId IS NOT NULL`));
      await db.execute(sql.raw(`DELETE FROM crm_users WHERE tenantId = ${tenantId} AND rdExternalId IS NOT NULL`));
      console.log("[RD Import] Clean complete.");
    } catch (e: any) {
      console.error("[RD Import] Clean error:", e.message);
      // Continue with import even if clean fails partially
    }
  }

  const results: Record<string, { imported: number; skipped: number; updated: number; errors: string[] }> = {};
  const rdCounts: Record<string, number> = {};

  // Maps from RD Station _id → Entur OS id
  const rdIdMap = {
    contacts: new Map<string, number>(),
    organizations: new Map<string, number>(),
    pipelines: new Map<string, number>(),
    stages: new Map<string, number>(),
    products: new Map<string, number>(),
    deals: new Map<string, number>(),
    sources: new Map<string, number>(),
    campaigns: new Map<string, number>(),
    lossReasons: new Map<string, number>(),
    users: new Map<string, number>(),       // rd user _id → entur crm_user id
  };

  // Secondary lookups for contact matching
  const contactByEmail = new Map<string, number>();
  const contactByName = new Map<string, number>();
  const orgByRdId = new Map<string, number>();

  let stepIndex = 0;

  function advanceStep(category: string, label: string) {
    stepIndex++;
    updateProgress(userId, {
      status: "importing",
      phase: `Importando ${label}...`,
      currentStep: label,
      completedSteps: stepIndex - 1,
      currentCategory: category,
      categoryTotal: 0,
      categoryDone: 0,
    });
  }

  function setCategoryProgress(done: number, total: number) {
    updateProgress(userId, { categoryDone: done, categoryTotal: total });
  }

  function makeEntry() {
    return { imported: 0, skipped: 0, updated: 0, errors: [] as string[] };
  }

  try {
    // ═══════════════════════════════════════════════════════════
    // 1. PIPELINES & STAGES
    // ═══════════════════════════════════════════════════════════
    if (input.importPipelines) {
      advanceStep("pipelines", "Funis e Etapas");
      const entry = makeEntry();
      try {
        const rdPipelines = await rdCrm.fetchAllPipelines(token);
        rdCounts.pipelines = rdPipelines.length;
        setCategoryProgress(0, rdPipelines.length);
        console.log(`[RD Import] Fetched ${rdPipelines.length} pipelines`);

        for (let i = 0; i < rdPipelines.length; i++) {
          const rdPipeline = rdPipelines[i];
          const pipelineRdId = rdPipeline.id || rdPipeline._id || "";
          try {
            // Check if pipeline already exists by rdExternalId
            const existingId = await findByRdExternalId("pipelines", tenantId, pipelineRdId);
            let pipelineId: number;

            if (existingId) {
              pipelineId = existingId;
              rdIdMap.pipelines.set(pipelineRdId, existingId);
              entry.skipped++;
              console.log(`[RD Import] Pipeline "${rdPipeline.name}" already exists (id=${existingId}), skipping`);
            } else {
              const result = await crm.createPipeline({ tenantId, name: rdPipeline.name });
              if (!result) { entry.errors.push(`Funil ${rdPipeline.name}: createPipeline returned null`); continue; }
              pipelineId = result.id;
              await setRdExternalId("pipelines", result.id, pipelineRdId);
              rdIdMap.pipelines.set(pipelineRdId, result.id);
              entry.imported++;
              console.log(`[RD Import] Created pipeline "${rdPipeline.name}" (id=${result.id})`);
            }

            // Import stages for this pipeline
            if (rdPipeline.deal_stages) {
              let stagesCreated = 0;
              let stagesSkipped = 0;
              for (const stage of rdPipeline.deal_stages) {
                try {
                  const existingStageId = await findByRdExternalId("pipeline_stages", tenantId, stage._id);
                  if (existingStageId) {
                    rdIdMap.stages.set(stage._id, existingStageId);
                    stagesSkipped++;
                  } else {
                    const stageResult = await crm.createStage({
                      tenantId,
                      pipelineId,
                      name: stage.name,
                      orderIndex: stage.order || 0,
                    });
                    if (stageResult) {
                      await setRdExternalId("pipeline_stages", stageResult.id, stage._id);
                      rdIdMap.stages.set(stage._id, stageResult.id);
                      stagesCreated++;
                    }
                  }
                } catch (e: any) {
                  entry.errors.push(`Etapa ${stage.name}: ${e.message}`);
                }
              }
              if (stagesCreated > 0 || stagesSkipped > 0) {
                console.log(`[RD Import]   Stages for "${rdPipeline.name}": ${stagesCreated} created, ${stagesSkipped} skipped`);
              }
            }
          } catch (e: any) {
            entry.errors.push(`Funil ${rdPipeline.name}: ${e.message}`);
          }
          setCategoryProgress(i + 1, rdPipelines.length);
        }
      } catch (e: any) {
        entry.errors.push(`Buscar funis: ${e.message}`);
      }
      results.pipelines = entry;
    }

    // ═══════════════════════════════════════════════════════════
    // 2. USERS (import RD Station users as CRM users)
    // ═══════════════════════════════════════════════════════════
    if (input.importUsers) {
      advanceStep("users", "Usuários");
      const entry = makeEntry();
      try {
        const rdUsers = await rdCrm.fetchAllUsers(token);
        rdCounts.users = rdUsers.length;
        setCategoryProgress(0, rdUsers.length);
        console.log(`[RD Import] Fetched ${rdUsers.length} users`);

        for (let i = 0; i < rdUsers.length; i++) {
          const u = rdUsers[i];
          try {
            // Check by rdExternalId first
            const existingId = await findByRdExternalId("crm_users", tenantId, u._id);
            if (existingId) {
              rdIdMap.users.set(u._id, existingId);
              entry.skipped++;
            } else {
              // Check by email (might already exist from manual creation)
              const existingUsers = await crm.listCrmUsers(tenantId);
              const byEmail = existingUsers.find(eu => eu.email.toLowerCase() === u.email.toLowerCase());
              if (byEmail) {
                await setRdExternalId("crm_users", byEmail.id, u._id);
                rdIdMap.users.set(u._id, byEmail.id);
                entry.skipped++;
                console.log(`[RD Import] User "${u.name}" matched by email (id=${byEmail.id})`);
              } else {
                const result = await crm.createCrmUser({
                  tenantId,
                  name: u.name,
                  email: u.email,
                  createdBy: userId,
                });
                if (result) {
                  await setRdExternalId("crm_users", result.id, u._id);
                  rdIdMap.users.set(u._id, result.id);
                  entry.imported++;
                  console.log(`[RD Import] Created CRM user "${u.name}" (id=${result.id})`);
                }
              }
            }
          } catch (e: any) {
            entry.errors.push(`Usuário ${u.name}: ${e.message}`);
          }
          setCategoryProgress(i + 1, rdUsers.length);
        }
      } catch (e: any) {
        entry.errors.push(`Buscar usuários: ${e.message}`);
      }
      results.users = entry;
    }

    // ═══════════════════════════════════════════════════════════
    // 3. SOURCES (Lead Sources)
    // ═══════════════════════════════════════════════════════════
    if (input.importSources) {
      advanceStep("sources", "Fontes de Leads");
      const entry = makeEntry();
      try {
        updateProgress(userId, { phase: "Buscando fontes do RD Station..." });
        const rdSources = await rdCrm.fetchAllSources(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
        });
        rdCounts.sources = rdSources.length;
        updateProgress(userId, { phase: "Importando fontes..." });
        setCategoryProgress(0, rdSources.length);

        for (let i = 0; i < rdSources.length; i++) {
          const src = rdSources[i];
          try {
            const existingId = await findByRdExternalId("lead_sources", tenantId, src._id);
            if (existingId) {
              rdIdMap.sources.set(src._id, existingId);
              entry.skipped++;
            } else {
              const result = await crm.createLeadSource({ tenantId, name: src.name });
              if (result) {
                await setRdExternalId("lead_sources", result.id, src._id);
                rdIdMap.sources.set(src._id, result.id);
                entry.imported++;
              }
            }
          } catch (e: any) {
            entry.errors.push(`Fonte ${src.name}: ${e.message}`);
          }
          setCategoryProgress(i + 1, rdSources.length);
        }
      } catch (e: any) {
        entry.errors.push(`Buscar fontes: ${e.message}`);
      }
      results.sources = entry;
    }

    // ═══════════════════════════════════════════════════════════
    // 4. CAMPAIGNS
    // ═══════════════════════════════════════════════════════════
    if (input.importCampaigns) {
      advanceStep("campaigns", "Campanhas");
      const entry = makeEntry();
      try {
        updateProgress(userId, { phase: "Buscando campanhas do RD Station..." });
        const rdCampaigns = await rdCrm.fetchAllCampaigns(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
        });
        rdCounts.campaigns = rdCampaigns.length;
        updateProgress(userId, { phase: "Importando campanhas..." });
        setCategoryProgress(0, rdCampaigns.length);

        for (let i = 0; i < rdCampaigns.length; i++) {
          const camp = rdCampaigns[i];
          try {
            const existingId = await findByRdExternalId("campaigns", tenantId, camp._id);
            if (existingId) {
              rdIdMap.campaigns.set(camp._id, existingId);
              entry.skipped++;
            } else {
              const result = await crm.createCampaign({ tenantId, name: camp.name });
              if (result) {
                await setRdExternalId("campaigns", result.id, camp._id);
                rdIdMap.campaigns.set(camp._id, result.id);
                entry.imported++;
              }
            }
          } catch (e: any) {
            entry.errors.push(`Campanha ${camp.name}: ${e.message}`);
          }
          setCategoryProgress(i + 1, rdCampaigns.length);
        }
      } catch (e: any) {
        entry.errors.push(`Buscar campanhas: ${e.message}`);
      }
      results.campaigns = entry;
    }

    // ═══════════════════════════════════════════════════════════
    // 5. LOSS REASONS
    // ═══════════════════════════════════════════════════════════
    if (input.importLossReasons) {
      advanceStep("lossReasons", "Motivos de Perda");
      const entry = makeEntry();
      try {
        updateProgress(userId, { phase: "Buscando motivos de perda..." });
        const rdReasons = await rdCrm.fetchAllLossReasons(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
        });
        rdCounts.lossReasons = rdReasons.length;
        updateProgress(userId, { phase: "Importando motivos de perda..." });
        setCategoryProgress(0, rdReasons.length);

        for (let i = 0; i < rdReasons.length; i++) {
          const reason = rdReasons[i];
          try {
            const existingId = await findByRdExternalId("loss_reasons", tenantId, reason._id);
            if (existingId) {
              rdIdMap.lossReasons.set(reason._id, existingId);
              entry.skipped++;
            } else {
              const result = await crm.createLossReason({ tenantId, name: reason.name });
              if (result) {
                await setRdExternalId("loss_reasons", result.id, reason._id);
                rdIdMap.lossReasons.set(reason._id, result.id);
                entry.imported++;
              }
            }
          } catch (e: any) {
            entry.errors.push(`Motivo ${reason.name}: ${e.message}`);
          }
          setCategoryProgress(i + 1, rdReasons.length);
        }
      } catch (e: any) {
        entry.errors.push(`Buscar motivos: ${e.message}`);
      }
      results.lossReasons = entry;
    }

    // ═══════════════════════════════════════════════════════════
    // 6. PRODUCTS
    // ═══════════════════════════════════════════════════════════
    if (input.importProducts) {
      advanceStep("products", "Produtos e Serviços");
      const entry = makeEntry();
      try {
        updateProgress(userId, { phase: "Buscando produtos do RD Station..." });
        const rdProducts = await rdCrm.fetchAllProducts(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
        });
        rdCounts.products = rdProducts.length;
        updateProgress(userId, { phase: "Importando produtos..." });
        setCategoryProgress(0, rdProducts.length);

        for (let i = 0; i < rdProducts.length; i++) {
          const prod = rdProducts[i];
          try {
            const existingId = await findByRdExternalId("product_catalog", tenantId, prod._id);
            if (existingId) {
              rdIdMap.products.set(prod._id, existingId);
              entry.skipped++;
            } else {
              const price = typeof prod.base_price === "string" ? parseFloat(prod.base_price) : (prod.base_price || 0);
              const result = await crm.createCatalogProduct({
                tenantId,
                name: prod.name,
                description: prod.description || undefined,
                basePriceCents: Math.round(price * 100),
                productType: "other",
                isActive: prod.visible !== false,
              });
              if (result) {
                await setRdExternalId("product_catalog", result.id, prod._id);
                rdIdMap.products.set(prod._id, result.id);
                entry.imported++;
              }
            }
          } catch (e: any) {
            entry.errors.push(`Produto ${prod.name}: ${e.message}`);
          }
          setCategoryProgress(i + 1, rdProducts.length);
        }
      } catch (e: any) {
        entry.errors.push(`Buscar produtos: ${e.message}`);
      }
      results.products = entry;
    }

    // ═══════════════════════════════════════════════════════════
    // 7. ORGANIZATIONS → ACCOUNTS
    // ═══════════════════════════════════════════════════════════
    if (input.importOrganizations) {
      advanceStep("organizations", "Empresas");
      const entry = makeEntry();
      try {
        updateProgress(userId, { phase: "Buscando empresas do RD Station..." });
        const rdOrgs = await rdCrm.fetchAllOrganizations(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
        });
        rdCounts.organizations = rdOrgs.length;
        updateProgress(userId, { phase: "Importando empresas como contas..." });
        setCategoryProgress(0, rdOrgs.length);

        for (let i = 0; i < rdOrgs.length; i++) {
          const org = rdOrgs[i];
          try {
            const existingId = await findByRdExternalId("accounts", tenantId, org._id);
            if (existingId) {
              rdIdMap.organizations.set(org._id, existingId);
              orgByRdId.set(org._id, existingId);
              entry.skipped++;
            } else {
              const result = await crm.createAccount({
                tenantId,
                name: org.name,
                createdBy: userId,
              });
              if (result) {
                await setRdExternalId("accounts", result.id, org._id);
                rdIdMap.organizations.set(org._id, result.id);
                orgByRdId.set(org._id, result.id);
                entry.imported++;
              }
            }
          } catch (e: any) {
            entry.errors.push(`Empresa ${org.name}: ${e.message}`);
          }
          setCategoryProgress(i + 1, rdOrgs.length);
        }
      } catch (e: any) {
        entry.errors.push(`Buscar empresas: ${e.message}`);
      }
      results.organizations = entry;
    }

    // ═══════════════════════════════════════════════════════════
    // 8. CONTACTS
    // ═══════════════════════════════════════════════════════════
    if (input.importContacts) {
      advanceStep("contacts", "Contatos");
      const entry = makeEntry();
      try {
        console.log("[RD Import] Starting contacts fetch...");
        updateProgress(userId, { phase: "Buscando contatos do RD Station..." });
        const rdContacts = await rdCrm.fetchAllContacts(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
          updateProgress(userId, { phase: `Buscando contatos... ${fetched}/${total}` });
        });
        rdCounts.contacts = rdContacts.length;
        console.log(`[RD Import] Fetched ${rdContacts.length} contacts. Starting import...`);
        updateProgress(userId, { phase: "Importando contatos..." });
        setCategoryProgress(0, rdContacts.length);

        for (let i = 0; i < rdContacts.length; i++) {
          const c = rdContacts[i];
          try {
            // Check if contact already exists by rdExternalId
            const existingId = await findByRdExternalId("contacts", tenantId, c._id);
            if (existingId) {
              rdIdMap.contacts.set(c._id, existingId);
              // Also populate email/name lookup maps for deal matching
              const email = c.emails?.[0]?.email;
              if (email) contactByEmail.set(email.toLowerCase().trim(), existingId);
              const name = (c.name || "").trim();
              if (name && name !== "Sem nome") contactByName.set(name.toLowerCase().trim(), existingId);
              entry.skipped++;
              if (i % 1000 === 0) setCategoryProgress(i + 1, rdContacts.length);
              continue;
            }

            const email = c.emails?.[0]?.email || undefined;
            const rawPhone = c.phones?.[0]?.phone || undefined;
            const phone = rawPhone ? rawPhone.substring(0, 32) : undefined;
            const contactName = (c.name || "").trim() || email || phone || "Sem nome";

            const result = await crm.createContact({
              tenantId,
              name: contactName,
              type: "person",
              email,
              phone,
              source: "rd_station_crm",
              createdBy: userId,
            });
            if (result) {
              await setRdExternalId("contacts", result.id, c._id);
              rdIdMap.contacts.set(c._id, result.id);
              if (email) contactByEmail.set(email.toLowerCase().trim(), result.id);
              if (contactName && contactName !== "Sem nome") {
                contactByName.set(contactName.toLowerCase().trim(), result.id);
              }
              entry.imported++;

              // Link contact → account via organization_id
              if (c.organization_id && rdIdMap.organizations.has(c.organization_id)) {
                const accountId = rdIdMap.organizations.get(c.organization_id)!;
                try {
                  await crm.updateAccount(tenantId, accountId, { primaryContactId: result.id });
                } catch {}
              }

              // Add notes if present
              if (c.notes) {
                try {
                  await crm.createNote({
                    tenantId,
                    entityType: "contact",
                    entityId: result.id,
                    body: c.notes,
                    createdByUserId: userId,
                  });
                } catch {}
              }
            }
          } catch (e: any) {
            if (entry.errors.length < 20) entry.errors.push(`Contato ${c.name}: ${e.message}`);
          }
          if (i % 100 === 0) {
            setCategoryProgress(i + 1, rdContacts.length);
            if (i % 1000 === 0) console.log(`[RD Import] Contacts progress: ${i}/${rdContacts.length}, imported: ${entry.imported}, skipped: ${entry.skipped}`);
          }
        }
        setCategoryProgress(rdContacts.length, rdContacts.length);
        console.log(`[RD Import] Contacts done: ${entry.imported} imported, ${entry.skipped} skipped, ${entry.errors.length} errors`);
      } catch (e: any) {
        console.error("[RD Import] CONTACTS OUTER ERROR:", e.message, e.stack);
        entry.errors.push(`Buscar contatos: ${e.message}`);
      }
      results.contacts = entry;
    }

    // ═══════════════════════════════════════════════════════════
    // 9. DEALS
    // ═══════════════════════════════════════════════════════════
    if (input.importDeals) {
      advanceStep("deals", "Negociações");
      const entry = makeEntry();
      try {
        // Build stage→pipeline map from RD Station data
        const rdPipelines = await rdCrm.fetchAllPipelines(token);
        const stageToPipelineRd = new Map<string, string>();
        for (const p of rdPipelines) {
          const pId = p.id || p._id || "";
          for (const s of p.deal_stages || []) {
            stageToPipelineRd.set(s._id, pId);
          }
        }

        // Get fallback pipeline/stage (use existing default)
        const existingPipelines = await crm.listPipelines(tenantId);
        let fallbackPipelineId = existingPipelines.find(p => p.isDefault)?.id || existingPipelines[0]?.id;
        let fallbackStageId: number | undefined;
        if (fallbackPipelineId) {
          const stages = await crm.listStages(tenantId, fallbackPipelineId);
          fallbackStageId = stages[0]?.id;
        }
        if (!fallbackPipelineId || !fallbackStageId) {
          const p = await crm.createPipeline({ tenantId, name: "Pipeline Importado", isDefault: true });
          if (p) {
            fallbackPipelineId = p.id;
            const s = await crm.createStage({ tenantId, pipelineId: p.id, name: "Novo", orderIndex: 0 });
            fallbackStageId = s?.id || 0;
          }
        }

        // Fetch all deals
        console.log("[RD Import] Starting deals fetch...");
        updateProgress(userId, { phase: "Buscando negociações do RD Station..." });
        const rdDeals = await rdCrm.fetchAllDeals(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
          updateProgress(userId, { phase: `Buscando negociações... ${fetched}/${total}` });
        });
        rdCounts.deals = rdDeals.length;
        console.log(`[RD Import] Fetched ${rdDeals.length} deals. Starting import...`);

        updateProgress(userId, { phase: "Importando negociações..." });
        setCategoryProgress(0, rdDeals.length);

        for (let i = 0; i < rdDeals.length; i++) {
          const d = rdDeals[i];
          try {
            const dealRdId = d._id || d.id;

            // ── Check if deal already exists by rdExternalId ──
            const existingDealId = await findByRdExternalId("deals", tenantId, dealRdId);
            if (existingDealId) {
              rdIdMap.deals.set(dealRdId, existingDealId);
              entry.skipped++;
              if (i % 500 === 0) setCategoryProgress(i + 1, rdDeals.length);
              continue;
            }

            // ── Resolve pipeline and stage ──
            let stageId = fallbackStageId!;
            let pipelineId = fallbackPipelineId!;

            if (d.deal_stage?._id) {
              const mappedStageId = rdIdMap.stages.get(d.deal_stage._id);
              if (mappedStageId) {
                stageId = mappedStageId;
                const rdPipelineId = stageToPipelineRd.get(d.deal_stage._id);
                if (rdPipelineId) {
                  const mappedPipelineId = rdIdMap.pipelines.get(rdPipelineId);
                  if (mappedPipelineId) {
                    pipelineId = mappedPipelineId;
                  }
                }
              }
            }

            // ── Resolve contact (by rdExternalId first, then email/name) ──
            let contactId: number | undefined;
            if (d.contacts?.length) {
              const firstContact = d.contacts[0];

              // Try by RD contact _id (most reliable)
              if (firstContact._id && rdIdMap.contacts.has(firstContact._id)) {
                contactId = rdIdMap.contacts.get(firstContact._id);
              }

              // Fallback: try by email
              if (!contactId) {
                const dealContactEmail = firstContact.emails?.[0]?.email;
                if (dealContactEmail) {
                  contactId = contactByEmail.get(dealContactEmail.toLowerCase().trim());
                }
              }

              // Fallback: try by name
              if (!contactId) {
                const dealContactName = (firstContact.name || "").trim();
                if (dealContactName) {
                  contactId = contactByName.get(dealContactName.toLowerCase().trim());
                }
              }

              // Last resort: create the contact on the fly
              if (!contactId) {
                const dealContactEmail = firstContact.emails?.[0]?.email;
                const dealContactName = (firstContact.name || "").trim();
                const rawPhone = firstContact.phones?.[0]?.phone || undefined;
                const phone = rawPhone ? rawPhone.substring(0, 32) : undefined;
                if (dealContactName || dealContactEmail) {
                  try {
                    const newContact = await crm.createContact({
                      tenantId,
                      name: dealContactName || dealContactEmail || "Sem nome",
                      type: "person",
                      email: dealContactEmail || undefined,
                      phone,
                      source: "rd_station_crm",
                      createdBy: userId,
                    });
                    if (newContact) {
                      contactId = newContact.id;
                      if (firstContact._id) {
                        await setRdExternalId("contacts", newContact.id, firstContact._id);
                        rdIdMap.contacts.set(firstContact._id, newContact.id);
                      }
                      if (dealContactEmail) contactByEmail.set(dealContactEmail.toLowerCase().trim(), newContact.id);
                      if (dealContactName) contactByName.set(dealContactName.toLowerCase().trim(), newContact.id);
                    }
                  } catch {}
                }
              }
            }

            // ── Resolve organization as account ──
            let accountId: number | undefined;
            if (d.organization?._id) {
              accountId = orgByRdId.get(d.organization._id);
              if (!accountId && d.organization.name) {
                try {
                  const existingAccId = await findByRdExternalId("accounts", tenantId, d.organization._id);
                  if (existingAccId) {
                    accountId = existingAccId;
                    orgByRdId.set(d.organization._id, existingAccId);
                  } else {
                    const newAccount = await crm.createAccount({
                      tenantId,
                      name: d.organization.name,
                      createdBy: userId,
                    });
                    if (newAccount) {
                      await setRdExternalId("accounts", newAccount.id, d.organization._id);
                      accountId = newAccount.id;
                      orgByRdId.set(d.organization._id, newAccount.id);
                    }
                  }
                } catch {}
              }
            }

            // ── Resolve owner (RD Station user → CRM user) ──
            let ownerUserId: number | undefined;
            if (d.user?._id && rdIdMap.users.has(d.user._id)) {
              ownerUserId = rdIdMap.users.get(d.user._id);
            }

            // ── Resolve deal_source → leadSource name ──
            let dealSourceName: string | undefined;
            if (d.deal_source?._id) {
              dealSourceName = d.deal_source.name || undefined;
            }

            // ── Resolve campaign → utmCampaign name ──
            let campaignName: string | undefined;
            if (d.campaign?._id) {
              campaignName = d.campaign.name || undefined;
            }

            // ── Resolve loss reason ──
            let lossReasonId: number | undefined;
            if (d.deal_lost_reason?._id && rdIdMap.lossReasons.has(d.deal_lost_reason._id)) {
              lossReasonId = rdIdMap.lossReasons.get(d.deal_lost_reason._id);
            }

            // ── Resolve expectedCloseAt from prediction_date ──
            let expectedCloseAt: Date | undefined;
            if (d.prediction_date) {
              const parsed = new Date(d.prediction_date);
              if (!isNaN(parsed.getTime())) expectedCloseAt = parsed;
            }

            // ── Determine status ──
            let status: "open" | "won" | "lost" = "open";
            if (d.win === true) status = "won";
            else if (d.win === false) status = "lost";

            const valueCents = Math.round((d.amount_total || 0) * 100);

            // ── Create the deal ──
            const result = await crm.createDeal({
              tenantId,
              title: d.name || "Negociação importada",
              contactId,
              accountId,
              pipelineId,
              stageId,
              valueCents,
              ownerUserId,
              createdBy: userId,
              leadSource: dealSourceName || "rd_station_crm",
            });

            if (result) {
              await setRdExternalId("deals", result.id, dealRdId);
              entry.imported++;
              rdIdMap.deals.set(dealRdId, result.id);

              // ── Post-creation update: status, campaign, lossReason, expectedCloseAt ──
              const postUpdate: Record<string, any> = { updatedBy: userId };
              if (status !== "open") postUpdate.status = status;
              if (campaignName) postUpdate.utmCampaign = campaignName;
              if (lossReasonId) postUpdate.lossReasonId = lossReasonId;
              if (expectedCloseAt) postUpdate.expectedCloseAt = expectedCloseAt;
              if (Object.keys(postUpdate).length > 1) {
                try {
                  await crm.updateDeal(tenantId, result.id, postUpdate);
                } catch {}
              }

              // Import deal products
              if (d.deal_products?.length) {
                for (const dp of d.deal_products) {
                  try {
                    let finalProductId = dp.product_id ? (rdIdMap.products.get(dp.product_id) || 0) : 0;
                    if (!finalProductId && dp.name) {
                      // Check if product exists by rdExternalId
                      if (dp.product_id) {
                        const existingProdId = await findByRdExternalId("product_catalog", tenantId, dp.product_id);
                        if (existingProdId) {
                          finalProductId = existingProdId;
                          rdIdMap.products.set(dp.product_id, existingProdId);
                        }
                      }
                      if (!finalProductId) {
                        const newProd = await crm.createCatalogProduct({
                          tenantId,
                          name: dp.name,
                          basePriceCents: Math.round((dp.price || 0) * 100),
                          productType: "other",
                        });
                        if (newProd) {
                          finalProductId = newProd.id;
                          if (dp.product_id) {
                            await setRdExternalId("product_catalog", newProd.id, dp.product_id);
                            rdIdMap.products.set(dp.product_id, newProd.id);
                          }
                        }
                      }
                    }
                    if (finalProductId) {
                      await crm.createDealProduct({
                        tenantId,
                        dealId: result.id,
                        productId: finalProductId,
                        name: dp.name || "Produto",
                        quantity: dp.amount || 1,
                        unitPriceCents: Math.round((dp.price || 0) * 100),
                        finalPriceCents: Math.round((dp.total || 0) * 100),
                        description: dp.description,
                      });
                    }
                  } catch {}
                }
              }

              // Add deal history
              try {
                await crm.createDealHistory({
                  tenantId,
                  dealId: result.id,
                  action: "import",
                  description: `Importado do RD Station CRM (ID: ${dealRdId})`,
                  actorUserId: userId,
                  actorName: userName,
                });
              } catch {}
            }
          } catch (e: any) {
            if (entry.errors.length < 20) entry.errors.push(`Negociação ${d.name}: ${e.message}`);
            if (entry.errors.length <= 3) console.error(`[RD Import] Deal error ${i}:`, e.message);
          }
          if (i % 20 === 0) {
            setCategoryProgress(i + 1, rdDeals.length);
            if (i % 500 === 0) console.log(`[RD Import] Deals progress: ${i}/${rdDeals.length}, imported: ${entry.imported}, skipped: ${entry.skipped}`);
          }
        }
        setCategoryProgress(rdDeals.length, rdDeals.length);
        console.log(`[RD Import] Deals done: ${entry.imported} imported, ${entry.skipped} skipped, ${entry.errors.length} errors`);
      } catch (e: any) {
        console.error("[RD Import] DEALS OUTER ERROR:", e.message, e.stack);
        entry.errors.push(`Buscar negociações: ${e.message}`);
      }
      results.deals = entry;
    }

    // ═══════════════════════════════════════════════════════════
    // 10. TASKS
    // ═══════════════════════════════════════════════════════════
    if (input.importTasks) {
      advanceStep("tasks", "Tarefas");
      const entry = makeEntry();
      try {
        console.log("[RD Import] Starting tasks fetch...");
        updateProgress(userId, { phase: "Buscando tarefas do RD Station..." });
        const rdTasks = await rdCrm.fetchAllTasks(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
          updateProgress(userId, { phase: `Buscando tarefas... ${fetched}/${total}` });
        });
        rdCounts.tasks = rdTasks.length;
        console.log(`[RD Import] Fetched ${rdTasks.length} tasks. Starting import...`);
        updateProgress(userId, { phase: "Importando tarefas..." });
        setCategoryProgress(0, rdTasks.length);

        for (let i = 0; i < rdTasks.length; i++) {
          const t = rdTasks[i];
          try {
            // Check if task already exists by rdExternalId
            const existingTaskId = await findByRdExternalId("crm_tasks", tenantId, t._id);
            if (existingTaskId) {
              entry.skipped++;
              if (i % 500 === 0) setCategoryProgress(i + 1, rdTasks.length);
              continue;
            }

            // Try to link to a deal or contact
            let entityType = "deal";
            let entityId = 0;

            if (t.deal_id && rdIdMap.deals.has(t.deal_id)) {
              entityType = "deal";
              entityId = rdIdMap.deals.get(t.deal_id)!;
            }
            if (!entityId && t.contact_id && rdIdMap.contacts.has(t.contact_id)) {
              entityType = "contact";
              entityId = rdIdMap.contacts.get(t.contact_id)!;
            }

            if (!entityId) {
              entry.skipped++;
              if (i % 50 === 0) setCategoryProgress(i + 1, rdTasks.length);
              continue;
            }

            // Resolve task owner
            let assignedToUserId: number | undefined;
            const taskUser = t.user || (t.users && t.users[0]);
            if (taskUser?._id && rdIdMap.users.has(taskUser._id)) {
              assignedToUserId = rdIdMap.users.get(taskUser._id);
            }

            const dueAt = t.date ? new Date(t.date) : undefined;
            const rdTypeMap: Record<string, string> = {
              call: "phone",
              whatsapp: "whatsapp",
              email: "email",
              meeting: "video_call",
              task: "task",
            };
            const taskType = rdTypeMap[t.type] || "task";

            const result = await crm.createTask({
              tenantId,
              entityType,
              entityId,
              title: t.subject || "Tarefa importada",
              description: t.notes || undefined,
              dueAt: dueAt && !isNaN(dueAt.getTime()) ? dueAt : undefined,
              createdByUserId: userId,
              assignedToUserId,
              taskType,
            });
            if (result) {
              await setRdExternalId("crm_tasks", result.id, t._id);
              entry.imported++;
              if (t.done) {
                try {
                  await db.update(crmTasks)
                    .set({ status: "done" })
                    .where(and(eq(crmTasks.id, result.id), eq(crmTasks.tenantId, tenantId)));
                } catch {}
              }
            }
          } catch (e: any) {
            if (entry.errors.length < 20) entry.errors.push(`Tarefa ${t.subject}: ${e.message}`);
          }
          if (i % 50 === 0) setCategoryProgress(i + 1, rdTasks.length);
        }
        setCategoryProgress(rdTasks.length, rdTasks.length);
        console.log(`[RD Import] Tasks done: ${entry.imported} imported, ${entry.skipped} skipped, ${entry.errors.length} errors`);
      } catch (e: any) {
        console.error("[RD Import] TASKS OUTER ERROR:", e.message, e.stack);
        entry.errors.push(`Buscar tarefas: ${e.message}`);
      }
      results.tasks = entry;
    }

    // ═══════════════════════════════════════════════════════════
    // 11. POST-IMPORT VALIDATION
    // ═══════════════════════════════════════════════════════════
    advanceStep("validation", "Validação pós-importação");
    updateProgress(userId, { phase: "Validando dados importados..." });

    const validation: ImportValidation = {
      rdCounts,
      enturCounts: {},
      mismatches: [],
      duplicatesRemoved: {},
    };

    try {
      // Count records in Entur OS
      const [contactCount]: any = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt FROM contacts WHERE tenantId = ${tenantId} AND source = 'rd_station_crm' AND deletedAt IS NULL`)
      );
      validation.enturCounts.contacts = contactCount?.[0]?.cnt || 0;

      const [dealCount]: any = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt FROM deals WHERE tenantId = ${tenantId} AND leadSource = 'rd_station_crm' AND deletedAt IS NULL`)
      );
      validation.enturCounts.deals = dealCount?.[0]?.cnt || 0;

      const [taskCount]: any = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt FROM crm_tasks WHERE tenantId = ${tenantId}`)
      );
      validation.enturCounts.tasks = taskCount?.[0]?.cnt || 0;

      const [pipelineCount]: any = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt FROM pipelines WHERE tenantId = ${tenantId}`)
      );
      validation.enturCounts.pipelines = pipelineCount?.[0]?.cnt || 0;

      const [accountCount]: any = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt FROM accounts WHERE tenantId = ${tenantId}`)
      );
      validation.enturCounts.accounts = accountCount?.[0]?.cnt || 0;

      // Check for deals without contacts
      const [dealsNoContact]: any = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt FROM deals WHERE tenantId = ${tenantId} AND leadSource = 'rd_station_crm' AND contactId IS NULL AND deletedAt IS NULL`)
      );
      const noContactCount = dealsNoContact?.[0]?.cnt || 0;
      if (noContactCount > 0) {
        validation.mismatches.push(`${noContactCount} negociações sem contato vinculado`);
      }

      // Check for duplicate pipelines (same name, same tenant)
      const [dupePipelines]: any = await db.execute(
        sql.raw(`SELECT name, COUNT(*) as cnt FROM pipelines WHERE tenantId = ${tenantId} GROUP BY name HAVING cnt > 1`)
      );
      if (dupePipelines && dupePipelines.length > 0) {
        for (const dp of dupePipelines) {
          validation.mismatches.push(`Funil "${dp.name}" aparece ${dp.cnt}x (duplicado)`);
        }
      }

      // Check for duplicate contacts (same email)
      const [dupeContacts]: any = await db.execute(
        sql.raw(`SELECT email, COUNT(*) as cnt FROM contacts WHERE tenantId = ${tenantId} AND source = 'rd_station_crm' AND deletedAt IS NULL AND email IS NOT NULL AND email != '' GROUP BY email HAVING cnt > 1 LIMIT 10`)
      );
      if (dupeContacts && dupeContacts.length > 0) {
        validation.mismatches.push(`${dupeContacts.length}+ emails de contatos duplicados encontrados`);
      }

      console.log("[RD Import] Validation:", JSON.stringify(validation, null, 2));
    } catch (e: any) {
      console.error("[RD Import] Validation error:", e.message);
      validation.mismatches.push(`Erro na validação: ${e.message}`);
    }

    // ─── Done ───
    updateProgress(userId, {
      status: "done",
      phase: "Importação concluída!",
      completedSteps: enabledCategories.length,
      results,
      validation,
    });
    console.log("[RD Import] IMPORT COMPLETE. Results:", JSON.stringify(results, null, 2));
  } catch (e: any) {
    console.error("[RD Import] FATAL:", e.message, e.stack);
    updateProgress(userId, {
      status: "error",
      error: e.message || "Erro desconhecido na importação",
      results,
    });
  }
}
