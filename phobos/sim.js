/* Moon Scoop! — rules, missions and the test bot, with no drawing (runs in Node too).
   Land missions: a side view of Phobos. Gravity is tiny, so a little push of the thrusters goes a long way and a
     hard touchdown bounces you high (slowly). Land softly on the glowing spot, hold SCOOP, then take off.
   Rover missions: Idefix drives over bumpy ground. Over a bump, going fast throws it into a long, floaty hop
     (on Phobos almost nothing pulls you back down). Stop next to a sparkly rock and hold SCAN.
   Home mission: the capsule falls through Earth's air toward the Australian desert. Open the parachute below the
     line, then steer to the landing zone.
   Screen y points down. Units are px and seconds. */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : global;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  /* ---------------- ground: a list of [x, y] points, plus round boulders sitting on it */
  function makeGround(pts) {
    return x => {
      if (x <= pts[0][0]) return pts[0][1];
      for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
        const a = pts[i - 1], b = pts[i], k = (x - a[0]) / (b[0] - a[0]), e = (1 - Math.cos(Math.PI * k)) / 2;
        return a[1] + (b[1] - a[1]) * e;
      }
      return pts[pts.length - 1][1];
    };
  }
  const slopeAt = (g, x) => (g(x + 6) - g(x - 6)) / 12;

  /* ---------------- missions */
  const PHOBOS_G = 7, EARTH_G = 70;
  const LEVELS = [
    { k: "first", kind: "land", name: "First Touchdown", W: 1900, fuel: 100,
      ground: [[0, 600], [400, 620], [700, 590], [900, 605], [1300, 605], [1500, 580], [1900, 610]], pads: [[1000, 1200]], boulders: [],
      intro: "Phobos's gravity is super weak. Hold UP to push gently, and use ◀ ▶ to move. Land softly on the glowing spot, then hold SCOOP to collect moon soil!" },
    { k: "drop", kind: "rover", name: "Hello, Idefix!", W: 1800, T: 100,
      ground: [[0, 600], [300, 590], [600, 610], [900, 585], [1200, 605], [1500, 590], [1800, 600]], spots: [700, 1400],
      intro: "Idefix is on Phobos! Hold GO to drive. Stop right next to the sparkly rocks and hold SCAN. Drive slowly: over a bump, a fast rover floats away!" },
    { k: "boulders", kind: "land", name: "Boulder Field", W: 2100, fuel: 110,
      ground: [[0, 610], [300, 590], [600, 620], [900, 600], [1300, 600], [1500, 620], [1800, 590], [2100, 610]], pads: [[1340, 1490]],
      boulders: [[620, 40], [850, 34], [1180, 46], [1600, 38], [1700, 30]],
      intro: "Big boulders everywhere! Land on the flat glowing spot between them. If you touch a boulder or land too fast, you'll bounce. Slowly, slowly..." },
    { k: "steady", kind: "rover", name: "Slow and Steady", W: 2100, T: 110,
      ground: [[0, 600], [250, 570], [450, 615], [650, 565], [850, 610], [1100, 560], [1350, 615], [1600, 575], [1850, 605], [2100, 590]], spots: [560, 1200, 1900],
      intro: "This ground is bumpy! Fast driving makes Idefix hop and float for a long time. Go slowly over the bumps, and scan 3 rocks before the Sun sets." },
    { k: "crater", kind: "land", name: "Into the Crater", W: 2200, fuel: 110,
      ground: [[0, 520], [500, 520], [700, 460], [820, 560], [1000, 640], [1300, 640], [1480, 560], [1600, 450], [1800, 520], [2200, 520]], pads: [[1060, 1240]],
      boulders: [[760, 30], [1550, 36]],
      intro: "The landing spot is at the bottom of a crater! Fly over the crater wall, then drift down gently. Watch your sideways speed." },
    { k: "explore", kind: "rover", name: "Idefix Explores", W: 2400, T: 120,
      ground: [[0, 590], [300, 560], [500, 620], [700, 650], [900, 600], [1150, 560], [1350, 620], [1550, 570], [1800, 640], [2050, 580], [2400, 600]], spots: [500, 1000, 1600, 2200],
      intro: "Scan 4 rocks, some down in little dips. Remember: slow over the bumps, and stop right next to each rock." },
    { k: "twice", kind: "land", name: "Two Scoops", W: 2600, fuel: 150,
      ground: [[0, 600], [400, 580], [700, 615], [1000, 600], [1300, 590], [1600, 620], [1900, 600], [2200, 585], [2600, 605]], pads: [[620, 780], [1900, 2050]],
      boulders: [[480, 34], [1150, 40], [1450, 36], [2300, 40]],
      intro: "Collect soil from two places! Land, scoop, then take off gently and hop to the second glowing spot. Save some fuel." },
    { k: "home", kind: "home", name: "Home to Australia",
      intro: "The capsule is coming home through Earth's air! It gets hot and glowy. Open the parachute once you're below the yellow line, then steer into the landing zone." },
  ];
  const FREE = { k: "free", kind: "land", free: true, name: "Free Landing", W: 2600, fuel: 0,
    ground: [[0, 600], [400, 580], [700, 615], [1000, 600], [1300, 590], [1600, 620], [1900, 600], [2200, 585], [2600, 605]], pads: [], boulders: [[480, 34], [1150, 40], [1450, 36], [2300, 40]],
    intro: "Land and scoop as many times as you like! A new glowing spot appears after each scoop. Press DONE when you're finished." };

  /* ---------------- land */
  const LANDER = { up: 20, side: 14, halfW: 46, halfH: 40, safeV: 30, safeX: 26 };
  function createLand(L) {
    const g = makeGround(L.ground);
    const s = { kind: "land", L, t: 0, g, x: 200, y: 160, vx: 0, vy: 0, fuel: L.fuel || 100, onGround: false, phase: "fly",
      pads: L.pads.map(([a, b]) => ({ a, b, done: false })), boulders: L.boulders.map(([x, r]) => ({ x, r, y: g(x) - r * 0.7 })),
      scoop: 0, samples: 0, bumps: 0, reserve: false, done: false, result: null, events: [], thrust: { up: false, side: 0 } };
    if (L.free) newPad(s);
    return s;
  }
  function newPad(s) {
    for (let t = 0; t < 30; t++) {
      const a = 150 + rnd() * (s.L.W - 400), b = a + 150;
      if (Math.abs(slopeAt(s.g, a + 75)) < 0.12 && s.boulders.every(o => o.x < a - 60 || o.x > b + 60)) { s.pads.push({ a, b, done: false }); return; }
    }
    s.pads.push({ a: 1000, b: 1150, done: false });
  }
  const padUnder = s => s.pads.find(p => !p.done && s.x > p.a + 10 && s.x < p.b - 10);
  function stepLand(s, dt, inp) {
    s.events = []; s.t += dt;
    if (s.done) return;
    const L = s.L;
    // thrusters (fuel is endless in free play); when the tank is empty you get one small reserve tank
    let up = !!inp.up, side = inp.left ? -1 : inp.right ? 1 : 0;
    if (L.fuel && s.fuel <= 0) { if (!s.reserve) { s.reserve = true; s.fuel = 25; s.events.push({ type: "reserve" }); } else { up = false; side = 0; } }
    s.thrust = { up, side };
    if (s.phase === "leave") {                 // all soil collected: Emmy lifts off by itself
      s.vy = Math.max(s.vy - 30 * dt, -60); s.y += s.vy * dt; s.thrust = { up: true, side: 0 };
      if (s.y < 120) finishLand(s);
      return;
    }
    if (s.phase === "scoop") {
      if (inp.scoop) { s.scoop = Math.min(1, s.scoop + dt / 3.5); if (s.scoop >= 1) { const p = padUnder(s) || s.lastPad; if (p) p.done = true; s.samples++; s.scoop = 0; s.phase = "fly"; s.events.push({ type: "sample", n: s.samples }); if (L.free) newPad(s); else if (s.pads.every(q => q.done)) { s.phase = "leave"; s.events.push({ type: "leave" }); } } }
      if (up && !inp.scoop) { s.phase = "fly"; s.onGround = false; }
      else return;
    }
    if (up) { s.vy -= LANDER.up * dt; if (L.fuel) s.fuel = Math.max(0, s.fuel - 4 * dt); }
    if (side) { s.vx += side * LANDER.side * dt; if (L.fuel) s.fuel = Math.max(0, s.fuel - 2 * dt); }
    s.vy += PHOBOS_G * dt;
    if (s.onGround) { s.vx *= Math.pow(0.05, dt); if (!up) { s.vy = 0; } }
    s.x = clamp(s.x + s.vx * dt, 60, L.W - 60); if (s.x === 60 || s.x === L.W - 60) s.vx = 0;
    s.y += s.vy * dt;
    if (s.y < 40) { s.y = 40; s.vy = Math.max(0, s.vy); }
    // touching the ground or a boulder
    let floor = s.g(s.x);
    for (const b of s.boulders) if (Math.abs(s.x - b.x) < b.r + LANDER.halfW * 0.6) floor = Math.min(floor, b.y - Math.sqrt(Math.max(0, (b.r) ** 2 - (s.x - b.x) ** 2)) * 0.9 + b.r * 0.2);
    const onBoulder = s.boulders.some(b => Math.abs(s.x - b.x) < b.r + LANDER.halfW * 0.6 && s.y + LANDER.halfH >= floor - 2);
    if (s.y + LANDER.halfH >= floor) {
      s.y = floor - LANDER.halfH;
      if (s.vy > 0) {
        const soft = s.vy <= LANDER.safeV && Math.abs(s.vx) <= LANDER.safeX && Math.abs(slopeAt(s.g, s.x)) < 0.25 && !onBoulder;
        if (soft) {
          if (!s.onGround) { s.onGround = true; s.events.push({ type: "touch", pad: !!padUnder(s) }); }
          s.vy = 0;
          const p = padUnder(s);
          if (p && !up) { s.phase = "scoop"; s.lastPad = p; s.vx = 0; }
        } else {
          s.vy = -s.vy * 0.55; s.vx = s.vx * 0.7 + (onBoulder ? Math.sign(s.x - (s.boulders.find(b => Math.abs(s.x - b.x) < b.r + 40) || { x: s.x - 1 }).x) * 25 : 0);
          s.bumps++; s.onGround = false; s.events.push({ type: "bounce", boulder: onBoulder });
        }
      }
    } else s.onGround = false;
    // resting on a glowing spot with the thrusters off: start scooping
    if (s.onGround && !up && s.phase === "fly") { const p = padUnder(s); if (p) { s.phase = "scoop"; s.lastPad = p; s.vx = 0; } }
    // the end: every pad scooped and back up high
    if (L.free && inp.quit) finishLand(s);
    // tank and reserve both empty, sitting on the ground away from a glowing spot: the mission can't go on
    if (L.fuel && s.reserve && s.fuel <= 0 && s.onGround && s.phase === "fly") { s.stuckT = (s.stuckT || 0) + dt; if (s.stuckT > 2.5) { finishLand(s); s.result.stars = 0; s.result.out = true; } }
  }
  function finishLand(s) {
    s.done = true;
    const stars = s.L.free ? 0 : s.bumps === 0 && !s.reserve ? 3 : s.bumps <= 1 && !s.reserve ? 2 : 1;
    s.result = { stars, samples: s.samples, bumps: s.bumps, fuel: Math.round(s.fuel), reserve: s.reserve, time: Math.round(s.t) };
    s.events.push({ type: "done" });
  }

  /* ---------------- rover */
  const ROVER = { acc: 30, max: 70, brake: 40, scanTime: 1.6, near: 46 };
  function createRover(L) {
    const g = makeGround(L.ground);
    const s = { kind: "rover", L, t: 0, g, x: 120, y: g(120), v: 0, vy: 0, air: false, spots: L.spots.map(x => ({ x, done: false })), scan: 0, scanning: null,
      hops: 0, hopT: 0, tumble: 0, done: false, result: null, events: [] };
    return s;
  }
  function stepRover(s, dt, inp) {
    s.events = []; s.t += dt;
    if (s.done) return;
    const L = s.L;
    if (s.tumble > 0) { s.tumble -= dt; inp = {}; }   // after a hop Idefix rights itself (that's what its arms are for)
    if (!s.air) {
      if (inp.go) s.v = Math.min(ROVER.max, s.v + ROVER.acc * dt);
      else if (inp.back) s.v = Math.max(-ROVER.max * 0.5, s.v - ROVER.acc * dt);
      else s.v = s.v > 0 ? Math.max(0, s.v - ROVER.brake * dt) : Math.min(0, s.v + ROVER.brake * dt);
    }
    const nx = clamp(s.x + s.v * dt, 40, L.W - 40);
    if (s.air) {
      s.vy += PHOBOS_G * dt; s.x = nx; s.y += s.vy * dt; s.hopT += dt;
      const gy = s.g(s.x);
      if (s.y >= gy) { s.y = gy; if (s.vy > 25) { s.vy = -s.vy * 0.4; } else { s.air = false; s.vy = 0; s.v = 0; s.tumble = 1.5; s.events.push({ type: "land", t: s.hopT }); } }
    } else {
      // following the ground: if the ground drops away faster than Phobos's gravity can pull Idefix down, it takes off
      const vyGround = (s.g(nx) - s.g(s.x)) / dt;
      if (vyGround - s.vy > PHOBOS_G * dt * 3 && s.v > 18) { s.air = true; s.hopT = 0; s.hops++; s.events.push({ type: "hop" }); s.x = nx; }
      else { s.vy = vyGround; s.x = nx; s.y = s.g(nx); }
    }
    if (nx === 40 || nx === L.W - 40) s.v = 0;
    // scanning rocks: stopped right next to one
    const spot = s.spots.find(p => !p.done && Math.abs(p.x - s.x) < ROVER.near);
    s.near = spot || null;
    if (inp.scan && spot && Math.abs(s.v) < 8 && !s.air) {
      s.scan += dt; s.scanning = spot;
      if (s.scan >= ROVER.scanTime) { spot.done = true; s.scan = 0; s.events.push({ type: "scanned", n: s.spots.filter(p => p.done).length }); }
    } else { if (inp.scan && spot && Math.abs(s.v) >= 8) s.events.push({ type: "stopFirst" }); s.scan = 0; s.scanning = null; }
    if (s.spots.every(p => p.done) || s.t >= L.T) finishRover(s);
  }
  function finishRover(s) {
    s.done = true;
    const n = s.spots.filter(p => p.done).length, all = n === s.spots.length;
    const stars = !all ? (n ? 1 : 0) : s.hops === 0 ? 3 : s.hops <= 2 ? 2 : 1;
    s.result = { stars: Math.max(stars, 1), scanned: n, total: s.spots.length, hops: s.hops, time: Math.round(s.t), all };
    s.events.push({ type: "done" });
  }

  /* ---------------- home: the capsule (Earth's gravity and air) */
  const HOME = { top: 0, ground: 2400, line: 1500, zone: [520, 760], W: 1280 };
  function createHome(L) {
    return { kind: "home", L, t: 0, x: 260, y: 40, vx: 70, vy: 120, chute: false, early: 0, auto: false, wind: 0, done: false, result: null, events: [] };
  }
  function stepHome(s, dt, inp) {
    s.events = []; s.t += dt;
    if (s.done) return;
    s.wind = 25 * Math.sin(s.t * 0.4);
    if (inp.chute && !s.chute) {
      if (s.y >= HOME.line) { s.chute = true; s.events.push({ type: "chute" }); }
      else if (s.t - (s.earlyT || -9) > 1.5) { s.early++; s.earlyT = s.t; s.events.push({ type: "tooEarly" }); }
    }
    if (!s.chute && s.y > HOME.ground - 260) { s.chute = true; s.auto = true; s.events.push({ type: "autoChute" }); }
    // air drag: fast without a parachute, slow and steerable with one
    const term = s.chute ? 38 : 420;
    s.vy += EARTH_G * dt; s.vy += (term - s.vy) * (s.chute ? 2.5 : 0.25) * dt * (s.vy > term ? 1 : 0);
    if (s.chute) { s.vx += ((inp.left ? -1 : inp.right ? 1 : 0) * 70 - (s.vx - s.wind)) * 1.5 * dt; }
    else s.vx += (s.wind - s.vx) * 0.2 * dt;
    s.x = clamp(s.x + s.vx * dt, 40, HOME.W - 40); s.y += s.vy * dt;
    s.hot = !s.chute && s.vy > 300;
    if (s.y >= HOME.ground) {
      s.y = HOME.ground; s.done = true;
      const inZone = s.x >= HOME.zone[0] && s.x <= HOME.zone[1], mid = (HOME.zone[0] + HOME.zone[1]) / 2;
      const stars = !inZone ? 1 : s.auto ? 1 : Math.abs(s.x - mid) < 60 && s.early === 0 ? 3 : 2;
      s.result = { stars, inZone, auto: s.auto, early: s.early, off: Math.round(Math.abs(s.x - mid)), time: Math.round(s.t) };
      s.events.push({ type: "done" });
    }
  }

  function create(L) { seed = 5; return L.kind === "land" ? createLand(L) : L.kind === "rover" ? createRover(L) : createHome(L); }
  function step(s, dt, inp) { inp = inp || {}; return s.kind === "land" ? stepLand(s, dt, inp) : s.kind === "rover" ? stepRover(s, dt, inp) : stepHome(s, dt, inp); }

  /* ---------------- test bot: plays like a careful kid */
  function bot(s, dt, mem) {
    if (s.kind === "land") {
      if (s.phase === "scoop") return { scoop: true };
      const pad = s.pads.find(p => !p.done);
      if (!pad) return { up: s.y > 140 };
      const tx = (pad.a + pad.b) / 2, dx = tx - s.x, inp = {};
      // horizontal: aim for a small speed toward the pad center
      const wantVx = clamp(dx * 0.25, -45, 45) * (mem.rough ? 1.6 : 1);
      if (s.vx < wantVx - 4) inp.right = true; else if (s.vx > wantVx + 4) inp.left = true;
      // vertical: stay high while far away (clear the boulders), sink slowly when above the pad
      const floor = s.g(s.x), height = floor - (s.y + LANDER.halfH);
      const cruise = Math.abs(dx) > 60 ? 170 : 0;
      const wantVy = !cruise && height > 2 ? mem.rough ? 40 : Math.min(22, Math.max(10, height * 0.25)) : height > cruise + 20 ? Math.min(mem.rough ? 45 : 22, Math.max(10, (height - cruise) * 0.25)) : height < cruise - 20 ? -18 : 0;
      if (s.vy > wantVy + 2) inp.up = true;
      if (s.onGround && Math.abs(dx) > 40) inp.up = true;             // landed off the spot: hop again
      return inp;
    }
    if (s.kind === "rover") {
      const spot = s.spots.find(p => !p.done);
      if (!spot) return {};
      const dx = spot.x - s.x;
      if (Math.abs(dx) < 30) return Math.abs(s.v) < 8 ? { scan: true } : {};
      // slow over bumps: cap the speed by how curvy the ground ahead is
      const ahead = Math.abs(slopeAt(s.g, s.x + 30) - slopeAt(s.g, s.x)) * 900;
      const cap = mem.rough ? 70 : 40;
      if (dx > 0) return s.v < cap ? { go: true } : {};
      return s.v > -20 ? { back: true } : {};
    }
    // home: wait for the line, open the parachute, steer to the middle of the zone
    const inp = {};
    if (!s.chute && s.y >= HOME.line + (mem.rough ? 300 : 20)) inp.chute = true;
    if (s.chute) { const mid = (HOME.zone[0] + HOME.zone[1]) / 2; if (s.x < mid - 15) inp.right = true; else if (s.x > mid + 15) inp.left = true; }
    return inp;
  }

  root.PhobosSim = { LEVELS, FREE, LANDER, ROVER, HOME, PHOBOS_G, EARTH_G, clamp, makeGround, slopeAt, create, step, bot };
  if (typeof module !== "undefined") module.exports = root.PhobosSim;
})();
