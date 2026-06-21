import { useState } from "react";
import { useGetQueue, useAddToQueue, useVetoQueueEntry, useRemoveFromQueue, useListSongs, useListUsers, getGetQueueQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayer } from "@/hooks/use-player";
import { getUserId } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ListMusic, Play, ThumbsDown, Plus, Music2, X, Zap } from "lucide-react";

export default function QueuePage() {
  const userId = getUserId();
  const { playSong } = usePlayer();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);

  const { data: queue, isLoading } = useGetQueue();
  const { data: mySongs } = useListSongs();
  const { data: users } = useListUsers();
  const addMutation = useAddToQueue();
  const vetoMutation = useVetoQueueEntry();
  const removeMutation = useRemoveFromQueue();

  const userMap = new Map((users ?? []).map((u) => [u.userId, u.displayName]));
  const userSongs = (mySongs ?? []).filter((s) => s.userId === userId);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const myTokensUsed = (queue ?? []).filter(
    (e) => e.userId === userId && new Date(e.createdAt) > oneHourAgo
  ).length;
  const tokensLeft = Math.max(0, 3 - myTokensUsed);

  const queuedSongIds = new Set((queue ?? []).map((e) => e.songId));

  function handleAdd() {
    if (!selectedSongId) return;
    addMutation.mutate(
      { data: { songId: selectedSongId, userId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() });
          setShowAdd(false);
          setSelectedSongId(null);
          toast({ title: "Added to queue" });
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error;
          toast({ title: msg ?? "Failed to add", variant: "destructive" });
        },
      }
    );
  }

  function handleVeto(id: number) {
    vetoMutation.mutate({ id, data: { userId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() });
        toast({ title: "Veto cast" });
      },
      onError: () => {
        toast({ title: "Already vetoed", variant: "destructive" });
      },
    });
  }

  function handlePlay(entry: NonNullable<typeof queue>[number]) {
    if (entry.song) {
      playSong(entry.song);
      removeMutation.mutate({ id: entry.id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() }),
      });
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold font-serif mb-1">Mixed Queue</h1>
          <p className="text-muted-foreground">Community jukebox — everyone contributes</p>
        </div>
        <button
          data-testid="button-add-to-queue"
          onClick={() => setShowAdd(!showAdd)}
          disabled={tokensLeft === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Song
        </button>
      </div>

      {/* Token meter */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
        <Zap className="w-5 h-5 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Your tokens this hour</p>
          <p className="text-xs text-muted-foreground">3 songs per hour per person</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-colors ${
                i < myTokensUsed
                  ? "bg-primary border-primary"
                  : "border-muted-foreground/40"
              }`}
            />
          ))}
        </div>
        <span className="text-sm font-semibold text-primary">{tokensLeft} left</span>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Pick a song from your library</p>
            <button onClick={() => setShowAdd(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="max-h-52 overflow-y-auto space-y-1">
            {userSongs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No songs in your library yet</p>
            ) : (
              userSongs.map((song) => {
                const alreadyQueued = queuedSongIds.has(song.id);
                return (
                  <button
                    key={song.id}
                    data-testid={`select-queue-song-${song.id}`}
                    onClick={() => !alreadyQueued && setSelectedSongId(song.id)}
                    disabled={alreadyQueued}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                      alreadyQueued
                        ? "opacity-40 cursor-not-allowed"
                        : selectedSongId === song.id
                        ? "bg-primary/20 border border-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    {song.coverUrl ? (
                      <img src={song.coverUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                    ) : (
                      <Music2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                    </div>
                    {alreadyQueued && (
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">in queue</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <button
            data-testid="button-confirm-add-queue"
            onClick={handleAdd}
            disabled={!selectedSongId || addMutation.isPending}
            className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Add to Queue
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : !queue || queue.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ListMusic className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Queue is empty</p>
          <p className="text-sm mt-1">Add a song and others will hear it next</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((entry, idx) => {
            const addedByName = userMap.get(entry.userId) ?? entry.userId.slice(0, 8) + "…";
            const isMe = entry.userId === userId;
            return (
              <div
                key={entry.id}
                data-testid={`queue-entry-${entry.id}`}
                className={`bg-card border rounded-xl p-4 flex items-center gap-4 ${
                  idx === 0 ? "border-primary/50 bg-primary/5" : "border-border"
                }`}
              >
                {idx === 0 ? (
                  <span className="text-xs font-bold text-primary uppercase tracking-wider w-6 shrink-0 text-center">▶</span>
                ) : (
                  <span className="text-lg font-bold font-serif text-muted-foreground w-6 shrink-0 text-center">
                    {idx + 1}
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
                  <p className="font-semibold truncate">{entry.song?.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{entry.song?.artist}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    added by{" "}
                    <span className={isMe ? "text-primary font-medium" : ""}>
                      {isMe ? "you" : addedByName}
                    </span>
                    {entry.vetoCount > 0 && (
                      <span className="ml-2 text-destructive">{entry.vetoCount}/3 vetos</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    data-testid={`button-play-queue-${entry.id}`}
                    onClick={() => handlePlay(entry)}
                    className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                    title="Play now"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    data-testid={`button-veto-${entry.id}`}
                    onClick={() => handleVeto(entry.id)}
                    disabled={vetoMutation.isPending}
                    className="p-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-colors disabled:opacity-50"
                    title="Veto (3 = removed)"
                  >
                    <ThumbsDown className="w-4 h-4" />
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
