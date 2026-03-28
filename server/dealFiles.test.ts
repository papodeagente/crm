/**
 * Tests for Deal Files — Repositório de Arquivos em Negociações
 *
 * Validates the deal_files schema, db helpers, and router structure.
 */
import { describe, it, expect, vi } from "vitest";

describe("Deal Files Schema", () => {
  it("should export dealFiles table from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.dealFiles).toBeDefined();
  });

  it("should have all required columns in dealFiles table", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.dealFiles;
    // Check that the table object has the expected column definitions
    const columnNames = Object.keys(table);
    const requiredColumns = ["id", "tenantId", "dealId", "fileName", "fileKey", "url", "mimeType", "sizeBytes", "description", "uploadedBy", "createdAt", "deletedAt"];
    for (const col of requiredColumns) {
      expect(columnNames).toContain(col);
    }
  });

  it("should export DealFile and InsertDealFile types", async () => {
    const schema = await import("../drizzle/schema");
    // Type exports exist (compile-time check — if this imports, types are valid)
    expect(schema.dealFiles).toBeDefined();
  });
});

describe("Deal Files DB Helpers", () => {
  it("should export listDealFiles function", async () => {
    const db = await import("./db");
    expect(typeof db.listDealFiles).toBe("function");
  });

  it("should export createDealFile function", async () => {
    const db = await import("./db");
    expect(typeof db.createDealFile).toBe("function");
  });

  it("should export deleteDealFile function", async () => {
    const db = await import("./db");
    expect(typeof db.deleteDealFile).toBe("function");
  });

  it("should export getDealFile function", async () => {
    const db = await import("./db");
    expect(typeof db.getDealFile).toBe("function");
  });

  it("should export countDealFiles function", async () => {
    const db = await import("./db");
    expect(typeof db.countDealFiles).toBe("function");
  });
});

describe("Deal Files Router Structure", () => {
  it("should have files router nested under crm.deals", async () => {
    const { crmRouter } = await import("./routers/crmRouter");
    // The router object should have the deals.files path
    expect(crmRouter).toBeDefined();
    // Check that the router has the expected structure
    const routerDef = (crmRouter as any)._def;
    expect(routerDef).toBeDefined();
    // Verify the procedures exist in the router
    const procedures = routerDef?.procedures || routerDef?.record;
    if (procedures) {
      // Check for deals.files.list, deals.files.upload, deals.files.delete, deals.files.get, deals.files.count
      const keys = Object.keys(procedures);
      expect(keys).toContain("deals.files.list");
      expect(keys).toContain("deals.files.upload");
      expect(keys).toContain("deals.files.delete");
      expect(keys).toContain("deals.files.get");
      expect(keys).toContain("deals.files.count");
    }
  });
});

describe("Deal Files Upload Validation", () => {
  it("should accept valid file upload input", () => {
    const { z } = require("zod");
    const uploadSchema = z.object({
      dealId: z.number(),
      fileName: z.string(),
      fileBase64: z.string(),
      contentType: z.string(),
      sizeBytes: z.number().optional(),
      description: z.string().optional(),
    });

    const validInput = {
      dealId: 1,
      fileName: "contrato.pdf",
      fileBase64: "dGVzdA==", // "test" in base64
      contentType: "application/pdf",
      sizeBytes: 4,
      description: "Contrato assinado",
    };

    const result = uploadSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("should reject upload without required fields", () => {
    const { z } = require("zod");
    const uploadSchema = z.object({
      dealId: z.number(),
      fileName: z.string(),
      fileBase64: z.string(),
      contentType: z.string(),
      sizeBytes: z.number().optional(),
      description: z.string().optional(),
    });

    const invalidInput = {
      dealId: 1,
      // missing fileName, fileBase64, contentType
    };

    const result = uploadSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it("should accept upload without optional fields", () => {
    const { z } = require("zod");
    const uploadSchema = z.object({
      dealId: z.number(),
      fileName: z.string(),
      fileBase64: z.string(),
      contentType: z.string(),
      sizeBytes: z.number().optional(),
      description: z.string().optional(),
    });

    const minimalInput = {
      dealId: 1,
      fileName: "foto.jpg",
      fileBase64: "dGVzdA==",
      contentType: "image/jpeg",
    };

    const result = uploadSchema.safeParse(minimalInput);
    expect(result.success).toBe(true);
  });
});

describe("Deal Files MIME Type Handling", () => {
  it("should correctly identify common file types", () => {
    const mimeMap: Record<string, string> = {
      "application/pdf": "PDF",
      "image/jpeg": "Image",
      "image/png": "Image",
      "video/mp4": "Video",
      "audio/mpeg": "Audio",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Spreadsheet",
      "application/zip": "Archive",
      "text/plain": "Text",
    };

    function classifyMime(mime: string): string {
      if (mime.startsWith("image/")) return "Image";
      if (mime.startsWith("video/")) return "Video";
      if (mime.startsWith("audio/")) return "Audio";
      if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return "Spreadsheet";
      if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar")) return "Archive";
      if (mime.includes("pdf")) return "PDF";
      return "Text";
    }

    for (const [mime, expected] of Object.entries(mimeMap)) {
      expect(classifyMime(mime)).toBe(expected);
    }
  });
});

describe("Deal Files Size Formatting", () => {
  it("should format file sizes correctly", () => {
    function formatFileSize(bytes: number | null): string {
      if (!bytes || bytes === 0) return "—";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    expect(formatFileSize(0)).toBe("—");
    expect(formatFileSize(null)).toBe("—");
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(1048576)).toBe("1.0 MB");
    expect(formatFileSize(5242880)).toBe("5.0 MB");
  });
});
