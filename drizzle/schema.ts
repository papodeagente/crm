import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const whatsappSessions = mysqlTable("whatsapp_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull().unique(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["connecting", "connected", "disconnected"]).default("disconnected").notNull(),
  phoneNumber: varchar("phoneNumber", { length: 32 }),
  pushName: varchar("pushName", { length: 128 }),
  platform: varchar("platform", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull(),
  messageId: varchar("messageId", { length: 256 }),
  remoteJid: varchar("remoteJid", { length: 128 }).notNull(),
  fromMe: boolean("fromMe").default(false).notNull(),
  messageType: varchar("messageType", { length: 32 }).default("text").notNull(),
  content: text("content"),
  mediaUrl: text("mediaUrl"),
  status: varchar("status", { length: 32 }).default("sent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  description: text("description"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const chatbotSettings = mysqlTable("chatbot_settings", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull().unique(),
  enabled: boolean("enabled").default(false).notNull(),
  systemPrompt: text("systemPrompt"),
  maxTokens: int("maxTokens").default(500),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type WhatsappSession = typeof whatsappSessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type ChatbotSettings = typeof chatbotSettings.$inferSelect;
