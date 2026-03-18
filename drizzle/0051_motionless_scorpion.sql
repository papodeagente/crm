ALTER TABLE `custom_field_values` MODIFY COLUMN `entityType` enum('contact','deal','company') NOT NULL DEFAULT 'contact';--> statement-breakpoint
ALTER TABLE `custom_fields` MODIFY COLUMN `entity` enum('contact','deal','company') NOT NULL DEFAULT 'contact';--> statement-breakpoint
ALTER TABLE `contacts` ADD `birthDate` varchar(10);--> statement-breakpoint
ALTER TABLE `contacts` ADD `weddingDate` varchar(10);--> statement-breakpoint
ALTER TABLE `messages` ADD `sent_via` varchar(32);