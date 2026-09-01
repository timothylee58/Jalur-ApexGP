"""Extract a WebP frame sequence from Sepang flyover footage into frontend/public/circuit-frames/."""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract numbered WebP frames for the hero sequence.")
    parser.add_argument("source", help="Path to source video")
    parser.add_argument(
        "--out",
        default="frontend/public/circuit-frames",
        help="Output directory (0001.webp …)",
    )
    parser.add_argument("--count", type=int, default=48)
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    print(
        f"TODO: decode {args.source} into {args.count} WebP frames under {out}. "
        "Use ffmpeg, e.g. ffmpeg -i SOURCE -vf fps=6 {out}/%04d.webp"
    )


if __name__ == "__main__":
    main()
