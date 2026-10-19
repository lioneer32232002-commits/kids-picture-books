// Sky Pilot! balance check in Node: the autopilot bot flies every mission.
//   node tools/dev/flight_autopilot.js          -> one line per level
//   node tools/dev/flight_autopilot.js 5 trace  -> prints the flight every 2 s
const S = require("../../flight/sim.js");
const which = process.argv[2] ? [+process.argv[2]] : S.LEVELS.map(l => l.id);
const trace = process.argv[3] === "trace";
for (const id of which) {
  const L = id === 0 ? S.FREE : S.LEVELS.find(l => l.id === id);
  const m = new S.Mission(L), dt = 1 / 60;
  let t = 0, log = [];
  while (m.state === "play" && t < 400) {
    m.update(S.bot(m, dt), dt); t += dt;
    for (const e of m.events.splice(0)) if (e.e !== "slow" || trace) log.push(e.e + (e.e === "touchdown" ? "(" + e.vs.toFixed(1) + " " + e.kind + ")" : "") + "@" + t.toFixed(0));
    if (trace && Math.abs(t % 2) < dt) { const p = m.p; console.log(t.toFixed(0).padStart(4), "x", p.x.toFixed(0), "y", p.y.toFixed(0), "z", p.z.toFixed(0), "hdg", (p.psi / S.D2R).toFixed(0), "V", (p.V * 3.6).toFixed(0), "g", (p.gamma / S.D2R).toFixed(1), "a", (p.alpha / S.D2R).toFixed(1), "roll", (p.phi / S.D2R).toFixed(0)); }
  }
  console.log("L" + id, L.name.padEnd(20), m.state, "t=" + t.toFixed(0) + "s", m.result ? JSON.stringify(m.result) : "", log.filter(s => !s.startsWith("ring")).join(" "), "rings:" + log.filter(s => s.startsWith("ring")).length);
}
