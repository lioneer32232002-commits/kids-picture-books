# Tap & Learn Picture Books

Two free, interactive English science picture books for kids aged 5–7.

- **Where Did the Dinosaurs Go?** — `dinosaurs/`
- **Are We There Yet? A Trip to the Planets** — `planets/`

Live: https://lioneer32232002-commits.github.io/kids-picture-books/

## Structure

| Path | What |
|------|------|
| `assets/book.js`, `assets/book.css` | Shared engine: paging, swipe, read-aloud (Web Speech), synthesized sound effects (Web Audio), particle FX (fire, explosions, ash/snow/stars weather) |
| `dinosaurs/`, `planets/` | One `index.html` per book + `img/` (WebP pages and cut-out sprites) |
| `banners/` | Facebook banners: `*-fb.jpg` 1200×630 (link/ad), `*-square.jpg` 1080×1080 (feed post) |
| `tools/process_images.py` | Raw Gemini images in `_raw/` (not committed) → WebP pages + transparent sprites |
| `tools/make_banners.py` | Renders banners from `tools/banners/banner.html` with headless Chrome (needs `python -m http.server 8080`) |

Illustrations generated with Google Gemini.
