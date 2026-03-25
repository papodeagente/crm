// Server runs in UTC — all timezone conversion happens in the frontend only.
// DO NOT set process.env.TZ here. mysql2 reads DATETIME as local time,
// and setting TZ=SP causes a +3h offset on timestamps read from MySQL.

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { Server as SocketIOServer } from "socket.io";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { whatsappManager } from "../whatsappEvolution";
import { startDailyBackupScheduler } from "../whatsappDailyBackup";
import { webhookRouter } from "../webhookRoutes";
import { setIo } from "../socketSingleton";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Socket.IO for real-time updates
  const io = new SocketIOServer(server, {
    cors: { origin: "*" },
    path: "/api/socket.io",
  });

  // Make io globally accessible for AI suggestion streaming etc.
  setIo(io);

  // Forward WhatsApp events to Socket.IO clients
  whatsappManager.on("qr", (data) => {
    io.emit("whatsapp:qr", data);
  });

  whatsappManager.on("status", (data) => {
    io.emit("whatsapp:status", data);
  });

  whatsappManager.on("message", (data) => {
    const socketEmitTime = Date.now();
    const payload = {
      sessionId: data.sessionId,
      messageId: data.messageId || null,
      content: data.content,
      fromMe: data.fromMe,
      remoteJid: data.remoteJid,
      messageType: data.messageType,
      pushName: data.pushName || '',
      timestamp: data.timestamp || Date.now(),
      isSync: !!(data.isSync || data.syncBatch), // true for sync/poll/reconciliation messages
      syncBatch: data.syncBatch || 0,
      _traceEmitAt: socketEmitTime, // TRACE: timestamp when socket.io emit happens
    };
    console.log(`[TRACE][SOCKET_EMIT] timestamp: ${socketEmitTime} | remoteJid: ${data.remoteJid?.substring(0, 15)} | msgId: ${data.messageId || 'N/A'} | fromMe: ${data.fromMe}`);
    io.emit("whatsapp:message", payload);
  });

  // Forward media update events (no notification sound)
  whatsappManager.on("media_update", (data) => {
    io.emit("whatsapp:media_update", {
      sessionId: data.sessionId,
      remoteJid: data.remoteJid,
      messageId: data.messageId,
      mediaUrl: data.mediaUrl,
      timestamp: Date.now(),
    });
  });

  // Forward reaction events to Socket.IO clients
  whatsappManager.on("reaction", (data) => {
    io.emit("whatsapp:reaction", {
      sessionId: data.sessionId,
      targetMessageId: data.targetMessageId,
      senderJid: data.senderJid,
      emoji: data.emoji,
      fromMe: data.fromMe,
      remoteJid: data.remoteJid,
    });
  });

  // Forward message status updates to Socket.IO clients (delivered, read, played)
  whatsappManager.on("message:status", (data) => {
    // Part 16: Debug logging
    console.log('[InboxDebug] emit whatsapp:message:status', {
      eventType: 'messages.update',
      messageId: data.messageId,
      status: data.status,
      remoteJid: data.remoteJid?.substring(0, 15) || null,
    });
    io.emit("whatsapp:message:status", {
      sessionId: data.sessionId,
      messageId: data.messageId,
      status: data.status,
      remoteJid: data.remoteJid || null,
      timestamp: Date.now(),
    });
  });

  io.on("connection", (socket) => {
    console.log("Socket.IO client connected:", socket.id);
    socket.on("disconnect", () => {
      console.log("Socket.IO client disconnected:", socket.id);
    });
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // REST API endpoints for external integration
  app.get("/api/v1/status/:sessionId", (req, res) => {
    const session = whatsappManager.getSession(req.params.sessionId);
    res.json({
      status: session?.status || "disconnected",
      user: session?.user || null,
    });
  });

  app.post("/api/v1/send-message", express.json(), async (req, res) => {
    try {
      const { sessionId, number, message } = req.body;
      if (!sessionId || !number || !message) {
        return res.status(400).json({ error: "sessionId, number e message são obrigatórios" });
      }
      const result = await whatsappManager.sendTextMessage(sessionId, number, message);
      res.json({ success: true, messageId: result?.key?.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/v1/send-media", express.json(), async (req, res) => {
    try {
      const { sessionId, number, mediaUrl, mediaType, caption, fileName } = req.body;
      if (!sessionId || !number || !mediaUrl || !mediaType) {
        return res.status(400).json({ error: "sessionId, number, mediaUrl e mediaType são obrigatórios" });
      }
      const result = await whatsappManager.sendMediaMessage(sessionId, number, mediaUrl, mediaType, caption, fileName);
      res.json({ success: true, messageId: result?.key?.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Webhook routes for lead capture (Landing Page + Meta Lead Ads)
  app.use(webhookRouter);

  // Hotmart webhook for payment processing
  const { handleHotmartWebhook } = await import("../hotmartWebhook");
  app.post("/api/webhooks/hotmart", handleHotmartWebhook);

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Start daily WhatsApp backup scheduler
    startDailyBackupScheduler();

    // Initialize BullMQ message worker (if Redis available)
    import("../messageWorker").then(m => {
      m.initMessageWorker();
    }).catch(e => {
      console.warn("[Worker] Failed to initialize message worker:", e.message);
    });

    // Initialize audio transcription worker (if Redis available)
    import("../audioTranscriptionWorker").then(m => {
      m.initAudioTranscriptionWorker();
    }).catch(e => {
      console.warn("[AudioTranscription] Failed to initialize worker:", e.message);
    });

    // Start date-based automation scheduler
    import("../dateAutomationScheduler").then(m => m.startDateAutomationScheduler());

    // Start RFV notification scheduler
    import("../rfvNotificationScheduler").then(m => m.startRfvNotificationScheduler());

    // Start birthday/wedding notification scheduler
    import("../birthdayScheduler").then(m => m.startBirthdayScheduler());

    // Start task due soon notification scheduler (tasks due within 3h)
    import("../taskDueScheduler").then(m => m.startTaskDueScheduler());

    // Start Z-API alert monitoring scheduler (disconnections + billing overdue)
    import("../zapiAlertScheduler").then(m => m.startZapiAlertScheduler());

    // Retroactive seed: ensure all tenants have default loss reasons
    import("../seedLossReasonsRetroactive").then(m => m.seedLossReasonsForAllTenants()).catch(e => {
      console.warn("[SeedLossReasons] Retroactive seed failed:", e.message);
    });

    // Auto-restore WhatsApp sessions that were connected before server restart
    // Delayed by 10s to let the server fully initialize first
    setTimeout(() => {
      console.log("[WA AutoRestore] Starting auto-restore of WhatsApp sessions...");
      whatsappManager.autoRestoreSessions().catch(e => {
        console.error("[WA AutoRestore] Error:", e);
      });
      // Start fast polling (60s) — PRIMARY mechanism for near-real-time messages
      // Evolution API webhooks are unreliable, so we poll the most recent chats frequently
      // Increased from 30s to 60s to reduce Evolution API load (~50% reduction)
      whatsappManager.startFastPoll(60 * 1000); // Every 60 seconds

      // Start periodic deep sync to catch anything FastPoll missed
      // Increased from 5min to 10min to reduce Evolution API load
      whatsappManager.startPeriodicSync(10 * 60 * 1000); // Every 10 minutes

      // Start safe message reconciliation (every 3 min, max 20 convs, 10 msgs/conv)
      import("../messageReconciliation").then(({ startReconciliation }) => {
        startReconciliation(() => {
          const sessMap = new Map<string, { sessionId: string; tenantId: number; instanceName: string; status: string }>();
          for (const s of whatsappManager.getAllSessions()) {
            sessMap.set(s.sessionId, { sessionId: s.sessionId, tenantId: s.tenantId, instanceName: s.instanceName, status: s.status });
          }
          return sessMap;
        });
      }).catch(e => console.error("[Reconciliation] Failed to start:", e));
    }, 10_000);
  });
}

startServer().catch(console.error);
