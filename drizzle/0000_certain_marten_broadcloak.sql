CREATE TABLE `api_usage` (
	`day_kind` text PRIMARY KEY NOT NULL,
	`calls` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `walk_routes` (
	`route_key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`saved_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
