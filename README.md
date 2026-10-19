# Tap & Learn Picture Books

Free, interactive English science picture books for kids aged 5–7.

- **Where Did the Dinosaurs Go?** — `dinosaurs/`
- **Are We There Yet? A Trip to the Planets** — `planets/` + `planets/space.html` (Space Clean-Up! vertical shooter, 8 levels, hangar upgrades)
- **Body Defenders: Veggie Power!** — `immune/` (story) + `immune/play.html` (Phaser 3 tower defense, 8 levels + endless)
- **The Car That Blasts Air** — `aircar/` (action and reaction behind Tesla's 2026 Roadster: hop, zoom, soft landing, suction fan) + `aircar/play.html` (Blast Racer!, Phaser 3 side-view racer with loops, corkscrews and an upside-down road, 8 tracks + Endless Rally)
- **Why Do Airplanes Fly?** — `flight/` (four forces, how a wing makes lift, take-off, thrust, steering and landing with Lin and Poppy) + `flight/play.html` (Sky Pilot!, a kids' cockpit flight simulator: real-style six-pack instruments, stick, throttle, flaps, gear lever; 8 missions + Free Flight)
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
| `aircar/sim.js` | Blast Racer! physics and tracks with no drawing (runs in Node too): the car rides a track surface or flies; loops only hold you if you're fast or sticking. Also the bot that sets Dash's racing line |
| `aircar/game.js` | Blast Racer! scenes (Phaser 3). `?unlock=1`, `?timer=1`, `?speed=3`. `tools/dev/puff_autopilot.js` steps it frame by frame |
| `flight/sim.js` | Sky Pilot! flight physics, islands, runways and missions with no drawing (runs in Node). Lift = speed² × wing tilt, flaps, gear drag, a stall-protecting fly-by-wire stick. Also the autopilot bot |
| `flight/game.js` | Sky Pilot! scenes (Phaser 3). Hand-made 3D: a camera projects sea, islands, runways and billboards (clouds, cloud rings, trees, balloons); the cockpit panel is drawn on top. `?unlock=1`, `?timer=1`, `?speed=3`. `node tools/dev/flight_autopilot.js` flies every mission |
| `tools/dev/` | Helpers: Gemini in-page capture + tile stitching (when Chrome blocks downloads), contact sheets, auto-play bots for balancing the games (`current_autopilot.js` steps the game frame by frame, so it works in hidden tabs) |
| `tools/make_banners.py` | Renders banners from `tools/banners/banner.html` with headless Chrome (needs `python -m http.server 8080`). `python tools/make_banners.py currents` renders one book only |

Illustrations generated with Google Gemini.
