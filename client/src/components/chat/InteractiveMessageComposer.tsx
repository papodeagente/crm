/**
 * InteractiveMessageComposer — Send buttons, option lists, and carousels via Z-API
 */

import { useState, useCallback } from "react";
import { X, Plus, Trash2, ListOrdered, MousePointerClick, GalleryHorizontalEnd, Image as ImageIcon, Video } from "lucide-react";
import { toast } from "sonner";

type InteractiveType = "buttons" | "list" | "carousel";

interface InteractiveMessageComposerProps {
  onSendButtons: (data: { title?: string; message: string; footer?: string; buttons: { id: string; label: string }[] }) => void;
  onSendList: (data: { title: string; message: string; footer?: string; buttonLabel: string; sections: { title: string; rows: { id: string; title: string; description?: string }[] }[] }) => void;
  onSendCarousel: (data: { cards: { header: { type: "image" | "video"; value: string }; body: string; footer?: string; buttons: ({ id: string; label: string } | { label: string; url: string })[] }[] }) => void;
  onClose: () => void;
}

export default function InteractiveMessageComposer({ onSendButtons, onSendList, onSendCarousel, onClose }: InteractiveMessageComposerProps) {
  const [activeType, setActiveType] = useState<InteractiveType>("buttons");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl border border-border w-[520px] max-w-[95vw] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header with type selector */}
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="text-lg font-semibold">Mensagem Interativa</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex border-b border-border shrink-0">
          {([
            { type: "buttons" as const, icon: MousePointerClick, label: "Botões" },
            { type: "list" as const, icon: ListOrdered, label: "Lista" },
            { type: "carousel" as const, icon: GalleryHorizontalEnd, label: "Carousel" },
          ]).map(t => (
            <button key={t.type} onClick={() => setActiveType(t.type)}
              className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${activeType === t.type ? "text-wa-tint border-b-2 border-wa-tint" : "text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeType === "buttons" && <ButtonsForm onSend={onSendButtons} onClose={onClose} />}
          {activeType === "list" && <ListForm onSend={onSendList} onClose={onClose} />}
          {activeType === "carousel" && <CarouselForm onSend={onSendCarousel} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}

/* ─── Buttons Form ─── */
function ButtonsForm({ onSend, onClose }: { onSend: InteractiveMessageComposerProps["onSendButtons"]; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState([{ id: "btn_1", label: "" }]);

  const addButton = () => { if (buttons.length < 3) setButtons([...buttons, { id: `btn_${buttons.length + 1}`, label: "" }]); };

  return (
    <div className="space-y-3">
      <input type="text" placeholder="Título (opcional)" value={title} onChange={e => setTitle(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
      <textarea placeholder="Mensagem *" value={message} onChange={e => setMessage(e.target.value)} rows={3}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint resize-none" />
      <input type="text" placeholder="Rodapé (opcional)" value={footer} onChange={e => setFooter(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase">Botões (máx. 3)</label>
        {buttons.map((btn, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="text" placeholder={`Botão ${i + 1}`} value={btn.label}
              onChange={e => { const b = [...buttons]; b[i] = { ...b[i], label: e.target.value }; setButtons(b); }}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
            {buttons.length > 1 && (
              <button onClick={() => setButtons(buttons.filter((_, idx) => idx !== i))} className="p-1 hover:bg-muted rounded"><Trash2 className="w-4 h-4 text-muted-foreground" /></button>
            )}
          </div>
        ))}
        {buttons.length < 3 && (
          <button onClick={addButton} className="text-sm text-wa-tint hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar botão</button>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors">Cancelar</button>
        <button onClick={() => {
          const validButtons = buttons.filter(b => b.label.trim());
          if (!message.trim()) return toast.error("Preencha a mensagem");
          if (validButtons.length === 0) return toast.error("Adicione pelo menos 1 botão");
          onSend({ title: title.trim() || undefined, message: message.trim(), footer: footer.trim() || undefined, buttons: validButtons });
          onClose();
        }} className="px-4 py-2 text-sm bg-wa-tint text-white rounded-lg hover:opacity-90 transition-colors">Enviar</button>
      </div>
    </div>
  );
}

/* ─── List Form ─── */
function ListForm({ onSend, onClose }: { onSend: InteractiveMessageComposerProps["onSendList"]; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [footer, setFooter] = useState("");
  const [buttonLabel, setButtonLabel] = useState("Ver opções");
  const [sections, setSections] = useState([{
    title: "",
    rows: [{ id: "row_1", title: "", description: "" }],
  }]);

  const addRow = (sIdx: number) => {
    const s = [...sections];
    s[sIdx].rows.push({ id: `row_${Date.now()}`, title: "", description: "" });
    setSections(s);
  };
  const addSection = () => {
    setSections([...sections, { title: "", rows: [{ id: `row_${Date.now()}`, title: "", description: "" }] }]);
  };
  const updateRow = (sIdx: number, rIdx: number, field: string, value: string) => {
    const s = [...sections];
    (s[sIdx].rows[rIdx] as any)[field] = value;
    setSections(s);
  };
  const removeRow = (sIdx: number, rIdx: number) => {
    const s = [...sections];
    if (s[sIdx].rows.length > 1) { s[sIdx].rows.splice(rIdx, 1); setSections(s); }
  };

  return (
    <div className="space-y-3">
      <input type="text" placeholder="Título *" value={title} onChange={e => setTitle(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
      <textarea placeholder="Mensagem *" value={message} onChange={e => setMessage(e.target.value)} rows={2}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint resize-none" />
      <input type="text" placeholder="Rodapé (opcional)" value={footer} onChange={e => setFooter(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
      <input type="text" placeholder="Texto do botão" value={buttonLabel} onChange={e => setButtonLabel(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
      {sections.map((section, sIdx) => (
        <div key={sIdx} className="border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <input type="text" placeholder={`Seção ${sIdx + 1} (título)`} value={section.title}
              onChange={e => { const s = [...sections]; s[sIdx].title = e.target.value; setSections(s); }}
              className="flex-1 px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
            {sections.length > 1 && (
              <button onClick={() => setSections(sections.filter((_, i) => i !== sIdx))} className="ml-2 p-1 hover:bg-muted rounded"><Trash2 className="w-4 h-4 text-muted-foreground" /></button>
            )}
          </div>
          {section.rows.map((row, rIdx) => (
            <div key={rIdx} className="flex gap-2 items-start pl-3">
              <div className="flex-1 space-y-1">
                <input type="text" placeholder="Título da opção *" value={row.title} onChange={e => updateRow(sIdx, rIdx, "title", e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
                <input type="text" placeholder="Descrição (opcional)" value={row.description} onChange={e => updateRow(sIdx, rIdx, "description", e.target.value)}
                  className="w-full px-2 py-1 rounded border border-border bg-background text-xs focus:outline-none focus:border-wa-tint" />
              </div>
              {section.rows.length > 1 && (
                <button onClick={() => removeRow(sIdx, rIdx)} className="mt-1 p-1 hover:bg-muted rounded"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
              )}
            </div>
          ))}
          <button onClick={() => addRow(sIdx)} className="text-xs text-wa-tint hover:underline flex items-center gap-1 pl-3"><Plus className="w-3 h-3" /> Adicionar opção</button>
        </div>
      ))}
      <button onClick={addSection} className="text-sm text-wa-tint hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar seção</button>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors">Cancelar</button>
        <button onClick={() => {
          if (!title.trim() || !message.trim()) return toast.error("Preencha título e mensagem");
          const validSections = sections.map(s => ({ ...s, rows: s.rows.filter(r => r.title.trim()) })).filter(s => s.rows.length > 0);
          if (validSections.length === 0) return toast.error("Adicione pelo menos 1 opção");
          onSend({ title: title.trim(), message: message.trim(), footer: footer.trim() || undefined, buttonLabel: buttonLabel.trim() || "Ver opções", sections: validSections });
          onClose();
        }} className="px-4 py-2 text-sm bg-wa-tint text-white rounded-lg hover:opacity-90 transition-colors">Enviar</button>
      </div>
    </div>
  );
}

/* ─── Carousel Form ─── */
function CarouselForm({ onSend, onClose }: { onSend: InteractiveMessageComposerProps["onSendCarousel"]; onClose: () => void }) {
  const [cards, setCards] = useState([{
    headerType: "image" as "image" | "video",
    headerValue: "",
    body: "",
    footer: "",
    buttons: [{ type: "reply" as "reply" | "url", id: "btn_1", label: "", url: "" }],
  }]);

  const addCard = () => {
    if (cards.length < 10) setCards([...cards, { headerType: "image", headerValue: "", body: "", footer: "", buttons: [{ type: "reply", id: `btn_${Date.now()}`, label: "", url: "" }] }]);
  };

  const updateCard = (idx: number, field: string, value: any) => {
    const c = [...cards];
    (c[idx] as any)[field] = value;
    setCards(c);
  };

  const addButton = (cIdx: number) => {
    const c = [...cards];
    if (c[cIdx].buttons.length < 3) c[cIdx].buttons.push({ type: "reply", id: `btn_${Date.now()}`, label: "", url: "" });
    setCards(c);
  };

  const updateButton = (cIdx: number, bIdx: number, field: string, value: string) => {
    const c = [...cards];
    (c[cIdx].buttons[bIdx] as any)[field] = value;
    setCards(c);
  };

  return (
    <div className="space-y-3">
      {cards.map((card, cIdx) => (
        <div key={cIdx} className="border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Card {cIdx + 1}</span>
            {cards.length > 1 && (
              <button onClick={() => setCards(cards.filter((_, i) => i !== cIdx))} className="p-1 hover:bg-muted rounded"><Trash2 className="w-4 h-4 text-muted-foreground" /></button>
            )}
          </div>
          <div className="flex gap-2">
            <select value={card.headerType} onChange={e => updateCard(cIdx, "headerType", e.target.value)}
              className="px-2 py-1.5 rounded border border-border bg-background text-sm">
              <option value="image">Imagem</option>
              <option value="video">Vídeo</option>
            </select>
            <input type="text" placeholder={card.headerType === "image" ? "URL da imagem" : "URL do vídeo"} value={card.headerValue}
              onChange={e => updateCard(cIdx, "headerValue", e.target.value)}
              className="flex-1 px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
          </div>
          <textarea placeholder="Texto do card *" value={card.body} onChange={e => updateCard(cIdx, "body", e.target.value)} rows={2}
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-wa-tint resize-none" />
          <input type="text" placeholder="Rodapé (opcional)" value={card.footer} onChange={e => updateCard(cIdx, "footer", e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-wa-tint" />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Botões</label>
            {card.buttons.map((btn, bIdx) => (
              <div key={bIdx} className="flex gap-1.5 items-center">
                <select value={btn.type} onChange={e => updateButton(cIdx, bIdx, "type", e.target.value)}
                  className="px-1.5 py-1 rounded border border-border bg-background text-xs w-20">
                  <option value="reply">Resposta</option>
                  <option value="url">URL</option>
                </select>
                <input type="text" placeholder="Label" value={btn.label} onChange={e => updateButton(cIdx, bIdx, "label", e.target.value)}
                  className="flex-1 px-2 py-1 rounded border border-border bg-background text-xs focus:outline-none focus:border-wa-tint" />
                {btn.type === "url" && (
                  <input type="text" placeholder="https://..." value={btn.url} onChange={e => updateButton(cIdx, bIdx, "url", e.target.value)}
                    className="flex-1 px-2 py-1 rounded border border-border bg-background text-xs focus:outline-none focus:border-wa-tint" />
                )}
                {card.buttons.length > 1 && (
                  <button onClick={() => { const c = [...cards]; c[cIdx].buttons.splice(bIdx, 1); setCards(c); }} className="p-0.5 hover:bg-muted rounded"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                )}
              </div>
            ))}
            {card.buttons.length < 3 && (
              <button onClick={() => addButton(cIdx)} className="text-xs text-wa-tint hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Botão</button>
            )}
          </div>
        </div>
      ))}
      {cards.length < 10 && (
        <button onClick={addCard} className="text-sm text-wa-tint hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar card</button>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors">Cancelar</button>
        <button onClick={() => {
          const validCards = cards.filter(c => c.body.trim() && c.headerValue.trim() && c.buttons.some(b => b.label.trim()));
          if (validCards.length === 0) return toast.error("Adicione pelo menos 1 card com imagem, texto e botão");
          onSend({
            cards: validCards.map(c => ({
              header: { type: c.headerType, value: c.headerValue.trim() },
              body: c.body.trim(),
              footer: c.footer.trim() || undefined,
              buttons: c.buttons.filter(b => b.label.trim()).map(b =>
                b.type === "url" ? { label: b.label.trim(), url: b.url.trim() } : { id: b.id, label: b.label.trim() }
              ),
            })),
          });
          onClose();
        }} className="px-4 py-2 text-sm bg-wa-tint text-white rounded-lg hover:opacity-90 transition-colors">Enviar</button>
      </div>
    </div>
  );
}
