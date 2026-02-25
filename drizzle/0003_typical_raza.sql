CREATE TABLE `deal_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`dealId` int NOT NULL,
	`action` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`fromStageId` int,
	`toStageId` int,
	`fromStageName` varchar(128),
	`toStageName` varchar(128),
	`fieldChanged` varchar(64),
	`oldValue` text,
	`newValue` text,
	`actorUserId` int,
	`actorName` varchar(255),
	`metadataJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deal_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deal_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`dealId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` enum('flight','hotel','tour','transfer','insurance','cruise','visa','other') NOT NULL DEFAULT 'other',
	`quantity` int NOT NULL DEFAULT 1,
	`unitPriceCents` bigint NOT NULL DEFAULT 0,
	`discountCents` bigint DEFAULT 0,
	`currency` varchar(3) DEFAULT 'BRL',
	`supplier` varchar(255),
	`checkIn` timestamp,
	`checkOut` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deal_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `dh_tenant_deal_idx` ON `deal_history` (`tenantId`,`dealId`);--> statement-breakpoint
CREATE INDEX `dp_prod_tenant_deal_idx` ON `deal_products` (`tenantId`,`dealId`);