import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playlistsTable, playlistSongsTable, songsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import {
  ListPlaylistsQueryParams,
  CreatePlaylistBody,
  GetPlaylistParams,
  DeletePlaylistParams,
  AddSongToPlaylistParams,
  AddSongToPlaylistBody,
  RemoveSongFromPlaylistParams,
} from "@workspace/api-zod";
import { toSongResponse } from "./songs";

const router: IRouter = Router();

async function buildPlaylistResponse(playlist: typeof playlistsTable.$inferSelect, withSongs = false) {
  const songCountResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playlistSongsTable)
    .where(eq(playlistSongsTable.playlistId, playlist.id));

  const songCount = songCountResult[0]?.count ?? 0;

  let songs;
  if (withSongs) {
    const songRows = await db
      .select({ song: songsTable })
      .from(playlistSongsTable)
      .innerJoin(songsTable, eq(playlistSongsTable.songId, songsTable.id))
      .where(eq(playlistSongsTable.playlistId, playlist.id));
    songs = songRows.map((r) => toSongResponse(r.song));
  }

  return {
    id: playlist.id,
    name: playlist.name,
    userId: playlist.userId,
    isPublic: playlist.isPublic,
    songCount,
    songs,
    createdAt: playlist.createdAt.toISOString(),
  };
}

router.get("/playlists", async (req, res): Promise<void> => {
  const params = ListPlaylistsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let playlists;
  if (params.data.userId) {
    playlists = await db.select().from(playlistsTable).where(eq(playlistsTable.userId, params.data.userId));
  } else {
    playlists = await db.select().from(playlistsTable);
  }

  const result = await Promise.all(playlists.map((p) => buildPlaylistResponse(p)));
  res.json(result);
});

router.post("/playlists", async (req, res): Promise<void> => {
  const parsed = CreatePlaylistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [playlist] = await db
    .insert(playlistsTable)
    .values({
      name: parsed.data.name,
      userId: parsed.data.userId,
      isPublic: parsed.data.isPublic ?? false,
    })
    .returning();

  res.status(201).json(await buildPlaylistResponse(playlist));
});

router.get("/playlists/:id", async (req, res): Promise<void> => {
  const params = GetPlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, params.data.id));
  if (!playlist) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }
  res.json(await buildPlaylistResponse(playlist, true));
});

router.delete("/playlists/:id", async (req, res): Promise<void> => {
  const params = DeletePlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(playlistSongsTable).where(eq(playlistSongsTable.playlistId, params.data.id));
  const [playlist] = await db.delete(playlistsTable).where(eq(playlistsTable.id, params.data.id)).returning();
  if (!playlist) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/playlists/:id/songs", async (req, res): Promise<void> => {
  const params = AddSongToPlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddSongToPlaylistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, params.data.id));
  if (!playlist) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }

  await db.insert(playlistSongsTable).values({
    playlistId: params.data.id,
    songId: parsed.data.songId,
    position: 0,
  }).onConflictDoNothing();

  res.json(await buildPlaylistResponse(playlist, true));
});

router.delete("/playlists/:id/songs/:songId", async (req, res): Promise<void> => {
  const params = RemoveSongFromPlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(playlistSongsTable).where(
    and(
      eq(playlistSongsTable.playlistId, params.data.id),
      eq(playlistSongsTable.songId, params.data.songId)
    )
  );
  res.sendStatus(204);
});

export default router;
