import { useState } from "react";
import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { PlayerProvider, usePlayer } from "@/hooks/use-player";
import { setUserIdGetter } from "@workspace/api-client-react";
import { getUserId, clearUserId } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import HomePage from "@/pages/home";
import SearchPage from "@/pages/search";
import LibraryPage from "@/pages/library";
import PlaylistsPage from "@/pages/playlists";
import SongboardPage from "@/pages/songboard";
import QueuePage from "@/pages/queue";
import DailyPage from "@/pages/daily";
import ForumPage from "@/pages/forum";
import ProfilePage from "@/pages/profile";
import PlayerPage from "@/pages/player";
import PublicLibraryPage from "@/pages/public-library";
import {
  Home, Search, ListMusic, Mic2,
  MessageSquare, UserCircle,
  PlayCircle, Pause, SkipForward, Trophy, Radio,
  Menu, X, AlertTriangle, Trash2, Library,
} from "lucide-react";

// Wire up the user-id getter so every API call carries X-User-Id
setUserIdGetter(() => getUserId());

function MiniPlayer() {
  const { currentSong, isPlaying, togglePlay, next } = usePlayer();
  const [location] = useLocation();

  if (!currentSong || location === "/player") return null;

  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 md:left-64 right-0 h-16 bg-card border-t border-border flex items-center px-4 justify-between z-50 backdrop-blur-sm">
      <div className="flex items-center gap-3 w-1/3 truncate">
        {currentSong.coverUrl ? (
          <img src={currentSong.coverUrl} className="w-10 h-10 rounded-md object-cover shrink-0" alt="" />
        ) : (
          <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center shrink-0">
            <ListMusic className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        <div className="truncate">
          <Link href="/player" className="hover:underline text-sm font-semibold block truncate">
            {currentSong.title}
          </Link>
          <span className="text-xs text-muted-foreground truncate block">{currentSong.artist}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          data-testid="mini-player-play"
          onClick={togglePlay}
          className="p-2.5 bg-primary rounded-full text-primary-foreground hover:opacity-90 transition-opacity"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
        </button>
        <button
          data-testid="mini-player-next"
          onClick={next}
          className="p-2 text-muted-foreground hover:text-foreground"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>
      <div className="w-1/3 flex justify-end">
        <Link href="/player" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Full player
        </Link>
      </div>
    </div>
  );
}

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/library", icon: ListMusic, label: "Library" },
  { href: "/playlists", icon: ListMusic, label: "Playlists" },
];

const communityItems = [
  { href: "/songboard", icon: Trophy, label: "Song Board" },
  { href: "/queue", icon: ListMusic, label: "Shared Queue" },
  { href: "/daily", icon: Radio, label: "Daily Playlist" },
  { href: "/public-library", icon: Library, label: "Public Library" },
  { href: "/forum", icon: MessageSquare, label: "Forum" },
];

function NavLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  const [location] = useLocation();
  const active = location === href;
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" /> {label}
    </Link>
  );
}

function DeleteAccountSection() {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  async function handleDelete() {
    const userId = getUserId();
    setDeleting(true);
    try {
      await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: { "x-user-id": userId },
      });
      clearUserId();
      queryClient.clear();
      toast({ title: "Account deleted" });
      setLocation("/");
      window.location.reload();
    } catch {
      toast({ title: "Failed to delete account", variant: "destructive" });
      setDeleting(false);
    }
  }

  if (!confirm) {
    return (
      <button
        data-testid="button-delete-account"
        onClick={() => setConfirm(true)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" /> Delete Account
      </button>
    );
  }

  return (
    <div className="mx-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2">
      <p className="text-xs text-destructive font-medium">Permanently delete account?</p>
      <div className="flex gap-1.5">
        <button
          data-testid="button-confirm-delete-account"
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 py-1.5 bg-destructive text-destructive-foreground rounded-md text-xs font-medium disabled:opacity-50 hover:opacity-90"
        >
          {deleting ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="flex-1 py-1.5 bg-muted text-muted-foreground rounded-md text-xs font-medium hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FirstVisitBanner() {
  const [show, setShow] = useState(() => !localStorage.getItem("muxic_welcomed"));

  if (!show) return null;

  function dismiss() {
    localStorage.setItem("muxic_welcomed", "1");
    setShow(false);
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-start gap-3 shrink-0">
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <p className="flex-1 text-xs text-amber-300">
        <span className="font-semibold">Your identity lives in this browser only.</span>
        {" "}Clearing site data will permanently erase your library and reputation — there is no recovery.
      </p>
      <button
        onClick={dismiss}
        className="p-0.5 text-amber-400 hover:text-amber-200 shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function Sidebar() {
  return (
    <div className="w-64 bg-card border-r border-border h-full flex-col hidden md:flex shrink-0">
      <div className="p-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <Mic2 className="w-4 h-4 text-white" />
        </div>
        <span className="font-serif font-bold tracking-tight text-xl text-primary">MuXic</span>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
        <div className="pt-4 pb-1 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Community</div>
        {communityItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
        <div className="pt-4 pb-1 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">You</div>
        <NavLink href="/profile" icon={UserCircle} label="Profile" />
      </nav>
      <div className="border-t border-border py-3 shrink-0">
        <div className="px-3 pb-1 text-xs text-muted-foreground/60 font-semibold uppercase tracking-wider">
          Danger
        </div>
        <DeleteAccountSection />
      </div>
    </div>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60] md:hidden" onClick={onClose} />
      <div className="fixed top-0 left-0 bottom-0 w-[280px] bg-card border-r border-border z-[60] flex flex-col md:hidden">
        <div className="p-5 flex items-center justify-between border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <Mic2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-serif font-bold tracking-tight text-xl text-primary">MuXic</span>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto" onClick={onClose}>
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
          <div className="pt-4 pb-1 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Community</div>
          {communityItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
          <div className="pt-4 pb-1 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">You</div>
          <NavLink href="/profile" icon={UserCircle} label="Profile" />
        </nav>
        <div className="border-t border-border py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 pb-1 text-xs text-muted-foreground/60 font-semibold uppercase tracking-wider">
            Danger
          </div>
          <DeleteAccountSection />
        </div>
      </div>
    </>
  );
}

function MobileNav() {
  const [location] = useLocation();
  const mobileItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/search", icon: Search, label: "Search" },
    { href: "/songboard", icon: Trophy, label: "Board" },
    { href: "/forum", icon: MessageSquare, label: "Forum" },
    { href: "/profile", icon: UserCircle, label: "Profile" },
  ];
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-1 z-40">
      {mobileItems.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${location === href ? "text-primary" : "text-muted-foreground"}`}
        >
          <Icon className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">{label}</span>
        </Link>
      ))}
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden">
      <Sidebar />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Mobile header bar */}
        <div className="md:hidden flex items-center justify-between px-4 h-12 border-b border-border bg-card shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-serif font-bold text-primary tracking-tight">MuXic</span>
          <div className="w-7" />
        </div>
        <FirstVisitBanner />
        <main className="flex-1 overflow-y-auto pb-32 md:pb-20">
          {children}
        </main>
        <MiniPlayer />
        <MobileNav />
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PlayerProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Layout>
              <Switch>
                <Route path="/" component={HomePage} />
                <Route path="/search" component={SearchPage} />
                <Route path="/library" component={LibraryPage} />
                <Route path="/playlists" component={PlaylistsPage} />
                <Route path="/songboard" component={SongboardPage} />
                <Route path="/queue" component={QueuePage} />
                <Route path="/daily" component={DailyPage} />
                <Route path="/forum" component={ForumPage} />
                <Route path="/profile" component={ProfilePage} />
                <Route path="/player" component={PlayerPage} />
                <Route path="/public-library" component={PublicLibraryPage} />
                <Route component={NotFound} />
              </Switch>
            </Layout>
          </WouterRouter>
        </PlayerProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
