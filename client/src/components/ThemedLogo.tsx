import { ClinilucroLogo, ClinilucroMark } from "./ClinilucroLogo";
import { useTheme } from "@/contexts/ThemeContext";

interface ThemedLogoProps {
  className?: string;
  /** Force a specific variant regardless of theme */
  variant?: "light" | "dark";
  /** Render only the symbol mark (no wordmark). */
  markOnly?: boolean;
}

/**
 * Theme-aware Clinilucro logo. Replaces the previous CDN <img> implementation.
 * On dark backgrounds, the mark uses a brighter mint→lime gradient and the
 * wordmark renders in white. On light backgrounds, the mark uses the deeper
 * emerald→lime gradient and the wordmark renders in slate-900.
 */
export function ThemedLogo({ className = "h-5", variant, markOnly = false }: ThemedLogoProps) {
  const { theme } = useTheme();
  const effectiveTheme = variant || theme;
  const isDark = effectiveTheme === "dark";

  if (markOnly) {
    return <ClinilucroMark className={className} inverted={isDark} />;
  }

  return <ClinilucroLogo className={className} inverted={isDark} textInverted={isDark} />;
}

/** Use outside ThemeProvider (landing page, login, etc.) — defaults to dark variant suitable for dark hero backgrounds. */
export function StaticLogo({ className = "h-5", variant = "dark", markOnly = false }: ThemedLogoProps) {
  const isDark = variant === "dark";
  if (markOnly) {
    return <ClinilucroMark className={className} inverted={isDark} />;
  }
  return <ClinilucroLogo className={className} inverted={isDark} textInverted={isDark} />;
}
