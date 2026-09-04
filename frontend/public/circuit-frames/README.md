# Circuit hero flyover frames

48 zero-padded WebP frames (0001.webp … 0048.webp), currently populated
from a user-supplied clip — treated with `scripts/extract-frames.py
--stylize` (grayscale + coarse mosaic) because the source showed real
sponsor decals and team livery colors, both ruled out by `docs/BRAND.md`.
Same source and treatment as `public/apple-design-frames/` and the landing
page's lap-preview GIF (`public/hero/circuit-motion.gif`).

To replace with different footage:

```
python scripts/extract-frames.py path/to/source.mp4 \
  --out frontend/public/circuit-frames --stylize
```

Drop `--stylize` only for footage you know is already free of sponsor
marks, team liveries, or other branding — see `docs/BRAND.md` before
skipping it. `--count` defaults to 48, matching `FRAME_COUNT` in
`frontend/components/hero/CircuitFrameSequence.tsx`; change both together
if you need a different count.
