ALTER TABLE `rd_station_webhook_log` ADD `autoProductStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `rd_station_webhook_log` ADD `autoProductError` text;--> statement-breakpoint
ALTER TABLE `rd_station_webhook_log` ADD `autoTasksCreated` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `rd_station_webhook_log` ADD `autoTasksFailed` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `rd_station_webhook_log` ADD `autoTasksError` text;--> statement-breakpoint
ALTER TABLE `rd_station_webhook_log` ADD `customDealName` boolean DEFAULT false;