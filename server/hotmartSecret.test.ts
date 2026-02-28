import { describe, expect, it } from "vitest";

describe("Hotmart Secret Configuration", () => {
  it("HOTMART_HOTTOK environment variable is set", () => {
    const hottok = process.env.HOTMART_HOTTOK;
    expect(hottok).toBeDefined();
    expect(typeof hottok).toBe("string");
    expect(hottok!.length).toBeGreaterThan(0);
  });

  it("HOTMART_HOTTOK is not a placeholder value", () => {
    const hottok = process.env.HOTMART_HOTTOK;
    expect(hottok).not.toBe("your_hottok_here");
    expect(hottok).not.toBe("placeholder");
    expect(hottok).not.toBe("test");
  });
});
