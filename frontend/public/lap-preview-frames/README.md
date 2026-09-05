# Landing page lap-preview frames

48 zero-padded WebP frames (0001.webp … 0048.webp) at 1600x900 (16:9),
populated with `scripts/extract-frames.py` — no `--stylize`. A matching
9:16 set lives in `../lap-preview-frames-9x16/` (900x1600), picked on
narrow viewports by `CircuitMotionPreview` via `ScrollFrameSequence`'s
`mobileFramesPath` — same `<source media>` art-direction idea as
`CircuitVideoHero`, not one clip CSS-stretched to fit both shapes.

## Provenance

Source clip: a chase-drone shot of a single-seater at Sepang (matte
blue/grey livery, no team name, no sponsor decals, no car number),
supplied directly by the project owner. Verified frame-by-frame: no
branding on the car at any point, no other readable signage in the
background, no visible driver face (helmet/visor only).

**One thing needed removing before use:** the source clip carries a
burned-in telemetry HUD (a speed readout + current-turn-number badge) in
the bottom-left corner for the *entire* clip — not a background decal but
an overlay graphic, which `docs/BRAND.md` rules out the same as broadcast
network bugs or F1/FIA watermarks. Since it's present throughout (not just
an opening shot), it was feathered out rather than cropped: a heavy
`boxblur` composited back over the original via a soft radial alpha mask
(`alphamerge` + `overlay`, not `maskedmerge` — see the git history on this
file for why: `maskedmerge` washed the *entire* frame with a uniform tint
in testing here instead of respecting the mask's black regions, even with
matching pixel formats forced on every input; `alphamerge`+`overlay`
composited exactly as expected on the first try). Verified by re-extracting
frames from the *output* that the HUD's numbers/text are actually
illegible, not just softened, and that nothing outside the masked corner
is affected.

The 9:16 crop happens to exclude that corner entirely (its left edge
starts well to the right of the HUD), so the portrait frames never needed
the mask.

## To replace with different footage

```
python scripts/extract-frames.py path/to/source.mp4 \
  --out frontend/public/lap-preview-frames

# Then for the 9:16 companion set, crop first (pick an x offset that keeps
# the car in frame across the whole clip — sample several timestamps, don't
# assume a center crop works):
ffmpeg -i path/to/source.mp4 -vf "crop=<w>:<h>:<x>:0" -an cropped-9x16.mp4
python scripts/extract-frames.py cropped-9x16.mp4 \
  --out frontend/public/lap-preview-frames-9x16 --width 900

# add --stylize (see the other frame dirs' READMEs) if the new clip shows
# any real sponsor decal, team livery, or other branding docs/BRAND.md
# rules out. If it carries any burned-in overlay graphic (telemetry HUD,
# broadcast bug, watermark) instead, that needs masking, not --stylize —
# see the alphamerge+overlay approach above.
```

`--count` defaults to 48, matching `FRAME_COUNT` in
`frontend/components/hero/CircuitMotionPreview.tsx`; change both together
(and re-run the 9:16 extraction with the same `--count`) if you need a
different count.
