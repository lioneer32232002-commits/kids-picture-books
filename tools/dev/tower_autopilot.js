// Plays every Steady Tower! mission with the sim's bot (no browser needed).
//   node tools/dev/tower_autopilot.js            good bot
//   node tools/dev/tower_autopilot.js all late   a kid who reacts late
//   node tools/dev/tower_autopilot.js all lazy   a kid who doesn't press anything (steady) / drops anywhere (build)
//   node tools/dev/tower_autopilot.js 4 trace    print the sway every second for mission 4
const R = require("../../taipei101/sim.js");
const [which = "all", style = "good"] = process.argv.slice(2);
const list = which === "all" ? R.LEVELS.map((_, i) => i) : which === "free" ? [-1] : [parseInt(which) - 1];
for (const i of list) {
  const L = i < 0 ? R.FREE : R.LEVELS[i], s = R.create(L), mem = { style: style === "trace" ? "good" : style }, dt = 1 / 30;
  let next = 0;
  while (!s.done && s.t < 600) {
    R.step(s, dt, R.bot(s, dt, mem));
    if (style === "trace" && s.t >= next) { next += 1; console.log(s.t.toFixed(0), s.kind === "steady" ? "x " + s.x.toFixed(0) + " slosh " + s.slosh.toFixed(2) + " cups " + s.cups : s.kind === "lift" ? "y " + s.y.toFixed(1) + " v " + s.v.toFixed(2) : "n " + s.n + " misses " + s.misses); }
  }
  console.log((i < 0 ? "free" : i + 1) + " " + L.name.padEnd(24), JSON.stringify(s.result));
}
