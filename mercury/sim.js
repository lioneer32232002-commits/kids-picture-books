/* Mercury Mission! — rules, missions and the test bot, with no drawing (runs in Node too).
   Flyby missions: the Sun sits at (0, 0). Bepi rides a looping path that drops from Earth's orbit to Mercury's.
     Energy stays the same unless you shed it (E = v²/2 − G/r), so falling closer to the Sun makes you faster.
     A FLYBY inside a planet's window and the BRAKE (gentle ion engines, uses fuel) take energy away.
     Arrive slow enough and Mercury catches you; too fast and you loop around for another Mercury flyby.
   Orbit missions: a side view of Mercury with the Sun to the left (the left half is day). Bepi's orbit goes over
     the poles; you choose the height. Low is better for photos but hot over the day side.
   Angles in the orbit view are math angles: 0 = right, 90 = up (north pole). */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : global;
  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));

  /* ---------------- flyby missions */
  const ORB = { earth: 1500, venus: 1085, mercury: 580 };
  const GATE_ANGLE = { earth: 0, venus: 140 * D2R, mercury: 260 * D2R };
  const G = 68000, K = 90;                                   // gravity strength; px per second per km/s
  const MIN_TRAVEL = 9;                                      // the trip never crawls: below this, speed only matters for arriving
  const WIN = 0.17;                                          // flyby window, radians either side of the planet
  const CRUISE = {
    // gates: planets met at the end of each loop; D: energy a perfect flyby takes away; B: brake power; vCap: Mercury catches you at or below this speed
    hello: { start: 1640, v0: 8.6, gates: ["venus", "venus", "mercury", "mercury"], D: 18, B: 8, fuel: 100, burn: 9, vCap: 6 },
    nine: { start: 1640, v0: 8.6, gates: ["earth", "venus", "venus", "mercury", "mercury", "mercury", "mercury", "mercury", "mercury"], D: 10.5, B: 8, fuel: 100, burn: 9, vCap: 6 },
    trouble: { start: 1640, v0: 8.6, gates: ["earth", "venus", "venus", "mercury", "mercury", "mercury", "mercury", "mercury", "mercury"], D: 10.5, B: 3.5, fuel: 100, burn: 9, vCap: 6, weak: true },
    finale: { start: 760, v0: 12.5, gates: ["mercury", "mercury", "mercury", "mercury", "mercury", "mercury"], D: 11, B: 6, fuel: 80, burn: 9, vCap: 5 },
  };

  /* ---------------- orbit missions */
  const MERC = { x: 640, y: 392, R: 170 };
  const ALT = { min: 36, max: 230 };
  const ORBIT = {
    // targets: [angle, name, max height for a good photo]
    photos: { heat: 0, targets: [[150, "a huge old crater", 130], [205, "bright crater rays", 130], [20, "a long cliff", 130], [320, "a double crater", 130]] },
    hot: { heat: 1, targets: [[140, "the Caloris Basin", 110], [190, "shiny hollows", 100], [300, "Dr. Seuss crater", 110], [110, "a bright young crater", 100], [225, "a crater with a peak", 100]] },
    mio: { heat: 0.8, mio: 90, targets: [[235, "a crater chain", 110], [160, "a wrinkly ridge", 110], [330, "a long cliff", 110]] },
    ice: { heat: 1.2, targets: [[78, "ice in a north pole crater", 90], [298, "ice in a south pole crater", 90], [150, "the Caloris Basin", 110], [64, "more polar ice", 90], [205, "shiny hollows", 100]] },
  };

  const LEVELS = [
    { k: "hello", kind: "cruise", c: CRUISE.hello, name: "Swing By!",
      intro: "The Sun's gravity pulls Bepi faster and faster. Tap FLYBY when Bepi is inside a planet's glowing ring, and hold BRAKE to slow down. Arrive slow enough, and Mercury will catch you!" },
    { k: "photos", kind: "orbit", o: ORBIT.photos, name: "First Photos",
      intro: "You made it to Mercury! Fly around the planet and take 4 photos. Move up and down, and tap the camera when Bepi is right over a glowing spot. Fly low for a good picture!" },
    { k: "nine", kind: "cruise", c: CRUISE.nine, name: "Nine Flybys",
      intro: "Fly the real route: Earth once, Venus twice, and Mercury six times! Every flyby slows Bepi down a little. Save fuel for the end." },
    { k: "hot", kind: "orbit", o: ORBIT.hot, name: "Too Hot!",
      intro: "The day side of Mercury is super hot! Flying low over it heats Bepi up. Fly high over the day side, and dip down only for your photos. The night side cools you off." },
    { k: "trouble", kind: "cruise", c: CRUISE.trouble, name: "Engine Trouble",
      intro: "Oh no, the engines can't push at full power, just like in 2024! The brake is weak now, so every flyby counts. Tap FLYBY right in the middle of the rings!" },
    { k: "mio", kind: "orbit", o: ORBIT.mio, name: "Bye-Bye, Mio!",
      intro: "Time for Mio to fly on its own! When Bepi is over the glowing spot at the north pole, tap LET MIO GO. Then take 3 more photos." },
    { k: "finale", kind: "cruise", c: CRUISE.finale, name: "Six Mercury Flybys",
      intro: "The last part of the trip: six Mercury flybys in a row, fast and close. There isn't much fuel left. Mercury can only catch you if you're really slow!" },
    { k: "ice", kind: "orbit", o: ORBIT.ice, name: "Ice in the Dark",
      intro: "Is there ice at Mercury's poles? The dark polar craters are on the cold night side. Fly low there to take photos of the ice, and stay high over the hot day side." },
  ];
  const FREE = { k: "free", kind: "orbit", free: true, name: "Free Orbit", o: { heat: 1, targets: [] },
    intro: "Take as many photos as you can! New spots keep appearing. Press DONE when you've finished." };

  /* ---------------- cruise: the looping path */
  function makePath(c) {
    // each leg is one loop around the Sun that ends at a gate (a planet waiting on its orbit)
    const legs = []; let a0 = 0, r0 = c.start;
    c.gates.forEach((p, i) => {
      let end = GATE_ANGLE[p];                               // the next time the path comes around to this planet
      while (end < a0 + 1.5) end += TAU;
      legs.push({ a0, a1: end, r0, r1: ORB[p], p, i });
      a0 = end; r0 = ORB[p];
    });
    return legs;
  }
  /** radius of the path at angle a: eases from one orbit to the next, with a little outward bulge so loops show */
  function pathR(legs, a) {
    const L = legs.find(l => a <= l.a1) || legs[legs.length - 1];
    const k = clamp((a - L.a0) / (L.a1 - L.a0), 0, 1), e = (1 - Math.cos(Math.PI * k)) / 2;
    return L.r0 + (L.r1 - L.r0) * e + Math.sin(Math.PI * k) * L.r1 * 0.1;
  }
  const pos = (a, r) => ({ x: Math.cos(a) * r, y: -Math.sin(a) * r });

  function createCruise(L) {
    const c = L.c, legs = makePath(c);
    const s = { kind: "cruise", L, c, legs, t: 0, a: 0, r: c.start, v: c.v0, E: c.v0 * c.v0 / 2 - G / c.start, fuel: c.fuel, gate: 0,
      used: {}, laps: 0, done: false, result: null, events: [], braking: false, flybys: 0, perfect: 0, help: false };
    Object.assign(s, pos(0, c.start));
    return s;
  }
  function addMercuryLap(s) {
    const last = s.legs[s.legs.length - 1];
    s.legs.push({ a0: last.a1, a1: last.a1 + TAU, r0: ORB.mercury, r1: ORB.mercury, p: "mercury", i: s.legs.length });
    s.laps++;
  }
  function stepCruise(s, dt, inp) {
    s.events = []; s.t += dt;
    if (s.done) return;
    const c = s.c;
    // brake: the ion engines push against the motion, using fuel
    s.braking = !!inp.brake && s.fuel > 0;
    if (s.braking) { s.E -= c.B * dt; s.fuel = Math.max(0, s.fuel - c.burn * dt); if (s.fuel === 0) s.events.push({ type: "noFuel" }); }
    // move along the path; speed comes from energy and distance to the Sun
    s.r = pathR(s.legs, s.a);
    s.v = Math.sqrt(Math.max(1, 2 * (s.E + G / s.r)));
    s.a += Math.max(s.v, MIN_TRAVEL) * K / s.r * dt;
    Object.assign(s, pos(s.a, s.r));
    // flyby gates
    const L = s.legs[s.gate];
    if (L) {
      const d = s.a - L.a1;
      s.inWindow = Math.abs(d) <= WIN && !s.used[s.gate];
      if ((inp.flyby || (s.help && Math.abs(d) < 0.02)) && s.inWindow) {
        const q = 1 - 0.6 * Math.abs(d) / WIN;
        s.E -= c.D * q; s.used[s.gate] = true; s.flybys++; if (q > 0.85) s.perfect++;
        s.events.push({ type: "flyby", p: L.p, q, gate: s.gate });
      }
      if (d > WIN) {
        if (!s.used[s.gate]) s.events.push({ type: "missed", p: L.p });
        if (s.gate === s.legs.length - 1) {
          const v = Math.sqrt(Math.max(1, 2 * (s.E + G / ORB.mercury)));
          if (v <= c.vCap) return finishCruise(s);
          addMercuryLap(s); s.events.push({ type: "tooFast", v });
          if (s.laps >= 3 && !s.help) { s.help = true; s.events.push({ type: "help" }); }
        }
        s.gate++;
      }
    }
  }
  function finishCruise(s) {
    s.done = true;
    const stars = s.help ? 1 : s.laps === 0 && s.fuel >= 15 ? 3 : s.laps <= 1 ? 2 : 1;
    s.result = { stars, laps: s.laps, fuel: Math.round(s.fuel), flybys: s.flybys, perfect: s.perfect, gates: s.legs.length, time: Math.round(s.t) };
    s.events.push({ type: "captured" });
  }
  /** speed when reaching Mercury if nothing else changes */
  const arriveSpeed = s => Math.sqrt(Math.max(1, 2 * (s.E + G / ORB.mercury)));

  /* ---------------- orbit */
  const period = h => 18 * Math.pow((MERC.R + h) / (MERC.R + 60), 0.6);   // seconds per orbit: lower is a bit faster (gentler than real, so high orbits don't crawl)
  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  function createOrbit(L) {
    const o = L.o;
    const s = { kind: "orbit", L, o, t: 0, ang: 200, h: 170, want: 170, heat: 0, hot: 0, done: false, result: null, events: [],
      photos: 0, carrying: !!o.mio, mioGone: false, mioAng: 0, cool: 0,
      targets: o.targets.map(([a, name, max]) => ({ a, name, max, done: false })) };
    if (L.free) { for (let i = 0; i < 3; i++) addTarget(s); }
    return s;
  }
  const NAMES = ["a round crater", "bright crater rays", "a long cliff", "shiny hollows", "a crater chain", "a wrinkly ridge", "a double crater"];
  function addTarget(s) {
    for (let tries = 0; tries < 20; tries++) {
      const a = Math.round(rnd() * 360);
      if (s.targets.every(t => t.done || Math.abs(wrapPi((t.a - a) * D2R)) > 40 * D2R) && Math.abs(wrapPi((a - s.ang) * D2R)) > 50 * D2R) {
        s.targets.push({ a, name: NAMES[Math.floor(rnd() * NAMES.length)], max: 110, done: false }); return;
      }
    }
  }
  const daySide = a => Math.cos(a * D2R) < 0;                // the Sun is to the left
  function stepOrbit(s, dt, inp) {
    s.events = []; s.t += dt;
    if (s.done) return;
    if (inp.want != null) s.want = clamp(inp.want, ALT.min, ALT.max);
    if (inp.up) s.want = clamp(s.want + 160 * dt, ALT.min, ALT.max);
    if (inp.down) s.want = clamp(s.want - 160 * dt, ALT.min, ALT.max);
    if (s.cool > 0) { s.cool -= dt; s.want = ALT.max; }
    s.h += clamp(s.want - s.h, -110 * dt, 110 * dt);
    s.ang = (s.ang + 360 / period(s.h) * dt) % 360;
    // heat: low over the sunny side heats Bepi up, the night side cools it down
    if (s.o.heat && daySide(s.ang)) s.heat += s.o.heat * (2 + 38 * Math.pow(1 - (s.h - ALT.min) / (ALT.max - ALT.min), 1.5)) * dt;
    else s.heat -= 14 * dt;
    s.heat = Math.max(0, s.heat);
    if (s.heat >= 100) { s.heat = 45; s.hot++; s.cool = 1.2; s.events.push({ type: "overheat" }); }
    if (s.mioGone) s.mioAng = (s.mioAng + 360 / 28 * dt) % 360;
    // the camera button (or LET MIO GO)
    const over = t => Math.abs(wrapPi((t.a - s.ang) * D2R)) / D2R;
    s.near = null;
    if (s.carrying) { if (over({ a: s.o.mio }) < 14) s.near = { mio: true }; }
    else for (const t of s.targets) if (!t.done && over(t) < 9) { s.near = t; break; }
    if (inp.snap) {
      if (s.carrying) {
        if (s.near && s.near.mio) { s.carrying = false; s.mioGone = true; s.mioAng = s.ang; s.events.push({ type: "mio" }); }
        else s.events.push({ type: "notHere", mio: true });
      } else if (s.near) {
        if (s.h <= s.near.max) { s.near.done = true; s.photos++; s.events.push({ type: "photo", t: s.near }); if (s.L.free) addTarget(s); }
        else s.events.push({ type: "tooHigh", t: s.near });
      } else s.events.push({ type: "notHere" });
    }
    const left = s.targets.filter(t => !t.done).length;
    if ((!s.L.free && !left && !s.carrying) || (s.L.free && inp.quit)) finishOrbit(s);
  }
  function finishOrbit(s) {
    s.done = true;
    const stars = s.L.free ? 0 : s.hot === 0 ? 3 : s.hot <= 1 ? 2 : 1;
    s.result = { stars, photos: s.photos, hot: s.hot, time: Math.round(s.t), mio: s.mioGone };
    s.events.push({ type: "done" });
  }

  function create(L) { seed = 3; return L.kind === "cruise" ? createCruise(L) : createOrbit(L); }
  function step(s, dt, inp) { return s.kind === "cruise" ? stepCruise(s, dt, inp || {}) : stepOrbit(s, dt, inp || {}); }

  /* ---------------- test bot */
  function bot(s, dt, mem) {
    if (s.kind === "cruise") {
      const c = s.c, L = s.legs[s.gate], inp = {};
      if (L && s.inWindow && Math.abs(s.a - L.a1) < (mem.sloppy ? 0.12 : 0.03)) inp.flyby = true;
      // brake if, even with good flybys from here on, we'd still arrive too fast
      const left = s.legs.length - s.gate - (s.used[s.gate] ? 1 : 0);
      const Efuture = s.E - left * c.D * (mem.sloppy ? 0.6 : 0.9);
      const vArrive = Math.sqrt(Math.max(1, 2 * (Efuture + G / ORB.mercury)));
      if (vArrive > c.vCap * 0.94) inp.brake = true;
      return inp;
    }
    // orbit: go low near the next target (or the Mio spot), high over the day side otherwise
    const inp = {}, ahead = t => ((t - s.ang) % 360 + 360) % 360;
    let next = null, best = 999;
    if (s.carrying) { next = { a: s.o.mio, max: ALT.max }; best = ahead(s.o.mio); }
    else for (const t of s.targets) if (!t.done && ahead(t.a) < best) { best = ahead(t.a); next = t; }
    let want = daySide(s.ang) && s.o.heat ? ALT.max : 120;
    if (next && best < (daySide(s.ang) && s.heat > 30 ? 35 : 70)) {
      const hotTarget = daySide(next.a) && s.o.heat && s.heat > 55;
      want = hotTarget ? (best < 25 ? next.max - 15 : ALT.max) : Math.min(want, next.max - 25);
    }
    inp.want = want;
    if (s.near && (s.near.mio || s.h <= s.near.max) && Math.abs(wrapPi(((s.near.a != null ? s.near.a : s.o.mio) - s.ang) * D2R)) / D2R < 4) inp.snap = true;
    if (s.L.free && s.t > (mem.freeT || 90)) inp.quit = true;
    return inp;
  }

  root.MercurySim = { LEVELS, FREE, ORB, GATE_ANGLE, G, K, WIN, MERC, ALT, CRUISE, ORBIT, TAU, D2R, clamp, wrapPi, pathR, pos, period, daySide, arriveSpeed,
    create, step, bot };
  if (typeof module !== "undefined") module.exports = root.MercurySim;
})();
