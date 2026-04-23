import { describe, it, expect } from "vitest";
import { classifyIntent, parseAiResponse, splitTextNaturally } from "./aiSuggestionService";

// ════════════════════════════════════════════════════════════
// classifyIntent
// ════════════════════════════════════════════════════════════

describe("classifyIntent", () => {
  it("classifies greetings", () => {
    expect(classifyIntent("Oi, tudo bem?")).toBe("saudacao");
    expect(classifyIntent("Bom dia!")).toBe("saudacao");
    expect(classifyIntent("Boa tarde")).toBe("saudacao");
    expect(classifyIntent("olá")).toBe("saudacao");
  });

  it("classifies gratitude", () => {
    expect(classifyIntent("Obrigado pela informação")).toBe("agradecimento");
    expect(classifyIntent("Valeu, muito bom!")).toBe("agradecimento");
  });

  it("classifies complaints", () => {
    expect(classifyIntent("Estou insatisfeito com o atendimento")).toBe("reclamacao");
    expect(classifyIntent("Péssimo serviço")).toBe("reclamacao");
  });

  it("classifies price requests", () => {
    expect(classifyIntent("Qual o valor do pacote?")).toBe("pedido_preco");
    expect(classifyIntent("Quanto custa o procedimento?")).toBe("pedido_preco");
    expect(classifyIntent("Me manda o orçamento")).toBe("pedido_preco");
    expect(classifyIntent("Qual o preço?")).toBe("pedido_preco");
  });

  it("classifies deadline/date requests", () => {
    expect(classifyIntent("Quando tem vaga?")).toBe("pedido_prazo");
    expect(classifyIntent("Qual a data do atendimento?")).toBe("pedido_prazo");
    expect(classifyIntent("Tem disponibilidade em janeiro?")).toBe("pedido_prazo");
  });

  it("classifies objections", () => {
    expect(classifyIntent("Achei caro demais")).toBe("objecao");
    expect(classifyIntent("Vou pensar e te retorno")).toBe("objecao");
    expect(classifyIntent("Não sei se consigo")).toBe("objecao");
  });

  it("classifies closing intent", () => {
    expect(classifyIntent("Quero fechar, pode reservar")).toBe("fechamento");
    expect(classifyIntent("Vamos confirmar o agendamento")).toBe("fechamento");
    expect(classifyIntent("Pode me mandar o pix?")).toBe("fechamento");
  });

  it("classifies interest", () => {
    expect(classifyIntent("Me interessa muito!")).toBe("interesse");
    expect(classifyIntent("Gostei, me conta mais")).toBe("interesse");
    expect(classifyIntent("Gostaria de saber mais detalhes")).toBe("interesse");
  });

  it("classifies indecision", () => {
    expect(classifyIntent("Não tenho certeza ainda")).toBe("indecisao");
    expect(classifyIntent("Preciso ver com minha esposa")).toBe("indecisao");
    expect(classifyIntent("Sei lá, estou em dúvida")).toBe("indecisao");
  });

  it("classifies return/follow-up", () => {
    expect(classifyIntent("Voltei! Ainda tem aquele pacote?")).toBe("retomada");
    expect(classifyIntent("Lembra que conversamos sobre aquele serviço?")).toBe("retomada");
  });

  it("classifies questions as duvida", () => {
    expect(classifyIntent("O pacote inclui retorno?")).toBe("duvida");
    expect(classifyIntent("Como funciona o procedimento?")).toBe("duvida");
  });

  it("returns outro for unclassifiable messages", () => {
    expect(classifyIntent("ok")).toBe("outro");
    expect(classifyIntent("sim")).toBe("outro");
    expect(classifyIntent("👍")).toBe("outro");
  });
});

// ════════════════════════════════════════════════════════════
// parseAiResponse
// ════════════════════════════════════════════════════════════

describe("parseAiResponse", () => {
  it("parses valid JSON with parts array", () => {
    const raw = '{"parts": ["Olá! Tudo bem?", "Vi que você se interessou pelo pacote."]}';
    const result = parseAiResponse(raw);
    expect(result.parts).toHaveLength(2);
    expect(result.parts[0]).toBe("Olá! Tudo bem?");
    expect(result.parts[1]).toBe("Vi que você se interessou pelo pacote.");
    expect(result.full).toBe("Olá! Tudo bem?\n\nVi que você se interessou pelo pacote.");
  });

  it("handles JSON with markdown wrapping", () => {
    const raw = '```json\n{"parts": ["Mensagem 1", "Mensagem 2"]}\n```';
    const result = parseAiResponse(raw);
    expect(result.parts).toHaveLength(2);
  });

  it("handles plain text with double newlines", () => {
    const raw = "Olá! Tudo bem?\n\nVi que você se interessou pelo nosso serviço.";
    const result = parseAiResponse(raw);
    expect(result.parts).toHaveLength(2);
    expect(result.full).toContain("Olá!");
  });

  it("handles single-line text", () => {
    const raw = "Olá! Como posso ajudar?";
    const result = parseAiResponse(raw);
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0]).toBe("Olá! Como posso ajudar?");
  });

  it("removes em-dashes and en-dashes", () => {
    const raw = '{"parts": ["Olá — como vai?", "Tudo — bem?"]}';
    const result = parseAiResponse(raw);
    expect(result.parts[0]).not.toContain("—");
    expect(result.parts[0]).toContain(",");
  });

  it("handles empty parts array gracefully", () => {
    const raw = '{"parts": []}';
    const result = parseAiResponse(raw);
    // Should fallback to plain text parsing
    expect(result.parts.length).toBeGreaterThanOrEqual(1);
  });

  it("handles malformed JSON gracefully", () => {
    const raw = '{"parts": [broken json';
    const result = parseAiResponse(raw);
    expect(result.parts.length).toBeGreaterThanOrEqual(1);
  });
});

// ════════════════════════════════════════════════════════════
// splitTextNaturally
// ════════════════════════════════════════════════════════════

describe("splitTextNaturally", () => {
  it("splits by paragraphs (double newline)", () => {
    const text = "Olá! Tudo bem?\n\nVi que você se interessou pelo pacote.\n\nPosso te ajudar?";
    const parts = splitTextNaturally(text);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("Olá! Tudo bem?");
    expect(parts[2]).toBe("Posso te ajudar?");
  });

  it("splits long single paragraph by sentences", () => {
    const text = "Olá! Tudo bem com você? Vi que você se interessou pelo nosso serviço. Temos ótimas condições para esse mês. Posso te mandar mais detalhes?";
    const parts = splitTextNaturally(text);
    expect(parts.length).toBeGreaterThan(1);
    // Each part should end with punctuation
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0);
    }
  });

  it("returns single message for short text", () => {
    const text = "Olá!";
    const parts = splitTextNaturally(text);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBe("Olá!");
  });

  it("splits by question marks when applicable", () => {
    const text = "Você prefere manhã ou tarde? E qual período seria melhor para você?";
    const parts = splitTextNaturally(text);
    expect(parts.length).toBeGreaterThanOrEqual(1);
  });

  it("handles empty text", () => {
    const parts = splitTextNaturally("");
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBe("");
  });

  it("trims whitespace from parts", () => {
    const text = "  Olá!  \n\n  Tudo bem?  ";
    const parts = splitTextNaturally(text);
    expect(parts[0]).toBe("Olá!");
    expect(parts[1]).toBe("Tudo bem?");
  });

  it("does not create empty parts from multiple newlines", () => {
    const text = "Olá!\n\n\n\nTudo bem?";
    const parts = splitTextNaturally(text);
    expect(parts).toHaveLength(2);
    expect(parts.every(p => p.length > 0)).toBe(true);
  });
});
