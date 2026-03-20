ALTER TABLE `wa_conversations` ADD `assignedUserId` int;--> statement-breakpoint
ALTER TABLE `wa_conversations` ADD `assignedTeamId` int;--> statement-breakpoint
ALTER TABLE `wa_conversations` ADD `queuedAt` timestamp;--> statement-breakpoint
ALTER TABLE `wa_conversations` ADD `firstResponseAt` timestamp;--> statement-breakpoint
ALTER TABLE `wa_conversations` ADD `slaDeadlineAt` timestamp;--> statement-breakpoint
CREATE INDEX `idx_wc_assigned_user` ON `wa_conversations` (`tenantId`,`assignedUserId`);--> statement-breakpoint
CREATE INDEX `idx_wc_queued` ON `wa_conversations` (`tenantId`,`queuedAt`);