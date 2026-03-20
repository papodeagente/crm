import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Avatar Responsiveness Tests
 * Ensures the user avatar in the TopBar never disappears
 * when the window is not fullscreen.
 */

const topNavSrc = readFileSync(
  resolve(__dirname, "../client/src/components/TopNavLayout.tsx"),
  "utf-8"
);

describe("Avatar Responsiveness — TopBar Layout", () => {
  it("Right actions block must have shrink-0 to prevent collapsing", () => {
    // The div wrapping bell, settings, avatar must not shrink
    const rightActionsMatch = topNavSrc.match(/\{\/\* Right actions \*\/\}\s*<div className="([^"]+)"/);
    expect(rightActionsMatch).toBeTruthy();
    expect(rightActionsMatch![1]).toContain("shrink-0");
  });

  it("Avatar button must have shrink-0 to prevent collapsing", () => {
    // Find the avatar trigger button
    const avatarButtonIdx = topNavSrc.indexOf("User avatar");
    expect(avatarButtonIdx).toBeGreaterThan(-1);
    const avatarBlock = topNavSrc.slice(avatarButtonIdx, avatarButtonIdx + 300);
    expect(avatarBlock).toContain("shrink-0");
  });

  it("Desktop nav must allow overflow to prevent pushing avatar out", () => {
    // The nav should have overflow handling
    const navMatch = topNavSrc.match(/\{\/\* Desktop Nav \*\/\}\s*<nav className="([^"]+)"/);
    expect(navMatch).toBeTruthy();
    expect(navMatch![1]).toContain("overflow-x-auto");
    expect(navMatch![1]).toContain("min-w-0");
  });

  it("Search bar must be shrinkable to yield space for avatar", () => {
    // Search button should have shrink (not shrink-0) and a min-width
    const searchMatch = topNavSrc.match(/\{\/\* Search \*\/\}\s*<button[^>]*className="([^"]+)"/);
    expect(searchMatch).toBeTruthy();
    const classes = searchMatch![1];
    expect(classes).toContain("shrink");
    expect(classes).not.toContain("shrink-0");
    expect(classes).toContain("min-w-[");
  });

  it("Avatar must NOT have any responsive hidden class", () => {
    // The avatar should never be hidden at any breakpoint
    const avatarIdx = topNavSrc.indexOf("User avatar");
    const avatarBlock = topNavSrc.slice(avatarIdx, avatarIdx + 500);
    expect(avatarBlock).not.toMatch(/\bhidden\b/);
    expect(avatarBlock).not.toMatch(/\bsm:hidden\b/);
    expect(avatarBlock).not.toMatch(/\bmd:hidden\b/);
    expect(avatarBlock).not.toMatch(/\blg:hidden\b/);
  });

  it("Avatar must always render regardless of screen size", () => {
    // The Avatar component should exist without conditional responsive wrappers
    expect(topNavSrc).toContain('<Avatar className="h-8 w-8">');
  });
});

describe("Avatar Responsiveness — No Regression", () => {
  it("Header must still have sticky positioning", () => {
    expect(topNavSrc).toContain("sticky top-0");
  });

  it("Mobile hamburger must still exist for md:hidden", () => {
    expect(topNavSrc).toContain("md:hidden");
    expect(topNavSrc).toContain("onToggleMobile");
  });

  it("User dropdown menu must still contain Super Admin option", () => {
    expect(topNavSrc).toContain("Super Admin");
    expect(topNavSrc).toContain("isSuperAdmin");
  });

  it("User dropdown menu must still contain logout option", () => {
    expect(topNavSrc).toContain("Sair");
    expect(topNavSrc).toContain("logout");
  });
});
