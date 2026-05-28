import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const queueTable = pgTable("queue", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").notNull(),
  userId: text("user_id").notNull(),
  vetoCount: integer("veto_count").notNull().default(0),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const queueVetosTable = pgTable("queue_vetos", {
  id: serial("id").primaryKey(),
  queueId: integer("queue_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQueueSchema = createInsertSchema(queueTable).omit({ id: true, createdAt: true });
export type InsertQueue = z.infer<typeof insertQueueSchema>;
export type Queue = typeof queueTable.$inferSelect;
