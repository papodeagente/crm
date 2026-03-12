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
 * - GET    /chat/findMessages/{name}   — Busca mensagens
 * - PUT    /instance/restart/{name}    — Reinicia instância
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
// HTTP HELPERS
// ════════════════════════════════════════════════════════════

async function evoFetch<T = any>(
  path: string,
  options: { method?: string; body?: any; timeout?: number } = {}
): Promise<T> {
  const { method = "GET", body, timeout = 30000 } = options;

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    throw new Error("Evolution API not configured (missing EVOLUTION_API_URL or EVOLUTION_API_KEY)");
  }

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

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.response?.message?.[0] || data?.message || `HTTP ${response.status}`;
      throw new Error(`Evolution API error: ${errMsg}`);
    }

    return data as T;
  } finally {
    clearTimeout(timer);
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
        byEvents: true,
        base64: false,
        events: [
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "CONNECTION_UPDATE",
          "QRCODE_UPDATED",
          "SEND_MESSAGE",
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
  return evoFetch<ConnectionState>(`/instance/connectionState/${instanceName}`);
}

/**
 * Busca detalhes de uma instância específica.
 */
export async function fetchInstance(instanceName: string): Promise<EvolutionInstance | null> {
  const instances = await evoFetch<EvolutionInstance[]>(
    `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`
  );
  return instances.length > 0 ? instances[0] : null;
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
 * Busca mensagens de um chat.
 */
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
    return Array.isArray(result) ? result : result?.messages || [];
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
// WEBHOOK EVENT TYPES
// ════════════════════════════════════════════════════════════

export type WebhookEventType =
  | "messages.upsert"
  | "messages.update"
  | "connection.update"
  | "qrcode.updated"
  | "send.message";

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
