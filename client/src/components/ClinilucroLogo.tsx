/**
 * Clinilucro brand assets.
 * Símbolo: C aberto (navy) + pulso cardíaco que vira seta ascendente (lime).
 * Light bg: navy + lime. Dark bg: white + lime.
 */

interface MarkProps {
  className?: string;
  /** When true, uses white "C" suited for dark backgrounds (pulse stays lime). */
  inverted?: boolean;
}

interface LogoProps extends MarkProps {
  /** When true, the wordmark "clini" becomes white (use over dark bg). "lucro" stays lime. */
  textInverted?: boolean;
  /** When true, hides "CRM PARA CLÍNICAS" tagline below the wordmark. */
  hideTagline?: boolean;
}

const NAVY = "#0F172A";
const LIME = "#65A30D";

export function ClinilucroMark({ className = "h-6 w-auto", inverted = false }: MarkProps) {
  const arcColor = inverted ? "#FFFFFF" : NAVY;
  const pulseColor = LIME;

  return (
    <svg viewBox="60 20 220 110" className={className} fill="none" aria-hidden="true">
      <g transform="translate(0, 60)">
        <path
          d="M 130 60 A 60 60 0 1 0 130 -60"
          stroke={arcColor}
          strokeWidth="16"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M 130 60 L 156 60 L 170 44 L 184 78 L 202 30 L 226 60 L 268 60"
        stroke={pulseColor}
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 250 42 L 268 60 L 250 78"
        stroke={pulseColor}
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ClinilucroLogo({
  className = "h-6",
  inverted = false,
  textInverted = false,
  hideTagline = true,
}: LogoProps) {
  const cliniColor = textInverted ? "text-white" : "text-slate-900 dark:text-white";
  const lucroStyle = { color: LIME };
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <ClinilucroMark className="h-full w-auto" inverted={inverted} />
      <span className="inline-flex flex-col leading-none">
        <span className={`font-semibold tracking-tight ${cliniColor} text-[1em]`} style={{ fontSize: "1.05em" }}>
          clini
          <span className="font-extrabold" style={lucroStyle}>
            lucro
          </span>
        </span>
        {!hideTagline && (
          <span
            className={`mt-0.5 text-[0.42em] font-medium tracking-[0.3em] ${
              textInverted ? "text-slate-300" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            CRM PARA CLÍNICAS
          </span>
        )}
      </span>
    </span>
  );
}

export function ClinilucroStacked({
  className = "h-16",
  inverted = false,
  textInverted = false,
}: LogoProps) {
  const cliniColor = textInverted ? "text-white" : "text-slate-900 dark:text-white";
  const lucroStyle = { color: LIME };
  return (
    <span className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <ClinilucroMark className="h-[55%] w-auto" inverted={inverted} />
      <span className="inline-flex flex-col items-center leading-none">
        <span className={`font-semibold tracking-tight text-[1.5em] ${cliniColor}`}>
          clini
          <span className="font-extrabold" style={lucroStyle}>
            lucro
          </span>
        </span>
        <span
          className={`mt-1 text-[0.55em] font-medium tracking-[0.35em] ${
            textInverted ? "text-slate-300" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          CRM PARA CLÍNICAS
        </span>
      </span>
    </span>
  );
}
