/* Steady Tower! rules with no drawing (runs in the browser and in Node).
   Three kinds of missions:
   - steady: wind gusts or an earthquake make the tower sway. The kid holds ◀ ▶ to help Bao swing the other way
     from the tower's motion, which takes energy out of the sway (passive Bao helps a little on its own).
     Bubble tea at the top sloshes when the sway is big; too much and a cup spills.
   - build: a crane swings each piece of the tower; DROP when it is right above the stack. A piece that misses
     just slides off ("Bonk!") onto the pile and the crane brings it back.
   - lift: hold ▲ / ▼ to run the elevator, let go to brake. Fast elevators need a long way to stop, so a marker
     shows where you would stop if you let go now; close to the floor, the elevator levels itself.
   Units: steady sway in px at the top of the tower, build in px, lift in floors and floors per second. */
(function (root) {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);

  /* ------------------------------------------------------------ steady */
  const TOWER = {
    period: 3,          // seconds per swing (the real tower is slower, about 7 s)
    damp0: 0.17,        // the tower's own damping plus passive Bao
    help: 0.95,         // extra damping when the kid swings Bao the right way
    harm: 0.3,          // extra shaking when Bao is pushed the wrong way
    spillAt: 62,        // sway (px) where the tea starts to slosh over
    slosh: 1.0,        // how fast the slosh meter fills per px above spillAt per second (/100)
  };
  const W0 = 2 * Math.PI / TOWER.period;

  /* ------------------------------------------------------------ build */
  const BUILD = { pieceW: 220, stick: 62, perfect: 16, fall: 0.55, cx: 640 };

  /* ------------------------------------------------------------ lift */
  const LIFT = { vmax: 3.8, acc: 0.3, brake: 0.35, reverse: 0.9, level: 1.0, levelV: 0.9 };
  // 3.8 floors/s is about 60 km/h for 4.4 m floors; 5F to 89F takes about 35 s with a perfect stop

  const LEVELS = [
    { k: "breeze", kind: "steady", name: "A Windy Day", T: 40, wind: { A: 115, gap: [3, 5], len: [4, 6] }, hint: true,
      intro: "The wind is pushing Taipei 101! Watch the arrow on the tower. When the tower moves ▶, hold ◀ to swing Bao the other way. Keep the bubble tea from spilling!" },
    { k: "stack", kind: "build", name: "Stack the Bamboo", swing: { A: 230, period: 3.4 }, sway: 0,
      intro: "Let's build Taipei 101! The crane swings each piece. Tap DROP when it is right above the tower. 8 pieces, then Bao, then the top!" },
    { k: "up89", kind: "lift", name: "Up to the 89th Floor", start: 5, stops: [89],
      intro: "Hold ▲ to go up. Let go to slow down. A fast elevator needs a long way to stop, so watch the 🛑 marker: it shows where you would stop if you let go now!" },
    { k: "typhoon", kind: "steady", name: "Typhoon Soudelor", T: 55, wind: { A: 95, gap: [2, 3.5], len: [5, 7] }, rain: true,
      intro: "August 8, 2015: a strong typhoon blows on Taipei. Bao swung 1 meter that day! Help Bao swing the other way from the tower." },
    { k: "windy", kind: "build", name: "Windy Crane", swing: { A: 260, period: 2.4 }, sway: 14, gust: true,
      intro: "The wind is blowing up high, and the tower sways a little as it grows. Wait for the right moment, then DROP!" },
    { k: "quake", kind: "steady", name: "Earthquake!", T: 40, quake: { Q: 200, at: [5, 22], len: 7 },
      intro: "The ground shakes! Earthquakes come fast and shake hard. Watch the arrow and help Bao calm the tower." },
    { k: "busy", kind: "lift", name: "Busy Elevator", start: 5, stops: [35, 89, 5],
      intro: "Lots of visitors today! Stop at the 35th floor, then the 89th floor, then take everyone back down to the 5th floor. Hold ▼ to go down." },
    { k: "newyear", kind: "steady", name: "New Year's Eve Storm", T: 55, wind: { A: 85, gap: [2, 3.5], len: [5, 7] }, quake: { Q: 120, at: [30], len: 6 }, night: true, fireworks: true,
      intro: "It's New Year's Eve, and it's windy! Keep the tower steady until midnight, so the fireworks can go!" },
  ];
  const FREE = { k: "free", kind: "steady", name: "Free Play: Endless Storm", T: 9999, free: true, wind: { A: 75, gap: [2, 4], len: [4, 7], grow: 0.08 }, quake: { Q: 120, every: 35, len: 6 },
    intro: "The storm gets stronger and stronger. How long can you keep the bubble tea from spilling?" };

  function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  const pick = (r, [a, b]) => a + (b - a) * r();

  /* ------------------------------------------------------------ create */
  function create(L) {
    const r = rng(L.k.length * 977 + 3);
    const s = { L, kind: L.kind, t: 0, done: false, events: [], r };
    if (L.kind === "steady") {
      Object.assign(s, { x: 0, v: 0, u: 0, w: 0, force: 0, slosh: 0, cups: 3, spilled: 0, good: 0, total: 0, peak: 0, gusts: [], quakeT: 0, quakeQ: 0, warn: 0 });
      // plan the gusts: [start, length, strength, phase]
      if (L.wind) {
        let t = 2.5, i = 0;
        while (t < L.T - 3) {
          const len = pick(r, L.wind.len), A = L.wind.A * (0.8 + 0.4 * r()) * (L.wind.grow ? 1 + L.wind.grow * i : 1);
          s.gusts.push({ t, len, A, ph: r() * Math.PI * 2 });
          t += len + pick(r, L.wind.gap); i++;
        }
      }
      s.quakes = [];
      if (L.quake) {
        if (L.quake.every) for (let t = 15; t < L.T; t += L.quake.every) s.quakes.push({ t, len: L.quake.len, Q: L.quake.Q * (1 + t / 120) });
        else L.quake.at.forEach(t => s.quakes.push({ t, len: L.quake.len, Q: L.quake.Q }));
      }
    } else if (L.kind === "build") {
      const order = [];
      for (let i = 0; i < 8; i++) order.push("piece");
      order.push("bao", "top");
      Object.assign(s, { order, n: 0, hook: 0, drop: null, misses: 0, perfect: 0, offs: [], stackX: 0, pile: 0, wind: 0 });
    } else if (L.kind === "lift") {
      Object.assign(s, { y: L.start, v: 0, held: 0, braking: false, stop: 0, over: 0, doors: 0, leveling: false, passed: false, stopsT: [] });
      s.par = L.stops.reduce((a, f, i) => a + idealTime(Math.abs(f - (i ? L.stops[i - 1] : L.start))) + 3, 0);
    }
    return s;
  }
  function idealTime(d) {
    // accelerate, (cruise), brake, with the elevator's real limits
    const a = LIFT.acc, b = LIFT.brake, V = LIFT.vmax;
    const dUp = V * V / (2 * a), dDown = V * V / (2 * b);
    if (dUp + dDown <= d) return V / a + V / b + (d - dUp - dDown) / V;
    const v = Math.sqrt(2 * d * a * b / (a + b)); return v / a + v / b;
  }

  /* ------------------------------------------------------------ step */
  function step(s, dt, inp) {
    s.events.length = 0;
    if (s.done) return;
    s.t += dt;
    if (s.kind === "steady") stepSteady(s, dt, inp);
    else if (s.kind === "build") stepBuild(s, dt, inp);
    else stepLift(s, dt, inp);
  }

  function windForce(s) {
    let f = 0, warn = 0;
    for (const g of s.gusts) {
      const k = (s.t - g.t) / g.len;
      if (k > 0 && k < 1) f += g.A * Math.sin(Math.PI * k) * Math.sin(W0 * (s.t - g.t) + g.ph);
      if (s.t > g.t - 1.5 && s.t < g.t) warn = 1;
    }
    return { f, warn };
  }
  function stepSteady(s, dt, inp) {
    const L = s.L;
    const w = windForce(s);
    let q = 0, quaking = false;
    for (const e of s.quakes) {
      const k = (s.t - e.t) / e.len;
      if (k > 0 && k < 1) { quaking = true; const env = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
        q += e.Q * env * (Math.sin(W0 * 1.05 * s.t) + 0.6 * Math.sin(W0 * 1.7 * s.t + 1) + 0.5 * Math.sin(W0 * 0.7 * s.t + 2)); }
      if (Math.abs(s.t - e.t) < dt / 2 + 1e-9) s.events.push({ type: "quake" });
    }
    if (w.warn && !s.warn) s.events.push({ type: "warn" });
    s.warn = w.warn; s.force = w.f; s.quaking = quaking;
    const i = sgn(inp.dir || 0);
    let c = TOWER.damp0;
    // helping: Bao swung the other way from where the tower is going
    const moving = Math.abs(s.v) > 6;
    if (i && moving) c += i === -sgn(s.v) ? TOWER.help : -TOWER.harm;
    if (moving) { s.total += dt; if (i === -sgn(s.v)) s.good += dt; }
    const a = -W0 * W0 * s.x - c * s.v + w.f + q;
    s.v += a * dt; s.x += s.v * dt;
    s.x = clamp(s.x, -140, 140);
    s.peak = Math.max(s.peak, Math.abs(s.x));
    // Bao (only for drawing): a pendulum hanging in the tower, pushed by the kid
    s.w += (-W0 * W0 * s.u - 0.8 * s.w - a * 0.6 + i * 260) * dt; s.u += s.w * dt; s.u = clamp(s.u, -46, 46);
    // the bubble tea sloshes when the sway is big
    const over = Math.abs(s.x) - TOWER.spillAt;
    if (over > 0) s.slosh += over * TOWER.slosh / 100 * dt * 10;
    else s.slosh = Math.max(0, s.slosh - 0.12 * dt);
    if (s.slosh >= 1 && s.cups > 0) { s.cups--; s.spilled++; s.slosh = 0.2; s.events.push({ type: "spill", left: s.cups }); }
    if (L.free && s.cups <= 0) return finish(s);
    if (s.t >= L.T) return finish(s);
  }

  function hookX(s) {
    const L = s.L, sw = L.swing;
    return BUILD.cx + sw.A * Math.sin(2 * Math.PI * s.t / sw.period) + s.wind;
  }
  function stackTopX(s) {
    return BUILD.cx + (s.L.sway ? s.L.sway * Math.min(1, s.n / 8) * Math.sin(2 * Math.PI * s.t / 4.1) : 0);
  }
  function stepBuild(s, dt, inp) {
    const L = s.L;
    if (L.gust) s.wind = 40 * Math.sin(s.t * 0.7) * Math.sin(s.t * 0.23 + 1);
    s.hook = hookX(s);
    if (s.drop) {
      s.drop.t += dt;
      if (s.drop.t >= BUILD.fall) {
        const off = s.drop.x - stackTopX(s), what = s.order[s.n];
        if (Math.abs(off) <= BUILD.stick) {
          const perfect = Math.abs(off) <= BUILD.perfect;
          s.offs.push(Math.abs(off)); if (perfect) s.perfect++;
          s.n++; s.events.push({ type: "stack", what, perfect, n: s.n });
          if (s.n >= s.order.length) return finish(s);
        } else { s.misses++; s.pile++; s.events.push({ type: "miss", what, side: sgn(off) }); }
        s.drop = null;
      }
    } else if (inp.drop && s.t > 0.5) {
      s.drop = { x: s.hook, t: 0 }; s.events.push({ type: "drop" });
    }
  }

  function stepLift(s, dt, inp) {
    const L = s.L;
    if (s.stop >= L.stops.length) return;
    if (s.doors > 0) { s.doors -= dt; if (s.doors <= 0) { s.stop++; s.passed = false; if (s.stop >= L.stops.length) return finish(s); s.events.push({ type: "next", floor: L.stops[s.stop] }); } return; }
    const target = L.stops[s.stop], dir = sgn(target - s.y) || 1;
    const up = !!inp.up, down = !!inp.down;
    const want = up && !down ? 1 : down && !up ? -1 : 0;
    if (!want) s.held = 0;
    if (want) {
      s.leveling = false;
      if (s.v * want < 0) {
        // pushing against the motion brakes hard, and stops at zero (let go and press again to go the other way)
        s.braking = true; s.held = want;
        const nv = s.v + want * LIFT.reverse * dt;
        s.v = nv * s.v <= 0 ? 0 : nv;
      } else if (s.held === want && s.v === 0) {
        // still holding the brake after stopping: stay put
      } else { s.braking = false; s.held = 0; s.v += want * LIFT.acc * dt; }
    } else if (s.leveling || (Math.abs(target - s.y) < LIFT.level && Math.abs(s.v) < LIFT.levelV)) {
      // close to the floor and slow: the elevator levels itself, gently
      s.leveling = true;
      const d = target - s.y, vd = clamp(d * 1.6, -0.8, 0.8);
      s.v += clamp(vd - s.v, -1.5 * dt, 1.5 * dt);
      if (Math.abs(d) < 0.03) { s.y = target; s.v = 0; s.leveling = false; s.doors = 2.2; s.stopsT.push(s.t); s.events.push({ type: "arrive", floor: target, n: s.stop + 1 }); return; }
    } else {
      const b = LIFT.brake * dt;
      s.v = Math.abs(s.v) <= b ? 0 : s.v - sgn(s.v) * b;
    }
    s.v = clamp(s.v, -LIFT.vmax, LIFT.vmax);
    const before = s.y;
    s.y = clamp(s.y + s.v * dt, 1, 101);
    if (s.y === 1 || s.y === 101) s.v = 0;
    // passing the floor too fast counts as an overshoot
    if (!s.passed && (before - target) * (s.y - target) < 0 && Math.abs(s.v) > LIFT.levelV) { s.passed = true; s.over++; s.events.push({ type: "overshoot" }); }
    if (s.passed && Math.abs(target - s.y) > 3) s.passed = false;
    if (s.t > 400) finish(s);
  }
  // where the elevator would stop if you let go now
  function stopAt(s) { return s.y + sgn(s.v) * s.v * s.v / (2 * LIFT.brake); }

  /* ------------------------------------------------------------ finish + stars */
  function finish(s) {
    if (s.done) return;
    s.done = true;
    const L = s.L;
    if (s.kind === "steady") {
      const share = s.total ? s.good / s.total : 1;
      s.result = { cups: s.cups, spilled: s.spilled, share: Math.round(share * 100), peak: Math.round(s.peak), time: Math.round(s.t),
        stars: L.free ? 0 : s.cups >= 3 ? 3 : s.cups === 2 ? 2 : 1 };
    } else if (s.kind === "build") {
      s.result = { misses: s.misses, perfect: s.perfect, pieces: s.order.length, stars: s.misses === 0 ? 3 : s.misses <= 2 ? 2 : 1 };
    } else {
      const t = s.t;
      s.result = { time: Math.round(t), par: Math.round(s.par), over: s.over, stops: L.stops.length,
        stars: s.over === 0 && t <= s.par * 1.3 ? 3 : s.over <= 1 && t <= s.par * 1.8 ? 2 : 1 };
    }
    s.events.push({ type: "done" });
  }

  /* ------------------------------------------------------------ bot (for testing and balancing) */
  // style: "good" (default), "lazy" (does nothing), "late" (reacts late and sometimes the wrong way)
  function bot(s, dt, mem, style) {
    style = style || mem.style || "good";
    if (s.kind === "steady") {
      if (style === "lazy") return { dir: 0 };
      mem.hist = mem.hist || []; mem.hist.push(s.v);
      const lag = style === "late" ? Math.round(0.45 / dt) : 0;
      const v = mem.hist.length > lag ? mem.hist[mem.hist.length - 1 - lag] : 0;
      if (mem.hist.length > 200) mem.hist.shift();
      return { dir: Math.abs(v) > 6 ? -sgn(v) : 0 };
    }
    if (s.kind === "build") {
      if (s.drop) return { drop: false };
      if (mem.tol == null) mem.tol = style === "late" ? 30 + 30 * s.r() : style === "lazy" ? 20 + 80 * s.r() : 10;
      const tol = mem.tol;
      mem.wait = (mem.wait || 0) - dt;
      if (mem.wait > 0) return { drop: false };
      const ok = Math.abs(s.hook - stackTopX(s)) < tol;
      if (ok) { mem.wait = 0.8; mem.tol = null; return { drop: true }; }
      return { drop: false };
    }
    // lift
    const target = s.L.stops[s.stop]; if (target == null || s.doors > 0) return {};
    const d = target - s.y, dir = sgn(d), margin = style === "late" ? -2.5 : style === "lazy" ? -6 : 0.3;
    const stopDist = s.v * s.v / (2 * LIFT.brake);
    if (s.held && s.v === 0) return {};          // braked to a stop: let go first, like the screen says
    if (s.v * dir < 0) return dir > 0 ? { up: true } : { down: true };
    if (Math.abs(d) > stopDist + margin && !(Math.abs(d) < LIFT.level && Math.abs(s.v) < LIFT.levelV)) return dir > 0 ? { up: true } : { down: true };
    return {};
  }

  const api = { LEVELS, FREE, TOWER, BUILD, LIFT, W0, create, step, bot, clamp, hookX, stackTopX, stopAt, idealTime };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TowerSim = api;
})(typeof window !== "undefined" ? window : this);
