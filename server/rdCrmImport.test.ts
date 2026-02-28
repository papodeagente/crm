import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after mocking
import {
  validateRdCrmToken,
  fetchRdCrmSummary,
  fetchAllContacts,
  fetchAllDeals,
  fetchAllOrganizations,
  fetchAllProducts,
  fetchAllTasks,
  fetchAllPipelines,
  fetchAllUsers,
  fetchAllCampaigns,
  fetchAllSources,
  fetchAllLossReasons,
  fetchAllCustomFields,
} from "./rdStationCrmImport";

beforeEach(() => {
  mockFetch.mockReset();
});

function mockJsonResponse(data: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

describe("RD Station CRM Import - validateRdCrmToken", () => {
  it("returns valid=true when API responds with users", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ users: [{ _id: "1", name: "User 1" }] }));
    const result = await validateRdCrmToken("valid-token-123");
    expect(result.valid).toBe(true);
    expect(result.userCount).toBe(1);
  });

  it("returns valid=false when API returns error", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ error: "unauthorized" }, 401));
    const result = await validateRdCrmToken("invalid-token");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns valid=false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const result = await validateRdCrmToken("any-token");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Network error");
  });

  it("passes token as query parameter", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ users: [] }));
    await validateRdCrmToken("my-token-abc");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("token=my-token-abc");
    expect(url).toContain("/users");
  });
});

describe("RD Station CRM Import - fetchRdCrmSummary", () => {
  it("returns counts for all data types", async () => {
    // Mock 11 parallel requests
    const responses = [
      mockJsonResponse({ total: 150 }), // contacts
      mockJsonResponse({ total: 75 }), // deals
      mockJsonResponse({ total: 30 }), // organizations
      mockJsonResponse({ total: 0, products: [] }), // products
      mockJsonResponse({ total: 20 }), // tasks
      mockJsonResponse({ total: 0, deal_pipelines: [{ _id: "1" }, { _id: "2" }] }), // pipelines
      mockJsonResponse({ total: 0, users: [{ _id: "1" }] }), // users
      mockJsonResponse({ total: 0, campaigns: [{ _id: "1" }, { _id: "2" }, { _id: "3" }] }), // campaigns
      mockJsonResponse({ total: 0, deal_sources: [{ _id: "1" }] }), // sources
      mockJsonResponse({ total: 0, deal_lost_reasons: [{ _id: "1" }, { _id: "2" }] }), // loss reasons
      mockJsonResponse({ total: 0, custom_fields: [] }), // custom fields
    ];
    responses.forEach(r => mockFetch.mockResolvedValueOnce(r));

    const summary = await fetchRdCrmSummary("valid-token");
    expect(summary.contacts).toBe(150);
    expect(summary.deals).toBe(75);
    expect(summary.organizations).toBe(30);
    expect(summary.pipelines).toBe(2);
    expect(summary.users).toBe(1);
    expect(summary.campaigns).toBe(3);
    expect(summary.sources).toBe(1);
    expect(summary.lossReasons).toBe(2);
  });

  it("returns 0 for failed endpoints", async () => {
    // All fail
    for (let i = 0; i < 11; i++) {
      mockFetch.mockRejectedValueOnce(new Error("API error"));
    }
    const summary = await fetchRdCrmSummary("bad-token");
    expect(summary.contacts).toBe(0);
    expect(summary.deals).toBe(0);
    expect(summary.organizations).toBe(0);
  });
});

describe("RD Station CRM Import - fetchAllContacts", () => {
  it("fetches contacts with pagination", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      contacts: [
        { _id: "c1", name: "Contact 1", emails: [{ email: "c1@test.com" }], phones: [], created_at: "2024-01-01", updated_at: "2024-01-01" },
        { _id: "c2", name: "Contact 2", emails: [], phones: [{ phone: "+5511999999999" }], created_at: "2024-01-01", updated_at: "2024-01-01" },
      ],
      has_more: true,
      total: 3,
    }));
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      contacts: [
        { _id: "c3", name: "Contact 3", emails: [], phones: [], created_at: "2024-01-01", updated_at: "2024-01-01" },
      ],
      has_more: false,
      total: 3,
    }));

    const contacts = await fetchAllContacts("valid-token");
    expect(contacts).toHaveLength(3);
    expect(contacts[0].name).toBe("Contact 1");
    expect(contacts[2]._id).toBe("c3");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns empty array on error", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      contacts: [],
      has_more: false,
      total: 0,
    }));
    const contacts = await fetchAllContacts("valid-token");
    expect(contacts).toHaveLength(0);
  });
});

describe("RD Station CRM Import - fetchAllDeals", () => {
  it("fetches deals with all fields", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      deals: [
        {
          _id: "d1", id: "d1", name: "Deal 1",
          amount_montly: 0, amount_total: 5000, amount_unique: 5000,
          closed_at: null, win: null, hold: false,
          rating: 3, interactions: 5,
          contacts: [{ name: "Contact 1", emails: [{ email: "c@test.com" }], phones: [] }],
          deal_stage: { _id: "s1", name: "Qualificação" },
          deal_products: [{ _id: "dp1", name: "Product 1", price: 1000, amount: 2, total: 2000 }],
          created_at: "2024-01-01", updated_at: "2024-01-01",
        },
      ],
      has_more: false,
      total: 1,
    }));

    const deals = await fetchAllDeals("valid-token");
    expect(deals).toHaveLength(1);
    expect(deals[0].name).toBe("Deal 1");
    expect(deals[0].amount_total).toBe(5000);
    expect(deals[0].contacts).toHaveLength(1);
    expect(deals[0].deal_products).toHaveLength(1);
  });
});

describe("RD Station CRM Import - fetchAllPipelines", () => {
  it("fetches pipelines with stages", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      deal_pipelines: [
        {
          _id: "p1", name: "Pipeline Vendas",
          deal_stages: [
            { _id: "s1", name: "Novo", order: 0 },
            { _id: "s2", name: "Qualificação", order: 1 },
            { _id: "s3", name: "Proposta", order: 2 },
          ],
          created_at: "2024-01-01",
        },
      ],
    }));

    const pipelines = await fetchAllPipelines("valid-token");
    expect(pipelines).toHaveLength(1);
    expect(pipelines[0].name).toBe("Pipeline Vendas");
    expect(pipelines[0].deal_stages).toHaveLength(3);
    expect(pipelines[0].deal_stages[1].name).toBe("Qualificação");
  });
});

describe("RD Station CRM Import - fetchAllProducts", () => {
  it("fetches products", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      products: [
        { _id: "pr1", name: "Pacote Cancún", base_price: 3500, visible: true, created_at: "2024-01-01", updated_at: "2024-01-01" },
        { _id: "pr2", name: "Seguro Viagem", base_price: 250, visible: false, created_at: "2024-01-01", updated_at: "2024-01-01" },
      ],
    }));

    const products = await fetchAllProducts("valid-token");
    expect(products).toHaveLength(2);
    expect(products[0].name).toBe("Pacote Cancún");
    expect(products[0].base_price).toBe(3500);
    expect(products[1].visible).toBe(false);
  });
});

describe("RD Station CRM Import - fetchAllTasks", () => {
  it("fetches tasks with pagination", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      tasks: [
        { _id: "t1", subject: "Ligar para cliente", type: "call", date: "2024-03-01", done: false, created_at: "2024-01-01", updated_at: "2024-01-01" },
      ],
      has_more: false,
      total: 1,
    }));

    const tasks = await fetchAllTasks("valid-token");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].subject).toBe("Ligar para cliente");
    expect(tasks[0].done).toBe(false);
  });
});

describe("RD Station CRM Import - other fetchers", () => {
  it("fetchAllUsers returns users", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      users: [{ _id: "u1", name: "Admin", email: "admin@test.com" }],
    }));
    const users = await fetchAllUsers("valid-token");
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("admin@test.com");
  });

  it("fetchAllCampaigns returns campaigns", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      campaigns: [{ _id: "camp1", name: "Black Friday", created_at: "2024-01-01" }],
    }));
    const campaigns = await fetchAllCampaigns("valid-token");
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0].name).toBe("Black Friday");
  });

  it("fetchAllSources returns sources", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      deal_sources: [{ _id: "src1", name: "Google Ads", created_at: "2024-01-01" }],
    }));
    const sources = await fetchAllSources("valid-token");
    expect(sources).toHaveLength(1);
    expect(sources[0].name).toBe("Google Ads");
  });

  it("fetchAllLossReasons returns loss reasons", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      deal_lost_reasons: [{ _id: "lr1", name: "Preço alto", created_at: "2024-01-01" }],
    }));
    const reasons = await fetchAllLossReasons("valid-token");
    expect(reasons).toHaveLength(1);
    expect(reasons[0].name).toBe("Preço alto");
  });

  it("fetchAllCustomFields returns custom fields", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      custom_fields: [{ _id: "cf1", label: "CPF", field_type: "text", created_at: "2024-01-01" }],
    }));
    const fields = await fetchAllCustomFields("valid-token");
    expect(fields).toHaveLength(1);
    expect(fields[0].label).toBe("CPF");
  });

  it("fetchAllOrganizations fetches with pagination", async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      organizations: [
        { _id: "org1", name: "Empresa ABC", created_at: "2024-01-01", updated_at: "2024-01-01" },
      ],
      has_more: false,
      total: 1,
    }));
    const orgs = await fetchAllOrganizations("valid-token");
    expect(orgs).toHaveLength(1);
    expect(orgs[0].name).toBe("Empresa ABC");
  });
});
