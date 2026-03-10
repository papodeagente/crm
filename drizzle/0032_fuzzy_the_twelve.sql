ALTER TABLE `crm_tasks` ADD `googleEventId` varchar(512);--> statement-breakpoint
ALTER TABLE `crm_tasks` ADD `googleCalendarSynced` boolean DEFAULT false;