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
import { whatsappManager } from "../whatsapp";
import { startDailyBackupScheduler } from "../whatsappDailyBackup";
import { webhookRouter } from "../webhookRoutes";

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

  // Forward WhatsApp events to Socket.IO clients
  whatsappManager.on("qr", (data) => {
    io.emit("whatsapp:qr", data);
  });

  whatsappManager.on("status", (data) => {
    io.emit("whatsapp:status", data);
  });

  whatsappManager.on("message", (data) => {
    io.emit("whatsapp:message", {
      sessionId: data.sessionId,
      content: data.content,
      fromMe: data.fromMe,
      remoteJid: data.remoteJid,
      messageType: data.messageType,
      timestamp: Date.now(),
    });
  });

  // Forward message status updates to Socket.IO clients (delivered, read, played)
  whatsappManager.on("message:status", (data) => {
    io.emit("whatsapp:message:status", {
      sessionId: data.sessionId,
      messageId: data.messageId,
      status: data.status,
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
  });
}

startServer().catch(console.error);
