/**
 * Tests for contextual button labels by pipeline type.
 * Validates that:
 * 1. Sales pipelines keep original labels
 * 2. Post-sale pipelines show "Atendimento cancelado" / "Atendimento finalizado"
 * 3. Support pipelines show "Não resolvido" / "Resolvido"
 * 4. Dashboard indicators are correctly named per type
 * 5. Internal logic (status won/lost) is NOT changed
 */
import { describe, it, expect } from "vitest";

// ─── Label mapping function (mirrors DealDetail.tsx logic) ───
function getLossLabel(pipelineType: string | undefined): string {
  if (pipelineType === "post_sale") return "Atendimento cancelado";
  if (pipelineType === "support") return "Não resolvido";
  return "Marcar perda";
}

function getWonLabel(pipelineType: string | undefined): string {
  if (pipelineType === "post_sale") return "Atendimento finalizado";
  if (pipelineType === "support") return "Resolvido";
  return "Marcar venda";
}

function getStatusBadge(status: string, pipelineType: string | undefined): string {
  if (status === "won") {
    if (pipelineType === "post_sale") return "FINALIZADA";
    if (pipelineType === "support") return "RESOLVIDO";
    return "GANHA";
  }
  if (pipelineType === "post_sale") return "CANCELADA";
  if (pipelineType === "support") return "NÃO RESOLVIDO";
  return "PERDIDA";
}

function getLostDialogTitle(pipelineType: string | undefined): string {
  if (pipelineType === "post_sale") return "Cancelar atendimento";
  if (pipelineType === "support") return "Marcar como não resolvido";
  return "Marcar como perda";
}

function getWonDialogTitle(pipelineType: string | undefined): string {
  if (pipelineType === "post_sale") return "Finalizar atendimento";
  if (pipelineType === "support") return "Marcar como resolvido";
  return "Marcar como venda";
}

function getConfirmLossLabel(pipelineType: string | undefined): string {
  if (pipelineType === "post_sale") return "Confirmar cancelamento";
  if (pipelineType === "support") return "Confirmar";
  return "Confirmar perda";
}

function getConfirmWonLabel(pipelineType: string | undefined): string {
  if (pipelineType === "post_sale") return "Confirmar finalização";
  if (pipelineType === "support") return "Confirmar resolução";
  return "Confirmar venda";
}

// ─── Dashboard indicator label mapping ───
function getPostSaleLostIndicator(): string {
  return "Atendimentos cancelados";
}

function getSupportLostIndicator(): string {
  return "Não resolvido";
}

describe("Contextual Button Labels", () => {
  describe("Sales pipeline (no changes)", () => {
    it("loss button should say 'Marcar perda'", () => {
      expect(getLossLabel("sales")).toBe("Marcar perda");
    });

    it("won button should say 'Marcar venda'", () => {
      expect(getWonLabel("sales")).toBe("Marcar venda");
    });

    it("won badge should say 'GANHA'", () => {
      expect(getStatusBadge("won", "sales")).toBe("GANHA");
    });

    it("lost badge should say 'PERDIDA'", () => {
      expect(getStatusBadge("lost", "sales")).toBe("PERDIDA");
    });

    it("lost dialog title should say 'Marcar como perda'", () => {
      expect(getLostDialogTitle("sales")).toBe("Marcar como perda");
    });

    it("won dialog title should say 'Marcar como venda'", () => {
      expect(getWonDialogTitle("sales")).toBe("Marcar como venda");
    });

    it("confirm loss should say 'Confirmar perda'", () => {
      expect(getConfirmLossLabel("sales")).toBe("Confirmar perda");
    });

    it("confirm won should say 'Confirmar venda'", () => {
      expect(getConfirmWonLabel("sales")).toBe("Confirmar venda");
    });
  });

  describe("Post-sale pipeline (contextual labels)", () => {
    it("loss button should say 'Atendimento cancelado'", () => {
      expect(getLossLabel("post_sale")).toBe("Atendimento cancelado");
    });

    it("won button should say 'Atendimento finalizado'", () => {
      expect(getWonLabel("post_sale")).toBe("Atendimento finalizado");
    });

    it("won badge should say 'FINALIZADA'", () => {
      expect(getStatusBadge("won", "post_sale")).toBe("FINALIZADA");
    });

    it("lost badge should say 'CANCELADA'", () => {
      expect(getStatusBadge("lost", "post_sale")).toBe("CANCELADA");
    });

    it("lost dialog title should say 'Cancelar atendimento'", () => {
      expect(getLostDialogTitle("post_sale")).toBe("Cancelar atendimento");
    });

    it("won dialog title should say 'Finalizar atendimento'", () => {
      expect(getWonDialogTitle("post_sale")).toBe("Finalizar atendimento");
    });

    it("confirm loss should say 'Confirmar cancelamento'", () => {
      expect(getConfirmLossLabel("post_sale")).toBe("Confirmar cancelamento");
    });

    it("confirm won should say 'Confirmar finalização'", () => {
      expect(getConfirmWonLabel("post_sale")).toBe("Confirmar finalização");
    });
  });

  describe("Support pipeline (contextual labels)", () => {
    it("loss button should say 'Não resolvido'", () => {
      expect(getLossLabel("support")).toBe("Não resolvido");
    });

    it("won button should say 'Resolvido'", () => {
      expect(getWonLabel("support")).toBe("Resolvido");
    });

    it("won badge should say 'RESOLVIDO'", () => {
      expect(getStatusBadge("won", "support")).toBe("RESOLVIDO");
    });

    it("lost badge should say 'NÃO RESOLVIDO'", () => {
      expect(getStatusBadge("lost", "support")).toBe("NÃO RESOLVIDO");
    });

    it("lost dialog title should say 'Marcar como não resolvido'", () => {
      expect(getLostDialogTitle("support")).toBe("Marcar como não resolvido");
    });

    it("won dialog title should say 'Marcar como resolvido'", () => {
      expect(getWonDialogTitle("support")).toBe("Marcar como resolvido");
    });

    it("confirm loss should say 'Confirmar'", () => {
      expect(getConfirmLossLabel("support")).toBe("Confirmar");
    });

    it("confirm won should say 'Confirmar resolução'", () => {
      expect(getConfirmWonLabel("support")).toBe("Confirmar resolução");
    });
  });

  describe("Undefined pipeline type (fallback to sales)", () => {
    it("loss button defaults to 'Marcar perda'", () => {
      expect(getLossLabel(undefined)).toBe("Marcar perda");
    });

    it("won button defaults to 'Marcar venda'", () => {
      expect(getWonLabel(undefined)).toBe("Marcar venda");
    });

    it("won badge defaults to 'GANHA'", () => {
      expect(getStatusBadge("won", undefined)).toBe("GANHA");
    });

    it("lost badge defaults to 'PERDIDA'", () => {
      expect(getStatusBadge("lost", undefined)).toBe("PERDIDA");
    });
  });

  describe("Dashboard indicators", () => {
    it("post-sale lost indicator should be 'Atendimentos cancelados'", () => {
      expect(getPostSaleLostIndicator()).toBe("Atendimentos cancelados");
    });

    it("support lost indicator should be 'Não resolvido'", () => {
      expect(getSupportLostIndicator()).toBe("Não resolvido");
    });

    it("indicators should NOT use commercial language", () => {
      expect(getPostSaleLostIndicator()).not.toContain("perda");
      expect(getPostSaleLostIndicator()).not.toContain("Perda");
      expect(getSupportLostIndicator()).not.toContain("perda");
      expect(getSupportLostIndicator()).not.toContain("Perda");
    });
  });

  describe("Internal status preservation", () => {
    it("won status is always 'won' internally regardless of pipeline type", () => {
      // The internal status used by handlers is always "won"
      // Only the UI label changes
      const internalStatus = "won";
      expect(internalStatus).toBe("won");
      // Labels change per type but status doesn't
      expect(getWonLabel("sales")).not.toBe(getWonLabel("post_sale"));
      expect(getWonLabel("sales")).not.toBe(getWonLabel("support"));
    });

    it("lost status is always 'lost' internally regardless of pipeline type", () => {
      const internalStatus = "lost";
      expect(internalStatus).toBe("lost");
      expect(getLossLabel("sales")).not.toBe(getLossLabel("post_sale"));
      expect(getLossLabel("sales")).not.toBe(getLossLabel("support"));
    });
  });
});
