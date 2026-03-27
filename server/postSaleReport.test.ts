/**
 * Tests for Post-Sale Report KPI calculations.
 * Validates that "Valor em Entrega" excludes lost deals (viagens canceladas).
 */
import { describe, it, expect } from "vitest";

interface AnalyticsSummary {
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalValueCents: number;
  wonValueCents: number;
  lostValueCents: number;
  openValueCents: number;
  conversionRate: number;
  avgTicketCents: number;
  avgCycleDays: number;
}

/**
 * Replicates the PostSaleReport.tsx KPI calculation logic.
 * "Valor em Entrega" = totalValueCents - lostValueCents
 * "Viagens em Gestão" = totalDeals - lostDeals
 * "Ticket Médio Entrega" = (totalValueCents - lostValueCents) / (totalDeals - lostDeals)
 */
function computePostSaleKpis(summary: AnalyticsSummary) {
  const activeDeals = summary.totalDeals - summary.lostDeals;
  const activeValueCents = summary.totalValueCents - summary.lostValueCents;
  const ticketMedioCents = activeDeals > 0 ? Math.round(activeValueCents / activeDeals) : 0;

  return {
    viagensEmGestao: activeDeals,
    valorEmEntrega: activeValueCents,
    ticketMedio: ticketMedioCents,
    finalizadas: summary.wonDeals,
    canceladas: summary.lostDeals,
    canceladasValor: summary.lostValueCents,
  };
}

describe("Post-Sale Report — Valor em Entrega deduction", () => {
  it("should subtract lost value from total to get Valor em Entrega", () => {
    const summary: AnalyticsSummary = {
      totalDeals: 10,
      openDeals: 5,
      wonDeals: 3,
      lostDeals: 2,
      totalValueCents: 100_000_00, // R$ 100.000
      wonValueCents: 30_000_00,    // R$ 30.000
      lostValueCents: 20_000_00,   // R$ 20.000
      openValueCents: 50_000_00,   // R$ 50.000
      conversionRate: 60,
      avgTicketCents: 10_000_00,
      avgCycleDays: 15,
    };

    const kpis = computePostSaleKpis(summary);

    // Valor em Entrega = 100.000 - 20.000 = 80.000
    expect(kpis.valorEmEntrega).toBe(80_000_00);
    // Viagens em Gestão = 10 - 2 = 8
    expect(kpis.viagensEmGestao).toBe(8);
    // Ticket Médio = 80.000 / 8 = 10.000
    expect(kpis.ticketMedio).toBe(10_000_00);
    // Canceladas = 2
    expect(kpis.canceladas).toBe(2);
    expect(kpis.canceladasValor).toBe(20_000_00);
  });

  it("should show zero when all deals are lost (cancelled)", () => {
    const summary: AnalyticsSummary = {
      totalDeals: 3,
      openDeals: 0,
      wonDeals: 0,
      lostDeals: 3,
      totalValueCents: 45_000_00,
      wonValueCents: 0,
      lostValueCents: 45_000_00,
      openValueCents: 0,
      conversionRate: 0,
      avgTicketCents: 0,
      avgCycleDays: 0,
    };

    const kpis = computePostSaleKpis(summary);

    expect(kpis.valorEmEntrega).toBe(0);
    expect(kpis.viagensEmGestao).toBe(0);
    expect(kpis.ticketMedio).toBe(0);
    expect(kpis.canceladas).toBe(3);
  });

  it("should show full value when no deals are lost", () => {
    const summary: AnalyticsSummary = {
      totalDeals: 5,
      openDeals: 3,
      wonDeals: 2,
      lostDeals: 0,
      totalValueCents: 50_000_00,
      wonValueCents: 20_000_00,
      lostValueCents: 0,
      openValueCents: 30_000_00,
      conversionRate: 100,
      avgTicketCents: 10_000_00,
      avgCycleDays: 10,
    };

    const kpis = computePostSaleKpis(summary);

    expect(kpis.valorEmEntrega).toBe(50_000_00);
    expect(kpis.viagensEmGestao).toBe(5);
    expect(kpis.ticketMedio).toBe(10_000_00);
    expect(kpis.canceladas).toBe(0);
  });

  it("should correctly compute ticket médio excluding lost deals", () => {
    // 4 deals total: 1 open (R$10k), 1 won (R$20k), 2 lost (R$30k each = R$60k)
    const summary: AnalyticsSummary = {
      totalDeals: 4,
      openDeals: 1,
      wonDeals: 1,
      lostDeals: 2,
      totalValueCents: 90_000_00,  // 10k + 20k + 60k
      wonValueCents: 20_000_00,
      lostValueCents: 60_000_00,
      openValueCents: 10_000_00,
      conversionRate: 33.33,
      avgTicketCents: 20_000_00,
      avgCycleDays: 7,
    };

    const kpis = computePostSaleKpis(summary);

    // Active value = 90k - 60k = 30k
    expect(kpis.valorEmEntrega).toBe(30_000_00);
    // Active deals = 4 - 2 = 2
    expect(kpis.viagensEmGestao).toBe(2);
    // Ticket médio = 30k / 2 = 15k
    expect(kpis.ticketMedio).toBe(15_000_00);
  });

  it("should handle single deal that gets cancelled", () => {
    const summary: AnalyticsSummary = {
      totalDeals: 1,
      openDeals: 0,
      wonDeals: 0,
      lostDeals: 1,
      totalValueCents: 5_000_00,
      wonValueCents: 0,
      lostValueCents: 5_000_00,
      openValueCents: 0,
      conversionRate: 0,
      avgTicketCents: 0,
      avgCycleDays: 0,
    };

    const kpis = computePostSaleKpis(summary);

    expect(kpis.valorEmEntrega).toBe(0);
    expect(kpis.viagensEmGestao).toBe(0);
    expect(kpis.ticketMedio).toBe(0);
    expect(kpis.canceladas).toBe(1);
    expect(kpis.canceladasValor).toBe(5_000_00);
  });

  it("should keep finalizadas count unaffected by lost deals", () => {
    const summary: AnalyticsSummary = {
      totalDeals: 10,
      openDeals: 2,
      wonDeals: 5,
      lostDeals: 3,
      totalValueCents: 200_000_00,
      wonValueCents: 100_000_00,
      lostValueCents: 60_000_00,
      openValueCents: 40_000_00,
      conversionRate: 62.5,
      avgTicketCents: 20_000_00,
      avgCycleDays: 12,
    };

    const kpis = computePostSaleKpis(summary);

    expect(kpis.finalizadas).toBe(5);
    expect(kpis.valorEmEntrega).toBe(140_000_00); // 200k - 60k
    expect(kpis.viagensEmGestao).toBe(7); // 10 - 3
  });
});
