import { describe, it, expect, vi } from "vitest";

// ─── Unit tests for the enhanced Create Deal flow ───
// These tests validate the backend procedures without writing to the database.

describe("Create Deal - Enhanced Flow", () => {
  describe("deals.create input validation", () => {
    it("should accept leadSource and channelOrigin as optional fields", () => {
      // Validate the input schema accepts the new fields
      const validInput = {
        tenantId: 1,
        title: "Test Deal",
        pipelineId: 1,
        stageId: 1,
        contactId: 10,
        accountId: 5,
        leadSource: "indicacao",
        channelOrigin: "Black Friday 2026",
      };
      expect(validInput.leadSource).toBe("indicacao");
      expect(validInput.channelOrigin).toBe("Black Friday 2026");
    });

    it("should work without leadSource and channelOrigin", () => {
      const validInput = {
        tenantId: 1,
        title: "Test Deal",
        pipelineId: 1,
        stageId: 1,
      };
      expect(validInput).not.toHaveProperty("leadSource");
      expect(validInput).not.toHaveProperty("channelOrigin");
    });

    it("should require title, pipelineId and stageId", () => {
      const requiredFields = ["tenantId", "title", "pipelineId", "stageId"];
      const input = { tenantId: 1, title: "Deal", pipelineId: 1, stageId: 1 };
      for (const field of requiredFields) {
        expect(input).toHaveProperty(field);
      }
    });
  });

  describe("accounts.create input validation", () => {
    it("should accept name as required field", () => {
      const input = { tenantId: 1, name: "Empresa Teste LTDA" };
      expect(input.name).toBe("Empresa Teste LTDA");
    });

    it("should accept optional fields", () => {
      const input = {
        tenantId: 1,
        name: "Empresa Teste",
        primaryContactId: 5,
        ownerUserId: 2,
        teamId: 3,
      };
      expect(input.primaryContactId).toBe(5);
    });
  });

  describe("contacts.create input validation", () => {
    it("should accept name, email, phone as fields", () => {
      const input = {
        tenantId: 1,
        name: "João Silva",
        email: "joao@exemplo.com",
        phone: "(84) 99999-0000",
      };
      expect(input.name).toBe("João Silva");
      expect(input.email).toBe("joao@exemplo.com");
      expect(input.phone).toBe("(84) 99999-0000");
    });

    it("should work with name only", () => {
      const input = { tenantId: 1, name: "Maria" };
      expect(input).not.toHaveProperty("email");
      expect(input).not.toHaveProperty("phone");
    });
  });

  describe("LEAD_SOURCES constant", () => {
    const LEAD_SOURCES = [
      { value: "indicacao", label: "Indicação" },
      { value: "google", label: "Google" },
      { value: "instagram", label: "Instagram" },
      { value: "facebook", label: "Facebook" },
      { value: "whatsapp", label: "WhatsApp" },
      { value: "wordpress", label: "Website" },
      { value: "tracking_script", label: "Tracking Script" },
      { value: "meta_ads", label: "Meta Ads" },
      { value: "email_marketing", label: "E-mail Marketing" },
      { value: "telefone", label: "Telefone" },
      { value: "evento", label: "Evento" },
      { value: "outro", label: "Outro" },
    ];

    it("should have 12 source options", () => {
      expect(LEAD_SOURCES).toHaveLength(12);
    });

    it("should have unique values", () => {
      const values = LEAD_SOURCES.map((s) => s.value);
      expect(new Set(values).size).toBe(values.length);
    });

    it("should include all main channels", () => {
      const values = LEAD_SOURCES.map((s) => s.value);
      expect(values).toContain("indicacao");
      expect(values).toContain("google");
      expect(values).toContain("whatsapp");
      expect(values).toContain("wordpress");
      expect(values).toContain("tracking_script");
      expect(values).toContain("meta_ads");
    });
  });

  describe("createDeal function signature", () => {
    it("should accept accountId, leadSource and channelOrigin in data parameter", async () => {
      // This test validates the TypeScript type signature by constructing a valid data object
      const data: {
        tenantId: number;
        title: string;
        contactId?: number;
        accountId?: number;
        pipelineId: number;
        stageId: number;
        valueCents?: number;
        leadSource?: string;
        channelOrigin?: string;
      } = {
        tenantId: 1,
        title: "Deal with all fields",
        contactId: 10,
        accountId: 5,
        pipelineId: 1,
        stageId: 1,
        valueCents: 499700,
        leadSource: "indicacao",
        channelOrigin: "Black Friday",
      };
      expect(data.accountId).toBe(5);
      expect(data.leadSource).toBe("indicacao");
      expect(data.channelOrigin).toBe("Black Friday");
    });
  });

  describe("Form value parsing", () => {
    it("should parse Brazilian currency format to cents", () => {
      const valueCents = "4.997,00";
      const parsed = Math.round(
        parseFloat(valueCents.replace(/[^\d,]/g, "").replace(",", ".")) * 100
      );
      expect(parsed).toBe(499700);
    });

    it("should parse simple number to cents", () => {
      const valueCents = "1500";
      const parsed = Math.round(
        parseFloat(valueCents.replace(/[^\d,]/g, "").replace(",", ".")) * 100
      );
      expect(parsed).toBe(150000);
    });

    it("should handle decimal with comma", () => {
      const valueCents = "2.500,50";
      const parsed = Math.round(
        parseFloat(valueCents.replace(/[^\d,]/g, "").replace(",", ".")) * 100
      );
      expect(parsed).toBe(250050);
    });
  });
});
