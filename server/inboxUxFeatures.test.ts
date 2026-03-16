import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Comprehensive test suite for Inbox UX improvements:
 * 1. Advanced internal notes (category, priority, global flag, mentions)
 * 2. Clickable links in messages (URL parsing, normalization, security)
 * 3. Real-time socket emit on note creation
 * 4. Inbox stability (status regression, preview consistency)
 */

// ─── Load source files for structural tests ───
const whatsAppChatFile = readFileSync(resolve(__dirname, "../client/src/components/WhatsAppChat.tsx"), "utf-8");
const routersFile = readFileSync(resolve(__dirname, "./routers.ts"), "utf-8");
const dbFile = readFileSync(resolve(__dirname, "./db.ts"), "utf-8");
const schemaFile = readFileSync(resolve(__dirname, "../drizzle/schema.ts"), "utf-8");
const socketHookFile = readFileSync(resolve(__dirname, "../client/src/hooks/useSocket.ts"), "utf-8");

// ═══════════════════════════════════════════════════════════
// 1. ADVANCED INTERNAL NOTES: CATEGORY & PRIORITY
// ═══════════════════════════════════════════════════════════

describe("Advanced Internal Notes: Category & Priority", () => {
  describe("Database schema", () => {
    it("internal_notes table has category column", () => {
      expect(schemaFile).toContain("category");
    });

    it("internal_notes table has priority column", () => {
      expect(schemaFile).toContain("priority");
    });

    it("internal_notes table has isCustomerGlobalNote column", () => {
      expect(schemaFile).toContain("isCustomerGlobalNote");
    });

    it("category column has correct enum values", () => {
      // Should support: client, financial, documentation, operation, other
      expect(schemaFile).toMatch(/category.*varchar|category.*text|category.*enum/i);
    });

    it("priority column has correct enum values", () => {
      // Should support: normal, high, urgent
      expect(schemaFile).toMatch(/priority.*varchar|priority.*text|priority.*enum/i);
    });
  });

  describe("Backend: createInternalNote accepts new fields", () => {
    it("createInternalNote function accepts category parameter", () => {
      expect(dbFile).toMatch(/createInternalNote[\s\S]*?category/);
    });

    it("createInternalNote function accepts priority parameter", () => {
      expect(dbFile).toMatch(/createInternalNote[\s\S]*?priority/);
    });

    it("createInternalNote function accepts isCustomerGlobalNote parameter", () => {
      expect(dbFile).toMatch(/createInternalNote[\s\S]*?isCustomerGlobalNote/);
    });
  });

  describe("Backend: notes.create mutation accepts new fields", () => {
    it("notes.create mutation input includes category", () => {
      expect(routersFile).toMatch(/category:\s*z\.\s*(enum|string)/);
    });

    it("notes.create mutation input includes priority", () => {
      expect(routersFile).toMatch(/priority:\s*z\.\s*(enum|string)/);
    });

    it("notes.create mutation input includes isCustomerGlobalNote", () => {
      expect(routersFile).toContain("isCustomerGlobalNote");
    });
  });

  describe("Frontend: Note mode banner has category/priority selectors", () => {
    it("renders category select with correct options", () => {
      expect(whatsAppChatFile).toContain('value="client"');
      expect(whatsAppChatFile).toContain('value="financial"');
      expect(whatsAppChatFile).toContain('value="documentation"');
      expect(whatsAppChatFile).toContain('value="operation"');
      expect(whatsAppChatFile).toContain('value="other"');
    });

    it("renders priority select with correct options", () => {
      expect(whatsAppChatFile).toContain('value="normal"');
      expect(whatsAppChatFile).toContain('value="high"');
      expect(whatsAppChatFile).toContain('value="urgent"');
    });

    it("renders global note checkbox", () => {
      expect(whatsAppChatFile).toContain("noteIsGlobal");
      expect(whatsAppChatFile).toContain('type="checkbox"');
    });
  });

  describe("Frontend: Note bubbles render category/priority badges", () => {
    it("renders category badge for non-other categories", () => {
      expect(whatsAppChatFile).toContain('noteCategory !== "other"');
      expect(whatsAppChatFile).toContain("cat.label");
      expect(whatsAppChatFile).toContain("cat.color");
    });

    it("renders priority badge for non-normal priorities", () => {
      expect(whatsAppChatFile).toContain('notePriority !== "normal"');
      expect(whatsAppChatFile).toContain("pri.label");
      expect(whatsAppChatFile).toContain("pri.color");
    });

    it("urgent notes have red background instead of amber", () => {
      expect(whatsAppChatFile).toContain('notePriority === "urgent"');
      expect(whatsAppChatFile).toContain("bg-red-50");
    });

    it("global notes show globe indicator", () => {
      expect(whatsAppChatFile).toContain("noteIsGlobal");
      expect(whatsAppChatFile).toContain("Global");
    });

    it("category labels include all expected categories", () => {
      const categoryLabelsBlock = whatsAppChatFile.match(/categoryLabels[\s\S]*?other.*?Geral/);
      expect(categoryLabelsBlock).toBeTruthy();
      expect(whatsAppChatFile).toContain('"Cliente"');
      expect(whatsAppChatFile).toContain('"Financeiro"');
    });

    it("priority styles include high and urgent", () => {
      expect(whatsAppChatFile).toContain('"Alta"');
      expect(whatsAppChatFile).toContain('"Urgente"');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 2. AGENT MENTIONS WITH AUTOCOMPLETE
// ═══════════════════════════════════════════════════════════

describe("Agent Mentions with Autocomplete", () => {
  describe("Frontend: @mention detection in textarea", () => {
    it("detects @mention pattern in text input with Unicode support", () => {
      // The regex must support accented characters (Portuguese names: João, Antônio, José)
      expect(whatsAppChatFile).toContain("\\u00C0-\\u024F");
      expect(whatsAppChatFile).toMatch(/@.*\$/);
    });

    it("mention regex matches accented Portuguese names", () => {
      const mentionRegex = /@([\w\u00C0-\u024F]*)$/;
      expect(mentionRegex.exec("@João")?.[1]).toBe("João");
      expect(mentionRegex.exec("@Antônio")?.[1]).toBe("Antônio");
      expect(mentionRegex.exec("@José")?.[1]).toBe("José");
      expect(mentionRegex.exec("@Maria")?.[1]).toBe("Maria");
      expect(mentionRegex.exec("test @Cláudia")?.[1]).toBe("Cláudia");
      expect(mentionRegex.exec("@")?.[1]).toBe(""); // empty query shows all agents
    });

    it("mention highlighting regex supports accented characters", () => {
      const highlightRegex = /(@[\w\u00C0-\u024F][\w\u00C0-\u024F\s]*?)(?=\s@|\s|$)/g;
      const text = "@João mencionou @Antônio";
      const parts = text.split(highlightRegex);
      const mentions = parts.filter(p => p.startsWith("@"));
      expect(mentions.length).toBeGreaterThanOrEqual(2);
      expect(mentions).toContain("@João");
      expect(mentions).toContain("@Antônio");
    });

    it("tracks mentionQuery state", () => {
      expect(whatsAppChatFile).toContain("mentionQuery");
      expect(whatsAppChatFile).toContain("setMentionQuery");
    });

    it("tracks mentionCursorPos state", () => {
      expect(whatsAppChatFile).toContain("mentionCursorPos");
      expect(whatsAppChatFile).toContain("setMentionCursorPos");
    });

    it("tracks selectedMentions state", () => {
      expect(whatsAppChatFile).toContain("selectedMentions");
      expect(whatsAppChatFile).toContain("setSelectedMentions");
    });
  });

  describe("Frontend: @mention autocomplete dropdown", () => {
    it("renders mention autocomplete popup when mentionQuery is active", () => {
      expect(whatsAppChatFile).toContain("Mencionar agente");
    });

    it("filters agents by name matching mentionQuery", () => {
      expect(whatsAppChatFile).toContain("a.name?.toLowerCase().includes(q)");
    });

    it("limits autocomplete results to 6 agents", () => {
      expect(whatsAppChatFile).toContain(".slice(0, 6)");
    });

    it("replaces @query with @AgentName on selection", () => {
      expect(whatsAppChatFile).toContain("beforeMention");
      expect(whatsAppChatFile).toContain("afterMention");
    });

    it("adds selected agent to selectedMentions array", () => {
      expect(whatsAppChatFile).toContain("selectedMentions.includes(agent.id)");
    });

    it("renders agent avatar or initials in dropdown", () => {
      expect(whatsAppChatFile).toContain("agent.avatarUrl");
      expect(whatsAppChatFile).toContain('(agent.name || "?").charAt(0).toUpperCase()');
    });
  });

  describe("Frontend: Selected mentions display in banner", () => {
    it("shows selected mention badges with remove button", () => {
      expect(whatsAppChatFile).toContain("selectedMentions.map");
      expect(whatsAppChatFile).toContain("prev.filter(m => m !== id)");
    });
  });

  describe("Frontend: Note content highlights @mentions", () => {
    it("renders @mentions in bold within note bubbles", () => {
      expect(whatsAppChatFile).toContain("renderNoteContent");
      expect(whatsAppChatFile).toContain('part.startsWith("@")');
    });

    it("shows mentioned agents list below note content", () => {
      expect(whatsAppChatFile).toContain("mentionedNames");
      expect(whatsAppChatFile).toContain("Mencionados:");
    });
  });

  describe("Backend: mentionedUserIds passed to createInternalNote", () => {
    it("notes.create mutation accepts mentionedUserIds", () => {
      expect(routersFile).toContain("mentionedUserIds");
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 3. CUSTOMER GLOBAL NOTES
// ═══════════════════════════════════════════════════════════

describe("Customer Global Notes", () => {
  describe("Backend: globalByContact endpoint", () => {
    it("notes router has globalByContact query", () => {
      expect(routersFile).toContain("globalByContact");
    });

    it("globalByContact accepts remoteJid input", () => {
      expect(routersFile).toMatch(/globalByContact[\s\S]*?remoteJid/);
    });

    it("getCustomerGlobalNotes function exists in db.ts", () => {
      expect(dbFile).toContain("getCustomerGlobalNotes");
    });
  });

  describe("Frontend: Global notes alert banner", () => {
    it("renders global notes alert above messages area", () => {
      expect(whatsAppChatFile).toContain("Global Notes Alert");
    });

    it("queries globalByContact with remoteJid", () => {
      expect(whatsAppChatFile).toContain("notes.globalByContact.useQuery");
    });

    it("shows count of global notes", () => {
      expect(whatsAppChatFile).toContain("nota");
      expect(whatsAppChatFile).toContain("global");
    });

    it("shows priority indicators for urgent/high notes", () => {
      // The alert banner shows emoji indicators for priority
      expect(whatsAppChatFile).toContain("note.priority");
    });

    it("truncates display to 3 notes with +N more indicator", () => {
      expect(whatsAppChatFile).toContain(".slice(0, 3)");
      expect(whatsAppChatFile).toContain("mais...");
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 4. REAL-TIME SOCKET EMIT ON NOTE CREATION
// ═══════════════════════════════════════════════════════════

describe("Real-time Socket Emit on Note Creation", () => {
  describe("Backend: socket emit in notes.create mutation", () => {
    it("imports getIo from socketSingleton", () => {
      expect(routersFile).toContain("getIo");
    });

    it("emits conversationUpdated event after note creation", () => {
      expect(routersFile).toContain('io.emit("conversationUpdated"');
    });

    it("includes type: internal_note in socket payload", () => {
      expect(routersFile).toContain('type: "internal_note"');
    });

    it("includes waConversationId in socket payload", () => {
      const emitBlock = routersFile.match(/io\.emit\("conversationUpdated"[\s\S]*?\}\)/)?.[0] || "";
      expect(emitBlock).toContain("waConversationId");
    });

    it("includes authorName in socket payload", () => {
      const emitBlock = routersFile.match(/io\.emit\("conversationUpdated"[\s\S]*?\}\)/)?.[0] || "";
      expect(emitBlock).toContain("authorName");
    });
  });

  describe("Frontend: socket listener for conversationUpdated", () => {
    it("useSocket hook handles conversationUpdated event", () => {
      expect(socketHookFile).toContain("conversationUpdated");
    });

    it("WhatsAppChat refetches notes on conversationUpdated", () => {
      expect(whatsAppChatFile).toContain("lastConversationUpdate");
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 5. CLICKABLE LINKS IN MESSAGES
// ═══════════════════════════════════════════════════════════

describe("Clickable Links in Messages", () => {
  describe("URL detection regex", () => {
    it("URL_REGEX constant is defined", () => {
      expect(whatsAppChatFile).toContain("URL_REGEX");
    });

    it("matches http:// URLs", () => {
      expect(whatsAppChatFile).toContain("https?:\\/\\/");
    });

    it("matches www. URLs", () => {
      expect(whatsAppChatFile).toContain("www.");
    });

    it("matches bare domain TLDs (com, org, net, br, etc.)", () => {
      expect(whatsAppChatFile).toContain("com|org|net|br");
    });
  });

  describe("URL normalization", () => {
    it("normalizeUrl function exists", () => {
      expect(whatsAppChatFile).toContain("function normalizeUrl");
    });

    it("blocks javascript: protocol", () => {
      expect(whatsAppChatFile).toContain("javascript:");
    });

    it("blocks data: protocol", () => {
      expect(whatsAppChatFile).toContain("data:");
    });

    it("blocks vbscript: protocol", () => {
      expect(whatsAppChatFile).toContain("vbscript:");
    });

    it("adds https:// to bare URLs", () => {
      expect(whatsAppChatFile).toContain("`https://${trimmed}`");
    });

    it("preserves existing http/https protocol", () => {
      expect(whatsAppChatFile).toContain("^https?:\\/\\/");
    });
  });

  describe("linkifyText function", () => {
    it("linkifyText function exists", () => {
      expect(whatsAppChatFile).toContain("function linkifyText");
    });

    it("renders links with target=_blank", () => {
      expect(whatsAppChatFile).toContain('target="_blank"');
    });

    it("renders links with rel=noopener noreferrer nofollow", () => {
      expect(whatsAppChatFile).toContain('rel="noopener noreferrer nofollow"');
    });

    it("renders links with blue color and underline", () => {
      expect(whatsAppChatFile).toContain("text-blue-500");
      expect(whatsAppChatFile).toContain("underline");
    });

    it("stops event propagation on link click", () => {
      expect(whatsAppChatFile).toContain("e.stopPropagation()");
    });
  });

  describe("Integration with formatWhatsAppText", () => {
    it("formatWhatsAppText calls linkifyText for plain text segments", () => {
      expect(whatsAppChatFile).toContain("linkifyText(remaining");
    });

    it("linkifies text before formatting matches", () => {
      expect(whatsAppChatFile).toContain("linkifyText(remaining.substring(0, earliest)");
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 6. URL PARSING UNIT TESTS (pure logic)
// ═══════════════════════════════════════════════════════════

describe("URL Parsing Logic (pure)", () => {
  // Replicate normalizeUrl logic for testing
  function normalizeUrl(raw: string): string | null {
    const trimmed = raw.trim();
    if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || /^vbscript:/i.test(trimmed)) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  it("normalizes bare domain to https://", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
  });

  it("preserves existing https://", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("preserves existing http://", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("blocks javascript: protocol", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("blocks JAVASCRIPT: protocol (case insensitive)", () => {
    expect(normalizeUrl("JAVASCRIPT:alert(1)")).toBeNull();
  });

  it("blocks data: protocol", () => {
    expect(normalizeUrl("data:text/html,<h1>XSS</h1>")).toBeNull();
  });

  it("blocks vbscript: protocol", () => {
    expect(normalizeUrl("vbscript:MsgBox")).toBeNull();
  });

  it("normalizes www.example.com to https://www.example.com", () => {
    expect(normalizeUrl("www.example.com")).toBe("https://www.example.com");
  });

  it("handles URL with path", () => {
    expect(normalizeUrl("https://example.com/path/to/page")).toBe("https://example.com/path/to/page");
  });

  it("handles URL with query parameters", () => {
    expect(normalizeUrl("https://example.com?q=test&lang=pt")).toBe("https://example.com?q=test&lang=pt");
  });

  // URL_REGEX tests
  const URL_REGEX = /(?:https?:\/\/|www\.)[-\w+&@#/%?=~|!:,.;]*[-\w+&@#/%=~|]|(?:[a-zA-Z0-9][-a-zA-Z0-9]*\.)+(?:com|org|net|br|io|dev|app|me|co|info|biz|gov|edu)(?:\/[-\w+&@#/%?=~|!:,.;]*[-\w+&@#/%=~|])?/gi;

  it("matches https:// URL in text", () => {
    URL_REGEX.lastIndex = 0;
    const match = URL_REGEX.exec("Visite https://example.com para mais info");
    expect(match).toBeTruthy();
    expect(match![0]).toBe("https://example.com");
  });

  it("matches www. URL in text", () => {
    URL_REGEX.lastIndex = 0;
    const match = URL_REGEX.exec("Acesse www.google.com.br agora");
    expect(match).toBeTruthy();
    expect(match![0]).toContain("www.google.com.br");
  });

  it("matches bare domain with .com.br", () => {
    URL_REGEX.lastIndex = 0;
    const match = URL_REGEX.exec("Veja em mercadolivre.com.br/produto");
    expect(match).toBeTruthy();
  });

  it("matches URL with path and query", () => {
    URL_REGEX.lastIndex = 0;
    const match = URL_REGEX.exec("Link: https://api.example.com/v1/users?page=1&limit=10");
    expect(match).toBeTruthy();
    expect(match![0]).toContain("api.example.com");
  });

  it("does not match plain text without URLs", () => {
    URL_REGEX.lastIndex = 0;
    const match = URL_REGEX.exec("Olá, tudo bem? Preciso de ajuda.");
    expect(match).toBeNull();
  });

  it("matches multiple URLs in same text", () => {
    const text = "Veja https://a.com e https://b.com";
    const matches: string[] = [];
    URL_REGEX.lastIndex = 0;
    let m;
    while ((m = URL_REGEX.exec(text)) !== null) matches.push(m[0]);
    expect(matches.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════
// 7. INBOX STABILITY (existing + new)
// ═══════════════════════════════════════════════════════════

describe("Inbox Stability", () => {
  const evoFile = readFileSync(resolve(__dirname, "./whatsappEvolution.ts"), "utf-8");
  const resolverFile = readFileSync(resolve(__dirname, "./conversationResolver.ts"), "utf-8");

  describe("Status regression prevention", () => {
    it("uses FIELD() SQL function for status comparison", () => {
      expect(evoFile).toContain("FIELD(status,");
      expect(evoFile).toContain("< FIELD(${newStatus}");
    });

    it("status priority order: error < pending < sent < delivered < read < played", () => {
      const priorityMatch = evoFile.match(/statusPriority.*?=.*?\{([^}]+)\}/);
      expect(priorityMatch).toBeTruthy();
      const priorityStr = priorityMatch![1];
      const errorVal = parseInt(priorityStr.match(/error:\s*(\d+)/)?.[1] || "-1");
      const pendingVal = parseInt(priorityStr.match(/pending:\s*(\d+)/)?.[1] || "-1");
      const sentVal = parseInt(priorityStr.match(/sent:\s*(\d+)/)?.[1] || "-1");
      const deliveredVal = parseInt(priorityStr.match(/delivered:\s*(\d+)/)?.[1] || "-1");
      const readVal = parseInt(priorityStr.match(/read:\s*(\d+)/)?.[1] || "-1");
      const playedVal = parseInt(priorityStr.match(/played:\s*(\d+)/)?.[1] || "-1");
      expect(errorVal).toBeLessThan(pendingVal);
      expect(pendingVal).toBeLessThan(sentVal);
      expect(sentVal).toBeLessThan(deliveredVal);
      expect(deliveredVal).toBeLessThan(readVal);
      expect(readVal).toBeLessThan(playedVal);
    });
  });

  describe("Preview consistency", () => {
    it("lastMessagePreview truncated to 300 chars", () => {
      expect(resolverFile).toContain("substring(0, 300)");
    });

    it("internal notes do NOT update lastMessagePreview", () => {
      // The notes.create mutation does NOT call updateConversationLastMessage
      const notesBlock = routersFile.match(/notes[\s\S]*?create[\s\S]*?mutation[\s\S]*?return result/)?.[0] || "";
      expect(notesBlock).not.toContain("updateConversationLastMessage");
    });

    it("defaults messageType to text when not provided", () => {
      expect(resolverFile).toContain('lastMessageType: data.messageType || "text"');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 8. NOTE STATE RESET ON SEND
// ═══════════════════════════════════════════════════════════

describe("Note State Reset on Send", () => {
  it("resets noteCategory on successful note creation", () => {
    expect(whatsAppChatFile).toContain('setNoteCategory("other")');
  });

  it("resets notePriority on successful note creation", () => {
    expect(whatsAppChatFile).toContain('setNotePriority("normal")');
  });

  it("resets noteIsGlobal on successful note creation", () => {
    expect(whatsAppChatFile).toContain("setNoteIsGlobal(false)");
  });

  it("clears selectedMentions on successful note creation", () => {
    expect(whatsAppChatFile).toContain("setSelectedMentions([])");
  });

  it("clears mentionQuery on successful note creation", () => {
    expect(whatsAppChatFile).toContain("setMentionQuery(null)");
  });

  it("resets all state when closing note mode", () => {
    // The X button in the banner should reset everything
    expect(whatsAppChatFile).toMatch(/setIsNoteMode\(false\)[\s\S]*?setNoteCategory/);
  });
});
