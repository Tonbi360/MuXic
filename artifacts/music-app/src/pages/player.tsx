import { useState, useEffect, useRef } from "react";
import { usePlayer } from "@/hooks/use-player";
import type { RepeatMode } from "@/hooks/use-player";
import { useLocation } from "wouter";
import {
  Play, Pause, SkipForward, SkipBack, Volume2, Music2,
  Shuffle, Repeat, Moon, ChevronDown
} from "lucide-react";

function formatTime(secs: number) {
  if (!secs || isNaN(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function PlayerPage() {
  const { currentSong, isPlaying, togglePlay, next, prev, progress, duration, seek, volume, setVolume, shuffle, setShuffle, repeat, setRepeat } = usePlayer();
  const [, setLocation] = useLocation();
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepLeft, setSleepLeft] = useState<number | null>(null);

  // Keep a ref so the sleep timer interval always sees the latest isPlaying value
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  const togglePlayRef = useRef(togglePlay);
  useEffect(() => { togglePlayRef.current = togglePlay; }, [togglePlay]);

  // Sleep timer
  useEffect(() => {
    if (sleepMinutes === null) return;
    const end = Date.now() + sleepMinutes * 60 * 1000;
    setSleepLeft(sleepMinutes * 60);
    const interval = setInterval(() => {
      const remaining = Math.ceil((end - Date.now()) / 1000);
      if (remaining <= 0) {
        setSleepLeft(null);
        setSleepMinutes(null);
        if (isPlayingRef.current) togglePlayRef.current();
        clearInterval(interval);
      } else {
        setSleepLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepMinutes]);

  if (!currentSong) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <Music2 className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">Nothing playing</p>
        <p className="text-sm mt-1">Search for a song or browse the Song Board</p>
        <button
          onClick={() => setLocation("/")}
          className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-full bg-background p-6 md:p-10 gap-8">
      {/* Back */}
      <button
        data-testid="button-back-player"
        onClick={() => setLocation(-1 as unknown as string)}
        className="self-start flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm"
      >
        <ChevronDown className="w-4 h-4" /> Now Playing
      </button>

      {/* Album art */}
      <div className="w-full max-w-xs aspect-square rounded-2xl overflow-hidden bg-muted shadow-2xl">
        {currentSong.coverUrl ? (
          <img src={currentSong.coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music2 className="w-20 h-20 text-muted-foreground opacity-40" />
          </div>
        )}
      </div>

      {/* Song info */}
      <div className="text-center w-full max-w-xs">
        <h2 className="text-2xl font-bold font-serif truncate">{currentSong.title}</h2>
        <p className="text-muted-foreground mt-1 truncate">{currentSong.artist}</p>
        {currentSong.album && <p className="text-xs text-muted-foreground mt-0.5 truncate">{currentSong.album}</p>}
      </div>

      {/* Seek bar */}
      <div className="w-full max-w-xs space-y-1">
        <input
          data-testid="input-seek"
          type="range"
          min={0}
          max={duration || 100}
          value={progress}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6">
        <button
          data-testid="button-shuffle"
          onClick={() => setShuffle(!shuffle)}
          className={`p-2 rounded-full transition-colors ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Shuffle className="w-5 h-5" />
        </button>
        <button
          data-testid="button-prev"
          onClick={prev}
          className="p-3 text-foreground hover:text-primary transition-colors"
        >
          <SkipBack className="w-6 h-6" />
        </button>
        <button
          data-testid="button-play-pause"
          onClick={togglePlay}
          className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:opacity-90 transition-opacity shadow-lg"
        >
          {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
        </button>
        <button
          data-testid="button-next"
          onClick={next}
          className="p-3 text-foreground hover:text-primary transition-colors"
        >
          <SkipForward className="w-6 h-6" />
        </button>
        <button
          data-testid="button-repeat"
          onClick={() => setRepeat((repeat === "off" ? "one" : repeat === "one" ? "all" : "off") as RepeatMode)}
          className={`p-2 rounded-full transition-colors relative ${repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Repeat className="w-5 h-5" />
          {repeat === "all" && (
            <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold bg-primary text-primary-foreground rounded-full w-3 h-3 flex items-center justify-center">∞</span>
          )}
          {repeat === "one" && (
            <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold bg-primary text-primary-foreground rounded-full w-3 h-3 flex items-center justify-center">1</span>
          )}
        </button>
      </div>

      {/* Volume */}
      <div className="w-full max-w-xs flex items-center gap-3">
        <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          data-testid="input-volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="flex-1 accent-primary"
        />
      </div>

      {/* Sleep timer */}
      <div className="w-full max-w-xs">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Sleep timer</span>
          {sleepLeft !== null && (
            <span className="text-sm text-primary font-medium ml-auto">
              {Math.floor(sleepLeft / 60)}:{String(sleepLeft % 60).padStart(2, "0")}
            </span>
          )}
        </div>
        {sleepMinutes === null ? (
          <div className="flex gap-2 mt-2">
            {[15, 30, 60].map((m) => (
              <button
                key={m}
                data-testid={`button-sleep-${m}`}
                onClick={() => setSleepMinutes(m)}
                className="flex-1 py-1.5 bg-muted text-muted-foreground hover:text-foreground rounded-lg text-xs font-medium transition-colors"
              >
                {m}m
              </button>
            ))}
          </div>
        ) : (
          <button
            data-testid="button-cancel-sleep"
            onClick={() => { setSleepMinutes(null); setSleepLeft(null); }}
            className="mt-2 w-full py-1.5 bg-muted text-muted-foreground hover:text-foreground rounded-lg text-xs font-medium transition-colors"
          >
            Cancel timer
          </button>
        )}
      </div>

      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="px-2 py-0.5 bg-muted rounded-full capitalize">{currentSong.source}</span>
        <span className="px-2 py-0.5 bg-muted rounded-full capitalize">{currentSong.storageType.replace("_", " ")}</span>
      </div>
    </div>
  );
}
