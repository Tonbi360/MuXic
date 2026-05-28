import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { forumTable, usersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  ListForumMessagesQueryParams,
  CreateForumMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const FORUM_PAGE_SIZE = 20;
const MESSAGE_COOLDOWN_MS = 30 * 1000;
const userLastMessage: Map<string, number> = new Map();

async function buildMessage(entry: typeof forumTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, entry.userId));
  return {
    id: entry.id,
    userId: entry.userId,
    userName: user?.displayName ?? null,
    content: entry.content,
    moodTag: entry.moodTag,
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

  let query = db.select().from(forumTable).$dynamic();
  let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(forumTable).$dynamic();

  if (params.data.moodTag) {
    query = query.where(eq(forumTable.moodTag, params.data.moodTag));
    countQuery = countQuery.where(eq(forumTable.moodTag, params.data.moodTag));
  }

  const [{ count: total }] = await countQuery;
  const entries = await query.orderBy(desc(forumTable.createdAt)).limit(limit).offset(offset);
  const messages = await Promise.all(entries.map(buildMessage));

  res.json({
    messages,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

router.post("/forum", async (req, res): Promise<void> => {
  const parsed = CreateForumMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId, content, moodTag } = parsed.data;

  // Anti-spam cooldown
  const lastPost = userLastMessage.get(userId);
  if (lastPost && Date.now() - lastPost < MESSAGE_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((MESSAGE_COOLDOWN_MS - (Date.now() - lastPost)) / 1000);
    res.status(429).json({ error: `Please wait ${remainingSeconds}s before posting again` });
    return;
  }

  userLastMessage.set(userId, Date.now());

  const [entry] = await db.insert(forumTable).values({
    userId,
    content,
    moodTag: moodTag ?? null,
  }).returning();

  res.status(201).json(await buildMessage(entry));
});

export default router;
