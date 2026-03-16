ALTER TABLE `messages` ADD `audio_transcription` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `audio_transcription_status` enum('pending','processing','completed','failed');--> statement-breakpoint
ALTER TABLE `messages` ADD `audio_transcription_language` varchar(16);--> statement-breakpoint
ALTER TABLE `messages` ADD `audio_transcription_duration` int;