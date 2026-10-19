CREATE TABLE `dietary_references` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bmr` integer NOT NULL,
	`maintenance_calories` integer NOT NULL,
	`daily_calorie_reference` integer NOT NULL,
	`calculated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dietary_references_user_calculated_idx` ON `dietary_references` (`user_id`,`calculated_at`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`age` integer NOT NULL,
	`sex` text NOT NULL,
	`weight_kg` real NOT NULL,
	`height_cm` real NOT NULL,
	`activity_level` text NOT NULL,
	`weight_goal` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_profiles_userId_unique` ON `user_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`auto_save_results` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_userId_unique` ON `user_settings` (`user_id`);