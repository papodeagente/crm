CREATE TABLE `addon_offer_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`addon_type` enum('whatsapp_number','extra_user','extra_storage_gb') NOT NULL,
	`hotmart_offer_code` varchar(100) NOT NULL,
	`price_cents` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `addon_offer_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_addon_offer` UNIQUE(`addon_type`,`hotmart_offer_code`)
);
--> statement-breakpoint
CREATE TABLE `plan_definitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(50) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`is_public` boolean NOT NULL DEFAULT true,
	`price_cents` int NOT NULL DEFAULT 0,
	`billing_cycle` enum('monthly','annual') NOT NULL DEFAULT 'monthly',
	`hotmart_offer_code` varchar(100),
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plan_definitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_plan_slug` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `plan_features` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plan_id` int NOT NULL,
	`feature_key` varchar(100) NOT NULL,
	`is_enabled` boolean NOT NULL DEFAULT true,
	`limit_value` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plan_features_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_plan_feature` UNIQUE(`plan_id`,`feature_key`)
);
--> statement-breakpoint
CREATE TABLE `tenant_addons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`addon_type` enum('whatsapp_number','extra_user','extra_storage_gb') NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`hotmart_transaction_id` varchar(200),
	`hotmart_offer_code` varchar(100),
	`activated_by_user_id` int,
	`status` enum('active','cancelled','expired') NOT NULL DEFAULT 'active',
	`expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tenant_addons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_entitlement_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`feature_key` varchar(100) NOT NULL,
	`is_enabled` boolean NOT NULL,
	`limit_value` int,
	`reason` varchar(500) NOT NULL,
	`expires_at` timestamp,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tenant_entitlement_overrides_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_override` UNIQUE(`tenant_id`,`feature_key`)
);
--> statement-breakpoint
CREATE INDEX `idx_pf_plan` ON `plan_features` (`plan_id`);--> statement-breakpoint
CREATE INDEX `idx_ta_tenant` ON `tenant_addons` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_ta_tenant_type` ON `tenant_addons` (`tenant_id`,`addon_type`);--> statement-breakpoint
CREATE INDEX `idx_ta_transaction` ON `tenant_addons` (`hotmart_transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_ov_tenant` ON `tenant_entitlement_overrides` (`tenant_id`);