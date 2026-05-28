import { useGetStats, useGetTrending, useGetDailyPlaylist, useGetQueue } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { Music2, Users, ThumbsUp, Radio, ListMusic, MessageSquare } from "lucide-react";

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4" data-testid={`stat-card-${label}`}>
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: trending, isLoading: trendingLoading } = useGetTrending({ limit: 5 });
  const { data: daily, isLoading: dailyLoading } = useGetDailyPlaylist();
  const { data: queue } = useGetQueue();
  const { playSong } = usePlayer();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold font-serif mb-1">MuXic</h1>
        <p className="text-muted-foreground">Your community music station</p>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 h-20 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Songs" value={stats.totalSongs} icon={Music2} />
          <StatCard label="Community Members" value={stats.totalUsers} icon={Users} />
          <StatCard label="Votes Cast" value={stats.totalVotes} icon={ThumbsUp} />
          <StatCard label="Forum Messages" value={stats.forumMessages} icon={MessageSquare} />
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Trending */}
        <section>
          <h2 className="text-xl font-bold font-serif mb-4 flex items-center gap-2">
            <ThumbsUp className="w-5 h-5 text-primary" /> Trending Now
          </h2>
          {trendingLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-lg h-14 animate-pulse" />
              ))}
            </div>
          ) : trending && trending.length > 0 ? (
            <div className="space-y-2">
              {trending.map((entry, i) => (
                <button
                  key={entry.id}
                  data-testid={`trending-entry-${entry.id}`}
                  onClick={() => entry.song && playSong(entry.song)}
                  className="w-full bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-primary/50 transition-colors text-left"
                >
                  <span className="text-2xl font-bold font-serif text-muted-foreground w-8 shrink-0">
                    {i + 1}
                  </span>
                  {entry.song?.coverUrl ? (
                    <img src={entry.song.coverUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-muted rounded flex items-center justify-center shrink-0">
                      <Music2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{entry.song?.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{entry.song?.artist}</p>
                  </div>
                  <span className="text-xs text-primary font-semibold shrink-0">{entry.voteCount} votes</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              <ThumbsUp className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No trending songs yet. Vote on the Song Board!</p>
            </div>
          )}
        </section>

        {/* Daily Playlist Preview */}
        <section>
          <h2 className="text-xl font-bold font-serif mb-4 flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" /> Today's Daily
          </h2>
          {dailyLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-lg h-14 animate-pulse" />
              ))}
            </div>
          ) : daily && daily.length > 0 ? (
            <div className="space-y-2">
              {daily.slice(0, 5).map((entry) => (
                <button
                  key={entry.id}
                  data-testid={`daily-entry-${entry.id}`}
                  onClick={() => entry.song && playSong(entry.song)}
                  className="w-full bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-primary/50 transition-colors text-left"
                >
                  {entry.song?.coverUrl ? (
                    <img src={entry.song.coverUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-muted rounded flex items-center justify-center shrink-0">
                      <Music2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{entry.song?.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{entry.song?.artist}</p>
                  </div>
                </button>
              ))}
              {daily.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-1">+{daily.length - 5} more songs</p>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              <Radio className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No submissions yet today. Be the first!</p>
            </div>
          )}
        </section>
      </div>

      {/* Queue Status */}
      {queue && queue.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <ListMusic className="w-5 h-5 text-primary" />
            Mixed Queue — {queue.length} song{queue.length !== 1 ? "s" : ""} up
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {queue.slice(0, 6).map((entry) => (
              <button
                key={entry.id}
                data-testid={`queue-preview-${entry.id}`}
                onClick={() => entry.song && playSong(entry.song)}
                className="shrink-0 bg-muted rounded-lg p-3 flex items-center gap-2 hover:bg-muted/80 transition-colors"
              >
                <Music2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium whitespace-nowrap max-w-[120px] truncate">{entry.song?.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
