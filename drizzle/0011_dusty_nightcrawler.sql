CREATE TABLE `ai_conversation_analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`dealId` int NOT NULL,
	`contactId` int,
	`analyzedBy` int,
	`overallScore` int,
	`toneScore` int,
	`responsivenessScore` int,
	`clarityScore` int,
	`closingScore` int,
	`summary` text,
	`strengths` json,
	`improvements` json,
	`suggestions` json,
	`missedOpportunities` json,
	`responseTimeAvg` varchar(64),
	`messagesAnalyzed` int DEFAULT 0,
	`rawAnalysis` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_conversation_analyses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_analysis_tenant_idx` ON `ai_conversation_analyses` (`tenantId`);--> statement-breakpoint
CREATE INDEX `ai_analysis_deal_idx` ON `ai_conversation_analyses` (`tenantId`,`dealId`);