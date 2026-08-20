import { useState } from "react";
import {
  useGetDailyPlaylist, useSubmitToDaily, useGetDailyArchive,
  useListSongs, useListUsers, useListPlaylists, useAddSongToPlaylist,
  getGetDailyPlaylistQueryKey, getListSongsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayer } from "@/hooks/use-player";
import { getUserId } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Radio, Play, Plus, Music2, Archive, X, PlayCircle, BookmarkPlus, Check, ListPlus } from "lucide-react";
import { decodeHtmlEntities } from "@/lib/utils";

type Tab = "today" | "archive";

export default function DailyPage() {
  const [tab, setTab] = useState<Tab>("today");
  const [showSubmit, setShowSubmit] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const userId = getUserId();
  const { playSong, playAll } = usePlayer();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [playlistPickerFor, setPlaylistPickerFor] = useState<number | null>(null);

  const { data: daily, isLoading: dailyLoading } = useGetDailyPlaylist();
  const { data: archive, isLoading: archiveLoading } = useGetDailyArchive({ limit: 50 }, {
    query: { enabled: tab === "archive", queryKey: ["getDailyArchive"] },
  });
  const { data: mySongs } = useListSongs();
  const { data: users } = useListUsers();
  const { data: playlists } = useListPlaylists({ userId });
  const submitMutation = useSubmitToDaily();
  const addToPlaylistMutation = useAddSongToPlaylist();

  const userMap = new Map((users ?? []).map((u) => [u.userId, u.displayName]));
  const userSongs = (mySongs ?? []).filter((s) => s.userId === userId);
  const alreadySubmitted = (daily ?? []).some((e) => e.userId === userId);

  const archiveByDate: Record<string, typeof archive> = {};
  (archive ?? []).forEach((e) => {
    if (!archiveByDate[e.date]) archiveByDate[e.date] = [];
    archiveByDate[e.date]!.push(e);
  });

  function handleSubmit() {
    if (!selectedSongId) return;
    submitMutation.mutate(
      { data: { songId: selectedSongId, userId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDailyPlaylistQueryKey() });
          setShowSubmit(false);
          setSelectedSongId(null);
          toast({ title: "Submitted to Daily Playlist!" });
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error;
          toast({ title: msg ?? "Failed", variant: "destructive" });
        },
      }
    );
  }

  function handlePlayAll() {
    const songs = (daily ?? []).map((e) => e.song).filter(Boolean) as NonNullable<typeof daily>[number]["song"][];
    if (songs.length === 0) return;
    playAll(songs as Parameters<typeof playAll>[0]);
     toast({ title: `Playing today's playlist (${songs.length === 1 ? "1 song" : `${songs.length} songs`})` });
  }

  async function handleSaveToLibrary(songId: number, title: string) {
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

  function handleAddToPlaylist(playlistId: number, songId: number) {
    addToPlaylistMutation.mutate(
      { id: playlistId, data: { songId } },
      {
        onSuccess: () => {
          toast({ title: "Added to playlist" });
          setPlaylistPickerFor(null);
        },
        onError: () => toast({ title: "Failed to add to playlist", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold font-serif mb-1">Daily Playlist</h1>
          <p className="text-muted-foreground">Community curated — resets at midnight</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {daily && daily.length > 0 && tab === "today" && (
            <button
              data-testid="button-play-all-daily"
              onClick={handlePlayAll}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <PlayCircle className="w-4 h-4" /> Play All
            </button>
          )}
          {!alreadySubmitted && (
            <button
              data-testid="button-submit-daily"
              onClick={() => setShowSubmit(!showSubmit)}
              className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
            >
              <Plus className="w-4 h-4" /> Submit Song
            </button>
          )}
        </div>
      </div>

      {alreadySubmitted && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 text-sm text-primary">
          You have submitted your song for today. Come back tomorrow!
        </div>
      )}

      {showSubmit && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Choose one song for today</p>
            <button onClick={() => setShowSubmit(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
           <div className="max-h-48 overflow-y-auto space-y-1">
            {userSongs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No songs in your library yet</p>
            ) : (
              userSongs.map((song) => (
                <button
                  key={song.id}
                  data-testid={`select-daily-song-${song.id}`}
                  onClick={() => setSelectedSongId(song.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${selectedSongId === song.id ? "bg-primary/20 border border-primary" : "hover:bg-muted"}`}
                >
                   {song.coverUrl ? (
                     <img src={song.coverUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                   ) : (
                     <div className="w-10 h-10 bg-muted rounded flex items-center justify-center shrink-0">
                       <Music2 className="w-4 h-4 text-muted-foreground" />
                     </div>
                   )}
                  <div className="min-w-0">
                     <p className="text-sm font-medium truncate">{decodeHtmlEntities(song.title)}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                  </div>
                </button>
              ))
            )}
          </div>
          <button
            data-testid="button-confirm-submit-daily"
            onClick={handleSubmit}
            disabled={!selectedSongId || submitMutation.isPending}
            className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button
          data-testid="tab-daily-today"
          onClick={() => setTab("today")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "today" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Radio className="w-4 h-4" /> Today
        </button>
        <button
          data-testid="tab-daily-archive"
          onClick={() => setTab("archive")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "archive" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Archive className="w-4 h-4" /> Archive
        </button>
      </div>

      {tab === "today" ? (
        dailyLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl h-20 animate-pulse" />
            ))}
          </div>
        ) : !daily || daily.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nothing submitted yet today</p>
            <p className="text-sm mt-1">Be the first to submit a song!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {daily.map((entry) => {
              const submitterName = userMap.get(entry.userId) ?? entry.userId.slice(0, 8) + "…";
              const isMe = entry.userId === userId;
              const isPublic = entry.song?.storageType === "public_limited" || entry.song?.storageType === "public_download";
              const alreadySaved = savedIds.has(entry.id) || entry.song?.userId === userId;
              return (
                <div
                  key={entry.id}
                  data-testid={`daily-song-${entry.id}`}
                   className="w-full bg-card border border-border rounded-xl p-3 sm:p-4 flex flex-wrap items-center gap-3 hover:border-primary/40 transition-colors min-w-0"
                >
                  {entry.song?.coverUrl ? (
                    <img src={entry.song.coverUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center shrink-0">
                      <Music2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                     <p className="font-semibold truncate">{decodeHtmlEntities(entry.song?.title)}</p>
                    <p className="text-sm text-muted-foreground truncate">{entry.song?.artist}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      by{" "}
                      <span className={isMe ? "text-primary font-medium" : ""}>
                        {isMe ? "you" : submitterName}
                      </span>
                    </p>
                  </div>
                   <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => entry.song && playSong(entry.song)}
                      className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                      title="Play"
                    >
                      <Play className="w-4 h-4" />
                    </button>

                    {isPublic && !alreadySaved ? (
                      <button
                        onClick={() => entry.song && handleSaveToLibrary(entry.song.id, entry.song.title)}
                        disabled={entry.song ? savingId === entry.song.id : false}
                        className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
                        title="Save to Library"
                      >
                        <BookmarkPlus className="w-4 h-4" />
                      </button>
                    ) : alreadySaved ? (
                      <span className="p-2 text-primary" title="In your library"><Check className="w-4 h-4" /></span>
                    ) : null}

                    <div className="relative">
                      <button
                        onClick={() => entry.song && setPlaylistPickerFor(playlistPickerFor === entry.song.id ? null : entry.song.id)}
                        className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                        title="Add to Playlist"
                      >
                        <ListPlus className="w-4 h-4" />
                      </button>
                      {entry.song && playlistPickerFor === entry.song.id && (
                        <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-xl min-w-[180px] p-1">
                          {!playlists || playlists.length === 0 ? (
                            <p className="text-xs text-muted-foreground px-3 py-2">No playlists yet</p>
                          ) : (
                            playlists.map((pl) => (
                              <button
                                key={pl.id}
                                onClick={() => entry.song && handleAddToPlaylist(pl.id, entry.song.id)}
                                className="w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-muted transition-colors truncate"
                              >
                                {pl.name}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        archiveLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl h-16 animate-pulse" />
            ))}
          </div>
        ) : Object.keys(archiveByDate).length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No archive yet</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(archiveByDate).sort(([a], [b]) => b.localeCompare(a)).map(([date, entries]) => (
              <div key={date}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">{date}</h3>
                <div className="space-y-1">
                  {(entries ?? []).map((entry) => (
                    <button
                      key={entry.id}
                      data-testid={`archive-song-${entry.id}`}
                      onClick={() => entry.song && playSong(entry.song)}
                      className="w-full bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-primary/30 transition-colors text-left"
                    >
                      <Music2 className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.song?.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{entry.song?.artist}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
