CREATE TABLE `media_assets` (
	`id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`kind` enum('image','video') NOT NULL,
	`source` enum('upload','url') NOT NULL,
	`storage_key` varchar(512),
	`external_url` varchar(2048),
	`original_name` varchar(255),
	`mime_type` varchar(127),
	`metadata` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `media_assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_assets_source_required` CHECK((
        `media_assets`.`source` = 'upload'
        AND CHAR_LENGTH(TRIM(`media_assets`.`storage_key`)) > 0
        AND `media_assets`.`storage_key` IS NOT NULL
        AND `media_assets`.`external_url` IS NULL
      ) OR (
        `media_assets`.`source` = 'url'
        AND CHAR_LENGTH(TRIM(`media_assets`.`external_url`)) > 0
        AND `media_assets`.`external_url` IS NOT NULL
        AND `media_assets`.`storage_key` IS NULL
      ))
);
--> statement-breakpoint
CREATE TABLE `post_blocks` (
	`id` varchar(36) NOT NULL,
	`post_id` varchar(36) NOT NULL,
	`data` json NOT NULL,
	`position` int unsigned NOT NULL,
	CONSTRAINT `post_blocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `post_blocks_post_position_unique` UNIQUE(`post_id`,`position`)
);
--> statement-breakpoint
CREATE TABLE `post_revisions` (
	`id` varchar(36) NOT NULL,
	`post_id` varchar(36) NOT NULL,
	`version` int unsigned NOT NULL,
	`edited_by` varchar(36) NOT NULL,
	`snapshot` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `post_revisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `post_revisions_post_version_unique` UNIQUE(`post_id`,`version`),
	CONSTRAINT `post_revisions_version_positive` CHECK(`post_revisions`.`version` > 0)
);
--> statement-breakpoint
CREATE TABLE `post_tags` (
	`post_id` varchar(36) NOT NULL,
	`tag_id` varchar(36) NOT NULL,
	CONSTRAINT `post_tags_post_id_tag_id_pk` PRIMARY KEY(`post_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` varchar(36) NOT NULL,
	`author_id` varchar(36) NOT NULL,
	`type` enum('recipe','blog') NOT NULL,
	`title` varchar(200) NOT NULL,
	`slug` varchar(220) NOT NULL,
	`excerpt` varchar(500) NOT NULL,
	`cover_media_id` varchar(36),
	`status` enum('draft','published','hidden') NOT NULL DEFAULT 'draft',
	`published_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`deleted_at` datetime(3),
	CONSTRAINT `posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `posts_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `posts_published_at_required` CHECK(`posts`.`status` <> 'published'
          OR `posts`.`published_at` IS NOT NULL),
	CONSTRAINT `posts_title_required` CHECK(CHAR_LENGTH(TRIM(`posts`.`title`)) > 0)
);
--> statement-breakpoint
CREATE TABLE `recipe_details` (
	`post_id` varchar(36) NOT NULL,
	`prep_minutes` int unsigned,
	`cook_minutes` int unsigned,
	`servings` int unsigned,
	`difficulty` int unsigned,
	CONSTRAINT `recipe_details_post_id` PRIMARY KEY(`post_id`),
	CONSTRAINT `recipe_details_servings_positive` CHECK(`recipe_details`.`servings` IS NULL OR `recipe_details`.`servings` > 0),
	CONSTRAINT `recipe_details_difficulty_range` CHECK(`recipe_details`.`difficulty` IS NULL
          OR `recipe_details`.`difficulty` BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE `recipe_ingredients` (
	`id` varchar(36) NOT NULL,
	`post_id` varchar(36) NOT NULL,
	`name` varchar(150) NOT NULL,
	`quantity` varchar(80),
	`unit` varchar(40),
	`note` varchar(255),
	`position` int unsigned NOT NULL,
	CONSTRAINT `recipe_ingredients_id` PRIMARY KEY(`id`),
	CONSTRAINT `recipe_ingredients_post_position_unique` UNIQUE(`post_id`,`position`),
	CONSTRAINT `recipe_ingredients_name_required` CHECK(CHAR_LENGTH(TRIM(`recipe_ingredients`.`name`)) > 0)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` varchar(36) NOT NULL,
	`name` varchar(60) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`created_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_name_unique` UNIQUE(`name`),
	CONSTRAINT `tags_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `tags_name_required` CHECK(CHAR_LENGTH(TRIM(`tags`.`name`)) > 0)
);
--> statement-breakpoint
ALTER TABLE `media_assets` ADD CONSTRAINT `media_assets_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_blocks` ADD CONSTRAINT `post_blocks_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_revisions` ADD CONSTRAINT `post_revisions_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_revisions` ADD CONSTRAINT `post_revisions_edited_by_users_id_fk` FOREIGN KEY (`edited_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_tags` ADD CONSTRAINT `post_tags_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_tags` ADD CONSTRAINT `post_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_cover_media_id_media_assets_id_fk` FOREIGN KEY (`cover_media_id`) REFERENCES `media_assets`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recipe_details` ADD CONSTRAINT `recipe_details_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recipe_ingredients` ADD CONSTRAINT `recipe_ingredients_post_id_recipe_details_post_id_fk` FOREIGN KEY (`post_id`) REFERENCES `recipe_details`(`post_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tags` ADD CONSTRAINT `tags_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `media_assets_owner_id_idx` ON `media_assets` (`owner_id`);--> statement-breakpoint
CREATE INDEX `post_revisions_edited_by_idx` ON `post_revisions` (`edited_by`);--> statement-breakpoint
CREATE INDEX `post_tags_tag_id_idx` ON `post_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `posts_author_id_idx` ON `posts` (`author_id`);--> statement-breakpoint
CREATE INDEX `posts_cover_media_id_idx` ON `posts` (`cover_media_id`);--> statement-breakpoint
CREATE INDEX `posts_feed_idx` ON `posts` (`status`,`deleted_at`,`published_at`,`id`);