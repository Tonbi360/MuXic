import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyPlaylistTable = pgTable("daily_playlist", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").notNull(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailySchema = createInsertSchema(dailyPlaylistTable).omit({ id: true, createdAt: true });
export type InsertDaily = z.infer<typeof insertDailySchema>;
export type Daily = typeof dailyPlaylistTable.$inferSelect;
