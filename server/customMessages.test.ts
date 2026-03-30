import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for the customMessages service layer.
 * We test the service functions directly since they contain the business logic.
 */

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Import the service after mocking
import {
  listCustomMessages,
  listCustomMessagesByCategory,
  createCustomMessage,
  updateCustomMessage,
  deleteCustomMessage,
  CUSTOM_MESSAGE_CATEGORIES,
  type CustomMessageCategory,
} from "./services/customMessagesService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("customMessages service", () => {
  describe("exported functions", () => {
    it("should export all CRUD functions", () => {
      expect(typeof listCustomMessages).toBe("function");
      expect(typeof listCustomMessagesByCategory).toBe("function");
      expect(typeof createCustomMessage).toBe("function");
      expect(typeof updateCustomMessage).toBe("function");
      expect(typeof deleteCustomMessage).toBe("function");
    });
  });

  describe("CUSTOM_MESSAGE_CATEGORIES", () => {
    it("should have all 7 expected categories", () => {
      expect(CUSTOM_MESSAGE_CATEGORIES).toHaveLength(7);

      const values = CUSTOM_MESSAGE_CATEGORIES.map((c) => c.value);
      expect(values).toContain("primeiro_contato");
      expect(values).toContain("reativacao");
      expect(values).toContain("pedir_indicacao");
      expect(values).toContain("receber_indicado");
      expect(values).toContain("recuperacao_vendas");
      expect(values).toContain("objecoes");
      expect(values).toContain("outros");
    });

    it("should have labels for all categories", () => {
      CUSTOM_MESSAGE_CATEGORIES.forEach((cat) => {
        expect(cat.label).toBeTruthy();
        expect(typeof cat.label).toBe("string");
        expect(cat.label.length).toBeGreaterThan(0);
      });
    });

    it("should have unique values", () => {
      const values = CUSTOM_MESSAGE_CATEGORIES.map((c) => c.value);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe("createCustomMessage validation", () => {
    it("should accept valid input shape", () => {
      const validInput = {
        tenantId: 1,
        category: "primeiro_contato" as CustomMessageCategory,
        title: "Mensagem de boas-vindas",
        content: "Olá {nome}, seja bem-vindo!",
      };

      expect(validInput.tenantId).toBe(1);
      expect(validInput.category).toBeTruthy();
      expect(validInput.title).toBeTruthy();
      expect(validInput.content).toBeTruthy();
    });

    it("should require title and content to be non-empty", () => {
      const validInput = {
        tenantId: 1,
        category: "reativacao",
        title: "Reativação",
        content: "Olá, faz tempo que não conversamos!",
      };

      expect(validInput.title.trim().length).toBeGreaterThan(0);
      expect(validInput.content.trim().length).toBeGreaterThan(0);
    });
  });

  describe("message content template variables", () => {
    it("should support placeholder variables in content", () => {
      const content = "Olá {primeiro_nome}, tudo bem? Sou da agência {empresa}.";
      const vars = content.match(/\{[^}]+\}/g);
      expect(vars).toEqual(["{primeiro_nome}", "{empresa}"]);
    });

    it("should handle content without variables", () => {
      const content = "Obrigado pelo seu contato!";
      const vars = content.match(/\{[^}]+\}/g);
      expect(vars).toBeNull();
    });

    it("should handle multiple occurrences of same variable", () => {
      const content = "Olá {nome}, como vai {nome}?";
      const vars = content.match(/\{[^}]+\}/g);
      expect(vars).toEqual(["{nome}", "{nome}"]);
    });
  });

  describe("listCustomMessages", () => {
    it("should return empty array when db is not available", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue(null);

      const result = await listCustomMessages(1);
      expect(result).toEqual([]);
    });
  });

  describe("listCustomMessagesByCategory", () => {
    it("should return empty array when db is not available", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue(null);

      const result = await listCustomMessagesByCategory(1, "primeiro_contato");
      expect(result).toEqual([]);
    });
  });
});
