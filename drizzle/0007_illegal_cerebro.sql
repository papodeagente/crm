CREATE TABLE `distribution_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`strategy` enum('round_robin','least_busy','manual','team_round_robin') NOT NULL DEFAULT 'round_robin',
	`teamId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`isDefault` boolean NOT NULL DEFAULT false,
	`priority` int NOT NULL DEFAULT 0,
	`configJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `distribution_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `team_members` ADD `role` enum('member','leader') DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `description` text;--> statement-breakpoint
ALTER TABLE `teams` ADD `color` varchar(7) DEFAULT '#6366f1';--> statement-breakpoint
ALTER TABLE `teams` ADD `maxMembers` int DEFAULT 50;--> statement-breakpoint
CREATE INDEX `dr_tenant_idx` ON `distribution_rules` (`tenantId`);--> statement-breakpoint
CREATE INDEX `dr_tenant_active_idx` ON `distribution_rules` (`tenantId`,`isActive`);--> statement-breakpoint
CREATE INDEX `tm_team_idx` ON `team_members` (`teamId`);--> statement-breakpoint
CREATE INDEX `tm_user_idx` ON `team_members` (`userId`);