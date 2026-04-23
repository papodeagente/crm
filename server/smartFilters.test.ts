/**
 * Smart Filters — Unit Tests
 * Tests for the smart filter classification rules
 */
import { describe, it, expect, vi } from "vitest";
import {
  SMART_FILTERS,
  SMART_FILTER_CONFIG,
  classifyContact,
  computeFlag,
} from "./rfv";

describe("Smart Filter Config", () => {
  it("should have 5 smart filters defined", () => {
    expect(SMART_FILTERS).toHaveLength(5);
  });

  it("should have config for all smart filters", () => {
    for (const filter of SMART_FILTERS) {
      expect(SMART_FILTER_CONFIG[filter]).toBeDefined();
      expect(SMART_FILTER_CONFIG[filter].label).toBeTruthy();
      expect(SMART_FILTER_CONFIG[filter].description).toBeTruthy();
    }
  });

  it("should include potencial_ex_cliente filter", () => {
    expect(SMART_FILTERS).toContain("potencial_ex_cliente");
    expect(SMART_FILTER_CONFIG.potencial_ex_cliente.description).toContain("250");
    expect(SMART_FILTER_CONFIG.potencial_ex_cliente.description).toContain("350");
  });

  it("should include potencial_indicador filter", () => {
    expect(SMART_FILTERS).toContain("potencial_indicador");
    expect(SMART_FILTER_CONFIG.potencial_indicador.description).toContain("30 dias");
  });

  it("should include potencial_indicador_pos_atendimento filter", () => {
    expect(SMART_FILTERS).toContain("potencial_indicador_pos_atendimento");
    expect(SMART_FILTER_CONFIG.potencial_indicador_pos_atendimento.description).toContain("follow-up");
  });

  it("should include potencial_indicador_fiel filter", () => {
    expect(SMART_FILTERS).toContain("potencial_indicador_fiel");
    expect(SMART_FILTER_CONFIG.potencial_indicador_fiel.description).toContain("1 compra");
  });

  it("should include abordagem_nao_cliente filter", () => {
    expect(SMART_FILTERS).toContain("abordagem_nao_cliente");
    expect(SMART_FILTER_CONFIG.abordagem_nao_cliente.description).toContain("90 dias");
  });
});

describe("Smart Filter — Potencial Ex-Cliente Logic", () => {
  // The smart filter 'potencial_ex_cliente' uses SQL: rScore BETWEEN 250 AND 350 AND fScore > 0
  // The classifyContact function uses diasDesdeUltimaCompra > 300 for ex_cliente
  // So contacts at 250-300 days are still 'cliente_primeira_compra' by classification,
  // but the smart filter catches them by rScore range in SQL

  it("should classify as cliente_primeira_compra at 250 days (still within 300 threshold)", () => {
    const result = classifyContact({
      estadoMaisRecente: "vendido",
      totalCompras: 1,
      diasDesdeUltimaCompra: 250,
      totalAtendimentos: 2,
    });
    // At 250 days, the contact is still classified as cliente_primeira_compra
    // but the smart filter catches them via rScore range in SQL
    expect(result).toBe("cliente_primeira_compra");
  });

  it("should classify as cliente_primeira_compra at 300 days (boundary)", () => {
    const result = classifyContact({
      estadoMaisRecente: "vendido",
      totalCompras: 1,
      diasDesdeUltimaCompra: 300,
      totalAtendimentos: 2,
    });
    expect(result).toBe("cliente_primeira_compra");
  });

  it("should classify as ex_cliente at 301+ days", () => {
    const result = classifyContact({
      estadoMaisRecente: "vendido",
      totalCompras: 1,
      diasDesdeUltimaCompra: 301,
      totalAtendimentos: 2,
    });
    expect(result).toBe("ex_cliente");
  });

  it("should classify as ex_cliente at 350 days", () => {
    const result = classifyContact({
      estadoMaisRecente: "vendido",
      totalCompras: 1,
      diasDesdeUltimaCompra: 350,
      totalAtendimentos: 2,
    });
    expect(result).toBe("ex_cliente");
  });
});

describe("Smart Filter — Potencial Indicador Logic", () => {
  // This filter targets contacts with a purchase in the last 30 days

  it("should classify as cliente_primeira_compra for recent first purchase", () => {
    const result = classifyContact({
      estadoMaisRecente: "vendido",
      totalCompras: 1,
      diasDesdeUltimaCompra: 10,
      totalAtendimentos: 1,
    });
    expect(result).toBe("cliente_primeira_compra");
  });

  it("should classify as cliente_recorrente for recent repeat purchase", () => {
    const result = classifyContact({
      estadoMaisRecente: "vendido",
      totalCompras: 3,
      diasDesdeUltimaCompra: 5,
      totalAtendimentos: 5,
    });
    expect(result).toBe("cliente_recorrente");
  });
});

describe("Smart Filter — Potencial Indicador Fiel Logic", () => {
  // This filter targets contacts with more than 1 purchase (fScore > 1)

  it("should classify as cliente_recorrente for 2+ purchases", () => {
    const result = classifyContact({
      estadoMaisRecente: "vendido",
      totalCompras: 2,
      diasDesdeUltimaCompra: 60,
      totalAtendimentos: 3,
    });
    expect(result).toBe("cliente_recorrente");
  });

  it("should not be fiel with only 1 purchase", () => {
    const result = classifyContact({
      estadoMaisRecente: "vendido",
      totalCompras: 1,
      diasDesdeUltimaCompra: 60,
      totalAtendimentos: 1,
    });
    expect(result).toBe("cliente_primeira_compra");
  });
});

describe("Smart Filter — Abordagem Não Cliente Logic", () => {
  // This filter targets contacts with lost deals in the last 90 days

  it("should classify as nao_cliente for recent lost deal", () => {
    const result = classifyContact({
      estadoMaisRecente: "perdido",
      totalCompras: 0,
      diasDesdeUltimaCompra: 9999,
      totalAtendimentos: 1,
    });
    expect(result).toBe("nao_cliente");
  });

  it("should classify as nao_cliente for multiple lost deals", () => {
    const result = classifyContact({
      estadoMaisRecente: "perdido",
      totalCompras: 0,
      diasDesdeUltimaCompra: 9999,
      totalAtendimentos: 5,
    });
    expect(result).toBe("nao_cliente");
  });
});

describe("Smart Filter — Flag Computation", () => {
  it("should flag potencial_indicador for recent first purchase", () => {
    const flag = computeFlag({
      audienceType: "cliente_primeira_compra",
      totalVendasGanhas: 1,
      diasDesdeUltimaCompra: 15,
      totalCompras: 1,
      createdAt: new Date(),
    });
    expect(flag).toBe("potencial_indicador");
  });

  it("should flag risco_ex_cliente for ex_cliente", () => {
    const flag = computeFlag({
      audienceType: "ex_cliente",
      totalVendasGanhas: 1,
      diasDesdeUltimaCompra: 300,
      totalCompras: 1,
      createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    });
    expect(flag).toBe("risco_ex_cliente");
  });

  it("should flag abordagem_nao_cliente for nao_cliente", () => {
    const flag = computeFlag({
      audienceType: "nao_cliente",
      totalVendasGanhas: 0,
      diasDesdeUltimaCompra: 9999,
      totalCompras: 0,
      createdAt: new Date(),
    });
    expect(flag).toBe("abordagem_nao_cliente");
  });
});
