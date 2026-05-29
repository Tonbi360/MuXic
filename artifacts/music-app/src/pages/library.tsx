import { useState } from "react";
import { useListSongs, useDeleteSong, usePromoteSong, useListUsers, useShareSong, getListSongsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayer } from "@/hooks/use-player";
import { getUserId } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Music2, Play, Trash2, ArrowUp, Clock, Search, Share2, X, Send } from "lucide-react";
import type { Song } from "@workspace/api-client-react";

const STORAGE_LABELS: Record<string, string> = {
  limited: "Limited",
  permanent: "Permanent",
  public_limited: "Public Limited",
  public_download: "Public Download",
};

const STORAGE_COLORS: Record<string, string> = {
  limited: "text-amber-400 bg-amber-400/10",
  permanent: "text-emerald-400 bg-emerald-400/10",
  public_limited: "text-blue-400 bg-blue-400/10",
  public_download: "text-primary bg-primary/10",
};

function CountdownTimer({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return <span className="text-xs text-destructive">Expired</span>;
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return (
    <span className="flex items-center gap-1 text-xs text-amber-400">
      <Clock className="w-3 h-3" /> {hours}h {mins}m left
    </span>
  );
}

function ShareModal({
  song,
  fromUserId,
  onClose,
}: {
  song: Song;
  fromUserId: string;
  onClose: () => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const { data: users } = useListUsers();
  const shareMutation = useShareSong();

  const otherUsers = (users ?? []).filter((u) => u.userId !== fromUserId);

  function handleSend() {
    if (!selectedUserId) return;
    shareMutation.mutate(
      { data: { fromUserId, toUserId: selectedUserId, songId: song.id, message: message || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Sent!", description: `"${song.title}" shared to their inbox` });
          onClose();
        },
        onError: () => {
          toast({ title: "Failed to share", variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Share song</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          {song.coverUrl ? (
            <img src={song.coverUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 bg-muted-foreground/20 rounded flex items-center justify-center shrink-0">
              <Music2 className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{song.title}</p>
            <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Send to</p>
          {otherUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No other users registered yet</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {otherUsers.map((u) => (
                <button
                  key={u.userId}
                  onClick={() => setSelectedUserId(u.userId)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left text-sm transition-colors ${
                    selectedUserId === u.userId
                      ? "bg-primary/20 border border-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                    {u.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate">{u.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a message (optional)"
          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />

        <button
          onClick={handleSend}
          disabled={!selectedUserId || shareMutation.isPending}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          <Send className="w-4 h-4" />
          Send to Inbox
        </button>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const [storageFilter, setStorageFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [sharingSong, setSharingSong] = useState<Song | null>(null);
  const userId = getUserId();
  const { playSong } = usePlayer();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: songs, isLoading } = useListSongs(
    { search: search || undefined, storageType: storageFilter || undefined },
  );

  const deleteMutation = useDeleteSong();
  const promoteMutation = usePromoteSong();

  const userSongs = (songs ?? []).filter((s) => s.userId === userId);

  const sortedSongs = [...userSongs].sort((a, b) => {
    if (sort === "date_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === "date_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "artist") return a.artist.localeCompare(b.artist);
    if (sort === "votes") return (b.voteCount ?? 0) - (a.voteCount ?? 0);
    return 0;
  });

  function handleDelete(song: Song) {
    deleteMutation.mutate({ id: song.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
        toast({ title: "Deleted", description: `"${song.title}" removed` });
      },
    });
  }

  function handlePromote(song: Song, target: "permanent" | "public_download") {
    promoteMutation.mutate({ id: song.id, data: { targetStorage: target } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
        toast({ title: "Promoted", description: `"${song.title}" is now ${target === "permanent" ? "permanent" : "publicly downloadable"}` });
      },
    });
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {sharingSong && (
        <ShareModal song={sharingSong} fromUserId={userId} onClose={() => setSharingSong(null)} />
      )}

      <div>
        <h1 className="text-4xl font-bold font-serif mb-1">Library</h1>
        <p className="text-muted-foreground">Your saved songs</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            data-testid="input-library-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your library..."
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <select
          data-testid="select-storage-filter"
          value={storageFilter}
          onChange={(e) => setStorageFilter(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">All types</option>
          <option value="limited">Limited</option>
          <option value="permanent">Permanent</option>
          <option value="public_limited">Public Limited</option>
          <option value="public_download">Public Download</option>
        </select>
        <select
          data-testid="select-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="title">Title A-Z</option>
          <option value="artist">Artist A-Z</option>
          <option value="votes">Most voted</option>
        </select>
      </div>

      {/* Songs */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : sortedSongs.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Music2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Your library is empty</p>
          <p className="text-sm mt-1">Search for songs and import them to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedSongs.map((song) => (
            <div
              key={song.id}
              data-testid={`song-card-${song.id}`}
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
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STORAGE_COLORS[song.storageType] ?? "text-muted-foreground bg-muted"}`}>
                    {STORAGE_LABELS[song.storageType] ?? song.storageType}
                  </span>
                  <CountdownTimer expiresAt={song.expiresAt ?? null} />
                  <span className="text-xs text-muted-foreground">{song.voteCount} votes</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  data-testid={`button-play-song-${song.id}`}
                  onClick={() => playSong(song)}
                  className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  title="Play"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button
                  data-testid={`button-share-${song.id}`}
                  onClick={() => setSharingSong(song)}
                  className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  title="Share to inbox"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                {(song.storageType === "limited" || song.storageType === "public_limited") && (
                  <button
                    data-testid={`button-promote-${song.id}`}
                    onClick={() => handlePromote(song, "permanent")}
                    disabled={promoteMutation.isPending}
                    className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    title="Make permanent"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                )}
                <button
                  data-testid={`button-delete-${song.id}`}
                  onClick={() => handleDelete(song)}
                  disabled={deleteMutation.isPending}
                  className="p-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
