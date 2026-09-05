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
export function BgmPlayer() {
  return (
    <div className="fixed bottom-4 left-4 z-40 w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl shadow-lg shadow-black/40">
      <iframe
        title="Spotify playlist player"
        src={`https://open.spotify.com/embed/playlist/${bgm.playlistId}?utm_source=generator&theme=0`}
        width="100%"
        height="80"
        style={{ border: 0 }}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>
  );
}
