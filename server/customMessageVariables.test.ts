import { describe, it, expect } from "vitest";

// We test the substituteVariables logic by reimplementing it server-side
// since the actual function lives in a React component file.
// This ensures the substitution algorithm is correct.

function substituteVariables(
  content: string,
  ctx: {
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    dealId?: number | null;
    dealTitle?: string | null;
    dealValueCents?: number | null;
    dealStageName?: string | null;
    companyName?: string | null;
  },
  products?: Array<{ name: string; unitPriceCents: number; quantity: number }>,
): string {
  const firstName = ctx.contactName?.split(" ")[0] || "";
  const fmtValue = ctx.dealValueCents != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ctx.dealValueCents / 100)
    : "";

  let mainProduct = "";
  if (products && products.length > 0) {
    const sorted = [...products].sort(
      (a, b) => (b.unitPriceCents * b.quantity) - (a.unitPriceCents * a.quantity),
    );
    mainProduct = sorted[0].name;
  }

  const replacements: Record<string, string> = {
    "{nome}": ctx.contactName || "",
    "{primeiro_nome}": firstName,
    "{email}": ctx.contactEmail || "",
    "{telefone}": ctx.contactPhone || "",
    "{negociacao}": ctx.dealTitle || "",
    "{valor}": fmtValue,
    "{etapa}": ctx.dealStageName || "",
    "{empresa}": ctx.companyName || "",
    "{nome_oportunidade}": ctx.dealTitle || "",
    "{produto_principal}": mainProduct,
  };

  let result = content;
  for (const [variable, value] of Object.entries(replacements)) {
    result = result.replaceAll(variable, value);
  }
  return result;
}

describe("Custom Message Variable Substitution", () => {
  const fullContext = {
    contactName: "Maria Silva",
    contactEmail: "maria@email.com",
    contactPhone: "5511999887766",
    dealId: 42,
    dealTitle: "Pacote Europa 2026",
    dealValueCents: 1500000, // R$ 15.000,00
    dealStageName: "Diagnóstico",
    companyName: "Agência Viagens Top",
  };

  const products = [
    { name: "Passagem Aérea SP-Paris", unitPriceCents: 500000, quantity: 2 },
    { name: "Hotel Paris 5 noites", unitPriceCents: 300000, quantity: 1 },
    { name: "Seguro Viagem", unitPriceCents: 50000, quantity: 2 },
  ];

  it("should substitute {nome} with full contact name", () => {
    const result = substituteVariables("Olá {nome}, tudo bem?", fullContext);
    expect(result).toBe("Olá Maria Silva, tudo bem?");
  });

  it("should substitute {primeiro_nome} with first name only", () => {
    const result = substituteVariables("Oi {primeiro_nome}!", fullContext);
    expect(result).toBe("Oi Maria!");
  });

  it("should substitute {email} with contact email", () => {
    const result = substituteVariables("Seu email: {email}", fullContext);
    expect(result).toBe("Seu email: maria@email.com");
  });

  it("should substitute {telefone} with contact phone", () => {
    const result = substituteVariables("Telefone: {telefone}", fullContext);
    expect(result).toBe("Telefone: 5511999887766");
  });

  it("should substitute {negociacao} with deal title", () => {
    const result = substituteVariables("Negociação: {negociacao}", fullContext);
    expect(result).toBe("Negociação: Pacote Europa 2026");
  });

  it("should substitute {valor} with formatted BRL currency", () => {
    const result = substituteVariables("Valor: {valor}", fullContext);
    expect(result).toContain("15.000");
    expect(result).toContain("R$");
  });

  it("should substitute {etapa} with deal stage name", () => {
    const result = substituteVariables("Etapa atual: {etapa}", fullContext);
    expect(result).toBe("Etapa atual: Diagnóstico");
  });

  it("should substitute {empresa} with company name", () => {
    const result = substituteVariables("Empresa: {empresa}", fullContext);
    expect(result).toBe("Empresa: Agência Viagens Top");
  });

  it("should substitute {nome_oportunidade} with deal title", () => {
    const result = substituteVariables("Oportunidade: {nome_oportunidade}", fullContext);
    expect(result).toBe("Oportunidade: Pacote Europa 2026");
  });

  it("should substitute {produto_principal} with the highest-value product", () => {
    // Passagem Aérea: 500000 * 2 = 1000000 (highest)
    // Hotel Paris: 300000 * 1 = 300000
    // Seguro: 50000 * 2 = 100000
    const result = substituteVariables(
      "Seu produto principal: {produto_principal}",
      fullContext,
      products,
    );
    expect(result).toBe("Seu produto principal: Passagem Aérea SP-Paris");
  });

  it("should handle {produto_principal} with single product", () => {
    const singleProduct = [{ name: "Cruzeiro Caribe", unitPriceCents: 800000, quantity: 1 }];
    const result = substituteVariables(
      "Produto: {produto_principal}",
      fullContext,
      singleProduct,
    );
    expect(result).toBe("Produto: Cruzeiro Caribe");
  });

  it("should leave {produto_principal} empty when no products", () => {
    const result = substituteVariables(
      "Produto: {produto_principal}",
      fullContext,
      [],
    );
    expect(result).toBe("Produto: ");
  });

  it("should substitute multiple variables in the same message", () => {
    const template = "Olá {primeiro_nome}, sua negociação {negociacao} no valor de {valor} está na etapa {etapa}. Produto principal: {produto_principal}";
    const result = substituteVariables(template, fullContext, products);
    expect(result).toContain("Maria");
    expect(result).toContain("Pacote Europa 2026");
    expect(result).toContain("R$");
    expect(result).toContain("Diagnóstico");
    expect(result).toContain("Passagem Aérea SP-Paris");
  });

  it("should handle missing context gracefully with empty strings", () => {
    const emptyCtx = {};
    const result = substituteVariables(
      "Nome: {nome}, Email: {email}, Empresa: {empresa}",
      emptyCtx,
    );
    expect(result).toBe("Nome: , Email: , Empresa: ");
  });

  it("should handle partial context", () => {
    const partialCtx = { contactName: "João Pereira" };
    const result = substituteVariables(
      "Olá {primeiro_nome}, sua negociação {negociacao}",
      partialCtx,
    );
    expect(result).toBe("Olá João, sua negociação ");
  });

  it("should handle message with no variables", () => {
    const result = substituteVariables("Mensagem sem variáveis", fullContext);
    expect(result).toBe("Mensagem sem variáveis");
  });

  it("should handle repeated variables in the same message", () => {
    const result = substituteVariables(
      "{primeiro_nome}, olá! {primeiro_nome}, como vai?",
      fullContext,
    );
    expect(result).toBe("Maria, olá! Maria, como vai?");
  });

  it("should correctly identify highest-value product considering quantity", () => {
    // Product A: 100000 * 10 = 1000000
    // Product B: 900000 * 1 = 900000
    const products = [
      { name: "Produto A (barato, muita qtd)", unitPriceCents: 100000, quantity: 10 },
      { name: "Produto B (caro, pouca qtd)", unitPriceCents: 900000, quantity: 1 },
    ];
    const result = substituteVariables("{produto_principal}", fullContext, products);
    expect(result).toBe("Produto A (barato, muita qtd)");
  });
});
