// Sky Rescue! balance check in Node: the autopilot bot flies every mission.
//   node tools/dev/rescue_autopilot.js          -> one line per level
//   node tools/dev/rescue_autopilot.js 3 trace  -> prints the flight every 2 s
global.window = global;
require("../../currents/geo.js");
const S = require("../../songshan/sim.js");
const which = process.argv[2] ? [+process.argv[2]] : S.LEVELS.map((l, i) => i + 1);
const trace = process.argv[3] === "trace";
for (const n of which) {
  const L = S.LEVELS[n - 1], s = S.create(L), dt = 1 / 30, mem = {};
  const log = [];
  while (!s.done && s.t < 600) {
    S.step(s, dt, S.bot(s, dt, mem));
    for (const e of s.events) if (!["careNoNeed", "careOK", "careNeed"].includes(e.type)) log.push(e.type + (e.rwy ? e.rwy : "") + "@" + s.t.toFixed(0));
    if (trace && Math.abs(s.t % 2) < dt) console.log(s.t.toFixed(0).padStart(4), s.phase.padEnd(7), "leg", s.leg, "x", s.x.toFixed(0), "y", s.y.toFixed(0), "h", s.h.toFixed(0), "v", s.v.toFixed(0), "alt", s.alt.toFixed(2), "lever", s.lever, "gear", s.gear, s.hint || "", "comfort", s.comfort.toFixed(0));
  }
  console.log("L" + n, L.name.padEnd(24), s.done ? "done" : "STUCK " + s.phase + " leg " + s.leg, "t=" + s.t.toFixed(0) + "s", s.result ? JSON.stringify(s.result) : "", "care ok/miss " + s.careDone + "/" + s.careMiss, "bumps " + s.bumps, "birds " + s.birdsHit);
  if (trace || !s.done) console.log("   ", log.join(" "));
}
