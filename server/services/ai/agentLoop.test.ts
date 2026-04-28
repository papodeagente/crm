import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock invokeLLM and tools BEFORE importing agentLoop
vi.mock("../../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./agentTools", () => ({
  ALL_TOOLS: {
    handoff: {
      name: "handoff",
      manifest: { type: "function", function: { name: "handoff" } },
      execute: vi.fn(async () => ({ ok: true, data: { assignedUserId: 99, reason: "test" } })),
    },
    lookup_crm: {
      name: "lookup_crm",
      manifest: { type: "function", function: { name: "lookup_crm" } },
      execute: vi.fn(async () => ({ ok: true, data: { contact: null, deals: [], conversationSummary: "" } })),
    },
    qualify: {
      name: "qualify",
      manifest: { type: "function", function: { name: "qualify" } },
      execute: vi.fn(async () => ({ ok: true, data: { stored: { destino: "X" } } })),
    },
    deal: {
      name: "deal",
      manifest: { type: "function", function: { name: "deal" } },
      execute: vi.fn(async () => ({ ok: true, data: { dealId: 42, action: "create" } })),
    },
  },
  filterTools: (allowed: string[]) => allowed.map(n => ({
    name: n,
    manifest: { type: "function", function: { name: n } },
  })),
}));

import { runAgent } from "./agentLoop";
import { invokeLLM } from "../../_core/llm";
import { ALL_TOOLS } from "./agentTools";

const baseAgent = {
  id: 1,
  systemPrompt: null,
  model: null,
  temperature: 0.5,
  maxTokens: 500,
  maxTurns: 4,
  toolsAllowed: ["lookup_crm", "qualify", "deal", "handoff"],
  escalateConfidenceBelow: 0.6,
};

const baseCtx = {
  tenantId: 1,
  sessionId: "s1",
  remoteJid: "123@s.whatsapp.net",
  agentId: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("agentLoop", () => {
  it("happy path: 1 turn, no tools, returns reply", async () => {
    (invokeLLM as any).mockResolvedValueOnce({
      choices: [{ message: { role: "assistant", content: "Olá! Como posso ajudar?" }, finish_reason: "stop", index: 0 }],
      usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
    });

    const out = await runAgent({
      agent: baseAgent,
      history: [],
      triggerMessage: "Oi",
      ctx: baseCtx,
    });

    expect(out.outcome).toBe("replied");
    expect(out.replyText).toBe("Olá! Como posso ajudar?");
    expect(out.toolCalls).toEqual([]);
  });

  it("tool call followed by reply", async () => {
    (invokeLLM as any)
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: "assistant",
            content: "",
            tool_calls: [{
              id: "tc1",
              type: "function",
              function: { name: "lookup_crm", arguments: "{}" },
            }],
          },
          finish_reason: "tool_calls",
          index: 0,
        }],
        usage: { prompt_tokens: 30, completion_tokens: 5, total_tokens: 35 },
      })
      .mockResolvedValueOnce({
        choices: [{ message: { role: "assistant", content: "Olá novamente!" }, finish_reason: "stop", index: 0 }],
        usage: { prompt_tokens: 60, completion_tokens: 5, total_tokens: 65 },
      });

    const out = await runAgent({
      agent: baseAgent,
      history: [],
      triggerMessage: "Oi",
      ctx: baseCtx,
    });

    expect(out.outcome).toBe("replied");
    expect(out.replyText).toBe("Olá novamente!");
    expect(out.toolCalls.length).toBe(1);
    expect(out.toolCalls[0].tool).toBe("lookup_crm");
  });

  it("explicit handoff terminates loop", async () => {
    (invokeLLM as any).mockResolvedValueOnce({
      choices: [{
        message: {
          role: "assistant",
          content: "",
          tool_calls: [{
            id: "tc1",
            type: "function",
            function: { name: "handoff", arguments: JSON.stringify({ reason: "user_request", summary: "Cliente quer humano" }) },
          }],
        },
        finish_reason: "tool_calls",
        index: 0,
      }],
      usage: { prompt_tokens: 30, completion_tokens: 5, total_tokens: 35 },
    });

    const out = await runAgent({
      agent: baseAgent,
      history: [],
      triggerMessage: "Quero falar com humano",
      ctx: baseCtx,
    });

    expect(out.outcome).toBe("handed_off");
    expect(out.toolCalls.length).toBe(1);
    expect(out.toolCalls[0].tool).toBe("handoff");
    expect(invokeLLM).toHaveBeenCalledTimes(1);
  });

  it("auto-handoff on low-confidence phrase", async () => {
    (invokeLLM as any).mockResolvedValueOnce({
      choices: [{
        message: { role: "assistant", content: "Hmm, não tenho certeza sobre isso." },
        finish_reason: "stop",
        index: 0,
      }],
      usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
    });

    const out = await runAgent({
      agent: baseAgent,
      history: [],
      triggerMessage: "Como funciona o seguro?",
      ctx: baseCtx,
    });

    expect(out.outcome).toBe("handed_off");
    expect(ALL_TOOLS.handoff.execute).toHaveBeenCalled();
    expect((out.toolCalls.at(-1) as any).tool).toBe("handoff");
  });

  it("max turns hit → defensive handoff", async () => {
    // Always return tool call in a loop
    (invokeLLM as any).mockResolvedValue({
      choices: [{
        message: {
          role: "assistant",
          content: "",
          tool_calls: [{ id: "tc", type: "function", function: { name: "lookup_crm", arguments: "{}" } }],
        },
        finish_reason: "tool_calls",
        index: 0,
      }],
      usage: { prompt_tokens: 30, completion_tokens: 5, total_tokens: 35 },
    });

    const out = await runAgent({
      agent: { ...baseAgent, maxTurns: 2 },
      history: [],
      triggerMessage: "loop",
      ctx: baseCtx,
    });

    expect(out.outcome).toBe("handed_off");
    expect(invokeLLM).toHaveBeenCalledTimes(2);
  });

  it("LLM error → outcome=errored", async () => {
    (invokeLLM as any).mockRejectedValueOnce(new Error("connection refused"));
    const out = await runAgent({
      agent: baseAgent,
      history: [],
      triggerMessage: "Oi",
      ctx: baseCtx,
    });
    expect(out.outcome).toBe("errored");
    expect(out.errorMessage).toContain("connection refused");
  });
});
