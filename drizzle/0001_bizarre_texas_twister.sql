CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(128),
	`eventType` varchar(64) NOT NULL,
	`description` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatbot_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(128) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`systemPrompt` text,
	`maxTokens` int DEFAULT 500,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chatbot_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `chatbot_settings_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(128) NOT NULL,
	`messageId` varchar(256),
	`remoteJid` varchar(128) NOT NULL,
	`fromMe` boolean NOT NULL DEFAULT false,
	`messageType` varchar(32) NOT NULL DEFAULT 'text',
	`content` text,
	`mediaUrl` text,
	`status` varchar(32) DEFAULT 'sent',
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(128) NOT NULL,
	`userId` int NOT NULL,
	`status` enum('connecting','connected','disconnected') NOT NULL DEFAULT 'disconnected',
	`phoneNumber` varchar(32),
	`pushName` varchar(128),
	`platform` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_sessions_sessionId_unique` UNIQUE(`sessionId`)
);
