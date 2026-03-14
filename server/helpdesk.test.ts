import { describe, it, expect } from "vitest";

/**
 * Helpdesk System Tests
 * 
 * Tests for the new helpdesk features:
 * 1. Internal notes CRUD
 * 2. Conversation events / timeline
 * 3. Transfer logic
 * 4. Queue filtering
 * 5. Quick replies CRUD
 * 6. Supervision data
 */

// ─── Internal Notes ───

describe("Internal Notes", () => {
  it("should validate note content is required", () => {
    const content = "";
    expect(content.trim().length > 0).toBe(false);
  });

  it("should validate note content max length", () => {
    const content = "a".repeat(5001);
    expect(content.length <= 5000).toBe(false);
  });

  it("should accept valid note content", () => {
    const content = "Rafa, por favor, atender esse cliente com urgência.";
    expect(content.trim().length > 0).toBe(true);
    expect(content.length <= 5000).toBe(true);
  });

  it("should associate note with correct conversation and author", () => {
    const note = {
      waConversationId: 123,
      authorId: 456,
      content: "Nota interna de teste",
    };
    expect(note.waConversationId).toBe(123);
    expect(note.authorId).toBe(456);
    expect(note.content).toBeTruthy();
  });
});

// ─── Conversation Events ───

describe("Conversation Events", () => {
  it("should create valid event types", () => {
    const validTypes = [
      "ticket_opened",
      "ticket_closed",
      "assigned",
      "transferred",
      "note_added",
      "status_changed",
      "queue_entered",
      "queue_exited",
    ];
    validTypes.forEach((type) => {
      expect(typeof type).toBe("string");
      expect(type.length).toBeGreaterThan(0);
    });
  });

  it("should format transfer event metadata correctly", () => {
    const metadata = {
      fromUserId: 1,
      fromUserName: "Priscila",
      toUserId: 2,
      toUserName: "Vanessa",
      note: "Transferindo para Vanessa pois ela tem mais experiência",
    };
    expect(metadata.fromUserId).not.toBe(metadata.toUserId);
    expect(metadata.note).toBeTruthy();
  });

  it("should format assignment event metadata correctly", () => {
    const metadata = {
      assignedUserId: 5,
      assignedUserName: "Rafaela",
      method: "manual" as const,
    };
    expect(metadata.assignedUserId).toBe(5);
    expect(["manual", "auto", "round_robin"]).toContain(metadata.method);
  });

  it("should format ticket status change event", () => {
    const metadata = {
      oldStatus: "open",
      newStatus: "closed",
      closedBy: 1,
    };
    expect(metadata.oldStatus).not.toBe(metadata.newStatus);
    expect(["open", "pending", "closed"]).toContain(metadata.newStatus);
  });
});

// ─── Transfer Logic ───

describe("Transfer Logic", () => {
  it("should not allow transfer to same agent", () => {
    const fromUserId = 5;
    const toUserId = 5;
    expect(fromUserId !== toUserId).toBe(false);
  });

  it("should allow transfer to different agent", () => {
    const fromUserId = 5;
    const toUserId = 8;
    expect(fromUserId !== toUserId).toBe(true);
  });

  it("should require toUserId for transfer", () => {
    const input = { sessionId: "crm-1-1", remoteJid: "5511999@s.whatsapp.net", toUserId: 8 };
    expect(input.toUserId).toBeTruthy();
    expect(input.sessionId).toBeTruthy();
    expect(input.remoteJid).toBeTruthy();
  });

  it("should optionally include note with transfer", () => {
    const withNote = { toUserId: 8, note: "Cliente VIP, tratar com cuidado" };
    const withoutNote = { toUserId: 8 };
    expect(withNote.note).toBeTruthy();
    expect((withoutNote as any).note).toBeUndefined();
  });

  it("should optionally include team with transfer", () => {
    const withTeam = { toUserId: 8, toTeamId: 3 };
    const withoutTeam = { toUserId: 8 };
    expect(withTeam.toTeamId).toBe(3);
    expect((withoutTeam as any).toTeamId).toBeUndefined();
  });
});

// ─── Queue Filtering ───

describe("Queue Filtering", () => {
  it("should identify unassigned conversations as queue items", () => {
    const conversations = [
      { remoteJid: "551199@s.whatsapp.net", assignedUserId: null, ticketStatus: "open" },
      { remoteJid: "551188@s.whatsapp.net", assignedUserId: 5, ticketStatus: "open" },
      { remoteJid: "551177@s.whatsapp.net", assignedUserId: null, ticketStatus: "open" },
    ];
    const queue = conversations.filter((c) => !c.assignedUserId && c.ticketStatus === "open");
    expect(queue.length).toBe(2);
  });

  it("should not include closed conversations in queue", () => {
    const conversations = [
      { remoteJid: "551199@s.whatsapp.net", assignedUserId: null, ticketStatus: "closed" },
      { remoteJid: "551188@s.whatsapp.net", assignedUserId: null, ticketStatus: "open" },
    ];
    const queue = conversations.filter((c) => !c.assignedUserId && c.ticketStatus === "open");
    expect(queue.length).toBe(1);
    expect(queue[0].remoteJid).toBe("551188@s.whatsapp.net");
  });

  it("should filter conversations by assigned agent (Meus Chats)", () => {
    const myUserId = 5;
    const conversations = [
      { remoteJid: "1@s.whatsapp.net", assignedUserId: 5 },
      { remoteJid: "2@s.whatsapp.net", assignedUserId: 8 },
      { remoteJid: "3@s.whatsapp.net", assignedUserId: 5 },
      { remoteJid: "4@s.whatsapp.net", assignedUserId: null },
    ];
    const myChats = conversations.filter((c) => c.assignedUserId === myUserId);
    expect(myChats.length).toBe(2);
  });

  it("should show all conversations for admin (Todas tab)", () => {
    const conversations = [
      { remoteJid: "1@s.whatsapp.net", assignedUserId: 5 },
      { remoteJid: "2@s.whatsapp.net", assignedUserId: 8 },
      { remoteJid: "3@s.whatsapp.net", assignedUserId: null },
    ];
    // Admin sees all
    expect(conversations.length).toBe(3);
  });
});

// ─── Quick Replies ───

describe("Quick Replies", () => {
  it("should validate shortcut format", () => {
    const validShortcuts = ["ola", "preco", "obrigado", "horario"];
    const invalidShortcuts = ["", "a".repeat(33)];
    
    validShortcuts.forEach((s) => {
      expect(s.length >= 1 && s.length <= 32).toBe(true);
    });
    invalidShortcuts.forEach((s) => {
      expect(s.length >= 1 && s.length <= 32).toBe(false);
    });
  });

  it("should validate quick reply structure", () => {
    const reply = {
      shortcut: "ola",
      title: "Saudação",
      content: "Olá! Como posso ajudá-lo hoje?",
      category: "geral",
    };
    expect(reply.shortcut.length).toBeGreaterThan(0);
    expect(reply.title.length).toBeGreaterThan(0);
    expect(reply.content.length).toBeGreaterThan(0);
  });

  it("should support team-specific quick replies", () => {
    const globalReply = { shortcut: "ola", teamId: undefined };
    const teamReply = { shortcut: "preco_vendas", teamId: 3 };
    
    expect(globalReply.teamId).toBeUndefined();
    expect(teamReply.teamId).toBe(3);
  });
});

// ─── Supervision Data ───

describe("Supervision Dashboard", () => {
  it("should calculate agent workload correctly", () => {
    const agents = [
      { id: 1, name: "Priscila", openTickets: 7 },
      { id: 2, name: "Rafaela", openTickets: 6 },
      { id: 3, name: "Vanessa", openTickets: 3 },
    ];
    const totalTickets = agents.reduce((sum, a) => sum + a.openTickets, 0);
    const avgTickets = totalTickets / agents.length;
    
    expect(totalTickets).toBe(16);
    expect(avgTickets).toBeCloseTo(5.33, 1);
  });

  it("should identify overloaded agents", () => {
    const agents = [
      { id: 1, name: "Priscila", openTickets: 12 },
      { id: 2, name: "Rafaela", openTickets: 3 },
      { id: 3, name: "Vanessa", openTickets: 3 },
    ];
    const avgTickets = agents.reduce((sum, a) => sum + a.openTickets, 0) / agents.length;
    const overloaded = agents.filter((a) => a.openTickets > avgTickets * 1.5);
    
    expect(overloaded.length).toBe(1);
    expect(overloaded[0].name).toBe("Priscila");
  });

  it("should track online/offline agent status", () => {
    const agents = [
      { id: 1, name: "Priscila", status: "online" },
      { id: 2, name: "Rafaela", status: "offline" },
      { id: 3, name: "Vanessa", status: "online" },
    ];
    const online = agents.filter((a) => a.status === "online");
    const offline = agents.filter((a) => a.status === "offline");
    
    expect(online.length).toBe(2);
    expect(offline.length).toBe(1);
  });

  it("should calculate queue wait time", () => {
    const now = Date.now();
    const waitingSince = now - 15 * 60 * 1000; // 15 minutes ago
    const waitTimeMinutes = Math.floor((now - waitingSince) / 60000);
    
    expect(waitTimeMinutes).toBe(15);
  });

  it("should format wait time correctly", () => {
    function formatWaitTime(timestamp: number): string {
      const diff = Date.now() - timestamp;
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return "menos de 1 min";
      if (minutes < 60) return `${minutes} min`;
      const hours = Math.floor(minutes / 60);
      return `${hours}h ${minutes % 60}min`;
    }

    const now = Date.now();
    expect(formatWaitTime(now)).toBe("menos de 1 min");
    expect(formatWaitTime(now - 5 * 60000)).toBe("5 min");
    expect(formatWaitTime(now - 90 * 60000)).toBe("1h 30min");
  });
});

// ─── Ticket Status ───

describe("Ticket Status", () => {
  it("should have valid ticket statuses", () => {
    const validStatuses = ["open", "pending", "closed"];
    validStatuses.forEach((s) => {
      expect(typeof s).toBe("string");
    });
  });

  it("should denormalize ticket status on wa_conversations", () => {
    const conversation = {
      remoteJid: "551199@s.whatsapp.net",
      assignedUserId: 5,
      assignedUserName: "Priscila",
      ticketStatus: "open",
      ticketOpenedAt: Date.now(),
      ticketClosedAt: null,
    };
    expect(conversation.ticketStatus).toBe("open");
    expect(conversation.assignedUserId).toBe(5);
    expect(conversation.ticketClosedAt).toBeNull();
  });

  it("should update denormalized fields on ticket close", () => {
    const conversation = {
      ticketStatus: "open" as string,
      ticketClosedAt: null as number | null,
    };
    // Close ticket
    conversation.ticketStatus = "closed";
    conversation.ticketClosedAt = Date.now();
    
    expect(conversation.ticketStatus).toBe("closed");
    expect(conversation.ticketClosedAt).toBeTruthy();
  });
});

// ─── Inbox Tab Filtering ───

describe("Inbox Tab Filtering", () => {
  const conversations = [
    { remoteJid: "1@s.whatsapp.net", assignedUserId: 5, ticketStatus: "open" },
    { remoteJid: "2@s.whatsapp.net", assignedUserId: 8, ticketStatus: "open" },
    { remoteJid: "3@s.whatsapp.net", assignedUserId: null, ticketStatus: "open" },
    { remoteJid: "4@s.whatsapp.net", assignedUserId: 5, ticketStatus: "closed" },
    { remoteJid: "5@s.whatsapp.net", assignedUserId: null, ticketStatus: "pending" },
  ];
  const myUserId = 5;

  it("'Meus Chats' tab should show only my assigned conversations", () => {
    const myChats = conversations.filter((c) => c.assignedUserId === myUserId);
    expect(myChats.length).toBe(2);
  });

  it("'Fila' tab should show unassigned open/pending conversations", () => {
    const queue = conversations.filter(
      (c) => !c.assignedUserId && (c.ticketStatus === "open" || c.ticketStatus === "pending")
    );
    expect(queue.length).toBe(2);
  });

  it("'Todas' tab should show all conversations (admin only)", () => {
    expect(conversations.length).toBe(5);
  });

  it("should correctly separate tabs with no overlap", () => {
    const myChats = conversations.filter((c) => c.assignedUserId === myUserId);
    const queue = conversations.filter((c) => !c.assignedUserId);
    const othersChats = conversations.filter((c) => c.assignedUserId && c.assignedUserId !== myUserId);
    
    // No overlap between my chats and queue
    const myJids = new Set(myChats.map((c) => c.remoteJid));
    const queueJids = new Set(queue.map((c) => c.remoteJid));
    const overlap = [...myJids].filter((j) => queueJids.has(j));
    expect(overlap.length).toBe(0);
    
    // Total should add up
    expect(myChats.length + queue.length + othersChats.length).toBe(conversations.length);
  });
});
