ALTER TABLE `deal_products` ADD `productId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `deal_products` ADD `finalPriceCents` bigint DEFAULT 0;--> statement-breakpoint
CREATE INDEX `dp_prod_product_idx` ON `deal_products` (`productId`);