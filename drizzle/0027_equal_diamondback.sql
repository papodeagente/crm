CREATE TABLE `rfv_filter_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`filterKey` varchar(64) NOT NULL,
	`previousCount` int NOT NULL DEFAULT 0,
	`currentCount` int NOT NULL DEFAULT 0,
	`lastCheckedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rfv_filter_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `rfv_snap_tenant_idx` ON `rfv_filter_snapshots` (`tenantId`);--> statement-breakpoint
CREATE INDEX `rfv_snap_tenant_filter_idx` ON `rfv_filter_snapshots` (`tenantId`,`filterKey`);