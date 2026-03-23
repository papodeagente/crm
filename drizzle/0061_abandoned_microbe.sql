CREATE TABLE `subscription_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`subscriptionId` int,
	`provider` varchar(32) NOT NULL DEFAULT 'hotmart',
	`externalEvent` varchar(128) NOT NULL,
	`internalStatus` varchar(64) NOT NULL,
	`transactionId` varchar(255),
	`buyerEmail` varchar(320),
	`rawPayload` json,
	`processed` boolean NOT NULL DEFAULT false,
	`processedAt` timestamp,
	`errorMessage` text,
	`idempotencyKey` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscription_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `plan` enum('free','pro','enterprise','start','growth','scale') NOT NULL DEFAULT 'start';--> statement-breakpoint
ALTER TABLE `tenants` MODIFY COLUMN `plan` enum('free','pro','enterprise','start','growth','scale') NOT NULL DEFAULT 'start';--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `provider` varchar(32) DEFAULT 'hotmart' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `hotmartOfferId` varchar(255);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `hotmartBuyerName` varchar(255);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `currency` varchar(8) DEFAULT 'BRL';--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `lastEventAt` timestamp;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `lastSyncAt` timestamp;--> statement-breakpoint
ALTER TABLE `tenants` ADD `billingStatus` enum('active','trialing','past_due','restricted','cancelled','expired') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `isLegacy` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `se_tenant_idx` ON `subscription_events` (`tenantId`);--> statement-breakpoint
CREATE INDEX `se_subscription_idx` ON `subscription_events` (`subscriptionId`);--> statement-breakpoint
CREATE INDEX `se_idempotency_idx` ON `subscription_events` (`idempotencyKey`);--> statement-breakpoint
CREATE INDEX `se_created_idx` ON `subscription_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `se_buyer_email_idx` ON `subscription_events` (`buyerEmail`);--> statement-breakpoint
CREATE INDEX `sub_buyer_email_idx` ON `subscriptions` (`hotmartBuyerEmail`);