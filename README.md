# Tap & Learn Picture Books

Free, interactive English science picture books for kids aged 5–7.

- **Where Did the Dinosaurs Go?** — `dinosaurs/`
- **Are We There Yet? A Trip to the Planets** — `planets/` + `planets/space.html` (Space Clean-Up! vertical shooter, 8 levels, hangar upgrades)
- **Body Defenders: Veggie Power!** — `immune/` (story) + `immune/play.html` (Phaser 3 tower defense, 8 levels + endless)
- **Rivers in the Sea** — `currents/` (ocean currents around Taiwan, with a season map) + `currents/play.html` (Ride the Current!, Phaser 3 flow-field swimming game, 8 trips + Endless Kuroshio)

Live: https://lioneer32232002-commits.github.io/kids-picture-books/

Art style, characters, writing and game-design rules: see **`STYLE.md`**.

## Structure

| Path | What |
|------|------|
| `assets/book.js`, `assets/book.css` | Shared engine: paging, swipe, read-aloud (Web Speech), synthesized sound effects (Web Audio), particle FX (fire, explosions, ash/snow/stars weather) |
| `dinosaurs/`, `planets/` | One `index.html` per book + `img/` (WebP pages and cut-out sprites) |
| `banners/` | Facebook banners: `*-fb.jpg` 1200×630 (link/ad), `*-square.jpg` 1080×1080 (feed post) |
| `tools/process_images.py` | Raw Gemini images in `_raw/` (not committed) → WebP pages + transparent sprites |
| `immune/game.js` | Tower defense game (Phaser 3 from jsDelivr). `?unlock=1` unlocks all levels; `?timer=1` runs the loop on setTimeout for automated testing |
| `planets/space.js` | Space Clean-Up! shooter (Phaser 3). Same `?unlock=1` / `?timer=1` test flags. Friendly aliens can't be hit by design |
| `currents/geo.js` | Simplified map of Taiwan's seas (coastlines, currents by season, places) shared by the book's SVG map and the game's mini-map |
| `currents/game.js` | Ride the Current! (Phaser 3). The sea is a flow field (current lanes + eddies) that moves Mo and everything floating. `?unlock=1`, `?timer=1`, `?speed=3` (test runs) |
| `tools/dev/` | Helpers: Gemini in-page capture + tile stitching (when Chrome blocks downloads), contact sheets, auto-play bots for balancing the games (`current_autopilot.js` steps the game frame by frame, so it works in hidden tabs) |
| `tools/make_banners.py` | Renders banners from `tools/banners/banner.html` with headless Chrome (needs `python -m http.server 8080`). `python tools/make_banners.py currents` renders one book only |

Illustrations generated with Google Gemini.
