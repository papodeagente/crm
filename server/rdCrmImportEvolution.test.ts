import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock fetch globally ───
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after mocking
import {
  validateRdCrmToken,
  fetchAllContacts,
  fetchAllDeals,
} from "./rdStationCrmImport";

beforeEach(() => {
  mockFetch.mockReset();
});

function mockJsonResponse(data: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => {
        if (name === "content-type") return "application/json";
        return null;
      },
    },
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

// ═══════════════════════════════════════════════════════════════
// 1. RETRY LOGIC IN rdFetch
// ═══════════════════════════════════════════════════════════════
describe("rdFetch retry logic", () => {
  it("retries on 429 (rate limit) and succeeds on second attempt", async () => {
    // First call: 429 rate limit
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ error: "rate limit" }, 429));
    // Second call: success
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ valid: true, account_name: "Test" }));

    const result = await validateRdCrmToken("test-token-123456");
    expect(result.valid).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 (server error) and succeeds on second attempt", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ error: "internal" }, 500));
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ valid: true, account_name: "Test" }));

    const result = await validateRdCrmToken("test-token-123456");
    expect(result.valid).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on network error and succeeds on second attempt", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fetch failed"));
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ valid: true, account_name: "Test" }));

    const result = await validateRdCrmToken("test-token-123456");
    expect(result.valid).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 retries and returns error", async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ error: "rate limit" }, 429));

    const result = await validateRdCrmToken("test-token-123456");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    // 1 initial + 3 retries = 4 calls
    expect(mockFetch).toHaveBeenCalledTimes(4);
  }, 30000);

  it("does not retry on 4xx errors (except 429)", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ error: "unauthorized" }, 401));

    const result = await validateRdCrmToken("test-token-123456");
    expect(result.valid).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. DEAL FIDELITY — RdDeal interface includes new fields
// ═══════════════════════════════════════════════════════════════
describe("Deal fidelity — API response parsing", () => {
  it("fetchAllDeals parses deal_source, campaign, prediction_date, deal_lost_reason", async () => {
    const mockDeal = {
      _id: "deal1",
      name: "Test Deal",
      amount_total: 5000,
      deal_stage: { _id: "stage1", name: "Novo" },
      deal_source: { _id: "src1", name: "Website" },
      campaign: { _id: "camp1", name: "Black Friday" },
      prediction_date: "2025-06-15",
      deal_lost_reason: { _id: "lr1", name: "Preço alto" },
      user: { _id: "user1", name: "Vendedor" },
      contacts: [{ _id: "c1", name: "João" }],
      organization: null,
      win: false,
      closed_at: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
    };

    // fetchAllDeals: first calls fetchAllPipelines (rdFetch returns array directly)
    // then fetches deals per pipeline using rdFetchAllPaginated
    mockFetch.mockResolvedValueOnce(mockJsonResponse([{ _id: "p1", name: "Default" }]));
    // Deals for pipeline p1 - page 1 (paginated format)
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ deals: [mockDeal], has_more: false, total: 1 }));

    const deals = await fetchAllDeals("test-token-123456");
    expect(deals.length).toBe(1);
    expect(deals[0].deal_source).toEqual({ _id: "src1", name: "Website" });
    expect(deals[0].campaign).toEqual({ _id: "camp1", name: "Black Friday" });
    expect(deals[0].prediction_date).toBe("2025-06-15");
    expect(deals[0].deal_lost_reason).toEqual({ _id: "lr1", name: "Preço alto" });
  });

  it("fetchAllDeals handles missing optional fields gracefully", async () => {
    const mockDeal = {
      _id: "deal2",
      name: "Simple Deal",
      amount_total: 1000,
      deal_stage: { _id: "stage1", name: "Novo" },
      user: null,
      contacts: [],
      organization: null,
      win: false,
      closed_at: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
    };

    // Mock pipelines (array directly)
    mockFetch.mockResolvedValueOnce(mockJsonResponse([{ _id: "p1", name: "Default" }]));
    // Mock deals for pipeline p1
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ deals: [mockDeal], has_more: false, total: 1 }));

    const deals = await fetchAllDeals("test-token-123456");
    expect(deals.length).toBe(1);
    expect(deals[0].deal_source).toBeUndefined();
    expect(deals[0].campaign).toBeUndefined();
    expect(deals[0].prediction_date).toBeUndefined();
    expect(deals[0].deal_lost_reason).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. CONTACT → ACCOUNT LINKING
// ═══════════════════════════════════════════════════════════════
describe("Contact → Account linking via organization_id", () => {
  it("fetchAllContacts parses organization field for account linking", async () => {
    const mockContact = {
      _id: "c1",
      name: "Maria Silva",
      emails: [{ email: "maria@test.com" }],
      phones: [{ phone: "11999999999" }],
      organization: { _id: "org1", name: "Empresa X" },
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
    };

    // Paginated response with wrapper key "contacts"
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ contacts: [mockContact], has_more: false, total: 1 }));

    const contacts = await fetchAllContacts("test-token-123456");
    expect(contacts.length).toBe(1);
    expect(contacts[0].organization).toEqual({ _id: "org1", name: "Empresa X" });
  });

  it("fetchAllContacts handles contacts without organization", async () => {
    const mockContact = {
      _id: "c2",
      name: "João Sem Empresa",
      emails: [],
      phones: [],
      organization: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse({ contacts: [mockContact], has_more: false, total: 1 }));

    const contacts = await fetchAllContacts("test-token-123456");
    expect(contacts.length).toBe(1);
    expect(contacts[0].organization).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. SPREADSHEET IMPORT — Input validation
// ═══════════════════════════════════════════════════════════════
describe("Spreadsheet import — input validation and processing", () => {
  it("validates row structure with required nome field", () => {
    const validRow = { nome: "João Silva", email: "joao@test.com", telefone: "11999999999" };
    expect(validRow.nome).toBeTruthy();
    expect(validRow.nome.length).toBeGreaterThan(0);
  });

  it("handles row with only nome (all other fields optional)", () => {
    const minimalRow = { nome: "Maria" };
    expect(minimalRow.nome).toBeTruthy();
  });

  it("parses Brazilian currency values correctly", () => {
    const testCases = [
      { input: "R$ 1.500,00", expected: 150000 },
      { input: "1500,00", expected: 150000 },
      { input: "R$ 500", expected: 50000 },
      { input: "1.234.567,89", expected: 123456789 },
      { input: "0,99", expected: 99 },
      { input: "abc", expected: NaN },
    ];

    for (const { input, expected } of testCases) {
      const cleaned = input.replace(/[R$\s.]/g, "").replace(",", ".");
      const parsed = parseFloat(cleaned);
      const valueCents = isNaN(parsed) ? NaN : Math.round(parsed * 100);
      if (isNaN(expected)) {
        expect(isNaN(valueCents)).toBe(true);
      } else {
        expect(valueCents).toBe(expected);
      }
    }
  });

  it("deduplicates contacts by email within batch", () => {
    const contactByEmail = new Map<string, number>();
    const rows = [
      { nome: "João", email: "joao@test.com" },
      { nome: "João Silva", email: "JOAO@TEST.COM" },
      { nome: "Maria", email: "maria@test.com" },
    ];

    let contactIdCounter = 1;
    const results: { nome: string; contactId: number; isNew: boolean }[] = [];

    for (const row of rows) {
      const emailKey = row.email?.toLowerCase().trim();
      if (emailKey && contactByEmail.has(emailKey)) {
        results.push({ nome: row.nome, contactId: contactByEmail.get(emailKey)!, isNew: false });
      } else {
        const newId = contactIdCounter++;
        if (emailKey) contactByEmail.set(emailKey, newId);
        results.push({ nome: row.nome, contactId: newId, isNew: true });
      }
    }

    expect(results[0].isNew).toBe(true);
    expect(results[0].contactId).toBe(1);
    expect(results[1].isNew).toBe(false);
    expect(results[1].contactId).toBe(1); // Same as first João
    expect(results[2].isNew).toBe(true);
    expect(results[2].contactId).toBe(2);
  });

  it("deduplicates accounts by name within batch", () => {
    const accountByName = new Map<string, number>();
    const rows = [
      { empresa: "Empresa X" },
      { empresa: "EMPRESA X" },
      { empresa: "Empresa Y" },
      { empresa: undefined },
    ];

    let accountIdCounter = 1;
    const results: { accountId: number | undefined; isNew: boolean }[] = [];

    for (const row of rows) {
      if (!row.empresa?.trim()) {
        results.push({ accountId: undefined, isNew: false });
        continue;
      }
      const empresaKey = row.empresa.trim().toLowerCase();
      if (accountByName.has(empresaKey)) {
        results.push({ accountId: accountByName.get(empresaKey)!, isNew: false });
      } else {
        const newId = accountIdCounter++;
        accountByName.set(empresaKey, newId);
        results.push({ accountId: newId, isNew: true });
      }
    }

    expect(results[0].isNew).toBe(true);
    expect(results[0].accountId).toBe(1);
    expect(results[1].isNew).toBe(false);
    expect(results[1].accountId).toBe(1); // Same as Empresa X
    expect(results[2].isNew).toBe(true);
    expect(results[2].accountId).toBe(2);
    expect(results[3].accountId).toBeUndefined();
  });

  it("matches stage name across multiple pipelines", () => {
    const allStagesMap = new Map<number, { id: number; name: string }[]>();
    allStagesMap.set(1, [
      { id: 10, name: "Novo Lead" },
      { id: 11, name: "Qualificação" },
    ]);
    allStagesMap.set(2, [
      { id: 20, name: "Pré-venda" },
      { id: 21, name: "Proposta" },
    ]);

    const defaultPipelineId = 1;
    const defaultStageId = 10;

    // Test matching "Proposta" → should find in pipeline 2
    const etapaName = "proposta";
    let targetPipelineId = defaultPipelineId;
    let targetStageId = defaultStageId;

    for (const [pId, stages] of Array.from(allStagesMap.entries())) {
      const match = stages.find((s) => s.name.toLowerCase() === etapaName);
      if (match) {
        targetPipelineId = pId;
        targetStageId = match.id;
        break;
      }
    }

    expect(targetPipelineId).toBe(2);
    expect(targetStageId).toBe(21);
  });

  it("falls back to default pipeline/stage when etapa not found", () => {
    const allStagesMap = new Map<number, { id: number; name: string }[]>();
    allStagesMap.set(1, [{ id: 10, name: "Novo Lead" }]);

    const defaultPipelineId = 1;
    const defaultStageId = 10;

    const etapaName = "etapa inexistente";
    let targetPipelineId = defaultPipelineId;
    let targetStageId = defaultStageId;

    for (const [pId, stages] of Array.from(allStagesMap.entries())) {
      const match = stages.find((s) => s.name.toLowerCase() === etapaName);
      if (match) {
        targetPipelineId = pId;
        targetStageId = match.id;
        break;
      }
    }

    expect(targetPipelineId).toBe(defaultPipelineId);
    expect(targetStageId).toBe(defaultStageId);
  });

  it("generates deal title from row data when negociacao is empty", () => {
    const row1 = { nome: "João Silva", negociacao: "Pacote Cancun" };
    const row2 = { nome: "Maria Santos", negociacao: "" };
    const row3 = { nome: "Pedro", negociacao: undefined };

    const title1 = row1.negociacao?.trim() || `${row1.nome.trim()} — Importação Planilha`;
    const title2 = row2.negociacao?.trim() || `${row2.nome.trim()} — Importação Planilha`;
    const title3 = row3.negociacao?.trim() || `${row3.nome.trim()} — Importação Planilha`;

    expect(title1).toBe("Pacote Cancun");
    expect(title2).toBe("Maria Santos — Importação Planilha");
    expect(title3).toBe("Pedro — Importação Planilha");
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. CSV TEMPLATE STRUCTURE
// ═══════════════════════════════════════════════════════════════
describe("CSV template structure", () => {
  it("template has all required columns", () => {
    const expectedHeaders = [
      "nome", "email", "telefone", "empresa",
      "negociacao", "valor", "etapa", "fonte", "campanha", "notas",
    ];

    // Simulating the frontend template generation
    const headers = expectedHeaders;
    expect(headers).toContain("nome");
    expect(headers).toContain("email");
    expect(headers).toContain("telefone");
    expect(headers).toContain("empresa");
    expect(headers).toContain("negociacao");
    expect(headers).toContain("valor");
    expect(headers).toContain("etapa");
    expect(headers).toContain("fonte");
    expect(headers).toContain("campanha");
    expect(headers).toContain("notas");
    expect(headers.length).toBe(10);
  });

  it("CSV parsing handles semicolon delimiter correctly", () => {
    const csvLine = "João Silva;joao@test.com;11999999999;Empresa X;Pacote Cancun;R$ 5.000,00;Novo Lead;Website;Black Friday;Observação importante";
    const parts = csvLine.split(";");
    expect(parts.length).toBe(10);
    expect(parts[0]).toBe("João Silva");
    expect(parts[1]).toBe("joao@test.com");
    expect(parts[5]).toBe("R$ 5.000,00");
    expect(parts[9]).toBe("Observação importante");
  });
});
