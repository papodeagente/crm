CREATE TABLE `crm_appointment_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`userId` int NOT NULL,
	`tenantId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crm_appointment_participants_id` PRIMARY KEY(`id`),
	CONSTRAINT `cap_appt_user_uniq` UNIQUE(`appointmentId`,`userId`)
);
--> statement-breakpoint
CREATE INDEX `cap_user_idx` ON `crm_appointment_participants` (`tenantId`,`userId`);