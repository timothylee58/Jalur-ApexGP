"use client";

import { useEffect, useState } from "react";
import { bgm } from "@/data/bgm";

/**
 * Sitewide Spotify playlist embed, bottom-left, persistent across
 * client-side navigation (mounted once in the root layout). This is
 * Spotify's own official compact embed — it plays in-page (unlike a plain
 * link out to open.spotify.com), and its play control plus the currently-
 * playing track's title/source are all part of Spotify's native embed UI.
 * This component renders none of its own playback controls beyond the
 * minimize/restore toggle below; the iframe's contents are Spotify's.
 *
 * Minimized state persists across visits (localStorage) — the embed keeps
 * playing underneath either way, this only changes what's on screen. Fresh
 * visitors get it expanded once so they discover it's there; anyone who's
 * minimized it before stays minimized.
 */

const STORAGE_KEY = "jalur-apexgp-bgm-minimized";

// Tolerates either a bare playlist ID or a full pasted share link
// (https://open.spotify.com/playlist/<ID>?si=...) in data/bgm.ts — pasting
// the whole link is the easy mistake to make, and it'd otherwise nest a
// full URL inside the embed src below instead of just the ID.
function extractPlaylistId(value: string): string {
  const match = value.match(/playlist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : value;
}

export function BgmPlayer() {
  const playlistId = extractPlaylistId(bgm.playlistId);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1" || stored === "0") {
        setMinimized(stored === "1");
        return;
      }
      // First visit on a narrow viewport: start minimized so the embed
      // doesn't eat the first screen of content. Desktop stays expanded
      // once so the player is discoverable.
      if (window.matchMedia("(max-width: 639px)").matches) {
        setMinimized(true);
      }
    } catch {
      // private mode / blocked storage — stays expanded for this visit
    }
  }, []);

  function toggle(next: boolean) {
    setMinimized(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore — toggle still works for this visit
    }
  }

  return (
    <>
      {/* Minimize/restore button — rendered only in the opposite state of
          the panel below, never both, so there's exactly one control on
          screen at a time. */}
      {minimized ? (
        <button
          type="button"
          onClick={() => toggle(false)}
          aria-label="Show Formula 1 playlist player"
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-40 flex h-11 w-11 items-center justify-center rounded-full border border-paper/10 bg-asphalt shadow-lg shadow-black/40 hover:border-amber"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber" fill="currentColor" aria-hidden>
            <path d="M12 3a9 9 0 1 0 9 9 9.01 9.01 0 0 0-9-9Zm4.3 13.1a.6.6 0 0 1-.83.2c-2.27-1.39-5.13-1.7-8.5-.93a.6.6 0 1 1-.27-1.17c3.69-.84 6.85-.48 9.4 1.08a.6.6 0 0 1 .2.82Zm1.1-2.45a.75.75 0 0 1-1.03.25c-2.6-1.6-6.56-2.06-9.63-1.13a.75.75 0 1 1-.43-1.44c3.51-1.06 7.87-.55 10.84 1.28a.75.75 0 0 1 .25 1.04Zm.1-2.55C14.7 9.3 9.3 9.1 6.5 9.96a.9.9 0 1 1-.52-1.72c3.22-.98 9.15-.75 12.75 1.4a.9.9 0 1 1-.93 1.54Z" />
          </svg>
        </button>
      ) : null}
      {/* The panel — including its iframe — stays mounted at all times,
          even while minimized. Spotify's embed is a live iframe with its
          own playback state; conditionally unmounting it (as an earlier
          version of this component did) destroyed that window and silenced
          playback the instant you minimized, the opposite of "keeps
          playing in the background." Hidden via `hidden` + off-screen
          positioning instead, which leaves the iframe's document — and
          whatever's playing in it — running exactly as a real background
          player should. */}
      <div
        hidden={minimized}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-40 w-[min(300px,calc(100vw-2rem))] overflow-hidden rounded-xl shadow-lg shadow-black/40"
      >
        <div className="flex items-center justify-end bg-asphalt px-2 py-1">
          <button
            type="button"
            onClick={() => toggle(true)}
            aria-label="Minimize playlist player"
            className="rounded p-1 text-paper-dim hover:text-amber"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <iframe
          title="Spotify playlist player"
          // No autoplay here: Spotify's plain embed URL has no autoplay query
          // param (an earlier version of this component added one — it was a
          // no-op, since the embed silently ignores unrecognised params).
          // Real autoplay needs the official Embed iFrame API
          // (open.spotify.com/embed/iframe-api/v1, an EmbedController.play()
          // call) — and even that only fires playback, not the browser's own
          // autoplay-with-sound gate (Chrome/Safari/Firefox all still require
          // a prior user gesture or engagement history on the site). Not
          // worth the added script-loading complexity for a bottom-left
          // corner widget when the ceiling is "starts after any click on the
          // page" rather than true autoplay; Spotify's own play button in the
          // embed below is one click away regardless.
          src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`}
          width="100%"
          height="80"
          style={{ border: 0 }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          // No `loading="lazy"`: this iframe now stays mounted even while
          // minimized (`hidden`, not unmounted — see above) specifically so
          // playback keeps running in the background. A `hidden` element
          // has no layout box, so browsers treat it as arbitrarily far from
          // the viewport and a lazy iframe would simply never load while
          // minimized — exactly the case (mobile starts minimized by
          // default, above) where this matters most.
        />
      </div>
    </>
  );
}
