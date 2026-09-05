/**
 * Sitewide Spotify playlist embed, bottom-left (see BgmPlayer.tsx). This is
 * Spotify's own official embed iframe, not a custom player — playback,
 * the play/pause control, and the track-title/source display are all
 * Spotify's native embed UI, not anything this app builds or manages.
 *
 * Edit `playlistId` once you've picked a real public playlist:
 * 1. Open the playlist in Spotify, "Share" → "Copy link to playlist".
 * 2. That link looks like https://open.spotify.com/playlist/<ID>?si=... —
 *    pasting the whole thing here works too (BgmPlayer.tsx extracts the
 *    <ID> either way), but the bare ID is the cleaner value to keep.
 */
export const bgm = {
  playlistId: "3lxQkKfmR7kehvSmI8Fnpp",
};
