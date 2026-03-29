import { memo } from "react";
import {
  ExternalLink, Phone, Reply, List, CheckCircle2,
  ShoppingCart, Package, Users, MapPin, BarChart3,
  FileText, MessageSquare, Eye, Sparkles, Globe,
  Copy, ChevronRight, User, Mail
} from "lucide-react";

/* ─── Types ─── */
interface StructuredData {
  type: string;
  [key: string]: any;
}

interface RichMessageRendererProps {
  messageType: string;
  content: string | null;
  structuredData?: StructuredData | null;
  fromMe: boolean;
}

/* ─── Shared Styles ─── */
const cardBg = (fromMe: boolean) =>
  fromMe ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.04)";

const accentColor = "var(--wa-tint)";

/* ─── Template Message ─── */
function TemplateRenderer({ sd, content, fromMe }: { sd: StructuredData; content: string | null; fromMe: boolean }) {
  const body = sd.body || content || "";
  const buttons = sd.buttons || [];
  const footer = sd.footer;

  return (
    <div className="min-w-[240px]">
      {/* Title */}
      {sd.title && (
        <p className="text-[13px] font-semibold mb-1" style={{ color: "var(--foreground)" }}>
          {sd.title}
        </p>
      )}

      {/* Body text */}
      {body && (
        <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">{body}</p>
      )}

      {/* Footer */}
      {footer && (
        <p className="text-[12px] mt-1" style={{ color: "var(--wa-text-secondary)" }}>{footer}</p>
      )}

      {/* Buttons */}
      {buttons.length > 0 && (
        <div className="mt-2 -mx-[9px] -mb-[8px] border-t" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          {buttons.map((btn: any, i: number) => (
            <TemplateButton key={i} btn={btn} isLast={i === buttons.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateButton({ btn, isLast }: { btn: any; isLast: boolean }) {
  const borderClass = isLast ? "" : "border-b";
  const icon = btn.type === "url" ? <ExternalLink className="w-[14px] h-[14px]" /> :
    btn.type === "call" ? <Phone className="w-[14px] h-[14px]" /> :
    btn.type === "copy" ? <Copy className="w-[14px] h-[14px]" /> :
    <Reply className="w-[14px] h-[14px]" />;

  const handleClick = () => {
    if (btn.type === "url" && btn.url) {
      window.open(btn.url, "_blank", "noopener,noreferrer");
    } else if (btn.type === "copy" && btn.copyCode) {
      navigator.clipboard.writeText(btn.copyCode);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center justify-center gap-2 w-full py-[10px] px-3 text-[14px] font-medium transition-colors hover:bg-black/[0.03] ${borderClass}`}
      style={{ color: accentColor, borderColor: "rgba(0,0,0,0.08)", cursor: btn.type === "url" || btn.type === "copy" ? "pointer" : "default" }}
    >
      {icon}
      <span>{btn.text || "Botão"}</span>
    </button>
  );
}

/* ─── Interactive Message ─── */
function InteractiveRenderer({ sd, content, fromMe }: { sd: StructuredData; content: string | null; fromMe: boolean }) {
  const body = sd.body || content || "";
  const buttons = sd.buttons || [];
  const footer = sd.footer;

  return (
    <div className="min-w-[240px]">
      {/* Header */}
      {sd.header && (
        <p className="text-[13px] font-semibold mb-1">{sd.header}</p>
      )}

      {/* Body */}
      {body && (
        <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">{body}</p>
      )}

      {/* Footer */}
      {footer && (
        <p className="text-[12px] mt-1" style={{ color: "var(--wa-text-secondary)" }}>{footer}</p>
      )}

      {/* Buttons */}
      {buttons.length > 0 && (
        <div className="mt-2 -mx-[9px] -mb-[8px] border-t" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          {buttons.map((btn: any, i: number) => {
            const icon = btn.type === "cta_url" ? <ExternalLink className="w-[14px] h-[14px]" /> :
              btn.type === "cta_copy" ? <Copy className="w-[14px] h-[14px]" /> :
              <Reply className="w-[14px] h-[14px]" />;

            const handleClick = () => {
              if (btn.type === "cta_url" && btn.url) {
                window.open(btn.url, "_blank", "noopener,noreferrer");
              } else if (btn.type === "cta_copy" && btn.copyCode) {
                navigator.clipboard.writeText(btn.copyCode);
              }
            };

            return (
              <button
                key={i}
                onClick={handleClick}
                className={`flex items-center justify-center gap-2 w-full py-[10px] px-3 text-[14px] font-medium transition-colors hover:bg-black/[0.03] ${i < buttons.length - 1 ? "border-b" : ""}`}
                style={{ color: accentColor, borderColor: "rgba(0,0,0,0.08)", cursor: (btn.type === "cta_url" || btn.type === "cta_copy") ? "pointer" : "default" }}
              >
                {icon}
                <span>{btn.text || "Botão"}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Buttons Message ─── */
function ButtonsRenderer({ sd, content, fromMe }: { sd: StructuredData; content: string | null; fromMe: boolean }) {
  const body = sd.text || content || "";
  const buttons = sd.buttons || [];
  const footer = sd.footer;

  return (
    <div className="min-w-[220px]">
      {body && (
        <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">{body}</p>
      )}
      {footer && (
        <p className="text-[12px] mt-1" style={{ color: "var(--wa-text-secondary)" }}>{footer}</p>
      )}
      {buttons.length > 0 && (
        <div className="mt-2 -mx-[9px] -mb-[8px] border-t" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          {buttons.map((btn: any, i: number) => (
            <div
              key={i}
              className={`flex items-center justify-center gap-2 py-[10px] px-3 text-[14px] font-medium ${i < buttons.length - 1 ? "border-b" : ""}`}
              style={{ color: accentColor, borderColor: "rgba(0,0,0,0.08)" }}
            >
              <Reply className="w-[14px] h-[14px]" />
              <span>{btn.text || "Botão"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── List Message ─── */
function ListRenderer({ sd, content, fromMe }: { sd: StructuredData; content: string | null; fromMe: boolean }) {
  const body = sd.description || content || "";
  const sections = sd.sections || [];
  const buttonText = sd.buttonText || "Ver opções";
  const footer = sd.footer;

  return (
    <div className="min-w-[240px]">
      {/* Title */}
      {sd.title && (
        <p className="text-[13px] font-semibold mb-1">{sd.title}</p>
      )}

      {/* Body */}
      {body && (
        <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">{body}</p>
      )}

      {/* Footer */}
      {footer && (
        <p className="text-[12px] mt-1" style={{ color: "var(--wa-text-secondary)" }}>{footer}</p>
      )}

      {/* Sections (expanded inline) */}
      {sections.length > 0 && (
        <div className="mt-2 -mx-[9px] -mb-[8px] border-t" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          {/* Button header */}
          <div className="flex items-center justify-center gap-2 py-[10px] px-3 text-[14px] font-medium"
            style={{ color: accentColor }}>
            <List className="w-[14px] h-[14px]" />
            <span>{buttonText}</span>
          </div>

          {/* Sections */}
          {sections.map((section: any, si: number) => (
            <div key={si}>
              {section.title && (
                <div className="px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wider"
                  style={{ color: accentColor, backgroundColor: "rgba(0,0,0,0.02)" }}>
                  {section.title}
                </div>
              )}
              {(section.rows || []).map((row: any, ri: number) => (
                <div key={ri} className="flex items-center gap-2 px-3 py-2 border-t" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium truncate">{row.title || "Opção"}</p>
                    {row.description && (
                      <p className="text-[12px] truncate" style={{ color: "var(--wa-text-secondary)" }}>{row.description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--wa-text-secondary)" }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Response Messages (user selections) ─── */
function ResponseRenderer({ sd, content, fromMe }: { sd: StructuredData; content: string | null; fromMe: boolean }) {
  const text = sd.selectedText || sd.title || content || "";
  const description = sd.description;

  const typeLabel = sd.type === "listResponse" ? "Selecionou da lista" :
    sd.type === "buttonsResponse" ? "Clicou no botão" :
    sd.type === "templateButtonReply" ? "Clicou no botão" : "Resposta";

  return (
    <div className="min-w-[180px]">
      <div className="flex items-center gap-1.5 mb-1">
        <CheckCircle2 className="w-[13px] h-[13px]" style={{ color: accentColor }} />
        <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: accentColor }}>
          {typeLabel}
        </span>
      </div>
      {text && (
        <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words font-medium">{text}</p>
      )}
      {description && (
        <p className="text-[12.5px] mt-0.5" style={{ color: "var(--wa-text-secondary)" }}>{description}</p>
      )}
    </div>
  );
}

/* ─── Poll Message ─── */
function PollRenderer({ sd, content, fromMe }: { sd: StructuredData; content: string | null; fromMe: boolean }) {
  const question = sd.question || content || "Enquete";
  const options = sd.options || [];

  return (
    <div className="min-w-[240px]">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-[16px] h-[16px]" style={{ color: accentColor }} />
        <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: accentColor }}>Enquete</span>
      </div>
      <p className="text-[14.2px] leading-[19px] font-semibold whitespace-pre-wrap break-words mb-2">{question}</p>
      {options.length > 0 && (
        <div className="space-y-1">
          {options.map((opt: string, i: number) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: cardBg(fromMe) }}>
              <div className="w-[18px] h-[18px] rounded-full border-2 shrink-0" style={{ borderColor: accentColor }} />
              <span className="text-[13.5px]">{opt}</span>
            </div>
          ))}
        </div>
      )}
      {sd.selectableCount && sd.selectableCount > 1 && (
        <p className="text-[11px] mt-1.5" style={{ color: "var(--wa-text-secondary)" }}>
          Selecione até {sd.selectableCount} opções
        </p>
      )}
    </div>
  );
}

/* ─── Order Message ─── */
function OrderRenderer({ sd, content, fromMe }: { sd: StructuredData; content: string | null; fromMe: boolean }) {
  return (
    <div className="min-w-[220px]">
      <div className="flex items-center gap-2 mb-1.5 px-2 py-1.5 rounded-lg" style={{ backgroundColor: cardBg(fromMe) }}>
        <ShoppingCart className="w-[18px] h-[18px]" style={{ color: accentColor }} />
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold">{sd.title || "Pedido"}</p>
          {sd.orderId && <p className="text-[11px]" style={{ color: "var(--wa-text-secondary)" }}>#{sd.orderId}</p>}
        </div>
      </div>
      {sd.itemCount && (
        <p className="text-[13px]" style={{ color: "var(--wa-text-secondary)" }}>
          {sd.itemCount} {sd.itemCount === 1 ? "item" : "itens"}
        </p>
      )}
      {sd.message && (
        <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words mt-1">{sd.message}</p>
      )}
    </div>
  );
}

/* ─── Product Message ─── */
function ProductRenderer({ sd, content, fromMe }: { sd: StructuredData; content: string | null; fromMe: boolean }) {
  const price = sd.price != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: sd.currency || "BRL" }).format(sd.price) : null;

  return (
    <div className="min-w-[220px]">
      <div className="flex items-center gap-2 px-2 py-2 rounded-lg" style={{ backgroundColor: cardBg(fromMe) }}>
        <Package className="w-[22px] h-[22px]" style={{ color: accentColor }} />
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold">{sd.title || "Produto"}</p>
          {sd.description && <p className="text-[12px] truncate" style={{ color: "var(--wa-text-secondary)" }}>{sd.description}</p>}
          {price && <p className="text-[14px] font-bold mt-0.5" style={{ color: accentColor }}>{price}</p>}
        </div>
      </div>
    </div>
  );
}

/* ─── Group Invite ─── */
function GroupInviteRenderer({ sd, content, fromMe }: { sd: StructuredData; content: string | null; fromMe: boolean }) {
  return (
    <div className="min-w-[220px]">
      <div className="flex items-center gap-2 px-2 py-2 rounded-lg" style={{ backgroundColor: cardBg(fromMe) }}>
        <Users className="w-[22px] h-[22px]" style={{ color: accentColor }} />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-wider" style={{ color: accentColor }}>Convite de grupo</p>
          <p className="text-[14px] font-semibold">{sd.groupName || "Grupo"}</p>
          {sd.caption && <p className="text-[12.5px]" style={{ color: "var(--wa-text-secondary)" }}>{sd.caption}</p>}
        </div>
      </div>
    </div>
  );
}

/* ─── Contact Message (enhanced) ─── */
function ContactRenderer({ sd, content, fromMe }: { sd: StructuredData; content: string | null; fromMe: boolean }) {
  // Parse vCard to extract phone number
  const parsePhone = (vcard: string | null): string | null => {
    if (!vcard) return null;
    const match = vcard.match(/TEL[^:]*:([^\n\r]+)/i);
    return match ? match[1].trim() : null;
  };

  if (sd.type === "contactsArray" && sd.contacts) {
    return (
      <div className="min-w-[200px] space-y-1">
        {sd.contacts.map((c: any, i: number) => {
          const phone = parsePhone(c.vcard);
          return (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ backgroundColor: cardBg(fromMe) }}>
              <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--wa-tint)", opacity: 0.15 }}>
                <User className="w-[18px] h-[18px]" style={{ color: accentColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium truncate">{c.displayName || "Passageiro"}</p>
                {phone && <p className="text-[12px]" style={{ color: "var(--wa-text-secondary)" }}>{phone}</p>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const phone = parsePhone(sd.vcard);
  return (
    <div className="min-w-[200px]">
      <div className="flex items-center gap-2 px-2 py-2 rounded-lg" style={{ backgroundColor: cardBg(fromMe) }}>
        <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}11)` }}>
          <User className="w-[20px] h-[20px]" style={{ color: accentColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium">{sd.displayName || content || "Passageiro"}</p>
          {phone && <p className="text-[12.5px]" style={{ color: "var(--wa-text-secondary)" }}>{phone}</p>}
        </div>
      </div>
    </div>
  );
}

/* ─── Location Message (enhanced) ─── */
function LocationRenderer({ sd, content, fromMe }: { sd: StructuredData; content: string | null; fromMe: boolean }) {
  const lat = sd.latitude;
  const lng = sd.longitude;
  const hasCoords = lat != null && lng != null;
  const mapUrl = hasCoords ? `https://maps.google.com/?q=${lat},${lng}` : null;
  // Static map image from OpenStreetMap
  const staticMapUrl = hasCoords
    ? `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=300x150&maptype=mapnik&markers=${lat},${lng},red-pushpin`
    : null;

  return (
    <div className="min-w-[240px]">
      {staticMapUrl && (
        <a href={mapUrl!} target="_blank" rel="noopener noreferrer" className="block -mx-[9px] -mt-[6px] mb-1 overflow-hidden rounded-t-[7.5px]">
          <img src={staticMapUrl} alt="Mapa" className="w-full h-[150px] object-cover hover:opacity-90 transition-opacity" loading="lazy" />
        </a>
      )}
      <div className="flex items-start gap-2">
        <MapPin className="w-[16px] h-[16px] mt-0.5 shrink-0 text-red-500" />
        <div className="flex-1 min-w-0">
          {sd.name && <p className="text-[13.5px] font-medium">{sd.name}</p>}
          {sd.address && <p className="text-[12.5px]" style={{ color: "var(--wa-text-secondary)" }}>{sd.address}</p>}
          {!sd.name && !sd.address && hasCoords && (
            <p className="text-[13px]" style={{ color: "var(--wa-text-secondary)" }}>
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── View Once Message ─── */
function ViewOnceRenderer({ content, fromMe }: { content: string | null; fromMe: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <Eye className="w-[16px] h-[16px]" style={{ color: accentColor }} />
      <span className="text-[14.2px] italic" style={{ color: "var(--wa-text-secondary)" }}>
        {content || "Mensagem de visualização única"}
      </span>
    </div>
  );
}

/* ─── Protocol Message (system) ─── */
function ProtocolRenderer({ content, fromMe }: { content: string | null; fromMe: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <MessageSquare className="w-[13px] h-[13px]" style={{ color: "var(--wa-text-secondary)" }} />
      <span className="text-[13px] italic" style={{ color: "var(--wa-text-secondary)" }}>
        {content || "Mensagem do sistema"}
      </span>
    </div>
  );
}

/* ─── Placeholder / Unknown ─── */
function PlaceholderRenderer({ messageType, content, fromMe }: { messageType: string; content: string | null; fromMe: boolean }) {
  // For messages that have content but no special rendering, just show the content
  if (content) return null; // Let the default text renderer handle it

  // For truly unknown types with no content
  const typeLabels: Record<string, string> = {
    placeholderMessage: "Mensagem não disponível",
    editedMessage: "Mensagem editada",
    albumMessage: "Álbum de fotos",
    associatedChildMessage: "Foto do álbum",
    lottieStickerMessage: "Figurinha animada",
    pollUpdateMessage: "Voto na enquete",
  };

  return (
    <div className="flex items-center gap-1.5 min-w-[160px]">
      <Sparkles className="w-[13px] h-[13px]" style={{ color: "var(--wa-text-secondary)" }} />
      <span className="text-[13px] italic" style={{ color: "var(--wa-text-secondary)" }}>
        {typeLabels[messageType] || `[${messageType}]`}
      </span>
    </div>
  );
}

/* ─── Main Renderer ─── */
const RichMessageRenderer = memo(({ messageType, content, structuredData, fromMe }: RichMessageRendererProps) => {
  const sd = structuredData;

  // If we have structured data, use the appropriate renderer
  if (sd) {
    switch (sd.type) {
      case "template":
        return <TemplateRenderer sd={sd} content={content} fromMe={fromMe} />;
      case "interactive":
        return <InteractiveRenderer sd={sd} content={content} fromMe={fromMe} />;
      case "buttons":
        return <ButtonsRenderer sd={sd} content={content} fromMe={fromMe} />;
      case "list":
        return <ListRenderer sd={sd} content={content} fromMe={fromMe} />;
      case "listResponse":
      case "buttonsResponse":
      case "templateButtonReply":
        return <ResponseRenderer sd={sd} content={content} fromMe={fromMe} />;
      case "poll":
        return <PollRenderer sd={sd} content={content} fromMe={fromMe} />;
      case "order":
        return <OrderRenderer sd={sd} content={content} fromMe={fromMe} />;
      case "product":
        return <ProductRenderer sd={sd} content={content} fromMe={fromMe} />;
      case "groupInvite":
        return <GroupInviteRenderer sd={sd} content={content} fromMe={fromMe} />;
      case "contact":
      case "contactsArray":
        return <ContactRenderer sd={sd} content={content} fromMe={fromMe} />;
      case "location":
        return <LocationRenderer sd={sd} content={content} fromMe={fromMe} />;
    }
  }

  // Fallback: render based on messageType for messages without structuredData
  // (e.g., old messages stored before the structuredData column was added)
  switch (messageType) {
    case "templateMessage":
      // Old template messages stored as "[Template]" — show a nicer fallback
      if (content === "[Template]" || !content) {
        return (
          <div className="flex items-center gap-1.5">
            <FileText className="w-[14px] h-[14px]" style={{ color: accentColor }} />
            <span className="text-[14.2px]" style={{ color: "var(--wa-text-secondary)" }}>
              Mensagem de template
            </span>
          </div>
        );
      }
      return null; // Has real content, let default renderer handle it

    case "interactiveMessage":
      if (!content) {
        return (
          <div className="flex items-center gap-1.5">
            <Globe className="w-[14px] h-[14px]" style={{ color: accentColor }} />
            <span className="text-[14.2px]" style={{ color: "var(--wa-text-secondary)" }}>
              Mensagem interativa
            </span>
          </div>
        );
      }
      return null;

    case "listResponseMessage":
    case "buttonsResponseMessage":
    case "templateButtonReplyMessage":
    case "interactiveResponseMessage":
      if (content) {
        return (
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <CheckCircle2 className="w-[13px] h-[13px]" style={{ color: accentColor }} />
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: accentColor }}>
                Resposta selecionada
              </span>
            </div>
            <p className="text-[14.2px] leading-[19px] font-medium">{content}</p>
          </div>
        );
      }
      return null;

    case "protocolMessage":
      return <ProtocolRenderer content={content} fromMe={fromMe} />;

    case "viewOnceMessage":
    case "viewOnceMessageV2":
      return <ViewOnceRenderer content={content} fromMe={fromMe} />;

    case "placeholderMessage":
    case "editedMessage":
    case "albumMessage":
    case "associatedChildMessage":
    case "lottieStickerMessage":
    case "pollUpdateMessage":
      return <PlaceholderRenderer messageType={messageType} content={content} fromMe={fromMe} />;

    default:
      return null; // Unknown type — let default text renderer handle it
  }
});
RichMessageRenderer.displayName = "RichMessageRenderer";

export default RichMessageRenderer;

/**
 * Check if a message type should use the RichMessageRenderer.
 * Returns true if the message type has a dedicated renderer.
 */
export function isRichMessageType(messageType: string): boolean {
  const richTypes = new Set([
    "templateMessage",
    "interactiveMessage",
    "buttonsMessage",
    "listMessage",
    "listResponseMessage",
    "buttonsResponseMessage",
    "templateButtonReplyMessage",
    "interactiveResponseMessage",
    "pollCreationMessage",
    "pollCreationMessageV3",
    "pollUpdateMessage",
    "orderMessage",
    "productMessage",
    "groupInviteMessage",
    "contactMessage",
    "contactsArrayMessage",
    "locationMessage",
    "liveLocationMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "protocolMessage",
    "placeholderMessage",
    "editedMessage",
    "albumMessage",
    "associatedChildMessage",
    "lottieStickerMessage",
  ]);
  return richTypes.has(messageType);
}
