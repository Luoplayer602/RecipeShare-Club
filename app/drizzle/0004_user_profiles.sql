CREATE TABLE `user_profiles` (
	`user_id` varchar(36) NOT NULL,
	`bio` varchar(240) NOT NULL DEFAULT '',
	`location` varchar(80) NOT NULL DEFAULT '',
	`cover_media_id` varchar(36),
	`avatar_media_id` varchar(36),
	`cover_y` int unsigned NOT NULL DEFAULT 50,
	CONSTRAINT `user_profiles_user_id` PRIMARY KEY(`user_id`),
	CONSTRAINT `user_profiles_cover_y_check` CHECK(`user_profiles`.`cover_y` BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_cover_media_id_media_assets_id_fk` FOREIGN KEY (`cover_media_id`) REFERENCES `media_assets`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_avatar_media_id_media_assets_id_fk` FOREIGN KEY (`avatar_media_id`) REFERENCES `media_assets`(`id`) ON DELETE restrict ON UPDATE no action;