import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { songsTable } from "@workspace/db";
import { SearchYoutubeQueryParams, SearchSoundcloudQueryParams, ImportFromSearchBody } from "@workspace/api-zod";
import { toSongResponse } from "./songs";

const router: IRouter = Router();

async function searchYouTube(query: string) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return getMockResults(query, "youtube");
  }
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(query)}&maxResults=10&key=${apiKey}`;
    const resp = await fetch(url);
    const data = await resp.json() as {
      items?: Array<{
        id: { videoId: string };
        snippet: { title: string; channelTitle: string; thumbnails: { medium?: { url: string } } };
      }>;
    };
    if (!data.items) return getMockResults(query, "youtube");
    return data.items.map((item) => ({
      externalId: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      duration: null,
      coverUrl: item.snippet.thumbnails.medium?.url ?? null,
      source: "youtube" as const,
      streamUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));
  } catch {
    return getMockResults(query, "youtube");
  }
}

async function searchSoundCloud(query: string) {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  if (!clientId) {
    return getMockResults(query, "soundcloud");
  }
  try {
    const url = `https://api.soundcloud.com/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=10&linked_partitioning=1`;
    const resp = await fetch(url);
    const data = await resp.json() as {
      collection?: Array<{
        id: number;
        title: string;
        user: { username: string };
        duration: number;
        artwork_url: string | null;
        permalink_url: string;
        stream_url: string;
      }>;
    };
    if (!data.collection) return getMockResults(query, "soundcloud");
    return data.collection.map((track) => ({
      externalId: String(track.id),
      title: track.title,
      artist: track.user.username,
      duration: Math.round(track.duration / 1000),
      coverUrl: track.artwork_url,
      source: "soundcloud" as const,
      streamUrl: track.permalink_url,
    }));
  } catch {
    return getMockResults(query, "soundcloud");
  }
}

function getMockResults(query: string, source: "youtube" | "soundcloud") {
  const artists = ["The Weeknd", "Billie Eilish", "Drake", "Doja Cat", "Tyler the Creator"];
  return Array.from({ length: 5 }, (_, i) => ({
    externalId: `mock-${source}-${i}-${Date.now()}`,
    title: `${query} - Track ${i + 1}`,
    artist: artists[i % artists.length],
    duration: 180 + i * 20,
    coverUrl: null,
    source,
    streamUrl: source === "youtube"
      ? `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
      : `https://soundcloud.com/mock/${query.toLowerCase().replace(/\s+/g, "-")}-${i}`,
  }));
}

router.get("/search/youtube", async (req, res): Promise<void> => {
  const params = SearchYoutubeQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const results = await searchYouTube(params.data.q);
  res.json(results);
});

router.get("/search/soundcloud", async (req, res): Promise<void> => {
  const params = SearchSoundcloudQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const results = await searchSoundCloud(params.data.q);
  res.json(results);
});

router.post("/search/import", async (req, res): Promise<void> => {
  const parsed = ImportFromSearchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const [song] = await db
    .insert(songsTable)
    .values({
      title: d.title,
      artist: d.artist,
      album: null,
      duration: d.duration ?? null,
      coverUrl: d.coverUrl ?? null,
      source: d.source,
      sourceUrl: d.streamUrl,
      storageType: "limited",
      category: d.category ?? "general",
      tags: [],
      userId: d.userId,
      isPublic: false,
      expiresAt,
      voteCount: 0,
    })
    .returning();

  res.status(201).json(toSongResponse(song));
});

export default router;
