CREATE TABLE `channel_change_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`instanceId` varchar(128) NOT NULL,
	`previousPhone` varchar(32),
	`newPhone` varchar(32) NOT NULL,
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	`previousChannelId` int,
	`newChannelId` int,
	CONSTRAINT `channel_change_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversation_locks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`waConversationId` int NOT NULL,
	`agentId` int NOT NULL,
	`agentName` varchar(128),
	`lockedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `conversation_locks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wa_channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`instanceId` varchar(128) NOT NULL,
	`phoneNumber` varchar(32) NOT NULL,
	`channel_status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`connectedAt` timestamp NOT NULL DEFAULT (now()),
	`disconnectedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wa_channels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cce_tenant_instance_idx` ON `channel_change_events` (`tenantId`,`instanceId`);--> statement-breakpoint
CREATE INDEX `cl_tenant_conv_idx` ON `conversation_locks` (`tenantId`,`waConversationId`);--> statement-breakpoint
CREATE INDEX `cl_expires_idx` ON `conversation_locks` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `wach_tenant_instance_idx` ON `wa_channels` (`tenantId`,`instanceId`);--> statement-breakpoint
CREATE INDEX `wach_tenant_phone_idx` ON `wa_channels` (`tenantId`,`phoneNumber`);