CREATE TABLE `wa_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(100) NOT NULL,
	`jid` varchar(100) NOT NULL,
	`lid` varchar(100),
	`phoneNumber` varchar(100),
	`pushName` varchar(255),
	`savedName` varchar(255),
	`verifiedName` varchar(255),
	`profilePictureUrl` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wa_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `wac_session_jid_idx` ON `wa_contacts` (`sessionId`,`jid`);--> statement-breakpoint
CREATE INDEX `wac_session_lid_idx` ON `wa_contacts` (`sessionId`,`lid`);--> statement-breakpoint
CREATE INDEX `wac_session_phone_idx` ON `wa_contacts` (`sessionId`,`phoneNumber`);