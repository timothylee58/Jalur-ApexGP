# Hero videos

`hero-16x9.mp4` and `hero-9x16.mp4` — the landing page and `/apple-design`
hero background (`CircuitVideoHero.tsx`). Both muted (no audio track at
all — stripped, not just silenced), looping, no controls; behaves like a
GIF, not a video player.

## Provenance

AI-generated (text-to-image/video), not real footage — an original,
license-clear stand-in for the real broadcast/aerial footage this project
has twice rejected (see root `README.md`'s "Landing page lap preview"
entry and `docs/BRAND.md`'s Imagery section for that history). Generated
against the negative-prompt checklist `docs/BRAND.md` now codifies: no
logos, sponsor names, team liveries, Ferrari, Santander, FIA, F1
watermark, readable signage, real venue text, or real driver likeness.

**One frame region needed a fix before use:** from ~1.65s to the scene cut
at ~3.45s, the generator rendered a trackside board with garbled
letterforms — not legible as any real word, but shaped enough like real
Sepang corner signage to fail the "no readable signage / no real venue
text" bar on sight. Blurred out with a targeted `boxblur`, verified by
re-extracting frames across that exact window afterward to confirm it's
actually illegible now (not just assumed) and that the blur doesn't bleed
into the next scene. The rest of the clip — the car on-track and the
podium celebration — was checked frame-by-frame and is clean: no
logos, no readable text, a synthetic/non-recognizable face.

## 9:16 crop

`hero-9x16.mp4` is a center crop of the cleaned 16:9 master
(`crop=404:720:438:0` — 720p height, 9:16 width, centered), not a separate
generation. Verified across all three shots in the clip (wide establishing
pan, the car through two corners, the podium close-up) that a single
static center crop composes correctly throughout — the car and driver stay
in frame at every sampled timestamp, so no per-shot crop offset was
needed.

## Regenerating

If either file is ever replaced, re-run the same checks before shipping:
scrub through the new clip frame-by-frame for anything the checklist
above rules out, and re-verify any crop/blur fix by re-extracting frames
from the *output*, not just trusting the filter graph.
