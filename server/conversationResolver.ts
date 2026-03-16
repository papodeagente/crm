/**
 * ConversationIdentityResolver
 * 
 * Módulo responsável por resolver identidades WhatsApp e conversas canônicas.
 * Garante que cada contato tenha uma única conversa, independente de variações
 * de formato de número (com/sem 9o dígito, com/sem +55, etc).
 * 
 * Funções principais:
 * - normalizePhone: normaliza qualquer formato de telefone para E.164
 * - resolveContact: upsert de contato por phoneE164
 * - resolveIdentity: upsert de identidade WhatsApp
 * - resolveConversation: upsert de conversa canônica
 * - reconcileGhostThreads: mescla threads fantasma duplicadas
 */

import { getDb } from "./db";
import { waConversations, waIdentities, waAuditLog, contacts } from "../drizzle/schema";
import { eq, and, sql, or, inArray } from "drizzle-orm";
import { normalizeBrazilianPhone, getAllJidVariants } from "./phoneUtils";

// ════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════

export interface NormalizedPhone {
  phoneE164: string;       // e.g. "+5584999838420"
  digitsOnly: string;      // e.g. "5584999838420"
  last11BR: string;        // e.g. "84999838420"
  valid: boolean;
  reason?: string;
}

export interface ResolvedConversation {
  conversationId: number;
  contactId: number | null;
  identityId: number;
  conversationKey: string;
  phoneE164: string;
  isNew: boolean;
}

// ════════════════════════════════════════════════════════════
// normalizePhone
// ════════════════════════════════════════════════════════════

/**
 * Normaliza qualquer formato de telefone para o formato canônico.
 * Retorna phoneE164, digitsOnly, last11BR e flag de validade.
 */
export function normalizePhone(input: string, defaultCountry = "55"): NormalizedPhone {
  if (!input || !input.trim()) {
    return { phoneE164: "", digitsOnly: "", last11BR: "", valid: false, reason: "empty_input" };
  }

  // Remove tudo que não é dígito
  let digits = input.replace(/\D/g, "");

  // Remove zeros à esquerda
  digits = digits.replace(/^0+/, "");

  if (!digits || digits.length < 8) {
    return { phoneE164: "", digitsOnly: "", last11BR: "", valid: false, reason: "too_short" };
  }

  // Adiciona código do país se não presente
  if (!digits.startsWith(defaultCountry)) {
    if (digits.length <= 11) {
      digits = `${defaultCountry}${digits}`;
    }
  }

  // Para números brasileiros, garantir 9o dígito
  if (digits.startsWith("55")) {
    const ddd = digits.substring(2, 4);
    const rest = digits.substring(4);

    // Validar DDD (11-99)
    const dddNum = parseInt(ddd, 10);
    if (dddNum < 11 || dddNum > 99) {
      return { phoneE164: "", digitsOnly: "", last11BR: "", valid: false, reason: "invalid_ddd" };
    }

    // Adicionar 9o dígito se faltando (8 dígitos após DDD)
    if (rest.length === 8) {
      digits = `55${ddd}9${rest}`;
    }

    // Validar comprimento final (13 dígitos para BR móvel)
    if (digits.length !== 13) {
      // Pode ser fixo (12 dígitos) — aceitar também
      if (digits.length !== 12) {
        return { phoneE164: `+${digits}`, digitsOnly: digits, last11BR: digits.slice(-11), valid: false, reason: "unexpected_length" };
      }
    }
  }

  const phoneE164 = `+${digits}`;
  const last11BR = digits.length >= 11 ? digits.slice(-11) : digits;

  return {
    phoneE164,
    digitsOnly: digits,
    last11BR,
    valid: true,
  };
}

// ════════════════════════════════════════════════════════════
// buildConversationKey
// ════════════════════════════════════════════════════════════

/**
 * Gera a chave canônica de conversa: "wa:{sessionId}:{phoneE164_digits}"
 * Garante que variações de JID resultem na mesma chave.
 */
export function buildConversationKey(sessionId: string, phoneE164Digits: string): string {
  return `wa:${sessionId}:${phoneE164Digits}`;
}

// ════════════════════════════════════════════════════════════
// resolveContact
// ════════════════════════════════════════════════════════════

/**
 * Encontra ou cria um contato pelo phoneE164.
 * Se o contato já existe com o mesmo phoneE164, retorna o existente.
 * Se não existe, cria um novo com o nome fornecido (ou "Desconhecido").
 */
export async function resolveContact(
  tenantId: number,
  phoneE164: string,
  name?: string | null,
  options?: { skipCreation?: boolean },
): Promise<{ contactId: number; isNew: boolean } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalized = normalizePhone(phoneE164);
  if (!normalized.valid) {
    throw new Error(`Invalid phone for contact resolution: ${phoneE164} (${normalized.reason})`);
  }

  // Buscar por phoneE164 primeiro
  const existing = await db.select({ id: contacts.id })
    .from(contacts)
    .where(and(
      eq(contacts.tenantId, tenantId),
      eq(contacts.phoneE164, normalized.phoneE164),
    ))
    .limit(1);

  if (existing.length > 0) {
    // Update contact name if a real name is provided and current name is just a phone number
    if (name) {
      const cleanedName = name.replace(/[\s\-\(\)\+]/g, '');
      const isRealName = !/^\d+$/.test(cleanedName) && name !== 'Voc\u00ea' && name !== 'You';
      if (isRealName) {
        // Check if current name is just a phone number
        const currentContact = await db.select({ name: contacts.name })
          .from(contacts)
          .where(eq(contacts.id, existing[0].id))
          .limit(1);
        const currentName = currentContact[0]?.name || '';
        const currentCleaned = currentName.replace(/[\s\-\(\)\+]/g, '');
        const currentIsPhone = /^\d+$/.test(currentCleaned) || !currentName;
        if (currentIsPhone) {
          await db.update(contacts)
            .set({ name, updatedAt: new Date() })
            .where(eq(contacts.id, existing[0].id));
        }
      }
    }
    return { contactId: existing[0].id, isNew: false };
  }

  // Buscar por phone legado (sem E164) — pode já existir com formato antigo
  const legacyMatches = await db.select({ id: contacts.id, phone: contacts.phone })
    .from(contacts)
    .where(and(
      eq(contacts.tenantId, tenantId),
      sql`${contacts.phone} IS NOT NULL AND ${contacts.phone} != ''`,
    ))
    .limit(200);

  for (const c of legacyMatches) {
    if (!c.phone) continue;
    const legacyNorm = normalizePhone(c.phone);
    if (legacyNorm.valid && legacyNorm.phoneE164 === normalized.phoneE164) {
      // Atualizar o contato existente com phoneE164
      await db.update(contacts)
        .set({
          phoneE164: normalized.phoneE164,
          phoneDigits: normalized.digitsOnly,
          phoneLast11: normalized.last11BR,
        })
        .where(eq(contacts.id, c.id));
      return { contactId: c.id, isNew: false };
    }
  }

  // Se skipCreation está ativo, não criar novo contato (apenas retornar existente)
  if (options?.skipCreation) {
    return null;
  }

  // Criar novo contato
  const displayName = name || `+${normalized.digitsOnly}`;
  const result = await db.insert(contacts).values({
    tenantId,
    name: displayName,
    phone: normalized.phoneE164,
    phoneE164: normalized.phoneE164,
    phoneDigits: normalized.digitsOnly,
    phoneLast11: normalized.last11BR,
    source: "whatsapp",
    type: "person",
  });

  const insertId = (result as any)[0]?.insertId;
  return { contactId: insertId, isNew: true };
}

// ════════════════════════════════════════════════════════════
// resolveIdentity
// ════════════════════════════════════════════════════════════

/**
 * Registra ou atualiza uma identidade WhatsApp (JID → contato).
 */
export async function resolveIdentity(
  tenantId: number,
  sessionId: string,
  remoteJid: string,
  contactId?: number | null,
  phoneE164?: string | null,
): Promise<{ identityId: number; isNew: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Extract digits from the raw JID for phone normalization
  const jidDigits = remoteJid.replace(/@.*$/, "").replace(/\D/g, "");
  const phone = phoneE164 || normalizePhone(jidDigits).phoneE164;

  // For identity lookup, we need to match by phoneE164 (canonical)
  // because the same contact may appear with different JID formats
  // First try exact JID match, then phoneE164 match
  const existing = await db.select({ id: waIdentities.id, remoteJid: waIdentities.remoteJid })
    .from(waIdentities)
    .where(and(
      eq(waIdentities.sessionId, sessionId),
      eq(waIdentities.phoneE164, phone),
    ))
    .limit(1);

  if (existing.length > 0) {
    // Atualizar lastSeenAt, contactId e remoteJid (raw) se fornecido
    const updateData: any = { lastSeenAt: new Date() };
    if (contactId) updateData.contactId = contactId;
    if (phone) updateData.phoneE164 = phone;
    // Always update remoteJid with the latest raw JID from WhatsApp
    updateData.remoteJid = remoteJid;

    await db.update(waIdentities)
      .set(updateData)
      .where(eq(waIdentities.id, existing[0].id));

    return { identityId: existing[0].id, isNew: false };
  }

  // Criar nova identidade — store raw JID
  const result = await db.insert(waIdentities).values({
    tenantId,
    sessionId,
    contactId: contactId || null,
    remoteJid: remoteJid, // RAW JID from WhatsApp
    waId: jidDigits,
    phoneE164: phone,
    confidenceScore: 80,
  });

  const insertId = (result as any)[0]?.insertId;
  return { identityId: insertId, isNew: true };
}

// ════════════════════════════════════════════════════════════
// resolveConversation
// ════════════════════════════════════════════════════════════

/**
 * Encontra ou cria a conversa canônica para um (sessionId, phoneE164).
 * A chave canônica é "wa:{sessionId}:{phoneE164_digits}".
 * Se já existe, retorna a existente. Se não, cria uma nova.
 */
export async function resolveConversation(
  tenantId: number,
  sessionId: string,
  remoteJid: string,
  contactId?: number | null,
  pushName?: string | null,
): Promise<{ conversationId: number; isNew: boolean; conversationKey: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // IMPORTANT: Use normalizePhone for the CANONICAL KEY (deduplication),
  // but preserve the raw remoteJid for storage (used for sending replies).
  // The raw JID is what WhatsApp actually recognizes.
  const jidDigits = remoteJid.replace(/@.*$/, "").replace(/\D/g, "");
  const phone = normalizePhone(jidDigits);

  // Usar phoneE164 digits como chave canônica (deduplication only)
  const keyDigits = phone.valid ? phone.digitsOnly : jidDigits;
  const conversationKey = buildConversationKey(sessionId, keyDigits);

  // Buscar conversa existente por conversationKey
  const existing = await db.select({
    id: waConversations.id,
    mergedIntoId: waConversations.mergedIntoId,
  })
    .from(waConversations)
    .where(and(
      eq(waConversations.tenantId, tenantId),
      eq(waConversations.conversationKey, conversationKey),
    ))
    .limit(1);

  if (existing.length > 0) {
    let convId = existing[0].id;

    // Se foi mesclada, seguir o ponteiro
    if (existing[0].mergedIntoId) {
      convId = existing[0].mergedIntoId;
    }

    // Atualizar pushName, contactId e remoteJid (raw) se fornecidos
    const updateData: any = {};
    // Only update contactPushName if it's a real name (not just a phone number)
    if (pushName) {
      const cleanedPush = pushName.replace(/[\s\-\(\)\+]/g, '');
      const isRealName = !/^\d+$/.test(cleanedPush) && pushName !== 'Você' && pushName !== 'You';
      if (isRealName) {
        updateData.contactPushName = pushName;
      }
    }
    if (contactId) updateData.contactId = contactId;
    // Always update remoteJid with the RAW JID from WhatsApp
    // This ensures replies go to the correct JID
    updateData.remoteJid = remoteJid;

    if (Object.keys(updateData).length > 0) {
      await db.update(waConversations)
        .set(updateData)
        .where(eq(waConversations.id, convId));
    }

    return { conversationId: convId, isNew: false, conversationKey };
  }

  // Criar nova conversa — store the RAW JID, not normalized
  // Wrapped in try/catch for race condition: if two messages arrive simultaneously
  // for the same new contact, the unique index on conversationKey prevents duplicates.
  try {
    const result = await db.insert(waConversations).values({
      tenantId,
      sessionId,
      contactId: contactId || null,
      remoteJid: remoteJid, // RAW JID from WhatsApp — critical for replies
      conversationKey,
      phoneE164: phone.valid ? phone.phoneE164 : null,
      phoneDigits: phone.valid ? phone.digitsOnly : jidDigits,
      phoneLast11: phone.valid ? phone.last11BR : null,
      status: "open",
      contactPushName: pushName || null,
      unreadCount: 0,
    });

    const insertId = (result as any)[0]?.insertId;
    return { conversationId: insertId, isNew: true, conversationKey };
  } catch (err: any) {
    // ER_DUP_ENTRY (1062) — another request created the conversation first.
    // Re-fetch and return the existing one.
    if (err?.errno === 1062 || err?.code === "ER_DUP_ENTRY") {
      console.log(`[ConvResolver] Race condition handled for key ${conversationKey} — re-fetching existing`);
      const [raceWinner] = await db.select({ id: waConversations.id })
        .from(waConversations)
        .where(eq(waConversations.conversationKey, conversationKey))
        .limit(1);
      if (raceWinner) {
        return { conversationId: raceWinner.id, isNew: false, conversationKey };
      }
    }
    throw err; // Re-throw unexpected errors
  }
}

// ════════════════════════════════════════════════════════════
// updateConversationLastMessage
// ════════════════════════════════════════════════════════════

/**
 * Atualiza os campos de última mensagem na conversa canônica.
 */
export async function updateConversationLastMessage(
  conversationId: number,
  data: {
    content?: string;
    messageType?: string;
    fromMe?: boolean;
    status?: string;
    timestamp?: Date;
    incrementUnread?: boolean;
  },
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const newTimestamp = data.timestamp || new Date();

  const updateData: any = {
    lastMessageAt: newTimestamp,
    lastMessagePreview: data.content ? data.content.substring(0, 300) : null,
    lastMessageType: data.messageType || "text",
    lastFromMe: data.fromMe ?? false,
    lastStatus: data.status || "received",
  };

  if (data.incrementUnread && !data.fromMe) {
    updateData.unreadCount = sql`unreadCount + 1`;
  }

  // Only update preview if this message is newer than the current lastMessageAt
  // This prevents older reconciliation messages from overwriting the latest preview
  await db.update(waConversations)
    .set(updateData)
    .where(
      and(
        eq(waConversations.id, conversationId),
        sql`(lastMessageAt IS NULL OR lastMessageAt <= ${newTimestamp})`
      )
    );
}

// ════════════════════════════════════════════════════════════
// markConversationRead
// ════════════════════════════════════════════════════════════

/**
 * Zera o unreadCount de uma conversa canônica.
 */
export async function markWaConversationRead(conversationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(waConversations)
    .set({ unreadCount: 0 })
    .where(eq(waConversations.id, conversationId));
}

// ════════════════════════════════════════════════════════════
// resolveInbound — Fluxo completo para mensagem recebida
// ════════════════════════════════════════════════════════════

/**
 * Fluxo completo de resolução para uma mensagem recebida:
 * 1. normalizePhone do JID
 * 2. resolveContact (upsert)
 * 3. resolveIdentity (upsert)
 * 4. resolveConversation (upsert)
 * 5. Retorna IDs canônicos
 */
export async function resolveInbound(
  tenantId: number,
  sessionId: string,
  remoteJid: string,
  pushName?: string | null,
  options?: { skipContactCreation?: boolean },
): Promise<ResolvedConversation> {
  // Use raw JID for storage, but normalize phone for canonical key/deduplication
  const jidDigits = remoteJid.replace(/@.*$/, "").replace(/\D/g, "");
  const phone = normalizePhone(jidDigits);

  let contactId: number | null = null;

  // Resolver contato se telefone válido
  if (phone.valid) {
    try {
      const contactResult = await resolveContact(tenantId, phone.phoneE164, pushName, { skipCreation: options?.skipContactCreation });
      contactId = contactResult?.contactId ?? null;
    } catch (e) {
      console.error("[ConvResolver] Error resolving contact:", e);
    }
  }

  // Resolver identidade — pass raw JID so it's stored as-is
  const identity = await resolveIdentity(tenantId, sessionId, remoteJid, contactId, phone.valid ? phone.phoneE164 : null);

  // Resolver conversa — pass raw JID so it's stored as-is
  const conversation = await resolveConversation(tenantId, sessionId, remoteJid, contactId, pushName);

  // Audit log
  await logAudit(tenantId, "conversation_resolved", "wa_conversation", String(conversation.conversationId), {
    remoteJid: remoteJid,
    phoneE164: phone.phoneE164,
    contactId,
    identityId: identity.identityId,
    isNewConversation: conversation.isNew,
    isNewIdentity: identity.isNew,
  });

  return {
    conversationId: conversation.conversationId,
    contactId,
    identityId: identity.identityId,
    conversationKey: conversation.conversationKey,
    phoneE164: phone.valid ? phone.phoneE164 : `+${jidDigits}`,
    isNew: conversation.isNew,
  };
}

// ════════════════════════════════════════════════════════════
// resolveOutbound — Fluxo completo para mensagem enviada
// ════════════════════════════════════════════════════════════

/**
 * Mesmo fluxo do inbound, mas para mensagens enviadas.
 * Garante que a conversa canônica exista antes de enviar.
 */
export async function resolveOutbound(
  tenantId: number,
  sessionId: string,
  targetJid: string,
  options?: { skipContactCreation?: boolean },
): Promise<ResolvedConversation> {
  return resolveInbound(tenantId, sessionId, targetJid, undefined, options);
}

// ════════════════════════════════════════════════════════════
// reconcileGhostThreads
// ════════════════════════════════════════════════════════════

/**
 * Encontra e mescla conversas fantasma (duplicadas por variação de JID).
 * Agrupa por phoneE164 e mantém a conversa mais antiga como canônica.
 * Mensagens das conversas fantasma são reatribuídas à conversa canônica.
 */
export async function reconcileGhostThreads(
  tenantId: number,
  sessionId: string,
): Promise<{ mergedCount: number; details: Array<{ canonical: number; ghosts: number[] }> }> {
  const db = await getDb();
  if (!db) return { mergedCount: 0, details: [] };

  // Encontrar phoneE164 com mais de uma conversa
  const duplicates = await db.execute(sql`
    SELECT phoneE164, COUNT(*) as cnt, GROUP_CONCAT(id ORDER BY id ASC) as ids
    FROM wa_conversations
    WHERE tenantId = ${tenantId}
    AND sessionId = ${sessionId}
    AND phoneE164 IS NOT NULL
    AND mergedIntoId IS NULL
    GROUP BY phoneE164
    HAVING cnt > 1
  `);

  const rows = (duplicates as any)[0] || [];
  const details: Array<{ canonical: number; ghosts: number[] }> = [];
  let mergedCount = 0;

  for (const row of rows) {
    const ids = String(row.ids).split(",").map(Number);
    if (ids.length < 2) continue;

    const canonicalId = ids[0]; // Mais antigo
    const ghostIds = ids.slice(1);

    // Reatribuir mensagens das conversas fantasma para a canônica
    for (const ghostId of ghostIds) {
      // Atualizar mensagens
      await db.execute(sql`
        UPDATE messages SET waConversationId = ${canonicalId}
        WHERE waConversationId = ${ghostId}
      `);

      // Marcar conversa fantasma como mesclada
      await db.update(waConversations)
        .set({ mergedIntoId: canonicalId, status: "closed" })
        .where(eq(waConversations.id, ghostId));

      // Reatribuir deals
      await db.execute(sql`
        UPDATE deals SET waConversationId = ${canonicalId}
        WHERE waConversationId = ${ghostId}
      `);

      mergedCount++;
    }

    // Recalcular unreadCount da conversa canônica
    const unreadResult = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM messages
      WHERE waConversationId = ${canonicalId}
      AND fromMe = 0
      AND (status IS NULL OR status = 'received')
    `);
    const unreadCount = ((unreadResult as any)[0]?.[0]?.cnt) || 0;

    await db.update(waConversations)
      .set({ unreadCount })
      .where(eq(waConversations.id, canonicalId));

    details.push({ canonical: canonicalId, ghosts: ghostIds });

    // Audit log
    await logAudit(tenantId, "ghost_merge_performed", "wa_conversation", String(canonicalId), {
      ghostIds,
      mergedMessages: true,
    });
  }

  return { mergedCount, details };
}

// ════════════════════════════════════════════════════════════
// migrateExistingData
// ════════════════════════════════════════════════════════════

/**
 * Migra dados existentes da tabela messages para wa_conversations.
 * Agrupa mensagens por (sessionId, remoteJid normalizado) e cria conversas canônicas.
 */
export async function migrateExistingData(tenantId: number): Promise<{ conversationsCreated: number; messagesLinked: number; identitiesCreated: number }> {
  const db = await getDb();
  if (!db) return { conversationsCreated: 0, messagesLinked: 0, identitiesCreated: 0 };

  // Buscar todas as conversas distintas na tabela messages
  const distinctConvs = await db.execute(sql`
    SELECT sessionId, remoteJid, 
           COUNT(*) as msgCount,
           MAX(timestamp) as lastTs,
           (SELECT m2.pushName FROM messages m2 
            WHERE m2.sessionId = m.sessionId AND m2.remoteJid = m.remoteJid 
            AND m2.fromMe = 0 AND m2.pushName IS NOT NULL AND m2.pushName != ''
            ORDER BY m2.id DESC LIMIT 1) as pushName
    FROM messages m
    WHERE tenantId = ${tenantId}
    AND remoteJid NOT LIKE '%@g.us'
    AND remoteJid != 'status@broadcast'
    AND waConversationId IS NULL
    GROUP BY sessionId, remoteJid
  `);

  const rows = (distinctConvs as any)[0] || [];
  let conversationsCreated = 0;
  let messagesLinked = 0;
  let identitiesCreated = 0;

  for (const row of rows) {
    const { sessionId, remoteJid, pushName } = row;

    try {
      // Resolver conversa (cria se não existe) - don't create CRM contacts during reconciliation
      const resolved = await resolveInbound(tenantId, sessionId, remoteJid, pushName, { skipContactCreation: true });

      // Linkar mensagens existentes
      const jidVariants = getAllJidVariants(remoteJid);
      for (const jid of jidVariants) {
        const updateResult = await db.execute(sql`
          UPDATE messages 
          SET waConversationId = ${resolved.conversationId}
          WHERE sessionId = ${sessionId}
          AND remoteJid = ${jid}
          AND waConversationId IS NULL
        `);
        messagesLinked += ((updateResult as any)[0]?.affectedRows) || 0;
      }

      if (resolved.isNew) conversationsCreated++;
      identitiesCreated++;

      // Atualizar última mensagem da conversa
      const lastMsg = await db.execute(sql`
        SELECT content, messageType, fromMe, status, timestamp
        FROM messages
        WHERE waConversationId = ${resolved.conversationId}
        ORDER BY timestamp DESC
        LIMIT 1
      `);
      const lastMsgRow = (lastMsg as any)[0]?.[0];
      if (lastMsgRow) {
        await updateConversationLastMessage(resolved.conversationId, {
          content: lastMsgRow.content,
          messageType: lastMsgRow.messageType,
          fromMe: !!lastMsgRow.fromMe,
          status: lastMsgRow.status,
          timestamp: lastMsgRow.timestamp,
        });
      }

      // Calcular unreadCount
      const unreadResult = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM messages
        WHERE waConversationId = ${resolved.conversationId}
        AND fromMe = 0
        AND (status IS NULL OR status = 'received')
      `);
      const unreadCount = ((unreadResult as any)[0]?.[0]?.cnt) || 0;
      await db.update(waConversations)
        .set({ unreadCount })
        .where(eq(waConversations.id, resolved.conversationId));

    } catch (e) {
      console.error(`[Migration] Error migrating conversation ${remoteJid}:`, e);
    }
  }

  // Reconciliar fantasmas após migração
  const sessions = Array.from(new Set(rows.map((r: any) => r.sessionId))) as string[];
  for (const sid of sessions) {
    await reconcileGhostThreads(tenantId, sid as string);
  }

  return { conversationsCreated, messagesLinked, identitiesCreated };
}

// ════════════════════════════════════════════════════════════
// Audit Log Helper
// ════════════════════════════════════════════════════════════

async function logAudit(
  tenantId: number,
  action: string,
  entityType: string,
  entityId: string,
  data: Record<string, any>,
  correlationId?: string,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(waAuditLog).values({
      tenantId,
      action,
      entityType,
      entityId,
      inputsJson: data,
      correlationId: correlationId || undefined,
    });
  } catch (e) {
    console.error("[AuditLog] Error:", e);
  }
}

// ════════════════════════════════════════════════════════════
// getConversationByJid — Busca conversa por JID
// ════════════════════════════════════════════════════════════

/**
 * Busca a conversa canônica por remoteJid (normalizado).
 * Útil para queries rápidas sem criar nova conversa.
 */
export async function getConversationByJid(
  tenantId: number,
  sessionId: string,
  remoteJid: string,
): Promise<{ conversationId: number; contactId: number | null } | null> {
  const db = await getDb();
  if (!db) return null;

  // Extract digits directly — do not normalize the JID
  const jidDigits = remoteJid.replace(/@.*$/, "").replace(/\D/g, "");
  const phone = normalizePhone(jidDigits);
  const keyDigits = phone.valid ? phone.digitsOnly : jidDigits;
  const conversationKey = buildConversationKey(sessionId, keyDigits);

  const result = await db.select({
    id: waConversations.id,
    contactId: waConversations.contactId,
    mergedIntoId: waConversations.mergedIntoId,
  })
    .from(waConversations)
    .where(and(
      eq(waConversations.tenantId, tenantId),
      eq(waConversations.conversationKey, conversationKey),
    ))
    .limit(1);

  if (result.length === 0) return null;

  const convId = result[0].mergedIntoId || result[0].id;
  return { conversationId: convId, contactId: result[0].contactId };
}

// ════════════════════════════════════════════════════════════
// getConversationById — Busca conversa por ID
// ════════════════════════════════════════════════════════════

export async function getConversationById(conversationId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select()
    .from(waConversations)
    .where(eq(waConversations.id, conversationId))
    .limit(1);

  return result[0] || null;
}
