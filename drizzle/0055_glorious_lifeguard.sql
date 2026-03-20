CREATE INDEX `idx_msg_session_ts` ON `messages` (`sessionId`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_msg_session_fromme` ON `messages` (`sessionId`,`fromMe`,`status`,`timestamp`);