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
