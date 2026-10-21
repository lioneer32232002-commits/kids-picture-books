/* Typhoon Chasers! — rules, missions and the test bot, with no drawing (runs in Node too).
   Chase missions: Swoop flies around a typhoon on the shared map of Taiwan's seas (currents/geo.js, 400 px per degree,
   so 1 px is about 0.28 km; storms are drawn at about the right size for the map, a little small). The wind spins counterclockwise around the eye, strongest at the eyewall, and pushes Swoop.
   Get Ready missions: tap the things in the yard before the rising wind blows them away, and pack the typhoon kit.
   Screen angles: 0 = east, 90 = south (y points down), 180 = west, 270 = north. */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : global;
  const G = root.TaiwanGeo;
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const KX = Math.cos(23.5 * D2R);
  const SX = 400;                                            // px per degree of latitude
  const P = G.projector((G.BOX.e - G.BOX.w) * KX * SX);
  const PX_PER_KM = SX / 111.2;
  const at = (lon, lat) => { const p = P([lon, lat]); return { x: p[0], y: p[1] }; };
  const LAND_PX = {};
  for (const k in G.LAND) LAND_PX[k] = G.smooth(G.LAND[k].map(P), true, 5).map(p => ({ x: p[0], y: p[1] }));
  const BOUNDS = (() => { const a = at(118.4, 27.3), b = at(127.4, 17.8); return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }; })();
  // Taiwan's typhoon-chasing jet takes off from Taichung (Ching Chuan Kang Air Base)
  const BASE = Object.assign(at(120.62, 24.26), { name: "Taichung", r: 110 });

  const PLANE = { air: 210, turn: 2.6, ringR: 84 };
  const EYE_MARGIN = 80;
  const K = 2.1;                                             // mission sizes below are in old map units; K scales them up                                     // the no-fly ring outside the eyewall

  /* ---------------- missions
     chase: track [lon, lat] points, speed px/s, Vm = strongest wind px/s, Re = eyewall radius px, Rs = storm radius px,
            rings [angle, distance] around the eye, cells [angle, distance] thunderstorms, fuel = seconds of fuel
     home:  T = seconds until the typhoon arrives, items in the yard, kit = things to pack */
  const ITEMS = {
    pot: { name: "flower pot", heavy: 1 }, tree: { name: "potted tree", heavy: 2 }, bike: { name: "bicycle", heavy: 2 },
    chair: { name: "chair", heavy: 1 }, chime: { name: "wind chime", heavy: 1 }, bin: { name: "trash can", heavy: 2 },
    umbrella: { name: "umbrella", heavy: 1 }, laundry: { name: "laundry", heavy: 1 },
  };
  const KIT = ["flashlight", "water", "radio", "cans"];
  // spots on the 1280 x 720 house picture: yard (y about 620) and balcony (y about 250)
  const SPOTS = {
    yardL1: [150, 640], yardL2: [300, 610], yardL3: [430, 655], yardR1: [850, 655], yardR2: [990, 610], yardR3: [1130, 640],
    balL: [330, 262], balR: [940, 262], balC: [740, 262],
  };
  const LEVELS = [
    { k: "first", kind: "chase", name: "First Chase", strength: "Light",
      intro: "A light typhoon is spinning over the ocean, east of Taiwan. Fly Swoop to the 3 glowing rings to drop dropsondes, then fly home to Taichung.",
      track: [[124.7, 20.5], [123.7, 21.1]], speed: 5, Vm: 120, Re: 80, Rs: 420, fuel: 90,
      rings: [[200, 300], [235, 280], [165, 320]], cells: [] },
    { k: "ready", kind: "home", name: "Get Ready!",
      intro: "A typhoon warning! The wind is getting stronger. Tap the things in the yard to bring them inside, and pack the typhoon kit before the typhoon arrives.",
      T: 55, items: [["pot", "yardL2", 0.3], ["chair", "yardR2", 0.45], ["umbrella", "yardR1", 0.55], ["laundry", "balL", 0.65], ["chime", "balR", 0.8]] },
    { k: "spin", kind: "chase", name: "Ride the Spin", strength: "Medium",
      intro: "Rings on every side of the typhoon! The wind spins counterclockwise. Fly the same way it spins and you'll zoom. Fly against it and you'll crawl!",
      track: [[124.9, 20.1], [123.8, 21.1]], speed: 6, Vm: 175, Re: 88, Rs: 470, fuel: 110,
      rings: [[180, 300], [90, 310], [0, 310], [270, 300]], cells: [] },
    { k: "night", kind: "home", name: "Typhoon Night", night: true,
      intro: "Get ready before dark! Then the power goes out, and you'll need your flashlight. And listen: if the wind suddenly stops, what should you do?",
      T: 38, items: [["pot", "yardL1", 0.3], ["tree", "yardL3", 0.4], ["bike", "yardR1", 0.55], ["bin", "yardR3", 0.7]],
      find: [["lantern", 50, 84, "the lantern"], ["cat", 82, 83, "the cat"], ["radio", 89, 51, "the radio"], ["water", 84, 45, "the water"]] },
    { k: "bands", kind: "chase", name: "Rain Bands", strength: "Medium",
      intro: "This typhoon has big rain bands with thunderstorms inside. Drop 5 dropsondes, and fly around the red thunderstorm clouds. They're bumpy!",
      track: [[124.9, 20.0], [123.6, 21.3]], speed: 6, Vm: 190, Re: 90, Rs: 500, fuel: 120,
      rings: [[200, 330], [130, 260], [60, 350], [330, 290], [255, 400]], cells: [[160, 380], [95, 210], [25, 420], [295, 340], [225, 250]] },
    { k: "big", kind: "home", name: "Big Typhoon", strong: true,
      intro: "A strong typhoon is coming, and the wind will rise fast! There's a lot to bring in, on the balcony too. Heavy things make Mei walk slowly, so save them early!",
      T: 42, items: [["pot", "yardL1", 0.14], ["bike", "yardR3", 0.22], ["chair", "yardL3", 0.3], ["bin", "yardL2", 0.38], ["tree", "yardR2", 0.46],
        ["umbrella", "yardR1", 0.54], ["laundry", "balL", 0.62], ["chime", "balR", 0.7]] },
    { k: "turn", kind: "chase", name: "The Big Turn", strength: "Strong",
      intro: "Will this typhoon hit Taiwan, or turn north? The Pacific High is pulling back. Drop 5 dropsondes so the forecasters can see the turn!",
      track: [[125.1, 19.5], [124.3, 20.7], [123.9, 21.9], [124.1, 23.0], [124.8, 23.9]], speed: 8, Vm: 205, Re: 92, Rs: 500, fuel: 130,
      rings: [[300, 330], [250, 300], [340, 380], [200, 320], [270, 420]], cells: [[225, 230], [320, 250], [150, 360]] },
    { k: "super", kind: "chase", name: "Super Typhoon", strength: "Strong",
      intro: "The strongest typhoon of the year! Its eyewall winds are faster than Swoop. Drop 6 dropsondes, stay out of the eyewall, and dodge the thunderstorms.",
      track: [[125.0, 20.0], [123.7, 21.4]], speed: 7, Vm: 235, Re: 100, Rs: 560, fuel: 130,
      rings: [[190, 330], [120, 300], [60, 380], [0, 300], [300, 340], [240, 420]], cells: [[150, 400], [90, 230], [30, 440], [330, 250], [270, 300], [215, 260]] },
  ];
  const FREE = { k: "free", kind: "chase", name: "Free Chase", free: true, strength: "Medium",
    intro: "Drop as many dropsondes as you can! New rings keep coming. Press HOME when you're done.",
    track: [[125.0, 19.8], [123.4, 21.6]], speed: 6, Vm: 185, Re: 90, Rs: 500, fuel: 0, rings: [], cells: [[150, 390], [60, 240], [320, 330], [240, 420]] };

  /* ---------------- the typhoon */
  function makeStorm(L) {
    const pts = G.smooth(L.track.map(P), false, 8);
    let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const st = { pts, len, s: 0, speed: L.speed * K, Vm: L.Vm, Re: L.Re * K, Rs: L.Rs * K, x: 0, y: 0, vx: 0, vy: 0, spin: 0 };
    placeStorm(st); st.vx = 0; st.vy = 0;
    return st;
  }
  function placeStorm(st) {
    const p = G.along(st.pts, st.len ? st.s / st.len : 0);
    st.vx = (p.x - st.x) || 0; st.vy = (p.y - st.y) || 0;   // overwritten by step with a per-second velocity
    st.x = p.x; st.y = p.y; st.dir = p.ang;
  }
  /** wind at a point: counterclockwise around the eye, a little inward; calm in the eye, strongest at the eyewall */
  function wind(st, x, y) {
    const dx = x - st.x, dy = y - st.y, r = Math.hypot(dx, dy) || 1;
    let v = r < st.Re ? st.Vm * (r / st.Re) * (r / st.Re) : st.Vm * Math.pow(st.Re / r, 0.62);
    if (r > st.Rs) v *= Math.max(0, 1 - (r - st.Rs) / 500);
    const tx = dy / r, ty = -dx / r, rx = dx / r, ry = dy / r;
    return { x: (tx - 0.14 * rx) * v + st.vx, y: (ty - 0.14 * ry) * v + st.vy, v, r };
  }
  const polar = (st, a, d) => ({ x: st.x + Math.cos(a * D2R) * d, y: st.y + Math.sin(a * D2R) * d });

  /* ---------------- chase */
  function createChase(L) {
    const st = makeStorm(L);
    const s = { kind: "chase", L, t: 0, st, done: false, result: null, events: [],
      x: BASE.x + 30, y: BASE.y, a: Math.atan2(st.y - BASE.y, st.x - BASE.x), vx: 0, vy: 0, gs: 0,
      fuel: 100, outOfFuel: false, home: false, bumps: 0, bumpCD: 0, push: { x: 0, y: 0 }, drops: 0,
      rings: L.rings.map(([a, d]) => ({ a, d: d * K, done: false, x: 0, y: 0 })),
      cells: L.cells.map(([a, d]) => ({ a, d: d * K, x: 0, y: 0, r: 72 })), freeRing: 0 };
    s.need = s.rings.length;
    if (L.free) { for (let i = 0; i < 3; i++) addFreeRing(s); s.need = Infinity; }
    placeThings(s);
    return s;
  }
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  function addFreeRing(s) {
    for (let tries = 0; tries < 30; tries++) {
      const a = rnd() * 360, d = (220 + rnd() * 220) * K;
      const ok = s.rings.every(r => r.done || Math.abs(((r.a - a + 540) % 360) - 180) > 40) && s.cells.every(c => Math.hypot(Math.cos(c.a * D2R) * c.d - Math.cos(a * D2R) * d, Math.sin(c.a * D2R) * c.d - Math.sin(a * D2R) * d) > 260);
      if (ok) { s.rings.push({ a, d, done: false, x: 0, y: 0 }); return; }
    }
  }
  function placeThings(s) {
    const st = s.st;
    for (const r of s.rings) { const p = polar(st, r.a, r.d); r.x = p.x; r.y = p.y; }
    for (const c of s.cells) { const p = polar(st, c.a, c.d); c.x = p.x; c.y = p.y; }
  }
  function stepChase(s, dt, inp) {
    const st = s.st, L = s.L;
    s.events = []; s.t += dt;
    // the storm drifts along its track; thunderstorms ride around with the spinning wind (slower than the wind itself)
    const ox = st.x, oy = st.y;
    st.s = L.free ? (st.s + st.speed * dt) % st.len : Math.min(st.len, st.s + st.speed * dt);
    placeStorm(st); st.vx = (st.x - ox) / dt; st.vy = (st.y - oy) / dt;
    if (L.free && Math.hypot(st.vx, st.vy) > 50) { st.vx = 0; st.vy = 0; }   // the free storm loops back to its start
    st.spin -= dt * 0.35;
    for (const c of s.cells) { const w = wind({ x: 0, y: 0, vx: 0, vy: 0, Vm: st.Vm, Re: st.Re, Rs: st.Rs }, c.d, 0).v; c.a -= (w / c.d) * dt / D2R * 0.3; }
    placeThings(s);
    // steering: toward the finger, or the arrow keys
    if (!s.done) {
      let want = null;
      if (s.outOfFuel) want = { x: BASE.x, y: BASE.y };
      else if (inp.aim) want = inp.aim;
      if (want) {
        const da = Math.atan2(want.y - s.y, want.x - s.x) - s.a, d = Math.atan2(Math.sin(da), Math.cos(da));
        s.a += clamp(d, -PLANE.turn * dt, PLANE.turn * dt);
      } else if (inp.turn) s.a += inp.turn * PLANE.turn * dt;
      const w = wind(st, s.x, s.y), air = PLANE.air * (s.outOfFuel ? 1.25 : 1);
      s.vx = Math.cos(s.a) * air + w.x + s.push.x; s.vy = Math.sin(s.a) * air + w.y + s.push.y;
      s.x = clamp(s.x + s.vx * dt, BOUNDS.x0, BOUNDS.x1); s.y = clamp(s.y + s.vy * dt, BOUNDS.y0, BOUNDS.y1);
      s.gs = Math.hypot(s.vx, s.vy); s.wind = w;
      s.push.x *= Math.pow(0.04, dt); s.push.y *= Math.pow(0.04, dt);
      s.bumpCD = Math.max(0, s.bumpCD - dt);
      const bump = (from, why) => {
        const dx = s.x - from.x, dy = s.y - from.y, r = Math.hypot(dx, dy) || 1;
        s.push.x = dx / r * 300; s.push.y = dy / r * 300;
        if (s.bumpCD <= 0) { s.bumps++; s.bumpCD = 1.6; s.events.push({ type: "bump", why }); }
      };
      if (w.r < st.Re + EYE_MARGIN) bump(st, "eyewall");
      for (const c of s.cells) if (Math.hypot(s.x - c.x, s.y - c.y) < c.r + 30) bump(c, "cell");
      // dropsondes
      for (const r of s.rings) if (!r.done && Math.hypot(s.x - r.x, s.y - r.y) < PLANE.ringR) {
        r.done = true; s.drops++; s.events.push({ type: "drop", x: r.x, y: r.y, n: s.drops, kmh: Math.round(wind(st, r.x, r.y).v * 0.8) });
        if (L.free) addFreeRing(s);
      }
      if (!s.home && s.drops >= s.need) { s.home = true; s.events.push({ type: "allDropped" }); }
      // fuel
      if (L.fuel && !s.outOfFuel) {
        s.fuel = Math.max(0, s.fuel - dt * 100 / L.fuel);
        if (s.fuel < 25 && !s.lowFuel) { s.lowFuel = true; s.events.push({ type: "lowFuel" }); }
        if (s.fuel <= 0) { s.outOfFuel = true; s.events.push({ type: "outOfFuel" }); }
      }
      // landing at home
      const atBase = Math.hypot(s.x - BASE.x, s.y - BASE.y) < BASE.r;
      if (atBase && (s.home || s.outOfFuel || inp.goHome) && s.t > 3) finishChase(s);
      if (L.free && inp.goHome && !s.done) s.outOfFuel = true;   // free chase: HOME flies you back
    }
  }
  function finishChase(s) {
    s.done = true;
    const all = s.drops >= s.need;
    let stars = all ? (s.bumps === 0 && !s.outOfFuel ? 3 : s.bumps <= 2 && !s.outOfFuel ? 2 : 1) : (s.drops > 0 ? 1 : 0);
    if (s.L.free) stars = 0;
    s.result = { stars, drops: s.drops, need: s.need, bumps: s.bumps, outOfFuel: s.outOfFuel, time: Math.round(s.t) };
    s.events.push({ type: "done" });
  }
  /** how wide the forecast cone is (1 = no data yet, smaller with every dropsonde) */
  const coneWidth = s => s.L.free ? Math.max(0.35, 1 - s.drops * 0.06) : Math.max(0.3, 1 - 0.7 * s.drops / Math.max(1, s.need));

  /* ---------------- get ready
     Tap a thing and a helper fetches it: Mei walks out to the yard (heavy things make her slow), Mom takes things off the balcony.
     Each helper works through her own list in the order you tapped. A wobbling thing blows away if nobody gets there in time. */
  const DOOR = { x: 637, y: 600 };
  const WALK = 270, MOM_TIME = 1.8, PICK = 0.35;
  function createHome(L) {
    const s = { kind: "home", L, t: 0, wind: 0, done: false, result: null, events: [], phase: "prep",
      items: L.items.map(([k, spot, loose], i) => ({ i, k, x: SPOTS[spot][0], y: SPOTS[spot][1], x0: SPOTS[spot][0], balcony: spot.startsWith("bal"), loose, heavy: ITEMS[k].heavy,
        state: "idle", wob: 0, queued: false })),
      mei: { x: DOOR.x, y: DOOR.y, state: "home", it: null, q: [], t: 0, face: 1 },
      mom: { state: "home", it: null, q: [], t: 0 },
      kit: {}, found: {}, eyeChoice: null };
    return s;
  }
  const WOBBLE = 6;                                           // seconds an item wobbles before the wind takes it
  const live = it => it.state === "idle" || it.state === "wobble";
  function stepHelpers(s, dt) {
    const m = s.mei;
    const next = () => { while (m.q.length && !live(m.q[0])) m.q.shift(); return m.q.shift() || null; };
    if (m.state === "home" || m.state === "back") {
      if (m.state === "back") {
        const d = Math.hypot(DOOR.x - m.x, DOOR.y - m.y), v = WALK * dt;
        if (d <= v) { m.x = DOOR.x; m.y = DOOR.y; m.state = "home"; } else { m.face = Math.sign(DOOR.x - m.x) || m.face; m.x += (DOOR.x - m.x) / d * v; m.y += (DOOR.y - m.y) / d * v; }
      }
      const it = next(); if (it) { m.it = it; m.state = "go"; }
    } else if (m.state === "go") {
      const it = m.it;
      if (!live(it)) { m.it = next(); if (!m.it) m.state = "back"; }
      else {
        const tx = it.x, ty = it.y + 10, d = Math.hypot(tx - m.x, ty - m.y), v = WALK * dt;
        m.face = Math.sign(tx - m.x) || m.face;
        if (d <= v) { m.x = tx; m.y = ty; m.state = "pick"; m.t = 0; } else { m.x += (tx - m.x) / d * v; m.y += (ty - m.y) / d * v; }
      }
    } else if (m.state === "pick") {
      if (!live(m.it)) { m.it = next(); m.state = m.it ? "go" : "back"; }
      else if ((m.t += dt) >= PICK) { m.it.state = "carried"; m.state = "carry"; s.events.push({ type: "pick", it: m.it }); }
    } else if (m.state === "carry") {
      const it = m.it, d = Math.hypot(DOOR.x - m.x, DOOR.y - m.y), v = WALK / it.heavy * dt;
      m.face = Math.sign(DOOR.x - m.x) || m.face;
      if (d <= v) {
        m.x = DOOR.x; m.y = DOOR.y; it.state = "saved"; s.events.push({ type: "saved", it });
        m.it = next(); m.state = m.it ? "go" : "home";
      } else { m.x += (DOOR.x - m.x) / d * v; m.y += (DOOR.y - m.y) / d * v; }
      if (it.state === "carried") { it.x = m.x; it.y = m.y - 128; }
    }
    const mo = s.mom;
    if (mo.state === "home") {
      while (mo.q.length && !live(mo.q[0])) mo.q.shift();
      if (mo.q.length) { mo.it = mo.q.shift(); mo.state = "get"; mo.t = 0; s.events.push({ type: "momOut", it: mo.it }); }
    } else if (mo.state === "get") {
      if (mo.it.state === "gone") { mo.state = "home"; mo.it = null; }
      else if ((mo.t += dt) >= MOM_TIME) { mo.it.state = "saved"; s.events.push({ type: "saved", it: mo.it, mom: true }); mo.state = "home"; mo.it = null; }
      else if (mo.t >= MOM_TIME * 0.4 && mo.it.state !== "carried") { mo.it.state = "carried"; }
    }
  }
  function stepHome(s, dt, inp) {
    s.events = []; s.t += dt;
    const L = s.L;
    if (s.phase === "prep") {
      s.wind = clamp(s.t / L.T, 0, 1);
      for (const it of s.items) {
        if (it.state === "idle" && s.wind >= it.loose) { it.state = "wobble"; it.wob = 0; s.events.push({ type: "wobble", it }); }
        else if (it.state === "wobble" && (it.wob += dt) >= WOBBLE * (L.strong ? 0.8 : 1)) { it.state = "gone"; s.events.push({ type: "gone", it }); }
      }
      for (const tap of inp.taps || []) tapHome(s, tap);
      stepHelpers(s, dt);
      const left = s.items.filter(it => it.state !== "saved" && it.state !== "gone").length;
      const kitDone = KIT.every(k => s.kit[k]);
      if (s.wind >= 1 || (!left && kitDone)) {
        for (const it of s.items) if (it.state !== "saved" && it.state !== "gone") { it.state = "gone"; s.events.push({ type: "gone", it }); }
        s.prep = { saved: s.items.filter(it => it.state === "saved").length, total: s.items.length, kit: KIT.filter(k => s.kit[k]).length };
        s.events.push({ type: "prepDone", early: s.wind < 1 });
        if (L.find) { s.phase = "dark"; s.events.push({ type: "lightsOut" }); } else finishHome(s);
      }
    } else if (s.phase === "dark") {
      for (const tap of inp.taps || []) {
        for (const [k, px, py, name] of L.find) if (!s.found[k] && Math.hypot(tap.x - px * 12.8, tap.y - py * 7.2) < 75) { s.found[k] = true; s.events.push({ type: "found", k, name }); }
      }
      if (L.find.every(f => s.found[f[0]])) { s.phase = "eye"; s.events.push({ type: "eye" }); }
    } else if (s.phase === "eye") {
      if (inp.choice) {
        if (inp.choice === "out") { if (!s.eyeChoice) s.eyeChoice = "out"; s.events.push({ type: "notYet" }); }
        else { s.eyeChoice = s.eyeChoice || "in"; s.events.push({ type: "stayIn" }); s.phase = "back"; s.backT = 0; }
      }
    } else if (s.phase === "back") {
      if ((s.backT += dt) > 4) finishHome(s);
    }
  }
  function tapHome(s, tap) {
    if (tap.kit) { if (!s.kit[tap.kit]) { s.kit[tap.kit] = true; s.events.push({ type: "pack", k: tap.kit }); } return; }
    const it = s.items[tap.item];
    if (!it || !live(it) || it.queued) return;
    it.queued = true;
    (it.balcony ? s.mom.q : s.mei.q).push(it);
    s.events.push({ type: "queued", it });
  }
  function finishHome(s) {
    s.done = true; s.phase = "done";
    const p = s.prep, lost = p.total - p.saved, kitAll = p.kit === KIT.length;
    const stars = lost === 0 && kitAll ? 3 : lost <= 1 && kitAll ? 2 : 1;
    s.result = { stars, saved: p.saved, total: p.total, kit: p.kit, eye: s.eyeChoice };
    s.events.push({ type: "done" });
  }

  function create(L) { seed = 7; return L.kind === "home" ? createHome(L) : createChase(L); }
  function step(s, dt, inp) { return s.kind === "home" ? stepHome(s, dt, inp || {}) : stepChase(s, dt, inp || {}); }

  /* ---------------- test bot: plays like a careful kid */
  function bot(s, dt, mem) {
    if (s.kind === "home") {
      mem.cd = (mem.cd || 0) - dt;
      if (mem.cd > 0) return {};
      mem.cd = mem.slow || 0.9;                              // one tap about every second
      if (s.phase === "prep") {
        const todo = s.items.filter(it => live(it) && !it.queued);
        todo.sort((a, b) => (b.state === "wobble") - (a.state === "wobble") || a.loose - b.loose);
        const kit = KIT.find(k => !s.kit[k]);
        const urgent = todo.length && (todo[0].state === "wobble" || todo[0].loose - s.wind < 0.25);
        if (urgent || (todo.length && !kit)) return { taps: [{ item: todo[0].i }] };
        if (kit) return { taps: [{ kit }] };
        if (todo.length) return { taps: [{ item: todo[0].i }] };
        return {};
      }
      if (s.phase === "dark") { const f = s.L.find.find(f => !s.found[f[0]]); return f ? { taps: [{ x: f[1] * 12.8, y: f[2] * 7.2 }] } : {}; }
      if (s.phase === "eye") return { choice: "in" };
      return {};
    }
    // chase: next ring (or home), going around the eyewall and the thunderstorms
    const st = s.st;
    let target = null;
    if (!s.home) {
      let best = 1e9;
      for (const r of s.rings) if (!r.done) {
        // prefer rings ahead in the counterclockwise direction (tailwind), then the closest
        const pa = Math.atan2(s.y - st.y, s.x - st.x) / D2R, ra = Math.atan2(r.y - st.y, r.x - st.x) / D2R;
        const ccw = ((pa - ra) % 360 + 360) % 360;             // degrees to go counterclockwise
        const cost = Math.hypot(r.x - s.x, r.y - s.y) + ccw * 2.2;
        if (cost < best) { best = cost; target = r; }
      }
    }
    if (!target) target = BASE;
    let aim = { x: target.x, y: target.y };
    // detour: if the straight line passes too close to the eye, aim at a point on a safe circle instead
    const safe = st.Re + EYE_MARGIN + 140;
    const dx = aim.x - s.x, dy = aim.y - s.y, L2 = dx * dx + dy * dy || 1;
    const k = clamp(((st.x - s.x) * dx + (st.y - s.y) * dy) / L2, 0, 1);
    const cx = s.x + dx * k, cy = s.y + dy * k;
    if (Math.hypot(cx - st.x, cy - st.y) < safe) {
      const pa = Math.atan2(s.y - st.y, s.x - st.x), ta = Math.atan2(aim.y - st.y, aim.x - st.x);
      let d = Math.atan2(Math.sin(ta - pa), Math.cos(ta - pa));
      const stepA = clamp(d, -0.9, 0.9), r = Math.max(safe + 30, Math.hypot(s.x - st.x, s.y - st.y));
      aim = { x: st.x + Math.cos(pa + stepA) * r, y: st.y + Math.sin(pa + stepA) * r };
    }
    // thunderstorms ahead: slide sideways
    for (const c of s.cells) {
      const ax = aim.x - s.x, ay = aim.y - s.y, al = Math.hypot(ax, ay) || 1;
      const t = ((c.x - s.x) * ax + (c.y - s.y) * ay) / al;
      if (t > 0 && t < 420) {
        const px = s.x + ax / al * t, py = s.y + ay / al * t, off = Math.hypot(c.x - px, c.y - py);
        if (off < c.r + 90) {
          const side = ((c.x - s.x) * ay - (c.y - s.y) * ax) > 0 ? 1 : -1;
          aim = { x: s.x + ax / al * t + (-ay / al) * side * 230, y: s.y + ay / al * t + (ax / al) * side * 230 };
        }
      }
    }
    return { aim };
  }

  root.TyphoonSim = { LEVELS, FREE, ITEMS, KIT, SPOTS, BASE, BOUNDS, LAND_PX, PLANE, EYE_MARGIN, PX_PER_KM, D2R, at, clamp, wind, polar, coneWidth,
    create, step, bot, WOBBLE, DOOR };
  if (typeof module !== "undefined") module.exports = root.TyphoonSim;
})();
