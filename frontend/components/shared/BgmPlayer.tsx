import { bgm } from "@/data/bgm";

/**
 * Sitewide Spotify playlist embed, bottom-left, persistent across
 * client-side navigation (mounted once in the root layout). This is
 * Spotify's own official compact embed — it plays in-page (unlike a plain
 * link out to open.spotify.com), and its play control plus the currently-
 * playing track's title/source are all part of Spotify's native embed UI.
 * This component renders none of its own playback controls; it just sizes
 * and positions the iframe.
 */

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

  return (
    <div className="fixed bottom-4 left-4 z-40 w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl shadow-lg shadow-black/40">
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
        loading="lazy"
      />
    </div>
  );
}
