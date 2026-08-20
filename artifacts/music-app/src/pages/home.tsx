import { useGetStats, useGetTrending, useGetDailyPlaylist, useGetQueue } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { decodeHtmlEntities, pluralize } from "@/lib/utils";
import { Music2, Users, ThumbsUp, Radio, ListMusic, MessageSquare } from "lucide-react";

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3" data-testid={`stat-card-${label}`}>
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-tight">{value.toLocaleString()}</p>
        <p className="text-[11px] text-muted-foreground leading-tight truncate">{label}</p>
      </div>
    </div>
  );
}

function SongRow({ rank, song, voteCount, onClick }: {
  rank?: number;
  song: { title: string; artist: string; coverUrl?: string | null };
  voteCount?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-primary/50 transition-colors text-left overflow-hidden"
    >
      {rank !== undefined && (
        <span className="text-xl font-bold font-serif text-muted-foreground w-6 shrink-0 text-center">
          {rank}
        </span>
      )}
      {song.coverUrl ? (
        <img src={song.coverUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
      ) : (
        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center shrink-0">
          <Music2 className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
         <p className="font-medium truncate text-sm">{decodeHtmlEntities(song.title)}</p>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
      </div>
      {voteCount !== undefined && (
         <span className="text-xs text-primary font-semibold shrink-0 ml-1">{pluralize(voteCount, "vote")}</span>
      )}
    </button>
  );
}

export default function HomePage() {
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: trending, isLoading: trendingLoading } = useGetTrending({ limit: 5 });
  const { data: daily, isLoading: dailyLoading } = useGetDailyPlaylist();
  const { data: queue } = useGetQueue();
  const { playSong } = usePlayer();

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-4xl font-bold font-serif mb-1">MuXic</h1>
        <p className="text-muted-foreground">Your community music station</p>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-16 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.totalSongs > 0 && <StatCard label="Songs" value={stats.totalSongs} icon={Music2} />}
          {stats.totalUsers > 0 && <StatCard label="Members" value={stats.totalUsers} icon={Users} />}
          {stats.totalVotes > 0 && <StatCard label="Votes" value={stats.totalVotes} icon={ThumbsUp} />}
          {stats.forumMessages > 0 && <StatCard label="Forum Posts" value={stats.forumMessages} icon={MessageSquare} />}
        </div>
      ) : null}

      {/* Trending */}
      <section>
        <h2 className="text-xl font-bold font-serif mb-3 flex items-center gap-2">
          <ThumbsUp className="w-5 h-5 text-primary" /> Trending Now
        </h2>
        {trendingLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg h-14 animate-pulse" />
            ))}
          </div>
        ) : trending && trending.length > 0 ? (
          <div className="space-y-2">
            {trending.map((entry, i) =>
              entry.song ? (
                <SongRow
                  key={entry.id}
                  rank={i + 1}
                  song={entry.song}
                  voteCount={entry.voteCount}
                  onClick={() => playSong(entry.song!)}
                />
              ) : null
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
            <ThumbsUp className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No trending songs yet. Vote on the Song Board!</p>
          </div>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily Playlist Preview */}
        <section>
          <h2 className="text-xl font-bold font-serif mb-3 flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" /> Today's Daily
          </h2>
          {dailyLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-lg h-14 animate-pulse" />
              ))}
            </div>
          ) : daily && daily.length > 0 ? (
            <div className="space-y-2">
              {daily.slice(0, 5).map((entry) =>
                entry.song ? (
                  <SongRow
                    key={entry.id}
                    song={entry.song}
                    onClick={() => playSong(entry.song!)}
                  />
                ) : null
              )}
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

        {/* Queue Status */}
        {queue && queue.length > 0 ? (
          <section>
            <h2 className="text-xl font-bold font-serif mb-3 flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-primary" /> Mixed Queue
              <span className="text-sm font-normal text-muted-foreground">({queue.length} up)</span>
            </h2>
            <div className="space-y-2">
              {queue.slice(0, 4).map((entry) =>
                entry.song ? (
                  <SongRow
                    key={entry.id}
                    song={entry.song}
                    onClick={() => playSong(entry.song!)}
                  />
                ) : null
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
