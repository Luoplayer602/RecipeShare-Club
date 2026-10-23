CREATE TABLE `post_edits` (
	`post_id` varchar(36) NOT NULL,
	`content` json NOT NULL,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `post_edits_post_id` PRIMARY KEY(`post_id`)
);
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `image_edits` json;--> statement-breakpoint
ALTER TABLE `post_edits` ADD CONSTRAINT `post_edits_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;