import { describe, it, expect } from "vitest";
import { runGuardrails } from "./agentGuardrails";

describe("agentGuardrails", () => {
  it("redacts CPF", () => {
    const r = runGuardrails("Seu cpf é 123.456.789-00 ok?");
    expect(r.cleanText).not.toContain("123.456.789-00");
    expect(r.cleanText).toContain("[CPF removido]");
    expect(r.redactionsApplied).toContain("cpf");
    expect(r.shouldEscalate).toBe(false);
  });

  it("redacts credit cards", () => {
    const r = runGuardrails("Cartão: 4111 1111 1111 1111");
    expect(r.cleanText).toContain("[cartão removido]");
    expect(r.redactionsApplied).toContain("card");
  });

  it("escalates on low-confidence phrases", () => {
    const r = runGuardrails("Olá, não tenho certeza sobre isso, posso verificar.");
    expect(r.shouldEscalate).toBe(true);
    expect(r.reason).toContain("confiança");
  });

  it("caps length", () => {
    const long = "a".repeat(2000);
    const r = runGuardrails(long, { maxLength: 100 });
    expect(r.cleanText.length).toBeLessThanOrEqual(100);
    expect(r.cleanText.endsWith("…")).toBe(true);
  });

  it("escalates on empty text", () => {
    const r = runGuardrails("   ");
    expect(r.shouldEscalate).toBe(true);
  });

  it("passes clean confident text through", () => {
    const r = runGuardrails("Claro! Posso te ajudar com isso. Qual destino você prefere?");
    expect(r.shouldEscalate).toBe(false);
    expect(r.cleanText).toBe("Claro! Posso te ajudar com isso. Qual destino você prefere?");
    expect(r.redactionsApplied).toEqual([]);
  });
});
