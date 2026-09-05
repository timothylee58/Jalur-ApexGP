# Circuit hero flyover frames

48 zero-padded WebP frames (0001.webp … 0048.webp), populated with
`scripts/extract-frames.py --stylize --stylize-after 5.5`. Same source and
treatment as `public/apple-design-frames/`: the clip shows a fake sponsor
decal on the rear wing from ~5.5s onward, so only frames at/after that get
the coarse-mosaic treatment — frames before it keep full detail. Verified
frame-by-frame that the mosaic destroys the decal's legibility, not just
softens it.

To replace with different footage:

```
python scripts/extract-frames.py path/to/source.mp4 \
  --out frontend/public/circuit-frames --stylize

# or, if the branding only shows up partway through (map the safe/unsafe
# window by eye first):
python scripts/extract-frames.py path/to/source.mp4 \
  --out frontend/public/circuit-frames --stylize --stylize-after N
```

Drop `--stylize` (and `--stylize-after`) only for footage you know is
already free of sponsor marks, team liveries, or other branding — see
`docs/BRAND.md` before skipping it. `--count` defaults to 48, matching
`FRAME_COUNT` in `frontend/components/hero/CircuitFrameSequence.tsx`;
change both together if you need a different count.
