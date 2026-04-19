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
import { tenantAdminProcedure, getTenantId, router } from "../_core/trpc";
import * as rdCrm from "../rdStationCrmImport";
import * as crm from "../crmDb";
import { getDb } from "../db";
import {
  contacts, accounts, deals, pipelines, pipelineStages,
  tasks as crmTasks, productCatalog, leadSources, campaigns, lossReasons, crmUsers,
} from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// ─── Database-backed progress store ───
// Progress is persisted to the `import_progress` table so it survives
// server restarts and works across multiple server instances.
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
  fetchPhase: boolean;
  fetchedRecords: number;
  totalRecordsEstimate: number;
  processedRecords: number;
  lastActivityAt: number;
}

interface ImportValidation {
  rdCounts: Record<string, number>;
  enturCounts: Record<string, number>;
  mismatches: string[];
  duplicatesRemoved: Record<string, number>;
}

// In-memory cache + debounced DB writes
const progressCache = new Map<string, ImportProgress>();
const pendingFlush = new Map<string, NodeJS.Timeout>();
const FLUSH_INTERVAL_MS = 1500; // Write to DB at most every 1.5s

// Also keep the old progressStore reference for spreadsheet import (which stays in-memory)
const progressStore = new Map<string, any>();

function getProgressKey(tenantId: number, userId: number): string {
  return `import_${tenantId}_${userId}`;
}

// Legacy key for backward compat in spreadsheet import
function getLegacyKey(userId: number): string {
  return `spreadsheet_${userId}`;
}

async function flushProgressToDb(tenantId: number, userId: number): Promise<void> {
  const key = getProgressKey(tenantId, userId);
  const p = progressCache.get(key);
  if (!p) return;
  try {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql.raw(`
      INSERT INTO import_progress ("tenantId", "userId", "importType", status, phase, "currentStep", "totalSteps", "completedSteps", "currentCategory", "categoryTotal", "categoryDone", results, error, "startedAt", "fetchPhase", "fetchedRecords", "totalRecordsEstimate", "processedRecords", "lastActivityAt", validation)
      VALUES (${tenantId}, ${userId}, 'rdcrm', '${p.status}', ${escSql(p.phase)}, ${escSql(p.currentStep)}, ${p.totalSteps}, ${p.completedSteps}, ${escSql(p.currentCategory)}, ${p.categoryTotal}, ${p.categoryDone}, ${escSql(JSON.stringify(p.results || {}))}, ${p.error ? escSql(p.error) : 'NULL'}, ${p.startedAt}, ${p.fetchPhase ? 'true' : 'false'}, ${p.fetchedRecords}, ${p.totalRecordsEstimate}, ${p.processedRecords}, ${p.lastActivityAt}, ${p.validation ? escSql(JSON.stringify(p.validation)) : 'NULL'})
      ON CONFLICT ("tenantId", "userId", "importType") DO UPDATE SET
        status = EXCLUDED.status, phase = EXCLUDED.phase, "currentStep" = EXCLUDED."currentStep",
        "totalSteps" = EXCLUDED."totalSteps", "completedSteps" = EXCLUDED."completedSteps",
        "currentCategory" = EXCLUDED."currentCategory", "categoryTotal" = EXCLUDED."categoryTotal",
        "categoryDone" = EXCLUDED."categoryDone", results = EXCLUDED.results, error = EXCLUDED.error,
        "fetchPhase" = EXCLUDED."fetchPhase", "fetchedRecords" = EXCLUDED."fetchedRecords",
        "totalRecordsEstimate" = EXCLUDED."totalRecordsEstimate", "processedRecords" = EXCLUDED."processedRecords",
        "lastActivityAt" = EXCLUDED."lastActivityAt", validation = EXCLUDED.validation
    `));
  } catch (e: any) {
    console.error("[RD Import] Failed to flush progress to DB:", e.message?.substring(0, 120));
  }
}

function escSql(val: string): string {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
}

function scheduleFlush(tenantId: number, userId: number): void {
  const key = getProgressKey(tenantId, userId);
  if (pendingFlush.has(key)) return; // Already scheduled
  const timer = setTimeout(async () => {
    pendingFlush.delete(key);
    await flushProgressToDb(tenantId, userId);
  }, FLUSH_INTERVAL_MS);
  pendingFlush.set(key, timer);
}

function initProgress(tenantId: number, userId: number): ImportProgress {
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
    fetchPhase: false,
    fetchedRecords: 0,
    totalRecordsEstimate: 0,
    processedRecords: 0,
    lastActivityAt: Date.now(),
  };
  const key = getProgressKey(tenantId, userId);
  progressCache.set(key, p);
  // Immediately flush the initial state
  flushProgressToDb(tenantId, userId).catch(() => {});
  return p;
}

function updateProgress(tenantId: number, userId: number, update: Partial<ImportProgress>) {
  const key = getProgressKey(tenantId, userId);
  let current = progressCache.get(key);
  if (!current) {
    // Shouldn't happen, but create a fallback
    current = initProgress(tenantId, userId);
  }
  Object.assign(current, update);
  current.lastActivityAt = Date.now();
  // Schedule debounced DB write
  scheduleFlush(tenantId, userId);
}

// Force immediate flush (used for critical state changes like done/error)
async function flushNow(tenantId: number, userId: number): Promise<void> {
  const key = getProgressKey(tenantId, userId);
  const timer = pendingFlush.get(key);
  if (timer) {
    clearTimeout(timer);
    pendingFlush.delete(key);
  }
  await flushProgressToDb(tenantId, userId);
}

async function readProgressFromDb(tenantId: number, userId: number): Promise<ImportProgress | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const rows: any = await db.execute(
      sql.raw(`SELECT * FROM import_progress WHERE "tenantId" = ${tenantId} AND "userId" = ${userId} AND "importType" = 'rdcrm' LIMIT 1`)
    );
    if (!rows || rows.length === 0) return null;
    const row = rows[0] || rows;
    if (!row || !row.status) return null;
    return {
      status: row.status,
      phase: row.phase || "",
      currentStep: row.currentStep || "",
      totalSteps: Number(row.totalSteps) || 0,
      completedSteps: Number(row.completedSteps) || 0,
      currentCategory: row.currentCategory || "",
      categoryTotal: Number(row.categoryTotal) || 0,
      categoryDone: Number(row.categoryDone) || 0,
      results: typeof row.results === 'string' ? JSON.parse(row.results) : (row.results || {}),
      error: row.error || undefined,
      startedAt: Number(row.startedAt) || Date.now(),
      fetchPhase: Boolean(row.fetchPhase),
      fetchedRecords: Number(row.fetchedRecords) || 0,
      totalRecordsEstimate: Number(row.totalRecordsEstimate) || 0,
      processedRecords: Number(row.processedRecords) || 0,
      lastActivityAt: Number(row.lastActivityAt) || Date.now(),
      validation: row.validation ? (typeof row.validation === 'string' ? JSON.parse(row.validation) : row.validation) : undefined,
    };
  } catch (e: any) {
    console.error("[RD Import] Failed to read progress from DB:", e.message?.substring(0, 120));
    return null;
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
        `ALTER TABLE "${table}" ADD COLUMN "rdExternalId" VARCHAR(64) NULL`
      ));
      console.log(`[RD Import] Added rdExternalId column to ${table}`);
    } catch (e: any) {
      // Column already exists — ignore
      if (!e.message?.includes("already exists") && !e.message?.includes("Duplicate column")) {
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
      await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${table}" (${cols.split(', ').map((c: string) => `"${c.trim()}"`).join(', ')})`));
    } catch {}
  }
}

// ─── Helper: find existing record by rdExternalId ───
async function findByRdExternalId(table: string, tenantId: number, rdExternalId: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows: any = await db.execute(
      sql.raw(`SELECT id FROM "${table}" WHERE "tenantId" = ${tenantId} AND "rdExternalId" = '${rdExternalId.replace(/'/g, "''")}' LIMIT 1`)
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
      sql.raw(`UPDATE "${table}" SET "rdExternalId" = '${rdExternalId.replace(/'/g, "''")}' WHERE id = ${id}`)
    );
  } catch {}
}

export const rdCrmImportRouter = router({
  // ─── Validate Token ───
  validateToken: tenantAdminProcedure
    .input(z.object({ token: z.string().min(10) }))
    .mutation(async ({ input, ctx }) => {
      return rdCrm.validateRdCrmToken(input.token);
    }),

  // ─── Fetch Summary (preview before import) ───
  fetchSummary: tenantAdminProcedure
    .input(z.object({ token: z.string().min(10) }))
    .mutation(async ({ input, ctx }) => {
      return rdCrm.fetchRdCrmSummary(input.token);
    }),

  // ─── Get Import Progress (reads from database for cross-instance persistence) ───
  getProgress: tenantAdminProcedure.query(async ({ ctx }) => {
    const tenantId = (ctx as any).saasUser?.tenantId ?? getTenantId(ctx);
    // First check in-memory cache (faster, same instance)
    const key = getProgressKey(tenantId, ctx.user.id);
    const cached = progressCache.get(key);
    if (cached) return cached;
    // Fallback: read from DB (cross-instance)
    return readProgressFromDb(tenantId, ctx.user.id);
  }),

  // ─── Import All Data (runs in background, progress via polling) ───
  importAll: tenantAdminProcedure
    .input(z.object({
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
      const tenantId = (ctx as any).saasUser?.tenantId ?? getTenantId(ctx);
      const { token } = input;
      const userId = ctx.user.id;
      const userName = ctx.user.name || "Sistema";

      const progress = initProgress(tenantId, userId);
      progress.status = "fetching";
      progress.phase = "Iniciando importação...";

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
      // Immediately flush the initial fetching state to DB
      await flushNow(tenantId, userId);

      runImport(tenantId, userId, tenantId, token, userName, input, enabledCategories).catch((err) => {
        console.error("[RD Import] FATAL ERROR:", err);
        updateProgress(tenantId, userId, {
          status: "error",
          error: err.message || "Erro desconhecido na importação",
        });
        flushNow(tenantId, userId).catch(() => {});
      });

      return { started: true, categories: enabledCategories.length };
    }),

  // ─── Get Spreadsheet Import Progress ───
  getSpreadsheetProgress: tenantAdminProcedure.query(({ ctx }) => {
    const key = `spreadsheet_${ctx.user.id}`;
    return progressStore.get(key) || null;
  }),

  // ─── Import from RD Station CSV (comprehensive, all 48 columns) ───
  importSpreadsheet: tenantAdminProcedure
    .input(z.object({
      rows: z.array(z.record(z.string(), z.string().nullable().optional())),
      columnMapping: z.record(z.string(), z.string()).optional(), // csvHeader → internalKey
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = (ctx as any).saasUser?.tenantId ?? getTenantId(ctx);
      const userId = ctx.user.id;
      const userName = ctx.user.name || "Sistema";
      const { rows } = input;

      // Initialize progress and start background processing
      const progressKey = `spreadsheet_${userId}`;
      const ssProgress: any = {
        status: "importing",
        phase: "Iniciando importação...",
        totalRows: rows.length,
        processedRows: 0,
        imported: 0,
        skipped: 0,
        errors: 0,
        errorDetails: [] as string[],
        contactsCreated: 0,
        accountsCreated: 0,
        productsCreated: 0,
        customFieldsDetected: 0,
      };
      progressStore.set(progressKey, ssProgress);

      // Start background processing (don't await)
      runSpreadsheetImport(userId, tenantId, userName, rows, input.columnMapping, ssProgress, progressKey).catch((err) => {
        console.error("[RD CSV Import] FATAL ERROR:", err);
        ssProgress.status = "error";
        ssProgress.phase = `Erro fatal: ${err.message}`;
      });

      return { started: true, totalRows: rows.length };
    }),
});

// ─── Background spreadsheet import function ───
async function runSpreadsheetImport(
  userId: number,
  tenantId: number,
  userName: string,
  rows: Record<string, string | null | undefined>[],
  columnMapping: Record<string, string> | undefined,
  ssProgress: any,
  progressKey: string,
) {

      let imported = 0;
      let skipped = 0;
      let contactsCreated = 0;
      let accountsCreated = 0;
      let productsCreated = 0;
      const errors: string[] = [];

      await ensureRdExternalIdColumns();

      // ─── Auto-detect RD Station CSV column mapping ───
      const RD_COLUMN_MAP: Record<string, string> = {
        "Nome": "nome", "Empresa": "empresa", "Qualificação": "qualificacao",
        "Funil de vendas": "funil", "Etapa": "etapa", "Estado": "estado",
        "Motivo de Perda": "motivoPerda", "Valor Único": "valorUnico",
        "Valor Recorrente": "valorRecorrente", "Pausada": "pausada",
        "Data de criação": "dataCriacao", "Hora de criação": "horaCriacao",
        "Data do primeiro contato": "dataPrimeiroContato", "Hora do primeiro contato": "horaPrimeiroContato",
        "Data do último contato": "dataUltimoContato", "Hora do último contato": "horaUltimoContato",
        "Data da próxima tarefa": "dataProximaTarefa", "Hora da próxima tarefa": "horaProximaTarefa",
        "Previsão de fechamento": "previsaoFechamento", "Data de fechamento": "dataFechamento",
        "Hora de fechamento": "horaFechamento", "Fonte": "fonte", "Campanha": "campanha",
        "Responsável": "responsavel", "Produtos": "produtos",
        "Equipes do responsável": "equipes", "Anotação do motivo de perda": "anotacaoPerda",
        "utm_campaign": "utmCampaign", "utm_term": "utmTerm", "utm_content": "utmContent",
        "utm_source": "utmSource", "utm_medium": "utmMedium",
        "Contatos": "contatos", "Cargo": "cargo", "Email": "email", "Telefone": "telefone",
        // Legacy simple format support
        "nome": "nome", "email": "email", "telefone": "telefone", "empresa": "empresa",
        "negociacao": "nome", "valor": "valorUnico", "etapa": "etapa",
        "fonte": "fonte", "campanha": "campanha", "notas": "anotacaoPerda",
      };

      function getVal(row: Record<string, string | null | undefined>, key: string): string {
        // Try mapped key first, then try original header
        const v = row[key];
        if (v != null && v.trim()) return v.trim();
        // Try reverse lookup from RD_COLUMN_MAP
        for (const [csvHeader, internalKey] of Object.entries(RD_COLUMN_MAP)) {
          if (internalKey === key) {
            const v2 = row[csvHeader];
            if (v2 != null && v2.trim()) return v2.trim();
          }
        }
        return "";
      }

      // Normalize row keys using the column mapping
      function normalizeRow(raw: Record<string, string | null | undefined>): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [csvHeader, value] of Object.entries(raw)) {
          const mapped = RD_COLUMN_MAP[csvHeader.trim()] || columnMapping?.[csvHeader.trim()];
          const key = mapped || csvHeader.trim();
          result[key] = (value ?? "").trim();
          // Also keep original header for custom fields
          result[csvHeader.trim()] = (value ?? "").trim();
        }
        return result;
      }

      // ─── Parse Brazilian date (DD/MM/YYYY) to Date ───
      function parseBrDate(dateStr: string, timeStr?: string): Date | null {
        if (!dateStr) return null;
        const parts = dateStr.split("/");
        if (parts.length !== 3) return null;
        const [day, month, year] = parts.map(Number);
        if (!day || !month || !year) return null;
        let hours = 0, minutes = 0;
        if (timeStr) {
          const tp = timeStr.split(":");
          hours = parseInt(tp[0]) || 0;
          minutes = parseInt(tp[1]) || 0;
        }
        return new Date(year, month - 1, day, hours, minutes);
      }

      // ─── Parse monetary value ("4997.0" or "R$ 4.997,00") ───
      function parseMoneyToCents(val: string): number {
        if (!val) return 0;
        // RD exports as "4997.0" (dot decimal, no thousands separator)
        let cleaned = val.replace(/[R$\s]/g, "");
        // If it has both . and , → Brazilian format (1.234,56)
        if (cleaned.includes(".") && cleaned.includes(",")) {
          cleaned = cleaned.replace(/\./g, "").replace(",", ".");
        } else if (cleaned.includes(",") && !cleaned.includes(".")) {
          cleaned = cleaned.replace(",", ".");
        }
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : Math.round(parsed * 100);
      }

      // ─── Pre-fetch all reference data ───
      const allPipelines = await crm.listPipelines(tenantId);
      const defaultPipeline = allPipelines.find((p: any) => p.isDefault) || allPipelines[0];
      if (!defaultPipeline) throw new Error("Nenhum funil encontrado. Crie um funil antes de importar.");

      // Build pipeline name → id map
      const pipelineByName = new Map<string, number>();
      for (const p of allPipelines) pipelineByName.set(p.name.toLowerCase().trim(), p.id);

      // Build stage maps per pipeline
      const allStagesMap = new Map<number, any[]>();
      const stageByNameGlobal = new Map<string, { pipelineId: number; stageId: number }>();
      for (const p of allPipelines) {
        const stages = await crm.listStages(tenantId, p.id);
        allStagesMap.set(p.id, stages);
        for (const s of stages) {
          stageByNameGlobal.set(s.name.toLowerCase().trim(), { pipelineId: p.id, stageId: s.id });
        }
      }
      const defaultStages = allStagesMap.get(defaultPipeline.id) || [];
      const defaultStage = defaultStages[0];
      if (!defaultStage) throw new Error("Nenhuma etapa encontrada no funil padrão.");

      // Find won/lost stages
      const wonStageMap = new Map<number, number>(); // pipelineId → wonStageId
      const lostStageMap = new Map<number, number>();
      for (const [pId, stages] of Array.from(allStagesMap.entries())) {
        const won = stages.find((s: any) => s.isWon);
        const lost = stages.find((s: any) => s.isLost);
        if (won) wonStageMap.set(pId, won.id);
        if (lost) lostStageMap.set(pId, lost.id);
      }

      // Sources, campaigns, loss reasons
      const existingSources = await crm.listLeadSources(tenantId);
      const existingCampaigns = await crm.listCampaigns(tenantId);
      const existingLossReasons = await crm.listLossReasons(tenantId);
      const sourceMap = new Map(existingSources.map((s: any) => [s.name.toLowerCase().trim(), s.id]));
      const campaignMap = new Map(existingCampaigns.map((c: any) => [c.name.toLowerCase().trim(), c.id]));
      const lossReasonMap = new Map(existingLossReasons.map((r: any) => [r.name.toLowerCase().trim(), r.id]));

      // CRM users (responsáveis)
      const existingCrmUsers = await crm.listCrmUsers(tenantId);
      const crmUserByName = new Map<string, number>();
      for (const u of existingCrmUsers) {
        crmUserByName.set(u.name.toLowerCase().trim(), u.id);
      }

      // Product catalog
      const existingProducts = await crm.listCatalogProducts(tenantId, {});
      const productByName = new Map<string, number>();
      for (const p of existingProducts) {
        productByName.set(p.name.toLowerCase().trim(), p.id);
      }

      // Contact/account dedup caches
      const contactByEmail = new Map<string, number>();
      const contactByPhone = new Map<string, number>();
      const contactByName = new Map<string, number>();
      const accountByName = new Map<string, number>();

      const db = await getDb();
      if (db) {
        try {
          const ec: any = await db.execute(
            sql.raw(`SELECT id, email, phone, name FROM contacts WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL`)
          );
          if (ec) for (const c of ec) {
            if (c.email) contactByEmail.set(c.email.toLowerCase().trim(), c.id);
            if (c.phone) contactByPhone.set(c.phone.replace(/\D/g, "").slice(-11), c.id);
            if (c.name) contactByName.set(c.name.toLowerCase().trim(), c.id);
          }
        } catch {}
        try {
          const ea: any = await db.execute(
            sql.raw(`SELECT id, name FROM accounts WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL`)
          );
          if (ea) for (const a of ea) {
            if (a.name) accountByName.set(a.name.toLowerCase().trim(), a.id);
          }
        } catch {}
      }

      // ─── Helper: find or create contact by email/phone/name ───
      async function findOrCreateContact(name: string, email?: string, phone?: string, cargo?: string, source?: string): Promise<number | undefined> {
        // Dedup by email first
        const emailKey = email?.toLowerCase().trim();
        if (emailKey && contactByEmail.has(emailKey)) return contactByEmail.get(emailKey);
        // Dedup by phone (last 11 digits)
        if (phone) {
          const phoneKey = phone.replace(/\D/g, "").slice(-11);
          if (phoneKey.length >= 10 && contactByPhone.has(phoneKey)) return contactByPhone.get(phoneKey);
        }
        // Dedup by exact name
        const nameKey = name.toLowerCase().trim();
        if (contactByName.has(nameKey)) return contactByName.get(nameKey);

        const contact = await crm.createContact({
          tenantId, name: name.trim(),
          email: email?.trim() || undefined,
          phone: phone?.trim() || undefined,
          source: source || "Importação RD",
          createdBy: userId,
        });
        if (contact) {
          const id = (contact as any).insertId ?? (contact as any).id;
          if (id) {
            if (emailKey) contactByEmail.set(emailKey, id);
            if (phone) contactByPhone.set(phone.replace(/\D/g, "").slice(-11), id);
            contactByName.set(nameKey, id);
            contactsCreated++;
            // Set cargo as custom field if provided
            if (cargo && db) {
              try {
                // Ensure "Cargo" custom field exists
                let cargoFieldId: number | undefined;
                const cfRows: any = await db.execute(
                  sql.raw(`SELECT id FROM custom_fields WHERE "tenantId" = ${tenantId} AND name = 'cargo' AND entity = 'contact' LIMIT 1`)
                );
                if (cfRows && cfRows.length > 0) {
                  cargoFieldId = cfRows[0].id;
                } else {
                  const ins: any = await db.execute(
                    sql.raw(`INSERT INTO custom_fields ("tenantId", entity, name, label, "fieldType", "sortOrder") VALUES (${tenantId}, 'contact', 'cargo', 'Cargo', 'text', 0) RETURNING id`)
                  );
                  cargoFieldId = ins?.[0]?.id;
                }
                if (cargoFieldId) {
                  await db.execute(
                    sql.raw(`INSERT INTO custom_field_values ("tenantId", "fieldId", "entityType", "entityId", value) VALUES (${tenantId}, ${cargoFieldId}, 'contact', ${id}, '${cargo.replace(/'/g, "''")}')`)
                  );
                }
              } catch {}
            }
          }
          return id;
        }
        return undefined;
      }

      // ─── Helper: find or create account ───
      async function findOrCreateAccount(name: string, contactId?: number): Promise<number | undefined> {
        const key = name.toLowerCase().trim();
        if (accountByName.has(key)) return accountByName.get(key);
        const account = await crm.createAccount({
          tenantId, name: name.trim(), primaryContactId: contactId, createdBy: userId,
        });
        if (account) {
          const id = (account as any).insertId ?? (account as any).id;
          if (id) { accountByName.set(key, id); accountsCreated++; }
          return id;
        }
        return undefined;
      }

      // ─── Helper: find or create CRM user (responsável) ───
      async function findOrCreateCrmUser(name: string): Promise<number | undefined> {
        const key = name.toLowerCase().trim();
        if (crmUserByName.has(key)) return crmUserByName.get(key);
        try {
          const user = await crm.createCrmUser({
            tenantId, name: name.trim(), email: `${key.replace(/\s+/g, ".")}@importado.rd`,
          });
          if (user) {
            const id = (user as any).insertId ?? (user as any).id;
            if (id) crmUserByName.set(key, id);
            return id;
          }
        } catch {}
        return undefined;
      }

      // ─── Helper: find or create product ───
      async function findOrCreateProduct(name: string): Promise<number | undefined> {
        const key = name.toLowerCase().trim();
        if (productByName.has(key)) return productByName.get(key);
        try {
          const prod = await crm.createCatalogProduct({
            tenantId, name: name.trim(), basePriceCents: 0, productType: "other",
          });
          if (prod) {
            const id = (prod as any).insertId ?? (prod as any).id;
            if (id) { productByName.set(key, id); productsCreated++; }
            return id;
          }
        } catch {}
        return undefined;
      }

      // ─── Helper: find or create source ───
      async function findOrCreateSource(name: string): Promise<number | undefined> {
        const key = name.toLowerCase().trim();
        if (sourceMap.has(key)) return sourceMap.get(key);
        try {
          const src = await crm.createLeadSource({ tenantId, name: name.trim() });
          if (src) {
            const id = (src as any).insertId ?? (src as any).id;
            if (id) sourceMap.set(key, id);
            return id;
          }
        } catch {}
        return undefined;
      }

      // ─── Helper: find or create campaign ───
      async function findOrCreateCampaign(name: string): Promise<number | undefined> {
        const key = name.toLowerCase().trim();
        if (campaignMap.has(key)) return campaignMap.get(key);
        try {
          const camp = await crm.createCampaign({ tenantId, name: name.trim() });
          if (camp) {
            const id = (camp as any).insertId ?? (camp as any).id;
            if (id) campaignMap.set(key, id);
            return id;
          }
        } catch {}
        return undefined;
      }

      // ─── Helper: find or create loss reason ───
      async function findOrCreateLossReason(name: string): Promise<number | undefined> {
        const key = name.toLowerCase().trim();
        if (lossReasonMap.has(key)) return lossReasonMap.get(key);
        try {
          const lr = await crm.createLossReason({ tenantId, name: name.trim() });
          if (lr) {
            const id = (lr as any).insertId ?? (lr as any).id;
            if (id) lossReasonMap.set(key, id);
            return id;
          }
        } catch {}
        return undefined;
      }

      // ─── Detect custom field columns (not in RD_COLUMN_MAP) ───
      const knownKeys = new Set(Object.keys(RD_COLUMN_MAP));
      const customFieldColumns: string[] = [];
      if (rows.length > 0) {
        for (const key of Object.keys(rows[0])) {
          if (!knownKeys.has(key.trim()) && key.trim()) {
            customFieldColumns.push(key.trim());
          }
        }
      }

      // Ensure custom fields exist in DB for detected columns
      const customFieldIdMap = new Map<string, number>(); // columnName → fieldId
      if (customFieldColumns.length > 0 && db) {
        for (const col of customFieldColumns) {
          try {
            const slug = col.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
            const existing: any = await db.execute(
              sql.raw(`SELECT id FROM custom_fields WHERE "tenantId" = ${tenantId} AND name = '${slug}' AND entity = 'deal' LIMIT 1`)
            );
            if (existing && existing.length > 0) {
              customFieldIdMap.set(col, existing[0].id);
            } else {
              const ins: any = await db.execute(
                sql.raw(`INSERT INTO custom_fields ("tenantId", entity, name, label, "fieldType", "sortOrder", "groupName") VALUES (${tenantId}, 'deal', '${slug}', '${col.replace(/'/g, "''")}', 'text', 0, 'Importação RD') RETURNING id`)
              );
              if (ins?.[0]?.id) customFieldIdMap.set(col, ins[0].id);
            }
          } catch {}
        }
      }

      // ─── Process each row ───
      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];
        const row = normalizeRow(raw);

        // Update progress every 10 rows
        if (i % 10 === 0) {
          ssProgress.processedRows = i;
          ssProgress.imported = imported;
          ssProgress.skipped = skipped;
          ssProgress.errors = errors.length;
          ssProgress.errorDetails = errors.slice(-20); // Keep last 20 errors
          ssProgress.contactsCreated = contactsCreated;
          ssProgress.accountsCreated = accountsCreated;
          ssProgress.productsCreated = productsCreated;
          ssProgress.phase = `Processando linha ${i + 1} de ${rows.length}...`;
        }

        try {
          // 1. Parse contacts (may be multiple separated by ;)
          const contactNames = (row.contatos || row.nome || "").split(";").map(s => s.trim()).filter(Boolean);
          const emails = (row.email || "").split(";").map(s => s.trim()).filter(Boolean);
          const phones = (row.telefone || "").split(";").map(s => s.trim()).filter(Boolean);
          const cargo = row.cargo || "";
          const fonte = row.fonte || "";

          // Primary contact = first contact name
          const primaryName = contactNames[0] || row.nome || `Linha ${i + 1}`;
          const primaryEmail = emails[0] || undefined;
          const primaryPhone = phones[0] || undefined;
          const primaryContactId = await findOrCreateContact(primaryName, primaryEmail, primaryPhone, cargo, fonte || "Importação RD");

          // Additional contacts as deal participants (created later)
          const additionalContactIds: number[] = [];
          for (let j = 1; j < contactNames.length; j++) {
            const cId = await findOrCreateContact(
              contactNames[j], emails[j] || undefined, phones[j] || undefined, undefined, fonte || "Importação RD"
            );
            if (cId) additionalContactIds.push(cId);
          }
          // Additional phones/emails without matching contact name → attach to primary
          // (already handled by primary contact creation)

          // 2. Account (empresa)
          let accountId: number | undefined;
          if (row.empresa) accountId = await findOrCreateAccount(row.empresa, primaryContactId);

          // 3. Resolve pipeline + stage
          let targetPipelineId = defaultPipeline.id;
          let targetStageId = defaultStage.id;
          // Try to match pipeline by name
          if (row.funil) {
            const pId = pipelineByName.get(row.funil.toLowerCase().trim());
            if (pId) targetPipelineId = pId;
          }
          // Try to match stage by name
          if (row.etapa) {
            const stageMatch = stageByNameGlobal.get(row.etapa.toLowerCase().trim());
            if (stageMatch) {
              targetPipelineId = stageMatch.pipelineId;
              targetStageId = stageMatch.stageId;
            }
          }

          // 4. Determine deal status
          let dealStatus: "open" | "won" | "lost" = "open";
          const estado = (row.estado || "").toLowerCase();
          if (estado === "vendida" || estado === "won" || estado === "ganha") {
            dealStatus = "won";
            const wonStage = wonStageMap.get(targetPipelineId);
            if (wonStage) targetStageId = wonStage;
          } else if (estado === "perdida" || estado === "lost") {
            dealStatus = "lost";
            const lostStage = lostStageMap.get(targetPipelineId);
            if (lostStage) targetStageId = lostStage;
          }

          // 5. Parse values
          const valorUnico = parseMoneyToCents(row.valorUnico || row["Valor Único"] || "");
          const valorRecorrente = parseMoneyToCents(row.valorRecorrente || row["Valor Recorrente"] || "");
          const valueCents = valorUnico + valorRecorrente;

          // 6. Source + Campaign
          if (fonte) await findOrCreateSource(fonte);
          const campanha = row.campanha || row.utmCampaign || "";
          if (campanha) await findOrCreateCampaign(campanha);

          // 7. Loss reason
          let lossReasonId: number | undefined;
          if (dealStatus === "lost" && row.motivoPerda) {
            lossReasonId = await findOrCreateLossReason(row.motivoPerda);
          }

          // 8. Responsável (owner)
          let ownerUserId: number | undefined;
          if (row.responsavel) ownerUserId = await findOrCreateCrmUser(row.responsavel);

          // 9. Dates
          const createdAt = parseBrDate(row.dataCriacao || "", row.horaCriacao || "");
          const closedAt = parseBrDate(row.dataFechamento || "", row.horaFechamento || "");
          const expectedCloseAt = parseBrDate(row.previsaoFechamento || "");

          // 10. Create deal
          const dealTitle = row.nome || primaryName;
          const deal = await crm.createDeal({
            tenantId,
            title: dealTitle,
            contactId: primaryContactId,
            accountId,
            pipelineId: targetPipelineId,
            stageId: targetStageId,
            valueCents: valueCents || undefined,
            ownerUserId: ownerUserId || userId,
            createdBy: userId,
            leadSource: fonte || "Importação RD",
          });

          if (deal) {
            const dealId = (deal as any).insertId ?? (deal as any).id;

            // 11. Update deal with additional fields
            const updateData: any = {};
            if (dealStatus !== "open") updateData.status = dealStatus;
            if (lossReasonId) updateData.lossReasonId = lossReasonId;
            if (row.anotacaoPerda) updateData.lossNotes = row.anotacaoPerda;
            if (row.utmCampaign || campanha) updateData.utmCampaign = row.utmCampaign || campanha;
            if (row.utmSource) updateData.utmSource = row.utmSource;
            if (row.utmMedium) updateData.utmMedium = row.utmMedium;
            if (row.utmTerm) updateData.utmTerm = row.utmTerm;
            if (row.utmContent) updateData.utmContent = row.utmContent;
            if (expectedCloseAt) updateData.expectedCloseAt = expectedCloseAt;
            if (Object.keys(updateData).length > 0) {
              await crm.updateDeal(tenantId, dealId, updateData);
            }

            // 12. Set createdAt and closedAt via raw SQL (Drizzle doesn't allow setting createdAt)
            if (db && (createdAt || closedAt)) {
              try {
                const sets: string[] = [];
                if (createdAt) sets.push(`createdAt = '${createdAt.toISOString().slice(0, 19).replace("T", " ")}'`);
                if (closedAt) sets.push(`updatedAt = '${closedAt.toISOString().slice(0, 19).replace("T", " ")}'`);
                if (sets.length > 0) {
                  await db.execute(sql.raw(`UPDATE deals SET ${sets.join(", ")} WHERE id = ${dealId}`));
                }
              } catch {}
            }

            // 13. Products (comma-separated)
            if (row.produtos) {
              const productNames = row.produtos.split(",").map((s: string) => s.trim()).filter(Boolean);
              for (const pName of productNames) {
                const productId = await findOrCreateProduct(pName);
                if (productId) {
                  try {
                    await crm.createDealProduct({
                      tenantId, dealId, productId, name: pName.trim(),
                      quantity: 1, unitPriceCents: 0, finalPriceCents: 0,
                    });
                  } catch {}
                }
              }
            }

            // 14. Additional contacts as deal participants
            for (const cId of additionalContactIds) {
              try {
                await crm.addDealParticipant({ tenantId, dealId, contactId: cId, role: "other" });
              } catch {}
            }

            // 15. Custom field values
            if (db && customFieldIdMap.size > 0) {
              for (const [col, fieldId] of Array.from(customFieldIdMap.entries())) {
                const val = raw[col];
                if (val != null && val.trim()) {
                  try {
                    await db.execute(
                      sql.raw(`INSERT INTO custom_field_values ("tenantId", "fieldId", "entityType", "entityId", value) VALUES (${tenantId}, ${fieldId}, 'deal', ${dealId}, '${val.trim().replace(/'/g, "''")}')`)
                    );
                  } catch {}
                }
              }
            }

            // 16. Store RD custom fields in deal JSON column
            const rdCustomFields: Record<string, string> = {};
            if (row.qualificacao) rdCustomFields.qualificacao = row.qualificacao;
            if (row.pausada) rdCustomFields.pausada = row.pausada;
            for (const col of customFieldColumns) {
              const val = raw[col];
              if (val != null && val.trim()) rdCustomFields[col] = val.trim();
            }
            if (Object.keys(rdCustomFields).length > 0 && db) {
              try {
                await db.execute(
                  sql.raw(`UPDATE deals SET "rdCustomFields" = '${JSON.stringify(rdCustomFields).replace(/'/g, "''")}' WHERE id = ${dealId}`)
                );
              } catch {}
            }

            // 17. History
            await crm.createDealHistory({
              tenantId, dealId, action: "created",
              description: `Negociação importada via planilha RD Station por ${userName}`,
              actorUserId: userId, actorName: userName,
            });
          }

          imported++;
        } catch (e: any) {
          const rowName = raw["Nome"] || raw["nome"] || `Linha ${i + 1}`;
          errors.push(`Linha ${i + 1} (${rowName}): ${e.message || "Erro desconhecido"}`);
        }
      }

      // Update final progress (don't delete - let frontend read the final state)
      ssProgress.status = "done";
      ssProgress.processedRows = rows.length;
      ssProgress.imported = imported;
      ssProgress.skipped = skipped;
      ssProgress.errors = errors.length;
      ssProgress.errorDetails = errors.slice(-50); // Keep last 50 errors
      ssProgress.contactsCreated = contactsCreated;
      ssProgress.accountsCreated = accountsCreated;
      ssProgress.productsCreated = productsCreated;
      ssProgress.customFieldsDetected = customFieldColumns.length;
      ssProgress.phase = "Importação concluída!";

      console.log(`[RD CSV Import] Completed: ${imported} imported, ${skipped} skipped, ${errors.length} errors, ${contactsCreated} contacts, ${accountsCreated} accounts, ${productsCreated} products`);

      // Auto-cleanup after 5 minutes
      setTimeout(() => {
        progressStore.delete(progressKey);
      }, 5 * 60 * 1000);
}

// ─── Background import function ───
async function runImport(
  tenantIdForProgress: number,
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
    updateProgress(tenantIdForProgress, userId, { status: "error", error: "Database unavailable" });
    await flushNow(tenantIdForProgress, userId);
    return;
  }

  // Ensure rdExternalId columns exist
  console.log("[RD Import] Ensuring rdExternalId columns exist...");
  updateProgress(tenantIdForProgress, userId, { phase: "Preparando banco de dados..." });
  await ensureRdExternalIdColumns();

  // ─── Clean before import: remove all RD-imported data ───
  if (input.cleanBeforeImport) {
    console.log("[RD Import] Cleaning all previously imported RD Station data...");
    updateProgress(tenantIdForProgress, userId, { phase: "Limpando dados importados anteriormente..." });
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
      await db.execute(sql.raw(`DELETE FROM pipeline_stages WHERE tenantId = ${tenantId} AND pipelineId IN (SELECT id FROM pipelines WHERE tenantId = ${tenantId} AND "isDefault" = false AND name NOT IN ('Funil de Vendas', 'Funil de Pós-Venda'))`));
      await db.execute(sql.raw(`DELETE FROM pipelines WHERE tenantId = ${tenantId} AND "isDefault" = false AND name NOT IN ('Funil de Vendas', 'Funil de Pós-Venda')`));
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
  let cumulativeProcessed = 0;

  function advanceStep(category: string, label: string) {
    stepIndex++;
    updateProgress(tenantIdForProgress, userId, {
      status: "importing",
      phase: `Importando ${label}...`,
      currentStep: label,
      completedSteps: stepIndex - 1,
      currentCategory: category,
      categoryTotal: 0,
      categoryDone: 0,
      fetchPhase: false,
    });
  }

  function setFetchPhase(category: string, label: string) {
    updateProgress(tenantIdForProgress, userId, {
      fetchPhase: true,
      phase: `Buscando ${label} do RD Station...`,
      currentCategory: category,
      categoryDone: 0,
      categoryTotal: 0,
    });
  }

  function setImportPhase(label: string, total: number) {
    updateProgress(tenantIdForProgress, userId, {
      fetchPhase: false,
      phase: `Importando ${label}...`,
      categoryDone: 0,
      categoryTotal: total,
    });
  }

  function setCategoryProgress(done: number, total: number) {
    updateProgress(tenantIdForProgress, userId, { categoryDone: done, categoryTotal: total });
  }

  function addProcessed(count: number) {
    cumulativeProcessed += count;
    updateProgress(tenantIdForProgress, userId, { processedRecords: cumulativeProcessed });
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
        addProcessed(entry.imported + entry.skipped);
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
        addProcessed(entry.imported + entry.skipped);
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
        setFetchPhase("sources", "fontes de leads");
        const rdSources = await rdCrm.fetchAllSources(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
        });
        rdCounts.sources = rdSources.length;
        setImportPhase("fontes", rdSources.length);
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
        setCategoryProgress(rdSources.length, rdSources.length);
        addProcessed(entry.imported + entry.skipped);
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
        setFetchPhase("campaigns", "campanhas");
        const rdCampaigns = await rdCrm.fetchAllCampaigns(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
        });
        rdCounts.campaigns = rdCampaigns.length;
        setImportPhase("campanhas", rdCampaigns.length);
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
        setCategoryProgress(rdCampaigns.length, rdCampaigns.length);
        addProcessed(entry.imported + entry.skipped);
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
        setFetchPhase("lossReasons", "motivos de perda");
        const rdReasons = await rdCrm.fetchAllLossReasons(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
        });
        rdCounts.lossReasons = rdReasons.length;
        setImportPhase("motivos de perda", rdReasons.length);
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
        setCategoryProgress(rdReasons.length, rdReasons.length);
        addProcessed(entry.imported + entry.skipped);
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
        setFetchPhase("products", "produtos");
        const rdProducts = await rdCrm.fetchAllProducts(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
        });
        rdCounts.products = rdProducts.length;
        setImportPhase("produtos", rdProducts.length);
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
        setCategoryProgress(rdProducts.length, rdProducts.length);
        addProcessed(entry.imported + entry.skipped);
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
        setFetchPhase("organizations", "empresas");
        const rdOrgs = await rdCrm.fetchAllOrganizations(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
          updateProgress(tenantIdForProgress, userId, { phase: `Buscando empresas... ${fetched.toLocaleString("pt-BR")}/${total.toLocaleString("pt-BR")}` });
        });
        rdCounts.organizations = rdOrgs.length;
        updateProgress(tenantIdForProgress, userId, { fetchedRecords: (progressCache.get(getProgressKey(tenantIdForProgress, userId))?.fetchedRecords || 0) + rdOrgs.length });
        setImportPhase("empresas", rdOrgs.length);
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
          if (i % 50 === 0) setCategoryProgress(i + 1, rdOrgs.length);
        }
        setCategoryProgress(rdOrgs.length, rdOrgs.length);
        addProcessed(entry.imported + entry.skipped);
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
        setFetchPhase("contacts", "contatos");
        const rdContacts = await rdCrm.fetchAllContacts(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
          updateProgress(tenantIdForProgress, userId, {
            phase: `Buscando contatos... ${fetched.toLocaleString("pt-BR")}/${total.toLocaleString("pt-BR")}`,
          });
        });
        rdCounts.contacts = rdContacts.length;
        updateProgress(tenantIdForProgress, userId, { fetchedRecords: (progressCache.get(getProgressKey(tenantIdForProgress, userId))?.fetchedRecords || 0) + rdContacts.length });
        console.log(`[RD Import] Fetched ${rdContacts.length} contacts. Starting import...`);
        setImportPhase("contatos", rdContacts.length);
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
          if (i % 50 === 0) {
            setCategoryProgress(i + 1, rdContacts.length);
            if (i % 500 === 0) console.log(`[RD Import] Contacts progress: ${i}/${rdContacts.length}, imported: ${entry.imported}, skipped: ${entry.skipped}`);
          }
        }
        setCategoryProgress(rdContacts.length, rdContacts.length);
        addProcessed(entry.imported + entry.skipped);
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
        setFetchPhase("deals", "negocia\u00e7\u00f5es");
        const rdDeals = await rdCrm.fetchAllDeals(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
          updateProgress(tenantIdForProgress, userId, {
            phase: `Buscando negocia\u00e7\u00f5es... ${fetched.toLocaleString("pt-BR")}/${total.toLocaleString("pt-BR")}`,
          });
        });
        rdCounts.deals = rdDeals.length;
        updateProgress(tenantIdForProgress, userId, { fetchedRecords: (progressCache.get(getProgressKey(tenantIdForProgress, userId))?.fetchedRecords || 0) + rdDeals.length });
        console.log(`[RD Import] Fetched ${rdDeals.length} deals. Starting import...`);

        setImportPhase("negocia\u00e7\u00f5es", rdDeals.length);
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
        addProcessed(entry.imported + entry.skipped);
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
        setFetchPhase("tasks", "tarefas");
        const rdTasks = await rdCrm.fetchAllTasks(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
          updateProgress(tenantIdForProgress, userId, { phase: `Buscando tarefas... ${fetched.toLocaleString("pt-BR")}/${total.toLocaleString("pt-BR")}` });
        });
        rdCounts.tasks = rdTasks.length;
        updateProgress(tenantIdForProgress, userId, { fetchedRecords: (progressCache.get(getProgressKey(tenantIdForProgress, userId))?.fetchedRecords || 0) + rdTasks.length });
        console.log(`[RD Import] Fetched ${rdTasks.length} tasks. Starting import...`);
        setImportPhase("tarefas", rdTasks.length);
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
        addProcessed(entry.imported + entry.skipped);
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
    updateProgress(tenantIdForProgress, userId, { phase: "Validando dados importados..." });

    const validation: ImportValidation = {
      rdCounts,
      enturCounts: {},
      mismatches: [],
      duplicatesRemoved: {},
    };

    try {
      // Count records in Entur OS
      const contactCount: any = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt FROM contacts WHERE "tenantId" = ${tenantId} AND source = 'rd_station_crm' AND "deletedAt" IS NULL`)
      );
      validation.enturCounts.contacts = contactCount?.[0]?.cnt || 0;

      const dealCount: any = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt FROM deals WHERE "tenantId" = ${tenantId} AND "leadSource" = 'rd_station_crm' AND "deletedAt" IS NULL`)
      );
      validation.enturCounts.deals = dealCount?.[0]?.cnt || 0;

      const taskCount: any = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt FROM crm_tasks WHERE "tenantId" = ${tenantId}`)
      );
      validation.enturCounts.tasks = taskCount?.[0]?.cnt || 0;

      const pipelineCount: any = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt FROM pipelines WHERE "tenantId" = ${tenantId}`)
      );
      validation.enturCounts.pipelines = pipelineCount?.[0]?.cnt || 0;

      const accountCount: any = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt FROM accounts WHERE "tenantId" = ${tenantId}`)
      );
      validation.enturCounts.accounts = accountCount?.[0]?.cnt || 0;

      // Check for deals without contacts
      const dealsNoContact: any = await db.execute(
        sql.raw(`SELECT COUNT(*) as cnt FROM deals WHERE "tenantId" = ${tenantId} AND "leadSource" = 'rd_station_crm' AND "contactId" IS NULL AND "deletedAt" IS NULL`)
      );
      const noContactCount = dealsNoContact?.[0]?.cnt || 0;
      if (noContactCount > 0) {
        validation.mismatches.push(`${noContactCount} negociações sem contato vinculado`);
      }

      // Check for duplicate pipelines (same name, same tenant)
      const dupePipelines: any = await db.execute(
        sql.raw(`SELECT name, COUNT(*) as cnt FROM pipelines WHERE "tenantId" = ${tenantId} GROUP BY name HAVING COUNT(*) > 1`)
      );
      if (dupePipelines && dupePipelines.length > 0) {
        for (const dp of dupePipelines) {
          validation.mismatches.push(`Funil "${dp.name}" aparece ${dp.cnt}x (duplicado)`);
        }
      }

      // Check for duplicate contacts (same email)
      const dupeContacts: any = await db.execute(
        sql.raw(`SELECT email, COUNT(*) as cnt FROM contacts WHERE "tenantId" = ${tenantId} AND source = 'rd_station_crm' AND "deletedAt" IS NULL AND email IS NOT NULL AND email != '' GROUP BY email HAVING COUNT(*) > 1 LIMIT 10`)
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
    updateProgress(tenantIdForProgress, userId, {
      status: "done",
      phase: "Importação concluída!",
      completedSteps: enabledCategories.length,
      results,
      validation,
    });
    // Immediately flush final state to DB
    await flushNow(tenantIdForProgress, userId);
    console.log("[RD Import] IMPORT COMPLETE. Results:", JSON.stringify(results, null, 2));
  } catch (e: any) {
    console.error("[RD Import] FATAL:", e.message, e.stack);
    updateProgress(tenantIdForProgress, userId, {
      status: "error",
      error: e.message || "Erro desconhecido na importação",
      results,
    });
    await flushNow(tenantIdForProgress, userId).catch(() => {});
  }
}
