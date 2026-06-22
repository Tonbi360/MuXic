import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { forumTable, usersTable } from "@workspace/db";
import { eq, desc, sql, isNull, asc, and } from "drizzle-orm";
import {
  ListForumMessagesQueryParams,
  CreateForumMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const FORUM_PAGE_SIZE = 20;
const MESSAGE_COOLDOWN_MS = 30 * 1000;
const userLastMessage: Map<string, number> = new Map();

// PG-13 word filter — best-effort, won't catch all creative evasions
const BLOCKED_WORDS = ["fuck", "shit", "cunt", "nigger", "nigga", "faggot", "fag"];
function containsBlockedContent(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.includes(w));
}

async function buildMessage(entry: typeof forumTable.$inferSelect, replyCount = 0) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, entry.userId));
  return {
    id: entry.id,
    userId: entry.userId,
    userName: user?.displayName ?? null,
    content: entry.content,
    moodTag: entry.moodTag,
    parentId: entry.parentId ?? null,
    replyCount,
    createdAt: entry.createdAt.toISOString(),
  };
}

router.get("/forum", async (req, res): Promise<void> => {
  const params = ListForumMessagesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const page = typeof params.data.page === "string" ? parseInt(params.data.page, 10) : (params.data.page ?? 1);
  const limit = typeof params.data.limit === "string" ? parseInt(params.data.limit, 10) : (params.data.limit ?? FORUM_PAGE_SIZE);
  const offset = (page - 1) * limit;

  const moodFilter = params.data.moodTag ? eq(forumTable.moodTag, params.data.moodTag) : undefined;
  const whereClause = moodFilter
    ? and(isNull(forumTable.parentId), moodFilter)
    : isNull(forumTable.parentId);

  const [{ count: total }] = await db.select({ count: sql<number>`count(*)::int` }).from(forumTable).where(whereClause);
  const entries = await db.select().from(forumTable).where(whereClause).orderBy(desc(forumTable.createdAt)).limit(limit).offset(offset);

  const messages = await Promise.all(
    entries.map(async (entry) => {
      const [{ replyCount }] = await db
        .select({ replyCount: sql<number>`count(*)::int` })
        .from(forumTable)
        .where(eq(forumTable.parentId, entry.id));
      return buildMessage(entry, replyCount);
    })
  );

  res.json({ messages, total, page, totalPages: Math.ceil(total / limit) });
});

router.get("/forum/:id/replies", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const entries = await db
    .select()
    .from(forumTable)
    .where(eq(forumTable.parentId, id))
    .orderBy(asc(forumTable.createdAt));

  const messages = await Promise.all(entries.map((e) => buildMessage(e)));
  res.json(messages);
});

router.post("/forum", async (req, res): Promise<void> => {
  const parsed = CreateForumMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId, content, moodTag, parentId } = parsed.data;

  // Word filter
  if (containsBlockedContent(content)) {
    res.status(400).json({ error: "Post contains prohibited language" });
    return;
  }

  // Anti-spam cooldown (top-level posts only)
  if (!parentId) {
    const lastPost = userLastMessage.get(userId);
    if (lastPost && Date.now() - lastPost < MESSAGE_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((MESSAGE_COOLDOWN_MS - (Date.now() - lastPost)) / 1000);
      res.status(429).json({ error: `Please wait ${remainingSeconds}s before posting again` });
      return;
    }
    userLastMessage.set(userId, Date.now());
  }

  const [entry] = await db.insert(forumTable).values({
    userId,
    content,
    moodTag: moodTag ?? null,
    parentId: parentId ?? null,
  }).returning();

  res.status(201).json(await buildMessage(entry));
});

router.delete("/forum/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const requestingUserId = req.userId;
  if (!requestingUserId) {
    res.status(401).json({ error: "Missing X-User-Id header" });
    return;
  }

  const [post] = await db.select().from(forumTable).where(eq(forumTable.id, id));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  if (post.userId !== requestingUserId) {
    res.status(403).json({ error: "Not authorized to delete this post" });
    return;
  }

  // Delete replies first, then the post
  await db.delete(forumTable).where(eq(forumTable.parentId, id));
  await db.delete(forumTable).where(eq(forumTable.id, id));

  res.sendStatus(204);
});

export default router;
