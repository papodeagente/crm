/**
 * socketSingleton.ts
 * Provides a global reference to the Socket.IO server instance.
 * Set once during server startup, then importable from any module.
 */
import type { Server as SocketIOServer } from "socket.io";

let _io: SocketIOServer | null = null;

export function setIo(io: SocketIOServer): void {
  _io = io;
}

export function getIo(): SocketIOServer | null {
  return _io;
}

/** Extract tenantId from sessionId format "crm-{tenantId}-{userId}" */
function getTenantFromSessionId(sessionId: string): number | null {
  if (!sessionId) return null;
  const parts = sessionId.split("-");
  return parts.length >= 2 ? parseInt(parts[1]) || null : null;
}

/**
 * Emit a Socket.IO event ONLY to the specified tenant's room.
 * If tenantId is not provided, attempts to extract it from sessionId.
 * If neither is available, the event is silently dropped (security: no broadcast to all).
 */
export function emitToTenant(event: string, data: any, tenantId?: number | null): void {
  const io = _io;
  if (!io) return;
  const tid = tenantId || data?.tenantId || getTenantFromSessionId(data?.sessionId) || null;
  if (!tid) return;
  io.to(`tenant:${tid}`).emit(event, data);
}

/** Emit to super-admin room (admins join on connect if isSuperAdmin=true). */
export function emitToSuperAdmin(event: string, data: any): void {
  const io = _io;
  if (!io) return;
  io.to("super-admin").emit(event, data);
}
