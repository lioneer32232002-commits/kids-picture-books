/* Steady Tower! — keep Taipei 101 steady with Bao, build the tower, and run the fast elevator (Phaser 3).
   The rules, missions and test bot live in sim.js. This file draws:
   - Steady: the tower swaying over the city, Bao swinging in a round window near the top, the 89th-floor café with
     bubble tea, wind streaks, rain, an earthquake shake, and fireworks for the New Year's Eve mission.
   - Build: a crane swinging each piece over the growing tower; a miss slides off onto a pile ("Bonk!").
   - Lift: a cut-away elevator shaft with floor numbers, the target floor, and a 🛑 marker where you would stop.
   Nothing breaks: spilled tea is the only thing you can lose. */
(function () {
  "use strict";
  const W = 1280, H = 720;
  const FONT = '"Baloo 2", "Trebuchet MS", sans-serif';
  const S = (window.Book && Book.sfx) || new Proxy({}, { get: () => () => {} });
  const R = window.TowerSim, LEVELS = R.LEVELS, clamp = R.clamp;
  const SPEED = parseFloat((location.search.match(/[?&]speed=([\d.]+)/) || [])[1]) || 1;   // test runs only
  const UNLOCK = /[?&]unlock=1/.test(location.search);
  const say = t => { if (window.Book && !Book.muted && Book.speak) Book.speak(t.replace(/[^\x20-\x7E]/g, "")); };

  /* ------------------------------------------------------------ save */
  const BLANK = () => ({ stars: {}, best: 0 });
  const save = {
    get() { try { return Object.assign(BLANK(), JSON.parse(localStorage.getItem("st-save")) || {}); } catch (e) { return BLANK(); } },
    set(v) { try { localStorage.setItem("st-save", JSON.stringify(v)); } catch (e) {} },
  };
  const totalStars = sv => Object.values(sv.stars).reduce((a, b) => a + b, 0);
  const FACTS = {
    breeze: "Taipei 101's damper is the biggest one in the world that visitors can see. It hangs near the top, around the 87th to 92nd floors.",
    stack: "Taipei 101 has 8 big pieces of 8 floors each, like a stalk of bamboo. In Chinese, 8 sounds like being rich and lucky!",
    up89: "Taipei 101's fast elevators go from the 5th floor to the 89th floor in 37 seconds, at about 60 km/h!",
    typhoon: "On August 8, 2015, Typhoon Soudelor made the real Bao swing about 1 meter, its biggest swing ever recorded.",
    windy: "Under the tower, 380 piles reach about 80 meters down into hard rock, like the roots of a giant tree.",
    quake: "On April 3, 2024, Taiwan had its strongest earthquake in 25 years. Taipei 101 was fine!",
    busy: "A fast elevator needs a long way to stop. Real elevators also slow down gently, so your tummy and ears feel okay.",
    newyear: "Every New Year's Eve, fireworks shoot out from the sides of Taipei 101, and people all over Taiwan watch.",
    free: "Bao weighs 660 tonnes, more than 100 elephants, and is about 5.5 meters wide.",
  };

  /* ------------------------------------------------------------ helpers */
  function txt(sc, x, y, s, size, color, opts) {
    return sc.add.text(x, y, s, Object.assign({ fontFamily: FONT, fontSize: size + "px", fontStyle: "800", color: color || "#fff",
      stroke: "#1e2340", strokeThickness: Math.max(3, size / 6), align: "center" }, opts || {})).setOrigin(0.5);
  }
  function button(sc, x, y, w, h, label, fill, onClick, size) {
    const c = sc.add.container(x, y), g = sc.add.graphics();
    const draw = d => { g.clear(); g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, Math.min(h / 2, 26));
      g.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2 + (d ? 5 : 0), w, h, Math.min(h / 2, 26));
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(-w / 2 + 10, -h / 2 + 6 + (d ? 5 : 0), w - 20, h * 0.3, h * 0.15); };
    draw(false);
    const t = txt(sc, 0, -2, label, size || 30);
    c.add([g, t]); c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on("pointerdown", () => { draw(true); t.y = 3; c.pressed = true; });
    c.on("pointerup", () => { draw(false); t.y = -2; if (c.pressed) { c.pressed = false; S.tap(); onClick(); } });
    c.on("pointerout", () => { draw(false); t.y = -2; c.pressed = false; });
    return c;
  }
  // a button you hold down; several can be held at once. glow(true) makes it pulse (a hint)
  function holdButton(sc, x, y, w, h, label, fill, size) {
    const c = sc.add.container(x, y).setScrollFactor(0).setDepth(40), g = sc.add.graphics();
    let glow = 0;
    const draw = d => { g.clear(); g.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, 26);
      if (glow) g.fillStyle(0xffe27a, 0.35 + 0.3 * glow).fillRoundedRect(-w / 2 - 12, -h / 2 - 12 + (d ? 5 : 0), w + 24, h + 24, 34);
      g.fillStyle(fill, d ? 1 : 0.85).fillRoundedRect(-w / 2, -h / 2 + (d ? 5 : 0), w, h, 26);
      g.lineStyle(4, 0xffffff, d ? 0.9 : 0.4).strokeRoundedRect(-w / 2, -h / 2 + (d ? 5 : 0), w, h, 26); };
    draw(false);
    const t = txt(sc, 0, 0, label, size || 30);
    c.add([g, t]); c.setSize(w, h).setInteractive();
    c.down = false;
    const set = d => { if (c.down !== d) { c.down = d; draw(d); t.y = d ? 5 : 0; } };
    c.on("pointerdown", () => set(true)); c.on("pointerup", () => set(false)); c.on("pointerout", () => set(false));
    c.setLabel = s => t.setText(s);
    c.glow = v => { const n = v ? 0.5 + 0.5 * Math.sin(sc.time.now / 120) : 0; if (n !== glow || v) { glow = n; draw(c.down); } };
    return c;
  }
  function fit(img, size) { img.setScale(size / Math.max(img.width, img.height)); return img; }
  function panel(sc, x, y, w, h, color) {
    const g = sc.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x - w / 2, y - h / 2 + 10, w, h, 36);
    g.fillStyle(0xfffaf2, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    g.lineStyle(6, color || 0x2fa39a, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    return g;
  }
  const rand = (() => { let s = 17; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const KIND = { steady: { icon: "bao_brave", color: 0xe2a12b, css: "#b9821a" }, build: { icon: "worker", color: 0x2fa39a, css: "#1d7f77" }, lift: { icon: "yuyu", color: 0x9b6cf2, css: "#7448c9" } };
  // messages that wait their turn at the top of the screen
  function toaster(sc, y) {
    sc.toastQ = []; sc.msgT = 0;
    sc.msg = txt(sc, W / 2, y || 160, "", 28, "#ffffff", { wordWrap: { width: 860 } }).setScrollFactor(0).setDepth(45).setAlpha(0);
    sc.toast = (t, speak) => { if (sc.toastQ[sc.toastQ.length - 1] !== t) sc.toastQ.push(t); if (speak) say(t); };
    sc.tickToast = dt => {
      sc.msgT -= dt;
      if (sc.msgT <= 0 && sc.toastQ.length) { sc.msg.setText(sc.toastQ.shift()).setAlpha(1); sc.msgT = 2.6; }
      else if (sc.msgT <= 0) sc.msg.setAlpha(Math.max(0, sc.msg.alpha - 0.05));
    };
  }
  function hud(sc, name) {
    const box = sc.add.graphics().setScrollFactor(0).setDepth(30);
    box.fillStyle(0xffffff, 0.9).fillRoundedRect(14, 14, 440, 104, 22);
    txt(sc, 30, 38, name, 24, "#1e2340", { strokeThickness: 0 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(31);
    sc.infoT = txt(sc, 30, 82, "", 24, "#1e2340", { strokeThickness: 0 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(31);
    button(sc, W - 90, 46, 140, 56, "◀ Menu", 0x6b7a90, () => sc.scene.start("menu"), 20).setScrollFactor(0).setDepth(42);
  }

  // Taipei 101 as polygons: a base, 8 flaring pieces, the top and the spire.
  // lean(h) is the sideways shift at height fraction h (0 = ground, 1 = spire tip).
  const TEAL = 0x5fb8b0, TEAL_D = 0x3c8f88, TEAL_L = 0x8fd6cc, EDGE = 0x2b6b66;
  const HB = 0.25, SH = 0.07, HT = HB + 8 * SH;   // base height, piece height, top of the 8th piece
  function drawTower(g, cx, ground, Ht, lean, opt) {
    opt = opt || {};
    const Wt = Ht * 0.17, n = opt.pieces == null ? 8 : opt.pieces;
    const P = (h, dx) => ({ x: cx + dx + (lean ? lean(h) : 0), y: ground - h * Ht });
    const quad = (h0, w0, h1, w1, col) => { const pts = [P(h0, -w0), P(h0, w0), P(h1, w1), P(h1, -w1)];
      g.fillStyle(col, 1).fillPoints(pts, true); g.lineStyle(3, EDGE, 1).strokePoints(pts, true); };
    quad(0, Wt * 0.62, HB, Wt * 0.36, TEAL_D);
    for (let i = 0; i < n; i++) {
      const h0 = HB + i * SH, h1 = h0 + SH;
      quad(h0, Wt * 0.33, h1, Wt * 0.45, i % 2 ? TEAL : TEAL_L);
      // window rows
      g.lineStyle(2, 0xffffff, 0.35);
      for (let k = 1; k < 3; k++) { const a = P(h0 + SH * k / 3, -Wt * 0.36), b = P(h0 + SH * k / 3, Wt * 0.36); g.lineBetween(a.x, a.y, b.x, b.y); }
    }
    if (n >= 8 && !opt.noTop) {
      quad(HT, Wt * 0.22, HT + 0.07, Wt * 0.12, TEAL_D);
      const a = P(HT + 0.07, 0), b = P(1, 0);
      g.lineStyle(Math.max(3, Ht * 0.008), EDGE, 1).lineBetween(a.x, a.y, b.x, b.y);
    }
    return Wt;
  }
  const bend = s => h => s * h * h;   // a tall tower bends most at the top

  /* ============================================================ BOOT */
  const ART = ["bao", "bao_brave", "yuyu", "yuyu_cheer", "tea", "cloud", "worker", "dad", "bg_city", "p01", "p02", "p03", "p04"];
  class Boot extends Phaser.Scene {
    constructor() { super("boot"); }
    preload() {
      txt(this, W / 2, H / 2 - 60, "Bao is getting ready to swing...", 40);
      const bar = this.add.graphics();
      this.load.on("progress", v => bar.clear().fillStyle(0xffffff, .3).fillRoundedRect(440, H / 2, 400, 28, 14).fillStyle(0xe2a12b, 1).fillRoundedRect(440, H / 2, 400 * v, 28, 14));
      ART.forEach(k => this.load.image(k, "img/" + k + ".webp"));
    }
    create() {
      ART.forEach(k => { if (!this.textures.exists(k)) { const g = this.make.graphics({ add: false }); g.fillStyle(0xffffff, 1).fillCircle(32, 32, 30); g.generateTexture(k, 64, 64); g.destroy(); } });
      this.scene.start("menu");
    }
  }

  /* ============================================================ MENU */
  class Menu extends Phaser.Scene {
    constructor() { super("menu"); }
    create() {
      const sv = save.get();
      this.add.image(W / 2, H / 2, "p01").setDisplaySize(W, H).setAlpha(0.65);
      this.add.rectangle(W / 2, H / 2, W, H, 0x1e2340, 0.4);
      const b = fit(this.add.image(130, 100, "bao"), 150);
      this.tweens.add({ targets: b, angle: 8, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      fit(this.add.image(1160, 110, "yuyu_cheer"), 170);
      txt(this, W / 2, 70, "Steady Tower!", 80, "#ffffff", { stroke: "#1d7f77", strokeThickness: 12 });
      txt(this, W / 2, 134, "Help Bao keep Taipei 101 steady, build it, and ride the fast elevator.  ⭐ " + totalStars(sv) + " / " + LEVELS.length * 3, 24, "#ffffff", { strokeThickness: 4 });
      LEVELS.forEach((L, i) => {
        const x = 205 + (i % 4) * 290, y = 240 + Math.floor(i / 4) * 170, K = KIND[L.kind];
        const open = UNLOCK || i === 0 || (sv.stars[LEVELS[i - 1].k] || 0) > 0;
        const c = this.add.container(x, y), bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.25).fillRoundedRect(-130, -66, 260, 140, 26);
        bg.fillStyle(open ? 0xfffaf2 : 0xd9dee6, 1).fillRoundedRect(-130, -72, 260, 140, 26);
        bg.lineStyle(5, K.color, 1).strokeRoundedRect(-130, -72, 260, 140, 26);
        c.add(bg);
        c.add(fit(this.add.image(-74, -16, K.icon), 92).setAlpha(open ? 1 : 0.4));
        c.add(txt(this, 52, -38, String(i + 1), 34, open ? K.css : "#9aa3b0", { strokeThickness: 0 }));
        c.add(txt(this, 0, 26, L.name, 23, open ? "#1e2340" : "#9aa3b0", { strokeThickness: 0, wordWrap: { width: 240 } }));
        const st = sv.stars[L.k] || 0;
        c.add(txt(this, 52, -6, open ? "★".repeat(st) + "☆".repeat(3 - st) : "🔒", 28, "#ffc41f", { strokeThickness: 3, stroke: "#8a6a10" }));
        if (open) {
          c.setSize(260, 140).setInteractive({ useHandCursor: true });
          c.on("pointerover", () => c.setScale(1.04)); c.on("pointerout", () => c.setScale(1));
          c.on("pointerup", () => { S.whoosh(); this.scene.start("brief", { level: i }); });
        }
      });
      button(this, W / 2, 640, 600, 76, "🌀 Free Play: Endless Storm  (best: " + (sv.best || 0) + " s)", 0xe2a12b, () => this.scene.start("brief", { level: -1 }), 26);
    }
  }

  /* ============================================================ BRIEFING */
  const briefArt = L => L.kind === "lift" ? "p02" : L.night ? "p04" : L.k === "typhoon" ? "p03" : "bg_city";
  class Brief extends Phaser.Scene {
    constructor() { super("brief"); }
    init(d) { this.li = d.level; }
    create() {
      const L = this.li < 0 ? R.FREE : LEVELS[this.li], K = KIND[L.kind];
      this.add.image(W / 2, H / 2, briefArt(L)).setDisplaySize(W, H);
      panel(this, W / 2, H / 2, 1060, 600, K.color);
      txt(this, W / 2, 110, (this.li < 0 ? "" : "Mission " + (this.li + 1) + ": ") + L.name, 46, "#1e2340", { strokeThickness: 0 });
      fit(this.add.image(260, 330, K.icon), 260);
      txt(this, 760, 250, L.intro, 28, "#1e2340", { strokeThickness: 0, wordWrap: { width: 620 }, align: "left" });
      txt(this, 760, 455, "💡 " + FACTS[L.k], 23, K.css, { strokeThickness: 0, wordWrap: { width: 620 }, align: "left" });
      button(this, 520, 630, 260, 74, "◀ Back", 0x6b7a90, () => this.scene.start("menu"), 28);
      button(this, 800, 630, 300, 74, "Let's go! ▶", 0xe2a12b, () => this.scene.start(L.kind, { level: this.li }), 30);
      say(L.intro);
    }
  }

  /* ============================================================ STEADY */
  const TX = 520, TG = 700, THt = 600;           // tower centre, ground line, height on screen
  const WIN_H = HT - 0.045;                        // where Bao's round window is (near the top of the 8th piece)
  class Steady extends Phaser.Scene {
    constructor() { super("steady"); }
    init(d) { this.li = d.level; }
    create() {
      const L = this.li < 0 ? R.FREE : LEVELS[this.li];
      Object.assign(this, { L, s: R.create(L), mem: {}, ended: false, streaks: [], drops: [], sparks: [], spills: [] });
      this.input.addPointer(3);
      const bg = this.add.image(W / 2, H / 2, "bg_city").setDisplaySize(W, H).setDepth(0);
      if (L.night) bg.setTint(0x5a64a8);
      else if (L.rain) bg.setTint(0x9aa6bf);
      this.clouds = [0, 1, 2].map(i => fit(this.add.image(200 + i * 420, 90 + i * 30, "cloud"), 200).setDepth(1).setAlpha(L.rain || L.night ? 0.9 : 0.6));
      this.towerG = this.add.graphics().setDepth(3);
      this.baoMask = this.make.graphics({ add: false });
      this.bao = fit(this.add.image(0, 0, "bao_brave"), 74).setDepth(5);
      this.bao.setMask(this.baoMask.createGeometryMask());
      this.winG = this.add.graphics().setDepth(4);
      this.fxG = this.add.graphics().setDepth(8);
      this.arrowT = txt(this, TX, 40, "", 54, "#ffe27a").setDepth(9);
      // the 89th-floor café
      const cafe = this.add.graphics().setDepth(20);
      cafe.fillStyle(0xffffff, 0.92).fillRoundedRect(840, 150, 410, 330, 28).lineStyle(5, 0xe2a12b, 1).strokeRoundedRect(840, 150, 410, 330, 28);
      txt(this, 1045, 185, "☕ 89th-floor café", 28, "#1e2340", { strokeThickness: 0 }).setDepth(21);
      this.cafeG = this.add.graphics().setDepth(21);
      this.cups = [0, 1, 2].map(i => fit(this.add.image(940 + i * 105, 330, "tea"), 120).setOrigin(0.5, 1).setDepth(22));
      this.sloshT = txt(this, 1045, 440, "", 22, "#1e2340", { strokeThickness: 0 }).setDepth(22);
      fit(this.add.image(1180, 640, "yuyu"), 150).setOrigin(0.5, 1).setDepth(20);
      hud(this, L.name);
      this.timeG = this.add.graphics().setScrollFactor(0).setDepth(31);
      toaster(this, 560);
      this.msg.setPosition(W / 2 + 120, 560);
      this.bLeft = holdButton(this, 110, H - 80, 170, 120, "◀", 0x5a8de0, 54);
      this.bRight = holdButton(this, 300, H - 80, 170, 120, "▶", 0x5a8de0, 54);
      this.keys = this.input.keyboard.createCursorKeys();
      this.toast(L.hint ? "👆 When the tower moves ▶, hold ◀. When it moves ◀, hold ▶!" : "💨 Help Bao swing the other way from the tower!", true);
      window.__st = this; window.__stGame = this.game;
    }
    update(_, dms) {
      const dt = Math.min(0.05, dms / 1000) * SPEED, s = this.s, k = this.keys;
      if (this.ended) { this.tickToast(Math.min(0.05, dms / 1000)); return; }
      const l = this.bLeft.down || k.left.isDown, r = this.bRight.down || k.right.isDown;
      let inp = { dir: l && !r ? -1 : r && !l ? 1 : 0 };
      if (window.__stBot) inp = R.bot(s, dt, this.mem);
      const n = Math.max(1, Math.ceil(dt / (1 / 30)));
      for (let i = 0; i < n; i++) { R.step(s, dt / n, inp); this.handle(s.events); if (s.done) break; }
      this.draw(dt, inp);
      this.tickToast(dt);
      if (s.done) this.finish();
    }
    handle(evs) {
      for (const e of evs) {
        if (e.type === "warn") { S.wind(); this.toast("💨 A gust is coming!"); }
        else if (e.type === "quake") { S.rumble(); this.toast("🌏 Earthquake! The ground is shaking!", true); }
        else if (e.type === "spill") { S.splash(); this.toast(e.left ? "💦 Oops, a bubble tea spilled! " + e.left + " left." : "💦 All the bubble tea spilled! Keep going!"); this.spillFx(); }
      }
    }
    spillFx() { for (let i = 0; i < 18; i++) this.spills.push({ x: 940 + rand() * 210, y: 300, vx: (rand() - 0.5) * 200, vy: -100 - rand() * 120, a: 1 }); }
    draw(dt, inp) {
      const s = this.s, L = this.L, t = this.time.now / 1000, cam = this.cameras.main;
      cam.setScroll(s.quaking ? (rand() - 0.5) * 10 : 0, s.quaking ? (rand() - 0.5) * 6 : 0);
      // tower
      const g = this.towerG.clear();
      const lean = bend(s.x);
      drawTower(g, TX, TG, THt, lean);
      // Bao's round window
      const wx = TX + lean(WIN_H), wy = TG - WIN_H * THt, wr = 48;
      const wg = this.winG.clear();
      wg.lineStyle(7, 0xffe27a, 0.9).strokeCircle(wx, wy, wr);
      this.baoMask.clear().fillStyle(0xffffff).fillCircle(wx, wy, wr - 3);
      g.fillStyle(0x1e2340, 0.85).fillCircle(wx, wy, wr);
      g.lineStyle(3, 0x999999, 1).lineBetween(wx, wy - wr, wx + s.u * 0.7, wy + 4);
      this.bao.setPosition(wx + s.u * 0.7, wy + 14).setAngle(-s.u * 0.4);
      // the arrow shows which way the tower is moving; on the hint mission, the right button glows
      const moving = Math.abs(s.v) > 8, dir = s.v > 0 ? 1 : -1;
      this.arrowT.setText(moving ? (dir > 0 ? "➡️" : "⬅️") : "").setPosition(TX + lean(1) + dir * 110, 150).setAlpha(clamp(Math.abs(s.v) / 30, 0.3, 1));
      const show = L.hint || this.li < 3;
      this.bLeft.glow(show && moving && dir > 0);
      this.bRight.glow(show && moving && dir < 0);
      // wind streaks and rain
      const fx = this.fxG.clear(), f = Math.abs(s.force);
      if (f > 10 && rand() < f / 60) this.streaks.push({ x: -40, y: 60 + rand() * 520, v: 500 + f * 6, l: 60 + rand() * 80 });
      this.streaks = this.streaks.filter(p => (p.x += p.v * dt) < W + 100);
      for (const p of this.streaks) fx.lineStyle(4, 0xffffff, 0.55).lineBetween(p.x, p.y, p.x + p.l, p.y);
      if (L.rain || L.night) { if (this.drops.length < 120) this.drops.push({ x: rand() * W * 1.2, y: -10 }); }
      this.drops = this.drops.filter(p => (p.x -= 160 * dt, p.y += 700 * dt) < H);
      for (const p of this.drops) fx.lineStyle(2, 0xcfe4ff, 0.6).lineBetween(p.x, p.y, p.x - 6, p.y + 18);
      this.clouds.forEach((c, i) => { c.x += (20 + f * 0.6) * dt; if (c.x > W + 150) c.x = -150; });
      // café: cups tilt with the sway, spilled cups are empty
      this.cups.forEach((c, i) => c.setAngle(clamp(s.x * 0.18 + Math.sin(t * 3 + i) * s.slosh * 6, -25, 25)).setAlpha(i < s.cups ? 1 : 0.25));
      const cg = this.cafeG.clear();
      cg.fillStyle(0xb98a5a, 1).fillRoundedRect(870, 330, 350, 18, 8);
      cg.fillStyle(0xe3ecf7, 1).fillRoundedRect(880, 395, 330, 26, 13);
      cg.fillStyle(s.slosh > 0.7 ? 0xff5a6a : s.slosh > 0.35 ? 0xf2a516 : 0x5ccf6a, 1).fillRoundedRect(880, 395, Math.max(14, 330 * clamp(s.slosh, 0, 1)), 26, 13);
      this.sloshT.setText(Math.abs(s.x) > R.TOWER.spillAt ? "😵 Sloshing! Calm the tower!" : "🥤 Slosh meter");
      this.spills = this.spills.filter(p => (p.x += p.vx * dt, p.y += p.vy * dt, p.vy += 600 * dt, p.a -= 0.8 * dt) > 0);
      for (const p of this.spills) cg.fillStyle(0xc8a27a, p.a).fillCircle(p.x, p.y, 7);
      // time bar
      const tg = this.timeG.clear();
      if (!L.free) { tg.fillStyle(0xe3ecf7, 1).fillRoundedRect(200, 70, 240, 24, 12).fillStyle(0x2fa39a, 1).fillRoundedRect(200, 70, Math.max(12, 240 * (1 - s.t / L.T)), 24, 12); this.infoT.setText("🥤 " + s.cups + "/3   ⏱"); }
      else this.infoT.setText("🥤 " + s.cups + "/3   ⏱ " + Math.floor(s.t) + " s");
    }
    finish() {
      if (this.ended) return; this.ended = true;
      const r = this.s.result, sv = save.get(), L = this.L;
      if (L.free) { if (r.time > (sv.best || 0)) sv.best = r.time; }
      else sv.stars[L.k] = Math.max(sv.stars[L.k] || 0, r.stars);
      save.set(sv);
      this.bLeft.glow(false); this.bRight.glow(false);
      let wait = 1200;
      if (L.fireworks) {
        wait = 4200; this.toast("🎆 3... 2... 1... Happy New Year!", true);
        for (let i = 0; i < 14; i++) this.time.delayedCall(400 + i * 220, () => {
          S.pop(); const x = TX + (rand() - 0.5) * 260, y = 80 + rand() * 360, col = [0xff6b6b, 0xffd23d, 0x7dff8a, 0x8ab6ff, 0xff9af0][i % 5];
          for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; const p = this.add.circle(x, y, 5, col).setDepth(30);
            this.tweens.add({ targets: p, x: x + Math.cos(a) * 90, y: y + Math.sin(a) * 90 + 30, alpha: 0, duration: 1100, onComplete: () => p.destroy() }); }
        });
      } else S.yay();
      this.time.delayedCall(wait, () => this.scene.start("result", { level: this.li, r, kind: "steady" }));
    }
  }

  /* ============================================================ BUILD */
  const PIECE_H = 62, BASE_H = 150, GROUND = 690, BX = R.BUILD.cx;
  class Build extends Phaser.Scene {
    constructor() { super("build"); }
    init(d) { this.li = d.level; }
    create() {
      const L = LEVELS[this.li];
      Object.assign(this, { L, s: R.create(L), mem: {}, ended: false, fall: [], dust: [] });
      const cam = this.cameras.main;
      this.input.addPointer(3);
      this.add.image(W / 2, H / 2, "bg_city").setDisplaySize(W, H).setScrollFactor(0).setDepth(0);
      this.add.rectangle(W / 2, GROUND + 60, W * 3, 120, 0x8cc97a).setDepth(1);
      this.stackG = this.add.graphics().setDepth(3);
      this.pileG = this.add.graphics().setDepth(3);
      this.worker = fit(this.add.image(BX + 260, GROUND + 6, "worker"), 140).setOrigin(0.5, 1).setDepth(4);
      this.baoIn = fit(this.add.image(0, 0, "bao"), 60).setDepth(4).setVisible(false);
      this.craneG = this.add.graphics().setScrollFactor(0).setDepth(10);
      this.hangG = this.add.graphics().setDepth(11);
      this.hangBao = fit(this.add.image(0, 0, "bao"), 80).setDepth(12).setVisible(false);
      this.guideG = this.add.graphics().setDepth(2);
      cam.setBounds(0, -900, W, 900 + H);
      this.camY = 0;
      hud(this, L.name);
      toaster(this, 170);
      this.bDrop = holdButton(this, W - 140, H - 80, 230, 120, "⬇ DROP", 0xe8662e, 36);
      this.bDrop.on("pointerdown", () => { this.wantDrop = true; });
      this.input.keyboard.on("keydown-SPACE", () => { this.wantDrop = true; });
      this.input.keyboard.on("keydown-DOWN", () => { this.wantDrop = true; });
      this.toast("🏗️ Tap DROP when the piece is right above the tower!", true);
      window.__st = this; window.__stGame = this.game;
    }
    topY() { const s = this.s; let y = GROUND - BASE_H - Math.min(s.n, 8) * PIECE_H; if (s.n > 9) y -= 70; return y; }
    update(_, dms) {
      const dt = Math.min(0.05, dms / 1000) * SPEED, s = this.s;
      if (this.ended) { this.tickToast(Math.min(0.05, dms / 1000)); return; }
      let inp = { drop: !!this.wantDrop }; this.wantDrop = false;
      if (window.__stBot) inp = R.bot(s, dt, this.mem);
      const n = Math.max(1, Math.ceil(dt / (1 / 30)));
      for (let i = 0; i < n; i++) { R.step(s, dt / n, i ? {} : inp); this.handle(s.events); if (s.done) break; }
      this.draw(dt);
      this.tickToast(dt);
      if (s.done) this.finish();
    }
    handle(evs) {
      const s = this.s;
      for (const e of evs) {
        if (e.type === "drop") S.whoosh();
        else if (e.type === "stack") {
          S.dig(); this.cameras.main.shake(120, 0.004); this.puff(R.stackTopX(s), this.topY() + (e.what === "piece" ? PIECE_H : 0));
          if (e.what === "bao") this.toast("🟡 Bao is in! Now the top and the spire.", true);
          else if (e.what === "top") this.toast("🎉 Taipei 101 is finished!", true);
          else if (e.perfect) this.toast(["🌟 Perfect!", "🌟 Right on!", "🌟 Bullseye!"][e.n % 3]);
          else this.toast("👍 Piece " + e.n + " of 8");
          if (e.n === 8) this.toast("Now let's hang Bao inside! 🟡");
        } else if (e.type === "miss") {
          S.oops(); this.toast("😅 Bonk! It slid off. The crane brings another one.");
          const what = this.s.order[this.s.n];
          this.fall.push({ x: this.lastDrop, y: this.topY() - 20, vx: e.side * 160, vy: -60, rot: 0, what });
        }
      }
    }
    puff(x, y) { for (let i = 0; i < 14; i++) this.dust.push({ x: x + (rand() - 0.5) * 200, y, vx: (rand() - 0.5) * 120, vy: -rand() * 60, a: 0.8, r: 4 + rand() * 6 }); }
    pieceShape(g, x, y, i, what, alpha) {
      // a flaring piece whose bottom edge is at y
      const Wt = 220;
      if (what === "top") {
        g.fillStyle(TEAL_D, alpha).fillPoints([{ x: x - Wt * 0.32, y }, { x: x + Wt * 0.32, y }, { x: x + Wt * 0.18, y: y - 60 }, { x: x - Wt * 0.18, y: y - 60 }], true);
        g.lineStyle(6, EDGE, alpha).lineBetween(x, y - 60, x, y - 150);
        return;
      }
      const pts = [{ x: x - Wt * 0.36, y }, { x: x + Wt * 0.36, y }, { x: x + Wt * 0.5, y: y - PIECE_H }, { x: x - Wt * 0.5, y: y - PIECE_H }];
      g.fillStyle(i % 2 ? TEAL : TEAL_L, alpha).fillPoints(pts, true).lineStyle(3, EDGE, alpha).strokePoints(pts, true);
      g.lineStyle(2, 0xffffff, 0.35 * alpha).lineBetween(x - Wt * 0.38, y - PIECE_H / 3, x + Wt * 0.38, y - PIECE_H / 3).lineBetween(x - Wt * 0.42, y - PIECE_H * 2 / 3, x + Wt * 0.42, y - PIECE_H * 2 / 3);
    }
    draw(dt) {
      const s = this.s, cam = this.cameras.main, t = this.time.now / 1000;
      // camera rises with the tower
      const want = Math.min(0, this.topY() - 440);
      this.camY += (want - this.camY) * Math.min(1, dt * 3);
      cam.setScroll(0, this.camY);
      // the stack (sways a little on the windy mission)
      const sway = R.stackTopX(s) - BX, g = this.stackG.clear();
      const off = k => sway * k;
      const bpts = [{ x: BX - 150, y: GROUND }, { x: BX + 150, y: GROUND }, { x: BX + 85 + off(0.2), y: GROUND - BASE_H }, { x: BX - 85 + off(0.2), y: GROUND - BASE_H }];
      g.fillStyle(TEAL_D, 1).fillPoints(bpts, true).lineStyle(3, EDGE, 1).strokePoints(bpts, true);
      for (let i = 0; i < Math.min(s.n, 8); i++) this.pieceShape(g, BX + off((i + 1) / 8), GROUND - BASE_H - i * PIECE_H, i, "piece", 1);
      this.baoIn.setVisible(s.n >= 9).setPosition(BX + off(1), GROUND - BASE_H - 8 * PIECE_H + 34);
      if (s.n >= 10) this.pieceShape(g, BX + off(1), GROUND - BASE_H - 8 * PIECE_H, 0, "top", 1);
      if (s.n >= 9 && s.n < 10) { g.fillStyle(0x1e2340, 0.6).fillCircle(BX + off(1), GROUND - BASE_H - 8 * PIECE_H + 34, 34); this.baoIn.setDepth(4); }
      // a guide line from the stack up
      const gg = this.guideG.clear(), top = this.topY(), tx = R.stackTopX(s);
      for (let y = top - 20; y > top - 240; y -= 22) gg.fillStyle(0xffffff, 0.5).fillCircle(tx, y, 3);
      // the crane: a jib across the top of the screen and a cable down to the piece
      const cg = this.craneG.clear();
      cg.fillStyle(0xf2c94c, 1).fillRect(330, 128, 720, 22).lineStyle(3, 0xb08a1e, 1);
      for (let x = 330; x < 1050; x += 40) cg.lineBetween(x, 128, x + 20, 150).lineBetween(x + 20, 150, x + 40, 128);
      cg.fillStyle(0xf2c94c, 1).fillRect(1050, 128, 30, H).lineStyle(3, 0xb08a1e, 1).strokeRect(1050, 128, 30, H);
      const hx = s.hook, hangY = this.camY + 300, what = s.order[s.n];
      cg.fillStyle(0x6b7a90, 1).fillRect(hx - 30, 148, 60, 18);
      const hg = this.hangG.clear();
      this.lastDrop = s.drop ? s.drop.x : hx;
      let py = hangY, px = hx;
      if (s.drop) { const k = Math.min(1, s.drop.t / R.BUILD.fall); px = s.drop.x; py = hangY + (top - hangY) * k * k; }
      if (what && !s.done) {
        hg.lineStyle(3, 0x444444, 1).lineBetween(px, this.camY + 166, px, py - (what === "piece" ? PIECE_H : what === "top" ? 60 : 40));
        if (what === "bao") { this.hangBao.setVisible(true).setPosition(px, py - 40); }
        else { this.hangBao.setVisible(false); this.pieceShape(hg, px, py, s.n, what, 1); }
        // green when it's lined up
        const ok = Math.abs(hx - tx) <= R.BUILD.stick * 0.5;
        if (!s.drop) hg.fillStyle(ok ? 0x7dff8a : 0xffffff, ok ? 0.9 : 0.4).fillTriangle(hx - 14, py + 14, hx + 14, py + 14, hx, py + 34);
      } else this.hangBao.setVisible(false);
      // pieces that slid off fall onto the pile
      this.fall = this.fall.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.rot += p.vx * 0.002;
        if (p.y > GROUND) { this.pileN = (this.pileN || 0) + 1; this.puff(p.x, GROUND); S.rumble(); return false; } return true; });
      for (const p of this.fall) { if (p.what === "bao") hg.fillStyle(0xe2a12b, 1).fillCircle(p.x, p.y - 30, 34); else this.pieceShape(hg, p.x, p.y, 0, p.what, 0.9); }
      const pg = this.pileG.clear();
      for (let i = 0; i < (this.pileN || 0); i++) pg.fillStyle(i % 2 ? TEAL : TEAL_L, 1).fillRoundedRect(140 + (i % 4) * 26, GROUND - 26 - Math.floor(i / 4) * 26, 120, 24, 8);
      this.dust = this.dust.filter(d => (d.x += d.vx * dt, d.y += d.vy * dt, d.vy += 200 * dt, d.a -= 0.8 * dt) > 0);
      for (const d of this.dust) hg.fillStyle(0xd8d0c4, d.a).fillCircle(d.x, d.y, d.r);
      this.infoT.setText("🧱 " + Math.min(s.n, 8) + "/8   " + (s.n >= 9 ? "🟡 ✅" : "🟡 ⬜") + "   " + (s.n >= 10 ? "🗼 ✅" : "🗼 ⬜") + (s.misses ? "   😅 " + s.misses : ""));
    }
    finish() {
      if (this.ended) return; this.ended = true;
      const r = this.s.result, sv = save.get(); sv.stars[this.L.k] = Math.max(sv.stars[this.L.k] || 0, r.stars); save.set(sv);
      S.yay(); if (window.Book && Book.confetti) Book.confetti(60);
      this.worker.setTexture("worker");
      this.time.delayedCall(2000, () => this.scene.start("result", { level: this.li, r, kind: "build" }));
    }
  }

  /* ============================================================ LIFT */
  const FLOOR_PX = 90, CAB_Y = 400, SHAFT_X = 560;
  class Lift extends Phaser.Scene {
    constructor() { super("lift"); }
    init(d) { this.li = d.level; }
    create() {
      const L = LEVELS[this.li];
      Object.assign(this, { L, s: R.create(L), mem: {}, ended: false, doorK: 0 });
      this.input.addPointer(3);
      this.add.rectangle(W / 2, H / 2, W, H, 0xdfe9ee);
      this.shaftG = this.add.graphics().setDepth(1);
      this.labels = [];
      for (let i = 0; i < 12; i++) this.labels.push(txt(this, SHAFT_X - 150, 0, "", 30, "#1e2340", { stroke: "#ffffff", strokeThickness: 6 }).setDepth(2));
      this.cabG = this.add.graphics().setDepth(3);
      this.yuyu = fit(this.add.image(SHAFT_X, CAB_Y + 70, "yuyu_cheer"), 130).setOrigin(0.5, 1).setDepth(4);
      this.dad = fit(this.add.image(SHAFT_X - 60, CAB_Y + 70, "dad"), 130).setOrigin(0.5, 1).setDepth(4);
      this.doorG = this.add.graphics().setDepth(5);
      this.stopT = txt(this, SHAFT_X + 200, 0, "🛑", 40).setDepth(6);
      // the panel on the right: floor, speed, stops
      const p = this.add.graphics().setDepth(20);
      p.fillStyle(0x1e2340, 0.95).fillRoundedRect(770, 140, 480, 420, 30).lineStyle(6, 0x9b6cf2, 1).strokeRoundedRect(770, 140, 480, 420, 30);
      this.floorT = txt(this, 920, 235, "", 104, "#ffe27a", { strokeThickness: 0 }).setDepth(21);
      this.speedT = txt(this, 1150, 215, "", 40, "#9dffaa", { strokeThickness: 0 }).setDepth(21);
      txt(this, 1150, 262, "km/h", 24, "#cfd6ff", { strokeThickness: 0 }).setDepth(21);
      this.stopsT = txt(this, 1010, 345, "", 30, "#ffffff", { strokeThickness: 0 }).setDepth(21);
      this.stopAtT = txt(this, 1010, 420, "", 28, "#ffb3b3", { strokeThickness: 0 }).setDepth(21);
      this.tipT = txt(this, 1010, 500, "", 28, "#ffffff", { strokeThickness: 0 }).setDepth(21);
      hud(this, L.name);
      toaster(this, 175);
      this.bUp = holdButton(this, W - 130, H - 80, 200, 120, "▲", 0x5ccf6a, 54);
      this.bDown = holdButton(this, W - 360, H - 80, 200, 120, "▼", 0x5a8de0, 54);
      this.keys = this.input.keyboard.createCursorKeys();
      this.toast("⬆️ Hold ▲ to go up. Let go before the 🛑 marker passes the glowing floor!", true);
      window.__st = this; window.__stGame = this.game;
    }
    update(_, dms) {
      const dt = Math.min(0.05, dms / 1000) * SPEED, s = this.s, k = this.keys;
      if (this.ended) { this.tickToast(Math.min(0.05, dms / 1000)); return; }
      let inp = { up: this.bUp.down || k.up.isDown, down: this.bDown.down || k.down.isDown };
      if (window.__stBot) inp = R.bot(s, dt, this.mem);
      const n = Math.max(1, Math.ceil(dt / (1 / 30)));
      for (let i = 0; i < n; i++) { R.step(s, dt / n, inp); this.handle(s.events); if (s.done) break; }
      this.draw(dt, inp);
      this.tickToast(dt);
      if (s.done) this.finish();
    }
    handle(evs) {
      for (const e of evs) {
        if (e.type === "arrive") { S.ding(); this.toast("🔔 Ding! " + e.floor + "th floor." + (e.floor === 89 ? " Bao is just a few floors up!" : e.floor === 5 ? " Bye-bye, visitors!" : " Doors open!"), true); }
        else if (e.type === "next") this.toast("👉 Next stop: " + e.floor + "F");
        else if (e.type === "overshoot") { S.oops(); this.toast("😮 Too fast, we passed it! Go back gently."); }
      }
    }
    draw(dt, inp) {
      const s = this.s, L = this.L, t = this.time.now / 1000, target = L.stops[Math.min(s.stop, L.stops.length - 1)];
      const yOf = f => CAB_Y - (f - s.y) * FLOOR_PX;   // screen y of a floor's level
      const g = this.shaftG.clear();
      g.fillStyle(0xb9c6cf, 1).fillRect(SHAFT_X - 130, 0, 260, H);
      g.fillStyle(0xd0dae0, 1).fillRect(SHAFT_X - 116, 0, 232, H);
      // target floor glow
      const ty = yOf(target);
      if (ty > -60 && ty < H + 60 && s.doors <= 0) { g.fillStyle(0x7dff8a, 0.35 + 0.2 * Math.sin(t * 5)).fillRect(SHAFT_X - 130, ty - FLOOR_PX, 260, FLOOR_PX); }
      const base = Math.floor(s.y) - 6;
      for (let i = 0; i < 12; i++) {
        const f = base + i, y = yOf(f), lab = this.labels[i];
        if (f < 1 || f > 101) { lab.setVisible(false); continue; }
        g.fillStyle(0x8a99a4, 1).fillRect(SHAFT_X - 130, y - 4, 260, 8);
        lab.setVisible(true).setText(f + "F").setPosition(SHAFT_X - 190, y - FLOOR_PX / 2).setColor(f === target ? "#1d9e4a" : "#1e2340");
      }
      // the cab
      const cg = this.cabG.clear();
      cg.lineStyle(4, 0x555555, 1).lineBetween(SHAFT_X, 0, SHAFT_X, CAB_Y - FLOOR_PX + 4);
      cg.fillStyle(0xf2c94c, 1).fillRoundedRect(SHAFT_X - 100, CAB_Y - FLOOR_PX + 4, 200, FLOOR_PX + 70 - 8, 12).lineStyle(4, 0xb08a1e, 1).strokeRoundedRect(SHAFT_X - 100, CAB_Y - FLOOR_PX + 4, 200, FLOOR_PX + 70 - 8, 12);
      // the doors slide open at a stop
      this.doorK += ((s.doors > 0 ? 1 : 0) - this.doorK) * Math.min(1, dt * 5);
      const dg = this.doorG.clear(), dw = 96 * (1 - this.doorK);
      dg.fillStyle(0xc9ced6, 0.92).fillRect(SHAFT_X - 96, CAB_Y - FLOOR_PX + 10, dw, FLOOR_PX + 56).fillRect(SHAFT_X + 96 - dw, CAB_Y - FLOOR_PX + 10, dw, FLOOR_PX + 56);
      // where you would stop if you let go now
      const at = R.stopAt(s), sy = yOf(at) - FLOOR_PX / 2 + 70;
      const show = Math.abs(s.v) > 0.3 && s.doors <= 0;
      this.stopT.setVisible(show).setPosition(SHAFT_X + 175, clamp(sy, 40, H - 40));
      if (show) g.lineStyle(4, 0xff5a6a, 0.9).lineBetween(SHAFT_X - 130, clamp(sy, 40, H - 40), SHAFT_X + 150, clamp(sy, 40, H - 40));
      // the panel
      this.floorT.setText(Math.round(s.y) + "F");
      this.speedT.setText(String(Math.round(Math.abs(s.v) * 4.4 * 3.6)));
      this.stopsT.setText(L.stops.map((f, i) => (i < s.stop || (i === s.stop && s.doors > 0) ? "✅ " : i === s.stop ? "👉 " : "⬜ ") + f + "F").join("    "));
      const d = target - s.y, over = (at - target) * Math.sign(d || 1) > 0.5;
      this.tipT.setText(s.doors > 0 ? "🚪 Doors open" : s.leveling ? "🎯 Leveling..." : Math.abs(s.v) > 0.3 && over ? "✋ Let go now to stop in time!" : Math.abs(s.v) > 0.3 && !inp.up && !inp.down ? "👍 Slowing down..." : Math.abs(d) < 0.6 ? "" : d > 0 ? "Hold ▲ to go up" : "Hold ▼ to go down")
        .setColor(Math.abs(s.v) > 0.3 && over ? "#ff8a8a" : "#ffffff");
      this.stopAtT.setText(show ? "🛑 If you let go now: " + clamp(Math.round(at), 1, 101) + "F" : "");
      this.bUp.glow(!s.doors && !inp.up && d > 0.6 && !over && Math.abs(s.v) < 0.2);
      this.bDown.glow(!s.doors && !inp.down && d < -0.6 && !over && Math.abs(s.v) < 0.2);
      this.infoT.setText("⏱ " + Math.floor(s.t) + " s   " + (s.over ? "😮 passed: " + s.over : "🎯 no misses"));
    }
    finish() {
      if (this.ended) return; this.ended = true;
      const r = this.s.result, sv = save.get(); sv.stars[this.L.k] = Math.max(sv.stars[this.L.k] || 0, r.stars); save.set(sv);
      S.yay();
      this.time.delayedCall(1500, () => this.scene.start("result", { level: this.li, r, kind: "lift" }));
    }
  }

  /* ============================================================ RESULT */
  class Result extends Phaser.Scene {
    constructor() { super("result"); }
    init(d) { this.d = d; }
    create() {
      const { level, r, kind } = this.d, L = level < 0 ? R.FREE : LEVELS[level], K = KIND[kind];
      this.add.image(W / 2, H / 2, briefArt(L)).setDisplaySize(W, H);
      panel(this, W / 2, H / 2, 900, 560, K.color);
      const title = L.free ? "Endless Storm" : r.stars >= 3 ? "Amazing! 🎉" : r.stars === 2 ? "Great job! 👏" : "You did it! 👍";
      txt(this, W / 2, 130, title, 52, "#1e2340", { strokeThickness: 0 });
      if (!L.free) txt(this, W / 2, 210, "★".repeat(r.stars) + "☆".repeat(3 - r.stars), 72, "#ffc41f", { stroke: "#8a6a10", strokeThickness: 5 });
      let lines;
      if (kind === "steady") lines = L.free ? ["⏱ You kept the tower steady for " + r.time + " seconds!", "🟡 Bao swung the right way " + r.share + "% of the time"]
        : [r.spilled ? "🥤 Bubble tea saved: " + r.cups + " / 3" : "🥤 Not one drop spilled!", "🟡 Bao swung the right way " + r.share + "% of the time",
          r.spilled ? "Tip: when the tower moves ▶, hold ◀." : ""];
      else if (kind === "build") lines = ["🏙️ Taipei 101 is built!", r.misses ? "😅 Pieces that slid off: " + r.misses : "🎯 No pieces slid off!", "🌟 Perfect drops: " + r.perfect];
      else lines = ["⏱ Time: " + r.time + " s  (a perfect ride: about " + r.par + " s)", r.over ? "😮 Passed the floor: " + r.over + " time" + (r.over > 1 ? "s" : "") + ". Let go earlier!" : "🎯 Stopped right on every floor!"];
      txt(this, W / 2, 335, lines.filter(Boolean).join("\n"), 27, "#1e2340", { strokeThickness: 0, lineSpacing: 10 });
      txt(this, W / 2, 470, "💡 " + FACTS[L.k], 22, K.css, { strokeThickness: 0, wordWrap: { width: 780 } });
      const next = level >= 0 && level < LEVELS.length - 1 && r.stars > 0 ? level + 1 : null;
      button(this, 330, 590, 240, 72, "☰ Menu", 0x6b7a90, () => this.scene.start("menu"), 26);
      button(this, 620, 590, 260, 72, "🔁 Again", 0x5a8de0, () => this.scene.start(L.kind, { level }), 26);
      if (next != null) button(this, 920, 590, 280, 72, "Next ▶", 0xe2a12b, () => this.scene.start("brief", { level: next }), 28);
      if (r.stars >= 2 || L.free) { S.yay(); if (window.Book && Book.confetti) Book.confetti(90); }
      window.__stResult = r;
    }
  }

  window.SteadyTower = {
    start() {
      const timer = /[?&]timer=1/.test(location.search);
      return new Phaser.Game({
        type: Phaser.AUTO, parent: "game", width: W, height: H, backgroundColor: "#1e2340",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        fps: timer ? { forceSetTimeOut: true, target: 30 } : undefined,
        scene: [Boot, Menu, Brief, Steady, Build, Lift, Result],
      });
    },
  };
})();
