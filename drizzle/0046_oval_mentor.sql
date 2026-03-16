ALTER TABLE `internal_notes` ADD `category` varchar(32) DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `internal_notes` ADD `priority` varchar(16) DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `internal_notes` ADD `isCustomerGlobalNote` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `in_global_note_idx` ON `internal_notes` (`tenantId`,`isCustomerGlobalNote`);