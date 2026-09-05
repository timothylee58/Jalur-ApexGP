# Scroll-frame sequence

48 zero-padded WebP frames (0001.webp … 0048.webp), populated from a
user-supplied clip with `scripts/extract-frames.py --stylize
--stylize-after 5.5`: the source shows a fake sponsor decal ("FORLEN" + an
F1 logo mark) on the rear wing from ~5.5s to the end (docs/BRAND.md rules
this out), but never before that — so frames before 5.5s keep full detail
and only the ones at/after it get the coarse-mosaic treatment. Verified
frame-by-frame, including against the closest/sharpest appearance of the
decal, that the mosaic destroys its legibility rather than softening it.

To replace with different footage:

```
python scripts/extract-frames.py path/to/source.mp4 \
  --out frontend/public/apple-design-frames --stylize

# or, if the branding only shows up partway through (map the safe/unsafe
# window by eye first):
python scripts/extract-frames.py path/to/source.mp4 \
  --out frontend/public/apple-design-frames --stylize --stylize-after N
```

Drop `--stylize` (and `--stylize-after`) only for footage you know is
already free of sponsor marks, team liveries, or other branding — see
`docs/BRAND.md` before skipping it. `--count` defaults to 48, matching
`FRAME_COUNT` in `frontend/app/apple-design/page.tsx`; change both together
if you need a different count.
