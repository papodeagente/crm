/**
 * RD Station CRM Import Router
 * Handles importing data from RD Station CRM into Entur OS
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as rdCrm from "../rdStationCrmImport";
import * as crm from "../crmDb";
import { getDb } from "../db";
import { contacts, deals, pipelines, pipelineStages, productCatalog, leadSources, campaigns, lossReasons, tasks as crmTasks } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

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

  // ─── Import All Data ───
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

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

      // ─── 1. Import Pipelines & Stages ───
      if (input.importPipelines) {
        const entry = { imported: 0, skipped: 0, errors: [] as string[] };
        try {
          const rdPipelines = await rdCrm.fetchAllPipelines(token);
          for (const rdPipeline of rdPipelines) {
            try {
              const result = await crm.createPipeline({ tenantId, name: rdPipeline.name });
              if (result) {
                rdIdMap.pipelines[rdPipeline._id] = result.id;
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
                      entry.errors.push(`Stage ${stage.name}: ${e.message}`);
                    }
                  }
                }
              }
            } catch (e: any) {
              entry.errors.push(`Pipeline ${rdPipeline.name}: ${e.message}`);
            }
          }
        } catch (e: any) {
          entry.errors.push(`Fetch pipelines: ${e.message}`);
        }
        results.pipelines = entry;
      }

      // ─── 2. Import Sources ───
      if (input.importSources) {
        const entry = { imported: 0, skipped: 0, errors: [] as string[] };
        try {
          const rdSources = await rdCrm.fetchAllSources(token);
          for (const src of rdSources) {
            try {
              const result = await crm.createLeadSource({ tenantId, name: src.name });
              if (result) {
                rdIdMap.sources[src._id] = result.id;
                entry.imported++;
              }
            } catch (e: any) {
              entry.errors.push(`Source ${src.name}: ${e.message}`);
            }
          }
        } catch (e: any) {
          entry.errors.push(`Fetch sources: ${e.message}`);
        }
        results.sources = entry;
      }

      // ─── 3. Import Campaigns ───
      if (input.importCampaigns) {
        const entry = { imported: 0, skipped: 0, errors: [] as string[] };
        try {
          const rdCampaigns = await rdCrm.fetchAllCampaigns(token);
          for (const camp of rdCampaigns) {
            try {
              const result = await crm.createCampaign({ tenantId, name: camp.name });
              if (result) {
                rdIdMap.campaigns[camp._id] = result.id;
                entry.imported++;
              }
            } catch (e: any) {
              entry.errors.push(`Campaign ${camp.name}: ${e.message}`);
            }
          }
        } catch (e: any) {
          entry.errors.push(`Fetch campaigns: ${e.message}`);
        }
        results.campaigns = entry;
      }

      // ─── 4. Import Loss Reasons ───
      if (input.importLossReasons) {
        const entry = { imported: 0, skipped: 0, errors: [] as string[] };
        try {
          const rdReasons = await rdCrm.fetchAllLossReasons(token);
          for (const reason of rdReasons) {
            try {
              const result = await crm.createLossReason({ tenantId, name: reason.name });
              if (result) {
                rdIdMap.lossReasons[reason._id] = reason.name ? result.id : 0;
                entry.imported++;
              }
            } catch (e: any) {
              entry.errors.push(`Reason ${reason.name}: ${e.message}`);
            }
          }
        } catch (e: any) {
          entry.errors.push(`Fetch loss reasons: ${e.message}`);
        }
        results.lossReasons = entry;
      }

      // ─── 5. Import Products ───
      if (input.importProducts) {
        const entry = { imported: 0, skipped: 0, errors: [] as string[] };
        try {
          const rdProducts = await rdCrm.fetchAllProducts(token);
          for (const prod of rdProducts) {
            try {
              const result = await crm.createCatalogProduct({
                tenantId,
                name: prod.name,
                description: prod.description || undefined,
                basePriceCents: Math.round((prod.base_price || 0) * 100),
                productType: "other",
                isActive: prod.visible !== false,
              });
              if (result) {
                rdIdMap.products[prod._id] = result.id;
                entry.imported++;
              }
            } catch (e: any) {
              entry.errors.push(`Product ${prod.name}: ${e.message}`);
            }
          }
        } catch (e: any) {
          entry.errors.push(`Fetch products: ${e.message}`);
        }
        results.products = entry;
      }

      // ─── 6. Import Organizations as Contacts (type=company) ───
      if (input.importOrganizations) {
        const entry = { imported: 0, skipped: 0, errors: [] as string[] };
        try {
          const rdOrgs = await rdCrm.fetchAllOrganizations(token);
          for (const org of rdOrgs) {
            try {
              const result = await crm.createContact({
                tenantId,
                name: org.name,
                type: "company",
                source: "rd_station_crm",
                createdBy: ctx.user.id,
              });
              if (result) {
                rdIdMap.organizations[org._id] = result.id;
                entry.imported++;
              }
            } catch (e: any) {
              entry.errors.push(`Org ${org.name}: ${e.message}`);
            }
          }
        } catch (e: any) {
          entry.errors.push(`Fetch organizations: ${e.message}`);
        }
        results.organizations = entry;
      }

      // ─── 7. Import Contacts ───
      if (input.importContacts) {
        const entry = { imported: 0, skipped: 0, errors: [] as string[] };
        try {
          const rdContacts = await rdCrm.fetchAllContacts(token);
          for (const c of rdContacts) {
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
                createdBy: ctx.user.id,
              });
              if (result) {
                rdIdMap.contacts[c._id] = result.id;
                entry.imported++;
                // Add notes if present
                if (c.notes) {
                  await crm.createNote({
                    tenantId,
                    entityType: "contact",
                    entityId: result.id,
                    body: c.notes,
                    createdByUserId: ctx.user.id,
                  });
                }
              }
            } catch (e: any) {
              entry.errors.push(`Contact ${c.name}: ${e.message}`);
            }
          }
        } catch (e: any) {
          entry.errors.push(`Fetch contacts: ${e.message}`);
        }
        results.contacts = entry;
      }

      // ─── 8. Import Deals ───
      if (input.importDeals) {
        const entry = { imported: 0, skipped: 0, errors: [] as string[] };
        try {
          // Get first pipeline/stage as fallback
          const existingPipelines = await crm.listPipelines(tenantId);
          let fallbackPipelineId = existingPipelines[0]?.id;
          let fallbackStageId: number | undefined;
          if (fallbackPipelineId) {
            const stages = await crm.listStages(tenantId, fallbackPipelineId);
            fallbackStageId = stages[0]?.id;
          }
          if (!fallbackPipelineId || !fallbackStageId) {
            // Create a default pipeline
            const p = await crm.createPipeline({ tenantId, name: "Pipeline Importado", isDefault: true });
            if (p) {
              fallbackPipelineId = p.id;
              const s = await crm.createStage({ tenantId, pipelineId: p.id, name: "Novo", orderIndex: 0 });
              fallbackStageId = s?.id || 0;
            }
          }

          const rdDeals = await rdCrm.fetchAllDeals(token);
          for (const d of rdDeals) {
            try {
              // Resolve pipeline/stage
              const stageId = d.deal_stage?._id ? (rdIdMap.stages[d.deal_stage._id] || fallbackStageId!) : fallbackStageId!;
              // Find which pipeline this stage belongs to
              let pipelineId = fallbackPipelineId!;
              if (stageId && stageId !== fallbackStageId) {
                const stageRows = await db.select().from(pipelineStages).where(eq(pipelineStages.id, stageId)).limit(1);
                if (stageRows[0]) pipelineId = stageRows[0].pipelineId;
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
                createdBy: ctx.user.id,
                leadSource: "rd_station_crm",
              });

              if (result) {
                entry.imported++;
                // Update status if won/lost
                if (status !== "open") {
                  await db.update(deals)
                    .set({ status, updatedBy: ctx.user.id })
                    .where(and(eq(deals.id, result.id), eq(deals.tenantId, tenantId)));
                }

                // Import deal products
                if (d.deal_products?.length) {
                  for (const dp of d.deal_products) {
                    try {
                      const productId = dp.product_id ? (rdIdMap.products[dp.product_id] || 0) : 0;
                      // If no mapped product, create a generic one
                      let finalProductId = productId;
                      if (!finalProductId) {
                        const newProd = await crm.createCatalogProduct({
                          tenantId,
                          name: dp.name || "Produto importado",
                          basePriceCents: Math.round((dp.price || 0) * 100),
                          productType: "other",
                        });
                        finalProductId = newProd?.id || 0;
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
                    } catch (e: any) {
                      // Non-critical, continue
                    }
                  }
                }

                // Add deal history entry
                await crm.createDealHistory({
                  tenantId,
                  dealId: result.id,
                  action: "import",
                  description: `Importado do RD Station CRM (ID: ${d._id})`,
                  actorUserId: ctx.user.id,
                  actorName: ctx.user.name || "Sistema",
                });
              }
            } catch (e: any) {
              entry.errors.push(`Deal ${d.name}: ${e.message}`);
            }
          }
        } catch (e: any) {
          entry.errors.push(`Fetch deals: ${e.message}`);
        }
        results.deals = entry;
      }

      // ─── 9. Import Tasks ───
      if (input.importTasks) {
        const entry = { imported: 0, skipped: 0, errors: [] as string[] };
        try {
          const rdTasks = await rdCrm.fetchAllTasks(token);
          for (const t of rdTasks) {
            try {
              // Resolve deal entity if available
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
                entityId: entityId || 1, // fallback
                title: t.subject || "Tarefa importada",
                dueAt: dueAt && !isNaN(dueAt.getTime()) ? dueAt : undefined,
                createdByUserId: ctx.user.id,
              });
              if (result) {
                entry.imported++;
                // Mark as done if completed
                if (t.done) {
                  await db.update(crmTasks)
                    .set({ status: "done" })
                    .where(and(eq(crmTasks.id, result.id), eq(crmTasks.tenantId, tenantId)));
                }
              }
            } catch (e: any) {
              entry.errors.push(`Task ${t.subject}: ${e.message}`);
            }
          }
        } catch (e: any) {
          entry.errors.push(`Fetch tasks: ${e.message}`);
        }
        results.tasks = entry;
      }

      return {
        success: true,
        results,
        totalImported: Object.values(results).reduce((sum, r) => sum + r.imported, 0),
        totalErrors: Object.values(results).reduce((sum, r) => sum + r.errors.length, 0),
      };
    }),
});
