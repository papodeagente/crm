import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  interpolateTemplate,
  getBulkSendProgress,
  cancelBulkSend,
} from "./bulkMessage";

// ─── interpolateTemplate tests ───
describe("interpolateTemplate", () => {
  const baseContact = {
    name: "João da Silva",
    email: "joao@email.com",
    phone: "11999990000",
    audienceType: "oportunidade",
    vScore: 150000, // R$ 1.500,00
  };

  it("should replace {nome} with full name", () => {
    const result = interpolateTemplate("Olá {nome}!", baseContact);
    expect(result).toBe("Olá João da Silva!");
  });

  it("should replace {primeiro_nome} with first name only", () => {
    const result = interpolateTemplate("Oi {primeiro_nome}, tudo bem?", baseContact);
    expect(result).toBe("Oi João, tudo bem?");
  });

  it("should replace {email} with contact email", () => {
    const result = interpolateTemplate("Seu email: {email}", baseContact);
    expect(result).toBe("Seu email: joao@email.com");
  });

  it("should replace {telefone} with contact phone", () => {
    const result = interpolateTemplate("Telefone: {telefone}", baseContact);
    expect(result).toBe("Telefone: 11999990000");
  });

  it("should replace {publico} with audience type", () => {
    const result = interpolateTemplate("Você é {publico}", baseContact);
    expect(result).toBe("Você é oportunidade");
  });

  it("should replace {valor} with formatted currency", () => {
    const result = interpolateTemplate("Valor: {valor}", baseContact);
    expect(result).toContain("1.500,00");
  });

  it("should replace multiple variables in one template", () => {
    const result = interpolateTemplate(
      "Olá {primeiro_nome}, seu valor é {valor} e público é {publico}.",
      baseContact,
    );
    expect(result).toContain("João");
    expect(result).toContain("1.500,00");
    expect(result).toContain("oportunidade");
  });

  it("should handle null email gracefully", () => {
    const contact = { ...baseContact, email: null };
    const result = interpolateTemplate("Email: {email}", contact);
    expect(result).toBe("Email: ");
  });

  it("should handle null phone gracefully", () => {
    const contact = { ...baseContact, phone: null };
    const result = interpolateTemplate("Tel: {telefone}", contact);
    expect(result).toBe("Tel: ");
  });

  it("should be case-insensitive for variable names", () => {
    const result = interpolateTemplate("{NOME} {Nome} {nome}", baseContact);
    expect(result).toBe("João da Silva João da Silva João da Silva");
  });

  it("should handle single-name contacts for primeiro_nome", () => {
    const contact = { ...baseContact, name: "Maria" };
    const result = interpolateTemplate("{primeiro_nome}", contact);
    expect(result).toBe("Maria");
  });

  it("should handle zero value", () => {
    const contact = { ...baseContact, vScore: 0 };
    const result = interpolateTemplate("{valor}", contact);
    expect(result).toContain("0,00");
  });

  it("should leave text without variables unchanged", () => {
    const result = interpolateTemplate("Texto sem variáveis", baseContact);
    expect(result).toBe("Texto sem variáveis");
  });
});

// ─── getBulkSendProgress tests ───
describe("getBulkSendProgress", () => {
  it("should return null when no job exists", () => {
    const result = getBulkSendProgress(99999);
    expect(result).toBeNull();
  });
});

// ─── cancelBulkSend tests ───
describe("cancelBulkSend", () => {
  it("should return false when no job exists", () => {
    const result = cancelBulkSend(99999);
    expect(result).toBe(false);
  });
});
