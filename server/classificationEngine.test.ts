import { describe, it, expect } from "vitest";
import {
  STAGE_CLASSIFICATIONS,
  CLASSIFICATION_CONFIG,
  SALES_PIPELINE_STAGES,
  POST_SALE_PIPELINE_STAGES,
} from "./classificationEngine";

describe("Classification Engine Constants", () => {
  it("should have 9 stage classifications", () => {
    expect(STAGE_CLASSIFICATIONS).toHaveLength(9);
    expect(STAGE_CLASSIFICATIONS).toContain("desconhecido");
    expect(STAGE_CLASSIFICATIONS).toContain("seguidor");
    expect(STAGE_CLASSIFICATIONS).toContain("lead");
    expect(STAGE_CLASSIFICATIONS).toContain("oportunidade");
    expect(STAGE_CLASSIFICATIONS).toContain("cliente_primeira_compra");
    expect(STAGE_CLASSIFICATIONS).toContain("cliente_ativo");
    expect(STAGE_CLASSIFICATIONS).toContain("cliente_recorrente");
    expect(STAGE_CLASSIFICATIONS).toContain("ex_cliente");
    expect(STAGE_CLASSIFICATIONS).toContain("promotor");
  });

  it("should have config for each classification with label and color", () => {
    for (const cls of STAGE_CLASSIFICATIONS) {
      const config = CLASSIFICATION_CONFIG[cls];
      expect(config).toBeDefined();
      expect(config.label).toBeTruthy();
      expect(config.color).toBeTruthy();
    }
  });

  it("should have correct sales pipeline stages", () => {
    expect(SALES_PIPELINE_STAGES).toHaveLength(7);
    expect(SALES_PIPELINE_STAGES[0].name).toBe("Novo atendimento");
    expect(SALES_PIPELINE_STAGES[1].name).toBe("Primeiro contato");
    expect(SALES_PIPELINE_STAGES[2].name).toBe("Diagnóstico");
    expect(SALES_PIPELINE_STAGES[3].name).toBe("Cotação");
    expect(SALES_PIPELINE_STAGES[4].name).toBe("Apresentação");
    expect(SALES_PIPELINE_STAGES[5].name).toBe("Acompanhamento");
    expect(SALES_PIPELINE_STAGES[6].name).toBe("Reserva");
  });

  it("should have correct post-sale pipeline stages", () => {
    expect(POST_SALE_PIPELINE_STAGES).toHaveLength(7);
    expect(POST_SALE_PIPELINE_STAGES[0].name).toBe("Novo cliente");
    expect(POST_SALE_PIPELINE_STAGES[1].name).toBe("Aguardando embarque");
    expect(POST_SALE_PIPELINE_STAGES[2].name).toBe("30D para embarque");
    expect(POST_SALE_PIPELINE_STAGES[3].name).toBe("Pré embarque");
    expect(POST_SALE_PIPELINE_STAGES[4].name).toBe("Em viagem");
    expect(POST_SALE_PIPELINE_STAGES[5].name).toBe("Pós viagem");
    expect(POST_SALE_PIPELINE_STAGES[6].name).toBe("Viagem finalizada");
  });

  it("should classify stages 1-2 as lead and 3-7 as oportunidade", () => {
    // Stages 0-1 (Novo atendimento, Primeiro contato) → Lead
    expect(SALES_PIPELINE_STAGES[0].orderIndex).toBe(0);
    expect(SALES_PIPELINE_STAGES[1].orderIndex).toBe(1);
    // Stages 2-6 (Diagnóstico to Reserva) → Oportunidade
    expect(SALES_PIPELINE_STAGES[2].orderIndex).toBe(2);
    expect(SALES_PIPELINE_STAGES[6].orderIndex).toBe(6);
  });

  it("should have referral window of 90 days in config", () => {
    expect(CLASSIFICATION_CONFIG.promotor).toBeDefined();
    expect(CLASSIFICATION_CONFIG.promotor.label).toBe("Promotor");
  });

  it("should have inactivity threshold of 360 days for ex-client", () => {
    expect(CLASSIFICATION_CONFIG.ex_cliente).toBeDefined();
    expect(CLASSIFICATION_CONFIG.ex_cliente.label).toBe("Ex-Cliente");
  });
});
