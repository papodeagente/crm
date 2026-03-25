ALTER TABLE `tenant_zapi_instances` MODIFY COLUMN `zapiToken` text NOT NULL;--> statement-breakpoint
ALTER TABLE `tenant_zapi_instances` MODIFY COLUMN `zapiClientToken` text;