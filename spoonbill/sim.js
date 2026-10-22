/* Spoonbill Journey! — map, rules, missions and the test bot, with no drawing (runs in Node too).
   Feed missions: a side view of a shallow pond or mudflat. Bomi walks on the bottom and sweeps its spoon bill
     through the water; it can only wade where the water is shallow enough. Fish swim in the water; walking fast
     scares them. Some missions lower the water (a fish farmer drains a pond) or raise it (the tide comes in).
   Fly missions: a top-down map of East Asia (simplified coastlines, real latitudes and longitudes). The autumn
     northeast monsoon blows toward the southwest; in spring a gentler wind blows north. Flying uses energy;
     landing in a stopover wetland refills it; rain clouds are bumpy.
   The map also draws page 4 of the book. */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : global;
  const G = root.TaiwanGeo;
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  /* ---------------- the map: hand-simplified coastlines, [longitude, latitude] */
  const MAP = { w: 115, e: 131, s: 21.5, n: 40.8, kx: Math.cos(31 * D2R) };
  const COAST = {
    // China, North Korea and South Korea as one piece of land, closed far inland
    asia: [[108, 45], [125, 45], [130.5, 43], [129.8, 42.0], [129.6, 41.2], [128.6, 40.2], [127.6, 39.7], [128.0, 39.0], [128.5, 38.4], [129.0, 37.8],
      [129.4, 37.0], [129.5, 36.0], [129.4, 35.4], [129.1, 35.1], [128.5, 34.9], [127.6, 34.7], [126.9, 34.4], [126.3, 34.5], [126.4, 35.2],
      [126.7, 35.9], [126.5, 36.4], [126.2, 36.8], [126.7, 37.0], [126.6, 37.5], [126.1, 37.7], [125.6, 37.9], [124.9, 38.0], [125.2, 38.6],
      [125.4, 39.2], [124.8, 39.6], [124.3, 39.9], [123.2, 39.7], [122.3, 39.4], [121.6, 38.9], [121.2, 39.4], [121.6, 39.9], [122.2, 40.5],
      [121.6, 40.9], [121.0, 40.9], [120.3, 40.3], [119.5, 39.8], [118.8, 39.2], [117.8, 38.9], [117.6, 38.3], [118.2, 37.8], [119.0, 37.2],
      [119.7, 37.1], [120.3, 37.6], [121.2, 37.6], [122.5, 37.3], [122.4, 36.9], [121.5, 36.7], [120.7, 36.4], [120.2, 35.9], [119.5, 35.2],
      [119.3, 34.6], [120.2, 34.3], [120.6, 33.4], [120.9, 32.6], [121.5, 32.1], [121.9, 31.7], [121.9, 31.0], [121.0, 30.6], [121.7, 30.1],
      [122.0, 29.8], [121.6, 28.9], [121.3, 28.2], [120.7, 27.6], [120.3, 27.0], [119.8, 26.5], [119.6, 25.9], [119.2, 25.4], [118.8, 24.9],
      [118.1, 24.5], [117.7, 24.1], [117.0, 23.6], [116.5, 23.2], [115.5, 22.8], [114.5, 22.4], [113.5, 22.2], [111, 21.5], [108, 21.5]],
    kyushu: [[129.8, 33.4], [130.4, 33.9], [131.0, 33.9], [131.6, 33.4], [131.9, 32.8], [131.5, 31.6], [131.1, 31.3], [130.6, 31.1], [130.2, 31.4], [130.1, 32.2], [129.8, 32.8]],
    honshu: [[130.9, 34.0], [131.5, 34.6], [132.5, 35.4], [133.5, 35.6], [135, 35.7], [136.5, 36.8], [140, 38], [140, 34], [135, 33.5], [133.5, 33.5], [132.2, 33.9], [131.0, 33.95]],
    jeju: (() => { const p = []; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; p.push([126.55 + Math.cos(a) * 0.32, 33.38 + Math.sin(a) * 0.17]); } return p; })(),
    nest: (() => { const p = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; p.push([125.95 + Math.cos(a) * 0.12, 37.55 + Math.sin(a) * 0.08]); } return p; })(),
  };
  if (G) { COAST.taiwan = G.LAND.taiwan; COAST.okinawa = G.LAND.okinawa; COAST.penghu = G.LAND.penghu; }
  const PLACES = {
    nest: { name: "Nesting island, Korea", at: [125.95, 37.55] },
    jiangsu: { name: "Jiangsu mudflats", at: [120.75, 33.2] },
    shanghai: { name: "Shanghai wetlands", at: [121.95, 31.15] },
    zhejiang: { name: "Zhejiang coast", at: [121.5, 28.7] },
    fujian: { name: "Fujian river mouth", at: [119.75, 26.0] },
    tainan: { name: "Tainan, Taiwan", at: [120.05, 23.1] },
    jeju: { name: "Jeju Island", at: [126.55, 33.38] },
  };
  /** project [lon, lat] into px for a map scale k (px per degree of latitude) */
  const proj = k => ([lon, lat]) => [(lon - MAP.w) * MAP.kx * k, (MAP.n - lat) * k];

  /* ---------------- feed missions: a side view, 1280 x 720 */
  const FEED_W = 1280, LEG = 92;            // the deepest water Bomi can wade (px)
  const FOOD = { fish: 2, shrimp: 1 };
  /* bottom: [x, y] points of the pond floor; wl: water line y (bigger = lower water)
     drain: [start time, how much the water drops]; tide: [start time, how much it rises over the mission]
     dark: fish show only as ripples unless the bill is near */
  const LEVELS = [
    { k: "sweep", kind: "feed", name: "Sweep and Snap", bg: "bg_dusk", T: 70, goal: 16, wl: 440, max: 5,
      bottom: [[0, 420], [180, 450], [420, 515], [700, 528], [980, 500], [1280, 455]],
      intro: "Hold your finger on the water, and Bomi walks there, sweeping its spoon bill side to side. When the bill touches a fish, snap! Walk slowly: fast steps scare the fish." },
    { k: "south", kind: "fly", name: "First Flight South", season: "autumn",
      start: "nest", stops: ["jiangsu", "fujian"], goal: "tainan", wind: 42, energy: 5, clouds: [],
      intro: "Autumn is here, and it's getting cold in Korea. Fly south to Taiwan! The northeast wind gives you a push. Land in the glowing wetlands to rest and eat." },
    { k: "pond", kind: "feed", name: "Fish Pond Night", bg: "bg_night", T: 80, goal: 22, wl: 400, max: 5, dark: true, drain: [22, 70],
      bottom: [[0, 425], [150, 455], [380, 540], [640, 560], [900, 530], [1120, 470], [1280, 440]],
      intro: "It's night, and the water is dark. Spoonbills find fish by touch, not by sight: follow the little ripples! Soon A-gong will drain his pond, and the water will get shallow." },
    { k: "monsoon", kind: "fly", name: "Ride the Monsoon", season: "autumn",
      start: "nest", stops: ["jiangsu", "shanghai", "fujian"], goal: "tainan", wind: 62, energy: 5, clouds: [[123.5, 35.4], [121.2, 30.0], [120.4, 25.1]],
      intro: "A strong northeast monsoon wind is blowing! Fly with it, rest at the stopovers, and fly around the rain clouds. They're bumpy!" },
    { k: "tide", kind: "feed", name: "Tide Is Coming", bg: "bg_dusk", T: 75, goal: 22, wl: 500, max: 5, tide: [5, 110],
      bottom: [[0, 430], [260, 470], [520, 520], [800, 545], [1060, 560], [1280, 575]],
      intro: "On the mudflat, the tide is coming in! The water gets deeper and deeper. Feed fast, and move toward the shore when it gets too deep." },
    { k: "spring", kind: "fly", name: "Spring Trip Home", season: "spring",
      start: "tainan", stops: ["fujian", "zhejiang", "jiangsu"], goal: "nest", wind: 30, energy: 5, clouds: [[120.5, 27.4], [122.6, 34.6]],
      intro: "Spring! Bomi has grown yellow feathers, and it's time to fly home to Korea to build a nest. The wind is gentler now. Rest along the way!" },
    { k: "feast", kind: "feed", name: "Big Night Feast", bg: "bg_night", T: 90, goal: 24, wl: 390, max: 6, dark: true, drain: [30, 85],
      bottom: [[0, 430], [200, 470], [430, 560], [620, 590], [820, 560], [1050, 500], [1280, 450]],
      intro: "A big hungry night! The fish are hard to see, so sweep near the ripples. When A-gong drains the pond, the deep middle becomes a feast!" },
    { k: "long", kind: "fly", name: "The Long Way", season: "autumn",
      start: "nest", stops: ["shanghai", "fujian"], goal: "tainan", wind: 55, energy: 5.6, clouds: [[124.0, 36.0], [123.0, 33.4], [121.6, 29.2], [120.9, 27.2], [120.2, 24.6]],
      intro: "The longest trip: straight across the Yellow Sea with only two stopovers. Save your energy, ride the wind, and dodge the storms!" },
  ];
  const FREE = { k: "free", kind: "feed", free: true, name: "Free Feeding", bg: "bg_night", T: 0, goal: 0, wl: 410, max: 9, dark: true,
    bottom: [[0, 425], [200, 460], [460, 540], [700, 555], [960, 520], [1280, 450]],
    intro: "Eat as much as you like! Press DONE when Bomi is full." };

  /* ---------------- feed */
  function smoothPts(pts) {
    // y of the pond floor at x, smoothed between the control points
    return x => {
      if (x <= pts[0][0]) return pts[0][1];
      for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
        const a = pts[i - 1], b = pts[i], k = (x - a[0]) / (b[0] - a[0]), e = (1 - Math.cos(Math.PI * k)) / 2;
        return a[1] + (b[1] - a[1]) * e;
      }
      return pts[pts.length - 1][1];
    };
  }
  let seed = 9;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  function createFeed(L) {
    const s = { kind: "feed", L, t: 0, wl: L.wl, bottom: smoothPts(L.bottom), x: 300, face: 1, target: null, v: 0, phase: 0,
      food: 0, fish: [], caught: 0, scared: 0, done: false, result: null, events: [], drained: false, deep: 0 };
    // start where the water is wadeable
    for (let x = 200; x < 1100; x += 10) if (canWade(s, x)) { s.x = x; break; }
    for (let i = 0; i < Math.ceil(L.max * 0.6); i++) spawnFish(s);
    return s;
  }
  const depthAt = (s, x) => s.bottom(x) - s.wl;
  const canWade = (s, x) => depthAt(s, x) <= LEG;
  function spawnFish(s, near) {
    for (let tries = 0; tries < 40; tries++) {
      const x = near ? clamp(near + (rnd() - 0.5) * 300, 40, FEED_W - 40) : 40 + rnd() * (FEED_W - 80);
      const d = depthAt(s, x);
      if (d < 26) continue;
      const kind = rnd() < 0.3 ? "shrimp" : "fish";
      s.fish.push({ x, y: s.wl + 12 + rnd() * (d - 24), vx: (rnd() < 0.5 ? -1 : 1) * (24 + rnd() * 26), kind, t: rnd() * 10, flee: 0 });
      return;
    }
  }
  /** where the bill tip is right now */
  function billTip(s) {
    const reach = 92 + 34 * Math.sin(s.phase);           // sweeping side to side, in front of Bomi
    const x = s.x + s.face * reach, floor = s.bottom(x);
    return { x, y: Math.min(floor - 6, Math.max(s.wl + 10, floor - 10)), wet: floor - s.wl > 8 };
  }
  function stepFeed(s, dt, inp) {
    s.events = []; s.t += dt;
    if (s.done) return;
    const L = s.L;
    // the water level: a fish farmer drains the pond, or the tide comes in
    if (L.drain && s.t >= L.drain[0] && !s.drained) { s.drained = true; s.events.push({ type: "drain" }); for (let i = 0; i < 6; i++) spawnFish(s, 640); }
    let wl = L.wl;
    if (L.drain && s.t >= L.drain[0]) wl += L.drain[1] * clamp((s.t - L.drain[0]) / 8, 0, 1);
    if (L.tide && s.t >= L.tide[0]) wl -= L.tide[1] * clamp((s.t - L.tide[0]) / (L.T - L.tide[0]), 0, 1);
    s.wl = wl;
    // walking: toward the finger, but never into water that is too deep
    let want = inp.x != null ? inp.x : null;
    if (inp.left) want = s.x - 200; if (inp.right) want = s.x + 200;
    s.v = 0;
    if (want != null && Math.abs(want - s.x) > 6) {
      const dir = Math.sign(want - s.x), speed = Math.min(150, 40 + Math.abs(want - s.x) * 0.6);
      const nx = s.x + dir * speed * dt;
      s.face = dir;
      if (canWade(s, nx) && nx > 30 && nx < FEED_W - 30) { s.x = nx; s.v = speed; }
      else if (!s.deep || s.t - s.deep > 2.5) { s.deep = s.t; s.events.push({ type: "tooDeep" }); }
    }
    // the bill sweeps faster when standing still
    s.phase += dt * (s.v > 0 ? 6 : 9);
    const tip = billTip(s);
    // fish swim, turn at the shallows, and flee from fast steps
    for (let i = s.fish.length - 1; i >= 0; i--) {
      const f = s.fish[i];
      f.t += dt;
      const d = depthAt(s, f.x);
      if (d < 18) { s.fish.splice(i, 1); continue; }      // the water dried up here: the fish slips away
      const near = Math.abs(f.x - s.x) < 170;
      if (near && s.v > 95 && f.flee <= 0) { f.flee = 2.5; f.vx = Math.sign(f.x - s.x || 1) * 150; s.scared++; s.events.push({ type: "scared" }); }
      f.flee -= dt;
      if (f.flee <= 0 && Math.abs(f.vx) > 60) f.vx *= Math.pow(0.3, dt);
      const nx = f.x + f.vx * dt;
      if (nx < 30 || nx > FEED_W - 30 || depthAt(s, nx) < 26) f.vx = -f.vx; else f.x = nx;
      f.y = clamp(f.y + Math.sin(f.t * 1.7) * 10 * dt, s.wl + 10, s.bottom(f.x) - 8);
      if (tip.wet && f.flee <= 0 && Math.hypot(f.x - tip.x, f.y - tip.y) < 30) {   // a frightened fish darts away too fast to catch
        s.fish.splice(i, 1); s.food += FOOD[f.kind]; s.caught++;
        s.events.push({ type: "catch", kind: f.kind, x: tip.x, y: tip.y });
      }
    }
    // new fish swim in slowly
    s.spawnT = (s.spawnT || 0) - dt;
    if (s.fish.length < L.max && s.spawnT <= 0) { spawnFish(s); s.spawnT = 2.2; }
    // the end: full tummy, or sunrise
    if (!L.free && (s.food >= L.goal || s.t >= L.T)) finishFeed(s);
    if (L.free && inp.quit) finishFeed(s);
  }
  function finishFeed(s) {
    s.done = true;
    const L = s.L, full = s.food >= L.goal;
    const stars = L.free ? 0 : full ? (L.T - s.t >= L.T * 0.25 ? 3 : 2) : 1;
    s.result = { stars, food: s.food, goal: L.goal, caught: s.caught, scared: s.scared, time: Math.round(s.t), full };
    s.events.push({ type: "done" });
  }

  /* ---------------- fly */
  const FLY_K = 260;                         // px per degree of latitude on the fly map
  const P = proj(FLY_K);
  const AIR = 130, REST = 2.4, RING = 80, CLOUD = 90;
  function wind(s, x, y) {
    // autumn: the northeast monsoon blows toward the southwest, stronger over the Taiwan Strait; spring: a gentle push north
    const L = s.L;
    if (L.season === "spring") return { x: 0.45 * L.wind, y: -0.9 * L.wind };
    const strait = Math.exp(-Math.pow((y - P([120, 24.5])[1]) / 600, 2)) * 0.5;
    const gust = 0.85 + 0.15 * Math.sin(s.t * 0.7 + x * 0.002);
    return { x: -0.55 * L.wind * (1 + strait) * gust, y: 0.84 * L.wind * (1 + strait) * gust };
  }
  function createFly(L) {
    const at = k => { const p = P(PLACES[k].at); return { k, name: PLACES[k].name, x: p[0], y: p[1] }; };
    const st = at(L.start);
    const s = { kind: "fly", L, t: 0, x: st.x, y: st.y, a: Math.atan2(1, -0.4), vx: 0, vy: 0, energy: 100, rest: 0, tired: false,
      stops: L.stops.map(k => Object.assign(at(k), { done: false })), goal: at(L.goal), start: st,
      clouds: L.clouds.map(c => { const p = P(c); return { x: p[0], y: p[1], x0: p[0], y0: p[1], r: CLOUD }; }),
      bumps: 0, bumpCD: 0, push: { x: 0, y: 0 }, tiredN: 0, done: false, result: null, events: [] };
    if (L.season === "spring") s.a = Math.atan2(-1, 0.4);
    return s;
  }
  function stepFly(s, dt, inp) {
    s.events = []; s.t += dt;
    if (s.done) return;
    for (const [i, c] of s.clouds.entries()) { c.x = c.x0 + Math.sin(s.t * 0.3 + i) * 120; c.y = c.y0 + Math.cos(s.t * 0.25 + i * 2) * 60; }
    if (s.rest > 0) {                                          // resting and eating at a stopover
      s.rest -= dt; s.energy = Math.min(100, s.energy + 45 * dt);
      if (s.rest <= 0) { s.energy = 100; s.events.push({ type: "rested" }); }
      return;
    }
    // steering: toward the finger; a tired bird glides to the nearest wetland
    let want = inp.aim || null;
    if (s.tired) { const n = nearestStop(s); want = { x: n.x, y: n.y }; }
    if (want) {
      const da = Math.atan2(want.y - s.y, want.x - s.x) - s.a;
      s.a += clamp(Math.atan2(Math.sin(da), Math.cos(da)), -2.6 * dt, 2.6 * dt);
    } else if (inp.turn) s.a += inp.turn * 2.6 * dt;
    const w = wind(s, s.x, s.y), air = s.tired ? 70 : AIR;
    s.vx = Math.cos(s.a) * air + w.x + s.push.x; s.vy = Math.sin(s.a) * air + w.y + s.push.y;
    s.x += s.vx * dt; s.y += s.vy * dt; s.wind = w;
    s.push.x *= Math.pow(0.05, dt); s.push.y *= Math.pow(0.05, dt);
    s.energy = Math.max(0, s.energy - s.L.energy * dt);
    if (s.energy <= 0 && !s.tired) { s.tired = true; s.tiredN++; s.events.push({ type: "tired" }); }
    s.bumpCD = Math.max(0, s.bumpCD - dt);
    for (const c of s.clouds) {
      const d = Math.hypot(s.x - c.x, s.y - c.y);
      if (d < c.r + 30) {
        s.push.x = (s.x - c.x) / d * 220; s.push.y = (s.y - c.y) / d * 220;
        if (s.bumpCD <= 0) { s.bumps++; s.bumpCD = 1.6; s.energy = Math.max(0, s.energy - 12); s.events.push({ type: "bump" }); }
      }
    }
    // a wetland: rest and eat the first time you land there (or any time you're tired)
    for (const st of s.stops) if (Math.hypot(s.x - st.x, s.y - st.y) < RING && (!st.done || s.tired)) {
      if (!st.done) { st.done = true; s.events.push({ type: "stop", name: st.name }); }
      s.rest = REST; s.tired = false; s.x = st.x; s.y = st.y; s.events.push({ type: "rest", name: st.name });
    }
    if (Math.hypot(s.x - s.goal.x, s.y - s.goal.y) < RING) finishFly(s);
  }
  function nearestStop(s) {
    let best = s.goal, bd = Math.hypot(s.goal.x - s.x, s.goal.y - s.y);
    for (const st of s.stops) { const d = Math.hypot(st.x - s.x, st.y - s.y); if (d < bd) { bd = d; best = st; } }
    return best;
  }
  function finishFly(s) {
    s.done = true;
    const stars = s.tiredN === 0 && s.bumps === 0 ? 3 : s.tiredN === 0 && s.bumps <= 2 ? 2 : 1;
    s.result = { stars, bumps: s.bumps, tired: s.tiredN, stops: s.stops.filter(x => x.done).length, time: Math.round(s.t) };
    s.events.push({ type: "done" });
  }

  function create(L) { seed = 9; return L.kind === "feed" ? createFeed(L) : createFly(L); }
  function step(s, dt, inp) { return s.kind === "feed" ? stepFeed(s, dt, inp || {}) : stepFly(s, dt, inp || {}); }

  /* ---------------- test bot */
  function bot(s, dt, mem) {
    if (s.kind === "feed") {
      // walk calmly toward the nearest reachable fish, then stand and sweep
      let best = null, bd = 1e9;
      for (const f of s.fish) {
        const stand = f.x - Math.sign(f.x - s.x || 1) * 92;
        if (!canWade(s, stand)) continue;
        const d = Math.abs(stand - s.x);
        if (d < bd) { bd = d; best = stand; }
      }
      if (best == null) return {};
      const step = mem.hasty ? 400 : 85;                      // a hasty kid holds the finger far away
      return { x: s.x + clamp(best - s.x, -step, step) };
    }
    // fly: next stopover if energy is not enough to reach the goal, else the goal; slide around clouds
    const distTo = p => Math.hypot(p.x - s.x, p.y - s.y);
    const gs = AIR + 20, need = distTo(s.goal) / gs * s.L.energy;
    let target = s.goal;
    if (need > s.energy * 0.85) {
      let best = null, bd = 1e9;
      for (const st of s.stops) {
        if (st.done) continue;
        const toGoal = Math.hypot(s.goal.x - st.x, s.goal.y - st.y);
        if (toGoal >= distTo(s.goal)) continue;                // only stopovers that bring us closer
        if (distTo(st) / gs * s.L.energy > s.energy * 0.95 && distTo(st) > RING) continue;
        const cost = distTo(st) + toGoal * 0.6;
        if (cost < bd) { bd = cost; best = st; }
      }
      if (best) target = best;
    }
    let aim = { x: target.x, y: target.y };
    for (const c of s.clouds) {
      const ax = aim.x - s.x, ay = aim.y - s.y, al = Math.hypot(ax, ay) || 1;
      const t = ((c.x - s.x) * ax + (c.y - s.y) * ay) / al;
      if (t > 0 && t < 420) {
        const px = s.x + ax / al * t, py = s.y + ay / al * t;
        if (Math.hypot(c.x - px, c.y - py) < c.r + 70) {
          const side = ((c.x - s.x) * ay - (c.y - s.y) * ax) > 0 ? 1 : -1;
          aim = { x: px + (-ay / al) * side * 240, y: py + (ax / al) * side * 240 };
        }
      }
    }
    return { aim };
  }

  root.SpoonbillSim = { MAP, COAST, PLACES, proj, LEVELS, FREE, FEED_W, LEG, FOOD, FLY_K, P, AIR, RING, CLOUD, D2R, clamp,
    create, step, bot, billTip, depthAt, canWade, wind };
  if (typeof module !== "undefined") module.exports = root.SpoonbillSim;
})();
