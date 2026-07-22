import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const songsTable = pgTable("songs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  album: text("album"),
  duration: integer("duration"),
  coverUrl: text("cover_url"),
  source: text("source").notNull(), // youtube | soundcloud | upload
  sourceUrl: text("source_url").notNull(),
  storageType: text("storage_type").notNull().default("limited"), // limited | permanent | public_limited | public_download
  category: text("category").notNull().default("general"),
  tags: text("tags").array().notNull().default([]),
  lyrics: text("lyrics"),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  voteCount: integer("vote_count").notNull().default(0),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSongSchema = createInsertSchema(songsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSong = z.infer<typeof insertSongSchema>;
export type Song = typeof songsTable.$inferSelect;
