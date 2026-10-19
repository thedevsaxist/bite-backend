CREATE TABLE `food_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`image_reference` text NOT NULL,
	`additional_context` text,
	`analysis_status` text DEFAULT 'processing' NOT NULL,
	`ai_result` text,
	`ai_provider` text,
	`ai_model` text,
	`failure_reason` text,
	`processing_time_ms` integer,
	`analysed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `food_analyses_user_created_idx` ON `food_analyses` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `recognised_food_items` (
	`id` text PRIMARY KEY NOT NULL,
	`analysis_id` text NOT NULL,
	`position` integer NOT NULL,
	`food_name` text NOT NULL,
	`nutrition_reference_id` text,
	`portion_description` text,
	`estimated_quantity` real,
	`quantity_unit` text,
	`recognition_confidence` real,
	`calories` real,
	`protein` real,
	`carbohydrates` real,
	`fat` real,
	FOREIGN KEY (`analysis_id`) REFERENCES `food_analyses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`nutrition_reference_id`) REFERENCES `nutritional_references`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `recognised_food_items_analysis_idx` ON `recognised_food_items` (`analysis_id`);