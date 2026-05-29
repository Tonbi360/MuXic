import { pgTable, text, serial, integer, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const forumTable = pgTable("forum", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  content: text("content").notNull(),
  moodTag: text("mood_tag"),
  parentId: integer("parent_id").references((): AnyPgColumn => forumTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertForumSchema = createInsertSchema(forumTable).omit({ id: true, createdAt: true });
export type InsertForum = z.infer<typeof insertForumSchema>;
export type Forum = typeof forumTable.$inferSelect;
