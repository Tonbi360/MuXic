import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { dailyPlaylistTable, songsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import {
  SubmitToDailyBody,
  GetDailyArchiveQueryParams,
} from "@workspace/api-zod";
import { toSongResponse } from "./songs";

const router: IRouter = Router();

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

async function buildDailyEntry(entry: typeof dailyPlaylistTable.$inferSelect) {
  const [song] = await db.select().from(songsTable).where(eq(songsTable.id, entry.songId));
  return {
    id: entry.id,
    songId: entry.songId,
    song: song ? toSongResponse(song) : null,
    userId: entry.userId,
    date: entry.date,
    createdAt: entry.createdAt.toISOString(),
  };
}

router.get("/daily", async (_req, res): Promise<void> => {
  const today = todayDate();
  const entries = await db.select().from(dailyPlaylistTable).where(eq(dailyPlaylistTable.date, today));
  const result = await Promise.all(entries.map(buildDailyEntry));
  res.json(result);
});

router.post("/daily/submit", async (req, res): Promise<void> => {
  const parsed = SubmitToDailyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const today = todayDate();
  const { songId, userId } = parsed.data;

  // One song per user per day
  const [existing] = await db.select().from(dailyPlaylistTable).where(
    and(eq(dailyPlaylistTable.userId, userId), eq(dailyPlaylistTable.date, today))
  );
  if (existing) {
    res.status(409).json({ error: "You have already submitted a song today" });
    return;
  }

  const [entry] = await db.insert(dailyPlaylistTable).values({ songId, userId, date: today }).returning();
  res.status(201).json(await buildDailyEntry(entry));
});

router.get("/daily/archive", async (req, res): Promise<void> => {
  const params = GetDailyArchiveQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const limit = typeof params.data.limit === "string" ? parseInt(params.data.limit, 10) : (params.data.limit ?? 50);

  let query = db.select().from(dailyPlaylistTable).$dynamic();

  if (params.data.date) {
    query = query.where(eq(dailyPlaylistTable.date, params.data.date));
  }

  const entries = await query.orderBy(desc(dailyPlaylistTable.createdAt)).limit(limit);
  const result = await Promise.all(entries.map(buildDailyEntry));
  res.json(result);
});

export default router;
