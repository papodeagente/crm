ALTER TABLE `subscriptions` MODIFY COLUMN `plan` enum('free','pro','enterprise','solo','growth','scale') NOT NULL DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `status` enum('active','trialing','past_due','cancelled','expired','unpaid','incomplete') NOT NULL DEFAULT 'trialing';--> statement-breakpoint
ALTER TABLE `tenants` MODIFY COLUMN `plan` enum('free','pro','enterprise','solo','growth','scale') NOT NULL DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `billing_provider` enum('stripe','hotmart','manual') DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `stripeCustomerId` varchar(128);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `stripeSubscriptionId` varchar(128);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `stripePriceId` varchar(128);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `payment_status` enum('paid','pending','failed','refunded') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `subscriptionStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `subscriptionEndsAt` timestamp;--> statement-breakpoint
CREATE INDEX `sub_stripe_idx` ON `subscriptions` (`stripeSubscriptionId`);