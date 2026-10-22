CREATE TABLE `user_sessions` (
	`token_hash` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_sessions_token_hash` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `user_sessions_user_id_idx` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_sessions_expires_at_idx` ON `user_sessions` (`expires_at`);