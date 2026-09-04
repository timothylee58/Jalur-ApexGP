"""Extract a WebP frame sequence from source footage into a frontend
public/*-frames/ directory, matching what ScrollFrameSequence (used by both
CircuitFrameSequence and the /apple-design page) expects to load.

Requires ffmpeg on PATH (https://ffmpeg.org/download.html).

Usage:
    python scripts/extract-frames.py path/to/source.mp4
    python scripts/extract-frames.py path/to/source.mp4 --count 60 --quality 80
    python scripts/extract-frames.py path/to/source.mp4 \
        --out frontend/public/apple-design-frames --stylize

The hero component hardcodes FRAME_COUNT=48 and zero-pads to 4 digits
(0001.webp … 0048.webp) — if you change --count here, update FRAME_COUNT in
the page/component that loads this output to match, or frames past the old
count are loaded but never shown, and shown-but-missing frames fall back
silently to the last successfully loaded texture.

--stylize exists for source clips that show real sponsor decals, team
livery colors, or other branding docs/BRAND.md rules out ("no team
liveries, no sponsor logos, anywhere"; hero footage "never official
broadcast footage, team media, or licensed circuit photography"): it
desaturates and downsamples to a coarse mosaic before upscaling back to
--width, the same treatment validated frame-by-frame against real sponsor
text (see the landing page's CircuitMotionPreview and its commit history)
to confirm it destroys legibility rather than just softening it. Clean,
rights-cleared footage doesn't need it — that's what the flag is for,
not a default.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def ffprobe_duration(source: Path) -> float | None:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(source),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return float(result.stdout.strip())
    except (subprocess.CalledProcessError, ValueError, FileNotFoundError):
        return None


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract numbered WebP frames for the hero scroll sequence."
    )
    parser.add_argument("source", help="Path to source video")
    parser.add_argument(
        "--out",
        default="frontend/public/circuit-frames",
        help="Output directory (0001.webp …)",
    )
    parser.add_argument(
        "--count", type=int, default=48, help="Number of frames to extract"
    )
    parser.add_argument(
        "--quality", type=int, default=82, help="WebP quality, 0-100 (ffmpeg -quality)"
    )
    parser.add_argument(
        "--width",
        type=int,
        default=1600,
        help="Output frame width in px; height is scaled to preserve aspect ratio",
    )
    parser.add_argument(
        "--stylize",
        action="store_true",
        help=(
            "Grayscale + coarse-mosaic treatment for source clips with real "
            "sponsor decals or team livery (see docs/BRAND.md). Skip for "
            "clean, rights-cleared footage."
        ),
    )
    parser.add_argument(
        "--mosaic-width",
        type=int,
        default=80,
        help="Logical width the frame is downsampled to before upscaling, "
        "with --stylize (smaller = coarser mosaic = more illegible text)",
    )
    args = parser.parse_args()

    if shutil.which("ffmpeg") is None:
        sys.exit(
            "ffmpeg not found on PATH. Install it first: "
            "https://ffmpeg.org/download.html"
        )

    source = Path(args.source)
    if not source.exists():
        sys.exit(f"Source video not found: {source}")

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    duration = ffprobe_duration(source)
    if duration is None:
        print("Warning: couldn't read duration via ffprobe; falling back to a fixed fps.", file=sys.stderr)
        fps_filter = "fps=6"
    else:
        # Spread exactly --count frames evenly across the whole clip, rather
        # than a fixed fps that would extract a different frame count
        # depending on the source's length.
        fps = args.count / duration
        fps_filter = f"fps={fps:.6f}"

    if args.stylize:
        # Grayscale first (kills any livery's color identity), then a soft
        # downsample-then-upscale mosaic. Plain gaussian blur was tried and
        # rejected for this same treatment elsewhere in the project: it left
        # small decal text partially legible at a web-reasonable size, and
        # blur's smooth gradients compress far worse than mosaic's flat
        # blocks. Downsampling with lanczos (averages a region, rather than
        # sampling one pixel like nearest-neighbor would) is what actually
        # destroys the text; the neighbor-flagged upscale back to --width
        # just makes the resulting blocks visible instead of re-blurring
        # them smooth.
        vf = (
            f"{fps_filter},hue=s=0,eq=contrast=1.3:brightness=-0.02,"
            f"scale={args.mosaic_width}:-2:flags=lanczos,"
            f"scale={args.width}:-2:flags=neighbor"
        )
    else:
        vf = f"{fps_filter},scale={args.width}:-2"

    pattern = str(out / "%04d.webp")
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(source),
        "-vf",
        vf,
        "-vframes",
        str(args.count),
        "-c:v",
        "libwebp",
        "-quality",
        str(args.quality),
        "-preset",
        "picture",
        pattern,
    ]

    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True)

    produced = sorted(out.glob("*.webp"))
    print(f"\nWrote {len(produced)} frame(s) to {out}")
    if len(produced) != args.count:
        print(
            f"Warning: expected {args.count} frames but got {len(produced)}. "
            "The source clip may be shorter than expected, or ffmpeg rounded "
            "the fps filter. Re-run with an explicit --count that matches, "
            "or update FRAME_COUNT in CircuitFrameSequence.tsx to match.",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
