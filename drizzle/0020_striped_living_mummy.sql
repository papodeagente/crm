CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`plan` enum('free','pro','enterprise') NOT NULL DEFAULT 'free',
	`status` enum('active','trialing','past_due','cancelled','expired') NOT NULL DEFAULT 'trialing',
	`hotmartTransactionId` varchar(255),
	`hotmartSubscriptionId` varchar(255),
	`hotmartProductId` varchar(255),
	`hotmartBuyerEmail` varchar(320),
	`priceInCents` int DEFAULT 9700,
	`trialStartedAt` timestamp,
	`trialEndsAt` timestamp,
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tenants` MODIFY COLUMN `plan` enum('free','pro','enterprise') NOT NULL DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `tenants` ADD `slug` varchar(128);--> statement-breakpoint
ALTER TABLE `tenants` ADD `ownerUserId` int;--> statement-breakpoint
ALTER TABLE `tenants` ADD `hotmartEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `tenants` ADD `freemiumDays` int DEFAULT 365 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `freemiumExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `tenants` ADD `logoUrl` text;--> statement-breakpoint
CREATE INDEX `sub_tenant_idx` ON `subscriptions` (`tenantId`);--> statement-breakpoint
CREATE INDEX `sub_hotmart_idx` ON `subscriptions` (`hotmartSubscriptionId`);--> statement-breakpoint
CREATE INDEX `sub_status_idx` ON `subscriptions` (`status`);