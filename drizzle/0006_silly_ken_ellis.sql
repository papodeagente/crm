CREATE TABLE `conversation_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`sessionId` varchar(128) NOT NULL,
	`remoteJid` varchar(128) NOT NULL,
	`assignedUserId` int,
	`assignedTeamId` int,
	`status` enum('open','pending','resolved','closed') NOT NULL DEFAULT 'open',
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`lastAssignedAt` timestamp,
	`firstResponseAt` timestamp,
	`resolvedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversation_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `messages` ADD `tenantId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `senderAgentId` int;--> statement-breakpoint
ALTER TABLE `whatsapp_sessions` ADD `tenantId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `ca_tenant_session_jid_idx` ON `conversation_assignments` (`tenantId`,`sessionId`,`remoteJid`);--> statement-breakpoint
CREATE INDEX `ca_tenant_user_idx` ON `conversation_assignments` (`tenantId`,`assignedUserId`);--> statement-breakpoint
CREATE INDEX `ca_tenant_team_idx` ON `conversation_assignments` (`tenantId`,`assignedTeamId`);--> statement-breakpoint
CREATE INDEX `ca_tenant_status_idx` ON `conversation_assignments` (`tenantId`,`status`);--> statement-breakpoint
CREATE INDEX `msg_tenant_idx` ON `messages` (`tenantId`);--> statement-breakpoint
CREATE INDEX `msg_session_jid_idx` ON `messages` (`sessionId`,`remoteJid`,`timestamp`);--> statement-breakpoint
CREATE INDEX `ws_tenant_idx` ON `whatsapp_sessions` (`tenantId`);