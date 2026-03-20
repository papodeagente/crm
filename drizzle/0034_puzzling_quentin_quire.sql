CREATE TABLE `session_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`sourceSessionId` varchar(128) NOT NULL,
	`sourceUserId` int NOT NULL,
	`targetUserId` int NOT NULL,
	`share_status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`sharedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`revokedAt` timestamp,
	CONSTRAINT `session_shares_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ss_tenant_idx` ON `session_shares` (`tenantId`);--> statement-breakpoint
CREATE INDEX `ss_target_user_idx` ON `session_shares` (`tenantId`,`targetUserId`);--> statement-breakpoint
CREATE INDEX `ss_source_session_idx` ON `session_shares` (`tenantId`,`sourceSessionId`);