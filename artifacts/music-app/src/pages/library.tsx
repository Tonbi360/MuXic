import { useState } from "react";
import { useListSongs, useDeleteSong, usePromoteSong, useListUsers, useShareSong, getListSongsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayer } from "@/hooks/use-player";
import { getUserId } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Music2, Play, Trash2, ArrowUp, Clock, Search, Share2, X, Send, ListPlus } from "lucide-react";
import type { Song } from "@workspace/api-client-react";
import { decodeHtmlEntities, isSongExpired } from "@/lib/utils";

const STORAGE_LABELS: Record<string, string> = {
  limited: "Borrowed · 48h",
  permanent: "Saved forever",
  public_limited: "Shared",
  public_download: "Downloadable",
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
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to share";
          toast({ title: msg, variant: "destructive" });
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
  const [storageFilter, setStorageFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sharingSong, setSharingSong] = useState<Song | null>(null);
  const userId = getUserId();
  const { playSong, playAll } = usePlayer();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: songs, isLoading } = useListSongs(
    { search: search || undefined, storageType: storageFilter === "all" ? undefined : storageFilter },
  );

  const deleteMutation = useDeleteSong();
  const promoteMutation = usePromoteSong();

  const userSongs = (songs ?? []).filter((s) => s.userId === userId);

  // Collect all unique tags from user's library
  const allTags = Array.from(new Set(userSongs.flatMap((s) => s.tags ?? []))).sort();

  const filteredSongs = activeTag
    ? userSongs.filter((s) => (s.tags ?? []).includes(activeTag))
    : userSongs;

  const sortedSongs = [...filteredSongs].sort((a, b) => {
    if (sort === "date_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === "date_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "artist") return a.artist.localeCompare(b.artist);
    return 0;
  });

  function handleDelete(song: Song) {
    deleteMutation.mutate({ id: song.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
        toast({ title: "Deleted", description: `"${song.title}" removed` });
      },
      onError: (err: unknown) => {
        const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to delete";
        toast({ title: msg, variant: "destructive" });
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

  function handlePlay(song: Song) {
    if (isSongExpired(song)) {
      toast({ title: "Song expired", description: "Keep this song permanently before playing it.", variant: "destructive" });
      return;
    }
    playSong(song);
  }

  function handlePlayAll() {
    const playable = sortedSongs.filter((song) => !isSongExpired(song));
    const skipped = sortedSongs.length - playable.length;
    if (playable.length === 0) {
      toast({ title: "Nothing playable", description: `No playable songs (${skipped} expired).` });
      return;
    }
    playAll(playable);
    if (skipped > 0) toast({ title: `Skipped ${skipped} expired song${skipped === 1 ? "" : "s"}.` });
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {sharingSong && (
        <ShareModal song={sharingSong} fromUserId={userId} onClose={() => setSharingSong(null)} />
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold font-serif mb-1">Library</h1>
          <p className="text-muted-foreground">Your saved songs</p>
        </div>
        {sortedSongs.length > 0 && (
          <button
            onClick={handlePlayAll}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
          >
            <ListPlus className="w-4 h-4" /> Play All
          </button>
        )}
      </div>

      {/* Filters */}
       <div className="flex flex-wrap gap-3 items-center">
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
        <Select value={storageFilter} onValueChange={setStorageFilter}>
          <SelectTrigger data-testid="select-storage-filter" className="w-[160px] bg-card border-border h-[42px] text-sm">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="limited">Limited</SelectItem>
            <SelectItem value="permanent">Permanent</SelectItem>
            <SelectItem value="public_limited">Public Limited</SelectItem>
            <SelectItem value="public_download">Public Download</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger data-testid="select-sort" className="w-[160px] bg-card border-border h-[42px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Newest first</SelectItem>
            <SelectItem value="date_asc">Oldest first</SelectItem>
            <SelectItem value="title">Title A–Z</SelectItem>
            <SelectItem value="artist">Artist A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tag chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTag(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeTag === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeTag === tag
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

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
               className={`bg-card border border-border rounded-xl p-3 sm:p-4 flex flex-wrap items-center gap-3 hover:border-primary/30 transition-colors min-w-0 ${isSongExpired(song) ? "opacity-60" : ""}`}
            >
              {song.coverUrl ? (
                <img src={song.coverUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center shrink-0">
                  <Music2 className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1 overflow-hidden">
             <p className="font-semibold truncate">{decodeHtmlEntities(song.title)}</p>
                <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
             <div className="flex items-center gap-2 mt-1 flex-wrap min-w-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STORAGE_COLORS[song.storageType] ?? "text-muted-foreground bg-muted"}`}>
                    {STORAGE_LABELS[song.storageType] ?? song.storageType}
                  </span>
                  <CountdownTimer expiresAt={song.expiresAt ?? null} />
                </div>
              </div>
               <div className="flex gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                <button
                  data-testid={`button-play-song-${song.id}`}
                   onClick={() => handlePlay(song)}
                   disabled={isSongExpired(song)}
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
                   title="Save permanently"
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
