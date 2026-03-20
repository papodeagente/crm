ALTER TABLE `rd_station_config` ADD `name` varchar(255);--> statement-breakpoint
ALTER TABLE `rd_station_config` ADD `defaultSource` varchar(255);--> statement-breakpoint
ALTER TABLE `rd_station_config` ADD `defaultCampaign` varchar(255);--> statement-breakpoint
ALTER TABLE `rd_station_config` ADD `defaultOwnerUserId` int;--> statement-breakpoint
ALTER TABLE `rd_station_config` ADD `autoWhatsAppEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `rd_station_config` ADD `autoWhatsAppMessageTemplate` text;--> statement-breakpoint
ALTER TABLE `rd_station_webhook_log` ADD `configId` int;--> statement-breakpoint
ALTER TABLE `rd_station_webhook_log` ADD `autoWhatsAppStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `rd_station_webhook_log` ADD `autoWhatsAppError` text;--> statement-breakpoint
CREATE INDEX `rdcfg_tenant_idx` ON `rd_station_config` (`tenantId`);--> statement-breakpoint
CREATE INDEX `rdlog_config_idx` ON `rd_station_webhook_log` (`configId`);