import { createContext, useContext, useState, useRef, useEffect, ReactNode } from "react";
import type { Song } from "@workspace/api-client-react";

export type RepeatMode = "off" | "one" | "all";

interface PlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  playSong: (song: Song) => void;
  togglePlay: () => void;
  seek: (value: number) => void;
  queue: Song[];
  addToQueue: (song: Song) => void;
  next: () => void;
  prev: () => void;
  volume: number;
  setVolume: (v: number) => void;
  shuffle: boolean;
  setShuffle: (v: boolean) => void;
  repeat: RepeatMode;
  setRepeat: (v: RepeatMode) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/[?&]v=([^&#\s]+)/);
  return m ? m[1] : null;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<Song[]>([]);
  const [volume, setVolumeState] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [ytReady, setYtReady] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep a ref to always-fresh state for use inside event listeners
  const liveRef = useRef({
    currentSong: null as Song | null,
    queue: [] as Song[],
    volume: 1,
    shuffle: false,
    repeat: "off" as RepeatMode,
    isPlaying: false,
  });
  liveRef.current = { currentSong, queue, volume, shuffle, repeat, isPlaying };

  // A stable ref to onSongEnded so event listeners always call the latest version
  const onSongEndedRef = useRef<() => void>(() => {});

  function stopProgress() {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }

  function playInternal(song: Song) {
    const vol = liveRef.current.volume;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    stopProgress();
    setProgress(0);
    setDuration(0);
    setCurrentSong(song);
    setIsPlaying(true);

    const ytId = song.source === "youtube" ? extractYouTubeId(song.sourceUrl) : null;

    if (ytId && ytPlayerRef.current) {
      ytPlayerRef.current.loadVideoById(ytId);
      ytPlayerRef.current.setVolume(vol * 100);
      progressIntervalRef.current = setInterval(() => {
        try {
          const t = ytPlayerRef.current?.getCurrentTime?.() ?? 0;
          const d = ytPlayerRef.current?.getDuration?.() ?? 0;
          setProgress(t);
          if (d > 0) setDuration(d);
        } catch {
          // YT player not ready yet
        }
      }, 500);
    } else if (song.sourceUrl) {
      if (audioRef.current) {
        audioRef.current.src = song.sourceUrl;
        audioRef.current.volume = vol;
        audioRef.current.play().catch(() => {});
      }
    }
  }

  function onSongEnded() {
    const { repeat, queue, currentSong, shuffle } = liveRef.current;
    if (repeat === "one" && currentSong) {
      playInternal(currentSong);
      return;
    }
    if (queue.length > 0) {
      const idx = shuffle ? Math.floor(Math.random() * queue.length) : 0;
      const next = queue[idx];
      setQueue((q) => q.filter((_, i) => i !== idx));
      playInternal(next);
      return;
    }
    if (repeat === "all" && currentSong) {
      playInternal(currentSong);
      return;
    }
    setIsPlaying(false);
    stopProgress();
  }

  // Keep the ref pointing to the latest version
  onSongEndedRef.current = onSongEnded;

  // Load YouTube IFrame API once
  useEffect(() => {
    if (window.YT?.Player) {
      setYtReady(true);
      return;
    }
    window.onYouTubeIframeAPIReady = () => setYtReady(true);
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  }, []);

  // Create YT player once API is ready
  useEffect(() => {
    if (!ytReady || ytPlayerRef.current) return;
    ytPlayerRef.current = new window.YT.Player("yt-player-container", {
      height: "1",
      width: "1",
      playerVars: { autoplay: 0, controls: 0, playsinline: 1 },
      events: {
        onStateChange: (e: any) => {
          const S = window.YT?.PlayerState;
          if (!S) return;
          if (e.data === S.PLAYING) setIsPlaying(true);
          else if (e.data === S.PAUSED) setIsPlaying(false);
          else if (e.data === S.ENDED) onSongEndedRef.current();
        },
      },
    });
  }, [ytReady]);

  // Setup HTML5 audio once
  useEffect(() => {
    if (audioRef.current) return;
    const audio = new Audio();
    audio.addEventListener("timeupdate", () => setProgress(audio.currentTime || 0));
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration || 0));
    audio.addEventListener("ended", () => onSongEndedRef.current());
    audioRef.current = audio;
  }, []);

  // Sync volume to whichever player is active
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (ytPlayerRef.current?.setVolume) ytPlayerRef.current.setVolume(volume * 100);
  }, [volume]);

  // Media Session API — registers with the OS so lock screen / notification controls work
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => {
      const { currentSong, isPlaying } = liveRef.current;
      if (!currentSong || isPlaying) return;
      const ytId = currentSong.source === "youtube" ? extractYouTubeId(currentSong.sourceUrl) : null;
      if (ytId && ytPlayerRef.current) ytPlayerRef.current.playVideo();
      else if (audioRef.current) { audioRef.current.play().catch(() => {}); setIsPlaying(true); }
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      const { currentSong, isPlaying } = liveRef.current;
      if (!currentSong || !isPlaying) return;
      const ytId = currentSong.source === "youtube" ? extractYouTubeId(currentSong.sourceUrl) : null;
      if (ytId && ytPlayerRef.current) ytPlayerRef.current.pauseVideo();
      else if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false); }
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => onSongEndedRef.current());
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      const song = liveRef.current.currentSong;
      const ytId = song?.source === "youtube" ? extractYouTubeId(song.sourceUrl) : null;
      if (ytId && ytPlayerRef.current) ytPlayerRef.current.seekTo(0, true);
      else if (audioRef.current) audioRef.current.currentTime = 0;
      setProgress(0);
    });
    return () => {
      (["play", "pause", "nexttrack", "previoustrack"] as MediaSessionAction[]).forEach((a) => {
        try { navigator.mediaSession.setActionHandler(a, null); } catch {}
      });
    };
  }, []);

  // Update OS media notification metadata when song changes
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!currentSong) { navigator.mediaSession.metadata = null; return; }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist,
      artwork: currentSong.coverUrl
        ? [{ src: currentSong.coverUrl, sizes: "512x512", type: "image/jpeg" }]
        : [],
    });
  }, [currentSong]);

  // Keep OS playback state in sync
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  const setVolume = (v: number) => setVolumeState(v);

  const playSong = (song: Song) => playInternal(song);

  const togglePlay = () => {
    const { currentSong, isPlaying } = liveRef.current;
    if (!currentSong) return;
    const ytId = currentSong.source === "youtube" ? extractYouTubeId(currentSong.sourceUrl) : null;
    if (ytId && ytPlayerRef.current) {
      if (isPlaying) ytPlayerRef.current.pauseVideo();
      else ytPlayerRef.current.playVideo();
    } else if (audioRef.current) {
      if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
      else { audioRef.current.play().catch(() => {}); setIsPlaying(true); }
    }
  };

  const seek = (value: number) => {
    const { currentSong } = liveRef.current;
    if (!currentSong) return;
    const ytId = currentSong.source === "youtube" ? extractYouTubeId(currentSong.sourceUrl) : null;
    if (ytId && ytPlayerRef.current) ytPlayerRef.current.seekTo(value, true);
    else if (audioRef.current) audioRef.current.currentTime = value;
    setProgress(value);
  };

  const addToQueue = (song: Song) => setQueue((q) => [...q, song]);

  const next = () => {
    const { queue, shuffle } = liveRef.current;
    if (queue.length > 0) {
      const idx = shuffle ? Math.floor(Math.random() * queue.length) : 0;
      const song = queue[idx];
      setQueue((q) => q.filter((_, i) => i !== idx));
      playInternal(song);
    } else {
      onSongEndedRef.current();
    }
  };

  const prev = () => {
    if (progress > 3) {
      seek(0);
    } else {
      seek(0);
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        currentSong, isPlaying, progress, duration,
        playSong, togglePlay, seek, queue, addToQueue,
        next, prev, volume, setVolume,
        shuffle, setShuffle, repeat, setRepeat,
      }}
    >
      <div
        id="yt-player-container"
        style={{
          position: "fixed",
          bottom: -2,
          right: -2,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
