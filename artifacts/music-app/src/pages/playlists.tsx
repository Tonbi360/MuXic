import { useState } from "react";
import { useListPlaylists, useCreatePlaylist, useDeletePlaylist, useGetPlaylist, getListPlaylistsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayer } from "@/hooks/use-player";
import { getUserId } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ListMusic, Plus, Trash2, Play, ChevronRight, Music2, X } from "lucide-react";

export default function PlaylistsPage() {
  const userId = getUserId();
  const { playSong } = usePlayer();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: playlists, isLoading } = useListPlaylists({ userId });
  const { data: selected } = useGetPlaylist(selectedId!, {
    query: { enabled: !!selectedId, queryKey: ["getPlaylist", selectedId] },
  });
  const createMutation = useCreatePlaylist();
  const deleteMutation = useDeletePlaylist();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate(
      { data: { name: newName.trim(), userId, isPublic: false } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey({ userId }) });
          setNewName("");
          setShowCreate(false);
          toast({ title: "Playlist created" });
        },
      }
    );
  }

  function handleDelete(id: number, name: string) {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlaylistsQueryKey({ userId }) });
        if (selectedId === id) setSelectedId(null);
        toast({ title: "Deleted", description: `"${name}" removed` });
      },
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold font-serif mb-1">Playlists</h1>
          <p className="text-muted-foreground">Organize your music</p>
        </div>
        <button
          data-testid="button-new-playlist"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> New Playlist
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-4 flex gap-3">
          <input
            data-testid="input-playlist-name"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Playlist name..."
            className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            data-testid="button-create-playlist"
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Create
          </button>
          <button type="button" onClick={() => setShowCreate(false)} className="p-2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Playlist list */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl h-16 animate-pulse" />
            ))
          ) : !playlists || playlists.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ListMusic className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No playlists yet. Create one!</p>
            </div>
          ) : (
            playlists.map((pl) => (
              <button
                key={pl.id}
                data-testid={`playlist-card-${pl.id}`}
                onClick={() => setSelectedId(selectedId === pl.id ? null : pl.id)}
                className={`w-full bg-card border rounded-xl p-4 flex items-center gap-3 text-left transition-colors hover:border-primary/40 ${selectedId === pl.id ? "border-primary" : "border-border"}`}
              >
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
                  <ListMusic className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{pl.name}</p>
                  <p className="text-xs text-muted-foreground">{pl.songCount} songs</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    data-testid={`button-delete-playlist-${pl.id}`}
                    onClick={(e) => { e.stopPropagation(); handleDelete(pl.id, pl.name); }}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${selectedId === pl.id ? "rotate-90" : ""}`} />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Selected playlist songs */}
        {selectedId && (
          <div className="space-y-2">
            <h2 className="font-bold text-lg font-serif">{selected?.name}</h2>
            {!selected?.songs || selected.songs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Music2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No songs yet. Add songs from your library.</p>
              </div>
            ) : (
              selected.songs.map((song) => (
                <div
                  key={song.id}
                  data-testid={`playlist-song-${song.id}`}
                  className="bg-card border border-border rounded-lg p-3 flex items-center gap-3"
                >
                  {song.coverUrl ? (
                    <img src={song.coverUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-muted rounded flex items-center justify-center shrink-0">
                      <Music2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                  </div>
                  <button
                    data-testid={`button-play-playlist-song-${song.id}`}
                    onClick={() => playSong(song)}
                    className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
