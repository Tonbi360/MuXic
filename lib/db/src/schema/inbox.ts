import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inboxTable = pgTable("inbox", {
  id: serial("id").primaryKey(),
  fromUserId: text("from_user_id").notNull(),
  toUserId: text("to_user_id").notNull(),
  songId: integer("song_id"),
  playlistId: integer("playlist_id"),
  playlistName: text("playlist_name"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInboxSchema = createInsertSchema(inboxTable).omit({ id: true, createdAt: true });
export type InsertInbox = z.infer<typeof insertInboxSchema>;
export type Inbox = typeof inboxTable.$inferSelect;
