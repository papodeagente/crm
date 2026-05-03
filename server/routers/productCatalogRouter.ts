import { z } from "zod";
import { tenantProcedure, tenantWriteProcedure, getTenantId, router } from "../_core/trpc";
import * as crm from "../crmDb";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

const productTypeEnum = z.enum(["servico", "pacote", "consulta", "procedimento", "assinatura", "produto", "other"]);

export const productCatalogRouter = router({
  // ─── CATEGORIES ───
  categories: router({
    list: tenantProcedure
      
      .query(async ({ input, ctx }) => {
        return crm.listProductCategories(getTenantId(ctx));
      }),
    get: tenantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return crm.getProductCategoryById(getTenantId(ctx), input.id);
      }),
    create: tenantWriteProcedure
      .input(z.object({
        name: z.string().min(1).max(128),
        icon: z.string().max(64).optional(),
        color: z.string().max(32).optional(),
        parentId: z.number().nullable().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { parentId, ...rest } = input;
        return crm.createProductCategory({ ...rest, tenantId: getTenantId(ctx), parentId: parentId ?? undefined });
      }),
    update: tenantWriteProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(128).optional(),
        icon: z.string().max(64).optional(),
        color: z.string().max(32).optional(),
        parentId: z.number().nullable().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
        await crm.updateProductCategory(tenantId, id, data);
        return { success: true };
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await crm.deleteProductCategory(getTenantId(ctx), input.id);
        return { success: true };
      }),
  }),

  // ─── PRODUCTS ───
  products: router({
    list: tenantProcedure
      .input(z.object({
        search: z.string().optional(),
        productType: z.string().optional(),
        categoryId: z.number().optional(),
        isActive: z.boolean().optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      }))
      .query(async ({ input, ctx }) => {
        return crm.listCatalogProducts(getTenantId(ctx), input);
      }),
    get: tenantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return crm.getCatalogProductById(getTenantId(ctx), input.id);
      }),
    create: tenantWriteProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        categoryId: z.number().nullable().optional(),
        productType: productTypeEnum.default("other"),
        basePriceCents: z.number().default(0),
        costPriceCents: z.number().nullable().optional(),
        currency: z.string().max(3).optional(),
        professional: z.string().max(255).optional(),
        location: z.string().max(255).optional(),
        durationMinutes: z.number().optional(),
        imageUrl: z.string().nullable().optional(),
        sku: z.string().max(64).optional(),
        isActive: z.boolean().optional(),
        detailsJson: z.any().optional(),
        // Campos de tratamento estético
        specialty: z.string().max(128).nullable().optional(),
        contraindications: z.string().nullable().optional(),
        returnReminderDays: z.number().int().min(0).max(3650).nullable().optional(),
        complexity: z.enum(["low", "medium", "high"]).nullable().optional(),
        // Precificação por unidade (mL/g/etc)
        pricingMode: z.enum(["fixed", "per_unit"]).optional(),
        unitOfMeasure: z.string().max(32).nullable().optional(),
        pricePerUnitCents: z.number().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { categoryId, costPriceCents, ...rest } = input;
        return crm.createCatalogProduct({
          ...rest,
          tenantId: getTenantId(ctx),
          categoryId: categoryId ?? undefined,
          costPriceCents: costPriceCents ?? undefined,
        });
      }),
    update: tenantWriteProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        categoryId: z.number().nullable().optional(),
        productType: productTypeEnum.optional(),
        basePriceCents: z.number().optional(),
        costPriceCents: z.number().optional(),
        currency: z.string().max(3).optional(),
        professional: z.string().max(255).optional(),
        location: z.string().max(255).optional(),
        durationMinutes: z.number().optional(),
        imageUrl: z.string().nullable().optional(),
        sku: z.string().max(64).optional(),
        isActive: z.boolean().optional(),
        detailsJson: z.any().optional(),
        specialty: z.string().max(128).nullable().optional(),
        contraindications: z.string().nullable().optional(),
        // Precificação por unidade
        pricingMode: z.enum(["fixed", "per_unit"]).optional(),
        unitOfMeasure: z.string().max(32).nullable().optional(),
        pricePerUnitCents: z.number().nullable().optional(),
        returnReminderDays: z.number().int().min(0).max(3650).nullable().optional(),
        complexity: z.enum(["low", "medium", "high"]).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
        await crm.updateCatalogProduct(tenantId, id, data);
        return { success: true };
      }),
    delete: tenantWriteProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await crm.deleteCatalogProduct(getTenantId(ctx), input.id);
        return { success: true };
      }),
    count: tenantProcedure
      .input(z.object({ isActive: z.boolean().optional() }))
      .query(async ({ input, ctx }) => {
        return crm.countCatalogProducts(getTenantId(ctx), input.isActive);
      }),
    /**
     * Upload de imagem do produto. Recebe base64 do arquivo (≤2MB), salva via
     * storagePut e devolve a URL pública. Front-end depois chama products.update
     * com imageUrl=URL retornada.
     */
    uploadImage: tenantWriteProcedure
      .input(z.object({
        fileName: z.string().max(255),
        fileBase64: z.string(),
        contentType: z.string().regex(/^image\//, "Apenas imagens"),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = getTenantId(ctx);
        const buffer = Buffer.from(input.fileBase64, "base64");
        if (buffer.length > 2 * 1024 * 1024) {
          throw new Error("Imagem muito grande — máximo 2 MB");
        }
        const ext = (input.fileName.match(/\.([^.]+)$/)?.[1] || "jpg").toLowerCase().slice(0, 5);
        const fileKey = `product-images/${tenantId}/${nanoid()}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.contentType);
        return { url };
      }),
  }),

  // ─── ANALYTICS ───
  analytics: router({
    summary: tenantProcedure
      
      .query(async ({ input, ctx }) => {
        return crm.getProductAnalyticsSummary(getTenantId(ctx));
      }),
    mostSold: tenantProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ input, ctx }) => {
        return crm.getProductAnalyticsMostSold(getTenantId(ctx), input.limit);
      }),
    mostLost: tenantProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ input, ctx }) => {
        return crm.getProductAnalyticsMostLost(getTenantId(ctx), input.limit);
      }),
    mostRequested: tenantProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ input, ctx }) => {
        return crm.getProductAnalyticsMostRequested(getTenantId(ctx), input.limit);
      }),
    revenueByType: tenantProcedure
      
      .query(async ({ input, ctx }) => {
        return crm.getProductAnalyticsRevenueByType(getTenantId(ctx));
      }),
    conversionRate: tenantProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ input, ctx }) => {
        return crm.getProductAnalyticsConversionRate(getTenantId(ctx), input.limit);
      }),
    topLocations: tenantProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ input, ctx }) => {
        return crm.getProductAnalyticsTopLocations(getTenantId(ctx), input.limit);
      }),
  }),
});
