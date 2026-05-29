import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { boardEntriesTable, votesTable, songsTable } from "@workspace/db";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import {
  ListSongBoardQueryParams,
  VoteSongParams,
  VoteSongBody,
  NominateSongParams,
  NominateSongBody,
} from "@workspace/api-zod";
import { toSongResponse } from "./songs";

const router: IRouter = Router();

async function buildBoardEntry(entry: typeof boardEntriesTable.$inferSelect, userId?: string) {
  const [song] = await db.select().from(songsTable).where(eq(songsTable.id, entry.songId));
  let userVoted = false;
  if (userId && song) {
    const [vote] = await db.select().from(votesTable).where(
      and(eq(votesTable.songId, entry.songId), eq(votesTable.userId, userId))
    );
    userVoted = !!vote;
  }
  return {
    id: entry.id,
    songId: entry.songId,
    song: song ? toSongResponse(song) : null,
    voteCount: entry.voteCount,
    nominatedBy: entry.nominatedBy,
    userVoted,
    createdAt: entry.createdAt.toISOString(),
  };
}

router.get("/songboard", async (req, res): Promise<void> => {
  const params = ListSongBoardQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { tab = "hot", limit = 20, offset = 0 } = params.data;
  const limitNum = typeof limit === "string" ? parseInt(limit, 10) : (limit ?? 20);
  const offsetNum = typeof offset === "string" ? parseInt(offset, 10) : (offset ?? 0);

  let entries;
  if (tab === "hot") {
    // Songs with the most votes cast in the last 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentVotes = await db
      .select({ songId: votesTable.songId })
      .from(votesTable)
      .where(sql`${votesTable.createdAt} > ${cutoff}`)
      .groupBy(votesTable.songId)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(limitNum)
      .offset(offsetNum);

    if (recentVotes.length === 0) {
      // Fallback: all-time leaderboard
      entries = await db
        .select()
        .from(boardEntriesTable)
        .orderBy(desc(boardEntriesTable.voteCount))
        .limit(limitNum)
        .offset(offsetNum);
    } else {
      const songIds = recentVotes.map((v) => v.songId);
      const unordered = await db
        .select()
        .from(boardEntriesTable)
        .where(inArray(boardEntriesTable.songId, songIds));
      const orderMap = new Map(songIds.map((id, i) => [id, i]));
      entries = [...unordered].sort(
        (a, b) => (orderMap.get(a.songId) ?? 999) - (orderMap.get(b.songId) ?? 999)
      );
    }
  } else if (tab === "legends") {
    entries = await db
      .select()
      .from(boardEntriesTable)
      .orderBy(desc(boardEntriesTable.voteCount))
      .limit(limitNum)
      .offset(offsetNum);
  } else {
    // mini - all entries ordered by newest
    entries = await db
      .select()
      .from(boardEntriesTable)
      .orderBy(desc(boardEntriesTable.createdAt))
      .limit(limitNum)
      .offset(offsetNum);
  }

  const userId = req.query.userId as string | undefined;
  const result = await Promise.all(entries.map((e) => buildBoardEntry(e, userId)));
  res.json(result);
});

router.post("/songboard/:songId/vote", async (req, res): Promise<void> => {
  const params = VoteSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = VoteSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { songId } = params.data;
  const { userId } = parsed.data;

  // Check duplicate vote
  const [existing] = await db.select().from(votesTable).where(
    and(eq(votesTable.songId, songId), eq(votesTable.userId, userId))
  );
  if (existing) {
    res.status(409).json({ error: "Already voted" });
    return;
  }

  await db.insert(votesTable).values({ songId, userId });

  // Update vote count on song and board entry
  await db.update(songsTable).set({ voteCount: sql`${songsTable.voteCount} + 1` }).where(eq(songsTable.id, songId));

  let [entry] = await db.select().from(boardEntriesTable).where(eq(boardEntriesTable.songId, songId));
  if (entry) {
    [entry] = await db
      .update(boardEntriesTable)
      .set({ voteCount: sql`${boardEntriesTable.voteCount} + 1` })
      .where(eq(boardEntriesTable.songId, songId))
      .returning();
  } else {
    const [song] = await db.select().from(songsTable).where(eq(songsTable.id, songId));
    [entry] = await db.insert(boardEntriesTable).values({
      songId,
      nominatedBy: userId,
      voteCount: 1,
    }).returning();
    void song;
  }

  // Graduate to public_download if >= 50 votes
  if (entry.voteCount >= 50) {
    await db.update(songsTable).set({ storageType: "public_download", expiresAt: null }).where(eq(songsTable.id, songId));
  }

  res.json(await buildBoardEntry(entry, userId));
});

router.post("/songboard/:songId/nominate", async (req, res): Promise<void> => {
  const params = NominateSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = NominateSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { songId } = params.data;

  const [existing] = await db.select().from(boardEntriesTable).where(eq(boardEntriesTable.songId, songId));
  if (existing) {
    res.status(409).json({ error: "Already nominated" });
    return;
  }

  const [entry] = await db.insert(boardEntriesTable).values({
    songId,
    nominatedBy: parsed.data.userId,
    voteCount: 0,
  }).returning();

  res.status(201).json(await buildBoardEntry(entry));
});

export default router;
