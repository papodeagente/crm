/**
 * Evolution API Provider
 *
 * Wraps the existing evolutionApi.ts functions into the WhatsAppProvider interface.
 * This is a thin adapter — all actual API logic stays in evolutionApi.ts.
 * The goal is zero behavioral change: the system works exactly as before.
 */

import * as evo from "../evolutionApi";
import type {
  WhatsAppProvider,
  WAInstance,
  WACreateResult,
  WAQrCode,
  WASendResult,
  WAChat,
  WAContact,
  WAMessage,
  WAMediaResult,
  WAHealthResult,
  WAWebhookConfig,
  WANumberCheck,
  WAWebhookEvent,
  WAWebhookEventType,
} from "./types";

// ════════════════════════════════════════════════════════════
// HELPERS — Translate Evolution-specific shapes to canonical types
// ════════════════════════════════════════════════════════════

function toWAInstance(inst: evo.EvolutionInstance): WAInstance {
  return {
    instanceId: inst.id,
    name: inst.name,
    connectionStatus: inst.connectionStatus,
    ownerJid: inst.ownerJid,
    profileName: inst.profileName,
    profilePicUrl: inst.profilePicUrl,
    phoneNumber: inst.number,
  };
}

function toWASendResult(result: evo.SendMessageResult): WASendResult {
  return {
    key: {
      remoteJid: result.key.remoteJid,
      fromMe: result.key.fromMe,
      id: result.key.id,
    },
    messageTimestamp: result.messageTimestamp,
    status: result.status,
  };
}

function toWAChat(chat: any): WAChat {
  return {
    remoteJid: chat.remoteJid || chat.id || "",
    name: chat.name || chat.pushName || null,
    lastMessage: chat.lastMessage
      ? {
          key: chat.lastMessage.key || { id: "", fromMe: false, remoteJid: "" },
          message: chat.lastMessage.message || null,
          messageTimestamp: chat.lastMessage.messageTimestamp || 0,
          messageType: chat.lastMessage.messageType || null,
          pushName: chat.lastMessage.pushName || null,
          status: chat.lastMessage.status,
        }
      : null,
    updatedAt: chat.updatedAt || null,
    unreadCount: chat.unreadCount ?? 0,
  };
}

function toWAContact(contact: any): WAContact {
  return {
    remoteJid: contact.remoteJid || contact.id || "",
    pushName: contact.pushName || null,
    profilePicUrl: contact.profilePicUrl || null,
  };
}

function toWAMessage(msg: any): WAMessage {
  return {
    key: {
      id: msg.key?.id || msg.id || "",
      fromMe: msg.key?.fromMe ?? false,
      remoteJid: msg.key?.remoteJid || msg.remoteJid || "",
    },
    message: msg.message || null,
    messageType: msg.messageType || "text",
    messageTimestamp: msg.messageTimestamp || 0,
    pushName: msg.pushName || null,
    status: msg.status ?? null,
  };
}

// ════════════════════════════════════════════════════════════
// EVOLUTION PROVIDER IMPLEMENTATION
// ════════════════════════════════════════════════════════════

export class EvolutionProvider implements WhatsAppProvider {
  readonly type = "evolution" as const;

  // ─── Instance Management ───

  getInstanceName(tenantId: number, userId: number): string {
    return evo.getInstanceName(tenantId, userId);
  }

  async createInstance(instanceName: string, opts?: { syncFullHistory?: boolean }): Promise<WACreateResult> {
    const result = await evo.createInstance(instanceName, opts);
    return {
      instanceId: result.instance.instanceId,
      instanceName: result.instance.instanceName,
      status: result.instance.status,
      qrCode: result.qrcode?.base64 || null,
    };
  }

  async connectInstance(instanceName: string): Promise<WAQrCode> {
    const result = await evo.connectInstance(instanceName);
    return { base64: result.base64 };
  }

  async fetchInstance(instanceName: string): Promise<WAInstance | null> {
    const inst = await evo.fetchInstance(instanceName);
    return inst ? toWAInstance(inst) : null;
  }

  async fetchAllInstances(): Promise<WAInstance[]> {
    const instances = await evo.fetchAllInstances();
    return instances.map(toWAInstance);
  }

  async logoutInstance(instanceName: string): Promise<void> {
    await evo.logoutInstance(instanceName);
  }

  async deleteInstance(instanceName: string): Promise<void> {
    await evo.deleteInstance(instanceName);
  }

  async restartInstance(instanceName: string): Promise<void> {
    await evo.restartInstance(instanceName);
  }

  // ─── Messaging ───

  async sendText(instanceName: string, number: string, text: string): Promise<WASendResult> {
    return toWASendResult(await evo.sendText(instanceName, number, text));
  }

  async sendMedia(
    instanceName: string,
    number: string,
    mediaUrl: string,
    mediaType: "image" | "video" | "audio" | "document",
    opts?: { caption?: string; fileName?: string; mimetype?: string }
  ): Promise<WASendResult> {
    return toWASendResult(await evo.sendMedia(instanceName, number, mediaUrl, mediaType, opts));
  }

  async sendAudio(instanceName: string, number: string, audioUrl: string): Promise<WASendResult> {
    return toWASendResult(await evo.sendAudio(instanceName, number, audioUrl));
  }

  async sendTextWithQuote(
    instanceName: string,
    number: string,
    text: string,
    quoted: { key: { id: string }; message: { conversation: string } }
  ): Promise<WASendResult> {
    return toWASendResult(await evo.sendTextWithQuote(instanceName, number, text, quoted));
  }

  // ─── Chat Sync ───

  async findChats(instanceName: string): Promise<WAChat[]> {
    const chats = await evo.findChats(instanceName);
    return chats.map(toWAChat);
  }

  async findContacts(instanceName: string): Promise<WAContact[]> {
    const contacts = await evo.findContacts(instanceName);
    return contacts.map(toWAContact);
  }

  async findMessages(
    instanceName: string,
    remoteJid: string,
    opts?: { limit?: number; page?: number }
  ): Promise<WAMessage[]> {
    const messages = await evo.findMessages(instanceName, remoteJid, opts);
    return messages.map(toWAMessage);
  }

  // ─── Chat Actions ───

  async markMessageAsRead(instanceName: string, remoteJid: string, messageIds: string[]): Promise<void> {
    await evo.markMessageAsRead(instanceName, remoteJid, messageIds);
  }

  async markMessageAsUnread(instanceName: string, remoteJid: string, messageId: string): Promise<void> {
    await evo.markMessageAsUnread(instanceName, remoteJid, messageId);
  }

  async deleteMessageForEveryone(
    instanceName: string,
    remoteJid: string,
    messageId: string,
    fromMe: boolean
  ): Promise<void> {
    await evo.deleteMessageForEveryone(instanceName, remoteJid, messageId, fromMe);
  }

  async updateMessage(
    instanceName: string,
    number: string,
    messageId: string,
    text: string
  ): Promise<WASendResult> {
    return toWASendResult(await evo.updateMessage(instanceName, number, messageId, text));
  }

  async sendPresence(
    instanceName: string,
    number: string,
    presence: "composing" | "recording" | "available" | "unavailable" | "paused"
  ): Promise<void> {
    await evo.sendPresence(instanceName, number, presence);
  }

  async archiveChat(instanceName: string, remoteJid: string, archive: boolean): Promise<void> {
    await evo.archiveChat(instanceName, remoteJid, archive);
  }

  async updateBlockStatus(instanceName: string, number: string, status: "block" | "unblock"): Promise<void> {
    await evo.updateBlockStatus(instanceName, number, status);
  }

  async checkIsWhatsApp(instanceName: string, numbers: string[]): Promise<WANumberCheck[]> {
    return evo.checkIsWhatsApp(instanceName, numbers);
  }

  // ─── Reactions & Rich Messages ───

  async sendReaction(
    instanceName: string,
    key: { remoteJid: string; fromMe: boolean; id: string },
    reaction: string
  ): Promise<WASendResult> {
    return toWASendResult(await evo.sendReaction(instanceName, key, reaction));
  }

  async sendSticker(instanceName: string, number: string, stickerUrl: string): Promise<WASendResult> {
    return toWASendResult(await evo.sendSticker(instanceName, number, stickerUrl));
  }

  async sendLocation(
    instanceName: string,
    number: string,
    latitude: number,
    longitude: number,
    name: string,
    address: string
  ): Promise<WASendResult> {
    return toWASendResult(await evo.sendLocation(instanceName, number, latitude, longitude, name, address));
  }

  async sendContact(
    instanceName: string,
    number: string,
    contact: Array<{ fullName: string; wuid?: string; phoneNumber: string }>
  ): Promise<WASendResult> {
    return toWASendResult(await evo.sendContact(instanceName, number, contact));
  }

  async sendPoll(
    instanceName: string,
    number: string,
    name: string,
    values: string[],
    selectableCount: number = 1
  ): Promise<WASendResult> {
    return toWASendResult(await evo.sendPoll(instanceName, number, name, values, selectableCount));
  }

  async sendList(
    instanceName: string,
    number: string,
    title: string,
    description: string,
    buttonText: string,
    footerText: string,
    sections: Array<{ title: string; rows: Array<{ title: string; description?: string; rowId: string }> }>
  ): Promise<WASendResult> {
    return toWASendResult(await evo.sendList(instanceName, number, title, description, buttonText, footerText, sections));
  }

  async sendButtons(
    instanceName: string,
    number: string,
    title: string,
    description: string,
    footer: string,
    buttons: Array<{ buttonId: string; buttonText: { displayText: string } }>
  ): Promise<WASendResult> {
    return toWASendResult(await evo.sendButtons(instanceName, number, title, description, footer, buttons));
  }

  // ─── Profile ───

  async getProfilePicture(instanceName: string, number: string): Promise<string | null> {
    return evo.getProfilePicture(instanceName, number);
  }

  async fetchProfile(instanceName: string, number: string): Promise<any> {
    return evo.fetchProfile(instanceName, number);
  }

  async fetchBusinessProfile(instanceName: string, number: string): Promise<any> {
    return evo.fetchBusinessProfile(instanceName, number);
  }

  // ─── Groups ───

  async createGroup(instanceName: string, subject: string, participants: string[], description?: string): Promise<any> {
    return evo.createGroup(instanceName, subject, participants, description);
  }

  async fetchAllGroups(instanceName: string): Promise<any[]> {
    return evo.fetchAllGroups(instanceName);
  }

  async findGroupByJid(instanceName: string, groupJid: string): Promise<any> {
    return evo.findGroupByJid(instanceName, groupJid);
  }

  async findGroupMembers(instanceName: string, groupJid: string): Promise<any[]> {
    return evo.findGroupMembers(instanceName, groupJid);
  }

  async updateGroupMembers(
    instanceName: string,
    groupJid: string,
    action: "add" | "remove" | "promote" | "demote",
    participants: string[]
  ): Promise<any> {
    return evo.updateGroupMembers(instanceName, groupJid, action, participants);
  }

  async updateGroupSubject(instanceName: string, groupJid: string, subject: string): Promise<any> {
    return evo.updateGroupSubject(instanceName, groupJid, subject);
  }

  async updateGroupDescription(instanceName: string, groupJid: string, description: string): Promise<any> {
    return evo.updateGroupDescription(instanceName, groupJid, description);
  }

  async fetchInviteCode(instanceName: string, groupJid: string): Promise<string | null> {
    return evo.fetchInviteCode(instanceName, groupJid);
  }

  async revokeInviteCode(instanceName: string, groupJid: string): Promise<string | null> {
    return evo.revokeInviteCode(instanceName, groupJid);
  }

  async updateGroupSetting(
    instanceName: string,
    groupJid: string,
    action: "announcement" | "not_announcement" | "locked" | "unlocked"
  ): Promise<any> {
    return evo.updateGroupSetting(instanceName, groupJid, action);
  }

  async toggleEphemeral(instanceName: string, groupJid: string, expiration: number): Promise<any> {
    return evo.toggleEphemeral(instanceName, groupJid, expiration);
  }

  async leaveGroup(instanceName: string, groupJid: string): Promise<any> {
    return evo.leaveGroup(instanceName, groupJid);
  }

  // ─── Media ───

  async getBase64FromMediaMessage(
    instanceName: string,
    messageId: string,
    options?: { remoteJid?: string; fromMe?: boolean; convertToMp4?: boolean }
  ): Promise<WAMediaResult | null> {
    const result = await evo.getBase64FromMediaMessage(instanceName, messageId, options);
    if (!result) return null;
    return {
      base64: result.base64,
      mimetype: result.mimetype,
      fileName: result.fileName,
    };
  }

  // ─── Health & Webhooks ───

  async healthCheck(): Promise<WAHealthResult> {
    const start = Date.now();
    const result = await evo.healthCheck();
    return {
      ok: result.ok,
      provider: "evolution",
      version: result.version,
      error: result.error,
      latencyMs: Date.now() - start,
    };
  }

  async findWebhook(instanceName: string): Promise<WAWebhookConfig | null> {
    return evo.findWebhook(instanceName);
  }

  async setWebhook(instanceName: string, opts?: { url?: string; events?: string[] }): Promise<boolean> {
    return evo.setWebhook(instanceName, opts);
  }

  async ensureWebhook(instanceName: string): Promise<boolean> {
    return evo.ensureWebhook(instanceName);
  }

  // ─── Webhook Normalization ───

  normalizeWebhookPayload(rawPayload: any): WAWebhookEvent | null {
    if (!rawPayload || !rawPayload.event) return null;

    // Evolution API already uses the canonical event names, so this is a passthrough
    return {
      event: rawPayload.event as WAWebhookEventType,
      instance: rawPayload.instance,
      data: rawPayload.data,
      provider: "evolution",
      receivedAt: rawPayload.date_time || new Date().toISOString(),
    };
  }
}

/** Singleton instance */
export const evolutionProvider = new EvolutionProvider();
