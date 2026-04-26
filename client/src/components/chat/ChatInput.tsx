/**
 * ChatInput — Message input area with emoji, attachments, notes, quick messages
 * Extracted from WhatsAppChat.tsx lines 2858-3155
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Smile, Paperclip, Send, Mic, X, StickyNote, Loader2, Sparkles,
} from "lucide-react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import InstantTooltip from "@/components/InstantTooltip";
import AiSuggestionPanel from "@/components/AiSuggestionPanel";
import QuickMessagesPicker, { type MessageContext } from "@/components/QuickMessagesPicker";
import AttachMenu from "./AttachMenu";
import VoiceRecorder from "./VoiceRecorder";

interface ReplyTarget {
  messageId: string;
  content: string;
  fromMe: boolean;
}

interface AgentInfo {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

interface ChatInputProps {
  sessionId: string;
  remoteJid: string;
  contact: { name: string; phone: string; email?: string } | null;
  tenantId: number | null;
  // State
  replyTarget: ReplyTarget | null;
  onClearReply: () => void;
  // Sending
  onSend: (text: string) => void;
  onSendWithQuote: (text: string, quotedMessageId: string, quotedText: string) => void;
  isSending: boolean;
  sendPending: boolean;
  // Note mode
  isNoteMode: boolean;
  onToggleNoteMode: () => void;
  onCreateNote: (data: { content: string; category: string; priority: string; isGlobal: boolean; mentions: number[] }) => void;
  createNotePending: boolean;
  agents?: AgentInfo[];
  waConversationId?: number;
  // Voice
  onVoiceSend: (blob: Blob, duration: number) => void;
  onStartRecording: () => void;
  // Files
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDocSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAttachSelect: (type: string) => void;
  // Presence
  onTyping: () => void;
  onPaused: () => void;
  // Quick messages context
  dealId?: number;
  dealTitle?: string;
  dealValueCents?: number;
  dealStageName?: string;
  companyName?: string;
  // AI suggestion
  onRefetchMessages: () => void;
}

export default function ChatInput({
  sessionId, remoteJid, contact, tenantId,
  replyTarget, onClearReply,
  onSend, onSendWithQuote, isSending, sendPending,
  isNoteMode, onToggleNoteMode, onCreateNote, createNotePending, agents, waConversationId,
  onVoiceSend, onStartRecording,
  onFileSelect, onDocSelect, onAttachSelect,
  onTyping, onPaused,
  dealId, dealTitle, dealValueCents, dealStageName, companyName,
  onRefetchMessages,
}: ChatInputProps) {
  const [messageText, setMessageText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showAiSuggestion, setShowAiSuggestion] = useState(false);
  // Note mode state
  const [noteCategory, setNoteCategory] = useState("other");
  const [notePriority, setNotePriority] = useState("normal");
  const [noteIsGlobal, setNoteIsGlobal] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState<number[]>([]);
  // Quick replies
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplyFilter, setQuickReplyFilter] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Auto-focus textarea when conversation changes
  useEffect(() => {
    if (remoteJid) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [remoteJid]);
  // Auto-focus textarea when user clicks "Responder"
  useEffect(() => {
    if (replyTarget) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [replyTarget]);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const presenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Quick replies query
  const quickRepliesQ = trpc.whatsapp.quickReplies.list.useQuery({}, { staleTime: 5 * 60 * 1000 });
  const incrementQrUsage = trpc.whatsapp.quickReplies.incrementUsage.useMutation();
  const filteredQuickReplies = useMemo(() => {
    const replies = (quickRepliesQ.data || []) as Array<{ id: number; shortcut: string; title: string; content: string; category?: string | null; contentType?: string; mediaUrl?: string; usageCount?: number }>;
    if (!quickReplyFilter) return replies.slice(0, 10);
    const f = quickReplyFilter.toLowerCase();
    return replies.filter(r => r.shortcut.toLowerCase().includes(f) || r.title.toLowerCase().includes(f)).slice(0, 10);
  }, [quickRepliesQ.data, quickReplyFilter]);

  // Close emoji picker and attach menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (showAttach && attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttach(false);
      }
    };
    if (showEmojiPicker || showAttach) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojiPicker, showAttach]);

  // Cleanup presence timer
  useEffect(() => {
    return () => {
      if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
    };
  }, []);

  const handleSend = useCallback(() => {
    if (!messageText.trim() || isSending) return;

    if (isNoteMode && waConversationId) {
      onCreateNote({
        content: messageText.trim(),
        category: noteCategory,
        priority: notePriority,
        isGlobal: noteIsGlobal,
        mentions: selectedMentions,
      });
      setMessageText("");
      setSelectedMentions([]);
      setMentionQuery(null);
      if (textareaRef.current) textareaRef.current.style.height = "42px";
      return;
    }

    if (replyTarget) {
      onSendWithQuote(messageText.trim(), replyTarget.messageId, replyTarget.content);
    } else {
      onSend(messageText.trim());
    }
    setMessageText("");
    if (textareaRef.current) textareaRef.current.style.height = "42px";
    onPaused();
  }, [messageText, isSending, replyTarget, isNoteMode, waConversationId, noteCategory, notePriority, noteIsGlobal, selectedMentions]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessageText(val);
    const el = e.target;
    el.style.height = "42px";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";

    if (val.startsWith("/")) {
      setShowQuickReplies(true);
      setQuickReplyFilter(val.substring(1));
    } else {
      setShowQuickReplies(false);
      setQuickReplyFilter("");
    }

    if (isNoteMode) {
      const cursorPos = e.target.selectionStart || 0;
      const textBeforeCursor = val.substring(0, cursorPos);
      const mentionMatch = textBeforeCursor.match(/@([\w\u00C0-\u024F]*)$/);
      if (mentionMatch) {
        setMentionQuery(mentionMatch[1]);
        setMentionCursorPos(cursorPos);
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }

    if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
    onTyping();
    presenceTimerRef.current = setTimeout(() => onPaused(), 3000);
  }, [onTyping, onPaused, isNoteMode]);

  const handleEmojiSelect = useCallback((emoji: any) => {
    setMessageText(prev => prev + emoji.native);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  }, []);

  const handleVoiceSend = useCallback((blob: Blob, duration: number) => {
    setIsRecording(false);
    onVoiceSend(blob, duration);
  }, [onVoiceSend]);

  const handleLocalAttachSelect = useCallback((type: string) => {
    if (type === "image" || type === "camera") fileInputRef.current?.click();
    else if (type === "document") docInputRef.current?.click();
    else onAttachSelect(type);
  }, [onAttachSelect]);

  return (
    <>
      {/* Reply Bar */}
      {replyTarget && (
        <div className="px-[16px] py-[5px] z-10 shrink-0" style={{ backgroundColor: 'var(--wa-chat-compose-bg)' }}>
          <div className="rounded-[8px] overflow-hidden flex items-stretch" style={{ backgroundColor: 'var(--wa-input-bg)' }}>
            <div style={{ width: 4, backgroundColor: 'var(--wa-tint)', flexShrink: 0 }} />
            <div className="flex-1 px-[12px] py-[7px] min-w-0">
              <p className="text-[12.5px] font-medium" style={{ color: 'var(--wa-tint)' }}>{replyTarget.fromMe ? "Você" : contact?.name || "Passageiro"}</p>
              <p className="text-[13px] truncate" style={{ color: 'var(--wa-text-secondary)' }}>{replyTarget.content}</p>
            </div>
            <button onClick={onClearReply} className="px-[12px] flex items-center justify-center hover:opacity-70 transition-opacity">
              <X className="w-[20px] h-[20px]" style={{ color: 'var(--wa-text-secondary)' }} />
            </button>
          </div>
        </div>
      )}

      {/* Note Mode Banner */}
      {isNoteMode && (
        <div className="bg-amber-400/20 border-t border-amber-400/40 px-3 py-2 z-10 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StickyNote className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-[13px] font-medium text-amber-700">Nota interna no chat</span>
            <span className="text-[11px] text-amber-600/70">(só a equipe vê)</span>
            <select
              value={noteCategory}
              onChange={(e) => setNoteCategory(e.target.value)}
              className="text-[11px] bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 rounded-md px-1.5 py-0.5 text-amber-800 dark:text-amber-200 outline-none cursor-pointer"
            >
              <option value="other">Geral</option>
              <option value="client">Cliente</option>
              <option value="financial">Financeiro</option>
              <option value="documentation">Documentação</option>
              <option value="operation">Operação</option>
            </select>
            <select
              value={notePriority}
              onChange={(e) => setNotePriority(e.target.value)}
              className={`text-[11px] border rounded-md px-1.5 py-0.5 outline-none cursor-pointer ${
                notePriority === "urgent" ? "bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200" :
                notePriority === "high" ? "bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200" :
                "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200"
              }`}
            >
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={noteIsGlobal}
                onChange={(e) => setNoteIsGlobal(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500 accent-amber-600"
              />
              <span className="text-[11px] text-amber-700" title="Nota visível em todas as conversas deste cliente">{"\uD83C\uDF10"} Global</span>
            </label>
            {selectedMentions.length > 0 && agents && (
              <div className="flex items-center gap-1">
                {selectedMentions.map(id => {
                  const agent = agents.find(a => a.id === id);
                  return agent ? (
                    <span key={id} className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      @{agent.name}
                      <button onClick={() => setSelectedMentions(prev => prev.filter(m => m !== id))} className="hover:text-red-600">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
            <button onClick={() => { onToggleNoteMode(); setNoteCategory("other"); setNotePriority("normal"); setNoteIsGlobal(false); setSelectedMentions([]); setMentionQuery(null); }} className="ml-auto p-1 hover:bg-amber-400/30 rounded-full transition-colors">
              <X className="w-4 h-4 text-amber-600" />
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className={`px-[10px] py-[5px] z-10 shrink-0 transition-colors ${isNoteMode ? "bg-amber-50 dark:bg-amber-950/30" : "inbox-compose-glass"}`}>
        {isRecording ? (
          <VoiceRecorder onSend={handleVoiceSend} onCancel={() => setIsRecording(false)} />
        ) : (
          <div className="flex items-end gap-1.5">
            {/* Note toggle */}
            <InstantTooltip label={isNoteMode ? "Voltar para mensagem" : "Nota interna (só equipe vê)"} side="top">
              <button
                onClick={onToggleNoteMode}
                className="w-[42px] h-[42px] flex items-center justify-center rounded-full transition-all duration-200 shrink-0 self-end"
                style={{ color: isNoteMode ? '#d97706' : 'var(--wa-text-secondary)' }}
              >
                <StickyNote className="w-[22px] h-[22px]" />
              </button>
            </InstantTooltip>

            {/* Emoji picker */}
            <div className="relative shrink-0 self-end" ref={emojiPickerRef}>
              <InstantTooltip label="Emoji" side="top">
                <button onClick={() => { setShowEmojiPicker(!showEmojiPicker); if (!showEmojiPicker) setShowAttach(false); }}
                  className="w-[42px] h-[42px] flex items-center justify-center rounded-full transition-all duration-200"
                  style={{ color: showEmojiPicker ? 'var(--wa-tint)' : 'var(--wa-text-secondary)' }}>
                  <Smile className="w-[24px] h-[24px]" />
                </button>
              </InstantTooltip>
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 z-50 rounded-xl overflow-hidden shadow-xl border border-border/50">
                  <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="light" previewPosition="none" skinTonePosition="none" locale="pt" perLine={8} />
                </div>
              )}
            </div>

            {/* Attach menu */}
            <div className="relative shrink-0 self-end" ref={attachMenuRef}>
              <InstantTooltip label="Anexar arquivo" side="top">
                <button onClick={() => { setShowAttach(!showAttach); if (!showAttach) setShowEmojiPicker(false); }}
                  className="w-[42px] h-[42px] flex items-center justify-center rounded-full transition-all duration-200"
                  style={{ color: showAttach ? 'var(--wa-tint)' : 'var(--wa-text-secondary)' }}>
                  <Paperclip className={`w-[24px] h-[24px] transition-transform duration-200 ${showAttach ? "rotate-[135deg]" : "rotate-45"}`} />
                </button>
              </InstantTooltip>
              {showAttach && <AttachMenu onSelect={handleLocalAttachSelect} onClose={() => setShowAttach(false)} />}
            </div>

            {/* Quick Messages */}
            <div className="relative shrink-0 self-end">
              <QuickMessagesPicker
                onSelect={(content) => { setMessageText(content); textareaRef.current?.focus(); }}
                variant="icon"
                side="top"
                align="start"
                className="w-[42px] h-[42px] rounded-full"
                context={{
                  contactName: contact?.name,
                  contactEmail: contact?.email,
                  contactPhone: contact?.phone,
                  dealId, dealTitle, dealValueCents, dealStageName, companyName,
                } as MessageContext}
              />
            </div>

            {/* AI Suggestion */}
            <div className="relative shrink-0 self-end">
              <InstantTooltip label="Sugestão IA" side="top">
                <button
                  onClick={() => setShowAiSuggestion(prev => !prev)}
                  className="w-[42px] h-[42px] flex items-center justify-center rounded-full transition-colors"
                  style={{ color: showAiSuggestion ? '#8b5cf6' : 'var(--wa-text-secondary)' }}
                >
                  <Sparkles className="w-[22px] h-[22px]" />
                </button>
              </InstantTooltip>
            </div>

            {/* Text input */}
            <div className="flex-1 relative">
              {/* AI Suggestion panel */}
              {showAiSuggestion && tenantId && (
                <AiSuggestionPanel
                  tenantId={tenantId}
                  sessionId={sessionId}
                  remoteJid={remoteJid}
                  contactName={contact?.name}
                  onUseText={(text) => { setMessageText(text); setShowAiSuggestion(false); textareaRef.current?.focus(); }}
                  onSendBroken={() => { onRefetchMessages(); }}
                  onClose={() => setShowAiSuggestion(false)}
                />
              )}

              {/* @Mention autocomplete (note mode) */}
              {isNoteMode && mentionQuery !== null && agents && agents.length > 0 && (() => {
                const q = mentionQuery.toLowerCase();
                const filtered = agents.filter(a => a.name?.toLowerCase().includes(q)).slice(0, 6);
                if (filtered.length === 0) return null;
                return (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-amber-300 rounded-lg shadow-xl max-h-[180px] overflow-y-auto z-50">
                    <div className="px-3 py-1.5 text-[11px] text-amber-700 font-medium uppercase tracking-wider border-b border-amber-200/50">
                      Mencionar agente
                    </div>
                    {filtered.map(agent => (
                      <button
                        key={agent.id}
                        className="w-full text-left px-3 py-2 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors border-b border-amber-100/30 dark:border-amber-800/30 last:border-0 flex items-center gap-2"
                        onClick={() => {
                          const beforeMention = messageText.substring(0, mentionCursorPos - (mentionQuery?.length || 0) - 1);
                          const afterMention = messageText.substring(mentionCursorPos);
                          setMessageText(`${beforeMention}@${agent.name} ${afterMention}`);
                          setMentionQuery(null);
                          if (!selectedMentions.includes(agent.id)) {
                            setSelectedMentions(prev => [...prev, agent.id]);
                          }
                          textareaRef.current?.focus();
                        }}
                      >
                        {agent.avatarUrl ? (
                          <img src={agent.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-[10px] font-bold text-amber-700">
                            {(agent.name || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-[13px] font-medium text-foreground">{agent.name}</span>
                        {agent.email && <span className="text-[11px] text-muted-foreground">{agent.email}</span>}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Quick Replies popup */}
              {showQuickReplies && filteredQuickReplies.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-xl max-h-[200px] overflow-y-auto z-50">
                  <div className="px-3 py-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wider border-b border-border/50">
                    Respostas Rápidas
                  </div>
                  {filteredQuickReplies.map((qr) => (
                    <button
                      key={qr.id}
                      className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors border-b border-border/20 last:border-0"
                      onClick={() => {
                        setMessageText(qr.content);
                        setShowQuickReplies(false);
                        setQuickReplyFilter("");
                        incrementQrUsage.mutate({ id: qr.id });
                        textareaRef.current?.focus();
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">/{qr.shortcut}</span>
                        <span className="text-[13px] font-medium text-foreground truncate">{qr.title}</span>
                        {qr.contentType && qr.contentType !== "text" && (
                          <span className="text-[9px] bg-muted text-muted-foreground px-1 py-0.5 rounded">{qr.contentType}</span>
                        )}
                      </div>
                      <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{qr.content.substring(0, 80)}</p>
                    </button>
                  ))}
                </div>
              )}

              <textarea
                ref={textareaRef} value={messageText} onChange={handleTextareaChange}
                placeholder={isNoteMode ? "Escreva uma nota interna (só a equipe vê)..." : "Mensagem"} rows={1}
                className={`w-full rounded-[8px] px-[12px] py-[9px] text-[15px] outline-none resize-none leading-[20px] transition-colors ${
                  isNoteMode
                    ? "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 focus:border-amber-400 dark:focus:border-amber-600 border placeholder:text-amber-600/50 dark:placeholder:text-amber-500"
                    : "border-none"
                }`}
                style={isNoteMode ? { height: "42px", maxHeight: "140px" } : { height: "42px", maxHeight: "140px", backgroundColor: 'var(--wa-input-bg)', color: 'var(--wa-text-primary)' }}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && showQuickReplies) { setShowQuickReplies(false); return; }
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (showQuickReplies) { setShowQuickReplies(false); } else { handleSend(); } }
                }}
              />
            </div>

            {/* Send / Mic button */}
            {messageText.trim() ? (
              <button onClick={handleSend} disabled={sendPending || isSending || createNotePending}
                className={`w-[42px] h-[42px] flex items-center justify-center rounded-full transition-all shrink-0 self-end disabled:opacity-50 hover:opacity-90 ${!isNoteMode ? "inbox-send-glow" : ""}`}
                style={{ background: isNoteMode ? '#f59e0b' : 'linear-gradient(135deg, #600FED, #8B5CF6)' }}>
                {sendPending || isSending || createNotePending
                  ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                  : isNoteMode
                    ? <StickyNote className="w-[20px] h-[20px] text-white" />
                    : <Send className="w-[20px] h-[20px] text-white" />}
              </button>
            ) : (
              <button onClick={() => { setIsRecording(true); onStartRecording(); }}
                className="w-[42px] h-[42px] flex items-center justify-center hover:bg-[var(--wa-hover)] rounded-full transition-colors shrink-0 self-end">
                <Mic className="w-[24px] h-[24px]" style={{ color: 'var(--wa-text-secondary)' }} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={onFileSelect} />
      <input ref={docInputRef} type="file" accept="*/*" multiple className="hidden" onChange={onDocSelect} />
    </>
  );
}
