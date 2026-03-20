CREATE TABLE `password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `prt_token_idx` ON `password_reset_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `prt_user_idx` ON `password_reset_tokens` (`userId`);