import { useState, useEffect } from "react";
import {
  useListForumMessages,
  useCreateForumMessage,
  useGetForumReplies,
  getListForumMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getUserId } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CornerDownRight } from "lucide-react";
import type { ForumMessage } from "@workspace/api-client-react";

const MOOD_TAGS = ["#Sad", "#Gym", "#Study", "#Chilled", "#Dance", "#Hype", "#Late Night"];
const COOLDOWN_MS = 30000;

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

function ReplyThread({ postId, currentUserId }: { postId: number; currentUserId: string }) {
  const [replyContent, setReplyContent] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: replies, isLoading } = useGetForumReplies(postId);
  const createMutation = useCreateForumMessage();

  function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyContent.trim()) return;
    createMutation.mutate(
      { data: { userId: currentUserId, content: replyContent.trim(), parentId: postId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["getForumReplies", postId] });
          setReplyContent("");
          toast({ title: "Reply posted!" });
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error;
          toast({ title: msg ?? "Failed to reply", variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="mt-3 pl-4 border-l-2 border-border space-y-2">
      {isLoading ? (
        <div className="h-10 bg-muted rounded-lg animate-pulse" />
      ) : (replies ?? []).map((reply: ForumMessage) => (
        <div key={reply.id} className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground">
              <CornerDownRight className="inline w-3 h-3 mr-1" />
              {reply.userName ?? reply.userId.slice(0, 8) + "..."}
              {reply.userId === currentUserId && <span className="ml-1 text-primary">(you)</span>}
            </span>
            <span className="text-xs text-muted-foreground">{formatTime(reply.createdAt)}</span>
          </div>
          <p className="text-sm leading-relaxed">{reply.content}</p>
        </div>
      ))}

      <form onSubmit={handleReply} className="flex gap-2 mt-2">
        <input
          type="text"
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          placeholder="Write a reply..."
          className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={!replyContent.trim() || createMutation.isPending}
          className="p-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}

export default function ForumPage() {
  const [moodFilter, setMoodFilter] = useState("");
  const [page, setPage] = useState(1);
  const [content, setContent] = useState("");
  const [selectedMood, setSelectedMood] = useState("");
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [expandedPost, setExpandedPost] = useState<number | null>(null);
  const userId = getUserId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListForumMessages({
    moodTag: moodFilter || undefined,
    page,
    limit: 20,
  });

  const createMutation = useCreateForumMessage();

  // Cooldown timer
  useEffect(() => {
    const lastPost = localStorage.getItem("muxic_lastForumPost");
    if (!lastPost) return undefined;
    const elapsed = Date.now() - parseInt(lastPost, 10);
    if (elapsed < COOLDOWN_MS) {
      setCooldownLeft(Math.ceil((COOLDOWN_MS - elapsed) / 1000));
      const interval = setInterval(() => {
        const remaining = COOLDOWN_MS - (Date.now() - parseInt(lastPost, 10));
        if (remaining <= 0) {
          setCooldownLeft(0);
          clearInterval(interval);
        } else {
          setCooldownLeft(Math.ceil(remaining / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, []);

  function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || cooldownLeft > 0) return;

    createMutation.mutate(
      { data: { userId, content: content.trim(), moodTag: selectedMood || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListForumMessagesQueryKey({ moodTag: moodFilter || undefined, page, limit: 20 }) });
          setContent("");
          setSelectedMood("");
          localStorage.setItem("muxic_lastForumPost", String(Date.now()));
          setCooldownLeft(Math.ceil(COOLDOWN_MS / 1000));
          toast({ title: "Posted!" });
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error;
          toast({ title: msg ?? "Failed to post", variant: "destructive" });
        },
      }
    );
  }

  function toggleReplies(postId: number) {
    setExpandedPost(expandedPost === postId ? null : postId);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-bold font-serif mb-1">Recommendation Board</h1>
        <p className="text-muted-foreground">Ask for songs. Share discoveries. The human algorithm.</p>
      </div>

      {/* Post form */}
      <form onSubmit={handlePost} className="bg-card border border-border rounded-xl p-4 space-y-3">
        <textarea
          data-testid="input-forum-message"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Ask for a song recommendation or share one..."
          rows={3}
          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="flex items-center gap-2 flex-wrap">
          {MOOD_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              data-testid={`tag-${tag}`}
              onClick={() => setSelectedMood(selectedMood === tag ? "" : tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selectedMood === tag ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {tag}
            </button>
          ))}
          <button
            data-testid="button-post-forum"
            type="submit"
            disabled={!content.trim() || cooldownLeft > 0 || createMutation.isPending}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            <Send className="w-4 h-4" />
            {cooldownLeft > 0 ? `Wait ${cooldownLeft}s` : "Post"}
          </button>
        </div>
      </form>

      {/* Mood filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          data-testid="filter-all"
          onClick={() => { setMoodFilter(""); setPage(1); }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!moodFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          All
        </button>
        {MOOD_TAGS.map((tag) => (
          <button
            key={tag}
            data-testid={`filter-${tag}`}
            onClick={() => { setMoodFilter(moodFilter === tag ? "" : tag); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${moodFilter === tag ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Messages */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : !data?.messages || data.messages.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No messages yet</p>
          <p className="text-sm mt-1">Start the conversation — ask for a recommendation!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.messages.map((msg) => (
            <div
              key={msg.id}
              data-testid={`forum-message-${msg.id}`}
              className={`bg-card border rounded-xl p-4 ${msg.userId === userId ? "border-primary/30" : "border-border"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {msg.userName ?? msg.userId.slice(0, 8) + "..."}
                    {msg.userId === userId && <span className="ml-1 text-primary">(you)</span>}
                  </span>
                  {msg.moodTag && (
                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">
                      {msg.moodTag}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatTime(msg.createdAt)}</span>
              </div>
              <p className="text-sm leading-relaxed">{msg.content}</p>

              {/* Reply toggle */}
              <button
                onClick={() => toggleReplies(msg.id)}
                className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expandedPost === msg.id ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                <MessageSquare className="w-3 h-3" />
                {msg.replyCount > 0
                  ? `${msg.replyCount} ${msg.replyCount === 1 ? "reply" : "replies"}`
                  : "Reply"}
              </button>

              {expandedPost === msg.id && (
                <ReplyThread postId={msg.id} currentUserId={userId} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            data-testid="button-prev-page"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 bg-card border border-border rounded-lg disabled:opacity-40 hover:border-primary/40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </span>
          <button
            data-testid="button-next-page"
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="p-2 bg-card border border-border rounded-lg disabled:opacity-40 hover:border-primary/40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
