#!/usr/bin/env python3
"""
Build assets/player.png (the game's sprite sheet) from individual pose images.

Put your AI-generated pose images in one folder, named:
    idle1.png  idle2.png  run1.png  run2.png  run3.png  run4.png  jump.png  fall.png
(.jpg / .webp work too). Only idle1 is required; any missing pose is filled in
from a similar one so you can start small:  idle1, run1, run2, jump  is enough.

Usage:
    python3 tools/make_sheet.py my_poses/
    python3 tools/make_sheet.py my_poses/ --bg "#ff00ff" --tol 60
    python3 tools/make_sheet.py my_poses/ --size 64 --out assets/player.png

What it does for every pose:
  1. removes the plain background (colour taken from the image corners, or --bg)
  2. crops to the character
  3. scales ALL poses with the SAME scale (so he doesn't grow/shrink between frames)
  4. puts his feet on the same line, centred, inside a 64x64 cell
Then it joins the 8 cells into one row and also writes a x4 preview.

Needs:  pip install pillow
"""
import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ORDER = ["idle1", "idle2", "run1", "run2", "run3", "run4", "jump", "fall"]
# if a pose is missing, try these (in order)
FALLBACK = {
    "idle2": ["idle1"],
    "run1": ["idle1"],
    "run2": ["run1"],
    "run3": ["run1"],
    "run4": ["run2"],
    "jump": ["run2", "run1", "idle1"],
    "fall": ["jump", "run2", "idle1"],
}
EXTS = [".png", ".jpg", ".jpeg", ".webp"]


def find(folder: Path, name: str):
    for ext in EXTS:
        for cand in (folder / f"{name}{ext}", folder / f"{name.upper()}{ext}"):
            if cand.exists():
                return cand
    return None


def parse_color(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def remove_bg(img: Image.Image, bg, tol):
    """Flood-fill the background from the four corners so colours INSIDE the
    character (e.g. a white shirt on a white background) are left alone."""
    img = img.convert("RGBA")
    # already has real transparency? keep it.
    if img.getchannel("A").getextrema()[0] < 250:
        return img
    w, h = img.size
    if bg is None:
        corners = [img.getpixel(p)[:3] for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
        bg = max(set(corners), key=corners.count)
    marker = (255, 0, 255, 0)
    for pt in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        px = img.getpixel(pt)[:3]
        if sum(abs(a - b) for a, b in zip(px, bg)) <= tol * 3:
            ImageDraw.floodfill(img, pt, marker, thresh=tol)
    px = img.load()
    # A bold key colour (magenta, green...) can't appear in the character, so
    # also clear enclosed pockets (e.g. between an arm and the head). A pale
    # background like white is NOT cleared globally, so white shirts stay safe.
    saturated = max(bg) - min(bg) > 100
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                px[x, y] = (0, 0, 0, 0)
            elif saturated and abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) <= tol * 3:
                px[x, y] = (0, 0, 0, 0)
    return img


def bbox(img):
    return img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", help="folder with pose images")
    ap.add_argument("--out", default="assets/player.png")
    ap.add_argument("--size", type=int, default=64, help="cell size in px (default 64)")
    ap.add_argument("--bg", default=None, help='background colour to remove, e.g. "#ff00ff" (default: auto)')
    ap.add_argument("--tol", type=int, default=45, help="background tolerance 0-255 (default 45)")
    ap.add_argument("--pad", type=int, default=2, help="empty px under the feet (default 2, matches config.js footPad)")
    ap.add_argument("--margin", type=int, default=2, help="empty px left/right/top (default 2)")
    ap.add_argument("--nearest", action="store_true", help="hard pixel edges (only if your source is already true pixel art)")
    args = ap.parse_args()

    folder = Path(args.folder)
    if not folder.is_dir():
        sys.exit(f"Folder not found: {folder}")
    bg = parse_color(args.bg) if args.bg else None

    # load what exists
    raw = {}
    for name in ORDER:
        p = find(folder, name)
        if p:
            raw[name] = p
    if "idle1" not in raw:
        sys.exit("idle1.png is required (the standing pose).")

    # resolve fallbacks
    src = {}
    for name in ORDER:
        if name in raw:
            src[name] = raw[name]
            continue
        for alt in FALLBACK.get(name, []):
            if alt in src:
                src[name] = src[alt]
                print(f"  note: {name} missing -> reusing {alt}")
                break

    # clean + crop each unique file once
    cleaned = {}
    for path in set(src.values()):
        im = remove_bg(Image.open(path), bg, args.tol)
        bb = bbox(im)
        if not bb:
            sys.exit(f"{path.name}: nothing left after background removal. Try --bg or a bigger --tol.")
        cleaned[path] = im.crop(bb)

    # one shared scale so every pose is the same size. Based on the tallest pose
    # (idle/run) but the widest pose must fit too.
    S = args.size
    avail_h = S - args.pad - args.margin
    avail_w = S - 2 * args.margin
    scale = min(min(avail_h / im.height, avail_w / im.width) for im in cleaned.values())
    print(f"  scale = {scale:.3f}")

    resample = Image.NEAREST if args.nearest else Image.LANCZOS
    sheet = Image.new("RGBA", (S * len(ORDER), S), (0, 0, 0, 0))
    for i, name in enumerate(ORDER):
        im = cleaned[src[name]]
        nw, nh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
        im = im.resize((nw, nh), resample)
        # snap semi-transparent edge pixels to crisp on/off so it looks like pixel art
        a = im.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
        im.putalpha(a)
        x = i * S + (S - nw) // 2
        y = S - args.pad - nh
        sheet.alpha_composite(im, (x, y))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    prev = sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST)
    bgc = Image.new("RGBA", prev.size, (60, 50, 90, 255))
    bgc.alpha_composite(prev)
    prev_path = out.with_name(out.stem + "_preview.png")
    bgc.save(prev_path)
    print(f"Saved {out}  ({sheet.width}x{sheet.height})  and preview {prev_path}")
    print("Check the preview: same size in every frame, feet on one line, no background halo.")


if __name__ == "__main__":
    main()
