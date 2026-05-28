import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  songsTable,
  usersTable,
  votesTable,
  dailyPlaylistTable,
  queueTable,
  forumTable,
  boardEntriesTable,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { GetTrendingQueryParams } from "@workspace/api-zod";
import { toSongResponse } from "./songs";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [[{ totalSongs }], [{ totalUsers }], [{ totalVotes }], [{ activeDailyEntries }], [{ queueLength }], [{ forumMessages }], [{ publicDownloadCount }], [{ publicLimitedCount }]] =
    await Promise.all([
      db.select({ totalSongs: sql<number>`count(*)::int` }).from(songsTable),
      db.select({ totalUsers: sql<number>`count(*)::int` }).from(usersTable),
      db.select({ totalVotes: sql<number>`count(*)::int` }).from(votesTable),
      db.select({ activeDailyEntries: sql<number>`count(*)::int` }).from(dailyPlaylistTable).where(eq(dailyPlaylistTable.date, new Date().toISOString().split("T")[0])),
      db.select({ queueLength: sql<number>`count(*)::int` }).from(queueTable),
      db.select({ forumMessages: sql<number>`count(*)::int` }).from(forumTable),
      db.select({ publicDownloadCount: sql<number>`count(*)::int` }).from(songsTable).where(eq(songsTable.storageType, "public_download")),
      db.select({ publicLimitedCount: sql<number>`count(*)::int` }).from(songsTable).where(eq(songsTable.storageType, "public_limited")),
    ]);

  res.json({
    totalSongs,
    totalUsers,
    totalVotes,
    activeDailyEntries,
    queueLength,
    forumMessages,
    publicDownloadCount,
    publicLimitedCount,
  });
});

router.get("/stats/trending", async (req, res): Promise<void> => {
  const params = GetTrendingQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const limit = typeof params.data.limit === "string" ? parseInt(params.data.limit, 10) : (params.data.limit ?? 10);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const entries = await db
    .select()
    .from(boardEntriesTable)
    .where(sql`${boardEntriesTable.createdAt} > ${cutoff}`)
    .orderBy(desc(boardEntriesTable.voteCount))
    .limit(limit);

  const result = await Promise.all(
    entries.map(async (entry) => {
      const [song] = await db.select().from(songsTable).where(eq(songsTable.id, entry.songId));
      return {
        id: entry.id,
        songId: entry.songId,
        song: song ? toSongResponse(song) : null,
        voteCount: entry.voteCount,
        nominatedBy: entry.nominatedBy,
        userVoted: false,
        createdAt: entry.createdAt.toISOString(),
      };
    })
  );

  res.json(result);
});

export default router;
