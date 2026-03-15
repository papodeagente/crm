CREATE TABLE `ai_suggestion_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int,
	`provider` varchar(32) NOT NULL,
	`model` varchar(128) NOT NULL,
	`intentClassified` varchar(32),
	`style` varchar(32) DEFAULT 'default',
	`durationMs` int,
	`contextMessageCount` int,
	`hasCrmContext` boolean DEFAULT false,
	`success` boolean NOT NULL DEFAULT true,
	`errorMessage` text,
	`wasEdited` boolean,
	`wasSent` boolean,
	`sendMethod` varchar(32),
	`partsCount` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_suggestion_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `aisl_tenant_idx` ON `ai_suggestion_logs` (`tenantId`);--> statement-breakpoint
CREATE INDEX `aisl_tenant_created_idx` ON `ai_suggestion_logs` (`tenantId`,`createdAt`);