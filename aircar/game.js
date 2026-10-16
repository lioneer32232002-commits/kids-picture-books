/* Puff Racer! — Rio's little air car Zip races Dash on a side-view track (Phaser 3).
   Physics and tracks live in sim.js. Three buttons, three real ideas:
   HOP puffs air down (car goes up), ZOOM puffs air back (car goes forward), STICK is a fan that
   sucks air from under the car so it's pressed onto the road, even upside down.
   Nothing gets hurt: bumping a cone or truck just says "Bonk!", and a helper drone fishes Zip out of the water. */
(function () {
  "use strict";
  const W = 1280, H = 720;
  const FONT = '"Baloo 2", "Trebuchet MS", sans-serif';
  const S = (window.Book && Book.sfx) || new Proxy({}, { get: () => () => {} });
  const P = window.PuffSim, LEVELS = P.LEVELS;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const SPEED = parseFloat((location.search.match(/[?&]speed=([\d.]+)/) || [])[1]) || 1;   // test runs only
  const CAR_W = 132;

  /* ------------------------------------------------------------ save */
  const BLANK = () => ({ stars: {}, bolts: 0, up: {}, best: 0, smooth: 0 });
  const save = {
    get() { try { return Object.assign(BLANK(), JSON.parse(localStorage.getItem("pr-save")) || {}); } catch (e) { return BLANK(); } },
    set(v) { try { localStorage.setItem("pr-save", JSON.stringify(v)); } catch (e) {} },
  };
  const GARAGE = [
    { k: "tank", name: "Bigger Tank", desc: "Holds more squeezed air", costs: [40, 110], icon: "bubble" },
    { k: "puff", name: "Puff Power", desc: "Hop and Zoom push harder", costs: [50, 130], icon: "bolt" },
    { k: "soft", name: "Soft Springs", desc: "Land harder without a Bonk", costs: [40, 110], icon: "zip" },
  ];
  const TIPS = [
    "Action and reaction: push air down, go up. Push air back, go forward!",
    "Hold HOP just before you touch down for a smooth landing.",
    "STICK holds Zip on the road, but you can't hop while it's on.",
    "Too slow for a loop? Hold STICK, or ZOOM in fast!",
    "Out of air? Zip's little pump refills the tank while it drives.",
    "Grab 💨 bubbles and AIR pumps to fill your tank.",
  ];

  /* ------------------------------------------------------------ helpers */
  function txt(sc, x, y, s, size, color, opts) {
    return sc.add.text(x, y, s, Object.assign({ fontFamily: FONT, fontSize: size + "px", fontStyle: "800", color: color || "#fff",
      stroke: "#2b2350", strokeThickness: Math.max(3, size / 6), align: "center" }, opts || {})).setOrigin(0.5);
  }
  function button(sc, x, y, w, h, label, fill, onClick, size) {
    const c = sc.add.container(x, y), g = sc.add.graphics();
    const draw = d => { g.clear(); g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, h / 2);
      g.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2 + (d ? 5 : 0), w, h, h / 2);
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(-w / 2 + 10, -h / 2 + 6 + (d ? 5 : 0), w - 20, h * 0.3, h * 0.15); };
    draw(false);
    const t = txt(sc, 0, -2, label, size || 30);
    c.add([g, t]); c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on("pointerdown", () => { draw(true); t.y = 3; c.pressed = true; });
    c.on("pointerup", () => { draw(false); t.y = -2; if (c.pressed) { c.pressed = false; S.tap(); onClick(); } });
    c.on("pointerout", () => { draw(false); t.y = -2; c.pressed = false; });
    c.label = t; return c;
  }
  function fit(img, size) { img.setScale(size / Math.max(img.width, img.height)); return img; }
  function panel(sc, x, y, w, h, color) {
    const g = sc.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x - w / 2, y - h / 2 + 10, w, h, 36);
    g.fillStyle(0xfff8ec, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    g.lineStyle(6, color || 0xff8a3d, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    return g;
  }
  function sky(sc) {
    const t = sc.textures.get("tile_sky").getSourceImage(), s = H / t.height;
    return sc.add.tileSprite(W / 2, H / 2, W, H, "tile_sky").setTileScale(s, s).setScrollFactor(0);
  }

  /* ============================================================ BOOT */
  const ART = ["zip", "dash", "rio", "cone", "truck", "pump", "drone", "bg_sky"];
  class Boot extends Phaser.Scene {
    constructor() { super("boot"); }
    preload() {
      txt(this, W / 2, H / 2 - 60, "Filling up the air tanks...", 40);
      const bar = this.add.graphics();
      this.load.on("progress", v => bar.clear().fillStyle(0xffffff, .3).fillRoundedRect(440, H / 2, 400, 28, 14).fillStyle(0x7fd8ff, 1).fillRoundedRect(440, H / 2, 400 * v, 28, 14));
      ART.forEach(k => this.load.image(k, "img/" + k + ".webp"));
    }
    create() {
      const g = this.make.graphics({ add: false });
      for (let r = 16; r > 0; r--) { g.fillStyle(0xffffff, (1 - r / 16) * 0.5 + 0.1); g.fillCircle(16, 16, r); }
      g.generateTexture("dot", 32, 32); g.clear();
      // air jet streak: a bright core with a cyan glow (thruster-like, not a cloud)
      for (let k = 0; k < 6; k++) { g.fillStyle(k < 3 ? 0x7fe9ff : 0xffffff, [0.12, 0.2, 0.35, 0.6, 0.85, 1][k]); g.fillRoundedRect(k * 3, 7 + k * 1.2, 60 - k * 6, 14 - k * 2.4, (14 - k * 2.4) / 2); }
      g.generateTexture("jet", 60, 28); g.clear();
      // golden bolt (a hex nut)
      const hex = (cx, cy, r) => { const pts = []; for (let i = 0; i < 6; i++) pts.push({ x: cx + r * Math.cos(i * Math.PI / 3), y: cy + r * Math.sin(i * Math.PI / 3) }); return pts; };
      g.fillStyle(0xc98a12, 1).fillPoints(hex(22, 24, 20), true); g.fillStyle(0xffd23f, 1).fillPoints(hex(22, 21, 19), true);
      g.fillStyle(0xfff3b0, 1).fillCircle(16, 15, 4); g.fillStyle(0xb57a0c, 1).fillCircle(22, 21, 7); g.fillStyle(0x8fd3ff, 1).fillCircle(22, 21, 4);
      g.generateTexture("bolt", 44, 46); g.clear();
      // air bubble
      g.fillStyle(0x9fe3ff, 0.45).fillCircle(26, 26, 25); g.lineStyle(4, 0xffffff, 0.95).strokeCircle(26, 26, 22);
      g.fillStyle(0xffffff, 0.95).fillCircle(17, 16, 6); g.fillStyle(0xffffff, 0.6).fillCircle(33, 35, 3);
      g.generateTexture("bubble", 52, 52); g.clear();
      // finish flag
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { g.fillStyle((i + j) % 2 ? 0x2b2350 : 0xffffff, 1).fillRect(i * 16, j * 16, 16, 16); }
      g.generateTexture("checker", 96, 64); g.destroy();
      // stand-ins when an illustration is missing, so the game never breaks
      const fake = (k, w, h, draw) => { if (this.textures.exists(k)) return; const f = this.make.graphics({ add: false }); draw(f); f.generateTexture(k, w, h); f.destroy(); };
      const car = col => f => { f.fillStyle(col, 1).fillRoundedRect(10, 40, 240, 70, 34).fillRoundedRect(70, 10, 120, 60, 30);
        f.fillStyle(0xbfe9ff, 1).fillRoundedRect(86, 20, 88, 36, 16); f.fillStyle(0x2b2350, 1).fillCircle(64, 112, 26).fillCircle(196, 112, 26);
        f.fillStyle(0xffffff, 1).fillCircle(228, 66, 12); f.fillStyle(0x2b2350, 1).fillCircle(231, 66, 6); };
      fake("zip", 260, 140, car(0x5fd6a8)); fake("dash", 260, 140, car(0xff8a3d));
      fake("rio", 160, 220, f => { f.fillStyle(0xff8a3d, 1).fillRoundedRect(40, 90, 80, 100, 30); f.fillStyle(0xffd9b8, 1).fillCircle(80, 60, 44); f.fillStyle(0x4a3424, 1).fillEllipse(80, 30, 96, 44); });
      fake("cone", 80, 96, f => { f.fillStyle(0xff7a2f, 1).fillTriangle(40, 4, 8, 86, 72, 86); f.fillStyle(0xffffff, 1).fillRect(22, 44, 36, 12); f.fillStyle(0xe2611a, 1).fillRoundedRect(0, 82, 80, 14, 6); });
      fake("truck", 260, 140, f => { f.fillStyle(0x4f86f7, 1).fillRoundedRect(0, 20, 180, 90, 14); f.fillStyle(0xffc44d, 1).fillRoundedRect(184, 44, 72, 66, 14);
        f.fillStyle(0xbfe9ff, 1).fillRoundedRect(206, 54, 38, 26, 8); f.fillStyle(0x2b2350, 1).fillCircle(50, 116, 22).fillCircle(140, 116, 22).fillCircle(220, 116, 22); });
      fake("pump", 120, 170, f => { f.fillStyle(0x3fa9f5, 1).fillRoundedRect(20, 20, 80, 140, 18); f.fillStyle(0xffffff, 1).fillCircle(60, 60, 26); f.fillStyle(0x2b2350, 1).fillRect(58, 42, 4, 20); });
      fake("drone", 180, 100, f => { f.fillStyle(0x8a95a5, 1).fillRoundedRect(50, 40, 80, 34, 14); f.fillStyle(0x2b2350, 1).fillRect(20, 30, 140, 8); f.fillStyle(0xc9f0ff, 1).fillEllipse(24, 26, 44, 10).fillEllipse(156, 26, 44, 10); });
      if (!this.textures.exists("bg_sky")) fake("bg_sky", 512, 288, f => { f.fillGradientStyle(0x8fd3ff, 0x8fd3ff, 0xe8f7ff, 0xe8f7ff, 1).fillRect(0, 0, 512, 288);
        f.fillStyle(0xb8e39a, 1).fillEllipse(120, 300, 400, 160).fillEllipse(400, 310, 420, 180); });
      // seamless sky: the painting next to its mirror image
      const img = this.textures.get("bg_sky").getSourceImage();
      const c = this.textures.createCanvas("tile_sky", img.width * 2, img.height), ctx = c.getContext();
      ctx.drawImage(img, 0, 0); ctx.save(); ctx.translate(img.width * 2, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore(); c.refresh();
      this.scene.start("title");
    }
  }

  /* ============================================================ TITLE */
  class Title extends Phaser.Scene {
    constructor() { super("title"); }
    create() {
      this.bg = sky(this);
      const sv = save.get(), all = /[?&]unlock=1/.test(location.search);
      const logo = txt(this, W / 2, 70, "Puff Racer!", 82, "#ffffff", { strokeThickness: 12 });
      this.tweens.add({ targets: logo, y: 78, yoyo: true, repeat: -1, duration: 1300, ease: "Sine.inOut" });
      txt(this, W / 2, 132, "Race Zip, the little car that blasts air!", 28, "#fff1b8");
      const zip = fit(this.add.image(190, 210, "zip"), 210);
      this.tweens.add({ targets: zip, y: 196, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, duration: 700, ease: "Sine.inOut" });
      fit(this.add.image(1090, 210, "rio"), 170);
      txt(this, 1090, 312, "🔩 " + sv.bolts, 30, "#fff1b8");
      LEVELS.forEach((L, i) => {
        const col = i % 4, row = Math.floor(i / 4), x = 205 + col * 290, y = 330 + row * 150;
        const open = all || i === 0 || (sv.stars[i] || 0) > 0, st = sv.stars[i + 1] || 0;
        const c = this.add.container(x, y), g = this.add.graphics();
        g.fillStyle(0x000000, 0.3).fillRoundedRect(-135, -58 + 8, 270, 118, 28);
        g.fillStyle(open ? [0xff8a3d, 0x4f86f7, 0x5ccf6a, 0x9b6cf2][row * 2 + (col >> 1)] : 0x6e7488, 1).fillRoundedRect(-135, -58, 270, 118, 28);
        c.add(g);
        c.add(txt(this, 0, -30, open ? (i + 1) + ". " + L.name : "🔒 Track " + (i + 1), 25));
        c.add(txt(this, 0, 4, open ? { h: "⬆ Hop", hz: "⬆ Hop  ➡ Zoom", hzs: "⬆ ➡ 🌀 All three!" }[L.btn] : "", 18, "#ffffff", { strokeThickness: 4 }));
        c.add(txt(this, 0, 36, open ? "★".repeat(st) + "☆".repeat(3 - st) : "", 28, st ? "#ffd93a" : "#ffffff"));
        if (open) {
          c.setSize(270, 118).setInteractive({ useHandCursor: true });
          c.on("pointerup", () => { S.puff(); this.scene.start("play", { level: i }); });
          c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.05, duration: 100 }));
          c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 100 }));
        }
      });
      const endlessOpen = all || (sv.stars[1] || 0) > 0;
      button(this, 450, 650, 500, 76, endlessOpen ? "∞ Endless Rally" + (sv.best ? "  (best " + sv.best + " m)" : "") : "🔒 Endless: finish track 1",
        endlessOpen ? 0x6c5ce7 : 0x8a95a5, () => { if (endlessOpen) this.scene.start("play", { level: -1 }); else S.oops(); }, 28);
      button(this, 900, 650, 320, 76, "🔧 Garage", 0x5ccf6a, () => this.scene.start("garage"), 30);
    }
    update(t, d) { this.bg.tilePositionX += 30 * d / 1000; }
  }

  /* ============================================================ GARAGE (upgrades) */
  class Garage extends Phaser.Scene {
    constructor() { super("garage"); }
    create() { sky(this); this.draw(); }
    draw() {
      if (this.box) this.box.destroy();
      const sv = save.get(), c = this.box = this.add.container(0, 0);
      c.add(panel(this, W / 2, H / 2, 1000, 640, 0x5ccf6a));
      c.add(txt(this, W / 2, 92, "🔧 Rio's Garage", 50, "#2b2350", { strokeThickness: 0 }));
      c.add(txt(this, W / 2, 142, "Trade bolts for upgrades that last forever!   🔩 " + sv.bolts, 26, "#5b4f73", { strokeThickness: 0 }));
      GARAGE.forEach((u, i) => {
        const y = 240 + i * 125, lvl = sv.up[u.k] || 0, max = lvl >= u.costs.length, cost = u.costs[lvl];
        const g = this.add.graphics(); g.fillStyle(0xffffff, 1).fillRoundedRect(190, y - 52, 900, 104, 26).lineStyle(3, 0xe3dcef, 1).strokeRoundedRect(190, y - 52, 900, 104, 26);
        c.add(g);
        c.add(fit(this.add.image(255, y, u.icon), 74));
        c.add(txt(this, 330, y - 18, u.name + "  " + "●".repeat(lvl) + "○".repeat(u.costs.length - lvl), 30, "#2b2350", { strokeThickness: 0 }).setOrigin(0, 0.5));
        c.add(txt(this, 330, y + 20, u.desc, 22, "#5b4f73", { strokeThickness: 0 }).setOrigin(0, 0.5));
        c.add(button(this, 990, y, 160, 66, max ? "MAX" : "🔩" + cost, max ? 0xa8b3b8 : (sv.bolts >= cost ? 0xff8a3d : 0xa8b3b8), () => {
          if (max) return;
          const s2 = save.get(); if (s2.bolts < cost) { S.oops(); return; }
          s2.bolts -= cost; s2.up[u.k] = lvl + 1; save.set(s2); S.yay(); this.draw();
        }, 28));
      });
      c.add(txt(this, W / 2, 600, "Smooth landings give +2 🔩. Real engineers test and improve their cars again and again!", 21, "#5b4f73", { strokeThickness: 0 }));
      c.add(button(this, W / 2, 660, 280, 70, "◀ Back", 0x4f86f7, () => this.scene.start("title"), 30));
    }
  }

  /* ============================================================ PLAY */
  class Play extends Phaser.Scene {
    constructor() { super("play"); }
    init(d) { this.li = d.level; }
    create() {
      const L = this.L = this.li < 0 ? { name: "Endless Rally", btn: "hzs", endless: true, tip: "Drive as far as you can! Three splashes and the rally is over." } : LEVELS[this.li];
      const sv = this.sv = save.get();
      const T = this.T = P.buildLevel(this.li);
      this.sim = new P.Sim(T, { btn: L.btn, up: sv.up });
      // Dash drives the racing line a careful bot finds, a little slower than the bot
      if (!L.endless) {
        const g = P.run(T, P.bot(), { btn: L.btn, rec: true });
        this.ghost = g.rec; this.dashT = g.t * L.dash;
      }
      this.bg = sky(this);
      this.drawTrack();
      this.makeItems();
      this.puffs = [];
      this.dash = this.ghost ? fit(this.add.image(0, 0, "dash"), CAR_W).setDepth(5) : null;
      this.dashTag = this.dash ? txt(this, 0, 0, "Dash", 20, "#ffe2c8").setDepth(6) : null;
      this.car = fit(this.add.image(0, 0, "zip"), CAR_W).setDepth(7);
      this.carScale = this.car.scaleX;
      this.drone = fit(this.add.image(0, -500, "drone"), 150).setDepth(9).setVisible(false);
      this.fan = this.add.graphics().setDepth(6);
      this.cam = this.cameras.main;
      this.cam.scrollX = -W * 0.3; this.cam.scrollY = T.base - H * 0.62;
      this.hud();
      this.keys = this.input.keyboard.addKeys({ up: "UP", sp: "SPACE", w: "W", right: "RIGHT", d: "D", down: "DOWN", s: "S", sh: "SHIFT" });
      this.input.addPointer(2);
      this.state = "count"; this.clock = 0; this.lastTag = ""; this.toastT = 0; this.sndT = {};
      this.countdown();
    }

    /* ---------------- drawing the track (static, in chunks so only nearby parts are drawn) */
    drawTrack() {
      const T = this.T, CH = 1600, chunks = new Map();
      const gfx = x => { const k = Math.floor(x / CH); if (!chunks.has(k)) chunks.set(k, this.add.graphics().setDepth(2)); return chunks.get(k); };
      const back = new Map();
      const bgfx = x => { const k = Math.floor(x / CH); if (!back.has(k)) back.set(k, this.add.graphics().setDepth(1)); return back.get(k); };
      // water in the gaps
      for (let x = -800; x < T.endX + 1600; x += CH) {
        const g = bgfx(x); g.fillStyle(0x55b8e8, 1).fillRect(x, T.waterY, CH + 2, 900);
        g.fillStyle(0xffffff, 0.5); for (let k = 0; k < CH; k += 90) g.fillEllipse(x + k + 30, T.waterY + 8, 40, 6);
      }
      for (const w of T.ponds) {
        const g = bgfx(w.x0);
        g.fillStyle(0x3fa0dc, 1).fillRect(w.x0 - 4, w.y, w.x1 - w.x0 + 8, T.floorY + 400 - w.y);
        g.fillStyle(0x7fd0f5, 1).fillRect(w.x0 - 4, w.y, w.x1 - w.x0 + 8, 10);
        g.fillStyle(0xffffff, 0.6); for (let k = w.x0 + 20; k < w.x1 - 20; k += 70) g.fillEllipse(k, w.y + 22, 34, 5);
      }
      const first = T.surfs[0].pts[0];
      T.surfs.forEach((S, si) => {
        const pts = S.pts;
        // ground under plain road
        let run = [];
        const flush = () => {
          if (run.length > 1) {
            for (let i = 0; i < run.length - 1; i += 40) {
              const seg = run.slice(i, i + 41), g = bgfx(seg[0].x);
              const poly = seg.map(p => ({ x: p.x, y: p.y + 10 })).concat([{ x: seg[seg.length - 1].x, y: T.floorY + 400 }, { x: seg[0].x, y: T.floorY + 400 }]);
              g.fillStyle(0xd9a86c, 1).fillPoints(poly, true);
              g.fillStyle(0x7ccf5a, 1).fillPoints(seg.map(p => ({ x: p.x, y: p.y + 8 })).concat(seg.slice().reverse().map(p => ({ x: p.x, y: p.y + 30 }))), true);
            }
          }
          run = [];
        };
        for (const p of pts) { if (p.tag === "" || p.tag === "twist") run.push(p); else { flush(); } }
        flush();
        if (si === 0) { const g = bgfx(first.x - 10); g.fillStyle(0xd9a86c, 1).fillRect(first.x - 1600, first.y + 10, 1600, 1600); g.fillStyle(0x7ccf5a, 1).fillRect(first.x - 1600, first.y + 8, 1600, 22); }
        // the road itself: a band whose visible thickness follows the roll
        for (let i = 0; i < pts.length - 1; i++) {
          const p = pts[i], q = pts[i + 1], g = (p.tag === "loop" && i % 2) ? bgfx(p.x) : gfx(p.x);
          const quad = (r) => { const c = Math.cos(r.phi), sn = Math.abs(Math.sin(r.phi)), nx = Math.sin(r.a), ny = -Math.cos(r.a);
            const th = 18 * Math.abs(c) + 46 * sn, mid = -c * 10; return [mid + th / 2, mid - th / 2].map(d => ({ x: r.x + nx * d, y: r.y + ny * d })); };
          const A = quad(p), B = quad(q), sn = Math.abs(Math.sin(p.phi));
          const col = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x4b4f63), Phaser.Display.Color.ValueToColor(0x9aa3c2), 100, sn * 100);
          g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1).fillPoints([A[0], B[0], B[1], A[1]], true);
          // curbs on loops, twists and the upside-down road; lane dashes on plain road
          const cnx = Math.sin(p.a) * Math.cos(p.phi), cny = -Math.cos(p.a) * Math.cos(p.phi);
          if (p.tag && p.tag !== "") {
            g.fillStyle(Math.floor(i / 4) % 2 ? 0xff5a5a : 0xffffff, 1).fillPoints([{ x: p.x, y: p.y }, { x: q.x, y: q.y }, { x: q.x - cnx * 6, y: q.y - cny * 6 }, { x: p.x - cnx * 6, y: p.y - cny * 6 }], true);
          } else if (Math.floor(i / 6) % 3 === 0) {
            g.fillStyle(0xfff6d8, 0.9).fillPoints([{ x: p.x - cnx * 8, y: p.y - cny * 8 }, { x: q.x - cnx * 8, y: q.y - cny * 8 }, { x: q.x - cnx * 11, y: q.y - cny * 11 }, { x: p.x - cnx * 11, y: p.y - cny * 11 }], true);
          }
          // posts: under raised road, above the upside-down road
          if ((p.tag === "rise" || p.tag === "ceil") && i % 22 === 0) {
            const c = Math.cos(p.phi), gb = bgfx(p.x);
            gb.fillStyle(0x8a7fa6, 1);
            if (c > 0) gb.fillRect(p.x - 5, p.y + 14, 10, T.waterY + 40 - p.y);
            else gb.fillRect(p.x - 5, p.y - 520, 10, 506);
          }
        }
      });
      // the upside-down road hangs from a long beam
      T.surfs.forEach(S => {
        const c = S.pts.filter(p => p.tag === "ceil");
        if (c.length) { const g = bgfx(c[0].x); g.fillStyle(0x6f6590, 1).fillRect(c[0].x - 60, c[0].y - 540, c[c.length - 1].x - c[0].x + 120, 34); }
      });
      // finish arch
      const fy = this.T.at(this.T.surfs.length - 1, 0).y, fx = T.finishX;
      const g = gfx(fx);
      g.fillStyle(0x2b2350, 1).fillRect(fx - 8, fy - 280, 16, 280);
      const fl = this.add.tileSprite(fx + 60, fy - 250, 120, 64, "checker").setDepth(3);
      this.tweens.add({ targets: fl, scaleX: 0.92, yoyo: true, repeat: -1, duration: 400 });
      txt(this, fx, fy - 310, "FINISH", 34, "#ffe066").setDepth(3);
      this.chunkList = [...chunks.entries(), ...back.entries()];
    }
    makeItems() {
      this.sprites = [];
      for (const o of this.sim.items) {
        let sp;
        if (o.kind === "bolt") { sp = this.add.image(o.x, o.y, "bolt").setScale(0.9); this.tweens.add({ targets: sp, angle: 360, repeat: -1, duration: 2400 }); }
        else if (o.kind === "bubble") { sp = this.add.image(o.x, o.y, "bubble"); this.tweens.add({ targets: sp, y: o.y - 10, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" }); }
        else if (o.kind === "cone") sp = fit(this.add.image(o.x, o.y + 26, "cone"), 64).setOrigin(0.5, 1);
        else if (o.kind === "truck") sp = fit(this.add.image(o.x, o.y + o.h / 2 + 4, "truck"), o.w + 30).setOrigin(0.5, 1);
        else if (o.kind === "pump") { sp = fit(this.add.image(o.x, o.y + 70, "pump"), 150).setOrigin(0.5, 1); txt(this, o.x, o.y - 100, "AIR", 26, "#bfefff").setDepth(4); }
        sp.setDepth(4); o.spr = sp; this.sprites.push(o);
      }
    }

    /* ---------------- HUD + buttons */
    hud() {
      const ui = [];
      const g = this.add.graphics(); ui.push(g); this.hudG = g;
      ui.push(txt(this, 66, 40, "💨", 34));
      this.boltTxt = txt(this, 380, 40, "🔩 0", 30, "#fff1b8").setOrigin(0, 0.5); ui.push(this.boltTxt);
      this.timeTxt = txt(this, W - 150, 40, "0.0 s", 30).setOrigin(1, 0.5); ui.push(this.timeTxt);
      ui.push(button(this, W - 60, 40, 84, 60, "⌂", 0x4f86f7, () => this.scene.start("title"), 32));
      ui.push(this.toastBox = this.add.graphics()); this.toastBox.setVisible(false);
      ui.push(this.toastTxt = txt(this, W / 2, 128, "", 30, "#2b2350", { strokeThickness: 0, wordWrap: { width: 900 } }).setVisible(false));
      // three big buttons (thumbs): STICK on the left, ZOOM and HOP on the right
      this.btn = {};
      const B = (k, x, y, r, col, icon, label) => {
        const c = this.add.container(x, y), gg = this.add.graphics();
        c.add([gg, txt(this, 0, -10, icon, r * 0.62), txt(this, 0, r * 0.5, label, r * 0.3, "#ffffff", { strokeThickness: 4 })]);
        c.setSize(r * 2, r * 2).setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
        const o = { c, gg, r, col, held: false, pid: -1, on: this.sim.can(k[0]) };
        o.draw = () => { gg.clear(); const a = o.on ? 1 : 0.35, d = o.held ? 4 : 0;
          gg.fillStyle(0x000000, 0.28 * a).fillCircle(0, 6, r); gg.fillStyle(o.on ? col : 0x8a95a5, 0.92 * a).fillCircle(0, d, r);
          gg.lineStyle(5, 0xffffff, 0.85 * a).strokeCircle(0, d, r - 3); };
        o.draw(); c.setAlpha(o.on ? 1 : 0.5);
        c.on("pointerdown", p => { o.held = true; o.pid = p.id; o.draw(); });
        this.btn[k] = o; ui.push(c);
      };
      B("stick", 128, H - 120, 92, 0x9b6cf2, "🌀", "STICK");
      B("zoom", W - 330, H - 100, 86, 0xff8a3d, "➡", "ZOOM");
      B("hop", W - 132, H - 150, 104, 0x3fa9f5, "⬆", "HOP");
      this.input.on("pointerup", p => { for (const k in this.btn) { const o = this.btn[k]; if (o.pid === p.id) { o.held = false; o.pid = -1; o.draw(); } } });
      // progress bar
      ui.push(this.prog = this.add.graphics());
      ui.forEach(o => o.setScrollFactor(0).setDepth(o.depth || 50));
      this.toastBox.setDepth(60); this.toastTxt.setDepth(61);
    }
    drawHud() {
      const g = this.hudG, sim = this.sim, f = sim.air / sim.cap;
      g.clear();
      g.fillStyle(0x2b2350, 0.55).fillRoundedRect(96, 22, 260, 36, 18);
      g.fillStyle(f < 0.2 ? 0xff7a7a : 0x7fd8ff, 1).fillRoundedRect(102, 28, Math.max(10, 248 * f), 24, 12);
      g.fillStyle(0xffffff, 0.4).fillRoundedRect(108, 30, Math.max(4, 236 * f), 7, 4);
      this.boltTxt.setText("🔩 " + sim.bolts);
      this.timeTxt.setText(this.L.endless ? Math.floor(sim.x / 50) + " m" + "   " + "💦".repeat(sim.rescues) : sim.t.toFixed(1) + " s");
      const p = this.prog; p.clear();
      if (!this.L.endless) {
        const x0 = 520, w = 360;
        p.fillStyle(0x2b2350, 0.5).fillRoundedRect(x0 - 6, 30, w + 12, 20, 10);
        p.fillStyle(0xffffff, 0.8).fillRoundedRect(x0, 36, w, 8, 4);
        const dp = clamp(this.dashX / this.T.finishX, 0, 1);
        p.fillStyle(0xff8a3d, 1).fillCircle(x0 + w * dp, 40, 11).lineStyle(3, 0xffffff, 1).strokeCircle(x0 + w * dp, 40, 11);
        p.fillStyle(0x5fd6a8, 1).fillCircle(x0 + w * sim.progress(), 40, 13).lineStyle(3, 0xffffff, 1).strokeCircle(x0 + w * sim.progress(), 40, 13);
        p.fillStyle(0xffe066, 1).fillRect(x0 + w, 24, 6, 32);
      }
    }
    pulse(k, on) {
      const o = this.btn[k]; if (!o || !o.on) return;
      const s = on ? 1 + 0.08 * Math.sin(this.time.now / 90) : 1; o.c.setScale(s);
    }
    toast(s, ms) {
      this.toastTxt.setText(s).setVisible(true);
      const b = this.toastTxt.getBounds();
      this.toastBox.clear().fillStyle(0xfff8ec, 0.95).fillRoundedRect(b.x - 24, b.y - 12, b.width + 48, b.height + 24, 22)
        .lineStyle(4, 0xff8a3d, 1).strokeRoundedRect(b.x - 24, b.y - 12, b.width + 48, b.height + 24, 22).setVisible(true);
      this.toastT = (ms || 2600) / 1000;
    }
    pop(x, y, s, col) {
      const t = txt(this, x, y, s, 34, col || "#ffffff").setDepth(30);
      this.tweens.add({ targets: t, y: y - 90, alpha: 0, duration: 1100, ease: "Cubic.out", onComplete: () => t.destroy() });
    }
    snd(k, gap) { const n = this.time.now; if ((this.sndT[k] || 0) > n) return; this.sndT[k] = n + (gap || 120); S[k](); }
    countdown() {
      this.toast(this.L.tip, 5200);
      const nums = ["3", "2", "1", "GO!"];
      nums.forEach((n, i) => this.time.delayedCall(700 + i * 650, () => {
        const t = txt(this, W / 2, H / 2 - 40, n, 120, i === 3 ? "#ffe066" : "#ffffff").setScrollFactor(0).setDepth(70);
        this.tweens.add({ targets: t, scale: 1.6, alpha: 0, duration: 600, onComplete: () => t.destroy() });
        i === 3 ? S.puff() : S.tick();
        if (i === 3) this.state = "go";
      }));
    }

    /* ---------------- puffs of air (tiny particle pool) */
    puff(x, y, vx, vy, n, col, life) {
      for (let i = 0; i < n; i++) {
        let p = this.puffs.find(q => !q.alive);
        if (!p) { if (this.puffs.length > 160) return; p = { img: this.add.image(0, 0, "jet").setDepth(6) }; this.puffs.push(p); }
        p.alive = true; p.img.setVisible(true).setPosition(x + Phaser.Math.Between(-6, 6), y + Phaser.Math.Between(-6, 6)).setTint(col || 0xffffff);
        p.vx = vx * (0.8 + Math.random() * 0.5) + Phaser.Math.Between(-25, 25); p.vy = vy * (0.8 + Math.random() * 0.5) + Phaser.Math.Between(-25, 25);
        p.life = p.max = (life || 0.28) * (0.7 + Math.random() * 0.5);
        p.img.setRotation(Math.atan2(p.vy, p.vx));
      }
    }
    puffStep(dt) {
      for (const p of this.puffs) {
        if (!p.alive) continue;
        p.life -= dt; if (p.life <= 0) { p.alive = false; p.img.setVisible(false); continue; }
        p.vx *= 0.96; p.vy *= 0.96;
        p.img.x += p.vx * dt; p.img.y += p.vy * dt;
        const k = p.life / p.max; p.img.setAlpha(k).setScale(0.6 + (1 - k) * 0.9, 0.7 * k + 0.2);
      }
    }

    /* ---------------- main loop */
    input3() {
      const k = this.keys, b = this.btn;
      return { hop: b.hop.held || k.up.isDown || k.sp.isDown || k.w.isDown, zoom: b.zoom.held || k.right.isDown || k.d.isDown,
        stick: b.stick.held || k.down.isDown || k.s.isDown || k.sh.isDown };
    }
    update(t, d) {
      const dtF = Math.min(d / 1000, 0.05) * SPEED, sim = this.sim;
      if (this.state === "go") {
        let inp = this.autopilot ? this.autopilot(sim) : this.input3();
        const n = Math.max(1, Math.round(dtF * 120));
        for (let i = 0; i < n; i++) { sim.step(dtF / n, inp); if (sim.done) break; }
        this.clock += dtF;
        this.handle();
        if (sim.done) this.finish(true);
        if (this.L.endless && sim.rescues >= 3) this.finish(false);
      }
      this.puffStep(dtF);
      this.paint(dtF);
      if (this.toastT > 0) { this.toastT -= dtF; if (this.toastT <= 0) { this.toastTxt.setVisible(false); this.toastBox.setVisible(false); } }
    }
    handle() {
      const sim = this.sim, L = this.L;
      for (const e of sim.ev.splice(0)) {
        switch (e.type) {
          case "hop": this.snd("puff", 90);
            if ((this.hops = (this.hops || 0) + 1) <= 3 || this.hops % 6 === 0) this.pop(e.x, e.y + 70, "Action ⬇  Reaction ⬆", "#bff6ff");
            break;
          case "smooth": this.pop(e.x, e.y - 90, "Smooth landing! +2🔩", "#b8ffcf"); this.snd("sparkle"); break;
          case "bonk":
            this.pop(e.x, e.y - 80, "Bonk!", "#ffd0d0"); this.snd("oops", 300); this.cam.shake(160, 0.006);
            if (e.item && e.item.spr) this.tweens.add({ targets: e.item.spr, angle: 70, x: e.item.spr.x + 90, y: e.item.spr.y - 30, alpha: 0.35, duration: 500, ease: "Cubic.out" });
            break;
          case "bolt": this.snd("tick", 60); this.grab(e.x, e.y); break;
          case "bubble": this.pop(e.x, e.y - 30, "+💨", "#bfefff"); this.snd("pop"); this.grab(e.x, e.y); break;
          case "refill": this.pop(e.x, e.y - 120, "Air tank full! 💨", "#bfefff"); this.snd("ding"); break;
          case "empty": if (this.toastT <= 0) this.toast("Out of air! Zip's little pump is filling the tank. Grab 💨 bubbles!", 2600); break;
          case "whoops":
            this.toast(sim.can("s") ? "Whoops! Too slow for the loop. Hold 🌀 STICK to stay on the road!" : "Whoops! Too slow for the loop. Hold ➡ ZOOM to go faster!", 3200);
            this.snd("oops"); this.rescue(); break;
          case "splash": this.pop(e.x, e.y - 40, "Splash!", "#bfefff"); this.snd("splash"); this.puff(e.x, e.y, 0, -420, 14, 0xbfe9ff, 0.5); this.rescue();
            this.toast(sim.lastCeil ? "Splash! Hold 🌀 STICK all the way along the upside-down road." : "Splash! Tap ⬆ HOP just before the edge to jump over the water.", 3200); break;
          case "drop": this.drone.setVisible(false); this.snd("pop"); break;
          case "finish": break;
        }
      }
      // little lessons, right when they matter
      const tag = sim.mode === "ground" ? sim.p.tag : "";
      if (this.lastTag === "loop" && tag === "" && sim.mode === "ground") { sim.loops++; this.pop(sim.x, sim.y - 120, "Round and round! 🌀", "#e6d6ff"); this.snd("yay", 400); }
      if (sim.mode === "ground") sim.lastCeil = tag === "ceil" || tag === "rise";
      if (tag === "ceil" && this.lastTag !== "ceil") this.pop(sim.x, sim.y + 110, "Upside down!", "#e6d6ff");
      this.lastTag = tag;
    }
    grab(x, y) {
      const o = this.sprites.find(q => q.gone && !q.taken && Math.abs(q.x - x) < 1 && Math.abs(q.y - y) < 1);
      if (!o) return; o.taken = true; this.tweens.killTweensOf(o.spr);
      this.tweens.add({ targets: o.spr, scale: o.spr.scale * 1.6, alpha: 0, duration: 260, onComplete: () => o.spr.setVisible(false) });
    }
    rescue() {
      const sim = this.sim, cp = sim.T.at(sim.cp.si, sim.cp.s);
      this.resc = { x0: this.car.x, y0: this.car.y, x1: cp.x, y1: cp.y - 40, t: 0 };
      this.drone.setVisible(true).setPosition(this.car.x, this.car.y - 400);
    }
    paint(dt) {
      const sim = this.sim, car = this.car, T = this.T;
      // Zip
      const ux = Math.sin(sim.ang) * Math.cos(sim.roll), uy = -Math.cos(sim.ang) * Math.cos(sim.roll);
      let cx = sim.x + ux * 34, cy = sim.y + uy * 34;
      if (sim.mode === "rescue" && this.resc) {
        const R = this.resc; R.t += dt; const k = clamp((R.t - 0.35) / 0.85, 0, 1), e = k * k * (3 - 2 * k);
        if (R.t < 0.35) { const q = R.t / 0.35; this.drone.setPosition(R.x0, R.y0 - 400 + 330 * q); cx = R.x0; cy = R.y0; }
        else { cx = R.x0 + (R.x1 - R.x0) * e; cy = R.y0 + (R.y1 - R.y0) * e - Math.sin(e * Math.PI) * 160; this.drone.setPosition(cx, cy - 70); }
        car.setRotation(0).setScale(this.carScale, this.carScale);
      } else {
        car.setRotation(sim.ang).setScale(this.carScale, this.carScale * (Math.abs(Math.cos(sim.roll)) < 0.08 ? 0.08 * Math.sign(Math.cos(sim.roll) || 1) : Math.cos(sim.roll)));
      }
      car.setPosition(cx, cy);
      // air puffs out of Zip's nozzles (the push goes the other way)
      const fx = Math.cos(sim.ang), fy = Math.sin(sim.ang);
      if (sim.puffing && sim.puffing.hop) this.puff(cx - ux * 30, cy - uy * 30, -ux * 900, -uy * 900, 3, 0x9fefff);
      if (sim.puffing && sim.puffing.zoom && !this.zoomSaid && sim.mode === "ground") { this.zoomSaid = true; this.pop(cx - 60, cy - 90, "Action ⬅  Reaction ➡", "#ffe2c8"); }
      if (sim.puffing && sim.puffing.zoom) { this.puff(cx - fx * 66, cy - fy * 66, -fx * 1000, -fy * 1000, 3, 0x9fefff); this.snd("hiss", 200); }
      this.fan.clear();
      if (sim.inp.stick && sim.mode !== "rescue") {
        // air is sucked from under the car: little streaks flow in toward the fan
        const bx = cx - ux * 30, by = cy - uy * 30, ph = (this.time.now / 300) % 1;
        this.fan.lineStyle(4, 0x7fe9ff, 0.9);
        for (let i = -2; i <= 2; i++) {
          const k = (ph + (i + 2) / 5) % 1, ox = fx * i * 24, oy = fy * i * 24, dd = 34 * (1 - k);
          this.fan.lineBetween(bx + ox - ux * dd, by + oy - uy * dd, bx + ox - ux * (dd - 10), by + oy - uy * (dd - 10));
        }
        if (!this.humOn) { this.humOn = true; S.hum(); }
      } else this.humOn = false;
      // Dash
      if (this.dash) {
        const f = this.ghost.length ? clamp(Math.floor(this.clock / (2 / 120 * this.L.dash)), 0, this.ghost.length - 1) : 0, g = this.ghost[f] || [0, T.base, 0, 0, 0];
        const dux = Math.sin(g[2]) * Math.cos(g[3]), duy = -Math.cos(g[2]) * Math.cos(g[3]);
        this.dash.setPosition(g[0] + dux * 34, g[1] + duy * 34).setRotation(g[2]).setScale(this.dash.scaleX, Math.abs(this.dash.scaleX) * (Math.cos(g[3]) || 0.05)).setAlpha(g[4] ? 0.3 : 1);
        this.dashTag.setPosition(this.dash.x, this.dash.y - 64 * Math.sign(Math.cos(g[3]) || 1));
        this.dashX = this.clock > this.dashT ? T.finishX : g[0];
      }
      // camera: Zip a third of the way across
      const tx = cx - W * 0.33, ty = clamp(cy - H * 0.55, T.minY - 260, T.floorY - H + 100);
      this.cam.scrollX += (tx - this.cam.scrollX) * Math.min(1, dt * 8);
      this.cam.scrollY += (ty - this.cam.scrollY) * Math.min(1, dt * 4);
      this.bg.tilePositionX = this.cam.scrollX * 0.2 / this.bg.tileScaleX;
      for (const [k, g] of this.chunkList) g.setVisible(Math.abs((k + 0.5) * 1600 - (this.cam.scrollX + W / 2)) < 1600 + W);
      // hints: wiggle the button that helps right now
      const ahead = x => sim.x > x - 260 && sim.x < x;
      let hopHint = sim.mode === "air" && sim.vyMax > sim.soft * 0.8 && sim.vy > 200 && T.below(sim.x, sim.y) < 240;
      if (this.li >= 0 && this.li < 3 && sim.mode === "ground") for (const c of T.cues) if (c.act === "hop" && ahead(c.x + 40)) hopHint = true;
      let stickHint = false, zoomHint = false;
      for (const z of T.zones) if (sim.x > z.x0 - 120 && sim.x < z.x1) { if (z.act === "stick") stickHint = !sim.inp.stick; else zoomHint = !sim.inp.zoom; }
      this.pulse("hop", hopHint && !sim.inp.hop); this.pulse("stick", stickHint); this.pulse("zoom", zoomHint);
      this.btn.hop.c.setAlpha(this.btn.hop.on ? (sim.inp.stick ? 0.45 : 1) : 0.5);
      this.drawHud();
    }

    /* ---------------- the end */
    finish(win) {
      if (this.state === "done") return;
      this.state = "done";
      const sim = this.sim, L = this.L, sv = save.get();
      const beat = win && !L.endless && sim.t <= this.dashT;
      const stars = win && !L.endless ? 1 + (beat ? 1 : 0) + (sim.rescues === 0 ? 1 : 0) : 0;
      sv.bolts += sim.bolts; sv.smooth = (sv.smooth || 0) + sim.smooth;
      if (!L.endless) sv.stars[this.li + 1] = Math.max(sv.stars[this.li + 1] || 0, stars);
      const m = Math.floor(sim.x / 50);
      if (L.endless) sv.best = Math.max(sv.best || 0, m);
      save.set(sv); this.stars = stars;
      for (const k in this.btn) this.btn[k].c.setVisible(false);
      this.time.delayedCall(L.endless ? 600 : 900, () => this.endPanel(win, stars, beat, m, sv));
    }
    endPanel(win, stars, beat, m, sv) {
      const sim = this.sim, L = this.L;
      const c = this.add.container(0, 0).setDepth(80).setScrollFactor(0);
      c.add(panel(this, W / 2, H / 2, 900, 600, win ? 0x5ccf6a : 0xff8a3d));
      if (L.endless) {
        c.add(fit(this.add.image(W / 2, 150, "zip"), 220));
        c.add(txt(this, W / 2, 250, "Zip drove " + m + " meters!", 50, "#2b2350", { strokeThickness: 0 }));
        c.add(txt(this, W / 2, 310, m >= sv.best ? "🏆 New best!" : "Best: " + sv.best + " m", 32, "#e0662f", { strokeThickness: 0 }));
        S.yay();
      } else {
        c.add(fit(this.add.image(W / 2 - 150, 150, "zip"), 200));
        c.add(fit(this.add.image(W / 2 + 150, 150, beat ? "rio" : "dash"), beat ? 150 : 180));
        c.add(txt(this, W / 2, 248, beat ? "You beat Dash! 🏁" : "Dash wins this time. Great race!", 44, "#2b2350", { strokeThickness: 0 }));
        const st = txt(this, W / 2, 314, "★".repeat(stars) + "☆".repeat(3 - stars), 66, "#ffc83a", { stroke: "#e0a21a", strokeThickness: 4 });
        st.setScale(0.2); this.tweens.add({ targets: st, scale: 1, duration: 500, ease: "Back.out" }); c.add(st);
        c.add(txt(this, W / 2, 372, "✓ Finished    " + (beat ? "✓" : "✗") + " Beat Dash (" + sim.t.toFixed(1) + " s / " + this.dashT.toFixed(1) + " s)    " + (sim.rescues ? "✗" : "✓") + " No splashes", 23, "#5b4f73", { strokeThickness: 0 }));
        S.yay(); if (beat) Book.confetti && Book.confetti(80);
      }
      c.add(txt(this, W / 2, 425, "🔩 +" + sim.bolts + "    ✨ " + sim.smooth + " smooth landing" + (sim.smooth === 1 ? "" : "s") + (sim.loops ? "    🌀 " + sim.loops + " loop" + (sim.loops > 1 ? "s" : "") : ""), 28, "#e0662f", { strokeThickness: 0 }));
      c.add(txt(this, W / 2, 478, L.fact || Phaser.Utils.Array.GetRandom(TIPS), 25, "#3b2f4a", { strokeThickness: 0, wordWrap: { width: 780 } }));
      const next = win && !L.endless && this.li < LEVELS.length - 1;
      const btns = [["⌂ Tracks", 0x4f86f7, () => this.scene.start("title")], ["↻ Again", 0xff8a3d, () => this.scene.start("play", { level: this.li })]];
      if (next) btns.push(["Next ▶", 0x5ccf6a, () => this.scene.start("play", { level: this.li + 1 })]);
      btns.push(["🔧 Garage", 0x9b6cf2, () => this.scene.start("garage")]);
      btns.forEach((b, i) => c.add(button(this, W / 2 + (i - (btns.length - 1) / 2) * 200, 572, 184, 74, b[0], b[1], b[2], 26)));
      c.iterate(o => o.setScrollFactor && o.setScrollFactor(0));
      if (win && this.li === LEVELS.length - 1 && stars === 3) this.time.delayedCall(700, () => this.toast("🏆 Grand Puff Prix champion! You know how air can push a car!", 5000));
    }
  }

  function start() {
    const ready = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 32px "Baloo 2"')]).catch(() => {}) : Promise.resolve();
    Promise.race([ready, new Promise(r => setTimeout(r, 2500))]).then(() => {
      window.__prGame = new Phaser.Game({
        type: Phaser.AUTO, parent: "game", backgroundColor: "#8fd3ff",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
        input: { activePointers: 3 },
        fps: /[?&]timer=1/.test(location.search) ? { forceSetTimeOut: true, target: 60 } : undefined,
        scene: [Boot, Title, Garage, Play],
      });
    });
  }
  window.PuffRacer = { start };
})();
