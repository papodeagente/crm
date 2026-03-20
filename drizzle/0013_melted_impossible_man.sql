CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL DEFAULT 1,
	`sourceId` int,
	`name` varchar(255) NOT NULL,
	`color` varchar(7) DEFAULT '#8b5cf6',
	`isActive` boolean NOT NULL DEFAULT true,
	`isDeleted` boolean NOT NULL DEFAULT false,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lead_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL DEFAULT 1,
	`name` varchar(255) NOT NULL,
	`color` varchar(7) DEFAULT '#6366f1',
	`isActive` boolean NOT NULL DEFAULT true,
	`isDeleted` boolean NOT NULL DEFAULT false,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lead_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loss_reasons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL DEFAULT 1,
	`name` varchar(255) NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`isDeleted` boolean NOT NULL DEFAULT false,
	`deletedAt` timestamp,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loss_reasons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `camp_tenant_idx` ON `campaigns` (`tenantId`);--> statement-breakpoint
CREATE INDEX `camp_source_idx` ON `campaigns` (`sourceId`);--> statement-breakpoint
CREATE INDEX `camp_tenant_active_idx` ON `campaigns` (`tenantId`,`isActive`,`isDeleted`);--> statement-breakpoint
CREATE INDEX `ls_tenant_idx` ON `lead_sources` (`tenantId`);--> statement-breakpoint
CREATE INDEX `ls_tenant_active_idx` ON `lead_sources` (`tenantId`,`isActive`,`isDeleted`);--> statement-breakpoint
CREATE INDEX `lr_tenant_idx` ON `loss_reasons` (`tenantId`);--> statement-breakpoint
CREATE INDEX `lr_tenant_active_idx` ON `loss_reasons` (`tenantId`,`isActive`,`isDeleted`);