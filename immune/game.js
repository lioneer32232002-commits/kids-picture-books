/* Body Defenders: Veggie Power! — tower defense (Phaser 3) */
(function () {
  "use strict";
  const W = 1280, H = 720, HUD_H = 58;
  const FONT = '"Baloo 2", "Trebuchet MS", sans-serif';
  const S = (window.Book && Book.sfx) || new Proxy({}, { get: () => () => {} });

  /* ------------------------------------------------------------------ data */
  const TOWERS = {
    neo:   { name: "Neo", full: "Neo the Neutrophil", cost: 50, ups: [40, 70], unlock: 1, kind: "orb", color: 0xb28dff,
             range: [130, 140, 155], cd: [0.4, 0.36, 0.32], dmg: [10, 15, 21], shots: [1, 1, 2],
             line: "Fast first responder!", lv3: "Shoots 2 germs at once" },
    max:   { name: "Max", full: "Max the Macrophage", cost: 80, ups: [60, 100], unlock: 2, kind: "chomp", color: 0x7ab8ff,
             range: [95, 102, 112], cd: [1.3, 1.2, 1.05], dmg: [34, 55, 82], splash: [0, 0, 60],
             line: "Big eater! CHOMP!", lv3: "Chomps germs next to the target too" },
    bella: { name: "Bella", full: "Bella the B Cell", cost: 70, ups: [55, 90], unlock: 3, kind: "antibody", color: 0x6fe0b0,
             range: [150, 160, 172], cd: [0.9, 0.8, 0.7], dmg: [4, 6, 8], slow: [0.45, 0.55, 0.6], targets: [1, 2, 3],
             line: "Sticky antibodies slow germs down!", lv3: "Hits 3 germs at once" },
    tcell: { name: "Captain T", full: "Captain T the Killer T Cell", cost: 120, ups: [90, 140], unlock: 5, kind: "strike", color: 0xffa04d,
             range: [135, 145, 158], cd: [1.1, 1.0, 0.88], dmg: [30, 48, 70], pierce: [0, 0, 1],
             line: "Breaks through armor!", lv3: "Each strike hits a second germ" },
  };
  const ENEMIES = {
    sniffle: { name: "Sniffle", hp: 26, speed: 52, reward: 5, size: 56, hurt: 1 },
    zippy:   { name: "Zippy", hp: 20, speed: 105, reward: 5, size: 46, hurt: 1 },
    flu:     { name: "Flu-Boss Jr", hp: 90, speed: 45, reward: 10, size: 66, hurt: 1 },
    tummy:   { name: "Tummy Bug", hp: 55, speed: 55, reward: 8, size: 62, hurt: 1, split: "mini" },
    mini:    { name: "Tummy Bug", tex: "tummy", hp: 14, speed: 86, reward: 2, size: 34, hurt: 1, memoryAs: "tummy" },
    armor:   { name: "Armor Virus", hp: 150, speed: 38, reward: 15, size: 70, hurt: 1, armor: 0.4 },
    mega:    { name: "Mega Virus", hp: 2600, speed: 24, reward: 150, size: 136, hurt: 4, armor: 0.35, boss: true },
  };
  const FOODS = {
    orange:      { nut: "Vitamin C", color: "orange" },
    strawberry:  { nut: "Vitamin C", color: "red" },
    kiwi:        { nut: "Vitamin C", color: "green" },
    pepper:      { nut: "Vitamin C", color: "red" },
    broccoli:    { nut: "Vitamin C", color: "green" },
    carrot:      { nut: "Vitamin A", color: "orange" },
    sweetpotato: { nut: "Vitamin A", color: "orange" },
    spinach:     { nut: "Folate", color: "green" },
    peas:        { nut: "Fiber", color: "green" },
    banana:      { nut: "Vitamin B6", color: "yellow" },
    lollipop:    { junk: true },
    soda:        { junk: true },
  };
  const RAINBOW = ["red", "orange", "yellow", "green"];
  const RAINBOW_HEX = { red: 0xff5a5a, orange: 0xff9d3a, yellow: 0xffd93a, green: 0x5ccf6a };

  const MAPS = {
    1: { name: "Inside the Nose", bg: "map1", road: [0xf7d7c4, 0xd9998a],
         path: [[-40, 170], [330, 170], [330, 520], [640, 520], [640, 250], [960, 250], [960, 560], [1320, 560]],
         pads: [[190, 290], [70, 300], [450, 410], [470, 640], [510, 330], [760, 390], [790, 140], [840, 640], [1090, 440], [1100, 660], [1070, 320], [230, 600]] },
    2: { name: "Inside the Tummy", bg: "map2", road: [0xfff0c9, 0xe0a46a],
         path: [[-40, 600], [250, 600], [250, 210], [540, 210], [540, 500], [820, 500], [820, 180], [1100, 180], [1100, 450], [1320, 450]],
         pads: [[130, 480], [130, 280], [390, 330], [390, 560], [660, 350], [680, 630], [400, 100], [950, 320], [900, 610], [1220, 330], [1230, 580], [700, 100]] },
    3: { name: "In the Bloodstream", bg: "map3", road: [0xffd1c9, 0xb84a4a],
         path: [[-40, 140], [1120, 140], [1120, 340], [160, 340], [160, 540], [1120, 540], [1120, 660], [1320, 660]],
         pads: [[300, 240], [530, 240], [760, 240], [990, 240], [330, 440], [560, 440], [790, 440], [1010, 440], [1235, 250], [40, 440], [620, 645], [1235, 450]] },
  };
  const ALL = ["neo", "max", "bella", "tcell"];
  const LEVELS = [
    { name: "First Sniffles", map: 1, energy: 160, towers: ["neo"], hp: 1,
      tip: "Tap a glowing spot to place Neo the Neutrophil!",
      waves: [[["sniffle", 6, 1.5]], [["sniffle", 8, 1.2]], [["sniffle", 10, 1.0]], [["sniffle", 12, 0.85]]] },
    { name: "Zippy Zoom", map: 1, energy: 150, towers: ["neo", "max"], hp: 1,
      tip: "New hero: Max the Macrophage! Put him near a corner. CHOMP!",
      waves: [[["sniffle", 8, 1.2]], [["zippy", 6, 1.3]], [["sniffle", 8, 1.0], ["zippy", 6, 1.2, 4]], [["zippy", 12, 0.7]], [["sniffle", 10, 0.8], ["zippy", 10, 0.8, 3]]] },
    { name: "Flu Season", map: 1, energy: 170, towers: ["neo", "max", "bella"], hp: 1.05,
      tip: "New hero: Bella the B Cell! Her antibodies make germs slow and sticky.",
      waves: [[["sniffle", 10, 1]], [["flu", 3, 2.5], ["sniffle", 6, 1.2, 2]], [["zippy", 10, 0.7]], [["flu", 5, 2], ["zippy", 8, 0.8, 3]], [["flu", 8, 1.6], ["sniffle", 10, 0.9, 1]]] },
    { name: "Tummy Trouble", map: 2, energy: 230, towers: ["neo", "max", "bella"], hp: 1.05,
      tip: "Tummy Bugs split into two little bugs! Catch them all.",
      waves: [[["tummy", 4, 2.2]], [["sniffle", 10, 0.9], ["tummy", 4, 2, 3]], [["zippy", 12, 0.6]], [["tummy", 8, 1.5]], [["flu", 6, 1.6], ["tummy", 6, 1.6, 2]], [["tummy", 10, 1.1], ["zippy", 10, 0.8, 2]]] },
    { name: "Shell Shock", map: 2, energy: 280, towers: ALL, hp: 1.1,
      tip: "New hero: Captain T! Armor Viruses wear shells. Captain T and Bella's antibodies break through.",
      waves: [[["armor", 2, 3]], [["sniffle", 12, 0.8], ["armor", 3, 3, 2]], [["tummy", 6, 1.4], ["zippy", 10, 0.7, 2]], [["armor", 6, 2.2]], [["flu", 8, 1.3], ["armor", 4, 2.5, 3]], [["armor", 8, 1.6], ["zippy", 14, 0.6, 1]]] },
    { name: "Rush Hour", map: 3, energy: 280, towers: ALL, hp: 1.4,
      tip: "So many germs! Catch 4 colors of food for RAINBOW POWER!",
      waves: [[["sniffle", 16, 0.6]], [["zippy", 16, 0.5]], [["flu", 8, 1.2], ["sniffle", 12, 0.7, 2]], [["tummy", 10, 1]], [["armor", 6, 1.8], ["zippy", 14, 0.5, 2]], [["flu", 10, 1], ["tummy", 8, 1.2, 3]], [["armor", 8, 1.4], ["flu", 8, 1.2, 4], ["zippy", 16, 0.5, 6]]] },
    { name: "Armored March", map: 3, energy: 320, towers: ALL, hp: 1.6,
      tip: "A wall of shells is coming. Build Captain T and upgrade!",
      waves: [[["armor", 4, 2.4]], [["flu", 10, 1], ["armor", 4, 2, 3]], [["tummy", 12, 0.9]], [["armor", 10, 1.4]], [["zippy", 24, 0.4], ["armor", 4, 2, 4]], [["flu", 14, 0.8], ["tummy", 8, 1.2, 2]], [["armor", 14, 1.1], ["flu", 10, 1, 3]]] },
    { name: "Mega Virus", map: 3, energy: 340, towers: ALL, hp: 1.75,
      tip: "The Mega Virus is coming! Get ready, Body Defenders!",
      waves: [[["sniffle", 16, 0.5], ["zippy", 10, 0.6, 3]], [["flu", 10, 1], ["armor", 4, 2, 2]], [["tummy", 12, 0.9], ["armor", 6, 1.6, 3]], [["armor", 10, 1.2], ["zippy", 20, 0.4, 2]], [["flu", 14, 0.8], ["tummy", 10, 1, 2]], [["mega", 1, 1, 2], ["sniffle", 20, 0.9, 4], ["armor", 6, 2.5, 8]]] },
  ];
  const ENDLESS = { name: "Germ Rush (Endless)", map: 3, energy: 300, towers: ALL, endless: true,
    tip: "How many waves can you survive? Your best score is saved!" };

  /* ------------------------------------------------------------ storage */
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const progress = () => store.get("bd-progress", { stars: {}, best: 0 });
  const memory = () => store.get("bd-memory", {});
  const memLevel = (type, mem) => Math.min(3, Math.floor(((mem || memory())[type] || 0) / 25));

  /* ------------------------------------------------------------ helpers */
  function txt(scene, x, y, s, size, color, opts) {
    return scene.add.text(x, y, s, Object.assign({
      fontFamily: FONT, fontSize: size + "px", fontStyle: "800", color: color || "#ffffff",
      stroke: "#3b2f4a", strokeThickness: Math.max(3, size / 6), align: "center",
    }, opts || {})).setOrigin(0.5);
  }
  function button(scene, x, y, w, h, label, fill, onClick, size) {
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    const draw = (down) => {
      g.clear();
      g.fillStyle(0x000000, 0.18).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, h / 2);
      g.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2 + (down ? 4 : 0), w, h, h / 2);
      g.fillStyle(0xffffff, 0.25).fillRoundedRect(-w / 2 + 8, -h / 2 + 5 + (down ? 4 : 0), w - 16, h * 0.32, h * 0.16);
    };
    draw(false);
    const t = txt(scene, 0, -2, label, size || 26, "#ffffff");
    c.add([g, t]);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on("pointerdown", (p, lx, ly, ev) => { draw(true); t.y = 2; ev && ev.stopPropagation(); });
    c.on("pointerup", (p, lx, ly, ev) => { draw(false); t.y = -2; ev && ev.stopPropagation(); S.tap(); onClick(); });
    c.on("pointerout", () => { draw(false); t.y = -2; });
    c.label = t;
    return c;
  }
  class Path {
    constructor(pts) {
      this.pts = pts; this.seg = []; let L = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.hypot(bx - ax, by - ay);
        this.seg.push({ ax, ay, bx, by, l, s: L }); L += l;
      }
      this.len = L;
    }
    at(d) {
      for (const s of this.seg) if (d <= s.s + s.l) { const t = (d - s.s) / s.l; return [s.ax + (s.bx - s.ax) * t, s.ay + (s.by - s.ay) * t]; }
      const s = this.seg[this.seg.length - 1]; return [s.bx, s.by];
    }
  }

  /* ============================================================ BOOT */
  class Boot extends Phaser.Scene {
    constructor() { super("boot"); }
    preload() {
      const bar = this.add.graphics(), t = txt(this, W / 2, H / 2 - 50, "Loading the Body Defenders...", 34);
      this.load.on("progress", v => { bar.clear().fillStyle(0xffffff, .3).fillRoundedRect(340, 380, 600, 28, 14).fillStyle(0xff8a5c, 1).fillRoundedRect(340, 380, 600 * v, 28, 14); });
      ["map1", "map2", "map3", "p01"].forEach(k => this.load.image(k, "img/" + k + ".webp"));
      Object.keys(TOWERS).forEach(k => this.load.image(k, "img/" + k + ".webp"));
      ["sniffle", "zippy", "flu", "tummy", "armor", "mega"].forEach(k => this.load.image(k, "img/" + k + ".webp"));
      Object.keys(FOODS).forEach(k => this.load.image(k, "img/" + k + ".webp"));
    }
    create() {
      const g = this.make.graphics({ add: false });
      // soft dot for particles
      for (let r = 16; r > 0; r--) { g.fillStyle(0xffffff, (1 - r / 16) * 0.35 + 0.05); g.fillCircle(16, 16, r); }
      g.fillStyle(0xffffff, 1).fillCircle(16, 16, 6); g.generateTexture("dot", 32, 32); g.clear();
      // glowing orb projectile
      for (let r = 14; r > 0; r--) { g.fillStyle(0xffffff, (1 - r / 14) * 0.6); g.fillCircle(14, 14, r); }
      g.fillStyle(0xffffff, 1).fillCircle(14, 14, 5); g.generateTexture("orb", 28, 28); g.clear();
      // antibody: a little Y
      g.lineStyle(6, 0xffffff, 1); g.beginPath(); g.moveTo(14, 26); g.lineTo(14, 14); g.lineTo(5, 4); g.moveTo(14, 14); g.lineTo(23, 4); g.strokePath();
      g.generateTexture("ab", 28, 30); g.clear();
      // spark (star)
      g.fillStyle(0xffffff, 1); g.fillPoints([{ x: 16, y: 0 }, { x: 20, y: 12 }, { x: 32, y: 16 }, { x: 20, y: 20 }, { x: 16, y: 32 }, { x: 12, y: 20 }, { x: 0, y: 16 }, { x: 12, y: 12 }], true);
      g.generateTexture("spark", 32, 32); g.destroy();
      this.scene.start("menu");
    }
  }

  /* ============================================================ MENU */
  class Menu extends Phaser.Scene {
    constructor() { super("menu"); }
    create() {
      this.add.image(W / 2, H / 2, "p01").setDisplaySize(W, H);
      this.add.rectangle(W / 2, H / 2, W, H, 0x2a1b3d, 0.55);
      const title = txt(this, W / 2, 78, "Body Defenders", 76, "#ffffff", { strokeThickness: 12 });
      this.tweens.add({ targets: title, y: 84, yoyo: true, repeat: -1, duration: 1400, ease: "Sine.inOut" });
      txt(this, W / 2, 140, "Veggie Power! · Choose a level", 30, "#ffe08a");
      const pr = progress();
      const all = /[?&]unlock=1/.test(location.search);
      const unlocked = i => all || i === 0 || (pr.stars[i] || 0) > 0;
      LEVELS.forEach((L, i) => {
        const col = i % 4, row = Math.floor(i / 4), x = 250 + col * 260, y = 260 + row * 190;
        const open = unlocked(i), stars = pr.stars[i + 1] || 0;
        const c = this.add.container(x, y);
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.25).fillRoundedRect(-110, -70 + 8, 220, 150, 26);
        g.fillStyle(open ? [0xff8a5c, 0xff8a5c, 0xff8a5c, 0xf2a93b, 0xf2a93b, 0xd9534f, 0xd9534f, 0xb83280][i] : 0x7d7490, 1).fillRoundedRect(-110, -70, 220, 150, 26);
        g.fillStyle(0xffffff, 0.2).fillRoundedRect(-100, -62, 200, 40, 18);
        c.add(g);
        c.add(txt(this, 0, -40, open ? "Level " + (i + 1) : "🔒", 26));
        c.add(txt(this, 0, -2, L.name, 24, "#fff7e0"));
        c.add(txt(this, 0, 42, open ? "★".repeat(stars) + "☆".repeat(3 - stars) : MAPS[L.map].name, open ? 34 : 18, stars ? "#ffd93a" : "#ffffff"));
        if (open) {
          c.setSize(220, 150).setInteractive({ useHandCursor: true });
          c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.06, duration: 120 }));
          c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
          c.on("pointerup", () => { S.whoosh(); this.scene.start("game", { level: i }); });
        }
      });
      const endlessOpen = all || (pr.stars[4] || 0) > 0;
      button(this, W / 2, 650, 420, 64, endlessOpen ? "♾  Germ Rush · Best: wave " + (pr.best || 0) : "🔒 Germ Rush (clear Level 4)", endlessOpen ? 0x6c8cff : 0x7d7490,
        () => { if (endlessOpen) { S.whoosh(); this.scene.start("game", { level: "endless" }); } else S.oops(); }, 24);
    }
  }

  /* ============================================================ GAME */
  class Game extends Phaser.Scene {
    constructor() { super("game"); }
    init(data) {
      this.levelIndex = data.level;
      this.L = data.level === "endless" ? ENDLESS : LEVELS[data.level];
      this.map = MAPS[this.L.map];
      this.path = new Path(this.map.path);
      this.lives = 10; this.energy = this.L.energy;
      this.wave = 0; this.waveCount = this.L.endless ? Infinity : this.L.waves.length;
      this.state = "build"; this.speed = 1; this.paused = false;
      this.enemies = []; this.towers = []; this.shots = []; this.foods = []; this.queue = []; this.waveT = 0;
      this.foodT = 4; this.rainbow = {}; this.rainbowT = 0; this.sleepyT = 0; this.breakT = 0;
      this.mem = memory(); this.memStart = {}; Object.keys(ENEMIES).forEach(k => this.memStart[k] = memLevel(k, this.mem));
      this.livesLost = 0; this.ended = false; this.tutorial = this.levelIndex === 0;
    }
    create() {
      this.tweens.timeScale = 1;
      this.add.image(W / 2, H / 2, this.map.bg).setDisplaySize(W, H);
      this.drawRoad();
      this.padLayer = this.add.layer(); this.towerLayer = this.add.layer(); this.enemyLayer = this.add.layer();
      this.bars = this.add.graphics().setDepth(20);
      this.fxLayer = this.add.layer().setDepth(25);
      this.foodLayer = this.add.layer().setDepth(30);
      this.makeFx();
      this.pads = this.map.pads.map(([x, y]) => this.makePad(x, y));
      this.makeHUD();
      this.input.on("pointerdown", (p, objs) => { if (!objs.length) this.closePopup(); });
      this.showTip(this.L.tip, 5200);
      if (this.tutorial) this.pointAt(this.pads[0].x, this.pads[0].y - 60);
      this.startBtn = button(this, W / 2, H - 70, 330, 70, "▶  Send the germs!", 0x5ccf6a, () => this.nextWave(), 30).setDepth(60);
      this.tweens.add({ targets: this.startBtn, scale: 1.06, yoyo: true, repeat: -1, duration: 700 });
    }

    /* ---------- map drawing */
    drawRoad() {
      const g = this.add.graphics(), pts = this.map.path.map(([x, y]) => new Phaser.Math.Vector2(x, y));
      const [light, edge] = this.map.road;
      const stroke = (w, c, a) => { g.lineStyle(w, c, a); g.strokePoints(pts, false); pts.forEach(p => { g.fillStyle(c, a); g.fillCircle(p.x, p.y, w / 2); }); };
      stroke(92, 0x000000, 0.16); stroke(80, edge, 1); stroke(64, light, 1);
      // centre dots
      g.fillStyle(edge, 0.45);
      for (let d = 10; d < this.path.len; d += 34) { const [x, y] = this.path.at(d); g.fillCircle(x, y, 3.2); }
      // entrance cloud + exit heart
      const [sx, sy] = this.path.at(40);
      for (let i = 0; i < 6; i++) { const c = this.add.image(sx - 10 + Math.random() * 30, sy - 30 + Math.random() * 60, "dot").setTint(0xd8d0e8).setScale(2.4 + Math.random()).setAlpha(0.7); this.tweens.add({ targets: c, scale: c.scale * 1.15, yoyo: true, repeat: -1, duration: 900 + i * 120 }); }
      const [ex, ey] = this.map.path[this.map.path.length - 2];
      const hx = Math.min(1230, ex + 110), hy = ey;
      this.heart = this.add.text(hx, hy, "💖", { fontSize: "64px" }).setOrigin(0.5).setDepth(15);
      this.tweens.add({ targets: this.heart, scale: 1.12, yoyo: true, repeat: -1, duration: 600, ease: "Sine.inOut" });
      this.heartLbl = txt(this, hx, hy + 48, "Your body", 18).setDepth(15);
    }
    makeFx() {
      const mk = (tint, extra) => { const e = this.add.particles(0, 0, "dot", Object.assign({ speed: { min: 60, max: 240 }, scale: { start: 0.7, end: 0 }, lifespan: 520, tint, emitting: false, blendMode: "ADD" }, extra || {})); this.fxLayer.add(e); return e; };
      this.fxPop = mk([0x9cff6b, 0xfff36b, 0x6bd6ff, 0xff8fd0]);
      this.fxHit = mk([0xffffff, 0xfff1a8], { speed: { min: 40, max: 140 }, lifespan: 260, scale: { start: 0.45, end: 0 } });
      this.fxGold = mk([0xffd93a, 0xffffff, 0xffa94d], { speed: { min: 80, max: 300 }, lifespan: 700, gravityY: 300 });
      this.fxRain = mk([0xff5a5a, 0xff9d3a, 0xffd93a, 0x5ccf6a, 0x6c8cff, 0xb28dff], { speed: { min: 100, max: 420 }, lifespan: 1000, scale: { start: 1, end: 0 } });
      this.fxDust = mk([0xb39ddb, 0xffffff], { speed: { min: 30, max: 120 }, lifespan: 600, blendMode: "NORMAL", alpha: { start: 0.8, end: 0 } });
    }
    makePad(x, y) {
      const pad = { x, y, tower: null };
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.18).fillEllipse(x, y + 8, 80, 34);
      g.fillStyle(0xffffff, 0.55).fillCircle(x, y, 34);
      g.lineStyle(4, 0xffffff, 0.95).strokeCircle(x, y, 34);
      g.lineStyle(5, 0xff8a5c, 0.9); g.beginPath(); g.moveTo(x - 11, y); g.lineTo(x + 11, y); g.moveTo(x, y - 11); g.lineTo(x, y + 11); g.strokePath();
      this.padLayer.add(g);
      pad.gfx = g;
      const glow = this.add.circle(x, y, 38, 0xffffff, 0).setStrokeStyle(4, 0xffe08a, 0.9);
      this.padLayer.add(glow);
      this.tweens.add({ targets: glow, scale: 1.25, alpha: { from: 1, to: 0 }, repeat: -1, duration: 1300 });
      pad.glow = glow;
      const z = this.add.zone(x, y, 84, 84).setInteractive({ useHandCursor: true });
      z.on("pointerdown", (p, lx, ly, ev) => { ev.stopPropagation(); S.tap(); pad.tower ? this.towerMenu(pad.tower) : this.buildMenu(pad); });
      return pad;
    }

    /* ---------- HUD */
    makeHUD() {
      const g = this.add.graphics().setDepth(50);
      g.fillStyle(0x2a1b3d, 0.72).fillRoundedRect(8, 6, W - 16, HUD_H - 8, 22);
      this.hLives = txt(this, 90, HUD_H / 2 + 1, "", 28).setDepth(51);
      this.hEnergy = txt(this, 250, HUD_H / 2 + 1, "", 28, "#ffe08a").setDepth(51);
      this.hWave = txt(this, 470, HUD_H / 2 + 1, "", 26).setDepth(51);
      txt(this, 640, HUD_H / 2 + 1, "Rainbow", 20, "#ffffff").setDepth(51);
      this.rbDots = RAINBOW.map((c, i) => this.add.circle(705 + i * 30, HUD_H / 2 + 1, 11, RAINBOW_HEX[c], 0.25).setStrokeStyle(3, 0xffffff, 0.9).setDepth(51));
      this.hBuff = txt(this, 900, HUD_H / 2 + 1, "", 22, "#9df7c0").setDepth(51);
      this.spdBtn = button(this, 1080, HUD_H / 2 + 1, 74, 40, "1x", 0x6c8cff, () => { this.speed = this.speed === 1 ? 2 : 1; this.spdBtn.label.setText(this.speed + "x"); this.tweens.timeScale = this.speed; }, 22).setDepth(52);
      this.pauseBtn = button(this, 1160, HUD_H / 2 + 1, 64, 40, "II", 0xff8a5c, () => this.togglePause(), 22).setDepth(52);
      this.menuBtn = button(this, 1232, HUD_H / 2 + 1, 64, 40, "☰", 0x8a7aa8, () => this.scene.start("menu"), 22).setDepth(52);
      this.updateHUD();
    }
    updateHUD() {
      this.hLives.setText("❤ " + this.lives);
      this.hEnergy.setText("⚡ " + Math.floor(this.energy));
      this.hWave.setText(this.L.endless ? "Wave " + Math.max(1, this.wave) : "Wave " + Math.max(1, Math.min(this.wave, this.waveCount)) + " / " + this.waveCount);
      RAINBOW.forEach((c, i) => this.rbDots[i].setFillStyle(RAINBOW_HEX[c], this.rainbow[c] ? 1 : 0.25));
      const b = [];
      if (this.rainbowT > 0) b.push("🌈 POWER " + Math.ceil(this.rainbowT));
      if (this.sleepyT > 0) b.push("😴 Sugar crash " + Math.ceil(this.sleepyT));
      this.hBuff.setText(b.join("  ")).setColor(this.sleepyT > 0 && !this.rainbowT ? "#ffb3b3" : "#9df7c0");
    }
    togglePause() {
      this.paused = !this.paused;
      this.pauseBtn.label.setText(this.paused ? "▶" : "II");
      this.paused ? this.tweens.pauseAll() : this.tweens.resumeAll();
      if (this.paused) { this.pauseCard = txt(this, W / 2, H / 2, "Paused", 72).setDepth(70); }
      else if (this.pauseCard) { this.pauseCard.destroy(); this.pauseCard = null; }
    }
    showTip(s, ms) {
      if (this.tipObj) this.tipObj.destroy();
      const c = this.add.container(W / 2, HUD_H + 40).setDepth(55);
      const t = txt(this, 0, 0, s, 24, "#3b2f4a", { stroke: "#ffffff", strokeThickness: 0, wordWrap: { width: 900 } });
      const g = this.add.graphics();
      g.fillStyle(0xfff8ec, 0.95).fillRoundedRect(-t.width / 2 - 22, -t.height / 2 - 10, t.width + 44, t.height + 20, 20);
      g.lineStyle(3, 0xff8a5c, 1).strokeRoundedRect(-t.width / 2 - 22, -t.height / 2 - 10, t.width + 44, t.height + 20, 20);
      c.add([g, t]); c.setScale(0.6).setAlpha(0);
      this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 260, ease: "Back.out" });
      this.tipObj = c;
      this.time.delayedCall(ms || 3500, () => { if (this.tipObj === c) this.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => c.destroy() }); });
    }
    floatText(x, y, s, color, size) {
      const t = txt(this, x, y, s, size || 24, color || "#ffffff").setDepth(40);
      this.tweens.add({ targets: t, y: y - 50, alpha: { from: 1, to: 0 }, duration: 1100, ease: "Cubic.out", onComplete: () => t.destroy() });
    }
    pointAt(x, y) {
      if (this.pointer) this.pointer.destroy();
      this.pointer = this.add.text(x, y, "👇", { fontSize: "54px" }).setOrigin(0.5).setDepth(56);
      this.tweens.add({ targets: this.pointer, y: y - 16, yoyo: true, repeat: -1, duration: 420 });
    }

    /* ---------- build / upgrade popups */
    closePopup() { if (this.popup) { this.popup.destroy(); this.popup = null; } if (this.rangeG) { this.rangeG.destroy(); this.rangeG = null; } }
    popupAt(pad, w, h) {
      this.closePopup();
      let px = Phaser.Math.Clamp(pad.x, w / 2 + 10, W - w / 2 - 10);
      let py = pad.y - 70 - h / 2; if (py - h / 2 < HUD_H + 4) py = pad.y + 70 + h / 2;
      py = Phaser.Math.Clamp(py, HUD_H + h / 2 + 4, H - h / 2 - 6);
      const c = this.add.container(px, py).setDepth(58);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.2).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 24);
      g.fillStyle(0xfff8ec, 0.98).fillRoundedRect(-w / 2, -h / 2, w, h, 24);
      g.lineStyle(4, 0xff8a5c, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 24);
      c.add(g);
      const blocker = this.add.zone(0, 0, w, h).setInteractive(); blocker.on("pointerdown", (p, a, b, ev) => ev.stopPropagation());
      c.add(blocker);
      this.popup = c;
      return c;
    }
    showRange(x, y, r) {
      if (this.rangeG) this.rangeG.destroy();
      this.rangeG = this.add.graphics().setDepth(57);
      this.rangeG.fillStyle(0xffffff, 0.12).fillCircle(x, y, r).lineStyle(3, 0xffffff, 0.7).strokeCircle(x, y, r);
    }
    buildMenu(pad) {
      const avail = this.L.towers, w = 120 * avail.length + 30, h = 170;
      const c = this.popupAt(pad, w, h);
      c.add(txt(this, 0, -h / 2 + 22, "Choose a defender", 20, "#3b2f4a", { strokeThickness: 0 }));
      avail.forEach((k, i) => {
        const T = TOWERS[k], x = -w / 2 + 75 + i * 120, ok = this.energy >= T.cost;
        const b = this.add.container(x, 18);
        const bg = this.add.graphics();
        bg.fillStyle(ok ? 0xffffff : 0xe6e1ea, 1).fillRoundedRect(-52, -58, 104, 120, 18).lineStyle(3, ok ? T.color : 0xbbb4c4, 1).strokeRoundedRect(-52, -58, 104, 120, 18);
        const im = this.add.image(0, -14, k); im.setScale(64 / Math.max(im.width, im.height)); if (!ok) im.setAlpha(0.45);
        b.add([bg, im, txt(this, 0, 30, T.name, 18, "#3b2f4a", { strokeThickness: 0 }), txt(this, 0, 50, "⚡" + T.cost, 18, ok ? "#e0662f" : "#9a90a6", { strokeThickness: 0 })]);
        b.setSize(104, 120).setInteractive({ useHandCursor: true });
        b.on("pointerover", () => this.showRange(pad.x, pad.y, T.range[0]));
        b.on("pointerdown", (p, a, bb, ev) => {
          ev.stopPropagation();
          if (this.energy < T.cost) { S.oops(); this.floatText(pad.x, pad.y - 40, "Need more ⚡! Tap healthy food!", "#ffd0d0", 20); return; }
          this.build(pad, k);
        });
        c.add(b);
      });
    }
    build(pad, k) {
      const T = TOWERS[k];
      this.energy -= T.cost; this.closePopup();
      const t = { pad, k, T, lvl: 1, cool: 0.2, spent: T.cost, x: pad.x, y: pad.y - 18 };
      const shadow = this.add.ellipse(pad.x, pad.y + 22, 70, 22, 0x000000, 0.22);
      const spr = this.add.image(t.x, t.y, k); spr.setScale(86 / Math.max(spr.width, spr.height));
      t.base = spr.scale; t.spr = spr; t.shadow = shadow;
      t.stars = txt(this, pad.x, pad.y + 40, "★", 18, "#ffd93a");
      this.towerLayer.add([shadow, spr, t.stars]);
      this.tweens.add({ targets: spr, y: t.y - 5, yoyo: true, repeat: -1, duration: 900 + Math.random() * 300, ease: "Sine.inOut" });
      spr.setScale(0.01); this.tweens.add({ targets: spr, scale: t.base, duration: 380, ease: "Back.out" });
      this.fxGold.explode(18, pad.x, pad.y); S.sparkle();
      pad.tower = t; pad.glow.setVisible(false); pad.gfx.setAlpha(0.35);
      this.towers.push(t); this.updateHUD();
      if (this.tutorial && this.pointer) { this.pointer.destroy(); this.pointer = null; this.showTip("Great! Now press ▶ to send the germs.", 3500); }
    }
    towerMenu(t) {
      const w = 300, h = 190, c = this.popupAt(t.pad, w, h), T = t.T;
      this.showRange(t.pad.x, t.pad.y, T.range[t.lvl - 1]);
      c.add(txt(this, 0, -h / 2 + 24, T.full, 21, "#3b2f4a", { strokeThickness: 0 }));
      c.add(txt(this, 0, -h / 2 + 50, "Level " + t.lvl + " · " + (t.lvl < 3 ? (t.lvl === 2 ? "Next: " + T.lv3 : "Stronger & farther") : T.lv3), 15, "#6b5d7b", { strokeThickness: 0, wordWrap: { width: 270 } }));
      if (t.lvl < 3) {
        const cost = T.ups[t.lvl - 1], ok = this.energy >= cost;
        c.add(button(this, -66, 40, 130, 56, "▲ ⚡" + cost, ok ? 0x5ccf6a : 0xa8a0b3, () => {
          if (this.energy < cost) { S.oops(); this.floatText(t.pad.x, t.pad.y - 50, "Need more ⚡!", "#ffd0d0", 20); return; }
          this.energy -= cost; t.spent += cost; t.lvl++; t.stars.setText("★".repeat(t.lvl));
          this.fxGold.explode(26, t.x, t.y); S.yay();
          this.tweens.add({ targets: t.spr, scale: t.base * 1.25, yoyo: true, duration: 180 });
          this.closePopup(); this.updateHUD();
        }, 22));
      } else c.add(txt(this, -66, 40, "MAX ★★★", 22, "#e0662f", { strokeThickness: 0 }));
      const refund = Math.floor(t.spent * 0.6);
      c.add(button(this, 76, 40, 120, 56, "Sell +" + refund, 0xff8a5c, () => {
        this.energy += refund; t.spr.destroy(); t.shadow.destroy(); t.stars.destroy();
        this.towers = this.towers.filter(o => o !== t); t.pad.tower = null; t.pad.glow.setVisible(true); t.pad.gfx.setAlpha(1);
        this.fxDust.explode(20, t.x, t.y); this.closePopup(); this.updateHUD();
      }, 20));
    }

    /* ---------- waves */
    nextWave() {
      if (this.startBtn) { this.startBtn.destroy(); this.startBtn = null; }
      if (this.breakBtn) { this.breakBtn.destroy(); this.breakBtn = null; }
      if (this.state === "break" && this.breakT > 1) { const bonus = Math.ceil(this.breakT) * 2; this.energy += bonus; this.floatText(W / 2, H - 120, "Early bonus +" + bonus + " ⚡", "#ffe08a", 26); }
      this.wave++; this.state = "wave"; this.waveT = 0; this.queue = [];
      const groups = this.L.endless ? this.endlessWave(this.wave) : this.L.waves[this.wave - 1];
      groups.forEach(([type, n, gap, delay]) => { for (let i = 0; i < n; i++) this.queue.push({ t: (delay || 0) + i * gap, type }); });
      this.queue.sort((a, b) => a.t - b.t);
      S.whoosh();
      const big = groups.some(g => g[0] === "mega");
      const banner = txt(this, W / 2, H / 2, big ? "⚠ MEGA VIRUS! ⚠" : "Wave " + this.wave + (this.L.endless ? "" : " / " + this.waveCount), 64, big ? "#ff8fa3" : "#ffffff").setDepth(65).setScale(0.3);
      this.tweens.add({ targets: banner, scale: 1, duration: 380, ease: "Back.out", yoyo: true, hold: 700, onComplete: () => banner.destroy() });
      if (big) { this.cameras.main.shake(500, 0.006); S.boom(); }
      this.updateHUD();
    }
    endlessWave(n) {
      const pool = ["sniffle", "zippy"]; if (n > 2) pool.push("flu"); if (n > 4) pool.push("tummy"); if (n > 6) pool.push("armor");
      const out = [], k = 2 + Math.min(3, Math.floor(n / 4));
      for (let i = 0; i < k; i++) { const type = pool[Math.floor(Math.random() * pool.length)]; out.push([type, 4 + Math.floor(n * 0.8), Math.max(0.35, 1.2 - n * 0.03), i * 2]); }
      if (n % 10 === 0) out.push(["mega", 1, 1, 3]);
      return out;
    }
    hpMult() { return this.L.endless ? 1 + 0.09 * this.wave : this.L.hp; }
    spawn(type, d, parentX) {
      const E = ENEMIES[type], tex = E.tex || type;
      const spr = this.add.image(0, 0, tex); spr.setScale(E.size / Math.max(spr.width, spr.height));
      const hp = E.hp * this.hpMult();
      const e = { type, E, spr, hp, max: hp, d: d || 0, slowT: 0, slow: 0, tagT: 0, base: spr.scale, wob: Math.random() * 6, summonT: 6 };
      this.enemyLayer.add(spr);
      const [x, y] = this.path.at(e.d); spr.setPosition(x, y);
      this.enemies.push(e);
      if (E.boss) { this.bossBar = true; }
      return e;
    }

    /* ---------- food */
    spawnFood() {
      const keys = Object.keys(FOODS), healthy = keys.filter(k => !FOODS[k].junk), junk = keys.filter(k => FOODS[k].junk);
      const k = Math.random() < 0.22 ? Phaser.Utils.Array.GetRandom(junk) : Phaser.Utils.Array.GetRandom(healthy);
      const x = 90 + Math.random() * (W - 180);
      const im = this.add.image(x, H + 50, k); im.setScale(78 / Math.max(im.width, im.height));
      im.setInteractive({ useHandCursor: true });
      const f = { k, F: FOODS[k], im, vy: -(60 + Math.random() * 25), x0: x, t: Math.random() * 6 };
      im.on("pointerdown", (p, a, b, ev) => { ev.stopPropagation(); this.eat(f); });
      this.foodLayer.add(im);
      this.foods.push(f);
      if (this.tutorial && !this.foodTipShown) { this.foodTipShown = true; this.showTip("Yum! Tap the floating food to get ⚡ power for your defenders!", 4500); }
    }
    eat(f) {
      if (f.gone) return; f.gone = true;
      const { x, y } = f.im;
      if (f.F.junk) {
        S.oops(); this.sleepyT = 4;
        this.floatText(x, y - 30, "Sugar crash! No vitamins 😴", "#ffb3b3", 22);
        this.fxDust.explode(14, x, y);
      } else {
        S.ding(); this.energy += 15;
        this.floatText(x, y - 30, "+15 ⚡ " + f.F.nut + "!", "#fff3a8", 24);
        this.fxRain.explode(16, x, y);
        this.rainbow[f.F.color] = true;
        if (RAINBOW.every(c => this.rainbow[c])) {
          this.rainbow = {}; this.rainbowT = 8; S.yay();
          this.cameras.main.flash(300, 255, 240, 200);
          this.showTip("🌈 RAINBOW POWER! Eating many colors makes your defenders super strong!", 3000);
          this.towers.forEach(t => this.fxRain.explode(20, t.x, t.y));
        }
      }
      this.tweens.add({ targets: f.im, scale: f.im.scale * 1.6, alpha: 0, duration: 220, onComplete: () => f.im.destroy() });
      this.foods = this.foods.filter(o => o !== f);
      this.updateHUD();
    }

    /* ---------- combat */
    damage(e, amount, src) {
      if (e.dead) return;
      const E = e.E;
      let d = amount * (1 + 0.08 * memLevel(E.memoryAs || e.type, this.mem)) * (this.rainbowT > 0 ? 1.6 : 1);
      if (e.tagT > 0) d *= 1.25;
      if (E.armor && src !== "tcell" && e.tagT <= 0) d *= 1 - E.armor;
      if (src === "tcell" && E.boss) d *= 1.5;
      e.hp -= d;
      e.spr.setTintFill(0xffffff); this.time.delayedCall(60, () => { if (!e.dead) this.tintEnemy(e); });
      if (e.hp <= 0) this.kill(e);
    }
    tintEnemy(e) { e.spr.clearTint(); if (e.slowT > 0) e.spr.setTint(0xa8d8ff); }
    kill(e) {
      e.dead = true;
      const { x, y } = e.spr;
      this.fxPop.explode(e.E.boss ? 80 : 18, x, y);
      S.pop();
      this.energy += e.E.reward;
      this.floatText(x, y - 20, "+" + e.E.reward, "#ffe08a", 20);
      this.tweens.add({ targets: e.spr, scale: e.spr.scale * 1.4, alpha: 0, angle: 90, duration: 200, onComplete: () => e.spr.destroy() });
      const key = e.E.memoryAs || e.type;
      this.mem[key] = (this.mem[key] || 0) + 1;
      const lv = memLevel(key, this.mem);
      if (lv > this.memStart[key]) { this.memStart[key] = lv; this.showTip("🧠 Memory cells now remember " + ENEMIES[key].name + "! +" + lv * 8 + "% damage against it", 3800); S.sparkle(); }
      if (e.E.split) for (let i = 0; i < 2; i++) this.spawn(e.E.split, Math.max(0, e.d - 10 - i * 22));
      if (e.E.boss) { this.cameras.main.shake(600, 0.01); S.boom(); this.fxGold.explode(60, x, y); }
      this.updateHUD();
    }
    targetsFor(t, n) {
      const r = t.T.range[t.lvl - 1], out = [];
      const list = this.enemies.filter(e => !e.dead && Phaser.Math.Distance.Between(t.x, t.y + 18, e.spr.x, e.spr.y) <= r);
      list.sort((a, b) => b.d - a.d);
      for (let i = 0; i < Math.min(n, list.length); i++) out.push(list[i]);
      return out;
    }
    fire(t) {
      const T = t.T, L = t.lvl - 1;
      if (T.kind === "orb") {
        const ts = this.targetsFor(t, T.shots[L]); if (!ts.length) return false;
        ts.forEach(e => this.shoot(t, e, "orb", T.color, 720, () => this.damage(e, T.dmg[L], "neo")));
        S.tap();
      } else if (T.kind === "chomp") {
        const [e] = this.targetsFor(t, 1); if (!e) return false;
        this.tweens.add({ targets: t.spr, scaleX: t.base * 1.3, scaleY: t.base * 0.8, yoyo: true, duration: 110 });
        this.tweens.add({ targets: t.spr, x: t.x + (e.spr.x - t.x) * 0.25, y: t.y + (e.spr.y - t.y) * 0.25, yoyo: true, duration: 110 });
        this.fxHit.explode(14, e.spr.x, e.spr.y); S.munch();
        this.floatText(e.spr.x, e.spr.y - 30, "CHOMP!", "#bfe3ff", 20);
        this.damage(e, T.dmg[L], "max");
        if (T.splash[L]) this.enemies.filter(o => o !== e && !o.dead && Phaser.Math.Distance.Between(o.spr.x, o.spr.y, e.spr.x, e.spr.y) < T.splash[L]).forEach(o => this.damage(o, T.dmg[L] * 0.5, "max"));
      } else if (T.kind === "antibody") {
        const ts = this.targetsFor(t, T.targets[L]); if (!ts.length) return false;
        ts.forEach(e => this.shoot(t, e, "ab", T.color, 560, () => {
          this.damage(e, T.dmg[L], "bella");
          e.slowT = 2.2; e.slow = T.slow[L]; e.tagT = 3; if (!e.dead) this.tintEnemy(e);
        }, true));
        S.tap();
      } else if (T.kind === "strike") {
        const [e] = this.targetsFor(t, 1); if (!e) return false;
        this.shoot(t, e, "spark", T.color, 950, () => {
          this.damage(e, T.dmg[L], "tcell"); this.fxGold.explode(10, e.spr.x, e.spr.y);
          if (T.pierce[L]) { const o = this.enemies.find(o => o !== e && !o.dead && Phaser.Math.Distance.Between(o.spr.x, o.spr.y, e.spr.x, e.spr.y) < 90); if (o) this.damage(o, T.dmg[L] * 0.7, "tcell"); }
        }, true);
        S.tick();
        this.tweens.add({ targets: t.spr, angle: { from: -12, to: 0 }, duration: 160 });
      }
      this.tweens.add({ targets: t.spr, scaleY: t.base * 0.9, yoyo: true, duration: 70 });
      return true;
    }
    shoot(t, e, tex, tint, speed, onHit, spin) {
      const s = this.add.image(t.x, t.y - 6, tex).setTint(tint).setBlendMode(tex === "orb" ? "ADD" : "NORMAL").setScale(tex === "orb" ? 1.1 : 0.9);
      this.fxLayer.add(s);
      this.shots.push({ s, e, speed, onHit, spin, lx: e.spr.x, ly: e.spr.y });
    }

    /* ---------- main loop */
    update(time, delta) {
      if (this.paused || this.ended) return;
      const dt = Math.min(0.05, delta / 1000) * this.speed;
      if (this.rainbowT > 0) this.rainbowT = Math.max(0, this.rainbowT - dt);
      if (this.sleepyT > 0) this.sleepyT = Math.max(0, this.sleepyT - dt);
      if ((this.hudTick = (this.hudTick || 0) + dt) > 0.25) { this.hudTick = 0; this.updateHUD(); }

      // spawning
      if (this.state === "wave") {
        this.waveT += dt;
        while (this.queue.length && this.queue[0].t <= this.waveT) this.spawn(this.queue.shift().type);
        if (!this.queue.length && !this.enemies.length) this.waveCleared();
      } else if (this.state === "break") {
        this.breakT -= dt;
        if (this.breakBtn) this.breakBtn.label.setText("▶ Next wave (" + Math.ceil(Math.max(0, this.breakT)) + ")");
        if (this.breakT <= 0) this.nextWave();
      }
      // food
      if (this.state !== "build") { this.foodT -= dt; if (this.foodT <= 0) { this.foodT = 4.5 + Math.random() * 3; this.spawnFood(); } }
      this.foods.forEach(f => { f.t += dt; f.im.y += f.vy * dt; f.im.x = f.x0 + Math.sin(f.t * 1.6) * 26; f.im.angle = Math.sin(f.t * 2) * 10; if (f.im.y < HUD_H - 30) { f.gone = true; f.im.destroy(); } });
      this.foods = this.foods.filter(f => !f.gone);

      // enemies
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) { e.slow = 0; this.tintEnemy(e); } }
        if (e.tagT > 0) e.tagT -= dt;
        e.d += e.E.speed * (1 - e.slow) * dt;
        const [x, y] = this.path.at(e.d);
        e.wob += dt * 7;
        e.spr.setPosition(x, y + Math.sin(e.wob) * 3);
        e.spr.rotation = Math.sin(e.wob * 0.7) * 0.14;
        if (e.E.boss) { e.summonT -= dt; if (e.summonT <= 0) { e.summonT = 5; this.spawn("sniffle", Math.max(0, e.d - 30)); this.spawn("sniffle", Math.max(0, e.d - 60)); this.fxPop.explode(20, x, y); } }
        if (e.d >= this.path.len) {
          e.dead = true; e.spr.destroy();
          this.lives = Math.max(0, this.lives - e.E.hurt); this.livesLost += e.E.hurt;
          S.oops(); this.cameras.main.shake(180, 0.004);
          this.tweens.add({ targets: this.heart, scale: 0.7, yoyo: true, duration: 120 });
          this.floatText(this.heart.x, this.heart.y - 40, "-" + e.E.hurt + " ❤", "#ff9db0", 26);
          this.updateHUD();
          if (this.lives <= 0) return this.finish(false);
        }
      }
      this.enemies = this.enemies.filter(e => !e.dead);

      // towers
      const rate = (this.sleepyT > 0 ? 0.6 : 1) * (this.rainbowT > 0 ? 1.4 : 1);
      for (const t of this.towers) {
        t.cool -= dt * rate;
        if (t.cool <= 0 && this.fire(t)) t.cool = t.T.cd[t.lvl - 1];
        else if (t.cool < 0) t.cool = 0;
      }
      // shots
      for (const sh of this.shots) {
        const tx = sh.e.dead ? sh.lx : sh.e.spr.x, ty = sh.e.dead ? sh.ly : sh.e.spr.y;
        sh.lx = tx; sh.ly = ty;
        const dx = tx - sh.s.x, dy = ty - sh.s.y, dist = Math.hypot(dx, dy), step = sh.speed * dt;
        if (sh.spin) sh.s.rotation += dt * 14;
        if (dist <= step + 8) { sh.done = true; sh.s.destroy(); this.fxHit.explode(6, tx, ty); if (!sh.e.dead) sh.onHit(); }
        else { sh.s.x += dx / dist * step; sh.s.y += dy / dist * step; }
      }
      this.shots = this.shots.filter(s => !s.done);

      // hp bars & status
      const g = this.bars.clear();
      for (const e of this.enemies) {
        const w = Math.max(36, e.E.size * 0.8), x = e.spr.x - w / 2, y = e.spr.y - e.E.size * 0.62 - 10;
        if (e.hp < e.max || e.E.boss) {
          g.fillStyle(0x2a1b3d, 0.75).fillRoundedRect(x - 2, y - 2, w + 4, 10, 4);
          g.fillStyle(e.hp / e.max > 0.5 ? 0x5ccf6a : e.hp / e.max > 0.25 ? 0xffd93a : 0xff5a5a, 1).fillRoundedRect(x, y, w * Math.max(0, e.hp / e.max), 6, 3);
        }
        if (e.tagT > 0) { g.lineStyle(3, 0x6fe0b0, 0.9).strokeCircle(e.spr.x, e.spr.y, e.E.size * 0.55); }
        if (e.E.armor && e.tagT <= 0) { g.lineStyle(2, 0xd0d6e0, 0.6).strokeCircle(e.spr.x, e.spr.y, e.E.size * 0.6); }
      }
      if (this.rainbowT > 0) for (const t of this.towers) { g.lineStyle(4, Phaser.Display.Color.HSVToRGB((time / 1000 + t.x / 600) % 1, 0.6, 1).color, 0.8).strokeCircle(t.x, t.y + 4, 46); }
      if (this.sleepyT > 0) for (const t of this.towers) { if (Math.random() < 0.02) this.floatText(t.x + 24, t.y - 40, "z", "#d9d0ff", 22); }
    }
    waveCleared() {
      if (!this.L.endless && this.wave >= this.waveCount) return this.finish(true);
      this.state = "break"; this.breakT = 9;
      const bonus = 10 + this.wave * 2; this.energy += bonus;
      this.floatText(W / 2, H / 2, "Wave cleared! +" + bonus + " ⚡", "#c8ffd8", 36);
      if (this.L.endless) { const pr = progress(); if (this.wave > (pr.best || 0)) { pr.best = this.wave; store.set("bd-progress", pr); } }
      this.breakBtn = button(this, W / 2, H - 64, 330, 62, "▶ Next wave", 0x5ccf6a, () => this.nextWave(), 26).setDepth(60);
      store.set("bd-memory", this.mem);
      this.updateHUD();
    }
    finish(win) {
      if (this.ended) return; this.ended = true;
      store.set("bd-memory", this.mem);
      this.closePopup();
      const stars = win ? (this.livesLost === 0 ? 3 : this.livesLost <= 3 ? 2 : 1) : 0;
      const pr = progress();
      if (win && !this.L.endless) { pr.stars[this.levelIndex + 1] = Math.max(pr.stars[this.levelIndex + 1] || 0, stars); store.set("bd-progress", pr); }
      if (this.L.endless && this.wave - 1 > (pr.best || 0)) { pr.best = this.wave - 1; store.set("bd-progress", pr); }
      this.add.rectangle(W / 2, H / 2, W, H, 0x1d1030, 0.6).setDepth(80).setInteractive();
      const c = this.add.container(W / 2, H / 2).setDepth(81);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.25).fillRoundedRect(-330, -210 + 10, 660, 420, 36);
      g.fillStyle(0xfff8ec, 1).fillRoundedRect(-330, -210, 660, 420, 36);
      g.lineStyle(6, win ? 0x5ccf6a : 0xff8a5c, 1).strokeRoundedRect(-330, -210, 660, 420, 36);
      c.add(g);
      const hero = this.add.image(-230, -60, win ? "neo" : "max"); hero.setScale(140 / Math.max(hero.width, hero.height)); c.add(hero);
      this.tweens.add({ targets: hero, y: -75, yoyo: true, repeat: -1, duration: 500 });
      if (this.L.endless) {
        c.add(txt(this, 40, -150, "Germ Rush over!", 48, "#3b2f4a", { strokeThickness: 0 }));
        c.add(txt(this, 40, -80, "You survived " + (this.wave - 1) + " waves", 32, "#e0662f", { strokeThickness: 0 }));
        c.add(txt(this, 40, -30, "Best: " + progress().best + " waves", 26, "#6b5d7b", { strokeThickness: 0 }));
      } else if (win) {
        c.add(txt(this, 40, -150, "Germs defeated!", 50, "#3b2f4a", { strokeThickness: 0 }));
        const st = txt(this, 40, -78, "★".repeat(stars) + "☆".repeat(3 - stars), 70, "#ffc83a", { stroke: "#e0a21a", strokeThickness: 4 });
        c.add(st); st.setScale(0.2); this.tweens.add({ targets: st, scale: 1, duration: 500, ease: "Back.out" });
        c.add(txt(this, 40, -14, stars === 3 ? "Perfect! Your body didn't get a single germ!" : "Your body is safe! Lost " + this.livesLost + " ❤", 22, "#6b5d7b", { strokeThickness: 0 }));
        S.yay(); this.fxRain.explode(80, W / 2, H / 2 - 120);
      } else {
        c.add(txt(this, 40, -150, "Achoo! The germs got in.", 42, "#3b2f4a", { strokeThickness: 0 }));
        c.add(txt(this, 40, -88, "That's OK. Rest, drink water, and try again!", 24, "#6b5d7b", { strokeThickness: 0 }));
        c.add(txt(this, 40, -40, "Tip: tap healthy food for more ⚡ and upgrade your defenders.", 20, "#6b5d7b", { strokeThickness: 0, wordWrap: { width: 470 } }));
        S.oops();
      }
      const fact = Phaser.Utils.Array.GetRandom([
        "Real fact: Fruits and vegetables give your immune cells vitamins they need to work well.",
        "Real fact: Neutrophils are the most common white blood cells. They rush in first!",
        "Real fact: Macrophage means 'big eater'. They gobble up germs.",
        "Real fact: B cells make antibodies that stick to germs.",
        "Real fact: Memory cells remember germs, so your body fights them faster next time.",
        "Real fact: Washing hands with soap washes germs away.",
      ]);
      c.add(txt(this, 0, 60, fact, 19, "#3b2f4a", { strokeThickness: 0, wordWrap: { width: 600 } }));
      const next = !this.L.endless && win && this.levelIndex < LEVELS.length - 1;
      const btns = [["Levels", 0x8a7aa8, () => this.scene.start("menu")], ["Retry", 0xff8a5c, () => this.scene.start("game", { level: this.levelIndex })]];
      if (next) btns.push(["Next ▶", 0x5ccf6a, () => this.scene.start("game", { level: this.levelIndex + 1 })]);
      btns.forEach((b, i) => c.add(button(this, (i - (btns.length - 1) / 2) * 200, 150, 180, 62, b[0], b[1], b[2], 26)));
      c.setScale(0.6).setAlpha(0); this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 320, ease: "Back.out" });
      if (win && this.levelIndex === LEVELS.length - 1) this.time.delayedCall(800, () => this.showTip("🏆 You beat the Mega Virus! Germ Rush mode is waiting for you.", 5000));
    }
  }

  /* ============================================================ start */
  function start() {
    const fontReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 32px "Baloo 2"'), document.fonts.load('600 20px "Baloo 2"')]).catch(() => {}) : Promise.resolve();
    Promise.race([fontReady, new Promise(r => setTimeout(r, 2500))]).then(() => {
      window.__bdGame = new Phaser.Game({
        type: Phaser.AUTO, parent: "game", backgroundColor: "#2a1b3d",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
        input: { activePointers: 2 },
        // ?timer=1 drives the loop with setTimeout (useful when the tab is hidden, e.g. automated tests)
        fps: /[?&]timer=1/.test(location.search) ? { forceSetTimeOut: true, target: 60 } : undefined,
        scene: [Boot, Menu, Game],
      });
    });
  }
  window.BodyDefenders = { start, TOWERS, ENEMIES, FOODS, LEVELS };
})();
