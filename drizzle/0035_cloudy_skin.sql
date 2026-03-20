CREATE TABLE `conversation_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`waConversationId` int NOT NULL,
	`sessionId` varchar(128) NOT NULL,
	`remoteJid` varchar(128) NOT NULL,
	`eventType` enum('created','assigned','transferred','note','resolved','reopened','queued','sla_breach','closed','priority_changed') NOT NULL,
	`fromUserId` int,
	`toUserId` int,
	`fromTeamId` int,
	`toTeamId` int,
	`content` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `internal_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`waConversationId` int NOT NULL,
	`sessionId` varchar(128) NOT NULL,
	`remoteJid` varchar(128) NOT NULL,
	`authorUserId` int NOT NULL,
	`content` text NOT NULL,
	`mentionedUserIds` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `internal_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quick_replies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`teamId` int,
	`shortcut` varchar(32) NOT NULL,
	`title` varchar(128) NOT NULL,
	`content` text NOT NULL,
	`category` varchar(64),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quick_replies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ce_tenant_conv_idx` ON `conversation_events` (`tenantId`,`waConversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ce_tenant_session_idx` ON `conversation_events` (`tenantId`,`sessionId`);--> statement-breakpoint
CREATE INDEX `ce_event_type_idx` ON `conversation_events` (`tenantId`,`eventType`);--> statement-breakpoint
CREATE INDEX `in_tenant_conv_idx` ON `internal_notes` (`tenantId`,`waConversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `in_author_idx` ON `internal_notes` (`tenantId`,`authorUserId`);--> statement-breakpoint
CREATE INDEX `qr_tenant_idx` ON `quick_replies` (`tenantId`);--> statement-breakpoint
CREATE INDEX `qr_tenant_team_idx` ON `quick_replies` (`tenantId`,`teamId`);--> statement-breakpoint
CREATE INDEX `qr_shortcut_idx` ON `quick_replies` (`tenantId`,`shortcut`);