/* Ride the Current! — Mo the baby sea turtle swims around Taiwan on the ocean currents (Phaser 3).
   The sea is a flow field: glowing currents push Mo along, eddies spin, everything that floats drifts.
   Living things are friends (say hi!); only trash can be scooped up, and it has no faces. */
(function () {
  "use strict";
  const W = 720, H = 1280;
  const FONT = '"Baloo 2", "Trebuchet MS", sans-serif';
  const S = (window.Book && Book.sfx) || new Proxy({}, { get: () => () => {} });
  const G = window.TaiwanGeo;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const SPEED = parseFloat((location.search.match(/[?&]speed=([\d.]+)/) || [])[1]) || 1;   // test runs only

  /* ------------------------------------------------------------ data */
  // things in the water. drift = how much the current moves it. tap = taps to scoop (0 = can't).
  const THING = {
    bag:    { tex: "bag", size: 74, drift: 0.95, tap: 1, shells: 2, hurt: true },
    bottle: { tex: "bottle", size: 62, drift: 0.9, tap: 1, shells: 2, bonk: true },
    log:    { tex: "log", size: 130, drift: 1, tap: 0, bonk: true },
    net:    { tex: "net", size: 120, drift: 0.55, tap: 3, shells: 5, hurt: true, tangle: true },
    grass:  { tex: "seagrass", size: 58, drift: 0.4, food: true },
    raft:   { tex: "sargassum", size: 120, drift: 1, rest: true },
  };
  // lanes: pts = [[progress, x], ...]; v = speed along the trip (+ helps, - pushes back)
  const K = (pts, w, v, o) => Object.assign({ pts, w, v, amp: 26, per: 1700, ph: Math.random() * 6 }, o || {});
  const LEVELS = [
    { name: "Hello, Kuroshio!", from: "Orchid Island", to: "Green Island", season: "🌸 Spring", dir: -1, len: 13000, coast: 0,
      start: "is_lanyu", goal: "is_green", route: [[121.58, 22.12], [121.52, 22.6]],
      lanes: [K([[0, 360], [0.35, 430], [0.7, 320], [1, 380]], 170, 240)],
      rates: { bag: 0.1, bottle: 0.08, grass: 0.22, raft: 0.03 }, friends: ["flyfish", 13],
      tip: "Hold your finger where you want Mo to swim. Find the glowing Kuroshio and ride it north!",
      fact: "Green Island sits right in the warm Kuroshio. Its clear water is home to colorful coral reefs." },
    { name: "Flying Fish Highway", from: "Green Island", to: "Hualien", season: "🌸 Spring", dir: -1, len: 17000, coast: -1,
      start: "is_green", goal: "is_harbor", route: [[121.52, 22.72], [121.56, 23.2], [121.62, 23.6], [121.68, 23.95]],
      lanes: [K([[0, 440], [0.25, 540], [0.5, 400], [0.75, 540], [1, 450]], 160, 250), K([[0, 230], [1, 240]], 62, -90)],
      rates: { bag: 0.2, bottle: 0.14, log: 0.05, grass: 0.22, raft: 0.03 }, friends: ["flyfish", 10],
      tip: "Spring is flying fish season! Swim over to say hi to the flying fish.",
      fact: "Near Hualien, the Kuroshio flows close to the shore. People take boats out to watch dolphins and whales!" },
    { name: "Dolphin Coast", from: "Hualien", to: "Turtle Island", season: "🌸 Spring", dir: -1, len: 19000, coast: -1,
      start: "is_harbor", goal: "is_turtle", route: [[121.68, 24.0], [121.82, 24.4], [121.94, 24.78]],
      lanes: [K([[0, 420], [0.2, 560], [0.45, 330], [0.7, 560], [1, 430]], 160, 255, { amp: 40 })],
      rates: { bag: 0.22, bottle: 0.12, net: 0.04, log: 0.05, grass: 0.2, raft: 0.03 }, boats: 15, friends: ["dolphin", 13],
      tip: "Watch for the red ⚠ warning: a boat is coming! Boats can't always see turtles, so swim out of the way.",
      fact: "Turtle Island, near Yilan, really looks like a giant turtle swimming in the sea. Can you see its head?" },
    { name: "Swirly Northeast", from: "Turtle Island", to: "Keelung", season: "🌸 Spring", dir: -1, len: 19000, coast: -1,
      start: "is_turtle", goal: "is_harbor", route: [[121.95, 24.9], [122.0, 25.08], [121.8, 25.18]],
      lanes: [K([[0, 430], [0.4, 540], [0.8, 600], [1, 560]], 150, 250)],
      eddies: [[0.16, 330, 1], [0.3, 560, -1], [0.44, 300, 1], [0.58, 420, -1], [0.7, 600, 1]],
      rates: { bag: 0.22, bottle: 0.12, net: 0.06, grass: 0.22, raft: 0.02 }, rescue: [0.8, 5], friends: ["dolphin", 16],
      tip: "Swirls ahead! These spinning water whirls are called eddies. Ride around the edge, or swim across fast.",
      fact: "Northeast of Taiwan, the Kuroshio stirs up cold water from deep down. It brings food for lots of fish!" },
    { name: "Winter Cold Current", from: "Matsu", to: "Penghu", season: "❄️ Winter", dir: 1, len: 19000, coast: -1,
      start: "is_harbor", goal: "is_penghu", route: [[119.95, 26.1], [119.78, 25.4], [119.62, 24.6], [119.6, 23.72]],
      lanes: [K([[0, 330], [0.5, 290], [1, 340]], 150, 235, { cold: true }), K([[0, 590], [0.5, 560], [1, 600]], 105, -150)],
      rates: { bag: 0.2, bottle: 0.12, log: 0.08, grass: 0.2 }, boats: 16, friends: ["mullet", 9],
      tip: "It's winter! Cold water flows SOUTH along the coast of China. Ride the blue current. The warm water on the right goes the other way!",
      fact: "Penghu has about 90 islands! Green sea turtles lay their eggs on its sandy beaches in summer." },
    { name: "Mullet Run", from: "Penghu", to: "Kaohsiung", season: "❄️ Winter", dir: 1, len: 20000, coast: 1,
      start: "is_penghu", goal: "is_harbor", route: [[119.66, 23.45], [119.95, 23.0], [120.22, 22.7]],
      lanes: [K([[0, 250], [0.4, 330], [0.75, 420], [1, 360]], 150, 245, { cold: true }), K([[0, 500], [0.5, 470], [1, 500]], 85, -170)],
      eddies: [[0.5, 210, -1], [0.82, 470, 1]],
      rates: { bag: 0.24, bottle: 0.14, net: 0.07, log: 0.05, grass: 0.2 }, boats: 17, friends: ["mullet", 8],
      tip: "Swim with the gray mullet! They ride the cool water south to southwestern Taiwan.",
      fact: "In winter, gray mullet come to the waters off southwestern Taiwan to lay their eggs. Fishermen call them \"black gold\"!" },
    { name: "Summer Switch!", from: "Kaohsiung", to: "Taichung", season: "☀️ Summer", dir: -1, len: 22000, coast: 1,
      start: "is_harbor", goal: "is_harbor", route: [[120.2, 22.7], [120.04, 23.2], [120.14, 23.8], [120.42, 24.22]],
      lanes: [K([[0, 330], [0.3, 250], [0.6, 390], [1, 300]], 165, 250)],
      eddies: [[0.35, 470, 1], [0.62, 200, -1], [0.85, 450, 1]],
      rates: { bag: 0.26, bottle: 0.18, net: 0.06, log: 0.07, grass: 0.2, raft: 0.02 }, boats: 12, friends: ["pinkdolphin", 14],
      tip: "It's summer now! The wind turned around, so this same sea flows NORTH. Ride the warm current!",
      fact: "Pink dolphins! Taiwanese humpback dolphins live in the shallow water along Taiwan's west coast. Very few are left, so they need our help." },
    { name: "Kuroshio to Japan", from: "Turtle Island", to: "Yonaguni", season: "☀️ Summer", dir: -1, len: 28000, coast: 0,
      start: "is_turtle", goal: "is_palm", route: [[121.96, 24.9], [122.3, 24.76], [122.7, 24.6], [122.94, 24.5]],
      lanes: [K([[0, 360], [0.2, 520], [0.4, 250], [0.6, 480], [0.8, 300], [1, 380]], 165, 280, { amp: 40 })],
      eddies: [[0.14, 580, -1], [0.33, 560, 1], [0.52, 180, -1], [0.7, 560, 1]],
      rates: { bag: 0.3, bottle: 0.18, net: 0.09, log: 0.08, grass: 0.22, raft: 0.03 }, boats: 11, rescue: [0.86, 8], friends: ["flyfish", 12, "dolphin", 15],
      tip: "The big trip! Ride the Kuroshio all the way toward Japan. You can do it!",
      fact: "On a very clear day, people on Yonaguni, a Japanese island, can see the mountains of Taiwan!" },
  ];
  const ENDLESS = { name: "Endless Kuroshio", endless: true, season: "🌊 Forever", dir: -1, len: 600000, coast: 0, start: "is_lanyu",
    route: G.CURRENTS.kuroshio.pts.slice(3), friends: ["flyfish", 14, "dolphin", 18],
    rates: { bag: 0.18, bottle: 0.12, net: 0.04, log: 0.05, grass: 0.22, raft: 0.02 }, boats: 14,
    tip: "Endless Kuroshio! How far can Mo swim? The sea gets busier the farther you go." };
  const TIPS = [
    "Real fact: the Kuroshio flows about as fast as you walk, and it never stops.",
    "Real fact: baby sea turtles are busy swimmers. They swim AND ride the currents.",
    "Real fact: a floating plastic bag can look like a jellyfish to a sea turtle.",
    "Real fact: old fishing nets that float away are called ghost nets. Divers work hard to pull them out of the sea.",
    "Real fact: in winter the cold current flows south, and in summer warm water flows north through the Taiwan Strait.",
    "Real fact: an eddy is a spinning whirl of water. Some are bigger than a whole city!",
  ];
  const GROW = [
    { k: "fins", name: "Strong Flippers", desc: "Mo swims faster", costs: [40, 100, 180], icon: "mo_top" },
    { k: "shell", name: "Tough Shell", desc: "+1 heart", costs: [70, 180], icon: "mo" },
    { k: "turbo", name: "Big Breath", desc: "⚡ Turbo lasts longer and starts half full", costs: [50, 130], icon: "seagrass" },
    { k: "finder", name: "Shell Finder", desc: "Grab shells from farther away", costs: [40, 110], icon: "shell" },
  ];

  /* ------------------------------------------------------------ save */
  const BLANK = () => ({ stars: {}, shells: 0, up: {}, friends: 0, best: 0, scooped: 0 });
  const save = {
    get() { try { return Object.assign(BLANK(), JSON.parse(localStorage.getItem("rc-save")) || {}); } catch (e) { return BLANK(); } },
    set(v) { try { localStorage.setItem("rc-save", JSON.stringify(v)); } catch (e) {} },
  };

  /* ------------------------------------------------------------ helpers */
  function txt(sc, x, y, s, size, color, opts) {
    return sc.add.text(x, y, s, Object.assign({ fontFamily: FONT, fontSize: size + "px", fontStyle: "800", color: color || "#fff",
      stroke: "#123a5a", strokeThickness: Math.max(3, size / 6), align: "center" }, opts || {})).setOrigin(0.5);
  }
  function button(sc, x, y, w, h, label, fill, onClick, size) {
    const c = sc.add.container(x, y), g = sc.add.graphics();
    const draw = d => { g.clear(); g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, h / 2);
      g.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2 + (d ? 5 : 0), w, h, h / 2);
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(-w / 2 + 10, -h / 2 + 6 + (d ? 5 : 0), w - 20, h * 0.3, h * 0.15); };
    draw(false);
    const t = txt(sc, 0, -2, label, size || 32);
    c.add([g, t]); c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on("pointerdown", (p, a, b, ev) => { draw(true); t.y = 3; c.pressed = true; ev && ev.stopPropagation(); });
    c.on("pointerup", (p, a, b, ev) => { draw(false); t.y = -2; ev && ev.stopPropagation(); if (c.pressed) { c.pressed = false; S.tap(); onClick(); } });
    c.on("pointerout", () => { draw(false); t.y = -2; c.pressed = false; });
    c.label = t; return c;
  }
  function fit(img, size) { img.setScale(size / Math.max(img.width, img.height)); return img; }
  function panel(sc, x, y, w, h, color) {
    const g = sc.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x - w / 2, y - h / 2 + 10, w, h, 36);
    g.fillStyle(0xfff8ec, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    g.lineStyle(6, color || 0x2fb6c9, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    return g;
  }
  /** little map of Taiwan's seas with a route; returns { set(t) } to move the dot */
  function miniMap(sc, x, y, w, route, opts) {
    const P = G.projector(w, 6), c = sc.add.container(x, y);
    const g = sc.add.graphics();
    g.fillStyle(0x123a5a, 0.55).fillRoundedRect(-6, -6, w + 12, P.h + 12, 18);
    g.fillStyle(0x8fd0f0, 1).fillRoundedRect(0, 0, w, P.h, 14);
    for (const k in G.LAND) {
      const pts = G.smooth(G.LAND[k], true, 3).map(P).map(([a, b]) => ({ x: clamp(a, 0, w), y: clamp(b, 0, P.h) }));
      g.fillStyle(k === "taiwan" ? 0xb9e08a : 0xe6dcb8, 1).fillPoints(pts, true);
    }
    if (opts && opts.currents) for (const k in G.CURRENTS) {
      const C = G.CURRENTS[k];
      if (!C.seasons.includes(opts.currents)) continue;
      g.lineStyle(3, C.warm ? 0xff7f50 : 0x3f8fd8, 0.8).strokePoints(G.smooth(C.pts, false, 4).map(P).map(([a, b]) => ({ x: a, y: b })));
    }
    const rp = route.map(P);
    g.lineStyle(4, 0xffffff, 1).strokePoints(rp.map(([a, b]) => ({ x: a, y: b })));
    const end = rp[rp.length - 1];
    g.fillStyle(0xffd166, 1).fillCircle(end[0], end[1], 6);
    const dot = sc.add.circle(rp[0][0], rp[0][1], 7, 0xff5a7a).setStrokeStyle(3, 0xffffff);
    c.add([g, dot]);
    return { c, h: P.h, set(t) { const a = G.along(rp, t); dot.setPosition(a.x, a.y); } };
  }

  /* ============================================================ BOOT */
  class Boot extends Phaser.Scene {
    constructor() { super("boot"); }
    preload() {
      txt(this, W / 2, H / 2 - 60, "Filling up the sea...", 40);
      const bar = this.add.graphics();
      this.load.on("progress", v => bar.clear().fillStyle(0xffffff, .3).fillRoundedRect(160, H / 2, 400, 28, 14).fillStyle(0xffd166, 1).fillRoundedRect(160, H / 2, 400 * v, 28, 14));
      ["mo_top", "mo", "kai", "pal", "dolphin", "flyfish", "mullet", "seagrass", "shell", "bag", "bottle", "net",
       "boat", "bignet", "log", "sargassum", "is_lanyu", "is_green", "is_turtle", "is_penghu", "is_harbor", "is_palm",
       "bg_sea", "bg_coast"].forEach(k => this.load.image(k, "img/" + k + ".webp"));
    }
    create() {
      const g = this.make.graphics({ add: false });
      for (let r = 16; r > 0; r--) { g.fillStyle(0xffffff, (1 - r / 16) * 0.35 + 0.05); g.fillCircle(16, 16, r); }
      g.fillStyle(0xffffff, 1).fillCircle(16, 16, 6); g.generateTexture("dot", 32, 32); g.clear();
      // flow chevron (points up)
      g.lineStyle(6, 0xffffff, 1).beginPath().moveTo(4, 24).lineTo(18, 8).lineTo(32, 24).strokePath();
      g.generateTexture("chev", 36, 30); g.clear();
      // bubble
      g.lineStyle(3, 0xffffff, 0.9).strokeCircle(12, 12, 9); g.fillStyle(0xffffff, 0.9).fillCircle(8, 8, 3);
      g.generateTexture("bubble", 24, 24); g.clear();
      // knot to cut
      g.fillStyle(0xffd166, 0.35).fillCircle(30, 30, 29); g.fillStyle(0xffd166, 1).fillCircle(30, 30, 15);
      g.lineStyle(5, 0xc0661f, 1).beginPath().moveTo(20, 20).lineTo(40, 40).moveTo(40, 20).lineTo(20, 40).strokePath();
      g.generateTexture("knot", 60, 60); g.clear();
      // finish-line buoy
      g.fillStyle(0xff7f50, 1).fillCircle(16, 16, 15); g.fillStyle(0xffffff, 1).fillRect(1, 12, 30, 8);
      g.generateTexture("buoy", 32, 32); g.destroy();
      // seamless backdrops: each painted sea stacked on its own mirror image
      const stack = (src, key, cropX) => {
        const img = this.textures.get(src).getSourceImage(), sx = cropX || 0, w = img.width - sx;
        const c = this.textures.createCanvas(key, w, img.height * 2), ctx = c.getContext();
        ctx.drawImage(img, sx, 0, w, img.height, 0, 0, w, img.height);
        ctx.save(); ctx.translate(0, img.height * 2); ctx.scale(1, -1); ctx.drawImage(img, sx, 0, w, img.height, 0, 0, w, img.height); ctx.restore();
        c.refresh();
      };
      stack("bg_sea", "tile_sea");
      stack("bg_coast", "tile_coast", 190);   // trim the land so the beach is a narrow strip
      this.scene.start("title");
    }
  }

  /* ============================================================ TITLE */
  class Title extends Phaser.Scene {
    constructor() { super("title"); }
    create() {
      const ts = W / this.textures.get("tile_sea").getSourceImage().width;
      this.bg = this.add.tileSprite(W / 2, H / 2, W, H, "tile_sea").setTileScale(ts, ts);
      this.ts = ts;
      this.chevs = [];
      for (let i = 0; i < 26; i++) this.chevs.push(this.add.image(rnd(250, 470), rnd(0, H), "chev").setTint(0xffc69a).setAlpha(0.5).setScale(0.8));
      const sv = save.get(), all = /[?&]unlock=1/.test(location.search);
      const logo = txt(this, W / 2, 104, "Ride the Current!", 74, "#ffffff", { strokeThickness: 12 });
      this.tweens.add({ targets: logo, y: 112, yoyo: true, repeat: -1, duration: 1300, ease: "Sine.inOut" });
      txt(this, W / 2, 176, "Swim around Taiwan with Mo the sea turtle", 27, "#fff1b8");
      const mo = fit(this.add.image(W / 2, 290, "mo_top"), 120 + 4 * Object.values(sv.up).reduce((a, b) => a + b, 0));
      this.tweens.add({ targets: mo, y: 276, angle: { from: -6, to: 6 }, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" });
      txt(this, W - 110, 250, "🐚 " + sv.shells, 32, "#fff1b8");
      txt(this, 110, 250, "🐟 " + sv.friends, 32, "#c9f7ff");
      const iconOf = L => L.goal;
      LEVELS.forEach((L, i) => {
        const col = i % 2, row = Math.floor(i / 2), x = 190 + col * 340, y = 440 + row * 148;
        const open = all || i === 0 || (sv.stars[i] || 0) > 0, st = sv.stars[i + 1] || 0;
        const c = this.add.container(x, y), g = this.add.graphics();
        g.fillStyle(0x000000, 0.3).fillRoundedRect(-155, -58 + 8, 310, 118, 30);
        g.fillStyle(open ? (L.season.includes("Winter") ? 0x3f8fd8 : L.season.includes("Summer") ? 0xff9a5c : 0x2fb6c9) : 0x5d6f80, 1).fillRoundedRect(-155, -58, 310, 118, 30);
        c.add(g);
        const ic = fit(this.add.image(-102, 2, iconOf(L)), 92); if (!open) ic.setAlpha(0.35); c.add(ic);
        c.add(txt(this, 42, -30, open ? (i + 1) + ". " + L.name : "🔒 Trip " + (i + 1), 23));
        c.add(txt(this, 42, 2, open ? L.season + "  ➜ " + L.to : "", 18, "#ffffff", { strokeThickness: 4 }));
        c.add(txt(this, 42, 34, open ? "★".repeat(st) + "☆".repeat(3 - st) : "", 28, st ? "#ffd93a" : "#ffffff"));
        if (open) {
          c.setSize(310, 118).setInteractive({ useHandCursor: true });
          c.on("pointerup", () => { S.splash(); this.scene.start("play", { level: i }); });
          c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.05, duration: 100 }));
          c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 100 }));
        }
      });
      const endlessOpen = all || (sv.stars[1] || 0) > 0;
      button(this, W / 2, 1050, 520, 84, endlessOpen ? "∞ Endless Kuroshio" + (sv.best ? "  (best " + sv.best + " km)" : "") : "🔒 Endless: finish trip 1",
        endlessOpen ? 0x6c5ce7 : 0x8a95a5, () => { if (endlessOpen) this.scene.start("play", { level: -1 }); else S.oops(); }, 28);
      button(this, W / 2, 1160, 420, 84, "🐢 Help Mo Grow", 0x5ccf6a, () => this.scene.start("grow"), 32);
    }
    update(t, d) {
      const dt = d / 1000;
      this.bg.tilePositionY -= 50 * dt / this.ts;
      this.chevs.forEach(c => { c.y -= 260 * dt; if (c.y < -20) { c.y = H + 20; c.x = rnd(250, 470); } });
    }
  }

  /* ============================================================ GROW (upgrades) */
  class Grow extends Phaser.Scene {
    constructor() { super("grow"); }
    create() {
      const ts = W / this.textures.get("tile_sea").getSourceImage().width;
      this.add.tileSprite(W / 2, H / 2, W, H, "tile_sea").setTileScale(ts, ts);
      this.draw();
    }
    draw() {
      if (this.box) this.box.destroy();
      const sv = save.get(), c = this.box = this.add.container(0, 0);
      c.add(panel(this, W / 2, 640, 640, 1080, 0x5ccf6a));
      c.add(txt(this, W / 2, 160, "🐢 Help Mo Grow", 50, "#123a5a", { strokeThickness: 0 }));
      c.add(txt(this, W / 2, 214, "Trade shells for training that lasts forever!", 24, "#4b6478", { strokeThickness: 0 }));
      c.add(txt(this, W / 2, 262, "🐚 " + sv.shells + " shells", 36, "#e0662f", { strokeThickness: 0 }));
      GROW.forEach((u, i) => {
        const y = 380 + i * 170, lvl = sv.up[u.k] || 0, max = lvl >= u.costs.length, cost = u.costs[lvl];
        const g = this.add.graphics(); g.fillStyle(0xffffff, 1).fillRoundedRect(60, y - 68, 600, 136, 26).lineStyle(3, 0xd2e4ea, 1).strokeRoundedRect(60, y - 68, 600, 136, 26);
        c.add(g);
        c.add(fit(this.add.image(125, y, u.icon), 84));
        c.add(txt(this, 310, y - 30, u.name + "  " + "●".repeat(lvl) + "○".repeat(u.costs.length - lvl), 27, "#123a5a", { strokeThickness: 0 }));
        c.add(txt(this, 310, y + 14, u.desc, 19, "#4b6478", { strokeThickness: 0, wordWrap: { width: 300 } }));
        c.add(button(this, 565, y, 150, 68, max ? "MAX" : "🐚" + cost, max ? 0xa8b3b8 : (sv.shells >= cost ? 0xff7f50 : 0xa8b3b8), () => {
          if (max) return;
          const s2 = save.get(); if (s2.shells < cost) { S.oops(); return; }
          s2.shells -= cost; s2.up[u.k] = lvl + 1; save.set(s2); S.yay(); this.draw();
        }, 26));
      });
      c.add(txt(this, W / 2, 1060, "Real baby turtles grow stronger by swimming every day!", 21, "#4b6478", { strokeThickness: 0 }));
      c.add(button(this, W / 2, 1130, 320, 80, "◀ Back", 0x2fb6c9, () => this.scene.start("title"), 32));
    }
  }

  /* ============================================================ PLAY */
  class Play extends Phaser.Scene {
    constructor() { super("play"); }
    init(data) {
      this.li = data.level;
      const L = this.L = data.level < 0 ? this.makeEndless() : LEVELS[data.level];
      const sv = this.sv = save.get(), up = sv.up;
      this.s = L.dir;                                       // -1 = swimming north (up the screen), +1 = south
      this.y0 = L.dir < 0 ? L.len - 420 : 420;              // start
      this.y1 = L.dir < 0 ? 420 : L.len - 420;              // finish line
      this.maxHearts = 5 + (up.shell || 0); this.hearts = this.maxHearts;
      this.swim = 175 * (1 + 0.16 * (up.fins || 0));
      this.turbo = up.turbo ? 50 : 0; this.turboLen = 1.6 + 0.6 * (up.turbo || 0); this.turboT = 0;
      this.finder = 70 + 45 * (up.finder || 0);
      this.shells = 0; this.hits = 0; this.friends = 0; this.scooped = 0;
      this.t = 0; this.state = "swim"; this.paused = false; this.inv = 0; this.tangle = 0; this.popT = 0;
      this.things = []; this.pals = []; this.boats = []; this.shellArr = [];
      this.spawnT = {}; this.boatT = 9; this.friendT = {};
      this.eddies = (L.eddies || []).map(([p, x, spin]) => ({ y: this.y0 + p * (this.y1 - this.y0), x, r: 190, spin }));
      this.rescueAt = L.rescue ? L.rescue[0] : 2; this.rescue = null; this.rescued = false;
      this.firsts = {}; this.hurtLog = []; this.boatWarn = null;
      this.calm = 1;
    }
    makeEndless() {
      const L = Object.assign({}, ENDLESS), n = 160, pts = [], lanes = [], eddies = [];
      for (let i = 0; i <= n; i++) pts.push([i / n, i < 2 ? 360 : rnd(200, 520)]);
      lanes.push(K(pts, 165, 260, { amp: 36 }));
      for (let i = 4; i < n; i += 3) if (Math.random() < 0.5) {     // little side currents, some pushing back
        const x = rnd(140, 580), back = Math.random() < 0.5;
        lanes.push(K([[i / n, x], [(i + 1.5) / n, x + rnd(-80, 80)]], rnd(70, 110), back ? -150 : 160, { p: [i / n, (i + 1.5) / n], cold: !back && Math.random() < 0.4 }));
      }
      for (let i = 5; i < n; i += 2) if (Math.random() < 0.6) eddies.push([(i + Math.random()) / n, rnd(170, 550), Math.random() < 0.5 ? 1 : -1]);
      L.lanes = lanes; L.eddies = eddies;
      return L;
    }

    /* ---------- the flow field */
    prog(y) { return (y - this.y0) / (this.y1 - this.y0); }
    laneX(L, p, y) {
      const P = L.pts; let x = P[P.length - 1][1];
      if (p <= P[0][0]) x = P[0][1];
      else for (let i = 0; i < P.length - 1; i++) if (p <= P[i + 1][0]) {
        let t = (p - P[i][0]) / (P[i + 1][0] - P[i][0]); t = (1 - Math.cos(t * Math.PI)) / 2;
        x = P[i][1] + (P[i + 1][1] - P[i][1]) * t; break;
      }
      return x + L.amp * Math.sin(y / L.per * Math.PI * 2 + L.ph);
    }
    field(x, y) {
      let vx = 0, vy = 0, warm = 0, cold = 0;
      const p = this.prog(y);
      for (const L of this.L.lanes) {
        let fade = 1;
        if (L.p) { const e = Math.min(p - L.p[0], L.p[1] - p); if (e <= 0) continue; fade = clamp(e / 0.004, 0, 1); }
        const cx = this.laneX(L, p, y), d = Math.abs(x - cx) / L.w;
        if (d >= 1) continue;
        const f = Math.pow(Math.cos(d * Math.PI / 2), 2) * fade;
        const ahead = y + 40 * this.s, slope = (this.laneX(L, this.prog(ahead), ahead) - cx) / 40;
        vy += L.v * this.s * f; vx += slope * L.v * f;
        if (L.v > 0 || L.cold) { if (L.cold) cold += f; else warm += f; } else warm += f * 0.6;
      }
      for (const E of this.eddies) {
        const dx = x - E.x, dy = y - E.y, d = Math.hypot(dx, dy);
        if (d >= E.r || d < 1) continue;
        const q = d / E.r, sp = E.spin * 250 * 4 * q * (1 - q);
        vx += -dy / d * sp; vy += dx / d * sp;
      }
      return { vx: vx * this.calm, vy: vy * this.calm, warm, cold };
    }

    create() {
      const L = this.L, cam = this.cameras.main;
      // backdrop (fixed to the camera, scrolled by hand)
      const key = L.coast ? "tile_coast" : "tile_sea", src = this.textures.get(key).getSourceImage();
      this.ts = W / src.width;
      this.bg = this.add.tileSprite(W / 2, H / 2, W, H, key).setTileScale(this.ts, this.ts).setScrollFactor(0).setDepth(-10);
      if (L.coast > 0) this.bg.setFlipX(true);
      this.xMin = L.coast < 0 ? 196 : 46; this.xMax = L.coast > 0 ? W - 196 : W - 46;
      this.light = !!L.coast;     // coastal water is pale, so currents get deeper colors there
      this.lanesG = this.add.graphics().setDepth(-5);
      if (!this.light) this.lanesG.setBlendMode(Phaser.BlendModes.ADD);
      this.eddyG = this.add.graphics().setDepth(-4);
      // flow chevrons
      this.chevs = [];
      for (let i = 0; i < 70; i++) this.chevs.push({ spr: this.add.image(0, 0, "chev").setDepth(-3).setVisible(false), life: 0 });
      // start + goal islands, finish line
      const midX = (this.xMin + this.xMax) / 2;
      fit(this.add.image(L.coast ? midX : W / 2, this.y0 - this.s * 330, L.start), 380).setDepth(-2).setAlpha(0.95);
      if (!L.endless) {
        fit(this.add.image(L.coast ? midX : W / 2, this.y1 + this.s * 330, L.goal), 420).setDepth(-2);
        const n = Math.round((this.xMax - this.xMin) / 70);
        for (let i = 0; i <= n; i++) this.add.image(this.xMin + i * (this.xMax - this.xMin) / n, this.y1, "buoy").setDepth(-1);
        this.goalLine = this.add.graphics().setDepth(-1).lineStyle(6, 0xffffff, 0.6).lineBetween(this.xMin, this.y1, this.xMax, this.y1);
      }
      // shells along the currents: ride the current to collect them
      this.placeShells();
      // Mo
      const size = 92 + 4 * Object.values(this.sv.up).reduce((a, b) => a + b, 0);
      this.mo = fit(this.add.image(L.coast < 0 ? midX : W / 2, this.y0, "mo_top"), size).setDepth(10);
      this.moR = size * 0.36; this.moBase = this.mo.scale;
      this.vel = { x: 0, y: 0 }; this.heading = this.s < 0 ? 0 : Math.PI;
      if (this.s > 0) this.mo.setRotation(Math.PI);
      cam.scrollY = this.camTarget();
      this.fx = this.add.particles(0, 0, "dot", { speed: { min: 60, max: 240 }, scale: { start: 0.7, end: 0 }, lifespan: 600, tint: [0xfff1a8, 0xffffff, 0x9fe8ff, 0xffc0e0], emitting: false, blendMode: "ADD" }).setDepth(30);
      this.trail = this.add.particles(0, 0, "bubble", { speed: { min: 10, max: 40 }, scale: { start: 0.7, end: 0.2 }, alpha: { start: 0.8, end: 0 }, lifespan: 700, frequency: 90, emitting: false }).setDepth(9);
      this.trail.startFollow(this.mo);
      // input
      this.input.on("pointerdown", p => {
        if (this.paused || this.state === "done") return;
        const wp = cam.getWorldPoint(p.x, p.y);
        if (this.tapAt(wp.x, wp.y)) { this.steer = null; return; }
        this.steer = p;
      });
      this.input.on("pointerup", () => { this.steer = null; });
      this.keys = this.input.keyboard.addKeys("LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE");
      this.time.timeScale = SPEED; this.tweens.timeScale = SPEED;
      this.makeHUD();
      this.toast(L.tip, 5200);
      if (this.li === 0) this.time.delayedCall(5600, () => this.state === "swim" && this.toast("👆 Hold your finger in front of Mo to swim. The glowing stripes are the current!", 4200));
    }
    camTarget() { return clamp(this.mo.y - (this.s < 0 ? H * 0.66 : H * 0.34), -200, this.L.len - H + 200); }
    placeShells() {
      const L = this.L, step = 115, n = Math.floor(Math.abs(this.y1 - this.y0) / step);
      if (L.endless) return;
      for (let i = 6; i < n - 2; i++) {
        if (i % 14 > 7) continue;                                  // little rows with gaps
        const y = this.y0 + (this.y1 - this.y0) * i / n;
        const lane = L.lanes.filter(l => l.v > 0)[0];
        if (!lane) continue;
        const x = clamp(this.laneX(lane, this.prog(y), y), this.xMin + 20, this.xMax - 20);
        this.shellArr.push(fit(this.add.image(x, y, "shell"), 40).setDepth(1));
      }
    }

    /* ---------- HUD */
    makeHUD() {
      const fix = o => o.setScrollFactor(0);
      const g = fix(this.add.graphics().setDepth(50));
      g.fillStyle(0x123a5a, 0.72).fillRoundedRect(10, 10, 500, 100, 28);
      this.hHearts = fix(txt(this, 30, 40, "", 30, "#ff6b8b").setDepth(51).setOrigin(0, 0.5));
      this.hShell = fix(txt(this, 30, 80, "", 26, "#fff1b8").setDepth(51).setOrigin(0, 0.5));
      this.hInfo = fix(txt(this, 494, 80, "", 22, "#c9f7ff").setDepth(51).setOrigin(1, 0.5));
      this.hTrip = fix(txt(this, 494, 40, "", 22, "#ffffff", { strokeThickness: 4 }).setDepth(51).setOrigin(1, 0.5));
      this.mini = miniMap(this, 540, 14, 166, this.L.route);
      this.mini.c.setScrollFactor(0).setDepth(51);
      this.badge = fix(txt(this, W / 2 - 60, 150, "", 28, "#ffffff").setDepth(52));
      this.pauseBtn = fix(button(this, 60, 166, 76, 60, "II", 0xff7f50, () => this.togglePause(), 28).setDepth(52));
      // turbo button
      this.tBtn = fix(this.add.container(W - 84, H - 96).setDepth(52));
      this.tG = this.add.graphics(); this.tTxt = txt(this, 0, 0, "⚡", 48);
      this.tBtn.add([this.tG, this.tTxt]).setSize(130, 130).setInteractive({ useHandCursor: true });
      this.tBtn.on("pointerdown", (p, a, b, ev) => { ev.stopPropagation(); this.goTurbo(); });
      this.updateHUD();
    }
    updateHUD() {
      this.hHearts.setText("❤".repeat(Math.max(0, this.hearts)) + "♡".repeat(Math.max(0, this.maxHearts - this.hearts)));
      this.hShell.setText("🐚 " + this.shells);
      const p = clamp(this.prog(this.mo.y), 0, 1);
      if (this.L.endless) { this.hTrip.setText("📏 " + this.km() + " km"); this.hInfo.setText("best " + this.sv.best + " km"); }
      else { this.hTrip.setText("➜ " + this.L.to + "  " + Math.floor(p * 100) + "%"); this.hInfo.setText("⏱ " + Math.floor(this.t) + "s"); }
      this.mini.set(this.L.endless ? (this.km() / 3) % 1 : p);
      const full = this.turbo >= 100;
      this.tG.clear().fillStyle(0x000000, 0.3).fillCircle(0, 6, 58).fillStyle(full ? 0xffb000 : 0x2c4a63, 1).fillCircle(0, 0, 58);
      this.tG.lineStyle(9, 0x9ff28f, 1).beginPath().arc(0, 0, 51, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.turbo / 100)).strokePath();
      this.tTxt.setAlpha(full ? 1 : 0.45);
    }
    km() { return Math.max(0, Math.round((this.y0 - this.mo.y) / 8000 * 10) / 10); }
    toast(s, ms, y) {
      const c = this.add.container(W / 2, y || 260).setDepth(60).setScrollFactor(0);
      const t = txt(this, 0, 0, s, 26, "#123a5a", { strokeThickness: 0, wordWrap: { width: 580 } });
      const g = this.add.graphics().fillStyle(0xfff8ec, 0.97).fillRoundedRect(-t.width / 2 - 22, -t.height / 2 - 12, t.width + 44, t.height + 24, 22)
        .lineStyle(4, 0x2fb6c9, 1).strokeRoundedRect(-t.width / 2 - 22, -t.height / 2 - 12, t.width + 44, t.height + 24, 22);
      c.add([g, t]); c.setAlpha(0).setScale(0.7);
      this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 250, ease: "Back.out" });
      this.time.delayedCall(ms || 2500, () => this.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => c.destroy() }));
    }
    first(key, s, ms) { if (this.firsts[key]) return; this.firsts[key] = true; this.toast(s, ms || 3800, 330); }
    float(x, y, s, color, size) {
      const t = txt(this, x, y, s, size || 26, color || "#fff").setDepth(40);
      this.tweens.add({ targets: t, y: y - 70, alpha: { from: 1, to: 0 }, duration: 1000, onComplete: () => t.destroy() });
    }
    togglePause() {
      if (this.state === "done" || this.state === "arrive") return;
      this.paused = !this.paused; this.pauseBtn.label.setText(this.paused ? "▶" : "II");
      this.paused ? this.tweens.pauseAll() : this.tweens.resumeAll();
      if (this.paused) {
        const b = this.pauseBox = this.add.container(0, 0).setDepth(70).setScrollFactor(0);
        b.add(this.add.rectangle(W / 2, H / 2, W, H, 0x0b2236, 0.6).setInteractive());
        b.add(txt(this, W / 2, 480, "Paused", 80));
        b.add(button(this, W / 2, 640, 340, 84, "▶ Keep swimming", 0x5ccf6a, () => this.togglePause(), 30));
        b.add(button(this, W / 2, 760, 340, 84, "⌂ Trips", 0x2fb6c9, () => this.scene.start("title"), 30));
        b.iterate(o => o.setScrollFactor && o.setScrollFactor(0));
      } else if (this.pauseBox) { this.pauseBox.destroy(); this.pauseBox = null; }
    }

    /* ---------- spawning */
    aheadY() { const cy = this.cameras.main.scrollY; return this.s < 0 ? cy - 90 : cy + H + 90; }
    spawn(k, x, y) {
      const T = THING[k];
      x = x == null ? rnd(this.xMin + 30, this.xMax - 30) : x;
      y = y == null ? this.aheadY() : y;
      const spr = fit(this.add.image(x, y, T.tex), T.size).setDepth(T.rest ? 0 : 5).setRotation(rnd(-0.6, 0.6));
      const o = { k, T, spr, taps: T.tap, spin: rnd(-0.6, 0.6), wob: rnd(0, 6) };
      this.things.push(o); return o;
    }
    spawnFriends(kind) {
      const fromLeft = Math.random() < 0.5, y = this.aheadY() + this.s * rnd(0, 200);
      const group = [];
      if (kind === "flyfish") {
        // a school crosses the screen, leaping
        for (let i = 0; i < 5; i++) group.push({ spr: fit(this.add.image(fromLeft ? -60 - i * 70 : W + 60 + i * 70, y + rnd(-60, 60), "flyfish"), 70).setDepth(12).setRotation(fromLeft ? Math.PI / 2 : -Math.PI / 2), vx: (fromLeft ? 1 : -1) * 260, vy: 0, hop: rnd(0, 6) });
      } else if (kind === "mullet") {
        const cx = rnd(this.xMin + 80, this.xMax - 80);
        for (let i = 0; i < 9; i++) group.push({ spr: fit(this.add.image(cx + rnd(-70, 70), y + rnd(-90, 90) - this.s * 60, "mullet"), 56).setDepth(4).setRotation(this.s > 0 ? Math.PI : 0), ride: 0.9, vx: 0, vy: 0, hop: rnd(0, 6) });
      } else {
        const pink = kind === "pinkdolphin";
        const cx = rnd(this.xMin + 80, this.xMax - 80);
        for (let i = 0; i < 3; i++) {
          const spr = fit(this.add.image(cx + (i - 1) * 90, y + this.s * i * 80, "dolphin"), 120).setDepth(4).setRotation(this.s > 0 ? Math.PI : 0);
          if (pink) spr.setTint(0xffc4d6);
          group.push({ spr, vx: 0, vy: this.s * 110, hop: i, weave: true });   // dolphins cruise ahead; catch up to say hi
        }
      }
      this.pals.push({ kind, group, met: false });
      this.first("friend-" + kind, { flyfish: "🐟 Flying fish! Swim over and say hi.", mullet: "🐟 A school of gray mullet! Swim with them and say hi.",
        dolphin: "🐬 Dolphins! Swim close to say hi.", pinkdolphin: "🐬 Pink dolphins! Swim close to say hi." }[kind]);
    }
    spawnBoat() {
      // a boat heads straight at you down a lane: the red stripe shows where, so swim sideways out of it
      const x = Math.random() < 0.5 ? clamp(this.mo.x + rnd(-70, 70), this.xMin + 60, this.xMax - 60) : rnd(this.xMin + 60, this.xMax - 60);
      const warn = this.add.rectangle(x, H / 2, 150, H, 0xff4d6d, 0.2).setDepth(3).setScrollFactor(0);
      const sign = txt(this, x, this.s < 0 ? 250 : H - 250, "⚠🚤", 54).setDepth(41).setScrollFactor(0);
      this.tweens.add({ targets: [warn, sign], alpha: { from: 0.2, to: 1 }, yoyo: true, repeat: 3, duration: 230 });
      S.whoosh(); this.boatWarn = x;
      this.first("boat", "⚠ A boat is coming! Boats can't always see sea turtles, so swim out of the red stripe.");
      this.time.delayedCall(1900, () => {
        warn.destroy(); sign.destroy();
        if (this.state !== "swim") { this.boatWarn = null; return; }
        const b = fit(this.add.image(x, this.aheadY() + this.s * 120, "boat"), 230).setDepth(13).setRotation(this.s < 0 ? Math.PI : 0);
        this.boats.push({ spr: b, vy: -this.s * 650 });
        this.cameras.main.shake(200, 0.003); S.jet();
      });
    }
    startRescue() {
      this.state = "rescue";
      const n = this.L.rescue[1], y = this.mo.y + this.s * 470, x = (this.xMin + this.xMax) / 2;
      const net = fit(this.add.image(x, y, "bignet"), 460).setDepth(7).setAlpha(0.82);
      const pal = fit(this.add.image(x, y, "pal"), 130).setDepth(6).setRotation(this.s > 0 ? Math.PI : 0);
      const knots = [];
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, r = 120 + (i % 2) * 50;
        const k = this.add.image(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 0.55, "knot").setDepth(8);
        this.tweens.add({ targets: k, scale: 1.18, yoyo: true, repeat: -1, duration: 420 + i * 30 });
        knots.push(k);
      }
      this.rescue = { net, pal, knots, x, y, t: 0 };
      this.calm = 0.15;
      S.oops();
      this.toast("⚠ A sea turtle is stuck in an old fishing net! Tap the glowing knots to cut it free.", 4500, 330);
    }
    cutKnot(k) {
      const R = this.rescue; R.knots = R.knots.filter(o => o !== k);
      this.fx.explode(18, k.x, k.y); S.pop(); k.destroy();
      this.tweens.add({ targets: R.net, angle: rnd(-6, 6), duration: 120, yoyo: true });
      if (!R.knots.length) {
        this.rescued = true; S.yay(); S.sparkle();
        this.tweens.add({ targets: R.net, alpha: 0, scale: R.net.scale * 1.3, duration: 700, onComplete: () => R.net.destroy() });
        this.float(R.pal.x, R.pal.y - 90, "Free! Thank you! 💚 +30 🐚", "#ffffff", 32);
        this.shells += 30; this.friends++;
        for (let i = 0; i < 6; i++) this.time.delayedCall(i * 120, () => this.fx.explode(20, R.pal.x + rnd(-80, 80), R.pal.y + rnd(-60, 60)));
        this.tweens.add({ targets: R.pal, x: R.pal.x + 160, y: R.pal.y + this.s * 700, duration: 2600, ease: "Sine.in", onComplete: () => R.pal.destroy() });
        this.calm = 1; this.state = "swim"; this.rescue = null;
        this.updateHUD();
      }
    }

    /* ---------- taps and touches */
    tapAt(x, y) {
      if (this.rescue) for (const k of this.rescue.knots) if (Math.hypot(k.x - x, k.y - y) < 60) { this.cutKnot(k); return true; }
      let best = null, bd = 1e9;
      for (const o of this.things) {
        if (o.dead || !o.T.tap) continue;
        const d = Math.hypot(o.spr.x - x, o.spr.y - y);
        if (d < o.T.size * 0.6 + 26 && d < bd) { best = o; bd = d; }
      }
      if (!best) return false;
      best.taps--;
      if (best.taps > 0) { S.dig(); this.float(best.spr.x, best.spr.y - 50, "Pull! " + best.taps + " more", "#fff1b8", 24); this.tweens.add({ targets: best.spr, scale: best.spr.scale * 0.9, yoyo: true, duration: 90 }); return true; }
      this.scoop(best);
      return true;
    }
    scoop(o) {
      o.dead = true; this.scooped++; this.shells += o.T.shells || 0;
      if (this.popT <= 0) { S.splash(); this.popT = 0.2; }
      this.fx.explode(14, o.spr.x, o.spr.y);
      this.float(o.spr.x, o.spr.y - 40, "Scooped! +" + o.T.shells + " 🐚", "#fff1b8", 24);
      this.tweens.add({ targets: o.spr, y: o.spr.y - 60, scale: 0, alpha: 0, duration: 260, onComplete: () => o.spr.destroy() });
      if (o.k === "bag") this.first("bag", "🛍️ Great scoop! A plastic bag can look like a jellyfish to a sea turtle, so it's best out of the sea.");
      if (o.k === "net") this.first("net", "🕸️ You pulled out an old \"ghost net\". Lost nets can trap sea animals!");
      this.updateHUD();
    }
    hurt(why) {
      if (this.inv > 0 || this.turboT > 0 || this.state === "done" || this.state === "arrive") return false;
      this.hearts--; this.hits++; this.inv = 1.8; S.oops(); (this.hurtLog = this.hurtLog || []).push(why);
      this.cameras.main.shake(220, 0.008);
      if (why) this.float(this.mo.x, this.mo.y - 80, why, "#ffd0d8", 26);
      this.updateHUD();
      if (this.hearts <= 0) this.finish(false);
      return true;
    }
    goTurbo() {
      if (this.paused || this.state === "done" || this.state === "arrive") return;
      if (this.turbo < 100) { this.float(W - 84, this.cameras.main.scrollY + H - 190, "Eat 🌿 to charge!", "#c8ffb0", 22); return; }
      this.turbo = 0; this.turboT = this.turboLen; S.whoosh(); S.sparkle();
      this.cameras.main.flash(250, 220, 255, 240);
      this.updateHUD();
    }

    /* ---------- loop */
    update(time, delta) {
      if (this.paused) return;
      const dt = Math.min(0.05, delta / 1000) * SPEED, cam = this.cameras.main, mo = this.mo, L = this.L;
      this.popT -= dt;
      if (this.state === "done") return;
      if (this.state !== "arrive") this.t += dt;
      this.inv = Math.max(0, this.inv - dt); this.tangle = Math.max(0, this.tangle - dt);
      if (this.turboT > 0) { this.turboT -= dt; if (Math.random() < 0.6) this.fx.explode(1, mo.x + rnd(-20, 20), mo.y - this.s * -40); }

      // steering: swim toward your finger (or arrow keys)
      let sx = 0, sy = 0;
      if (this.state !== "arrive") {
        if (this.steer && this.steer.isDown) {
          const wp = cam.getWorldPoint(this.steer.x, this.steer.y), dx = wp.x - mo.x, dy = wp.y - mo.y, d = Math.hypot(dx, dy);
          if (d > 8) { const k = Math.min(1, d / 90); sx = dx / d * k; sy = dy / d * k; }
        }
        const k = this.keys;
        if (k.LEFT.isDown || k.A.isDown) sx = -1; if (k.RIGHT.isDown || k.D.isDown) sx = 1;
        if (k.UP.isDown || k.W.isDown) sy = -1; if (k.DOWN.isDown || k.S.isDown) sy = 1;
        const m = Math.hypot(sx, sy); if (m > 1) { sx /= m; sy /= m; }
        if (Phaser.Input.Keyboard.JustDown(k.SPACE)) this.goTurbo();
      } else { sx = 0; sy = this.s * 0.6; }
      if (this.autopilot) { const a = this.autopilot(this); sx = a.x; sy = a.y; }
      let sp = this.swim * (this.tangle > 0 ? 0.35 : 1);
      if (this.turboT > 0) { sp += 300; if (!sx && !sy) sy = this.s; }
      const f = this.field(mo.x, mo.y);
      const tx = sx * sp + f.vx, ty = sy * sp + f.vy, ease = 1 - Math.pow(0.02, dt);
      this.vel.x += (tx - this.vel.x) * ease; this.vel.y += (ty - this.vel.y) * ease;
      mo.x = clamp(mo.x + this.vel.x * dt, this.xMin + this.moR, this.xMax - this.moR);
      mo.y += this.vel.y * dt;
      if (this.rescue) {   // can't swim past the net until the turtle is free
        const lim = this.rescue.y - this.s * 230;
        if ((mo.y - lim) * this.s > 0) { mo.y = lim; this.vel.y = 0; }
      }
      mo.y = clamp(mo.y, 140, L.len - 140);
      // face the way Mo is moving; paddle
      const spd = Math.hypot(this.vel.x, this.vel.y);
      if (spd > 30) { const want = Math.atan2(this.vel.y, this.vel.x) + Math.PI / 2; mo.rotation = Phaser.Math.Angle.RotateTo(mo.rotation, want, 5 * dt); }
      mo.setScale(this.moBase * (1 + Math.sin(time / (this.turboT > 0 ? 50 : 140)) * 0.05), this.moBase);
      mo.setAlpha(this.inv > 0 ? (Math.floor(time / 90) % 2 ? 0.4 : 1) : 1);
      // riding the current?
      const along = f.vy * this.s;
      const riding = along > 110, against = along < -60;
      this.trail.emitting = riding || this.turboT > 0;
      const bt = this.turboT > 0 ? "⚡ TURBO!" : riding ? (f.cold > f.warm ? "❄️ Riding the cold current!" : "🌊 Riding the warm current!") : against ? "😣 Swimming against the current" : "";
      if (bt !== this.badgeTxt) { this.badgeTxt = bt; this.badge.setText(bt).setColor(against ? "#ffd0d8" : f.cold > f.warm ? "#bfe6ff" : "#fff1b8"); if (bt) this.tweens.add({ targets: this.badge, scale: { from: 1.25, to: 1 }, duration: 250 }); }
      if (against) this.first("against", "😣 This water flows the other way! Find the glowing current that goes your way.", 3500);

      // camera + backdrop
      cam.scrollY += (this.camTarget() - cam.scrollY) * (1 - Math.pow(0.004, dt));
      this.bg.tilePositionY = cam.scrollY / this.ts;
      this.drawCurrents(dt);

      // level flow
      const p = this.prog(mo.y);
      if (this.state === "swim") {
        const ramp = L.endless ? Math.min(2.4, 1 + this.km() / 4) : 1;
        for (const k in L.rates) {
          this.spawnT[k] = (this.spawnT[k] == null ? rnd(1, 4) : this.spawnT[k]) - dt;
          if (this.spawnT[k] <= 0 && (L.endless || p < 0.97)) { this.spawn(k); this.spawnT[k] = rnd(0.6, 1.4) / (L.rates[k] * (k === "grass" || k === "raft" ? 1 : ramp)); }
        }
        if (L.boats && (!L.endless || this.km() > 0.6)) { this.boatT -= dt; if (this.boatT <= 0 && p < 0.95) { this.spawnBoat(); this.boatT = L.boats * rnd(0.8, 1.2) / Math.sqrt(ramp); } }
        const fr = L.friends || [];
        for (let i = 0; i < fr.length; i += 2) {
          const k = fr[i]; this.friendT[k] = (this.friendT[k] == null ? fr[i + 1] * 0.5 : this.friendT[k]) - dt;
          if (this.friendT[k] <= 0 && p < 0.9) { this.spawnFriends(k); this.friendT[k] = fr[i + 1] * rnd(0.8, 1.3); }
        }
        if (!this.rescued && p >= this.rescueAt) this.startRescue();
        if (!L.endless && p >= 1) this.arrive();
      }
      if ((this.hudT = (this.hudT || 0) + dt) > 0.25) { this.hudT = 0; this.updateHUD(); }

      // things drifting in the water
      const behind = o => (o.y - mo.y) * this.s < -H * 0.9 || (o.y - mo.y) * this.s > H * 1.6;
      for (const o of this.things) {
        if (o.dead) continue;
        const s2 = o.spr, ff = this.field(s2.x, s2.y);
        o.wob += dt;
        s2.x += (ff.vx * o.T.drift + Math.sin(o.wob * 1.3) * 14) * dt; s2.y += ff.vy * o.T.drift * dt;
        s2.x = clamp(s2.x, this.xMin + 10, this.xMax - 10);
        s2.rotation += o.spin * dt * (o.k === "bag" ? 1 : 0.4);
        if (o.k === "bag") s2.setScale(s2.scaleX, s2.scaleX * (1 + Math.sin(o.wob * 3) * 0.08));
        if (behind(s2)) { o.dead = true; s2.destroy(); continue; }
        const d = Math.hypot(s2.x - mo.x, s2.y - mo.y), r = o.T.size * 0.36 + this.moR;
        if (d < r) {
          if (o.T.food) { o.dead = true; s2.destroy(); this.turbo = Math.min(100, this.turbo + 34); S.munch(); this.float(mo.x, mo.y - 70, "Munch! ⚡", "#c8ffb0", 24); this.first("grass", "🌿 Seagrass is turtle food! It charges your ⚡ Turbo button."); this.updateHUD(); continue; }
          if (o.T.rest) continue;
          if (o.T.hurt) {
            if (this.hurt(o.k === "bag" ? "Yuck! Plastic isn't food!" : "Tangled!")) {
              if (o.T.tangle) this.tangle = 1.2;
              o.dead = true; this.tweens.add({ targets: s2, alpha: 0, scale: 0, duration: 250, onComplete: () => s2.destroy() });
              if (o.k === "bag") this.first("bagHit", "Tap plastic bags to scoop them out with Kai's net, before Mo bumps into them!");
            }
            continue;
          }
          if (o.T.bonk) {
            const nx = (mo.x - s2.x) / (d || 1), ny = (mo.y - s2.y) / (d || 1);
            mo.x += nx * (r - d); mo.y += ny * (r - d); this.vel.x += nx * 160; this.vel.y += ny * 160;
            if (!o.bonkT || time - o.bonkT > 800) { o.bonkT = time; S.dig(); this.float(mo.x, mo.y - 60, "Bonk!", "#c9f7ff", 22); }
          }
        }
      }
      this.things = this.things.filter(o => !o.dead);
      // shells
      for (const sh of this.shellArr) {
        if (!sh.active) continue;
        const d = Math.hypot(sh.x - mo.x, sh.y - mo.y);
        if (d < this.finder) { const a = Math.atan2(mo.y - sh.y, mo.x - sh.x); sh.x += Math.cos(a) * 600 * dt; sh.y += Math.sin(a) * 600 * dt; }
        if (d < this.moR + 14) { sh.destroy(); this.shells++; if (this.popT <= 0) { S.tick(); this.popT = 0.25; } }
      }
      if (L.endless && Math.random() < dt * 2.2) {      // endless: shells keep coming along the main current
        const y = this.aheadY(), x = clamp(this.laneX(L.lanes[0], this.prog(y), y) + rnd(-30, 30), this.xMin + 20, this.xMax - 20);
        this.shellArr.push(fit(this.add.image(x, y, "shell"), 40).setDepth(1));
      }
      if ((this.cleanT = (this.cleanT || 0) + dt) > 2) { this.cleanT = 0; this.shellArr = this.shellArr.filter(sh => { if (sh.active && (sh.y - mo.y) * this.s < -H) sh.destroy(); return sh.active; }); }
      // friends
      for (const fg of this.pals) {
        let alive = 0;
        for (const m of fg.group) {
          const s2 = m.spr; if (!s2.active) continue;
          m.hop += dt;
          if (m.ride) { const ff = this.field(s2.x, s2.y); s2.x += (ff.vx * m.ride + Math.sin(m.hop * 2) * 30) * dt; s2.y += (ff.vy * m.ride + this.s * 40) * dt; }
          else { s2.x += m.vx * dt + (m.weave ? Math.sin(m.hop * 2.2) * 90 * dt : 0); s2.y += m.vy * dt; }
          if (fg.kind === "flyfish") s2.setScale(s2.scaleX, s2.scaleX).setAlpha(0.75 + 0.25 * Math.sin(m.hop * 6));
          if (s2.x < -400 || s2.x > W + 400 || behind(s2)) { s2.destroy(); continue; }
          alive++;
          if (!fg.met && Math.hypot(s2.x - mo.x, s2.y - mo.y) < this.moR + 50) {
            fg.met = true; this.friends++; this.shells += 10; S.chirp(); S.yay();
            this.float(s2.x, s2.y - 60, "👋 Hi, friend! +10 🐚", "#c9f7ff", 28);
            fg.group.forEach(q => q.spr.active && this.tweens.add({ targets: q.spr, angle: q.spr.angle + 20, yoyo: true, repeat: 2, duration: 110 }));
          }
        }
        fg.dead = !alive;
      }
      this.pals = this.pals.filter(fg => !fg.dead);
      // boats
      for (const b of this.boats) {
        b.spr.y += b.vy * dt; if (Math.random() < 0.6) this.fx.explode(1, b.spr.x + rnd(-20, 20), b.spr.y - Math.sign(b.vy) * 110);
        if (Math.abs(b.spr.x - mo.x) < 48 + this.moR * 0.7 && Math.abs(b.spr.y - mo.y) < 110 + this.moR * 0.7) this.hurt("Watch out for boats!");
        if ((b.spr.y - mo.y) * this.s < -160) this.boatWarn = null;
        if ((b.spr.y - mo.y) * this.s < -H) { b.dead = true; b.spr.destroy(); }
      }
      this.boats = this.boats.filter(b => !b.dead);
      // rescue net: bumping it tangles you
      if (this.rescue) {
        const R = this.rescue; R.t += dt;
        R.net.rotation = Math.sin(R.t * 0.8) * 0.05;
        if (Math.hypot(R.net.x - mo.x, (R.net.y - mo.y) * 1.8) < 200 + this.moR && this.hurt("Careful! Don't get stuck too!")) { this.vel.y = -this.s * 300; }
      }
    }
    drawCurrents(dt) {
      const cam = this.cameras.main, top = cam.scrollY - 40, bot = cam.scrollY + H + 40, g = this.lanesG;
      g.clear();
      for (const L of this.L.lanes) {
        const col = this.light ? (L.cold ? 0x2f86e0 : L.v > 0 ? 0xff8a3c : 0xff4f7a) : (L.cold ? 0x6fc4ff : L.v > 0 ? 0xffa860 : 0xff6f8f);
        for (const [k, a] of [[0.85, 0.13], [0.45, 0.13]]) {      // soft glowing band, brighter in the middle
          const left = [], right = [];
          for (let y = top; y <= bot; y += 48) {
            const p = this.prog(y);
            if (L.p && (p < L.p[0] || p > L.p[1])) continue;
            const x = this.laneX(L, p, y);
            left.push({ x: x - L.w * k, y }); right.unshift({ x: x + L.w * k, y });
          }
          if (left.length < 2) continue;
          g.fillStyle(col, L.v > 0 ? a : a * 0.8).fillPoints(left.concat(right), true);
        }
      }
      // eddies
      const e = this.eddyG; e.clear();
      this.eTime = (this.eTime || 0) + dt;
      for (const E of this.eddies) {
        if (E.y < top - E.r || E.y > bot + E.r) continue;
        e.fillStyle(0xffffff, 0.06).fillCircle(E.x, E.y, E.r);
        for (let i = 0; i < 3; i++) {
          const a0 = this.eTime * 2.2 * E.spin + i * 2.1, r = E.r * (0.35 + i * 0.22);
          e.lineStyle(6, 0xffffff, 0.35 - i * 0.07).beginPath().arc(E.x, E.y, r, a0, a0 + 1.9 * (E.spin > 0 ? 1 : -1), E.spin < 0).strokePath();
        }
      }
      // chevrons ride the flow
      for (const c of this.chevs) {
        const s2 = c.spr;
        if (c.life <= 0) {
          const x = rnd(this.xMin, this.xMax), y = rnd(top, bot), f = this.field(x, y), sp = Math.hypot(f.vx, f.vy);
          if (sp < 70) continue;
          s2.setPosition(x, y).setVisible(true).setTint(this.light ? (f.cold > f.warm ? 0x1f6fd0 : this.alongOf(f) < 0 ? 0xe8456e : 0xf07a2a) : (f.cold > f.warm ? 0xbfe6ff : this.alongOf(f) < 0 ? 0xffc0cc : 0xffe2c4));
          c.life = c.max = rnd(0.8, 1.6);
        }
        c.life -= dt;
        const f = this.field(s2.x, s2.y), sp = Math.hypot(f.vx, f.vy);
        s2.x += f.vx * dt; s2.y += f.vy * dt;
        s2.rotation = Math.atan2(f.vy, f.vx) + Math.PI / 2;
        s2.setAlpha(Math.min(1, sp / 220) * 0.75 * Math.sin(Math.PI * clamp(c.life / c.max, 0, 1)));
        if (c.life <= 0 || sp < 40) { c.life = 0; s2.setVisible(false); }
      }
    }
    alongOf(f) { return f.vy * this.s; }

    /* ---------- end */
    arrive() {
      if (this.state === "arrive" || this.state === "done") return;
      this.state = "arrive"; S.yay();
      this.fx.explode(60, this.mo.x, this.mo.y);
      this.things.forEach(o => { if (o.T.hurt) { o.dead = true; o.spr.destroy(); } });
      this.boats.forEach(b => b.spr.destroy()); this.boats = [];
      this.time.delayedCall(1800, () => this.finish(true));
    }
    par() { const L = this.L, v = L.lanes.filter(l => l.v > 0).map(l => l.v)[0] || 200; return Math.round(Math.abs(this.y1 - this.y0) / (175 + v * 0.58) + (L.rescue ? 14 : 0)); }
    finish(win) {
      if (this.state === "done") return;
      const L = this.L;
      this.state = "done"; this.trail.emitting = false;
      const sv = save.get();
      let stars = 0, keep;
      if (L.endless) {
        keep = this.shells; sv.best = Math.max(sv.best || 0, this.km());
      } else {
        keep = win ? this.shells : Math.floor(this.shells / 2);
        stars = win ? 1 + (this.hits <= 1 ? 1 : 0) + (this.t <= this.par() ? 1 : 0) : 0;
        if (win) sv.stars[this.li + 1] = Math.max(sv.stars[this.li + 1] || 0, stars);
      }
      sv.shells += keep; sv.friends += this.friends; sv.scooped = (sv.scooped || 0) + this.scooped;
      save.set(sv);
      this.add.rectangle(W / 2, H / 2, W, H, 0x0b2236, 0.55).setDepth(80).setInteractive().setScrollFactor(0);
      const c = this.add.container(0, 0).setDepth(81).setScrollFactor(0);
      c.add(panel(this, W / 2, 680, 640, 900, win ? 0x5ccf6a : 0xff7f50));
      if (L.endless) {
        c.add(fit(this.add.image(W / 2, 380, "mo"), 190));
        c.add(txt(this, W / 2, 510, "Mo swam " + this.km() + " km!", 46, "#123a5a", { strokeThickness: 0 }));
        c.add(txt(this, W / 2, 570, this.km() >= sv.best ? "🏆 New best!" : "Best: " + sv.best + " km", 32, "#e0662f", { strokeThickness: 0 }));
        c.add(txt(this, W / 2, 680, Phaser.Utils.Array.GetRandom(TIPS), 23, "#4b6478", { strokeThickness: 0, wordWrap: { width: 540 } }));
        S.yay();
      } else if (win) {
        c.add(fit(this.add.image(W / 2 - 120, 360, L.goal), 200));
        c.add(fit(this.add.image(W / 2 + 120, 370, "mo"), 150));
        c.add(txt(this, W / 2, 490, "You reached " + L.to + "!", 42, "#123a5a", { strokeThickness: 0 }));
        const st = txt(this, W / 2, 560, "★".repeat(stars) + "☆".repeat(3 - stars), 66, "#ffc83a", { stroke: "#e0a21a", strokeThickness: 4 });
        st.setScale(0.2); this.tweens.add({ targets: st, scale: 1, duration: 500, ease: "Back.out" }); c.add(st);
        c.add(txt(this, W / 2, 630, "✓ Arrived   " + (this.hits <= 1 ? "✓" : "✗") + " 1 bump or less   " + (this.t <= this.par() ? "✓" : "✗") + " ⏱ " + Math.floor(this.t) + "s / " + this.par() + "s", 21, "#4b6478", { strokeThickness: 0 }));
        c.add(txt(this, W / 2, 730, L.fact, 25, "#3b2f4a", { strokeThickness: 0, wordWrap: { width: 540 } }));
        S.yay(); this.fx.explode(80, this.mo.x, this.mo.y);
      } else {
        c.add(fit(this.add.image(W / 2, 400, "mo"), 180).setAngle(-12));
        c.add(txt(this, W / 2, 530, "Mo needs a little rest.", 40, "#123a5a", { strokeThickness: 0 }));
        c.add(txt(this, W / 2, 620, "You kept 🐚" + keep + " shells. Help Mo grow stronger, then try again!", 25, "#3b2f4a", { strokeThickness: 0, wordWrap: { width: 520 } }));
        c.add(txt(this, W / 2, 730, Phaser.Utils.Array.GetRandom(TIPS), 22, "#4b6478", { strokeThickness: 0, wordWrap: { width: 540 } }));
        S.oops();
      }
      c.add(txt(this, W / 2, 840, "🐚 +" + keep + (this.friends ? "   🐟 +" + this.friends + " friend" + (this.friends > 1 ? "s" : "") : "") + (this.scooped ? "   🛍️ " + this.scooped + " scooped" : ""), 26, "#e0662f", { strokeThickness: 0 }));
      const next = win && !L.endless && this.li < LEVELS.length - 1;
      const btns = [["⌂ Trips", 0x2fb6c9, () => this.scene.start("title")], ["↻ Again", 0xff7f50, () => this.scene.start("play", { level: this.li })]];
      if (next) btns.push(["Next ▶", 0x5ccf6a, () => this.scene.start("play", { level: this.li + 1 })]);
      btns.forEach((b, i) => c.add(button(this, W / 2 + (i - (btns.length - 1) / 2) * 196, 950, 180, 80, b[0], b[1], b[2], 28)));
      c.add(button(this, W / 2, 1055, 300, 66, "🐢 Help Mo Grow", 0x5ccf6a, () => this.scene.start("grow"), 26));
      c.iterate(o => o.setScrollFactor && o.setScrollFactor(0));
      if (win && this.li === LEVELS.length - 1) this.time.delayedCall(700, () => this.toast("🏆 You rode the Kuroshio all the way toward Japan! Mo is a real ocean traveler now.", 5000, 200));
    }
  }

  function start() {
    const ready = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 32px "Baloo 2"')]).catch(() => {}) : Promise.resolve();
    Promise.race([ready, new Promise(r => setTimeout(r, 2500))]).then(() => {
      window.__rcGame = new Phaser.Game({
        type: Phaser.AUTO, parent: "game", backgroundColor: "#1d6fa0",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
        input: { activePointers: 2 },
        fps: /[?&]timer=1/.test(location.search) ? { forceSetTimeOut: true, target: 60 } : undefined,
        scene: [Boot, Title, Grow, Play],
      });
    });
  }
  window.RideTheCurrent = { start, LEVELS };
})();
