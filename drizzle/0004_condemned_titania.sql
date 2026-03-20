ALTER TABLE `messages` ADD `media_mime_type` varchar(128);--> statement-breakpoint
ALTER TABLE `messages` ADD `media_file_name` varchar(512);--> statement-breakpoint
ALTER TABLE `messages` ADD `media_duration` int;--> statement-breakpoint
ALTER TABLE `messages` ADD `is_voice_note` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `messages` ADD `quoted_message_id` varchar(256);