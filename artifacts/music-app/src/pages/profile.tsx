import { useState, useEffect } from "react";
import { useGetUser, useRegisterUser, useGetUserInbox, getGetUserQueryKey, getGetUserInboxQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getUserId } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { usePlayer } from "@/hooks/use-player";
import { UserCircle, Star, Music2, Award, Inbox, Play, Edit2, Check } from "lucide-react";

const BADGE_COLORS: Record<string, string> = {
  Lyricist: "bg-purple-500/20 text-purple-400",
  "Music Guru": "bg-amber-500/20 text-amber-400",
  Nominator: "bg-blue-500/20 text-blue-400",
};

export default function ProfilePage() {
  const [tab, setTab] = useState<"profile" | "inbox">("profile");
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const userId = getUserId();
  const { playSong } = usePlayer();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, isError } = useGetUser(userId);
  const { data: inbox } = useGetUserInbox(userId, {
    query: { enabled: tab === "inbox", queryKey: ["getUserInbox", userId] },
  });

  const registerMutation = useRegisterUser();

  useEffect(() => {
    if (isLoading) return;
    if (isError && !registerMutation.isPending && !registerMutation.isSuccess) {
      const name = `User_${userId.slice(0, 6)}`;
      registerMutation.mutate(
        { userId, data: { displayName: name } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
          },
        }
      );
    } else if (profile) {
      setDisplayName(profile.displayName);
    }
  }, [isLoading, isError, profile]);

  function handleSaveName() {
    if (!displayName.trim()) return;
    registerMutation.mutate(
      { userId, data: { displayName: displayName.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
          setEditing(false);
          toast({ title: "Name updated" });
        },
      }
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-bold font-serif mb-1">Profile</h1>
        <p className="text-muted-foreground">Your identity and activity</p>
      </div>

      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-6 animate-pulse h-48" />
      ) : profile ? (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          {/* Avatar & name */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <UserCircle className="w-10 h-10 text-primary" />
            </div>
            <div className="flex-1">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    data-testid="input-display-name"
                    autoFocus
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    data-testid="button-save-name"
                    onClick={handleSaveName}
                    className="p-1.5 bg-primary text-primary-foreground rounded-lg"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{profile.displayName}</h2>
                  <button
                    data-testid="button-edit-name"
                    onClick={() => setEditing(true)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">ID: {userId.slice(0, 12)}...</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-primary">{profile.reputation}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Reputation</p>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{profile.nominatedCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Nominated</p>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{profile.uploadCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Uploads</p>
            </div>
          </div>

          {/* Badges */}
          {(profile.badges ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Badges</p>
              <div className="flex flex-wrap gap-2">
                {(profile.badges ?? []).map((badge) => (
                  <span
                    key={badge}
                    data-testid={`badge-${badge}`}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${BADGE_COLORS[badge] ?? "bg-muted text-muted-foreground"}`}
                  >
                    <Award className="w-3 h-3" /> {badge}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(profile.badges ?? []).length === 0 && (
            <div className="border border-dashed border-border rounded-lg p-4 text-center text-sm text-muted-foreground">
              <Star className="w-6 h-6 mx-auto mb-1 opacity-40" />
              Earn badges by nominating songs and contributing to the community
            </div>
          )}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button
          data-testid="tab-profile"
          onClick={() => setTab("profile")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "profile" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Music2 className="w-4 h-4" /> Activity
        </button>
        <button
          data-testid="tab-inbox"
          onClick={() => setTab("inbox")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "inbox" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Inbox className="w-4 h-4" /> Inbox
        </button>
      </div>

      {tab === "inbox" && (
        <div className="space-y-2">
          {!inbox || inbox.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Inbox className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No gifts yet</p>
            </div>
          ) : (
            inbox.map((item) => (
              <div
                key={item.id}
                data-testid={`inbox-item-${item.id}`}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
              >
                {item.song?.coverUrl ? (
                  <img src={item.song.coverUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center shrink-0">
                    <Music2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{item.song?.title}</p>
                  <p className="text-xs text-muted-foreground">from {item.fromUserName ?? item.fromUserId.slice(0, 8) + "..."}</p>
                  {item.message && <p className="text-xs text-muted-foreground italic mt-0.5">"{item.message}"</p>}
                </div>
                {item.song && (
                  <button
                    data-testid={`button-play-inbox-${item.id}`}
                    onClick={() => playSong(item.song!)}
                    className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors shrink-0"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
