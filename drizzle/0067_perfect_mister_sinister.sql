CREATE TABLE `contact_conversion_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`contactId` int NOT NULL,
	`integrationSource` varchar(64) NOT NULL,
	`externalLeadId` varchar(255),
	`eventType` varchar(64) NOT NULL DEFAULT 'conversion',
	`conversionIdentifier` varchar(512),
	`conversionName` varchar(512),
	`assetName` varchar(512),
	`assetType` varchar(64),
	`trafficSource` varchar(255),
	`utmSource` varchar(255),
	`utmMedium` varchar(255),
	`utmCampaign` varchar(512),
	`utmContent` varchar(512),
	`utmTerm` varchar(512),
	`formName` varchar(512),
	`landingPage` varchar(1024),
	`rawPayload` json,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`dedupeMatchType` enum('lead_id','email','phone','email_and_phone','manual_merge','new_contact') NOT NULL DEFAULT 'new_contact',
	`matchedExistingContactId` int,
	`mergeEventId` int,
	`idempotencyKey` varchar(255) NOT NULL,
	`dealId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_conversion_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_merges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`primaryContactId` int NOT NULL,
	`secondaryContactId` int NOT NULL,
	`reason` varchar(512) NOT NULL,
	`matchType` enum('lead_id','email','phone','email_and_phone','manual') NOT NULL,
	`createdBy` varchar(128) NOT NULL DEFAULT 'system',
	`status` enum('pending_review','confirmed','reverted') NOT NULL DEFAULT 'pending_review',
	`snapshotBeforeMerge` json NOT NULL,
	`snapshotAfterMerge` json,
	`movedDealIds` json,
	`movedTaskIds` json,
	`movedConversionEventIds` json,
	`reversible` boolean NOT NULL DEFAULT true,
	`confirmedAt` timestamp,
	`confirmedBy` varchar(128),
	`revertedAt` timestamp,
	`revertedBy` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contact_merges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cce_tenant_contact_idx` ON `contact_conversion_events` (`tenantId`,`contactId`);--> statement-breakpoint
CREATE INDEX `cce_tenant_source_idx` ON `contact_conversion_events` (`tenantId`,`integrationSource`);--> statement-breakpoint
CREATE INDEX `cce_idempotency_idx` ON `contact_conversion_events` (`idempotencyKey`);--> statement-breakpoint
CREATE INDEX `cce_external_lead_idx` ON `contact_conversion_events` (`tenantId`,`externalLeadId`);--> statement-breakpoint
CREATE INDEX `cce_received_at_idx` ON `contact_conversion_events` (`tenantId`,`receivedAt`);--> statement-breakpoint
CREATE INDEX `cm_tenant_idx` ON `contact_merges` (`tenantId`);--> statement-breakpoint
CREATE INDEX `cm_primary_idx` ON `contact_merges` (`tenantId`,`primaryContactId`);--> statement-breakpoint
CREATE INDEX `cm_secondary_idx` ON `contact_merges` (`tenantId`,`secondaryContactId`);--> statement-breakpoint
CREATE INDEX `cm_status_idx` ON `contact_merges` (`tenantId`,`status`);