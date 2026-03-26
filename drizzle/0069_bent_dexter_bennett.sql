ALTER TABLE `deal_history` ADD `eventCategory` varchar(32);--> statement-breakpoint
ALTER TABLE `deal_history` ADD `eventSource` varchar(32);--> statement-breakpoint
ALTER TABLE `deal_history` ADD `contactId` int;--> statement-breakpoint
ALTER TABLE `deal_history` ADD `dedupeKey` varchar(255);--> statement-breakpoint
ALTER TABLE `deal_history` ADD `occurredAt` timestamp;--> statement-breakpoint
CREATE INDEX `dh_tenant_deal_cat_idx` ON `deal_history` (`tenantId`,`dealId`,`eventCategory`);--> statement-breakpoint
CREATE INDEX `dh_tenant_contact_idx` ON `deal_history` (`tenantId`,`contactId`);--> statement-breakpoint
CREATE INDEX `dh_dedupe_idx` ON `deal_history` (`dedupeKey`);--> statement-breakpoint
CREATE INDEX `dh_occurred_idx` ON `deal_history` (`tenantId`,`dealId`,`occurredAt`);