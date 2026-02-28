CREATE TABLE `rd_field_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`rdFieldKey` varchar(255) NOT NULL,
	`rdFieldLabel` varchar(255) NOT NULL,
	`enturFieldType` enum('standard','custom') NOT NULL DEFAULT 'custom',
	`enturFieldKey` varchar(255),
	`enturCustomFieldId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rd_field_mappings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `rdfm_tenant_idx` ON `rd_field_mappings` (`tenantId`);--> statement-breakpoint
CREATE INDEX `rdfm_rd_key_idx` ON `rd_field_mappings` (`tenantId`,`rdFieldKey`);