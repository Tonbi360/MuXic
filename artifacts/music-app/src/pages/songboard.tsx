import { useState } from "react";
import { useListSongBoard, useVoteSong, useNominateSong, getListSongBoardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayer } from "@/hooks/use-player";
import { getUserId } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ThumbsUp, Music2, Play, Flame, Trophy, Radio } from "lucide-react";

type Tab = "hot" | "legends" | "mini";

export default function SongboardPage() {
  const [tab, setTab] = useState<Tab>("hot");
  const userId = getUserId();
  const { playSong } = usePlayer();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: entries, isLoading } = useListSongBoard({ tab, limit: 30 });
  const voteMutation = useVoteSong();

  function handleVote(songId: number) {
    voteMutation.mutate(
      { songId, data: { userId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSongBoardQueryKey({ tab }) });
          toast({ title: "Voted!" });
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error;
          toast({ title: msg === "Already voted" ? "Already voted" : "Vote failed", variant: "destructive" });
        },
      }
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "hot", label: "Hot (24h)", icon: Flame },
    { id: "legends", label: "Legends", icon: Trophy },
    { id: "mini", label: "Mini Board", icon: Radio },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-bold font-serif mb-1">Song Board</h1>
        <p className="text-muted-foreground">Vote on the best tracks. Top songs get promoted.</p>
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
          Every searched song appears here. Give it a vote to promote it to the main board.
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
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              data-testid={`board-entry-${entry.id}`}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors"
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
                <p className="font-semibold truncate">{entry.song?.title}</p>
                <p className="text-sm text-muted-foreground truncate">{entry.song?.artist}</p>
                <p className="text-xs text-muted-foreground mt-0.5">by {entry.nominatedBy.slice(0, 8)}...</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  data-testid={`button-play-board-${entry.id}`}
                  onClick={() => entry.song && playSong(entry.song)}
                  className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                >
                  <Play className="w-4 h-4" />
                </button>
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
                  <span>{entry.voteCount}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
