CREATE TABLE `product_catalog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`categoryId` int,
	`productType` enum('flight','hotel','tour','transfer','insurance','cruise','visa','package','other') NOT NULL DEFAULT 'other',
	`basePriceCents` bigint NOT NULL DEFAULT 0,
	`costPriceCents` bigint DEFAULT 0,
	`currency` varchar(3) DEFAULT 'BRL',
	`supplier` varchar(255),
	`destination` varchar(255),
	`duration` varchar(128),
	`imageUrl` text,
	`sku` varchar(64),
	`isActive` boolean NOT NULL DEFAULT true,
	`detailsJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_catalog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`icon` varchar(64),
	`color` varchar(32),
	`parentId` int,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `deal_products` ADD `catalogProductId` int;--> statement-breakpoint
CREATE INDEX `pcat_tenant_idx` ON `product_catalog` (`tenantId`);--> statement-breakpoint
CREATE INDEX `pcat_tenant_type_idx` ON `product_catalog` (`tenantId`,`productType`);--> statement-breakpoint
CREATE INDEX `pcat_tenant_cat_idx` ON `product_catalog` (`tenantId`,`categoryId`);--> statement-breakpoint
CREATE INDEX `pcat_tenant_active_idx` ON `product_catalog` (`tenantId`,`isActive`);--> statement-breakpoint
CREATE INDEX `pc_tenant_idx` ON `product_categories` (`tenantId`);--> statement-breakpoint
CREATE INDEX `dp_prod_catalog_idx` ON `deal_products` (`catalogProductId`);