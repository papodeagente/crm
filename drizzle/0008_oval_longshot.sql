CREATE TABLE `custom_field_values` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`fieldId` int NOT NULL,
	`entityType` enum('contact','deal','account','trip') NOT NULL DEFAULT 'contact',
	`entityId` int NOT NULL,
	`value` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_field_values_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custom_fields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`entity` enum('contact','deal','account','trip') NOT NULL DEFAULT 'contact',
	`name` varchar(128) NOT NULL,
	`label` varchar(255) NOT NULL,
	`fieldType` enum('text','number','date','select','multiselect','checkbox','textarea','email','phone','url','currency') NOT NULL DEFAULT 'text',
	`optionsJson` json,
	`defaultValue` text,
	`placeholder` varchar(255),
	`isRequired` boolean NOT NULL DEFAULT false,
	`isVisibleOnForm` boolean NOT NULL DEFAULT true,
	`isVisibleOnProfile` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`groupName` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cfv_tenant_entity_idx` ON `custom_field_values` (`tenantId`,`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `cfv_field_idx` ON `custom_field_values` (`fieldId`);--> statement-breakpoint
CREATE INDEX `cf_tenant_entity_idx` ON `custom_fields` (`tenantId`,`entity`);--> statement-breakpoint
CREATE INDEX `cf_tenant_sort_idx` ON `custom_fields` (`tenantId`,`entity`,`sortOrder`);