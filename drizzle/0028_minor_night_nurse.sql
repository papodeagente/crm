ALTER TABLE `pipeline_stages` ADD `coolingEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pipeline_stages` ADD `coolingDays` int DEFAULT 3;