// Mercury Mission! balance check in Node: the bot plays every mission.
//   node tools/dev/mercury_autopilot.js            -> one line per mission (careful bot)
//   node tools/dev/mercury_autopilot.js all sloppy -> flybys tapped late or early (a younger kid)
//   node tools/dev/mercury_autopilot.js 3 trace    -> prints the flight every 2 s
const S = require("../../mercury/sim.js");
const arg = process.argv[2];
const which = arg && arg !== "all" ? [+arg] : S.LEVELS.map((l, i) => i + 1).concat([0]);
const mode = process.argv[3];
for (const n of which) {
  const L = n ? S.LEVELS[n - 1] : S.FREE, s = S.create(L), dt = 1 / 30, mem = { sloppy: mode === "sloppy" };
  const log = [];
  while (!s.done && s.t < 600) {
    S.step(s, dt, S.bot(s, dt, mem));
    for (const e of s.events) if (e.type !== "noFuel") log.push(e.type + (e.p ? ":" + e.p : "") + (e.q ? ":" + e.q.toFixed(2) : "") + (e.v ? ":v" + e.v.toFixed(1) : "") + "@" + s.t.toFixed(0));
    if (mode === "trace" && Math.abs(s.t % 2) < dt) console.log(s.t.toFixed(0).padStart(4), s.kind === "cruise" ? "r " + s.r.toFixed(0) + " v " + s.v.toFixed(1) + " arrive " + S.arriveSpeed(s).toFixed(1) + " fuel " + s.fuel.toFixed(0) + " gate " + s.gate : "ang " + s.ang.toFixed(0) + " h " + s.h.toFixed(0) + " heat " + s.heat.toFixed(0));
  }
  console.log((n ? "L" + n : "Free"), L.name.padEnd(20), s.done ? "done" : "STUCK", "t=" + s.t.toFixed(0) + "s", JSON.stringify(s.result));
  if (mode === "log" || mode === "trace" || !s.done) console.log("   ", log.join(" "));
}
