/**
 * Clinilucro brand assets — Neon Edition.
 *
 * Identidade:
 *   - Wordmark "clinilucro" em Inter Light (200), letter-spacing apertado.
 *   - Acento verde lima (#5A8A1F) na sílaba "lucro" — legível em fundo branco.
 *   - Glow sutil em fundo escuro (text-shadow).
 *
 * Uso:
 *   - <ClinilucroLogo />: wordmark com acento (default — recomendado para dashboard/leitura).
 *   - <ClinilucroLogo variant="mono" />: wordmark inteiro em neon (impacto/marketing).
 *   - <ClinilucroMark />: símbolo compacto (favicon, avatar, app icon).
 */

interface MarkProps {
  className?: string;
  inverted?: boolean;
}

interface LogoProps extends MarkProps {
  /** "accent" (default): clini base + lucro neon. "mono": tudo em neon. */
  variant?: "accent" | "mono";
  textInverted?: boolean;
  hideTagline?: boolean;
}

// Verde primário — versão escura, legível em fundo branco. Passa WCAG AA.
export const NEON = "#5A8A1F";
export const BLACK = "#0A0A0A";
const GLOW_TEXT_SHADOW =
  "0 0 20px rgba(90, 138, 31, 0.45), 0 0 40px rgba(90, 138, 31, 0.20)";
const GLOW_TEXT_SHADOW_SOFT =
  "0 0 12px rgba(90, 138, 31, 0.35)";

/**
 * Símbolo compacto: bloco arredondado neon com letra "L" em preto.
 * Usado em favicon, app icon, situações sem espaço para wordmark.
 */
export function ClinilucroMark({ className = "h-6 w-auto", inverted = false }: MarkProps) {
  // inverted=true → fundo preto com "L" neon. Caso contrário: fundo neon + "L" preto.
  const bg = inverted ? BLACK : NEON;
  const fg = inverted ? NEON : BLACK;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="2" y="2" width="60" height="60" rx="14" fill={bg} />
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight={300}
        fontSize="42"
        letterSpacing="-2"
        fill={fg}
      >
        l
      </text>
    </svg>
  );
}

/**
 * Wordmark Clinilucro — Inter Light, com acento neon na sílaba "lucro".
 * Em fundo escuro (textInverted), aplica glow no acento.
 */
export function ClinilucroLogo({
  className = "h-6",
  variant = "accent",
  textInverted = false,
  hideTagline = true,
}: LogoProps) {
  const baseColor = textInverted ? "#FAFAFA" : BLACK;
  const accentStyle: React.CSSProperties = {
    color: NEON,
    fontWeight: 200,
    letterSpacing: "-0.05em",
    ...(textInverted ? { textShadow: GLOW_TEXT_SHADOW } : {}),
  };
  const baseStyle: React.CSSProperties = {
    color: variant === "mono" ? NEON : baseColor,
    fontWeight: 200,
    letterSpacing: "-0.05em",
    ...(variant === "mono" && textInverted ? { textShadow: GLOW_TEXT_SHADOW } : {}),
  };

  return (
    <span
      className={`inline-flex flex-col leading-none ${className}`}
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <span className="text-[1em]" style={{ fontSize: "1.6em" }}>
        <span style={baseStyle}>clini</span>
        <span style={variant === "accent" ? accentStyle : baseStyle}>lucro</span>
      </span>
      {!hideTagline && (
        <span
          className="mt-1 text-[0.42em] tracking-[0.3em]"
          style={{
            color: textInverted ? "#9CA3AF" : "#5A8A1F",
            fontWeight: 500,
          }}
        >
          CRM PARA CLÍNICAS
        </span>
      )}
    </span>
  );
}

/** Versão empilhada (mark + wordmark verticalmente). Usada em telas vazias e onboarding. */
export function ClinilucroStacked({
  className = "h-16",
  variant = "accent",
  inverted = false,
  textInverted = false,
}: LogoProps) {
  return (
    <span className={`inline-flex flex-col items-center gap-3 ${className}`}>
      <ClinilucroMark className="h-[45%] w-auto" inverted={inverted} />
      <ClinilucroLogo
        className="h-[45%]"
        variant={variant}
        textInverted={textInverted}
        hideTagline={false}
      />
    </span>
  );
}
