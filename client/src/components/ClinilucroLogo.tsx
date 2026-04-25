/**
 * Clinilucro brand assets.
 * Symbol = C aberto + pulso cardíaco que vira seta ascendente.
 * Cores: gradiente esmeralda → mint → lima.
 */

interface MarkProps {
  className?: string;
  /** When true, uses light/white gradient suited for dark backgrounds. */
  inverted?: boolean;
}

interface LogoProps extends MarkProps {
  /** When true, the wordmark text becomes white (use over dark bg). */
  textInverted?: boolean;
  /** When true, hides "CRM PARA CLÍNICAS" tagline below the wordmark. */
  hideTagline?: boolean;
}

let gradientCounter = 0;
function uid(prefix: string) {
  // Deterministic per-render is fine — collisions across instances handled by useId in callsites if needed.
  gradientCounter += 1;
  return `${prefix}-${gradientCounter}`;
}

export function ClinilucroMark({ className = "h-6 w-auto", inverted = false }: MarkProps) {
  const gid = uid("cl-mark");
  // Light gradient for dark backgrounds; brand gradient otherwise.
  const stops = inverted
    ? [
        { offset: "0%", color: "#10B981" },
        { offset: "100%", color: "#A3E635" },
      ]
    : [
        { offset: "0%", color: "#047857" },
        { offset: "55%", color: "#10B981" },
        { offset: "100%", color: "#84CC16" },
      ];

  return (
    <svg viewBox="60 20 220 110" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          {stops.map((s) => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <g transform="translate(0, 60)">
        <path
          d="M 130 60 A 60 60 0 1 0 130 -60"
          stroke={`url(#${gid})`}
          strokeWidth="16"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M 130 60 L 156 60 L 170 44 L 184 78 L 202 30 L 226 60 L 268 60"
        stroke={`url(#${gid})`}
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 250 42 L 268 60 L 250 78"
        stroke={`url(#${gid})`}
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
  const baseText = textInverted ? "text-white" : "text-slate-900 dark:text-white";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <ClinilucroMark className="h-full w-auto" inverted={inverted} />
      <span className="inline-flex flex-col leading-none">
        <span className={`font-semibold tracking-tight ${baseText} text-[1em]`} style={{ fontSize: "1.05em" }}>
          clini
          <span className="font-extrabold bg-gradient-to-r from-[#059669] to-[#65A30D] bg-clip-text text-transparent">
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
  const baseText = textInverted ? "text-white" : "text-slate-900 dark:text-white";
  return (
    <span className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <ClinilucroMark className="h-[55%] w-auto" inverted={inverted} />
      <span className="inline-flex flex-col items-center leading-none">
        <span className={`font-semibold tracking-tight text-[1.5em] ${baseText}`}>
          clini
          <span className="font-extrabold bg-gradient-to-r from-[#059669] to-[#65A30D] bg-clip-text text-transparent">
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
