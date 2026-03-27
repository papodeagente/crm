import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

describe("Logo Update — enturOS CRM", () => {
  const themedLogoCode = readFileSync(join(ROOT, "client/src/components/ThemedLogo.tsx"), "utf-8");
  const indexHtml = readFileSync(join(ROOT, "client/index.html"), "utf-8");

  // ─── New CDN URLs ───
  const NEW_LOGO_DARK = "logo-dark_2e24a3dc.webp";   // Logo preta (fundo claro)
  const NEW_LOGO_LIGHT = "logo-light_c3efa809.webp";  // Logo branca (fundo escuro)
  const NEW_FAVICON_PNG = "favicon_c3ca1d5d.png";
  const NEW_FAVICON_ICO = "favicon_319af43d.ico";
  const NEW_FAVICON_WEBP = "favicon_9bd1f9e0.webp";

  // ─── Old URLs that should NOT exist ───
  const OLD_LOGO_DARK = "logo-dark-theme_021f3cb2.webp";
  const OLD_LOGO_LIGHT = "logo-light-theme_c316c6d0.webp";
  const OLD_ICON = "OSICON_03b1c322.webp";

  describe("ThemedLogo component", () => {
    it("should use the new dark logo (preta) for LOGO_LIGHT (light theme)", () => {
      expect(themedLogoCode).toContain(NEW_LOGO_DARK);
    });

    it("should use the new light logo (branca) for LOGO_DARK (dark theme)", () => {
      expect(themedLogoCode).toContain(NEW_LOGO_LIGHT);
    });

    it("should NOT reference old logo URLs", () => {
      expect(themedLogoCode).not.toContain(OLD_LOGO_DARK);
      expect(themedLogoCode).not.toContain(OLD_LOGO_LIGHT);
    });
  });

  describe("Favicon in index.html", () => {
    it("should use the new PNG favicon", () => {
      expect(indexHtml).toContain(NEW_FAVICON_PNG);
    });

    it("should use the new ICO favicon", () => {
      expect(indexHtml).toContain(NEW_FAVICON_ICO);
    });

    it("should NOT reference the old OSICON", () => {
      expect(indexHtml).not.toContain(OLD_ICON);
    });
  });

  describe("No old URLs or favicon icons in landing pages", () => {
    const landingFiles = [
      "client/src/components/landing/HeroSection.tsx",
      "client/src/components/landing/FinalCTA.tsx",
      "client/src/components/landing/PricingSection.tsx",
    ];

    for (const file of landingFiles) {
      it(`${file} should not contain old logo URLs`, () => {
        const code = readFileSync(join(ROOT, file), "utf-8");
        expect(code).not.toContain(OLD_LOGO_DARK);
        expect(code).not.toContain(OLD_LOGO_LIGHT);
        expect(code).not.toContain(OLD_ICON);
      });

      it(`${file} should NOT have favicon icon inline (favicon only in browser tab)`, () => {
        const code = readFileSync(join(ROOT, file), "utf-8");
        expect(code).not.toContain(NEW_FAVICON_WEBP);
      });
    }
  });

  describe("Login/Register pages", () => {
    const authFiles = [
      "client/src/pages/SaasLogin.tsx",
      "client/src/pages/SaasRegister.tsx",
    ];

    for (const file of authFiles) {
      it(`${file} should not contain old URLs`, () => {
        const code = readFileSync(join(ROOT, file), "utf-8");
        expect(code).not.toContain(OLD_LOGO_DARK);
        expect(code).not.toContain(OLD_LOGO_LIGHT);
        expect(code).not.toContain(OLD_ICON);
      });
    }
  });
});
