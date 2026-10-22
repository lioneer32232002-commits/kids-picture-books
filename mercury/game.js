/* Mercury Mission! — fly Bepi and Mio to Mercury, then map the planet (Phaser 3).
   The rules, missions and test bot live in sim.js. This file draws:
   - Flyby missions: the inner Solar System seen from above (the Sun, the orbits of Earth, Venus and Mercury, the
     looping path), Bepi's stack turning around to brake, and a HUD scene with the speed gauge, fuel, FLYBY and BRAKE.
   - Orbit missions: Mercury from the side with its hot day half and cold night half, Bepi going over the poles,
     photo spots on the surface, the heat meter, and Mio flying off on its own.
   Planet pictures come from the planets book (../planets/img). */
(function () {
  "use strict";
  const W = 1280, H = 720;
  const FONT = '"Baloo 2", "Trebuchet MS", sans-serif';
  const S = (window.Book && Book.sfx) || new Proxy({}, { get: () => () => {} });
  const R = window.MercurySim, LEVELS = R.LEVELS, D2R = R.D2R, clamp = R.clamp, M = R.MERC;
  const SPEED = parseFloat((location.search.match(/[?&]speed=([\d.]+)/) || [])[1]) || 1;   // test runs only
  const UNLOCK = /[?&]unlock=1/.test(location.search);
  const say = t => { if (window.Book && !Book.muted && Book.speak) Book.speak(t.replace(/[^\x20-\x7E]/g, "")); };
  const ZOOM = 0.42;

  /* ------------------------------------------------------------ save */
  const BLANK = () => ({ stars: {}, best: 0 });
  const save = {
    get() { try { return Object.assign(BLANK(), JSON.parse(localStorage.getItem("mm-save")) || {}); } catch (e) { return BLANK(); } },
    set(v) { try { localStorage.setItem("mm-save", JSON.stringify(v)); } catch (e) {} },
  };
  const totalStars = sv => Object.values(sv.stars).reduce((a, b) => a + b, 0);
  const FACTS = {
    hello: "Falling toward the Sun is like rolling downhill: you speed up. That's why a trip to Mercury needs so much braking!",
    photos: "Bepi's cameras will map Mercury's whole surface. Its orbit goes over the poles, so the planet turns underneath it.",
    nine: "The real BepiColombo made 9 flybys: Earth once, Venus twice and Mercury six times, from 2020 to 2025.",
    hot: "Mercury's day side can reach 430°C. Bepi wears thick blankets and mirrors to stay cool.",
    trouble: "In 2024, Bepi's engines couldn't push at full power. Engineers found a new path that takes about 11 months longer.",
    mio: "Mio means 'waterway' in Japanese. It flies a big stretched orbit to study Mercury's magnetic field.",
    finale: "Mercury's gravity can only catch a spacecraft that is moving almost as fast as Mercury, not faster.",
    ice: "In deep craters near Mercury's poles, the sunlight never reaches the bottom, so ice can hide there.",
    free: "Mercury is only a little bigger than our Moon. There's a lot to explore!",
  };
  const PNAME = { earth: "Earth", venus: "Venus", mercury: "Mercury" };

  /* ------------------------------------------------------------ helpers */
  function txt(sc, x, y, s, size, color, opts) {
    return sc.add.text(x, y, s, Object.assign({ fontFamily: FONT, fontSize: size + "px", fontStyle: "800", color: color || "#fff",
      stroke: "#0e1338", strokeThickness: Math.max(3, size / 6), align: "center" }, opts || {})).setOrigin(0.5);
  }
  function button(sc, x, y, w, h, label, fill, onClick, size, hold) {
    const c = sc.add.container(x, y), g = sc.add.graphics();
    const draw = d => { g.clear(); g.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, Math.min(h / 2, 26));
      g.fillStyle(c.fill || fill, 1).fillRoundedRect(-w / 2, -h / 2 + (d ? 5 : 0), w, h, Math.min(h / 2, 26));
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(-w / 2 + 10, -h / 2 + 6 + (d ? 5 : 0), w - 20, h * 0.3, h * 0.15); };
    c.redraw = draw; draw(false);
    const t = txt(sc, 0, -2, label, size || 30);
    c.add([g, t]); c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on("pointerdown", () => { draw(true); t.y = 3; c.pressed = true; c.held = true; if (hold) onClick(true); });
    const up = fire => { draw(false); t.y = -2; c.held = false; if (hold) { if (c.pressed) onClick(false); } else if (c.pressed && fire) { S.tap(); onClick(); } c.pressed = false; };
    c.on("pointerup", () => up(true));
    c.on("pointerout", () => up(false));
    c.label = t; return c;
  }
  function fit(img, size) { img.setScale(size / Math.max(img.width, img.height)); return img; }
  function panel(sc, x, y, w, h, color) {
    const g = sc.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x - w / 2, y - h / 2 + 10, w, h, 36);
    g.fillStyle(0xf4f5ff, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    g.lineStyle(6, color || 0x4b5fd6, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    return g;
  }
  const rand = (() => { let s = 5; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  // stars come from one small tiled picture: thousands of separate dots would be redrawn every frame and slow the game down
  function starfield(sc, n, x0, y0, w, h, depth) {
    return sc.add.tileSprite(x0, y0, w, h, "stars").setOrigin(0).setDepth(depth || 0);
  }

  /* ============================================================ BOOT */
  const ART = ["stack", "stack2", "bepi", "mio", "mtm", "cone", "mercury_big", "p01", "p08"];
  class Boot extends Phaser.Scene {
    constructor() { super("boot"); }
    preload() {
      txt(this, W / 2, H / 2 - 60, "Getting Bepi and Mio ready...", 40);
      const bar = this.add.graphics();
      this.load.on("progress", v => bar.clear().fillStyle(0xffffff, .3).fillRoundedRect(440, H / 2, 400, 28, 14).fillStyle(0xf2a516, 1).fillRoundedRect(440, H / 2, 400 * v, 28, 14));
      ART.forEach(k => this.load.image(k, "img/" + k + ".webp"));
      ["earth", "venus", "mercury"].forEach(k => this.load.image("pl_" + k, "../planets/img/" + k + ".webp"));
    }
    create() {
      const mk = (k, w, h, draw) => { if (this.textures.exists(k)) return; const g = this.make.graphics({ add: false }); draw(g); g.generateTexture(k, w, h); g.destroy(); };
      // stand-ins when a picture is missing, so the game never breaks
      ART.concat(["pl_earth", "pl_venus", "pl_mercury"]).forEach(k => mk(k, 64, 64, g => g.fillStyle(0xcccccc, 1).fillCircle(32, 32, 30)));
      mk("stars", 512, 512, g => { for (let i = 0; i < 70; i++) g.fillStyle(0xffffff, 0.25 + rand() * 0.7).fillCircle(rand() * 512, rand() * 512, 0.8 + rand() * 1.8); });
      // the Sun's glow
      const ST = this.textures.createCanvas("sunglow", 512, 512), c = ST.getContext();
      const g = c.createRadialGradient(256, 256, 30, 256, 256, 256);
      g.addColorStop(0, "rgba(255,250,220,1)"); g.addColorStop(0.25, "rgba(255,214,90,1)"); g.addColorStop(0.5, "rgba(255,170,40,0.45)"); g.addColorStop(1, "rgba(255,140,20,0)");
      c.fillStyle = g; c.fillRect(0, 0, 512, 512); ST.refresh();
      this.scene.start("menu");
    }
  }

  /* ============================================================ MENU */
  class Menu extends Phaser.Scene {
    constructor() { super("menu"); }
    create() {
      const sv = save.get();
      this.cameras.main.setBackgroundColor("#0e1338");
      starfield(this, 160, 0, 0, W, H);
      this.add.image(W + 40, 120, "sunglow").setScale(1.2);
      const pl = fit(this.add.image(180, 110, "stack"), 300).setAngle(-8), m = fit(this.add.image(1130, 600, "mercury_big"), 220);
      this.tweens.add({ targets: pl, y: "-=10", duration: 1300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.tweens.add({ targets: m, angle: 360, duration: 60000, repeat: -1 });
      txt(this, W / 2, 70, "Mercury Mission!", 76, "#ffffff", { stroke: "#4b5fd6", strokeThickness: 12 });
      txt(this, W / 2, 132, "Fly Bepi and Mio to Mercury, then explore it.  ⭐ " + totalStars(sv) + " / " + LEVELS.length * 3, 24, "#ffd98a", { strokeThickness: 0 });
      LEVELS.forEach((L, i) => {
        const x = 205 + (i % 4) * 290, y = 240 + Math.floor(i / 4) * 170;
        const open = UNLOCK || i === 0 || (sv.stars[LEVELS[i - 1].k] || 0) > 0;
        const c = this.add.container(x, y), bg = this.add.graphics(), orbit = L.kind === "orbit";
        bg.fillStyle(0x000000, 0.3).fillRoundedRect(-130, -66, 260, 140, 26);
        bg.fillStyle(open ? 0xf4f5ff : 0x8a90a8, 1).fillRoundedRect(-130, -72, 260, 140, 26);
        bg.lineStyle(5, orbit ? 0xf2a516 : 0x4b5fd6, 1).strokeRoundedRect(-130, -72, 260, 140, 26);
        c.add(bg);
        c.add(fit(this.add.image(-74, -16, orbit ? "mercury_big" : "stack"), orbit ? 70 : 110).setAlpha(open ? 1 : 0.4));
        c.add(txt(this, 52, -38, String(i + 1), 34, open ? (orbit ? "#d88a00" : "#4b5fd6") : "#5d6378", { strokeThickness: 0 }));
        c.add(txt(this, 0, 26, L.name, 23, open ? "#0e1338" : "#5d6378", { strokeThickness: 0, wordWrap: { width: 240 } }));
        const st = sv.stars[L.k] || 0;
        c.add(txt(this, 52, -6, open ? "★".repeat(st) + "☆".repeat(3 - st) : "🔒", 28, "#ffc41f", { strokeThickness: 3, stroke: "#8a6a10" }));
        if (open) {
          c.setSize(260, 140).setInteractive({ useHandCursor: true });
          c.on("pointerover", () => c.setScale(1.04)); c.on("pointerout", () => c.setScale(1));
          c.on("pointerup", () => { S.whoosh(); this.scene.start("brief", { level: i }); });
        }
      });
      button(this, W / 2, 640, 520, 76, "📷 Free Orbit  (best: " + (sv.best || 0) + " photos)", 0xf2a516, () => this.scene.start("brief", { level: -1 }), 28);
    }
  }

  /* ============================================================ BRIEFING */
  class Brief extends Phaser.Scene {
    constructor() { super("brief"); }
    init(d) { this.li = d.level; }
    create() {
      const L = this.li < 0 ? R.FREE : LEVELS[this.li], orbit = L.kind === "orbit";
      this.cameras.main.setBackgroundColor("#0e1338");
      starfield(this, 120, 0, 0, W, H);
      panel(this, W / 2, H / 2, 1060, 600, orbit ? 0xf2a516 : 0x4b5fd6);
      txt(this, W / 2, 110, (this.li < 0 ? "" : "Mission " + (this.li + 1) + ": ") + L.name, 46, "#0e1338", { strokeThickness: 0 });
      fit(this.add.image(260, 330, orbit ? (L.o && L.o.mio ? "stack2" : "bepi") : "stack"), 330);
      txt(this, 760, 250, L.intro, 28, "#0e1338", { strokeThickness: 0, wordWrap: { width: 620 }, align: "left" });
      txt(this, 760, 450, "💡 " + FACTS[L.k], 23, "#4b5fd6", { strokeThickness: 0, wordWrap: { width: 620 }, align: "left" });
      button(this, 520, 630, 260, 74, "◀ Back", 0x6b7a90, () => this.scene.start("menu"), 28);
      button(this, 800, 630, 300, 74, "Let's go! ▶", 0xf2a516, () => this.scene.start(orbit ? "orbit" : "cruise", { level: this.li }), 30);
      say(L.intro);
    }
  }

  /* ============================================================ CRUISE (flybys) */
  class Cruise extends Phaser.Scene {
    constructor() { super("cruise"); }
    init(d) { this.li = d.level; }
    create() {
      const L = LEVELS[this.li];
      Object.assign(this, { L, s: R.create(L), mem: {}, ended: false, toastQ: [], flybyTap: false, brakeHeld: false, trail: [], pathN: 0 });
      const s = this.s, cam = this.cameras.main;
      cam.setBackgroundColor("#0b0f2e").setZoom(ZOOM);
      cam.setBounds(-2400, -2400, 4800, 4800);
      starfield(this, 900, -2400, -2400, 4800, 4800, 0);
      this.add.image(0, 0, "sunglow").setScale(1.4).setDepth(1);
      const og = this.add.graphics().setDepth(2);
      [["earth", 0x5ea7ff], ["venus", 0xe8c06a], ["mercury", 0xb8bccb]].forEach(([k, col]) => {
        const r = R.ORB[k];
        og.lineStyle(6, col, 0.35).strokeCircle(0, 0, r);
        const p = R.pos(R.GATE_ANGLE[k], r);
        const used = s.c.gates.includes(k) || k === "mercury";
        const im = fit(this.add.image(p.x, p.y, "pl_" + k), k === "mercury" ? 120 : 170).setDepth(4).setAlpha(used ? 1 : 0.5);
        txt(this, p.x, p.y + (k === "mercury" ? 100 : 130), PNAME[k], 56, "#ffffff").setDepth(4).setAlpha(used ? 1 : 0.5);
        this["pl_" + k] = im;
      });
      txt(this, 0, 240, "Sun", 70, "#ffe08a", { stroke: "#7a3a00", strokeThickness: 10 }).setDepth(3);
      this.pathG = this.add.graphics().setDepth(3);
      this.gateG = this.add.graphics().setDepth(5);
      this.trailG = this.add.graphics().setDepth(6);
      this.ship = fit(this.add.image(s.x, s.y, "stack"), 260).setDepth(8);
      this.drawPath();
      cam.startFollow(this.ship, true, 0.1, 0.1);
      this.keys = this.input.keyboard.addKeys("SPACE,DOWN,B,F");
      this.scene.launch("chud", { cruise: this });
      this.events.once("shutdown", () => this.scene.stop("chud"));
      this.toast("🪐 Tap FLYBY when you're inside a planet's glowing ring!", true);
      window.__mm = this; window.__mmGame = this.game;
    }
    toast(t, speak) { this.toastQ.push(t); if (speak) say(t); }
    drawPath() {
      // one line for the whole looping path (redrawn only when a loop is added)
      const s = this.s, g = this.pathG.clear(), end = s.legs[s.legs.length - 1].a1, pts = [];
      for (let a = 0; a <= end; a += 0.1) { const p = R.pos(a, R.pathR(s.legs, a)); pts.push(new Phaser.Math.Vector2(p.x, p.y)); }
      g.lineStyle(9, 0x9fb0ff, 0.4).strokePoints(pts, false);
      this.pathN = s.legs.length;
    }
    update(_, dms) {
      const dt = Math.min(0.05, dms / 1000) * SPEED, s = this.s;
      if (this.ended) return;
      let inp = { brake: this.brakeHeld || this.keys.DOWN.isDown || this.keys.B.isDown, flyby: this.flybyTap || Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.F) };
      this.flybyTap = false;
      if (window.__mmBot) inp = R.bot(s, dt, this.mem);
      const n = Math.max(1, Math.ceil(dt / (1 / 30)));
      for (let i = 0; i < n; i++) { R.step(s, dt / n, i ? { brake: inp.brake } : inp); this.handle(s.events); if (s.done) break; }
      if (s.legs.length !== this.pathN) this.drawPath();
      this.draw();
      if (s.done) this.finish();
    }
    handle(evs) {
      for (const e of evs) {
        if (e.type === "flyby") {
          S.whoosh(); this.cameras.main.shake(200, 0.004);
          const good = e.q > 0.85 ? "Perfect" : e.q > 0.65 ? "Great" : "OK";
          this.toast("🪐 " + good + " " + PNAME[e.p] + " flyby! Slower now.");
          const pl = this["pl_" + e.p]; if (pl) this.tweens.add({ targets: pl, scale: pl.scale * 1.25, yoyo: true, duration: 220 });
        } else if (e.type === "missed") { S.oops(); this.toast("💨 Missed the " + PNAME[e.p] + " flyby. Watch for the next ring!"); }
        else if (e.type === "tooFast") { S.oops(); this.toast("😮 Too fast for Mercury to catch! Let's loop around for another flyby.", true); }
        else if (e.type === "help") { this.toast("🤖 Mission control is helping with the flybys now."); }
        else if (e.type === "noFuel") { if (!this.saidFuel) { this.saidFuel = true; this.toast("⛽ Out of fuel! Only flybys can slow you down now."); } }
        else if (e.type === "captured") { S.yay(); this.toast("🤲 Mercury caught Bepi and Mio! You're in orbit!", true); }
      }
    }
    draw() {
      const s = this.s, t = this.time.now / 1000;
      // the ship points along the path; when braking it turns around so the engines push against the motion
      const ahead = R.pos(s.a + 0.02, R.pathR(s.legs, s.a + 0.02)), dir = Math.atan2(ahead.y - s.y, ahead.x - s.x);
      this.ship.setPosition(s.x, s.y).setRotation(dir + (s.braking ? Math.PI : 0));
      this.trail.push([s.x, s.y]); if (this.trail.length > 70) this.trail.shift();
      const tg = this.trailG.clear();
      this.trail.forEach((p, i) => { if (i % 3 === 0) tg.fillStyle(0xffd98a, i / this.trail.length * 0.8).fillCircle(p[0], p[1], 6); });
      if (s.braking) for (let i = 0; i < 4; i++) { const d = 90 + i * 40 + (t * 400 % 40); tg.fillStyle(0x9ff0ff, 0.7 - i * 0.15).fillCircle(s.x + Math.cos(dir) * d, s.y + Math.sin(dir) * d, 12 - i * 2); }
      // the next flyby ring
      const g = this.gateG.clear(), L = s.legs[s.gate];
      if (L) {
        const gp = R.pos(L.a1, R.ORB[L.p]), pulse = 1 + 0.08 * Math.sin(t * 6);
        g.lineStyle(14, s.inWindow ? 0x5ccf6a : 0xffd23d, s.inWindow ? 1 : 0.8).strokeCircle(gp.x, gp.y, (L.p === "mercury" ? 120 : 160) * pulse);
        if (s.inWindow) g.fillStyle(0x5ccf6a, 0.18).fillCircle(gp.x, gp.y, (L.p === "mercury" ? 120 : 160) * pulse);
      }
    }
    finish() {
      if (this.ended) return; this.ended = true;
      const r = this.s.result, sv = save.get(); sv.stars[this.L.k] = Math.max(sv.stars[this.L.k] || 0, r.stars); save.set(sv);
      this.tweens.add({ targets: this.ship, scale: this.ship.scale * 0.6, duration: 1400 });
      this.time.delayedCall(1800, () => this.scene.start("result", { level: this.li, r, kind: "cruise" }));
    }
  }

  /* ============================================================ CRUISE HUD */
  class CHud extends Phaser.Scene {
    constructor() { super("chud"); }
    init(d) { this.cr = d.cruise; }
    create() {
      const cr = this.cr, s = cr.s;
      const box = this.add.graphics();
      box.fillStyle(0xffffff, 0.92).fillRoundedRect(14, 14, 380, 118, 22);
      txt(this, 30, 38, cr.L.name, 24, "#0e1338", { strokeThickness: 0 }).setOrigin(0, 0.5);
      this.fly = txt(this, 30, 76, "", 28, "#0e1338", { strokeThickness: 0 }).setOrigin(0, 0.5);
      txt(this, 30, 112, "⛽", 22, "#0e1338", { strokeThickness: 0 }).setOrigin(0, 0.5);
      this.fuelG = this.add.graphics();
      // speed gauge, top right
      const gb = this.add.graphics();
      gb.fillStyle(0xffffff, 0.92).fillRoundedRect(W - 330, 14, 316, 170, 22);
      this.gx = W - 172; this.gy = 140; this.gr = 100;
      const VMAX = 18;
      this.vmax = VMAX;
      const ang = v => Math.PI + clamp(v / VMAX, 0, 1) * Math.PI;
      gb.lineStyle(18, 0x5ccf6a, 1).beginPath().arc(this.gx, this.gy, this.gr, ang(0), ang(s.c.vCap)).strokePath();
      gb.lineStyle(18, 0xf2a516, 1).beginPath().arc(this.gx, this.gy, this.gr, ang(s.c.vCap), ang(s.c.vCap + 3)).strokePath();
      gb.lineStyle(18, 0xff5a6a, 1).beginPath().arc(this.gx, this.gy, this.gr, ang(s.c.vCap + 3), ang(VMAX)).strokePath();
      this.ang = ang;
      this.needle = this.add.graphics();
      this.speedT = txt(this, this.gx, this.gy - 26, "", 26, "#0e1338", { strokeThickness: 0 });
      this.arriveT = txt(this, this.gx, this.gy + 26, "", 18, "#0e1338", { strokeThickness: 0 });
      this.msg = txt(this, W / 2, 220, "", 28, "#ffffff", { wordWrap: { width: 760 } }).setAlpha(0);
      this.flyBtn = button(this, 200, H - 70, 300, 96, "🪐 FLYBY", 0xf2a516, () => { cr.flybyTap = true; }, 38);
      this.brakeBtn = button(this, W - 200, H - 70, 300, 96, "🔵 BRAKE", 0x4b5fd6, on => { cr.brakeHeld = on; }, 38, true);
      button(this, W / 2, H - 46, 130, 60, "◀ Menu", 0x6b7a90, () => cr.scene.start("menu"), 20);
      this.msgT = 0;
    }
    update(_, dms) {
      const cr = this.cr, s = cr.s;
      if (!s) return;
      this.fly.setText("🪐 Flybys: " + s.flybys + " / " + s.legs.length + (s.laps ? "  (extra loops: " + s.laps + ")" : ""));
      const fg = this.fuelG.clear();
      fg.fillStyle(0xe3e6f7, 1).fillRoundedRect(70, 102, 300, 20, 10);
      fg.fillStyle(s.fuel < 20 ? 0xff5a6a : 0x5ccf6a, 1).fillRoundedRect(70, 102, Math.max(0, 300 * s.fuel / s.c.fuel), 20, 10);
      const ng = this.needle.clear(), a = this.ang(s.v);
      ng.lineStyle(7, 0x0e1338, 1).lineBetween(this.gx, this.gy, this.gx + Math.cos(a) * (this.gr - 8), this.gy + Math.sin(a) * (this.gr - 8));
      const av = R.arriveSpeed(s), aa = this.ang(av);
      ng.fillStyle(0xff3fa4, 1).fillCircle(this.gx + Math.cos(aa) * (this.gr + 18), this.gy + Math.sin(aa) * (this.gr + 18), 8);
      this.speedT.setText(s.v.toFixed(1) + " km/s");
      this.arriveT.setText(av <= s.c.vCap ? "🩷 At Mercury: slow enough! ✓" : "🩷 At Mercury: too fast!").setColor(av <= s.c.vCap ? "#2f9e44" : "#d6334a");
      // the FLYBY button glows when it's time
      this.flyBtn.fill = s.inWindow ? 0x5ccf6a : 0xf2a516; this.flyBtn.redraw(this.flyBtn.held);
      this.flyBtn.setScale(s.inWindow ? 1 + 0.05 * Math.sin(this.time.now / 80) : 1);
      this.brakeBtn.fill = s.braking ? 0x2fb6c9 : s.fuel > 0 ? 0x4b5fd6 : 0x8a90a8; this.brakeBtn.redraw(this.brakeBtn.held);
      this.msgT -= dms / 1000;
      if (this.msgT <= 0 && cr.toastQ.length) { this.msg.setText(cr.toastQ.shift()).setAlpha(1); this.msgT = 2.4; }
      else if (this.msgT <= 0) this.msg.setAlpha(Math.max(0, this.msg.alpha - 0.05));
    }
  }

  /* ============================================================ ORBIT (map Mercury) */
  class Orbit extends Phaser.Scene {
    constructor() { super("orbit"); }
    init(d) { this.li = d.level; }
    create() {
      const L = this.li < 0 ? R.FREE : LEVELS[this.li];
      Object.assign(this, { L, s: R.create(L), mem: {}, ended: false, toastQ: [], snapTap: false, up: false, down: false, quit: false, msgT: 0, flashT: 0 });
      const s = this.s;
      this.cameras.main.setBackgroundColor("#0b0f2e");
      starfield(this, 200, 0, 0, W, H, 0);
      this.add.image(-140, M.y, "sunglow").setScale(1.6).setDepth(1);
      this.add.image(M.x, M.y, "mercury_big").setDisplaySize(M.R * 2, M.R * 2).setDepth(3);
      // the night half: darker toward the right edge
      const sh = this.add.graphics().setDepth(4);
      for (let i = 0; i < 10; i++) { sh.fillStyle(0x05081e, 0.075); sh.slice(M.x, M.y, M.R + 1, -Math.PI / 2, Math.PI / 2, false).fillPath(); sh.fillStyle(0x05081e, 0.04); sh.fillEllipse(M.x + M.R * 0.3, M.y, M.R * 1.4 * (1 - i * 0.05), M.R * 2); }
      txt(this, M.x - 330, 200, "☀️ DAY SIDE\nhot!", 26, "#ffd98a").setDepth(5);
      txt(this, M.x + 330, 200, "🌙 NIGHT SIDE\ncold", 26, "#bcd2ff").setDepth(5);
      this.zoneG = this.add.graphics().setDepth(5);
      this.tgtG = this.add.graphics().setDepth(6);
      this.tgtT = {};
      this.mioImg = fit(this.add.image(0, 0, "mio"), 70).setDepth(8).setVisible(false);
      this.ship = fit(this.add.image(0, 0, s.carrying ? "stack2" : "bepi"), s.carrying ? 140 : 120).setDepth(9);
      this.flashR = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(40);
      // left panel: photos, heat, height
      const box = this.add.graphics().setDepth(30);
      box.fillStyle(0xffffff, 0.92).fillRoundedRect(14, 14, 360, s.o.heat ? 140 : 100, 22);
      txt(this, 30, 38, L.name, 24, "#0e1338", { strokeThickness: 0 }).setOrigin(0, 0.5).setDepth(31);
      this.photoT = txt(this, 30, 76, "", 28, "#0e1338", { strokeThickness: 0 }).setOrigin(0, 0.5).setDepth(31);
      if (s.o.heat) txt(this, 30, 116, "🌡️", 24, "#0e1338", { strokeThickness: 0 }).setOrigin(0, 0.5).setDepth(31);
      this.heatG = this.add.graphics().setDepth(31);
      // controls
      this.snapBtn = button(this, W / 2, H - 60, 340, 92, s.carrying ? "🌀 LET MIO GO" : "📷 SNAP!", 0xf2a516, () => { this.snapTap = true; }, 36).setDepth(32);
      button(this, W - 90, H - 250, 140, 110, "▲ Up", 0x4b5fd6, on => { this.up = on; }, 32, true).setDepth(32);
      button(this, W - 90, H - 120, 140, 110, "▼ Down", 0x4b5fd6, on => { this.down = on; }, 32, true).setDepth(32);
      this.altG = this.add.graphics().setDepth(31);
      if (L.free) button(this, 130, H - 60, 200, 72, "✅ DONE", 0x5ccf6a, () => { this.quit = true; }, 28).setDepth(32);
      button(this, 130, H - (L.free ? 150 : 60), 150, 60, "◀ Menu", 0x6b7a90, () => this.scene.start("menu"), 20).setDepth(32);
      this.msg = txt(this, W / 2, 160, "", 28, "#ffffff", { wordWrap: { width: 760 } }).setDepth(35).setAlpha(0);
      this.keys = this.input.keyboard.addKeys("UP,DOWN,SPACE");
      this.toast(s.carrying ? "🌀 Wait for the glowing spot at the north pole, then let Mio go!" : "📷 Fly over a glowing spot, low enough, and tap SNAP!", true);
      window.__mm = this; window.__mmGame = this.game;
    }
    toast(t, speak) { this.toastQ.push(t); if (speak) say(t); }
    update(_, dms) {
      const dt = Math.min(0.05, dms / 1000) * SPEED, s = this.s;
      if (this.ended) return;
      let inp = { up: this.up || this.keys.UP.isDown, down: this.down || this.keys.DOWN.isDown, snap: this.snapTap || Phaser.Input.Keyboard.JustDown(this.keys.SPACE), quit: this.quit };
      this.snapTap = false;
      if (window.__mmBot) inp = R.bot(s, dt, this.mem);
      const n = Math.max(1, Math.ceil(dt / (1 / 30)));
      for (let i = 0; i < n; i++) { R.step(s, dt / n, i ? { up: inp.up, down: inp.down, want: inp.want } : inp); this.handle(s.events); if (s.done) break; }
      this.draw(dt);
      this.msgT -= dt;
      if (this.msgT <= 0 && this.toastQ.length) { this.msg.setText(this.toastQ.shift()).setAlpha(1); this.msgT = 2.4; }
      else if (this.msgT <= 0) this.msg.setAlpha(Math.max(0, this.msg.alpha - 0.05));
      if (s.done) this.finish();
    }
    handle(evs) {
      for (const e of evs) {
        if (e.type === "photo") { S.ding(); this.flashT = 0.25; this.toast("📸 Click! You got " + e.t.name + "!"); }
        else if (e.type === "tooHigh") { S.oops(); this.toast("🔭 Too far away for a good photo! Fly lower (▼)."); }
        else if (e.type === "notHere") { if (e.mio) this.toast("🌀 Not yet! Wait for the glowing spot at the north pole."); }
        else if (e.type === "overheat") { S.oops(); this.cameras.main.shake(250, 0.005); this.toast("🥵 Too hot! Bepi climbs up to cool down. Fly high over the day side!", true); }
        else if (e.type === "mio") { S.yay(); this.ship.setTexture("bepi"); fit(this.ship, 120); this.mioImg.setVisible(true); this.toast("🌀 Bye-bye, Mio! Mio spins off into its own big orbit.", true); this.snapBtn.label.setText("📷 SNAP!"); }
        else if (e.type === "done") { S.yay(); }
      }
    }
    draw(dt) {
      const s = this.s, t = this.time.now / 1000, rr = M.R + s.h;
      const px = a => M.x + Math.cos(a * D2R) * (M.R + 6), py = a => M.y - Math.sin(a * D2R) * (M.R + 6);
      // photo spots on the surface, and the "low enough" line above each one
      const g = this.tgtG.clear(), z = this.zoneG.clear();
      z.lineStyle(3, 0x9fb0ff, 0.35).strokeCircle(M.x, M.y, rr);
      for (const tg of s.targets) {
        if (tg.done) { g.fillStyle(0x5ccf6a, 1).fillCircle(px(tg.a), py(tg.a), 9); continue; }
        const pulse = 1 + 0.25 * Math.sin(t * 5 + tg.a);
        g.lineStyle(6, 0xffd23d, 1).strokeCircle(px(tg.a), py(tg.a), 14 * pulse).fillStyle(0xffd23d, 0.4).fillCircle(px(tg.a), py(tg.a), 12);
        const a0 = (tg.a - 10) * D2R, a1 = (tg.a + 10) * D2R, r = M.R + tg.max;
        z.lineStyle(5, 0xffd23d, 0.65).beginPath().arc(M.x, M.y, r, -a1, -a0).strokePath();
        if (!this.tgtT[tg.a]) this.tgtT[tg.a] = txt(this, 0, 0, "", 17, "#ffe9a8").setDepth(7);
        this.tgtT[tg.a].setText(tg.name).setPosition(M.x + Math.cos(tg.a * D2R) * (M.R + tg.max + 34), M.y - Math.sin(tg.a * D2R) * (M.R + tg.max + 34));
      }
      for (const k in this.tgtT) { const tg = s.targets.find(q => String(q.a) === k); if (!tg || tg.done) this.tgtT[k].setVisible(false); }
      if (s.carrying) {
        const a = s.o.mio, x = M.x + Math.cos(a * D2R) * rr, y = M.y - Math.sin(a * D2R) * rr;
        g.lineStyle(7, 0x9ff0ff, 1).strokeCircle(x, y, 36 + 6 * Math.sin(t * 5));
      }
      // Bepi: its orbit goes over the poles
      const x = M.x + Math.cos(s.ang * D2R) * rr, y = M.y - Math.sin(s.ang * D2R) * rr;
      this.ship.setPosition(x, y).setRotation(Math.sin(t * 1.5) * 0.08);     // Bepi keeps its face toward us
      if (s.cool > 0) this.ship.setTint(0xff9a9a); else this.ship.clearTint();
      if (s.mioGone) {
        const a = s.mioAng * D2R;
        this.mioImg.setPosition(M.x + 40 + Math.cos(a) * 520, M.y - Math.sin(a) * 300).setRotation(t * 4);
      }
      // panel
      this.photoT.setText(s.carrying ? "🌀 Let Mio go first!" : "📸 Photos: " + s.photos + (this.L.free ? "" : " / " + s.targets.length));
      const hg = this.heatG.clear();
      if (s.o.heat) {
        hg.fillStyle(0xe3e6f7, 1).fillRoundedRect(70, 106, 280, 20, 10);
        hg.fillStyle(s.heat > 75 ? 0xff5a6a : s.heat > 45 ? 0xf2a516 : 0x5ccf6a, 1).fillRoundedRect(70, 106, Math.max(8, 280 * s.heat / 100), 20, 10);
      }
      // height meter next to the up/down buttons
      const ag = this.altG.clear(), top = 170, bot = H - 330, k = (s.h - R.ALT.min) / (R.ALT.max - R.ALT.min);
      ag.fillStyle(0xffffff, 0.85).fillRoundedRect(W - 104, top - 10, 28, bot - top + 20, 14);
      ag.fillStyle(0x4b5fd6, 1).fillCircle(W - 90, bot - k * (bot - top), 14);
      this.flashT = Math.max(0, this.flashT - dt); this.flashR.setFillStyle(0xffffff, this.flashT * 2.4);
      this.snapBtn.fill = s.near ? 0x5ccf6a : 0xf2a516; this.snapBtn.redraw(this.snapBtn.held);
    }
    finish() {
      if (this.ended) return; this.ended = true;
      const r = this.s.result, sv = save.get();
      if (this.L.free) { if (r.photos > (sv.best || 0)) sv.best = r.photos; }
      else sv.stars[this.L.k] = Math.max(sv.stars[this.L.k] || 0, r.stars);
      save.set(sv);
      this.time.delayedCall(1200, () => this.scene.start("result", { level: this.li, r, kind: "orbit" }));
    }
  }

  /* ============================================================ RESULT */
  class Result extends Phaser.Scene {
    constructor() { super("result"); }
    init(d) { this.d = d; }
    create() {
      const { level, r, kind } = this.d, L = level < 0 ? R.FREE : LEVELS[level];
      this.cameras.main.setBackgroundColor("#0e1338");
      starfield(this, 120, 0, 0, W, H);
      panel(this, W / 2, H / 2, 900, 560, kind === "orbit" ? 0xf2a516 : 0x4b5fd6);
      txt(this, W / 2, 130, L.free ? "Free Orbit" : (r.stars >= 3 ? "Amazing! 🎉" : r.stars === 2 ? "Great job! 👏" : "You did it! 👍"), 52, "#0e1338", { strokeThickness: 0 });
      if (!L.free) txt(this, W / 2, 210, "★".repeat(r.stars) + "☆".repeat(3 - r.stars), 72, "#ffc41f", { stroke: "#8a6a10", strokeThickness: 5 });
      let lines;
      if (kind === "cruise") lines = ["🤲 Mercury caught you!", "🪐 Flybys: " + r.flybys + "  (perfect: " + r.perfect + ")",
        r.laps ? "🔁 Extra loops: " + r.laps + "  (brake earlier, and tap FLYBY in the middle of the ring)" : "🔁 No extra loops. Right on time!", "⛽ Fuel left: " + r.fuel + "%"];
      else lines = ["📸 Photos: " + r.photos, r.hot ? "🥵 Too hot " + r.hot + " time" + (r.hot > 1 ? "s" : "") + " (fly high over the day side)" : "😎 Never too hot. Cool flying!"].concat(r.mio ? ["🌀 Mio is on its own orbit!"] : []);
      txt(this, W / 2, 330, lines.join("\n"), 26, "#0e1338", { strokeThickness: 0, lineSpacing: 10 });
      txt(this, W / 2, 470, "💡 " + FACTS[L.k], 22, "#4b5fd6", { strokeThickness: 0, wordWrap: { width: 780 } });
      const next = level >= 0 && level < LEVELS.length - 1 ? level + 1 : null;
      button(this, 330, 590, 240, 72, "☰ Menu", 0x6b7a90, () => this.scene.start("menu"), 26);
      button(this, 620, 590, 260, 72, "🔁 Again", 0x4b5fd6, () => this.scene.start(kind === "orbit" ? "orbit" : "cruise", { level }), 26);
      if (next != null) button(this, 920, 590, 280, 72, "Next ▶", 0xf2a516, () => this.scene.start("brief", { level: next }), 28);
      if (r.stars >= 2) { S.yay(); if (window.Book && Book.confetti) Book.confetti(90); }
      window.__mmResult = r;
    }
  }

  window.MercuryMission = {
    start() {
      const timer = /[?&]timer=1/.test(location.search);
      return new Phaser.Game({
        type: Phaser.AUTO, parent: "game", width: W, height: H, backgroundColor: "#0e1338",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        fps: timer ? { forceSetTimeOut: true, target: 30 } : undefined,
        scene: [Boot, Menu, Brief, Cruise, CHud, Orbit, Result],
      });
    },
  };
})();
