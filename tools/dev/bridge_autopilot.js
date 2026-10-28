// Plays every Bridge Puzzle! mission with the sim's bot (no browser needed).
//   node tools/dev/bridge_autopilot.js          a careful player
//   node tools/dev/bridge_autopilot.js all kid  a kid who makes a few mistakes
const R = require("../../meiji/sim.js");
const [which = "all", style = "good"] = process.argv.slice(2);
const list = which === "all" ? R.LEVELS.map((_, i) => i).concat(-1) : [parseInt(which) - 1];
for (const i of list) {
  const L = i < 0 ? R.FREE : R.LEVELS[i], s = R.create(L), mem = { style }, dt = 1 / 30;
  while (!s.done && s.t < 600) R.step(s, dt, R.bot(s, dt, mem));
  console.log((i < 0 ? "free" : i + 1) + " " + L.name.padEnd(24), JSON.stringify(s.result || { stuck: s.phase, t: Math.round(s.t) }));
}
