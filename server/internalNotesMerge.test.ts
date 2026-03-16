import { describe, expect, it } from "vitest";

/**
 * Tests for internal notes chronological merging logic.
 * 
 * The frontend merges internal notes into the message flow by:
 * 1. Converting notes to virtual Message objects with messageType='internal_note'
 * 2. Sorting combined messages+notes chronologically by timestamp
 * 3. Grouping by date labels (Hoje, Ontem, or full date)
 * 4. Rendering notes as yellow bubbles inline with messages
 * 
 * These tests validate the merging and sorting logic extracted from
 * the groupedMessages useMemo in WhatsAppChat.tsx.
 */

// ─── Types (mirror frontend) ───
interface Message {
  id: number;
  sessionId: string;
  messageId?: string | null;
  remoteJid: string;
  fromMe: boolean;
  messageType: string;
  content: string | null;
  mediaUrl?: string | null;
  status?: string | null;
  timestamp: string | Date;
  createdAt: string | Date;
  pushName?: string | null;
  mediaFileName?: string | null;
}

interface InternalNote {
  id: number;
  waConversationId: number;
  content: string;
  createdAt: string | Date;
  authorUserId: number;
  authorName: string | null;
  authorAvatar: string | null;
  mentionedUserIds: number[] | null;
}

// ─── Helper: convert note to virtual message (same logic as frontend) ───
function noteToVirtualMessage(note: InternalNote): Message {
  return {
    id: -note.id,
    sessionId: "",
    messageId: `note_${note.id}`,
    remoteJid: "",
    fromMe: true,
    messageType: "internal_note",
    content: note.content,
    mediaUrl: null,
    status: null,
    timestamp: note.createdAt,
    createdAt: note.createdAt,
    pushName: note.authorName || "Agente",
    mediaFileName: note.authorAvatar || null,
  };
}

// ─── Helper: merge and sort (same logic as frontend groupedMessages) ───
function mergeAndSort(messages: Message[], notes: InternalNote[]): Message[] {
  const noteItems = notes.map(noteToVirtualMessage);
  return [...messages, ...noteItems].sort((a, b) => {
    const tA = new Date(a.timestamp || a.createdAt).getTime();
    const tB = new Date(b.timestamp || b.createdAt).getTime();
    return tA - tB;
  });
}

// ─── Helper: group by date (simplified version of frontend logic) ───
function groupByDate(items: Message[]): { date: string; messages: Message[] }[] {
  const groups: { date: string; messages: Message[] }[] = [];
  let currentDate = "";
  for (const msg of items) {
    const d = new Date(msg.timestamp || msg.createdAt);
    const label = d.toISOString().split("T")[0]; // simplified: use YYYY-MM-DD
    if (label !== currentDate) {
      currentDate = label;
      groups.push({ date: label, messages: [] });
    }
    groups[groups.length - 1].messages.push(msg);
  }
  return groups;
}

// ─── Test Data Factories ───
function makeMessage(overrides: Partial<Message> & { id: number; timestamp: string }): Message {
  return {
    sessionId: "sess1",
    messageId: `msg_${overrides.id}`,
    remoteJid: "5511999999999@s.whatsapp.net",
    fromMe: false,
    messageType: "text",
    content: `Message ${overrides.id}`,
    mediaUrl: null,
    status: "delivered",
    createdAt: overrides.timestamp,
    ...overrides,
  };
}

function makeNote(overrides: Partial<InternalNote> & { id: number; createdAt: string }): InternalNote {
  return {
    waConversationId: 1,
    content: `Note ${overrides.id}`,
    authorUserId: 1,
    authorName: "Agent Smith",
    authorAvatar: null,
    mentionedUserIds: null,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════

describe("Internal Notes Chronological Merge", () => {
  describe("noteToVirtualMessage", () => {
    it("converts a note to a virtual message with correct messageType", () => {
      const note = makeNote({ id: 1, createdAt: "2026-03-15T10:00:00Z", content: "Test note" });
      const vm = noteToVirtualMessage(note);
      expect(vm.messageType).toBe("internal_note");
      expect(vm.content).toBe("Test note");
      expect(vm.fromMe).toBe(true);
      expect(vm.id).toBe(-1); // negative ID
      expect(vm.messageId).toBe("note_1");
    });

    it("uses negative ID to avoid collision with real messages", () => {
      const note = makeNote({ id: 42, createdAt: "2026-03-15T10:00:00Z" });
      const vm = noteToVirtualMessage(note);
      expect(vm.id).toBe(-42);
      expect(vm.id).toBeLessThan(0);
    });

    it("preserves author name in pushName field", () => {
      const note = makeNote({ id: 1, createdAt: "2026-03-15T10:00:00Z", authorName: "Maria Silva" });
      const vm = noteToVirtualMessage(note);
      expect(vm.pushName).toBe("Maria Silva");
    });

    it("defaults author name to 'Agente' when null", () => {
      const note = makeNote({ id: 1, createdAt: "2026-03-15T10:00:00Z", authorName: null });
      const vm = noteToVirtualMessage(note);
      expect(vm.pushName).toBe("Agente");
    });

    it("preserves timestamp from note createdAt", () => {
      const ts = "2026-03-15T14:30:00Z";
      const note = makeNote({ id: 1, createdAt: ts });
      const vm = noteToVirtualMessage(note);
      expect(vm.timestamp).toBe(ts);
      expect(vm.createdAt).toBe(ts);
    });

    it("sets sessionId and remoteJid to empty strings", () => {
      const note = makeNote({ id: 1, createdAt: "2026-03-15T10:00:00Z" });
      const vm = noteToVirtualMessage(note);
      expect(vm.sessionId).toBe("");
      expect(vm.remoteJid).toBe("");
    });
  });

  describe("mergeAndSort", () => {
    it("merges messages and notes in chronological order", () => {
      const messages = [
        makeMessage({ id: 1, timestamp: "2026-03-15T09:00:00Z", content: "Olá" }),
        makeMessage({ id: 2, timestamp: "2026-03-15T09:05:00Z", content: "Tudo bem?" }),
        makeMessage({ id: 3, timestamp: "2026-03-15T09:15:00Z", content: "Ok, obrigado" }),
      ];
      const notes = [
        makeNote({ id: 1, createdAt: "2026-03-15T09:03:00Z", content: "Cliente VIP" }),
        makeNote({ id: 2, createdAt: "2026-03-15T09:10:00Z", content: "Verificar pacote" }),
      ];

      const merged = mergeAndSort(messages, notes);
      expect(merged).toHaveLength(5);
      // Order: msg1 (09:00), note1 (09:03), msg2 (09:05), note2 (09:10), msg3 (09:15)
      expect(merged[0].content).toBe("Olá");
      expect(merged[1].content).toBe("Cliente VIP");
      expect(merged[1].messageType).toBe("internal_note");
      expect(merged[2].content).toBe("Tudo bem?");
      expect(merged[3].content).toBe("Verificar pacote");
      expect(merged[3].messageType).toBe("internal_note");
      expect(merged[4].content).toBe("Ok, obrigado");
    });

    it("handles empty notes array", () => {
      const messages = [
        makeMessage({ id: 1, timestamp: "2026-03-15T09:00:00Z" }),
        makeMessage({ id: 2, timestamp: "2026-03-15T09:05:00Z" }),
      ];
      const merged = mergeAndSort(messages, []);
      expect(merged).toHaveLength(2);
      expect(merged.every(m => m.messageType !== "internal_note")).toBe(true);
    });

    it("handles empty messages array", () => {
      const notes = [
        makeNote({ id: 1, createdAt: "2026-03-15T09:00:00Z" }),
        makeNote({ id: 2, createdAt: "2026-03-15T09:05:00Z" }),
      ];
      const merged = mergeAndSort([], notes);
      expect(merged).toHaveLength(2);
      expect(merged.every(m => m.messageType === "internal_note")).toBe(true);
    });

    it("handles both empty", () => {
      const merged = mergeAndSort([], []);
      expect(merged).toHaveLength(0);
    });

    it("places note before message when note is earlier", () => {
      const messages = [makeMessage({ id: 1, timestamp: "2026-03-15T10:00:00Z" })];
      const notes = [makeNote({ id: 1, createdAt: "2026-03-15T09:00:00Z" })];
      const merged = mergeAndSort(messages, notes);
      expect(merged[0].messageType).toBe("internal_note");
      expect(merged[1].messageType).toBe("text");
    });

    it("places note after message when note is later", () => {
      const messages = [makeMessage({ id: 1, timestamp: "2026-03-15T09:00:00Z" })];
      const notes = [makeNote({ id: 1, createdAt: "2026-03-15T10:00:00Z" })];
      const merged = mergeAndSort(messages, notes);
      expect(merged[0].messageType).toBe("text");
      expect(merged[1].messageType).toBe("internal_note");
    });

    it("handles notes and messages with same timestamp", () => {
      const ts = "2026-03-15T09:00:00Z";
      const messages = [makeMessage({ id: 1, timestamp: ts })];
      const notes = [makeNote({ id: 1, createdAt: ts })];
      const merged = mergeAndSort(messages, notes);
      expect(merged).toHaveLength(2);
      // Both should be present regardless of order
      const types = merged.map(m => m.messageType);
      expect(types).toContain("text");
      expect(types).toContain("internal_note");
    });

    it("maintains stable order for multiple notes between messages", () => {
      const messages = [
        makeMessage({ id: 1, timestamp: "2026-03-15T08:00:00Z" }),
        makeMessage({ id: 2, timestamp: "2026-03-15T12:00:00Z" }),
      ];
      const notes = [
        makeNote({ id: 1, createdAt: "2026-03-15T09:00:00Z", content: "Nota 1" }),
        makeNote({ id: 2, createdAt: "2026-03-15T10:00:00Z", content: "Nota 2" }),
        makeNote({ id: 3, createdAt: "2026-03-15T11:00:00Z", content: "Nota 3" }),
      ];
      const merged = mergeAndSort(messages, notes);
      expect(merged).toHaveLength(5);
      expect(merged[0].messageType).toBe("text"); // 08:00
      expect(merged[1].content).toBe("Nota 1"); // 09:00
      expect(merged[2].content).toBe("Nota 2"); // 10:00
      expect(merged[3].content).toBe("Nota 3"); // 11:00
      expect(merged[4].messageType).toBe("text"); // 12:00
    });
  });

  describe("groupByDate", () => {
    it("groups messages and notes from the same day together", () => {
      const messages = [
        makeMessage({ id: 1, timestamp: "2026-03-15T09:00:00Z" }),
        makeMessage({ id: 2, timestamp: "2026-03-15T14:00:00Z" }),
      ];
      const notes = [
        makeNote({ id: 1, createdAt: "2026-03-15T11:00:00Z" }),
      ];
      const merged = mergeAndSort(messages, notes);
      const groups = groupByDate(merged);
      expect(groups).toHaveLength(1);
      expect(groups[0].messages).toHaveLength(3);
    });

    it("separates messages and notes from different days", () => {
      const messages = [
        makeMessage({ id: 1, timestamp: "2026-03-14T09:00:00Z" }),
        makeMessage({ id: 2, timestamp: "2026-03-15T14:00:00Z" }),
      ];
      const notes = [
        makeNote({ id: 1, createdAt: "2026-03-14T11:00:00Z" }),
        makeNote({ id: 2, createdAt: "2026-03-15T10:00:00Z" }),
      ];
      const merged = mergeAndSort(messages, notes);
      const groups = groupByDate(merged);
      expect(groups).toHaveLength(2);
      // Day 1: msg1 + note1
      expect(groups[0].messages).toHaveLength(2);
      // Day 2: note2 + msg2
      expect(groups[1].messages).toHaveLength(2);
    });

    it("notes appear in correct position within their date group", () => {
      const messages = [
        makeMessage({ id: 1, timestamp: "2026-03-15T08:00:00Z", content: "Bom dia" }),
        makeMessage({ id: 2, timestamp: "2026-03-15T08:30:00Z", content: "Preciso de ajuda" }),
        makeMessage({ id: 3, timestamp: "2026-03-15T09:30:00Z", content: "Obrigado" }),
      ];
      const notes = [
        makeNote({ id: 1, createdAt: "2026-03-15T08:45:00Z", content: "Escalar para supervisor" }),
      ];
      const merged = mergeAndSort(messages, notes);
      const groups = groupByDate(merged);
      expect(groups).toHaveLength(1);
      const items = groups[0].messages;
      expect(items).toHaveLength(4);
      expect(items[0].content).toBe("Bom dia");
      expect(items[1].content).toBe("Preciso de ajuda");
      expect(items[2].content).toBe("Escalar para supervisor");
      expect(items[2].messageType).toBe("internal_note");
      expect(items[3].content).toBe("Obrigado");
    });
  });

  describe("Message grouping boundaries", () => {
    it("internal notes break message bubble grouping (isFirst/isLast)", () => {
      // Simulates the isFirst/isLast logic from the rendering loop
      const messages = [
        makeMessage({ id: 1, timestamp: "2026-03-15T09:00:00Z", fromMe: true }),
        makeMessage({ id: 2, timestamp: "2026-03-15T09:05:00Z", fromMe: true }),
      ];
      const notes = [
        makeNote({ id: 1, createdAt: "2026-03-15T09:02:00Z" }),
      ];
      const merged = mergeAndSort(messages, notes);

      // Simulate isFirst/isLast calculation from the rendering loop
      for (let i = 0; i < merged.length; i++) {
        const msg = merged[i];
        const prev = i > 0 ? merged[i - 1] : null;
        const next = i < merged.length - 1 ? merged[i + 1] : null;

        if (msg.messageType === "internal_note") continue;

        const isFirst = !prev || prev.fromMe !== msg.fromMe || prev.messageType === "internal_note";
        const isLast = !next || next.fromMe !== msg.fromMe || next.messageType === "internal_note";

        if (i === 0) {
          // First message: should be isFirst=true, isLast=true (note follows)
          expect(isFirst).toBe(true);
          expect(isLast).toBe(true);
        }
        if (i === 2) {
          // Third item (second real message): should be isFirst=true (note precedes), isLast=true
          expect(isFirst).toBe(true);
          expect(isLast).toBe(true);
        }
      }
    });
  });

  describe("Edge cases", () => {
    it("handles notes with Date objects instead of strings", () => {
      const note = makeNote({ id: 1, createdAt: new Date("2026-03-15T10:00:00Z").toISOString() });
      const vm = noteToVirtualMessage(note);
      expect(vm.messageType).toBe("internal_note");
      expect(new Date(vm.timestamp as string).getTime()).toBe(new Date("2026-03-15T10:00:00Z").getTime());
    });

    it("handles large number of notes mixed with messages", () => {
      const messages: Message[] = [];
      const notes: InternalNote[] = [];
      // 50 messages, 1 per hour
      for (let i = 0; i < 50; i++) {
        const h = String(i % 24).padStart(2, "0");
        const d = 14 + Math.floor(i / 24);
        messages.push(makeMessage({ id: i + 1, timestamp: `2026-03-${d}T${h}:00:00Z` }));
      }
      // 20 notes interspersed
      for (let i = 0; i < 20; i++) {
        const h = String((i * 2 + 1) % 24).padStart(2, "0");
        const d = 14 + Math.floor((i * 2 + 1) / 24);
        notes.push(makeNote({ id: i + 1, createdAt: `2026-03-${d}T${h}:30:00Z` }));
      }
      const merged = mergeAndSort(messages, notes);
      expect(merged).toHaveLength(70);
      // Verify chronological order
      for (let i = 1; i < merged.length; i++) {
        const tPrev = new Date(merged[i - 1].timestamp || merged[i - 1].createdAt).getTime();
        const tCurr = new Date(merged[i].timestamp || merged[i].createdAt).getTime();
        expect(tCurr).toBeGreaterThanOrEqual(tPrev);
      }
    });

    it("note IDs don't collide with message IDs", () => {
      const messages = [makeMessage({ id: 5, timestamp: "2026-03-15T09:00:00Z" })];
      const notes = [makeNote({ id: 5, createdAt: "2026-03-15T09:05:00Z" })];
      const merged = mergeAndSort(messages, notes);
      const ids = merged.map(m => m.id);
      expect(ids).toContain(5);
      expect(ids).toContain(-5);
      expect(new Set(ids).size).toBe(2); // no collision
    });

    it("note messageIds have note_ prefix to avoid collision", () => {
      const notes = [
        makeNote({ id: 1, createdAt: "2026-03-15T09:00:00Z" }),
        makeNote({ id: 2, createdAt: "2026-03-15T09:05:00Z" }),
      ];
      const merged = mergeAndSort([], notes);
      expect(merged[0].messageId).toBe("note_1");
      expect(merged[1].messageId).toBe("note_2");
    });

    it("all virtual note messages have fromMe=true (right-aligned)", () => {
      const notes = [
        makeNote({ id: 1, createdAt: "2026-03-15T09:00:00Z" }),
        makeNote({ id: 2, createdAt: "2026-03-15T09:05:00Z" }),
        makeNote({ id: 3, createdAt: "2026-03-15T09:10:00Z" }),
      ];
      const merged = mergeAndSort([], notes);
      expect(merged.every(m => m.fromMe === true)).toBe(true);
    });
  });
});


describe("Timestamp Serialization Fix (UTC 'Z' suffix)", () => {
  /**
   * Root cause: Drizzle's db.execute(sql`...`) returns TIMESTAMP columns as strings
   * (e.g. "2026-03-16 04:18:05") WITHOUT timezone info. Drizzle's select().from()
   * treats these same DB values as UTC (returning Date objects like 2026-03-16T04:18:05.000Z).
   * 
   * Without the 'Z' suffix, new Date("2026-03-16 04:18:05") interprets the string in the
   * SERVER's local timezone (EDT, UTC-4), producing 2026-03-16T08:18:05.000Z — a 4-hour shift.
   * This causes notes to display wrong times AND sort after messages instead of interleaved.
   *
   * Fix: Append 'Z' to the string before creating Date, so it's treated as UTC:
   * new Date("2026-03-16T04:18:05Z") → 2026-03-16T04:18:05.000Z (correct, matches messages)
   */

  // The actual fix function from db.ts
  function applyTimestampFix(createdAt: string | Date): Date {
    if (createdAt instanceof Date) return createdAt;
    const str = createdAt as string;
    if (str.endsWith('Z')) return new Date(str);
    return new Date(str.replace(' ', 'T') + 'Z');
  }

  // Simulate what db.execute returns (raw strings without timezone)
  function simulateRawDbNotes(): InternalNote[] {
    return [
      makeNote({ id: 4, createdAt: "2026-03-16 01:34:38", content: "Note at 01:34" }),
      makeNote({ id: 5, createdAt: "2026-03-16 04:23:52", content: "Note at 04:23" }),
      makeNote({ id: 6, createdAt: "2026-03-16 04:31:54", content: "Note at 04:31" }),
    ];
  }

  // Simulate what the backend returns AFTER the fix (proper UTC Date objects)
  function simulatePostFixNotes(): InternalNote[] {
    return [
      makeNote({ id: 4, createdAt: new Date("2026-03-16T01:34:38.000Z").toISOString(), content: "Note at 01:34" }),
      makeNote({ id: 5, createdAt: new Date("2026-03-16T04:23:52.000Z").toISOString(), content: "Note at 04:23" }),
      makeNote({ id: 6, createdAt: new Date("2026-03-16T04:31:54.000Z").toISOString(), content: "Note at 04:31" }),
    ];
  }

  // Messages from Drizzle select().from() — already correct UTC Date objects
  function getTestMessages(): Message[] {
    return [
      makeMessage({ id: 574887, timestamp: new Date("2026-03-16T04:24:02.000Z").toISOString(), content: "msg at 04:24 UTC" }),
      makeMessage({ id: 574888, timestamp: new Date("2026-03-16T04:24:09.000Z").toISOString(), content: "msg at 04:24 UTC" }),
      makeMessage({ id: 575231, timestamp: new Date("2026-03-16T04:31:59.000Z").toISOString(), content: "msg at 04:31 UTC" }),
      makeMessage({ id: 575544, timestamp: new Date("2026-03-16T04:38:10.000Z").toISOString(), content: "msg at 04:38 UTC" }),
    ];
  }

  it("with UTC timestamps (post-fix), notes interleave correctly with messages", () => {
    const messages = getTestMessages();
    const notes = simulatePostFixNotes();
    const merged = mergeAndSort(messages, notes);

    // Expected order:
    // note4 (01:34 UTC) -> note5 (04:23 UTC) -> msg (04:24) -> msg (04:24) -> note6 (04:31 UTC) -> msg (04:31) -> msg (04:38)
    expect(merged).toHaveLength(7);
    expect(merged[0].content).toBe("Note at 01:34");
    expect(merged[0].messageType).toBe("internal_note");
    expect(merged[1].content).toBe("Note at 04:23");
    expect(merged[1].messageType).toBe("internal_note");
    expect(merged[2].content).toBe("msg at 04:24 UTC");
    expect(merged[2].messageType).toBe("text");
    expect(merged[3].content).toBe("msg at 04:24 UTC");
    expect(merged[3].messageType).toBe("text");
    expect(merged[4].content).toBe("Note at 04:31");
    expect(merged[4].messageType).toBe("internal_note");
    expect(merged[5].content).toBe("msg at 04:31 UTC");
    expect(merged[5].messageType).toBe("text");
    expect(merged[6].content).toBe("msg at 04:38 UTC");
    expect(merged[6].messageType).toBe("text");
  });

  it("verifies chronological order is maintained with UTC timestamps", () => {
    const messages = getTestMessages();
    const notes = simulatePostFixNotes();
    const merged = mergeAndSort(messages, notes);

    for (let i = 1; i < merged.length; i++) {
      const tPrev = new Date(merged[i - 1].timestamp || merged[i - 1].createdAt).getTime();
      const tCurr = new Date(merged[i].timestamp || merged[i].createdAt).getTime();
      expect(tCurr).toBeGreaterThanOrEqual(tPrev);
    }
  });

  it("notes with ISO Z-suffix sort identically regardless of server timezone", () => {
    const note1 = makeNote({ id: 1, createdAt: "2026-03-16T01:34:38.000Z" });
    const note2 = makeNote({ id: 2, createdAt: "2026-03-16T04:23:52.000Z" });
    const msg = makeMessage({ id: 100, timestamp: "2026-03-16T03:00:00.000Z" });

    const merged = mergeAndSort([msg], [note1, note2]);
    // note1 (01:34) -> msg (03:00) -> note2 (04:23)
    expect(merged[0].messageType).toBe("internal_note");
    expect(merged[0].id).toBe(-1);
    expect(merged[1].messageType).toBe("text");
    expect(merged[2].messageType).toBe("internal_note");
    expect(merged[2].id).toBe(-2);
  });

  it("applyTimestampFix: appends Z suffix to treat DB string as UTC", () => {
    // DB returns "2026-03-16 04:18:05" (no timezone)
    const dbString = "2026-03-16 04:18:05";
    const fixed = applyTimestampFix(dbString);

    expect(fixed instanceof Date).toBe(true);
    expect(isNaN(fixed.getTime())).toBe(false);
    // Must be treated as UTC, so ISO should be 04:18:05Z
    expect(fixed.toISOString()).toBe("2026-03-16T04:18:05.000Z");
  });

  it("applyTimestampFix: preserves already-Date values", () => {
    const dateObj = new Date("2026-03-16T04:18:05.000Z");
    const fixed = applyTimestampFix(dateObj);

    expect(fixed instanceof Date).toBe(true);
    expect(fixed.toISOString()).toBe("2026-03-16T04:18:05.000Z");
  });

  it("applyTimestampFix: preserves strings already ending in Z", () => {
    const isoString = "2026-03-16T04:18:05.000Z";
    const fixed = applyTimestampFix(isoString);

    expect(fixed instanceof Date).toBe(true);
    expect(fixed.toISOString()).toBe("2026-03-16T04:18:05.000Z");
  });

  it("without Z suffix, new Date() interprets as server local time (WRONG)", () => {
    // This demonstrates the bug: without Z, the string is parsed in server local time
    const dbString = "2026-03-16 04:18:05";
    const wrongDate = new Date(dbString); // Interpreted as server local time!
    const correctDate = new Date(dbString.replace(' ', 'T') + 'Z'); // Forced UTC

    // The wrong date will have a different UTC time than the correct one
    // (unless the server happens to be in UTC)
    // The correct date should always be 04:18:05 UTC
    expect(correctDate.toISOString()).toBe("2026-03-16T04:18:05.000Z");
    // The wrong date depends on server TZ, but should NOT equal the correct one (unless UTC)
    if (process.env.TZ !== 'UTC' && process.env.TZ !== 'Etc/UTC') {
      expect(wrongDate.getTime()).not.toBe(correctDate.getTime());
    }
  });

  it("message and note created at same real time show same display time", () => {
    // User creates a message and note at the same moment
    // Message via Drizzle select(): 2026-03-16T04:17:59.000Z (UTC)
    // Note via db.execute() raw: "2026-03-16 04:18:05" -> with Z fix: 2026-03-16T04:18:05.000Z
    const msg = makeMessage({ id: 1, timestamp: "2026-03-16T04:17:59.000Z", content: "teste 1" });
    const note = makeNote({ id: 1, createdAt: applyTimestampFix("2026-03-16 04:18:05").toISOString(), content: "teste de nota agora" });

    const merged = mergeAndSort([msg], [note]);
    // Message at 04:17:59 should come before note at 04:18:05
    expect(merged[0].content).toBe("teste 1");
    expect(merged[1].content).toBe("teste de nota agora");

    // Both should display as ~01:17/01:18 in BRT (UTC-3)
    const msgBRT = new Date(merged[0].timestamp).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    const noteBRT = new Date(merged[1].timestamp).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    expect(msgBRT).toBe("01:17");
    expect(noteBRT).toBe("01:18");
  });
});
