"""Convert raw Gemini downloads (_raw/) into web-ready assets.

Pages  -> <book>/img/pNN.webp  (1600px wide, WebP)
Sprites-> <book>/img/<name>.png (white background removed by edge flood-fill)

usage: python tools/process_images.py          (every book)
       python tools/process_images.py flight   (one _raw/ folder only)
"""
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "_raw"

BOOKS = {"dino": "dinosaurs", "planet": "planets", "immune": "immune", "space": "planets", "currents": "currents", "aircar": "aircar", "flight": "flight", "tsa": "songshan", "paris": "paris"}
# sprite name -> max size (px)
SPRITES = {"asteroid": 360, "boss": 520, "tower": 760}
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
    # space clean-up game (planets book)
    "junk": {n: ((c / 3, r / 3, (c + 1) / 3, (r + 1) / 3), 200) for n, c, r in
             [("sat", 0, 0), ("panel", 1, 0), ("bolt", 2, 0), ("tank", 0, 1), ("glove", 1, 1), ("wrench", 2, 1),
              ("camera", 0, 2), ("dish", 1, 2), ("cables", 2, 2)]},
    "rocks": {"rock_big": ((0, 0, 1 / 3, .5), 280), "rock_med": ((1 / 3, 0, 2 / 3, .5), 200), "rock_small": ((2 / 3, 0, 1, .4), 120),
              "rock_metal": ((0, .5, 1 / 3, 1), 240), "ice": ((1 / 3, .5, 2 / 3, 1), 140), "comet": ((2 / 3, .4, 1, 1), 380)},
    "items": {n: ((c / 3, r / 2, (c + 1) / 3, (r + 1) / 2), 220) for n, c, r in
              [("ufo", 0, 0), ("buddy", 1, 0), ("shield", 2, 0), ("dust", 0, 1), ("magnet", 1, 1), ("power", 2, 1)]},
    # damaged meteors = the game's mid/large "enemy ships" (the big one has a broken second stage)
    "cracks": {"crack_m": ((0, 0, .5, .5), 300), "crack_l": ((.5, 0, 1, .5), 420),
               "crack_l2": ((0, .5, .5, 1), 420), "crack_ice": ((.5, .5, 1, 1), 300)},
    # ocean currents book + Ride the Current! game (top-down sprites point up)
    "cast": {n: ((c / 3, r / 2, (c + 1) / 3, (r + 1) / 2), s) for n, c, r, s in
             [("kai", 0, 0, 320), ("mo", 1, 0, 320), ("mo_top", 2, 0, 240),
              ("pal", 0, 1, 240), ("dolphin", 1, 1, 240), ("flyfish", 2, 1, 220)]},
    "sea": {n: ((c / 3, r / 2, (c + 1) / 3, (r + 1) / 2), s) for n, c, r, s in
            [("mullet", 0, 0, 150), ("seagrass", 1, 0, 160), ("shell", 2, 0, 120),
             ("bag", 0, 1, 160), ("bottle", 1, 1, 140), ("net", 2, 1, 220)]},
    "big": {"boat": ((0, 0, .5, .5), 300), "bignet": ((.5, 0, 1, .5), 460),
            "log": ((0, .5, .5, 1), 260), "sargassum": ((.5, .5, 1, 1), 240)},
    # air car book + Blast Racer! (side-view sprites face right)
    "sheet_cast": {n: ((c / 3, r / 2, (c + 1) / 3, (r + 1) / 2), s) for n, c, r, s in
                   [("zip", 0, 0, 360), ("dash", 1, 0, 360), ("rio", 2, 0, 300),
                    ("drone", 0, 1, 240), ("pump", 1, 1, 300), ("truck", 2, 1, 420)]},
    "cone": {"cone": ((0, 0, .5, 1), 160)},
    # airplane book + Sky Pilot! (side views face right)
    "sheet_flight": {n: ((c / 3, r / 2, (c + 1) / 3, (r + 1) / 2), s) for n, c, r, s in
                     [("lin", 0, 0, 320), ("poppy", 1, 0, 400), ("poppy_front", 2, 0, 400),
                      ("jet", 0, 1, 420), ("cloud", 1, 1, 256), ("balloon", 2, 1, 260)]},
    "islands": {n: ((c / 3, r / 2, (c + 1) / 3, (r + 1) / 2), 440) for n, c, r in
                [("is_lanyu", 0, 0), ("is_green", 1, 0), ("is_turtle", 2, 0),
                 ("is_penghu", 0, 1), ("is_harbor", 1, 1), ("is_palm", 2, 1)]},
}
# per-book sheets that reuse a sheet name (Songshan Airport book + Sky Rescue!: side views face right, top-down views point up)
SHEETS_BY_BOOK = {
    "tsa": {
        "sheet_cast": {n: ((c / 3, r / 2, (c + 1) / 3, (r + 1) / 2), s) for n, c, r, s in
                       [("anan", 0, 0, 320), ("jetty", 1, 0, 420), ("jetty_top", 2, 0, 300),
                        ("whirly", 0, 1, 400), ("whirly_top", 1, 1, 300), ("ambulance", 2, 1, 320)]},
        "sheet_items": {n: ((c / 3, r / 2, (c + 1) / 3, (r + 1) / 2), s) for n, c, r, s in
                        [("storm", 0, 0, 360), ("cloud", 1, 0, 320), ("gulls", 2, 0, 220),
                         ("nurse", 0, 1, 260), ("grandma", 1, 1, 300), ("cooler", 2, 1, 160)]},
    },
    # Paris book + Cathedral Builders! (4 x 2 sheet; the gargoyle spout faces right)
    "paris": {
        "sheet_paris": {n: ((c / 4, r / 2, (c + 1) / 4, (r + 1) / 2), s) for n, c, r, s in
                        [("lea", 0, 0, 340), ("gus", 1, 0, 300), ("garg", 2, 0, 220), ("pigeon", 3, 0, 160),
                         ("window", 0, 1, 320), ("rooster", 1, 1, 200), ("cloud", 2, 1, 340), ("lea_wave", 3, 1, 340)]},
    },
}
# sprites that must face right but were drawn facing left
FLIP = {"rocket", "ambulance", "jetty"}
# sprites made of several blobs (a cloud and its lightning bolt, a flock of birds): keep every blob in the box
MULTI = {"storm", "gulls"}
# see-through sprites (nets): white holes inside the shape are cleared too
HOLES = {"net", "bignet"}


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
        best, best_size, keep = None, 0, []
        for i in range(n):
            if sizes[i] < 2000:
                continue
            ys, xs = np.nonzero(labels == i + 1)
            cx, cy = xs.mean() / W, ys.mean() / H
            if l <= cx < r and t <= cy < b:
                keep.append(i + 1)
                if sizes[i] > best_size:
                    best, best_size = i + 1, sizes[i]
        sel = np.isin(labels, keep) if name in MULTI else (labels == best)
        mask = Image.fromarray((sel * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1))
        a = Image.fromarray(np.minimum(np.array(mask), np.array(full.getchannel("A"))))
        if name in HOLES:
            rgb = np.array(full.convert("RGB")).astype(int)
            white = (rgb.min(axis=2) > 222) & (rgb.max(axis=2) - rgb.min(axis=2) < 28)
            a = Image.fromarray(np.where(white, 0, np.array(a)).astype("uint8"))
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
    import sys
    only = sys.argv[1:]
    for key, folder in BOOKS.items():
        if only and key not in only:
            continue
        src_dir = RAW / key
        if not src_dir.exists():
            continue
        out = ROOT / folder / "img"
        out.mkdir(parents=True, exist_ok=True)
        for f in sorted(src_dir.glob("p[0-9][0-9].jpg")) + sorted(src_dir.glob("p[0-9][0-9]b.jpg")) + sorted(src_dir.glob("map[0-9].jpg")) + sorted(src_dir.glob("bg_*.jpg")):
            page(f, out / (f.stem + ".webp"))
            print("page", f.name)
        for name, size in SPRITES.items():
            f = src_dir / f"{name}.jpg"
            if f.exists():
                sprite(f, out / f"{name}.webp", size)
                print("sprite", name)
        for sheet, parts in {**SHEETS, **SHEETS_BY_BOOK.get(key, {})}.items():
            f = src_dir / f"{sheet}.jpg"
            if f.exists():
                sheet_sprites(f, out, parts)


if __name__ == "__main__":
    main()
