/* Bridge Puzzle! — build arches, find the numbered pieces of Taipei's old Meiji Bridge, and test bridges against floods (Phaser 3).
   The rules, missions and test bot live in sim.js. This file draws:
   - Arch: the river valley, a wooden frame (centering) with numbered slots, the stones in a tray to drag (or tap, then tap a slot),
     the deck on top, bronze lamps, and a truck (and Hao and A-ma on Opening Day) crossing at the end.
   - Find: an old empty swimming pool full of numbered blocks, some under tarps; a crane lifts each one to the truck.
   - Flood: the river from the side, a bridge whose height and piers you change, then a flood, a truck and sometimes a boat.
   Nothing breaks: a wrong stone slides back to the tray, a failed flood test just shows what went wrong. */
(function () {
  "use strict";
  const W = 1280, H = 720;
  const FONT = '"Baloo 2", "Trebuchet MS", sans-serif';
  const S = (window.Book && Book.sfx) || new Proxy({}, { get: () => () => {} });
  const R = window.BridgeSim, LEVELS = R.LEVELS, clamp = R.clamp, RV = R.RIVER;
  const SPEED = parseFloat((location.search.match(/[?&]speed=([\d.]+)/) || [])[1]) || 1;   // test runs only
  const UNLOCK = /[?&]unlock=1/.test(location.search);
  const say = t => { if (window.Book && !Book.muted && Book.speak) Book.speak(t.replace(/[^\x20-\x7E]/g, "")); };

  /* ------------------------------------------------------------ save */
  const BLANK = () => ({ stars: {}, best: 0 });
  const save = {
    get() { try { return Object.assign(BLANK(), JSON.parse(localStorage.getItem("bp-save")) || {}); } catch (e) { return BLANK(); } },
    set(v) { try { localStorage.setItem("bp-save", JSON.stringify(v)); } catch (e) {} },
  };
  const totalStars = sv => Object.values(sv.stars).reduce((a, b) => a + b, 0);
  const FACTS = {
    first: "The top stone of an arch is called the keystone. Until it is in, the arch needs a wooden frame to hold it up.",
    pool: "In 2002, the Meiji Bridge was cut into 435 pieces. They lie in an old empty swimming pool in Taipei.",
    flood: "A bridge over a river must let floodwater pass underneath. Engineers look at old floods to see how high the water can get.",
    bigger: "The Meiji Bridge opened in 1933. Its arches were made of concrete with steel inside, shaped like a stone arch.",
    tarps: "Every piece got a number when the bridge was taken apart, so one day it could go back in the right place.",
    boats: "Each pier in the river pushes a flood a little higher, and leaves less room for boats. But arches can't be too long, either.",
    lamps: "The bridge had two pairs of bronze lamps. In 1968 the bridge was made wider for cars, and the lamps came off.",
    opening: "In 2026, experts, students and neighbors shared ideas about where the bridge could go. The city plans a report in January 2027.",
    free: "People have built arches for thousands of years. Two books leaning on each other make a tiny arch!",
  };

  /* ------------------------------------------------------------ helpers */
  function txt(sc, x, y, s, size, color, opts) {
    return sc.add.text(x, y, s, Object.assign({ fontFamily: FONT, fontSize: size + "px", fontStyle: "800", color: color || "#fff",
      stroke: "#1e2340", strokeThickness: Math.max(3, size / 6), align: "center" }, opts || {})).setOrigin(0.5);
  }
  function button(sc, x, y, w, h, label, fill, onClick, size) {
    const c = sc.add.container(x, y).setDepth(40), g = sc.add.graphics();
    const draw = d => { g.clear(); g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, Math.min(h / 2, 26));
      g.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2 + (d ? 5 : 0), w, h, Math.min(h / 2, 26));
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(-w / 2 + 10, -h / 2 + 6 + (d ? 5 : 0), w - 20, h * 0.3, h * 0.15); };
    draw(false);
    const t = txt(sc, 0, -2, label, size || 30);
    c.add([g, t]); c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on("pointerdown", () => { draw(true); t.y = 3; c.pressed = true; });
    c.on("pointerup", () => { draw(false); t.y = -2; if (c.pressed) { c.pressed = false; S.tap(); onClick(); } });
    c.on("pointerout", () => { draw(false); t.y = -2; c.pressed = false; });
    c.setLabel = s => t.setText(s);
    return c;
  }
  function fit(img, size) { img.setScale(size / Math.max(img.width, img.height)); return img; }
  function panel(sc, x, y, w, h, color) {
    const g = sc.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x - w / 2, y - h / 2 + 10, w, h, 36);
    g.fillStyle(0xfffaf2, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    g.lineStyle(6, color || 0xb97a2e, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    return g;
  }
  const rand = (() => { let s = 23; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const KIND = { arch: { icon: "hao", color: 0xb97a2e, css: "#94601f" }, find: { icon: "ama", color: 0x4f86c6, css: "#2f62a0" }, flood: { icon: "engineer", color: 0x3f9e5a, css: "#2b7a42" } };
  function toaster(sc, y) {
    sc.toastQ = []; sc.msgT = 0;
    sc.msg = txt(sc, W / 2 + 60, y || 150, "", 28, "#ffffff", { wordWrap: { width: 720 } }).setDepth(45).setAlpha(0);
    sc.toast = (t, speak) => { if (sc.toastQ[sc.toastQ.length - 1] !== t) sc.toastQ.push(t); if (speak) say(t); };
    // feedback on what the kid just did: show it now, and drop older messages still waiting
    sc.toastNow = (t, speak) => { sc.toastQ = []; sc.msg.setText(t).setAlpha(1); sc.msgT = 2.6; if (speak) say(t); };
    sc.tickToast = dt => {
      sc.msgT -= dt;
      if (sc.msgT <= 0 && sc.toastQ.length) { sc.msg.setText(sc.toastQ.shift()).setAlpha(1); sc.msgT = 2.6; }
      else if (sc.msgT <= 0) sc.msg.setAlpha(Math.max(0, sc.msg.alpha - 0.05));
    };
  }
  function hud(sc, name) {
    const box = sc.add.graphics().setDepth(30);
    box.fillStyle(0xffffff, 0.9).fillRoundedRect(14, 14, 440, 104, 22);
    txt(sc, 30, 38, name, 24, "#1e2340", { strokeThickness: 0 }).setOrigin(0, 0.5).setDepth(31);
    sc.infoT = txt(sc, 30, 82, "", 24, "#1e2340", { strokeThickness: 0 }).setOrigin(0, 0.5).setDepth(31);
    button(sc, W - 90, 46, 140, 56, "◀ Menu", 0x6b7a90, () => sc.scene.start("menu"), 20);
  }
  const STONE = 0xd6d1c8, STONE_D = 0x8f8a80, WOOD = 0xb98a55, WOOD_L = 0xe9cfa6, WATER = 0x5aa0d8;
  // a wedge stone between radii r1 and r2 from angle a0 to a1 (0 = right, PI = left, measured upward)
  function wedgePts(cx, cy, r1, r2, a0, a1) {
    const pts = [], n = 6;
    for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; pts.push({ x: cx + r2 * Math.cos(a), y: cy - r2 * Math.sin(a) }); }
    for (let k = n; k >= 0; k--) { const a = a0 + (a1 - a0) * k / n; pts.push({ x: cx + r1 * Math.cos(a), y: cy - r1 * Math.sin(a) }); }
    return pts;
  }

  /* ============================================================ BOOT */
  const ART = ["hao", "hao_cheer", "ama", "lamp", "truck", "boat", "engineer", "bg_valley", "p01", "p03", "p05", "p06"];
  class Boot extends Phaser.Scene {
    constructor() { super("boot"); }
    preload() {
      txt(this, W / 2, H / 2 - 60, "Hao is sorting the stones...", 40);
      const bar = this.add.graphics();
      this.load.on("progress", v => bar.clear().fillStyle(0xffffff, .3).fillRoundedRect(440, H / 2, 400, 28, 14).fillStyle(0xb97a2e, 1).fillRoundedRect(440, H / 2, 400 * v, 28, 14));
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
      this.add.rectangle(W / 2, H / 2, W, H, 0x2a2232, 0.4);
      fit(this.add.image(120, 110, "hao_cheer"), 170);
      fit(this.add.image(1165, 110, "ama"), 170);
      txt(this, W / 2, 70, "Bridge Puzzle!", 80, "#ffffff", { stroke: "#835317", strokeThickness: 12 });
      txt(this, W / 2, 134, "Build arches, find the 435 pieces, and keep bridges safe from floods.  ⭐ " + totalStars(sv) + " / " + LEVELS.length * 3, 24, "#ffffff", { strokeThickness: 4 });
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
      button(this, W / 2, 640, 560, 76, "🧱 Free Build: Big Arch  (best: " + (sv.best ? sv.best + " s" : "-") + ")", 0xb97a2e, () => this.scene.start("brief", { level: -1 }), 26);
    }
  }

  /* ============================================================ BRIEFING */
  const briefArt = L => L.kind === "find" ? "p05" : L.kind === "flood" ? "p03" : L.k === "opening" ? "p06" : "p01";
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

  /* ============================================================ ARCH */
  const ACX = 640, ACY = 545, TRAY_Y = 655;
  class Arch extends Phaser.Scene {
    constructor() { super("arch"); }
    init(d) { this.li = d.level; }
    create() {
      const L = this.li < 0 ? R.FREE : LEVELS[this.li];
      Object.assign(this, { L, s: R.create(L), mem: {}, ended: false, drag: null, pick: null, falls: [], dust: [], frameY: 0, idle: 0, acts: [] });
      const s = this.s, n = s.n;
      this.r1 = n <= 5 ? 150 : n <= 9 ? 170 : n <= 11 ? 190 : 205; this.r2 = this.r1 + (n <= 5 ? 85 : 65);
      this.input.addPointer(2);
      this.add.image(W / 2, H / 2, "bg_valley").setDisplaySize(W, H);
      // river and banks
      const g = this.add.graphics().setDepth(1);
      g.fillStyle(WATER, 1).fillRect(ACX - this.r2 + 10, ACY - 10, 2 * this.r2 - 20, 120);
      g.fillStyle(0x8cc276, 1).fillRect(0, ACY - 30, ACX - this.r2 + 10, 300).fillRect(ACX + this.r2 - 10, ACY - 30, W, 300);
      g.fillStyle(STONE_D, 1).fillRect(ACX - this.r2 - 60, ACY - 60, 70, 110).fillRect(ACX + this.r2 - 10, ACY - 60, 70, 110);
      this.slots = [...Array(n).keys()].map(i => {
        const a1 = Math.PI - i * Math.PI / n, a0 = a1 - Math.PI / n, am = (a0 + a1) / 2, rm = (this.r1 + this.r2) / 2;
        return { i, pts: wedgePts(ACX, ACY, this.r1, this.r2, a0, a1), x: ACX + rm * Math.cos(am), y: ACY - rm * Math.sin(am), a: am };
      });
      this.frameG = this.add.graphics().setDepth(2);
      this.archG = this.add.graphics().setDepth(3);
      this.deckG = this.add.graphics().setDepth(4);
      this.slotT = this.slots.map(sl => txt(this, sl.x, sl.y, String(sl.i + 1), 26, "#ffffff").setDepth(5));
      this.lampSpots = [ACX - this.r2 - 30, ACX - this.r2 + 40, ACX + this.r2 - 40, ACX + this.r2 + 30].map(x => ({ x, y: this.deckY() - 8 }));
      this.lampImgs = this.lampSpots.map(p => fit(this.add.image(p.x, p.y, "lamp"), 100).setOrigin(0.5, 1).setDepth(6).setVisible(false));
      this.lampHint = this.add.graphics().setDepth(6);
      this.truck = fit(this.add.image(-200, this.deckY() - 6, "truck"), 170).setOrigin(0.5, 1).setDepth(7);
      this.walkers = [fit(this.add.image(-300, this.deckY() - 4, "hao_cheer"), 110), fit(this.add.image(-380, this.deckY() - 4, "ama"), 120)].map(i => i.setOrigin(0.5, 1).setDepth(7).setVisible(!!L.parade));
      this.trayG = this.add.graphics().setDepth(20);
      this.trayT = [];
      this.fxG = this.add.graphics().setDepth(25);
      hud(this, L.name);
      toaster(this, 150);
      this.frameBtn = button(this, W / 2, TRAY_Y, 420, 80, "👷 Take the frame away", 0x3f9e5a, () => this.acts.push(R.removeFrame), 30).setVisible(false);
      // dragging stones from the tray, or tap a stone and then a slot
      this.input.on("pointerdown", p => this.down(p));
      this.input.on("pointermove", p => { if (this.drag) { this.drag.x = p.x; this.drag.y = p.y; } });
      this.input.on("pointerup", p => this.up(p));
      this.toast(L.hint ? "👆 Drag stone 1 to slot 1. Start at the bottom, on both sides!" : "🧱 Build up from both sides. The keystone goes last!", true);
      window.__bp = this; window.__bpGame = this.game;
    }
    deckY() { return ACY - this.r2 - 34; }
    trayPos(k, count) { const gap = Math.min(92, 1000 / Math.max(1, count)); return { x: W / 2 - (count - 1) * gap / 2 + k * gap, y: TRAY_Y }; }
    stoneAt(p) {
      const tr = this.s.tray;
      for (let k = 0; k < tr.length; k++) { const q = this.trayPos(k, tr.length); if (Math.abs(p.x - q.x) < 42 && Math.abs(p.y - q.y) < 42) return tr[k]; }
      return null;
    }
    slotAt(p) {
      let best = null, bd = 70;
      this.slots.forEach(sl => { const d = Math.hypot(p.x - sl.x, p.y - sl.y); if (d < bd) { bd = d; best = sl.i; } });
      return best;
    }
    down(p) {
      const s = this.s; if (this.ended) return;
      if (s.phase === "stones") {
        const num = this.stoneAt(p);
        if (num != null) { this.drag = { num, x: p.x, y: p.y, sx: p.x, sy: p.y }; S.pop(); return; }
        if (this.pick != null) { const slot = this.slotAt(p); if (slot != null) { this.tryPlace(this.pick, slot); this.pick = null; } }
      } else if (s.phase === "lamps") {
        this.lampSpots.forEach((q, i) => { if (!s.lamps[i] && Math.abs(p.x - q.x) < 60 && p.y > q.y - 140 && p.y < q.y + 30) this.acts.push(x => R.placeLamp(x, i)); });
      }
    }
    up(p) {
      const d = this.drag; this.drag = null; if (!d) return;
      const moved = Math.hypot(p.x - d.sx, p.y - d.sy) > 25;
      if (!moved) { this.pick = this.pick === d.num ? null : d.num; return; }     // a tap: pick this stone, then tap a slot
      const slot = this.slotAt(p);
      if (slot != null) this.tryPlace(d.num, slot);
    }
    tryPlace(num, slot) { this.idle = 0; this.acts.push(x => R.place(x, num, slot)); }
    update(_, dms) {
      const dt = Math.min(0.05, dms / 1000) * SPEED, s = this.s;
      if (this.ended) { this.tickToast(dt); return; }
      this.idle += dt;
      let inp = {};
      if (this.acts.length) inp = { act: this.acts.shift() };
      if (window.__bpBot) inp = R.bot(s, dt, this.mem);
      R.step(s, dt, inp); this.handle(s.events);
      this.draw(dt);
      this.tickToast(dt);
      if (s.done) this.finish();
    }
    handle(evs) {
      const s = this.s;
      for (const e of evs) {
        if (e.type === "placed") { S.dig(); this.puff(this.slots[e.slot].x, this.slots[e.slot].y, 8); if (e.key) this.toastNow("🔑 The keystone! The arch is complete.", true); }
        else if (e.type === "wrong") {
          S.oops();
          if (e.why === "number") this.toastNow("🙃 That's stone " + (e.num + 1) + ". It only fits in slot " + (e.num + 1) + "!");
          else if (e.slot === Math.round(R.mid(s.n))) this.toastNow("✋ The keystone goes in LAST, when both sides are up.");
          else this.toastNow("✋ Start lower! Stone " + (e.slot + 1) + " needs the stone below it first.");
          this.falls.push({ num: e.num, x: this.slots[e.slot].x, y: this.slots[e.slot].y, t: 0 });
        }
        else if (e.type === "arched") { S.ding(); this.frameBtn.setVisible(true); this.toastNow("🎉 All the stones are in! Now take the frame away.", true); }
        else if (e.type === "frameOut") { S.whoosh(); this.frameBtn.setVisible(false); this.toastNow(s.lamps.length ? "💡 It stands by itself! Now tap the glowing posts to put the lamps back." : "🚚 It stands by itself! Here comes a truck to test it...", true); }
        else if (e.type === "lamp") { S.sparkle(); this.lampImgs[e.i].setVisible(true).setScale(0.01); this.tweens.add({ targets: this.lampImgs[e.i], scale: 100 / Math.max(this.lampImgs[e.i].width, this.lampImgs[e.i].height), duration: 300, ease: "Back.out" });
          if (s.phase === "truck") this.toastNow(this.L.parade ? "🎉 Opening Day! Everyone, walk across!" : "🚚 Here comes a truck to test it...", true); }
      }
    }
    puff(x, y, n) { for (let i = 0; i < n; i++) this.dust.push({ x, y, vx: (rand() - 0.5) * 140, vy: -rand() * 80, a: 0.8, r: 4 + rand() * 6 }); }
    draw(dt) {
      const s = this.s, t = this.time.now / 1000, n = s.n, open = new Set(this.slots.filter(sl => R.canPlace(s, sl.i)).map(sl => sl.i));
      // the frame slides down and away once it's taken out
      const framed = s.phase === "stones" || s.phase === "frame";
      if (!framed) this.frameY = Math.min(400, this.frameY + dt * 500);
      const fg = this.frameG.clear(), fy = this.frameY;
      if (fy < 400) {
        const pts = []; for (let k = 0; k <= 24; k++) { const a = Math.PI * k / 24; pts.push({ x: ACX + this.r1 * Math.cos(a), y: ACY - this.r1 * Math.sin(a) + fy }); }
        fg.fillStyle(WOOD_L, 1).fillPoints(pts, true).lineStyle(8, WOOD, 1).strokePoints(pts, true);
        for (let k = 0; k < 7; k++) { const x = ACX - this.r1 + 24 + k * (2 * this.r1 - 48) / 6; fg.lineStyle(7, WOOD, 1).lineBetween(x, ACY + fy, x, ACY - Math.sqrt(Math.max(0, this.r1 * this.r1 - (x - ACX) ** 2)) + 8 + fy); }
      }
      // slots and stones
      const ag = this.archG.clear(), key = Math.round(R.mid(n));
      this.slots.forEach(sl => {
        const on = s.filled[sl.i];
        if (on) { ag.fillStyle(sl.i === key ? 0xe8c66a : STONE, 1).fillPoints(sl.pts, true).lineStyle(3, STONE_D, 1).strokePoints(sl.pts, true); }
        else {
          const glow = open.has(sl.i) && s.phase === "stones";
          ag.fillStyle(glow ? 0xfff3a8 : 0xffffff, glow ? 0.35 + 0.25 * Math.sin(t * 5) : 0.18).fillPoints(sl.pts, true);
          ag.lineStyle(3, glow ? 0xffd23d : 0xffffff, glow ? 1 : 0.6).strokePoints(sl.pts, true);
        }
        this.slotT[sl.i].setText(on ? (sl.i === key ? "🔑" : String(sl.i + 1)) : String(sl.i + 1)).setColor(on ? "#5b5650" : "#ffffff").setStroke(on ? "#ffffff" : "#1e2340", on ? 2 : 5).setAlpha(on ? 0.8 : 1);
      });
      // the deck and spandrel posts appear once the arch stands
      const dg = this.deckG.clear(), dy = this.deckY(), arched = s.phase !== "stones";
      if (arched) {
        dg.fillStyle(STONE, 1).fillRect(ACX - this.r2 - 60, dy, 2 * this.r2 + 120, 28).lineStyle(3, STONE_D, 1).strokeRect(ACX - this.r2 - 60, dy, 2 * this.r2 + 120, 28);
        for (let k = 1; k < 8; k++) { const x = ACX - this.r2 + k * this.r2 / 4; const top = ACY - Math.sqrt(Math.max(0, this.r2 * this.r2 - (x - ACX) ** 2)); if (top - dy > 12) dg.fillStyle(STONE_D, 1).fillRect(x - 7, dy + 28, 14, top - dy - 26); }
        dg.lineStyle(4, 0xb8b2a6, 1).lineBetween(ACX - this.r2 - 60, dy - 14, ACX + this.r2 + 60, dy - 14);
        for (let x = ACX - this.r2 - 50; x < ACX + this.r2 + 60; x += 22) dg.lineBetween(x, dy - 14, x, dy);
      }
      // lamp spots glow while you place the lamps
      const lh = this.lampHint.clear();
      if (s.phase === "lamps") this.lampSpots.forEach((q, i) => { if (!s.lamps[i]) lh.fillStyle(0xffe27a, 0.4 + 0.3 * Math.sin(t * 5)).fillCircle(q.x, q.y - 40, 30).lineStyle(4, 0xffd23d, 1).strokeCircle(q.x, q.y - 40, 30); });
      // the truck (and on Opening Day, Hao and A-ma) crossing
      if (s.phase === "truck") {
        const k = s.testT / R.TRUCK_T;
        this.truck.setPosition(-200 + k * (W + 400), dy + 4 + (k > 0.1 && k < 0.9 ? 0 : 0));
        this.walkers.forEach((w, i) => w.setPosition(-120 - i * 90 + Math.max(0, s.testT - 1) / R.TRUCK_T * (W + 300), dy + 4 + Math.abs(Math.sin(t * 8 + i)) * -6));
      }
      // the tray of stones
      const tg = this.trayG.clear();
      tg.fillStyle(0x6b5a45, 0.85).fillRoundedRect(110, TRAY_Y - 52, W - 220, 104, 26);
      this.trayT.forEach(o => o.destroy()); this.trayT = [];
      if (s.phase === "stones") s.tray.forEach((num, k) => {
        const q = this.trayPos(k, s.tray.length), dragging = this.drag && this.drag.num === num && Math.hypot(this.drag.x - this.drag.sx, this.drag.y - this.drag.sy) > 25;
        const x = dragging ? this.drag.x : q.x, y = dragging ? this.drag.y : q.y, sel = this.pick === num;
        tg.fillStyle(sel ? 0xfff3a8 : num === key ? 0xe8c66a : STONE, 1).fillRoundedRect(x - 36, y - 32, 72, 64, 12).lineStyle(sel ? 5 : 3, sel ? 0xffd23d : STONE_D, 1).strokeRoundedRect(x - 36, y - 32, 72, 64, 12);
        this.trayT.push(txt(this, x, y + 1, num === key ? "🔑" + (num + 1) : String(num + 1), 30, "#1e2340", { stroke: "#ffffff", strokeThickness: 4 }).setDepth(21));
      });
      else if (s.phase === "lamps") this.trayT.push(txt(this, W / 2, TRAY_Y, "💡 Tap the glowing posts: " + s.lamps.filter(Boolean).length + " / " + s.lamps.length + " lamps", 30, "#ffffff").setDepth(21));
      else this.trayT.push(txt(this, W / 2, TRAY_Y, this.L.parade ? "🎉 Opening Day!" : "🚚 Testing the bridge...", 30, "#ffffff").setDepth(21));
      // wrong stones slide back to the tray
      const xg = this.fxG.clear();
      this.falls = this.falls.filter(f => { f.t += dt * 2.2; const k = Math.min(1, f.t), q = this.trayPos(Math.max(0, s.tray.indexOf(f.num)), s.tray.length);
        const x = f.x + (q.x - f.x) * k, y = f.y + (q.y - f.y) * k - Math.sin(k * Math.PI) * 60;
        xg.fillStyle(0xff8a8a, 1 - k * 0.5).fillRoundedRect(x - 30, y - 26, 60, 52, 10); return f.t < 1; });
      this.dust = this.dust.filter(d => (d.x += d.vx * dt, d.y += d.vy * dt, d.vy += 300 * dt, d.a -= 0.9 * dt) > 0);
      for (const d of this.dust) xg.fillStyle(0xd8d0c4, d.a).fillCircle(d.x, d.y, d.r);
      // a gentle hint after a while: the next good slot pulses brighter (handled by the glow), and a reminder
      if (this.idle > 9 && s.phase === "stones") { this.idle = 0; const nx = [...open][0]; if (nx != null) this.toast("💡 Stone " + (nx + 1) + " can go in now. Find it in the tray!"); }
      this.infoT.setText(s.phase === "stones" ? "🧱 " + s.filled.filter(Boolean).length + " / " + n + " stones" + (s.wrong ? "   🙃 " + s.wrong : "") : s.phase === "frame" ? "👷 Now take the frame away" : s.phase === "lamps" ? "💡 Lamps: " + s.lamps.filter(Boolean).length + " / " + s.lamps.length : "🚚 Testing the bridge");
    }
    finish() {
      if (this.ended) return; this.ended = true;
      const r = this.s.result, sv = save.get(), L = this.L;
      if (L.free) { if (!sv.best || r.time < sv.best) sv.best = r.time; }
      else sv.stars[L.k] = Math.max(sv.stars[L.k] || 0, r.stars);
      save.set(sv);
      S.yay(); if (window.Book && Book.confetti) Book.confetti(L.parade ? 120 : 50);
      this.time.delayedCall(L.parade ? 1500 : 800, () => this.scene.start("result", { level: this.li, r, kind: "arch" }));
    }
  }

  /* ============================================================ FIND */
  const POOL = { x: 120, y: 160, w: 1040, h: 470 };
  class Find extends Phaser.Scene {
    constructor() { super("find"); }
    init(d) { this.li = d.level; }
    create() {
      const L = LEVELS[this.li];
      Object.assign(this, { L, s: R.create(L), mem: {}, ended: false, idle: 0, flying: [], acts: [] });
      this.add.rectangle(W / 2, H / 2, W, H, 0x9cc97f);
      const g = this.add.graphics();
      // the empty pool: blue tiles, cracks and weeds
      g.fillStyle(0xd9d3c4, 1).fillRoundedRect(POOL.x - 24, POOL.y - 24, POOL.w + 48, POOL.h + 48, 18);
      g.fillStyle(0x8fc3dd, 1).fillRect(POOL.x, POOL.y, POOL.w, POOL.h);
      g.lineStyle(2, 0x6fa7c4, 0.7);
      for (let x = POOL.x; x <= POOL.x + POOL.w; x += 40) g.lineBetween(x, POOL.y, x, POOL.y + POOL.h);
      for (let y = POOL.y; y <= POOL.y + POOL.h; y += 40) g.lineBetween(POOL.x, y, POOL.x + POOL.w, y);
      g.lineStyle(3, 0x4f7f98, 0.8);
      for (let i = 0; i < 6; i++) { let x = POOL.x + rand() * POOL.w, y = POOL.y + rand() * POOL.h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rand() - 0.5) * 80; y += (rand() - 0.5) * 80; g.lineTo(x, y); } g.strokePath(); }
      for (let i = 0; i < 26; i++) { const x = POOL.x + rand() * POOL.w, y = POOL.y + rand() * POOL.h; g.fillStyle(0x5f9e4a, 0.9).fillTriangle(x - 8, y, x, y - 18, x + 8, y).fillTriangle(x - 2, y, x + 8, y - 14, x + 12, y); }
      this.pieceG = this.add.graphics().setDepth(3);
      this.pieceT = this.s.pieces.map(p => txt(this, 0, 0, String(p.num), 34, "#1e2340", { stroke: "#ffffff", strokeThickness: 6 }).setDepth(4));
      this.truck = fit(this.add.image(W - 120, 670, "truck"), 200).setDepth(6);
      this.loadT = txt(this, W - 120, 612, "", 26, "#ffffff").setDepth(7);
      fit(this.add.image(70, 640, "ama"), 150).setDepth(6);
      this.craneG = this.add.graphics().setDepth(8);
      hud(this, L.name);
      this.nextT = txt(this, W / 2, 70, "", 44, "#ffe27a").setDepth(31);
      toaster(this, 150);
      this.input.on("pointerdown", p => {
        if (this.ended) return;
        const i = this.pieceAt(p); if (i >= 0) { this.idle = 0; this.acts.push(x => R.tapPiece(x, i)); }
      });
      this.toast("👆 Find piece number 1!", true);
      window.__bp = this; window.__bpGame = this.game;
    }
    pos(p) { return { x: POOL.x + p.x * POOL.w, y: POOL.y + p.y * POOL.h }; }
    pieceAt(pt) {
      let best = -1, bd = 1e9;
      this.s.pieces.forEach((p, i) => { if (p.got) return; const q = this.pos(p); if (Math.abs(pt.x - q.x) < 66 && Math.abs(pt.y - q.y) < 50) { const d = Math.hypot(pt.x - q.x, pt.y - q.y); if (d < bd) { bd = d; best = i; } } });
      return best;
    }
    update(_, dms) {
      const dt = Math.min(0.05, dms / 1000) * SPEED, s = this.s;
      if (this.ended) { this.tickToast(dt); this.drawCrane(dt); return; }
      this.idle += dt;
      let inp = {};
      if (this.acts.length) inp = { act: this.acts.shift() };
      if (window.__bpBot) inp = R.bot(s, dt, this.mem);
      R.step(s, dt, inp); this.handle(s.events);
      this.draw(dt);
      this.tickToast(dt);
      if (s.done) this.finish();
    }
    handle(evs) {
      for (const e of evs) {
        if (e.type === "tarp") { S.whoosh(); }
        else if (e.type === "got") { S.ding(); const q = this.pos(this.s.pieces[e.i]); this.flying.push({ x: q.x, y: q.y, num: e.num, t: 0 }); if (this.s.next <= this.L.n) this.toastNow("👍 Number " + e.num + "! Now find " + this.s.next + "."); }
        else if (e.type === "wrong") { S.oops(); this.wiggle = { i: e.i, t: 0.5 }; this.toastNow("🙃 That's " + e.num + ". Find number " + e.want + "!"); }
      }
    }
    drawCrane(dt) {
      const cg = this.craneG.clear();
      this.flying = this.flying.filter(f => { f.t += dt * 1.3; const k = Math.min(1, f.t), x = f.x + (W - 110 - f.x) * k, y = f.y + (650 - f.y) * k - Math.sin(k * Math.PI) * 160;
        cg.lineStyle(3, 0x444444, 1).lineBetween(x, y - 60, x, 0).fillStyle(STONE, 1).fillRoundedRect(x - 40, y - 28, 80, 56, 10).lineStyle(3, STONE_D, 1).strokeRoundedRect(x - 40, y - 28, 80, 56, 10);
        return f.t < 1; });
    }
    draw(dt) {
      const s = this.s, t = this.time.now / 1000, pg = this.pieceG.clear();
      if (this.wiggle) this.wiggle.t -= dt;
      s.pieces.forEach((p, i) => {
        const q = this.pos(p), T = this.pieceT[i];
        if (p.got) { T.setVisible(false); return; }
        const wx = this.wiggle && this.wiggle.i === i && this.wiggle.t > 0 ? Math.sin(t * 40) * 6 : 0, x = q.x + wx, y = q.y;
        pg.fillStyle(0x000000, 0.18).fillRoundedRect(x - 52, y - 30, 108, 72, 12);
        if (p.tarp) {
          pg.fillStyle(0x3b6fb5, 1).fillRoundedRect(x - 60, y - 40, 120, 80, 14).lineStyle(3, 0x274d82, 1).strokeRoundedRect(x - 60, y - 40, 120, 80, 14);
          pg.lineStyle(2, 0x274d82, 0.8).lineBetween(x - 40, y - 40, x - 20, y + 40).lineBetween(x + 10, y - 40, x + 30, y + 40);
          T.setVisible(true).setPosition(x, y).setText("?").setColor("#ffffff").setStroke("#1e2340", 6);
        } else {
          pg.fillStyle(STONE, 1).fillRoundedRect(x - 54, y - 36, 108, 72, 12).lineStyle(3, STONE_D, 1).strokeRoundedRect(x - 54, y - 36, 108, 72, 12);
          pg.fillStyle([0xe8662e, 0x4f86c6, 0x3f9e5a, 0x9b6cf2][p.num % 4], 1).fillCircle(x + 38, y - 20, 7);
          T.setVisible(true).setPosition(x, y + 2).setText(String(p.num)).setColor("#1e2340").setStroke("#ffffff", 6);
        }
      });
      // after a long wait, the next piece (if you can see it) gives a little hop
      if (this.idle > 8) { const i = s.pieces.findIndex(p => !p.got && !p.tarp && p.num === s.next); if (i >= 0) { this.wiggle = { i, t: 0.6 }; } else this.toast("💡 Maybe it's under a tarp? Tap one to look."); this.idle = 0; }
      this.drawCrane(dt);
      this.nextT.setText(s.next <= this.L.n ? "Find: " + s.next : "All found!");
      this.loadT.setText((s.next - 1) + " / " + this.L.n);
      this.infoT.setText("🧩 " + (s.next - 1) + " / " + this.L.n + " pieces" + (s.wrong ? "   🙃 " + s.wrong : ""));
    }
    finish() {
      if (this.ended) return; this.ended = true;
      const r = this.s.result, sv = save.get(); sv.stars[this.L.k] = Math.max(sv.stars[this.L.k] || 0, r.stars); save.set(sv);
      S.yay(); this.toast("🎉 All " + this.L.n + " pieces are on the truck!", true);
      this.time.delayedCall(1400, () => this.scene.start("result", { level: this.li, r, kind: "find" }));
    }
  }

  /* ============================================================ FLOOD */
  const X0 = 300, X1 = 980, YM = m => 600 - m * 26, BED = -2;
  class Flood extends Phaser.Scene {
    constructor() { super("flood"); }
    init(d) { this.li = d.level; }
    create() {
      const L = LEVELS[this.li];
      Object.assign(this, { L, s: R.create(L), mem: {}, ended: false, splash: [], q: [] });
      this.add.image(W / 2, H / 2, "bg_valley").setDisplaySize(W, H);
      const g = this.add.graphics().setDepth(1), bank = YM(RV.bank);
      g.fillStyle(0x8cc276, 1).fillPoints([{ x: 0, y: bank }, { x: X0, y: bank }, { x: X0, y: YM(BED) }, { x: X1, y: YM(BED) }, { x: X1, y: bank }, { x: W, y: bank }, { x: W, y: H }, { x: 0, y: H }], true);
      g.lineStyle(4, 0x5f8f4a, 1).strokePoints([{ x: 0, y: bank }, { x: X0, y: bank }, { x: X0, y: YM(BED) }, { x: X1, y: YM(BED) }, { x: X1, y: bank }, { x: W, y: bank }], false);
      this.waterG = this.add.graphics().setDepth(2);
      // the biggest flood so far: a dashed line on the bank
      const mg = this.add.graphics().setDepth(3), fy = YM(L.flood);
      for (let x = X0 - 60; x < X1 + 60; x += 26) mg.fillStyle(0xe8662e, 1).fillRect(x, fy - 2, 14, 4);
      txt(this, X0 + 14, fy - 16, "biggest flood so far", 20, "#ffffff").setOrigin(0, 0.5).setDepth(6);
      this.bridgeG = this.add.graphics().setDepth(4);
      this.boat = fit(this.add.image(-200, YM(0), "boat"), 150).setOrigin(0.5, 0.8).setDepth(5).setVisible(!!L.boat);
      this.mast = this.add.graphics().setDepth(5);
      this.truck = fit(this.add.image(-200, bank, "truck"), 140).setOrigin(0.5, 1).setDepth(6);
      fit(this.add.image(70, bank, "engineer"), 150).setOrigin(0.5, 1).setDepth(6);
      hud(this, L.name);
      toaster(this, 150);
      // controls on the right
      const pg = this.add.graphics().setDepth(30);
      pg.fillStyle(0xffffff, 0.92).fillRoundedRect(W - 280, 130, 262, L.fixedPiers ? 300 : 420, 24);
      txt(this, W - 149, 160, "Bridge height", 24, "#1e2340", { strokeThickness: 0 }).setDepth(31);
      this.hT = txt(this, W - 149, 205, "", 36, "#2b7a42", { strokeThickness: 0 }).setDepth(31);
      button(this, W - 210, 265, 110, 70, "⬆", 0x4f86c6, () => this.q.push(x => R.nudge(x, RV.stepH, 0)), 40).setDepth(32);
      button(this, W - 88, 265, 110, 70, "⬇", 0x4f86c6, () => this.q.push(x => R.nudge(x, -RV.stepH, 0)), 40).setDepth(32);
      this.slopeT = txt(this, W - 149, 330, "", 22, "#1e2340", { strokeThickness: 0 }).setDepth(31);
      if (!L.fixedPiers) {
        txt(this, W - 149, 380, "Piers in the river", 22, "#1e2340", { strokeThickness: 0 }).setDepth(31);
        button(this, W - 210, 430, 110, 66, "－", 0x9b6cf2, () => this.q.push(x => R.nudge(x, 0, -1)), 40).setDepth(32);
        button(this, W - 88, 430, 110, 66, "＋", 0x9b6cf2, () => this.q.push(x => R.nudge(x, 0, 1)), 40).setDepth(32);
        this.spanT = txt(this, W - 149, 490, "", 22, "#1e2340", { strokeThickness: 0 }).setDepth(31);
      }
      this.testBtn = button(this, W - 149, L.fixedPiers ? 395 : 600, 230, 78, "🌊 TEST", 0xe8662e, () => this.q.push(R.test), 34).setDepth(32);
      this.toast(L.mark ? "📏 The orange line shows the biggest flood. Make the bridge high enough, then press TEST!" : "🌊 Pick a height and the number of piers, then press TEST!", true);
      window.__bp = this; window.__bpGame = this.game;
    }
    update(_, dms) {
      const dt = Math.min(0.05, dms / 1000) * SPEED, s = this.s;
      if (this.ended) { this.tickToast(dt); this.draw(dt); return; }
      let inp = {};
      if (this.q.length) { const a = this.q.shift(); inp = { act: a }; }
      if (window.__bpBot) inp = R.bot(s, dt, this.mem);
      R.step(s, dt, inp); this.handle(s.events);
      this.draw(dt);
      this.tickToast(dt);
      if (s.done) this.finish();
    }
    handle(evs) {
      for (const e of evs) {
        if (e.type === "test") { S.wind(); this.toastNow("🌊 Here comes the flood..."); }
        else if (e.type === "retry") {
          // say what went wrong (at most two things at once, so it stays short)
          S.oops(); const P = e.r.problems, MSG = {
            low: "💦 Too low! The flood hit the bridge. Make it higher.",
            span: "🌉 The arches would be too long! Add a pier.",
            narrow: "⛵ The boat can't fit between the piers. Use fewer piers.",
            boatLow: "⛵ The boat's mast hits the bridge. Make it higher.",
            steep: "🚚 The ramps are too steep for the truck. Make it a bit lower." };
          const said = ["low", "span", "narrow", "steep", "boatLow"].filter(k => P.includes(k) && !(k === "boatLow" && P.includes("low"))).slice(0, 2).map(k => MSG[k]);
          this.toastNow(said.join(" ") || "Try again!", true);
        }
      }
    }
    draw(dt) {
      const s = this.s, L = this.L, t = this.time.now / 1000;
      const h = s.h, piers = s.piers, deckY = YM(h), roadY = YM(h + RV.deck), bank = YM(RV.bank), rampW = 150, span = (X1 - X0) / (piers + 1);
      const r = s.last, testing = s.phase === "testing" || (this.ended && r), k = testing ? Math.min(1, s.testT / R.TEST_T) : 0;
      // water: normal, or rising during a test (it stops at the bridge if the bridge is too low)
      const fl = r ? r.flood : L.flood, top = r && r.problems.includes("low") ? Math.min(fl + 0.6, h + 0.4) : fl;
      const lvl = testing ? Math.min(top, k * 2.2 * top) : 0;
      const wg = this.waterG.clear();
      wg.fillStyle(WATER, 0.85).fillRect(X0, YM(lvl), X1 - X0, YM(BED) - YM(lvl));
      for (let x = X0; x < X1; x += 40) wg.lineStyle(3, 0xffffff, 0.35).lineBetween(x + ((t * 60) % 40), YM(lvl) + 6, x + 16 + ((t * 60) % 40), YM(lvl) + 6);
      if (testing && r && r.problems.includes("low") && k > 0.45) { if (rand() < 0.6) this.splash.push({ x: X0 + rand() * (X1 - X0), y: deckY + 10, vx: (rand() - 0.5) * 100, vy: -120 - rand() * 120, a: 1 }); }
      this.splash = this.splash.filter(p => (p.x += p.vx * dt, p.y += p.vy * dt, p.vy += 500 * dt, p.a -= 1.2 * dt) > 0);
      for (const p of this.splash) wg.fillStyle(0xdff0ff, p.a).fillCircle(p.x, p.y, 6);
      // the bridge: ramps, deck, piers and arches (red if they'd be too long)
      const bg = this.bridgeG.clear(), tooLong = (RV.width / (piers + 1)) > RV.maxSpan;
      bg.lineStyle(12, r && r.problems.includes("steep") && testing ? 0xe8662e : 0x6b6b74, 1).beginPath().moveTo(X0 - rampW - 40, bank).lineTo(X0 - 20, roadY).lineTo(X1 + 20, roadY).lineTo(X1 + rampW + 40, bank).strokePath();
      bg.fillStyle(STONE, 1).fillRect(X0 - 20, roadY, X1 - X0 + 40, deckY - roadY).lineStyle(3, STONE_D, 1).strokeRect(X0 - 20, roadY, X1 - X0 + 40, deckY - roadY);
      for (let p = 1; p <= piers; p++) bg.fillStyle(STONE_D, 1).fillRect(X0 + p * span - 13, deckY, 26, YM(BED) - deckY);
      const lowY = Math.min(YM(BED), deckY + 90);
      for (let p = 0; p <= piers; p++) {
        const a = X0 + p * span + (p ? 13 : 0), b = X0 + (p + 1) * span - (p < piers ? 13 : 0), pts = [];
        for (let q = 0; q <= 16; q++) { const u = q / 16; pts.push({ x: a + (b - a) * u, y: lowY - (lowY - deckY) * Math.sin(Math.PI * u) }); }
        bg.lineStyle(7, tooLong ? 0xe8662e : STONE_D, 1).strokePoints(pts, false);
      }
      // labels
      this.hT.setText(h.toFixed(1) + " m");
      const slope = Math.round((h + RV.deck - RV.bank) / RV.ramp * 100);
      this.slopeT.setText(slope <= 0 ? "🚚 ramp: flat" : "🚚 ramp: " + slope + "% " + (slope / 100 > RV.maxSlope ? "😮 steep!" : "👍")).setColor(slope / 100 > RV.maxSlope ? "#c92a2a" : "#1e2340");
      if (this.spanT) this.spanT.setText(piers + " piers · arches " + Math.round(RV.width / (piers + 1)) + " m" + (tooLong ? " 😮" : "")).setColor(tooLong ? "#c92a2a" : "#1e2340");
      this.testBtn.setAlpha(s.phase === "design" ? 1 : 0.5);
      // during a test: the truck tries the ramp, and the boat tries to pass
      if (testing && r) {
        const steep = r.problems.includes("steep"), tk = Math.min(1, s.testT / R.TEST_T);
        let tx = -200 + tk * (W + 400), ty = bank;
        if (steep && tx > X0 - rampW - 40) { const back = Math.max(0, tk - 0.35) * 600; tx = Math.max(X0 - rampW - 80, X0 - rampW - 10 - back); }
        else if (tx > X0 - rampW - 40 && tx < X1 + rampW + 40) { ty = tx < X0 - 20 ? bank + (roadY - bank) * (tx - (X0 - rampW - 40)) / (rampW + 20) : tx > X1 + 20 ? roadY + (bank - roadY) * (tx - (X1 + 20)) / (rampW + 20) : roadY; }
        this.truck.setPosition(tx, ty);
        if (L.boat) {
          const blocked = r.problems.includes("narrow") || r.problems.includes("boatLow");
          let bx = X0 + 70 + tk * (X1 - X0 - 140); if (blocked) bx = Math.min(bx, X0 + span - 80);   // a blocked boat waits before the first pier
          this.boat.setPosition(bx, YM(lvl) + 6);
        }
      } else { this.truck.setPosition(-200, bank); if (L.boat) this.boat.setPosition(X0 + 70, YM(0) + 6); }
      const mg = this.mast.clear();
      if (L.boat) { mg.lineStyle(5, 0x6b4a2a, 1).lineBetween(this.boat.x, this.boat.y - 20, this.boat.x, this.boat.y - 20 - 5 * 26 + 30); mg.fillStyle(0xffffff, 1).fillTriangle(this.boat.x + 3, this.boat.y - 25, this.boat.x + 3, this.boat.y - 100, this.boat.x + 50, this.boat.y - 30); }
      this.infoT.setText("🌊 Tests: " + s.tests);
    }
    finish() {
      if (this.ended) return; this.ended = true;
      const r = this.s.result, sv = save.get(); sv.stars[this.L.k] = Math.max(sv.stars[this.L.k] || 0, r.stars); save.set(sv);
      S.yay(); if (window.Book && Book.confetti) Book.confetti(60);
      this.toast("🎉 The flood flows under, the truck drives over" + (this.L.boat ? ", and the boat sails through!" : "!"), true);
      this.time.delayedCall(1600, () => this.scene.start("result", { level: this.li, r, kind: "flood" }));
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
      const title = L.free ? "Free Build" : r.stars >= 3 ? "Amazing! 🎉" : r.stars === 2 ? "Great job! 👏" : "You did it! 👍";
      txt(this, W / 2, 130, title, 52, "#1e2340", { strokeThickness: 0 });
      if (!L.free) txt(this, W / 2, 210, "★".repeat(r.stars) + "☆".repeat(3 - r.stars), 72, "#ffc41f", { stroke: "#8a6a10", strokeThickness: 5 });
      else txt(this, W / 2, 210, "⏱ " + r.time + " s   (best: " + save.get().best + " s)", 44, "#ffc41f", { stroke: "#8a6a10", strokeThickness: 5 });
      let lines;
      if (kind === "arch") lines = ["🌉 " + r.stones + " stones, and the arch stands by itself!", r.wrong ? "🙃 Stones that slid back: " + r.wrong : "🎯 Every stone in the right place!", r.wrong ? "Tip: match the numbers, and build up from both sides." : ""];
      else if (kind === "find") lines = ["🧩 Found all " + r.pieces + " pieces in order!", r.wrong ? "🙃 Wrong taps: " + r.wrong : "🎯 No wrong taps!"];
      else lines = ["🌊 The flood passed under the bridge!", "📏 Height " + r.h + " m · " + r.piers + " piers · ramps " + r.slope + "%", r.tests > 1 ? "🔁 Tests: " + r.tests + " (testing is how engineers learn!)" : "🎯 Right the first time!"];
      txt(this, W / 2, 335, lines.filter(Boolean).join("\n"), 27, "#1e2340", { strokeThickness: 0, lineSpacing: 10 });
      txt(this, W / 2, 470, "💡 " + FACTS[L.k], 22, K.css, { strokeThickness: 0, wordWrap: { width: 780 } });
      const next = level >= 0 && level < LEVELS.length - 1 && r.stars > 0 ? level + 1 : null;
      button(this, 330, 590, 240, 72, "☰ Menu", 0x6b7a90, () => this.scene.start("menu"), 26);
      button(this, 620, 590, 260, 72, "🔁 Again", 0x4f86c6, () => this.scene.start(L.kind, { level }), 26);
      if (next != null) button(this, 920, 590, 280, 72, "Next ▶", 0xe2a12b, () => this.scene.start("brief", { level: next }), 28);
      if (r.stars >= 2 || L.free) { S.yay(); if (window.Book && Book.confetti) Book.confetti(90); }
      window.__bpResult = r;
    }
  }

  window.BridgePuzzle = {
    start() {
      const timer = /[?&]timer=1/.test(location.search);
      return new Phaser.Game({
        type: Phaser.AUTO, parent: "game", width: W, height: H, backgroundColor: "#2a2232",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        fps: timer ? { forceSetTimeOut: true, target: 30 } : undefined,
        scene: [Boot, Menu, Brief, Arch, Find, Flood, Result],
      });
    },
  };
})();
