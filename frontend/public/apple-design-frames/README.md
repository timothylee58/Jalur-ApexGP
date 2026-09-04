# Scroll-frame sequence

48 zero-padded WebP frames (0001.webp … 0048.webp), currently populated
from a user-supplied clip — treated with `scripts/extract-frames.py
--stylize` (grayscale + coarse mosaic) because the source showed real
sponsor decals and team livery colors, both ruled out by `docs/BRAND.md`.
Verified frame-by-frame that the treatment destroys decal legibility
rather than just softening it.

To replace with different footage:

```
python scripts/extract-frames.py path/to/source.mp4 \
  --out frontend/public/apple-design-frames --stylize
```

Drop `--stylize` only for footage you know is already free of sponsor
marks, team liveries, or other branding — see `docs/BRAND.md` before
skipping it. `--count` defaults to 48, matching `FRAME_COUNT` in
`frontend/app/apple-design/page.tsx`; change both together if you need a
different count.
