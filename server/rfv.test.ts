import { describe, it, expect } from "vitest";
import {
  classifyContact,
  computeFlag,
  normalizePhone,
  whatsappLink,
  conversionBadge,
  normalizeEstado,
  parseCsvRows,
  groupCsvByPerson,
  type AudienceType,
} from "./rfv";

// ─── classifyContact ───
describe("classifyContact", () => {
  it("Rule 1: open deal → oportunidade", () => {
    expect(classifyContact({ estadoMaisRecente: "em andamento", totalCompras: 0, diasDesdeUltimaCompra: 9999, totalAtendimentos: 1 })).toBe("oportunidade");
    expect(classifyContact({ estadoMaisRecente: "aberto", totalCompras: 0, diasDesdeUltimaCompra: 9999, totalAtendimentos: 1 })).toBe("oportunidade");
    expect(classifyContact({ estadoMaisRecente: "open", totalCompras: 0, diasDesdeUltimaCompra: 9999, totalAtendimentos: 1 })).toBe("oportunidade");
  });

  it("Rule 2: lost deal + no purchases → nao_cliente", () => {
    expect(classifyContact({ estadoMaisRecente: "perdido", totalCompras: 0, diasDesdeUltimaCompra: 9999, totalAtendimentos: 1 })).toBe("nao_cliente");
    expect(classifyContact({ estadoMaisRecente: "perdida", totalCompras: 0, diasDesdeUltimaCompra: 9999, totalAtendimentos: 1 })).toBe("nao_cliente");
    expect(classifyContact({ estadoMaisRecente: "lost", totalCompras: 0, diasDesdeUltimaCompra: 9999, totalAtendimentos: 1 })).toBe("nao_cliente");
  });

  it("Rule 3: 2+ purchases within 300 days → cliente_recorrente", () => {
    expect(classifyContact({ estadoMaisRecente: "vendido", totalCompras: 2, diasDesdeUltimaCompra: 100, totalAtendimentos: 3 })).toBe("cliente_recorrente");
    expect(classifyContact({ estadoMaisRecente: "vendido", totalCompras: 5, diasDesdeUltimaCompra: 300, totalAtendimentos: 5 })).toBe("cliente_recorrente");
  });

  it("Rule 4: 1 purchase within 300 days → cliente_primeira_compra", () => {
    expect(classifyContact({ estadoMaisRecente: "vendido", totalCompras: 1, diasDesdeUltimaCompra: 100, totalAtendimentos: 2 })).toBe("cliente_primeira_compra");
    expect(classifyContact({ estadoMaisRecente: "vendido", totalCompras: 1, diasDesdeUltimaCompra: 300, totalAtendimentos: 1 })).toBe("cliente_primeira_compra");
  });

  it("Rule 5: purchases but > 300 days → ex_cliente", () => {
    expect(classifyContact({ estadoMaisRecente: "vendido", totalCompras: 1, diasDesdeUltimaCompra: 301, totalAtendimentos: 1 })).toBe("ex_cliente");
    expect(classifyContact({ estadoMaisRecente: "vendido", totalCompras: 3, diasDesdeUltimaCompra: 500, totalAtendimentos: 3 })).toBe("ex_cliente");
  });

  it("Rule 6: no purchases but has interactions → nao_cliente", () => {
    expect(classifyContact({ estadoMaisRecente: "", totalCompras: 0, diasDesdeUltimaCompra: 9999, totalAtendimentos: 3 })).toBe("nao_cliente");
  });

  it("Rule 7: fallback → lead", () => {
    expect(classifyContact({ estadoMaisRecente: "", totalCompras: 0, diasDesdeUltimaCompra: 9999, totalAtendimentos: 0 })).toBe("lead");
    expect(classifyContact({ estadoMaisRecente: null, totalCompras: 0, diasDesdeUltimaCompra: 9999, totalAtendimentos: 0 })).toBe("lead");
  });

  it("Rule priority: open deal takes precedence over purchases", () => {
    // Even with purchases, if latest deal is open → oportunidade
    expect(classifyContact({ estadoMaisRecente: "em andamento", totalCompras: 3, diasDesdeUltimaCompra: 50, totalAtendimentos: 5 })).toBe("oportunidade");
  });

  it("Rule priority: lost + no purchases takes precedence over interactions", () => {
    expect(classifyContact({ estadoMaisRecente: "perdido", totalCompras: 0, diasDesdeUltimaCompra: 9999, totalAtendimentos: 5 })).toBe("nao_cliente");
  });
});

// ─── computeFlag ───
describe("computeFlag", () => {
  const baseDate = new Date();

  it("potencial_indicador: won deals + 10-20 days since last purchase", () => {
    expect(computeFlag({
      audienceType: "cliente_primeira_compra",
      totalVendasGanhas: 1,
      diasDesdeUltimaCompra: 15,
      totalCompras: 1,
      createdAt: baseDate,
    })).toBe("potencial_indicador");
  });

  it("risco_ex_cliente: purchases + 280-310 days since last purchase", () => {
    expect(computeFlag({
      audienceType: "cliente_primeira_compra",
      totalVendasGanhas: 1,
      diasDesdeUltimaCompra: 290,
      totalCompras: 1,
      createdAt: baseDate,
    })).toBe("risco_ex_cliente");
  });

  it("abordagem_nao_cliente: nao_cliente + created within 90 days", () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 30);
    expect(computeFlag({
      audienceType: "nao_cliente",
      totalVendasGanhas: 0,
      diasDesdeUltimaCompra: 9999,
      totalCompras: 0,
      createdAt: recentDate,
    })).toBe("abordagem_nao_cliente");
  });

  it("none: no flag conditions met", () => {
    expect(computeFlag({
      audienceType: "lead",
      totalVendasGanhas: 0,
      diasDesdeUltimaCompra: 9999,
      totalCompras: 0,
      createdAt: baseDate,
    })).toBe("none");
  });

  it("flags are mutually exclusive: potencial_indicador takes priority", () => {
    // If both potencial_indicador and risco_ex_cliente could match, only first wins
    expect(computeFlag({
      audienceType: "cliente_primeira_compra",
      totalVendasGanhas: 1,
      diasDesdeUltimaCompra: 15,
      totalCompras: 1,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    })).toBe("potencial_indicador");
  });
});

// ─── normalizePhone ───
describe("normalizePhone", () => {
  it("adds 55 prefix to 11-digit number", () => {
    expect(normalizePhone("11999887766")).toBe("5511999887766");
  });

  it("keeps 55 prefix if already present", () => {
    expect(normalizePhone("5511999887766")).toBe("5511999887766");
  });

  it("strips non-digits", () => {
    expect(normalizePhone("(11) 99988-7766")).toBe("5511999887766");
  });

  it("returns null for short numbers", () => {
    expect(normalizePhone("12345")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});

// ─── whatsappLink ───
describe("whatsappLink", () => {
  it("generates correct link", () => {
    expect(whatsappLink("11999887766")).toBe("https://web.whatsapp.com/send?phone=5511999887766");
  });

  it("returns null for invalid phone", () => {
    expect(whatsappLink("123")).toBeNull();
    expect(whatsappLink(null)).toBeNull();
  });
});

// ─── conversionBadge ───
describe("conversionBadge", () => {
  it(">= 50% → alta", () => expect(conversionBadge(50)).toBe("alta"));
  it(">= 20% → media", () => expect(conversionBadge(20)).toBe("media"));
  it("< 20% → baixa", () => expect(conversionBadge(10)).toBe("baixa"));
  it("0% → baixa", () => expect(conversionBadge(0)).toBe("baixa"));
  it("100% → alta", () => expect(conversionBadge(100)).toBe("alta"));
});

// ─── normalizeEstado ───
describe("normalizeEstado", () => {
  it("normalizes open variants", () => {
    expect(normalizeEstado("em andamento")).toBe("em andamento");
    expect(normalizeEstado("aberto")).toBe("em andamento");
    expect(normalizeEstado("open")).toBe("em andamento");
    expect(normalizeEstado("OPEN")).toBe("em andamento");
  });

  it("normalizes lost variants", () => {
    expect(normalizeEstado("perdido")).toBe("perdido");
    expect(normalizeEstado("perdida")).toBe("perdido");
    expect(normalizeEstado("lost")).toBe("perdido");
  });

  it("normalizes won variants", () => {
    expect(normalizeEstado("vendido")).toBe("vendido");
    expect(normalizeEstado("ganho")).toBe("vendido");
    expect(normalizeEstado("won")).toBe("vendido");
  });

  it("returns lowercase for unknown", () => {
    expect(normalizeEstado("custom")).toBe("custom");
  });
});

// ─── parseCsvRows ───
describe("parseCsvRows", () => {
  it("parses comma-separated CSV", () => {
    const csv = `Nome,Email,Telefone,Valor,Estado
João Silva,joao@test.com,11999887766,1500,vendido
Maria Santos,maria@test.com,11988776655,2000,perdido`;
    const rows = parseCsvRows(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].nome).toBe("João Silva");
    expect(rows[0].email).toBe("joao@test.com");
    expect(rows[0].valor).toBe("1500");
    expect(rows[0].estado).toBe("vendido");
  });

  it("parses semicolon-separated CSV", () => {
    const csv = `Nome;Email;Valor;Estado
João;joao@test.com;1500;vendido`;
    const rows = parseCsvRows(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].nome).toBe("João");
  });

  it("returns empty for header-only CSV", () => {
    const csv = `Nome,Email`;
    expect(parseCsvRows(csv)).toHaveLength(0);
  });

  it("maps alternative column names", () => {
    const csv = `Name,E-mail,Phone,Value,Status
Test,test@test.com,11999887766,1000,won`;
    const rows = parseCsvRows(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].nome).toBe("Test");
    expect(rows[0].email).toBe("test@test.com");
  });
});

// ─── groupCsvByPerson ───
describe("groupCsvByPerson", () => {
  it("groups by phone (priority)", () => {
    const rows = [
      { nome: "João", telefone: "11999887766", valor: "1000", estado: "vendido" },
      { nome: "João Silva", telefone: "11999887766", valor: "2000", estado: "vendido" },
    ];
    const grouped = groupCsvByPerson(rows);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].totalAtendimentos).toBe(2);
    expect(grouped[0].totalVendasGanhas).toBe(2);
    expect(grouped[0].totalValor).toBe(300000); // 3000 * 100 cents
  });

  it("groups by email when no phone", () => {
    const rows = [
      { nome: "João", email: "joao@test.com", valor: "1000", estado: "vendido" },
      { nome: "João Silva", email: "joao@test.com", valor: "500", estado: "perdido" },
    ];
    const grouped = groupCsvByPerson(rows);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].totalVendasGanhas).toBe(1);
    expect(grouped[0].totalVendasPerdidas).toBe(1);
  });

  it("groups by name as last resort", () => {
    const rows = [
      { nome: "João", valor: "1000", estado: "vendido" },
      { nome: "João", valor: "500", estado: "vendido" },
    ];
    const grouped = groupCsvByPerson(rows);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].totalCompras).toBe(2);
  });

  it("separates different contacts", () => {
    const rows = [
      { nome: "João", email: "joao@test.com", valor: "1000", estado: "vendido" },
      { nome: "Maria", email: "maria@test.com", valor: "2000", estado: "perdido" },
    ];
    const grouped = groupCsvByPerson(rows);
    expect(grouped).toHaveLength(2);
  });

  it("calculates estadoMaisRecente correctly", () => {
    const rows = [
      { nome: "João", email: "joao@test.com", valor: "1000", estado: "vendido", data_fechamento: "2025-01-01" },
      { nome: "João", email: "joao@test.com", valor: "500", estado: "em andamento", data_fechamento: "2025-06-01" },
    ];
    const grouped = groupCsvByPerson(rows);
    expect(grouped[0].estadoMaisRecente).toBe("em andamento");
  });
});
