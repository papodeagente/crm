CREATE TABLE `contact_action_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`rfvContactId` int NOT NULL,
	`actionType` varchar(64) NOT NULL,
	`description` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `contact_action_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rfv_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(32),
	`vScore` bigint NOT NULL DEFAULT 0,
	`fScore` int NOT NULL DEFAULT 0,
	`rScore` int NOT NULL DEFAULT 9999,
	`audienceType` varchar(32) NOT NULL DEFAULT 'desconhecido',
	`rfvFlag` varchar(32) NOT NULL DEFAULT 'none',
	`totalAtendimentos` int NOT NULL DEFAULT 0,
	`totalVendasGanhas` int NOT NULL DEFAULT 0,
	`totalVendasPerdidas` int NOT NULL DEFAULT 0,
	`taxaConversao` decimal(5,2) NOT NULL DEFAULT '0',
	`lastActionDate` timestamp,
	`lastPurchaseAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`contactId` int,
	`createdBy` int,
	`deletedAt` timestamp,
	CONSTRAINT `rfv_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cal_tenant_idx` ON `contact_action_logs` (`tenantId`);--> statement-breakpoint
CREATE INDEX `cal_rfv_contact_idx` ON `contact_action_logs` (`rfvContactId`);--> statement-breakpoint
CREATE INDEX `rfv_tenant_idx` ON `rfv_contacts` (`tenantId`);--> statement-breakpoint
CREATE INDEX `rfv_tenant_audience_idx` ON `rfv_contacts` (`tenantId`,`audienceType`);--> statement-breakpoint
CREATE INDEX `rfv_tenant_email_idx` ON `rfv_contacts` (`tenantId`,`email`);--> statement-breakpoint
CREATE INDEX `rfv_tenant_phone_idx` ON `rfv_contacts` (`tenantId`,`phone`);--> statement-breakpoint
CREATE INDEX `rfv_tenant_flag_idx` ON `rfv_contacts` (`tenantId`,`rfvFlag`);