CREATE TABLE `user_follows` (
	`follower_id` varchar(36) NOT NULL,
	`author_id` varchar(36) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_follows_follower_id_author_id_pk` PRIMARY KEY(`follower_id`,`author_id`),
	CONSTRAINT `user_follows_not_self` CHECK(`user_follows`.`follower_id` <> `user_follows`.`author_id`)
);
--> statement-breakpoint
ALTER TABLE `user_follows` ADD CONSTRAINT `user_follows_follower_id_users_id_fk` FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_follows` ADD CONSTRAINT `user_follows_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `user_follows_author_idx` ON `user_follows` (`author_id`);--> statement-breakpoint
CREATE INDEX `user_follows_recent_idx` ON `user_follows` (`follower_id`,`created_at`,`author_id`);