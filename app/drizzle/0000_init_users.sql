CREATE TABLE `user_titles` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`code` varchar(40) NOT NULL,
	`name` varchar(80) NOT NULL,
	`description` varchar(255),
	CONSTRAINT `user_titles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_titles_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`username` varchar(32) NOT NULL,
	`display_name` varchar(80) NOT NULL,
	`role` enum('member','moderator','admin') NOT NULL DEFAULT 'member',
	`title_id` int unsigned NOT NULL,
	`email` varchar(254),
	`phone` varchar(16),
	`password_hash` varchar(255),
	`avatar_url` varchar(2048),
	`status` enum('active','suspended','deactivated') NOT NULL DEFAULT 'active',
	`email_verified_at` datetime(3),
	`phone_verified_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_phone_unique` UNIQUE(`phone`),
	CONSTRAINT `users_contact_required` CHECK(COALESCE(CHAR_LENGTH(TRIM(`users`.`email`)), 0) > 0
          OR COALESCE(CHAR_LENGTH(TRIM(`users`.`phone`)), 0) > 0)
);
--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_title_id_user_titles_id_fk` FOREIGN KEY (`title_id`) REFERENCES `user_titles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `users_title_id_idx` ON `users` (`title_id`);