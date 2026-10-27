/* Moon Scoop! — land Emmy on Phobos, drive Idefix over the bumps, and bring the capsule home (Phaser 3).
   The rules, missions and test bot live in sim.js. This file draws:
   - Land: a side view of Phobos under the big Mars picture, boulders, glowing landing spots, Emmy with its thrusters.
   - Rover: the same ground, sparkly rocks to scan, Idefix hopping when it goes too fast.
   - Home: a tall sky from black space down to the Australian desert, the capsule glowing hot, then the parachute.
   Nothing breaks: a hard landing just bounces slowly, and a hop ends with Idefix righting itself. */
(function () {
  "use strict";
  const W = 1280, H = 720;
  const FONT = '"Baloo 2", "Trebuchet MS", sans-serif';
  const S = (window.Book && Book.sfx) || new Proxy({}, { get: () => () => {} });
  const R = window.PhobosSim, LEVELS = R.LEVELS, clamp = R.clamp;
  const SPEED = parseFloat((location.search.match(/[?&]speed=([\d.]+)/) || [])[1]) || 1;   // test runs only
  const UNLOCK = /[?&]unlock=1/.test(location.search);
  const say = t => { if (window.Book && !Book.muted && Book.speak) Book.speak(t.replace(/[^\x20-\x7E]/g, "")); };

  /* ------------------------------------------------------------ save */
  const BLANK = () => ({ stars: {}, best: 0 });
  const save = {
    get() { try { return Object.assign(BLANK(), JSON.parse(localStorage.getItem("ms-save")) || {}); } catch (e) { return BLANK(); } },
    set(v) { try { localStorage.setItem("ms-save", JSON.stringify(v)); } catch (e) {} },
  };
  const totalStars = sv => Object.values(sv.stars).reduce((a, b) => a + b, 0);
  const FACTS = {
    first: "Phobos is so small that its gravity is more than 1,000 times weaker than Earth's. A tiny push sends you floating up for a long time!",
    drop: "Idefix is a little rover from France and Germany. It rides to Phobos on MMX's back, then drops down and drives very slowly.",
    boulders: "Before landing, MMX will study Phobos from close by for a long time, looking for a safe place to touch down.",
    steady: "On Phobos, almost nothing pulls you back down. Drive fast over a bump, and your wheels leave the ground!",
    crater: "Phobos has a giant crater called Stickney. It is about 9 km wide, more than a third of the whole moon!",
    explore: "Phobos is as dark as a road. Did it come from Mars, or is it an asteroid Mars caught? Its soil can tell us!",
    twice: "MMX plans to bring home at least 10 grams of Phobos soil, about as heavy as two or three sugar cubes.",
    home: "In 2031, MMX's capsule is planned to land in the desert of South Australia, where Hayabusa2's capsule landed in 2020.",
    free: "Phobos goes around Mars in about 7 hours and 39 minutes. That's 3 times in one Mars day!",
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
  // a button you hold down (thrusters, driving, scooping); several can be held at once
  function holdButton(sc, x, y, w, h, label, fill, size) {
    const c = sc.add.container(x, y).setScrollFactor(0).setDepth(40), g = sc.add.graphics();
    const draw = d => { g.clear(); g.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, 26);
      g.fillStyle(fill, d ? 1 : 0.85).fillRoundedRect(-w / 2, -h / 2 + (d ? 5 : 0), w, h, 26);
      g.lineStyle(4, 0xffffff, d ? 0.9 : 0.4).strokeRoundedRect(-w / 2, -h / 2 + (d ? 5 : 0), w, h, 26); };
    draw(false);
    const t = txt(sc, 0, 0, label, size || 30);
    c.add([g, t]); c.setSize(w, h).setInteractive();
    c.down = false;
    const set = d => { if (c.down !== d) { c.down = d; draw(d); t.y = d ? 5 : 0; } };
    c.on("pointerdown", () => set(true)); c.on("pointerup", () => set(false)); c.on("pointerout", () => set(false));
    c.setLabel = s => t.setText(s);
    return c;
  }
  function fit(img, size) { img.setScale(size / Math.max(img.width, img.height)); return img; }
  function panel(sc, x, y, w, h, color) {
    const g = sc.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x - w / 2, y - h / 2 + 10, w, h, 36);
    g.fillStyle(0xfffaf2, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    g.lineStyle(6, color || 0xe2a12b, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    return g;
  }
  const rand = (() => { let s = 13; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const KIND = { land: { icon: "emmy", color: 0xe2a12b, css: "#c9851a" }, rover: { icon: "idefix", color: 0x5a8de0, css: "#3f6fc0" }, home: { icon: "capsule", color: 0xe8662e, css: "#c94f1c" } };

  // the gray ground of Phobos (drawn once): fill, a lighter rim, and little craters
  function drawPhobos(sc, s, L) {
    const g = sc.add.graphics().setDepth(2), pts = [];
    for (let x = 0; x <= L.W; x += 16) pts.push({ x, y: s.g(x) });
    pts.push({ x: L.W, y: H + 20 }, { x: 0, y: H + 20 });
    g.fillStyle(0x6c625a, 1).fillPoints(pts, true);
    g.lineStyle(6, 0x8d8279, 1).strokePoints(pts.slice(0, pts.length - 2), false);
    for (let i = 0; i < L.W / 60; i++) {
      const x = rand() * L.W, y = s.g(x) + 30 + rand() * (H - s.g(x) - 30), r = 6 + rand() * 18;
      g.fillStyle(0x564d46, 1).fillEllipse(x, y, r * 2, r * 0.8).fillStyle(0x82776e, 1).fillEllipse(x, y + r * 0.25, r * 1.6, r * 0.35);
    }
    return g;
  }
  function spaceBack(sc) {
    sc.add.image(W / 2, H / 2, "bg_space").setDisplaySize(W, H).setScrollFactor(0).setDepth(0);
  }
  // messages that wait their turn at the top of the screen
  function toaster(sc, y) {
    sc.toastQ = []; sc.msgT = 0;
    sc.msg = txt(sc, W / 2, y || 170, "", 28, "#ffffff", { wordWrap: { width: 860 } }).setScrollFactor(0).setDepth(45).setAlpha(0);
    sc.toast = (t, speak) => { if (sc.toastQ[sc.toastQ.length - 1] !== t) sc.toastQ.push(t); if (speak) say(t); };
    sc.tickToast = dt => {
      sc.msgT -= dt;
      if (sc.msgT <= 0 && sc.toastQ.length) { sc.msg.setText(sc.toastQ.shift()).setAlpha(1); sc.msgT = 2.6; }
      else if (sc.msgT <= 0) sc.msg.setAlpha(Math.max(0, sc.msg.alpha - 0.05));
    };
  }

  /* ============================================================ BOOT */
  const ART = ["emmy", "emmy_fire", "idefix", "capsule", "chute", "moon", "riku", "boulder", "bg_space", "bg_desert", "p01", "p04"];
  class Boot extends Phaser.Scene {
    constructor() { super("boot"); }
    preload() {
      txt(this, W / 2, H / 2 - 60, "Emmy is warming up its thrusters...", 40);
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
      this.add.image(W / 2, H / 2, "p01").setDisplaySize(W, H).setAlpha(0.6);
      this.add.rectangle(W / 2, H / 2, W, H, 0x141a3a, 0.45);
      const e = fit(this.add.image(140, 100, "emmy"), 210);
      this.tweens.add({ targets: e, y: "-=10", duration: 1400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      fit(this.add.image(1150, 120, "idefix"), 140);
      txt(this, W / 2, 70, "Moon Scoop!", 80, "#ffffff", { stroke: "#c9851a", strokeThickness: 12 });
      txt(this, W / 2, 134, "Land on Phobos, scoop its soil, and bring it home to Earth.  ⭐ " + totalStars(sv) + " / " + LEVELS.length * 3, 24, "#ffffff", { strokeThickness: 4 });
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
      button(this, W / 2, 640, 540, 76, "🥄 Free Landing  (best: " + (sv.best || 0) + ")", 0xe2a12b, () => this.scene.start("brief", { level: -1 }), 28);
    }
  }

  /* ============================================================ BRIEFING */
  class Brief extends Phaser.Scene {
    constructor() { super("brief"); }
    init(d) { this.li = d.level; }
    create() {
      const L = this.li < 0 ? R.FREE : LEVELS[this.li], K = KIND[L.kind];
      this.add.image(W / 2, H / 2, L.kind === "home" ? "bg_desert" : "p04").setDisplaySize(W, H);
      panel(this, W / 2, H / 2, 1060, 600, K.color);
      txt(this, W / 2, 110, (this.li < 0 ? "" : "Mission " + (this.li + 1) + ": ") + L.name, 46, "#1e2340", { strokeThickness: 0 });
      fit(this.add.image(260, 330, L.kind === "home" ? "chute" : K.icon), 280);
      txt(this, 760, 250, L.intro, 28, "#1e2340", { strokeThickness: 0, wordWrap: { width: 620 }, align: "left" });
      txt(this, 760, 455, "💡 " + FACTS[L.k], 23, K.css, { strokeThickness: 0, wordWrap: { width: 620 }, align: "left" });
      button(this, 520, 630, 260, 74, "◀ Back", 0x6b7a90, () => this.scene.start("menu"), 28);
      button(this, 800, 630, 300, 74, "Let's go! ▶", 0xe2a12b, () => this.scene.start(L.kind, { level: this.li }), 30);
      say(L.intro);
    }
  }

  /* ============================================================ LAND */
  class Land extends Phaser.Scene {
    constructor() { super("land"); }
    init(d) { this.li = d.level; }
    create() {
      const L = this.li < 0 ? R.FREE : LEVELS[this.li];
      Object.assign(this, { L, s: R.create(L), mem: {}, ended: false, quit: false, dust: [] });
      const s = this.s, cam = this.cameras.main;
      this.input.addPointer(3);
      spaceBack(this);
      drawPhobos(this, s, L);
      this.padG = this.add.graphics().setDepth(3);
      this.padT = [];
      s.boulders.forEach(b => fit(this.add.image(b.x, b.y, "boulder"), b.r * 2.3).setDepth(4));
      this.guideG = this.add.graphics().setDepth(5);
      this.dustG = this.add.graphics().setDepth(7);
      this.emmy = this.add.image(s.x, s.y, "emmy").setDepth(6);
      this.puffG = this.add.graphics().setDepth(6.5);
      cam.setBounds(0, 0, L.W, H);
      cam.startFollow(this.emmy, true, 0.1, 0.1);
      // HUD
      const box = this.add.graphics().setScrollFactor(0).setDepth(30);
      box.fillStyle(0xffffff, 0.9).fillRoundedRect(14, 14, 420, 104, 22);
      txt(this, 30, 38, L.name, 24, "#1e2340", { strokeThickness: 0 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(31);
      this.infoT = txt(this, 30, 82, "", 24, "#1e2340", { strokeThickness: 0 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(31);
      this.fuelG = this.add.graphics().setScrollFactor(0).setDepth(31);
      this.speedT = txt(this, W / 2, H - 40, "", 28, "#ffffff").setScrollFactor(0).setDepth(31);
      this.arrowT = txt(this, 0, 0, "", 40, "#7dff8a").setScrollFactor(0).setDepth(31);
      toaster(this, 175);
      button(this, W - 90, 46, 140, 56, "◀ Menu", 0x6b7a90, () => this.scene.start("menu"), 20).setScrollFactor(0).setDepth(42);
      if (L.free) button(this, W - 250, 46, 150, 56, "✅ DONE", 0x5ccf6a, () => { this.quit = true; }, 22).setScrollFactor(0).setDepth(42);
      this.bLeft = holdButton(this, 90, H - 80, 130, 110, "◀", 0x5a8de0, 46);
      this.bRight = holdButton(this, 240, H - 80, 130, 110, "▶", 0x5a8de0, 46);
      this.bUp = holdButton(this, W - 110, H - 80, 170, 120, "▲ UP", 0xe8662e, 34);
      this.bScoop = holdButton(this, W - 320, H - 80, 210, 110, "🥄 SCOOP", 0x5ccf6a, 30).setVisible(false);
      this.keys = this.input.keyboard.createCursorKeys();
      this.toast(L.k === "first" ? "👆 Hold ▲ UP to push gently. Use ◀ ▶ to move. Land on the green glow!" : "🟢 Find the glowing spot and land softly!", true);
      window.__ms = this; window.__msGame = this.game;
    }
    update(_, dms) {
      const dt = Math.min(0.05, dms / 1000) * SPEED, s = this.s, k = this.keys;
      if (this.ended) return;
      let inp = { up: this.bUp.down || k.up.isDown, left: this.bLeft.down || k.left.isDown, right: this.bRight.down || k.right.isDown,
        scoop: this.bScoop.down || k.space.isDown || k.down.isDown, quit: this.quit };
      if (window.__msBot) inp = Object.assign(R.bot(s, dt, this.mem), { quit: this.quit });
      const n = Math.max(1, Math.ceil(dt / (1 / 30)));
      for (let i = 0; i < n; i++) { R.step(s, dt / n, inp); this.handle(s.events); if (s.done) break; }
      this.draw(dt, inp);
      this.tickToast(dt);
      if (s.done) this.finish();
    }
    handle(evs) {
      const s = this.s;
      for (const e of evs) {
        if (e.type === "touch") { S.pop(); this.puff(s.x, s.g(s.x), 14); if (!e.pad && s.phase !== "scoop") this.toast("🛬 Soft landing! But the green glow is over there. Push UP to hop."); }
        else if (e.type === "bounce") { S.oops(); this.cameras.main.shake(200, 0.006); this.puff(s.x, s.y + R.LANDER.halfH, 20);
          this.toast(e.boulder ? "🪨 Bonk! A boulder. Emmy bounces away... slowly." : "🏀 Boing! Too fast. On Phobos you bounce very high!"); }
        else if (e.type === "reserve") { S.oops(); this.toast("⛽ Fuel is empty! Using the small reserve tank. Careful!", true); }
        else if (e.type === "sample") { S.ding(); Book.confetti && Book.confetti(30); this.toast("🥄 Got Phobos soil! (" + e.n + ")", true); }
        else if (e.type === "leave") { S.rocket(); this.toast("🚀 All done! Emmy flies up with the soil.", true); }
        else if (e.type === "done") S.yay();
      }
      if (s.phase === "scoop" && !this.saidScoop) { this.saidScoop = true; this.toast("🥄 Perfect landing! Hold SCOOP to collect the soil.", true); }
      if (s.phase !== "scoop") this.saidScoop = false;
    }
    puff(x, y, n) { for (let i = 0; i < n; i++) this.dust.push({ x, y, vx: (rand() - 0.5) * 120, vy: -rand() * 50, a: 0.8, r: 4 + rand() * 6 }); }
    draw(dt, inp) {
      const s = this.s, L = this.L, t = this.time.now / 1000, cam = this.cameras.main, H2 = R.LANDER.halfH;
      // glowing landing spots
      const pg = this.padG.clear(), pulse = 0.55 + 0.35 * Math.sin(t * 4);
      s.pads.forEach((p, i) => {
        const y = s.g((p.a + p.b) / 2);
        if (!this.padT[i]) this.padT[i] = txt(this, (p.a + p.b) / 2, y - 120, "", 26, "#7dff8a").setDepth(3);
        this.padT[i].setPosition((p.a + p.b) / 2, y - 150 + Math.sin(t * 3) * 6).setText(p.done ? "✅" : "⬇ LAND HERE")
          .setAlpha(p.done || Math.abs(s.x - (p.a + p.b) / 2) > 160 || s.y > y - 260 ? 1 : 0);
        if (p.done) { pg.fillStyle(0x9fd8a8, 0.5).fillRect(p.a, y - 4, p.b - p.a, 8); return; }
        pg.fillStyle(0x5ccf6a, 0.18 * pulse).fillRect(p.a, y - 110, p.b - p.a, 110);
        pg.fillStyle(0x7dff8a, pulse).fillRoundedRect(p.a, y - 6, p.b - p.a, 12, 6);
      });
      // a dotted line from Emmy down to the ground, green above a landing spot
      const gy = s.g(s.x), over = s.pads.some(p => !p.done && s.x > p.a + 10 && s.x < p.b - 10), gg = this.guideG.clear();
      if (gy - (s.y + H2) > 30) for (let y = s.y + H2 + 10; y < gy - 10; y += 22) gg.fillStyle(over ? 0x7dff8a : 0xffffff, 0.6).fillCircle(s.x, y, 3);
      // Emmy
      const fire = s.thrust.up || s.phase === "leave";
      this.emmy.setTexture(fire ? "emmy_fire" : "emmy"); fit(this.emmy, 200);
      this.emmy.setOrigin(0.5, fire ? 0.66 : 0.95).setPosition(s.x, s.y + H2).setAngle(clamp(s.vx * 0.25, -10, 10));
      const fg = this.puffG.clear();
      if (s.thrust.side) { const sx = s.x - s.thrust.side * 95; for (let i = 0; i < 3; i++) fg.fillStyle(0xbfe3ff, 0.6 - i * 0.15).fillCircle(sx - s.thrust.side * i * 14, s.y + 10 + Math.sin(t * 30 + i) * 3, 9 - i * 2); }
      if (fire && gy - (s.y + H2) < 140 && Math.random() < 0.5) this.puff(s.x + (rand() - 0.5) * 60, gy, 1);
      if (s.phase === "scoop" && inp.scoop && Math.random() < 0.6) this.puff(s.x + 50, gy, 1);
      const dg = this.dustG.clear();
      this.dust = this.dust.filter(d => (d.x += d.vx * dt, d.y += d.vy * dt, d.vy += R.PHOBOS_G * dt, d.a -= 0.35 * dt) > 0);
      for (const d of this.dust) dg.fillStyle(0xb0a49a, d.a).fillCircle(d.x, d.y, d.r);
      // scoop meter
      if (s.phase === "scoop") { dg.lineStyle(10, 0xffffff, 0.4).strokeCircle(s.x, s.y - 70, 28); dg.lineStyle(10, 0x7dff8a, 1).beginPath().arc(s.x, s.y - 70, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.scoop).strokePath(); }
      this.bScoop.setVisible(s.phase === "scoop");
      // arrow toward the next spot when it is off screen
      const next = s.pads.find(p => !p.done), v = cam.worldView;
      if (next && ((next.a + next.b) / 2 > v.right || (next.a + next.b) / 2 < v.x)) {
        const right = (next.a + next.b) / 2 > v.right;
        this.arrowT.setText(right ? "🟢 ▶" : "◀ 🟢").setPosition(right ? W - 70 : 70, 330 + Math.sin(t * 5) * 8).setVisible(true);
      } else this.arrowT.setVisible(false);
      // speed warnings (only near the ground, where they matter)
      const near = gy - (s.y + H2) < 220 && !s.onGround;
      const fastDown = s.vy > R.LANDER.safeV * 0.8, fastSide = Math.abs(s.vx) > R.LANDER.safeX * 0.85;
      this.speedT.setText(s.phase === "scoop" ? "" : near && fastDown ? "⬇ Too fast! Hold ▲ UP" : near && fastSide ? "↔ Too fast sideways!" : near ? "👍 Nice and slow" : "")
        .setColor(near && (fastDown || fastSide) ? "#ff8a8a" : "#9dffaa");
      // fuel and soil
      const fb = this.fuelG.clear();
      if (L.fuel) {
        fb.fillStyle(0xe3ecf7, 1).fillRoundedRect(200, 70, 220, 24, 12);
        const f = s.fuel / (s.reserve ? 25 : L.fuel);
        fb.fillStyle(s.reserve ? 0xff5a6a : f < 0.3 ? 0xf2a516 : 0x5ccf6a, 1).fillRoundedRect(200, 70, Math.max(12, 220 * f), 24, 12);
        this.infoT.setText("🥄 " + s.samples + "/" + s.pads.length + "   ⛽");
      } else this.infoT.setText("🥄 Soil scoops: " + s.samples);
    }
    finish() {
      if (this.ended) return; this.ended = true;
      const r = this.s.result, sv = save.get();
      if (this.L.free) { if (r.samples > (sv.best || 0)) sv.best = r.samples; }
      else sv.stars[this.L.k] = Math.max(sv.stars[this.L.k] || 0, r.stars);
      save.set(sv);
      this.time.delayedCall(r.out ? 600 : 1000, () => this.scene.start("result", { level: this.li, r, kind: "land" }));
    }
  }

  /* ============================================================ ROVER */
  class Rover extends Phaser.Scene {
    constructor() { super("rover"); }
    init(d) { this.li = d.level; }
    create() {
      const L = LEVELS[this.li];
      Object.assign(this, { L, s: R.create(L), mem: {}, ended: false, spin: 0 });
      const s = this.s, cam = this.cameras.main;
      this.input.addPointer(3);
      spaceBack(this);
      drawPhobos(this, s, L);
      this.rocks = s.spots.map(p => ({ im: fit(this.add.image(p.x + 40, s.g(p.x + 40) - 8, "boulder"), 74).setDepth(4), t: txt(this, p.x + 40, s.g(p.x + 40) - 70, "✨", 34).setDepth(4) }));
      this.beamG = this.add.graphics().setDepth(5);
      this.rover = fit(this.add.image(s.x, s.y, "idefix"), 150).setOrigin(0.5, 0.94).setDepth(6);
      this.dustG = this.add.graphics().setDepth(7); this.dust = [];
      cam.setBounds(0, 0, L.W, H);
      cam.startFollow(this.rover, true, 0.1, 0.1);
      const box = this.add.graphics().setScrollFactor(0).setDepth(30);
      box.fillStyle(0xffffff, 0.9).fillRoundedRect(14, 14, 420, 104, 22);
      txt(this, 30, 38, L.name, 24, "#1e2340", { strokeThickness: 0 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(31);
      this.infoT = txt(this, 30, 82, "", 24, "#1e2340", { strokeThickness: 0 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(31);
      this.timeT = txt(this, W / 2, 46, "", 26, "#ffffff").setScrollFactor(0).setDepth(31);
      this.spdG = this.add.graphics().setScrollFactor(0).setDepth(31);
      this.spdT = txt(this, W / 2, H - 112, "", 24, "#ffffff").setScrollFactor(0).setDepth(31);
      this.arrowT = txt(this, 0, 0, "", 40, "#ffe27a").setScrollFactor(0).setDepth(31);
      toaster(this, 175);
      button(this, W - 90, 46, 140, 56, "◀ Menu", 0x6b7a90, () => this.scene.start("menu"), 20).setScrollFactor(0).setDepth(42);
      this.bBack = holdButton(this, 90, H - 80, 140, 110, "◀", 0x6b7a90, 44);
      this.bGo = holdButton(this, W - 110, H - 80, 180, 120, "GO ▶", 0x5a8de0, 36);
      this.bScan = holdButton(this, W - 330, H - 80, 200, 110, "🔍 SCAN", 0x5ccf6a, 30).setVisible(false);
      this.keys = this.input.keyboard.createCursorKeys();
      this.toast(L.k === "drop" ? "👆 Hold GO to drive. Stop next to the sparkly rock, then hold SCAN!" : "🐢 Slow over the bumps! Scan every sparkly rock.", true);
      window.__ms = this; window.__msGame = this.game;
    }
    update(_, dms) {
      const dt = Math.min(0.05, dms / 1000) * SPEED, s = this.s, k = this.keys;
      if (this.ended) return;
      let inp = { go: this.bGo.down || k.right.isDown, back: this.bBack.down || k.left.isDown, scan: this.bScan.down || k.space.isDown || k.down.isDown };
      if (window.__msBot) inp = R.bot(s, dt, this.mem);
      const n = Math.max(1, Math.ceil(dt / (1 / 30)));
      for (let i = 0; i < n; i++) { R.step(s, dt / n, inp); this.handle(s.events); if (s.done) break; }
      this.draw(dt);
      this.tickToast(dt);
      if (s.done) this.finish();
    }
    handle(evs) {
      for (const e of evs) {
        if (e.type === "hop") { S.whoosh(); this.toast("🎈 Whoa! Too fast over the bump. Idefix floats away!"); }
        else if (e.type === "land") { S.pop(); this.puff(); this.toast("🤖 Idefix rights itself... drive slower next time!"); }
        else if (e.type === "scanned") { S.ding(); this.toast("🔍 Rock scanned! (" + e.n + "/" + this.s.spots.length + ")", true); }
        else if (e.type === "stopFirst") { if (!this.saidStop || this.time.now - this.saidStop > 3000) { this.saidStop = this.time.now; this.toast("✋ Stop first, then scan."); } }
        else if (e.type === "done") { if (this.s.spots.every(p => p.done)) S.yay(); else { S.oops(); this.toast("🌙 The Sun went down. Idefix needs sunlight!", true); } }
      }
    }
    puff() { const s = this.s; for (let i = 0; i < 16; i++) this.dust.push({ x: s.x + (rand() - 0.5) * 60, y: s.y, vx: (rand() - 0.5) * 100, vy: -rand() * 40, a: 0.8, r: 4 + rand() * 6 }); }
    draw(dt) {
      const s = this.s, L = this.L, t = this.time.now / 1000, cam = this.cameras.main;
      // rocks: sparkle until scanned
      s.spots.forEach((p, i) => { const r = this.rocks[i]; r.t.setText(p.done ? "✅" : "✨").setScale(p.done ? 1 : 1 + 0.15 * Math.sin(t * 5 + i)); });
      // Idefix: tilts with the ground, spins slowly in a hop, wobbles while righting itself
      if (s.air) this.spin += dt * 1.4 * Math.sign(s.v || 1);
      else this.spin = 0;
      const tilt = s.air ? this.spin : s.tumble > 0 ? Math.sin(s.tumble * 14) * 0.35 : Math.atan(R.slopeAt(s.g, s.x));
      this.rover.setPosition(s.x, s.y + (s.air ? 0 : 6)).setRotation(tilt);
      if (Math.abs(s.v) > 5 && !s.air && Math.random() < Math.abs(s.v) / 140) this.dust.push({ x: s.x - Math.sign(s.v) * 50, y: s.y, vx: -s.v * 0.3, vy: -10 - rand() * 20, a: 0.6, r: 3 + rand() * 4 });
      const dg = this.dustG.clear();
      this.dust = this.dust.filter(d => (d.x += d.vx * dt, d.y += d.vy * dt, d.vy += R.PHOBOS_G * dt, d.a -= 0.4 * dt) > 0);
      for (const d of this.dust) dg.fillStyle(0xb0a49a, d.a).fillCircle(d.x, d.y, d.r);
      // scanning beam and progress ring
      const bg = this.beamG.clear();
      if (s.scanning) {
        const rx = s.scanning.x + 40, ry = s.g(rx) - 14;
        bg.lineStyle(6, 0x7dff8a, 0.5 + 0.3 * Math.sin(t * 20)).lineBetween(s.x + 20, s.y - 100, rx, ry);
        bg.lineStyle(10, 0x7dff8a, 1).beginPath().arc(rx, ry - 70, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.scan / R.ROVER.scanTime).strokePath();
      }
      this.bScan.setVisible(!!s.near && !s.air);
      // speed meter: green is safe for bumps, red is too fast
      const sg = this.spdG.clear(), sx = W / 2 - 160, sp = Math.abs(s.v) / R.ROVER.max;
      sg.fillStyle(0x000000, 0.35).fillRoundedRect(sx - 8, H - 88, 336, 40, 20);
      sg.fillStyle(0x5ccf6a, 0.5).fillRect(sx, H - 80, 320 * 0.7, 24).fillStyle(0xff5a6a, 0.5).fillRect(sx + 320 * 0.7, H - 80, 320 * 0.3, 24);
      sg.fillStyle(sp > 0.72 ? 0xff5a6a : 0xffffff, 1).fillRoundedRect(sx + 320 * sp - 6, H - 86, 12, 36, 6);
      this.spdT.setText(s.air ? "🎈 Floating..." : s.tumble > 0 ? "🤖 Getting up..." : sp > 0.72 ? "🐇 Too fast for bumps!" : s.near ? "✋ Stop here and SCAN" : "🐢 Speed").setColor(sp > 0.72 ? "#ff8a8a" : "#ffffff");
      // arrow to the next rock
      const next = s.spots.find(p => !p.done), v = cam.worldView;
      if (next && (next.x > v.right || next.x < v.x)) { const right = next.x > v.right; this.arrowT.setText(right ? "✨ ▶" : "◀ ✨").setPosition(right ? W - 70 : 70, 330 + Math.sin(t * 5) * 8).setVisible(true); }
      else this.arrowT.setVisible(false);
      this.infoT.setText("🔍 Rocks: " + s.spots.filter(p => p.done).length + " / " + s.spots.length);
      this.timeT.setText("☀️ Sunset in " + Math.max(0, Math.ceil(L.T - s.t)) + " s");
    }
    finish() {
      if (this.ended) return; this.ended = true;
      const r = this.s.result, sv = save.get(); sv.stars[this.L.k] = Math.max(sv.stars[this.L.k] || 0, r.stars); save.set(sv);
      this.time.delayedCall(1200, () => this.scene.start("result", { level: this.li, r, kind: "rover" }));
    }
  }

  /* ============================================================ HOME */
  class Home extends Phaser.Scene {
    constructor() { super("home"); }
    init(d) { this.li = d.level; }
    create() {
      const L = LEVELS[this.li], Hm = R.HOME;
      Object.assign(this, { L, s: R.create(L), mem: {}, ended: false, sparks: [] });
      const s = this.s, cam = this.cameras.main, top = Hm.ground - 648;
      this.input.addPointer(3);
      // the sky: black space at the top, blue near the ground, then the desert picture
      const sky = this.add.graphics().setDepth(0);
      for (let i = 0; i < 40; i++) {
        const k = i / 39, c = Phaser.Display.Color.Interpolate.ColorWithColor({ r: 10, g: 14, b: 40 }, { r: 92, g: 172, b: 240 }, 100, k * 100);
        sky.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(0, (top / 40) * i - 2, W, top / 40 + 4);
      }
      for (let i = 0; i < 120; i++) { const y = rand() * top * 0.5; sky.fillStyle(0xffffff, 0.8 * (1 - y / (top * 0.5))).fillCircle(rand() * W, y, 1 + rand() * 2); }
      this.add.image(W / 2, top, "bg_desert").setOrigin(0.5, 0).setDisplaySize(W, H).setDepth(0);
      // the parachute line and the landing zone
      const lg = this.add.graphics().setDepth(2);
      for (let x = 0; x < W; x += 40) lg.fillStyle(0xffd23d, 0.9).fillRect(x, Hm.line - 3, 24, 6);
      txt(this, W / 2, Hm.line - 30, "⬇ Open the parachute below this line", 26, "#ffe27a").setDepth(2);
      const zg = this.add.graphics().setDepth(2), zy = Hm.ground;
      zg.fillStyle(0x7dff8a, 0.25).fillRect(Hm.zone[0], zy - 300, Hm.zone[1] - Hm.zone[0], 300);
      zg.lineStyle(5, 0x2f9e44, 1).lineBetween(Hm.zone[0], zy - 300, Hm.zone[0], zy).lineBetween(Hm.zone[1], zy - 300, Hm.zone[1], zy);
      txt(this, (Hm.zone[0] + Hm.zone[1]) / 2, zy - 330, "🎯 Landing zone", 28, "#ffffff", { stroke: "#2f6f3a", strokeThickness: 7 }).setDepth(2);
      fit(this.add.image(Hm.zone[1] + 150, zy + 40, "riku"), 170).setOrigin(0.5, 1).setDepth(3);
      this.glowG = this.add.graphics().setDepth(4);
      this.chute = fit(this.add.image(0, 0, "chute"), 230).setOrigin(0.5, 0.92).setDepth(5).setVisible(false);
      this.cap = fit(this.add.image(0, 0, "capsule"), 110).setOrigin(0.5, 0.9).setDepth(5);
      cam.setBounds(0, 0, W, Hm.ground + 72);
      cam.startFollow(this.cap, true, 0.15, 0.15, 0, 120);
      const box = this.add.graphics().setScrollFactor(0).setDepth(30);
      box.fillStyle(0xffffff, 0.9).fillRoundedRect(14, 14, 420, 104, 22);
      txt(this, 30, 38, L.name, 24, "#1e2340", { strokeThickness: 0 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(31);
      this.infoT = txt(this, 30, 82, "", 24, "#1e2340", { strokeThickness: 0 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(31);
      this.zoneT = txt(this, W / 2, H - 50, "", 26, "#ffffff").setScrollFactor(0).setDepth(31);
      toaster(this, 175);
      button(this, W - 90, 46, 140, 56, "◀ Menu", 0x6b7a90, () => this.scene.start("menu"), 20).setScrollFactor(0).setDepth(42);
      this.bLeft = holdButton(this, 90, H - 80, 130, 110, "◀", 0x5a8de0, 46);
      this.bRight = holdButton(this, 240, H - 80, 130, 110, "▶", 0x5a8de0, 46);
      this.bChute = holdButton(this, W - 150, H - 80, 250, 120, "🪂 PARACHUTE", 0xe8662e, 28);
      this.keys = this.input.keyboard.createCursorKeys();
      this.toast("🔥 The capsule is falling through Earth's air. It gets hot!", true);
      window.__ms = this; window.__msGame = this.game;
    }
    update(_, dms) {
      const dt = Math.min(0.05, dms / 1000) * SPEED, s = this.s, k = this.keys;
      if (this.ended) return;
      let inp = { chute: this.bChute.down || k.space.isDown || k.up.isDown, left: this.bLeft.down || k.left.isDown, right: this.bRight.down || k.right.isDown };
      if (window.__msBot) inp = R.bot(s, dt, this.mem);
      const n = Math.max(1, Math.ceil(dt / (1 / 30)));
      for (let i = 0; i < n; i++) { R.step(s, dt / n, inp); this.handle(s.events); if (s.done) break; }
      this.draw(dt);
      this.tickToast(dt);
      if (s.done) this.finish();
    }
    handle(evs) {
      for (const e of evs) {
        if (e.type === "chute") { S.whoosh(); this.toast("🪂 Parachute open! Now steer with ◀ ▶ into the landing zone.", true); }
        else if (e.type === "autoChute") { S.whoosh(); this.toast("🪂 The parachute opened by itself, just in time!"); }
        else if (e.type === "tooEarly") { S.oops(); this.toast("🔥 Not yet! The capsule is too fast and hot. Wait for the yellow line."); }
        else if (e.type === "done") { S.splash(); this.cameras.main.shake(200, 0.005); if (this.s.result.inZone) { S.yay(); this.toast("🎉 Welcome home! Riku runs over to see.", true); } else this.toast("🏜️ Landed in the desert. The team will drive over to find it!"); }
      }
    }
    draw(dt) {
      const s = this.s, Hm = R.HOME, t = this.time.now / 1000;
      this.cap.setPosition(s.x, s.y).setAngle(s.chute ? Math.sin(t * 2) * 5 : 0).setVisible(!s.chute);
      this.chute.setPosition(s.x, s.y).setAngle(clamp(-(s.vx - s.wind) * 0.15, -12, 12) + Math.sin(t * 2) * 3).setVisible(s.chute);
      // glowing hot while falling fast
      const g = this.glowG.clear();
      if (s.hot) {
        const a = clamp((s.vy - 300) / 120, 0, 1);
        g.fillStyle(0xff7a1a, 0.35 * a).fillCircle(s.x, s.y + 4, 70).fillStyle(0xffd23d, 0.5 * a).fillCircle(s.x, s.y + 10, 46);
        if (Math.random() < 0.8) this.sparks.push({ x: s.x + (rand() - 0.5) * 70, y: s.y + 10, a: 1 });
      }
      this.sparks = this.sparks.filter(p => (p.y -= 260 * dt, p.a -= 1.6 * dt) > 0);
      for (const p of this.sparks) g.fillStyle(0xffb347, p.a).fillCircle(p.x, p.y, 5);
      const left = Math.max(0, Math.round((Hm.ground - s.y) / 10));
      this.infoT.setText("📏 Height: " + left + (s.y < Hm.line ? "   🔥 hot!" : "   ✅ below the line"));
      const inZone = s.x >= Hm.zone[0] && s.x <= Hm.zone[1];
      this.zoneT.setText(s.chute ? (inZone ? "🎯 Right over the landing zone!" : s.x < Hm.zone[0] ? "Steer ▶ to the landing zone" : "◀ Steer to the landing zone") : "").setColor(inZone ? "#9dffaa" : "#ffffff");
    }
    finish() {
      if (this.ended) return; this.ended = true;
      const r = this.s.result, sv = save.get(); sv.stars[this.L.k] = Math.max(sv.stars[this.L.k] || 0, r.stars); save.set(sv);
      this.time.delayedCall(1800, () => this.scene.start("result", { level: this.li, r, kind: "home" }));
    }
  }

  /* ============================================================ RESULT */
  class Result extends Phaser.Scene {
    constructor() { super("result"); }
    init(d) { this.d = d; }
    create() {
      const { level, r, kind } = this.d, L = level < 0 ? R.FREE : LEVELS[level], K = KIND[kind];
      this.add.image(W / 2, H / 2, kind === "home" ? "bg_desert" : "p04").setDisplaySize(W, H);
      panel(this, W / 2, H / 2, 900, 560, K.color);
      const title = L.free ? "Free Landing" : r.out ? "Out of fuel! 😮" : r.stars >= 3 ? "Amazing! 🎉" : r.stars === 2 ? "Great job! 👏" : "You did it! 👍";
      txt(this, W / 2, 130, title, 52, "#1e2340", { strokeThickness: 0 });
      if (!L.free && !r.out) txt(this, W / 2, 210, "★".repeat(r.stars) + "☆".repeat(3 - r.stars), 72, "#ffc41f", { stroke: "#8a6a10", strokeThickness: 5 });
      let lines;
      if (kind === "land") lines = r.out ? ["Emmy used up all its fuel before landing on the glow.", "Try pushing UP in short little taps:", "on Phobos, a tiny push goes a long way!"]
        : ["🥄 Soil scoops: " + r.samples, r.bumps ? "🏀 Bounces: " + r.bumps + "  (land slowly!)" : "🌟 Soft as a feather. No bounces!",
          L.free ? "" : r.reserve ? "⛽ Used the reserve tank" : "⛽ Fuel left: " + r.fuel + "%"];
      else if (kind === "rover") lines = ["🔍 Rocks scanned: " + r.scanned + " / " + r.total, r.hops ? "🎈 Hops: " + r.hops + "  (slow over bumps!)" : "🐢 Slow and steady. No hops!",
        r.all ? "⏱️ Time: " + r.time + " s" : "🌙 The Sun went down first"];
      else lines = [r.inZone ? "🎯 Landed in the zone!" : "🏜️ Landed outside the zone", r.auto ? "🪂 The parachute opened by itself" : r.early ? "🔥 Tried to open it too early: " + r.early : "🪂 Parachute opened at the right time",
        r.inZone ? "📏 " + (r.off < 60 ? "Right in the middle!" : "Near the edge") : ""];
      txt(this, W / 2, 335, lines.filter(Boolean).join("\n"), 27, "#1e2340", { strokeThickness: 0, lineSpacing: 10 });
      txt(this, W / 2, 470, "💡 " + FACTS[L.k], 22, K.css, { strokeThickness: 0, wordWrap: { width: 780 } });
      const next = level >= 0 && level < LEVELS.length - 1 && r.stars > 0 ? level + 1 : null;
      button(this, 330, 590, 240, 72, "☰ Menu", 0x6b7a90, () => this.scene.start("menu"), 26);
      button(this, 620, 590, 260, 72, "🔁 Again", 0x5a8de0, () => this.scene.start(L.kind, { level }), 26);
      if (next != null) button(this, 920, 590, 280, 72, "Next ▶", 0xe2a12b, () => this.scene.start("brief", { level: next }), 28);
      if (r.stars >= 2) { S.yay(); if (window.Book && Book.confetti) Book.confetti(90); }
      window.__msResult = r;
    }
  }

  window.MoonScoop = {
    start() {
      const timer = /[?&]timer=1/.test(location.search);
      return new Phaser.Game({
        type: Phaser.AUTO, parent: "game", width: W, height: H, backgroundColor: "#141a3a",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        fps: timer ? { forceSetTimeOut: true, target: 30 } : undefined,
        scene: [Boot, Menu, Brief, Land, Rover, Home, Result],
      });
    },
  };
})();
