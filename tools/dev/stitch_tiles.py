"""Stitch screenshot tiles of one Gemini image back into a single picture.

Used with tools/dev/gemini_capture.js when Chrome blocks Gemini downloads:
the image is shown full-size in the page and captured in vertical tiles.

usage:
  python tools/dev/stitch_tiles.py OUT.jpg H_CSS [w=CSS_WIDTH] [--dir=FOLDER] tile1.jpg:TOP1 tile2.jpg:TOP2 ...

  H_CSS     height of the displayed image in CSS px (returned by __grab)
  w=        CSS width the image was displayed at (default 1900)
  --dir=    folder holding the saved screenshots (the session's tool-results folder)
  TOPn      CSS offset returned by __tile(n)

Screenshots are 1568 px wide for a 1920 CSS px viewport, hence the 1568/1920 factor.
"""
import sys
from pathlib import Path

from PIL import Image

args = sys.argv[1:]
out, H = args[0], float(args[1])
args = args[2:]
css_w, folder = 1900.0, Path(".")
while args and (args[0].startswith("w=") or args[0].startswith("--dir=")):
    a = args.pop(0)
    if a.startswith("w="):
        css_w = float(a[2:])
    else:
        folder = Path(a[6:])
f = 1568 / 1920
W, Ht = round(css_w * f), round(H * f)
canvas = Image.new("RGB", (W, Ht))
for arg in args:
    name, top = arg.rsplit(":", 1)
    im = Image.open(folder / name).convert("RGB")
    canvas.paste(im.crop((0, 0, W, im.height)), (0, round(float(top) * f)))
canvas.save(out, quality=95)
print(out, canvas.size)
