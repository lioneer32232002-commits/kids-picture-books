/* Typhoon Chasers! — chase a typhoon with Swoop and get Mei's home ready (Phaser 3).
   The rules, missions and test bot live in sim.js. This file draws:
   - Chase: a top-down sea map (coastlines from currents/geo.js), a spinning typhoon, wind streaks that show the
     counterclockwise spin, glowing drop rings, thunderstorm cells; a HUD scene with the mini-map and forecast cone.
   - Get Ready: the front of Mei's house; Mei walks out to fetch things, Grandpa takes things off the balcony;
     on Typhoon Night the lights go out (find things with the flashlight) and then the eye passes over.
   Nothing gets hurt: bumps only shake Swoop, and things that blow away just roll off the screen. */
(function () {
  "use strict";
  const W = 1280, H = 720;
  const FONT = '"Baloo 2", "Trebuchet MS", sans-serif';
  const S = (window.Book && Book.sfx) || new Proxy({}, { get: () => () => {} });
  const R = window.TyphoonSim, LEVELS = R.LEVELS, D2R = R.D2R, clamp = R.clamp;
  const SPEED = parseFloat((location.search.match(/[?&]speed=([\d.]+)/) || [])[1]) || 1;   // test runs only
  const UNLOCK = /[?&]unlock=1/.test(location.search);
  const say = t => { if (window.Book && !Book.muted && Book.speak) Book.speak(t.replace(/[^\x20-\x7E]/g, "")); };
  const ZOOM = 0.6;

  /* ------------------------------------------------------------ save */
  const BLANK = () => ({ stars: {}, best: 0 });
  const save = {
    get() { try { return Object.assign(BLANK(), JSON.parse(localStorage.getItem("tc-save")) || {}); } catch (e) { return BLANK(); } },
    set(v) { try { localStorage.setItem("tc-save", JSON.stringify(v)); } catch (e) {} },
  };
  const totalStars = sv => Object.values(sv.stars).reduce((a, b) => a + b, 0);
  const FACTS = {
    first: "Swoop flies about 13,000 meters up, high above the typhoon's clouds. Real typhoon-chasing jets drop dropsondes all around the storm.",
    ready: "Typhoon winds can blow flower pots, chairs and laundry around. Bring them in early, and the wind can't take them!",
    spin: "North of the equator, typhoon winds spin counterclockwise. Fly the same way and the wind gives you a push: a tailwind!",
    night: "If the wind suddenly stops during a typhoon, it may be the eye. The wind will come back, blowing from the other side.",
    bands: "Rain bands are long arms of cloud that spiral around a typhoon. The thunderstorms inside them make the air very bumpy.",
    big: "The stronger the wind, the more things it can blow away. Look for things that wobble, and save them first!",
    turn: "The Pacific High steers typhoons. When it pulls back east, a typhoon can turn north, away from Taiwan.",
    super: "In a strong typhoon, the wind near the eyewall blows at 184 km/h or more. That's why Swoop stays out of the eyewall!",
    free: "Every dropsonde helps forecasters see where the typhoon will go.",
  };
  const KIT_UI = { flashlight: "🔦", water: "💧", radio: "📻", cans: "🥫" };

  /* ------------------------------------------------------------ helpers */
  function txt(sc, x, y, s, size, color, opts) {
    return sc.add.text(x, y, s, Object.assign({ fontFamily: FONT, fontSize: size + "px", fontStyle: "800", color: color || "#fff",
      stroke: "#1d3354", strokeThickness: Math.max(3, size / 6), align: "center" }, opts || {})).setOrigin(0.5);
  }
  function button(sc, x, y, w, h, label, fill, onClick, size) {
    const c = sc.add.container(x, y), g = sc.add.graphics();
    const draw = d => { g.clear(); g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, Math.min(h / 2, 26));
      g.fillStyle(c.fill || fill, 1).fillRoundedRect(-w / 2, -h / 2 + (d ? 5 : 0), w, h, Math.min(h / 2, 26));
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
    g.fillStyle(0xf6f9ff, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    g.lineStyle(6, color || 0x3b7dd8, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    return g;
  }
  const rand = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  // a soft round brush, for painting clouds into canvas textures
  function blob(c, x, y, r, a, col) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(" + col + "," + a + ")"); g.addColorStop(1, "rgba(" + col + ",0)");
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  }

  /* ============================================================ BOOT */
  const ART = ["swoop", "swoop_top", "sonde", "mei", "mei_light", "grandpa", "bg_home", "p07", "p05",
    "pot", "tree", "bike", "chair", "chime", "bin", "umbrella", "laundry", "flashlight", "water", "radio", "cans"];
  class Boot extends Phaser.Scene {
    constructor() { super("boot"); }
    preload() {
      txt(this, W / 2, H / 2 - 60, "Getting Swoop ready...", 40);
      const bar = this.add.graphics();
      this.load.on("progress", v => bar.clear().fillStyle(0xffffff, .3).fillRoundedRect(440, H / 2, 400, 28, 14).fillStyle(0xf2a516, 1).fillRoundedRect(440, H / 2, 400 * v, 28, 14));
      ART.forEach(k => this.load.image(k, "img/" + k + ".webp"));
    }
    create() {
      const mk = (k, w, h, draw) => { if (this.textures.exists(k)) return; const g = this.make.graphics({ add: false }); draw(g); g.generateTexture(k, w, h); g.destroy(); };
      // stand-ins when an illustration is missing, so the game never breaks
      ART.forEach(k => mk(k, 64, 64, g => g.fillStyle(0xffffff, 1).fillCircle(32, 32, 30)));
      mk("glow", 64, 64, g => { for (let r = 32; r > 0; r -= 2) g.fillStyle(0xffffff, 0.05).fillCircle(32, 32, r); });
      // the typhoon seen from above: spiral arms that curl clockwise going outward, so the winds spin counterclockwise
      const ST = this.textures.createCanvas("storm", 1024, 1024), c = ST.getContext(), M = 512, RR = 500, eye = RR * 0.185;
      const haze = c.createRadialGradient(M, M, eye, M, M, RR);
      haze.addColorStop(0, "rgba(255,255,255,0.5)"); haze.addColorStop(0.55, "rgba(235,242,255,0.28)"); haze.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = haze; c.beginPath(); c.arc(M, M, RR, 0, 6.2832); c.fill();
      for (let a = 0; a < 5; a++) {
        const th0 = a / 5 * 6.2832;
        for (let i = 0; i < 170; i++) {
          const k = i / 170, r = eye * 1.25 + (RR * 0.97 - eye * 1.25) * k, th = th0 + 2.7 * k;
          blob(c, M + Math.cos(th) * r, M + Math.sin(th) * r, 46 * (1 - k * 0.55), 0.34 * (1 - k * 0.75), "255,255,255");
        }
      }
      for (let i = 0; i < 60; i++) { const th = i / 60 * 6.2832; blob(c, M + Math.cos(th) * eye * 1.2, M + Math.sin(th) * eye * 1.2, 44, 0.55, "255,255,255"); }
      c.globalCompositeOperation = "destination-out";
      const hole = c.createRadialGradient(M, M, 0, M, M, eye * 0.95);
      hole.addColorStop(0, "rgba(0,0,0,1)"); hole.addColorStop(0.7, "rgba(0,0,0,0.9)"); hole.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = hole; c.beginPath(); c.arc(M, M, eye, 0, 6.2832); c.fill();
      c.globalCompositeOperation = "source-over"; ST.refresh();
      // a thunderstorm cell: dark puffy cloud with a red-hot middle (no face)
      const CT = this.textures.createCanvas("cell", 256, 256), cc = CT.getContext();
      [[128, 128, 110], [80, 110, 70], [170, 100, 70], [120, 175, 70], [180, 160, 60]].forEach(([x, y, r]) => blob(cc, x, y, r, 0.85, "70,78,104"));
      blob(cc, 128, 128, 70, 0.75, "255,90,70"); blob(cc, 128, 128, 34, 0.85, "255,210,90");
      CT.refresh();
      // a flashlight beam: soft white disc that erases the darkness
      const LT = this.textures.createCanvas("light", 300, 300), lc = LT.getContext();
      const lg = lc.createRadialGradient(150, 150, 40, 150, 150, 150); lg.addColorStop(0, "rgba(255,255,255,1)"); lg.addColorStop(1, "rgba(255,255,255,0)");
      lc.fillStyle = lg; lc.fillRect(0, 0, 300, 300); LT.refresh();
      this.scene.start("menu");
    }
  }

  /* ============================================================ MENU */
  class Menu extends Phaser.Scene {
    constructor() { super("menu"); }
    create() {
      const sv = save.get();
      const g = this.add.graphics();
      g.fillGradientStyle(0x7fb8f0, 0x7fb8f0, 0xdbeaff, 0xdbeaff, 1).fillRect(0, 0, W, H);
      g.fillStyle(0x3f73b8, 1).fillRect(0, 620, W, 100);
      const sw = this.add.image(W / 2 + 470, 610, "storm").setScale(0.5).setAlpha(0.9);
      this.tweens.add({ targets: sw, angle: -360, duration: 20000, repeat: -1 });
      const pl = fit(this.add.image(170, 105, "swoop"), 250).setAngle(-6), mei = fit(this.add.image(1150, 120, "mei"), 170);
      this.tweens.add({ targets: [pl, mei], y: "-=10", duration: 1300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      txt(this, W / 2, 70, "Typhoon Chasers!", 76, "#ffffff", { stroke: "#2f5fa8", strokeThickness: 12 });
      txt(this, W / 2, 132, "Chase typhoons with Swoop, and get Mei's home ready.  ⭐ " + totalStars(sv) + " / " + LEVELS.length * 3, 24, "#1d3354", { strokeThickness: 0 });
      LEVELS.forEach((L, i) => {
        const x = 205 + (i % 4) * 290, y = 240 + Math.floor(i / 4) * 170;
        const open = UNLOCK || i === 0 || (sv.stars[LEVELS[i - 1].k] || 0) > 0;
        const c = this.add.container(x, y), bg = this.add.graphics(), home = L.kind === "home";
        bg.fillStyle(0x000000, 0.2).fillRoundedRect(-130, -66, 260, 140, 26);
        bg.fillStyle(open ? 0xf6f9ff : 0xd9dee6, 1).fillRoundedRect(-130, -72, 260, 140, 26);
        bg.lineStyle(5, home ? 0xf2a516 : 0x3b7dd8, 1).strokeRoundedRect(-130, -72, 260, 140, 26);
        c.add(bg);
        if (L.night) c.add(txt(this, 104, -48, "🌙", 26, "#fff", { strokeThickness: 0 }));
        c.add(fit(this.add.image(-78, -16, home ? "mei" : "swoop"), home ? 80 : 96).setAlpha(open ? 1 : 0.4));
        c.add(txt(this, 38, -38, String(i + 1), 34, open ? (home ? "#d88a00" : "#3b7dd8") : "#9aa3b0", { strokeThickness: 0 }));
        c.add(txt(this, 0, 26, L.name, 23, open ? "#1d3354" : "#9aa3b0", { strokeThickness: 0, wordWrap: { width: 240 } }));
        const st = sv.stars[L.k] || 0;
        c.add(txt(this, 38, -6, open ? "★".repeat(st) + "☆".repeat(3 - st) : "🔒", 28, "#ffc41f", { strokeThickness: 3, stroke: "#8a6a10" }));
        if (open) {
          c.setSize(260, 140).setInteractive({ useHandCursor: true });
          c.on("pointerover", () => c.setScale(1.04)); c.on("pointerout", () => c.setScale(1));
          c.on("pointerup", () => { S.whoosh(); this.scene.start("brief", { level: i }); });
        }
      });
      button(this, W / 2, 640, 520, 76, "🌀 Free Chase  (best: " + (sv.best || 0) + " 📡)", 0x3b7dd8, () => this.scene.start("brief", { level: -1 }), 28);
    }
  }

  /* ============================================================ BRIEFING */
  class Brief extends Phaser.Scene {
    constructor() { super("brief"); }
    init(d) { this.li = d.level; }
    create() {
      const L = this.li < 0 ? R.FREE : LEVELS[this.li], home = L.kind === "home";
      this.cameras.main.setBackgroundColor(L.night ? "#1b2a55" : "#86b8ee");
      panel(this, W / 2, H / 2, 1060, 600, home ? 0xf2a516 : 0x3b7dd8);
      txt(this, W / 2, 110, (this.li < 0 ? "" : "Mission " + (this.li + 1) + ": ") + L.name, 46, "#1d3354", { strokeThickness: 0 });
      fit(this.add.image(260, 320, home ? "mei" : "swoop"), home ? 230 : 280);
      if (!home) txt(this, 260, 470, "🌀 " + L.strength + " typhoon", 26, "#3b7dd8", { strokeThickness: 0 });
      txt(this, 760, 250, L.intro, 28, "#1d3354", { strokeThickness: 0, wordWrap: { width: 620 }, align: "left" });
      txt(this, 760, 450, "💡 " + FACTS[L.k], 23, "#2f6fb8", { strokeThickness: 0, wordWrap: { width: 620 }, align: "left" });
      button(this, 520, 630, 260, 74, "◀ Back", 0x6b7a90, () => this.scene.start("menu"), 28);
      button(this, 800, 630, 300, 74, "Let's go! ▶", 0xf2a516, () => this.scene.start(home ? "home" : "chase", { level: this.li }), 30);
      say(L.intro);
    }
  }

  /* ============================================================ CHASE */
  class Chase extends Phaser.Scene {
    constructor() { super("chase"); }
    init(d) { this.li = d.level; }
    create() {
      const L = this.li < 0 ? R.FREE : LEVELS[this.li];
      this.L = L; this.s = R.create(L); this.mem = {}; this.aim = null; this.ended = false; this.toastQ = [];
      const s = this.s, cam = this.cameras.main, B = R.BOUNDS;
      cam.setBackgroundColor("#2f6fae").setZoom(ZOOM);
      cam.setBounds(B.x0 - 500, B.y0 - 500, B.x1 - B.x0 + 1000, B.y1 - B.y0 + 1000);
      // sea sparkles and the land
      const sea = this.add.graphics().setDepth(0);
      for (let i = 0; i < 260; i++) { sea.fillStyle(0xffffff, 0.08 + rand() * 0.1).fillCircle(B.x0 - 400 + rand() * (B.x1 - B.x0 + 800), B.y0 - 400 + rand() * (B.y1 - B.y0 + 800), 3 + rand() * 6); }
      const land = this.add.graphics().setDepth(1);
      for (const k in R.LAND_PX) {
        const far = k !== "taiwan" && !["penghu", "lanyu", "green", "turtle", "liuqiu", "matsu", "kinmen"].includes(k);
        land.fillStyle(far ? 0xe3dcc0 : 0x9fd27a, 1).lineStyle(8, far ? 0xc3b78f : 0x6fae52, 1);
        land.fillPoints(R.LAND_PX[k], true).strokePoints(R.LAND_PX[k], true);
      }
      const tw = R.at(120.95, 23.6); txt(this, tw.x - 40, tw.y, "Taiwan", 64, "#ffffff", { stroke: "#4f8a3a", strokeThickness: 10 }).setDepth(2);
      const BS = R.BASE;
      land.fillStyle(0xffffff, 1).fillCircle(BS.x, BS.y, 46).lineStyle(8, 0xf2a516, 1).strokeCircle(BS.x, BS.y, BS.r);
      txt(this, BS.x, BS.y, "✈", 50, "#f2a516", { strokeThickness: 0 }).setDepth(2);
      txt(this, BS.x, BS.y + 100, "Taichung", 44, "#ffffff", { stroke: "#1d3354", strokeThickness: 8 }).setDepth(2);
      // the typhoon
      this.storm = this.add.image(0, 0, "storm").setDepth(5);
      this.storm.setScale(s.st.Rs * 2.1 / 1024);
      this.eyeG = this.add.graphics().setDepth(6);
      this.streaks = []; this.streakG = this.add.graphics().setDepth(7);
      for (let i = 0; i < 150; i++) this.streaks.push({ x: 0, y: 0, life: 0, max: 1 });
      this.ringG = this.add.graphics().setDepth(8);
      this.ringIcons = [];
      this.cellImgs = s.cells.map(c => this.add.image(c.x, c.y, "cell").setDepth(9).setScale(c.r * 2.6 / 256));
      this.boltG = this.add.graphics().setDepth(9.5);
      this.navG = this.add.graphics().setDepth(10);
      // Swoop and its shadow on the clouds
      this.shadow = fit(this.add.image(0, 0, "swoop_top"), 120).setTint(0x000000).setAlpha(0.22).setDepth(11);
      this.plane = fit(this.add.image(0, 0, "swoop_top"), 120).setDepth(12);
      cam.startFollow(this.plane, true, 0.08, 0.08);
      // input: hold a finger where you want to fly
      this.input.on("pointerdown", p => { if (!this.hud || !this.hud.hit(p)) this.aimPtr = p; });
      this.input.on("pointerup", () => { this.aimPtr = null; });
      this.keys = this.input.keyboard.createCursorKeys();
      this.scene.launch("hud", { chase: this });
      this.hud = this.scene.get("hud");
      this.elapsedT = 0; this.goHome = false;
      this.toast(this.L.free ? "🌀 Fly through the rings! Press 🏠 HOME when you're done." : "✈️ Touch where you want to fly. Find the glowing rings!");
      window.__tcGame = this.game; window.__tc = this;
      this.events.once("shutdown", () => { this.scene.stop("hud"); });
    }
    toast(t, speak) { this.toastQ.push(t); if (speak) say(t); }
    update(_, dms) {
      const dt = Math.min(0.05, dms / 1000) * SPEED, s = this.s;
      if (this.ended) return;
      // controls
      let inp = {};
      if (window.__tcBot) inp = R.bot(s, dt, this.mem);
      else if (this.aimPtr && this.aimPtr.isDown) { const p = this.cameras.main.getWorldPoint(this.aimPtr.x, this.aimPtr.y); inp.aim = { x: p.x, y: p.y }; }
      else if (this.keys.left.isDown) inp.turn = -1; else if (this.keys.right.isDown) inp.turn = 1;
      if (this.goHome) inp.goHome = true;
      const n = Math.max(1, Math.ceil(dt / (1 / 30)));
      for (let i = 0; i < n; i++) { R.step(s, dt / n, inp); this.handle(s.events); if (s.done) break; }
      this.draw(dt);
      if (s.done) this.finish();
    }
    handle(evs) {
      for (const e of evs) {
        if (e.type === "drop") {
          S.whoosh(); const sd = fit(this.add.image(e.x, e.y, "sonde"), 110).setDepth(8.5);
          this.tweens.add({ targets: sd, scale: sd.scale * 0.35, alpha: 0, x: e.x + (this.s.wind ? this.s.wind.x * 1.4 : 0), y: e.y + (this.s.wind ? this.s.wind.y * 1.4 : 0), duration: 2200, onComplete: () => sd.destroy() });
          this.time.delayedCall(800, () => S.tick());
          this.toast("📡 Dropsonde " + e.n + (this.s.need < 99 ? " of " + this.s.need : "") + "! Wind: " + e.kmh + " km/h. 📡 Sent!");
        } else if (e.type === "bump") {
          S.oops(); this.cameras.main.shake(260, 0.006);
          this.toast(e.why === "eyewall" ? "😵 Too bumpy! Stay out of the eyewall." : "⚡ Bumpy thunderstorm! Fly around the red clouds.");
        } else if (e.type === "allDropped") { S.yay(); this.toast("🎉 All dropsondes sent! Follow the pink line home to Taichung.", true); }
        else if (e.type === "lowFuel") { S.ding(); this.toast("⛽ Fuel is getting low!"); }
        else if (e.type === "outOfFuel") { this.toast(this.L.free ? "🏠 Heading home!" : "⛽ Out of fuel! The autopilot flies Swoop home."); }
      }
    }
    draw(dt) {
      const s = this.s, st = s.st, cam = this.cameras.main;
      this.storm.setPosition(st.x, st.y).setRotation(st.spin);
      // the eyewall no-fly ring
      const eg = this.eyeG.clear(), rr = st.Re + R.EYE_MARGIN, t = this.time.now / 1000;
      for (let i = 0; i < 36; i++) { const a0 = i / 36 * 6.2832 + st.spin; eg.lineStyle(10, 0xff5a6a, 0.55).beginPath().arc(st.x, st.y, rr, a0, a0 + 0.1).strokePath(); }
      // wind streaks: little lines carried by the wind, so you can see the spin
      const v = cam.worldView, sg = this.streakG.clear();
      for (const p of this.streaks) {
        if ((p.life += dt) > p.max || p.x < v.x - 100 || p.x > v.right + 100 || p.y < v.y - 100 || p.y > v.bottom + 100) {
          p.x = v.x + rand() * v.width; p.y = v.y + rand() * v.height; p.life = 0; p.max = 0.8 + rand() * 1.4;
        }
        const w = R.wind(st, p.x, p.y); p.x += w.x * dt; p.y += w.y * dt;
        const a = Math.min(1, 0.25 + w.v / 140) * Math.sin(Math.PI * p.life / p.max) * 0.85;
        if (a > 0.03 && w.v > 15) sg.lineStyle(9, 0xdff1ff, a).lineBetween(p.x - w.x * 0.3, p.y - w.y * 0.3, p.x, p.y);
      }
      // rings
      const rg = this.ringG.clear(), pulse = 1 + 0.1 * Math.sin(t * 5);
      s.rings.forEach((r, i) => {
        if (r.done) { if (this.ringIcons[i]) { this.ringIcons[i].destroy(); this.ringIcons[i] = null; } return; }
        rg.fillStyle(0xffd23d, 0.18).fillCircle(r.x, r.y, R.PLANE.ringR * pulse);
        rg.lineStyle(10, 0xffd23d, 0.95).strokeCircle(r.x, r.y, R.PLANE.ringR * pulse);
        if (!this.ringIcons[i]) this.ringIcons[i] = fit(this.add.image(r.x, r.y, "sonde"), 70).setDepth(8.2);
        this.ringIcons[i].setPosition(r.x, r.y);
      });
      // thunderstorms, with a flash of lightning now and then
      const bg = this.boltG.clear();
      s.cells.forEach((c, i) => {
        this.cellImgs[i].setPosition(c.x, c.y).setRotation(st.spin * 0.5 + i);
        if (Math.sin(t * 3.1 + i * 1.7) > 0.985) {
          bg.lineStyle(7, 0xfff3a0, 1).beginPath().moveTo(c.x - 10, c.y - 40);
          bg.lineTo(c.x + 12, c.y - 8).lineTo(c.x - 8, c.y + 4).lineTo(c.x + 14, c.y + 44).strokePath();
        }
      });
      // GPS line home
      const ng = this.navG.clear();
      if (s.home || s.outOfFuel) {
        const B = R.BASE, d = Math.hypot(B.x - s.x, B.y - s.y), n = Math.floor(d / 60);
        for (let i = 1; i < n; i++) { const k = i / n; ng.fillStyle(0xff3fa4, 0.9).fillCircle(s.x + (B.x - s.x) * k, s.y + (B.y - s.y) * k, 9); }
      }
      // Swoop: nose points where it is heading; the shadow drifts below
      const bank = this.aimPtr ? 1.06 : 1;
      this.plane.setPosition(s.x, s.y).setRotation(s.a + Math.PI / 2);
      this.plane.scaleX = this.plane.scaleY * (2 - bank);
      this.shadow.setPosition(s.x + 40, s.y + 55).setRotation(s.a + Math.PI / 2);
      if (s.bumpCD > 1.2) this.plane.setTint(0xffb0b0); else this.plane.clearTint();
    }
    finish() {
      if (this.ended) return; this.ended = true;
      const s = this.s, r = s.result;
      if (this.L.free) { const sv = save.get(); if (s.drops > (sv.best || 0)) { sv.best = s.drops; save.set(sv); } }
      else if (r.stars) { const sv = save.get(); sv.stars[this.L.k] = Math.max(sv.stars[this.L.k] || 0, r.stars); save.set(sv); }
      this.time.delayedCall(700, () => this.scene.start("result", { level: this.li, r, kind: "chase" }));
    }
  }

  /* ============================================================ CHASE HUD (mini-map, fuel, messages) */
  class Hud extends Phaser.Scene {
    constructor() { super("hud"); }
    init(d) { this.chase = d.chase; }
    create() {
      const c = this.chase, s = c.s, L = c.L, B = R.BOUNDS;
      // top-left box
      const box = this.add.graphics();
      box.fillStyle(0xffffff, 0.92).fillRoundedRect(14, 14, 380, 118, 22);
      this.title = txt(this, 30, 38, L.name, 24, "#1d3354", { strokeThickness: 0 }).setOrigin(0, 0.5);
      this.drops = txt(this, 30, 76, "", 30, "#1d3354", { strokeThickness: 0 }).setOrigin(0, 0.5);
      this.fuelG = this.add.graphics();
      this.fuelT = txt(this, 30, 112, "⛽", 22, "#1d3354", { strokeThickness: 0 }).setOrigin(0, 0.5);
      this.windT = txt(this, W / 2, H - 40, "", 30, "#ffffff");
      // mini-map, top right
      const mw = 230, mh = mw * (B.y1 - B.y0) / (B.x1 - B.x0), mx = W - mw - 16, my = 14;
      this.mm = { mw, mh, mx, my, k: mw / (B.x1 - B.x0) };
      this.mmRect = new Phaser.Geom.Rectangle(mx, my, mw, mh);
      const mg = this.add.graphics();
      mg.fillStyle(0x000000, 0.25).fillRoundedRect(mx - 4, my + 4, mw + 8, mh + 8, 16);
      mg.fillStyle(0x3f84c6, 1).fillRoundedRect(mx - 4, my - 4, mw + 8, mh + 8, 16);
      const P = p => [mx + (p.x - B.x0) * this.mm.k, my + (p.y - B.y0) * this.mm.k];
      for (const k in R.LAND_PX) {
        const pts = R.LAND_PX[k].map(p => { const q = P(p); return { x: clamp(q[0], mx, mx + mw), y: clamp(q[1], my, my + mh) }; });
        mg.fillStyle(k === "taiwan" ? 0x9fd27a : 0xe3dcc0, 1).fillPoints(pts, true);
      }
      if (L.k === "turn") { const h = P(R.at(127.6, 23.5)); txt(this, h[0] - 6, h[1], "H", 34, "#c25e00", { stroke: "#fff", strokeThickness: 5 }); txt(this, h[0] - 30, h[1] + 30, "Pacific\nHigh", 14, "#c25e00", { stroke: "#fff", strokeThickness: 3 }); }
      this.P = P; this.mmG = this.add.graphics();
      this.msg = txt(this, W / 2 - 60, 170, "", 28, "#ffffff", { wordWrap: { width: 760 } }).setAlpha(0);
      if (L.free) button(this, 120, H - 60, 200, 70, "🏠 HOME", 0xf2a516, () => { c.goHome = true; }, 28);
      this.backBtn = button(this, W - 70, H - 50, 110, 60, "◀ Menu", 0x6b7a90, () => this.chase.scene.start("menu"), 20);
      this.msgT = 0;
    }
    hit(p) { return this.mmRect.contains(p.x, p.y) || (p.y > H - 100 && (p.x < 240 || p.x > W - 140)); }
    update(_, dms) {
      const c = this.chase, s = c.s, L = c.L;
      if (!s) return;
      this.drops.setText("📡 " + s.drops + (L.free ? "" : " / " + s.need) + (s.home ? "  ✅ Fly home!" : ""));
      const fg = this.fuelG.clear();
      if (L.fuel) {
        fg.fillStyle(0xe3ecf7, 1).fillRoundedRect(70, 102, 300, 20, 10);
        fg.fillStyle(s.fuel < 25 ? 0xff5a6a : 0x5ccf6a, 1).fillRoundedRect(70, 102, 300 * s.fuel / 100, 20, 10);
      } else this.fuelT.setText("⛽ Free Chase: no fuel to worry about");
      // tailwind or headwind?
      const air = R.PLANE.air, gs = s.gs || air;
      this.windT.setText(gs > air * 1.3 ? "🚀 Tailwind! The typhoon is pushing you!" : gs < air * 0.7 ? "🐢 Headwind... try flying the other way around!" : "");
      // mini-map: storm, forecast cone, rings, Swoop, home
      const g = this.mmG.clear(), st = s.st, k = this.mm.k, P = this.P;
      const sp = P(st), cw = R.coneWidth(s), dir = st.dir || 0, len = 0.9 * st.Rs * k * 2.2;
      const ax = Math.cos(dir), ay = Math.sin(dir), wdt = len * 0.75 * cw;
      g.fillStyle(0xff5a8a, 0.35).fillTriangle(sp[0], sp[1], sp[0] + ax * len - ay * wdt, sp[1] + ay * len + ax * wdt, sp[0] + ax * len + ay * wdt, sp[1] + ay * len - ax * wdt);
      g.fillStyle(0xffffff, 0.55).fillCircle(sp[0], sp[1], st.Rs * k);
      g.fillStyle(0x3f84c6, 1).fillCircle(sp[0], sp[1], 3);
      for (const r of s.rings) if (!r.done) { const q = P(r); g.fillStyle(0xffd23d, 1).fillCircle(q[0], q[1], 4); }
      for (const cl of s.cells) { const q = P(cl); g.fillStyle(0xff5a6a, 1).fillCircle(q[0], q[1], 3); }
      const bq = P(R.BASE); g.fillStyle(0xf2a516, 1).fillCircle(bq[0], bq[1], 5);
      const pq = P(s); g.fillStyle(0xffffff, 1).fillCircle(pq[0], pq[1], 6).fillStyle(0xff3fa4, 1).fillCircle(pq[0], pq[1], 4);
      // one message at a time
      this.msgT -= dms / 1000;
      if (this.msgT <= 0 && c.toastQ.length) { this.msg.setText(c.toastQ.shift()).setAlpha(1); this.msgT = 2.6; }
      else if (this.msgT <= 0) this.msg.setAlpha(Math.max(0, this.msg.alpha - 0.05));
    }
  }

  /* ============================================================ GET READY (and Typhoon Night) */
  class Home extends Phaser.Scene {
    constructor() { super("home"); }
    init(d) { this.li = d.level; }
    create() {
      const L = LEVELS[this.li], s = R.create(L);
      // the scene object is reused between runs: forget the last run's lights-out layer and buttons
      Object.assign(this, { L, s, mem: {}, ended: false, taps: [], choice: null, msgT: 0, toastQ: [], dark: null, eyeBtns: null, foundT: {}, findBox: [] });
      this.bg = this.add.image(W / 2, H / 2, "bg_home").setDisplaySize(W, H);
      this.sky = this.add.rectangle(W / 2, H / 2, W, H, 0x1d2a44, 0).setDepth(1);
      this.rainG = this.add.graphics().setDepth(30); this.rain = [];
      for (let i = 0; i < 160; i++) this.rain.push({ x: rand() * W, y: rand() * H, v: 600 + rand() * 400 });
      // things in the yard and on the balcony
      const SIZE = { pot: 100, tree: 140, bike: 170, chair: 110, chime: 90, bin: 110, umbrella: 130, laundry: 120 };
      this.items = s.items.map(it => {
        const im = fit(this.add.image(it.x, it.y, it.k), SIZE[it.k]).setOrigin(0.5, 1).setDepth(it.balcony ? 3 : 10 + it.y / 100);
        im.setInteractive({ useHandCursor: true });
        im.on("pointerdown", () => this.taps.push({ item: it.i }));
        const warn = txt(this, it.x, it.y - im.displayHeight - 26, "❗", 34, "#fff", { strokeThickness: 0 }).setDepth(40).setVisible(false);
        const tag = txt(this, it.x, it.y - im.displayHeight - 26, "", 26, "#fff").setDepth(40);
        return { it, im, warn, tag, h: im.displayHeight };
      });
      this.mei = fit(this.add.image(R.DOOR.x, R.DOOR.y, "mei"), 150).setOrigin(0.5, 1).setDepth(20);
      this.gp = fit(this.add.image(0, 0, "grandpa"), 120).setOrigin(0.5, 1).setDepth(2.5).setVisible(false);
      // the typhoon kit, top left
      const kg = this.add.graphics().setDepth(41);
      kg.fillStyle(0xffffff, 0.92).fillRoundedRect(14, 14, 400, 132, 22);
      txt(this, 30, 38, "🎒 Pack the typhoon kit:", 22, "#1d3354", { strokeThickness: 0 }).setOrigin(0, 0.5).setDepth(42);
      this.kit = R.KIT.map((k, i) => {
        const x = 70 + i * 92, y = 96, im = fit(this.add.image(x, y, k), 70).setDepth(42).setInteractive({ useHandCursor: true });
        im.on("pointerdown", () => this.taps.push({ kit: k }));
        const ck = txt(this, x + 26, y + 22, "✔", 30, "#5ccf6a", { stroke: "#fff", strokeThickness: 5 }).setDepth(43).setVisible(false);
        return { k, im, ck };
      });
      // wind meter, top right
      const wg = this.add.graphics().setDepth(41);
      wg.fillStyle(0xffffff, 0.92).fillRoundedRect(W - 414, 14, 400, 100, 22);
      this.windT = txt(this, W - 214, 40, "", 22, "#1d3354", { strokeThickness: 0 }).setDepth(42);
      this.windG = this.add.graphics().setDepth(42);
      this.msg = txt(this, W / 2, 190, "", 30, "#ffffff", { wordWrap: { width: 900 } }).setDepth(45).setAlpha(0);
      button(this, W - 70, H - 46, 110, 60, "◀ Menu", 0x6b7a90, () => this.scene.start("menu"), 20).setDepth(50);
      this.toast("Tap the things in the yard! Mei will bring them in. 🏠", true);
      window.__tc = this; window.__tcGame = this.game;
    }
    toast(t, speak) { this.toastQ.push(t); if (speak) say(t); }
    update(_, dms) {
      const dt = Math.min(0.05, dms / 1000) * SPEED, s = this.s;
      if (this.ended) return;
      let inp = { taps: this.taps.splice(0) };
      if (this.choice) { inp.choice = this.choice; this.choice = null; }
      if (window.__tcBot) inp = R.bot(s, dt, this.mem);
      // wait for the lights-out and eye pictures before taking taps for them
      if ((s.phase === "dark" && !this.dark) || (s.phase === "eye" && !this.eyeBtns)) inp = {};
      const n = Math.max(1, Math.ceil(dt / (1 / 30)));
      for (let i = 0; i < n; i++) { R.step(s, dt / n, i ? {} : inp); this.handle(s.events); if (s.done) break; }
      this.draw(dt);
      this.msgT -= dt;
      if (this.msgT <= 0 && this.toastQ.length) { this.msg.setText(this.toastQ.shift()).setAlpha(1); this.msgT = 2.4; }
      else if (this.msgT <= 0) this.msg.setAlpha(Math.max(0, this.msg.alpha - 0.05));
      if (s.done) this.finish();
    }
    handle(evs) {
      for (const e of evs) {
        const V = e.it && this.items[e.it.i];
        if (e.type === "queued") { S.pop(); V.tag.setText(e.it.balcony ? "👴" : "👧"); }
        else if (e.type === "wobble") { S.wind(); this.toast("💨 The " + R.ITEMS[e.it.k].name + " is wobbling! Save it!"); }
        else if (e.type === "pick") S.tap();
        else if (e.type === "saved") { S.ding(); V.tag.setText(""); this.tweens.add({ targets: V.im, alpha: 0, scale: V.im.scale * 0.5, duration: 300 }); }
        else if (e.type === "gone") {
          S.whoosh(); V.tag.setText(""); V.warn.setVisible(false);
          const dir = 1;
          this.tweens.add({ targets: V.im, x: V.im.x + dir * 900, y: V.im.y - 160, angle: 540, alpha: 0, duration: 1800, ease: "Quad.in" });
          if (this.s.phase === "prep") this.toast("🌬️ Whoosh! The " + R.ITEMS[e.it.k].name + " blew away.");
        }
        else if (e.type === "pack") { S.ding(); const K = this.kit.find(k => k.k === e.k); K.ck.setVisible(true); this.tweens.add({ targets: K.im, y: K.im.y - 14, yoyo: true, duration: 160 }); }
        else if (e.type === "prepDone") { e.early ? S.yay() : S.rumble(); this.toast(e.early ? "🎉 All ready, before the typhoon came!" : "🌀 Here comes the typhoon! Everyone inside!", true); }
        else if (e.type === "lightsOut") this.time.delayedCall(2200, () => this.startDark());
        else if (e.type === "found") { S.sparkle(); this.toast("✨ You found " + e.name + "!"); this.foundT[e.k].setColor("#5ccf6a").setText("✔ " + e.name); }
        else if (e.type === "eye") this.time.delayedCall(900, () => this.startEye());
        else if (e.type === "notYet") { S.oops(); this.toast("👴 Wait, Mei! It's the eye. The wind will come back soon. Let's stay in.", true); }
        else if (e.type === "stayIn") { S.ding(); this.toast("👍 Good choice! Let's wait and watch...", true); this.time.delayedCall(1600, () => this.windBack()); }
      }
    }
    draw(dt) {
      const s = this.s, t = this.time.now / 1000;
      if (s.phase === "prep") {
        this.sky.setFillStyle(0x1d2a44, 0.45 * s.wind);
        // things wobble more and more before the wind takes them
        for (const V of this.items) {
          const it = V.it;
          if (it.state === "wobble") {
            const k = it.wob / (R.WOBBLE * (this.L.strong ? 0.8 : 1));
            V.im.setAngle(Math.sin(t * (8 + 10 * k)) * (6 + 18 * k)); V.warn.setVisible(Math.sin(t * 10) > -0.3).setPosition(it.x, it.y - V.h - 26);
          } else if (it.state === "idle") V.im.setAngle(Math.sin(t * 2 + it.i) * 3 * s.wind * 2);
          else if (it.state === "carried") { V.im.setPosition(it.x, it.y).setAngle(0).setDepth(21); V.warn.setVisible(false); }
          if (it.state === "idle" || it.state === "wobble") V.tag.setPosition(it.x, it.y - V.h - (V.warn.visible ? 66 : 26));
        }
        // Mei walks; Grandpa pops out on the balcony
        const m = s.mei, walking = m.state === "go" || m.state === "carry" || m.state === "back";
        this.mei.setPosition(m.x, m.y - (walking ? Math.abs(Math.sin(t * 12)) * 8 : 0)).setDepth(10 + m.y / 100 + 0.5);
        this.mei.setVisible(m.state !== "home" || this.s.items.some(it => it.queued && !it.balcony && (it.state === "idle" || it.state === "wobble")));
        const mo = s.mom;
        if (mo.state === "get" && mo.it) this.gp.setVisible(true).setPosition(mo.it.x + (mo.it.x < 640 ? 70 : -70), 268);
        else this.gp.setVisible(false);
        const left = Math.max(0, Math.ceil(this.L.T * (1 - s.wind)));
        this.windT.setText(left > 0 ? "🌀 Typhoon arrives in " + left + " s" : "🌀 The typhoon is here!");
        const g = this.windG.clear();
        g.fillStyle(0xe3ecf7, 1).fillRoundedRect(W - 394, 66, 360, 26, 13);
        g.fillStyle(s.wind > 0.7 ? 0xff5a6a : s.wind > 0.4 ? 0xf2a516 : 0x5ccf6a, 1).fillRoundedRect(W - 394, 66, Math.max(26, 360 * s.wind), 26, 13);
        this.drawRain(dt, s.wind, -1);
      } else if (s.phase === "dark") {
        if (!this.dark) { this.sky.setDepth(25).setFillStyle(0x080c1e, Math.min(0.9, this.sky.fillAlpha + dt * 0.5)); this.drawRain(dt, 0.9, -1); return; }
        const p = this.input.activePointer, lx = window.__tcBot ? W / 2 + Math.sin(t) * 400 : p.x, ly = window.__tcBot ? H / 2 + Math.cos(t * 1.3) * 200 : p.y;
        this.dark.clear().fill(0x080c1e, 0.94).erase("light", lx - 150, ly - 150);
        this.drawRain(dt, 0.8, -1);
      } else if (s.phase === "eye" || s.phase === "back") this.drawRain(dt, s.phase === "back" ? 0.9 : 0, s.phase === "back" ? 1 : -1);
    }
    drawRain(dt, k, dir) {
      const g = this.rainG.clear(), n = Math.floor(this.rain.length * k);
      for (let i = 0; i < n; i++) {
        const r = this.rain[i]; r.y += r.v * dt; r.x += dir * r.v * 0.35 * k * dt;
        if (r.y > H) { r.y = -20; r.x = rand() * W; } if (r.x < -20) r.x = W + 10; if (r.x > W + 20) r.x = -10;
        g.lineStyle(2, 0xcfe6ff, 0.5).lineBetween(r.x, r.y, r.x - dir * 10 * k, r.y - 22);
      }
    }
    startDark() {
      // inside, the power goes out: find things with the flashlight
      this.items.forEach(V => { V.im.setVisible(false); V.warn.setVisible(false); V.tag.setVisible(false); });
      this.mei.setVisible(false); this.gp.setVisible(false); this.sky.setFillStyle(0, 0);
      this.bg.setTexture("p07").setDisplaySize(W, H);
      this.dark = this.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(35);
      this.windT.setText("🔦 Lights out!"); this.windG.clear();
      const hits = this.add.graphics().setDepth(36);
      this.foundT = {};
      const fg = this.add.graphics().setDepth(41); fg.fillStyle(0xffffff, 0.92).fillRoundedRect(W - 330, 130, 316, 40 + 36 * this.L.find.length, 18);
      this.findBox = [fg, txt(this, W - 172, 152, "Find with your flashlight:", 20, "#1d3354", { strokeThickness: 0 }).setDepth(42)];
      this.L.find.forEach(([k, px, py, name], i) => { this.foundT[k] = txt(this, W - 310, 188 + i * 36, "◻ " + name, 22, "#1d3354", { strokeThickness: 0 }).setOrigin(0, 0.5).setDepth(42); });
      this.input.on("pointerdown", p => { if (this.s.phase === "dark") this.taps.push({ x: p.x, y: p.y }); });
      S.tick(); this.toast("🔦 The power went out! Move your finger to shine the flashlight, and tap the things you find.", true);
      hits.setVisible(false);
    }
    startEye() {
      // the eye passes over: calm and blue sky. Go out, or stay in?
      if (this.dark) this.dark.setVisible(false);
      this.bg.setTexture("p05").setDisplaySize(W, H);
      Object.values(this.foundT).concat(this.findBox).forEach(t => t.setVisible(false));
      this.windT.setText("🤫 The wind stopped!");
      this.eyeBtns = [
        button(this, 380, H - 70, 420, 80, "🏃 Go outside to play!", 0xf2a516, () => { this.choice = "out"; }, 28).setDepth(50),
        button(this, 860, H - 70, 360, 80, "🏠 Stay inside", 0x5ccf6a, () => { this.choice = "in"; }, 28).setDepth(50),
      ];
      S.sparkle(); this.toast("Whoa! The wind stopped and the sky is blue. Is the typhoon over? What should Mei do?", true);
    }
    windBack() {
      this.eyeBtns.forEach(b => b.setVisible(false));
      this.sky.setFillStyle(0x2a3550, 0.5).setDepth(1.5);
      this.cameras.main.shake(400, 0.004); S.wind();
      this.toast("💨 The eyewall is back! Now the wind blows from the OTHER side. Good thing we stayed in!", true);
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
      const { level, r, kind } = this.d, L = level < 0 ? R.FREE : LEVELS[level];
      this.cameras.main.setBackgroundColor("#86b8ee");
      panel(this, W / 2, H / 2, 900, 560, kind === "home" ? 0xf2a516 : 0x3b7dd8);
      txt(this, W / 2, 130, L.free ? "Free Chase" : (r.stars >= 3 ? "Amazing! 🎉" : r.stars === 2 ? "Great job! 👏" : "You did it! 👍"), 52, "#1d3354", { strokeThickness: 0 });
      if (!L.free) txt(this, W / 2, 210, "★".repeat(r.stars) + "☆".repeat(3 - r.stars), 72, "#ffc41f", { stroke: "#8a6a10", strokeThickness: 5 });
      let lines;
      if (kind === "chase") lines = L.free ? ["📡 You dropped " + r.drops + " dropsondes!", "💥 Bumps: " + r.bumps] :
        ["📡 Dropsondes: " + r.drops + " / " + r.need, "💥 Bumps: " + r.bumps + (r.bumps ? "  (stay out of the eyewall and the red clouds)" : "  (super smooth!)"),
          r.outOfFuel ? "⛽ Ran out of fuel. Try flying with the spin!" : "⛽ Made it home with fuel to spare."];
      else lines = ["🏠 Brought inside: " + r.saved + " / " + r.total, "🎒 Typhoon kit: " + r.kit + " / 4"].concat(r.eye ? [r.eye === "in" ? "👁️ You stayed inside when the eye passed. Smart!" : "👁️ Remember: when the wind stops, it may be the eye. Stay in!"] : []);
      txt(this, W / 2, 330, lines.join("\n"), 27, "#1d3354", { strokeThickness: 0, lineSpacing: 10 });
      txt(this, W / 2, 470, "💡 " + FACTS[L.k], 22, "#2f6fb8", { strokeThickness: 0, wordWrap: { width: 780 } });
      const next = level >= 0 && level < LEVELS.length - 1 ? level + 1 : null;
      button(this, 330, 590, 240, 72, "☰ Menu", 0x6b7a90, () => this.scene.start("menu"), 26);
      button(this, 620, 590, 260, 72, "🔁 Again", 0x3b7dd8, () => this.scene.start(kind === "home" ? "home" : "chase", { level }), 26);
      if (next != null) button(this, 920, 590, 280, 72, "Next ▶", 0xf2a516, () => this.scene.start("brief", { level: next }), 28);
      if (r.stars >= 2) { S.yay(); if (window.Book && Book.confetti) Book.confetti(90); }
      window.__tcResult = r;
    }
  }

  window.TyphoonChasers = {
    start() {
      const timer = /[?&]timer=1/.test(location.search);
      return new Phaser.Game({
        type: Phaser.AUTO, parent: "game", width: W, height: H, backgroundColor: "#86b8ee",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        fps: timer ? { forceSetTimeOut: true, target: 30 } : undefined,
        scene: [Boot, Menu, Brief, Chase, Hud, Home, Result],
      });
    },
  };
})();
