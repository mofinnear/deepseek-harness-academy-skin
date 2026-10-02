#!/usr/bin/env python3
"""Build a macOS .icns from one square source image.

Pillow produces the resampled PNGs; `iconutil` packs them. Sizes follow the
standard iconset matrix, so Finder, the Dock, the app switcher and Quick Look
all pick up a crisp variant.

Usage:
    python3 tools/build_icns.py assets/app-icon.png build/icon.icns
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

# (pixel size, iconset file name) — the matrix `iconutil` expects.
ICONSET_MATRIX = [
    (16, "icon_16x16.png"),
    (32, "icon_16x16@2x.png"),
    (32, "icon_32x32.png"),
    (64, "icon_32x32@2x.png"),
    (128, "icon_128x128.png"),
    (256, "icon_128x128@2x.png"),
    (256, "icon_256x256.png"),
    (512, "icon_256x256@2x.png"),
    (512, "icon_512x512.png"),
    (1024, "icon_512x512@2x.png"),
]


def build(source: Path, output: Path) -> None:
    if not source.exists():
        raise SystemExit(f"source image not found: {source}")
    image = Image.open(source).convert("RGBA")
    if image.width != image.height:
        print(f"[warn] source is {image.width}x{image.height}; cropping to a centered square", file=sys.stderr)
        side = min(image.width, image.height)
        left = (image.width - side) // 2
        top = (image.height - side) // 2
        image = image.crop((left, top, left + side, top + side))

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(suffix=".iconset") as tmp:
        iconset = Path(tmp)
        for px, name in ICONSET_MATRIX:
            resized = image.resize((px, px), Image.LANCZOS)
            resized.save(iconset / name, format="PNG")
        subprocess.run(
            ["iconutil", "--convert", "icns", "--output", str(output), str(iconset)],
            check=True,
        )
    print(f"[icns] wrote {output} ({output.stat().st_size} B) from {source}")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    build(Path(sys.argv[1]), Path(sys.argv[2]))


if __name__ == "__main__":
    main()
