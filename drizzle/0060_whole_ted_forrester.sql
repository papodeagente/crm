DROP INDEX `sub_stripe_idx` ON `subscriptions`;--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `plan` enum('free','pro','enterprise') NOT NULL DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `status` enum('active','trialing','past_due','cancelled','expired') NOT NULL DEFAULT 'trialing';--> statement-breakpoint
ALTER TABLE `tenants` MODIFY COLUMN `plan` enum('free','pro','enterprise') NOT NULL DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `subscriptions` DROP COLUMN `billing_provider`;--> statement-breakpoint
ALTER TABLE `subscriptions` DROP COLUMN `stripeCustomerId`;--> statement-breakpoint
ALTER TABLE `subscriptions` DROP COLUMN `stripeSubscriptionId`;--> statement-breakpoint
ALTER TABLE `subscriptions` DROP COLUMN `stripePriceId`;--> statement-breakpoint
ALTER TABLE `subscriptions` DROP COLUMN `payment_status`;--> statement-breakpoint
ALTER TABLE `subscriptions` DROP COLUMN `subscriptionStartedAt`;--> statement-breakpoint
ALTER TABLE `subscriptions` DROP COLUMN `subscriptionEndsAt`;