/**
 * Test script that mimics the EXACT _doConnect flow from whatsapp.ts
 * to diagnose why QR code scanning doesn't complete the connection.
 * 
 * This script will:
 * 1. Create auth state
 * 2. Create socket with same config as the app
 * 3. Listen for ALL connection.update events and log them in detail
 * 4. Wait for QR code generation
 * 5. Wait for connection to complete (or timeout)
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const baileys = require("@whiskeysockets/baileys");
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } = baileys;
const pino = require("pino");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const logger = pino({ level: "silent" });

// Same constants as the app
const KEEPALIVE_INTERVAL_MS = 30_000;
const CONNECT_TIMEOUT_MS = 60_000;
const DEFAULT_QUERY_TIMEOUT_MS = undefined;
const RETRY_REQUEST_DELAY_MS = 500;

async function testConnectionFlow() {
  const sessionId = "test-connection-" + Date.now();
  const sessionDir = path.join(process.cwd(), "auth_sessions", sessionId);
  
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  console.log(`\n=== TEST CONNECTION FLOW ===`);
  console.log(`Session: ${sessionId}`);
  console.log(`Auth dir: ${sessionDir}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();
  
  console.log(`Baileys version: ${version.join('.')}`);
  console.log(`Has existing creds: ${!!state.creds.me}`);
  console.log(`Creating socket with EXACT same config as the app...\n`);

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    browser: Browsers.macOS("Desktop"),
    generateHighQualityLinkPreview: false,
    keepAliveIntervalMs: KEEPALIVE_INTERVAL_MS,
    connectTimeoutMs: CONNECT_TIMEOUT_MS,
    defaultQueryTimeoutMs: DEFAULT_QUERY_TIMEOUT_MS,
    retryRequestDelayMs: RETRY_REQUEST_DELAY_MS,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    emitOwnEvents: true,
  });

  let qrCount = 0;
  let connected = false;
  let disconnected = false;

  // Listen for ALL connection.update events
  sock.ev.on("connection.update", async (update) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] connection.update event:`);
    console.log(`  Full update object:`, JSON.stringify(update, null, 2));
    
    const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications } = update;

    if (qr) {
      qrCount++;
      console.log(`\n  >>> QR CODE #${qrCount} GENERATED <<<`);
      console.log(`  QR string length: ${qr.length}`);
      console.log(`  QR first 50 chars: ${qr.substring(0, 50)}...`);
      
      try {
        const dataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        console.log(`  QR DataURL generated: ${dataUrl.substring(0, 50)}...`);
        console.log(`  QR DataURL length: ${dataUrl.length}`);
      } catch (e) {
        console.error(`  QR DataURL FAILED:`, e.message);
      }
      console.log(`\n  Waiting for scan... (scan the QR code on your phone)\n`);
    }

    if (receivedPendingNotifications) {
      console.log(`  >>> RECEIVED PENDING NOTIFICATIONS <<<`);
    }
    
    if (isNewLogin) {
      console.log(`  >>> NEW LOGIN DETECTED <<<`);
    }

    if (connection === "close") {
      disconnected = true;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errorMessage = lastDisconnect?.error?.message || "unknown";
      console.log(`\n  >>> CONNECTION CLOSED <<<`);
      console.log(`  Status code: ${statusCode}`);
      console.log(`  Error message: ${errorMessage}`);
      console.log(`  Full error:`, JSON.stringify(lastDisconnect?.error, null, 2));
      
      if (statusCode === 401 || statusCode === 403 || statusCode === 405) {
        console.log(`  FATAL: Logged out or banned`);
      } else if (statusCode === DisconnectReason.badSession) {
        console.log(`  BAD SESSION: Auth corrupted`);
      } else {
        console.log(`  RECONNECTABLE: Code ${statusCode}`);
      }
    }

    if (connection === "open") {
      connected = true;
      console.log(`\n  >>> CONNECTION OPEN — SUCCESS! <<<`);
      console.log(`  User:`, JSON.stringify(sock.user, null, 2));
      console.log(`  Connected at: ${new Date().toISOString()}`);
    }
  });

  // Listen for creds update
  sock.ev.on("creds.update", async () => {
    console.log(`[${new Date().toISOString()}] creds.update — saving credentials`);
    await saveCreds();
  });

  // Wait up to 3 minutes for connection
  const timeout = 180_000;
  const startTime = Date.now();
  
  console.log(`Waiting up to ${timeout/1000}s for connection events...\n`);
  
  await new Promise((resolve) => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (connected || disconnected || elapsed > timeout) {
        clearInterval(interval);
        resolve();
      }
    }, 1000);
  });

  console.log(`\n=== TEST RESULTS ===`);
  console.log(`QR codes generated: ${qrCount}`);
  console.log(`Connected: ${connected}`);
  console.log(`Disconnected: ${disconnected}`);
  console.log(`Duration: ${(Date.now() - startTime) / 1000}s`);

  // Cleanup
  try {
    sock.end(undefined);
  } catch (e) {}
  
  // Clean up test session
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
  
  console.log(`\nTest session cleaned up.`);
  process.exit(0);
}

testConnectionFlow().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
