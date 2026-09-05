/**
 * Sitewide Spotify playlist embed, bottom-left (see BgmPlayer.tsx). This is
 * Spotify's own official embed iframe, not a custom player — playback,
 * the play/pause control, and the track-title/source display are all
 * Spotify's native embed UI, not anything this app builds or manages.
 *
 * Edit `playlistId` once you've picked a real public playlist:
 * 1. Open the playlist in Spotify, "Share" → "Copy link to playlist".
 * 2. That link looks like https://open.spotify.com/playlist/<ID>?si=... —
 *    copy just the <ID> segment (before any "?") into `playlistId` below.
 */
export const bgm = {
  playlistId: "https://open.spotify.com/playlist/3lxQkKfmR7kehvSmI8Fnpp?si=8MGjvFBGTMyW9VwWmeCI6Q",
};
