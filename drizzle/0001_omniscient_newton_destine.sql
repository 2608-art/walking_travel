CREATE TABLE `bus_routes` (
	`route_key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`average_ride_seconds` integer NOT NULL,
	`sample_count` integer DEFAULT 1 NOT NULL,
	`saved_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`checked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
