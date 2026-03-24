/**
 * Evolution API v2 Client
 * 
 * Módulo de integração com o servidor Evolution API para gerenciamento
 * de instâncias WhatsApp. Cada usuário CRM tem sua própria instância.
 * 
 * Endpoints usados:
 * - POST   /instance/create           — Cria instância + retorna QR
 * - GET    /instance/connect/{name}    — Gera novo QR code
 * - GET    /instance/connectionState/{name} — Status da conexão
 * - GET    /instance/fetchInstances    — Lista instâncias
 * - DELETE /instance/logout/{name}     — Desconecta (mantém instância)
 * - DELETE /instance/delete/{name}     — Remove instância
 * - POST   /message/sendText/{name}    — Envia texto
 * - POST   /message/sendMedia/{name}   — Envia mídia
 * - POST   /message/sendAudio/{name}   — Envia áudio
 * - POST   /message/sendSticker/{name} — Envia sticker
 * - POST   /message/sendLocation/{name}— Envia localização
 * - POST   /message/sendContact/{name} — Envia contato
 * - POST   /message/sendPoll/{name}    — Envia enquete
 * - POST   /message/sendReaction/{name}— Envia reação
 * - POST   /message/sendList/{name}    — Envia lista
 * - POST   /message/sendButtons/{name} — Envia botões
 * - DEL    /chat/deleteMessageForEveryone/{name} — Apaga msg
 * - POST   /chat/updateMessage/{name}  — Edita msg
 * - POST   /chat/sendPresence/{name}   — Presença
 * - POST   /chat/archiveChat/{name}    — Arquivar
 * - POST   /chat/updateBlockStatus/{name} — Bloquear
 * - POST   /chat/checkIsWhatsApp/{name}— Verificar número
 * - GET    /chat/findMessages/{name}   — Busca mensagens
 * - PUT    /instance/restart/{name}    — Reinicia instância
 * - POST   /group/create/{name}        — Criar grupo
 * - GET    /group/fetchAllGroups/{name} — Listar grupos
 */

import { ENV } from "./_core/env";

// ════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════

const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";
const WEBHOOK_BASE_URL = "https://crm.acelerador.tur.br";

// ════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════

export interface EvolutionInstance {
  id: string;
  name: string;
  connectionStatus: "open" | "connecting" | "close";
  ownerJid: string | null;
  profileName: string | null;
  profilePicUrl: string | null;
  integration: string;
  number: string | null;
  token: string;
  clientName: string;
  disconnectionReasonCode: number | null;
  createdAt: string;
  updatedAt: string;
  _count?: { Message: number; Contact: number; Chat: number };
}

export interface CreateInstanceResult {
  instance: {
    instanceName: string;
    instanceId: string;
    integration: string;
    status: string;
  };
  hash: string;
  qrcode?: {
    base64: string;
    count: number;
  };
}

export interface ConnectionState {
  instance: {
    instanceName: string;
    state: "open" | "connecting" | "close";
  };
}

export interface QrCodeResult {
  base64: string;
  count: number;
}

export interface SendMessageResult {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: Record<string, any>;
  messageTimestamp: number;
  status: string;
}

// ════════════════════════════════════════════════════════════
// CONCURRENCY LIMITER — Prevents overwhelming Evolution API
// Max 5 concurrent requests + 100ms minimum gap between requests
// ════════════════════════════════════════════════════════════
const MAX_CONCURRENT_REQUESTS = 5;
const MIN_REQUEST_GAP_MS = 100;
let _activeRequests = 0;
let _lastRequestTime = 0;
const _requestQueue: Array<{ resolve: () => void }> = [];

function _acquireSlot(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (_activeRequests < MAX_CONCURRENT_REQUESTS) {
      _activeRequests++;
      const now = Date.now();
      const gap = _lastRequestTime + MIN_REQUEST_GAP_MS - now;
      _lastRequestTime = Math.max(now, _lastRequestTime + MIN_REQUEST_GAP_MS);
      if (gap > 0) {
        setTimeout(resolve, gap);
      } else {
        resolve();
      }
    } else {
      _requestQueue.push({ resolve });
    }
  });
}

function _releaseSlot(): void {
  _activeRequests--;
  const next = _requestQueue.shift();
  if (next) {
    _activeRequests++;
    const now = Date.now();
    const gap = _lastRequestTime + MIN_REQUEST_GAP_MS - now;
    _lastRequestTime = Math.max(now, _lastRequestTime + MIN_REQUEST_GAP_MS);
    if (gap > 0) {
      setTimeout(() => next.resolve(), gap);
    } else {
      next.resolve();
    }
  }
}

/** Expose current queue depth for diagnostics */
export function getEvoConcurrencyStats() {
  return { active: _activeRequests, queued: _requestQueue.length };
}

// ════════════════════════════════════════════════════════════
// HTTP HELPERS
// ════════════════════════════════════════════════════════════

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 2; // Reduced from 3 to lower retry amplification
const BASE_DELAY_MS = 1500; // Increased from 1000 for better backoff

async function evoFetch<T = any>(
  path: string,
  options: { method?: string; body?: any; timeout?: number; retries?: number } = {}
): Promise<T> {
  const { method = "GET", body, timeout = 30000, retries = MAX_RETRIES } = options;

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    throw new Error("Evolution API not configured (missing EVOLUTION_API_URL or EVOLUTION_API_KEY)");
  }

  // Acquire concurrency slot before making request
  await _acquireSlot();

  let lastError: Error | null = null;

  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(`${EVOLUTION_API_URL}${path}`, {
          method,
          headers: {
            apikey: EVOLUTION_API_KEY,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        // If retryable status and we have retries left, wait and retry
        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < retries) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
          console.warn(`[EvoAPI] ${method} ${path} returned ${response.status}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${retries})`);
          clearTimeout(timer);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        const data = await response.json();

        if (!response.ok) {
          const errMsg = data?.response?.message?.[0] || data?.message || `HTTP ${response.status}`;
          throw new Error(`Evolution API error: ${errMsg}`);
        }

        return data as T;
      } catch (e: any) {
        clearTimeout(timer);
        lastError = e;

        // Retry on network errors (ECONNRESET, ETIMEDOUT, AbortError) if we have retries left
        const isNetworkError = e.name === 'AbortError' || e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT' || e.code === 'ECONNREFUSED' || e.message?.includes('fetch failed');
        if (isNetworkError && attempt < retries) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
          console.warn(`[EvoAPI] ${method} ${path} network error: ${e.message}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${retries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        throw e;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError || new Error(`Evolution API: max retries exceeded for ${path}`);
  } finally {
    // ALWAYS release the concurrency slot
    _releaseSlot();
  }
}

// ════════════════════════════════════════════════════════════
// INSTANCE NAME HELPER
// ════════════════════════════════════════════════════════════

/**
 * Gera o nome da instância no padrão: crm-{tenantId}-{userId}
 */
export function getInstanceName(tenantId: number, userId: number): string {
  return `crm-${tenantId}-${userId}`;
}

// ════════════════════════════════════════════════════════════
// INSTANCE MANAGEMENT
// ════════════════════════════════════════════════════════════

/**
 * Cria uma nova instância na Evolution API e retorna o QR code.
 */
export async function createInstance(
  instanceName: string,
  opts?: { syncFullHistory?: boolean }
): Promise<CreateInstanceResult> {
  const webhookUrl = `${WEBHOOK_BASE_URL}/api/webhooks/evolution`;
  
  return evoFetch<CreateInstanceResult>("/instance/create", {
    method: "POST",
    body: {
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhook: {
        url: webhookUrl,
        byEvents: false,
        base64: false,
        events: [
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "CONNECTION_UPDATE",
          "QRCODE_UPDATED",
          "SEND_MESSAGE",
          "MESSAGES_DELETE",
          "CONTACTS_UPSERT",
        ],
      },
      settings: {
        rejectCall: false,
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: opts?.syncFullHistory ?? false,
      },
    },
    timeout: 60000, // Instance creation can take longer
  });
}

/**
 * Gera um novo QR code para uma instância existente.
 */
export async function connectInstance(instanceName: string): Promise<QrCodeResult> {
  return evoFetch<QrCodeResult>(`/instance/connect/${instanceName}`, {
    timeout: 30000,
  });
}

/**
 * Verifica o estado da conexão de uma instância.
 */
export async function getConnectionState(instanceName: string): Promise<ConnectionState> {
  try {
    return await evoFetch<ConnectionState>(`/instance/connectionState/${instanceName}`);
  } catch (e: any) {
    // 404 means instance doesn't exist — return "close" state
    if (e.message?.includes("not found") || e.message?.includes("not exist") || e.message?.includes("Not Found") || e.message?.includes("404")) {
      return { instance: { instanceName, state: "close" } };
    }
    throw e;
  }
}

/**
 * Busca detalhes de uma instância específica.
 */
export async function fetchInstance(instanceName: string): Promise<EvolutionInstance | null> {
  try {
    const instances = await evoFetch<EvolutionInstance[]>(
      `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`
    );
    return instances.length > 0 ? instances[0] : null;
  } catch (e: any) {
    // 404 means instance doesn't exist — return null instead of throwing
    if (e.message?.includes("not found") || e.message?.includes("Not Found") || e.message?.includes("404")) {
      return null;
    }
    throw e;
  }
}

/**
 * Lista todas as instâncias.
 */
export async function fetchAllInstances(): Promise<EvolutionInstance[]> {
  return evoFetch<EvolutionInstance[]>("/instance/fetchInstances");
}

/**
 * Desconecta uma instância (mantém dados para reconexão).
 */
export async function logoutInstance(instanceName: string): Promise<any> {
  return evoFetch(`/instance/logout/${instanceName}`, { method: "DELETE" });
}

/**
 * Remove uma instância completamente.
 */
export async function deleteInstance(instanceName: string): Promise<any> {
  return evoFetch(`/instance/delete/${instanceName}`, { method: "DELETE" });
}

/**
 * Reinicia uma instância.
 */
export async function restartInstance(instanceName: string): Promise<any> {
  return evoFetch(`/instance/restart/${instanceName}`, { method: "PUT" });
}

// ════════════════════════════════════════════════════════════
// MESSAGING
// ════════════════════════════════════════════════════════════

/**
 * Envia mensagem de texto.
 */
export async function sendText(
  instanceName: string,
  number: string,
  text: string
): Promise<SendMessageResult> {
  return evoFetch<SendMessageResult>(`/message/sendText/${instanceName}`, {
    method: "POST",
    body: { number, text },
  });
}

/**
 * Envia mídia (imagem, vídeo, documento).
 */
export async function sendMedia(
  instanceName: string,
  number: string,
  mediaUrl: string,
  mediaType: "image" | "video" | "audio" | "document",
  opts?: { caption?: string; fileName?: string; mimetype?: string }
): Promise<SendMessageResult> {
  return evoFetch<SendMessageResult>(`/message/sendMedia/${instanceName}`, {
    method: "POST",
    body: {
      number,
      mediatype: mediaType,
      media: mediaUrl,
      caption: opts?.caption,
      fileName: opts?.fileName,
      mimetype: opts?.mimetype,
    },
  });
}

/**
 * Envia áudio (PTT - Push to Talk).
 */
export async function sendAudio(
  instanceName: string,
  number: string,
  audioUrl: string
): Promise<SendMessageResult> {
  return evoFetch<SendMessageResult>(`/message/sendWhatsAppAudio/${instanceName}`, {
    method: "POST",
    body: {
      number,
      audio: audioUrl,
    },
  });
}

/**
 * Busca foto de perfil de um contato.
 */
export async function getProfilePicture(
  instanceName: string,
  number: string
): Promise<string | null> {
  try {
    const result = await evoFetch<{ profilePictureUrl?: string; wpiUrl?: string }>(
      `/chat/fetchProfilePictureUrl/${instanceName}`,
      { method: "POST", body: { number } }
    );
    return result?.profilePictureUrl || result?.wpiUrl || null;
  } catch {
    return null;
  }
}

/**
 * Busca todos os chats de uma instância (para sincronização).
 */
export async function findChats(
  instanceName: string
): Promise<any[]> {
  try {
    const result = await evoFetch<any>(`/chat/findChats/${instanceName}`, {
      method: "POST",
      body: {},
      timeout: 60000, // Can be slow for many chats
    });
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

/**
 * Busca contatos da instância (com pushName, profilePicUrl).
 */
export async function findContacts(
  instanceName: string
): Promise<{ remoteJid: string; pushName: string | null; profilePicUrl: string | null }[]> {
  try {
    const result = await evoFetch<any>(`/chat/findContacts/${instanceName}`, {
      method: "POST",
      body: {},
      timeout: 60000,
    });
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

export async function findMessages(
  instanceName: string,
  remoteJid: string,
  opts?: { limit?: number; page?: number }
): Promise<any[]> {
  try {
    const result = await evoFetch<any>(`/chat/findMessages/${instanceName}`, {
      method: "POST",
      body: {
        where: { key: { remoteJid } },
        limit: opts?.limit || 50,
        page: opts?.page || 1,
      },
    });
    // Evolution API v2 returns { messages: { total, pages, currentPage, records: [...] } }
    if (Array.isArray(result)) return result;
    if (result?.messages?.records && Array.isArray(result.messages.records)) return result.messages.records;
    if (Array.isArray(result?.messages)) return result.messages;
    return [];
  } catch {
    return [];
  }
}

/**
 * Marca mensagens como lidas.
 */
export async function markMessageAsRead(
  instanceName: string,
  remoteJid: string,
  messageIds: string[]
): Promise<void> {
  try {
    await evoFetch(`/chat/markMessageAsRead/${instanceName}`, {
      method: "PUT",
      body: {
        readMessages: messageIds.map((id) => ({
          remoteJid,
          id,
        })),
      },
    });
  } catch (e) {
    console.warn("[EvolutionAPI] markMessageAsRead failed:", e);
  }
}

// ════════════════════════════════════════════════════════════
// REACTIONS & INTERACTIONS
// ════════════════════════════════════════════════════════════

/**
 * Envia reação (emoji) em uma mensagem.
 * Para remover reação, envie reaction como string vazia.
 */
export async function sendReaction(
  instanceName: string,
  key: { remoteJid: string; fromMe: boolean; id: string },
  reaction: string
): Promise<SendMessageResult> {
  return evoFetch<SendMessageResult>(`/message/sendReaction/${instanceName}`, {
    method: "POST",
    body: { key, reaction },
  });
}

/**
 * Envia sticker/figurinha.
 */
export async function sendSticker(
  instanceName: string,
  number: string,
  stickerUrl: string
): Promise<SendMessageResult> {
  return evoFetch<SendMessageResult>(`/message/sendSticker/${instanceName}`, {
    method: "POST",
    body: { number, sticker: stickerUrl },
  });
}

/**
 * Envia localização.
 */
export async function sendLocation(
  instanceName: string,
  number: string,
  latitude: number,
  longitude: number,
  name: string,
  address: string
): Promise<SendMessageResult> {
  return evoFetch<SendMessageResult>(`/message/sendLocation/${instanceName}`, {
    method: "POST",
    body: { number, name, address, latitude, longitude },
  });
}

/**
 * Envia contato (vCard).
 */
export async function sendContact(
  instanceName: string,
  number: string,
  contact: Array<{ fullName: string; wuid?: string; phoneNumber: string }>
): Promise<SendMessageResult> {
  return evoFetch<SendMessageResult>(`/message/sendContact/${instanceName}`, {
    method: "POST",
    body: { number, contact },
  });
}

/**
 * Envia enquete/votação.
 */
export async function sendPoll(
  instanceName: string,
  number: string,
  name: string,
  values: string[],
  selectableCount: number = 1
): Promise<SendMessageResult> {
  return evoFetch<SendMessageResult>(`/message/sendPoll/${instanceName}`, {
    method: "POST",
    body: { number, name, selectableCount, values },
  });
}

/**
 * Envia lista interativa.
 */
export async function sendList(
  instanceName: string,
  number: string,
  title: string,
  description: string,
  buttonText: string,
  footerText: string,
  sections: Array<{ title: string; rows: Array<{ title: string; description?: string; rowId: string }> }>
): Promise<SendMessageResult> {
  return evoFetch<SendMessageResult>(`/message/sendList/${instanceName}`, {
    method: "POST",
    body: { number, title, description, buttonText, footerText, sections },
  });
}

/**
 * Envia botões interativos.
 */
export async function sendButtons(
  instanceName: string,
  number: string,
  title: string,
  description: string,
  footer: string,
  buttons: Array<{ buttonId: string; buttonText: { displayText: string } }>
): Promise<SendMessageResult> {
  return evoFetch<SendMessageResult>(`/message/sendButtons/${instanceName}`, {
    method: "POST",
    body: { number, title, description, footer, buttons },
  });
}

/**
 * Envia texto com quoted message (reply).
 */
export async function sendTextWithQuote(
  instanceName: string,
  number: string,
  text: string,
  quoted: { key: { id: string }; message: { conversation: string } }
): Promise<SendMessageResult> {
  return evoFetch<SendMessageResult>(`/message/sendText/${instanceName}`, {
    method: "POST",
    body: { number, text, quoted },
  });
}

// ════════════════════════════════════════════════════════════
// CHAT CONTROLLER
// ════════════════════════════════════════════════════════════

/**
 * Apaga mensagem para todos.
 */
export async function deleteMessageForEveryone(
  instanceName: string,
  remoteJid: string,
  messageId: string,
  fromMe: boolean
): Promise<any> {
  return evoFetch(`/chat/deleteMessageForEveryone/${instanceName}`, {
    method: "DELETE",
    body: { id: messageId, remoteJid, fromMe },
  });
}

/**
 * Edita mensagem enviada.
 */
export async function updateMessage(
  instanceName: string,
  number: string,
  messageId: string,
  text: string
): Promise<SendMessageResult> {
  return evoFetch<SendMessageResult>(`/chat/updateMessage/${instanceName}`, {
    method: "POST",
    body: { number, key: { id: messageId }, text },
  });
}

/**
 * Envia indicador de presença (digitando, gravando, online, offline).
 */
export async function sendPresence(
  instanceName: string,
  number: string,
  presence: "composing" | "recording" | "available" | "unavailable" | "paused"
): Promise<void> {
  try {
    await evoFetch(`/chat/sendPresence/${instanceName}`, {
      method: "POST",
      body: { number, presence, delay: 1200 },
    });
  } catch (e) {
    console.warn("[EvolutionAPI] sendPresence failed:", e);
  }
}

/**
 * Arquiva/desarquiva uma conversa.
 */
export async function archiveChat(
  instanceName: string,
  remoteJid: string,
  archive: boolean
): Promise<void> {
  try {
    await evoFetch(`/chat/archiveChat/${instanceName}`, {
      method: "POST",
      body: { lastMessage: { key: { remoteJid } }, archive },
    });
  } catch (e) {
    console.warn("[EvolutionAPI] archiveChat failed:", e);
  }
}

/**
 * Bloqueia/desbloqueia um contato.
 */
export async function updateBlockStatus(
  instanceName: string,
  number: string,
  status: "block" | "unblock"
): Promise<void> {
  try {
    await evoFetch(`/chat/updateBlockStatus/${instanceName}`, {
      method: "POST",
      body: { number, status },
    });
  } catch (e) {
    console.warn("[EvolutionAPI] updateBlockStatus failed:", e);
  }
}

/**
 * Verifica se um número tem WhatsApp.
 */
export async function checkIsWhatsApp(
  instanceName: string,
  numbers: string[]
): Promise<Array<{ exists: boolean; jid: string; number: string }>> {
  try {
    const result = await evoFetch<any>(`/chat/checkIsWhatsApp/${instanceName}`, {
      method: "POST",
      body: { numbers },
    });
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

/**
 * Marca mensagens como não lidas.
 */
export async function markMessageAsUnread(
  instanceName: string,
  remoteJid: string,
  messageId: string
): Promise<void> {
  try {
    await evoFetch(`/chat/markMessageAsUnread/${instanceName}`, {
      method: "POST",
      body: { readMessages: [{ remoteJid, id: messageId }] },
    });
  } catch (e) {
    console.warn("[EvolutionAPI] markMessageAsUnread failed:", e);
  }
}

// ════════════════════════════════════════════════════════════
// PROFILE
// ════════════════════════════════════════════════════════════

/**
 * Busca perfil completo de um contato.
 */
export async function fetchProfile(
  instanceName: string,
  number: string
): Promise<any> {
  try {
    return await evoFetch(`/chat/fetchProfile/${instanceName}`, {
      method: "POST",
      body: { number },
    });
  } catch {
    return null;
  }
}

/**
 * Busca perfil comercial (WhatsApp Business).
 */
export async function fetchBusinessProfile(
  instanceName: string,
  number: string
): Promise<any> {
  try {
    return await evoFetch(`/chat/fetchBusinessProfile/${instanceName}`, {
      method: "POST",
      body: { number },
    });
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════
// GROUPS
// ════════════════════════════════════════════════════════════

/**
 * Cria um grupo.
 */
export async function createGroup(
  instanceName: string,
  subject: string,
  participants: string[],
  description?: string
): Promise<any> {
  return evoFetch(`/group/create/${instanceName}`, {
    method: "POST",
    body: { subject, participants, description },
  });
}

/**
 * Lista todos os grupos.
 */
export async function fetchAllGroups(
  instanceName: string
): Promise<any[]> {
  try {
    const result = await evoFetch<any>(`/group/fetchAllGroups/${instanceName}?getParticipants=false`);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

/**
 * Busca informações de um grupo por JID.
 */
export async function findGroupByJid(
  instanceName: string,
  groupJid: string
): Promise<any> {
  try {
    return await evoFetch(`/group/findGroupInfos/${instanceName}?groupJid=${encodeURIComponent(groupJid)}`);
  } catch {
    return null;
  }
}

/**
 * Busca membros de um grupo.
 */
export async function findGroupMembers(
  instanceName: string,
  groupJid: string
): Promise<any[]> {
  try {
    const result = await evoFetch<any>(`/group/findGroupMembers/${instanceName}?groupJid=${encodeURIComponent(groupJid)}`);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

/**
 * Adiciona ou remove membros de um grupo.
 */
export async function updateGroupMembers(
  instanceName: string,
  groupJid: string,
  action: "add" | "remove" | "promote" | "demote",
  participants: string[]
): Promise<any> {
  return evoFetch(`/group/updateGroupMembers/${instanceName}`, {
    method: "POST",
    body: { groupJid, action, participants },
  });
}

/**
 * Atualiza nome do grupo.
 */
export async function updateGroupSubject(
  instanceName: string,
  groupJid: string,
  subject: string
): Promise<any> {
  return evoFetch(`/group/updateGroupSubject/${instanceName}`, {
    method: "POST",
    body: { groupJid, subject },
  });
}

/**
 * Atualiza descrição do grupo.
 */
export async function updateGroupDescription(
  instanceName: string,
  groupJid: string,
  description: string
): Promise<any> {
  return evoFetch(`/group/updateGroupDescription/${instanceName}`, {
    method: "POST",
    body: { groupJid, description },
  });
}

/**
 * Busca código de convite do grupo.
 */
export async function fetchInviteCode(
  instanceName: string,
  groupJid: string
): Promise<string | null> {
  try {
    const result = await evoFetch<any>(`/group/fetchInviteCode/${instanceName}?groupJid=${encodeURIComponent(groupJid)}`);
    return result?.inviteCode || result?.code || null;
  } catch {
    return null;
  }
}

/**
 * Revoga código de convite do grupo.
 */
export async function revokeInviteCode(
  instanceName: string,
  groupJid: string
): Promise<string | null> {
  try {
    const result = await evoFetch<any>(`/group/revokeInviteCode/${instanceName}`, {
      method: "POST",
      body: { groupJid },
    });
    return result?.inviteCode || result?.code || null;
  } catch {
    return null;
  }
}

/**
 * Atualiza configurações do grupo.
 */
export async function updateGroupSetting(
  instanceName: string,
  groupJid: string,
  action: "announcement" | "not_announcement" | "locked" | "unlocked"
): Promise<any> {
  return evoFetch(`/group/updateGroupSetting/${instanceName}`, {
    method: "POST",
    body: { groupJid, action },
  });
}

/**
 * Ativa/desativa mensagens temporárias no grupo.
 */
export async function toggleEphemeral(
  instanceName: string,
  groupJid: string,
  expiration: number // 0 = off, 86400 = 24h, 604800 = 7d, 7776000 = 90d
): Promise<any> {
  return evoFetch(`/group/toggleEphemeral/${instanceName}`, {
    method: "POST",
    body: { groupJid, expiration },
  });
}

/**
 * Sai de um grupo.
 */
export async function leaveGroup(
  instanceName: string,
  groupJid: string
): Promise<any> {
  return evoFetch(`/group/leaveGroup/${instanceName}`, {
    method: "DELETE",
    body: { groupJid },
  });
}

// ════════════════════════════════════════════════════════════
// WEBHOOK EVENT TYPES
// ════════════════════════════════════════════════════════════

export type WebhookEventType =
  | "messages.upsert"
  | "messages.update"
  | "messages.delete"
  | "connection.update"
  | "qrcode.updated"
  | "send.message"
  | "contacts.upsert"
  | "groups.update";

export interface WebhookPayload {
  event: WebhookEventType;
  instance: string;
  data: any;
  destination?: string;
  date_time?: string;
  server_url?: string;
  apikey?: string;
}

// ════════════════════════════════════════════════════════════
// MEDIA DOWNLOAD
// ════════════════════════════════════════════════════════════
/**
 * Obtém a mídia de uma mensagem como base64.
 * Evolution API v2: POST /chat/getBase64FromMediaMessage/{instance}
 */
export async function getBase64FromMediaMessage(
  instance: string,
  messageId: string,
  options?: { remoteJid?: string; fromMe?: boolean; convertToMp4?: boolean },
): Promise<{ base64: string; mimetype: string; fileName?: string } | null> {
  try {
    // Evolution API requires the full message key (id + remoteJid + fromMe) to find the message
    const key: Record<string, any> = { id: messageId };
    if (options?.remoteJid) key.remoteJid = options.remoteJid;
    if (options?.fromMe !== undefined) key.fromMe = options.fromMe;

    const data = await evoFetch<any>(
      `/chat/getBase64FromMediaMessage/${instance}`,
      {
        method: "POST",
        body: {
          message: { key },
          convertToMp4: options?.convertToMp4 || false,
        },
      }
    );
    return data || null;
  } catch (e: any) {
    console.error(`[EvoAPI] getBase64FromMediaMessage error for ${instance}:`, e.message);
    return null;
  }
}

// ════════════════════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════════════════════

/**
 * Verifica se o servidor Evolution API está acessível.
 */
export async function healthCheck(): Promise<{
  ok: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const data = await evoFetch<{ status: number; version: string; message: string }>("/");
    return { ok: data.status === 200, version: data.version };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}


// ════════════════════════════════════════════════════════════
// WEBHOOK MANAGEMENT
// ════════════════════════════════════════════════════════════

/**
 * Get current webhook configuration for an instance.
 */
export async function findWebhook(instanceName: string): Promise<{
  enabled: boolean;
  url: string;
  events: string[];
} | null> {
  try {
    const data = await evoFetch<any>(`/webhook/find/${instanceName}`, { timeout: 10000 });
    return data;
  } catch {
    return null;
  }
}

/**
 * Set/update webhook configuration for an instance.
 */
export async function setWebhook(instanceName: string, opts?: { url?: string; events?: string[] }): Promise<boolean> {
  const webhookUrl = opts?.url || `${WEBHOOK_BASE_URL}/api/webhooks/evolution`;
  const events = opts?.events || [
    "MESSAGES_UPSERT",
    "MESSAGES_UPDATE",
    "CONNECTION_UPDATE",
    "QRCODE_UPDATED",
    "SEND_MESSAGE",
    "MESSAGES_DELETE",
    "CONTACTS_UPSERT",
  ];
  try {
    await evoFetch(`/webhook/set/${instanceName}`, {
      method: "POST",
      body: {
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events,
        },
      },
      timeout: 15000,
    });
    return true;
  } catch (e: any) {
    console.error(`[EvoAPI] Failed to set webhook for ${instanceName}:`, e.message);
    return false;
  }
}

/**
 * Verify and fix webhook configuration for an instance.
 * Returns true if webhook was already correct or was successfully fixed.
 */
export async function ensureWebhook(instanceName: string): Promise<boolean> {
  const expectedUrl = `${WEBHOOK_BASE_URL}/api/webhooks/evolution`;
  try {
    const current = await findWebhook(instanceName);
    if (current && current.enabled && current.url === expectedUrl) {
      return true; // Already correct
    }
    console.log(`[EvoAPI] Webhook misconfigured for ${instanceName}, fixing... (current: ${current?.url || "none"}, expected: ${expectedUrl})`);
    return await setWebhook(instanceName);
  } catch (e: any) {
    console.error(`[EvoAPI] Error ensuring webhook for ${instanceName}:`, e.message);
    return false;
  }
}
