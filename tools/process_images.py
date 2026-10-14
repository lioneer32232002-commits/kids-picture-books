"""Convert raw Gemini downloads (_raw/) into web-ready assets.

Pages  -> <book>/img/pNN.webp  (1600px wide, WebP)
Sprites-> <book>/img/<name>.png (white background removed by edge flood-fill)

usage: python tools/process_images.py
"""
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "_raw"

BOOKS = {"dino": "dinosaurs", "planet": "planets", "immune": "immune"}
# sprite name -> max size (px)
SPRITES = {"asteroid": 360}
# sprite sheets cut into boxes: name -> {out_name: (l, t, r, b) as fractions}
_c = lambda col, row: (col / 3, row / 3, (col + 1) / 3, (row + 1) / 3)
SHEETS: dict = {
    "planets": {
        "mercury": (_c(0, 0), 220), "venus": (_c(1, 0), 220), "earth": (_c(2, 0), 220),
        "moon": (_c(0, 1), 220), "mars": (_c(1, 1), 220), "jupiter": (_c(2, 1), 220),
        "saturn": (_c(0, 2), 260), "uranus": (_c(1, 2), 220), "neptune": (_c(2, 2), 220),
    },
    "vehicles": {"jet": ((0, 0, .5, 1), 320), "rocket": ((.5, 0, 1, 1), 320)},
    # immune book: 2x2 heroes, 3x2 viruses (labels under each are dropped: largest blob wins), 4x3 foods
    "heroes": {n: ((c / 2, r / 2, (c + 1) / 2, (r + 1) / 2), 300) for n, c, r in
               [("neo", 0, 0), ("max", 1, 0), ("bella", 0, 1), ("tcell", 1, 1)]},
    "viruses": {n: ((c / 3, r / 2, (c + 1) / 3, (r + 1) / 2), 220 if n != "mega" else 300) for n, c, r in
                [("sniffle", 0, 0), ("zippy", 1, 0), ("flu", 2, 0), ("tummy", 0, 1), ("armor", 1, 1), ("mega", 2, 1)]},
    "foods": {n: ((c / 4, r / 3, (c + 1) / 4, (r + 1) / 3), 160) for n, c, r in
              [("orange", 0, 0), ("strawberry", 1, 0), ("kiwi", 2, 0), ("pepper", 3, 0),
               ("carrot", 0, 1), ("broccoli", 1, 1), ("spinach", 2, 1), ("sweetpotato", 3, 1),
               ("peas", 0, 2), ("banana", 1, 2), ("lollipop", 2, 2), ("soda", 3, 2)]},
}
# sprites that must face right but were drawn facing left
FLIP = {"rocket"}


def page(src: Path, dst: Path, width=1600):
    im = Image.open(src).convert("RGB")
    width = min(width, im.width)
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)
    im.save(dst, "WEBP", quality=80, method=6)


def cutout(im: Image.Image, tol=38, crop=True) -> Image.Image:
    """Remove near-white background connected to the image border."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()

    def bg(x, y):
        r, g, b, _ = px[x, y]
        return r > 255 - tol and g > 255 - tol and b > 255 - tol and max(r, g, b) - min(r, g, b) < 28

    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i] or not bg(x, y):
            continue
        seen[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    mask = Image.frombytes("L", (w, h), bytes(0 if s else 255 for s in seen))
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    im.putalpha(mask)
    return im.crop(im.getbbox()) if crop else im


def sheet_sprites(src: Path, out_dir: Path, parts: dict):
    """Cut a sticker sheet by connected components (so rings that cross the
    grid lines stay whole); each blob goes to the part whose box holds its centre."""
    import numpy as np
    from scipy import ndimage

    im = Image.open(src).convert("RGB")
    im.thumbnail((1400, 1400))
    full = cutout(im, crop=False)
    alpha = np.array(full.getchannel("A")) > 40
    labels, n = ndimage.label(alpha)
    sizes = ndimage.sum(alpha, labels, range(1, n + 1))
    W, H = full.size
    for name, (box, size) in parts.items():
        l, t, r, b = box
        best, best_size = None, 0
        for i in range(n):
            if sizes[i] < 2000:
                continue
            ys, xs = np.nonzero(labels == i + 1)
            cx, cy = xs.mean() / W, ys.mean() / H
            if l <= cx < r and t <= cy < b and sizes[i] > best_size:
                best, best_size = i + 1, sizes[i]
        mask = Image.fromarray(((labels == best) * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1))
        a = Image.fromarray(np.minimum(np.array(mask), np.array(full.getchannel("A"))))
        piece = full.copy(); piece.putalpha(a)
        piece = piece.crop(piece.getbbox())
        piece.thumbnail((size, size), Image.LANCZOS)
        if name in FLIP:
            piece = piece.transpose(Image.FLIP_LEFT_RIGHT)
        piece.save(out_dir / f"{name}.webp", "WEBP", quality=88, method=6)
        print("sprite", src.stem, name)


def sprite(src: Path, dst: Path, size: int, box=None, flip=False):
    im = Image.open(src).convert("RGB")
    if box:
        l, t, r, b = box
        im = im.crop((int(l * im.width), int(t * im.height), int(r * im.width), int(b * im.height)))
    # work at reduced size for speed
    im.thumbnail((size * 2, size * 2))
    out = cutout(im)
    out.thumbnail((size, size), Image.LANCZOS)
    if flip:
        out = out.transpose(Image.FLIP_LEFT_RIGHT)
    out.save(dst, "WEBP", quality=88, method=6)


def main():
    for key, folder in BOOKS.items():
        src_dir = RAW / key
        if not src_dir.exists():
            continue
        out = ROOT / folder / "img"
        out.mkdir(parents=True, exist_ok=True)
        for f in sorted(src_dir.glob("p[0-9][0-9].jpg")) + sorted(src_dir.glob("map[0-9].jpg")):
            page(f, out / (f.stem + ".webp"))
            print("page", f.name)
        for name, size in SPRITES.items():
            f = src_dir / f"{name}.jpg"
            if f.exists():
                sprite(f, out / f"{name}.webp", size)
                print("sprite", name)
        for sheet, parts in SHEETS.items():
            f = src_dir / f"{sheet}.jpg"
            if f.exists():
                sheet_sprites(f, out, parts)


if __name__ == "__main__":
    main()
