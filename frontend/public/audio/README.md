# BGM track goes here

Drop a license-clear audio file at `bgm.mp3` in this directory (or update
the `src` in `frontend/data/bgm.ts` if you use a different filename/format).

## Sourcing (keep this royalty-free / CC-licensed — see the README's own
"no official misuse" standard)

- [YouTube Audio Library](https://www.youtube.com/audiolibrary) — free
  tracks, filter by "Attribution not required" for the simplest path.
- [Pixabay Music](https://pixabay.com/music/) — free, no attribution
  required.
- [Free Music Archive](https://freemusicarchive.org/) — check each
  track's specific CC license; some require attribution.

## After adding the file

1. Update `frontend/data/bgm.ts` with the real `title` and `artist` —
   this is what shows in the hover tooltip bottom-left.
2. If the track requires attribution under its license, add that credit
   line into `bgm.ts` too and surface it in the tooltip (ask for a build
   change if you need this — the current component doesn't render an
   attribution line since the default suggestion above avoids needing one).
3. Keep the file reasonably small (a compressed MP3 under ~5MB is plenty
   for background music) — it loads on every page via the root layout.
