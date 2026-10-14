/* Space Clean-Up! — a gentle vertical shooter for the "Are We There Yet?" book (Phaser 3).
   Clean asteroids and space junk on the way to each planet. Living things (friendly aliens)
   can't be hurt: fly over to say hi instead. */
(function () {
  "use strict";
  const W = 720, H = 1280;
  const FONT = '"Baloo 2", "Trebuchet MS", sans-serif';
  const S = (window.Book && Book.sfx) || new Proxy({}, { get: () => () => {} });

  /* ------------------------------------------------------------ data */
  // Things you can clean. No faces, nothing alive.
  const OBJ = {
    sat:    { tex: "sat", big: 1, hp: 6, size: 96, dust: 4, drop: 0.25, spin: 0.6 },
    panel:  { tex: "panel", hp: 3, size: 74, dust: 2, drop: 0.08, spin: 1.2 },
    bolt:   { tex: "bolt", hp: 1, size: 50, dust: 1, drop: 0.03, spin: 3 },
    tank:   { tex: "tank", big: 1, hp: 6, size: 104, dust: 5, drop: 0.3, spin: 0.4 },
    glove:  { tex: "glove", hp: 2, size: 60, dust: 3, drop: 0.1, spin: 1.5, fact: "glove" },
    wrench: { tex: "wrench", hp: 1, size: 56, dust: 1, drop: 0.05, spin: 4 },
    camera: { tex: "camera", hp: 3, size: 62, dust: 2, drop: 0.1, spin: 1.5 },
    dish:   { tex: "dish", big: 1, hp: 4, size: 78, dust: 2, drop: 0.12, spin: 1 },
    cables: { tex: "cables", hp: 3, size: 64, dust: 2, drop: 0.08, spin: 1 },
    rockL:  { tex: "rock_big", big: 1, hp: 9, size: 132, dust: 3, drop: 0.15, spin: 0.3, split: "rockM" },
    rockM:  { tex: "rock_med", hp: 4, size: 86, dust: 2, drop: 0.08, spin: 0.6, split: "rockS" },
    rockS:  { tex: "rock_small", hp: 2, size: 52, dust: 1, drop: 0.03, spin: 1.2 },
    metal:  { tex: "rock_metal", big: 1, hp: 16, size: 112, dust: 6, drop: 0.35, spin: 0.3 },
    ice:    { tex: "ice", hp: 2, size: 58, dust: 1, drop: 0.04, spin: 1.6 },
  };
  const JUNK = ["sat", "panel", "bolt", "tank", "glove", "wrench", "camera", "dish", "cables"];
  const ITEMS = ["power", "shield", "buddy", "magnet"];
  const ITEM_INFO = {
    power:  "Laser power up!", shield: "Shield bubble!", buddy: "Bolt the robot dog joins you!", magnet: "Stardust magnet!",
  };

  const LEVELS = [
    { name: "Earth Orbit", to: "moon", bg: "bg_orbit", len: 60, speed: 1, mix: { junk: 1 }, rate: 0.9,
      tip: "Old satellites and lost tools are floating around Earth. Let's clean them up!" },
    { name: "Off to the Moon", to: "moon", bg: "bg_deep", len: 70, speed: 1.05, mix: { junk: 0.7, rockS: 0.3 }, rate: 0.75, ufo: 1,
      tip: "Friendly aliens! Your cleaner beam can't hurt living things. Fly over and say hi!" },
    { name: "Mars Run", to: "mars", bg: "bg_deep", len: 75, speed: 1.1, mix: { junk: 0.4, rockM: 0.35, rockS: 0.2, metal: 0.05 }, rate: 0.85, ufo: 1 },
    { name: "The Asteroid Belt", to: "jupiter", bg: "bg_deep", len: 75, speed: 1.15, mix: { rockL: 0.25, rockM: 0.35, metal: 0.1, junk: 0.3 }, rate: 0.95, boss: 1,
      tip: "Asteroid Belt! Big rocks break into smaller rocks. A giant junk ball is waiting at the end..." },
    { name: "Jupiter Storm", to: "jupiter", bg: "bg_deep", len: 80, speed: 1.2, mix: { junk: 0.4, rockM: 0.3, metal: 0.1, rockS: 0.2 }, rate: 0.8, comets: 1, ufo: 1,
      tip: "Comets are too big to clean! Watch for the red warning and dodge!" },
    { name: "Saturn's Rings", to: "saturn", bg: "bg_ice", len: 80, speed: 1.25, mix: { ice: 0.6, rockS: 0.2, junk: 0.2 }, rate: 0.5, ufo: 1,
      tip: "Saturn's rings are made of ice and rock. Lots of little ice chunks ahead!" },
    { name: "Icy Uranus", to: "uranus", bg: "bg_ice", len: 85, speed: 1.3, mix: { ice: 0.4, metal: 0.1, rockL: 0.15, junk: 0.35 }, rate: 0.75, comets: 1, ufo: 1 },
    { name: "Neptune Finale", to: "neptune", bg: "bg_deep", len: 85, speed: 1.35, mix: { rockL: 0.2, metal: 0.1, junk: 0.45, ice: 0.25 }, rate: 0.75, comets: 1, boss: 2, ufo: 1,
      tip: "Last stop: Neptune! The MEGA junk ball is coming. You can do it!" },
  ];
  const FACTS = {
    moon: ["You reached the Moon!", "Footprints on the Moon can stay for millions of years, because there's no wind or rain to wipe them away."],
    mars: ["You reached Mars!", "Mars has the biggest volcano in the solar system, Olympus Mons. It's about 2½ times taller than Mount Everest!"],
    jupiter: ["You reached Jupiter!", "Jupiter's Great Red Spot is a giant storm that is bigger than the whole Earth."],
    saturn: ["You reached Saturn!", "Saturn's rings are made of billions of pieces of ice and rock, from tiny grains to chunks as big as a house."],
    uranus: ["You reached Uranus!", "Uranus spins on its side, so it looks like it's rolling around the Sun."],
    neptune: ["You reached Neptune!", "Neptune has the fastest winds in the solar system: more than 2,000 km per hour!"],
  };
  const TIPS = [
    "Real fact: Space agencies track about 40,000 objects circling Earth, and there are over a million smaller pieces of junk.",
    "Real fact: In 1965, astronaut Ed White lost a glove on the first American spacewalk. It floated away into orbit!",
    "Real fact: In the real Asteroid Belt, asteroids are about a million km apart. Spaceships fly through without bumping into any!",
    "Real fact: Breaking junk in real space can make MORE junk, so scientists plan to catch old satellites with nets and robot arms.",
    "Real fact: Comets are balls of ice and dust. When they get close to the Sun, they grow long glowing tails.",
    "Real fact: Junk around Earth moves faster than a bullet, so even a tiny bolt can damage a spaceship.",
  ];
  const HANGAR = [
    { k: "laser", name: "Laser Power", desc: "Start each trip with a stronger laser", costs: [60, 140, 260], icon: "power" },
    { k: "hull", name: "Strong Hull", desc: "+1 heart for your rocket", costs: [90, 220], icon: "shield" },
    { k: "buddy", name: "Bolt Buddy", desc: "Bolt the robot dog flies with you from the start", costs: [180], icon: "buddy" },
    { k: "magnet", name: "Big Magnet", desc: "Grab stardust from farther away", costs: [50, 130], icon: "magnet" },
  ];

  /* ------------------------------------------------------------ save */
  const save = {
    get() { try { return Object.assign({ stars: {}, dust: 0, up: {}, friends: 0 }, JSON.parse(localStorage.getItem("sc-save")) || {}); } catch (e) { return { stars: {}, dust: 0, up: {}, friends: 0 }; } },
    set(v) { try { localStorage.setItem("sc-save", JSON.stringify(v)); } catch (e) {} },
  };

  /* ------------------------------------------------------------ helpers */
  function txt(sc, x, y, s, size, color, opts) {
    return sc.add.text(x, y, s, Object.assign({ fontFamily: FONT, fontSize: size + "px", fontStyle: "800", color: color || "#fff",
      stroke: "#1b1640", strokeThickness: Math.max(3, size / 6), align: "center" }, opts || {})).setOrigin(0.5);
  }
  function button(sc, x, y, w, h, label, fill, onClick, size) {
    const c = sc.add.container(x, y), g = sc.add.graphics();
    const draw = d => { g.clear(); g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, h / 2);
      g.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2 + (d ? 5 : 0), w, h, h / 2);
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(-w / 2 + 10, -h / 2 + 6 + (d ? 5 : 0), w - 20, h * 0.3, h * 0.15); };
    draw(false);
    const t = txt(sc, 0, -2, label, size || 32);
    c.add([g, t]); c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on("pointerdown", (p, a, b, ev) => { draw(true); t.y = 3; ev && ev.stopPropagation(); });
    c.on("pointerup", (p, a, b, ev) => { draw(false); t.y = -2; ev && ev.stopPropagation(); S.tap(); onClick(); });
    c.on("pointerout", () => { draw(false); t.y = -2; });
    c.label = t; return c;
  }
  function fit(img, size) { img.setScale(size / Math.max(img.width, img.height)); return img; }
  function panel(sc, x, y, w, h, color) {
    const g = sc.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x - w / 2, y - h / 2 + 10, w, h, 36);
    g.fillStyle(0xfff8ec, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    g.lineStyle(6, color || 0x6c8cff, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    return g;
  }

  /* ============================================================ BOOT */
  class Boot extends Phaser.Scene {
    constructor() { super("boot"); }
    preload() {
      txt(this, W / 2, H / 2 - 60, "Fueling the rocket...", 40);
      const bar = this.add.graphics();
      this.load.on("progress", v => bar.clear().fillStyle(0xffffff, .3).fillRoundedRect(160, H / 2, 400, 28, 14).fillStyle(0xffd166, 1).fillRoundedRect(160, H / 2, 400 * v, 28, 14));
      const im = k => this.load.image(k, "img/" + k + ".webp");
      ["rocket", "moon", "mars", "jupiter", "saturn", "uranus", "neptune", "earth", "p01",
       "sat", "panel", "bolt", "tank", "glove", "wrench", "camera", "dish", "cables",
       "rock_big", "rock_med", "rock_small", "rock_metal", "ice", "comet",
       "ufo", "buddy", "shield", "dust", "magnet", "power", "boss", "bg_orbit", "bg_deep", "bg_ice"].forEach(im);
    }
    create() {
      const g = this.make.graphics({ add: false });
      for (let r = 16; r > 0; r--) { g.fillStyle(0xffffff, (1 - r / 16) * 0.35 + 0.05); g.fillCircle(16, 16, r); }
      g.fillStyle(0xffffff, 1).fillCircle(16, 16, 6); g.generateTexture("dot", 32, 32); g.clear();
      // laser capsule
      g.fillStyle(0xffffff, 0.35).fillRoundedRect(0, 0, 18, 46, 9); g.fillStyle(0xffffff, 1).fillRoundedRect(4, 4, 10, 38, 5);
      g.generateTexture("beam", 18, 46); g.clear();
      // star shot
      g.fillStyle(0xffffff, 1); g.fillPoints([{ x: 14, y: 0 }, { x: 18, y: 10 }, { x: 28, y: 14 }, { x: 18, y: 18 }, { x: 14, y: 28 }, { x: 10, y: 18 }, { x: 0, y: 14 }, { x: 10, y: 10 }], true);
      g.generateTexture("star", 28, 28); g.clear();
      // twinkle star for background
      g.fillStyle(0xffffff, 1).fillCircle(3, 3, 3); g.generateTexture("twinkle", 6, 6); g.destroy();
      this.scene.start("title");
    }
  }

  /* ============================================================ background */
  function makeBackground(sc, key) {
    // painted backdrop stays put; three layers of stars stream past for the sense of speed
    const src = sc.textures.get(key).getSourceImage();
    const bg = sc.add.image(W / 2, H / 2, key).setScale(Math.max(W / src.width, H / src.height) * 1.04);
    const layers = [0.25, 0.55, 1].map((sp, i) => {
      const arr = [];
      for (let n = 0; n < 30 - i * 7; n++) {
        arr.push(sc.add.image(Math.random() * W, Math.random() * H, "twinkle").setAlpha(0.35 + i * 0.25).setScale(0.4 + i * 0.35));
      }
      return { sp, arr };
    });
    let t = 0;
    return {
      update(dt, speed) {
        t += dt; bg.y = H / 2 + Math.sin(t * 0.15) * 14;
        layers.forEach(L => L.arr.forEach(st => { st.y += 110 * L.sp * speed * dt; if (st.y > H + 6) { st.y = -6; st.x = Math.random() * W; } }));
      },
    };
  }

  /* ============================================================ TITLE */
  class Title extends Phaser.Scene {
    constructor() { super("title"); }
    create() {
      this.bgx = makeBackground(this, "bg_deep");
      const sv = save.get(), all = /[?&]unlock=1/.test(location.search);
      const logo = txt(this, W / 2, 120, "Space Clean-Up!", 78, "#ffffff", { strokeThickness: 12 });
      this.tweens.add({ targets: logo, y: 128, yoyo: true, repeat: -1, duration: 1300, ease: "Sine.inOut" });
      txt(this, W / 2, 196, "Clean the way to the planets with Nova!", 28, "#ffe08a");
      const ship = fit(this.add.image(W / 2, 330, "rocket"), 150).setAngle(-90);
      this.tweens.add({ targets: ship, y: 315, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" });
      txt(this, W - 120, 270, "✨ " + sv.dust, 30, "#ffe08a");
      LEVELS.forEach((L, i) => {
        const col = i % 2, row = Math.floor(i / 2), x = 190 + col * 340, y = 470 + row * 150;
        const open = all || i === 0 || (sv.stars[i] || 0) > 0, st = sv.stars[i + 1] || 0;
        const c = this.add.container(x, y);
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.3).fillRoundedRect(-150, -58 + 8, 300, 120, 30);
        g.fillStyle(open ? [0x6c8cff, 0x6c8cff, 0xff7a59, 0xa66cff, 0xf2a93b, 0x4fb8c9, 0x4fb8c9, 0x3b5bdb][i] : 0x5d5876, 1).fillRoundedRect(-150, -58, 300, 120, 30);
        c.add(g);
        const pl = fit(this.add.image(-100, 0, L.to), 78); if (!open) pl.setAlpha(0.35); c.add(pl);
        c.add(txt(this, 40, -26, open ? (i + 1) + ". " + L.name : "🔒 Level " + (i + 1), 25));
        c.add(txt(this, 40, 20, open ? "★".repeat(st) + "☆".repeat(3 - st) : "", 32, st ? "#ffd93a" : "#ffffff"));
        if (open) {
          c.setSize(300, 120).setInteractive({ useHandCursor: true });
          c.on("pointerup", () => { S.whoosh(); this.scene.start("play", { level: i }); });
          c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.05, duration: 100 }));
          c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 100 }));
        }
      });
      button(this, W / 2, 1110, 420, 86, "🛠  Rocket Hangar", 0x5ccf6a, () => this.scene.start("hangar"), 34);
      txt(this, W / 2, 1210, "Friends met: 👽 " + sv.friends, 26, "#c9f7ff");
    }
    update(t, d) { this.bgx.update(d / 1000, 1); }
  }

  /* ============================================================ HANGAR */
  class Hangar extends Phaser.Scene {
    constructor() { super("hangar"); }
    create() {
      this.bgx = makeBackground(this, "bg_orbit");
      this.draw();
    }
    draw() {
      if (this.box) this.box.destroy();
      const sv = save.get(), c = this.box = this.add.container(0, 0);
      c.add(panel(this, W / 2, 640, 640, 1060, 0x5ccf6a));
      c.add(txt(this, W / 2, 170, "🛠 Rocket Hangar", 50, "#1b1640", { strokeThickness: 0 }));
      c.add(txt(this, W / 2, 225, "Spend stardust on upgrades that last forever!", 24, "#5b5478", { strokeThickness: 0 }));
      c.add(txt(this, W / 2, 275, "✨ " + sv.dust + " stardust", 36, "#e0662f", { strokeThickness: 0 }));
      HANGAR.forEach((u, i) => {
        const y = 390 + i * 175, lvl = sv.up[u.k] || 0, max = lvl >= u.costs.length, cost = u.costs[lvl];
        const g = this.add.graphics(); g.fillStyle(0xffffff, 1).fillRoundedRect(60, y - 70, 600, 140, 26).lineStyle(3, 0xd9d2ea, 1).strokeRoundedRect(60, y - 70, 600, 140, 26);
        c.add(g);
        c.add(fit(this.add.image(125, y, u.icon), 84));
        c.add(txt(this, 300, y - 32, u.name + "  " + "●".repeat(lvl) + "○".repeat(u.costs.length - lvl), 28, "#1b1640", { strokeThickness: 0 }));
        c.add(txt(this, 300, y + 12, u.desc, 19, "#5b5478", { strokeThickness: 0, wordWrap: { width: 300 } }));
        c.add(button(this, 560, y, 160, 70, max ? "MAX" : "✨" + cost, max ? 0xa8a0b3 : (sv.dust >= cost ? 0xff7a59 : 0xa8a0b3), () => {
          if (max) return;
          const s2 = save.get(); if (s2.dust < cost) { S.oops(); return; }
          s2.dust -= cost; s2.up[u.k] = lvl + 1; save.set(s2); S.yay(); this.draw();
        }, 28));
      });
      c.add(button(this, W / 2, 1110, 320, 82, "◀ Back", 0x6c8cff, () => this.scene.start("title"), 32));
    }
    update(t, d) { this.bgx.update(d / 1000, 0.6); }
  }

  /* ============================================================ PLAY */
  class Play extends Phaser.Scene {
    constructor() { super("play"); }
    init(data) {
      this.li = data.level; this.L = LEVELS[data.level];
      const sv = this.sv = save.get(), up = sv.up;
      this.maxHearts = 5 + (up.hull || 0); this.hearts = this.maxHearts;
      this.power = 1 + (up.laser || 0); this.buddies = up.buddy ? 1 : 0; this.shields = 0;
      this.magnetR = 70 + 45 * (up.magnet || 0); this.magnetT = 0;
      this.burst = 0; this.dust = 0; this.hits = 0; this.friends = 0;
      this.t = 0; this.spawnT = 1.5; this.ufoT = 9; this.cometT = 12;
      this.objs = []; this.beams = []; this.drops = []; this.ufos = []; this.comets = []; this.bossShots = [];
      this.state = "fly"; this.paused = false; this.inv = 0; this.fireT = 0; this.buddyT = 0; this.popT = 0;
      this.firstUfo = true;
    }
    create() {
      this.bgx = makeBackground(this, this.L.bg);
      this.layer = this.add.layer();
      this.fx = this.add.particles(0, 0, "dot", { speed: { min: 60, max: 260 }, scale: { start: 0.7, end: 0 }, lifespan: 600, tint: [0xffe08a, 0xffffff, 0x9fd8ff, 0xffb3e6], emitting: false, blendMode: "ADD" }).setDepth(30);
      this.fxFire = this.add.particles(0, 0, "dot", { speed: { min: 40, max: 120 }, angle: { min: 70, max: 110 }, scale: { start: 0.7, end: 0 }, lifespan: 260, tint: [0xfff1a8, 0xffb04d, 0xff7a3a], blendMode: "ADD", frequency: 20 }).setDepth(9);
      // ship
      this.ship = fit(this.add.image(W / 2, H - 230, "rocket"), 120).setAngle(-90).setDepth(10);
      this.fxFire.startFollow(this.ship, 0, 58);
      this.shieldG = this.add.graphics().setDepth(11);
      this.buddySpr = [0, 1].map(() => fit(this.add.image(0, 0, "buddy"), 62).setDepth(10).setVisible(false));
      // input: drag anywhere
      this.input.on("pointerdown", p => { this.drag = { px: p.x, py: p.y, sx: this.ship.x, sy: this.ship.y }; });
      this.input.on("pointermove", p => { if (this.drag && p.isDown) { this.ship.x = Phaser.Math.Clamp(this.drag.sx + (p.x - this.drag.px) * 1.15, 40, W - 40); this.ship.y = Phaser.Math.Clamp(this.drag.sy + (p.y - this.drag.py) * 1.15, 260, H - 70); } });
      this.input.on("pointerup", () => { this.drag = null; });
      this.keys = this.input.keyboard.addKeys("LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE");
      this.makeHUD();
      if (this.L.tip) this.toast(this.L.tip, 4500);
      else this.toast("Drag anywhere to fly. Your laser fires by itself!", 3500);
      if (this.li === 0) this.toast("Drag anywhere to fly. Your laser fires by itself!", 4000, 520);
    }

    /* ---------- HUD */
    makeHUD() {
      const g = this.add.graphics().setDepth(50);
      g.fillStyle(0x1b1640, 0.7).fillRoundedRect(10, 10, W - 20, 96, 28);
      this.hHearts = txt(this, 100, 40, "", 30).setDepth(51);
      this.hDust = txt(this, 100, 78, "", 24, "#ffe08a").setDepth(51);
      this.hPow = txt(this, 280, 40, "", 24, "#9fd8ff").setDepth(51);
      this.hItems = txt(this, 280, 78, "", 22, "#c9f7ff").setDepth(51);
      // progress to destination
      this.progG = this.add.graphics().setDepth(51);
      this.progP = fit(this.add.image(610, 58, this.L.to), 54).setDepth(52);
      this.pauseBtn = button(this, 662, 150, 76, 60, "II", 0xff7a59, () => this.togglePause(), 28).setDepth(52);
      // star burst button
      this.burstBtn = this.add.container(W - 80, H - 90).setDepth(52);
      this.burstG = this.add.graphics();
      this.burstTxt = txt(this, 0, 0, "💥", 44);
      this.burstBtn.add([this.burstG, this.burstTxt]).setSize(120, 120).setInteractive({ useHandCursor: true });
      this.burstBtn.on("pointerdown", (p, a, b, ev) => { ev.stopPropagation(); this.starBurst(); });
      this.updateHUD();
    }
    updateHUD() {
      this.hHearts.setText("❤".repeat(this.hearts) + "♡".repeat(Math.max(0, this.maxHearts - this.hearts)));
      this.hDust.setText("✨ " + this.dust);
      this.hPow.setText("Laser " + "▮".repeat(this.power) + "▯".repeat(5 - this.power));
      const it = [];
      if (this.shields) it.push("🫧" + this.shields);
      if (this.buddies) it.push("🐶" + this.buddies);
      if (this.magnetT > 0) it.push("🧲" + Math.ceil(this.magnetT));
      this.hItems.setText(it.join("  "));
      const p = Math.min(1, this.t / this.L.len);
      this.progG.clear().fillStyle(0xffffff, 0.25).fillRoundedRect(400, 52, 180, 12, 6).fillStyle(0xffd166, 1).fillRoundedRect(400, 52, 180 * p, 12, 6);
      const full = this.burst >= 100;
      this.burstG.clear().fillStyle(0x000000, 0.3).fillCircle(0, 6, 56).fillStyle(full ? 0xff7a59 : 0x3d3766, 1).fillCircle(0, 0, 56);
      this.burstG.lineStyle(8, 0xffd166, 1).beginPath().arc(0, 0, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.burst / 100)).strokePath();
      this.burstTxt.setAlpha(full ? 1 : 0.45);
    }
    toast(s, ms, y) {
      const c = this.add.container(W / 2, y || 220).setDepth(60);
      const t = txt(this, 0, 0, s, 26, "#1b1640", { strokeThickness: 0, wordWrap: { width: 560 } });
      const g = this.add.graphics().fillStyle(0xfff8ec, 0.96).fillRoundedRect(-t.width / 2 - 22, -t.height / 2 - 12, t.width + 44, t.height + 24, 22)
        .lineStyle(4, 0x6c8cff, 1).strokeRoundedRect(-t.width / 2 - 22, -t.height / 2 - 12, t.width + 44, t.height + 24, 22);
      c.add([g, t]); c.setAlpha(0).setScale(0.7);
      this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 250, ease: "Back.out" });
      this.time.delayedCall(ms || 2500, () => this.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => c.destroy() }));
    }
    float(x, y, s, color, size) {
      const t = txt(this, x, y, s, size || 26, color || "#fff").setDepth(40);
      this.tweens.add({ targets: t, y: y - 60, alpha: { from: 1, to: 0 }, duration: 900, onComplete: () => t.destroy() });
    }
    togglePause() {
      if (this.state !== "fly" && this.state !== "boss") return;
      this.paused = !this.paused; this.pauseBtn.label.setText(this.paused ? "▶" : "II");
      this.paused ? (this.tweens.pauseAll(), this.fxFire.pause()) : (this.tweens.resumeAll(), this.fxFire.resume());
      if (this.paused) {
        this.pauseBox = this.add.container(0, 0).setDepth(70);
        this.pauseBox.add(this.add.rectangle(W / 2, H / 2, W, H, 0x0d0a26, 0.6).setInteractive());
        this.pauseBox.add(txt(this, W / 2, 480, "Paused", 80));
        this.pauseBox.add(button(this, W / 2, 640, 340, 84, "▶ Keep flying", 0x5ccf6a, () => this.togglePause(), 32));
        this.pauseBox.add(button(this, W / 2, 760, 340, 84, "⌂ Levels", 0x6c8cff, () => this.scene.start("title"), 32));
      } else if (this.pauseBox) { this.pauseBox.destroy(); this.pauseBox = null; }
    }

    /* ---------- spawning */
    pick() {
      const mix = this.L.mix, r = Math.random(); let acc = 0;
      for (const k in mix) { acc += mix[k]; if (r <= acc) return k === "junk" ? Phaser.Utils.Array.GetRandom(JUNK) : k; }
      return Phaser.Utils.Array.GetRandom(JUNK);
    }
    spawnObj(type, x, y, vx, vy) {
      const O = OBJ[type];
      const spr = fit(this.add.image(x == null ? 60 + Math.random() * (W - 120) : x, y == null ? -80 : y, O.tex), O.size).setDepth(5);
      this.layer.add(spr);
      const sp = this.L.speed;
      const o = { type, O, spr, hp: O.hp * (1 + this.li * 0.05), vx: vx != null ? vx : (Math.random() - 0.5) * 70, vy: vy != null ? vy : (90 + Math.random() * 70) * sp,
        spin: (Math.random() < 0.5 ? -1 : 1) * O.spin, base: spr.scale };
      this.objs.push(o); return o;
    }
    spawnUfo() {
      const left = Math.random() < 0.5, y = 300 + Math.random() * 500;
      const spr = fit(this.add.image(left ? -80 : W + 80, y, "ufo"), 110).setDepth(6);
      const u = { spr, vx: (left ? 1 : -1) * (120 + Math.random() * 40), t: 0, y0: y, met: false };
      this.ufos.push(u);
      if (this.firstUfo) { this.firstUfo = false; this.toast("👽 A friendly alien! Aliens are living things, so your beam passes right through. Fly over to say hi!", 4500, 300); }
    }
    spawnComet() {
      const x = 80 + Math.random() * (W - 160);
      const warn = this.add.rectangle(x, H / 2, 150, H, 0xff4d6d, 0.18).setDepth(4);
      const sign = txt(this, x, 200, "⚠", 70, "#ff8fa3").setDepth(41);
      this.tweens.add({ targets: [warn, sign], alpha: { from: 0.2, to: 1 }, yoyo: true, repeat: 3, duration: 220 });
      S.whoosh();
      this.time.delayedCall(1800, () => {
        warn.destroy(); sign.destroy();
        if (this.state === "done") return;
        const c = { spr: fit(this.add.image(x, -160, "comet"), 230).setAngle(-30).setDepth(7), vy: 900 };
        this.comets.push(c); this.cameras.main.shake(300, 0.004);
      });
    }

    /* ---------- weapons */
    fire() {
      const x = this.ship.x, y = this.ship.y - 60, P = this.power;
      const shot = (dx, ang, tint) => { const b = this.add.image(x + dx, y, "beam").setTint(tint || 0x7ff0ff).setBlendMode("ADD").setDepth(8).setAngle(ang || 0); this.beams.push({ b, vx: Math.sin(Phaser.Math.DegToRad(ang || 0)) * 1100, vy: -1100, dmg: 1.4 }); };
      if (P === 1) shot(0);
      else if (P === 2) { shot(-14); shot(14); }
      else if (P === 3) { shot(0); shot(-16, -10); shot(16, 10); }
      else if (P === 4) { shot(-10); shot(10); shot(-22, -12); shot(22, 12); }
      else { shot(0, 0, 0xffb3f0); shot(-14); shot(14); shot(-26, -16); shot(26, 16); }
    }
    buddyFire() {
      this.buddySpr.forEach((b, i) => {
        if (!b.visible) return;
        const t = this.objs.filter(o => o.spr.y > 120).sort((a, c) => Phaser.Math.Distance.Between(b.x, b.y, a.spr.x, a.spr.y) - Phaser.Math.Distance.Between(b.x, b.y, c.spr.x, c.spr.y))[0];
        const s = this.add.image(b.x, b.y - 20, "star").setTint(0xffd166).setDepth(8);
        let vx = 0, vy = -800;
        if (t) { const a = Math.atan2(t.spr.y - b.y, t.spr.x - b.x); vx = Math.cos(a) * 800; vy = Math.sin(a) * 800; }
        this.beams.push({ b: s, vx, vy, dmg: 1.5, spin: true });
      });
    }
    starBurst() {
      if (this.burst < 100 || this.paused || this.state === "done") { if (this.burst < 100) this.float(W - 80, H - 170, "Collect ✨ to charge!", "#ffe08a", 22); return; }
      this.burst = 0; S.boom(); S.sparkle();
      this.cameras.main.flash(400, 255, 240, 200);
      const ring = this.add.circle(this.ship.x, this.ship.y, 30, 0xffffff, 0).setStrokeStyle(16, 0xffd166, 1).setDepth(35);
      this.tweens.add({ targets: ring, scale: 30, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
      this.objs.slice().forEach(o => this.clean(o, true));
      if (this.boss) this.hitBoss(60);
      this.bossShots.forEach(s => s.spr.destroy()); this.bossShots = [];
      this.updateHUD();
    }

    /* ---------- events */
    clean(o, noSplit) {
      if (o.dead) return; o.dead = true;
      const { x, y } = o.spr;
      this.fx.explode(14, x, y);
      if (this.popT <= 0) { S.pop(); this.popT = 0.22; }
      this.tweens.add({ targets: o.spr, scale: o.spr.scale * 1.4, alpha: 0, duration: 180, onComplete: () => o.spr.destroy() });
      for (let i = 0; i < o.O.dust; i++) this.dropItem("dust", x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40);
      if (Math.random() < o.O.drop * 1.5) this.dropItem(Phaser.Utils.Array.GetRandom(ITEMS), x, y);
      if (o.O.split && !noSplit) [-1, 1].forEach(s => this.spawnObj(o.O.split, x + s * 20, y, s * (70 + Math.random() * 60), o.vy * 0.6));
      if (o.O.fact === "glove" && !this.gloveFact) { this.gloveFact = true; this.toast("🧤 Real fact: in 1965 astronaut Ed White lost a glove on a spacewalk!", 3500, 300); }
    }
    dropItem(k, x, y) {
      const spr = fit(this.add.image(x, y, k), k === "dust" ? 34 : 72).setDepth(12);
      if (k !== "dust") this.tweens.add({ targets: spr, scale: spr.scale * 1.15, yoyo: true, repeat: -1, duration: 400 });
      this.drops.push({ k, spr, vy: k === "dust" ? 140 : 120, vx: (Math.random() - 0.5) * 50 });
    }
    collect(d) {
      const { x, y } = d.spr; d.spr.destroy(); d.dead = true;
      if (d.k === "dust") { this.dust++; this.burst = Math.min(100, this.burst + 3.5); if (this.popT <= 0) { S.tick(); this.popT = 0.3; } return; }
      S.sparkle(); this.fx.explode(20, x, y);
      if (d.k === "power") { if (this.power < 5) this.power++; else { this.dust += 10; } }
      if (d.k === "shield") this.shields = Math.min(3, this.shields + 1);
      if (d.k === "buddy") { if (this.buddies < 2) this.buddies++; else this.dust += 10; }
      if (d.k === "magnet") this.magnetT = 10;
      this.float(x, y - 30, ITEM_INFO[d.k], "#c9f7ff", 24);
      this.updateHUD();
    }
    hurt() {
      if (this.inv > 0 || this.state === "done") return;
      if (this.shields > 0) { this.shields--; this.inv = 1; S.splash(); this.float(this.ship.x, this.ship.y - 70, "Shield saved you!", "#9fd8ff", 24); this.updateHUD(); return; }
      this.hearts--; this.hits++; this.inv = 2; S.oops();
      this.cameras.main.shake(250, 0.01);
      if (this.power > 1 + (this.sv.up.laser || 0)) this.power--;
      this.updateHUD();
      if (this.hearts <= 0) this.finish(false);
    }

    /* ---------- boss */
    startBoss() {
      this.state = "boss"; S.whoosh(); S.boom();
      const hp = this.L.boss === 2 ? 480 : 260;
      const spr = fit(this.add.image(W / 2, -200, "boss"), this.L.boss === 2 ? 330 : 270).setDepth(6);
      this.boss = { spr, hp, max: hp, t: 0, shotT: 2, base: spr.scale };
      this.tweens.add({ targets: spr, y: 300, duration: 2200, ease: "Sine.out" });
      this.toast(this.L.boss === 2 ? "⚠ The MEGA Junk Ball! A giant clump of old space junk!" : "⚠ A giant Junk Ball! Clean it up piece by piece!", 3500, 560);
      this.bossBar = this.add.graphics().setDepth(51);
      if (this.power < 3) this.time.delayedCall(1500, () => this.dropItem("power", W / 2, 380));
    }
    hitBoss(d) {
      const b = this.boss; if (!b || b.dead) return;
      b.hp -= d; b.spr.setTintFill(0xffffff); this.time.delayedCall(50, () => b.spr && b.spr.clearTint());
      if (Math.random() < 0.25) this.dropItem("dust", b.spr.x + (Math.random() - 0.5) * 200, b.spr.y + 60);
      if (b.hp <= 0) {
        b.dead = true; S.boom(); S.yay(); this.cameras.main.shake(800, 0.015);
        for (let i = 0; i < 6; i++) this.time.delayedCall(i * 120, () => this.fx.explode(40, b.spr.x + (Math.random() - 0.5) * 200, b.spr.y + (Math.random() - 0.5) * 200));
        for (let i = 0; i < 30; i++) this.dropItem("dust", b.spr.x + (Math.random() - 0.5) * 220, b.spr.y + (Math.random() - 0.5) * 160);
        this.dropItem("power", b.spr.x, b.spr.y);
        this.tweens.add({ targets: b.spr, scale: b.base * 1.4, alpha: 0, angle: 120, duration: 900, onComplete: () => b.spr.destroy() });
        this.bossBar.destroy();
        this.time.delayedCall(1800, () => this.arrive());
      }
    }

    /* ---------- loop */
    update(time, delta) {
      if (this.paused) return;
      const dt = Math.min(0.05, delta / 1000);
      this.bgx.update(dt, this.state === "arrive" ? 0.3 : this.L.speed);
      if (this.state === "done") return;
      this.popT -= dt; this.inv = Math.max(0, this.inv - dt);
      if (this.magnetT > 0) { this.magnetT -= dt; if (this.magnetT <= 0) this.updateHUD(); }

      // keyboard
      const k = this.keys, v = 620 * dt;
      if (k.LEFT.isDown || k.A.isDown) this.ship.x -= v;
      if (k.RIGHT.isDown || k.D.isDown) this.ship.x += v;
      if (k.UP.isDown || k.W.isDown) this.ship.y -= v;
      if (k.DOWN.isDown || k.S.isDown) this.ship.y += v;
      if (Phaser.Input.Keyboard.JustDown(k.SPACE)) this.starBurst();
      this.ship.x = Phaser.Math.Clamp(this.ship.x, 40, W - 40); this.ship.y = Phaser.Math.Clamp(this.ship.y, 260, H - 70);
      this.ship.setAlpha(this.inv > 0 ? (Math.floor(time / 90) % 2 ? 0.35 : 1) : 1);
      this.ship.setAngle(-90 + Phaser.Math.Clamp((this.ship.x - (this.lastX || this.ship.x)) * 1.5, -12, 12)); this.lastX = this.ship.x;
      // shield + buddies
      this.shieldG.clear(); if (this.shields) this.shieldG.lineStyle(5, 0x9fd8ff, 0.8).strokeCircle(this.ship.x, this.ship.y, 74).fillStyle(0x9fd8ff, 0.12).fillCircle(this.ship.x, this.ship.y, 74);
      this.buddySpr.forEach((b, i) => { b.setVisible(i < this.buddies); const s = i ? 1 : -1; b.x += ((this.ship.x + s * 95) - b.x) * 0.15; b.y += ((this.ship.y + 30 + Math.sin(time / 300 + i) * 8) - b.y) * 0.15; });

      if (this.state === "fly" || this.state === "boss") {
        this.fireT -= dt; if (this.fireT <= 0) { this.fire(); this.fireT = this.power >= 5 ? 0.16 : 0.21; }
        this.buddyT -= dt; if (this.buddies && this.buddyT <= 0) { this.buddyFire(); this.buddyT = 0.55; }
      }
      // level flow
      if (this.state === "fly") {
        this.t += dt;
        this.spawnT -= dt;
        if (this.spawnT <= 0 && this.t < this.L.len - 3) { this.spawnObj(this.pick()); this.spawnT = this.L.rate * (0.6 + Math.random() * 0.8) * Math.max(0.65, 1 - this.t / this.L.len * 0.3); }
        if (this.L.ufo) { this.ufoT -= dt; if (this.ufoT <= 0) { this.spawnUfo(); this.ufoT = 14 + Math.random() * 8; } }
        if (this.L.comets) { this.cometT -= dt; if (this.cometT <= 0) { this.spawnComet(); this.cometT = 9 + Math.random() * 6; } }
        if ((this.hudT = (this.hudT || 0) + dt) > 0.3) { this.hudT = 0; this.updateHUD(); }
        if (this.t >= this.L.len && !this.objs.length) this.L.boss ? this.startBoss() : this.arrive();
      }
      if (this.state === "boss" && this.boss && !this.boss.dead) {
        const b = this.boss; b.t += dt;
        if (b.spr.y >= 290) b.spr.x = W / 2 + Math.sin(b.t * 0.7) * 200;
        b.spr.rotation = Math.sin(b.t * 0.5) * 0.15;
        b.shotT -= dt;
        if (b.shotT <= 0 && b.spr.y >= 290) {
          b.shotT = this.L.boss === 2 ? 1.5 : 2;
          const n = this.L.boss === 2 ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const a = Phaser.Math.DegToRad(90 + (i - (n - 1) / 2) * 18), kk = Phaser.Utils.Array.GetRandom(["bolt", "wrench", "panel", "rockM"]);
            this.spawnObj(kk, b.spr.x, b.spr.y + 100, Math.cos(a) * 230, Math.sin(a) * 230);
          }
        }
        this.bossBar.clear().fillStyle(0x1b1640, 0.7).fillRoundedRect(110, 190, 500, 22, 11).fillStyle(0xff7a59, 1).fillRoundedRect(114, 194, 492 * Math.max(0, b.hp / b.max), 14, 7);
      }

      // beams
      for (const bm of this.beams) {
        bm.b.x += bm.vx * dt; bm.b.y += bm.vy * dt; if (bm.spin) bm.b.rotation += dt * 10;
        if (bm.b.y < -60 || bm.b.x < -40 || bm.b.x > W + 40 || bm.b.y > H + 40) { bm.dead = true; bm.b.destroy(); continue; }
        for (const o of this.objs) {
          if (o.dead) continue;
          const r = o.O.size * 0.42;
          if (Math.abs(o.spr.x - bm.b.x) < r && Math.abs(o.spr.y - bm.b.y) < r) {
            o.hp -= bm.dmg; bm.dead = true; bm.b.destroy();
            o.spr.setTintFill(0xffffff); this.time.delayedCall(40, () => o.spr.active && o.spr.clearTint());
            if (o.hp <= 0) this.clean(o);
            break;
          }
        }
        if (!bm.dead && this.boss && !this.boss.dead && Phaser.Math.Distance.Between(bm.b.x, bm.b.y, this.boss.spr.x, this.boss.spr.y) < this.boss.spr.displayWidth * 0.4) {
          bm.dead = true; bm.b.destroy(); this.hitBoss(bm.dmg); this.fx.explode(3, bm.b.x, bm.b.y);
        }
        // friendly aliens: beams pass through and sparkle
        if (!bm.dead) for (const u of this.ufos) if (Math.abs(u.spr.x - bm.b.x) < 45 && Math.abs(u.spr.y - bm.b.y) < 35 && Math.random() < 0.3) this.fx.explode(1, bm.b.x, bm.b.y);
      }
      this.beams = this.beams.filter(b => !b.dead);

      // objects
      const sx = this.ship.x, sy = this.ship.y;
      for (const o of this.objs) {
        if (o.dead) continue;
        o.spr.x += o.vx * dt; o.spr.y += o.vy * dt; o.spr.rotation += o.spin * dt;
        if (o.spr.x < 30 || o.spr.x > W - 30) o.vx *= -1;
        if (o.spr.y > H + 100) { o.dead = true; o.spr.destroy(); continue; }
        if (Phaser.Math.Distance.Between(sx, sy, o.spr.x, o.spr.y) < o.O.size * 0.32 + 20) {
          this.clean(o, true);
          if (o.O.big) this.hurt(); else this.float(o.spr.x, o.spr.y - 30, "Bonk!", "#c9f7ff", 22);
        }
      }
      this.objs = this.objs.filter(o => !o.dead);
      // comets (dodge only)
      for (const c of this.comets) {
        c.spr.y += c.vy * dt; if (Math.random() < 0.5) this.fx.explode(2, c.spr.x, c.spr.y - 60);
        if (Math.abs(c.spr.x - sx) < 70 && Math.abs(c.spr.y + 40 - sy) < 90) this.hurt();
        if (c.spr.y > H + 260) { c.dead = true; c.spr.destroy(); }
      }
      this.comets = this.comets.filter(c => !c.dead);
      // ufos
      for (const u of this.ufos) {
        u.t += dt; u.spr.x += u.vx * dt; u.spr.y = u.y0 + Math.sin(u.t * 2) * 30;
        if (!u.met && Phaser.Math.Distance.Between(sx, sy, u.spr.x, u.spr.y) < 90) {
          u.met = true; this.friends++; this.dust += 20; S.chirp(); S.yay();
          this.float(u.spr.x, u.spr.y - 60, "👋 Hi, friend! +20 ✨", "#c9f7ff", 28);
          this.tweens.add({ targets: u.spr, angle: { from: -15, to: 15 }, yoyo: true, repeat: 3, duration: 120 });
        }
        if (u.spr.x < -150 || u.spr.x > W + 150) { u.dead = true; u.spr.destroy(); }
      }
      this.ufos = this.ufos.filter(u => !u.dead);
      // drops
      const pull = this.magnetT > 0 ? 420 : this.magnetR;
      for (const d of this.drops) {
        const dist = Phaser.Math.Distance.Between(sx, sy, d.spr.x, d.spr.y);
        if (dist < pull) { const a = Math.atan2(sy - d.spr.y, sx - d.spr.x), sp = d.k === "dust" ? 700 : 380; d.spr.x += Math.cos(a) * sp * dt; d.spr.y += Math.sin(a) * sp * dt; }
        else { d.spr.y += d.vy * dt; d.spr.x += d.vx * dt; }
        if (dist < 50) this.collect(d);
        else if (d.spr.y > H + 60) { d.dead = true; d.spr.destroy(); }
      }
      this.drops = this.drops.filter(d => !d.dead);
    }

    /* ---------- end */
    arrive() {
      if (this.state === "arrive" || this.state === "done") return;
      this.state = "arrive";
      const pl = fit(this.add.image(W / 2, -260, this.L.to), 420).setDepth(3);
      this.tweens.add({ targets: pl, y: 330, duration: 2600, ease: "Sine.out" });
      this.tweens.add({ targets: this.ship, x: W / 2, y: 820, duration: 1600, ease: "Sine.inOut" });
      this.drops.forEach(d => { d.spr.destroy(); this.dust++; }); this.drops = [];
      this.time.delayedCall(2700, () => this.finish(true));
    }
    finish(win) {
      if (this.state === "done") return;
      this.state = "done"; this.fxFire.stop();
      const sv = save.get();
      const keep = win ? this.dust : Math.floor(this.dust / 2);
      sv.dust += keep; sv.friends += this.friends;
      const stars = win ? (this.hits === 0 ? 3 : this.hits <= 2 ? 2 : 1) : 0;
      if (win) sv.stars[this.li + 1] = Math.max(sv.stars[this.li + 1] || 0, stars);
      save.set(sv);
      this.add.rectangle(W / 2, H / 2, W, H, 0x0d0a26, 0.55).setDepth(80).setInteractive();
      const c = this.add.container(0, 0).setDepth(81);
      c.add(panel(this, W / 2, 700, 620, 820, win ? 0x5ccf6a : 0xff7a59));
      if (win) {
        const [title, fact] = FACTS[this.L.to];
        c.add(fit(this.add.image(W / 2, 420, this.L.to), 170));
        c.add(txt(this, W / 2, 540, title, 46, "#1b1640", { strokeThickness: 0 }));
        const st = txt(this, W / 2, 610, "★".repeat(stars) + "☆".repeat(3 - stars), 66, "#ffc83a", { stroke: "#e0a21a", strokeThickness: 4 });
        st.setScale(0.2); this.tweens.add({ targets: st, scale: 1, duration: 500, ease: "Back.out" }); c.add(st);
        c.add(txt(this, W / 2, 700, fact, 24, "#3b2f4a", { strokeThickness: 0, wordWrap: { width: 540 } }));
        c.add(txt(this, W / 2, 800, "✨ +" + keep + " stardust" + (this.friends ? "   👽 +" + this.friends + " friend" + (this.friends > 1 ? "s" : "") : ""), 26, "#e0662f", { strokeThickness: 0 }));
        S.yay(); this.fx.explode(80, W / 2, 400);
      } else {
        c.add(fit(this.add.image(W / 2, 430, "rocket"), 160).setAngle(-60));
        c.add(txt(this, W / 2, 550, "Bonk! The rocket needs a rest.", 38, "#1b1640", { strokeThickness: 0 }));
        c.add(txt(this, W / 2, 640, "You kept ✨" + keep + " stardust. Visit the Hangar to make your rocket stronger, then try again!", 24, "#3b2f4a", { strokeThickness: 0, wordWrap: { width: 520 } }));
        c.add(txt(this, W / 2, 760, Phaser.Utils.Array.GetRandom(TIPS), 21, "#5b5478", { strokeThickness: 0, wordWrap: { width: 540 } }));
        S.oops();
      }
      const next = win && this.li < LEVELS.length - 1;
      const btns = [["⌂ Levels", 0x6c8cff, () => this.scene.start("title")], ["↻ Retry", 0xff7a59, () => this.scene.start("play", { level: this.li })]];
      if (next) btns.push(["Next ▶", 0x5ccf6a, () => this.scene.start("play", { level: this.li + 1 })]);
      btns.forEach((b, i) => c.add(button(this, W / 2 + (i - (btns.length - 1) / 2) * 196, 930, 180, 80, b[0], b[1], b[2], 28)));
      c.add(button(this, W / 2, 1035, 300, 66, "🛠 Hangar", 0x8a7aa8, () => this.scene.start("hangar"), 26));
      if (win && this.li === LEVELS.length - 1) this.time.delayedCall(700, () => this.toast("🏆 You cleaned the whole way to Neptune! Space is safer for everyone.", 5000, 200));
    }
  }

  function start() {
    const ready = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 32px "Baloo 2"')]).catch(() => {}) : Promise.resolve();
    Promise.race([ready, new Promise(r => setTimeout(r, 2500))]).then(() => {
      window.__scGame = new Phaser.Game({
        type: Phaser.AUTO, parent: "game", backgroundColor: "#0d0a26",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
        fps: /[?&]timer=1/.test(location.search) ? { forceSetTimeOut: true, target: 60 } : undefined,
        scene: [Boot, Title, Hangar, Play],
      });
    });
  }
  window.SpaceCleanUp = { start, LEVELS, OBJ };
})();
