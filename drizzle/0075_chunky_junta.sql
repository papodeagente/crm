CREATE TABLE `google_calendar_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`googleEventId` varchar(512) NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`startAt` timestamp NOT NULL,
	`endAt` timestamp NOT NULL,
	`allDay` boolean DEFAULT false,
	`location` varchar(500),
	`status` varchar(50) DEFAULT 'confirmed',
	`htmlLink` varchar(1000),
	`sourceCalendarId` varchar(500),
	`rawJson` json,
	`syncedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_calendar_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_gcal_tenant_user_event` UNIQUE(`tenantId`,`userId`,`googleEventId`)
);
--> statement-breakpoint
CREATE INDEX `idx_gcal_tenant_user_range` ON `google_calendar_events` (`tenantId`,`userId`,`startAt`,`endAt`);--> statement-breakpoint
CREATE INDEX `idx_gcal_tenant_range` ON `google_calendar_events` (`tenantId`,`startAt`,`endAt`);