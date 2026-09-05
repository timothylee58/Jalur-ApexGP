import { Music } from "lucide-react";
import { bgm } from "@/data/bgm";

/**
 * Sitewide "listen on Spotify" link, bottom-left, persistent across
 * client-side navigation (mounted once in the root layout). Just an
 * outbound link — no play/pause/next, no in-page audio element. Spotify
 * playback happens in Spotify's own app/tab once clicked, so this needs no
 * "use client" (no state, no browser APIs) and no autoplay workaround.
 */
export function BgmPlayer() {
  return (
    <a
      href={bgm.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Listen to ${bgm.name} on Spotify — opens in a new tab`}
      className="fixed bottom-4 left-4 z-40 flex h-10 items-center gap-2 rounded-full border border-paper/20 bg-asphalt/90 px-3 text-paper backdrop-blur transition-colors hover:border-amber hover:text-amber focus-visible:border-amber focus-visible:text-amber"
    >
      <Music size={16} className="shrink-0" />
      <span className="max-w-[12rem] truncate font-mono text-[11px] uppercase tracking-wide">
        {bgm.name}
      </span>
    </a>
  );
}
