/**
 * Sitewide "listen while you browse" link, bottom-left — just an outbound
 * link to a Spotify playlist now, not a self-hosted audio file (see
 * BgmPlayer.tsx: no play/pause, no in-page audio element, so no licensing
 * or hosting to manage — Spotify handles playback in its own app/tab).
 *
 * Edit these once you've picked a real public playlist:
 * 1. Open the playlist in Spotify, "Share" → "Copy link to playlist".
 * 2. Paste it as `url` below.
 * 3. Set `name` to whatever should show on the pill (playlist title, or
 *    your own label for it).
 */
export const bgm = {
  name: "Add your playlist name",
  url: "https://open.spotify.com/playlist/REPLACE_WITH_PLAYLIST_ID",
};
