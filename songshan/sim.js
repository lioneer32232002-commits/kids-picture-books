/* Sky Rescue! — world, aircraft, missions and the autopilot bot, with no drawing (runs in Node too).
   The world is the shared map of Taiwan's seas (currents/geo.js) projected to pixels, about 13.5 px per km.
   Islands are a little bigger than real so their runways fit; airports and runways are drawn bigger too.
   Heading is a compass heading in degrees: 0 = north (up), 90 = east (right). */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : global;
  const G = root.TaiwanGeo;
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const wrap = a => ((a % 360) + 540) % 360 - 180;          // -180..180
  const KX = Math.cos(23.5 * D2R);
  const PX_PER_DEG = 1500;                                  // px per degree of latitude
  const P = G.projector((G.BOX.e - G.BOX.w) * KX * PX_PER_DEG);
  const PX_PER_KM = PX_PER_DEG / 111.2;
  const at = (lon, lat) => { const p = P([lon, lat]); return { x: p[0], y: p[1] }; };

  // game land: the shared coastlines, with the small islands made a bit larger
  const ring = (lon, lat, rx, ry, n, seed) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, wob = 1 + 0.14 * Math.sin(a * 3 + seed) + 0.07 * Math.sin(a * 5 + seed * 2);
      pts.push([lon + Math.cos(a) * rx * wob, lat + Math.sin(a) * ry * wob]);
    }
    return pts;
  };
  const LAND = Object.assign({}, G.LAND, {
    kinmen: ring(118.37, 24.44, 0.14, 0.075, 14, 1),
    matsu: ring(119.955, 26.16, 0.085, 0.07, 12, 2),
    penghu: ring(119.6, 23.56, 0.15, 0.17, 14, 3),
    green: ring(121.48, 22.665, 0.05, 0.045, 10, 4),
    lanyu: ring(121.545, 22.04, 0.07, 0.055, 12, 5),
  });
  const LAND_PX = {};
  for (const k in LAND) LAND_PX[k] = G.smooth(LAND[k].map(P), true, 5).map(p => ({ x: p[0], y: p[1] }));

  /* ---------------- airports: runway heading = the lower runway number's direction (true), length in px */
  const AIRPORTS = {
    tsa: { name: "Songshan", city: "Taipei", lon: 121.5525, lat: 25.0697, rwy: 96, len: 240, nums: ["10", "28"], hospital: true },
    kinmen: { name: "Kinmen", lon: 118.3594, lat: 24.4279, rwy: 53, len: 200, nums: ["06", "24"] },
    matsu: { name: "Matsu", lon: 119.9583, lat: 26.1598, rwy: 28, len: 170, nums: ["03", "21"] },
    penghu: { name: "Penghu", lon: 119.6283, lat: 23.5687, rwy: 18, len: 210, nums: ["02", "20"] },
    hualien: { name: "Hualien", lon: 121.6178, lat: 24.0231, rwy: 26, len: 210, nums: ["03", "21"] },
    taitung: { name: "Taitung", lon: 121.1018, lat: 22.755, rwy: 38, len: 200, nums: ["04", "22"] },
    green: { name: "Green Island", lon: 121.4664, lat: 22.6739, rwy: null, pad: [0, 0] },
    lanyu: { name: "Orchid Island", lon: 121.535, lat: 22.027, rwy: null, pad: [0, 0] },
  };
  for (const k in AIRPORTS) {
    const a = AIRPORTS[k]; a.k = k;
    const p = at(a.lon, a.lat); a.x = p.x; a.y = p.y;
    if (a.rwy != null) {
      // every runway airport also has a helipad beside the runway
      const r = a.rwy * D2R; a.pad = [Math.cos(r) * 62, Math.sin(r) * 62];
    }
    a.px = a.x + a.pad[0]; a.py = a.y + a.pad[1];
  }
  const dirOf = h => ({ x: Math.sin(h * D2R), y: -Math.cos(h * D2R) });
  /** landing heading into the wind at a runway airport (wind FROM wfrom) */
  function landHeading(a, wfrom) {
    if (a.rwy == null) return null;
    return Math.abs(wrap(wfrom - a.rwy)) <= 90 ? a.rwy : (a.rwy + 180) % 360;
  }
  /** the touchdown end (threshold) for a landing heading */
  function threshold(a, h) { const d = dirOf(h); return { x: a.x - d.x * a.len / 2, y: a.y - d.y * a.len / 2 }; }
  const runwayNumber = (a, h) => a.nums[Math.abs(wrap(h - a.rwy)) < 90 ? 0 : 1];

  /* ---------------- aircraft */
  const PLANES = {
    jet: { name: "Jetty", speeds: [70, 125, 170], kmh: [260, 750, 850], labels: ["SLOW", "CRUISE", "FAST"], turn: 62, accel: 38, gear: true, gearMax: 95 },
    heli: { name: "Whirly", speeds: [0, 45, 90], kmh: [0, 130, 250], labels: ["HOVER", "SLOW", "FAST"], turn: 120, accel: 34, gear: false },
  };

  const CARE = ["blanket", "oxygen", "water", "check"];
  const CARE_SAY = {
    blanket: "Brrr, I'm a little cold.", oxygen: "I need some oxygen, please.", water: "Could I have a sip of water?", check: "Can you check my heartbeat?",
  };

  /* ---------------- missions
     legs: fly to an airport and land. do: pickup | dropoff | deliver | visit | transfer (switch to the jet)
     wind: [from, px/s]. storms: [lon, lat, radius px, drift px/s east, north]. birds: [lon, lat]. */
  const LEVELS = [
    { k: "first", name: "First Flight", plane: "jet", start: "tsa", wind: [90, 6], night: false,
      who: "Dr. Wang", whoIcon: "👩‍⚕️",
      intro: "Dr. Wang needs a ride to the hospital in Penghu. Take off from Songshan and fly Jetty to Penghu!",
      legs: [{ to: "penghu", do: "deliver", say: "Thank you! I'll go help the patients in Penghu." }],
      storms: [], birds: [[120.3, 24.6]], care: null, par: 85 },
    { k: "medicine", name: "Medicine to Matsu", plane: "jet", start: "tsa", wind: [30, 8], night: false,
      who: "the medicine box", whoIcon: "🧊",
      intro: "The hospital in Matsu needs special medicine, kept cold in a cooler box. Fly it there fast and smooth!",
      legs: [{ to: "matsu", do: "deliver", say: "The medicine is here, still nice and cold. Great flying!" }],
      storms: [[120.9, 25.55, 170, 0, 0]], birds: [[121.2, 25.3], [120.2, 26.0]], care: null, par: 75 },
    { k: "grandma", name: "Grandma's Ride", plane: "jet", start: "tsa", wind: [80, 8], night: false,
      who: "Grandma Lin", whoIcon: "👵", patient: "grandma",
      intro: "Grandma Lin in Penghu has a very bad tummy ache and needs the big hospital in Taipei. Fly to Penghu, pick her up, and bring her to Songshan!",
      legs: [{ to: "penghu", do: "pickup", say: "Hello, dear. I'm so glad you came!" },
        { to: "tsa", do: "dropoff", say: "Thank you, little jet! The ambulance will take me to the hospital now." }],
      storms: [[120.6, 24.3, 160, 0, 0]], birds: [[119.9, 23.8], [121.3, 25.0]], care: [13, 17], par: 160 },
    { k: "whirly", name: "Whirly's First Rescue", plane: "heli", start: "taitung", wind: [60, 6], night: false,
      who: "Hao", whoIcon: "👦", patient: "boy",
      intro: "Hao fell off his bike on Green Island and hurt his arm. Fly Whirly to the helipad, pick him up, and bring him to Taitung!",
      legs: [{ to: "green", do: "pickup", say: "Ouch, my arm! But wow, a real helicopter!" },
        { to: "taitung", do: "dropoff", say: "Thank you, Whirly! My mom is waiting at the hospital." }],
      storms: [], birds: [[121.3, 22.72]], care: [9, 12], par: 55 },
    { k: "storm", name: "Storm over the Strait", plane: "jet", start: "kinmen", wind: [60, 9], night: false,
      who: "Mr. Chen", whoIcon: "👴", patient: "grandpa", startWithPatient: true,
      intro: "Mr. Chen in Kinmen needs a heart doctor in Taipei. He's already aboard! Big storms are over the Taiwan Strait. Fly around them and keep him cozy.",
      legs: [{ to: "tsa", do: "dropoff", say: "What a smooth ride, even with those storms. Thank you!" }],
      storms: [[119.3, 24.5, 210, 4, 0], [120.15, 24.95, 230, -3, 2], [119.6, 24.95, 170, 0, -3], [120.8, 25.05, 160, 3, 0]],
      birds: [[121.3, 25.1]], care: [11, 15], par: 90 },
    { k: "night", name: "Orchid Island at Night", plane: "heli", start: "taitung", wind: [40, 7], night: true,
      who: "Grandpa Si", whoIcon: "👴", patient: "grandpa",
      intro: "It's night, and Grandpa Si on Orchid Island feels very sick. Whirly can fly in the dark! Follow the GPS line to the glowing helipad.",
      legs: [{ to: "lanyu", do: "pickup", say: "You came all the way in the dark! Thank you." },
        { to: "taitung", do: "dropoff", say: "Thank you, Whirly. You're a star in the night sky!" }],
      storms: [[121.35, 22.4, 150, 0, 2]], birds: [], care: [9, 12], par: 85 },
    { k: "windy", name: "Windy Matsu", plane: "jet", start: "tsa", wind: [35, 20], night: false,
      who: "baby Mei", whoIcon: "👶", patient: "baby",
      intro: "The winter wind blows hard from the northeast! Baby Mei in Matsu needs a special children's hospital in Taipei. The wind pushes Jetty sideways, so steer a little into it.",
      legs: [{ to: "matsu", do: "pickup", say: "Mei's mom: Thank you for coming in this wind!" },
        { to: "tsa", do: "dropoff", say: "Mei's mom: We made it! Thank you, Jetty!" }],
      storms: [[120.55, 25.75, 180, -6, -4], [121.05, 25.4, 150, -5, -3]], birds: [[120.3, 26.05], [121.25, 25.2]], care: [9, 13], par: 140 },
    { k: "relay", name: "The Big Relay", plane: "heli", start: "taitung", wind: [70, 9], night: true,
      who: "Auntie Ana", whoIcon: "👩", patient: "auntie",
      intro: "Auntie Ana on Orchid Island needs the biggest hospital in Taipei. Whirly flies her to Taitung, then Jetty takes her all the way to Songshan. Teamwork!",
      legs: [{ to: "lanyu", do: "pickup", say: "Thank you for coming, Whirly!" },
        { to: "taitung", do: "transfer", say: "Now it's Jetty's turn. Off to Taipei!" },
        { to: "tsa", do: "dropoff", say: "Thank you, Whirly and Jetty! What a team!" }],
      storms: [[121.75, 23.6, 200, -3, 0], [121.45, 24.4, 180, 0, -3], [121.2, 22.4, 140, 0, 0]], birds: [[121.45, 24.9]], care: [9, 13], par: 160 },
  ];
  const FREE = { k: "free", name: "Free Flight", free: true, wind: [70, 6], night: false, legs: [], storms: [[120.2, 24.2, 180, 2, 0], [121.9, 23.3, 170, 0, 2]], birds: [[121.3, 25.15], [119.8, 23.9]], care: null };

  /* ---------------- the simulation */
  function create(level, opts) {
    opts = opts || {};
    const lv = level.free ? Object.assign({}, FREE, { plane: opts.plane || "jet", start: opts.start || (opts.plane === "heli" ? "taitung" : "tsa") }) : level;
    const s = {
      lv, t: 0, plane: lv.plane, leg: 0, events: [], done: false, result: null,
      x: 0, y: 0, h: 0, v: 0, alt: 0, lever: 1, gear: true, gearT: 0, gearMove: 0,
      phase: "ground", phaseT: 0, roll: 0,
      comfort: 100, patient: !!lv.startWithPatient, care: null, careNext: 6, careDone: 0, careMiss: 0,
      bumps: 0, birdsHit: 0, hint: null, canLand: false, stamps: {},
      storms: lv.storms.map(a => { const p = at(a[0], a[1]); return { x: p.x, y: p.y, r: a[2], vx: a[3] || 0, vy: -(a[4] || 0), x0: p.x, y0: p.y, hit: 0 }; }),
      birds: lv.birds.map(a => { const p = at(a[0], a[1]); return { hx: p.x, hy: p.y, x: p.x, y: p.y, a: Math.random() * 6.28, scatter: 0, gone: 0 }; }),
      wind: { from: lv.wind[0], spd: lv.wind[1] },
      bounds: (() => { const a = at(117.6, 26.75), b = at(122.7, 21.5); return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }; })(),
    };
    const w = dirOf(s.wind.from + 180); s.wind.vx = w.x * s.wind.spd; s.wind.vy = w.y * s.wind.spd;
    park(s, AIRPORTS[lv.start]);
    return s;
  }

  function park(s, a) {
    const pl = PLANES[s.plane];
    if (s.plane === "jet") {
      const h = landHeading(a, s.wind.from), th = threshold(a, h);
      s.x = th.x; s.y = th.y; s.h = h;
    } else { s.x = a.px; s.y = a.py; s.h = s.wind.from; }
    s.v = 0; s.alt = 0; s.gear = true; s.gearMove = 0; s.phase = "ground"; s.phaseT = 0; s.roll = 0; s.lever = pl.gear ? 1 : 1;
    s.at = a.k;
  }

  const dest = s => s.lv.free ? null : AIRPORTS[(s.lv.legs[s.leg] || {}).to];
  const ev = (s, type, data) => s.events.push(Object.assign({ type }, data || {}));

  /** input: { turn: -1..1 } or { aim: {x,y} }, lever: 0..2, gear: toggle, go: take off, land: helicopter land, care: name */
  function step(s, dt, inp) {
    inp = inp || {};
    s.events.length = 0;
    if (s.done) return s;
    s.t += dt; s.phaseT += dt;
    const pl = PLANES[s.plane];
    if (inp.lever != null) s.lever = clamp(inp.lever | 0, 0, 2);
    // gear lever: takes about 4 seconds to move, can't fold up on the ground
    if (pl.gear && inp.gear) {
      if (s.alt < 0.3 && s.gear) ev(s, "gearLocked");
      else if (!s.gearMove) { s.gearMove = s.gear ? -1 : 1; s.gearT = 0; ev(s, "gearMove", { down: s.gearMove > 0 }); }
    }
    if (s.gearMove) { s.gearT += dt; if (s.gearT >= 4) { s.gear = s.gearMove > 0; s.gearMove = 0; ev(s, s.gear ? "gearDown" : "gearUp"); } }

    // storms drift and swing back toward home, birds circle
    for (const st of s.storms) {
      st.x += st.vx * dt; st.y += st.vy * dt;
      if (Math.hypot(st.x - st.x0, st.y - st.y0) > 400) { st.vx = -st.vx; st.vy = -st.vy; }
    }
    for (const b of s.birds) {
      if (b.gone > 0) { b.gone -= dt; if (b.gone <= 0) { b.x = b.hx; b.y = b.hy; b.scatter = 0; } continue; }
      if (b.scatter > 0) { b.scatter -= dt; b.x += b.sx * dt; b.y += b.sy * dt; if (b.scatter <= 0) b.gone = 10; continue; }
      b.a += dt * 0.35; b.x = b.hx + Math.cos(b.a) * 120; b.y = b.hy + Math.sin(b.a * 1.3) * 70;
    }

    const air = s.phase === "air";
    switch (s.phase) {
      case "ground":
        s.v = 0;
        if (inp.go) {
          if (s.plane === "jet") { s.phase = "roll"; s.phaseT = 0; s.roll = 0; if (s.lever < 1) s.lever = 1; ev(s, "roll"); }
          else { s.phase = "lift"; s.phaseT = 0; ev(s, "lift"); }
        }
        break;
      case "roll": {              // jet take-off roll down the runway, into the wind
        s.v = Math.min(95, s.v + 44 * dt);
        const d = dirOf(s.h); s.x += d.x * s.v * dt; s.y += d.y * s.v * dt; s.roll += s.v * dt;
        if (s.roll > AIRPORTS[s.at].len * 0.55) { s.alt = Math.min(1, s.alt + dt / 2.6); if (s.alt > 0.05 && s.phase === "roll") { s.phase = "climb"; s.phaseT = 0; ev(s, "liftoff"); } }
        break;
      }
      case "lift":                // helicopter goes straight up
        s.alt = Math.min(1, s.alt + dt / 1.8);
        if (s.alt >= 0.6) { s.phase = "air"; s.phaseT = 0; s.at = null; ev(s, "airborne"); }
        break;
      case "climb":
        s.alt = Math.min(1, s.alt + dt / 2.6);
        fly(s, dt, inp, pl, s.alt > 0.35);
        if (s.alt >= 1) { s.phase = "air"; s.phaseT = 0; s.at = null; ev(s, "airborne"); }
        break;
      case "air":
        s.alt = Math.min(1, s.alt + dt / 2);
        fly(s, dt, inp, pl, true);
        if (s.plane === "jet") tryFinal(s); else tryPad(s, inp);
        break;
      case "final": final(s, dt); break;
      case "descend": {           // helicopter settles onto the helipad
        const a = AIRPORTS[s.target];
        s.x += (a.px - s.x) * Math.min(1, dt * 2.5); s.y += (a.py - s.y) * Math.min(1, dt * 2.5);
        s.v = Math.max(0, s.v - 60 * dt); s.alt = Math.max(0, s.alt - dt / 2);
        if (s.alt <= 0) arrive(s, a);
        break;
      }
      case "landed":
        if (s.phaseT > (s.lv.free ? 1.2 : 3.2)) nextLeg(s);
        break;
    }
    // weather and birds only matter in the air
    if (s.alt > 0.2 && s.phase !== "landed") hazards(s, dt);
    if (s.patient && s.alt > 0.3 && !s.lv.free && s.lv.care) careStep(s, dt, inp);
    else if (inp.care) ev(s, "careNoNeed");
    s.speedKmh = pl.kmh[0] + (s.v - pl.speeds[0]) / (pl.speeds[2] - pl.speeds[0]) * (pl.kmh[2] - pl.kmh[0]);
    if (s.plane === "jet" && s.phase !== "air" && s.phase !== "climb") s.speedKmh = s.v / 95 * 280;
    return s;
  }

  function fly(s, dt, inp, pl, steer) {
    // steering: turn toward an aim point, or by a turn rate
    let turn = 0;
    if (steer) {
      if (inp.aim) {
        const want = Math.atan2(inp.aim.x - s.x, -(inp.aim.y - s.y)) / D2R;
        turn = clamp(wrap(want - s.h) / 25, -1, 1);
      } else if (inp.turn) turn = clamp(inp.turn, -1, 1);
    }
    s.turnNow = turn;
    s.h = (s.h + turn * pl.turn * dt + 360) % 360;
    // speed follows the power lever; gear down = more drag = slower
    let target = pl.speeds[s.lever];
    if (pl.gear && (s.gear || s.gearMove) && s.phase === "air") target = Math.min(target, pl.gearMax);
    if (s.phase === "climb") target = Math.max(95, Math.min(target, 110));
    s.v += clamp(target - s.v, -pl.accel * dt, pl.accel * dt);
    const d = dirOf(s.h);
    const wk = s.plane === "heli" ? 1 : 0.8;
    s.x += (d.x * s.v + s.wind.vx * wk) * dt; s.y += (d.y * s.v + s.wind.vy * wk) * dt;
    // stay on the map: a gentle push back from the edges
    const B = s.bounds;
    if (s.x < B.x0 || s.x > B.x1 || s.y < B.y0 || s.y > B.y1) {
      s.x = clamp(s.x, B.x0 - 40, B.x1 + 40); s.y = clamp(s.y, B.y0 - 40, B.y1 + 40);
      const back = Math.atan2(((B.x0 + B.x1) / 2) - s.x, -(((B.y0 + B.y1) / 2) - s.y)) / D2R;
      s.h = (s.h + clamp(wrap(back - s.h), -90 * dt, 90 * dt) + 360) % 360;
      if (!s.edgeT || s.t - s.edgeT > 4) { s.edgeT = s.t; ev(s, "edge"); }
    }
  }

  /** jets: fly into the glowing arrows of the right runway with gear down and SLOW, and the autopilot lands */
  function landingTargets(s) {
    if (s.lv.free) return Object.values(AIRPORTS).filter(a => a.rwy != null);
    const a = dest(s); return a ? [a] : [];
  }
  function funnel(s, a) {
    const h = landHeading(a, s.wind.from), th = threshold(a, h), d = dirOf(h);
    const rx = s.x - th.x, ry = s.y - th.y;
    const along = rx * d.x + ry * d.y, cross = -rx * d.y + ry * d.x;
    return { h, th, d, along, cross, inside: along < -50 && along > -900 && Math.abs(cross) < 70 + (-along) * 0.32, aligned: Math.abs(wrap(s.h - h)) < 45 };
  }
  function tryFinal(s) {
    s.hint = null;
    for (const a of landingTargets(s)) {
      if (s.plane === "jet" && a.rwy == null) continue;
      const f = funnel(s, a);
      if (!f.inside) continue;
      if (!f.aligned) { s.hint = "align"; continue; }
      if (!s.gear || s.gearMove) { s.hint = "gear"; continue; }
      if (s.lever > 0) { s.hint = "slow"; continue; }
      s.phase = "final"; s.phaseT = 0; s.target = a.k; s.fin = f; s.fin.along0 = f.along; s.fin.cross0 = f.cross; s.hint = null;
      ev(s, "final", { rwy: runwayNumber(a, f.h) });
      return;
    }
    // a nudge when you're close to the destination but not lined up yet
    const a = dest(s);
    if (!s.hint && a && a.rwy != null && Math.hypot(s.x - a.x, s.y - a.y) < 1300) s.hint = "approach";
  }
  function final(s, dt) {
    const f = s.fin, a = AIRPORTS[s.target];
    // glide down the centre line: sideways error and height shrink to zero at the runway's start, then brake
    if (f.along < 0) s.v += clamp(70 - s.v, -20 * dt, 20 * dt);
    else s.v = Math.max(0, s.v - 40 * dt);
    f.along += s.v * dt;
    const k = f.along < 0 ? clamp(f.along / f.along0, 0, 1) : 0;   // 1 at capture, 0 at the threshold
    f.cross = f.cross0 * k;
    s.alt = k;
    s.x = f.th.x + f.d.x * f.along - f.d.y * f.cross;
    s.y = f.th.y + f.d.y * f.along + f.d.x * f.cross;
    s.h = (s.h + clamp(wrap(f.h - s.h), -50 * dt, 50 * dt) + 360) % 360;
    if (f.along >= 0 && !f.touched) { f.touched = true; ev(s, "touchdown"); }
    if (f.touched && s.v <= 0) arrive(s, a);
  }
  /** helicopters: get slow over the H and press LAND (the bot and keyboard do the same) */
  function tryPad(s, inp) {
    s.canLand = false; s.hint = null;
    const cands = s.lv.free ? Object.values(AIRPORTS) : [dest(s)].filter(Boolean);
    for (const a of cands) {
      const d = Math.hypot(s.x - a.px, s.y - a.py);
      if (d < 75 && s.v < 55) {
        s.canLand = true;
        if (inp.land) { s.phase = "descend"; s.phaseT = 0; s.target = a.k; s.canLand = false; ev(s, "descend"); }
        return;
      }
      if (d < 75) s.hint = "slowHeli";
      else if (d < 500) s.hint = "pad";
    }
  }

  function arrive(s, a) {
    s.phase = "landed"; s.phaseT = 0; s.at = a.k; s.v = 0; s.alt = 0; s.care = null;
    if (s.lv.free) { const first = !s.stamps[a.k]; s.stamps[a.k] = true; ev(s, "stamp", { k: a.k, first }); return; }
    const leg = s.lv.legs[s.leg];
    if (!leg || leg.to !== a.k) { ev(s, "wrongAirport", { k: a.k }); return; }
    if (leg.do === "pickup") { s.patient = true; s.careNext = 7; }
    if (leg.do === "dropoff") s.patient = false;
    ev(s, "arrive", { k: a.k, do: leg.do, say: leg.say });
  }

  function nextLeg(s) {
    if (s.lv.free) { s.phase = "ground"; s.phaseT = 0; return; }
    const leg = s.lv.legs[s.leg];
    if (!leg || leg.to !== s.at) { s.phase = "ground"; s.phaseT = 0; return; }   // landed somewhere else: just take off again
    s.leg++;
    if (s.leg >= s.lv.legs.length) return finish(s);
    if (leg.do === "transfer") { s.plane = "jet"; park(s, AIRPORTS[s.at]); ev(s, "transfer"); return; }
    s.phase = "ground"; s.phaseT = 0;
    if (s.plane === "jet") park(s, AIRPORTS[s.at]);
    ev(s, "nextLeg");
  }

  function finish(s) {
    s.done = true;
    const c = Math.round(s.comfort), par = s.lv.par || 999;
    const stars = 1 + (c >= 60 ? 1 : 0) + (c >= 85 && s.t <= par ? 1 : 0);
    s.result = { time: s.t, comfort: c, stars, par };
    ev(s, "done", s.result);
  }

  function hazards(s, dt) {
    for (const st of s.storms) {
      const d = Math.hypot(s.x - st.x, s.y - st.y);
      st.hit = Math.max(0, st.hit - dt);
      if (d < st.r * 0.82 && st.hit <= 0) {
        st.hit = 1.3; s.bumps++;
        s.comfort = Math.max(0, s.comfort - (s.patient ? 6 : 4));
        ev(s, "bump");
      }
    }
    for (const b of s.birds) {
      if (b.gone > 0 || b.scatter > 0) continue;
      if (Math.hypot(s.x - b.x, s.y - b.y) < 60) {
        // the birds fly away safely; a close call is bumpy for the passengers
        const a = Math.atan2(b.y - s.y, b.x - s.x) + (Math.random() - 0.5);
        b.scatter = 2.5; b.sx = Math.cos(a) * 160; b.sy = Math.sin(a) * 160;
        s.birdsHit++; s.comfort = Math.max(0, s.comfort - 3);
        ev(s, "birds");
      }
    }
  }

  function careStep(s, dt, inp) {
    const [lo, hi] = s.lv.care;
    if (!s.care) {
      s.careNext -= dt;
      if (s.careNext <= 0) {
        const k = CARE[Math.floor((s.t * 7.31 + s.careDone * 3 + s.careMiss) % CARE.length)];
        s.care = { k, t: 10, max: 10 }; ev(s, "careNeed", { k, say: CARE_SAY[k] });
      }
      if (inp.care) ev(s, "careNoNeed");
      return;
    }
    s.care.t -= dt;
    if (inp.care) {
      if (inp.care === s.care.k) { s.comfort = Math.min(100, s.comfort + 4); s.careDone++; ev(s, "careOK", { k: s.care.k }); s.care = null; s.careNext = lo + (hi - lo) * ((s.careDone * 0.37) % 1); return; }
      ev(s, "careWrong", { k: inp.care, want: s.care.k });
    }
    if (s.care.t <= 0) {
      s.comfort = Math.max(0, s.comfort - 12); s.careMiss++; ev(s, "careMiss", { k: s.care.k });
      s.care = null; s.careNext = lo + (hi - lo) * 0.5;
    }
  }

  /** where to go next: the destination's approach point (jets) or helipad, routed around storms */
  function guide(s) {
    const a = dest(s);
    if (!a) return null;
    if (s.plane === "jet" && a.rwy != null) {
      const h = landHeading(a, s.wind.from), th = threshold(a, h), d = dirOf(h);
      return { a, x: th.x, y: th.y, ax: th.x - d.x * 650, ay: th.y - d.y * 650, h };
    }
    return { a, x: a.px, y: a.py, ax: a.px, ay: a.py, h: null };
  }

  /* ---------------- autopilot bot (for testing the levels; it reacts like a careful kid) */
  function bot(s, dt, mem) {
    mem = mem || {};
    const inp = {};
    if (s.phase === "ground") { for (const k in mem) delete mem[k]; if (s.phaseT > 0.8) inp.go = true; return inp; }
    if (s.phase === "climb" || s.phase === "air") {
      const g = guide(s);
      if (!g) return inp;
      const pl = PLANES[s.plane];
      if (s.plane === "jet") {
        if (s.alt > 0.6 && s.gear && !s.gearMove && !mem.gearDownAsked) inp.gear = true;
        const dA = Math.hypot(s.x - g.ax, s.y - g.ay), dT = Math.hypot(s.x - g.x, s.y - g.y);
        // fly to the approach point, then down the centre line
        let tx = g.ax, ty = g.ay;
        if (mem.onFinal || dA < 160) { mem.onFinal = true; tx = g.x; ty = g.y; }
        if (mem.onFinal && dT > 1500) mem.onFinal = false;
        if (dA < 1400 || mem.onFinal) { if (!s.gear && !s.gearMove) { inp.gear = true; mem.gearDownAsked = true; } inp.lever = dA < 900 || mem.onFinal ? 0 : 1; }
        else inp.lever = 2;
        inp.aim = avoid(s, tx, ty);
      } else {
        const d = Math.hypot(s.x - g.x, s.y - g.y);
        inp.lever = d < 450 ? 1 : 2;
        inp.aim = d < 300 ? { x: g.x, y: g.y } : avoid(s, g.x, g.y);
        if (s.canLand) inp.land = true;
      }
    }
    // a kid needs a moment to read the bubble
    if (s.care) { if (!mem.careSeen || mem.careSeen !== s.care) { mem.careSeen = s.care; mem.careT = 0; } mem.careT += dt; if (mem.careT > 2.2) inp.care = s.care.k; }
    return inp;
  }
  function avoid(s, tx, ty) {
    // steer for a point beside any storm in the way
    let best = { x: tx, y: ty };
    for (const st of s.storms) {
      const dx = tx - s.x, dy = ty - s.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const ox = st.x - s.x, oy = st.y - s.y, along = ox * ux + oy * uy;
      if (along < 0 || along > L) continue;
      const cross = -ox * uy + oy * ux, R = st.r + 120;
      if (Math.abs(cross) < R) {
        const side = cross > 0 ? -1 : 1;
        best = { x: st.x - uy * R * side * 1.1 - ux * 40, y: st.y + ux * R * side * 1.1 - uy * 40 };
        if (Math.hypot(best.x - s.x, best.y - s.y) < 120) best = { x: tx, y: ty };
        break;
      }
    }
    return best;
  }

  const distKm = (s, x, y) => Math.hypot(s.x - x, s.y - y) / PX_PER_KM;

  root.RescueSim = { LEVELS, FREE, AIRPORTS, PLANES, LAND_PX, CARE, CARE_SAY, D2R, PX_PER_KM, at, clamp, wrap, dirOf, landHeading, threshold, runwayNumber, funnel,
    create, step, bot, guide, dest, distKm };
  if (typeof module !== "undefined") module.exports = root.RescueSim;
})();
