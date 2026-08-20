import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  inboxTable,
  songsTable,
  boardEntriesTable,
  dailyPlaylistTable,
  forumTable,
  playlistsTable,
} from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import {
  GetUserParams,
  RegisterUserParams,
  RegisterUserBody,
  GetUserInboxParams,
  ShareSongBody,
  SharePlaylistBody,
} from "@workspace/api-zod";
import { toSongResponse } from "./songs";

const router: IRouter = Router();

// Inbox share cooldown — prevents spam
const inboxCooldownMap: Map<string, number> = new Map();
const INBOX_COOLDOWN_MS = 30 * 1000;

async function buildUserProfile(user: typeof usersTable.$inferSelect) {
  const [nominatedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(boardEntriesTable)
    .where(eq(boardEntriesTable.nominatedBy, user.userId));

  const [uploadResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(songsTable)
    .where(eq(songsTable.userId, user.userId));

  const nominations = nominatedResult?.count ?? 0;
  const uploads = uploadResult?.count ?? 0;

  // Compute reputation and badges from live data
  const reputation = nominations * 5 + uploads * 10;
  const badges: string[] = [];
  if (uploads >= 1) badges.push("Lyricist");
  if (nominations >= 1) badges.push("Nominator");
  if (reputation >= 50) badges.push("Music Guru");

  // Sync stored values if they differ
  const reputationChanged = user.reputation !== reputation;
  const badgesChanged = JSON.stringify([...user.badges].sort()) !== JSON.stringify([...badges].sort());
  if (reputationChanged || badgesChanged) {
    await db
      .update(usersTable)
      .set({ reputation, badges })
      .where(eq(usersTable.userId, user.userId));
  }

  return {
    userId: user.userId,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    reputation,
    badgeCount: badges.length,
    badges,
    nominatedCount: nominations,
    uploadCount: uploads,
    createdAt: user.createdAt.toISOString(),
  };
}

// List all users (minimal data for sharing UI)
router.get("/users", async (_req, res): Promise<void> => {
  const users = await db
    .select({ userId: usersTable.userId, displayName: usersTable.displayName })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(100);
  res.json(users);
});

router.get("/users/:userId", async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, params.data.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(await buildUserProfile(user));
});

router.post("/users/:userId/register", async (req, res): Promise<void> => {
  const params = RegisterUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.userId, params.data.userId));
  let user;
  if (existing) {
    const updates: Record<string, unknown> = { displayName: parsed.data.displayName };
    if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;
    [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.userId, params.data.userId))
      .returning();
  } else {
    [user] = await db.insert(usersTable).values({
      userId: params.data.userId,
      displayName: parsed.data.displayName,
      avatarUrl: parsed.data.avatarUrl ?? null,
      reputation: 0,
      badges: [],
    }).returning();
  }

  res.json(await buildUserProfile(user));
});

router.get("/users/:userId/inbox", async (req, res): Promise<void> => {
  const params = GetUserInboxParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Only the inbox owner can read it
  if (req.userId && req.userId !== params.data.userId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  const items = await db.select().from(inboxTable).where(eq(inboxTable.toUserId, params.data.userId));
  const result = await Promise.all(
    items.map(async (item) => {
      const [song] = item.songId
        ? await db.select().from(songsTable).where(eq(songsTable.id, item.songId))
        : [undefined];
      const [fromUser] = await db.select().from(usersTable).where(eq(usersTable.userId, item.fromUserId));
      return {
        id: item.id,
        fromUserId: item.fromUserId,
        fromUserName: fromUser?.displayName ?? null,
        toUserId: item.toUserId,
        songId: item.songId,
        song: song ? toSongResponse(song) : null,
        message: item.message,
        createdAt: item.createdAt.toISOString(),
      };
    })
  );

  res.json(result);
});

router.get("/users/:userId/activity", async (req, res): Promise<void> => {
  const userId = req.params.userId;

  const [nominations, dailyEntries, forumPosts] = await Promise.all([
    db.select().from(boardEntriesTable)
      .where(eq(boardEntriesTable.nominatedBy, userId))
      .orderBy(desc(boardEntriesTable.createdAt))
      .limit(15),
    db.select().from(dailyPlaylistTable)
      .where(eq(dailyPlaylistTable.userId, userId))
      .orderBy(desc(dailyPlaylistTable.createdAt))
      .limit(15),
    db.select().from(forumTable)
      .where(eq(forumTable.userId, userId))
      .orderBy(desc(forumTable.createdAt))
      .limit(15),
  ]);

  const nominationItems = await Promise.all(
    nominations.map(async (n) => {
      const [song] = await db.select().from(songsTable).where(eq(songsTable.id, n.songId));
      return { type: "nomination", date: n.createdAt.toISOString(), song: song ? toSongResponse(song) : null };
    })
  );

  const dailyItems = await Promise.all(
    dailyEntries.map(async (d) => {
      const [song] = await db.select().from(songsTable).where(eq(songsTable.id, d.songId));
      return { type: "daily", date: d.createdAt.toISOString(), song: song ? toSongResponse(song) : null };
    })
  );

  const forumItems = forumPosts.map((f) => ({
    type: "forum",
    date: f.createdAt.toISOString(),
    content: f.content,
    moodTag: f.moodTag ?? null,
    song: null,
  }));

  const activities = [...nominationItems, ...dailyItems, ...forumItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  res.json(activities);
});

router.delete("/users/:userId", async (req, res): Promise<void> => {
  const userId = req.params.userId;
  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  // Ownership check — only the user themselves can delete their account
  if (req.userId && req.userId !== userId) {
    res.status(403).json({ error: "Not authorized to delete this account" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.userId, userId));
  res.sendStatus(204);
});

router.post("/users/share", async (req, res): Promise<void> => {
  const parsed = ShareSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { fromUserId, toUserId, songId, message } = parsed.data;

  // Rate limit: 30s cooldown per sender
  const lastShare = inboxCooldownMap.get(fromUserId);
  if (lastShare && Date.now() - lastShare < INBOX_COOLDOWN_MS) {
    const remaining = Math.ceil((INBOX_COOLDOWN_MS - (Date.now() - lastShare)) / 1000);
    res.status(429).json({ error: `Please wait ${remaining}s before sharing again` });
    return;
  }
  inboxCooldownMap.set(fromUserId, Date.now());

  const [item] = await db.insert(inboxTable).values({
    fromUserId,
    toUserId,
    songId,
    message: message ?? null,
  }).returning();

  const [song] = item.songId
    ? await db.select().from(songsTable).where(eq(songsTable.id, item.songId))
    : [undefined];
  const [fromUser] = await db.select().from(usersTable).where(eq(usersTable.userId, item.fromUserId));

  res.status(201).json({
    id: item.id,
    fromUserId: item.fromUserId,
    fromUserName: fromUser?.displayName ?? null,
    toUserId: item.toUserId,
    songId: item.songId,
    song: song ? toSongResponse(song) : null,
    message: item.message,
    createdAt: item.createdAt.toISOString(),
  });
});

router.post("/users/share-playlist", async (req, res): Promise<void> => {
  const parsed = SharePlaylistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { fromUserId, toUserId, playlistId, message } = parsed.data;

  // Rate limit: share cooldown per sender
  const lastShare = inboxCooldownMap.get(fromUserId);
  if (lastShare && Date.now() - lastShare < INBOX_COOLDOWN_MS) {
    const remaining = Math.ceil((INBOX_COOLDOWN_MS - (Date.now() - lastShare)) / 1000);
    res.status(429).json({ error: `Please wait ${remaining}s before sharing again` });
    return;
  }
  inboxCooldownMap.set(fromUserId, Date.now());

  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, playlistId));
  if (!playlist) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }

  const [item] = await db.insert(inboxTable).values({
    fromUserId,
    toUserId,
    playlistId,
    playlistName: playlist.name,
    message: message ?? null,
  }).returning();

  const [fromUser] = await db.select().from(usersTable).where(eq(usersTable.userId, item.fromUserId));

  res.status(201).json({
    id: item.id,
    type: "playlist",
    fromUserId: item.fromUserId,
    fromUserName: fromUser?.displayName ?? null,
    toUserId: item.toUserId,
    playlistId: item.playlistId,
    playlistName: item.playlistName,
    message: item.message,
    createdAt: item.createdAt.toISOString(),
  });
});

export default router;
