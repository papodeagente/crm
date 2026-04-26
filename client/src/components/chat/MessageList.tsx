/**
 * MessageList — Messages area with date groups, notes, timeline, scroll
 * Extracted from WhatsAppChat.tsx lines 2539-2856
 */

import { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  Send, Loader2, ArrowDown, StickyNote, X, Pencil, Trash2,
  ArrowRightLeft, Users, Check, History, Brain,
} from "lucide-react";
import MessageBubble from "./MessageBubble";
import DateSeparator from "./DateSeparator";
import { formatTime } from "../../../../shared/dateUtils";

/* Status Order Map for monotonic enforcement */
const STATUS_ORDER_MAP: Record<string, number> = {
  error: 0, pending: 1, sending: 2, sent: 3, server_ack: 3,
  delivered: 4, delivery_ack: 4, read: 5, played: 6,
};

interface Message {
  id: number;
  sessionId: string;
  messageId?: string | null;
  remoteJid: string;
  fromMe: boolean;
  messageType: string;
  content: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  mediaDuration?: number | null;
  isVoiceNote?: boolean | null;
  status?: string | null;
  timestamp: string | Date;
  createdAt: string | Date;
  quotedMessageId?: string | null;
  structuredData?: any | null;
  audioTranscription?: string | null;
  audioTranscriptionStatus?: string | null;
  senderAgentId?: number | null;
  pushName?: string;
  _noteCategory?: string;
  _notePriority?: string;
  _noteIsGlobal?: boolean;
  _noteMentionedUserIds?: string | number[];
  reactions?: any[];
}

interface GroupedMessages {
  date: string;
  messages: Message[];
}

interface AgentInfo {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

interface ReplyTarget {
  messageId: string;
  content: string;
  fromMe: boolean;
}

interface MessageListProps {
  groupedMessages: GroupedMessages[];
  allMessages: Message[];
  isLoading: boolean;
  hasMoreMessages: boolean;
  loadMoreMessages: () => void;
  contactName?: string;
  contactAvatarUrl?: string;
  myAvatarUrl?: string;
  sessionId: string;
  // Socket status updates
  localStatusUpdates: Record<string, string>;
  // Reactions
  reactionsMap: Record<string, Array<{ emoji: string; senderJid: string; fromMe: boolean }>>;
  // Agents
  agents?: AgentInfo[];
  agentMap: Record<number, string>;
  showAgentNames: boolean;
  // AI
  autoTranscribe?: boolean;
  transcriptions: Record<number, { text?: string; loading?: boolean; error?: string }>;
  // Callbacks
  onReply: (target: ReplyTarget) => void;
  onReact: (key: { remoteJid: string; fromMe: boolean; id: string }, emoji: string) => void;
  onDelete: (remoteJid: string, messageId: string, fromMe: boolean) => void;
  onEditStart: (messageId: string, currentText: string) => void;
  onForward: (msg: Message) => void;
  onImageClick: (url: string) => void;
  onTranscribe: (msgId: number, audioUrl: string) => void;
  onRetranscribe: (msgId: number) => void;
  // Notes
  onEditNote: (noteId: number, text: string) => void;
  onDeleteNote: (noteId: number) => void;
  onSaveEditedNote: (noteId: number, text: string) => void;
  editingNoteId: number | null;
  editingNoteText: string;
  onSetEditingNoteText: (text: string) => void;
  onCancelEditNote: () => void;
  updateNotePending: boolean;
  // Global notes
  globalNotes: any[] | null;
  // AI Summary
  showSummary: boolean;
  summaryText: string;
  summaryLoading: boolean;
  onSummarize: () => void;
  onCloseSummary: () => void;
  // Timeline
  showTimeline: boolean;
  timelineEvents: any[] | null;
  // Socket trigger for auto-scroll
  lastMessage: any;
  // Conversation identity for scroll reset on switch
  remoteJid?: string;
}

export default function MessageList({
  groupedMessages, allMessages, isLoading, hasMoreMessages, loadMoreMessages,
  contactName, contactAvatarUrl, myAvatarUrl, sessionId,
  localStatusUpdates, reactionsMap,
  agents, agentMap, showAgentNames,
  autoTranscribe, transcriptions,
  onReply, onReact, onDelete, onEditStart, onForward, onImageClick,
  onTranscribe, onRetranscribe,
  onEditNote, onDeleteNote, onSaveEditedNote,
  editingNoteId, editingNoteText, onSetEditingNoteText, onCancelEditNote, updateNotePending,
  globalNotes,
  showSummary, summaryText, summaryLoading, onSummarize, onCloseSummary,
  showTimeline, timelineEvents,
  lastMessage,
  remoteJid,
}: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) scrollToBottom(true);
  }, [groupedMessages, lastMessage]);

  // Scroll button visibility
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      setShowScrollBtn(!isNearBottom);
    };
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  // Track conversation identity to detect switches
  const prevJidRef = useRef(remoteJid);
  const initialScrollDone = useRef(false);
  const scrollTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Force scroll container to absolute bottom (instant, bypasses CSS smooth scroll)
  const forceScrollBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: "instant" as ScrollBehavior });
    }
  }, []);

  // Reset scroll flag when conversation changes
  useEffect(() => {
    if (prevJidRef.current !== remoteJid) {
      initialScrollDone.current = false;
      prevJidRef.current = remoteJid;
      // Clear any pending scroll timers from previous conversation
      scrollTimers.current.forEach(clearTimeout);
      scrollTimers.current = [];
    }
  }, [remoteJid]);

  // Initial scroll to bottom (on first load + conversation switch)
  // Uses staggered retries + ResizeObserver to handle images/lazy content
  useEffect(() => {
    if (groupedMessages.length > 0 && !initialScrollDone.current) {
      initialScrollDone.current = true;
      // Clear old timers
      scrollTimers.current.forEach(clearTimeout);
      scrollTimers.current = [];
      // Immediate scroll + staggered retries
      forceScrollBottom();
      for (const delay of [30, 80, 150, 300, 600, 1000]) {
        scrollTimers.current.push(setTimeout(forceScrollBottom, delay));
      }
      // ResizeObserver: re-scroll whenever content height changes (image loads, etc.)
      // Active only during the first 2 seconds after opening a conversation
      const container = scrollContainerRef.current;
      if (container) {
        const inner = container.firstElementChild as HTMLElement | null;
        if (inner) {
          const ro = new ResizeObserver(() => forceScrollBottom());
          ro.observe(inner);
          scrollTimers.current.push(setTimeout(() => ro.disconnect(), 2000));
        }
      }
    }
    return () => {
      scrollTimers.current.forEach(clearTimeout);
      scrollTimers.current = [];
    };
  }, [groupedMessages, remoteJid, forceScrollBottom]);

  const TIME_GAP_MS = 5 * 60 * 1000;

  return (
    <>
      {/* Global Notes Alert */}
      {globalNotes && globalNotes.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/40 px-4 py-2 shrink-0 z-10">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">
              {globalNotes.length} nota{globalNotes.length > 1 ? "s" : ""} global{globalNotes.length > 1 ? "is" : ""} sobre este cliente
            </span>
          </div>
          <div className="mt-1 space-y-1 max-h-[80px] overflow-y-auto">
            {globalNotes.slice(0, 3).map((note: any) => {
              const priColor = note.priority === "urgent" ? "text-red-600" : note.priority === "high" ? "text-orange-600" : "text-amber-700";
              return (
                <div key={note.id} className={`text-[11px] ${priColor} dark:text-amber-200 flex items-start gap-1`}>
                  {note.priority === "urgent" && <span className="shrink-0">{"\u26A0\uFE0F"}</span>}
                  {note.priority === "high" && <span className="shrink-0">{"\u2757"}</span>}
                  <span className="truncate"><strong>{note.authorName}:</strong> {note.content}</span>
                </div>
              );
            })}
            {globalNotes.length > 3 && (
              <span className="text-[10px] text-amber-500">+{globalNotes.length - 3} mais...</span>
            )}
          </div>
        </div>
      )}

      {/* AI Summary Panel */}
      {showSummary && (
        <div className="bg-violet-50 dark:bg-violet-950/30 border-b border-violet-200 dark:border-violet-800/40 px-4 py-3 shrink-0 z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <span className="text-[12px] font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wider">Resumo da Conversa</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onSummarize}
                disabled={summaryLoading}
                className="text-[11px] text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-200 px-2 py-0.5 rounded hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
              >
                {summaryLoading ? "Gerando..." : "Atualizar"}
              </button>
              <button
                onClick={onCloseSummary}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-violet-500" />
              </button>
            </div>
          </div>
          {summaryLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
              <span className="text-[12px] text-violet-600 dark:text-violet-400">Analisando conversa com IA...</span>
            </div>
          ) : (
            <div className="text-[12px] text-violet-900 dark:text-violet-200 leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">
              {summaryText}
            </div>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div ref={scrollContainerRef} data-chat-scroll className="flex-1 overflow-y-auto relative scrollbar-thin inbox-chat-mesh">

        <div className="relative z-[1] py-2">
          {/* Load more */}
          {hasMoreMessages && !isLoading && (
            <div className="flex justify-center py-3">
              <button
                onClick={loadMoreMessages}
                className="text-xs text-wa-tint hover:text-wa-tint/80 bg-card/80 dark:bg-[#0D1129]/80 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-sm border border-wa-divider transition-colors"
              >
                Carregar mensagens anteriores
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : groupedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-wa-tint/10 flex items-center justify-center mb-3">
                <Send className="w-7 h-7 text-wa-tint" />
              </div>
              <p className="text-sm font-medium">Nenhuma mensagem ainda</p>
              <p className="text-xs mt-1">Envie a primeira mensagem para {contactName}</p>
            </div>
          ) : (
            groupedMessages.map((group, gi) => (
              <div key={gi}>
                <DateSeparator date={group.date} />
                {group.messages.map((msg, mi) => {
                  // Internal note
                  if (msg.messageType === "internal_note") {
                    return (
                      <InternalNoteRow
                        key={msg.id}
                        msg={msg}
                        agents={agents}
                        editingNoteId={editingNoteId}
                        editingNoteText={editingNoteText}
                        onSetEditingNoteText={onSetEditingNoteText}
                        onEditNote={onEditNote}
                        onDeleteNote={onDeleteNote}
                        onSaveEditedNote={onSaveEditedNote}
                        onCancelEditNote={onCancelEditNote}
                        updateNotePending={updateNotePending}
                      />
                    );
                  }

                  const prev = mi > 0 ? group.messages[mi - 1] : null;
                  const next = mi < group.messages.length - 1 ? group.messages[mi + 1] : null;
                  const msgTs = new Date(msg.timestamp).getTime();
                  const prevTs = prev ? new Date(prev.timestamp).getTime() : 0;
                  const nextTs = next ? new Date(next.timestamp).getTime() : 0;
                  const isFirst = !prev || prev.fromMe !== msg.fromMe || prev.messageType === "internal_note" || msg.messageType === "internal_note" || (msgTs - prevTs > TIME_GAP_MS);
                  const isLast = !next || next.fromMe !== msg.fromMe || next.messageType === "internal_note" || msg.messageType === "internal_note" || (nextTs - msgTs > TIME_GAP_MS);

                  // Monotonic status merge
                  const socketStatus = msg.messageId ? localStatusUpdates[msg.messageId] : undefined;
                  let updatedMsg = msg;
                  if (socketStatus) {
                    const msgOrder = msg.status ? (STATUS_ORDER_MAP[msg.status] ?? -1) : -1;
                    const socketOrder = STATUS_ORDER_MAP[socketStatus] ?? -1;
                    if (socketOrder > msgOrder) {
                      updatedMsg = { ...msg, status: socketStatus };
                    }
                  }

                  return (
                    <MessageBubble
                      key={msg.id}
                      msg={updatedMsg}
                      isFirst={isFirst}
                      isLast={isLast}
                      allMessages={allMessages}
                      onReply={onReply}
                      onReact={onReact}
                      onDelete={onDelete}
                      onEdit={onEditStart}
                      onForward={onForward}
                      contactAvatarUrl={contactAvatarUrl}
                      myAvatarUrl={myAvatarUrl}
                      onImageClick={onImageClick}
                      autoTranscribe={autoTranscribe}
                      onTranscribe={onTranscribe}
                      transcriptions={transcriptions}
                      onRetranscribe={onRetranscribe}
                      reactions={msg.messageId ? reactionsMap[msg.messageId] : undefined}
                      agentMap={agentMap}
                      showAgentNames={showAgentNames}
                    />
                  );
                })}
              </div>
            ))
          )}

          {/* Timeline Events */}
          {showTimeline && timelineEvents && timelineEvents.length > 0 && (
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-blue-300/30" />
                <span className="text-[11px] font-medium text-blue-600 uppercase tracking-wider flex items-center gap-1">
                  <History className="w-3 h-3" /> Timeline
                </span>
                <div className="h-px flex-1 bg-blue-300/30" />
              </div>
              {timelineEvents.map((event: any) => (
                <div key={event.id} className="flex justify-center mb-1.5">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 shadow-sm max-w-[85%]">
                    <div className="flex items-center gap-2 text-[12px]">
                      {event.eventType === 'transfer' && <ArrowRightLeft className="w-3 h-3 text-blue-500" />}
                      {event.eventType === 'assignment' && <Users className="w-3 h-3 text-green-500" />}
                      {event.eventType === 'status_change' && <Check className="w-3 h-3 text-purple-500" />}
                      {event.eventType === 'note' && <StickyNote className="w-3 h-3 text-amber-500" />}
                      <span className="text-blue-700">
                        {event.eventType === 'transfer' && `Transferido por ${event.actorName || 'Sistema'}`}
                        {event.eventType === 'assignment' && `Atribuído a ${event.metadata?.toAgentName || 'agente'}`}
                        {event.eventType === 'status_change' && `Status: ${event.metadata?.newStatus || ''}`}
                        {event.eventType === 'note' && `Nota de ${event.actorName || 'Agente'}`}
                        {event.eventType === 'queue_claim' && `Puxado da fila por ${event.actorName || 'Agente'}`}
                      </span>
                      <span className="text-blue-400 text-[10px]">
                        {new Date(event.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                      </span>
                    </div>
                    {event.metadata?.note && (
                      <p className="text-[11px] text-blue-600 mt-0.5 italic">"{event.metadata.note}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom */}
        {showScrollBtn && (
          <button onClick={() => scrollToBottom(true)}
            className="absolute bottom-4 right-4 w-[42px] h-[42px] rounded-full bg-wa-panel shadow-lg flex items-center justify-center hover:bg-wa-hover transition-colors z-20 border border-wa-divider">
            <ArrowDown className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>
    </>
  );
}

/* ─── Internal Note Row (extracted for clarity) ─── */
function InternalNoteRow({
  msg, agents, editingNoteId, editingNoteText,
  onSetEditingNoteText, onEditNote, onDeleteNote, onSaveEditedNote,
  onCancelEditNote, updateNotePending,
}: {
  msg: Message;
  agents?: AgentInfo[];
  editingNoteId: number | null;
  editingNoteText: string;
  onSetEditingNoteText: (text: string) => void;
  onEditNote: (noteId: number, text: string) => void;
  onDeleteNote: (noteId: number) => void;
  onSaveEditedNote: (noteId: number, text: string) => void;
  onCancelEditNote: () => void;
  updateNotePending: boolean;
}) {
  const noteTime = formatTime(msg.timestamp || msg.createdAt);
  const authorName = (msg as any).pushName || "Agente";
  const noteCategory = (msg as any)._noteCategory || "other";
  const notePriority = (msg as any)._notePriority || "normal";
  const noteIsGlobal = (msg as any)._noteIsGlobal || false;
  const noteMentions: any[] = (() => {
    try {
      const raw = (msg as any)._noteMentionedUserIds;
      if (!raw) return [];
      return typeof raw === "string" ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
    } catch { return []; }
  })();

  const categoryLabels: Record<string, { label: string; color: string }> = {
    client: { label: "Cliente", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    financial: { label: "Financeiro", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    documentation: { label: "Documentação", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    operation: { label: "Operação", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
    other: { label: "Geral", color: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400" },
  };
  const priorityStyles: Record<string, { label: string; color: string }> = {
    normal: { label: "", color: "" },
    high: { label: "Alta", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
    urgent: { label: "Urgente", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-pulse" },
  };

  const cat = categoryLabels[noteCategory] || categoryLabels.other;
  const pri = priorityStyles[notePriority] || priorityStyles.normal;
  const mentionedNames = noteMentions.length > 0 && agents
    ? noteMentions.map(id => agents.find(a => a.id === id)?.name).filter(Boolean)
    : [];

  const renderNoteContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@[\w\u00C0-\u024F][\w\u00C0-\u024F\s]*?)(?=\s@|\s|$)/g);
    return parts.map((part, i) =>
      part.startsWith("@") ? <strong key={i} className="text-amber-700 dark:text-amber-200">{part}</strong> : part
    );
  };

  const realNoteId = Math.abs(msg.id);
  const isEditing = editingNoteId === realNoteId;

  return (
    <div className="flex justify-end px-[63px] mb-[2px] mt-[6px] group/note">
      <div className="relative max-w-[65%]">
        {/* Edit/Delete buttons */}
        <div className="absolute -left-16 top-1/2 -translate-y-1/2 hidden group-hover/note:flex items-center gap-1 z-10">
          <button
            onClick={() => onEditNote(realNoteId, msg.content || "")}
            className="p-1 rounded-full bg-white dark:bg-zinc-800 shadow-sm border border-gray-200 dark:border-zinc-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
            title="Editar nota"
          >
            <Pencil className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          </button>
          <button
            onClick={() => { if (confirm("Excluir esta nota interna?")) onDeleteNote(realNoteId); }}
            className="p-1 rounded-full bg-white dark:bg-zinc-800 shadow-sm border border-gray-200 dark:border-zinc-700 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            title="Excluir nota"
          >
            <Trash2 className="w-3 h-3 text-red-500 dark:text-red-400" />
          </button>
        </div>
        <div className={`relative px-[9px] pt-[6px] pb-[8px] shadow-sm rounded-[7.5px] border ${notePriority === "urgent" ? "bg-red-50 dark:bg-red-950/30 border-red-300/60 dark:border-red-700/40" : "bg-amber-100 dark:bg-amber-900/40 border-amber-200/60 dark:border-amber-700/40"}`} style={{ minWidth: "80px" }}>
          {/* Note header */}
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <StickyNote className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">{authorName}</span>
            <span className="text-[10px] text-amber-500 dark:text-amber-400/70">{"\u2022"} Nota Interna</span>
            {noteIsGlobal && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-700/50 text-amber-800 dark:text-amber-200 font-medium">{"\uD83C\uDF10"} Global</span>
            )}
            {noteCategory !== "other" && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${cat.color}`}>{cat.label}</span>
            )}
            {notePriority !== "normal" && pri.label && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${pri.color}`}>{pri.label}</span>
            )}
          </div>
          {/* Note content */}
          {isEditing ? (
            <div className="flex flex-col gap-1">
              <textarea
                className="w-full text-[14px] bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-600 rounded px-2 py-1 text-amber-900 dark:text-amber-100 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
                value={editingNoteText}
                onChange={(e) => onSetEditingNoteText(e.target.value)}
                rows={3}
                autoFocus
              />
              <div className="flex gap-1 justify-end">
                <button onClick={onCancelEditNote} className="text-[11px] px-2 py-0.5 rounded bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300">Cancelar</button>
                <button
                  onClick={() => onSaveEditedNote(realNoteId, editingNoteText)}
                  disabled={!editingNoteText.trim() || updateNotePending}
                  className="text-[11px] px-2 py-0.5 rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                >Salvar</button>
              </div>
            </div>
          ) : (
            <span className={`text-[14.2px] leading-[19px] whitespace-pre-wrap break-words ${notePriority === "urgent" ? "text-red-900 dark:text-red-100" : "text-amber-900 dark:text-amber-100"}`}>{renderNoteContent(msg.content || "")}</span>
          )}
          {/* Mentioned agents */}
          {mentionedNames.length > 0 && (
            <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-400/80">
              Mencionados: {mentionedNames.join(", ")}
            </div>
          )}
          {/* Time */}
          <span className="float-right ml-2 mt-[3px] flex items-center gap-0.5 relative -bottom-0.5">
            <span className={`text-[11px] leading-none tabular-nums ${notePriority === "urgent" ? "text-red-400/70 dark:text-red-400/60" : "text-amber-500/70 dark:text-amber-400/60"}`}>{noteTime}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
