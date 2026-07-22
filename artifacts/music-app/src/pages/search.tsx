import { useState } from "react";
import {
  useSearchYoutube, useImportFromSearch, useListSongs,
  getListSongsQueryKey, useNominateSong, getListSongBoardQueryKey,
  getListSongsQueryKey as _unused,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayer } from "@/hooks/use-player";
import { getUserId } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Search, Music2, Download, Play, Youtube, AppWindow, BookmarkPlus, Check } from "lucide-react";
import type { SearchResult } from "@workspace/api-client-react";

void _unused;

type Tab = "youtube" | "app";

export default function SearchPage() {
  const [tab, setTab] = useState<Tab>("youtube");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const { playSong } = usePlayer();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = getUserId();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedSourceUrls, setSavedSourceUrls] = useState<Set<string>>(new Set());

  const { data: ytResults, isLoading: ytLoading } = useSearchYoutube(
    { q: submitted },
    { query: { enabled: !!submitted && tab === "youtube", queryKey: ["searchYoutube", submitted] } }
  );

  const [appSearchMode, setAppSearchMode] = useState<"title" | "lyrics">("title");

  // On App: title/artist search — only show public songs + user's own
  const { data: appTitleRaw, isLoading: appTitleLoading } = useListSongs(
    { search: submitted, limit: 100 },
    { query: { enabled: !!submitted && tab === "app" && appSearchMode === "title", queryKey: ["appSearch", submitted] } }
  );
  // On App: lyrics search
  const { data: appLyricsRaw, isLoading: appLyricsLoading } = useListSongs(
    { lyricsSearch: submitted, limit: 100 },
    { query: { enabled: !!submitted && tab === "app" && appSearchMode === "lyrics", queryKey: ["appLyricsSearch", submitted] } }
  );
  const appResultsRaw = appSearchMode === "lyrics" ? appLyricsRaw : appTitleRaw;
  const appLoading = appSearchMode === "lyrics" ? appLyricsLoading : appTitleLoading;
  const appResults = (appResultsRaw ?? []).filter(
    (s) => s.isPublic || s.userId === userId
  );

  const importMutation = useImportFromSearch();
  const nominateMutation = useNominateSong();

  const results: SearchResult[] = ytResults ?? [];
  const loading = tab === "youtube" ? ytLoading : appLoading;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(query.trim());
  }

  async function handleImport(result: SearchResult) {
    importMutation.mutate(
      {
        data: {
          externalId: result.externalId,
          title: result.title,
          artist: result.artist,
          duration: result.duration ?? undefined,
          coverUrl: result.coverUrl ?? undefined,
          source: result.source,
          streamUrl: result.streamUrl,
          userId,
          category: "general",
        },
      },
      {
        onSuccess: (song) => {
          queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
          toast({ title: "Added to library", description: `"${song.title}" saved as a limited song (48h)` });

          nominateMutation.mutate(
            { songId: song.id, data: { userId } },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: getListSongBoardQueryKey() });
                toast({ title: "Nominated to Song Board", description: "Others can now vote on it!" });
              },
            }
          );
        },
        onError: () => {
          toast({ title: "Import failed", variant: "destructive" });
        },
      }
    );
  }

  async function handleSaveFromApp(songId: number, title: string, sourceUrl: string) {
    setSavingId(String(songId));
    try {
      const resp = await fetch(`/api/songs/${songId}/save`, {
        method: "POST",
        headers: { "x-user-id": userId },
      });
      const data = await resp.json() as { error?: string };
      if (!resp.ok) {
        toast({ title: data.error ?? "Could not save", variant: "destructive" });
        return;
      }
      setSavedSourceUrls((s) => new Set([...s, sourceUrl]));
      queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
      toast({ title: "Saved to Library", description: `"${title}" added (48h)` });
    } finally {
      setSavingId(null);
    }
  }

  function formatDuration(secs?: number | null) {
    if (!secs) return "";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-bold font-serif mb-1">Search</h1>
        <p className="text-muted-foreground">Find songs on YouTube or browse what's already on the app</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            data-testid="input-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "youtube" ? "Search YouTube for a song or artist…" : "Search songs already on MuXic…"}
            className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button
          data-testid="button-search"
          type="submit"
          className="px-5 py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-opacity"
        >
          Search
        </button>
      </form>

      {/* Source Tabs */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
          <button
            key="youtube"
            data-testid="tab-youtube"
            onClick={() => setTab("youtube")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "youtube" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Youtube className="w-4 h-4" /> YouTube
          </button>
          <button
            key="app"
            data-testid="tab-app"
            onClick={() => setTab("app")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "app" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <AppWindow className="w-4 h-4" /> On App
          </button>
        </div>
        {tab === "app" && (
          <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
            <button
              onClick={() => setAppSearchMode("title")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${appSearchMode === "title" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Title / Artist
            </button>
            <button
              onClick={() => setAppSearchMode("lyrics")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${appSearchMode === "lyrics" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Lyrics
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {!submitted ? (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          {tab === "youtube" ? (
            <>
              <p>Search to discover songs from YouTube</p>
              <p className="text-sm mt-1">Imported songs are saved for 48 hours in your library</p>
            </>
          ) : (
            <>
              <p>Search songs already imported by the community</p>
              <p className="text-sm mt-1">Play or save public songs directly to your library</p>
            </>
          )}
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : tab === "youtube" ? (
        results.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Music2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No results found for "{submitted}"</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((result) => (
              <div
                key={result.externalId}
                data-testid={`search-result-${result.externalId}`}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/40 transition-colors"
              >
                {result.coverUrl ? (
                  <img src={result.coverUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center shrink-0">
                    <Youtube className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{result.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{result.artist}</p>
                  {result.duration && (
                    <p className="text-xs text-muted-foreground mt-1">{formatDuration(result.duration)}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    data-testid={`button-play-${result.externalId}`}
                    onClick={() =>
                      playSong({
                        id: 0,
                        title: result.title,
                        artist: result.artist,
                        album: null,
                        duration: result.duration ?? null,
                        coverUrl: result.coverUrl ?? null,
                        source: result.source,
                        sourceUrl: result.streamUrl,
                        storageType: "limited",
                        category: "general",
                        tags: [],
                        userId,
                        expiresAt: null,
                        voteCount: 0,
                        isPublic: false,
                        createdAt: new Date().toISOString(),
                      })
                    }
                    className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                    title="Play"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    data-testid={`button-import-${result.externalId}`}
                    onClick={() => handleImport(result)}
                    disabled={importMutation.isPending}
                    className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    title="Save to library"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* On App results */
        !appResults || appResults.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Music2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No songs found for "{submitted}" on the app</p>
            <p className="text-sm mt-1">Try searching YouTube to import it</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appResults.map((song) => {
              const isPublic = song.storageType === "public_limited" || song.storageType === "public_download";
              const isMine = song.userId === userId;
              const alreadySaved = isMine || savedSourceUrls.has(song.sourceUrl);
              return (
                <div
                  key={song.id}
                  data-testid={`app-result-${song.id}`}
                  className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/40 transition-colors"
                >
                  {song.coverUrl ? (
                    <img src={song.coverUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center shrink-0">
                      <Music2 className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{song.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full text-muted-foreground capitalize">
                        {song.storageType.replace("_", " ")}
                      </span>
                      {(song.voteCount ?? 0) > 0 && (
                        <span className="text-[10px] text-primary font-medium">{song.voteCount} votes</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      data-testid={`button-play-app-${song.id}`}
                      onClick={() => playSong(song)}
                      className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                      title="Play"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    {isPublic && !alreadySaved && (
                      <button
                        data-testid={`button-save-app-${song.id}`}
                        onClick={() => handleSaveFromApp(song.id, song.title, song.sourceUrl)}
                        disabled={savingId === String(song.id)}
                        className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                        title="Save to my library"
                      >
                        <BookmarkPlus className="w-4 h-4" />
                      </button>
                    )}
                    {alreadySaved && (
                      <span className="p-2 text-primary" title="In your library">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
