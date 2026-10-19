CREATE TABLE `meal_items` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_id` text NOT NULL,
	`position` integer NOT NULL,
	`recognised_item_id` text,
	`food_name` text NOT NULL,
	`nutrition_reference_id` text,
	`portion_quantity` real,
	`portion_unit` text,
	`calories` real,
	`protein` real,
	`carbohydrates` real,
	`fat` real,
	`was_modified` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meal_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recognised_item_id`) REFERENCES `recognised_food_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`nutrition_reference_id`) REFERENCES `nutritional_references`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `meal_items_meal_idx` ON `meal_items` (`meal_id`);--> statement-breakpoint
CREATE TABLE `meal_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`analysis_id` text NOT NULL,
	`meal_date` integer NOT NULL,
	`total_calories` real NOT NULL,
	`total_protein` real NOT NULL,
	`total_carbohydrates` real NOT NULL,
	`total_fat` real NOT NULL,
	`record_status` text DEFAULT 'saved' NOT NULL,
	`validated_by_user` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`analysis_id`) REFERENCES `food_analyses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meal_records_analysisId_unique` ON `meal_records` (`analysis_id`);--> statement-breakpoint
CREATE INDEX `meal_records_user_date_idx` ON `meal_records` (`user_id`,`meal_date`);--> statement-breakpoint
ALTER TABLE `food_analyses` ADD `disputed_at` integer;--> statement-breakpoint
ALTER TABLE `food_analyses` ADD `dispute_reason` text;