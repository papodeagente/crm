/**
 * Common types and helpers for agent tools.
 *
 * Each tool is a small, validated function. The agent loop discovers tools via
 * a manifest (name, description, JSON schema for params) and dispatches to the
 * concrete implementation here.
 */

import type { Tool } from "../../../_core/llm";

export type ToolContext = {
  tenantId: number;
  sessionId: string;
  remoteJid: string;
  agentId: number;
  conversationStateId?: number;
  userId?: number; // crm_users.id (nullable for fully autonomous runs)
};

export type ToolResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ToolDescriptor = {
  name: string;
  manifest: Tool;
  execute: (input: unknown, ctx: ToolContext) => Promise<ToolResult>;
};
