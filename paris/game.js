/* Cathedral Builders! — build Notre-Dame with Lea and Gus the gargoyle (Phaser 3).
   Rules and shapes live in sim.js. Three jobs, three real ideas:
   STACK the stone walls with a swinging crane, hold the walls up with FLYING BUTTRESSES at the
   push points (the heavy vault pushes walls outward), and put GARGOYLES on the gutters so the
   rain shoots away from the walls. Nothing gets hurt: a missed stone just slides off ("Bonk!"),
   a wall without help only wobbles, and the pigeon just flutters away from the rain. */
(function () {
  "use strict";
  const C = window.CathSim, LEVELS = C.LEVELS;
  const W = C.W, H = C.H, GROUND = C.GROUND, CX = C.CX, BW = C.BW, BH = C.BH;
  const FONT = '"Baloo 2", "Trebuchet MS", sans-serif';
  const S = (window.Book && Book.sfx) || new Proxy({}, { get: () => () => {} });
  const SPEED = parseFloat((location.search.match(/[?&]speed=([\d.]+)/) || [])[1]) || 1;   // test runs only
  const BOT = /[?&]bot=1/.test(location.search);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ------------------------------------------------------------ save */
  const BLANK = () => ({ stars: {}, best: 0 });
  const save = {
    get() { try { return Object.assign(BLANK(), JSON.parse(localStorage.getItem("cb-save")) || {}); } catch (e) { return BLANK(); } },
    set(v) { try { localStorage.setItem("cb-save", JSON.stringify(v)); } catch (e) {} },
  };
  const FACTS = [
    "Flying buttresses hold the walls from outside, so the walls can be thinner, with room for big windows. That's why Notre-Dame is full of colored light!",
    "\"Gargoyle\" comes from an old French word for throat. Gargle, gurgle, gargoyle!",
    "Notre-Dame took almost 200 years to build. Many builders never saw it finished, but they built it anyway.",
    "Medieval builders lifted stones with treadwheel cranes: people walked inside a big wooden wheel to wind up the rope.",
    "A rose window is made of hundreds of pieces of colored glass, held together with strips of lead.",
    "After the 2019 fire, carpenters shaped the new oak roof beams by hand with axes, like builders 800 years ago.",
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
    c.on("pointerdown", (p, lx, ly, ev) => { ev && ev.stopPropagation(); draw(true); t.y = 3; c.pressed = true; });
    c.on("pointerup", (p, lx, ly, ev) => { ev && ev.stopPropagation(); draw(false); t.y = -2; if (c.pressed) { c.pressed = false; S.tap(); onClick(); } });
    c.on("pointerout", () => { draw(false); t.y = -2; c.pressed = false; });
    c.label = t; return c;
  }
  function fit(img, size) { img.setScale(size / Math.max(img.width, img.height)); return img; }
  function panel(sc, x, y, w, h, color) {
    const g = sc.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x - w / 2, y - h / 2 + 10, w, h, 36);
    g.fillStyle(0xfff8ec, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    g.lineStyle(6, color || 0x3d6fd8, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    return g;
  }
  function backdrop(sc) {
    const im = sc.add.image(W / 2, H / 2, "bg_city");
    im.setScale(Math.max(W / im.width, H / im.height));
    return im;
  }
  // a stable "random" number per block, so stones keep their tint
  const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };
  const STONE = [0xeadcbf, 0xe3d2b0, 0xefe3c9, 0xddcba6];

  /* ============================================================ BOOT */
  const ART = ["lea", "gus", "garg", "pigeon", "window", "rooster", "cloud", "bg_city"];
  class Boot extends Phaser.Scene {
    constructor() { super("boot"); }
    preload() {
      txt(this, W / 2, H / 2 - 60, "Carving the stones...", 40);
      const bar = this.add.graphics();
      this.load.on("progress", v => bar.clear().fillStyle(0xffffff, .3).fillRoundedRect(440, H / 2, 400, 28, 14).fillStyle(0xffd23f, 1).fillRoundedRect(440, H / 2, 400 * v, 28, 14));
      ART.forEach(k => this.load.image(k, "img/" + k + ".webp"));
    }
    create() {
      const g = this.make.graphics({ add: false });
      for (let r = 12; r > 0; r--) { g.fillStyle(0xffffff, (1 - r / 12) * 0.6 + 0.2); g.fillCircle(12, 12, r); }
      g.generateTexture("dot", 24, 24); g.clear();
      g.fillStyle(0xbfe6ff, 0.9).fillRoundedRect(0, 0, 4, 22, 2);
      g.generateTexture("drop", 4, 22); g.clear();
      g.fillStyle(0x6fc3ff, 1).fillCircle(6, 6, 6); g.fillStyle(0xffffff, 0.8).fillCircle(4, 4, 2);
      g.generateTexture("blob", 12, 12); g.destroy();
      // stand-ins when an illustration is missing, so the game never breaks
      const fake = (k, w, h, draw) => { if (this.textures.exists(k)) return; const f = this.make.graphics({ add: false }); draw(f); f.generateTexture(k, w, h); f.destroy(); };
      fake("lea", 160, 240, f => { f.fillStyle(0x2c4fa3, 1).fillRoundedRect(40, 100, 80, 100, 30); f.fillStyle(0xffd9b8, 1).fillCircle(80, 70, 44); f.fillStyle(0xd6372e, 1).fillEllipse(80, 30, 100, 36); });
      fake("gus", 180, 180, f => { f.fillStyle(0xb9bcc4, 1).fillCircle(90, 100, 70); f.fillStyle(0xffffff, 1).fillCircle(66, 86, 16).fillCircle(114, 86, 16); f.fillStyle(0x2b2350, 1).fillCircle(66, 88, 8).fillCircle(114, 88, 8); });
      fake("garg", 200, 140, f => { f.fillStyle(0xa9adb6, 1).fillRoundedRect(10, 40, 150, 70, 30); f.fillCircle(160, 70, 38); f.fillStyle(0x2b2350, 1).fillEllipse(186, 84, 22, 14); });
      fake("pigeon", 120, 100, f => { f.fillStyle(0x9aa3b8, 1).fillEllipse(60, 60, 90, 60); f.fillCircle(96, 34, 22); f.fillStyle(0xff9a3d, 1).fillTriangle(114, 32, 128, 36, 114, 40); });
      fake("window", 260, 260, f => { f.fillStyle(0x3d4f9a, 1).fillCircle(130, 130, 126); for (let i = 0; i < 12; i++) { f.fillStyle([0xe4574f, 0xffd23f, 0x4f86f7, 0x5ccf6a][i % 4], 1); const a = i * Math.PI / 6; f.fillCircle(130 + 80 * Math.cos(a), 130 + 80 * Math.sin(a), 26); } f.fillStyle(0xffd23f, 1).fillCircle(130, 130, 34); });
      fake("rooster", 120, 140, f => { f.fillStyle(0xf2b632, 1).fillEllipse(60, 80, 80, 70); f.fillCircle(84, 40, 22); f.fillStyle(0xe4574f, 1).fillTriangle(80, 14, 96, 14, 88, 24); });
      fake("cloud", 300, 160, f => { f.fillStyle(0x7d869c, 1).fillCircle(90, 90, 60).fillCircle(160, 70, 70).fillCircle(220, 96, 56).fillRoundedRect(40, 90, 230, 60, 30); });
      if (!this.textures.exists("bg_city")) fake("bg_city", 640, 360, f => { f.fillGradientStyle(0x9fd0ff, 0x9fd0ff, 0xf3f8ff, 0xf3f8ff, 1).fillRect(0, 0, 640, 360);
        f.fillStyle(0xd9cfe6, 1); for (let i = 0; i < 16; i++) f.fillRect(i * 40, 250 - (i * 37 % 50), 36, 120); });
      this.scene.start("title");
    }
  }

  /* ============================================================ TITLE */
  class Title extends Phaser.Scene {
    constructor() { super("title"); }
    create() {
      backdrop(this);
      this.add.graphics().fillStyle(0xffffff, 0.35).fillRect(0, 0, W, H);
      const sv = save.get(), all = /[?&]unlock=1/.test(location.search);
      const logo = txt(this, W / 2, 66, "Cathedral Builders!", 78, "#ffffff", { strokeThickness: 12 });
      this.tweens.add({ targets: logo, y: 74, yoyo: true, repeat: -1, duration: 1300, ease: "Sine.inOut" });
      txt(this, W / 2, 128, "Stack the stones, hold up the roof, and keep the walls dry!", 27, "#fff1b8");
      const gus = fit(this.add.image(150, 200, "gus"), 170);
      this.tweens.add({ targets: gus, y: 186, yoyo: true, repeat: -1, duration: 600, ease: "Sine.inOut" });
      fit(this.add.image(1130, 200, "lea"), 190);
      LEVELS.forEach((L, i) => {
        const col = i % 4, row = Math.floor(i / 4), x = 205 + col * 290, y = 330 + row * 150;
        const open = all || i === 0 || (sv.stars[i] || 0) > 0, st = sv.stars[i + 1] || 0;
        const c = this.add.container(x, y), g = this.add.graphics();
        g.fillStyle(0x000000, 0.3).fillRoundedRect(-135, -58 + 8, 270, 118, 28);
        g.fillStyle(open ? [0x3d6fd8, 0xe4574f, 0xe9a21f, 0x8a5cd0][row * 2 + (col >> 1)] : 0x6e7488, 1).fillRoundedRect(-135, -58, 270, 118, 28);
        c.add(g);
        c.add(txt(this, 0, -30, open ? (i + 1) + ". " + L.name : "🔒 Level " + (i + 1), 25));
        c.add(txt(this, 0, 4, open ? "🧱" + L.n + "  " + (L.bt ? "🌉×" + L.bt * 2 + "  " : "") + "🐉×" + L.out + (L.spire ? "  🐓" : "") : "", 19, "#ffffff", { strokeThickness: 4 }));
        c.add(txt(this, 0, 36, open ? "★".repeat(st) + "☆".repeat(3 - st) : "", 28, st ? "#ffd93a" : "#ffffff"));
        if (open) {
          c.setSize(270, 118).setInteractive({ useHandCursor: true });
          c.on("pointerup", () => { S.pop(); this.scene.start("play", { level: i }); });
          c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.05, duration: 100 }));
          c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 100 }));
        }
      });
      const freeOpen = all || (sv.stars[1] || 0) > 0;
      button(this, W / 2, 650, 560, 76, freeOpen ? "∞ Free Build" + (sv.best ? "  (best: " + sv.best + " buildings)" : "") : "🔒 Free Build: finish level 1",
        freeOpen ? 0x6c5ce7 : 0x8a95a5, () => { if (freeOpen) this.scene.start("play", { level: -1, round: 0, built: 0 }); else S.oops(); }, 28);
    }
  }

  /* ============================================================ PLAY */
  class Play extends Phaser.Scene {
    constructor() { super("play"); }
    init(d) {
      this.li = d.level; this.round = d.round || 0; this.built = d.built || 0;
      // Phaser reuses this scene object for every level, so clear what the last level left behind
      this.ended = false; this.pushLabels = null; this.dryLbl = null; this.bub = null; this.dragging = null;
    }
    create() {
      const L = this.L = this.li < 0 ? Object.assign(C.endless(this.round), { endless: true }) : LEVELS[this.li];
      const sim = this.sim = new C.Sim(L), G = this.G = sim.G;
      this.bot = BOT ? new C.Bot(sim, 1) : null;
      backdrop(this);
      // ground: a cobbled square in front of the cathedral
      const gr = this.add.graphics();
      gr.fillStyle(0x9ccf7a, 1).fillRect(0, GROUND, W, H - GROUND);
      gr.fillStyle(0xcdbfa6, 1).fillRect(0, GROUND, W, 18);
      for (let x = 0; x < W; x += 36) gr.fillStyle(0xb9aa8e, 1).fillRect(x, GROUND + 2, 30, 6);
      this.gBack = this.add.graphics();                // back wall, vault, roof
      this.win = fit(this.add.image(CX, 0, "window"), G.span * 0.5).setVisible(false);
      this.gB = this.add.graphics();                   // walls, buttresses, spire, crane
      this.gFx = this.add.graphics();                  // arrows, outlets, ghost
      this.rooster = fit(this.add.image(CX, 0, "rooster"), 70).setVisible(false);
      this.pigeon = fit(this.add.image(CX + 60, G.ridge - 18, "pigeon"), 54).setVisible(false).setFlipX(true);
      this.gargs = G.outlets.map(o => fit(this.add.image(o.x + o.dir * 14, o.y + 4, "garg"), 74).setFlipX(o.dir < 0).setVisible(false));
      this.lea = fit(this.add.image(78, GROUND - 70, "lea"), 150);
      this.gus = fit(this.add.image(W - 80, GROUND - 46, "gus"), 104);
      this.tweens.add({ targets: this.gus, y: GROUND - 54, yoyo: true, repeat: -1, duration: 700, ease: "Sine.inOut" });
      this.drops = this.add.particles(0, 0, "drop", { lifespan: 900, speedY: { min: 700, max: 900 }, speedX: -60, quantity: 0, emitting: false });
      this.spray = this.add.particles(0, 0, "blob", { lifespan: 900, gravityY: 900, scale: { start: 0.9, end: 0.4 }, emitting: false });
      this.drip = this.add.particles(0, 0, "blob", { lifespan: 700, gravityY: 500, speedY: { min: 20, max: 60 }, scale: { start: 0.7, end: 0.3 }, alpha: { start: 0.9, end: 0.3 }, emitting: false });
      this.dust = this.add.particles(0, 0, "dot", { lifespan: 600, speed: { min: 40, max: 140 }, angle: { min: 200, max: 340 }, scale: { start: 0.9, end: 0.2 }, tint: 0xcbb894, alpha: { start: 0.8, end: 0 }, emitting: false });
      this.sparks = this.add.particles(0, 0, "dot", { lifespan: 700, speed: { min: 80, max: 260 }, scale: { start: 0.8, end: 0 }, tint: [0xffd23f, 0xffffff, 0x7fd8ff, 0xff8a8a], emitting: false });
      this.clouds = [];
      // UI
      this.title = txt(this, W / 2, 30, (L.endless ? "" : (this.li + 1) + ". ") + L.name, 34).setDepth(22);
      this.info = txt(this, W / 2, 72, "", 26, "#fff1b8").setDepth(22);
      this.meter = this.add.graphics().setDepth(20);
      button(this, W - 56, 40, 84, 60, "⌂", 0x3d6fd8, () => this.scene.start("title"), 32).setDepth(30);
      this.say(L.tip, 5000);
      // tray for buttresses and gargoyles
      this.tray = this.add.container(0, 0).setDepth(25);
      this.dragging = null;
      this.input.on("pointerdown", p => this.onDown(p));
      this.input.on("pointermove", p => this.onMove(p));
      this.input.on("pointerup", p => this.onUp(p));
      if (this.input.keyboard) {
        this.input.keyboard.addCapture("SPACE");   // otherwise Space also scrolls the page down
        this.input.keyboard.on("keydown-SPACE", () => { if (this.sim.drop()) S.tick(); });
      }
      this.wobble = [0, 0];
      this.phaseUi();
    }

    /* ---------------- talking */
    say(s, ms) {
      if (this.bub) this.bub.destroy();
      const c = this.bub = this.add.container(26, GROUND - 190).setDepth(28);
      const t = txt(this, 0, 0, s, 19, "#2b2350", { strokeThickness: 0, wordWrap: { width: 196 } }).setOrigin(0, 0.5);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.18).fillRoundedRect(-14, -t.height / 2 - 10 + 5, t.width + 28, t.height + 20, 18);
      g.fillStyle(0xffffff, 1).fillRoundedRect(-14, -t.height / 2 - 10, t.width + 28, t.height + 20, 18);
      g.fillTriangle(30, t.height / 2 + 6, 60, t.height / 2 + 6, 46, t.height / 2 + 30);
      c.add([g, t]); c.setScale(0.3); this.tweens.add({ targets: c, scale: 1, duration: 250, ease: "Back.out" });
      if (ms) this.time.delayedCall(ms, () => { if (this.bub === c) { c.destroy(); this.bub = null; } });
    }
    toast(s, col) {
      const t = txt(this, W / 2, 180, s, 40, col || "#ffffff").setDepth(40).setScale(0.3);
      this.tweens.add({ targets: t, scale: 1, duration: 250, ease: "Back.out" });
      this.tweens.add({ targets: t, alpha: 0, y: 150, delay: 1100, duration: 500, onComplete: () => t.destroy() });
    }

    /* ---------------- the tray: pieces to drag */
    phaseUi() {
      const sim = this.sim, ph = sim.phase;
      this.tray.removeAll(true);
      if (ph === "stack") this.info.setText("Tap to drop the stone right on the wall!");
      else if (ph === "spire") this.info.setText("Rebuild the spire! Drop the oak beams on the roof.");
      else if (ph === "buttress") {
        this.info.setText("The roof pushes the walls out! Drag a flying buttress to each red arrow.");
        this.fillTray("butt", sim.pushLeft());
      } else if (ph === "rain") {
        this.info.setText("A storm is coming! Put a gargoyle on every glowing gutter.");
        this.fillTray("garg", sim.garg.filter(g => !g).length);
        this.storm();
      }
    }
    fillTray(kind, n) {
      this.tray.removeAll(true);
      if (!n) return;
      const g = this.add.graphics(), w = Math.min(560, 90 + n * 84);
      g.fillStyle(0x000000, 0.25).fillRoundedRect(CX - w / 2, H - 82 + 6, w, 74, 30);
      g.fillStyle(0xfff8ec, 0.95).fillRoundedRect(CX - w / 2, H - 82, w, 74, 30);
      this.tray.add(g);
      for (let i = 0; i < n; i++) {
        const x = CX - (n - 1) * 42 + i * 84, y = H - 45;
        let it;
        if (kind === "garg") it = fit(this.add.image(x, y, "garg"), 70);
        else { it = this.add.graphics({ x, y }); this.drawFlyer(it, -30, -14, 30, 10, 0, true); }
        it.kind = kind; it.home = { x, y };
        this.tray.add(it);
      }
      const hand = txt(this, CX - (n - 1) * 42, H - 100, "👆 drag", 22, "#ffffff");
      this.tray.add(hand);
      this.tweens.add({ targets: hand, y: H - 108, yoyo: true, repeat: -1, duration: 500 });
    }
    trayAt(p) {
      let best = null, bd = 50 * 50;
      this.tray.list.forEach(o => { if (!o.kind) return; const d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2; if (d < bd) { bd = d; best = o; } });
      return best;
    }

    /* ---------------- input */
    onDown(p) {
      const sim = this.sim;
      if (sim.done || this.ended) return;
      if (sim.canDrop()) { if (p.y < H - 90 || sim.phase === "stack" || sim.phase === "spire") { if (sim.drop()) S.tick(); } return; }
      const it = this.trayAt(p);
      if (it) { this.dragging = it; it.setDepth(30); this.tweens.killTweensOf(it); return; }
      // tapping straight on a gutter also works (easier for little hands)
      if (sim.phase === "rain") { const i = sim.outletAt(p.x, p.y, 60); if (i >= 0) this.putGargoyle(i); }
      if (sim.phase === "buttress") this.dragging = { tap: true, x: p.x, y: p.y };
    }
    onMove(p) { const d = this.dragging; if (d && !d.tap) { d.x = p.x; d.y = p.y; } }
    onUp(p) {
      const d = this.dragging, sim = this.sim; this.dragging = null;
      if (!d) return;
      const back = () => { if (d.tap) return; this.tweens.add({ targets: d, x: d.home.x, y: d.home.y, duration: 250, ease: "Back.out" }); };
      if (sim.phase === "buttress") {
        const side = p.x < CX ? 0 : 1, wx = side ? G(this).wr : G(this).wl;
        if (Math.abs(p.x - wx) > 260 || p.y > GROUND - 8 || p.y < G(this).top - 30) { back(); return; }
        this.tryButtress(side, p.y);
        if (!d.tap && sim.phase === "buttress") this.fillTray("butt", sim.pushLeft());
      } else if (sim.phase === "rain" && d.kind === "garg") {
        const i = sim.outletAt(p.x, p.y, 90);
        if (i >= 0) { this.putGargoyle(i); } else back();
      } else back();
    }
    tryButtress(side, y) {
      const sim = this.sim, r = sim.placeButtress(side, y);
      if (!r.ok && r.hint) {
        S.oops(); this.wobble[side] = 1;
        if (r.hint === "higher") this.say("A bit higher! Put it right at the red PUSH arrow.", 2500);
        else if (r.hint === "lower") this.say("A bit lower! Put it right at the red PUSH arrow.", 2500);
      }
    }
    putGargoyle(i) {
      this.sim.placeGargoyle(i);
    }

    /* ---------------- events from the sim */
    handle(e) {
      const G = this.G;
      switch (e.type) {
        case "land":
          S.dig(); this.dust.emitParticleAt(e.x, e.y + BH / 2, 8);
          if (e.q > 0.85) { this.toast(e.spire ? "Perfect beam!" : "Perfect!", "#fff1b8"); this.sparks.emitParticleAt(e.x, e.y, 12); S.sparkle(); }
          break;
        case "bonk": S.oops(); this.toast("Bonk! Try again", "#ffd0d0"); break;
        case "miss": this.dust.emitParticleAt(e.x, GROUND, 10); break;
        case "walls": S.yay(); this.say(this.L.bt ? "Walls done! But uh-oh: the heavy roof pushes them outward. See the red arrows?" : "Walls done! Low walls can hold the roof by themselves.", 4500); break;
        case "buttress": {
          S.ding(); const x = e.side ? G.wr + BW / 2 : G.wl - BW / 2;
          this.sparks.emitParticleAt(x, e.y, 16); this.toast("Push back! 💪", "#c8ffd0");
          if (this.sim.phase === "buttress") this.fillTray("butt", this.sim.pushLeft());
          break;
        }
        case "standing": S.yay(); this.say("The walls stand straight! The buttresses push back as hard as the roof pushes out.", 4000); break;
        case "rooster": S.yay(); this.rooster.setVisible(true).setPosition(CX, this.spireTop() - 34).setScale(0.01);
          this.tweens.add({ targets: this.rooster, scale: 70 / Math.max(this.rooster.width, this.rooster.height), duration: 600, ease: "Back.out" });
          this.sparks.emitParticleAt(CX, this.spireTop() - 30, 30); this.toast("🐓 The golden rooster!", "#fff1b8"); break;
        case "gargoyle": {
          const o = G.outlets[e.i], gi = this.gargs[e.i];
          S.pop(); gi.setVisible(true).setScale(0.01);
          this.tweens.add({ targets: gi, scale: 74 / Math.max(gi.width, gi.height), duration: 300, ease: "Back.out" });
          this.sparks.emitParticleAt(o.x, o.y, 10);
          this.fillTray("garg", this.sim.garg.filter(g => !g).length);
          break;
        }
        case "rainStart": S.wind(); this.toast("🌧️ Here comes the rain!", "#d6ecff"); this.flyPigeon(); break;
        case "phase": this.phaseUi(); if (e.phase === "rain" || e.phase === "buttress") this.showPigeon(); break;
        case "done": this.end(e); break;
      }
    }
    showPigeon() {
      if (this.pigeon.visible) return;
      const P = this.pigeon; P.setVisible(true).setPosition(W + 60, 160);
      this.tweens.add({ targets: P, x: CX + 70, y: this.G.ridge + 14, duration: 1400, ease: "Sine.out" });
    }
    flyPigeon() {
      const P = this.pigeon; if (!P.visible) return;
      this.tweens.add({ targets: P, x: -80, y: 120, duration: 1600, ease: "Sine.in" });
      this.time.delayedCall(1700, () => this.say("The pigeon flew off to stay dry. It'll be back after the rain!", 3000));
    }
    storm() {
      if (this.clouds.length) return;
      // storm clouds gather on both sides, leaving the spire in view
      [[130, 110], [360, 150], [920, 150], [1150, 110]].forEach(([x, y], i) => {
        const c = fit(this.add.image(i < 2 ? -260 : W + 260, y, "cloud"), 280).setAlpha(0.95).setDepth(5);
        this.clouds.push(c);
        this.tweens.add({ targets: c, x, duration: this.L.prep * 900, ease: "Sine.out" });
      });
    }
    spireTop() { return this.G.ridge - this.sim.spire.length * C.BEAM_H; }

    /* ---------------- drawing */
    drawFlyer(g, ax, ay, bx, by, alpha, icon) {
      // a flying buttress: a straight sloping top and a curved underside, from the wall (a) to the pier (b)
      const P0 = { x: ax, y: ay + 16 }, P1 = { x: bx, y: ay + 16 }, P2 = { x: bx, y: by + (icon ? 18 : 46) };
      const pts = [{ x: ax, y: ay - 12 }, { x: bx, y: by - 12 }];
      for (let i = 0; i <= 14; i++) {
        const t = 1 - i / 14, u = 1 - t;     // underside from the pier back to the wall
        pts.push({ x: u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x, y: u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y });
      }
      g.fillStyle(0xe3d2b0, alpha || 1).fillPoints(pts, true);
      g.lineStyle(3, 0x8a7656, alpha || 1).strokePoints(pts, true);
    }
    drawWall(g, side, n, lean, wet) {
      const G = this.G, sim = this.sim, wx = side ? G.wr : G.wl, dir = side ? 1 : -1, list = sim.walls[side];
      for (let i = 0; i < n; i++) {
        const y = GROUND - (i + 1) * BH, shift = dir * lean * (i + 1) / Math.max(1, this.L.n);
        const x = wx + list[i] + shift - BW / 2;
        g.fillStyle(STONE[Math.floor(hash(side, i) * 4)], 1).fillRect(x, y, BW, BH);
        g.lineStyle(2, 0x9c8664, 1).strokeRect(x, y, BW, BH);
        if (wet > 0) g.fillStyle(0x5d6b84, Math.min(0.55, wet * (0.5 + 0.5 * (n - i) / n))).fillRect(x, y, BW, BH);
      }
    }
    draw() {
      const g = this.gB, gb = this.gBack, fx = this.gFx, sim = this.sim, G = this.G, L = this.L, t = this.time.now / 1000;
      g.clear(); gb.clear(); fx.clear();
      const nL = sim.walls[0].length, nR = sim.walls[1].length, built = sim.phase !== "stack";
      // back wall rises with the shorter wall
      const hb = Math.min(nL, nR) * BH;
      gb.fillStyle(0xd8c7a4, 1).fillRect(G.wl, GROUND - hb, G.wr - G.wl, hb);
      for (let y = GROUND - BH; y >= GROUND - hb; y -= BH) gb.lineStyle(1, 0xbfa985, 1).lineBetween(G.wl, y, G.wr, y);
      if (built) {
        const xl = G.wl - BW / 2 - 16, xr = G.wr + BW / 2 + 16;
        gb.fillStyle(0x6f7f99, 1).fillTriangle(xl, G.top + 2, CX, G.ridge, xr, G.top + 2);
        gb.lineStyle(4, 0x4e5b73, 1).strokeTriangle(xl, G.top + 2, CX, G.ridge, xr, G.top + 2);
        for (let k = 1; k < 6; k++) { const y = G.ridge + (G.top - G.ridge) * k / 6, hw = (xr - xl) / 2 * k / 6; gb.lineStyle(2, 0x5f6e87, 1).lineBetween(CX - hw, y, CX + hw, y); }
        // the vault: a pointed stone arch under the roof
        const a = G.wl + BW / 2, b = G.wr - BW / 2, sp = b - a, pts = [], inner = [];
        for (let i = 0; i <= 20; i++) { const th = Math.PI - i / 20 * (Math.PI / 3); pts.push({ x: b + sp * Math.cos(th), y: G.top - sp * Math.sin(th) * 0.3 }); }
        for (let i = 20; i >= 0; i--) { const th = i / 20 * (Math.PI / 3); pts.push({ x: a + sp * Math.cos(th), y: G.top - sp * Math.sin(th) * 0.3 }); }
        for (let i = 0; i < pts.length; i++) inner.push({ x: pts[i].x, y: pts[i].y + 26 });
        gb.fillStyle(0xd8c7a4, 1).fillPoints([{ x: a, y: G.top }].concat(pts, [{ x: b, y: G.top }]), true);
        gb.fillStyle(0xe8dcc0, 1).fillPoints(pts.concat(inner.slice().reverse()), true);
        gb.lineStyle(3, 0x9c8664, 1).strokePoints(pts, false).strokePoints(inner, false);
        if (!this.win.visible) { this.win.setVisible(true).setPosition(CX, (G.top + GROUND) / 2 - 20); }
      }
      // buttresses: piers and flyers
      const lean = [0, 0];
      for (let side = 0; side < 2; side++) {
        const dir = side ? 1 : -1, face = (side ? G.wr : G.wl) + dir * BW / 2;
        const missing = G.push.filter((_, i) => sim.butt[side][i] === undefined).length;
        const want = sim.phase === "buttress" && missing ? (missing / G.push.length) * 12 : 0;
        this.wobble[side] = Math.max(0, this.wobble[side] - 0.02);
        lean[side] = want * Math.min(1, sim.pt / 2) * (1 + 0.25 * Math.sin(t * 7)) + this.wobble[side] * 10 * Math.sin(t * 30);
        const placed = G.push.filter((_, i) => sim.butt[side][i] !== undefined);
        if (placed.length) {
          const px = G.pierX[side];
          g.fillStyle(0xe3d2b0, 1).fillRect(px - 22, G.pierTop, 44, GROUND - G.pierTop);
          g.lineStyle(3, 0x8a7656, 1).strokeRect(px - 22, G.pierTop, 44, GROUND - G.pierTop);
          g.fillStyle(0xd8c7a4, 1).fillTriangle(px - 24, G.pierTop, px, G.pierTop - 50, px + 24, G.pierTop);
          g.lineStyle(3, 0x8a7656, 1).strokeTriangle(px - 24, G.pierTop, px, G.pierTop - 50, px + 24, G.pierTop);
          G.push.forEach((py, i) => { if (sim.butt[side][i] !== undefined) this.drawFlyer(g, face + dir * lean[side] * 0.4, py, px - dir * 22, Math.min(G.pierTop - 6, py + 50)); });
        }
        const wet = sim.phase === "rain" || sim.phase === "done" ? G.outlets.reduce((s, o, i) => s + (o.wall === side ? sim.wetBy[i] : 0), 0) / (L.rain * 1.2) : 0;
        this.drawWall(g, side, sim.walls[side].length, lean[side], wet);
      }
      // spire
      if (sim.spire.length || sim.phase === "spire") {
        sim.spire.forEach((dx, i) => {
          const y = G.ridge - (i + 1) * C.BEAM_H, w = C.BEAM_W - i * 3;
          g.fillStyle(0x9a6a3c, 1).fillRect(CX + dx - w / 2, y, w, C.BEAM_H);
          g.lineStyle(2, 0x5e3f22, 1).strokeRect(CX + dx - w / 2, y, w, C.BEAM_H);
          g.lineStyle(2, 0x5e3f22, 1).lineBetween(CX + dx - w / 2, y + C.BEAM_H, CX + dx + w / 2, y);
        });
        if (this.rooster.visible) this.rooster.y = this.spireTop() - 34 + Math.sin(t * 2) * 2;
      }
      // red push arrows where the walls need help
      if (sim.phase === "buttress") {
        for (let side = 0; side < 2; side++) G.push.forEach((py, i) => {
          if (sim.butt[side][i] !== undefined) return;
          const dir = side ? 1 : -1, x0 = (side ? G.wr : G.wl) + dir * (BW / 2 + 8 + lean[side]), len = 46 + 8 * Math.sin(t * 6);
          fx.fillStyle(0xe4574f, 1).fillRect(Math.min(x0, x0 + dir * len), py - 8, len, 16);
          fx.fillTriangle(x0 + dir * len, py - 20, x0 + dir * (len + 26), py, x0 + dir * len, py + 20);
          // ghost buttress where it should go
          fx.lineStyle(3, 0xffffff, 0.5 + 0.3 * Math.sin(t * 5)).strokeRect(G.pierX[side] - 22, G.pierTop, 44, GROUND - G.pierTop);
        });
        if (!this.pushLabels) {
          this.pushLabels = [];
          for (let side = 0; side < 2; side++) G.push.forEach((py, i) => this.pushLabels.push({ side, i, t: txt(this, (side ? G.wr : G.wl) + (side ? 1 : -1) * 120, py - 30, "PUSH", 22, "#ffd0d0").setDepth(15) }));
        }
        this.pushLabels.forEach(p => p.t.setVisible(sim.butt[p.side][p.i] === undefined));
        // a buttress being dragged: show where it would go
        const d = this.dragging;
        if (d && !d.tap) {
          const side = d.x < CX ? 0 : 1, dir = side ? 1 : -1, face = (side ? G.wr : G.wl) + dir * BW / 2;
          const y = clamp(d.y, G.top, GROUND - 60);
          this.drawFlyer(fx, face, y, G.pierX[side] - dir * 22, Math.min(G.pierTop - 6, y + 50), 0.55);
          d.setVisible(false);
        } else this.tray.list.forEach(o => o.kind && o.setVisible(true));
      } else if (this.pushLabels) { this.pushLabels.forEach(p => p.t.destroy()); this.pushLabels = null; }
      // gutters waiting for a gargoyle
      if (sim.phase === "rain") G.outlets.forEach((o, i) => {
        if (sim.garg[i]) return;
        const r = 16 + 5 * Math.sin(t * 6 + i);
        fx.fillStyle(0x2b2350, 1).fillCircle(o.x, o.y, 8);
        fx.lineStyle(4, 0xfff27a, 0.9).strokeCircle(o.x, o.y, r);
      });
      // crane and the hanging stone
      if (sim.phase === "stack" || sim.phase === "spire") {
        const T = sim.target(), hx = sim.hookX(), hy = sim.hookY();
        g.fillStyle(0x8a5a2b, 1).fillRect(0, 22, W, 14);
        g.lineStyle(3, 0x5e3f22, 1).lineBetween(hx, 36, hx, hy);
        g.fillStyle(0x5e3f22, 1).fillRect(hx - 12, 30, 24, 12);
        // where to drop: a glowing yellow box on top of the wall, with a bouncing arrow
        const pulse = 0.5 + 0.5 * Math.sin(t * 6), over = Math.abs(hx - T.x) < (T.spire ? C.BEAM_W * 0.4 : BW * 0.35);
        fx.fillStyle(over ? 0x5ccf6a : 0xffd23f, 0.3 + 0.2 * pulse).fillRect(T.x - T.w / 2, T.y - T.h, T.w, T.h);
        fx.lineStyle(5, over ? 0x2f9e44 : 0xffb020, 1).strokeRect(T.x - T.w / 2, T.y - T.h, T.w, T.h);
        const ay = T.y - T.h - 16 - 8 * pulse;
        fx.fillStyle(0xffb020, 1).fillTriangle(T.x - 16, ay - 18, T.x + 16, ay - 18, T.x, ay);
        fx.fillRect(T.x - 6, ay - 38, 12, 22);
        const f = sim.falling;
        // a dotted line straight down from the stone shows where it will land (green when it's right above the box)
        if (!f) for (let y = hy + 30; y < T.y - T.h - 4; y += 18) fx.fillStyle(over ? 0x5ccf6a : 0xffffff, over ? 0.95 : 0.6).fillRect(hx - 2, y, 4, 9);
        const bx = f ? f.x : hx, by = f ? f.y : hy + 4 + T.h / 2;
        if (T.spire) { g.fillStyle(0x9a6a3c, 1).fillRect(bx - T.w / 2, by - T.h / 2, T.w, T.h); g.lineStyle(2, 0x5e3f22, 1).strokeRect(bx - T.w / 2, by - T.h / 2, T.w, T.h); }
        else { g.fillStyle(0xeadcbf, 1).fillRect(bx - BW / 2, by - BH / 2, BW, BH); g.lineStyle(2, 0x9c8664, 1).strokeRect(bx - BW / 2, by - BH / 2, BW, BH); }
        if (!f) g.lineStyle(3, 0x5e3f22, 1).lineBetween(hx, hy, hx, hy + 4);
      }
      // rain meter
      this.meter.clear();
      if (sim.phase === "rain") {
        const dry = sim.dryness();
        this.meter.fillStyle(0x000000, 0.3).fillRoundedRect(W - 330, 96, 300, 34, 17);
        this.meter.fillStyle(dry > 0.7 ? 0x5ccf6a : dry > 0.4 ? 0xffc83a : 0xe4574f, 1).fillRoundedRect(W - 326, 100, 292 * dry, 26, 13);
        if (!this.dryLbl) this.dryLbl = txt(this, W - 180, 113, "Dry walls", 20).setDepth(21);
        const left = sim.rainOn ? "" : Math.ceil(L.prep - sim.pt);
        this.info.setText(sim.rainOn ? "Keep the walls dry! Rain goes out of the gargoyles' mouths." : "A storm is coming in " + left + "... put gargoyles on the glowing gutters!");
      }
    }
    rain(dt) {
      const sim = this.sim, G = this.G;
      if (!sim.rainOn) return;
      // raindrops across the sky
      for (let i = 0; i < 6; i++) this.drops.emitParticleAt(Math.random() * (W + 200), -20, 1);
      G.outlets.forEach((o, i) => {
        if (Math.random() > 0.5) return;
        if (sim.garg[i]) {
          // a gargoyle spits the water far away from the wall
          const p = this.spray.emitParticleAt(o.x + o.dir * 46, o.y + 8, 1);
          if (p) { p.velocityX = o.dir * (220 + Math.random() * 80); p.velocityY = -40 + Math.random() * 40; }
        } else {
          const p = this.drip.emitParticleAt(o.x - o.dir * 4, o.y + 6, 1);
          if (p) p.velocityX = -o.dir * 10;
        }
      });
    }
    update(time, delta) {
      const sim = this.sim;
      if (this.ended) { this.draw(); return; }
      let dt = Math.min(0.05, delta / 1000) * SPEED;
      const steps = Math.ceil(SPEED);
      for (let k = 0; k < steps; k++) {
        if (this.bot) this.bot.step(dt / steps);
        sim.step(dt / steps);
        while (sim.events.length) this.handle(sim.events.shift());
        if (this.ended) break;
      }
      // the drag ghost follows the pointer
      const d = this.dragging; if (d && !d.tap && sim.phase === "rain") { d.setVisible(true); }
      if (sim.phase === "stack") this.info.setText("Tap to drop the stone right on the wall!  🧱 " + (sim.walls[0].length + sim.walls[1].length) + " / " + this.L.n * 2);
      this.rain(dt);
      this.draw();
    }

    /* ---------------- finish */
    end(e) {
      this.ended = true; this.tray.removeAll(true);
      const L = this.L, sv = save.get();
      if (this.pigeon.visible) this.tweens.add({ targets: this.pigeon, x: CX + 70, y: this.G.ridge + 14, duration: 1600, ease: "Sine.out" });
      this.clouds.forEach(c => this.tweens.add({ targets: c, x: W + 400, duration: 2000, ease: "Sine.in" }));
      if (L.endless) { this.built++; sv.best = Math.max(sv.best || 0, this.built); }
      else sv.stars[this.li + 1] = Math.max(sv.stars[this.li + 1] || 0, e.stars);
      save.set(sv);
      this.time.delayedCall(1400, () => this.endPanel(e, sv));
    }
    endPanel(e, sv) {
      const L = this.L, sim = this.sim;
      const c = this.add.container(0, 0).setDepth(80);
      c.add(panel(this, W / 2, H / 2, 900, 600, 0x5ccf6a));
      c.add(fit(this.add.image(W / 2 - 170, 150, "gus"), 150));
      c.add(fit(this.add.image(W / 2 + 170, 150, "lea"), 170));
      c.add(fit(this.add.image(W / 2, 150, L.spire ? "rooster" : "window"), 120));
      c.add(txt(this, W / 2, 252, L.endless ? "Building " + this.built + " is done!" : "Your cathedral stands!", 46, "#2b2350", { strokeThickness: 0 }));
      const st = txt(this, W / 2, 314, "★".repeat(e.stars) + "☆".repeat(3 - e.stars), 66, "#ffc83a", { stroke: "#e0a21a", strokeThickness: 4 });
      st.setScale(0.2); this.tweens.add({ targets: st, scale: 1, duration: 500, ease: "Back.out" }); c.add(st);
      const pct = v => Math.round(v * 100) + "%";
      const parts = ["🧱 Neat stones " + pct(e.neat)];
      if (this.G.push.length) parts.push("🌉 Buttresses first try " + sim.buttFirst + "/" + this.G.push.length * 2);
      parts.push("💧 Dry walls " + pct(e.dry));
      c.add(txt(this, W / 2, 376, parts.join("     "), 23, "#5b4f73", { strokeThickness: 0 }));
      c.add(txt(this, W / 2, 452, Phaser.Utils.Array.GetRandom(FACTS), 24, "#3b2f4a", { strokeThickness: 0, wordWrap: { width: 800 } }));
      S.yay(); if (e.stars === 3 && window.Book && Book.confetti) Book.confetti(80);
      const btns = [["⌂ Levels", 0x3d6fd8, () => this.scene.start("title")]];
      if (L.endless) btns.push(["Build next ▶", 0x5ccf6a, () => this.scene.start("play", { level: -1, round: this.round + 1, built: this.built })]);
      else {
        btns.push(["↻ Again", 0xe9a21f, () => this.scene.start("play", { level: this.li })]);
        if (this.li < LEVELS.length - 1) btns.push(["Next ▶", 0x5ccf6a, () => this.scene.start("play", { level: this.li + 1 })]);
      }
      btns.forEach((b, i) => c.add(button(this, W / 2 + (i - (btns.length - 1) / 2) * 230, 572, 210, 74, b[0], b[1], b[2], 27)));
      if (!L.endless && this.li === LEVELS.length - 1) this.time.delayedCall(800, () => this.toast("🏆 Master builder! Notre-Dame is back!", "#fff1b8"));
    }
  }
  const G = sc => sc.G;

  function start() {
    const ready = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 32px "Baloo 2"')]).catch(() => {}) : Promise.resolve();
    Promise.race([ready, new Promise(r => setTimeout(r, 2500))]).then(() => {
      window.__cbGame = new Phaser.Game({
        type: Phaser.AUTO, parent: "game", backgroundColor: "#bcd9ff",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
        input: { activePointers: 3 },
        fps: /[?&]timer=1/.test(location.search) ? { forceSetTimeOut: true, target: 60 } : undefined,
        scene: [Boot, Title, Play],
      });
    });
  }
  window.CathedralBuilders = { start };
})();
