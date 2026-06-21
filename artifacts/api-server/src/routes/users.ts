import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, inboxTable, songsTable, boardEntriesTable, dailyPlaylistTable, forumTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import {
  GetUserParams,
  RegisterUserParams,
  RegisterUserBody,
  GetUserInboxParams,
  ShareSongBody,
} from "@workspace/api-zod";
import { toSongResponse } from "./songs";

const router: IRouter = Router();

async function buildUserProfile(user: typeof usersTable.$inferSelect) {
  const [nominatedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(boardEntriesTable)
    .where(eq(boardEntriesTable.nominatedBy, user.userId));

  const [uploadCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(songsTable)
    .where(eq(songsTable.userId, user.userId));

  return {
    userId: user.userId,
    displayName: user.displayName,
    reputation: user.reputation,
    badgeCount: user.badges.length,
    badges: user.badges,
    nominatedCount: nominatedCount?.count ?? 0,
    uploadCount: uploadCount?.count ?? 0,
    createdAt: user.createdAt.toISOString(),
  };
}

// List all users (for sharing)
router.get("/users", async (_req, res): Promise<void> => {
  const users = await db
    .select({ userId: usersTable.userId, displayName: usersTable.displayName })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(50);
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
    [user] = await db
      .update(usersTable)
      .set({ displayName: parsed.data.displayName })
      .where(eq(usersTable.userId, params.data.userId))
      .returning();
  } else {
    [user] = await db.insert(usersTable).values({
      userId: params.data.userId,
      displayName: parsed.data.displayName,
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

  const items = await db.select().from(inboxTable).where(eq(inboxTable.toUserId, params.data.userId));
  const result = await Promise.all(
    items.map(async (item) => {
      const [song] = await db.select().from(songsTable).where(eq(songsTable.id, item.songId));
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

  const [item] = await db.insert(inboxTable).values({
    fromUserId,
    toUserId,
    songId,
    message: message ?? null,
  }).returning();

  const [song] = await db.select().from(songsTable).where(eq(songsTable.id, item.songId));
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

export default router;
