import { z } from "zod";
import { tenantProcedure, getTenantId, router } from "../_core/trpc";
import * as crm from "../crmDb";

const productTypeEnum = z.enum(["flight", "hotel", "tour", "transfer", "insurance", "cruise", "visa", "package", "other"]);

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
    create: tenantProcedure
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
    update: tenantProcedure
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
    delete: tenantProcedure
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
    create: tenantProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        categoryId: z.number().nullable().optional(),
        productType: productTypeEnum.optional(),
        basePriceCents: z.number().default(0),
        costPriceCents: z.number().optional(),
        currency: z.string().max(3).optional(),
        supplier: z.string().max(255).optional(),
        destination: z.string().max(255).optional(),
        duration: z.string().max(128).optional(),
        imageUrl: z.string().optional(),
        sku: z.string().max(64).optional(),
        isActive: z.boolean().optional(),
        detailsJson: z.any().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { categoryId, ...rest } = input;
        return crm.createCatalogProduct({ ...rest, tenantId: getTenantId(ctx), categoryId: categoryId ?? undefined });
      }),
    update: tenantProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        categoryId: z.number().nullable().optional(),
        productType: productTypeEnum.optional(),
        basePriceCents: z.number().optional(),
        costPriceCents: z.number().optional(),
        currency: z.string().max(3).optional(),
        supplier: z.string().max(255).optional(),
        destination: z.string().max(255).optional(),
        duration: z.string().max(128).optional(),
        imageUrl: z.string().optional(),
        sku: z.string().max(64).optional(),
        isActive: z.boolean().optional(),
        detailsJson: z.any().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
const tenantId = getTenantId(ctx); const { id, ...data } = input;
        await crm.updateCatalogProduct(tenantId, id, data);
        return { success: true };
      }),
    delete: tenantProcedure
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
    topDestinations: tenantProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ input, ctx }) => {
        return crm.getProductAnalyticsTopDestinations(getTenantId(ctx), input.limit);
      }),
  }),
});
