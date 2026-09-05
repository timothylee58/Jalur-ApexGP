# Landing page lap-preview frames

48 zero-padded WebP frames (0001.webp … 0048.webp), populated with
`scripts/extract-frames.py` — no `--stylize`. Source clip is a generic,
unbranded single-seater (matte black/orange livery, no team name, no
sponsor decals, no car number) filmed at Sepang and Silverstone.

Verified clean before skipping the mosaic treatment other two sequences
need (`apple-design-frames/`, `circuit-frames/`):

- No visible branding on the car itself at any point in the clip.
- The wide Sepang shots show trackside sign boards in the background; a
  native-resolution crop (no upscaling beyond the source's own 1280x720)
  showed the text/logo genuinely isn't legible at this clip's resolution —
  not stylized to destroy it, just never resolved enough to read in the
  first place. Re-verify this if the source clip is ever swapped for
  higher-resolution footage of the same shot.

To replace with different footage:

```
python scripts/extract-frames.py path/to/source.mp4 \
  --out frontend/public/lap-preview-frames

# add --stylize (see the other two frame dirs' READMEs) if the new clip
# shows any real sponsor decal, team livery, or other branding docs/BRAND.md
# rules out.
```

`--count` defaults to 48, matching `FRAME_COUNT` in
`frontend/components/hero/CircuitMotionPreview.tsx`; change both together
if you need a different count.
