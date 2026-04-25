import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MousePointer, PenTool, Pencil, Eraser, Plus, Undo2 } from "lucide-react";

interface FaceMapProps {
  selectedRegions: string[];
  onToggleRegion: (id: string) => void;
  showUnits: boolean;
}

export const FACE_REGIONS = [
  { id: "testa", label: "Testa" },
  { id: "glabela", label: "Glabela" },
  { id: "temporal_esq", label: "Temporal E" },
  { id: "temporal_dir", label: "Temporal D" },
  { id: "periorbital_esq", label: "Periorbital E" },
  { id: "periorbital_dir", label: "Periorbital D" },
  { id: "nariz", label: "Nariz" },
  { id: "malar_esq", label: "Malar E" },
  { id: "malar_dir", label: "Malar D" },
  { id: "sulco_esq", label: "Sulco Nasogeniano E" },
  { id: "sulco_dir", label: "Sulco Nasogeniano D" },
  { id: "labio_sup", label: "Lábio Superior" },
  { id: "labio_inf", label: "Lábio Inferior" },
  { id: "mentual", label: "Mento" },
  { id: "mandibula_esq", label: "Mandíbula E" },
  { id: "mandibula_dir", label: "Mandíbula D" },
  { id: "papada", label: "Papada" },
];

export default function FaceMap({ selectedRegions, onToggleRegion, showUnits }: FaceMapProps) {
  const isSelected = (id: string) => selectedRegions.includes(id);
  const regionFill = (id: string) => isSelected(id) ? "rgba(46,125,91,0.35)" : "rgba(255,255,255,0)";
  const regionStroke = (id: string) => isSelected(id) ? "#2E7D5B" : "rgba(255,255,255,0.6)";
  const regionStrokeW = (id: string) => isSelected(id) ? "1.8" : "0.8";

  return (
    <div className="flex gap-4">
      {/* Drawing tools */}
      <div className="flex flex-col gap-1.5 pt-2">
        {[
          { icon: MousePointer, title: "Selecionar" },
          { icon: PenTool, title: "Caneta" },
          { icon: Pencil, title: "Lápis" },
          { icon: Eraser, title: "Borracha" },
          { icon: Plus, title: "Adicionar" },
          { icon: Undo2, title: "Desfazer" },
        ].map((tool, i) => (
          <button
            key={i}
            title={tool.title}
            className="h-7 w-7 rounded border border-border/50 flex items-center justify-center hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <tool.icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      {/* Face diagram */}
      <div className="flex-1 flex justify-center">
        <svg viewBox="0 0 400 520" className="w-full max-w-sm" style={{ maxHeight: 480 }}>
          <defs>
            {/* Skin gradient */}
            <radialGradient id="skinGrad" cx="50%" cy="42%" r="55%">
              <stop offset="0%" stopColor="#f5dcc3" />
              <stop offset="60%" stopColor="#e8c9a8" />
              <stop offset="100%" stopColor="#d4a982" />
            </radialGradient>
            {/* Shadow */}
            <radialGradient id="shadowGrad" cx="50%" cy="60%" r="50%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.08)" />
            </radialGradient>
            {/* Lip gradient */}
            <linearGradient id="lipGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4878f" />
              <stop offset="100%" stopColor="#c47a82" />
            </linearGradient>
            {/* Eye gradient */}
            <radialGradient id="irisGrad" cx="45%" cy="45%" r="50%">
              <stop offset="0%" stopColor="#7a9e6e" />
              <stop offset="70%" stopColor="#5a7e4e" />
              <stop offset="100%" stopColor="#3a5e2e" />
            </radialGradient>
            {/* Hair gradient */}
            <linearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b6f47" />
              <stop offset="50%" stopColor="#7a5e3a" />
              <stop offset="100%" stopColor="#6a4e2d" />
            </linearGradient>
            <filter id="softShadow" x="-5%" y="-5%" width="110%" height="110%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feOffset dx="0" dy="2" result="shadow" />
              <feFlood floodColor="rgba(0,0,0,0.15)" />
              <feComposite in2="shadow" operator="in" />
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Background */}
          <rect width="400" height="520" fill="#f0ede8" rx="12" />

          {/* Neck */}
          <path d="M 160,395 Q 162,440 155,490 L 245,490 Q 238,440 240,395" fill="url(#skinGrad)" />
          <path d="M 160,395 Q 162,440 155,490 L 245,490 Q 238,440 240,395" fill="rgba(0,0,0,0.03)" />

          {/* Face shape */}
          <path
            d="M 200,55 Q 120,55 95,130 Q 80,180 85,220 Q 88,260 105,300 Q 125,345 155,375 Q 175,395 200,400 Q 225,395 245,375 Q 275,345 295,300 Q 312,260 315,220 Q 320,180 305,130 Q 280,55 200,55"
            fill="url(#skinGrad)"
            filter="url(#softShadow)"
          />
          {/* Face shading */}
          <path
            d="M 200,55 Q 120,55 95,130 Q 80,180 85,220 Q 88,260 105,300 Q 125,345 155,375 Q 175,395 200,400 Q 225,395 245,375 Q 275,345 295,300 Q 312,260 315,220 Q 320,180 305,130 Q 280,55 200,55"
            fill="url(#shadowGrad)"
          />

          {/* Hair */}
          <path
            d="M 200,20 Q 100,20 78,100 Q 72,130 80,155 Q 90,125 95,105 Q 110,55 200,50 Q 290,55 305,105 Q 310,125 320,155 Q 328,130 322,100 Q 300,20 200,20"
            fill="url(#hairGrad)"
          />
          {/* Hair top */}
          <path
            d="M 200,15 Q 130,12 95,40 Q 75,58 72,90 Q 78,55 105,38 Q 140,20 200,18 Q 260,20 295,38 Q 322,55 328,90 Q 325,58 305,40 Q 270,12 200,15"
            fill="url(#hairGrad)"
          />
          {/* Hair sides */}
          <path d="M 78,100 Q 72,140 75,165 Q 80,155 82,130 Q 84,110 78,100" fill="url(#hairGrad)" opacity="0.8" />
          <path d="M 322,100 Q 328,140 325,165 Q 320,155 318,130 Q 316,110 322,100" fill="url(#hairGrad)" opacity="0.8" />

          {/* ═══ Eyebrows ═══ */}
          <path d="M 125,160 Q 140,148 165,150 Q 172,151 178,155" fill="none" stroke="#7a5e3a" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M 222,155 Q 228,151 235,150 Q 260,148 275,160" fill="none" stroke="#7a5e3a" strokeWidth="3.5" strokeLinecap="round" />

          {/* ═══ Eyes ═══ */}
          {/* Left eye */}
          <path d="M 130,182 Q 152,170 175,182 Q 152,192 130,182" fill="white" stroke="#c4a080" strokeWidth="0.5" />
          <circle cx="152" cy="181" r="8" fill="url(#irisGrad)" />
          <circle cx="152" cy="181" r="4.5" fill="#1a1a1a" />
          <circle cx="149" cy="178" r="2" fill="white" opacity="0.8" />
          <path d="M 130,182 Q 152,170 175,182" fill="none" stroke="#6a4e2d" strokeWidth="1.2" />
          <path d="M 130,182 Q 152,192 175,182" fill="none" stroke="#c4a080" strokeWidth="0.5" />
          {/* Left eyelashes */}
          <path d="M 130,182 Q 128,178 127,175" fill="none" stroke="#4a3520" strokeWidth="0.8" />
          <path d="M 140,176 Q 138,173 137,170" fill="none" stroke="#4a3520" strokeWidth="0.6" />
          <path d="M 152,174 Q 152,171 153,168" fill="none" stroke="#4a3520" strokeWidth="0.6" />
          <path d="M 164,176 Q 166,173 168,171" fill="none" stroke="#4a3520" strokeWidth="0.6" />

          {/* Right eye */}
          <path d="M 225,182 Q 248,170 270,182 Q 248,192 225,182" fill="white" stroke="#c4a080" strokeWidth="0.5" />
          <circle cx="248" cy="181" r="8" fill="url(#irisGrad)" />
          <circle cx="248" cy="181" r="4.5" fill="#1a1a1a" />
          <circle cx="245" cy="178" r="2" fill="white" opacity="0.8" />
          <path d="M 225,182 Q 248,170 270,182" fill="none" stroke="#6a4e2d" strokeWidth="1.2" />
          <path d="M 225,182 Q 248,192 270,182" fill="none" stroke="#c4a080" strokeWidth="0.5" />
          {/* Right eyelashes */}
          <path d="M 270,182 Q 272,178 273,175" fill="none" stroke="#4a3520" strokeWidth="0.8" />
          <path d="M 260,176 Q 262,173 263,170" fill="none" stroke="#4a3520" strokeWidth="0.6" />
          <path d="M 248,174 Q 248,171 247,168" fill="none" stroke="#4a3520" strokeWidth="0.6" />
          <path d="M 236,176 Q 234,173 232,171" fill="none" stroke="#4a3520" strokeWidth="0.6" />

          {/* ═══ Nose ═══ */}
          <path d="M 195,175 Q 192,230 185,265 Q 190,272 200,275 Q 210,272 215,265 Q 208,230 205,175" fill="none" stroke="#c4a080" strokeWidth="0.8" />
          <path d="M 185,265 Q 178,268 175,262" fill="none" stroke="#c4a080" strokeWidth="0.8" />
          <path d="M 215,265 Q 222,268 225,262" fill="none" stroke="#c4a080" strokeWidth="0.8" />
          {/* Nose shadow */}
          <ellipse cx="188" cy="267" rx="6" ry="4" fill="rgba(0,0,0,0.04)" />
          <ellipse cx="212" cy="267" rx="6" ry="4" fill="rgba(0,0,0,0.04)" />

          {/* ═══ Lips ═══ */}
          {/* Upper lip */}
          <path
            d="M 170,310 Q 180,300 190,305 Q 200,295 210,305 Q 220,300 230,310 Q 215,315 200,313 Q 185,315 170,310"
            fill="url(#lipGrad)"
            stroke="#b06a72"
            strokeWidth="0.5"
          />
          {/* Lower lip */}
          <path
            d="M 170,310 Q 185,315 200,313 Q 215,315 230,310 Q 225,330 200,335 Q 175,330 170,310"
            fill="url(#lipGrad)"
            stroke="#b06a72"
            strokeWidth="0.5"
          />
          {/* Lip line */}
          <path d="M 172,310 Q 200,315 228,310" fill="none" stroke="#a0606a" strokeWidth="0.6" />

          {/* ═══ TREATMENT GUIDE LINES (white) ═══ */}
          {/* Forehead horizontal lines */}
          <path d="M 125,100 Q 200,93 275,100" fill="none" stroke="white" strokeWidth="1" opacity="0.7" />
          <path d="M 120,115 Q 200,108 280,115" fill="none" stroke="white" strokeWidth="1" opacity="0.6" />
          <path d="M 118,130 Q 200,123 282,130" fill="none" stroke="white" strokeWidth="1" opacity="0.5" />
          <path d="M 120,145 Q 200,140 280,145" fill="none" stroke="white" strokeWidth="0.8" opacity="0.4" />

          {/* Glabela vertical lines */}
          <path d="M 190,105 L 188,155" fill="none" stroke="white" strokeWidth="0.8" opacity="0.5" />
          <path d="M 210,105 L 212,155" fill="none" stroke="white" strokeWidth="0.8" opacity="0.5" />

          {/* Crow's feet - left */}
          <path d="M 120,175 Q 110,170 100,168" fill="none" stroke="white" strokeWidth="0.8" opacity="0.6" />
          <path d="M 122,180 Q 108,178 95,178" fill="none" stroke="white" strokeWidth="0.8" opacity="0.5" />
          <path d="M 120,185 Q 110,188 100,192" fill="none" stroke="white" strokeWidth="0.8" opacity="0.6" />

          {/* Crow's feet - right */}
          <path d="M 280,175 Q 290,170 300,168" fill="none" stroke="white" strokeWidth="0.8" opacity="0.6" />
          <path d="M 278,180 Q 292,178 305,178" fill="none" stroke="white" strokeWidth="0.8" opacity="0.5" />
          <path d="M 280,185 Q 290,188 300,192" fill="none" stroke="white" strokeWidth="0.8" opacity="0.6" />

          {/* Nasolabial folds */}
          <path d="M 172,260 Q 158,285 160,310" fill="none" stroke="white" strokeWidth="1" opacity="0.6" />
          <path d="M 228,260 Q 242,285 240,310" fill="none" stroke="white" strokeWidth="1" opacity="0.6" />

          {/* Cheek circles */}
          <circle cx="135" cy="240" r="28" fill="none" stroke="white" strokeWidth="1" opacity="0.5" />
          <circle cx="265" cy="240" r="28" fill="none" stroke="white" strokeWidth="1" opacity="0.5" />

          {/* Jawline */}
          <path d="M 95,280 Q 105,345 155,380 Q 178,395 200,400" fill="none" stroke="white" strokeWidth="1" opacity="0.5" />
          <path d="M 305,280 Q 295,345 245,380 Q 222,395 200,400" fill="none" stroke="white" strokeWidth="1" opacity="0.5" />

          {/* Chin line */}
          <path d="M 170,365 Q 200,385 230,365" fill="none" stroke="white" strokeWidth="0.8" opacity="0.4" />

          {/* Neck lines */}
          <path d="M 155,410 Q 200,405 245,410" fill="none" stroke="white" strokeWidth="0.8" opacity="0.3" />
          <path d="M 150,425 Q 200,418 250,425" fill="none" stroke="white" strokeWidth="0.8" opacity="0.25" />

          {/* ═══ CLICKABLE REGIONS (transparent overlays) ═══ */}
          {/* Testa */}
          <path
            d="M 120,80 Q 200,70 280,80 Q 285,100 282,140 Q 200,130 118,140 Q 115,100 120,80"
            fill={regionFill("testa")} stroke={regionStroke("testa")} strokeWidth={regionStrokeW("testa")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("testa")}
          />
          {/* Glabela */}
          <path
            d="M 180,140 L 220,140 L 218,170 L 182,170 Z"
            fill={regionFill("glabela")} stroke={regionStroke("glabela")} strokeWidth={regionStrokeW("glabela")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("glabela")}
          />
          {/* Temporal E */}
          <path
            d="M 85,130 Q 90,160 92,190 L 125,185 Q 120,160 118,135 Z"
            fill={regionFill("temporal_esq")} stroke={regionStroke("temporal_esq")} strokeWidth={regionStrokeW("temporal_esq")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("temporal_esq")}
          />
          {/* Temporal D */}
          <path
            d="M 315,130 Q 310,160 308,190 L 275,185 Q 280,160 282,135 Z"
            fill={regionFill("temporal_dir")} stroke={regionStroke("temporal_dir")} strokeWidth={regionStrokeW("temporal_dir")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("temporal_dir")}
          />
          {/* Periorbital E */}
          <path
            d="M 118,165 Q 140,158 178,165 Q 178,195 140,200 Q 115,195 118,165"
            fill={regionFill("periorbital_esq")} stroke={regionStroke("periorbital_esq")} strokeWidth={regionStrokeW("periorbital_esq")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("periorbital_esq")}
          />
          {/* Periorbital D */}
          <path
            d="M 222,165 Q 260,158 282,165 Q 285,195 260,200 Q 222,195 222,165"
            fill={regionFill("periorbital_dir")} stroke={regionStroke("periorbital_dir")} strokeWidth={regionStrokeW("periorbital_dir")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("periorbital_dir")}
          />
          {/* Nariz */}
          <path
            d="M 182,200 Q 195,195 200,195 Q 205,195 218,200 L 225,265 Q 210,278 200,280 Q 190,278 175,265 Z"
            fill={regionFill("nariz")} stroke={regionStroke("nariz")} strokeWidth={regionStrokeW("nariz")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("nariz")}
          />
          {/* Malar E (cheek) */}
          <circle
            cx="135" cy="240" r="30"
            fill={regionFill("malar_esq")} stroke={regionStroke("malar_esq")} strokeWidth={regionStrokeW("malar_esq")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("malar_esq")}
          />
          {/* Malar D (cheek) */}
          <circle
            cx="265" cy="240" r="30"
            fill={regionFill("malar_dir")} stroke={regionStroke("malar_dir")} strokeWidth={regionStrokeW("malar_dir")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("malar_dir")}
          />
          {/* Sulco Nasogeniano E */}
          <path
            d="M 168,265 Q 155,280 155,310 L 168,310 Q 170,285 175,268 Z"
            fill={regionFill("sulco_esq")} stroke={regionStroke("sulco_esq")} strokeWidth={regionStrokeW("sulco_esq")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("sulco_esq")}
          />
          {/* Sulco Nasogeniano D */}
          <path
            d="M 232,265 Q 245,280 245,310 L 232,310 Q 230,285 225,268 Z"
            fill={regionFill("sulco_dir")} stroke={regionStroke("sulco_dir")} strokeWidth={regionStrokeW("sulco_dir")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("sulco_dir")}
          />
          {/* Lábio Superior */}
          <path
            d="M 165,295 Q 200,290 235,295 Q 225,310 200,308 Q 175,310 165,295"
            fill={regionFill("labio_sup")} stroke={regionStroke("labio_sup")} strokeWidth={regionStrokeW("labio_sup")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("labio_sup")}
          />
          {/* Lábio Inferior */}
          <path
            d="M 165,312 Q 175,315 200,318 Q 225,315 235,312 Q 230,338 200,342 Q 170,338 165,312"
            fill={regionFill("labio_inf")} stroke={regionStroke("labio_inf")} strokeWidth={regionStrokeW("labio_inf")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("labio_inf")}
          />
          {/* Mento (chin) */}
          <path
            d="M 165,342 Q 175,350 200,355 Q 225,350 235,342 Q 230,375 200,385 Q 170,375 165,342"
            fill={regionFill("mentual")} stroke={regionStroke("mentual")} strokeWidth={regionStrokeW("mentual")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("mentual")}
          />
          {/* Mandíbula E */}
          <path
            d="M 92,200 Q 88,260 105,310 Q 125,350 160,378 L 155,345 Q 125,315 110,280 Q 100,250 105,210 Z"
            fill={regionFill("mandibula_esq")} stroke={regionStroke("mandibula_esq")} strokeWidth={regionStrokeW("mandibula_esq")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("mandibula_esq")}
          />
          {/* Mandíbula D */}
          <path
            d="M 308,200 Q 312,260 295,310 Q 275,350 240,378 L 245,345 Q 275,315 290,280 Q 300,250 295,210 Z"
            fill={regionFill("mandibula_dir")} stroke={regionStroke("mandibula_dir")} strokeWidth={regionStrokeW("mandibula_dir")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("mandibula_dir")}
          />
          {/* Papada */}
          <path
            d="M 160,395 Q 180,405 200,408 Q 220,405 240,395 Q 238,430 200,440 Q 162,430 160,395"
            fill={regionFill("papada")} stroke={regionStroke("papada")} strokeWidth={regionStrokeW("papada")}
            className="cursor-pointer transition-all hover:fill-[rgba(46,125,91,0.18)]"
            onClick={() => onToggleRegion("papada")}
          />

          {/* Region labels (when showUnits) */}
          {showUnits && (
            <>
              <text x="200" y="115" textAnchor="middle" fontSize="9" fill="white" fontWeight="500" opacity="0.9">Testa</text>
              <text x="200" y="158" textAnchor="middle" fontSize="8" fill="white" fontWeight="500" opacity="0.9">Glabela</text>
              <text x="100" y="165" textAnchor="middle" fontSize="7" fill="white" fontWeight="500" opacity="0.9">Temporal</text>
              <text x="300" y="165" textAnchor="middle" fontSize="7" fill="white" fontWeight="500" opacity="0.9">Temporal</text>
              <text x="152" y="185" textAnchor="middle" fontSize="7" fill="white" fontWeight="500" opacity="0.85">Periorbital</text>
              <text x="248" y="185" textAnchor="middle" fontSize="7" fill="white" fontWeight="500" opacity="0.85">Periorbital</text>
              <text x="200" y="245" textAnchor="middle" fontSize="8" fill="white" fontWeight="500" opacity="0.9">Nariz</text>
              <text x="135" y="245" textAnchor="middle" fontSize="8" fill="white" fontWeight="500" opacity="0.9">Malar</text>
              <text x="265" y="245" textAnchor="middle" fontSize="8" fill="white" fontWeight="500" opacity="0.9">Malar</text>
              <text x="152" y="290" textAnchor="middle" fontSize="7" fill="white" fontWeight="500" opacity="0.85">Sulco</text>
              <text x="248" y="290" textAnchor="middle" fontSize="7" fill="white" fontWeight="500" opacity="0.85">Sulco</text>
              <text x="200" y="303" textAnchor="middle" fontSize="7" fill="white" fontWeight="500" opacity="0.9">Lábio Sup.</text>
              <text x="200" y="328" textAnchor="middle" fontSize="7" fill="white" fontWeight="500" opacity="0.9">Lábio Inf.</text>
              <text x="200" y="368" textAnchor="middle" fontSize="8" fill="white" fontWeight="500" opacity="0.9">Mento</text>
              <text x="110" y="300" textAnchor="middle" fontSize="7" fill="white" fontWeight="500" opacity="0.85">Mandíbula</text>
              <text x="290" y="300" textAnchor="middle" fontSize="7" fill="white" fontWeight="500" opacity="0.85">Mandíbula</text>
              <text x="200" y="425" textAnchor="middle" fontSize="8" fill="white" fontWeight="500" opacity="0.9">Papada</text>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
