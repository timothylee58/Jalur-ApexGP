"use client";

import { useEffect, useRef, useState } from "react";
import { bgm } from "@/data/bgm";

/**
 * Sitewide Spotify playlist embed, bottom-left, persistent across
 * client-side navigation (mounted once in the root layout). Playback, the
 * play control and the track title are Spotify's own embed UI; this
 * component only adds the minimize/restore toggle and a fallback.
 *
 * The embed is created through Spotify's iFrame API rather than a bare
 * <iframe>, because the API's `ready` event is the only reliable sign that
 * the player actually works. Content blockers, strict tracking protection
 * and some networks block Spotify's frame, and a bare iframe then sits on
 * the page as an empty grey box (a blocked frame still fires `load`). If
 * the API script fails, or `ready` hasn't arrived after READY_TIMEOUT_MS,
 * the panel shows a "Listen on Spotify" card instead; a late `ready` (a
 * slow network, not a block) still swaps the player back in.
 *
 * Minimized state persists across visits (localStorage) — the embed keeps
 * playing underneath either way, this only changes what's on screen. Fresh
 * visitors get it expanded once so they discover it's there; anyone who's
 * minimized it before stays minimized.
 */

const STORAGE_KEY = "jalur-apexgp-bgm-minimized";
const API_SRC = "https://open.spotify.com/embed/iframe-api/v1";
const READY_TIMEOUT_MS = 12000;

interface EmbedController {
  addListener: (event: "ready", handler: () => void) => void;
  destroy: () => void;
}
interface IFrameAPI {
  createController: (
    element: HTMLElement,
    options: { url: string; width: string; height: number },
    callback: (controller: EmbedController) => void,
  ) => void;
}
type SpotifyWindow = Window & { onSpotifyIframeApiReady?: (api: IFrameAPI) => void };

// Tolerates either a bare playlist ID or a full pasted share link
// (https://open.spotify.com/playlist/<ID>?si=...) in data/bgm.ts — pasting
// the whole link is the easy mistake to make.
function extractPlaylistId(value: string): string {
  const match = value.match(/playlist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : value;
}

// One script per page load; `onSpotifyIframeApiReady` is a single global
// hook. A failed load clears the promise so "Try again" can re-request it.
let apiPromise: Promise<IFrameAPI> | null = null;
function loadSpotifyApi(): Promise<IFrameAPI> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<IFrameAPI>((resolve, reject) => {
    (window as SpotifyWindow).onSpotifyIframeApiReady = resolve;
    const script = document.createElement("script");
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => {
      script.remove();
      apiPromise = null;
      reject(new Error("Spotify iFrame API blocked"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

type Status = "loading" | "ready" | "blocked";

export function BgmPlayer() {
  const playlistId = extractPlaylistId(bgm.playlistId);
  const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
  const [minimized, setMinimized] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1" || stored === "0") {
        setMinimized(stored === "1");
        return;
      }
      // First visit on a narrow viewport: start minimized so the embed
      // doesn't eat the first screen of content.
      if (window.matchMedia("(max-width: 639px)").matches) {
        setMinimized(true);
      }
    } catch {
      // private mode / blocked storage — stays expanded for this visit
    }
  }, []);

  // The player host stays mounted while minimized (hidden, not unmounted):
  // the embed is a live frame with its own playback, and unmounting it
  // would silence the music the moment the panel is minimized.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let controller: EmbedController | null = null;
    setStatus("loading");
    const timer = window.setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "ready" ? s : "blocked"));
    }, READY_TIMEOUT_MS);

    loadSpotifyApi()
      .then((api) => {
        if (cancelled) return;
        // createController replaces the element it's given, so hand it a
        // fresh child rather than the React-owned host.
        const slot = document.createElement("div");
        host.replaceChildren(slot);
        api.createController(
          slot,
          // `url` keeps its query string on the embed: theme=0 is the dark
          // player that matches the site.
          { url: `${playlistUrl}?utm_source=generator&theme=0`, width: "100%", height: 80 },
          (created) => {
            if (cancelled) {
              created.destroy();
              return;
            }
            controller = created;
            created.addListener("ready", () => {
              if (cancelled) return;
              window.clearTimeout(timer);
              setStatus("ready");
            });
          },
        );
      })
      .catch(() => {
        if (cancelled) return;
        window.clearTimeout(timer);
        setStatus("blocked");
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller?.destroy();
      host.replaceChildren();
    };
  }, [playlistUrl, attempt]);

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
          the panel below, so there's exactly one control on screen. */}
      {minimized ? (
        <button
          type="button"
          onClick={() => toggle(false)}
          aria-label="Show Formula 1 playlist player"
          data-floating-widget=""
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-40 flex h-11 w-11 items-center justify-center rounded-full border border-paper/10 bg-asphalt shadow-lg shadow-black/40 hover:border-amber"
        >
          <SpotifyGlyph className="h-5 w-5 text-amber" />
        </button>
      ) : null}
      <div
        hidden={minimized}
        data-floating-widget=""
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-40 w-[min(300px,calc(100vw-2rem))] overflow-hidden rounded-xl shadow-lg shadow-black/40"
      >
        <div className="flex items-center justify-between gap-2 bg-asphalt px-2 py-1">
          {/* Always there, so even a player that loads but shows Spotify's
              own error has a way through to the playlist. */}
          <a
            href={playlistUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-dim hover:text-amber"
          >
            Open in Spotify <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
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
        <div className="relative h-20 bg-[#121212]">
          {/* Spotify's player lands in here. Invisible until it reports
              ready, so a blocked or half-loaded frame never shows. */}
          <div
            ref={hostRef}
            aria-hidden={status !== "ready"}
            className={`absolute inset-0 transition-opacity duration-300 ${status === "ready" ? "opacity-100" : "pointer-events-none opacity-0"}`}
          />
          {status === "loading" ? (
            <div className="absolute inset-0 flex items-center gap-3 px-3" role="status">
              <span className="h-14 w-14 shrink-0 animate-pulse rounded-md bg-paper/10" />
              <span className="flex-1 space-y-2">
                <span className="block h-2.5 w-3/4 animate-pulse rounded bg-paper/10" />
                <span className="block h-2 w-1/2 animate-pulse rounded bg-paper/10" />
              </span>
              <span className="sr-only">Loading the Spotify player…</span>
            </div>
          ) : null}
          {status === "blocked" ? (
            <div className="absolute inset-0 flex items-center gap-3 px-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[#1db954]/15">
                <SpotifyGlyph className="h-7 w-7 text-[#1db954]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-paper">Formula 1 playlist</span>
                <span className="block text-[11px] leading-snug text-paper-dim">
                  The player couldn&apos;t load here — a content blocker may be stopping it.
                </span>
                <span className="mt-1 flex items-center gap-3">
                  <a
                    href={playlistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-[#1db954] hover:underline"
                  >
                    Listen on Spotify
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setAttempt((n) => n + 1)}
                    className="text-xs text-paper-dim hover:text-amber"
                  >
                    Try again
                  </button>
                </span>
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function SpotifyGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 3a9 9 0 1 0 9 9 9.01 9.01 0 0 0-9-9Zm4.3 13.1a.6.6 0 0 1-.83.2c-2.27-1.39-5.13-1.7-8.5-.93a.6.6 0 1 1-.27-1.17c3.69-.84 6.85-.48 9.4 1.08a.6.6 0 0 1 .2.82Zm1.1-2.45a.75.75 0 0 1-1.03.25c-2.6-1.6-6.56-2.06-9.63-1.13a.75.75 0 1 1-.43-1.44c3.51-1.06 7.87-.55 10.84 1.28a.75.75 0 0 1 .25 1.04Zm.1-2.55C14.7 9.3 9.3 9.1 6.5 9.96a.9.9 0 1 1-.52-1.72c3.22-.98 9.15-.75 12.75 1.4a.9.9 0 1 1-.93 1.54Z" />
    </svg>
  );
}
