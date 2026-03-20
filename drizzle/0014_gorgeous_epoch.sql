CREATE TABLE `rd_station_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL DEFAULT 1,
	`webhookToken` varchar(128) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`autoCreateDeal` boolean NOT NULL DEFAULT true,
	`defaultPipelineId` int,
	`defaultStageId` int,
	`totalLeadsReceived` int NOT NULL DEFAULT 0,
	`lastLeadReceivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rd_station_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rd_station_webhook_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL DEFAULT 1,
	`rdLeadId` varchar(255),
	`conversionIdentifier` varchar(255),
	`email` varchar(320),
	`name` varchar(255),
	`phone` varchar(64),
	`utmSource` varchar(255),
	`utmMedium` varchar(255),
	`utmCampaign` varchar(255),
	`utmContent` varchar(255),
	`utmTerm` varchar(255),
	`status` enum('success','failed','duplicate') NOT NULL DEFAULT 'success',
	`dealId` int,
	`contactId` int,
	`error` text,
	`rawPayload` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rd_station_webhook_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `rdlog_tenant_idx` ON `rd_station_webhook_log` (`tenantId`);--> statement-breakpoint
CREATE INDEX `rdlog_status_idx` ON `rd_station_webhook_log` (`tenantId`,`status`);--> statement-breakpoint
CREATE INDEX `rdlog_created_idx` ON `rd_station_webhook_log` (`tenantId`,`createdAt`);