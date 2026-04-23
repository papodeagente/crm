import { describe, it, expect } from "vitest";

/**
 * Tests for the message tag resolver logic.
 * Validates that {produto_principal} and other tags are correctly resolved.
 */

// Simulate the interpolateDealMessage function
interface DealMessageContext {
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  dealTitle?: string | null;
  dealValueCents?: number | null;
  stageName?: string | null;
  companyName?: string | null;
  mainProductName?: string | null;
}

function interpolateDealMessage(template: string, ctx: DealMessageContext): string {
  const name = ctx.contactName || "";
  const firstName = name.split(" ")[0] || "";
  const valor = ctx.dealValueCents
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ctx.dealValueCents / 100)
    : "";

  return template
    .replace(/\{nome\}/gi, name)
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{email\}/gi, ctx.contactEmail || "")
    .replace(/\{telefone\}/gi, ctx.contactPhone || "")
    .replace(/\{negociacao\}/gi, ctx.dealTitle || "")
    .replace(/\{nome_oportunidade\}/gi, ctx.dealTitle || "")
    .replace(/\{valor\}/gi, valor)
    .replace(/\{etapa\}/gi, ctx.stageName || "")
    .replace(/\{empresa\}/gi, ctx.companyName || "")
    .replace(/\{produto_principal\}/gi, ctx.mainProductName || "");
}

// Simulate getMainProductName logic
function findMainProduct(products: Array<{ name: string; finalPriceCents: number | null; unitPriceCents: number | null }>): string | null {
  if (products.length === 0) return null;
  if (products.length === 1) return products[0].name;

  let best = products[0];
  for (const p of products) {
    const pValue = (p.finalPriceCents ?? 0) || (p.unitPriceCents ?? 0);
    const bestValue = (best.finalPriceCents ?? 0) || (best.unitPriceCents ?? 0);
    if (pValue > bestValue) best = p;
  }
  return best.name;
}

// Simulate frontend substituteVariables logic
function substituteVariables(
  content: string,
  ctx: { contactName?: string | null; dealTitle?: string | null; dealValueCents?: number | null; dealStageName?: string | null; companyName?: string | null; contactEmail?: string | null; contactPhone?: string | null },
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

// Simulate interpolateCrmTemplate (bulk send)
function interpolateCrmTemplate(template: string, data: {
  name: string;
  email: string | null;
  phone: string | null;
  dealTitle?: string | null;
  dealValue?: number | null;
  stage?: string | null;
  company?: string | null;
  mainProductName?: string | null;
}): string {
  const firstName = data.name.split(" ")[0];
  const valor = data.dealValue
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.dealValue / 100)
    : "";

  return template
    .replace(/\{nome\}/gi, data.name)
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{email\}/gi, data.email || "")
    .replace(/\{telefone\}/gi, data.phone || "")
    .replace(/\{negociacao\}/gi, data.dealTitle || "")
    .replace(/\{nome_oportunidade\}/gi, data.dealTitle || "")
    .replace(/\{valor\}/gi, valor)
    .replace(/\{etapa\}/gi, data.stage || "")
    .replace(/\{empresa\}/gi, data.company || "")
    .replace(/\{produto_principal\}/gi, data.mainProductName || "");
}

describe("MessageTagResolver", () => {
  describe("interpolateDealMessage - {produto_principal}", () => {
    it("should replace {produto_principal} with the main product name", () => {
      const result = interpolateDealMessage(
        "Olá {primeiro_nome}, seu produto principal é {produto_principal}",
        {
          contactName: "João Silva",
          mainProductName: "Limpeza de Pele",
        }
      );
      expect(result).toBe("Olá João, seu produto principal é Limpeza de Pele");
    });

    it("should replace {produto_principal} with empty string when no product", () => {
      const result = interpolateDealMessage(
        "Produto: {produto_principal}",
        {
          contactName: "Maria",
          mainProductName: null,
        }
      );
      expect(result).toBe("Produto: ");
    });

    it("should replace {produto_principal} case-insensitively", () => {
      const result = interpolateDealMessage(
        "{PRODUTO_PRINCIPAL} - {Produto_Principal}",
        { mainProductName: "Botox" }
      );
      expect(result).toBe("Botox - Botox");
    });

    it("should resolve all tags including produto_principal", () => {
      const result = interpolateDealMessage(
        "Olá {nome}, negociação {negociacao} com produto {produto_principal} no valor de {valor}",
        {
          contactName: "Ana Costa",
          dealTitle: "Pacote Premium",
          dealValueCents: 359000,
          mainProductName: "Limpeza de Pele",
        }
      );
      expect(result).toContain("Ana Costa");
      expect(result).toContain("Pacote Premium");
      expect(result).toContain("Limpeza de Pele");
      expect(result).toContain("R$");
    });
  });

  describe("findMainProduct - product selection logic", () => {
    it("should return null for empty products", () => {
      expect(findMainProduct([])).toBeNull();
    });

    it("should return the only product when there's just one", () => {
      expect(findMainProduct([
        { name: "Limpeza de Pele", finalPriceCents: 3590000, unitPriceCents: 3590000 },
      ])).toBe("Limpeza de Pele");
    });

    it("should return the product with highest finalPriceCents", () => {
      expect(findMainProduct([
        { name: "Pacote Premium", finalPriceCents: 1210375, unitPriceCents: 2500 },
        { name: "Comissão", finalPriceCents: 100000, unitPriceCents: 100000 },
        { name: "Taxas", finalPriceCents: 53360, unitPriceCents: 53360 },
      ])).toBe("Pacote Premium");
    });

    it("should fallback to unitPriceCents when finalPriceCents is null", () => {
      expect(findMainProduct([
        { name: "Produto A", finalPriceCents: null, unitPriceCents: 500000 },
        { name: "Produto B", finalPriceCents: null, unitPriceCents: 100000 },
      ])).toBe("Produto A");
    });

    it("should handle mixed null and non-null finalPriceCents", () => {
      expect(findMainProduct([
        { name: "Produto A", finalPriceCents: null, unitPriceCents: 500000 },
        { name: "Produto B", finalPriceCents: 600000, unitPriceCents: 100000 },
      ])).toBe("Produto B");
    });
  });

  describe("substituteVariables (frontend) - {produto_principal}", () => {
    it("should resolve {produto_principal} from products array", () => {
      const result = substituteVariables(
        "Produto: {produto_principal}",
        { contactName: "João" },
        [
          { name: "Limpeza de Pele", unitPriceCents: 3590000, quantity: 1 },
          { name: "Hidratação Capilar", unitPriceCents: 50000, quantity: 1 },
        ]
      );
      expect(result).toBe("Produto: Limpeza de Pele");
    });

    it("should select product with highest total value (unitPrice * quantity)", () => {
      const result = substituteVariables(
        "{produto_principal}",
        {},
        [
          { name: "Sessão Laser", unitPriceCents: 2500, quantity: 484 },
          { name: "Consulta", unitPriceCents: 500000, quantity: 1 },
        ]
      );
      // Sessão Laser: 2500 * 484 = 1,210,000 > Consulta: 500,000 * 1 = 500,000
      expect(result).toBe("Sessão Laser");
    });

    it("should return empty string when no products", () => {
      const result = substituteVariables(
        "Produto: {produto_principal}",
        {},
        []
      );
      expect(result).toBe("Produto: ");
    });

    it("should return empty string when products is undefined", () => {
      const result = substituteVariables(
        "Produto: {produto_principal}",
        {},
        undefined
      );
      expect(result).toBe("Produto: ");
    });
  });

  describe("interpolateCrmTemplate (bulk send) - {produto_principal}", () => {
    it("should replace {produto_principal} with mainProductName", () => {
      const result = interpolateCrmTemplate(
        "Olá {primeiro_nome}, seu produto é {produto_principal}",
        {
          name: "João Silva",
          email: "joao@test.com",
          phone: "+5511999",
          dealTitle: "Pacote Premium",
          dealValue: 3590000,
          stage: "Proposta",
          mainProductName: "Limpeza de Pele",
        }
      );
      expect(result).toBe("Olá João, seu produto é Limpeza de Pele");
    });

    it("should replace {produto_principal} with empty string when mainProductName is null", () => {
      const result = interpolateCrmTemplate(
        "Produto: {produto_principal}",
        {
          name: "Maria",
          email: null,
          phone: null,
          mainProductName: null,
        }
      );
      expect(result).toBe("Produto: ");
    });

    it("should replace {produto_principal} with empty string when mainProductName is undefined", () => {
      const result = interpolateCrmTemplate(
        "Produto: {produto_principal}",
        {
          name: "Maria",
          email: null,
          phone: null,
        }
      );
      expect(result).toBe("Produto: ");
    });
  });
});
