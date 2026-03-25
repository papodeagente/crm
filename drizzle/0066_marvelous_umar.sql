CREATE TABLE `zapi_admin_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`tenantName` varchar(255),
	`alert_type` enum('disconnected','billing_overdue','instance_error') NOT NULL,
	`alert_severity` enum('critical','warning','info') NOT NULL DEFAULT 'warning',
	`message` text NOT NULL,
	`metadata` json,
	`resolved` boolean NOT NULL DEFAULT false,
	`resolvedAt` timestamp,
	`resolvedBy` varchar(320),
	`alertKey` varchar(255) NOT NULL,
	`ownerNotified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `zapi_admin_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `zaa_tenant_idx` ON `zapi_admin_alerts` (`tenantId`);--> statement-breakpoint
CREATE INDEX `zaa_type_idx` ON `zapi_admin_alerts` (`alert_type`);--> statement-breakpoint
CREATE INDEX `zaa_resolved_idx` ON `zapi_admin_alerts` (`resolved`);--> statement-breakpoint
CREATE INDEX `zaa_alert_key_idx` ON `zapi_admin_alerts` (`alertKey`);