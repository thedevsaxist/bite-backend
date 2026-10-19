CREATE TABLE `nutritional_references` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`food_name` text NOT NULL,
	`aliases` text NOT NULL,
	`serving_size` real NOT NULL,
	`serving_unit` text NOT NULL,
	`calories` real NOT NULL,
	`protein` real NOT NULL,
	`carbohydrates` real NOT NULL,
	`fat` real NOT NULL,
	`typical_serving_size` real NOT NULL,
	`typical_serving_label` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nutritional_references_key_unique` ON `nutritional_references` (`key`);