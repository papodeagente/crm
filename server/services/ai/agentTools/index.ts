/**
 * Registry of all agent tools.
 * Add new tools here so the agent loop discovers them.
 */

import { lookupCrmTool } from "./lookupCrm";
import { qualifyTool } from "./qualify";
import { dealTool } from "./deal";
import { handoffTool } from "./handoff";
import type { ToolDescriptor } from "./types";

export const ALL_TOOLS: Record<string, ToolDescriptor> = {
  lookup_crm: lookupCrmTool,
  qualify: qualifyTool,
  deal: dealTool,
  handoff: handoffTool,
};

export type ToolName = keyof typeof ALL_TOOLS;

export function filterTools(allowed: string[]): ToolDescriptor[] {
  return allowed
    .map(name => ALL_TOOLS[name as ToolName])
    .filter((t): t is ToolDescriptor => !!t);
}
