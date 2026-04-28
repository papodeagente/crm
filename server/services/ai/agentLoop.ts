/**
 * Agent loop — multi-turn LLM with tool calls, guardrails, and trace.
 *
 * Caller passes:
 *   - agent config (from DB)
 *   - conversation history (already fetched)
 *   - trigger message (the user's latest input)
 *   - ctx (tenantId, sessionId, remoteJid, agentId, conversationStateId)
 *
 * Returns:
 *   - outcome (replied | handed_off | errored)
 *   - reply text (for "replied")
 *   - full trace (toolCalls, modelMessages, tokens)
 */

import { invokeLLM, type Message, type Tool, type ToolCall } from "../../_core/llm";
import { ALL_TOOLS, filterTools } from "./agentTools";
import type { ToolContext } from "./agentTools/types";
import { runGuardrails } from "./agentGuardrails";

export type AgentLoopInput = {
  agent: {
    id: number;
    systemPrompt: string | null;
    model: string | null;
    temperature: number | string | null;
    maxTokens: number;
    maxTurns: number;
    toolsAllowed: string[];
    escalateConfidenceBelow: number | string | null;
  };
  history: Array<{ role: "user" | "assistant"; content: string }>;
  triggerMessage: string;
  ctx: ToolContext;
};

export type AgentLoopOutput = {
  outcome: "replied" | "handed_off" | "errored";
  replyText?: string;
  toolCalls: Array<{ tool: string; input: unknown; output: unknown; durationMs: number }>;
  modelMessages: Message[];
  inputTokens: number;
  outputTokens: number;
  errorMessage?: string;
};

const DEFAULT_SYSTEM = `Você é um agente de atendimento via WhatsApp. Seja educado, direto e útil.
Regras:
- Use a ferramenta lookup_crm logo no início para entender o histórico do cliente.
- Use qualify para registrar dados que o cliente fornecer (destino, datas, número de pessoas, orçamento, etc.).
- Use deal apenas quando tiver dados suficientes para criar uma negociação.
- Se o cliente pedir falar com humano, ou pedido for fora do seu escopo, use handoff com um summary detalhado.
- Sempre responda em português do Brasil, em tom cordial.
- Se não tiver certeza, prefira fazer handoff em vez de inventar resposta.
- Não peça dados sensíveis (CPF, cartão de crédito, senha).`;

export async function runAgent(input: AgentLoopInput): Promise<AgentLoopOutput> {
  const { agent, history, triggerMessage, ctx } = input;
  const allowedTools = filterTools(agent.toolsAllowed ?? ["lookup_crm", "qualify", "deal", "handoff"]);
  const toolManifests: Tool[] = allowedTools.map(t => t.manifest);

  const messages: Message[] = [
    { role: "system", content: agent.systemPrompt || DEFAULT_SYSTEM },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: "user", content: triggerMessage },
  ];

  const trace: AgentLoopOutput["toolCalls"] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  const escalateBelow = Number(agent.escalateConfidenceBelow ?? 0.6);

  for (let turn = 0; turn < (agent.maxTurns ?? 8); turn++) {
    let llmResp;
    try {
      llmResp = await invokeLLM({
        messages,
        tools: toolManifests.length > 0 ? toolManifests : undefined,
        toolChoice: toolManifests.length > 0 ? "auto" : "none",
        maxTokens: agent.maxTokens,
      });
    } catch (e: any) {
      return {
        outcome: "errored",
        toolCalls: trace,
        modelMessages: messages,
        inputTokens,
        outputTokens,
        errorMessage: `LLM error: ${e?.message ?? "unknown"}`,
      };
    }
    inputTokens += llmResp.usage?.prompt_tokens ?? 0;
    outputTokens += llmResp.usage?.completion_tokens ?? 0;
    const choice = llmResp.choices?.[0];
    const msg = choice?.message;
    if (!msg) {
      return {
        outcome: "errored",
        toolCalls: trace,
        modelMessages: messages,
        inputTokens,
        outputTokens,
        errorMessage: "LLM returned no choice",
      };
    }

    // Persist assistant turn to messages history (for next iteration context)
    messages.push({
      role: "assistant",
      content: typeof msg.content === "string" ? msg.content : "",
      ...(msg.tool_calls ? { tool_calls: msg.tool_calls } as any : {}),
    });

    // Tool calls present → execute each, push tool result, loop again
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const call of msg.tool_calls) {
        const toolDescriptor = ALL_TOOLS[call.function.name as keyof typeof ALL_TOOLS];
        const t0 = Date.now();
        let result: unknown;
        if (!toolDescriptor) {
          result = { ok: false, error: `Tool desconhecida: ${call.function.name}` };
        } else {
          let args: unknown = {};
          try {
            args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          } catch (e: any) {
            args = {};
          }
          try {
            result = await toolDescriptor.execute(args, ctx);
          } catch (e: any) {
            result = { ok: false, error: `Tool erro: ${e?.message ?? "unknown"}` };
          }
        }
        const durationMs = Date.now() - t0;
        trace.push({ tool: call.function.name, input: parseArgsForTrace(call), output: result, durationMs });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        } as any);

        // handoff terminates the loop
        if (call.function.name === "handoff" && (result as any)?.ok) {
          return {
            outcome: "handed_off",
            toolCalls: trace,
            modelMessages: messages,
            inputTokens,
            outputTokens,
          };
        }
      }
      continue; // próxima iteração — LLM vai analisar resultados das tools
    }

    // No tool call → resposta final do agente
    const text = typeof msg.content === "string" ? msg.content : extractText(msg.content);
    const guard = runGuardrails(text, { escalateConfidenceBelow: escalateBelow });
    if (guard.shouldEscalate) {
      // Auto-handoff via tool para preservar contexto/log
      const handoff = ALL_TOOLS.handoff;
      try {
        await handoff.execute(
          { reason: "low_confidence", summary: guard.reason ?? "Confiança baixa" },
          ctx
        );
      } catch {
        /* segue mesmo se handoff falhar — outcome ainda é handed_off */
      }
      trace.push({
        tool: "handoff",
        input: { reason: "low_confidence", auto: true },
        output: { ok: true, data: { auto: true, reason: guard.reason } },
        durationMs: 0,
      });
      return {
        outcome: "handed_off",
        toolCalls: trace,
        modelMessages: messages,
        inputTokens,
        outputTokens,
      };
    }
    return {
      outcome: "replied",
      replyText: guard.cleanText,
      toolCalls: trace,
      modelMessages: messages,
      inputTokens,
      outputTokens,
    };
  }

  // turnos esgotados → handoff defensivo
  try {
    await ALL_TOOLS.handoff.execute(
      { reason: "max_turns", summary: "Loop atingiu o limite de turnos sem chegar a uma resposta." },
      ctx
    );
  } catch {
    /* noop */
  }
  return {
    outcome: "handed_off",
    toolCalls: trace,
    modelMessages: messages,
    inputTokens,
    outputTokens,
  };
}

function parseArgsForTrace(call: ToolCall): unknown {
  try {
    return call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    return call.function.arguments;
  }
}

function extractText(content: unknown): string {
  if (Array.isArray(content)) {
    return content
      .map((p: any) => (typeof p === "string" ? p : p?.text ?? ""))
      .filter(Boolean)
      .join(" ");
  }
  if (typeof content === "string") return content;
  return "";
}
