import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { queueTable, queueVetosTable, songsTable } from "@workspace/db";
import { eq, asc, and, sql } from "drizzle-orm";
import {
  AddToQueueBody,
  VetoQueueEntryParams,
  VetoQueueEntryBody,
  RemoveFromQueueParams,
} from "@workspace/api-zod";
import { toSongResponse } from "./songs";

const VETO_THRESHOLD = 3;
const TOKENS_PER_HOUR = 3;

const router: IRouter = Router();

async function buildQueueEntry(entry: typeof queueTable.$inferSelect) {
  const [song] = await db.select().from(songsTable).where(eq(songsTable.id, entry.songId));
  return {
    id: entry.id,
    songId: entry.songId,
    song: song ? toSongResponse(song) : null,
    userId: entry.userId,
    vetoCount: entry.vetoCount,
    position: entry.position,
    createdAt: entry.createdAt.toISOString(),
  };
}

router.get("/queue", async (_req, res): Promise<void> => {
  const entries = await db.select().from(queueTable).orderBy(asc(queueTable.position), asc(queueTable.createdAt));
  const result = await Promise.all(entries.map(buildQueueEntry));
  res.json(result);
});

router.post("/queue", async (req, res): Promise<void> => {
  const parsed = AddToQueueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { songId, userId } = parsed.data;

  // Token check: count user's submissions in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [tokenCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(queueTable)
    .where(and(eq(queueTable.userId, userId), sql`${queueTable.createdAt} > ${oneHourAgo}`));

  if ((tokenCount?.count ?? 0) >= TOKENS_PER_HOUR) {
    res.status(429).json({ error: "Token limit reached. You can add up to 3 songs per hour." });
    return;
  }

  // Round-robin positioning: find max position for this user to ensure fairness
  const allEntries = await db.select().from(queueTable).orderBy(asc(queueTable.position));
  const maxPosition = allEntries.length > 0 ? allEntries[allEntries.length - 1].position + 1 : 0;

  const [entry] = await db.insert(queueTable).values({
    songId,
    userId,
    vetoCount: 0,
    position: maxPosition,
  }).returning();

  res.status(201).json(await buildQueueEntry(entry));
});

router.post("/queue/:id/veto", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const params = VetoQueueEntryParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = VetoQueueEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Check duplicate veto
  const [existingVeto] = await db.select().from(queueVetosTable).where(
    and(eq(queueVetosTable.queueId, params.data.id), eq(queueVetosTable.userId, parsed.data.userId))
  );
  if (existingVeto) {
    res.status(409).json({ error: "Already vetoed" });
    return;
  }

  await db.insert(queueVetosTable).values({ queueId: params.data.id, userId: parsed.data.userId });

  const [entry] = await db
    .update(queueTable)
    .set({ vetoCount: sql`${queueTable.vetoCount} + 1` })
    .where(eq(queueTable.id, params.data.id))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Queue entry not found" });
    return;
  }

  // Auto-remove if veto threshold reached
  if (entry.vetoCount >= VETO_THRESHOLD) {
    await db.delete(queueTable).where(eq(queueTable.id, params.data.id));
  }

  res.json(await buildQueueEntry(entry));
});

router.delete("/queue/:id", async (req, res): Promise<void> => {
  const params = RemoveFromQueueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(queueTable).where(eq(queueTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
