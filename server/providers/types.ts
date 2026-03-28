/**
 * WhatsApp Provider Interface & Canonical Types
 *
 * This file defines the SINGLE contract that ALL WhatsApp providers must implement.
 * The rest of the system (Inbox, reconciliation, workers, routers) consumes ONLY
 * these types — never provider-specific shapes.
 *
 * Adding a new provider means implementing WhatsAppProvider against these types.
 * No consumer code should ever need to change.
 */

// ════════════════════════════════════════════════════════════
// CANONICAL TYPES — Provider-agnostic shapes used by the system
// ════════════════════════════════════════════════════════════

/** Identifies which provider backs a given session */
export type ProviderType = "zapi";

/** Instance/connection info returned by the provider */
export interface WAInstance {
  /** Provider-specific instance identifier */
  instanceId: string;
  /** Human-readable name (e.g. "crm-1-2" for Evolution, "instance-abc" for Z-API) */
  name: string;
  /** Connection state normalized across providers */
  connectionStatus: "open" | "connecting" | "close";
  /** WhatsApp JID of the connected account (e.g. "5511999999999@s.whatsapp.net") */
  ownerJid: string | null;
  /** Profile display name */
  profileName: string | null;
  /** Profile picture URL */
  profilePicUrl: string | null;
  /** Phone number (without @s.whatsapp.net) */
  phoneNumber: string | null;
}

/** Result of creating a new instance/connection */
export interface WACreateResult {
  instanceId: string;
  instanceName: string;
  status: string;
  qrCode: string | null;   // base64 data URL if available
}

/** QR code for connecting */
export interface WAQrCode {
  /** base64 data URL of the QR code image */
  base64: string;
}

/** Result of sending any message */
export interface WASendResult {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  messageTimestamp: number;
  status: string;
}

/** A chat/conversation from the provider */
export interface WAChat {
  remoteJid: string;
  name: string | null;
  lastMessage: {
    key: { id: string; fromMe: boolean; remoteJid: string };
    message: Record<string, any> | null;
    messageTimestamp: number;
    messageType: string | null;
    pushName: string | null;
    status?: number | string;
  } | null;
  updatedAt: string | null;
  unreadCount: number;
}

/** A contact from the provider */
export interface WAContact {
  remoteJid: string;
  pushName: string | null;
  profilePicUrl: string | null;
}

/** A message from the provider (normalized) */
export interface WAMessage {
  key: {
    id: string;
    fromMe: boolean;
    remoteJid: string;
  };
  message: Record<string, any> | null;
  messageType: string;
  messageTimestamp: number;
  pushName: string | null;
  status: number | string | null;
}

/** Media download result */
export interface WAMediaResult {
  base64: string;
  mimetype: string;
  fileName?: string;
}

/** Health check result */
export interface WAHealthResult {
  ok: boolean;
  provider: ProviderType;
  version?: string;
  error?: string;
  latencyMs: number;
}

/** Webhook configuration */
export interface WAWebhookConfig {
  enabled: boolean;
  url: string;
  events: string[];
}

/** Check if number has WhatsApp */
export interface WANumberCheck {
  exists: boolean;
  jid: string;
  number: string;
}

// ════════════════════════════════════════════════════════════
// CANONICAL WEBHOOK EVENT — Provider-agnostic internal event
// ════════════════════════════════════════════════════════════

export type WAWebhookEventType =
  | "messages.upsert"
  | "messages.update"
  | "messages.delete"
  | "connection.update"
  | "qrcode.updated"
  | "send.message"
  | "contacts.upsert"
  | "groups.update";

export interface WAWebhookEvent {
  /** Normalized event type */
  event: WAWebhookEventType;
  /** Instance/session identifier (provider-specific) */
  instance: string;
  /** Event data — normalized to Evolution-compatible shape for backward compat */
  data: any;
  /** Original provider that generated this event */
  provider: ProviderType;
  /** ISO timestamp of when the event was received */
  receivedAt: string;
}

// ════════════════════════════════════════════════════════════
// PROVIDER INTERFACE — The contract ALL providers must implement
// ════════════════════════════════════════════════════════════

export interface WhatsAppProvider {
  /** Provider identifier */
  readonly type: ProviderType;

  // ─── Instance Management ───

  /**
   * Generate the canonical instance name for a tenant+user pair.
   * Each provider may use different naming conventions internally.
   */
  getInstanceName(tenantId: number, userId: number): string;

  /** Create a new WhatsApp instance and optionally return QR code */
  createInstance(instanceName: string, opts?: { syncFullHistory?: boolean }): Promise<WACreateResult>;

  /** Generate a new QR code for an existing instance */
  connectInstance(instanceName: string): Promise<WAQrCode>;

  /** Fetch instance details (returns null if not found) */
  fetchInstance(instanceName: string): Promise<WAInstance | null>;

  /** Fetch all instances */
  fetchAllInstances(): Promise<WAInstance[]>;

  /** Disconnect instance (keep data for reconnection) */
  logoutInstance(instanceName: string): Promise<void>;

  /** Delete instance completely */
  deleteInstance(instanceName: string): Promise<void>;

  /** Restart instance */
  restartInstance(instanceName: string): Promise<void>;

  // ─── Messaging ───

  /** Send text message */
  sendText(instanceName: string, number: string, text: string): Promise<WASendResult>;

  /** Send media (image, video, audio, document) */
  sendMedia(
    instanceName: string,
    number: string,
    mediaUrl: string,
    mediaType: "image" | "video" | "audio" | "document",
    opts?: { caption?: string; fileName?: string; mimetype?: string }
  ): Promise<WASendResult>;

  /** Send audio as voice note (PTT) */
  sendAudio(instanceName: string, number: string, audioUrl: string): Promise<WASendResult>;

  /** Send text replying to a specific message */
  sendTextWithQuote(
    instanceName: string,
    number: string,
    text: string,
    quoted: { key: { id: string }; message: { conversation: string } }
  ): Promise<WASendResult>;

  // ─── Chat Sync ───

  /** Fetch all chats for an instance */
  findChats(instanceName: string): Promise<WAChat[]>;

  /** Fetch all contacts for an instance */
  findContacts(instanceName: string): Promise<WAContact[]>;

  /** Fetch messages for a specific chat */
  findMessages(
    instanceName: string,
    remoteJid: string,
    opts?: { limit?: number; page?: number }
  ): Promise<WAMessage[]>;

  // ─── Chat Actions ───

  /** Mark messages as read */
  markMessageAsRead(instanceName: string, remoteJid: string, messageIds: string[]): Promise<void>;

  /** Mark message as unread */
  markMessageAsUnread(instanceName: string, remoteJid: string, messageId: string): Promise<void>;

  /** Delete message for everyone */
  deleteMessageForEveryone(
    instanceName: string,
    remoteJid: string,
    messageId: string,
    fromMe: boolean
  ): Promise<void>;

  /** Edit a sent message */
  updateMessage(
    instanceName: string,
    number: string,
    messageId: string,
    text: string
  ): Promise<WASendResult>;

  /** Send typing/recording/online presence indicator */
  sendPresence(
    instanceName: string,
    number: string,
    presence: "composing" | "recording" | "available" | "unavailable" | "paused"
  ): Promise<void>;

  /** Archive/unarchive a chat */
  archiveChat(instanceName: string, remoteJid: string, archive: boolean): Promise<void>;

  /** Block/unblock a contact */
  updateBlockStatus(instanceName: string, number: string, status: "block" | "unblock"): Promise<void>;

  /** Check if numbers have WhatsApp */
  checkIsWhatsApp(instanceName: string, numbers: string[]): Promise<WANumberCheck[]>;

  // ─── Reactions & Rich Messages ───

  /** Send emoji reaction to a message */
  sendReaction(
    instanceName: string,
    key: { remoteJid: string; fromMe: boolean; id: string },
    reaction: string
  ): Promise<WASendResult>;

  /** Send sticker */
  sendSticker(instanceName: string, number: string, stickerUrl: string): Promise<WASendResult>;

  /** Send location */
  sendLocation(
    instanceName: string,
    number: string,
    latitude: number,
    longitude: number,
    name: string,
    address: string
  ): Promise<WASendResult>;

  /** Send contact (vCard) */
  sendContact(
    instanceName: string,
    number: string,
    contact: Array<{ fullName: string; wuid?: string; phoneNumber: string }>
  ): Promise<WASendResult>;

  /** Send poll */
  sendPoll(
    instanceName: string,
    number: string,
    name: string,
    values: string[],
    selectableCount?: number
  ): Promise<WASendResult>;

  /** Send interactive list */
  sendList(
    instanceName: string,
    number: string,
    title: string,
    description: string,
    buttonText: string,
    footerText: string,
    sections: Array<{ title: string; rows: Array<{ title: string; description?: string; rowId: string }> }>
  ): Promise<WASendResult>;

  /** Send interactive buttons */
  sendButtons(
    instanceName: string,
    number: string,
    title: string,
    description: string,
    footer: string,
    buttons: Array<{ buttonId: string; buttonText: { displayText: string } }>
  ): Promise<WASendResult>;

  // ─── Profile ───

  /** Get profile picture URL */
  getProfilePicture(instanceName: string, number: string): Promise<string | null>;

  /** Fetch full profile */
  fetchProfile(instanceName: string, number: string): Promise<any>;

  /** Fetch business profile */
  fetchBusinessProfile(instanceName: string, number: string): Promise<any>;

  // ─── Groups ───

  /** Create a group */
  createGroup(instanceName: string, subject: string, participants: string[], description?: string): Promise<any>;

  /** List all groups */
  fetchAllGroups(instanceName: string): Promise<any[]>;

  /** Get group info by JID */
  findGroupByJid(instanceName: string, groupJid: string): Promise<any>;

  /** Get group members */
  findGroupMembers(instanceName: string, groupJid: string): Promise<any[]>;

  /** Add/remove/promote/demote group members */
  updateGroupMembers(
    instanceName: string,
    groupJid: string,
    action: "add" | "remove" | "promote" | "demote",
    participants: string[]
  ): Promise<any>;

  /** Update group name */
  updateGroupSubject(instanceName: string, groupJid: string, subject: string): Promise<any>;

  /** Update group description */
  updateGroupDescription(instanceName: string, groupJid: string, description: string): Promise<any>;

  /** Get group invite code */
  fetchInviteCode(instanceName: string, groupJid: string): Promise<string | null>;

  /** Revoke group invite code */
  revokeInviteCode(instanceName: string, groupJid: string): Promise<string | null>;

  /** Update group settings */
  updateGroupSetting(
    instanceName: string,
    groupJid: string,
    action: "announcement" | "not_announcement" | "locked" | "unlocked"
  ): Promise<any>;

  /** Toggle ephemeral messages */
  toggleEphemeral(instanceName: string, groupJid: string, expiration: number): Promise<any>;

  /** Leave a group */
  leaveGroup(instanceName: string, groupJid: string): Promise<any>;

  // ─── Media ───

  /** Download media from a message as base64 */
  getBase64FromMediaMessage(
    instanceName: string,
    messageId: string,
    options?: { remoteJid?: string; fromMe?: boolean; convertToMp4?: boolean }
  ): Promise<WAMediaResult | null>;

  // ─── Health & Webhooks ───

  /** Check if the provider API is reachable */
  healthCheck(): Promise<WAHealthResult>;

  /** Get current webhook configuration */
  findWebhook(instanceName: string): Promise<WAWebhookConfig | null>;

  /** Set/update webhook configuration */
  setWebhook(instanceName: string, opts?: { url?: string; events?: string[] }): Promise<boolean>;

  /** Verify and fix webhook configuration */
  ensureWebhook(instanceName: string): Promise<boolean>;

  // ─── Webhook Normalization ───

  /**
   * Normalize a raw webhook payload from this provider into the canonical WAWebhookEvent.
   * This is the ONLY place where provider-specific webhook formats are translated.
   */
  normalizeWebhookPayload(rawPayload: any): WAWebhookEvent | null;
}

// ════════════════════════════════════════════════════════════
// PROVIDER METRICS — Observability per provider
// ════════════════════════════════════════════════════════════

export interface ProviderMetrics {
  provider: ProviderType;
  totalRequests: number;
  totalErrors: number;
  totalTimeouts: number;
  avgLatencyMs: number;
  lastError: string | null;
  lastErrorAt: number | null;
  /** Per-operation breakdown */
  operations: Record<string, {
    count: number;
    errors: number;
    avgLatencyMs: number;
    lastLatencyMs: number;
  }>;
}
