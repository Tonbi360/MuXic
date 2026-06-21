import { useState } from "react";
import { useGetDailyPlaylist, useSubmitToDaily, useGetDailyArchive, useListSongs, useListUsers, getGetDailyPlaylistQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayer } from "@/hooks/use-player";
import { getUserId } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Radio, Play, Plus, Music2, Archive, X } from "lucide-react";

type Tab = "today" | "archive";

export default function DailyPage() {
  const [tab, setTab] = useState<Tab>("today");
  const [showSubmit, setShowSubmit] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const userId = getUserId();
  const { playSong } = usePlayer();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: daily, isLoading: dailyLoading } = useGetDailyPlaylist();
  const { data: archive, isLoading: archiveLoading } = useGetDailyArchive({ limit: 50 }, {
    query: { enabled: tab === "archive", queryKey: ["getDailyArchive"] },
  });
  const { data: mySongs } = useListSongs();
  const { data: users } = useListUsers();
  const submitMutation = useSubmitToDaily();

  const userMap = new Map((users ?? []).map((u) => [u.userId, u.displayName]));
  const userSongs = (mySongs ?? []).filter((s) => s.userId === userId);
  const alreadySubmitted = (daily ?? []).some((e) => e.userId === userId);

  // Group archive by date
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

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold font-serif mb-1">Daily Playlist</h1>
          <p className="text-muted-foreground">Community curated — resets at midnight</p>
        </div>
        {!alreadySubmitted && (
          <button
            data-testid="button-submit-daily"
            onClick={() => setShowSubmit(!showSubmit)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Submit Song
          </button>
        )}
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
                  <Music2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{song.title}</p>
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
              return (
                <button
                  key={entry.id}
                  data-testid={`daily-song-${entry.id}`}
                  onClick={() => entry.song && playSong(entry.song)}
                  className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/40 transition-colors text-left"
                >
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
                      by{" "}
                      <span className={isMe ? "text-primary font-medium" : ""}>
                        {isMe ? "you" : submitterName}
                      </span>
                    </p>
                  </div>
                  <Play className="w-5 h-5 text-muted-foreground shrink-0" />
                </button>
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
