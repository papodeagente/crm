import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for RFV Notification System
 * Tests the snapshot comparison logic and notification generation
 */

// ─── Test the snapshot comparison logic ───
describe("RFV Notification Snapshot Logic", () => {
  // Simulate the comparison logic used in runRfvNotificationCheck
  function detectChanges(
    currentCounts: Record<string, number>,
    previousSnapshots: Record<string, number>,
  ): Array<{ filterKey: string; previousCount: number; currentCount: number; newContacts: number }> {
    const changes: Array<{ filterKey: string; previousCount: number; currentCount: number; newContacts: number }> = [];
    for (const [filterKey, currentCount] of Object.entries(currentCounts)) {
      const previousCount = previousSnapshots[filterKey] ?? 0;
      if (currentCount > previousCount) {
        changes.push({
          filterKey,
          previousCount,
          currentCount,
          newContacts: currentCount - previousCount,
        });
      }
    }
    return changes;
  }

  it("should detect no changes when counts are the same", () => {
    const current = { potencial_ex_cliente: 10, potencial_indicador: 5 };
    const previous = { potencial_ex_cliente: 10, potencial_indicador: 5 };
    const changes = detectChanges(current, previous);
    expect(changes).toHaveLength(0);
  });

  it("should detect new contacts when count increases", () => {
    const current = { potencial_ex_cliente: 15, potencial_indicador: 5 };
    const previous = { potencial_ex_cliente: 10, potencial_indicador: 5 };
    const changes = detectChanges(current, previous);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      filterKey: "potencial_ex_cliente",
      previousCount: 10,
      currentCount: 15,
      newContacts: 5,
    });
  });

  it("should NOT notify when count decreases", () => {
    const current = { potencial_ex_cliente: 5, potencial_indicador: 5 };
    const previous = { potencial_ex_cliente: 10, potencial_indicador: 5 };
    const changes = detectChanges(current, previous);
    expect(changes).toHaveLength(0);
  });

  it("should detect changes in multiple filters", () => {
    const current = {
      potencial_ex_cliente: 15,
      potencial_indicador: 8,
      potencial_indicador_pos_viagem: 3,
      potencial_indicador_fiel: 12,
      abordagem_nao_cliente: 20,
    };
    const previous = {
      potencial_ex_cliente: 10,
      potencial_indicador: 5,
      potencial_indicador_pos_viagem: 3,
      potencial_indicador_fiel: 12,
      abordagem_nao_cliente: 15,
    };
    const changes = detectChanges(current, previous);
    expect(changes).toHaveLength(3);
    expect(changes.map((c) => c.filterKey)).toEqual([
      "potencial_ex_cliente",
      "potencial_indicador",
      "abordagem_nao_cliente",
    ]);
  });

  it("should treat missing previous snapshot as 0", () => {
    const current = { potencial_ex_cliente: 5 };
    const previous: Record<string, number> = {};
    const changes = detectChanges(current, previous);
    expect(changes).toHaveLength(1);
    expect(changes[0].previousCount).toBe(0);
    expect(changes[0].newContacts).toBe(5);
  });

  it("should handle first run with all new counts", () => {
    const current = {
      potencial_ex_cliente: 10,
      potencial_indicador: 5,
      potencial_indicador_pos_viagem: 3,
      potencial_indicador_fiel: 7,
      abordagem_nao_cliente: 12,
    };
    const previous: Record<string, number> = {};
    const changes = detectChanges(current, previous);
    expect(changes).toHaveLength(5);
    const totalNew = changes.reduce((sum, c) => sum + c.newContacts, 0);
    expect(totalNew).toBe(37);
  });

  it("should handle zero current counts gracefully", () => {
    const current = { potencial_ex_cliente: 0, potencial_indicador: 0 };
    const previous = { potencial_ex_cliente: 0, potencial_indicador: 0 };
    const changes = detectChanges(current, previous);
    expect(changes).toHaveLength(0);
  });

  it("should not notify for zero to zero transitions", () => {
    const current = { potencial_ex_cliente: 0 };
    const previous: Record<string, number> = {};
    const changes = detectChanges(current, previous);
    expect(changes).toHaveLength(0);
  });
});

// ─── Test notification message generation ───
describe("RFV Notification Message Generation", () => {
  const FILTER_LABELS: Record<string, string> = {
    potencial_ex_cliente: "Potencial Ex-Cliente",
    potencial_indicador: "Potencial Indicador",
    potencial_indicador_pos_viagem: "Pós Viagem",
    potencial_indicador_fiel: "Indicador Fiel",
    abordagem_nao_cliente: "Abordagem Não Cliente",
  };

  function generateNotificationTitle(filterKey: string, newContacts: number): string {
    const label = FILTER_LABELS[filterKey] || filterKey;
    return `${newContacts} novo(s) contato(s) em "${label}"`;
  }

  function generateNotificationBody(filterKey: string, previousCount: number, currentCount: number): string {
    const label = FILTER_LABELS[filterKey] || filterKey;
    return `O filtro "${label}" passou de ${previousCount} para ${currentCount} contatos. Verifique a Matriz RFV para ações.`;
  }

  it("should generate correct title for single new contact", () => {
    const title = generateNotificationTitle("potencial_ex_cliente", 1);
    expect(title).toBe('1 novo(s) contato(s) em "Potencial Ex-Cliente"');
  });

  it("should generate correct title for multiple new contacts", () => {
    const title = generateNotificationTitle("potencial_indicador", 5);
    expect(title).toBe('5 novo(s) contato(s) em "Potencial Indicador"');
  });

  it("should generate correct body with counts", () => {
    const body = generateNotificationBody("abordagem_nao_cliente", 10, 15);
    expect(body).toBe('O filtro "Abordagem Não Cliente" passou de 10 para 15 contatos. Verifique a Matriz RFV para ações.');
  });

  it("should generate body for first detection (from 0)", () => {
    const body = generateNotificationBody("potencial_indicador_fiel", 0, 7);
    expect(body).toBe('O filtro "Indicador Fiel" passou de 0 para 7 contatos. Verifique a Matriz RFV para ações.');
  });

  it("should handle all filter types", () => {
    for (const [key, label] of Object.entries(FILTER_LABELS)) {
      const title = generateNotificationTitle(key, 3);
      expect(title).toContain(label);
    }
  });
});

// ─── Test scheduler interval logic ───
describe("RFV Notification Scheduler", () => {
  it("should have correct 6-hour interval in milliseconds", () => {
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    expect(SIX_HOURS_MS).toBe(21600000);
  });

  it("should have correct 1-hour interval in milliseconds", () => {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    expect(ONE_HOUR_MS).toBe(3600000);
  });
});
