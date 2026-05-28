import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { PlayerProvider, usePlayer } from "@/hooks/use-player";
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
import {
  Home, Search, ListMusic, Mic2,
  Calendar, MessageSquare, UserCircle,
  PlayCircle, Pause, SkipForward, Trophy, Radio
} from "lucide-react";

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
  { href: "/daily", icon: Radio, label: "Daily Mix" },
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

function Sidebar() {
  return (
    <div className="w-64 bg-card border-r border-border h-full flex-col hidden md:flex shrink-0">
      <div className="p-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <Mic2 className="w-4 h-4 text-white" />
        </div>
        <span className="font-serif font-bold tracking-tight text-xl text-primary">SoundBoard</span>
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
    </div>
  );
}

function MobileNav() {
  const [location] = useLocation();
  const mobileItems = [
    { href: "/", icon: Home },
    { href: "/search", icon: Search },
    { href: "/songboard", icon: Trophy },
    { href: "/daily", icon: Radio },
    { href: "/profile", icon: UserCircle },
  ];
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 z-40">
      {mobileItems.map(({ href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`p-2 flex flex-col items-center ${location === href ? "text-primary" : "text-muted-foreground"}`}
        >
          <Icon className="w-5 h-5" />
        </Link>
      ))}
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col relative overflow-hidden">
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
