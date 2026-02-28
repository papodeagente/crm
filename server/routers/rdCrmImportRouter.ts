/**
 * RD Station CRM Import Router
 * Handles importing data from RD Station CRM into Entur OS
 * Uses in-memory progress tracking with polling for real-time updates
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as rdCrm from "../rdStationCrmImport";
import * as crm from "../crmDb";
import { getDb } from "../db";
import { deals, tasks as crmTasks } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

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
  results: Record<string, { imported: number; skipped: number; errors: string[] }>;
  error?: string;
  startedAt: number;
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

// ─── Build stage-to-pipeline map from RD Station pipelines ───
function buildStageToPipelineMap(rdPipelines: rdCrm.RdPipeline[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of rdPipelines) {
    for (const s of p.deal_stages || []) {
      map.set(s._id, p.id || p._id || "");
    }
  }
  return map;
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
    }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId, token } = input;
      const userId = ctx.user.id;
      const userName = ctx.user.name || "Sistema";

      // Initialize progress
      const progress = initProgress(userId);
      progress.status = "fetching";

      // Count total steps
      const enabledCategories: string[] = [];
      if (input.importPipelines) enabledCategories.push("pipelines");
      if (input.importSources) enabledCategories.push("sources");
      if (input.importCampaigns) enabledCategories.push("campaigns");
      if (input.importLossReasons) enabledCategories.push("lossReasons");
      if (input.importProducts) enabledCategories.push("products");
      if (input.importOrganizations) enabledCategories.push("organizations");
      if (input.importContacts) enabledCategories.push("contacts");
      if (input.importDeals) enabledCategories.push("deals");
      if (input.importTasks) enabledCategories.push("tasks");
      progress.totalSteps = enabledCategories.length;

      // Run import in background (don't await)
      runImport(userId, tenantId, token, userName, input, enabledCategories).catch((err) => {
        updateProgress(userId, {
          status: "error",
          error: err.message || "Erro desconhecido na importação",
        });
      });

      return { started: true, categories: enabledCategories.length };
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
    importSources: boolean;
    importCampaigns: boolean;
    importLossReasons: boolean;
    importProducts: boolean;
    importOrganizations: boolean;
    importContacts: boolean;
    importDeals: boolean;
    importTasks: boolean;
  },
  enabledCategories: string[],
) {
  const db = await getDb();
  if (!db) {
    updateProgress(userId, { status: "error", error: "Database unavailable" });
    return;
  }

  const results: Record<string, { imported: number; skipped: number; errors: string[] }> = {};
  const rdIdMap: Record<string, Record<string, number>> = {
    contacts: {},
    organizations: {},
    pipelines: {},
    stages: {},
    products: {},
    sources: {},
    campaigns: {},
    lossReasons: {},
  };

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

  try {
    // ─── 1. Import Pipelines & Stages ───
    if (input.importPipelines) {
      advanceStep("pipelines", "Funis e Etapas");
      const entry = { imported: 0, skipped: 0, errors: [] as string[] };
      try {
        const rdPipelines = await rdCrm.fetchAllPipelines(token);
        setCategoryProgress(0, rdPipelines.length);

        for (let i = 0; i < rdPipelines.length; i++) {
          const rdPipeline = rdPipelines[i];
          try {
            const result = await crm.createPipeline({ tenantId, name: rdPipeline.name });
            if (result) {
              rdIdMap.pipelines[rdPipeline.id || rdPipeline._id || ""] = result.id;
              entry.imported++;
              // Import stages for this pipeline
              if (rdPipeline.deal_stages) {
                for (const stage of rdPipeline.deal_stages) {
                  try {
                    const stageResult = await crm.createStage({
                      tenantId,
                      pipelineId: result.id,
                      name: stage.name,
                      orderIndex: stage.order || 0,
                    });
                    if (stageResult) {
                      rdIdMap.stages[stage._id] = stageResult.id;
                    }
                  } catch (e: any) {
                    entry.errors.push(`Etapa ${stage.name}: ${e.message}`);
                  }
                }
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

    // ─── 2. Import Sources ───
    if (input.importSources) {
      advanceStep("sources", "Fontes de Leads");
      const entry = { imported: 0, skipped: 0, errors: [] as string[] };
      try {
        updateProgress(userId, { phase: "Buscando fontes do RD Station..." });
        const rdSources = await rdCrm.fetchAllSources(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
          updateProgress(userId, { phase: `Buscando fontes... ${fetched}/${total}` });
        });
        updateProgress(userId, { phase: "Importando fontes..." });
        setCategoryProgress(0, rdSources.length);

        for (let i = 0; i < rdSources.length; i++) {
          const src = rdSources[i];
          try {
            const result = await crm.createLeadSource({ tenantId, name: src.name });
            if (result) {
              rdIdMap.sources[src._id] = result.id;
              entry.imported++;
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

    // ─── 3. Import Campaigns ───
    if (input.importCampaigns) {
      advanceStep("campaigns", "Campanhas");
      const entry = { imported: 0, skipped: 0, errors: [] as string[] };
      try {
        updateProgress(userId, { phase: "Buscando campanhas do RD Station..." });
        const rdCampaigns = await rdCrm.fetchAllCampaigns(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
          updateProgress(userId, { phase: `Buscando campanhas... ${fetched}/${total}` });
        });
        updateProgress(userId, { phase: "Importando campanhas..." });
        setCategoryProgress(0, rdCampaigns.length);

        for (let i = 0; i < rdCampaigns.length; i++) {
          const camp = rdCampaigns[i];
          try {
            const result = await crm.createCampaign({ tenantId, name: camp.name });
            if (result) {
              rdIdMap.campaigns[camp._id] = result.id;
              entry.imported++;
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

    // ─── 4. Import Loss Reasons ───
    if (input.importLossReasons) {
      advanceStep("lossReasons", "Motivos de Perda");
      const entry = { imported: 0, skipped: 0, errors: [] as string[] };
      try {
        updateProgress(userId, { phase: "Buscando motivos de perda do RD Station..." });
        const rdReasons = await rdCrm.fetchAllLossReasons(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
        });
        updateProgress(userId, { phase: "Importando motivos de perda..." });
        setCategoryProgress(0, rdReasons.length);

        for (let i = 0; i < rdReasons.length; i++) {
          const reason = rdReasons[i];
          try {
            const result = await crm.createLossReason({ tenantId, name: reason.name });
            if (result) {
              rdIdMap.lossReasons[reason._id] = result.id;
              entry.imported++;
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

    // ─── 5. Import Products ───
    if (input.importProducts) {
      advanceStep("products", "Produtos e Serviços");
      const entry = { imported: 0, skipped: 0, errors: [] as string[] };
      try {
        updateProgress(userId, { phase: "Buscando produtos do RD Station..." });
        const rdProducts = await rdCrm.fetchAllProducts(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
          updateProgress(userId, { phase: `Buscando produtos... ${fetched}/${total}` });
        });
        updateProgress(userId, { phase: "Importando produtos..." });
        setCategoryProgress(0, rdProducts.length);

        for (let i = 0; i < rdProducts.length; i++) {
          const prod = rdProducts[i];
          try {
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
              rdIdMap.products[prod._id] = result.id;
              entry.imported++;
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

    // ─── 6. Import Organizations ───
    if (input.importOrganizations) {
      advanceStep("organizations", "Empresas");
      const entry = { imported: 0, skipped: 0, errors: [] as string[] };
      try {
        updateProgress(userId, { phase: "Buscando empresas do RD Station..." });
        const rdOrgs = await rdCrm.fetchAllOrganizations(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
          updateProgress(userId, { phase: `Buscando empresas... ${fetched}/${total}` });
        });
        updateProgress(userId, { phase: "Importando empresas..." });
        setCategoryProgress(0, rdOrgs.length);

        for (let i = 0; i < rdOrgs.length; i++) {
          const org = rdOrgs[i];
          try {
            const result = await crm.createContact({
              tenantId,
              name: org.name,
              type: "company",
              source: "rd_station_crm",
              createdBy: userId,
            });
            if (result) {
              rdIdMap.organizations[org._id] = result.id;
              entry.imported++;
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

    // ─── 7. Import Contacts ───
    if (input.importContacts) {
      advanceStep("contacts", "Contatos");
      const entry = { imported: 0, skipped: 0, errors: [] as string[] };
      try {
        updateProgress(userId, { phase: "Buscando contatos do RD Station..." });
        const rdContacts = await rdCrm.fetchAllContacts(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
          updateProgress(userId, { phase: `Buscando contatos... ${fetched}/${total}` });
        });
        updateProgress(userId, { phase: "Importando contatos..." });
        setCategoryProgress(0, rdContacts.length);

        for (let i = 0; i < rdContacts.length; i++) {
          const c = rdContacts[i];
          try {
            const email = c.emails?.[0]?.email || undefined;
            const phone = c.phones?.[0]?.phone || undefined;
            const result = await crm.createContact({
              tenantId,
              name: c.name || email || phone || "Sem nome",
              type: "person",
              email,
              phone,
              source: "rd_station_crm",
              createdBy: userId,
            });
            if (result) {
              rdIdMap.contacts[c._id] = result.id;
              entry.imported++;
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
            entry.errors.push(`Contato ${c.name}: ${e.message}`);
          }
          if (i % 50 === 0) setCategoryProgress(i + 1, rdContacts.length);
        }
        setCategoryProgress(rdContacts.length, rdContacts.length);
      } catch (e: any) {
        entry.errors.push(`Buscar contatos: ${e.message}`);
      }
      results.contacts = entry;
    }

    // ─── 8. Import Deals (by pipeline for correct association) ───
    if (input.importDeals) {
      advanceStep("deals", "Negociações");
      const entry = { imported: 0, skipped: 0, errors: [] as string[] };
      try {
        // First, fetch pipelines to build stage→pipeline map
        const rdPipelines = await rdCrm.fetchAllPipelines(token);
        const stageToPipelineRd = buildStageToPipelineMap(rdPipelines);

        // Get fallback pipeline/stage
        const existingPipelines = await crm.listPipelines(tenantId);
        let fallbackPipelineId = existingPipelines[0]?.id;
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
        updateProgress(userId, { phase: "Buscando negociações do RD Station..." });
        const rdDeals = await rdCrm.fetchAllDeals(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
          updateProgress(userId, { phase: `Buscando negociações... ${fetched}/${total}` });
        });

        updateProgress(userId, { phase: "Importando negociações..." });
        setCategoryProgress(0, rdDeals.length);

        for (let i = 0; i < rdDeals.length; i++) {
          const d = rdDeals[i];
          try {
            // Resolve stage and pipeline
            let stageId = fallbackStageId!;
            let pipelineId = fallbackPipelineId!;

            if (d.deal_stage?._id) {
              // Find the mapped stage
              const mappedStageId = rdIdMap.stages[d.deal_stage._id];
              if (mappedStageId) {
                stageId = mappedStageId;
                // Find which pipeline this stage belongs to via RD data
                const rdPipelineId = stageToPipelineRd.get(d.deal_stage._id);
                if (rdPipelineId && rdIdMap.pipelines[rdPipelineId]) {
                  pipelineId = rdIdMap.pipelines[rdPipelineId];
                }
              }
            }

            // Resolve contact
            let contactId: number | undefined;
            if (d.contacts?.[0]) {
              const firstContact = d.contacts[0];
              if (firstContact._id && rdIdMap.contacts[firstContact._id]) {
                contactId = rdIdMap.contacts[firstContact._id];
              }
            }

            // Determine status
            let status: "open" | "won" | "lost" = "open";
            if (d.win === true) status = "won";
            else if (d.win === false) status = "lost";

            const valueCents = Math.round((d.amount_total || 0) * 100);

            const result = await crm.createDeal({
              tenantId,
              title: d.name || "Negociação importada",
              contactId,
              pipelineId,
              stageId,
              valueCents,
              createdBy: userId,
              leadSource: "rd_station_crm",
            });

            if (result) {
              entry.imported++;
              // Update status if won/lost
              if (status !== "open") {
                try {
                  await db.update(deals)
                    .set({ status, updatedBy: userId })
                    .where(and(eq(deals.id, result.id), eq(deals.tenantId, tenantId)));
                } catch {}
              }

              // Import deal products
              if (d.deal_products?.length) {
                for (const dp of d.deal_products) {
                  try {
                    let finalProductId = dp.product_id ? (rdIdMap.products[dp.product_id] || 0) : 0;
                    if (!finalProductId && dp.name) {
                      const newProd = await crm.createCatalogProduct({
                        tenantId,
                        name: dp.name,
                        basePriceCents: Math.round((dp.price || 0) * 100),
                        productType: "other",
                      });
                      if (newProd) {
                        finalProductId = newProd.id;
                        if (dp.product_id) rdIdMap.products[dp.product_id] = newProd.id;
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
                  description: `Importado do RD Station CRM (ID: ${d._id})`,
                  actorUserId: userId,
                  actorName: userName,
                });
              } catch {}
            }
          } catch (e: any) {
            entry.errors.push(`Negociação ${d.name}: ${e.message}`);
          }
          if (i % 20 === 0) setCategoryProgress(i + 1, rdDeals.length);
        }
        setCategoryProgress(rdDeals.length, rdDeals.length);
      } catch (e: any) {
        entry.errors.push(`Buscar negociações: ${e.message}`);
      }
      results.deals = entry;
    }

    // ─── 9. Import Tasks ───
    if (input.importTasks) {
      advanceStep("tasks", "Tarefas");
      const entry = { imported: 0, skipped: 0, errors: [] as string[] };
      try {
        updateProgress(userId, { phase: "Buscando tarefas do RD Station..." });
        const rdTasks = await rdCrm.fetchAllTasks(token, (fetched, total) => {
          setCategoryProgress(fetched, total);
          updateProgress(userId, { phase: `Buscando tarefas... ${fetched}/${total}` });
        });
        updateProgress(userId, { phase: "Importando tarefas..." });
        setCategoryProgress(0, rdTasks.length);

        for (let i = 0; i < rdTasks.length; i++) {
          const t = rdTasks[i];
          try {
            let entityType = "deal";
            let entityId = 0;
            if (t.contact_id && rdIdMap.contacts[t.contact_id]) {
              entityType = "contact";
              entityId = rdIdMap.contacts[t.contact_id];
            }

            const dueAt = t.date ? new Date(t.date) : undefined;
            const result = await crm.createTask({
              tenantId,
              entityType,
              entityId: entityId || 1,
              title: t.subject || "Tarefa importada",
              dueAt: dueAt && !isNaN(dueAt.getTime()) ? dueAt : undefined,
              createdByUserId: userId,
            });
            if (result) {
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
            entry.errors.push(`Tarefa ${t.subject}: ${e.message}`);
          }
          if (i % 50 === 0) setCategoryProgress(i + 1, rdTasks.length);
        }
        setCategoryProgress(rdTasks.length, rdTasks.length);
      } catch (e: any) {
        entry.errors.push(`Buscar tarefas: ${e.message}`);
      }
      results.tasks = entry;
    }

    // ─── Done ───
    updateProgress(userId, {
      status: "done",
      phase: "Importação concluída!",
      completedSteps: enabledCategories.length,
      results,
    });
  } catch (e: any) {
    updateProgress(userId, {
      status: "error",
      error: e.message || "Erro desconhecido na importação",
      results,
    });
  }
}
