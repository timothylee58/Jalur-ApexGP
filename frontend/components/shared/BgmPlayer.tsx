"use client";

import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { bgm } from "@/data/bgm";

/**
 * Sitewide background music toggle, bottom-left, persistent across
 * client-side navigation (mounted once in the root layout). Starts paused —
 * browsers block audio-with-sound autoplay without a user gesture, so this
 * never pretends to autoplay; the first click is what actually starts it.
 * Hover or focus reveals the track title/artist to the right of the button.
 */
export function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    // play() returns a promise that rejects if the browser still blocks it
    // (e.g. no user gesture registered yet) — swallow that rather than
    // throwing an unhandled rejection into the console.
    audio.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }

  return (
    <div className="group fixed bottom-4 left-4 z-40 flex items-center gap-2">
      <audio ref={audioRef} src={bgm.src} loop preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={`${playing ? "Pause" : "Play"} background music — ${bgm.title} by ${bgm.artist}`}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-paper/20 bg-asphalt/90 text-paper backdrop-blur transition-colors hover:border-amber hover:text-amber focus-visible:border-amber focus-visible:text-amber"
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <div
        className="pointer-events-none max-w-[14rem] origin-left scale-95 rounded-full border border-paper/10 bg-asphalt/90 px-3 py-1.5 opacity-0 backdrop-blur transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100"
        aria-hidden
      >
        <p className="truncate font-mono text-[11px] uppercase tracking-wide text-paper">
          {bgm.title}
        </p>
        <p className="truncate font-mono text-[10px] text-paper-dim">{bgm.artist}</p>
      </div>
    </div>
  );
}
