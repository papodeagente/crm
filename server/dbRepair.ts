/**
 * DB Repair Script — Fixes known data inconsistencies in the inbox.
 *
 * Issues repaired:
 * 1. wa_conversations with protocolMessage/reactionMessage as lastMessageType
 *    → Recalculates from the actual last non-protocol message in messages table
 * 2. messages with audio_transcription_status = 'failed' or stuck 'pending'
 *    → Resets to NULL so auto-transcribe can retry
 */

import { getDb } from "./db";
import { sql } from "drizzle-orm";

// Non-preview message types that should never be shown as conversation preview
const NON_PREVIEW_TYPES = [
  "protocolMessage",
  "reactionMessage",
  "senderKeyDistributionMessage",
  "messageContextInfo",
  "ephemeralMessage",
  "viewOnceMessage",
  "associatedChildMessage",
  "placeholderMessage",
];

export interface RepairResult {
  previewsFixed: number;
  transcriptionsReset: number;
  stuckPendingReset: number;
  errors: string[];
}

/**
 * Fix conversation previews that show protocol/reaction messages.
 * For each affected conversation, find the actual last content message and update.
 */
async function repairConversationPreviews(): Promise<{ fixed: number; errors: string[] }> {
  const errors: string[] = [];
  const db = await getDb();
  if (!db) {
    errors.push("Database not available");
    return { fixed: 0, errors };
  }

  try {
    const typeList = NON_PREVIEW_TYPES.map(t => `'${t}'`).join(",");

    // Find conversations with non-preview lastMessageType
    const [affected] = await db.execute(sql.raw(`
      SELECT id, sessionId, remoteJid, lastMessageType
      FROM wa_conversations
      WHERE lastMessageType IN (${typeList})
    `));

    const rows = Array.isArray(affected) ? affected : [];
    if (rows.length === 0) {
      return { fixed: 0, errors };
    }

    let fixed = 0;
    for (const conv of rows as any[]) {
      try {
        // Find the actual last non-protocol message for this conversation
        const [msgRows] = await db.execute(sql.raw(`
          SELECT content, messageType, fromMe, timestamp, status
          FROM messages
          WHERE sessionId = '${conv.sessionId}'
            AND remoteJid = '${conv.remoteJid}'
            AND messageType NOT IN (${typeList})
          ORDER BY timestamp DESC
          LIMIT 1
        `));

        const msgs = Array.isArray(msgRows) ? msgRows : [];
        if (msgs.length > 0) {
          const msg = msgs[0] as any;
          const escapedContent = msg.content ? `'${String(msg.content).replace(/'/g, "''").replace(/\\/g, "\\\\")}'` : "NULL";
          await db.execute(sql.raw(`
            UPDATE wa_conversations
            SET lastMessage = ${escapedContent},
                lastMessageType = '${msg.messageType}',
                lastFromMe = ${msg.fromMe ? 1 : 0},
                lastTimestamp = '${msg.timestamp}',
                lastMessageStatus = ${msg.status ? `'${msg.status}'` : "NULL"}
            WHERE id = ${conv.id}
          `));
          fixed++;
        }
      } catch (e: any) {
        errors.push(`Conv ${conv.id}: ${e.message}`);
      }
    }

    return { fixed, errors };
  } catch (e: any) {
    errors.push(`Preview repair failed: ${e.message}`);
    return { fixed: 0, errors };
  }
}

/**
 * Reset failed/stuck audio transcriptions so the worker can retry.
 */
async function resetFailedTranscriptions(): Promise<{ failed: number; pending: number; errors: string[] }> {
  const errors: string[] = [];
  const db = await getDb();
  if (!db) {
    errors.push("Database not available");
    return { failed: 0, pending: 0, errors };
  }

  let failedCount = 0;
  let pendingCount = 0;

  try {
    // Reset failed transcriptions
    const [failedResult] = await db.execute(sql.raw(`
      UPDATE messages
      SET audio_transcription_status = NULL,
          audio_transcription = NULL
      WHERE audio_transcription_status = 'failed'
        AND messageType IN ('audioMessage', 'pttMessage')
    `));
    failedCount = (failedResult as any)?.affectedRows || 0;

    // Reset stuck pending (older than 10 minutes)
    const [pendingResult] = await db.execute(sql.raw(`
      UPDATE messages
      SET audio_transcription_status = NULL,
          audio_transcription = NULL
      WHERE audio_transcription_status = 'pending'
        AND messageType IN ('audioMessage', 'pttMessage')
        AND updatedAt < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
    `));
    pendingCount = (pendingResult as any)?.affectedRows || 0;
  } catch (e: any) {
    errors.push(`Transcription reset failed: ${e.message}`);
  }

  return { failed: failedCount, pending: pendingCount, errors };
}

/**
 * Run all repair operations.
 */
export async function runDbRepair(): Promise<RepairResult> {
  const previewResult = await repairConversationPreviews();
  const transcriptionResult = await resetFailedTranscriptions();

  return {
    previewsFixed: previewResult.fixed,
    transcriptionsReset: transcriptionResult.failed,
    stuckPendingReset: transcriptionResult.pending,
    errors: [...previewResult.errors, ...transcriptionResult.errors],
  };
}
