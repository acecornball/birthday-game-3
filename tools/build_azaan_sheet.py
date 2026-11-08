#!/usr/bin/env python3
"""
Turns source/azaan_sprite_sheet.png (a grid of AI-made pixel-art poses with a
fake checkerboard background) into assets/player.png: one clean row of 32x32
frames, true pixel size, transparent background, feet and head lined up.

    python3 tools/build_azaan_sheet.py

Re-run it if you replace the source sheet. If your new sheet has a different
layout, edit GRID_ROWS and FRAMES below. Needs: pip install pillow numpy
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "source" / "azaan_sprite_sheet.png"
OUT = ROOT / "assets" / "player.png"

GRID_COLS = 6
GRID_ROWS = 9
ROW_COUNTS = [4, 4, 6, 2, 2, 2, 4, 6, 4]   # how many sprites are in each row
ART_PX = 5                                  # one art pixel = 5x5 pixels in the sheet
CELL = 32                                   # output frame size (art pixels)
FOOT_PAD = 1                                # empty rows under the feet (config.js footPad)
BG_COLORS = [(200, 230, 250), (225, 242, 255)]  # the two checkerboard colours

# (row, col) in the source sheet, 1-based, in the order they go into player.png
FRAMES = [
    ("idle", 1, 1), ("idle", 1, 2), ("idle-wink", 1, 3),
    ("run", 3, 1), ("run", 3, 2), ("run", 3, 3), ("run", 3, 4), ("run", 3, 5), ("run", 3, 6),
    ("jump-up", 4, 1), ("jump-top", 4, 2),
    ("fall", 5, 1), ("fall2", 5, 2),
    ("glide", 6, 1), ("glide2", 6, 2),
    ("shoot", 7, 1), ("shoot", 7, 2), ("shoot", 7, 3), ("shoot", 7, 4),
    ("cheer", 8, 1), ("cheer", 8, 2), ("cheer", 8, 3), ("cheer", 8, 4), ("cheer", 8, 5), ("cheer", 8, 6),
    ("cheer2", 9, 1), ("cheer2", 9, 2), ("cheer2", 9, 3), ("cheer2", 9, 4),
]


def is_bg(rgb, tol=14):
    return any(sum(abs(int(a) - b) for a, b in zip(rgb, bg)) <= tol for bg in BG_COLORS)


def extract(im, row, col):
    W, H = im.size
    cw, ch = W / GRID_COLS, H / GRID_ROWS
    x0, x1 = round((col - 1) * cw), round(col * cw)
    y0, y1 = round((row - 1) * ch), round(row * ch)
    cell = np.array(im.crop((x0, y0, x1, y1)).convert("RGB")).astype(int)
    bg = np.zeros(cell.shape[:2], bool)
    for c in BG_COLORS:
        bg |= np.abs(cell - np.array(c)).sum(axis=2) <= 14
    ys, xs = np.where(~bg)
    bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    w, h = round((bx1 - bx0) / ART_PX), round((by1 - by0) / ART_PX)
    out = np.zeros((h, w, 4), np.uint8)
    for j in range(h):
        for i in range(w):
            sx, sy = bx0 + i * ART_PX + ART_PX // 2, by0 + j * ART_PX + ART_PX // 2
            sx, sy = min(sx, cell.shape[1] - 1), min(sy, cell.shape[0] - 1)
            if not bg[sy, sx]:
                out[j, i, :3] = cell[sy, sx]
                out[j, i, 3] = 255
    return out


def main_blob(a):
    """Largest 8-connected group of visible pixels = the character (sparkles are separate)."""
    h, w = a.shape[:2]
    seen = np.zeros((h, w), bool)
    best = []
    for sy in range(h):
        for sx in range(w):
            if a[sy, sx, 3] and not seen[sy, sx]:
                q, comp = deque([(sy, sx)]), []
                seen[sy, sx] = True
                while q:
                    y, x = q.popleft()
                    comp.append((y, x))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < h and 0 <= nx < w and a[ny, nx, 3] and not seen[ny, nx]:
                                seen[ny, nx] = True
                                q.append((ny, nx))
                if len(comp) > len(best):
                    best = comp
    return best


def place(a):
    blob = main_blob(a)
    ys = [p[0] for p in blob]
    xs = [p[1] for p in blob]
    top, feet = min(ys), max(ys)
    # horizontal anchor = centre of the head/face rows, so he doesn't jitter between frames
    head = [x for y, x in blob if top + 6 <= y <= top + 11] or xs
    cx = sum(head) / len(head)
    dx = round(CELL / 2 - 0.5 - cx)
    dy = (CELL - FOOT_PAD) - (feet + 1)
    cell = np.zeros((CELL, CELL, 4), np.uint8)
    h, w = a.shape[:2]
    for y in range(h):
        for x in range(w):
            ty, tx = y + dy, x + dx
            if a[y, x, 3] and 0 <= ty < CELL and 0 <= tx < CELL:
                cell[ty, tx] = a[y, x]
    return cell


def main():
    im = Image.open(SRC)
    sheet = np.zeros((CELL, CELL * len(FRAMES), 4), np.uint8)
    for i, (name, r, c) in enumerate(FRAMES):
        sheet[:, i * CELL:(i + 1) * CELL] = place(extract(im, r, c))
    OUT.parent.mkdir(exist_ok=True)
    Image.fromarray(sheet, "RGBA").save(OUT)
    out = Image.open(OUT)
    # x4 preview on a dark background, 10 frames per row
    cols = 10
    rows = (len(FRAMES) + cols - 1) // cols
    prev = Image.new("RGBA", (cols * CELL * 4, rows * CELL * 4), (60, 50, 90, 255))
    for i in range(len(FRAMES)):
        fr = out.crop((i * CELL, 0, (i + 1) * CELL, CELL)).resize((CELL * 4, CELL * 4), Image.NEAREST)
        prev.alpha_composite(fr, ((i % cols) * CELL * 4, (i // cols) * CELL * 4))
    prev.save(OUT.with_name("player_preview.png"))
    print(f"Wrote {OUT} ({out.width}x{out.height}, {len(FRAMES)} frames)")
    for i, (name, r, c) in enumerate(FRAMES):
        print(f"  frame {i:2d}: {name}  (source row {r}, col {c})")


if __name__ == "__main__":
    main()
