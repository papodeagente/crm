CREATE TABLE `google_calendar_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tenantId` int NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`tokenType` varchar(32) DEFAULT 'Bearer',
	`expiresAt` timestamp,
	`scope` text,
	`calendarEmail` varchar(320),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_calendar_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `gct_user_tenant_idx` ON `google_calendar_tokens` (`userId`,`tenantId`);--> statement-breakpoint
CREATE INDEX `gct_tenant_idx` ON `google_calendar_tokens` (`tenantId`);