CREATE TABLE `custom_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`category` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`orderIndex` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cm_tenant_idx` ON `custom_messages` (`tenantId`);--> statement-breakpoint
CREATE INDEX `cm_tenant_category_idx` ON `custom_messages` (`tenantId`,`category`);