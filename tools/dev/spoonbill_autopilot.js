// Spoonbill Journey! balance check in Node: the bot plays every mission.
//   node tools/dev/spoonbill_autopilot.js            -> one line per mission (a calm kid)
//   node tools/dev/spoonbill_autopilot.js all hasty  -> feed missions with a kid who rushes (scares fish)
//   node tools/dev/spoonbill_autopilot.js 2 trace    -> prints the trip every 2 s
global.window = global;
require("../../currents/geo.js");
const S = require("../../spoonbill/sim.js");
const arg = process.argv[2], mode = process.argv[3];
const which = arg && arg !== "all" ? [+arg] : S.LEVELS.map((l, i) => i + 1);
for (const n of which) {
  const L = S.LEVELS[n - 1], s = S.create(L), dt = 1 / 30, mem = { hasty: mode === "hasty" };
  const log = [];
  while (!s.done && s.t < 400) {
    S.step(s, dt, S.bot(s, dt, mem));
    for (const e of s.events) if (!["catch", "scared"].includes(e.type)) log.push(e.type + (e.name ? ":" + e.name.split(" ")[0] : "") + "@" + s.t.toFixed(0));
    if (mode === "trace" && Math.abs(s.t % 2) < dt) console.log(s.t.toFixed(0).padStart(4), s.kind === "fly" ? "x " + s.x.toFixed(0) + " y " + s.y.toFixed(0) + " energy " + s.energy.toFixed(0) : "x " + s.x.toFixed(0) + " food " + s.food + " wl " + s.wl.toFixed(0) + " fish " + s.fish.length);
  }
  console.log("L" + n, L.name.padEnd(20), s.done ? "done" : "STUCK", "t=" + s.t.toFixed(0) + "s", JSON.stringify(s.result));
  if (mode === "log" || mode === "trace" || !s.done) console.log("   ", log.join(" "));
}
