CREATE TABLE `wa_reactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(128) NOT NULL,
	`targetMessageId` varchar(256) NOT NULL,
	`senderJid` varchar(128) NOT NULL,
	`emoji` varchar(32) NOT NULL,
	`fromMe` boolean NOT NULL DEFAULT false,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wa_reactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_react_unique` UNIQUE(`sessionId`,`targetMessageId`,`senderJid`)
);
--> statement-breakpoint
ALTER TABLE `custom_field_values` MODIFY COLUMN `entityType` enum('contact','deal','company') NOT NULL DEFAULT 'contact';--> statement-breakpoint
ALTER TABLE `custom_fields` MODIFY COLUMN `entity` enum('contact','deal','company') NOT NULL DEFAULT 'contact';--> statement-breakpoint
ALTER TABLE `contacts` ADD `birthDate` varchar(10);--> statement-breakpoint
ALTER TABLE `contacts` ADD `weddingDate` varchar(10);--> statement-breakpoint
CREATE INDEX `idx_react_target` ON `wa_reactions` (`sessionId`,`targetMessageId`);