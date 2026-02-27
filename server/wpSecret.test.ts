import { describe, expect, it } from "vitest";

describe("WP_SECRET Environment Variable", () => {
  it("WP_SECRET is configured and not empty", () => {
    const wpSecret = process.env.WP_SECRET;
    expect(wpSecret).toBeDefined();
    expect(typeof wpSecret).toBe("string");
    expect(wpSecret!.length).toBeGreaterThan(0);
  });

  it("WP_SECRET is accessible via ENV helper", async () => {
    const { ENV } = await import("./_core/env");
    expect(ENV.wpSecret).toBeDefined();
    expect(typeof ENV.wpSecret).toBe("string");
    expect(ENV.wpSecret.length).toBeGreaterThan(0);
  });
});
