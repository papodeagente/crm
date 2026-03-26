import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock dependencies ───
// Paths are relative to THIS test file (server/scheduledWhatsApp.test.ts)
// The service at server/services/scheduledWhatsAppService.ts imports from "../db" which resolves to server/db.ts
// vi.mock resolves paths relative to the test file, so "./db" = server/db.ts

let selectResults: any[][] = [];
let selectCallIndex = 0;

function createSelectChain() {
  const chain: any = {
    from: vi.fn((..._a: any[]) => chain),
    where: vi.fn((..._a: any[]) => chain),
    limit: vi.fn((..._a: any[]) => {
      const result = selectResults[selectCallIndex] ?? [];
      selectCallIndex++;
      return Promise.resolve(result);
    }),
  };
  return chain;
}

const mockDbObj = {
  select: vi.fn((..._args: any[]) => createSelectChain()),
  insert: vi.fn((..._args: any[]) => ({
    values: vi.fn((..._a: any[]) => ({
      $returningId: vi.fn(async () => [{ id: 1 }]),
    })),
  })),
  update: vi.fn((..._args: any[]) => ({
    set: vi.fn((..._a: any[]) => ({
      where: vi.fn(async () => undefined),
    })),
  })),
  execute: vi.fn(async () => [{ affectedRows: 0 }]),
};

vi.mock("./db", () => ({
  getDb: vi.fn(async () => mockDbObj),
  assignConversation: vi.fn(async () => ({ success: true })),
}));

vi.mock("./conversationResolver", () => ({
  resolveConversation: vi.fn(async () => ({ conversationId: 100 })),
}));

vi.mock("./bulkMessage", () => ({
  getActiveSessionForTenant: vi.fn(async () => ({ sessionId: "sess-1", status: "connected" })),
}));

vi.mock("./whatsapp", () => ({
  whatsappManager: {
    sendTextMessage: vi.fn(async () => ({ key: { id: "msg-123" } })),
    getSession: vi.fn(),
  },
}));

vi.mock("./whatsappEvolution", () => ({
  whatsappManager: {
    sendTextMessage: vi.fn(async () => ({ key: { id: "msg-456" } })),
    getSession: vi.fn(() => ({ status: "connected" })),
  },
}));

import {
  createScheduledWhatsApp,
  cancelScheduledWhatsApp,
  rescheduleWhatsApp,
  retryScheduledWhatsApp,
  processScheduledWhatsAppTasks,
  startScheduledWhatsAppWorker,
  stopScheduledWhatsAppWorker,
} from "./services/scheduledWhatsAppService";

describe("scheduledWhatsAppService", () => {
  beforeEach(() => {
    selectResults = [];
    selectCallIndex = 0;
  });

  describe("createScheduledWhatsApp", () => {
    it("should create a scheduled task when contact has valid phone", async () => {
      selectResults = [[{
        id: 10, phone: "+5511999998888", phoneE164: "+5511999998888", name: "João Silva",
      }]];

      const result = await createScheduledWhatsApp({
        tenantId: 1, entityType: "deal", entityId: 5, contactId: 10, dealId: 5,
        messageBody: "Olá, tudo bem?", scheduledAt: "2026-03-26T15:00:00",
        timezone: "America/Sao_Paulo", createdByUserId: 2,
      });

      expect(result).toEqual({ id: 1, waStatus: "scheduled" });
    });

    it("should throw error when contact not found", async () => {
      selectResults = [[]];

      await expect(createScheduledWhatsApp({
        tenantId: 1, entityType: "deal", entityId: 5, contactId: 999,
        messageBody: "Test", scheduledAt: "2026-03-26T15:00:00",
        timezone: "America/Sao_Paulo", createdByUserId: 2,
      })).rejects.toThrow("Contato não encontrado neste tenant");
    });

    it("should throw error when contact has no phone", async () => {
      selectResults = [[{
        id: 10, phone: null, phoneE164: null, name: "Sem Telefone",
      }]];

      await expect(createScheduledWhatsApp({
        tenantId: 1, entityType: "deal", entityId: 5, contactId: 10,
        messageBody: "Test", scheduledAt: "2026-03-26T15:00:00",
        timezone: "America/Sao_Paulo", createdByUserId: 2,
      })).rejects.toThrow("Contato não possui telefone válido");
    });

    it("should throw error when message is empty", async () => {
      selectResults = [[{
        id: 10, phone: "+5511999998888", phoneE164: "+5511999998888", name: "Test",
      }]];

      await expect(createScheduledWhatsApp({
        tenantId: 1, entityType: "deal", entityId: 5, contactId: 10,
        messageBody: "   ", scheduledAt: "2026-03-26T15:00:00",
        timezone: "America/Sao_Paulo", createdByUserId: 2,
      })).rejects.toThrow("Mensagem não pode estar vazia");
    });

    it("should throw error for invalid scheduled date", async () => {
      selectResults = [[{
        id: 10, phone: "+5511999998888", phoneE164: "+5511999998888", name: "Test",
      }]];

      await expect(createScheduledWhatsApp({
        tenantId: 1, entityType: "deal", entityId: 5, contactId: 10,
        messageBody: "Hello", scheduledAt: "invalid-date",
        timezone: "America/Sao_Paulo", createdByUserId: 2,
      })).rejects.toThrow("Data de agendamento inválida");
    });

    it("should convert phone without country code to JID", async () => {
      selectResults = [[{
        id: 10, phone: "11999998888", phoneE164: null, name: "Test",
      }]];

      const result = await createScheduledWhatsApp({
        tenantId: 1, entityType: "deal", entityId: 5, contactId: 10,
        messageBody: "Hello", scheduledAt: "2026-03-26T15:00:00",
        timezone: "America/Sao_Paulo", createdByUserId: 2,
      });
      expect(result.waStatus).toBe("scheduled");
    });

    it("should reject phone with too few digits", async () => {
      selectResults = [[{
        id: 10, phone: "12345", phoneE164: null, name: "Short Phone",
      }]];

      await expect(createScheduledWhatsApp({
        tenantId: 1, entityType: "deal", entityId: 5, contactId: 10,
        messageBody: "Hello", scheduledAt: "2026-03-26T15:00:00",
        timezone: "America/Sao_Paulo", createdByUserId: 2,
      })).rejects.toThrow("não é válido para WhatsApp");
    });
  });

  describe("cancelScheduledWhatsApp", () => {
    it("should cancel a scheduled task", async () => {
      selectResults = [[{
        id: 1, tenantId: 1, taskType: "whatsapp_scheduled_send",
        waStatus: "scheduled", entityType: "deal", entityId: 5, title: "Test WA",
      }]];

      const result = await cancelScheduledWhatsApp(1, 1, 2);
      expect(result).toEqual({ success: true });
    });

    it("should throw error when task not found", async () => {
      selectResults = [[]];
      await expect(cancelScheduledWhatsApp(999, 1, 2)).rejects.toThrow("Tarefa não encontrada");
    });

    it("should throw error when task already sent", async () => {
      selectResults = [[{
        id: 1, tenantId: 1, taskType: "whatsapp_scheduled_send",
        waStatus: "sent", entityType: "deal", entityId: 5,
      }]];
      await expect(cancelScheduledWhatsApp(1, 1, 2)).rejects.toThrow("já foi enviada");
    });

    it("should throw error when task is processing", async () => {
      selectResults = [[{
        id: 1, tenantId: 1, taskType: "whatsapp_scheduled_send",
        waStatus: "processing", entityType: "deal", entityId: 5,
      }]];
      await expect(cancelScheduledWhatsApp(1, 1, 2)).rejects.toThrow("está sendo processada");
    });

    it("should throw error when task already cancelled", async () => {
      selectResults = [[{
        id: 1, tenantId: 1, taskType: "whatsapp_scheduled_send",
        waStatus: "cancelled", entityType: "deal", entityId: 5,
      }]];
      await expect(cancelScheduledWhatsApp(1, 1, 2)).rejects.toThrow("já está cancelada");
    });
  });

  describe("rescheduleWhatsApp", () => {
    it("should reschedule a task with new date", async () => {
      selectResults = [[{
        id: 1, tenantId: 1, taskType: "whatsapp_scheduled_send",
        waStatus: "scheduled", entityType: "deal", entityId: 5,
        waTimezone: "America/Sao_Paulo",
      }]];

      const result = await rescheduleWhatsApp({ taskId: 1, tenantId: 1, scheduledAt: "2026-03-27T10:00:00" }, 2);
      expect(result).toEqual({ success: true });
    });

    it("should throw error when task already sent", async () => {
      selectResults = [[{
        id: 1, tenantId: 1, taskType: "whatsapp_scheduled_send",
        waStatus: "sent", entityType: "deal", entityId: 5,
      }]];
      await expect(rescheduleWhatsApp({ taskId: 1, tenantId: 1, scheduledAt: "2026-03-27T10:00:00" }, 2)).rejects.toThrow("já foi enviada");
    });

    it("should throw error for invalid date", async () => {
      selectResults = [[{
        id: 1, tenantId: 1, taskType: "whatsapp_scheduled_send",
        waStatus: "scheduled", entityType: "deal", entityId: 5,
      }]];
      await expect(rescheduleWhatsApp({ taskId: 1, tenantId: 1, scheduledAt: "invalid" }, 2)).rejects.toThrow("Data inválida");
    });
  });

  describe("retryScheduledWhatsApp", () => {
    it("should retry a failed task", async () => {
      selectResults = [[{
        id: 1, tenantId: 1, taskType: "whatsapp_scheduled_send",
        waStatus: "failed", entityType: "deal", entityId: 5,
      }]];

      const result = await retryScheduledWhatsApp(1, 1, 2);
      expect(result).toEqual({ success: true });
    });

    it("should throw error when task is not failed", async () => {
      selectResults = [[{
        id: 1, tenantId: 1, taskType: "whatsapp_scheduled_send",
        waStatus: "scheduled", entityType: "deal", entityId: 5,
      }]];
      await expect(retryScheduledWhatsApp(1, 1, 2)).rejects.toThrow("Apenas tarefas com falha");
    });
  });

  describe("processScheduledWhatsAppTasks", () => {
    it("should return zero counts when no tasks are due", async () => {
      mockDbObj.execute.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await processScheduledWhatsAppTasks();
      expect(result).toEqual({ processed: 0, sent: 0, failed: 0 });
    });
  });

  describe("worker lifecycle", () => {
    it("should start and stop the worker without errors", () => {
      startScheduledWhatsAppWorker();
      stopScheduledWhatsAppWorker();
    });
  });
});
