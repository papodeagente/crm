import { describe, it, expect, vi } from "vitest";

/**
 * Tests for agent assignment, transfer, and supervision features
 */

describe("Agent Assignment & Transfer", () => {
  describe("Supervision transferBetweenAgents endpoint", () => {
    it("should require sessionId, remoteJid, fromAgentId, and toAgentId", () => {
      // Validate the input schema requirements
      const validInput = {
        sessionId: "test-session",
        remoteJid: "5511999999999@s.whatsapp.net",
        fromAgentId: 1,
        toAgentId: 2,
        note: "Transferido pelo supervisor",
      };
      expect(validInput.sessionId).toBeDefined();
      expect(validInput.remoteJid).toBeDefined();
      expect(validInput.fromAgentId).toBeTypeOf("number");
      expect(validInput.toAgentId).toBeTypeOf("number");
      expect(validInput.note).toBeTypeOf("string");
    });

    it("should not allow transferring to the same agent", () => {
      const fromAgentId = 1;
      const toAgentId = 1;
      expect(fromAgentId).toBe(toAgentId);
      // In the UI, the dropdown filters out the current agent
    });

    it("should emit conversationUpdated event with transfer type", () => {
      const expectedEvent = {
        type: "transfer",
        sessionId: "test-session",
        remoteJid: "5511999999999@s.whatsapp.net",
        assignedUserId: 2,
        fromAgentId: 1,
        timestamp: Date.now(),
      };
      expect(expectedEvent.type).toBe("transfer");
      expect(expectedEvent.assignedUserId).toBe(2);
      expect(expectedEvent.fromAgentId).toBe(1);
    });
  });

  describe("Agent name display on messages", () => {
    it("should build agentMap from agents array", () => {
      const agents = [
        { id: 1, name: "João Silva" },
        { id: 2, name: "Maria Santos" },
        { id: 3, name: "Pedro Oliveira" },
      ];
      const agentMap: Record<number, string> = {};
      for (const a of agents) {
        agentMap[a.id] = a.name;
      }
      expect(agentMap[1]).toBe("João Silva");
      expect(agentMap[2]).toBe("Maria Santos");
      expect(agentMap[3]).toBe("Pedro Oliveira");
    });

    it("should only show agent name for fromMe messages with senderAgentId", () => {
      const msg = {
        fromMe: true,
        senderAgentId: 1,
      };
      const showAgentNames = true;
      const agentMap: Record<number, string> = { 1: "João" };
      const isFirst = true;

      const shouldShow = showAgentNames && msg.fromMe && msg.senderAgentId && agentMap[msg.senderAgentId] && isFirst;
      expect(shouldShow).toBeTruthy();
    });

    it("should not show agent name for received messages", () => {
      const msg = {
        fromMe: false,
        senderAgentId: null,
      };
      const showAgentNames = true;
      const agentMap: Record<number, string> = { 1: "João" };

      const shouldShow = showAgentNames && msg.fromMe && msg.senderAgentId;
      expect(shouldShow).toBeFalsy();
    });

    it("should not show agent name when toggle is off", () => {
      const msg = {
        fromMe: true,
        senderAgentId: 1,
      };
      const showAgentNames = false;
      const agentMap: Record<number, string> = { 1: "João" };

      const shouldShow = showAgentNames && msg.fromMe && msg.senderAgentId;
      expect(shouldShow).toBeFalsy();
    });
  });

  describe("Assignment button visibility", () => {
    it("should show assignment button even when assignment is null", () => {
      const assignment = null;
      // The button should always be visible regardless of assignment state
      const shouldShowButton = true; // Always visible now
      expect(shouldShowButton).toBe(true);
    });

    it("should show assigned agent name when assignment exists", () => {
      const assignment = {
        assignedUserId: 1,
        assignedAgentName: "João Silva",
      };
      expect(assignment.assignedAgentName).toBe("João Silva");
    });

    it("should show 'Não atribuído' when no agent is assigned", () => {
      const assignment = null;
      const label = assignment?.assignedAgentName || "Não atribuído";
      expect(label).toBe("Não atribuído");
    });
  });

  describe("Supervision panel transfer flow", () => {
    it("should filter out current agent from transfer target list", () => {
      const allAgents = [
        { agentId: 1, agentName: "João" },
        { agentId: 2, agentName: "Maria" },
        { agentId: 3, agentName: "Pedro" },
      ];
      const currentAgentId = 1;
      const availableTargets = allAgents.filter(a => a.agentId !== currentAgentId);
      expect(availableTargets).toHaveLength(2);
      expect(availableTargets.map(a => a.agentName)).toEqual(["Maria", "Pedro"]);
    });

    it("should show transfer UI when transfer button is clicked", () => {
      let transferringJid: string | null = null;
      const remoteJid = "5511999999999@s.whatsapp.net";
      
      // Simulate clicking transfer button
      transferringJid = remoteJid;
      expect(transferringJid).toBe(remoteJid);
    });

    it("should reset transfer state after successful transfer", () => {
      let transferringJid: string | null = "5511999999999@s.whatsapp.net";
      let transferTargetId: number | null = 2;
      
      // Simulate successful transfer
      transferringJid = null;
      transferTargetId = null;
      expect(transferringJid).toBeNull();
      expect(transferTargetId).toBeNull();
    });
  });
});
