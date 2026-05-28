import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const boardEntriesTable = pgTable("board_entries", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").notNull(),
  nominatedBy: text("nominated_by").notNull(),
  voteCount: integer("vote_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const votesTable = pgTable("votes", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBoardEntrySchema = createInsertSchema(boardEntriesTable).omit({ id: true, createdAt: true });
export type InsertBoardEntry = z.infer<typeof insertBoardEntrySchema>;
export type BoardEntry = typeof boardEntriesTable.$inferSelect;
