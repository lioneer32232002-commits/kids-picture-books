// Typhoon Chasers! balance check in Node: the bot plays every mission like a careful kid.
//   node tools/dev/typhoon_autopilot.js           -> one line per mission
//   node tools/dev/typhoon_autopilot.js 3 trace   -> prints the flight every 2 s
//   node tools/dev/typhoon_autopilot.js all slow  -> Get Ready missions with a slower kid (a tap every 1.6 s)
global.window = global;
require("../../currents/geo.js");
const S = require("../../typhoon/sim.js");
const arg = process.argv[2];
const which = arg && arg !== "all" ? [+arg] : S.LEVELS.map((l, i) => i + 1).concat([0]);
const trace = process.argv[3] === "trace", slow = process.argv[3] === "slow";
for (const n of which) {
  const L = n ? S.LEVELS[n - 1] : S.FREE, s = S.create(L), dt = 1 / 30, mem = { slow: slow ? 1.6 : 0 };
  const log = [];
  while (!s.done && s.t < (L.free ? 120 : 600)) {
    const inp = S.bot(s, dt, mem);
    if (L.free && s.t > 100) inp.goHome = true;
    S.step(s, dt, inp);
    for (const e of s.events) if (["drop", "bump", "allDropped", "lowFuel", "outOfFuel", "gone", "prepDone", "eye"].includes(e.type)) log.push(e.type + (e.why ? ":" + e.why : "") + (e.it ? ":" + e.it.k : "") + "@" + s.t.toFixed(0));
    if (trace && Math.abs(s.t % 2) < dt && s.kind === "chase") {
      const w = S.wind(s.st, s.x, s.y);
      console.log(s.t.toFixed(0).padStart(4), "x", s.x.toFixed(0), "y", s.y.toFixed(0), "r", w.r.toFixed(0), "wind", w.v.toFixed(0), "gs", s.gs.toFixed(0), "drops", s.drops, "fuel", s.fuel.toFixed(0));
    }
  }
  console.log((n ? "L" + n : "Free"), L.name.padEnd(16), s.done ? "done" : "STUCK", "t=" + s.t.toFixed(0) + "s", s.result ? JSON.stringify(s.result) : "drops " + s.drops);
  if (trace || !s.done || process.argv[3] === "log") console.log("   ", log.join(" "));
}
