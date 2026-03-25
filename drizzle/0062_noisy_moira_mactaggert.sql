ALTER TABLE `whatsapp_sessions` ADD `provider` enum('evolution','zapi') DEFAULT 'evolution' NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_sessions` ADD `providerInstanceId` varchar(128);--> statement-breakpoint
ALTER TABLE `whatsapp_sessions` ADD `providerToken` varchar(256);--> statement-breakpoint
ALTER TABLE `whatsapp_sessions` ADD `providerClientToken` varchar(256);