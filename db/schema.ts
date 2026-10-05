import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const walkRoutes = sqliteTable('walk_routes', {
  routeKey: text('route_key').primaryKey(),
  response: text('response').notNull(),
  savedAt: text('saved_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const busRoutes = sqliteTable('bus_routes', {
  routeKey: text('route_key').primaryKey(),
  response: text('response').notNull(),
  averageRideSeconds: integer('average_ride_seconds').notNull(),
  sampleCount: integer('sample_count').notNull().default(1),
  savedAt: text('saved_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  checkedAt: text('checked_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const apiUsage = sqliteTable('api_usage', {
  dayKind: text('day_kind').primaryKey(),
  calls: integer('calls').notNull().default(0),
});
