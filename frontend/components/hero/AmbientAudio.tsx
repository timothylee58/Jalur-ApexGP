"use client";

import { useEffect, useRef, useState } from "react";

const AUDIO_SRC = "/audio/ambient.mp3";

export function AmbientAudio() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(AUDIO_SRC, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setAvailable(res.ok);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !available) return;
    el.volume = 0.32;
    if (enabled) {
      void el.play().catch(() => setEnabled(false));
    } else {
      el.pause();
    }
  }, [enabled, available]);

  if (!available) return null;

  return (
    <>
      <audio ref={audioRef} src={AUDIO_SRC} loop preload="none" />
      <button
        type="button"
        onClick={() => setEnabled((value) => !value)}
        aria-pressed={enabled}
        className="fixed bottom-4 right-4 z-50 rounded-full border border-paper/15 bg-asphalt/90 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim backdrop-blur transition-colors hover:border-amber/50 hover:text-amber"
      >
        {enabled ? "Sound on" : "Sound off"}
      </button>
    </>
  );
}
