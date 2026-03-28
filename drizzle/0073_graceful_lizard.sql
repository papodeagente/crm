CREATE TABLE `deal_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`dealId` int NOT NULL,
	`fileName` varchar(512) NOT NULL,
	`fileKey` varchar(1024) NOT NULL,
	`url` text NOT NULL,
	`mimeType` varchar(128),
	`sizeBytes` bigint DEFAULT 0,
	`description` varchar(512),
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`deletedAt` timestamp,
	CONSTRAINT `deal_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `whatsapp_sessions` MODIFY COLUMN `provider` enum('evolution','zapi') NOT NULL DEFAULT 'zapi';--> statement-breakpoint
CREATE INDEX `df_tenant_idx` ON `deal_files` (`tenantId`);--> statement-breakpoint
CREATE INDEX `df_deal_idx` ON `deal_files` (`tenantId`,`dealId`);