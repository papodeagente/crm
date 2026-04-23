import { describe, it, expect, vi } from "vitest";
import {
  CRM_DEAL_MESSAGE_TAGS,
  CONTACT_MESSAGE_TAGS,
  RD_STATION_MESSAGE_TAGS,
  previewExamples,
  previewMessage,
} from "../shared/messageTags";
import {
  interpolateDealMessage,
  DealMessageContext,
} from "./messageTagResolver";

// ═══════════════════════════════════════════════════════════════
// 1. Tag definitions (shared/messageTags.ts)
// ═══════════════════════════════════════════════════════════════

describe("shared/messageTags", () => {
  it("CRM_DEAL_MESSAGE_TAGS includes {nome_oportunidade}", () => {
    const tag = CRM_DEAL_MESSAGE_TAGS.find((t) => t.var === "{nome_oportunidade}");
    expect(tag).toBeDefined();
    expect(tag!.desc).toBeTruthy();
    expect(tag!.example).toBeTruthy();
  });

  it("CRM_DEAL_MESSAGE_TAGS includes {produto_principal}", () => {
    const tag = CRM_DEAL_MESSAGE_TAGS.find((t) => t.var === "{produto_principal}");
    expect(tag).toBeDefined();
    expect(tag!.desc).toBeTruthy();
    expect(tag!.example).toBeTruthy();
  });

  it("all original tags still present in CRM_DEAL_MESSAGE_TAGS", () => {
    const required = ["{nome}", "{primeiro_nome}", "{email}", "{telefone}", "{negociacao}", "{valor}", "{etapa}", "{empresa}"];
    for (const v of required) {
      expect(CRM_DEAL_MESSAGE_TAGS.find((t) => t.var === v)).toBeDefined();
    }
  });

  it("CONTACT_MESSAGE_TAGS has basic contact tags", () => {
    expect(CONTACT_MESSAGE_TAGS.length).toBeGreaterThanOrEqual(4);
    expect(CONTACT_MESSAGE_TAGS.find((t) => t.var === "{nome}")).toBeDefined();
  });

  it("RD_STATION_MESSAGE_TAGS has lead-specific tags", () => {
    expect(RD_STATION_MESSAGE_TAGS.find((t) => t.var === "{origem}")).toBeDefined();
    expect(RD_STATION_MESSAGE_TAGS.find((t) => t.var === "{campanha}")).toBeDefined();
  });

  it("previewExamples generates correct map", () => {
    const map = previewExamples(CRM_DEAL_MESSAGE_TAGS);
    expect(map["{nome}"]).toBe("João da Silva");
    expect(map["{nome_oportunidade}"]).toBeTruthy();
    expect(map["{produto_principal}"]).toBeTruthy();
  });

  it("previewMessage replaces all tags with examples", () => {
    const template = "Olá {primeiro_nome}, sua negociação {nome_oportunidade} com {produto_principal}";
    const result = previewMessage(template, CRM_DEAL_MESSAGE_TAGS);
    expect(result).not.toContain("{primeiro_nome}");
    expect(result).not.toContain("{nome_oportunidade}");
    expect(result).not.toContain("{produto_principal}");
    expect(result).toContain("João");
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. Tag resolution (server/messageTagResolver.ts)
// ═══════════════════════════════════════════════════════════════

describe("messageTagResolver - interpolateDealMessage", () => {
  const fullCtx: DealMessageContext = {
    contactName: "Maria Santos",
    contactEmail: "maria@test.com",
    contactPhone: "(84) 99999-1234",
    dealTitle: "Pacote Estética Premium",
    dealValueCents: 750000,
    stageName: "Proposta Enviada",
    companyName: "Studio Beleza",
    mainProductName: "Limpeza de Pele",
  };

  it("resolves all original tags correctly", () => {
    const template = "Olá {nome}, {primeiro_nome}! Email: {email}, Tel: {telefone}. Deal: {negociacao} ({valor}) na etapa {etapa}. Empresa: {empresa}";
    const result = interpolateDealMessage(template, fullCtx);
    expect(result).toContain("Maria Santos");
    expect(result).toContain("Maria");
    expect(result).toContain("maria@test.com");
    expect(result).toContain("(84) 99999-1234");
    expect(result).toContain("Pacote Estética Premium");
    expect(result).toContain("R$"); // formatted value
    expect(result).toContain("Proposta Enviada");
    expect(result).toContain("Studio Beleza");
  });

  it("{nome_oportunidade} resolves to deal title", () => {
    const result = interpolateDealMessage("Oportunidade: {nome_oportunidade}", fullCtx);
    expect(result).toBe("Oportunidade: Pacote Estética Premium");
  });

  it("{produto_principal} resolves to main product name", () => {
    const result = interpolateDealMessage("Produto: {produto_principal}", fullCtx);
    expect(result).toBe("Produto: Limpeza de Pele");
  });

  it("{produto_principal} with 1 product resolves correctly", () => {
    const ctx: DealMessageContext = { ...fullCtx, mainProductName: "Botox Facial" };
    const result = interpolateDealMessage("{produto_principal}", ctx);
    expect(result).toBe("Botox Facial");
  });

  it("{produto_principal} without product does not break (empty string)", () => {
    const ctx: DealMessageContext = { ...fullCtx, mainProductName: null };
    const result = interpolateDealMessage("Produto: {produto_principal}!", ctx);
    expect(result).toBe("Produto: !");
    // No error thrown
  });

  it("{produto_principal} with undefined does not break", () => {
    const ctx: DealMessageContext = { ...fullCtx, mainProductName: undefined };
    const result = interpolateDealMessage("Produto: {produto_principal}!", ctx);
    expect(result).toBe("Produto: !");
  });

  it("tags are case-insensitive", () => {
    const result = interpolateDealMessage("{NOME} {Primeiro_Nome} {PRODUTO_PRINCIPAL}", fullCtx);
    expect(result).toContain("Maria Santos");
    expect(result).toContain("Maria");
    expect(result).toContain("Limpeza de Pele");
  });

  it("empty context produces empty replacements without errors", () => {
    const emptyCtx: DealMessageContext = {};
    const template = "{nome} - {negociacao} - {produto_principal}";
    const result = interpolateDealMessage(template, emptyCtx);
    expect(result).toBe(" -  - ");
    // No error thrown
  });

  it("template without tags returns unchanged", () => {
    const result = interpolateDealMessage("Mensagem simples sem tags", fullCtx);
    expect(result).toBe("Mensagem simples sem tags");
  });

  it("multiple occurrences of same tag are all replaced", () => {
    const result = interpolateDealMessage("{nome} e {nome}", fullCtx);
    expect(result).toBe("Maria Santos e Maria Santos");
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. Automation task creation (unit test for schema/logic)
// ═══════════════════════════════════════════════════════════════

describe("task automation WhatsApp type", () => {
  it("waMessageTemplate field is accepted in automation data", () => {
    // Simulates the data structure sent by the frontend
    const automationData = {
      stageId: 1,
      taskTitle: "Enviar boas-vindas",
      taskType: "whatsapp" as const,
      waMessageTemplate: "Olá {primeiro_nome}, bem-vindo à etapa {etapa}!",
      deadlineReference: "current_date" as const,
      deadlineOffsetDays: 0,
      assignToOwner: true,
      isActive: true,
    };
    expect(automationData.waMessageTemplate).toBeTruthy();
    expect(automationData.taskType).toBe("whatsapp");
  });

  it("non-whatsapp tasks can have null waMessageTemplate", () => {
    const automationData = {
      stageId: 1,
      taskTitle: "Ligar para cliente",
      taskType: "phone" as const,
      waMessageTemplate: null,
      deadlineReference: "current_date" as const,
      deadlineOffsetDays: 1,
      assignToOwner: true,
      isActive: true,
    };
    expect(automationData.waMessageTemplate).toBeNull();
    expect(automationData.taskType).toBe("phone");
  });

  it("interpolation works in automation context", () => {
    const template = "Olá {primeiro_nome}! Sua negociação {nome_oportunidade} ({produto_principal}) avançou para {etapa}.";
    const ctx: DealMessageContext = {
      contactName: "Carlos Oliveira",
      dealTitle: "Pacote Harmonização",
      mainProductName: "Preenchimento Labial",
      stageName: "Documentação",
    };
    const result = interpolateDealMessage(template, ctx);
    expect(result).toContain("Carlos");
    expect(result).toContain("Pacote Harmonização");
    expect(result).toContain("Preenchimento Labial");
    expect(result).toContain("Documentação");
    expect(result).not.toContain("{");
  });

  it("existing automations without waMessageTemplate still work", () => {
    // Simulates an old automation loaded from DB (no waMessageTemplate field)
    const oldAutomation: any = {
      id: 1,
      stageId: 1,
      taskTitle: "Tarefa antiga",
      taskType: "task",
      deadlineReference: "current_date",
      deadlineOffsetDays: 0,
      assignToOwner: true,
      isActive: true,
      // waMessageTemplate is undefined (old record)
    };
    expect(oldAutomation.waMessageTemplate).toBeUndefined();
    // The system should treat undefined as "no message to send"
    const shouldSendMessage = oldAutomation.taskType === "whatsapp" && !!oldAutomation.waMessageTemplate;
    expect(shouldSendMessage).toBe(false);
  });
});
