import { useTheme } from "@/contexts/ThemeContext";

const LOGO_DARK = "https://d2xsxph8kpxj0f.cloudfront.net/310519663249817763/EKvcVicuVoUxTnzjSKzgdk/logo-dark-theme_021f3cb2.webp";
const LOGO_LIGHT = "https://d2xsxph8kpxj0f.cloudfront.net/310519663249817763/EKvcVicuVoUxTnzjSKzgdk/logo-light-theme_c316c6d0.webp";

interface ThemedLogoProps {
  className?: string;
  /** Force a specific variant regardless of theme */
  variant?: "light" | "dark";
}

export function ThemedLogo({ className = "h-5 object-contain", variant }: ThemedLogoProps) {
  const { theme } = useTheme();
  const effectiveTheme = variant || theme;
  const src = effectiveTheme === "dark" ? LOGO_DARK : LOGO_LIGHT;

  return <img src={src} alt="ENTUR OS" className={className} />;
}

/** Use outside ThemeProvider (landing page, login, etc.) — always dark bg */
export function StaticLogo({ className = "h-5 object-contain", variant = "dark" }: ThemedLogoProps) {
  const src = variant === "dark" ? LOGO_DARK : LOGO_LIGHT;
  return <img src={src} alt="ENTUR OS" className={className} />;
}

export { LOGO_DARK, LOGO_LIGHT };
