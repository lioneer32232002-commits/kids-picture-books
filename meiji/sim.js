/* Bridge Puzzle! rules with no drawing (runs in the browser and in Node).
   Three kinds of missions:
   - arch: numbered stones go into numbered slots on a wooden frame (the centering). A stone can only go in once the
     stone below it is in, so you build up from both sides; the keystone in the middle goes last. Then the frame comes
     out and a truck drives across. A wrong slot just slides the stone back to the tray.
   - find: the bridge's pieces lie in an old empty swimming pool, each with a number. Tap them in order (some are under
     tarps: tap the tarp first). A wrong tap only wiggles the piece.
   - flood: pick how high the bridge is and how many piers stand in the river, then test it with a flood. Too low and
     the water hits the bridge; too high and the ramps are too steep for cars; too many piers block the water (and the
     boats); too few and the arches would have to be too long.
   Units: flood missions in meters, arch and find in screen px. */
(function (root) {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const RIVER = {
    width: 120,        // m from bank to bank
    bank: 9,           // m: the road on each bank, above normal water (higher than any flood)
    deck: 1.5,         // m: from the bottom of the bridge to the road on top
    ramp: 60,          // m: the ramp from the bank road up to the bridge
    maxSlope: 0.08,    // 8%: steeper and trucks can't climb
    freeboard: 0.5,    // m: gap to keep between the flood and the bottom of the bridge
    pierRise: 0.3,     // m: each pier in the water pushes the flood a little higher
    maxSpan: 40,       // m: an arch can't be longer than this
    minH: 4, maxH: 14, stepH: 0.5,
  };

  const LEVELS = [
    { k: "first", kind: "arch", name: "My First Arch", n: 5, hint: true,
      intro: "Put the numbered stones on the wooden frame. Start at the bottom on both sides, and put the keystone in the middle last. Then take the frame away!" },
    { k: "pool", kind: "find", name: "The Pieces in the Pool", n: 6, tarps: 0,
      intro: "The old bridge lies in an empty swimming pool, in many numbered pieces. Find them in order: 1, 2, 3... Tap each piece and the crane takes it to the truck." },
    { k: "flood", kind: "flood", name: "Let the River Pass", flood: 7, piers: 2, fixedPiers: true, mark: true,
      intro: "Where should the bridge be? Not too low, or a big flood hits it. Not too high, or the ramps get too steep for cars. Pick a height, then test it with a flood!" },
    { k: "bigger", kind: "arch", name: "A Bigger Arch", n: 9,
      intro: "A bigger arch with 9 stones. Remember: build up from both sides, and the keystone goes last." },
    { k: "tarps", kind: "find", name: "Under the Tarps", n: 10, tarps: 5,
      intro: "Some pieces are under tarps to keep the rain off. Tap a tarp to lift it and see the number underneath." },
    { k: "boats", kind: "flood", name: "Floods and Boats", flood: 7.5, piers: 4, boat: true,
      intro: "Now you choose the height AND the number of piers. More piers push the flood higher and leave less room for boats. Too few, and the arches get too long!" },
    { k: "lamps", kind: "arch", name: "Bronze Lamps", n: 9, lamps: 4,
      intro: "Build the arch, then put the four bronze lamps back on their posts, just like in 1933." },
    { k: "opening", kind: "arch", name: "Opening Day", n: 11, lamps: 4, parade: true,
      intro: "The last stones, the keystone, the lamps... and then everyone walks across! Hao and A-ma are waiting." },
  ];
  const FREE = { k: "free", kind: "arch", name: "Free Build: Big Arch", n: 13, lamps: 4, free: true,
    intro: "A big arch with 13 stones. How fast can you build it, with no wrong stones?" };

  function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ------------------------------------------------------------ arch */
  // slots go from the left foot (0) to the right foot (n-1); the keystone is the middle one
  const mid = n => (n - 1) / 2;
  function canPlace(s, i) {
    const n = s.n, m = mid(n), f = s.filled;
    if (f[i]) return false;
    if (i === 0 || i === n - 1) return true;
    if (i < m) return f[i - 1];
    if (i > m) return f[i + 1];
    return f[i - 1] && f[i + 1];   // the keystone needs both sides
  }

  /* ------------------------------------------------------------ flood */
  function floodCheck(L, h, piers) {
    const R = RIVER, spans = piers + 1, span = R.width / spans;
    const flood = L.flood + piers * R.pierRise;
    const road = h + R.deck, slope = (road - R.bank) / R.ramp;
    const r = { h, piers, span: Math.round(span), flood: +flood.toFixed(1), slope: Math.round(slope * 100), problems: [] };
    if (span > R.maxSpan) r.problems.push("span");
    if (h < flood + R.freeboard) r.problems.push("low");
    if (slope > R.maxSlope) r.problems.push("steep");
    if (L.boat) { if (span < 25) r.problems.push("narrow"); if (h < 5) r.problems.push("boatLow"); }
    r.ok = r.problems.length === 0;
    return r;
  }

  /* ------------------------------------------------------------ create */
  function create(L) {
    const r = rng(L.k.length * 7919 + 11);
    const s = { L, kind: L.kind, t: 0, done: false, events: [], r, wrong: 0 };
    if (L.kind === "arch") {
      s.n = L.n; s.filled = new Array(L.n).fill(false);
      s.tray = shuffle([...Array(L.n).keys()], r);       // stone numbers waiting in the tray (stone i belongs in slot i)
      s.phase = "stones"; s.lamps = L.lamps ? new Array(L.lamps).fill(false) : [];
    } else if (L.kind === "find") {
      // pieces scattered in the pool (fractions of the pool area), no two too close
      const ps = [];
      for (let i = 0; i < L.n; i++) {
        let x, y, tries = 0;
        do { x = 0.08 + r() * 0.84; y = 0.12 + r() * 0.76; tries++; } while (tries < 200 && ps.some(p => Math.hypot((p.x - x) * 1.6, p.y - y) < 0.2));
        ps.push({ num: i + 1, x, y, got: false, tarp: false });
      }
      shuffle(ps.slice(), r).slice(0, L.tarps || 0).forEach(p => { p.tarp = true; });
      s.pieces = ps; s.next = 1;
    } else {
      // start with a flat bridge at bank level: it looks fine, but it is too low for a big flood
      s.h = 7.5; s.piers = L.piers; s.tests = 0; s.last = null; s.phase = "design"; s.testT = 0;
    }
    return s;
  }

  /* ------------------------------------------------------------ actions (called by the game and the bot) */
  // arch: try to put stone `num` into slot `slot`
  function place(s, num, slot) {
    if (s.kind !== "arch" || s.phase !== "stones") return false;
    if (num === slot && canPlace(s, slot)) {
      s.filled[slot] = true; s.tray = s.tray.filter(k => k !== num);
      s.events.push({ type: "placed", slot, key: slot === mid(s.n) });
      if (s.filled.every(Boolean)) { s.phase = "frame"; s.events.push({ type: "arched" }); }
      return true;
    }
    s.wrong++;
    s.events.push({ type: "wrong", num, slot, why: num !== slot ? "number" : "order" });
    return false;
  }
  function removeFrame(s) {
    if (s.phase !== "frame") return;
    s.phase = s.lamps.length ? "lamps" : "truck"; s.events.push({ type: "frameOut" });
    if (s.phase === "truck") s.testT = 0;
  }
  function placeLamp(s, i) {
    if (s.phase !== "lamps" || s.lamps[i]) return;
    s.lamps[i] = true; s.events.push({ type: "lamp", i });
    if (s.lamps.every(Boolean)) { s.phase = "truck"; s.testT = 0; }
  }
  // find: tap piece index i, or its tarp
  function tapPiece(s, i) {
    const p = s.pieces[i]; if (!p || p.got || s.done) return;
    if (p.tarp) { p.tarp = false; s.events.push({ type: "tarp", i }); return; }
    if (p.num === s.next) { p.got = true; s.next++; s.events.push({ type: "got", i, num: p.num }); if (s.next > s.L.n) finish(s); }
    else { s.wrong++; s.events.push({ type: "wrong", i, num: p.num, want: s.next }); }
  }
  function nudge(s, dh, dp) {
    if (s.phase !== "design") return;
    s.h = clamp(Math.round((s.h + dh) / RIVER.stepH) * RIVER.stepH, RIVER.minH, RIVER.maxH);
    if (!s.L.fixedPiers) s.piers = clamp(s.piers + dp, 1, 6);
  }
  function test(s) {
    if (s.phase !== "design") return;
    s.tests++; s.last = floodCheck(s.L, s.h, s.piers); s.phase = "testing"; s.testT = 0;
    s.events.push({ type: "test", r: s.last });
  }

  /* ------------------------------------------------------------ step (time) */
  const TRUCK_T = 4, TEST_T = 4.5;
  function step(s, dt, inp) {
    s.events.length = 0;
    if (s.done) return;
    s.t += dt;
    inp = inp || {};
    if (inp.act) inp.act(s);                      // a queued action from the game or the bot
    if (s.kind === "arch" && s.phase === "truck") { s.testT += dt; if (s.testT >= (s.L.parade ? TRUCK_T + 3 : TRUCK_T)) finish(s); }
    if (s.kind === "flood" && s.phase === "testing") {
      s.testT += dt;
      if (s.testT >= TEST_T) {
        if (s.last.ok) finish(s);
        else { s.phase = "design"; s.events.push({ type: "retry", r: s.last }); }
      }
    }
  }

  /* ------------------------------------------------------------ finish + stars */
  function finish(s) {
    if (s.done) return;
    s.done = true;
    const L = s.L;
    if (s.kind === "arch") s.result = { wrong: s.wrong, time: Math.round(s.t), stones: s.n, stars: L.free ? 0 : s.wrong <= 1 ? 3 : s.wrong <= 4 ? 2 : 1 };
    else if (s.kind === "find") s.result = { wrong: s.wrong, time: Math.round(s.t), pieces: L.n, stars: s.wrong <= 1 ? 3 : s.wrong <= 3 ? 2 : 1 };
    else s.result = { tests: s.tests, h: s.h, piers: s.piers, flood: s.last.flood, slope: s.last.slope, span: s.last.span, stars: s.tests <= 2 ? 3 : s.tests === 3 ? 2 : 1 };
    s.events.push({ type: "done" });
  }

  /* ------------------------------------------------------------ bot (for testing and balancing) */
  // style "good" plays cleanly; "kid" makes a few mistakes and thinks a bit between moves
  function bot(s, dt, mem) {
    const style = mem.style || "good";
    mem.wait = (mem.wait || 0) - dt;
    if (mem.wait > 0) return {};
    mem.wait = style === "kid" ? 0.9 : 0.35;
    const oops = style === "kid" && s.r() < 0.18;
    if (s.kind === "arch") {
      if (s.phase === "stones") {
        const open = [...Array(s.n).keys()].filter(i => canPlace(s, i));
        const slot = open[0];
        let num = slot;
        if (oops) num = s.tray.find(k => k !== slot) ?? slot;       // the wrong stone
        else if (style === "kid" && s.r() < 0.1 && s.tray.length > 1) { const m = Math.round(mid(s.n)); if (!s.filled[m] && slot !== m) return { act: x => place(x, m, m) }; }   // keystone too early
        return { act: x => place(x, num, slot) };
      }
      if (s.phase === "frame") return { act: removeFrame };
      if (s.phase === "lamps") { const i = s.lamps.indexOf(false); return { act: x => placeLamp(x, i) }; }
      return {};
    }
    if (s.kind === "find") {
      const i = s.pieces.findIndex(p => !p.got && (p.num === s.next || p.tarp));
      if (oops) { const j = s.pieces.findIndex(p => !p.got && !p.tarp && p.num !== s.next); if (j >= 0) return { act: x => tapPiece(x, j) }; }
      // a careful kid lifts tarps one by one until the number shows up
      const want = s.pieces.findIndex(p => !p.got && !p.tarp && p.num === s.next);
      if (want >= 0) return { act: x => tapPiece(x, want) };
      const tarp = s.pieces.findIndex(p => !p.got && p.tarp);
      return tarp >= 0 ? { act: x => tapPiece(x, tarp) } : {};
    }
    // flood: the good bot works it out; the kid tries the middle height first and fixes what the test says
    if (s.phase !== "design") return {};
    if (style === "good" && !mem.planned) {
      mem.planned = true;
      let best = null;
      for (let p = 1; p <= 6; p++) for (let h = RIVER.minH; h <= RIVER.maxH; h += RIVER.stepH) {
        if (s.L.fixedPiers && p !== s.L.piers) continue;
        if (floodCheck(s.L, h, p).ok && (!best || h < best.h)) best = { h, p };
      }
      mem.target = best;
    }
    if (style === "kid" && !mem.target) mem.target = { h: 8, p: s.piers };
    if (style === "kid" && s.last && !s.last.ok && mem.fixed !== s.tests) {
      mem.fixed = s.tests;
      const pr = s.last.problems;
      if (pr.includes("low")) mem.target.h = s.h + 1;
      if (pr.includes("steep")) mem.target.h = s.h - 1;
      if (pr.includes("narrow")) mem.target.p = s.piers - 1;
      if (pr.includes("span")) mem.target.p = s.piers + 1;
    }
    const T = mem.target;
    if (Math.abs(s.h - T.h) > 0.01) return { act: x => nudge(x, Math.sign(T.h - x.h) * RIVER.stepH, 0) };
    if (!s.L.fixedPiers && s.piers !== T.p) return { act: x => nudge(x, 0, Math.sign(T.p - x.piers)) };
    return { act: test };
  }

  const api = { LEVELS, FREE, RIVER, create, step, bot, place, canPlace, removeFrame, placeLamp, tapPiece, nudge, test, floodCheck, mid, clamp, TRUCK_T, TEST_T };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BridgeSim = api;
})(typeof window !== "undefined" ? window : this);
