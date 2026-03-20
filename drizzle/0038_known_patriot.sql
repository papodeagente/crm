CREATE TABLE `ai_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`provider` enum('openai','anthropic') NOT NULL,
	`apiKey` text NOT NULL,
	`defaultModel` varchar(128) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`label` varchar(128),
	`maxTokens` int DEFAULT 1024,
	`temperature` varchar(8) DEFAULT '0.7',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_tenant_idx` ON `ai_integrations` (`tenantId`);--> statement-breakpoint
CREATE INDEX `ai_tenant_provider_idx` ON `ai_integrations` (`tenantId`,`provider`);