import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as crm from "../crmDb";

const productTypeEnum = z.enum(["flight", "hotel", "tour", "transfer", "insurance", "cruise", "visa", "package", "other"]);

export const productCatalogRouter = router({
  // ─── CATEGORIES ───
  categories: router({
    list: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return crm.listProductCategories(input.tenantId);
      }),
    get: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .query(async ({ input }) => {
        return crm.getProductCategoryById(input.tenantId, input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        name: z.string().min(1).max(128),
        icon: z.string().max(64).optional(),
        color: z.string().max(32).optional(),
        parentId: z.number().nullable().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { parentId, ...rest } = input;
        return crm.createProductCategory({ ...rest, parentId: parentId ?? undefined });
      }),
    update: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        id: z.number(),
        name: z.string().min(1).max(128).optional(),
        icon: z.string().max(64).optional(),
        color: z.string().max(32).optional(),
        parentId: z.number().nullable().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { tenantId, id, ...data } = input;
        await crm.updateProductCategory(tenantId, id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .mutation(async ({ input }) => {
        await crm.deleteProductCategory(input.tenantId, input.id);
        return { success: true };
      }),
  }),

  // ─── PRODUCTS ───
  products: router({
    list: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
        search: z.string().optional(),
        productType: z.string().optional(),
        categoryId: z.number().optional(),
        isActive: z.boolean().optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        return crm.listCatalogProducts(input.tenantId, input);
      }),
    get: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .query(async ({ input }) => {
        return crm.getCatalogProductById(input.tenantId, input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
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
      .mutation(async ({ input }) => {
        const { categoryId, ...rest } = input;
        return crm.createCatalogProduct({ ...rest, categoryId: categoryId ?? undefined });
      }),
    update: protectedProcedure
      .input(z.object({
        tenantId: z.number(),
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
      .mutation(async ({ input }) => {
        const { tenantId, id, ...data } = input;
        await crm.updateCatalogProduct(tenantId, id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ tenantId: z.number(), id: z.number() }))
      .mutation(async ({ input }) => {
        await crm.deleteCatalogProduct(input.tenantId, input.id);
        return { success: true };
      }),
    count: protectedProcedure
      .input(z.object({ tenantId: z.number(), isActive: z.boolean().optional() }))
      .query(async ({ input }) => {
        return crm.countCatalogProducts(input.tenantId, input.isActive);
      }),
  }),

  // ─── ANALYTICS ───
  analytics: router({
    summary: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return crm.getProductAnalyticsSummary(input.tenantId);
      }),
    mostSold: protectedProcedure
      .input(z.object({ tenantId: z.number(), limit: z.number().default(10) }))
      .query(async ({ input }) => {
        return crm.getProductAnalyticsMostSold(input.tenantId, input.limit);
      }),
    mostLost: protectedProcedure
      .input(z.object({ tenantId: z.number(), limit: z.number().default(10) }))
      .query(async ({ input }) => {
        return crm.getProductAnalyticsMostLost(input.tenantId, input.limit);
      }),
    mostRequested: protectedProcedure
      .input(z.object({ tenantId: z.number(), limit: z.number().default(10) }))
      .query(async ({ input }) => {
        return crm.getProductAnalyticsMostRequested(input.tenantId, input.limit);
      }),
    revenueByType: protectedProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        return crm.getProductAnalyticsRevenueByType(input.tenantId);
      }),
    conversionRate: protectedProcedure
      .input(z.object({ tenantId: z.number(), limit: z.number().default(10) }))
      .query(async ({ input }) => {
        return crm.getProductAnalyticsConversionRate(input.tenantId, input.limit);
      }),
    topDestinations: protectedProcedure
      .input(z.object({ tenantId: z.number(), limit: z.number().default(10) }))
      .query(async ({ input }) => {
        return crm.getProductAnalyticsTopDestinations(input.tenantId, input.limit);
      }),
  }),
});
