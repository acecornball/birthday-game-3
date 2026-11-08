#!/usr/bin/env python3
"""Draws the home-screen icons (a birthday cake). Run: python3 tools/make_icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw


def draw(size):
    s = size / 192
    im = Image.new("RGBA", (size, size), (31, 42, 90, 255))
    d = ImageDraw.Draw(im)
    # sparkles
    for x, y, r in [(30, 40, 4), (160, 30, 5), (150, 120, 3), (24, 120, 3), (96, 18, 3)]:
        d.ellipse([(x - r) * s, (y - r) * s, (x + r) * s, (y + r) * s], fill=(255, 255, 255, 255))
    def rr(box, fill, r=10):
        d.rounded_rectangle([v * s for v in box], radius=r * s, fill=fill)
    rr((28, 120, 164, 160), (94, 58, 46, 255))           # base
    rr((38, 90, 154, 128), (240, 160, 60, 255))         # middle
    rr((52, 62, 140, 98), (245, 241, 232, 255))         # top
    for i in range(7):                                   # drips
        d.rectangle([(54 + i * 13) * s, 94 * s, (62 + i * 13) * s, (100 + (i % 2) * 6) * s], fill=(240, 160, 60, 255))
    cols = [(229, 72, 58), (240, 160, 60), (98, 184, 234), (63, 174, 90), (155, 224, 90), (245, 241, 232), (63, 111, 180)]
    for i, c in enumerate(cols):                         # 7 candles
        x = 58 + i * 12.8
        d.rectangle([(x - 2.5) * s, 38 * s, (x + 2.5) * s, 62 * s], fill=c + (255,))
        d.ellipse([(x - 4) * s, 24 * s, (x + 4) * s, 40 * s], fill=(255, 176, 46, 255))
        d.ellipse([(x - 2) * s, 29 * s, (x + 2) * s, 38 * s], fill=(255, 243, 160, 255))
    return im


out = Path(__file__).resolve().parent.parent / "assets"
out.mkdir(exist_ok=True)
for n in (192, 512):
    draw(n).save(out / f"icon-{n}.png")
    print("wrote", out / f"icon-{n}.png")
