#!/usr/bin/env python3
"""Compose the harness logo assets from one square mascot image.

Input : a square colour illustration on a white background (this project's
        `src/mascot-restored.png`).
Output: everything `logo.config.json` and `tools/install_app_icon.py` consume.

  assets/app-icon.png       1024x1024, macOS squircle mask + system-style shadow
  assets/hero-mark.png      generous padding, art untouched
  assets/sidebar-mark.png   tight "avatar" crop, white converted to alpha
  assets/sidebar-name.png   full art, tight crop, white converted to alpha

White-to-alpha uses a soft luminance ramp rather than a hard threshold, because
the character itself wears white: a global threshold would punch holes in the
apron and collar. Because the illustration sits on pure white with no white
contacting the frame edge, every near-white pixel really is background.

Usage:
    python3 tools/compose_artwork.py [--source src/mascot-restored.png]
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

# Alpha ramp: fully background at/above WHITE_HI, fully opaque at/below WHITE_LO.
WHITE_LO = 244
WHITE_HI = 252


def load_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGB")


def white_to_alpha(image: Image.Image) -> Image.Image:
    """Convert a pure-white background to transparency with a soft ramp."""
    rgb = image.convert("RGB")
    gray = rgb.convert("L")
    alpha = gray.point(lambda v: 0 if v >= WHITE_HI else (255 if v <= WHITE_LO else int(255 * (WHITE_HI - v) / (WHITE_HI - WHITE_LO))))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def alpha_bbox(image: Image.Image, threshold: int = 8) -> tuple[int, int, int, int]:
    """Bounding box of pixels whose alpha clears `threshold`."""
    alpha = image.getchannel("A").point(lambda v: 255 if v > threshold else 0)
    box = alpha.getbbox()
    if box is None:
        raise SystemExit("no opaque pixels found — is the source blank?")
    return box


def pad_square(image: Image.Image, fill: tuple[int, int, int, int] = (0, 0, 0, 0)) -> Image.Image:
    """Center an image on a transparent square canvas sized to its longer side."""
    side = max(image.width, image.height)
    canvas = Image.new("RGBA", (side, side), fill)
    canvas.paste(image, ((side - image.width) // 2, (side - image.height) // 2))
    return canvas


def add_padding(image: Image.Image, ratio: float) -> Image.Image:
    """Add `ratio` of the image size as transparent margin on every side."""
    pad = int(round(max(image.width, image.height) * ratio))
    canvas = Image.new("RGBA", (image.width + 2 * pad, image.height + 2 * pad), (0, 0, 0, 0))
    canvas.paste(image, (pad, pad))
    return canvas


def squircle_mask(side: int, inset_ratio: float = 0.055) -> Image.Image:
    """Approximate the macOS app-icon shape: a rounded square, never a circle."""
    mask = Image.new("L", (side * 4, side * 4), 0)
    draw = ImageDraw.Draw(mask)
    inset = side * 4 * inset_ratio
    draw.rounded_rectangle(
        [inset, inset, side * 4 - inset, side * 4 - inset],
        radius=(side * 4) * 0.225,
        fill=255,
    )
    return mask.resize((side, side), Image.LANCZOS)


def soft_shadow(shape_alpha: Image.Image, blur: int, offset: int) -> Image.Image:
    """A shadow layer derived from the icon silhouette."""
    shadow = Image.new("RGBA", shape_alpha.size, (0, 0, 0, 0))
    tint = Image.new("RGBA", shape_alpha.size, (0, 0, 0, 90))
    shadow.paste(tint, (0, offset), shape_alpha)
    return shadow.filter(ImageFilter.GaussianBlur(blur))


def build_app_icon(source: Image.Image, size: int = 1024) -> Image.Image:
    """Full-bleed coloured artwork clipped to the macOS icon shape."""
    art = pad_square(source)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    art_resized = art.resize((int(size * 0.90), int(size * 0.90)), Image.LANCZOS)
    offset = (size - art_resized.width) // 2
    canvas.paste(art_resized, (offset, offset))

    mask = squircle_mask(size)
    clipped = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    clipped.paste(canvas, (0, 0), mask)

    shadow = soft_shadow(mask, blur=size // 40, offset=size // 90)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(shadow)
    out.alpha_composite(clipped)
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default=str(ROOT / "src" / "mascot-restored.png"))
    args = parser.parse_args()

    source_path = Path(args.source)
    if not source_path.exists():
        raise SystemExit(f"source image not found: {source_path}")

    source = load_rgba(source_path)
    if source.width != source.height:
        print(f"[warn] source is {source.width}x{source.height}; centering on a square")
        source = pad_square(source)
    print(f"[in]  {source_path.name} {source.width}x{source.height}")

    ASSETS.mkdir(parents=True, exist_ok=True)

    app_icon = build_app_icon(source)
    app_icon.save(ASSETS / "app-icon.png")
    print(f"[out] assets/app-icon.png      {app_icon.width}x{app_icon.height} squircle + shadow")

    cutout = white_to_alpha(source)
    box = alpha_bbox(cutout)
    tight = cutout.crop(box)
    print(f"[mid] white -> alpha, ink bbox {box} -> {tight.width}x{tight.height}")

    hero = pad_square(add_padding(tight, 0.10))
    hero.resize((1024, 1024), Image.LANCZOS).save(ASSETS / "hero-mark.png")
    print(f"[out] assets/hero-mark.png     {hero.width}x{hero.height} (10% padding)")

    sidebar_mark = pad_square(add_padding(tight, 0.02)).resize((512, 512), Image.LANCZOS)
    sidebar_mark.save(ASSETS / "sidebar-mark.png")
    print(f"[out] assets/sidebar-mark.png  {sidebar_mark.width}x{sidebar_mark.height} (avatar crop)")

    sidebar_name = tight.copy()
    sidebar_name.thumbnail((720, 360), Image.LANCZOS)
    sidebar_name.save(ASSETS / "sidebar-name.png")
    print(f"[out] assets/sidebar-name.png  {sidebar_name.width}x{sidebar_name.height} (tight crop)")


if __name__ == "__main__":
    main()
