// Standalone test: Does Baileys generate a QR code in this environment?
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const baileys = require("@whiskeysockets/baileys");
import pino from "pino";
import fs from "fs";

const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, makeCacheableSignalKeyStore, DisconnectReason } = baileys;

const logger = pino({ level: "warn" });
const TEST_DIR = "/tmp/baileys-test-session";

// Clean up any previous test
if (fs.existsSync(TEST_DIR)) {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TEST_DIR, { recursive: true });

console.log("=== Baileys Standalone QR Test ===");
console.log(`Baileys package loaded`);
console.log(`makeWASocket type: ${typeof makeWASocket}`);
console.log(`useMultiFileAuthState type: ${typeof useMultiFileAuthState}`);
console.log(`fetchLatestBaileysVersion type: ${typeof fetchLatestBaileysVersion}`);
console.log("Starting...\n");

try {
  const { state, saveCreds } = await useMultiFileAuthState(TEST_DIR);
  console.log("✓ Auth state created");

  const { version } = await fetchLatestBaileysVersion();
  console.log(`✓ WA version fetched: ${version.join(".")}`);

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    browser: Browsers.macOS("Desktop"),
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    emitOwnEvents: true,
    connectTimeoutMs: 30000,
  });

  console.log("✓ Socket created, waiting for events...\n");

  let qrReceived = false;
  let connectionClosed = false;

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    const logObj = { ...update };
    if (logObj.qr) logObj.qr = `${logObj.qr.substring(0, 40)}...(${logObj.qr.length} chars)`;
    console.log(`[Event] connection.update:`, JSON.stringify(logObj));

    if (qr) {
      qrReceived = true;
      console.log(`\n✓✓✓ QR CODE GENERATED SUCCESSFULLY ✓✓✓`);
      console.log(`QR length: ${qr.length} chars\n`);
    }

    if (connection === "close") {
      connectionClosed = true;
      const code = lastDisconnect?.error?.output?.statusCode;
      const msg = lastDisconnect?.error?.message;
      console.log(`\n✗ Connection closed - code: ${code}, msg: ${msg}`);
    }

    if (connection === "open") {
      console.log(`\n✓ Connected!`);
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // Wait up to 30 seconds for QR
  const timeout = setTimeout(() => {
    if (!qrReceived && !connectionClosed) {
      console.log("\n✗✗✗ TIMEOUT: No QR code received after 30 seconds ✗✗✗");
      console.log("This means Baileys cannot reach WhatsApp servers from this environment");
    }
    try { sock.end(undefined); } catch (e) {}
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    process.exit(qrReceived ? 0 : 1);
  }, 30000);

  const checkInterval = setInterval(() => {
    if (qrReceived) {
      clearInterval(checkInterval);
      clearTimeout(timeout);
      setTimeout(() => {
        console.log("Test complete - QR generation works!");
        try { sock.end(undefined); } catch (e) {}
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
        process.exit(0);
      }, 3000);
    }
  }, 500);

} catch (err) {
  console.error("✗ Error:", err);
  process.exit(1);
}
