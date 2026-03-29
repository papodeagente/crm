CREATE TABLE `crm_appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`startAt` timestamp NOT NULL,
	`endAt` timestamp NOT NULL,
	`allDay` boolean NOT NULL DEFAULT false,
	`location` varchar(500),
	`color` varchar(20) DEFAULT 'emerald',
	`dealId` int,
	`contactId` int,
	`isCompleted` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crm_appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ca_tenant_user_range_idx` ON `crm_appointments` (`tenantId`,`userId`,`startAt`,`endAt`);--> statement-breakpoint
CREATE INDEX `ca_tenant_range_idx` ON `crm_appointments` (`tenantId`,`startAt`,`endAt`);--> statement-breakpoint
CREATE INDEX `ca_tenant_deal_idx` ON `crm_appointments` (`tenantId`,`dealId`);