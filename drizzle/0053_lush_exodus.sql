ALTER TABLE `goals` ADD `name` varchar(255);--> statement-breakpoint
ALTER TABLE `goals` ADD `scope` enum('user','company') DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `goals` ADD `companyId` int;