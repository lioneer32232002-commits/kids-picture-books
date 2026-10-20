/* Sky Rescue! — fly Jetty the little jet and Whirly the rescue helicopter over Taiwan's islands (Phaser 3).
   The world, aircraft and missions live in sim.js; this file draws a top-down map (coastlines from currents/geo.js),
   airports, storms and birds, and the cockpit controls: power lever, gear handle with three lights, care buttons.
   Nothing gets hurt: birds always fly away safely, and a bumpy ride only makes the patient less cozy. */
(function () {
  "use strict";
  const W = 1280, H = 720;
  const FONT = '"Baloo 2", "Trebuchet MS", sans-serif';
  const S = (window.Book && Book.sfx) || new Proxy({}, { get: () => () => {} });
  const R = window.RescueSim, LEVELS = R.LEVELS, A = R.AIRPORTS, D2R = R.D2R, clamp = R.clamp;
  const SPEED = parseFloat((location.search.match(/[?&]speed=([\d.]+)/) || [])[1]) || 1;   // test runs only
  const UNLOCK = /[?&]unlock=1/.test(location.search);
  const muted = () => !!(window.Book && Book.muted);
  const say = t => { if (window.Book && !Book.muted && Book.speak) Book.speak(t.replace(/[^\x20-\x7E]/g, "")); };

  /* ------------------------------------------------------------ save */
  const BLANK = () => ({ stars: {}, stamps: {} });
  const save = {
    get() { try { return Object.assign(BLANK(), JSON.parse(localStorage.getItem("sr-save")) || {}); } catch (e) { return BLANK(); } },
    set(v) { try { localStorage.setItem("sr-save", JSON.stringify(v)); } catch (e) {} },
  };
  const totalStars = sv => Object.values(sv.stars).reduce((a, b) => a + b, 0);
  const FACTS = [
    "Planes take off into the wind. Today the wind blows from the east, so Jetty takes off toward the east on Runway 10!",
    "Medicine that must stay cold rides in a cooler box. A quick, smooth flight keeps it fresh.",
    "An air ambulance is like a tiny flying hospital, with a bed, oxygen and a flight nurse.",
    "Helicopters don't need a runway. Whirly can hover and land right on the H!",
    "Pilots use weather radar to see storms. The purple blobs on your mini-map are storms. Fly around them!",
    "Some rescue pilots wear night-vision goggles, so they can see in the dark.",
    "In winter, a strong wind blows from the northeast. Steer a little into the wind to keep going straight.",
    "Helicopters for tiny islands, jets for long trips. Together they make a great team!",
  ];
  const CARE_UI = { blanket: ["🛏️", "Blanket", 0x6aa8ff], oxygen: ["💨", "Oxygen", 0x2fb6c9], water: ["💧", "Water", 0x4f86f7], check: ["💓", "Check", 0xff6f8f] };
  const HINTS = {
    gear: "🛞 Gear down! Press GEAR and wait for 3 green lights.",
    slow: "🐢 Pull the power lever down to SLOW to land.",
    align: "➡️ Turn to line up with the glowing arrows.",
    approach: "🛬 Fly into the glowing arrows: gear down and SLOW.",
    pad: "🚁 Fly to the glowing H.",
    slowHeli: "🐢 Slow down over the H, then press LAND.",
  };

  /* ------------------------------------------------------------ helpers */
  function txt(sc, x, y, s, size, color, opts) {
    return sc.add.text(x, y, s, Object.assign({ fontFamily: FONT, fontSize: size + "px", fontStyle: "800", color: color || "#fff",
      stroke: "#1d3a52", strokeThickness: Math.max(3, size / 6), align: "center" }, opts || {})).setOrigin(0.5);
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
    g.fillStyle(0xfff8ec, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    g.lineStyle(6, color || 0x139c94, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    return g;
  }
  const rand = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const compass = h => ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"][Math.round(((h % 360) + 360) % 360 / 45) % 8];

  /* ============================================================ BOOT */
  const ART = ["jetty", "jetty_top", "whirly", "whirly_top", "ambulance", "anan", "nurse", "grandma", "storm", "cloud", "gulls", "cooler", "p01"];
  class Boot extends Phaser.Scene {
    constructor() { super("boot"); }
    preload() {
      txt(this, W / 2, H / 2 - 60, "Getting the rescue team ready...", 40);
      const bar = this.add.graphics();
      this.load.on("progress", v => bar.clear().fillStyle(0xffffff, .3).fillRoundedRect(440, H / 2, 400, 28, 14).fillStyle(0xffb020, 1).fillRoundedRect(440, H / 2, 400 * v, 28, 14));
      ART.forEach(k => this.load.image(k, "img/" + k + ".webp"));
    }
    create() {
      const mk = (k, w, h, draw) => { if (this.textures.exists(k)) return; const g = this.make.graphics({ add: false }); draw(g); g.generateTexture(k, w, h); g.destroy(); };
      // stand-ins when an illustration is missing, so the game never breaks
      mk("jetty_top", 200, 200, g => { g.fillStyle(0xffffff, 1).fillEllipse(100, 100, 40, 180).fillTriangle(10, 120, 190, 120, 100, 70); });
      mk("whirly_top", 200, 200, g => { g.fillStyle(0xff7a2f, 1).fillCircle(100, 80, 45).fillRect(92, 100, 16, 90); });
      mk("storm", 300, 220, g => { g.fillStyle(0x5b5f86, 1); [[90, 120, 70], [160, 90, 85], [220, 125, 65]].forEach(c => g.fillCircle(c[0], c[1], c[2])); });
      mk("cloud", 260, 160, g => { g.fillStyle(0xffffff, 1); [[70, 95, 55], [128, 70, 70], [190, 95, 52]].forEach(c => g.fillCircle(c[0], c[1], c[2])); });
      mk("gulls", 160, 120, g => { g.lineStyle(8, 0xffffff, 1); [[40, 40], [110, 30], [80, 90]].forEach(([x, y]) => g.beginPath().arc(x - 12, y, 14, Math.PI * 1.1, Math.PI * 1.9).strokePath().beginPath().arc(x + 12, y, 14, Math.PI * 1.1, Math.PI * 1.9).strokePath()); });
      ["jetty", "whirly", "ambulance", "anan", "nurse", "grandma", "cooler", "p01"].forEach(k => mk(k, 64, 64, g => g.fillStyle(0xffffff, 1).fillCircle(32, 32, 30)));
      // spinning rotor disc for Whirly
      mk("rotor", 220, 220, g => {
        g.fillStyle(0xffffff, 0.12).fillCircle(110, 110, 108);
        g.fillStyle(0xd8dde6, 0.75); g.fillRoundedRect(4, 104, 212, 12, 6); g.fillRoundedRect(104, 4, 12, 212, 6);
        g.fillStyle(0x6b7280, 1).fillCircle(110, 110, 12);
      });
      // little wave marks that scroll with the sea
      mk("waves", 256, 256, g => {
        g.lineStyle(3, 0xffffff, 0.22);
        for (let i = 0; i < 9; i++) { const x = (i * 97) % 240 + 8, y = (i * 61) % 240 + 8; g.beginPath().arc(x, y, 9, Math.PI * 1.15, Math.PI * 1.85).strokePath().beginPath().arc(x + 16, y, 9, Math.PI * 1.15, Math.PI * 1.85).strokePath(); }
      });
      mk("glow", 64, 64, g => { for (let r = 32; r > 0; r -= 2) g.fillStyle(0xffffff, 0.05).fillCircle(32, 32, r); });
      this.scene.start("menu");
    }
  }

  /* ============================================================ MENU */
  class Menu extends Phaser.Scene {
    constructor() { super("menu"); }
    create() {
      const sv = save.get();
      this.cameras.main.setBackgroundColor("#7fd0f0");
      const g = this.add.graphics();
      g.fillGradientStyle(0x86d3f5, 0x86d3f5, 0xd8f4ff, 0xd8f4ff, 1).fillRect(0, 0, W, H);
      g.fillStyle(0x4fb0dc, 1).fillRect(0, 610, W, 110);
      fit(this.add.image(1110, 120, "whirly"), 210).setAngle(-4);
      fit(this.add.image(170, 110, "jetty"), 250).setAngle(-6);
      this.tweens.add({ targets: this.children.list.slice(-2), y: "-=10", duration: 1300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      txt(this, W / 2, 70, "Sky Rescue!", 76, "#ffffff", { stroke: "#d16a24", strokeThickness: 12 });
      txt(this, W / 2, 132, "Fly Jetty and Whirly to the islands and bring people to the hospital.  ⭐ " + totalStars(sv) + " / " + LEVELS.length * 3, 24, "#1d3a52", { strokeThickness: 0 });
      LEVELS.forEach((L, i) => {
        const x = 205 + (i % 4) * 290, y = 240 + Math.floor(i / 4) * 170;
        const open = UNLOCK || i === 0 || (sv.stars[LEVELS[i - 1].k] || 0) > 0;
        const c = this.add.container(x, y), bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.2).fillRoundedRect(-130, -66, 260, 140, 26);
        bg.fillStyle(open ? 0xfffaf0 : 0xd9dee6, 1).fillRoundedRect(-130, -72, 260, 140, 26);
        bg.lineStyle(5, L.plane === "heli" ? 0xff8a3d : 0x139c94, 1).strokeRoundedRect(-130, -72, 260, 140, 26);
        c.add(bg);
        if (L.night) c.add(txt(this, 104, -48, "🌙", 26, "#fff", { strokeThickness: 0 }));
        c.add(fit(this.add.image(-78, -16, L.plane === "heli" ? "whirly" : "jetty"), 92).setAlpha(open ? 1 : 0.4));
        c.add(txt(this, 38, -38, String(i + 1), 34, open ? "#139c94" : "#9aa3b0", { strokeThickness: 0 }));
        c.add(txt(this, 0, 26, L.name, 23, open ? "#1d3a52" : "#9aa3b0", { strokeThickness: 0, wordWrap: { width: 240 } }));
        const st = sv.stars[L.k] || 0;
        c.add(txt(this, 38, -6, open ? "★".repeat(st) + "☆".repeat(3 - st) : "🔒", 28, "#ffc41f", { strokeThickness: 3, stroke: "#8a6a10" }));
        if (open) {
          c.setSize(260, 140).setInteractive({ useHandCursor: true });
          c.on("pointerover", () => c.setScale(1.04)); c.on("pointerout", () => c.setScale(1));
          c.on("pointerup", () => { S.whoosh(); this.scene.start("brief", { level: i }); });
        }
      });
      const n = Object.keys(sv.stamps || {}).length;
      button(this, 400, 640, 420, 76, "✈️ Free Flight: Jetty", 0x139c94, () => this.scene.start("play", { level: -1, plane: "jet" }), 28);
      button(this, 880, 640, 440, 76, "🚁 Free Flight: Whirly", 0xff8a3d, () => this.scene.start("play", { level: -1, plane: "heli" }), 28);
      txt(this, W / 2, 588, "Free Flight: land at every airport to collect stamps! 🏷️ " + n + " / " + Object.keys(A).length, 20, "#1d3a52", { strokeThickness: 0 });
    }
  }

  /* ============================================================ BRIEFING */
  class Brief extends Phaser.Scene {
    constructor() { super("brief"); }
    init(d) { this.li = d.level; }
    create() {
      const L = LEVELS[this.li];
      this.cameras.main.setBackgroundColor(L.night ? "#1b2a55" : "#86d3f5");
      panel(this, W / 2, H / 2, 1060, 600, L.plane === "heli" ? 0xff8a3d : 0x139c94);
      txt(this, W / 2, 110, "Mission " + (this.li + 1) + ": " + L.name, 46, "#1d3a52", { strokeThickness: 0 });
      fit(this.add.image(250, 300, L.plane === "heli" ? "whirly" : "jetty"), 260);
      if (L.patient === "grandma") fit(this.add.image(250, 470, "grandma"), 150);
      else if (L.k === "medicine") fit(this.add.image(250, 470, "cooler"), 110);
      else txt(this, 250, 470, L.whoIcon || "", 90, "#fff", { strokeThickness: 0 });
      txt(this, 760, 250, L.intro, 28, "#1d3a52", { strokeThickness: 0, wordWrap: { width: 620 }, align: "left" });
      txt(this, 760, 440, "💡 " + FACTS[this.li], 23, "#139c94", { strokeThickness: 0, wordWrap: { width: 620 }, align: "left" });
      const route = L.legs.map(l => A[l.to].name).join("  ➜  ");
      txt(this, 760, 530, "🗺️ " + A[L.start].name + "  ➜  " + route, 22, "#5b4f73", { strokeThickness: 0, wordWrap: { width: 640 } });
      button(this, 520, 630, 260, 74, "◀ Back", 0x4f86f7, () => this.scene.start("menu"), 28);
      button(this, 800, 630, 300, 74, "Let's go! ▶", 0xff8a3d, () => this.scene.start("play", { level: this.li }), 30);
      say(L.intro);
    }
  }

  /* ============================================================ PLAY */
  class Play extends Phaser.Scene {
    constructor() { super("play"); }
    init(d) { this.li = d.level; this.planeKind = d.plane; }
    create() {
      const L = this.li < 0 ? R.FREE : LEVELS[this.li];
      this.L = L;
      // the scene object is reused between runs: forget everything from the last one
      Object.assign(this, { camLead: null, lever: null, gearBox: null, paused: false, aimPtr: null, toasting: false, lastLever: null, dragLever: false, gearMoving: false, pulse: null });
      this.s = R.create(L, { plane: this.planeKind });
      this.inp = {}; this.aim = null; this.mem = {}; this.toastQ = [];
      const s = this.s, cam = this.cameras.main;
      cam.setBackgroundColor(L.night ? "#1f3f73" : "#3f9fd6");
      cam.setBounds(s.bounds.x0 - 700, s.bounds.y0 - 500, s.bounds.x1 - s.bounds.x0 + 1400, s.bounds.y1 - s.bounds.y0 + 1000);
      this.waves = this.add.tileSprite(0, 0, W, H, "waves").setOrigin(0).setScrollFactor(0).setDepth(0);
      this.drawWorld();
      // storms, birds, decoration clouds
      this.stormImgs = s.storms.map(st => { const im = this.add.image(st.x, st.y, "storm").setDepth(11).setAlpha(0.92); im.setScale(st.r * 2.1 / im.width); return im; });
      this.birdImgs = s.birds.map(() => fit(this.add.image(0, 0, "gulls"), 64).setDepth(5));
      this.deco = [];
      for (let i = 0; i < 40; i++) {
        const x = s.bounds.x0 + rand() * (s.bounds.x1 - s.bounds.x0), y = s.bounds.y0 + rand() * (s.bounds.y1 - s.bounds.y0);
        this.deco.push(fit(this.add.image(x, y, "cloud"), 160 + rand() * 120).setDepth(12).setAlpha(L.night ? 0.12 : 0.38).setScrollFactor(1.08));
      }
      // the aircraft
      this.shadow = this.add.image(0, 0, "jetty_top").setTint(0x000000).setAlpha(0.22).setDepth(7);
      this.craft = this.add.image(0, 0, "jetty_top").setDepth(10);
      this.rotor = this.add.image(0, 0, "rotor").setDepth(10.5).setAlpha(0.8);
      this.navG = this.add.graphics().setDepth(23);
      this.amb = fit(this.add.image(0, 0, "ambulance"), 70).setDepth(9).setVisible(false);
      this.setCraft();
      // the camera is moved by hand in draw(), in the same frame as the sea waves, so nothing lags a frame behind
      cam.centerOn(s.x, s.y);
      if (L.night) {
        this.add.rectangle(0, 0, W, H, 0x0b1440, 0.3).setOrigin(0).setScrollFactor(0).setDepth(20);
      }
      this.fx = this.add.graphics().setDepth(13);
      this.buildHud();
      this.bindInput();
      if (s.patient) this.toast((L.whoIcon || "") + " " + L.who + " is aboard. Keep them cozy!", 3000);
      this.toast(this.li < 0 ? "Free Flight! Press TAKE OFF, then land anywhere." : "Press TAKE OFF! ✈️", 3000);
      this.lastHint = null; this.hintT = 0;
    }

    /* ---------------- the map */
    drawWorld() {
      const s = this.s, L = this.L, g = this.add.graphics().setDepth(1);
      const far = ["china", "luzon", "okinawa", "yonaguni", "iriomote", "ishigaki", "miyako", "batanes", "babuyan"];
      const night = L.night;
      // small things (peaks, buildings, lights) go into 600 px chunks that are hidden when off screen
      this.cull = [];
      const cells = {}, CS = 600;
      const cell = (x, y, depth, tag) => {
        const cx = Math.floor(x / CS), cy = Math.floor(y / CS), k = tag + cx + "," + cy;
        if (!cells[k]) { const gg = this.add.graphics().setDepth(depth); gg.bb = [cx * CS - 300, cy * CS - 300, cx * CS + CS + 300, cy * CS + CS + 300]; this.cull.push(gg); cells[k] = gg; }
        return cells[k];
      };
      for (const k in R.LAND_PX) {
        const pts = R.LAND_PX[k];
        g.fillStyle(night ? 0x8a7f63 : 0xf1dfa8, 1).fillPoints(pts.map(p => ({ x: p.x, y: p.y + 6 })), true);   // sandy beach edge
        g.fillStyle(far.includes(k) ? (night ? 0x5f6b55 : 0xd9d2b0) : (night ? 0x2f5a46 : 0x8fd16a), 1).fillPoints(pts, true);
        g.lineStyle(4, far.includes(k) ? 0xbdb38c : 0x6fb04c, night ? 0.4 : 0.8).strokePoints(pts, true, true);
      }
      // Taiwan's mountains: darker green hills down the middle, with little peaks
      const tw = R.LAND_PX.taiwan, cx = tw.reduce((a, p) => a + p.x, 0) / tw.length, cy = tw.reduce((a, p) => a + p.y, 0) / tw.length;
      const ridge = tw.map(p => ({ x: cx + (p.x - cx) * 0.5 + 60, y: cy + (p.y - cy) * 0.8 }));
      g.fillStyle(night ? 0x284d3c : 0x6fb85a, 1).fillPoints(ridge, true);
      const ridge2 = tw.map(p => ({ x: cx + (p.x - cx) * 0.26 + 90, y: cy + (p.y - cy) * 0.62 }));
      g.fillStyle(night ? 0x22443a : 0x5aa34e, 1).fillPoints(ridge2, true);
      for (let i = 0; i < 70; i++) {
        const p = ridge2[Math.floor(rand() * ridge2.length)], k = rand();
        const x = cx + (p.x - cx) * k + 90 * (1 - k), y = cy + (p.y - cy) * k;
        const r = 26 + rand() * 30;
        cell(x, y, 1.1, "m").fillStyle(night ? 0x1d3b31 : 0x4d9444, 1).fillTriangle(x - r, y + r * 0.6, x + r, y + r * 0.6, x, y - r * 0.9)
          .fillStyle(0xffffff, night ? 0.25 : 0.7).fillTriangle(x - r * 0.28, y - r * 0.4, x + r * 0.28, y - r * 0.4, x, y - r * 0.9);
      }
      // towns: Taipei is big and wraps around Songshan
      const towns = [[121.53, 25.06, 330, 230], [121.1, 22.77, 120, 90], [121.6, 24.0, 110, 120], [119.57, 23.57, 90, 80], [118.33, 24.44, 90, 60], [119.95, 26.17, 50, 40], [120.68, 24.15, 200, 160], [120.3, 22.65, 220, 170], [120.21, 23.0, 160, 120]];
      towns.forEach(([lon, lat, rx, ry]) => {
        const c = R.at(lon, lat);
        g.fillStyle(night ? 0x4c4a5c : 0xe8dcc8, 0.95).fillEllipse(c.x, c.y, rx * 2, ry * 2);
        for (let i = 0; i < rx * ry / 260; i++) {
          const a = rand() * 6.283, d = Math.sqrt(rand());
          const x = c.x + Math.cos(a) * rx * d * 0.92, y = c.y + Math.sin(a) * ry * d * 0.92;
          if (Math.hypot(x - A.tsa.x, y - A.tsa.y) < 160) continue;      // keep the airport clear
          const w = 10 + rand() * 16, h = 10 + rand() * 16;
          cell(x, y, 2, "b").fillStyle([0xf6a07a, 0xffd28a, 0x9fc9e6, 0xc9b6e8, 0xffffff][Math.floor(rand() * 5)], night ? 0.5 : 1).fillRect(x - w / 2, y - h / 2, w, h);
          if (night && rand() < 0.5) cell(x, y, 21, "l").fillStyle(0xffe9a3, 0.8).fillCircle(x, y, 2.5);
        }
      });
      // Taipei 101 as a landmark
      const t1 = R.at(121.592, 25.022);   // nudged east: the airport is drawn bigger than real
      g.fillStyle(0x7fb7b0, 1).fillCircle(t1.x, t1.y, 16); g.fillStyle(0x5aa6a0, 1).fillCircle(t1.x, t1.y, 9);
      this.add.text(t1.x + 30, t1.y + 26, "Taipei 101", { fontFamily: FONT, fontSize: "18px", fontStyle: "800", color: "#1d3a52", stroke: "#fff", strokeThickness: 4 }).setOrigin(0.5).setDepth(3);
      // airports
      for (const k in A) {
        const a = A[k];
        const ag = this.add.graphics().setDepth(3); ag.bb = [a.x - 260, a.y - 260, a.x + 260, a.y + 260]; this.cull.push(ag);
        const lights = cell(a.x, a.y, 21, "l");
        // helipad
        ag.fillStyle(0x5d6470, 1).fillCircle(a.px, a.py, 26); ag.lineStyle(4, 0xffffff, 1).strokeCircle(a.px, a.py, 22);
        this.add.text(a.px, a.py, "H", { fontFamily: FONT, fontSize: "28px", fontStyle: "800", color: "#ffffff" }).setOrigin(0.5).setDepth(3.2);
        if (a.rwy != null) {
          const d = R.dirOf(a.rwy), n = { x: -d.y, y: d.x }, hl = a.len / 2, hw = 13;
          const c = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([u, v]) => ({ x: a.x + d.x * u + n.x * v, y: a.y + d.y * u + n.y * v }));
          ag.fillStyle(0x9aa3ad, 1).fillPoints(c.map((p, i) => ({ x: p.x + n.x * (i < 2 ? -6 : 6), y: p.y + n.y * (i < 2 ? -6 : 6) })), true);
          ag.fillStyle(0x4b515b, 1).fillPoints(c, true);
          for (let u = -hl + 40; u < hl - 40; u += 22) ag.lineStyle(3, 0xffffff, 0.9).lineBetween(a.x + d.x * u, a.y + d.y * u, a.x + d.x * (u + 11), a.y + d.y * (u + 11));
          // runway numbers at each end, written the way a landing pilot reads them
          [[0, -1], [1, 1]].forEach(([i, sgn]) => {
            const u = sgn * (hl - 18);
            this.add.text(a.x + d.x * u, a.y + d.y * u, a.nums[i], { fontFamily: FONT, fontSize: "15px", fontStyle: "800", color: "#ffffff" })
              .setOrigin(0.5).setAngle(a.rwy + (i ? 0 : 180)).setDepth(3.2);
          });
          // terminal
          const tx = a.x - n.x * 44, ty = a.y - n.y * 44;
          ag.fillStyle(0xf3f0ea, 1).fillCircle(tx, ty, 16); ag.fillStyle(0x7fc3d8, 1).fillCircle(tx, ty, 9);
          if (night) for (let u = -hl; u <= hl; u += 20) [-1, 1].forEach(v => lights.fillStyle(0xffffff, 0.9).fillCircle(a.x + d.x * u + n.x * v * 15, a.y + d.y * u + n.y * v * 15, 2.4));
        }
        if (night) for (let i = 0; i < 12; i++) { const an = i / 12 * 6.283; lights.fillStyle(0x9fe8ff, 0.9).fillCircle(a.px + Math.cos(an) * 28, a.py + Math.sin(an) * 28, 2.4); }
        // the name goes on the side away from the helipad
        const lx = a.rwy != null ? a.x - a.pad[0] * 1.15 : a.x, ly = a.rwy != null ? a.y - a.pad[1] * 1.15 - 8 : a.y - 52;
        this.add.text(lx, ly, "✈ " + a.name, { fontFamily: FONT, fontSize: "22px", fontStyle: "800", color: "#1d3a52", stroke: "#ffffff", strokeThickness: 5 }).setOrigin(0.5).setDepth(22);
      }
      // windsock arrows at the destination (drawn each frame with the funnel)
      this.guideG = this.add.graphics().setDepth(4);
      this.padGlow = this.add.image(0, 0, "glow").setDepth(3.5).setScale(2.4).setTint(0xfff36b).setVisible(false);
    }

    setCraft() {
      const s = this.s, heli = s.plane === "heli";
      this.craft.setTexture(heli ? "whirly_top" : "jetty_top"); fit(this.craft, heli ? 92 : 96); this.baseScale = this.craft.scale;
      this.shadow.setTexture(this.craft.texture.key).setScale(this.baseScale);
      this.rotor.setVisible(heli); fit(this.rotor, 120);
      if (this.L.night) { this.craft.setDepth(22); this.rotor.setDepth(22.5); }
      if (this.lever) this.paintLever();
      if (this.gearBox) this.gearBox.setVisible(!heli);
    }

    /* ---------------- HUD */
    buildHud() {
      const s = this.s, L = this.L, hud = [];
      const Z = o => { o.setScrollFactor(0).setDepth(30); hud.push(o); return o; };
      // mission card
      const card = Z(this.add.graphics());
      card.fillStyle(0xfffaf0, 0.95).fillRoundedRect(14, 12, 410, 112, 22).lineStyle(4, 0x139c94, 1).strokeRoundedRect(14, 12, 410, 112, 22);
      this.missionT = Z(this.add.text(32, 22, "", { fontFamily: FONT, fontSize: "26px", fontStyle: "800", color: "#1d3a52" }));
      this.distT = Z(this.add.text(32, 56, "", { fontFamily: FONT, fontSize: "21px", fontStyle: "700", color: "#5b4f73" }));
      this.windT = Z(this.add.text(32, 86, "", { fontFamily: FONT, fontSize: "19px", fontStyle: "700", color: "#2f6f9f" }));
      this.clockT = Z(this.add.text(408, 22, "", { fontFamily: FONT, fontSize: "22px", fontStyle: "800", color: "#1d3a52" }).setOrigin(1, 0));
      const back = Z(button(this, 470, 46, 64, 56, "☰", 0x4f86f7, () => this.pause(), 28));
      // mini-map (weather radar shows the storms)
      this.mm = { x: W - 250, y: 12, w: 236, h: 236 };
      const mmBg = Z(this.add.graphics());
      mmBg.fillStyle(0x10324f, 0.9).fillRoundedRect(this.mm.x, this.mm.y, this.mm.w, this.mm.h, 18).lineStyle(4, 0xffffff, 0.9).strokeRoundedRect(this.mm.x, this.mm.y, this.mm.w, this.mm.h, 18);
      const B0 = s.bounds, sc = Math.min((this.mm.w - 20) / (B0.x1 - B0.x0), (this.mm.h - 20) / (B0.y1 - B0.y0));
      this.mmP = (x, y) => [this.mm.x + 10 + (x - B0.x0) * sc + ((this.mm.w - 20) - (B0.x1 - B0.x0) * sc) / 2, this.mm.y + 10 + (y - B0.y0) * sc];
      const mml = Z(this.add.graphics());
      const mask = this.make.graphics({ add: false }); mask.setScrollFactor(0); mask.fillStyle(0xffffff).fillRoundedRect(this.mm.x + 3, this.mm.y + 3, this.mm.w - 6, this.mm.h - 6, 16);
      const gm = mask.createGeometryMask();
      mml.setMask(gm);
      for (const k in R.LAND_PX) mml.fillStyle(0x7fbf6a, 1).fillPoints(R.LAND_PX[k].map(p => { const q = this.mmP(p.x, p.y); return { x: q[0], y: q[1] }; }), true);
      for (const k in A) { const q = this.mmP(A[k].x, A[k].y); mml.fillStyle(0xffffff, 1).fillCircle(q[0], q[1], 3); }
      this.mmG = Z(this.add.graphics()); this.mmG.setMask(gm);
      Z(this.add.text(this.mm.x + this.mm.w / 2, this.mm.y + this.mm.h + 6, "radar: 🟣 storms", { fontFamily: FONT, fontSize: "16px", fontStyle: "800", color: "#ffffff", stroke: "#1d3a52", strokeThickness: 4 }).setOrigin(0.5, 0));
      // edge arrow toward the destination
      this.edge = Z(this.add.container(0, 0));
      const eg = this.add.graphics(); eg.fillStyle(0xff3fa4, 1).fillTriangle(30, 0, -14, -20, -14, 20).lineStyle(4, 0xffffff, 1).strokeTriangle(30, 0, -14, -20, -14, 20);
      this.edgeT = this.add.text(0, 34, "", { fontFamily: FONT, fontSize: "18px", fontStyle: "800", color: "#ffffff", stroke: "#a01f68", strokeThickness: 5 }).setOrigin(0.5);
      this.edge.add([eg]); this.edgeLbl = Z(this.edgeT);

      // power lever (right)
      const lx = W - 70, ly = 520;
      const lg = Z(this.add.graphics());
      lg.fillStyle(0x24303e, 0.92).fillRoundedRect(lx - 56, ly - 150, 112, 300, 22).lineStyle(4, 0xffffff, 0.8).strokeRoundedRect(lx - 56, ly - 150, 112, 300, 22);
      lg.fillStyle(0x0d141c, 1).fillRoundedRect(lx - 8, ly - 100, 16, 200, 8);
      this.leverLbl = [0, 1, 2].map(i => Z(this.add.text(lx, ly + 100 - i * 100, "", { fontFamily: FONT, fontSize: "17px", fontStyle: "800", color: "#cfe3ff" }).setOrigin(0.5)));
      this.leverKnob = Z(this.add.container(lx, ly));
      const kg = this.add.graphics(); kg.fillStyle(0x000000, 0.35).fillRoundedRect(-40, -14, 80, 34, 12); kg.fillStyle(0xe9edf2, 1).fillRoundedRect(-40, -18, 80, 34, 12); kg.fillStyle(0xff8a3d, 1).fillRoundedRect(-34, -12, 68, 8, 4);
      this.leverKnob.add(kg);
      Z(this.add.text(lx, ly - 136, "POWER", { fontFamily: FONT, fontSize: "18px", fontStyle: "800", color: "#ffd166" }).setOrigin(0.5));
      this.spdT = Z(this.add.text(lx, ly + 170, "", { fontFamily: FONT, fontSize: "20px", fontStyle: "800", color: "#ffffff", stroke: "#1d3a52", strokeThickness: 5 }).setOrigin(0.5));
      const hit = Z(this.add.zone(lx, ly, 112, 300).setInteractive({ useHandCursor: true }));
      const setFromY = p => { const i = clamp(Math.round((ly + 100 - p.y) / 100), 0, 2); if (i !== this.s.lever) { this.inp.lever = i; S.tick(); } };
      hit.on("pointerdown", p => { this.dragLever = true; setFromY(p); });
      this.input.on("pointermove", p => { if (this.dragLever && p.isDown) setFromY(p); });
      this.input.on("pointerup", () => { this.dragLever = false; });
      this.lever = { lx, ly };
      this.paintLever();

      // gear handle with three lights (jet only)
      const gx = W - 196, gy = 560;
      this.gearBox = Z(this.add.container(gx, gy));
      const gb = this.add.graphics();
      gb.fillStyle(0x24303e, 0.92).fillRoundedRect(-58, -110, 116, 220, 22).lineStyle(4, 0xffffff, 0.8).strokeRoundedRect(-58, -110, 116, 220, 22);
      this.gearLights = this.add.graphics();
      this.gearKnob = this.add.container(0, 0);
      const gk = this.add.graphics(); gk.fillStyle(0x0d141c, 1).fillRoundedRect(-6, -40, 12, 80, 6);
      this.gearKnob.add(gk);
      this.gearWheel = this.add.graphics();
      this.gearWheel.fillStyle(0xf2f2f2, 1).fillCircle(0, 0, 18).lineStyle(5, 0x333333, 1).strokeCircle(0, 0, 18).fillStyle(0x333333, 1).fillCircle(0, 0, 6);
      this.gearKnob.add(this.gearWheel);
      this.gearBox.add([gb, this.add.text(0, -94, "GEAR", { fontFamily: FONT, fontSize: "18px", fontStyle: "800", color: "#ffd166" }).setOrigin(0.5), this.gearLights, this.gearKnob,
        this.add.text(0, 92, "UP / DOWN", { fontFamily: FONT, fontSize: "13px", fontStyle: "800", color: "#cfe3ff" }).setOrigin(0.5)]);
      this.gearBox.setSize(116, 220).setInteractive({ useHandCursor: true }).on("pointerup", () => { this.inp.gear = true; S.tap(); });
      this.gearBox.setVisible(s.plane === "jet");

      // the big context button (TAKE OFF / LAND)
      this.goBtn = Z(button(this, W / 2, H - 62, 300, 84, "TAKE OFF", 0xff8a3d, () => { if (this.s.phase === "ground") this.inp.go = true; else if (this.s.canLand) this.inp.land = true; }, 36));
      this.hintT_ = Z(this.add.text(W / 2, H - 140, "", { fontFamily: FONT, fontSize: "26px", fontStyle: "800", color: "#ffffff", stroke: "#1d3a52", strokeThickness: 7, align: "center" }).setOrigin(0.5));

      // care panel (bottom left)
      this.careBox = Z(this.add.container(0, 0));
      const cbg = this.add.graphics();
      cbg.fillStyle(0xfffaf0, 0.95).fillRoundedRect(14, H - 186, 470, 172, 24).lineStyle(4, 0xff6f8f, 1).strokeRoundedRect(14, H - 186, 470, 172, 24);
      this.careBox.add(cbg);
      const who = L.patient === "grandma" ? fit(this.add.image(74, H - 128, "grandma"), 92) : this.add.text(74, H - 128, L.whoIcon || "🙂", { fontFamily: FONT, fontSize: "60px" }).setOrigin(0.5);
      this.careBox.add(who);
      this.careBox.add(this.add.text(74, H - 66, L.who || "", { fontFamily: FONT, fontSize: "16px", fontStyle: "800", color: "#1d3a52" }).setOrigin(0.5));
      this.comfortT = this.add.text(140, H - 176, "Cozy", { fontFamily: FONT, fontSize: "19px", fontStyle: "800", color: "#1d3a52" });
      this.comfortBar = this.add.graphics();
      this.careBox.add([this.comfortT, this.comfortBar]);
      this.careBtns = {};
      R.CARE.forEach((k, i) => {
        const [ic, name, col] = CARE_UI[k];
        const b = button(this, 172 + i * 84, H - 70, 76, 86, ic, col, () => { this.inp.care = k; }, 34);
        b.add(this.add.text(0, 30, name, { fontFamily: FONT, fontSize: "14px", fontStyle: "800", color: "#ffffff", stroke: "#1d3a52", strokeThickness: 3 }).setOrigin(0.5));
        this.careBtns[k] = b; this.careBox.add(b);
      });
      // the nurse's speech bubble
      this.bubble = this.add.container(0, 0).setVisible(false);
      const bb = this.add.graphics();
      bb.fillStyle(0xffffff, 1).fillRoundedRect(130, H - 300, 380, 96, 20).fillTriangle(170, H - 206, 200, H - 206, 160, H - 186).lineStyle(3, 0xff6f8f, 1).strokeRoundedRect(130, H - 300, 380, 96, 20);
      this.bubbleNurse = fit(this.add.image(80, H - 252, "nurse"), 96);
      this.bubbleT = this.add.text(146, H - 292, "", { fontFamily: FONT, fontSize: "19px", fontStyle: "800", color: "#1d3a52", wordWrap: { width: 300 } });
      this.bubbleIcon = this.add.text(486, H - 252, "", { fontFamily: FONT, fontSize: "44px" }).setOrigin(0.5);
      this.bubbleRing = this.add.graphics();
      this.bubble.add([bb, this.bubbleNurse, this.bubbleT, this.bubbleRing, this.bubbleIcon]);
      this.careBox.add(this.bubble);
      this.careBox.setVisible(false);

      // toast
      this.toastT = Z(this.add.text(W / 2, 170, "", { fontFamily: FONT, fontSize: "32px", fontStyle: "800", color: "#ffffff", stroke: "#1d3a52", strokeThickness: 8, align: "center", wordWrap: { width: 760 } }).setOrigin(0.5).setAlpha(0));
      this.hud = hud;
      // containers pass "stay on screen" down to everything inside them
      [this.careBox, this.bubble, this.gearBox, this.gearKnob, this.leverKnob, this.edge, this.goBtn].forEach(o => o.setScrollFactor(0, 0, true));
      R.CARE.forEach(k => this.careBtns[k].setScrollFactor(0, 0, true));
    }

    paintLever() {
      const pl = R.PLANES[this.s.plane];
      this.leverLbl.forEach((t, i) => { t.setText(pl.labels[i]); t.setColor(i === this.s.lever ? "#ffd166" : "#8fa3bd"); });
      this.leverKnob.y = this.lever.ly + 100 - this.s.lever * 100;
    }

    bindInput() {
      this.keys = this.input.keyboard.addKeys("UP,DOWN,LEFT,RIGHT,SPACE,G,ONE,TWO,THREE,FOUR,L");
      this.input.keyboard.on("keydown-UP", () => { this.inp.lever = Math.min(2, this.s.lever + 1); S.tick(); });
      this.input.keyboard.on("keydown-DOWN", () => { this.inp.lever = Math.max(0, this.s.lever - 1); S.tick(); });
      this.input.keyboard.on("keydown-G", () => { this.inp.gear = true; });
      const goOrLand = () => { if (this.s.phase === "ground") this.inp.go = true; else this.inp.land = true; };
      this.input.keyboard.on("keydown-SPACE", goOrLand); this.input.keyboard.on("keydown-L", goOrLand);
      ["ONE", "TWO", "THREE", "FOUR"].forEach((k, i) => this.input.keyboard.on("keydown-" + k, () => { this.inp.care = R.CARE[i]; }));
      // touch the map to steer toward that spot
      this.input.on("pointerdown", (p, over) => { if (over.length || this.paused) return; this.aimPtr = p; });
      this.input.on("pointerup", p => { if (this.aimPtr === p) this.aimPtr = null; });
    }

    toast(msg, ms) {
      this.toastQ.push([msg, ms || 2200]);
      if (!this.toasting) this.nextToast();
    }
    nextToast() {
      const n = this.toastQ.shift();
      if (!n) { this.toasting = false; return; }
      this.toasting = true;
      this.toastT.setText(n[0]).setAlpha(1).setScale(0.8);
      this.tweens.add({ targets: this.toastT, scale: 1, duration: 220, ease: "Back.out" });
      this.time.delayedCall(n[1], () => this.tweens.add({ targets: this.toastT, alpha: 0, duration: 250, onComplete: () => this.nextToast() }));
    }

    pause() {
      if (this.paused || this.s.done) return;
      this.paused = true;
      const c = this.add.container(0, 0).setDepth(60).setScrollFactor(0);
      c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.4).setInteractive());
      c.add(panel(this, W / 2, H / 2, 640, 340, 0x4f86f7));
      c.add(txt(this, W / 2, H / 2 - 100, "Paused", 52, "#1d3a52", { strokeThickness: 0 }));
      c.add(button(this, W / 2, H / 2 - 10, 300, 66, "▶ Keep flying", 0x5ccf6a, () => { c.destroy(); this.paused = false; }, 26));
      c.add(button(this, W / 2 - 150, H / 2 + 90, 260, 62, "↻ Restart", 0xff8a3d, () => this.scene.restart(), 24));
      c.add(button(this, W / 2 + 150, H / 2 + 90, 260, 62, "⌂ Missions", 0x4f86f7, () => this.scene.start("menu"), 24));
      c.setScrollFactor(0, 0, true); c.list.forEach(o => o.list && o.setScrollFactor(0, 0, true));
    }

    /* ---------------- frame */
    update(time, delta) {
      if (this.paused) return;
      const s = this.s;
      let dt = Math.min(0.05, delta / 1000) * SPEED;
      // steering input
      const inp = this.inp;
      if (window.__srBot) Object.assign(inp, R.bot(s, dt, this.mem));
      else if (this.aimPtr && this.aimPtr.isDown) { const p = this.cameras.main.getWorldPoint(this.aimPtr.x, this.aimPtr.y); inp.aim = { x: p.x, y: p.y }; }
      else if (this.keys.LEFT.isDown || this.keys.RIGHT.isDown) inp.turn = (this.keys.RIGHT.isDown ? 1 : 0) - (this.keys.LEFT.isDown ? 1 : 0);
      // big frames get split so the physics stays steady
      const n = Math.ceil(dt / 0.034);
      for (let i = 0; i < n && !s.done; i++) {
        R.step(s, dt / n, i === 0 ? inp : { aim: inp.aim, turn: inp.turn });
        this.handle(s.events.slice());
      }
      this.inp = {};
      this.draw(dt, Math.min(0.05, delta / 1000));
    }

    handle(evs) {
      const s = this.s, L = this.L;
      for (const e of evs) {
        switch (e.type) {
          case "roll": S.jet(); break;
          case "lift": S.whoosh(); break;
          case "liftoff": this.toast("Lift-off! 🛫 Now GEAR UP for less drag.", 2400); break;
          case "airborne": if (s.plane === "heli") this.toast("Up we go! Touch the map to fly.", 2000); break;
          case "gearMove": this.gearMoving = true; break;
          case "gearDown": S.ding(); this.toast("3 green lights: gear down! 🟢🟢🟢", 1600); break;
          case "gearUp": S.tap(); break;
          case "gearLocked": S.oops(); this.toast("The gear is locked on the ground. Take off first!", 1800); break;
          case "final": S.ding(); this.toast("Cleared to land, Runway " + e.rwy + "! 🛬", 2200); say("Cleared to land, runway " + e.rwy.split("").join(" ")); break;
          case "touchdown": S.dig(); break;
          case "descend": S.whoosh(); break;
          case "bump": S.rumble(); this.cameras.main.shake(380, 0.006); this.toast("Bumpy! ⛈️ Fly around the storms.", 1600); break;
          case "birds": S.chirp(); this.toast("Birds! 🐦 They flew away safely. Give them room!", 2000); break;
          case "edge": this.toast("That's far enough! Turning back.", 1600); break;
          case "careNeed": S.pop(); this.bubbleT.setText(e.say); this.bubbleIcon.setText(CARE_UI[e.k][0]); this.bubble.setVisible(true); this.bubble.setScale(1); break;
          case "careOK": S.sparkle(); this.bubble.setVisible(false); this.toast("Thank you! 💖", 1100); this.pulse = null; break;
          case "careWrong": S.oops(); break;
          case "careMiss": S.oops(); this.bubble.setVisible(false); this.toast("Oh no, we forgot! Next time tap " + CARE_UI[e.k][0], 1800); break;
          case "arrive": this.arrive(e); break;
          case "stamp": S.yay(); this.toast(e.first ? "New stamp: " + A[e.k].name + "! 🏷️" : "Welcome back to " + A[e.k].name + "!", 2200); { const sv = save.get(); sv.stamps[e.k] = true; save.set(sv); } break;
          case "transfer": this.setCraft(); this.toast("Now Jetty takes over! Press TAKE OFF.", 2600); break;
          case "nextLeg": if (s.plane === "jet") this.setCraft(); this.toast("Press TAKE OFF! Next stop: " + A[L.legs[s.leg].to].name, 2400); break;
          case "done": this.time.delayedCall(600, () => this.result()); break;
        }
      }
    }

    arrive(e) {
      const a = A[e.k], s = this.s;
      S.yay();
      this.toast(e.say, 3000); say(e.say);
      if (e.do === "dropoff" && e.k === "tsa") this.toast("🏥 Songshan is in the city: the hospital is just 10 to 15 minutes away!", 2600);
      // the ambulance drives up to the plane
      if (e.do === "pickup" || e.do === "dropoff" || e.do === "transfer") {
        const px = s.x, py = s.y;
        this.amb.setVisible(true).setPosition(px + 160, py + 90).setFlipX(true);
        this.tweens.add({ targets: this.amb, x: px + 60, y: py + 34, duration: 900, ease: "Sine.out" });
        if (e.do === "dropoff") this.tweens.add({ targets: this.amb, x: px + 360, y: py - 120, delay: 1800, duration: 1300, ease: "Sine.in", onStart: () => { this.amb.setFlipX(false); S.whoosh(); } });
        this.time.delayedCall(3300, () => this.amb.setVisible(false));
      }
    }

    draw(dt, realDt) {
      const s = this.s, L = this.L, cam = this.cameras.main, t = this.time.now / 1000;
      const heli = s.plane === "heli";
      // only draw the map chunks the camera can see
      const v = cam.worldView;
      for (const g of this.cull) g.setVisible(g.bb[2] > v.x && g.bb[0] < v.right && g.bb[3] > v.y && g.bb[1] < v.bottom);
      // aircraft
      const sc = this.baseScale * (0.78 + 0.22 * s.alt);
      this.craft.setPosition(s.x, s.y).setAngle(s.h).setScale(sc);
      this.shadow.setPosition(s.x + 10 + s.alt * 38, s.y + 10 + s.alt * 46).setAngle(s.h).setScale(sc * 0.92);
      this.rotor.setPosition(s.x, s.y - 0).setAngle(t * 1500 % 360).setVisible(heli && (s.phase !== "ground" || s.alt > 0)).setScale(this.rotor.scale);
      if (heli && s.phase === "ground") this.rotor.setVisible(true).setAngle(t * 120 % 360);
      // camera: glide toward a point a little ahead of the aircraft (frame-rate independent)
      const lead = Math.min(1, s.v / 90), hd = R.dirOf(s.h);
      this.camLead = this.camLead || { x: 0, y: 0 };
      const lk = 1 - Math.pow(0.985, realDt * 60);   // the look-ahead swings slowly when turning
      this.camLead.x += (hd.x * 140 * lead - this.camLead.x) * lk; this.camLead.y += (hd.y * 110 * lead - this.camLead.y) * lk;
      const ck = 1 - Math.pow(0.88, realDt * 60);
      cam.scrollX += (s.x + this.camLead.x - W / 2 - cam.scrollX) * ck;
      cam.scrollY += (s.y + this.camLead.y - H / 2 - cam.scrollY) * ck;
      this.waves.tilePositionX = cam.scrollX; this.waves.tilePositionY = cam.scrollY;
      // night: navigation lights (red left, green right) and a blinking beacon
      this.navG.clear();
      if (L.night) {
        const d = R.dirOf(s.h), n = { x: -d.y, y: d.x }, span = heli ? 22 : 42;
        this.navG.fillStyle(0xff4b4b, 1).fillCircle(s.x - n.x * span, s.y - n.y * span, 4);
        this.navG.fillStyle(0x4bff7a, 1).fillCircle(s.x + n.x * span, s.y + n.y * span, 4);
        if ((t * 1.4) % 1 < 0.18) this.navG.fillStyle(0xffffff, 1).fillCircle(s.x, s.y, 6);
      }
      // storms and birds
      s.storms.forEach((st, i) => { const im = this.stormImgs[i]; im.setPosition(st.x, st.y + Math.sin(t + i) * 6); if (Math.random() < 0.004) { im.setTint(0xfff6b0); this.time.delayedCall(90, () => im.clearTint()); } });
      s.birds.forEach((b, i) => { const im = this.birdImgs[i]; im.setVisible(b.gone <= 0).setPosition(b.x, b.y); im.setAngle(b.scatter > 0 ? Math.atan2(b.sy, b.sx) / D2R + 90 : Math.sin(t * 2 + i) * 15); });
      // GPS line, approach arrows, glowing helipad
      const gg = this.guideG; gg.clear();
      const gd = R.guide(s);
      this.padGlow.setVisible(false);
      if (gd && s.phase !== "landed") {
        if (s.phase === "air" || s.phase === "climb" || s.phase === "ground") {
          const pts = s.plane === "jet" && gd.h != null && Math.hypot(s.x - gd.ax, s.y - gd.ay) > 120 ? [[s.x, s.y], [gd.ax, gd.ay], [gd.x, gd.y]] : [[s.x, s.y], [gd.x, gd.y]];
          for (let i = 0; i < pts.length - 1; i++) this.dashed(gg, pts[i], pts[i + 1], 0xff3fa4, 0.85, t);
        }
        if (s.plane === "jet" && gd.h != null) {
          const d = R.dirOf(gd.h), n = { x: -d.y, y: d.x };
          for (let k = 0; k < 7; k++) {
            const u = -80 - k * 110, w = 34 + k * 26, ph = ((t * 2 - k * 0.35) % 1 + 1) % 1;
            const cx = gd.x + d.x * u, cy = gd.y + d.y * u;
            gg.lineStyle(8, 0xfff36b, 0.25 + 0.6 * ph);
            gg.beginPath(); gg.moveTo(cx - n.x * w - d.x * 30, cy - n.y * w - d.y * 30); gg.lineTo(cx, cy); gg.lineTo(cx + n.x * w - d.x * 30, cy + n.y * w - d.y * 30); gg.strokePath();
          }
        } else if (gd.h == null) {
          this.padGlow.setVisible(true).setPosition(gd.x, gd.y).setAlpha(0.55 + 0.35 * Math.sin(t * 5));
        }
      }
      if (L.free && s.plane === "jet" && (s.phase === "air")) {
        // free flight: arrows at every runway
        for (const k in A) { const a = A[k]; if (a.rwy == null || Math.hypot(s.x - a.x, s.y - a.y) > 1600) continue;
          const h = R.landHeading(a, s.wind.from), th = R.threshold(a, h), d = R.dirOf(h), n = { x: -d.y, y: d.x };
          for (let k2 = 0; k2 < 5; k2++) { const u = -80 - k2 * 110, w = 34 + k2 * 26, cx = th.x + d.x * u, cy = th.y + d.y * u;
            gg.lineStyle(7, 0xfff36b, 0.55); gg.beginPath(); gg.moveTo(cx - n.x * w - d.x * 30, cy - n.y * w - d.y * 30); gg.lineTo(cx, cy); gg.lineTo(cx + n.x * w - d.x * 30, cy + n.y * w - d.y * 30); gg.strokePath(); } }
      }
      if (L.free && heli && s.phase === "air") for (const k in A) { const a = A[k]; if (Math.hypot(s.x - a.px, s.y - a.py) < 600) { gg.lineStyle(5, 0xfff36b, 0.5 + 0.4 * Math.sin(t * 5)); gg.strokeCircle(a.px, a.py, 34); } }
      this.drawHud(gd, t);
    }

    dashed(g, a, b, col, alpha, t) {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 1) return;
      const ux = dx / L, uy = dy / L, off = (t * 60) % 36;
      g.lineStyle(6, col, alpha);
      for (let u = off; u < L; u += 36) { const e = Math.min(L, u + 20); g.lineBetween(a[0] + ux * u, a[1] + uy * u, a[0] + ux * e, a[1] + uy * e); }
    }

    drawHud(gd, t) {
      const s = this.s, L = this.L, pl = R.PLANES[s.plane];
      // mission card
      if (L.free) { this.missionT.setText("🗺️ Free Flight"); this.distT.setText("Stamps: " + Object.keys(save.get().stamps).length + " / " + Object.keys(A).length); }
      else if (gd) {
        const leg = L.legs[s.leg];
        const verb = { pickup: "Pick up " + L.who, dropoff: "🚑 The ambulance is waiting", deliver: "Deliver " + L.who, transfer: "Jetty is waiting", visit: "Visit" }[leg.do];
        this.missionT.setText((leg.do === "pickup" ? "🚑 " : "📍 ") + gd.a.name);
        this.distT.setText(verb + " · " + Math.round(R.distKm(s, gd.x, gd.y)) + " km");
      }
      this.windT.setText("🌬️ Wind from the " + compass(s.wind.from) + (s.wind.spd > 15 ? " (strong!)" : ""));
      const m = Math.floor(s.t / 60), sec = Math.floor(s.t % 60);
      this.clockT.setText(L.free ? "" : "⏱ " + m + ":" + String(sec).padStart(2, "0"));
      // lever and speed
      if (this.lastLever !== s.lever + s.plane) { this.lastLever = s.lever + s.plane; this.paintLever(); }
      this.spdT.setText(Math.max(0, Math.round(s.speedKmh / 10) * 10) + " km/h");
      // gear lights: green = down and locked, red = moving, dark = up
      if (s.plane === "jet") {
        const gl = this.gearLights; gl.clear();
        const col = s.gearMove ? ((t * 4) % 1 < 0.5 ? 0xff4b4b : 0x5a1f1f) : s.gear ? 0x3cff6a : 0x2a3340;
        [-30, 0, 30].forEach((x, i) => gl.fillStyle(col, 1).fillCircle(x, i === 1 ? -66 : -56, 10));
        const target = s.gearMove ? (s.gearMove > 0 ? 36 : -36) * Math.min(1, s.gearT / 0.4) : s.gear ? 36 : -36;
        this.gearWheel.y += (target - this.gearWheel.y) * 0.3;
        this.gearBox.setAlpha(s.hint === "gear" || (s.phase === "air" && s.gear && !s.gearMove && s.phaseT < 10 && !s.hint) ? 0.75 + 0.25 * Math.sin(t * 8) : 1);
      }
      // context button
      const showGo = s.phase === "ground" || s.canLand;
      this.goBtn.setVisible(showGo);
      if (showGo) { const lab = s.phase === "ground" ? "TAKE OFF" : "LAND"; if (this.goBtn.label.text !== lab) this.goBtn.label.setText(lab); this.goBtn.setScale(1 + 0.05 * Math.sin(t * 6)); }
      // hints (wait a moment before nagging)
      const hint = s.phase === "air" ? s.hint : null;
      if (hint !== this.lastHint) { this.lastHint = hint; this.hintT = 0; }
      this.hintT += 1 / 60;
      this.hintT_.setText(hint && this.hintT > 0.6 ? HINTS[hint] : "");
      // care panel
      const showCare = s.patient && !L.free && !!L.care;
      this.careBox.setVisible(showCare);
      if (showCare) {
        const c = s.comfort / 100, cb = this.comfortBar; cb.clear();
        cb.fillStyle(0xe6dfe8, 1).fillRoundedRect(140, H - 150, 330, 22, 11);
        cb.fillStyle(c > 0.6 ? 0x5ccf6a : c > 0.3 ? 0xffb020 : 0xff6b5e, 1).fillRoundedRect(140, H - 150, Math.max(22, 330 * c), 22, 11);
        this.comfortT.setText("💖 Cozy: " + Math.round(s.comfort) + "%");
        this.bubbleRing.clear();
        if (s.care) {
          this.bubbleRing.lineStyle(6, 0xff6f8f, 1).beginPath().arc(486, H - 252, 32, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (s.care.t / s.care.max)).strokePath();
          // after a few seconds, the right button wiggles to help
          R.CARE.forEach(k => this.careBtns[k].setScale(k === s.care.k && s.care.t < 6.5 ? 1 + 0.12 * Math.abs(Math.sin(t * 7)) : 1));
        } else { this.bubble.setVisible(false); R.CARE.forEach(k => this.careBtns[k].setScale(1)); }
      }
      // mini-map
      const g = this.mmG; g.clear();
      s.storms.forEach(st => { const q = this.mmP(st.x, st.y); g.fillStyle(0xb06cff, 0.55).fillCircle(q[0], q[1], Math.max(5, st.r * 0.017)); g.fillStyle(0xff5fd0, 0.6).fillCircle(q[0], q[1], Math.max(2.5, st.r * 0.008)); });
      if (gd) { const q = this.mmP(gd.a.x, gd.a.y); g.lineStyle(3, 0xff3fa4, 0.6 + 0.4 * Math.sin(t * 6)).strokeCircle(q[0], q[1], 8); }
      const q = this.mmP(s.x, s.y), d = R.dirOf(s.h);
      g.fillStyle(s.plane === "heli" ? 0xff8a3d : 0xffffff, 1).fillTriangle(q[0] + d.x * 9, q[1] + d.y * 9, q[0] - d.x * 6 - d.y * 6, q[1] - d.y * 6 + d.x * 6, q[0] - d.x * 6 + d.y * 6, q[1] - d.y * 6 - d.x * 6);
      // edge arrow when the destination is off screen
      const cam = this.cameras.main;
      if (gd && s.phase !== "landed") {
        const sx = gd.x - cam.scrollX, sy = gd.y - cam.scrollY;
        const off = sx < 40 || sx > W - 40 || sy < 40 || sy > H - 40;
        this.edge.setVisible(off); this.edgeLbl.setVisible(off);
        if (off) {
          const cx = W / 2, cy = H / 2, ang = Math.atan2(sy - cy, sx - cx);
          const k = Math.min((W / 2 - 70) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - 70) / Math.abs(Math.sin(ang) || 1e-6));
          const ex = clamp(cx + Math.cos(ang) * k, 280, W - 290), ey = clamp(cy + Math.sin(ang) * k, 150, H - 200);
          this.edge.setPosition(ex, ey).setRotation(ang);
          this.edgeLbl.setPosition(ex, ey + 34).setText(gd.a.name + " " + Math.round(R.distKm(s, gd.x, gd.y)) + " km");
        }
      } else { this.edge.setVisible(false); this.edgeLbl.setVisible(false); }
    }

    result() {
      const s = this.s, L = this.L, r = s.result, sv = save.get();
      sv.stars[L.k] = Math.max(sv.stars[L.k] || 0, r.stars); save.set(sv);
      const c = this.add.container(0, 0).setDepth(60);
      c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.35));
      c.add(panel(this, W / 2, H / 2 - 10, 900, 540, 0x5ccf6a));
      c.add(fit(this.add.image(W / 2 - 320, H / 2 - 90, L.plane === "heli" && L.k !== "relay" ? "whirly" : "jetty"), 230));
      c.add(fit(this.add.image(W / 2 - 320, H / 2 + 90, "ambulance"), 150));
      c.add(txt(this, W / 2 + 60, 140, ["Mission complete!", "Great rescue!", "Super rescue pilot!"][r.stars - 1], 50, "#1d3a52", { strokeThickness: 0 }));
      c.add(txt(this, W / 2 + 60, 215, "★".repeat(r.stars) + "☆".repeat(3 - r.stars), 70, "#ffc41f", { strokeThickness: 6, stroke: "#8a6a10" }));
      const tm = Math.floor(r.time / 60) + ":" + String(Math.floor(r.time % 60)).padStart(2, "0"), par = Math.floor(r.par / 60) + ":" + String(r.par % 60).padStart(2, "0");
      const lines = [["⭐", "Mission done", true], [r.comfort >= 60 ? "⭐" : "☆", "Cozy ride: " + r.comfort + "%" + (r.comfort >= 60 ? "" : " (get 60%)"), r.comfort >= 60],
        [r.stars === 3 ? "⭐" : "☆", "Super cozy (85%) in " + tm + " (goal " + par + ")", r.stars === 3]];
      lines.forEach((l, i) => c.add(txt(this, W / 2 + 60, 300 + i * 40, l[0] + " " + l[1], 26, l[2] ? "#1d3a52" : "#9a92ad", { strokeThickness: 0 })));
      const toCity = L.legs[L.legs.length - 1].to === "tsa" && L.patient;
      const tip = toCity ? "🏥 You landed in the middle of Taipei, so big hospitals are only a 10 to 15 minute drive away. That's why the islands need Songshan!" : "💡 " + FACTS[(this.li + 1) % FACTS.length];
      c.add(txt(this, W / 2 + 60, 430, tip, 21, "#139c94", { strokeThickness: 0, wordWrap: { width: 560 } }));
      const next = this.li < LEVELS.length - 1;
      const btns = [["⌂ Missions", 0x4f86f7, () => this.scene.start("menu")], ["↻ Again", 0xff8a3d, () => this.scene.start("play", { level: this.li })]];
      if (next) btns.push(["Next ▶", 0x5ccf6a, () => this.scene.start("brief", { level: this.li + 1 })]);
      btns.forEach((b, i) => c.add(button(this, W / 2 + (i - (btns.length - 1) / 2) * 230, 560, 210, 74, b[0], b[1], b[2], 28)));
      c.setScrollFactor(0, 0, true); c.list.forEach(o => o.list && o.setScrollFactor(0, 0, true));
      if (r.stars === 3 && this.li === LEVELS.length - 1) this.toast("🏆 You're a real rescue pilot!", 5000);
      say(["Mission complete!", "Great rescue!", "Super rescue pilot!"][r.stars - 1]);
    }
  }

  function start() {
    const ready = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 32px "Baloo 2"')]).catch(() => {}) : Promise.resolve();
    Promise.race([ready, new Promise(r => setTimeout(r, 2500))]).then(() => {
      window.__srGame = new Phaser.Game({
        type: Phaser.AUTO, parent: "game", backgroundColor: "#3f9fd6",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
        input: { activePointers: 3 },
        fps: /[?&]timer=1/.test(location.search) ? { forceSetTimeOut: true, target: 60 } : undefined,
        scene: [Boot, Menu, Brief, Play],
      });
    });
  }
  window.SkyRescue = { start };
})();
