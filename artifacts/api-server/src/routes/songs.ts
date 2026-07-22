import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  songsTable,
  boardEntriesTable,
  votesTable,
  queueTable,
  queueVetosTable,
  playlistSongsTable,
  dailyPlaylistTable,
  inboxTable,
} from "@workspace/db";
import { eq, ilike, or, and, sql, inArray } from "drizzle-orm";
import {
  ListSongsQueryParams,
  CreateSongBody,
  GetSongParams,
  UpdateSongParams,
  UpdateSongBody,
  DeleteSongParams,
  PromoteSongParams,
  PromoteSongBody,
  TagSongParams,
  TagSongBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toSongResponse(s: typeof songsTable.$inferSelect) {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    album: s.album,
    duration: s.duration,
    coverUrl: s.coverUrl,
    source: s.source,
    sourceUrl: s.sourceUrl,
    storageType: s.storageType,
    category: s.category,
    tags: s.tags,
    lyrics: s.lyrics ?? null,
    userId: s.userId,
    expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
    voteCount: s.voteCount,
    isPublic: s.isPublic,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/songs", async (req, res): Promise<void> => {
  const params = ListSongsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { category, storageType, sort, search, lyricsSearch, limit = 50, offset = 0 } = params.data;

  let query = db.select().from(songsTable).$dynamic();

  const conditions = [];
  if (category) conditions.push(eq(songsTable.category, category));
  if (storageType) conditions.push(eq(songsTable.storageType, storageType));
  if (search) {
    conditions.push(
      or(
        ilike(songsTable.title, `%${search}%`),
        ilike(songsTable.artist, `%${search}%`)
      )!
    );
  }
  if (lyricsSearch) {
    conditions.push(ilike(songsTable.lyrics, `%${lyricsSearch}%`));
  }
  if (conditions.length > 0) query = query.where(and(...conditions));

  const limitNum = typeof limit === "string" ? parseInt(limit, 10) : (limit ?? 50);
  const offsetNum = typeof offset === "string" ? parseInt(offset, 10) : (offset ?? 0);

  void sort;
  const songs = await query.limit(limitNum).offset(offsetNum);
  res.json(songs.map(toSongResponse));
});

router.post("/songs", async (req, res): Promise<void> => {
  const parsed = CreateSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const expiresAt =
    data.storageType === "limited" || data.storageType === "public_limited"
      ? new Date(Date.now() + 48 * 60 * 60 * 1000)
      : null;

  const [song] = await db
    .insert(songsTable)
    .values({
      title: data.title,
      artist: data.artist,
      album: data.album ?? null,
      duration: data.duration ?? null,
      coverUrl: data.coverUrl ?? null,
      source: data.source,
      sourceUrl: data.sourceUrl,
      storageType: data.storageType,
      category: data.category ?? "general",
      tags: data.tags ?? [],
      userId: data.userId,
      isPublic: data.isPublic ?? false,
      expiresAt,
      voteCount: 0,
    })
    .returning();

  res.status(201).json(toSongResponse(song));
});

router.get("/songs/:id", async (req, res): Promise<void> => {
  const params = GetSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [song] = await db.select().from(songsTable).where(eq(songsTable.id, params.data.id));
  if (!song) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  res.json(toSongResponse(song));
});

router.patch("/songs/:id", async (req, res): Promise<void> => {
  const params = UpdateSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Ownership check
  const [existing] = await db.select().from(songsTable).where(eq(songsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  if (req.userId && existing.userId !== req.userId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  // Only allow safe fields — voteCount, isPublic are intentionally excluded (mass-assignment protection)
  const update: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.title !== undefined) update.title = d.title;
  if (d.artist !== undefined) update.artist = d.artist;
  if (d.album !== undefined) update.album = d.album;
  if (d.coverUrl !== undefined) update.coverUrl = d.coverUrl;
  if (d.category !== undefined) update.category = d.category;
  if (d.tags !== undefined) update.tags = d.tags;
  if (d.storageType !== undefined) {
    update.storageType = d.storageType;
    if (d.storageType === "permanent" || d.storageType === "public_download") {
      update.expiresAt = null;
    }
  }

  const [song] = await db.update(songsTable).set(update).where(eq(songsTable.id, params.data.id)).returning();
  if (!song) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  res.json(toSongResponse(song));
});

router.delete("/songs/:id", async (req, res): Promise<void> => {
  const params = DeleteSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(songsTable).where(eq(songsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Song not found" });
    return;
  }

  // Ownership check
  if (req.userId && existing.userId !== req.userId) {
    res.status(403).json({ error: "Not authorized to delete this song" });
    return;
  }

  const songId = params.data.id;

  // Cascade: inbox references
  await db.delete(inboxTable).where(eq(inboxTable.songId, songId));

  // Cascade: daily playlist
  await db.delete(dailyPlaylistTable).where(eq(dailyPlaylistTable.songId, songId));

  // Cascade: playlist_songs
  await db.delete(playlistSongsTable).where(eq(playlistSongsTable.songId, songId));

  // Cascade: queue vetos then queue entries
  const queueEntries = await db
    .select({ id: queueTable.id })
    .from(queueTable)
    .where(eq(queueTable.songId, songId));
  if (queueEntries.length > 0) {
    await db.delete(queueVetosTable).where(
      inArray(queueVetosTable.queueId, queueEntries.map((e) => e.id))
    );
  }
  await db.delete(queueTable).where(eq(queueTable.songId, songId));

  // Cascade: votes + board entries
  await db.delete(votesTable).where(eq(votesTable.songId, songId));
  await db.delete(boardEntriesTable).where(eq(boardEntriesTable.songId, songId));

  // Finally delete the song
  await db.delete(songsTable).where(eq(songsTable.id, songId));

  res.sendStatus(204);
});

// Save a public song to the requesting user's own library (creates a copy)
router.post("/songs/:id/save", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid song id" }); return; }

  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: "X-User-Id header required" }); return; }

  const [original] = await db.select().from(songsTable).where(eq(songsTable.id, id));
  if (!original) { res.status(404).json({ error: "Song not found" }); return; }

  // Only public songs can be saved by others
  const publicTypes = ["public_limited", "public_download"] as const;
  if (!publicTypes.includes(original.storageType as typeof publicTypes[number]) && original.userId !== userId) {
    res.status(403).json({ error: "Only public songs can be saved" }); return;
  }

  // Idempotent: already own a copy with this sourceUrl?
  const [existing] = await db.select().from(songsTable)
    .where(and(eq(songsTable.sourceUrl, original.sourceUrl), eq(songsTable.userId, userId)));
  if (existing) { res.json(toSongResponse(existing)); return; }

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const [song] = await db.insert(songsTable).values({
    title: original.title, artist: original.artist, album: original.album,
    duration: original.duration, coverUrl: original.coverUrl,
    source: original.source, sourceUrl: original.sourceUrl,
    storageType: "limited", category: original.category,
    tags: original.tags, lyrics: original.lyrics ?? null,
    userId, isPublic: false, expiresAt, voteCount: 0,
  }).returning();

  res.status(201).json(toSongResponse(song));
});

router.post("/songs/:id/promote", async (req, res): Promise<void> => {
  const params = PromoteSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = PromoteSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(songsTable).where(eq(songsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  if (req.userId && existing.userId !== req.userId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  const [song] = await db
    .update(songsTable)
    .set({ storageType: parsed.data.targetStorage, expiresAt: null })
    .where(eq(songsTable.id, params.data.id))
    .returning();

  if (!song) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  res.json(toSongResponse(song));
});

router.post("/songs/:id/tags", async (req, res): Promise<void> => {
  const params = TagSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = TagSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(songsTable).where(eq(songsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Song not found" });
    return;
  }

  const newTags = Array.from(new Set([...existing.tags, parsed.data.tag]));
  const [song] = await db.update(songsTable).set({ tags: newTags }).where(eq(songsTable.id, params.data.id)).returning();
  res.json(toSongResponse(song));
});

router.get("/categories", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ category: songsTable.category, count: sql<number>`count(*)::int` })
    .from(songsTable)
    .groupBy(songsTable.category);

  res.json(rows.map((r) => ({ name: r.category, count: r.count })));
});

export default router;
export { toSongResponse };
