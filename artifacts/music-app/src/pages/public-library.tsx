import { useState } from "react";
import { useListSongs, getListSongsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayer } from "@/hooks/use-player";
import { getUserId } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Library, Search, Play, BookmarkPlus, Check, Music2, ThumbsUp, PlayCircle } from "lucide-react";

export default function PublicLibraryPage() {
  const userId = getUserId();
  const { playSong, playAll } = usePlayer();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const { data: songs, isLoading } = useListSongs({
    storageType: "public_download",
    search: search || undefined,
    limit: 100,
  });

  const mySongs = songs?.filter((s) => s.userId !== userId) ?? [];
  const allSongs = songs ?? [];

  async function handleSave(songId: number, title: string) {
    setSavingId(songId);
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
      setSavedIds((s) => new Set([...s, songId]));
      queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
      toast({ title: "Saved to Library", description: `"${title}" added (48h)` });
    } finally {
      setSavingId(null);
    }
  }

  function handlePlayAll() {
    if (allSongs.length === 0) return;
    playAll(allSongs);
    toast({ title: `Playing ${allSongs.length} community songs` });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold font-serif mb-1 flex items-center gap-2">
            <Library className="w-8 h-8 text-primary" /> Public Library
          </h1>
          <p className="text-muted-foreground">Community songs that reached 50+ votes — free to save and keep</p>
        </div>
        {allSongs.length > 0 && (
          <button
            data-testid="button-play-all-public"
            onClick={handlePlayAll}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
          >
            <PlayCircle className="w-4 h-4" /> Play All
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search public songs…"
          className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : allSongs.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <Library className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="font-medium text-lg">No community songs yet</p>
          <p className="text-sm mt-1">
            {search
              ? `No results for "${search}"`
              : "Songs reach here once they earn 50+ votes on the Song Board"}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {allSongs.length} song{allSongs.length !== 1 ? "s" : ""} available
          </p>
          <div className="space-y-2">
            {allSongs.map((song) => {
              const isMine = song.userId === userId;
              const alreadySaved = isMine || savedIds.has(song.id);
              return (
                <div
                  key={song.id}
                  data-testid={`public-song-${song.id}`}
                  className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors"
                >
                  {song.coverUrl ? (
                    <img src={song.coverUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center shrink-0">
                      <Music2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{song.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                    {(song.voteCount ?? 0) > 0 && (
                      <p className="flex items-center gap-1 text-xs text-primary mt-0.5">
                        <ThumbsUp className="w-3 h-3" /> {song.voteCount} votes
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      data-testid={`button-play-public-${song.id}`}
                      onClick={() => playSong(song)}
                      className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                      title="Play"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    {!isMine && !alreadySaved && (
                      <button
                        data-testid={`button-save-public-${song.id}`}
                        onClick={() => handleSave(song.id, song.title)}
                        disabled={savingId === song.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        title="Save to Library (free, permanent)"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" /> Save
                      </button>
                    )}
                    {alreadySaved && !isMine && (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium px-2">
                        <Check className="w-4 h-4" /> Saved
                      </span>
                    )}
                    {isMine && (
                      <span className="text-xs text-muted-foreground px-2">Yours</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
