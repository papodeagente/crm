CREATE TABLE `tenant_zapi_instances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`zapiInstanceId` varchar(128) NOT NULL,
	`zapiToken` varchar(255) NOT NULL,
	`zapiClientToken` varchar(255),
	`instanceName` varchar(255) NOT NULL,
	`zapi_instance_status` enum('active','pending','cancelled','expired') NOT NULL DEFAULT 'pending',
	`subscribedAt` timestamp,
	`cancelledAt` timestamp,
	`expiresAt` timestamp,
	`webhookBaseUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_zapi_instances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `tzi_tenant_idx` ON `tenant_zapi_instances` (`tenantId`);--> statement-breakpoint
CREATE INDEX `tzi_zapi_instance_idx` ON `tenant_zapi_instances` (`zapiInstanceId`);