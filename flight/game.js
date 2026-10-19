/* Sky Pilot! — fly Poppy from the cockpit (Phaser 3).
   Physics, world and missions live in sim.js. The 3D view is drawn by hand: a tiny camera projects
   the sea, islands, runways, cloud rings and billboards (clouds, trees, balloons) onto the screen,
   then the cockpit (nose, instruments, stick, power lever, buttons) is drawn on top.
   Nothing gets hurt: a too-hard landing is just a "Bonk!" and you try again. Balloons are people, so you wave. */
(function () {
  "use strict";
  const W = 1280, H = 720;
  const FONT = '"Baloo 2", "Trebuchet MS", sans-serif';
  const S = (window.Book && Book.sfx) || new Proxy({}, { get: () => () => {} });
  const F = window.FlightSim, LEVELS = F.LEVELS, D2R = F.D2R, clamp = F.clamp;
  const SPEED = parseFloat((location.search.match(/[?&]speed=([\d.]+)/) || [])[1]) || 1;   // test runs only
  const muted = () => !!(window.Book && Book.muted);
  const say = t => { if (window.Book && !Book.muted && Book.speak) Book.speak(t.replace(/[^\x20-\x7E]/g, "")); };

  /* ------------------------------------------------------------ save */
  const BLANK = () => ({ stars: {}, paint: "yellow", flip: false, time: "day", rings: 0 });
  const save = {
    get() { try { return Object.assign(BLANK(), JSON.parse(localStorage.getItem("sp-save")) || {}); } catch (e) { return BLANK(); } },
    set(v) { try { localStorage.setItem("sp-save", JSON.stringify(v)); } catch (e) {} },
  };
  const totalStars = sv => Object.values(sv.stars).reduce((a, b) => a + b, 0);
  const PAINTS = [
    { k: "yellow", name: "Sunny Yellow", col: 0xffcf3a, need: 0 },
    { k: "red", name: "Cherry Red", col: 0xff6b5e, need: 5 },
    { k: "blue", name: "Sky Blue", col: 0x5fb3ff, need: 10 },
    { k: "mint", name: "Mint Green", col: 0x5fd6a8, need: 15 },
    { k: "purple", name: "Grape Purple", col: 0xb58cff, need: 20 },
  ];
  const TIMES = [
    { k: "day", name: "☀️ Day", need: 0 }, { k: "sunset", name: "🌅 Sunset", need: 8 }, { k: "night", name: "🌙 Night", need: 16 },
  ];
  const SKY = {
    morning: { top: 0x86c8f7, hor: 0xe6f6ff, sea: 0x4fb0dc, haze: 0xd9f0fb, sand: 0xf3e2b0, grass: 0x8fd16a, cloud: 0xffffff, sun: 0xfff3c4 },
    day:     { top: 0x5fb3f2, hor: 0xd3efff, sea: 0x3f9fd6, haze: 0xcfe9f8, sand: 0xf1dfa8, grass: 0x86cc5f, cloud: 0xffffff, sun: 0xfffbe0 },
    afternoon: { top: 0x6cb2ee, hor: 0xfff0cf, sea: 0x4a9fd0, haze: 0xf3ecd8, sand: 0xf1d9a0, grass: 0x8ec85e, cloud: 0xfff8ee, sun: 0xffeab0 },
    sunset:  { top: 0x6f7fd6, hor: 0xffc191, sea: 0x5b7fc0, haze: 0xffcfa8, sand: 0xe9c592, grass: 0x7fae5a, cloud: 0xffe4d2, sun: 0xffb36b },
    night:   { top: 0x0e1840, hor: 0x2c3c7c, sea: 0x162a58, haze: 0x2a3a72, sand: 0x5d5a6e, grass: 0x2f5a46, cloud: 0x8d9ac8, sun: 0xf5f2d0 },
  };
  const TIPS = [
    "Wings need fast air to lift. Speed up before you pull back!",
    "Pull the stick back: nose up, climb. Push it forward: nose down.",
    "Tilt the stick to the side to bank and turn, like a bird.",
    "Climbing makes Poppy slower. Add THROTTLE when you go up!",
    "Flaps make the wing bigger, so Poppy can fly slowly for landing.",
    "Land gently: slow down, wheels down, and float onto the runway.",
  ];

  /* ------------------------------------------------------------ helpers */
  function txt(sc, x, y, s, size, color, opts) {
    return sc.add.text(x, y, s, Object.assign({ fontFamily: FONT, fontSize: size + "px", fontStyle: "800", color: color || "#fff",
      stroke: "#24305e", strokeThickness: Math.max(3, size / 6), align: "center" }, opts || {})).setOrigin(0.5);
  }
  function button(sc, x, y, w, h, label, fill, onClick, size) {
    const c = sc.add.container(x, y), g = sc.add.graphics();
    const draw = d => { g.clear(); g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, h / 2);
      g.fillStyle(c.fill || fill, 1).fillRoundedRect(-w / 2, -h / 2 + (d ? 5 : 0), w, h, h / 2);
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(-w / 2 + 10, -h / 2 + 6 + (d ? 5 : 0), w - 20, h * 0.3, h * 0.15); };
    c.redraw = draw; draw(false);
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
    g.lineStyle(6, color || 0x4f86f7, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    return g;
  }
  // clip a 2D polygon / line to a rectangle (the GPS screen), cheaper than a mask
  function clipPoly(pts, x0, y0, x1, y1) {
    const edge = (P, inside, cut) => { const out = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], ai = inside(a), bi = inside(b); if (ai) out.push(a); if (ai !== bi) out.push(cut(a, b)); } return out; };
    const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    let P = pts;
    P = edge(P, q => q.x >= x0, (a, b) => lerp(a, b, (x0 - a.x) / (b.x - a.x))); if (P.length < 3) return null;
    P = edge(P, q => q.x <= x1, (a, b) => lerp(a, b, (x1 - a.x) / (b.x - a.x))); if (P.length < 3) return null;
    P = edge(P, q => q.y >= y0, (a, b) => lerp(a, b, (y0 - a.y) / (b.y - a.y))); if (P.length < 3) return null;
    P = edge(P, q => q.y <= y1, (a, b) => lerp(a, b, (y1 - a.y) / (b.y - a.y)));
    return P.length >= 3 ? P : null;
  }
  function clipLine(a, b, x0, y0, x1, y1) {
    let t0 = 0, t1 = 1; const dx = b.x - a.x, dy = b.y - a.y;
    for (const [pp, q] of [[-dx, a.x - x0], [dx, x1 - a.x], [-dy, a.y - y0], [dy, y1 - a.y]]) {
      if (pp === 0) { if (q < 0) return null; continue; }
      const r = q / pp; if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [a.x + dx * t0, a.y + dy * t0, a.x + dx * t1, a.y + dy * t1];
  }
  const setCol = (t, c) => { if (t._col !== c) { t._col = c; t.setColor(c); } };   // re-colouring a text redraws it, so only when it changes
  const mix = (a, b, t) => {
    const r = (a >> 16 & 255) + ((b >> 16 & 255) - (a >> 16 & 255)) * t, g = (a >> 8 & 255) + ((b >> 8 & 255) - (a >> 8 & 255)) * t, bl = (a & 255) + ((b & 255) - (a & 255)) * t;
    return (r << 16) | (g << 8) | bl;
  };
  const rand = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

  /* ------------------------------------------------------------ engine sound (quiet, follows the power lever) */
  const Engine = {
    ctx: null, osc: null, gain: null,
    start() {
      if (muted()) return;
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.osc) return;
        const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
        o.type = "sawtooth"; o2.type = "square"; o2.detune.value = 7; f.type = "lowpass"; f.frequency.value = 420; g.gain.value = 0;
        o.connect(f); o2.connect(f); f.connect(g).connect(c.destination); o.start(); o2.start();
        this.osc = o; this.osc2 = o2; this.gain = g; this.filt = f;
      } catch (e) {}
    },
    set(spin, power) {
      if (!this.osc) return;
      if (muted()) { this.gain.gain.value = 0; return; }
      const t = this.ctx.currentTime, f = 38 + spin * (34 + power * 46);
      this.osc.frequency.setTargetAtTime(f, t, 0.1); this.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.1);
      this.filt.frequency.setTargetAtTime(260 + power * 500, t, 0.1);
      this.gain.gain.setTargetAtTime(spin * (0.018 + power * 0.022), t, 0.15);
    },
    stop() { if (!this.osc) return; try { this.osc.stop(); this.osc2.stop(); } catch (e) {} this.osc = null; },
  };

  /* ============================================================ BOOT */
  const ART = ["lin", "poppy", "poppy_front", "jet", "cloud", "balloon", "p01"];
  class Boot extends Phaser.Scene {
    constructor() { super("boot"); }
    preload() {
      txt(this, W / 2, H / 2 - 60, "Warming up the engine...", 40);
      const bar = this.add.graphics();
      this.load.on("progress", v => bar.clear().fillStyle(0xffffff, .3).fillRoundedRect(440, H / 2, 400, 28, 14).fillStyle(0xffd23f, 1).fillRoundedRect(440, H / 2, 400 * v, 28, 14));
      ART.forEach(k => this.load.image(k, "img/" + k + ".webp"));
    }
    create() {
      const mk = (k, w, h, draw) => { if (this.textures.exists(k)) return; const g = this.make.graphics({ add: false }); draw(g); g.generateTexture(k, w, h); g.destroy(); };
      // stand-ins when an illustration is missing, so the game never breaks
      mk("cloud", 256, 150, g => { g.fillStyle(0xffffff, 1); [[70, 95, 55], [128, 70, 70], [190, 95, 52], [128, 110, 50]].forEach(c => g.fillCircle(c[0], c[1], c[2])); });
      mk("balloon", 160, 230, g => { g.fillStyle(0xff7a6b, 1).fillCircle(80, 80, 76); g.fillStyle(0xffd23f, 1).fillRect(56, 6, 48, 150); g.fillStyle(0x9b6b3d, 1).fillRect(60, 196, 40, 30); });
      mk("lin", 160, 220, g => { g.fillStyle(0x7fb8ef, 1).fillRoundedRect(40, 100, 80, 110, 30); g.fillStyle(0xffd9b8, 1).fillCircle(80, 64, 46); g.fillStyle(0x6b4a2e, 1).fillEllipse(80, 30, 100, 46); });
      mk("poppy", 300, 160, g => { g.fillStyle(0xffcf3a, 1).fillRoundedRect(20, 50, 260, 70, 34); g.fillStyle(0xffffff, 1).fillRect(90, 74, 120, 18); g.fillStyle(0xbfe9ff, 1).fillCircle(150, 46, 30); });
      mk("poppy_front", 300, 200, g => { g.fillStyle(0xffffff, 1).fillRoundedRect(0, 90, 300, 26, 13); g.fillStyle(0xffcf3a, 1).fillCircle(150, 100, 56); });
      mk("jet", 300, 120, g => { g.fillStyle(0xffffff, 1).fillRoundedRect(10, 40, 280, 44, 22); g.fillStyle(0x4f86f7, 1).fillTriangle(20, 40, 60, 40, 30, 0); });
      mk("p01", 640, 360, g => { g.fillGradientStyle(0x7cc4f5, 0x7cc4f5, 0xe8f7ff, 0xe8f7ff, 1).fillRect(0, 0, 640, 360); });
      // little world things, drawn here
      mk("puff", 64, 64, g => { for (let r = 30; r > 0; r -= 2) { g.fillStyle(0xffffff, 0.08 + (1 - r / 30) * 0.35); g.fillCircle(32, 32, r); } });
      mk("tree", 64, 96, g => { g.fillStyle(0x8a5a33, 1).fillRect(28, 60, 9, 34); g.fillStyle(0x3f9c4a, 1).fillCircle(32, 40, 28); g.fillStyle(0x5cbd5a, 1).fillCircle(26, 32, 18); g.fillStyle(0x7fd36a, 1).fillCircle(22, 26, 8); });
      mk("palm", 80, 120, g => { g.lineStyle(8, 0x9a6a3a, 1).beginPath(); g.moveTo(40, 118); g.lineTo(44, 70); g.lineTo(40, 28); g.strokePath();
        g.fillStyle(0x3fae5a, 1); [[-34, 6], [34, 6], [-26, -10], [26, -10], [0, -18]].forEach(([dx, dy]) => g.fillEllipse(40 + dx * 0.7, 28 + dy * 0.6 + 6, 46, 14)); });
      mk("house", 96, 90, g => { g.fillStyle(0xfff3dc, 1).fillRect(14, 40, 68, 48); g.fillStyle(0xff7a5c, 1).fillTriangle(6, 44, 48, 6, 90, 44);
        g.fillStyle(0x7fc8ff, 1).fillRect(24, 54, 16, 14); g.fillRect(56, 54, 16, 14); g.fillStyle(0x9b6b3d, 1).fillRect(42, 64, 12, 24); });
      mk("house2", 96, 90, g => { g.fillStyle(0xe6f2ff, 1).fillRect(14, 40, 68, 48); g.fillStyle(0x5f8fe8, 1).fillTriangle(6, 44, 48, 6, 90, 44);
        g.fillStyle(0xffe08a, 1).fillRect(24, 54, 16, 14); g.fillRect(56, 54, 16, 14); g.fillStyle(0x9b6b3d, 1).fillRect(42, 64, 12, 24); });
      mk("hangar", 160, 100, g => { g.fillStyle(0xd7dde8, 1).fillRect(0, 30, 160, 70); g.fillStyle(0xb6bfd0, 1).fillEllipse(80, 34, 160, 60); g.fillStyle(0x6c7a96, 1).fillRect(36, 52, 88, 48); });
      mk("tower", 70, 160, g => { g.fillStyle(0xeef2f8, 1).fillRect(24, 40, 22, 120); g.fillStyle(0x5aa7e8, 1).fillRoundedRect(8, 14, 54, 30, 8); g.fillStyle(0xff7a5c, 1).fillRect(10, 6, 50, 10); });
      mk("light", 16, 16, g => { g.fillStyle(0xfff6c0, 0.35).fillCircle(8, 8, 8); g.fillStyle(0xffffff, 1).fillCircle(8, 8, 3); });
      mk("star", 16, 16, g => { g.fillStyle(0xffffff, 1).fillCircle(8, 8, 2.2); g.fillStyle(0xffffff, 0.3).fillCircle(8, 8, 5); });
      mk("sunb", 128, 128, g => { for (let r = 64; r > 0; r -= 3) { g.fillStyle(0xffffff, r > 26 ? 0.05 : 0.9); g.fillCircle(64, 64, r); } });
      mk("glow", 128, 128, g => { for (let r = 64; r > 0; r -= 4) { g.fillStyle(0xffe066, 0.06); g.fillCircle(64, 64, r); } });
      this.scene.start("menu");
    }
  }

  /* ============================================================ MENU */
  class Menu extends Phaser.Scene {
    constructor() { super("menu"); }
    create() {
      Engine.stop();
      const bg = this.add.image(W / 2, H / 2, "p01"); bg.setScale(Math.max(W / bg.width, H / bg.height));
      this.add.rectangle(W / 2, H / 2, W, H, 0x1d2a5c, 0.28);
      const sv = save.get(), all = /[?&]unlock=1/.test(location.search), stars = totalStars(sv);
      const logo = txt(this, W / 2, 62, "Sky Pilot!", 80, "#ffffff", { strokeThickness: 12 });
      this.tweens.add({ targets: logo, y: 70, yoyo: true, repeat: -1, duration: 1300, ease: "Sine.inOut" });
      txt(this, W / 2, 122, "Fly Poppy from the cockpit!   ⭐ " + stars + " / " + LEVELS.length * 3, 28, "#fff1b8");
      LEVELS.forEach((L, i) => {
        const col = i % 4, row = Math.floor(i / 4), x = 200 + col * 293, y = 245 + row * 150;
        const open = all || i === 0 || (sv.stars[i] || 0) > 0, st = sv.stars[i + 1] || 0;
        const c = this.add.container(x, y), g = this.add.graphics();
        g.fillStyle(0x000000, 0.3).fillRoundedRect(-135, -58 + 8, 270, 122, 28);
        g.fillStyle(open ? [0xff8a3d, 0x4f86f7, 0x5ccf6a, 0x9b6cf2][i % 4] : 0x6e7488, 1).fillRoundedRect(-135, -58, 270, 122, 28);
        c.add(g);
        c.add(txt(this, 0, -30, open ? (i + 1) + ". " + L.name : "🔒 Mission " + (i + 1), 25));
        c.add(txt(this, 0, 4, open ? L.sub : "", 16, "#ffffff", { strokeThickness: 4, wordWrap: { width: 250 } }));
        c.add(txt(this, 0, 40, open ? "★".repeat(st) + "☆".repeat(3 - st) : "", 28, st ? "#ffd93a" : "#ffffff"));
        if (open) {
          c.setSize(270, 122).setInteractive({ useHandCursor: true });
          c.on("pointerup", () => { S.whoosh(); this.scene.start("fly", { level: i }); });
          c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.05, duration: 100 }));
          c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 100 }));
        }
      });
      button(this, 360, 560, 420, 78, "☁️ Free Flight" + (sv.rings ? "  (best " + sv.rings + ")" : ""), 0x2fb6c9, () => this.scene.start("fly", { level: -1 }), 30);
      button(this, 820, 560, 400, 78, "🛠️ Hangar", 0x9b6cf2, () => this.scene.start("hangar"), 30);
      txt(this, W / 2, 650, TIPS[Math.floor(Math.random() * TIPS.length)], 24, "#ffffff", { strokeThickness: 5, wordWrap: { width: 1100 } });
    }
  }

  /* ============================================================ HANGAR: paint, sky, controls */
  class Hangar extends Phaser.Scene {
    constructor() { super("hangar"); }
    create() { const bg = this.add.image(W / 2, H / 2, "p01"); bg.setScale(Math.max(W / bg.width, H / bg.height)); this.add.rectangle(W / 2, H / 2, W, H, 0x1d2a5c, 0.35); this.draw(); }
    draw() {
      if (this.box) this.box.destroy();
      const sv = save.get(), stars = totalStars(sv), c = this.box = this.add.container(0, 0);
      c.add(panel(this, W / 2, H / 2, 1080, 660, 0x9b6cf2));
      c.add(txt(this, W / 2, 70, "🛠️ Poppy's Hangar", 48, "#24305e", { strokeThickness: 0 }));
      c.add(txt(this, W / 2, 114, "Earn ⭐ in the missions to unlock new paint and new skies.   You have ⭐ " + stars, 23, "#5b4f73", { strokeThickness: 0 }));
      const pp = this.add.image(250, 230, "poppy"); fit(pp, 300); if (sv.paint !== "yellow") pp.setTint(PAINTS.find(p => p.k === sv.paint).col);
      c.add(pp);
      c.add(txt(this, 600, 170, "Paint", 30, "#24305e", { strokeThickness: 0 }).setOrigin(0, 0.5));
      PAINTS.forEach((p, i) => {
        const x = 640 + i * 108, y = 240, ok = stars >= p.need, on = sv.paint === p.k;
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.2).fillCircle(x, y + 5, 42); g.fillStyle(ok ? p.col : 0xc9c3d6, 1).fillCircle(x, y, 42);
        if (on) g.lineStyle(7, 0x24305e, 1).strokeCircle(x, y, 46);
        c.add(g);
        c.add(txt(this, x, y, ok ? (on ? "✔" : "") : "🔒", 30));
        c.add(txt(this, x, y + 64, ok ? p.name.split(" ")[0] : "⭐" + p.need, 18, "#5b4f73", { strokeThickness: 0 }));
        const z = this.add.zone(x, y, 90, 90).setInteractive({ useHandCursor: true });
        z.on("pointerup", () => { if (!ok) { S.oops(); return; } const s2 = save.get(); s2.paint = p.k; save.set(s2); S.pop(); this.draw(); });
        c.add(z);
      });
      c.add(txt(this, 150, 400, "Free Flight sky", 30, "#24305e", { strokeThickness: 0 }).setOrigin(0, 0.5));
      TIMES.forEach((t, i) => {
        const ok = stars >= t.need, on = sv.time === t.k;
        const b = button(this, 520 + i * 230, 400, 210, 66, ok ? t.name : "🔒 ⭐" + t.need, on ? 0x24305e : (ok ? 0x4f86f7 : 0xa8b3b8),
          () => { if (!ok) { S.oops(); return; } const s2 = save.get(); s2.time = t.k; save.set(s2); this.draw(); }, 26);
        c.add(b);
      });
      c.add(txt(this, 150, 500, "Stick up/down", 30, "#24305e", { strokeThickness: 0 }).setOrigin(0, 0.5));
      c.add(button(this, 610, 500, 440, 66, sv.flip ? "Pull = nose DOWN (flipped)" : "Pull back = nose UP (like real)", sv.flip ? 0xff8a3d : 0x5ccf6a,
        () => { const s2 = save.get(); s2.flip = !s2.flip; save.set(s2); this.draw(); }, 24));
      c.add(txt(this, 1010, 500, "Real pilots pull\nback to climb!", 20, "#5b4f73", { strokeThickness: 0 }));
      c.add(button(this, W / 2, 620, 280, 70, "◀ Back", 0x4f86f7, () => this.scene.start("menu"), 30));
    }
  }

  /* ============================================================ FLY */
  const VIEW = { cx: W / 2, cy: 250, f: 640, near: 2 };
  const DASH_Y = 476;
  class Fly extends Phaser.Scene {
    constructor() { super("fly"); }
    init(d) { this.li = d.level; }

    create() {
      const sv = this.sv = save.get();
      this.L = this.li < 0 ? F.FREE : LEVELS[this.li];
      this.m = new F.Mission(this.L);
      this.time_ = this.li < 0 ? sv.time : this.L.time;
      this.C = SKY[this.time_] || SKY.day;
      this.paint = (PAINTS.find(p => p.k === sv.paint) || PAINTS[0]).col;
      this.flip = !!sv.flip;
      this.inp = { x: 0, y: 0 }; this.keys = this.input.keyboard.addKeys("UP,DOWN,LEFT,RIGHT,W,S,B,SPACE,A,Z");
      this.acc = 0; this.prop = 0; this.cloudFog = 0; this.hintT = 0; this.over = false;
      this.makeWorld();
      this.world = this.add.graphics().setDepth(-1e7);
      this.ringG = []; this.pool = []; this.poolI = 0;
      this.fog = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(9);
      this.makeCockpit();
      this.makeHud();
      this.gates = this.L.land ? this.makeGates(this.L.land) : [];
      this.input.keyboard.on("keydown-M", () => this.toggleMaster());
      this.input.keyboard.on("keydown-E", () => this.turnKey());
      this.input.keyboard.on("keydown-G", () => this.toggleGear());
      this.input.keyboard.on("keydown-F", () => this.toggleFlaps());
      this.events.once("shutdown", () => Engine.stop());
      this.intro();
      window.__spScene = this;
    }

    /* ---------------- world dressing (fixed for every mission) ---------------- */
    makeWorld() {
      const r0 = rand; const things = this.things = [];
      const main = F.ISLANDS[0], palm = F.ISLANDS[1];
      const inLand = (x, z) => { const s = F.surface(x, z); return s.kind === "grass"; };
      const nearRunway = (x, z, pad) => F.RUNWAYS.some(rw => { const l = F.runwayLocal(rw, x, z); return Math.abs(l.along) < rw.len / 2 + pad && Math.abs(l.across) < 60 + pad * 0.2; });
      // fields: patchwork squares on the big island
      this.fields = [];
      const FC = [0x9ed870, 0xb9e07a, 0x7cc45a, 0xd9e48a, 0xa6d47b, 0xc8e69a];
      for (let i = 0; i < 70; i++) {
        const x = (r0() - 0.5) * 3600, z = (r0() - 0.4) * 4600, s = 140 + r0() * 220, a = r0() * 0.6;
        if (!inLand(x, z) || nearRunway(x, z, 200)) continue;
        const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [x + (u * Math.cos(a) - v * Math.sin(a)) * s, z + (u * Math.sin(a) + v * Math.cos(a)) * s * 0.7]);
        this.fields.push({ pts, col: FC[i % FC.length], cx: x, cz: z });
      }
      // trees, houses, palms
      for (let i = 0; i < 260; i++) {
        const x = (r0() - 0.5) * 4400, z = (r0() - 0.45) * 5600;
        if (!inLand(x, z) || nearRunway(x, z, 120)) continue;
        things.push({ x, y: 0, z, key: r0() < 0.15 ? (r0() < 0.5 ? "house" : "house2") : "tree", size: 14 + r0() * 8, anchor: 1 });
      }
      for (let i = 0; i < 60; i++) {
        const a = r0() * Math.PI * 2, rr = 500 + r0() * 350, x = palm.pts[0] && 1700 + Math.sin(a) * rr * 0.8, z = 4600 + Math.cos(a) * rr;
        if (!inLand(x, z) || nearRunway(x, z, 80)) continue;
        things.push({ x, y: 0, z, key: "palm", size: 16 + r0() * 6, anchor: 1 });
      }
      F.RUNWAYS.forEach(rw => {
        const q = F.runwayPoint(rw, 0.2, 120), q2 = F.runwayPoint(rw, -0.15, 110);
        things.push({ x: q.x, y: 0, z: q.z, key: "hangar", size: 46, anchor: 1 });
        things.push({ x: q2.x, y: 0, z: q2.z, key: "tower", size: 34, anchor: 1 });
      });
      // big decorative clouds (fly through them for a white whoosh)
      this.clouds = [];
      for (let i = 0; i < 70; i++) {
        const x = (r0() - 0.5) * 13000, z = (r0() - 0.5) * 13000, y = 260 + r0() * 520;
        if (Math.hypot(x, z) < 700 && y < 400) continue;
        this.clouds.push({ x, y, z, key: "cloud", size: 160 + r0() * 220, anchor: 0.5, cloud: true });
      }
      // a passenger jet far away, flying circles
      this.jet = { x: 0, y: 900, z: 0, key: "jet", size: 60, anchor: 0.5, jet: true, a: 0 };
      this.balloons = this.m.balloons.map(b => ({ x: b.x, y: b.y, z: b.z, key: "balloon", size: 34, anchor: 0.5, b }));
      if (this.time_ === "night") {
        this.starsSky = []; for (let i = 0; i < 140; i++) { const a = r0() * Math.PI * 2, e = 0.05 + r0() * 0.9; this.starsSky.push({ a, e, s: 0.4 + r0() * 0.8 }); }
      }
      // ring puffs: little clouds around each ring
      this.m.rings.forEach(r => this.dressRing(r));
    }
    dressRing(r) {
      if (r.puffs) return;
      const h = r.hdg * D2R, n = 14; r.puffs = [];
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, lx = Math.cos(a) * r.r, ly = Math.sin(a) * r.r;
        r.puffs.push({ x: r.x + Math.cos(h) * lx, y: r.y + ly, z: r.z - Math.sin(h) * lx, key: "cloud", size: r.r * 0.62 + (i % 3) * 3, anchor: 0.5, ring: r, rot: rand() * 6 });
      }
    }
    makeGates(rw) {
      // landing gates: yellow frames along the glide path (3.5 degrees down to the touch-down spot)
      const a = F.runwayPoint(rw, -1), h = rw.hdg * D2R, aim = { x: a.x + Math.sin(h) * 120, z: a.z + Math.cos(h) * 120 };
      return [1500, 1050, 650, 330].map(d => ({ x: aim.x - Math.sin(h) * d, z: aim.z - Math.cos(h) * d, y: d * Math.tan(3.5 * D2R) + 4, h, w: 70, hh: 34 }));
    }

    /* ---------------- camera ---------------- */
    cam() {
      const p = this.m.p;
      const ch = Math.cos(p.psi), sh = Math.sin(p.psi), ct = Math.cos(p.theta), st = Math.sin(p.theta), cr = Math.cos(p.phi), sr = Math.sin(p.phi);
      const eye = { x: p.x, y: p.y + 2.2, z: p.z };
      this.C3 = { ch, sh, ct, st, cr, sr, eye };
    }
    // world -> camera space [x, y, z] (z forward)
    toCam(x, y, z) {
      const c = this.C3, dx = x - c.eye.x, dy = y - c.eye.y, dz = z - c.eye.z;
      const x1 = dx * c.ch - dz * c.sh, z1 = dx * c.sh + dz * c.ch;
      const z2 = z1 * c.ct + dy * c.st, y2 = dy * c.ct - z1 * c.st;
      return [x1 * c.cr - y2 * c.sr, x1 * c.sr + y2 * c.cr, z2];
    }
    dirCam(x, y, z) {   // a direction (no position): for the horizon, sun, stars
      const c = this.C3;
      const x1 = x * c.ch - z * c.sh, z1 = x * c.sh + z * c.ch;
      const z2 = z1 * c.ct + y * c.st, y2 = y * c.ct - z1 * c.st;
      return [x1 * c.cr - y2 * c.sr, x1 * c.sr + y2 * c.cr, z2];
    }
    proj(v) { return { x: VIEW.cx + VIEW.f * v[0] / v[2], y: VIEW.cy - VIEW.f * v[1] / v[2] }; }
    // clip a camera-space polygon at the near plane, then project it
    poly(camPts) {
      const out = [], n = camPts.length, N = VIEW.near;
      for (let i = 0; i < n; i++) {
        const a = camPts[i], b = camPts[(i + 1) % n], ai = a[2] >= N, bi = b[2] >= N;
        if (ai) out.push(this.proj(a));
        if (ai !== bi) { const t = (N - a[2]) / (b[2] - a[2]); out.push(this.proj([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, N])); }
      }
      return out.length >= 3 ? out : null;
    }
    fillWorld(pts, col, alpha) {
      const P = this.poly(pts.map(q => this.toCam(q[0], q[1] || 0, q[2])));
      if (P) this.world.fillStyle(col, alpha == null ? 1 : alpha).fillPoints(P, true);
    }
    // a pooled billboard image
    bill(o, key) {
      const v = this.toCam(o.x, o.y, o.z);
      if (v[2] < 6) return null;
      const s = VIEW.f * o.size / v[2];
      if (s < 1.2) return null;
      const P = this.proj(v);
      if (P.x < -s * 2 || P.x > W + s * 2 || P.y < -s * 2 || P.y > H + s * 2) return null;
      let im = this.pool[this.poolI++];
      if (!im) { im = this.add.image(0, 0, key); this.pool.push(im); }
      if (im.texture.key !== key) im.setTexture(key);
      im.setVisible(true).setPosition(P.x, P.y).setOrigin(0.5, o.anchor == null ? 0.5 : o.anchor);
      im.setScale(s / Math.max(im.width, im.height)).setRotation(-this.m.p.phi).setDepth(-v[2]).setAlpha(1).clearTint();
      return { im, v, P, s };
    }

    /* ---------------- draw the 3D view ---------------- */
    drawWorld() {
      const g = this.world, C = this.C, p = this.m.p;
      g.clear(); this.poolI = 0;
      this.cam();
      // sky gradient bands parallel to the horizon
      const hl = this.proj(this.dirCam(Math.sin(p.psi - 1.2) * 1, 0, Math.cos(p.psi - 1.2))), hr = this.proj(this.dirCam(Math.sin(p.psi + 1.2), 0, Math.cos(p.psi + 1.2)));
      const dx = hr.x - hl.x, dy = hr.y - hl.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = uy, ny = -ux;   // n points up (sky side)
      const band = (o1, o2, col) => {
        const L = 4000, a = { x: hl.x - ux * L, y: hl.y - uy * L }, b = { x: hr.x + ux * L, y: hr.y + uy * L };
        g.fillStyle(col, 1).fillPoints([{ x: a.x + nx * o1, y: a.y + ny * o1 }, { x: b.x + nx * o1, y: b.y + ny * o1 }, { x: b.x + nx * o2, y: b.y + ny * o2 }, { x: a.x + nx * o2, y: a.y + ny * o2 }], true);
      };
      g.fillStyle(C.top, 1).fillRect(0, 0, W, H);
      const steps = 24;
      for (let i = steps - 1; i >= 0; i--) band(i * 22, (i + 1) * 22 + 2, mix(C.hor, C.top, Math.pow(i / steps, 0.7)));
      // stars at night
      if (this.starsSky) this.starsSky.forEach(s => {
        const v = this.dirCam(Math.sin(s.a) * Math.cos(s.e), Math.sin(s.e), Math.cos(s.a) * Math.cos(s.e));
        if (v[2] > 0.05) { const P = this.proj(v); if (P.x > 0 && P.x < W && P.y > 0 && P.y < H) g.fillStyle(0xffffff, 0.5 + 0.5 * s.s).fillCircle(P.x, P.y, s.s * 1.6); }
      });
      // sun (or moon)
      const sun = this.time_ === "sunset" ? [0.25, 0.12, 1] : this.time_ === "night" ? [-0.4, 0.5, 1] : [0.45, 0.55, 1];
      const sv = this.dirCam(sun[0], sun[1], sun[2]);
      if (sv[2] > 0.1) { const P = this.proj(sv); g.fillStyle(C.sun, 0.25).fillCircle(P.x, P.y, 70); g.fillStyle(C.sun, 1).fillCircle(P.x, P.y, this.time_ === "night" ? 22 : 34); }
      // the sea: everything below the horizon
      band(-3000, 0, C.sea);
      band(-26, 0, mix(C.sea, C.haze, 0.5));
      band(-8, 0, C.haze);
      // islands (sand, then grass), fields, runways
      F.ISLANDS.forEach((is, k) => {
        const cx = is.pts.reduce((a, q) => a + q[0], 0) / is.pts.length, cz = is.pts.reduce((a, q) => a + q[1], 0) / is.pts.length;
        const d = Math.hypot(cx - p.x, cz - p.z), fade = clamp((d - 3500) / 9000, 0, 0.7);
        this.fillWorld(is.pts.map(q => [q[0], 0, q[1]]), mix(C.sand, C.haze, fade));
        this.fillWorld(is.pts.map(q => [cx + (q[0] - cx) * 0.95, 0, cz + (q[1] - cz) * 0.95]), mix(C.grass, C.haze, fade));
      });
      const night = this.time_ === "night";
      this.fields.forEach(f => {
        if (Math.hypot(f.cx - p.x, f.cz - p.z) > 5000) return;
        this.fillWorld(f.pts.map(q => [q[0], 0, q[1]]), night ? mix(f.col, 0x10203a, 0.65) : f.col);
      });
      F.RUNWAYS.forEach(rw => this.drawRunway(rw));
      // landing gates (frames in the air)
      this.gates.forEach(gt => {
        const cs = Math.cos(gt.h), sn = Math.sin(gt.h), c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => this.toCam(gt.x + cs * u * gt.w / 2, gt.y + v * gt.hh / 2, gt.z - sn * u * gt.w / 2));
        if (c.some(q => q[2] < 4)) return;
        const P = c.map(q => this.proj(q)), lw = clamp(VIEW.f * 2.4 / c[0][2], 1, 10);
        g.lineStyle(lw + 3, 0x24305e, 0.35).strokePoints(P, true); g.lineStyle(lw, 0xffd23f, 0.95).strokePoints(P, true);
      });
      // billboards: things, clouds, ring puffs, balloons, the far jet
      const all = [];
      this.things.forEach(o => { if (Math.abs(o.x - p.x) < 3500 && Math.abs(o.z - p.z) < 3500) all.push(o); });
      this.clouds.forEach(o => all.push(o));
      const nxt = this.m.next;
      this.m.rings.forEach(r => { if (!r.passed && !r.missed) { this.dressRing(r); r.puffs.forEach(o => all.push(o)); } });
      this.balloons.forEach(o => all.push(o));
      all.push(this.jet);
      let fog = 0;
      all.forEach(o => {
        const b = this.bill(o, o.key);
        if (o.cloud) {
          const d = Math.hypot(o.x - p.x, (o.y - p.y) * 2, o.z - p.z);
          if (d < o.size * 0.55) fog = Math.max(fog, 1 - d / (o.size * 0.55));
        }
        if (!b) return;
        if (o.cloud) { b.im.setTint(this.C.cloud); b.im.setAlpha(clamp((b.v[2] - 20) / 120, 0, 1) * 0.95); }
        if (o.ring) {
          const isNext = o.ring === nxt;
          b.im.setRotation(o.rot).setAlpha(isNext ? 1 : 0.55);
          if (isNext) b.im.setTint(0xfff3a8);
          else b.im.setTint(this.C.cloud);
        }
        if (night && (o.key === "house" || o.key === "house2") && b.s > 4) b.im.setTint(0xffe9a0);
        else if (night && !o.ring && !o.cloud && !o.b) b.im.setTint(0x6a7aa8);
      });
      // a golden glow inside the next ring, so it's easy to find
      if (nxt) {
        const v = this.toCam(nxt.x, nxt.y, nxt.z);
        if (v[2] > 10) { const P = this.proj(v), s = VIEW.f * nxt.r * 2 / v[2];
          let im = this.pool[this.poolI++]; if (!im) { im = this.add.image(0, 0, "glow"); this.pool.push(im); }
          if (im.texture.key !== "glow") im.setTexture("glow");
          im.setVisible(true).setOrigin(0.5).setPosition(P.x, P.y).setScale(s / 128).setRotation(0).setDepth(-v[2] - 2).setAlpha(0.5 + 0.2 * Math.sin(this.time.now / 200)).clearTint();
        }
      }
      for (let i = this.poolI; i < this.pool.length; i++) this.pool[i].setVisible(false);
      this.cloudFog += (fog - this.cloudFog) * 0.15;
      this.fog.setFillStyle(this.C.cloud, this.cloudFog * 0.85);
    }
    drawRunway(rw) {
      const p = this.m.p;
      if (Math.hypot(rw.x - p.x, rw.z - p.z) > 9000) return;
      const h = rw.hdg * D2R, cs = Math.cos(h), sn = Math.sin(h);
      const pt = (along, across) => [rw.x + sn * along + cs * across, 0, rw.z + cs * along - sn * across];
      const quad = (a0, a1, c0, c1, col, al) => this.fillWorld([pt(a0, c0), pt(a1, c0), pt(a1, c1), pt(a0, c1)], col, al);
      const L = rw.len / 2, Wd = rw.wid / 2, night = this.time_ === "night";
      quad(-L - 40, L + 40, -Wd - 22, Wd + 22, night ? 0x2d4a3e : 0xb5df8c);           // grass strip
      quad(-L, L, -Wd, Wd, night ? 0x3a3f52 : 0x6f7486);                                 // runway
      quad(-L, L, -Wd, -Wd + 1.2, 0xffffff); quad(-L, L, Wd - 1.2, Wd, 0xffffff);         // edges
      for (let a = -L + 60; a < L - 60; a += 50) quad(a, a + 26, -0.6, 0.6, 0xffffff);  // centre dashes
      [-1, 1].forEach(e => { for (let k = -3; k <= 3; k++) { if (!k) continue; const c = k * 3.4; quad(e * (L - 4) - (e > 0 ? 34 : 0), e * (L - 4) + (e > 0 ? 0 : 34), c - 1, c + 1, 0xffffff); } });
      // touch-down aim marks: two fat white bars
      [-1, 1].forEach(e => quad(-L + 110, -L + 150, e * 5 - 2, e * 5 + 2, 0xffffff));
      if (night) for (let a = -L; a <= L; a += 60) [-1, 1].forEach(e => { const q = pt(a, e * (Wd + 1)); const v = this.toCam(q[0], 0.5, q[2]); if (v[2] > 3) { const P = this.proj(v); this.world.fillStyle(0xfff3b0, 1).fillCircle(P.x, P.y, clamp(160 / v[2], 1, 4)); } });
    }

    /* ---------------- cockpit ----------------
       Laid out like a real small plane: the "six pack" of flight instruments in front of the pilot
       (airspeed, attitude, altimeter / turn coordinator, heading, vertical speed), an engine RPM gauge,
       warning lights, MASTER switch and ignition key, flap lever with notches, gear lever with the
       wheel-shaped knob and three green lights, brakes, a GPS map and the throttle. */
    makeCockpit() {
      const D = 10;
      // window frame
      const fr = this.add.graphics().setDepth(D);
      fr.fillStyle(0x2a3350, 1);
      fr.fillRect(0, 0, W, 12); fr.fillTriangle(0, 0, 80, 0, 0, 150); fr.fillTriangle(W, 0, W - 80, 0, W, 150);
      fr.fillStyle(0x3a4670, 1).fillRect(0, 0, W, 5);
      // the nose (Poppy's paint) peeking up over the glareshield
      this.nose = this.add.graphics().setDepth(D);
      this.drawNose();
      this.propG = this.add.graphics().setDepth(D + 0.5);
      this.inst = this.add.graphics().setDepth(D + 2);
      this.inst2 = this.add.graphics().setDepth(D + 3.5);     // needles drawn over the dial labels
      const lab = (x, y, s, size, col) => txt(this, x, y, s, size || 11, col || "#d6dcef", { strokeThickness: 0, fontStyle: "700" }).setDepth(D + 3);
      // six pack positions
      const I = this.I = { asi: [300, 548], ai: [412, 548], alt: [524, 548], tc: [300, 660], hi: [412, 660], vsi: [524, 660], tach: [622, 548], R: 48 };
      lab(I.asi[0], I.asi[1] - 19, "AIRSPEED", 7, "#24305e");
      lab(I.alt[0], I.alt[1] - 19, "ALT  m", 8, "#24305e");
      lab(I.tc[0], I.tc[1] - 30, "TURN COORD", 7, "#ffffff"); lab(I.tc[0] - 34, I.tc[1] + 12, "L", 11, "#ffffff"); lab(I.tc[0] + 34, I.tc[1] + 12, "R", 11, "#ffffff"); lab(I.tc[0], I.tc[1] + 39, "2 MIN", 7, "#ffffff");
      lab(I.vsi[0] + 12, I.vsi[1] - 17, "UP", 8, "#24305e"); lab(I.vsi[0] + 12, I.vsi[1] + 17, "DOWN", 8, "#24305e"); lab(I.vsi[0] + 10, I.vsi[1] + 1, "m/s", 7, "#24305e");
      lab(I.tach[0], I.tach[1] + 15, "RPM", 8, "#24305e"); lab(I.tach[0], I.tach[1] + 24, "x100", 7, "#24305e");
      // dial numbers that stay put
      const ring = (c, vals, ang, r, size, col) => vals.forEach((v, i) => { const a = ang(i, v); lab(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, String(v), size, col || "#24305e"); });
      const asiA = v => -Math.PI / 2 + v / 300 * Math.PI * 1.78;
      ring(I.asi, [0, 50, 100, 150, 200, 250], (i, v) => asiA(v), 30, 10);
      ring(I.alt, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], i => -Math.PI / 2 + i / 10 * Math.PI * 2, 35, 11);
      ring(I.vsi, [0, 5, 10, 5, 10], i => [Math.PI, Math.PI * 1.44, Math.PI * 1.88, Math.PI * 0.56, Math.PI * 0.12][i], 33, 10);
      ring(I.tach, [0, 10, 20, 30], i => Math.PI * 0.75 + i / 3 * Math.PI * 1.5, 25, 9);
      this.ivSpd = lab(I.asi[0], I.asi[1] + 19, "", 9, "#24305e");
      this.ivAlt = lab(I.alt[0], I.alt[1] + 19, "", 9, "#24305e");
      // heading card letters (they turn)
      this.hiTxt = ["N", "3", "6", "E", "12", "15", "S", "21", "24", "W", "30", "33"].map(s => lab(0, 0, s, s.length > 1 ? 9 : 12, "#ffffff"));
      // warning lights
      this.lights = [["STALL", 0xff4d4d], ["GEAR", 0xff4d4d], ["BRAKE", 0xffb020]].map((l, i) => {
        const y = 616 + i * 30; lab(622, y, l[0], 11, "#1e2438").setDepth(D + 3.6);
        return { y, col: l[1], name: l[0] };
      });
      // labels for switches and levers
      lab(712, 506, "MASTER", 11); lab(800, 506, "KEY", 11);
      this.keyLabs = [["OFF", -2.1], ["ON", -0.6], ["START", 0.5]].map(([s, a]) => lab(800 + Math.cos(a - Math.PI / 2) * 38, 548 + Math.sin(a - Math.PI / 2) * 38, s, 8));
      lab(712, 600, "FLAPS", 11);
      this.flapLabs = [["UP", 0, 622], ["10°", 0.4, 656], ["30°", 1, 694]].map(([s, v, y]) => { const t = lab(752, y, s, 12); t.v = v; t.yy = y; return t; });
      lab(866, 506, "GEAR", 11);
      lab(866, 520, "UP", 9); lab(866, 654, "DOWN", 9);
      // stick
      this.stick = { x: 130, y: 606, R: 78, kx: 0, ky: 0, id: null };
      this.stickG = this.add.graphics().setDepth(D + 2);
      this.stickT = [txt(this, 130, 506, this.flip ? "pull ⬆ nose up" : "push ⬇ nose down", 13, "#ffffff", { strokeThickness: 3 }).setDepth(D + 3),
        txt(this, 130, 706, this.flip ? "push ⬇ nose down" : "pull ⬆ nose up", 13, "#ffffff", { strokeThickness: 3 }).setDepth(D + 3)];
      // throttle
      this.thr = { x: 1210, top: 524, bot: 676, id: null };
      this.thrG = this.add.graphics().setDepth(D + 2);
      lab(1210, 498, "THROTTLE", 12, "#ffffff"); lab(1210, 704, "IDLE", 10); lab(1252, 524, "FULL", 10);
      // GPS
      this.mapG = this.add.graphics().setDepth(D + 2);
      this.gpsTxt = lab(1051, 638, "", 10, "#ffffff").setDepth(D + 3.6);
      lab(986, 520, "GPS", 10, "#7fe9ff").setDepth(D + 3.6);
      // brakes
      this.bBrake = button(this, 1051, 686, 150, 50, "BRAKES", 0xe0535a, () => {}, 20).setDepth(D + 3);
      this.bBrake.on("pointerdown", () => { this.brakeHeld = true; });
      this.bBrake.on("pointerup", () => { this.brakeHeld = false; });
      this.bBrake.on("pointerout", () => { this.brakeHeld = false; });
      // tap zones for the switches and levers
      const zone = (x, y, w, h, fn) => { const z = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).setDepth(D + 4); z.on("pointerdown", fn); return z; };
      zone(712, 540, 60, 66, () => this.toggleMaster());
      zone(800, 548, 90, 80, () => this.turnKey());
      this.flapLabs.forEach(t => zone(732, t.yy, 80, 34, () => this.setFlaps(t.v)));
      zone(880, 590, 90, 150, () => this.toggleGear());
      // pointer control
      this.input.addPointer(2);
      this.input.on("pointerdown", ptr => {
        const s = this.stick, t = this.thr;
        if (Math.hypot(ptr.x - s.x, ptr.y - s.y) < s.R * 1.35 && s.id === null) { s.id = ptr.id; this.moveStick(ptr); }
        else if (Math.abs(ptr.x - t.x) < 50 && ptr.y > t.top - 30 && ptr.y < t.bot + 30 && t.id === null) { t.id = ptr.id; this.moveThr(ptr); }
      });
      this.input.on("pointermove", ptr => { if (ptr.id === this.stick.id) this.moveStick(ptr); if (ptr.id === this.thr.id) this.moveThr(ptr); });
      const up = ptr => { if (ptr.id === this.stick.id) { this.stick.id = null; this.stick.kx = this.stick.ky = 0; } if (ptr.id === this.thr.id) this.thr.id = null; };
      this.input.on("pointerup", up); this.input.on("pointerupoutside", up);
      this.crank = 0; this.beepT = 0;
      this.bakePanel();
    }
    drawNose() {
      const g = this.nose; g.clear();
      const c = this.paint, dark = mix(c, 0x000000, 0.18), lite = mix(c, 0xffffff, 0.35);
      g.fillStyle(dark, 1).fillEllipse(W / 2 + 40, DASH_Y + 30, 520, 150);
      g.fillStyle(c, 1).fillEllipse(W / 2 + 40, DASH_Y + 24, 480, 128);
      g.fillStyle(lite, 1).fillEllipse(W / 2 - 20, DASH_Y - 10, 200, 26);
    }
    moveStick(ptr) {
      const s = this.stick; let dx = ptr.x - s.x, dy = ptr.y - s.y; const d = Math.hypot(dx, dy);
      if (d > s.R) { dx *= s.R / d; dy *= s.R / d; }
      s.kx = dx / s.R; s.ky = dy / s.R;
    }
    moveThr(ptr) { const t = this.thr; if (this.m.state === "play") this.m.p.throttle = clamp((t.bot - ptr.y) / (t.bot - t.top), 0, 1); }
    toggleMaster() {
      const p = this.m.p; if (this.m.state !== "play") return;
      if (p.master && !p.onGround) { this.toast("Leave the MASTER switch on while you fly!", 1800); return; }
      p.master = !p.master; S.tick();
      this.toast(p.master ? "⚡ MASTER on: the battery powers the panel and the starter." : "MASTER off.", 1800);
    }
    turnKey() {
      const p = this.m.p; if (this.m.state !== "play") return;
      if (p.engine) {
        if (!p.onGround) { this.toast("Keep the engine running while you fly! 🙂", 1800); return; }
        p.engine = false; S.hum(); this.toast("Engine off.", 1200); return;
      }
      if (this.crank > 0) return;
      if (!p.master) { S.oops(); this.toast("Turn on the MASTER switch first. It powers the starter.", 2200); return; }
      // turn the key to START: the starter cranks, then the engine catches
      this.crank = 1.3; Engine.start(); S.rumble();
    }
    toggleGear() {
      const p = this.m.p; if (this.m.state !== "play") return;
      if (p.onGround) { S.oops(); this.toast("On the ground, a safety switch locks the wheels down.", 2000); return; }
      p.gearCmd = !p.gearCmd; S.hum();
      this.toast(p.gearCmd ? "Gear DOWN... wait for 3 green lights!" : "Gear UP: wheels tucked away, less drag.", 2000);
    }
    setFlaps(v) {
      const p = this.m.p; if (this.m.state !== "play" || p.flapsCmd === v) return;
      p.flapsCmd = v; S.hiss();
      this.toast(v === 0 ? "Flaps UP: a sleek wing for fast flying." : v < 1 ? "Flaps 10°: a little extra lift for take-off." : "Flaps 30°: a big wing for slow flying and landing.", 2000);
    }
    toggleFlaps() { const p = this.m.p; this.setFlaps(p.flapsCmd === 0 ? 0.4 : p.flapsCmd < 1 ? 1 : 0); }

    // everything on the panel that never moves is drawn once into a texture (redrawing hundreds of ticks every frame is slow)
    bakePanel() {
      if (this.textures.exists("panelTex")) this.textures.remove("panelTex");
      const g = this.make.graphics({ add: false }), I = this.I, R = I.R, D2 = Math.PI * 2;
      const bezel = (c, r, face) => { g.fillStyle(0x0f1220, 1).fillCircle(c[0], c[1], r + 6); g.fillStyle(0x50566a, 1).fillCircle(c[0], c[1], r + 3); g.fillStyle(face == null ? 0xf7f4ea : face, 1).fillCircle(c[0], c[1], r); };
      const tick = (c, a, r1, r2, w, col) => g.lineStyle(w, col == null ? 0x24305e : col, 1).lineBetween(c[0] + Math.cos(a) * r1, c[1] + Math.sin(a) * r1, c[0] + Math.cos(a) * r2, c[1] + Math.sin(a) * r2);
      const arcB = (c, r, a0, a1, w, col) => { g.lineStyle(w, col, 1).beginPath(); g.arc(c[0], c[1], r, a0, a1); g.strokePath(); };
      const asiA = v => -Math.PI / 2 + clamp(v, 0, 300) / 300 * Math.PI * 1.78;
      const vsA = v => Math.PI + clamp(v, -10, 10) / 10 * Math.PI * 0.88;
      const thA = r => Math.PI * 0.75 + clamp(r, 0, 3000) / 3000 * Math.PI * 1.5;
      const c = I.ai;
      // the panel itself
      g.fillStyle(0x000000, 0.3).fillRoundedRect(-20, DASH_Y - 8, W + 40, H - DASH_Y + 40, 40);
      g.fillStyle(0x2f3850, 1).fillRoundedRect(-20, DASH_Y, W + 40, H - DASH_Y + 40, 40);
      g.fillStyle(0x1e2438, 1).fillRoundedRect(-20, DASH_Y, W + 40, 16, { tl: 40, tr: 40, bl: 0, br: 0 });   // glareshield
      g.fillStyle(0x283048, 1).fillRoundedRect(242, DASH_Y + 18, 336, 222, 22);                          // six-pack sub-panel
      g.fillStyle(0x283048, 1).fillRoundedRect(668, DASH_Y + 18, 252, 222, 22);                          // switches and levers
      [[252, 502], [568, 502], [252, 708], [568, 708], [678, 502], [910, 502]].forEach(([x, y]) => g.fillStyle(0x59627e, 1).fillCircle(x, y, 3));   // screws
      bezel(I.asi, R);
      arcB(I.asi, R - 12, asiA(73), asiA(150), 5, 0xffffff); arcB(I.asi, R - 6, asiA(82), asiA(210), 7, 0x3fbf5a); arcB(I.asi, R - 6, asiA(210), asiA(250), 7, 0xffc21f);
      g.lineStyle(1, 0x000000, 0.25).strokeCircle(I.asi[0], I.asi[1], R - 14.5);
      tick(I.asi, asiA(250), R - 12, R, 4, 0xe02020);
      for (let v = 0; v <= 300; v += 10) tick(I.asi, asiA(v), v % 50 ? R - 5 : R - 10, R - 1, v % 50 ? 1.2 : 2.5);
      bezel(I.ai, R, 0x5fb3f2);
      [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60].forEach(b => tick(c, -Math.PI / 2 + b * D2R, R - (Math.abs(b) % 30 ? 6 : 10), R, 2, 0xffffff));
      bezel(I.alt, R);
      for (let k = 0; k < 50; k++) tick(I.alt, -Math.PI / 2 + k / 50 * D2, k % 5 ? R - 4 : R - 9, R - 1, k % 5 ? 1 : 2.5);
      bezel(I.tc, R, 0x1d2233);
      [-20, 0, 20].forEach(a => { tick(I.tc, Math.PI + a * D2R, R - 14, R - 2, 3, 0xffffff); tick(I.tc, a * D2R, R - 14, R - 2, 3, 0xffffff); });
      g.fillStyle(0xd9dce6, 1).fillRoundedRect(I.tc[0] - 26, I.tc[1] + 18, 52, 12, 6);
      g.lineStyle(1.5, 0x24305e, 1).lineBetween(I.tc[0] - 6, I.tc[1] + 18, I.tc[0] - 6, I.tc[1] + 30).lineBetween(I.tc[0] + 6, I.tc[1] + 18, I.tc[0] + 6, I.tc[1] + 30);
      bezel(I.hi, R, 0x1d2233);
      bezel(I.vsi, R);
      for (let v = -10; v <= 10; v++) tick(I.vsi, vsA(v), v % 5 ? R - 4 : R - 9, R - 1, v % 5 ? 1 : 2.5);
      bezel(I.tach, 38);
      arcB(I.tach, 32, thA(2100), thA(2700), 6, 0x3fbf5a); tick(I.tach, thA(2700), 26, 38, 3, 0xe02020);
      for (let r = 0; r <= 3000; r += 500) tick(I.tach, thA(r), 31, 37, 2);
      g.fillStyle(0x0f1220, 1).fillRoundedRect(696, 520, 32, 44, 6);
      g.fillStyle(0x0f1220, 1).fillCircle(800, 548, 26); g.fillStyle(0x9aa3b8, 1).fillCircle(800, 548, 20);
      g.fillStyle(0x0f1220, 1).fillRoundedRect(698, 616, 14, 84, 7);
      [622, 656, 694].forEach(y => g.fillStyle(0x59627e, 1).fillRect(694, y - 1, 22, 3));
      g.fillStyle(0x0f1220, 1).fillRoundedRect(780, 640, 50, 40, 8);
      g.fillStyle(0x0f1220, 1).fillRoundedRect(859, 534, 14, 108, 7);
      this.lights.forEach(L => g.fillStyle(0x0f1220, 1).fillRoundedRect(590, L.y - 12, 64, 24, 5));
      [[900, 556], [892, 578], [908, 578]].forEach(([x, y]) => g.fillStyle(0x0f1220, 1).fillCircle(x, y, 8));
      const s = this.stick, t = this.thr;
      g.fillStyle(0x0f1220, 1).fillCircle(s.x, s.y, s.R + 6); g.fillStyle(0x1b2030, 1).fillCircle(s.x, s.y, s.R);
      for (let k = 0; k < 8; k++) { const a = k / 8 * D2; g.lineStyle(2, 0x2c3348, 1).lineBetween(s.x + Math.cos(a) * 20, s.y + Math.sin(a) * 20, s.x + Math.cos(a) * (s.R - 4), s.y + Math.sin(a) * (s.R - 4)); }   // rubber boot folds
      g.fillStyle(0x0f1220, 1).fillRoundedRect(t.x - 10, t.top - 6, 20, t.bot - t.top + 12, 10);
      for (let k = 0; k <= 4; k++) g.fillStyle(0x59627e, 1).fillRect(t.x + 16, t.top + k * (t.bot - t.top) / 4 - 1, 12, 2);
      g.generateTexture("panelTex", W, H); g.destroy();
      this.add.image(0, 0, "panelTex").setOrigin(0).setDepth(11);
    }

    drawCockpit(dt) {
      const p = this.m.p, g = this.inst, n = this.inst2, I = this.I, R = I.R, kmh = p.V * F.KMH, D2 = Math.PI * 2;
      g.clear(); n.clear();
      // engine start: the starter cranks for a moment, then the engine catches
      if (this.crank > 0) { this.crank -= dt; p.spin = Math.max(p.spin, 0.25); if (this.crank <= 0) { this.crank = 0; p.engine = true; S.whoosh(); this.toast("Vroom! The engine is running.", 1500); } }
      const bezel = (c, r, face) => { g.fillStyle(0x0f1220, 1).fillCircle(c[0], c[1], r + 6); g.fillStyle(0x50566a, 1).fillCircle(c[0], c[1], r + 3); g.fillStyle(face == null ? 0xf7f4ea : face, 1).fillCircle(c[0], c[1], r); };
      const tick = (c, a, r1, r2, w, col) => g.lineStyle(w, col == null ? 0x24305e : col, 1).lineBetween(c[0] + Math.cos(a) * r1, c[1] + Math.sin(a) * r1, c[0] + Math.cos(a) * r2, c[1] + Math.sin(a) * r2);
      const needle = (c, a, len, col, w) => { n.lineStyle(w || 4, col, 1).lineBetween(c[0] - Math.cos(a) * 8, c[1] - Math.sin(a) * 8, c[0] + Math.cos(a) * len, c[1] + Math.sin(a) * len); n.fillStyle(0x24305e, 1).fillCircle(c[0], c[1], 4); };
      const arcB = (c, r, a0, a1, w, col) => { g.lineStyle(w, col, 1).beginPath(); g.arc(c[0], c[1], r, a0, a1); g.strokePath(); };

      // 1. AIRSPEED (km/h): white arc = flaps OK, green = normal, yellow = careful, red line = never faster
      const asiA = v => -Math.PI / 2 + clamp(v, 0, 300) / 300 * Math.PI * 1.78;
      needle(I.asi, asiA(kmh), R - 6, 0x24305e);
      this.ivSpd.setText(Math.round(kmh) + " km/h");
      // 2. ATTITUDE: sky and ground move behind the little orange airplane
      const c = I.ai, off = clamp(p.theta / D2R * 1.5, -R * 0.9, R * 0.9), cr = Math.cos(-p.phi), sr = Math.sin(-p.phi);
      const pt = (u, v) => ({ x: c[0] + u * cr - v * sr, y: c[1] + u * sr + v * cr });
      const circ = []; for (let i = 0; i < 48; i++) { const a = i / 48 * D2; circ.push({ x: c[0] + Math.cos(a) * R, y: c[1] + Math.sin(a) * R }); }
      const o = pt(0, off), nx = -sr, ny = cr, side = q => (q.x - o.x) * nx + (q.y - o.y) * ny, gnd = [];
      circ.forEach((q, i) => { const r2 = circ[(i + 1) % circ.length], s1 = side(q), s2 = side(r2);
        if (s1 >= 0) gnd.push(q);
        if ((s1 >= 0) !== (s2 >= 0)) { const t = s1 / (s1 - s2); gnd.push({ x: q.x + (r2.x - q.x) * t, y: q.y + (r2.y - q.y) * t }); } });
      if (gnd.length > 2) g.fillStyle(0xa8743f, 1).fillPoints(gnd, true);
      const seg = (u1, v1, u2, v2, w, col) => { const a = pt(u1, v1), b = pt(u2, v2); g.lineStyle(w, col, 1).lineBetween(a.x, a.y, b.x, b.y); };
      seg(-R * 0.98, off, R * 0.98, off, 2, 0xffffff);
      [-20, -10, 10, 20].forEach(dg => { const v = off - dg * 1.5, hw = Math.abs(dg) === 10 ? 12 : 20; if (Math.abs(v) < R - 10) seg(-hw, v, hw, v, 1.5, 0xffffff); });
      // bank scale on the rim: 10, 20, 30, 45, 60 degrees
      const bi = -Math.PI / 2 - p.phi, bp = [[0, R - 3], [-5, R - 12], [5, R - 12]].map(([u, v]) => ({ x: c[0] + Math.cos(bi) * v - Math.sin(bi) * u, y: c[1] + Math.sin(bi) * v + Math.cos(bi) * u }));
      n.fillStyle(0xffffff, 1).fillPoints(bp, true);
      n.lineStyle(5, 0xff9a1a, 1).lineBetween(c[0] - 30, c[1], c[0] - 10, c[1]).lineBetween(c[0] + 10, c[1], c[0] + 30, c[1]).lineBetween(c[0] - 10, c[1], c[0], c[1] + 6).lineBetween(c[0], c[1] + 6, c[0] + 10, c[1]);
      n.fillStyle(0xff9a1a, 1).fillCircle(c[0], c[1], 3);
      // 3. ALTIMETER (meters): long hand 10 m per number, short hand 100 m per number
      needle(I.alt, -Math.PI / 2 + (p.y / 1000) * D2, R - 26, 0x24305e, 6);
      needle(I.alt, -Math.PI / 2 + (p.y / 100) * D2, R - 6, 0x24305e, 3);
      this.ivAlt.setText(Math.round(p.y) + " m");
      // 4. TURN COORDINATOR: the little plane tips with the turn rate; the ball shows a smooth (coordinated) turn
      const rate = p.onGround ? 0 : p.lift * Math.sin(p.phi) / Math.max(6, p.V) / D2R;   // degrees per second
      const tca = clamp(rate / 3, -1.6, 1.6) * 20 * D2R;
      const tcp = (u, v) => ({ x: I.tc[0] + u * Math.cos(tca) - v * Math.sin(tca), y: I.tc[1] - 4 + u * Math.sin(tca) + v * Math.cos(tca) });
      n.fillStyle(0xffffff, 1).fillPoints([tcp(-34, -2), tcp(34, -2), tcp(34, 2), tcp(-34, 2)], true).fillPoints([tcp(-5, -8), tcp(5, -8), tcp(5, 5), tcp(-5, 5)], true);
      const t1 = tcp(-10, 9), t2 = tcp(10, 9); n.lineStyle(3, 0xffffff, 1).lineBetween(t1.x, t1.y, t2.x, t2.y);
      // the ball wobbles a little when the wings start or stop tilting, then settles in the middle
      const dphi = (p.phi - (this.lastPhi || 0)) / Math.max(dt, 1e-3); this.lastPhi = p.phi;
      this.ball = (this.ball || 0) + (clamp(-dphi * 0.25, -1, 1) - (this.ball || 0)) * 0.12;
      n.fillStyle(0x111111, 1).fillCircle(I.tc[0] + this.ball * 18, I.tc[1] + 24, 5);
      // 5. HEADING INDICATOR: the compass card turns, the little plane always points up
      const hdg = p.psi;
      for (let k = 0; k < 36; k++) { const a = -Math.PI / 2 + k / 36 * D2 - hdg; tick(I.hi, a, k % 3 ? R - 5 : R - 9, R - 1, k % 3 ? 1 : 2, 0xffffff); }
      this.hiTxt.forEach((t, k) => { const a = -Math.PI / 2 + k / 12 * D2 - hdg; t.setPosition(I.hi[0] + Math.cos(a) * (R - 17), I.hi[1] + Math.sin(a) * (R - 17)).setRotation(a + Math.PI / 2); setCol(t, k % 3 ? "#ffffff" : "#ffd23f"); });
      n.fillStyle(0xff9a1a, 1).fillTriangle(I.hi[0], I.hi[1] - R + 2, I.hi[0] - 5, I.hi[1] - R - 6, I.hi[0] + 5, I.hi[1] - R - 6);
      n.lineStyle(3, 0xff9a1a, 1).lineBetween(I.hi[0], I.hi[1] - 18, I.hi[0], I.hi[1] + 16).lineBetween(I.hi[0] - 15, I.hi[1] - 2, I.hi[0] + 15, I.hi[1] - 2).lineBetween(I.hi[0] - 6, I.hi[1] + 13, I.hi[0] + 6, I.hi[1] + 13);
      // 6. VERTICAL SPEED (m/s): 0 at the 9 o'clock spot, up is above
      const vsA = v => Math.PI + clamp(v, -10, 10) / 10 * Math.PI * 0.88;
      needle(I.vsi, vsA(p.V * Math.sin(p.gamma)), R - 6, 0x24305e);
      // ENGINE RPM: green arc = normal running
      const rpm = p.spin * (700 + p.throttle * 1900) + (this.crank > 0 ? 250 + Math.random() * 60 : 0);
      const thA = r => Math.PI * 0.75 + clamp(r, 0, 3000) / 3000 * Math.PI * 1.5;
      needle(I.tach, thA(rpm), 32, 0x24305e, 3);
      // WARNING LIGHTS: stall horn, gear not down (when slow and low), brakes
      const gearWarn = !p.onGround && !p.gear && (p.gearCmd || (p.throttle < 0.25 && p.y < 150));
      const stall = !p.onGround && p.slow > 0.25;
      const blink = Math.sin(this.time.now / 110) > 0;
      [stall, gearWarn && (p.gearCmd || blink), p.brake && p.onGround].forEach((on, i) => {
        const L = this.lights[i];
        g.fillStyle(on ? L.col : mix(L.col, 0x2a2f40, 0.8), 1).fillRoundedRect(593, L.y - 9, 58, 18, 4);
      });
      this.beepT -= dt;
      if ((stall || (gearWarn && !p.gearCmd)) && this.beepT <= 0 && this.m.state === "play") { this.beepT = 0.5; S.tick(); }
      // MASTER switch (a red rocker) and the KEY
      g.fillStyle(0xe0535a, 1).fillRoundedRect(699, p.master ? 523 : 539, 26, 22, 5);
      g.fillStyle(0xffffff, 0.5).fillRect(703, p.master ? 526 : 553, 18, 3);
      const kc = [800, 548];
      const ka = (p.engine ? -0.6 : this.crank > 0 ? 0.5 : -2.1) - Math.PI / 2;
      g.lineStyle(9, 0xd8b44a, 1).lineBetween(kc[0] - Math.cos(ka) * 14, kc[1] - Math.sin(ka) * 14, kc[0] + Math.cos(ka) * 16, kc[1] + Math.sin(ka) * 16);
      g.fillStyle(0xd8b44a, 1).fillCircle(kc[0] - Math.cos(ka) * 14, kc[1] - Math.sin(ka) * 14, 7);
      this.keyLabs.forEach((t, i) => setCol(t, (i === 0 && !p.engine && !this.crank) || (i === 1 && p.engine) || (i === 2 && this.crank > 0) ? "#ffd23f" : "#d6dcef"));
      // FLAP lever: a white handle in a slot with three notches; the little wing shows where the flaps really are
      const fy = 622 + (p.flapsCmd >= 1 ? 72 : p.flapsCmd > 0 ? 34 : 0);
      g.fillStyle(0x000000, 0.3).fillRoundedRect(687, fy - 6, 40, 16, 6); g.fillStyle(0xf2f2f2, 1).fillRoundedRect(685, fy - 9, 40, 16, 6);
      const fa = p.flaps * 30 * D2R;   // flap position: a little wing that droops
      g.lineStyle(5, 0xffffff, 1).lineBetween(786, 652, 806, 652); g.lineStyle(5, 0x7fe9ff, 1).lineBetween(806, 652, 806 + Math.cos(fa) * 16, 652 + Math.sin(fa) * 16);
      this.flapLabs.forEach(t => setCol(t, p.flapsCmd === t.v ? "#ffd23f" : "#d6dcef"));
      // GEAR lever: wheel-shaped knob, UP or DOWN; three lights: green = down and locked, red = moving
      const gy = p.gearCmd ? 626 : 548;
      g.fillStyle(0x000000, 0.35).fillCircle(868, gy + 4, 17); g.fillStyle(0x2a2a2a, 1).fillCircle(866, gy, 17); g.fillStyle(0xd0d4de, 1).fillCircle(866, gy, 8); g.fillStyle(0x2a2a2a, 1).fillCircle(866, gy, 3);
      const moving = p.gearPos > 0 && p.gearPos < 1;
      [[900, 556], [892, 578], [908, 578]].forEach(([x, y]) => {
        const col = p.gearPos >= 1 ? 0x3fe060 : moving ? 0xff4d4d : 0x2a3a2e;
        g.fillStyle(col, 1).fillCircle(x, y, 6);
      });
      if (moving) g.fillStyle(0xff4d4d, blink ? 1 : 0.4).fillRoundedRect(886, 598, 28, 12, 4);
      // stick
      const s = this.stick, live = s.id !== null, kx = live ? s.kx : this.kbX, ky = live ? s.ky : this.kbY, sg = this.stickG;
      const sgx = s.x + kx * s.R * 0.75, sgy = s.y + ky * s.R * 0.75;
      sg.clear();
      sg.lineStyle(16, 0x3a3f50, 1).lineBetween(s.x, s.y, sgx, sgy);
      sg.fillStyle(0x000000, 0.35).fillRoundedRect(sgx - 20, sgy - 28, 44, 62, 18);
      sg.fillStyle(0x2a2d36, 1).fillRoundedRect(sgx - 22, sgy - 32, 44, 62, 18);
      sg.fillStyle(0x454b5c, 1).fillRoundedRect(sgx - 16, sgy - 26, 14, 50, 7);
      sg.fillStyle(0xe0535a, 1).fillCircle(sgx + 8, sgy - 22, 6);
      // throttle quadrant: black knob on a lever
      const t = this.thr, tg = this.thrG, ty = t.bot - (t.bot - t.top) * p.throttle;
      tg.clear();
      tg.fillStyle(0x7a8094, 1).fillRect(t.x - 4, ty, 8, t.bot - ty + 6);
      tg.fillStyle(0x000000, 0.35).fillRoundedRect(t.x - 30, ty - 15, 64, 34, 12);
      tg.fillStyle(0x1a1a1a, 1).fillRoundedRect(t.x - 32, ty - 19, 64, 34, 12); tg.fillStyle(0x3a3a3a, 1).fillRoundedRect(t.x - 26, ty - 15, 52, 8, 4);
      // propeller, seen from the cockpit: it spins in a circle facing us, like clock hands around the red spinner.
      // Real props have yellow tips, so a spinning prop shows a faint disc with a yellow ring.
      const pg = this.propG, px = W / 2 + 40, py = DASH_Y - 34, PR = 150, PRy = 0.94; pg.clear();
      this.prop += p.spin * 0.9 * dt * 60;
      const blade = (a, alpha) => {
        const ca = Math.cos(a), sa = Math.sin(a), P = (r, w) => ({ x: px + ca * r - sa * w, y: py + (sa * r + ca * w) * PRy });
        pg.fillStyle(0x34302c, alpha).fillPoints([P(16, -11), P(PR * 0.55, -13), P(PR - 6, -8), P(PR, 0), P(PR - 6, 8), P(PR * 0.55, 12), P(16, 9)], true);
        pg.fillStyle(0xffd23f, alpha).fillPoints([P(PR - 20, -9), P(PR - 6, -8), P(PR, 0), P(PR - 6, 8), P(PR - 20, 9)], true);
      };
      if (p.spin > 0.5) {
        pg.fillStyle(0x6a6058, 0.05 + p.spin * 0.05).fillEllipse(px, py, PR * 2, PR * 2 * PRy);
        pg.lineStyle(10, 0xffd23f, 0.12 + p.spin * 0.14).strokeEllipse(px, py, PR * 2 - 22, (PR * 2 - 22) * PRy);
        for (let k = 0; k < 2; k++) blade(this.prop * 3 + k * Math.PI, 0.1);
      } else {
        for (let k = 0; k < 2; k++) blade(this.prop + 0.5 + k * Math.PI, 1);
      }
      pg.fillStyle(0xa8352a, 1).fillCircle(px, py + 2, 22); pg.fillStyle(0xd94b3b, 1).fillCircle(px, py, 21); pg.fillStyle(0xff8a80, 1).fillCircle(px - 6, py - 7, 6);
      // GPS map: plane in the middle, north up, 3 km each way, magenta line to the next waypoint like a real GPS
      const mg = this.mapG, mx = 1051, my = 568, ms = 64 / 3000; mg.clear();
      mg.fillStyle(0x1f5f96, 1).fillRect(966, 508, 170, 140);
      const X0 = 966, Y0 = 508, X1 = 1136, Y1 = 648, inR = (x, y) => x > X0 && x < X1 && y > Y0 && y < Y1;
      const M = (x, z) => ({ x: mx + (x - p.x) * ms, y: my - (z - p.z) * ms });
      F.ISLANDS.forEach(is => { const P = clipPoly(is.pts.map(q => M(q[0], q[1])), X0, Y0, X1, Y1); if (P) mg.fillStyle(0x4f9a4a, 1).fillPoints(P, true); });
      const line = (a, b, w, col) => { const l = clipLine(a, b, X0, Y0, X1, Y1); if (l) mg.lineStyle(w, col, 1).lineBetween(l[0], l[1], l[2], l[3]); };
      F.RUNWAYS.forEach(rw => { const a = F.runwayPoint(rw, -1), b = F.runwayPoint(rw, 1); line(M(a.x, a.z), M(b.x, b.z), 4, 0xffffff); });
      const nxt = this.m.next;
      if (nxt) line({ x: mx, y: my }, M(nxt.x, nxt.z), 2, 0xff4df0);   // magenta course line, like a real GPS
      this.m.rings.forEach(r => { if (r.passed || r.missed) return; const q = M(r.x, r.z); if (inR(q.x, q.y)) mg.fillStyle(r === nxt ? 0xffd23f : 0xffffff, 1).fillCircle(q.x, q.y, r === nxt ? 4 : 2.5); });
      this.balloons.forEach(b => { const q = M(b.x, b.z); if (inR(q.x, q.y)) mg.fillStyle(b.b.waved ? 0xffffff : 0xff7a6b, 1).fillCircle(q.x, q.y, 3); });
      const tri = [[0, -9], [6, 6], [0, 3], [-6, 6]].map(([u, v]) => ({ x: mx + u * Math.cos(p.psi) - v * Math.sin(p.psi), y: my + u * Math.sin(p.psi) + v * Math.cos(p.psi) }));
      mg.fillStyle(0xffffff, 1).fillPoints(tri, true);
      mg.fillStyle(0x0f1220, 0.8).fillRect(966, 628, 170, 20);
      mg.lineStyle(5, 0x0f1220, 1).strokeRoundedRect(966, 508, 170, 140, 10);
      const hd = Math.round(((p.psi / D2R) + 360) % 360);
      this.gpsTxt.setText("HDG " + String(hd).padStart(3, "0") + "°   GS " + Math.round(kmh) + " km/h");
    }

    /* ---------------- HUD ---------------- */
    makeHud() {
      const D = 20;
      this.lin = fit(this.add.image(70, 92, "lin"), 112).setDepth(D);
      this.hintBox = this.add.graphics().setDepth(D);
      this.hintTxt = txt(this, 140, 70, "", 26, "#24305e", { strokeThickness: 0, align: "left", wordWrap: { width: 700 } }).setOrigin(0, 0.5).setDepth(D + 1);
      this.goalTxt = txt(this, W - 26, 34, "", 26, "#ffffff", { align: "right" }).setOrigin(1, 0.5).setDepth(D);
      this.warnTxt = txt(this, W / 2, 210, "", 44, "#ffe066", { strokeThickness: 8 }).setDepth(D);
      this.toastTxt = txt(this, W / 2, 452, "", 24, "#ffffff", { strokeThickness: 6 }).setDepth(D);
      this.pointer = txt(this, 0, 0, "👆", 52, "#ffffff", { strokeThickness: 0 }).setDepth(D + 5).setVisible(false);
      this.arrow = this.add.graphics().setDepth(D);
      button(this, W - 52, 86, 76, 54, "⏸", 0x4f86f7, () => this.pause(), 28).setDepth(D);
    }
    hint(text, target) {
      if (this.hintNow === text) return;
      this.hintNow = text;
      this.hintTxt.setText(text);
      const b = this.hintTxt.getBounds(), g = this.hintBox;
      g.clear(); if (text) { g.fillStyle(0x000000, 0.2).fillRoundedRect(122, b.y - 12 + 5, b.width + 36, b.height + 24, 22); g.fillStyle(0xffffff, 0.95).fillRoundedRect(122, b.y - 12, b.width + 36, b.height + 24, 22);
        g.fillStyle(0xffffff, 0.95).fillTriangle(110, 70, 126, 58, 126, 82); }
      this.pointAt(target);
      if (text) say(text);
    }
    pointAt(target) {
      this.tweens.killTweensOf(this.pointer);
      if (!target) { this.pointer.setVisible(false); return; }
      const below = target[1] < 640;
      this.pointer.setVisible(true).setPosition(target[0] + 6, target[1] + (below ? 46 : -46)).setFlipY(!below);
      this.tweens.add({ targets: this.pointer, y: target[1] + (below ? 60 : -60), yoyo: true, repeat: -1, duration: 420, ease: "Sine.inOut" });
    }
    toast(t, ms) {
      this.toastTxt.setText(t).setAlpha(1);
      this.tweens.killTweensOf(this.toastTxt);
      this.tweens.add({ targets: this.toastTxt, alpha: 0, delay: ms || 1600, duration: 400 });
    }
    intro() {
      const L = this.L;
      const first = {
        0: "Free flight! Take off and fly anywhere. Find the glowing cloud rings!",
        2: "Fly through the cloud rings! Pull the stick back to go up, push it to go down.",
        3: "Tilt the stick left or right to bank and turn, like a bird!",
        4: "Climbing makes Poppy slower. Push the THROTTLE up when you climb!",
        6: "Take off, then wave to the balloons! Fly close, but not too close.",
        7: "Pilots fly a big rectangle around the airport, then line up and land!",
        8: "Fly across the sea, then land on Palm Island's runway!",
      }[L.id];
      if (first) this.hint(first);
    }
    tutorial() {
      const p = this.m.p, L = this.L, kmh = p.V * F.KMH;
      if (L.id === 1) {
        if (!p.master) return this.hint("Let's fly! Real pilots start with the MASTER switch. Tap it ON.", [712, 540]);
        if (!p.engine) return this.hint(this.crank > 0 ? "The starter is turning the propeller..." : "Now turn the KEY to START the engine.", this.crank > 0 ? null : [800, 548]);
        if (p.onGround && p.flapsCmd === 0 && p.V < 5) return this.hint("Set the FLAPS to 10°. A little flap gives extra lift for take-off.", [740, 656]);
        if (p.onGround && p.throttle < 0.85) return this.hint("Push the THROTTLE all the way up! The propeller pushes air back, so Poppy rolls forward.", [1210, 600]);
        if (p.onGround && kmh < 95) return this.hint("Faster, faster! Watch the AIRSPEED needle. Wings need lots of fast air to make lift.", [300, 548]);
        if (p.onGround) return this.hint("95 km/h! Now pull the stick back (toward you) to lift the nose!", [130, 660]);
        if (p.gearCmd) return this.hint("We're flying! Move the GEAR lever UP to tuck the wheels in.", [866, 590]);
        if (p.flapsCmd > 0 && p.y > 50) return this.hint("Flaps UP now: a sleek wing climbs faster.", [740, 622]);
        return this.hint("Keep climbing to " + L.climb + " meters! Watch the ALTIMETER.", [524, 548]);
      }
      if (L.id === 5) {
        if (p.onGround && this.m.landed) return this.hint(p.V > 3 ? "You landed! Press and hold BRAKES to stop." : "Stopped! Great landing.", p.V > 3 ? [1051, 686] : null);
        if (!p.gearCmd) return this.hint("Landing time! Move the GEAR lever DOWN.", [866, 590]);
        if (!p.gear) return this.hint("Wait for 3 green lights: the wheels are down and locked.", [900, 570]);
        if (p.flapsCmd < 1) return this.hint("Set the FLAPS to 30°: a bigger wing lets Poppy fly slowly.", [740, 694]);
        if (kmh > 135) return this.hint("Pull the THROTTLE back a little to slow down.", [1210, 640]);
        if (p.y > 9) return this.hint("Fly through the yellow gates, down to the runway. Push the stick a little to go down.", null);
        return this.hint("Almost there... gently, gently! Pull back a tiny bit just before the wheels touch.", null);
      }
    }

    /* ---------------- loop ---------------- */
    update(t, dms) {
      if (this.paused) return;
      const dt = Math.min(0.05, dms / 1000) * SPEED, m = this.m, p = m.p, k = this.keys;
      // keyboard stick
      this.kbX = (k.RIGHT.isDown ? 1 : 0) - (k.LEFT.isDown ? 1 : 0);
      this.kbY = (k.DOWN.isDown ? 1 : 0) - (k.UP.isDown ? 1 : 0);
      if (m.state === "play") {
        if (k.W.isDown || k.A.isDown) p.throttle = clamp(p.throttle + dt * 0.6, 0, 1);
        if (k.S.isDown || k.Z.isDown) p.throttle = clamp(p.throttle - dt * 0.6, 0, 1);
      }
      const sx = this.stick.id !== null ? this.stick.kx : this.kbX, sy0 = this.stick.id !== null ? this.stick.ky : this.kbY;
      const sy = this.flip ? -sy0 : sy0;
      p.brake = !!(this.brakeHeld || k.B.isDown || k.SPACE.isDown);
      const input = this.auto ? F.bot(m, dt) : { x: sx, y: sy };
      // fixed physics steps
      this.acc += dt;
      while (this.acc >= 1 / 60) { this.acc -= 1 / 60; m.update(input, 1 / 60); }
      // balloons drift slowly; the far jet circles
      this.jet.a += dt * 0.03; this.jet.x = Math.sin(this.jet.a) * 5200; this.jet.z = Math.cos(this.jet.a) * 5200 + 1500; this.jet.y = 1100;
      this.drawWorld();
      this.drawCockpit(dt);
      Engine.set(p.spin, p.throttle);
      this.handleEvents();
      this.hud(dt);
    }
    handleEvents() {
      const m = this.m;
      for (const e of m.events.splice(0)) {
        if (e.e === "ring") { S.ding(); this.flash(0xfff3a8); const n = m.rings.filter(r => r.passed).length; this.toast(this.L.free ? "☁️ " + m.freeCount + "!" : ["Swoosh!", "Nice!", "Great flying!", "Wheee!", "Right through!"][n % 5], 900); }
        if (e.e === "miss") { this.toast("Missed one. Keep going!", 1200); }
        if (e.e === "liftoff") { S.whoosh(); this.toast("🛫 Lift-off! The wings are lifting Poppy!", 2200); }
        if (e.e === "slow") { S.oops(); }
        if (e.e === "wave") { S.chirp(); this.toast("👋 Hello, balloon friends!", 1500); }
        if (e.e === "close") { this.toast("Whoa, too close! Give the balloon lots of room.", 1600); }
        if (e.e === "touchdown") { S.dig(); this.cameras.main.shake(180, e.smooth ? 0.002 : 0.006); this.toast(e.smooth ? "✨ Smooth landing!" : "Bump! A bit hard, but safe.", 1800); }
        if (e.e === "fail") { S.oops(); this.cameras.main.shake(300, 0.01); this.time.delayedCall(600, () => this.result(false)); }
        if (e.e === "win") { S.yay(); this.time.delayedCall(500, () => this.result(true)); }
      }
    }
    flash(col) { const r = this.add.rectangle(W / 2, H / 2, W, H, col, 0.35).setDepth(8); this.tweens.add({ targets: r, alpha: 0, duration: 350, onComplete: () => r.destroy() }); }
    hud(dt) {
      const m = this.m, p = m.p, L = this.L, nRings = m.rings.length;
      // goal line
      let goal = "";
      if (L.free) goal = "☁️ " + m.freeCount;
      else if (nRings) goal = "☁️ " + m.rings.filter(r => r.passed).length + " / " + nRings;
      else if (L.goal === "takeoff") goal = "🎯 " + Math.round(p.y) + " / " + L.climb + " m";
      if (this.balloons.length) goal += "   🎈 " + this.balloons.filter(b => b.b.waved).length + "/" + this.balloons.length;
      if (L.land && !nRings) goal = "🛬 " + L.land.name;
      this.goalTxt.setText(goal);
      // warnings
      const vs = -p.V * Math.sin(p.gamma);
      let warn = "";
      if (m.state === "play" && !p.onGround) {
        if (p.slow > 0.6) warn = "TOO SLOW! More THROTTLE!";
        else if (p.y < 30 && vs > 4.5) warn = "PULL UP! Gently!";
        else if (m.far) warn = "Turn back to the islands!";
      }
      this.warnTxt.setText(warn).setAlpha(warn ? 0.65 + 0.35 * Math.sin(this.time.now / 120) : 0);
      // hints
      if (this.L.tutorial) this.tutorial();
      else if (this.hintNow && (this.hintT += dt) > 9) { this.hint(""); }
      if (!this.L.tutorial && !this.hintNow && m.state === "play") {
        if (p.onGround && !m.tookOff && !p.engine) this.hint("MASTER on, KEY to start, THROTTLE up, then pull back to take off!", [712, 540]);
        else if (L.land && this.m.next == null && !p.onGround && p.y < 200 && !p.gearCmd) this.hint("Gear DOWN for landing! Wait for 3 green lights.", [866, 590]);
        else if (p.onGround && m.landed && p.V > 3) this.hint("Hold BRAKES to stop!", [1051, 686]);
      }
      if (this.hintNow && !this.L.tutorial) {
        if (p.onGround && p.engine && this.hintNow.startsWith("MASTER on")) this.hint("");
        if (this.hintNow.startsWith("Gear DOWN") && p.gear) this.hint("");
      }
      // guide arrow toward the next ring, gate or runway
      const tgt = m.next || (L.land && !p.onGround ? (() => { const a = F.runwayPoint(L.land, -1); return { x: a.x, y: 0, z: a.z }; })() : null);
      const g = this.arrow; g.clear();
      if (tgt && m.state === "play") {
        const v = this.toCam(tgt.x, tgt.y, tgt.z), P = v[2] > 5 ? this.proj(v) : null;
        if (P && P.x > 60 && P.x < W - 60 && P.y > 40 && P.y < DASH_Y - 60) {
          const bob = Math.sin(this.time.now / 160) * 6, sz = 16;
          g.fillStyle(0x24305e, 0.6).fillTriangle(P.x - sz - 2, P.y - 70 + bob - 2, P.x + sz + 2, P.y - 70 + bob - 2, P.x, P.y - 46 + bob + 2);
          g.fillStyle(0xffd23f, 1).fillTriangle(P.x - sz, P.y - 70 + bob, P.x + sz, P.y - 70 + bob, P.x, P.y - 48 + bob);
        } else {
          // off screen: a big arrow near the middle pointing the way
          let ax = v[0], ay = v[1]; if (v[2] < 0) { ax = -ax; ay = -ay; }
          if (v[2] < 0 && Math.abs(ax) < 1) ax = 1;
          const a = Math.atan2(-ay, ax), cx = W / 2 + Math.cos(a) * 170, cy = VIEW.cy + Math.sin(a) * 120;
          const pts = [[34, 0], [-14, -24], [-6, 0], [-14, 24]].map(([u, w]) => ({ x: cx + u * Math.cos(a) - w * Math.sin(a), y: cy + u * Math.sin(a) + w * Math.cos(a) }));
          g.fillStyle(0x24305e, 0.5).fillPoints(pts.map(q => ({ x: q.x + 3, y: q.y + 4 })), true);
          g.fillStyle(0xffd23f, 0.95).fillPoints(pts, true);
        }
      }
    }

    pause() {
      if (this.m.state !== "play") return;
      this.paused = true; Engine.set(0, 0);
      const c = this.pauseBox = this.add.container(0, 0).setDepth(50);
      c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.4));
      c.add(panel(this, W / 2, H / 2, 640, 360, 0x4f86f7));
      c.add(txt(this, W / 2, 230, "Paused", 48, "#24305e", { strokeThickness: 0 }));
      c.add(button(this, W / 2, 320, 300, 70, "▶ Keep flying", 0x5ccf6a, () => { c.destroy(); this.paused = false; }, 28));
      c.add(button(this, W / 2 - 160, 420, 280, 66, "↻ Restart", 0xff8a3d, () => this.scene.start("fly", { level: this.li }), 26));
      c.add(button(this, W / 2 + 160, 420, 280, 66, "⌂ Missions", 0x4f86f7, () => this.scene.start("menu"), 26));
    }

    result(win) {
      if (this.over) return; this.over = true;
      const m = this.m, L = this.L, sv = save.get();
      this.hint(""); Engine.set(0.3, 0);
      let stars = 0;
      if (L.free) {
        win = true; sv.rings = Math.max(sv.rings || 0, m.freeCount); save.set(sv);
      } else if (win) {
        stars = m.result.stars;
        sv.stars[L.id] = Math.max(sv.stars[L.id] || 0, stars); save.set(sv);
      }
      const c = this.add.container(0, 0).setDepth(60);
      c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.35));
      c.add(panel(this, W / 2, H / 2 - 10, 860, 520, win ? 0x5ccf6a : 0xff8a3d));
      c.add(fit(this.add.image(W / 2 - 330, H / 2 - 120, win ? "poppy" : "lin"), win ? 200 : 140));
      if (L.free) {
        c.add(txt(this, W / 2 + 40, 170, "What a flight!", 52, "#24305e", { strokeThickness: 0 }));
        c.add(txt(this, W / 2 + 40, 250, "You flew through ☁️ " + m.freeCount + " cloud rings.\nBest: " + sv.rings, 30, "#5b4f73", { strokeThickness: 0 }));
      } else if (win) {
        c.add(txt(this, W / 2 + 40, 150, ["Great flying, pilot!", "Mission complete!", "Super pilot!"][stars - 1], 50, "#24305e", { strokeThickness: 0 }));
        c.add(txt(this, W / 2 + 40, 225, "★".repeat(stars) + "☆".repeat(3 - stars), 70, "#ffc41f", { strokeThickness: 6 }));
        L.stars.forEach((s, i) => c.add(txt(this, W / 2 + 40, 300 + i * 38, (m.result.got[i] ? "⭐ " : "☆ ") + s, 26, m.result.got[i] ? "#24305e" : "#9a92ad", { strokeThickness: 0 })));
      } else {
        c.add(txt(this, W / 2 + 40, 160, "Oops! Let's try again.", 48, "#24305e", { strokeThickness: 0 }));
        c.add(txt(this, W / 2 + 40, 260, m.result.text, 27, "#5b4f73", { strokeThickness: 0, wordWrap: { width: 600 } }));
        c.add(txt(this, W / 2 + 40, 350, "💡 " + TIPS[(L.id + 3) % TIPS.length], 22, "#4f86f7", { strokeThickness: 0, wordWrap: { width: 600 } }));
      }
      const next = win && !L.free && this.li < LEVELS.length - 1;
      const btns = [["⌂ Missions", 0x4f86f7, () => this.scene.start("menu")], ["↻ Again", 0xff8a3d, () => this.scene.start("fly", { level: this.li })]];
      if (next) btns.push(["Next ▶", 0x5ccf6a, () => this.scene.start("fly", { level: this.li + 1 })]);
      btns.forEach((b, i) => c.add(button(this, W / 2 + (i - (btns.length - 1) / 2) * 220, 520, 200, 74, b[0], b[1], b[2], 28)));
      if (win && !L.free && stars === 3 && this.li === LEVELS.length - 1) this.toast("🏆 You're a real Sky Pilot!", 5000);
      say(win ? (L.free ? "What a flight!" : "Mission complete!") : m.result.text);
    }
  }

  function start() {
    const ready = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 32px "Baloo 2"')]).catch(() => {}) : Promise.resolve();
    Promise.race([ready, new Promise(r => setTimeout(r, 2500))]).then(() => {
      window.__spGame = new Phaser.Game({
        type: Phaser.AUTO, parent: "game", backgroundColor: "#5fb3f2",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
        input: { activePointers: 3 },
        fps: /[?&]timer=1/.test(location.search) ? { forceSetTimeOut: true, target: 60 } : undefined,
        scene: [Boot, Menu, Hangar, Fly],
      });
    });
  }
  window.SkyPilot = { start };
})();
