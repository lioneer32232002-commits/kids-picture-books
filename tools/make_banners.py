"""Render the Facebook banners with headless Chrome.

Needs the local server (python -m http.server 8080 at the repo root) running.
Outputs banners/<book>-fb.jpg (1200x630) and banners/<book>-square.jpg (1080x1080).
usage: python tools/make_banners.py
"""
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = ROOT / "banners"
JOBS = [
    ("dino", "wide", "dinosaurs-fb", (1200, 630)),
    ("dino", "square", "dinosaurs-square", (1080, 1080)),
    ("planet", "wide", "planets-fb", (1200, 630)),
    ("planet", "square", "planets-square", (1080, 1080)),
    ("immune", "wide", "immune-fb", (1200, 630)),
    ("immune", "square", "immune-square", (1080, 1080)),
]


def main():
    OUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for book, size, name, (w, h) in JOBS:
            png = Path(tmp) / f"{name}.png"
            url = f"http://localhost:8080/tools/banners/banner.html?book={book}&size={size}"
            subprocess.run([
                CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                f"--user-data-dir={tmp}/profile", "--force-device-scale-factor=1",
                f"--window-size={w},{h}", "--virtual-time-budget=6000",
                f"--screenshot={png}", url,
            ], check=True, capture_output=True, timeout=90)
            im = Image.open(png).convert("RGB").crop((0, 0, w, h))
            im.save(OUT / f"{name}.jpg", quality=90, optimize=True, progressive=True)
            print(name, im.size, (OUT / f"{name}.jpg").stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
