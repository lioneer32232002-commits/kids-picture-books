/* Spoonbill Journey! — feed at night like a black-faced spoonbill, and fly between Korea and Taiwan (Phaser 3).
   The rules, map, missions and test bot live in sim.js. This file draws:
   - Feed: the picture behind, then a side view of the water and the mud bottom; Bomi wades and sweeps its bill,
     fish swim (only ripples show on dark nights), A-gong drains his pond or the tide comes in.
   - Fly: the map of East Asia from above, the monsoon wind as moving streaks, glowing stopover wetlands,
     rain clouds, an energy bar and a mini-map.
   Nothing gets hurt: a tired Bomi just glides to the nearest wetland to rest. */
(function () {
  "use strict";
  const W = 1280, H = 720;
  const FONT = '"Baloo 2", "Trebuchet MS", sans-serif';
  const S = (window.Book && Book.sfx) || new Proxy({}, { get: () => () => {} });
  const R = window.SpoonbillSim, LEVELS = R.LEVELS, clamp = R.clamp;
  const SPEED = parseFloat((location.search.match(/[?&]speed=([\d.]+)/) || [])[1]) || 1;   // test runs only
  const UNLOCK = /[?&]unlock=1/.test(location.search);
  const say = t => { if (window.Book && !Book.muted && Book.speak) Book.speak(t.replace(/[^\x20-\x7E]/g, "")); };

  /* ------------------------------------------------------------ save */
  const BLANK = () => ({ stars: {}, best: 0 });
  const save = {
    get() { try { return Object.assign(BLANK(), JSON.parse(localStorage.getItem("sj-save")) || {}); } catch (e) { return BLANK(); } },
    set(v) { try { localStorage.setItem("sj-save", JSON.stringify(v)); } catch (e) {} },
  };
  const totalStars = sv => Object.values(sv.stars).reduce((a, b) => a + b, 0);
  const FACTS = {
    sweep: "A spoonbill's bill can feel a fish touch it. Swish, swish, snap! It doesn't need to see the fish at all.",
    south: "Young black-faced spoonbills tracked by satellite flew about 1,200 km on average from Korea to their winter homes, resting 2 or 3 times on the way.",
    pond: "Spoonbills mostly eat from dusk to dawn. On dark nights, they find fish by touch, not by sight.",
    monsoon: "In autumn, the northeast monsoon wind blows toward Taiwan. Spoonbills ride it south!",
    tide: "Spoonbills like to feed where the water is shallow, only about as deep as a ruler is long, or less.",
    spring: "In spring, adult spoonbills grow yellow feathers on the head and chest, then fly north to build nests.",
    feast: "After the fish harvest, Tainan's fish farmers drain their ponds. The little fish left behind are a feast for spoonbills!",
    long: "Most black-faced spoonbills nest on small islands off the west coast of Korea, then cross the Yellow Sea.",
    free: "In 2026, more than half of all the black-faced spoonbills in the world spent the winter in Taiwan.",
  };

  /* ------------------------------------------------------------ helpers */
  function txt(sc, x, y, s, size, color, opts) {
    return sc.add.text(x, y, s, Object.assign({ fontFamily: FONT, fontSize: size + "px", fontStyle: "800", color: color || "#fff",
      stroke: "#26324a", strokeThickness: Math.max(3, size / 6), align: "center" }, opts || {})).setOrigin(0.5);
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
  function fit(img, size) { img.setScale(size / Math.max(img.width, img.height)); return img; }
  function panel(sc, x, y, w, h, color) {
    const g = sc.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x - w / 2, y - h / 2 + 10, w, h, 36);
    g.fillStyle(0xfffaf2, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    g.lineStyle(6, color || 0x2f9e8f, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    return g;
  }
  const rand = (() => { let s = 13; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

  /* ============================================================ BOOT */
  const ART = ["bomi", "bomi_sweep", "bomi_fly", "bomi_spring", "fish", "shrimp", "ting", "agong", "bg_night", "bg_dusk", "p01"];
  class Boot extends Phaser.Scene {
    constructor() { super("boot"); }
    preload() {
      txt(this, W / 2, H / 2 - 60, "Bomi is waking up...", 40);
      const bar = this.add.graphics();
      this.load.on("progress", v => bar.clear().fillStyle(0xffffff, .3).fillRoundedRect(440, H / 2, 400, 28, 14).fillStyle(0xf2a516, 1).fillRoundedRect(440, H / 2, 400 * v, 28, 14));
      ART.forEach(k => this.load.image(k, "img/" + k + ".webp"));
    }
    create() {
      const mk = (k, w, h, draw) => { if (this.textures.exists(k)) return; const g = this.make.graphics({ add: false }); draw(g); g.generateTexture(k, w, h); g.destroy(); };
      ART.forEach(k => mk(k, 64, 64, g => g.fillStyle(0xffffff, 1).fillCircle(32, 32, 30)));
      // a rain cloud seen from above: soft gray puffs with a darker middle
      const RT = this.textures.createCanvas("rain", 256, 256), c = RT.getContext();
      const blob = (x, y, r, a, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(" + col + "," + a + ")"); g.addColorStop(1, "rgba(" + col + ",0)"); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); };
      [[128, 128, 115], [80, 110, 70], [170, 100, 70], [120, 175, 70], [185, 160, 60]].forEach(([x, y, r]) => blob(x, y, r, 0.85, "120,128,150"));
      blob(128, 128, 70, 0.7, "70,78,104");
      RT.refresh();
      this.scene.start("menu");
    }
  }

  /* ============================================================ MENU */
  class Menu extends Phaser.Scene {
    constructor() { super("menu"); }
    create() {
      const sv = save.get();
      this.add.image(W / 2, H / 2, "p01").setDisplaySize(W, H).setAlpha(0.55);
      this.add.rectangle(W / 2, H / 2, W, H, 0xfff4e6, 0.45);
      const b = fit(this.add.image(150, 110, "bomi_fly"), 220).setAngle(70);
      this.tweens.add({ targets: b, y: "-=10", duration: 1300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      fit(this.add.image(1150, 130, "ting"), 170);
      txt(this, W / 2, 70, "Spoonbill Journey!", 76, "#ffffff", { stroke: "#2f9e8f", strokeThickness: 12 });
      txt(this, W / 2, 132, "Sweep for fish at night, and fly between Korea and Taiwan.  ⭐ " + totalStars(sv) + " / " + LEVELS.length * 3, 24, "#26324a", { strokeThickness: 0 });
      LEVELS.forEach((L, i) => {
        const x = 205 + (i % 4) * 290, y = 240 + Math.floor(i / 4) * 170;
        const open = UNLOCK || i === 0 || (sv.stars[LEVELS[i - 1].k] || 0) > 0;
        const c = this.add.container(x, y), bg = this.add.graphics(), fly = L.kind === "fly";
        bg.fillStyle(0x000000, 0.2).fillRoundedRect(-130, -66, 260, 140, 26);
        bg.fillStyle(open ? 0xfffaf2 : 0xd9dee6, 1).fillRoundedRect(-130, -72, 260, 140, 26);
        bg.lineStyle(5, fly ? 0x4f86f7 : 0x2f9e8f, 1).strokeRoundedRect(-130, -72, 260, 140, 26);
        c.add(bg);
        c.add(fit(this.add.image(-74, -16, fly ? (L.season === "spring" ? "bomi_spring" : "bomi_fly") : "bomi_sweep"), 92).setAlpha(open ? 1 : 0.4));
        c.add(txt(this, 52, -38, String(i + 1), 34, open ? (fly ? "#4f86f7" : "#2f9e8f") : "#9aa3b0", { strokeThickness: 0 }));
        c.add(txt(this, 0, 26, L.name, 23, open ? "#26324a" : "#9aa3b0", { strokeThickness: 0, wordWrap: { width: 240 } }));
        const st = sv.stars[L.k] || 0;
        c.add(txt(this, 52, -6, open ? "★".repeat(st) + "☆".repeat(3 - st) : "🔒", 28, "#ffc41f", { strokeThickness: 3, stroke: "#8a6a10" }));
        if (open) {
          c.setSize(260, 140).setInteractive({ useHandCursor: true });
          c.on("pointerover", () => c.setScale(1.04)); c.on("pointerout", () => c.setScale(1));
          c.on("pointerup", () => { S.whoosh(); this.scene.start("brief", { level: i }); });
        }
      });
      button(this, W / 2, 640, 520, 76, "🐟 Free Feeding  (best: " + (sv.best || 0) + ")", 0x2f9e8f, () => this.scene.start("brief", { level: -1 }), 28);
    }
  }

  /* ============================================================ BRIEFING */
  class Brief extends Phaser.Scene {
    constructor() { super("brief"); }
    init(d) { this.li = d.level; }
    create() {
      const L = this.li < 0 ? R.FREE : LEVELS[this.li], fly = L.kind === "fly";
      this.add.image(W / 2, H / 2, fly ? "p01" : L.bg).setDisplaySize(W, H);
      panel(this, W / 2, H / 2, 1060, 600, fly ? 0x4f86f7 : 0x2f9e8f);
      txt(this, W / 2, 110, (this.li < 0 ? "" : "Mission " + (this.li + 1) + ": ") + L.name, 46, "#26324a", { strokeThickness: 0 });
      fit(this.add.image(260, 330, fly ? (L.season === "spring" ? "bomi_spring" : "bomi_fly") : "bomi_sweep"), 300);
      txt(this, 760, 250, L.intro, 28, "#26324a", { strokeThickness: 0, wordWrap: { width: 620 }, align: "left" });
      txt(this, 760, 450, "💡 " + FACTS[L.k], 23, "#2f9e8f", { strokeThickness: 0, wordWrap: { width: 620 }, align: "left" });
      button(this, 520, 630, 260, 74, "◀ Back", 0x6b7a90, () => this.scene.start("menu"), 28);
      button(this, 800, 630, 300, 74, "Let's go! ▶", 0xf2a516, () => this.scene.start(fly ? "fly" : "feed", { level: this.li }), 30);
      say(L.intro);
    }
  }

  /* ============================================================ FEED */
  class Feed extends Phaser.Scene {
    constructor() { super("feed"); }
    init(d) { this.li = d.level; }
    create() {
      const L = this.li < 0 ? R.FREE : LEVELS[this.li];
      Object.assign(this, { L, s: R.create(L), mem: {}, ended: false, toastQ: [], msgT: 0, quit: false, fishImgs: new Map(), ripples: [], deepT: null });
      const s = this.s;
      this.add.image(W / 2, H / 2, L.bg).setDisplaySize(W, H);
      if (L.dark) this.add.rectangle(W / 2, H / 2, W, H, 0x0a1430, 0.25);
      this.waterG = this.add.graphics().setDepth(2);
      this.fishLayer = this.add.layer().setDepth(3);
      this.rippleG = this.add.graphics().setDepth(4);
      this.mudG = this.add.graphics().setDepth(5);
      this.bird = fit(this.add.image(s.x, 0, "bomi_sweep"), 250).setOrigin(0.5, 1).setDepth(6);
      this.swishG = this.add.graphics().setDepth(7);
      this.agong = fit(this.add.image(90, 0, "agong"), 190).setOrigin(0.5, 1).setDepth(6).setVisible(false);
      // panel: food and time
      const box = this.add.graphics().setDepth(20);
      box.fillStyle(0xffffff, 0.9).fillRoundedRect(14, 14, 400, 100, 22);
      txt(this, 30, 38, L.name, 24, "#26324a", { strokeThickness: 0 }).setOrigin(0, 0.5).setDepth(21);
      this.foodT = txt(this, 30, 80, "", 26, "#26324a", { strokeThickness: 0 }).setOrigin(0, 0.5).setDepth(21);
      this.foodG = this.add.graphics().setDepth(21);
      this.timeT = txt(this, W - 170, 44, "", 26, "#ffffff").setDepth(21);
      this.msg = txt(this, W / 2, 170, "", 28, "#ffffff", { wordWrap: { width: 820 } }).setDepth(25).setAlpha(0);
      if (L.free) button(this, W - 130, H - 60, 200, 70, "✅ DONE", 0x5ccf6a, () => { this.quit = true; }, 28).setDepth(30);
      button(this, W - 90, 110, 140, 56, "◀ Menu", 0x6b7a90, () => this.scene.start("menu"), 20).setDepth(30);
      // hold a finger on the pond: Bomi walks there
      this.input.on("pointerdown", p => { if (p.y > 140) this.aimPtr = p; });
      this.input.on("pointerup", () => { this.aimPtr = null; });
      this.keys = this.input.keyboard.createCursorKeys();
      this.toast(L.dark ? "🌙 Follow the little ripples! Hold your finger on the water to walk." : "👆 Hold your finger on the water, and Bomi walks there. Walk slowly!", true);
      window.__sj = this; window.__sjGame = this.game;
    }
    toast(t, speak) { this.toastQ.push(t); if (speak) say(t); }
    update(_, dms) {
      const dt = Math.min(0.05, dms / 1000) * SPEED, s = this.s;
      if (this.ended) return;
      let inp = { quit: this.quit };
      if (this.aimPtr && this.aimPtr.isDown) inp.x = this.aimPtr.x;
      else if (this.keys.left.isDown) inp.left = true; else if (this.keys.right.isDown) inp.right = true;
      if (window.__sjBot) inp = R.bot(s, dt, this.mem);
      const n = Math.max(1, Math.ceil(dt / (1 / 30)));
      for (let i = 0; i < n; i++) { R.step(s, dt / n, inp); this.handle(s.events); if (s.done) break; }
      this.draw(dt);
      this.msgT -= dt;
      if (this.msgT <= 0 && this.toastQ.length) { this.msg.setText(this.toastQ.shift()).setAlpha(1); this.msgT = 2.4; }
      else if (this.msgT <= 0) this.msg.setAlpha(Math.max(0, this.msg.alpha - 0.05));
      if (s.done) this.finish();
    }
    handle(evs) {
      for (const e of evs) {
        if (e.type === "catch") {
          S.munch(); const t = txt(this, e.x, e.y - 30, e.kind === "fish" ? "Gulp! +2" : "Yum! +1", 26, "#fff3a8").setDepth(26);
          this.tweens.add({ targets: t, y: t.y - 60, alpha: 0, duration: 900, onComplete: () => t.destroy() });
        } else if (e.type === "scared") { if (!this.saidScare || this.time.now - this.saidScare > 5000) { this.saidScare = this.time.now; S.splash(); this.toast("💦 Oops, the fish got scared! Walk slowly, and sweep."); } }
        else if (e.type === "tooDeep") this.toast("🚫 Too deep for Bomi's legs! Spoonbills feed in shallow water.");
        else if (e.type === "drain") { S.splash(); this.agong.setVisible(true); this.toast("👴 A-gong opened the water gate! The pond is getting shallow. Look for fish!", true); }
        else if (e.type === "done") S.yay();
      }
    }
    draw(dt) {
      const s = this.s, L = this.L, t = this.time.now / 1000;
      // water (deep water is darker; too-deep water is marked) and the mud bottom
      const wg = this.waterG.clear(), mg = this.mudG.clear();
      let deepX = 0, deepN = 0;
      for (let x = 0; x < W; x += 16) {
        const b = s.bottom(x + 8), d = b - s.wl;
        if (d > 0) {
          const deep = d > R.LEG;
          wg.fillStyle(deep ? 0x1d4a7a : 0x3f86c4, L.dark ? 0.75 : 0.6).fillRect(x, s.wl, 16, d);
          wg.fillStyle(0xffffff, 0.12).fillRect(x, s.wl, 16, Math.min(d, 10));
          if (deep) { deepX += x + 8; deepN++; }
        }
      }
      wg.lineStyle(4, 0xd6efff, 0.85).lineBetween(0, s.wl, W, s.wl);
      if (!this.deepT) this.deepT = txt(this, 0, 0, "🚫 too deep", 22, "#bcd8ff").setDepth(4).setAlpha(0.85);
      this.deepT.setVisible(deepN > 2).setPosition(deepX / Math.max(1, deepN), s.wl + 40);
      const pts = []; for (let x = 0; x <= W; x += 16) pts.push({ x, y: s.bottom(x) }); pts.push({ x: W, y: H }, { x: 0, y: H });
      mg.fillStyle(L.dark ? 0x5a473a : 0x8a6a4c, 1).fillPoints(pts, true);
      mg.lineStyle(4, L.dark ? 0x6b5546 : 0x9b7a55, 1).strokePoints(pts.slice(0, pts.length - 2), false);
      // fish: clear in daylight, only ripples on dark nights unless the bill is near
      const tip = R.billTip(s), seen = new Set();
      for (const f of s.fish) {
        seen.add(f);
        let im = this.fishImgs.get(f);
        if (!im) { im = fit(this.add.image(f.x, f.y, f.kind), f.kind === "fish" ? 58 : 44); this.fishLayer.add(im); this.fishImgs.set(f, im); }
        const near = Math.hypot(f.x - tip.x, f.y - tip.y) < 130;
        im.setPosition(f.x, f.y).setFlipX(f.vx < 0).setAlpha(L.dark ? (near ? 0.75 : 0.12) : 0.9);
        if (L.dark && Math.random() < dt * 0.9) this.ripples.push({ x: f.x, y: s.wl, r: 4, a: 0.8 });
      }
      for (const [f, im] of this.fishImgs) if (!seen.has(f)) { im.destroy(); this.fishImgs.delete(f); }
      const rg = this.rippleG.clear();
      this.ripples = this.ripples.filter(r => (r.r += 40 * dt, r.a -= 0.7 * dt) > 0);
      for (const r of this.ripples) rg.lineStyle(3, 0xffffff, r.a).strokeEllipse(r.x, r.y + 2, r.r * 2, r.r * 0.6);
      // Bomi: feet on the bottom, swaying a little as it sweeps
      const floor = s.bottom(s.x), wet = floor - s.wl > 6;
      this.bird.setTexture(wet ? "bomi_sweep" : "bomi"); fit(this.bird, wet ? 250 : 230);
      this.bird.setFlipX(s.face < 0).setPosition(s.x + (wet ? Math.sin(s.phase) * 8 * s.face : 0), floor + 6 + (s.v ? Math.abs(Math.sin(t * 9)) * -4 : 0));
      const sg = this.swishG.clear();
      if (wet && tip.wet) { sg.lineStyle(4, 0xffffff, 0.6).beginPath().arc(s.x + s.face * 92, tip.y - 36, 40, Math.PI * 0.15, Math.PI * 0.85).strokePath(); sg.fillStyle(0xffffff, 0.5).fillCircle(tip.x, tip.y, 6); }
      if (this.agong.visible) this.agong.setPosition(80, s.bottom(80) + 4);
      // panel
      if (L.free) this.foodT.setText("🐟 " + s.food);
      else {
        this.foodT.setText("🐟 " + s.food + " / " + L.goal);
        const fg = this.foodG.clear(); fg.fillStyle(0xe3ecf7, 1).fillRoundedRect(160, 70, 230, 22, 11).fillStyle(0x5ccf6a, 1).fillRoundedRect(160, 70, Math.max(10, 230 * Math.min(1, s.food / L.goal)), 22, 11);
        const left = Math.max(0, Math.ceil(L.T - s.t));
        this.timeT.setText((L.dark ? "🌙 Sunrise in " : "⏱️ ") + left + " s");
      }
    }
    finish() {
      if (this.ended) return; this.ended = true;
      const r = this.s.result, sv = save.get();
      if (this.L.free) { if (r.food > (sv.best || 0)) sv.best = r.food; }
      else sv.stars[this.L.k] = Math.max(sv.stars[this.L.k] || 0, r.stars);
      save.set(sv);
      this.time.delayedCall(1100, () => this.scene.start("result", { level: this.li, r, kind: "feed" }));
    }
  }

  /* ============================================================ FLY */
  class Fly extends Phaser.Scene {
    constructor() { super("fly"); }
    init(d) { this.li = d.level; }
    create() {
      const L = LEVELS[this.li];
      Object.assign(this, { L, s: R.create(L), mem: {}, ended: false, toastQ: [], msgT: 0, streaks: [] });
      const s = this.s, P = R.P, cam = this.cameras.main;
      const [mw, mh] = P([R.MAP.e, R.MAP.s]);
      cam.setBackgroundColor("#4f9fd8").setBounds(-200, -200, mw + 400, mh + 400);
      const land = this.add.graphics().setDepth(1);
      for (const k in R.COAST) {
        const pts = R.COAST[k].map(p => { const q = P(p); return { x: q[0], y: q[1] }; });
        const home = k === "taiwan" || k === "nest";
        land.fillStyle(home ? 0xa6d47e : 0xe4dcbd, 1).lineStyle(8, home ? 0x6fae52 : 0xc3b78f, 1).fillPoints(pts, true).strokePoints(pts, true);
      }
      const lab = (lonlat, t, size, col) => { const q = P(lonlat); return txt(this, q[0], q[1], t, size, col || "#ffffff", { stroke: "#2b4a6b", strokeThickness: 8 }).setDepth(3); };
      lab([116.5, 36.5], "China", 64, "#8b6a3c"); lab([127.6, 36.8], "Korea", 52, "#8b6a3c"); lab([130.6, 32.2], "Japan", 48, "#8b6a3c");
      lab([121.0, 23.8], "Taiwan", 48, "#3f7a2f"); lab([123.3, 36.0], "Yellow Sea", 52); lab([124.5, 29.5], "East China Sea", 52);
      // stopovers and the goal
      this.ringG = this.add.graphics().setDepth(4);
      s.stops.forEach(st => txt(this, st.x, st.y + 110, st.name, 30, "#ffffff", { stroke: "#1f6f4a", strokeThickness: 7 }).setDepth(5));
      txt(this, s.goal.x, s.goal.y + 120, "🏁 " + s.goal.name, 34, "#fff3a8", { stroke: "#7a4a00", strokeThickness: 8 }).setDepth(5);
      this.cloudImgs = s.clouds.map(c => this.add.image(c.x, c.y, "rain").setDepth(8).setScale(c.r * 2.4 / 256));
      this.rainG = this.add.graphics().setDepth(8.5);
      this.streakG = this.add.graphics().setDepth(6);
      for (let i = 0; i < 70; i++) this.streaks.push({ x: 0, y: 0, life: 0, max: 1 });
      this.bird = fit(this.add.image(s.x, s.y, "bomi_fly"), 150).setDepth(10);
      cam.startFollow(this.bird, true, 0.08, 0.08);
      // HUD (camera zoom is 1, so these can simply stay put)
      const box = this.add.graphics().setScrollFactor(0).setDepth(30);
      box.fillStyle(0xffffff, 0.9).fillRoundedRect(14, 14, 400, 104, 22);
      txt(this, 30, 38, L.name, 24, "#26324a", { strokeThickness: 0 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(31);
      txt(this, 30, 82, "💪", 26, "#26324a", { strokeThickness: 0 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(31);
      this.energyG = this.add.graphics().setScrollFactor(0).setDepth(31);
      this.windT = txt(this, W / 2, H - 36, "", 26, "#ffffff").setScrollFactor(0).setDepth(31);
      this.msg = txt(this, W / 2, 160, "", 28, "#ffffff", { wordWrap: { width: 820 } }).setScrollFactor(0).setDepth(35).setAlpha(0);
      // mini-map
      const k = 200 / mh, mx = W - 14 - mw * k, my = 14;
      this.mini = { k, mx, my };
      const mm = this.add.graphics().setScrollFactor(0).setDepth(30);
      mm.fillStyle(0x000000, 0.25).fillRoundedRect(mx - 6, my + 2, mw * k + 12, mh * k + 12, 12).fillStyle(0x4f9fd8, 1).fillRoundedRect(mx - 6, my - 4, mw * k + 12, mh * k + 12, 12);
      for (const key in R.COAST) mm.fillStyle(key === "taiwan" ? 0xa6d47e : 0xe4dcbd, 1).fillPoints(R.COAST[key].map(p => { const q = P(p); return { x: clamp(mx + q[0] * k, mx, mx + mw * k), y: clamp(my + q[1] * k, my, my + mh * k) }; }), true);
      this.miniG = this.add.graphics().setScrollFactor(0).setDepth(31);
      button(this, 90, H - 46, 140, 56, "◀ Menu", 0x6b7a90, () => this.scene.start("menu"), 20).setScrollFactor(0).setDepth(32);
      this.input.on("pointerdown", p => { if (!(p.x > mx - 10 && p.y < my + mh * k + 20) && !(p.x < 180 && p.y > H - 90)) this.aimPtr = p; });
      this.input.on("pointerup", () => { this.aimPtr = null; });
      this.keys = this.input.keyboard.createCursorKeys();
      this.toast(L.season === "spring" ? "🌸 Fly north to Korea! Touch where you want Bomi to fly." : "🍂 Fly south to Taiwan! Touch where you want Bomi to fly. Rest at the green wetlands.", true);
      window.__sj = this; window.__sjGame = this.game;
    }
    toast(t, speak) { this.toastQ.push(t); if (speak) say(t); }
    update(_, dms) {
      const dt = Math.min(0.05, dms / 1000) * SPEED, s = this.s;
      if (this.ended) return;
      let inp = {};
      if (this.aimPtr && this.aimPtr.isDown) { const p = this.cameras.main.getWorldPoint(this.aimPtr.x, this.aimPtr.y); inp.aim = { x: p.x, y: p.y }; }
      else if (this.keys.left.isDown) inp.turn = -1; else if (this.keys.right.isDown) inp.turn = 1;
      if (window.__sjBot) inp = R.bot(s, dt, this.mem);
      const n = Math.max(1, Math.ceil(dt / (1 / 30)));
      for (let i = 0; i < n; i++) { R.step(s, dt / n, inp); this.handle(s.events); if (s.done) break; }
      this.draw(dt);
      this.msgT -= dt;
      if (this.msgT <= 0 && this.toastQ.length) { this.msg.setText(this.toastQ.shift()).setAlpha(1); this.msgT = 2.4; }
      else if (this.msgT <= 0) this.msg.setAlpha(Math.max(0, this.msg.alpha - 0.05));
      if (s.done) this.finish();
    }
    handle(evs) {
      for (const e of evs) {
        if (e.type === "rest") { S.ding(); this.toast("🍽️ Resting and eating at the " + e.name + ". Yum!"); }
        else if (e.type === "rested") S.chirp();
        else if (e.type === "tired") { S.oops(); this.toast("😴 Bomi is tired! It glides to the nearest wetland to rest.", true); }
        else if (e.type === "bump") { S.oops(); this.cameras.main.shake(220, 0.005); this.toast("🌧️ Bumpy rain cloud! Fly around the gray clouds."); }
        else if (e.type === "done") { S.yay(); this.toast(this.L.season === "spring" ? "🏝️ Home! Time to build a nest." : "🎉 Welcome to Taiwan!", true); }
      }
    }
    draw(dt) {
      const s = this.s, t = this.time.now / 1000, cam = this.cameras.main;
      const rg = this.ringG.clear(), pulse = 1 + 0.08 * Math.sin(t * 5);
      for (const st of s.stops) rg.lineStyle(10, st.done ? 0x9fd8a8 : 0x5ccf6a, st.done ? 0.5 : 1).strokeCircle(st.x, st.y, R.RING * pulse).fillStyle(0x5ccf6a, 0.15).fillCircle(st.x, st.y, R.RING * pulse);
      rg.lineStyle(12, 0xffd23d, 1).strokeCircle(s.goal.x, s.goal.y, R.RING * pulse).fillStyle(0xffd23d, 0.2).fillCircle(s.goal.x, s.goal.y, R.RING * pulse);
      // clouds drift; rain falls
      const rn = this.rainG.clear();
      s.clouds.forEach((c, i) => { this.cloudImgs[i].setPosition(c.x, c.y); for (let k = 0; k < 6; k++) { const x = c.x - 60 + k * 24, y = c.y - 30 + ((t * 120 + k * 37) % 90); rn.lineStyle(3, 0xd6e9ff, 0.7).lineBetween(x, y, x - 6, y + 16); } });
      // the wind, as moving streaks
      const v = cam.worldView, sg = this.streakG.clear();
      for (const p of this.streaks) {
        if ((p.life += dt) > p.max || p.x < v.x - 50 || p.x > v.right + 50 || p.y < v.y - 50 || p.y > v.bottom + 50) { p.x = v.x + rand() * v.width; p.y = v.y + rand() * v.height; p.life = 0; p.max = 1 + rand(); }
        const w = R.wind(s, p.x, p.y); p.x += w.x * dt * 1.5; p.y += w.y * dt * 1.5;
        sg.lineStyle(4, 0xffffff, 0.45 * Math.sin(Math.PI * p.life / p.max)).lineBetween(p.x - w.x * 0.4, p.y - w.y * 0.4, p.x, p.y);
      }
      // Bomi: flapping (or resting)
      const flap = s.rest > 0 ? 1 : 1 + 0.12 * Math.sin(t * 12);
      this.bird.setPosition(s.x, s.y).setRotation(s.a + Math.PI / 2);
      this.bird.scaleX = this.bird.scaleY * flap;
      if (s.tired) this.bird.setTint(0xc8c8d8); else this.bird.clearTint();
      // HUD
      const eg = this.energyG.clear();
      eg.fillStyle(0xe3ecf7, 1).fillRoundedRect(70, 70, 320, 24, 12);
      eg.fillStyle(s.energy < 25 ? 0xff5a6a : s.energy < 50 ? 0xf2a516 : 0x5ccf6a, 1).fillRoundedRect(70, 70, Math.max(12, 320 * s.energy / 100), 24, 12);
      const air = R.AIR, gs = Math.hypot(s.vx, s.vy);
      this.windT.setText(s.rest > 0 ? "🍽️ Resting..." : gs > air * 1.25 ? "🍃 Tailwind! The wind is helping." : gs < air * 0.75 ? "💨 Headwind... it's slow going." : "");
      const { k, mx, my } = this.mini, mg = this.miniG.clear();
      for (const st of s.stops) mg.fillStyle(st.done ? 0x9fd8a8 : 0x2f9e44, 1).fillCircle(mx + st.x * k, my + st.y * k, 4);
      mg.fillStyle(0xffd23d, 1).fillCircle(mx + s.goal.x * k, my + s.goal.y * k, 5);
      mg.fillStyle(0xffffff, 1).fillCircle(mx + s.x * k, my + s.y * k, 5).fillStyle(0xff3fa4, 1).fillCircle(mx + s.x * k, my + s.y * k, 3);
    }
    finish() {
      if (this.ended) return; this.ended = true;
      const r = this.s.result, sv = save.get(); sv.stars[this.L.k] = Math.max(sv.stars[this.L.k] || 0, r.stars); save.set(sv);
      this.time.delayedCall(1400, () => this.scene.start("result", { level: this.li, r, kind: "fly" }));
    }
  }

  /* ============================================================ RESULT */
  class Result extends Phaser.Scene {
    constructor() { super("result"); }
    init(d) { this.d = d; }
    create() {
      const { level, r, kind } = this.d, L = level < 0 ? R.FREE : LEVELS[level];
      this.add.image(W / 2, H / 2, "p01").setDisplaySize(W, H);
      panel(this, W / 2, H / 2, 900, 560, kind === "fly" ? 0x4f86f7 : 0x2f9e8f);
      txt(this, W / 2, 130, L.free ? "Free Feeding" : (r.stars >= 3 ? "Amazing! 🎉" : r.stars === 2 ? "Great job! 👏" : "You did it! 👍"), 52, "#26324a", { strokeThickness: 0 });
      if (!L.free) txt(this, W / 2, 210, "★".repeat(r.stars) + "☆".repeat(3 - r.stars), 72, "#ffc41f", { stroke: "#8a6a10", strokeThickness: 5 });
      let lines;
      if (kind === "feed") lines = [L.free ? "🐟 Food: " + r.food : "🐟 Food: " + r.food + " / " + r.goal + (r.full ? "  Full tummy!" : "  Still a little hungry"), "🎣 Caught: " + r.caught,
        r.scared ? "💦 Scared fish: " + r.scared + "  (walk slowly!)" : "🤫 You never scared a fish. Sneaky!"];
      else lines = ["🏝️ Stopovers: " + r.stops, r.tired ? "😴 Got tired " + r.tired + " time" + (r.tired > 1 ? "s" : "") + " (rest at the wetlands)" : "💪 Never too tired!",
        r.bumps ? "🌧️ Rain cloud bumps: " + r.bumps : "☀️ No bumps. Smooth flying!"];
      txt(this, W / 2, 330, lines.join("\n"), 27, "#26324a", { strokeThickness: 0, lineSpacing: 10 });
      txt(this, W / 2, 470, "💡 " + FACTS[L.k], 22, "#2f9e8f", { strokeThickness: 0, wordWrap: { width: 780 } });
      const next = level >= 0 && level < LEVELS.length - 1 ? level + 1 : null;
      button(this, 330, 590, 240, 72, "☰ Menu", 0x6b7a90, () => this.scene.start("menu"), 26);
      button(this, 620, 590, 260, 72, "🔁 Again", 0x2f9e8f, () => this.scene.start(kind === "fly" ? "fly" : "feed", { level }), 26);
      if (next != null) button(this, 920, 590, 280, 72, "Next ▶", 0xf2a516, () => this.scene.start("brief", { level: next }), 28);
      if (r.stars >= 2) { S.yay(); if (window.Book && Book.confetti) Book.confetti(90); }
      window.__sjResult = r;
    }
  }

  window.SpoonbillJourney = {
    start() {
      const timer = /[?&]timer=1/.test(location.search);
      return new Phaser.Game({
        type: Phaser.AUTO, parent: "game", width: W, height: H, backgroundColor: "#26324a",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        fps: timer ? { forceSetTimeOut: true, target: 30 } : undefined,
        scene: [Boot, Menu, Brief, Feed, Fly, Result],
      });
    },
  };
})();
