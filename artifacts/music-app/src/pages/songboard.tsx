import { useState } from "react";
import {
  useListSongBoard, useVoteSong, useNominateSong, useListUsers,
  useListPlaylists, useAddSongToPlaylist,
  getListSongBoardQueryKey, getListSongsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayer } from "@/hooks/use-player";
import { getUserId } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { decodeHtmlEntities, pluralize } from "@/lib/utils";
import { ThumbsUp, Music2, Play, Flame, Trophy, Radio, BookmarkPlus, ListPlus, PlayCircle, Check } from "lucide-react";

type Tab = "hot" | "legends" | "mini";

export default function SongboardPage() {
  const [tab, setTab] = useState<Tab>("hot");
  const userId = getUserId();
  const { playSong, playAll } = usePlayer();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [playlistPickerFor, setPlaylistPickerFor] = useState<number | null>(null);

  const { data: entries, isLoading } = useListSongBoard({ tab, limit: 30, userId });
  const { data: users } = useListUsers();
  const { data: playlists } = useListPlaylists({ userId });
  const voteMutation = useVoteSong();
  const addToPlaylistMutation = useAddSongToPlaylist();

  const userMap = new Map((users ?? []).map((u) => [u.userId, u.displayName]));

  function handleVote(songId: number) {
    voteMutation.mutate(
      { songId, data: { userId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSongBoardQueryKey({ tab }) });
           toast({ title: "Vote locked in ✓", description: "Votes are final." });
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error;
          toast({ title: msg === "Already voted" ? "Already voted" : "Vote failed", variant: "destructive" });
        },
      }
    );
  }

  async function handleSaveToLibrary(songId: number, title: string) {
    setSavingId(songId);
    try {
      const resp = await fetch(`/api/songs/${songId}/save`, {
        method: "POST",
        headers: { "x-user-id": userId },
      });
      const data = await resp.json() as { error?: string; id?: number };
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

  function handlePlayAll() {
     const songs = (entries ?? []).map((e) => e.song).filter(Boolean) as NonNullable<typeof entries>[number]["song"][];
     if (songs.length === 0) {
       toast({ title: "Nothing playable", description: "There are no playable songs on this board." });
       return;
     }
    playAll(songs as Parameters<typeof playAll>[0]);
    toast({ title: `Playing all ${songs.length} songs` });
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "hot", label: "Hot (24h)", icon: Flame },
    { id: "legends", label: "Legends", icon: Trophy },
    { id: "mini", label: "Discover", icon: Radio },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold font-serif mb-1">Song Board</h1>
          <p className="text-muted-foreground">Vote on the best tracks. Top songs get promoted.</p>
        </div>
        {entries && entries.length > 0 && (
          <button
            data-testid="button-play-all-board"
            onClick={handlePlayAll}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
          >
            <PlayCircle className="w-4 h-4" /> Play All
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            data-testid={`tab-board-${id}`}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "mini" && (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
          All newly imported songs land here. Vote to promote them to Hot or Legends.
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : !entries || entries.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ThumbsUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No songs on the board yet</p>
          <p className="text-sm mt-1">Import songs from Search and nominate them</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => {
             const nominatorName = userMap.get(entry.nominatedBy) ?? entry.nominatedBy.slice(0, 8) + "…";
            const isMe = entry.nominatedBy === userId;
            const isPublic = entry.song?.storageType === "public_limited" || entry.song?.storageType === "public_download";
            const alreadySaved = savedIds.has(entry.songId) || entry.song?.userId === userId;
            return (
              <div
                key={entry.id}
                data-testid={`board-entry-${entry.id}`}
                 className="bg-card border border-border rounded-xl p-3 sm:p-4 flex flex-wrap items-center gap-3 hover:border-primary/30 transition-colors min-w-0"
              >
                {tab !== "mini" && (
                  <span className="text-xl font-bold font-serif text-muted-foreground w-7 shrink-0 text-center">
                    {i + 1}
                  </span>
                )}
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
                     <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    nominated by{" "}
                    <span className={isMe ? "text-primary font-medium" : ""}>
                      {isMe ? "you" : nominatorName}
                    </span>
                  </p>
                </div>
                 <div className="flex items-center gap-1.5 shrink-0 relative w-full sm:w-auto sm:ml-auto justify-end">
                  <button
                    data-testid={`button-play-board-${entry.id}`}
                    onClick={() => entry.song && playSong(entry.song)}
                    className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                    title="Play"
                  >
                    <Play className="w-4 h-4" />
                  </button>

                  {/* Save to Library */}
                  {isPublic && !alreadySaved && (
                    <button
                      data-testid={`button-save-board-${entry.id}`}
                      onClick={() => entry.song && handleSaveToLibrary(entry.songId, entry.song.title)}
                      disabled={savingId === entry.songId}
                      className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
                      title="Save to Library"
                    >
                      <BookmarkPlus className="w-4 h-4" />
                    </button>
                  )}
                  {alreadySaved && (
                       <span className="inline-flex items-center gap-1 p-2 text-primary text-xs" title="Already in your library">
                       <Check className="w-4 h-4" /><span className="hidden sm:inline">Saved</span>
                    </span>
                  )}

                  {/* Add to Playlist */}
                  <div className="relative">
                    <button
                      data-testid={`button-playlist-board-${entry.id}`}
                      onClick={() => setPlaylistPickerFor(playlistPickerFor === entry.songId ? null : entry.songId)}
                      className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                      title="Add to Playlist"
                    >
                      <ListPlus className="w-4 h-4" />
                    </button>
                    {playlistPickerFor === entry.songId && (
                      <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-xl min-w-[180px] p-1">
                        {!playlists || playlists.length === 0 ? (
                          <p className="text-xs text-muted-foreground px-3 py-2">No playlists yet</p>
                        ) : (
                          playlists.map((pl) => (
                            <button
                              key={pl.id}
                              onClick={() => handleAddToPlaylist(pl.id, entry.songId)}
                              className="w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-muted transition-colors truncate"
                            >
                              {pl.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    data-testid={`button-vote-${entry.id}`}
                    onClick={() => handleVote(entry.songId)}
                    disabled={entry.userVoted || voteMutation.isPending}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      entry.userVoted
                        ? "bg-primary/20 text-primary cursor-default"
                        : "bg-primary text-primary-foreground hover:opacity-90"
                    } disabled:opacity-60`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                     <span>{entry.userVoted ? "Voted" : pluralize(entry.voteCount, "vote")}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
