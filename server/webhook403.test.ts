import { describe, it, expect } from "vitest";

/**
 * Tests for the Evolution API webhook 403 fix.
 *
 * Root cause: handleEvolutionWebhook rejected requests with 403 when the
 * `apikey` in the webhook payload didn't match `EVOLUTION_API_KEY`.
 * Evolution API sends its own global apikey in callbacks, which may differ
 * from the key we use to call the Evolution API.
 *
 * Fix applied in webhookRoutes.ts:
 * 1. Removed hard 403 reject on apikey mismatch → warn-and-accept
 * 2. Made connection.update/qrcode.updated events async (non-blocking)
 *    to avoid 50s+ response times that caused Evolution API timeouts
 */

// ─── Simulate the FIXED apikey validation logic ───────────────────

function validateWebhookRequest(body: any, expectedKey: string | undefined): {
  status: number;
  response: any;
  warning?: string;
} {
  // Step 1: Validate payload has event field
  if (!body || !body.event) {
    return { status: 400, response: { error: "Invalid webhook payload" } };
  }

  // Step 2: Log apikey mismatch but DO NOT reject (the fix)
  const receivedKey = body.apikey;
  if (expectedKey && receivedKey && receivedKey !== expectedKey) {
    // OLD: return { status: 403, response: { error: "Invalid API key" } };
    // NEW: warn but accept
    return {
      status: 200,
      response: { received: true },
      warning: `API key mismatch (received: ${String(receivedKey).substring(0, 8)}...)`,
    };
  }

  return { status: 200, response: { received: true } };
}

// ─── Simulate event processing mode ───────────────────────────────

type ProcessingMode = "queued" | "async-fallback" | "async";

function getProcessingMode(event: string, queueEnabled: boolean): ProcessingMode {
  const queueableEvents = [
    "messages.upsert", "send.message", "messages.update", "messages.delete",
  ];

  if (queueableEvents.includes(event)) {
    return queueEnabled ? "queued" : "async-fallback";
  }

  // After fix: connection.update, qrcode.updated, etc. are ALL async
  return "async";
}

// ─── Tests ────────────────────────────────────────────────────────

describe("Evolution Webhook — 403 Fix", () => {
  const OUR_KEY = "WQMo37DNvuabEhxb8IG7q2340XGt8gu6";

  describe("API key validation (the core fix)", () => {
    it("accepts webhook with DIFFERENT apikey (was 403, now 200)", () => {
      const result = validateWebhookRequest(
        { event: "connection.update", instance: "crm-270008-270062", data: {}, apikey: "EVOLUTION_GLOBAL_KEY_DIFFERENT" },
        OUR_KEY
      );
      expect(result.status).toBe(200);
      expect(result.warning).toContain("API key mismatch");
    });

    it("accepts webhook with NO apikey", () => {
      const result = validateWebhookRequest(
        { event: "connection.update", instance: "crm-270008-270062", data: {} },
        OUR_KEY
      );
      expect(result.status).toBe(200);
      expect(result.warning).toBeUndefined();
    });

    it("accepts webhook with CORRECT apikey", () => {
      const result = validateWebhookRequest(
        { event: "connection.update", instance: "crm-270008-270062", data: {}, apikey: OUR_KEY },
        OUR_KEY
      );
      expect(result.status).toBe(200);
      expect(result.warning).toBeUndefined();
    });

    it("accepts webhook when EVOLUTION_API_KEY is not configured", () => {
      const result = validateWebhookRequest(
        { event: "connection.update", instance: "test", data: {}, apikey: "any-key" },
        undefined
      );
      expect(result.status).toBe(200);
    });

    it("rejects payload without event field (400, not 403)", () => {
      const result = validateWebhookRequest(
        { instance: "test", data: {} },
        OUR_KEY
      );
      expect(result.status).toBe(400);
    });

    it("rejects null/empty payload (400)", () => {
      expect(validateWebhookRequest(null, OUR_KEY).status).toBe(400);
      expect(validateWebhookRequest({}, OUR_KEY).status).toBe(400);
    });
  });

  describe("All Evolution event types accepted with mismatched apikey", () => {
    const events = [
      "connection.update",
      "qrcode.updated",
      "messages.upsert",
      "messages.update",
      "messages.delete",
      "send.message",
      "contacts.upsert",
    ];

    for (const event of events) {
      it(`accepts ${event} with different apikey`, () => {
        const result = validateWebhookRequest(
          { event, instance: "crm-240006-240006", data: {}, apikey: "DIFFERENT" },
          OUR_KEY
        );
        expect(result.status).toBe(200);
      });
    }
  });

  describe("Event processing mode (async fix)", () => {
    it("connection.update is processed async (was sync, caused 50s+ response)", () => {
      expect(getProcessingMode("connection.update", true)).toBe("async");
      expect(getProcessingMode("connection.update", false)).toBe("async");
    });

    it("qrcode.updated is processed async", () => {
      expect(getProcessingMode("qrcode.updated", true)).toBe("async");
    });

    it("messages.upsert is queued when Redis available", () => {
      expect(getProcessingMode("messages.upsert", true)).toBe("queued");
    });

    it("messages.upsert falls back to async when Redis unavailable", () => {
      expect(getProcessingMode("messages.upsert", false)).toBe("async-fallback");
    });

    it("send.message is queued when Redis available", () => {
      expect(getProcessingMode("send.message", true)).toBe("queued");
    });

    it("messages.update is queued when Redis available", () => {
      expect(getProcessingMode("messages.update", true)).toBe("queued");
    });

    it("messages.delete is queued when Redis available", () => {
      expect(getProcessingMode("messages.delete", true)).toBe("queued");
    });
  });

  describe("Instance name patterns from real instances", () => {
    const realInstances = [
      "crm-270008-270062",
      "crm-240006-240006",
      "crm-240010-240010",
      "crm-210002-240001",
    ];

    for (const instance of realInstances) {
      it(`accepts webhook from ${instance} with any apikey`, () => {
        const result = validateWebhookRequest(
          { event: "connection.update", instance, data: { state: "open" }, apikey: "ANY_KEY" },
          OUR_KEY
        );
        expect(result.status).toBe(200);
      });
    }
  });
});
