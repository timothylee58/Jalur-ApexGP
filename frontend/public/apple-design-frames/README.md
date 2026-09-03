# Scroll-frame sequence goes here

Place extracted frames here as zero-padded WebP files:
0001.webp … 0048.webp

Generate with `scripts/extract-frames.py` once you have source footage you
have rights to use — see that script's own docstring for the command, and
`public/circuit-frames/README.md` for sourcing guidance (the same rules
apply here: royalty-free/CC-licensed footage or your own, not an
arbitrary copyrighted clip reproduced frame-by-frame).

`--out frontend/public/apple-design-frames` targets this directory; adjust
`--count` to match `FRAME_COUNT` in
`frontend/components/apple-design/AppleDesignFrameSequence` usage (or just
keep the default 48 on both ends).
