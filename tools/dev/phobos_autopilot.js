// Moon Scoop! balance check in Node: the bot plays every mission.
//   node tools/dev/phobos_autopilot.js            -> one line per mission (a careful kid)
//   node tools/dev/phobos_autopilot.js all rough  -> a kid who pushes too hard and drives too fast
//   node tools/dev/phobos_autopilot.js 3 trace    -> prints the flight every second
global.window = global;
const S = require("../../phobos/sim.js");
const arg = process.argv[2], mode = process.argv[3];
const which = arg && arg !== "all" ? [+arg] : S.LEVELS.map((l, i) => i + 1);
for (const n of which) {
  const L = S.LEVELS[n - 1], s = S.create(L), dt = 1 / 30, mem = { rough: mode === "rough" };
  const log = [];
  while (!s.done && s.t < 400) {
    S.step(s, dt, S.bot(s, dt, mem));
    for (const e of s.events) log.push(e.type + "@" + s.t.toFixed(0));
    if (mode === "trace" && Math.abs(s.t % 1) < dt) console.log(s.t.toFixed(0).padStart(4), "x " + s.x.toFixed(0) + " y " + s.y.toFixed(0) +
      (s.kind === "land" ? " vx " + s.vx.toFixed(0) + " vy " + s.vy.toFixed(0) + " fuel " + s.fuel.toFixed(0) + " " + s.phase : s.kind === "rover" ? " v " + s.v.toFixed(0) + (s.air ? " AIR" : "") : " vy " + s.vy.toFixed(0) + (s.chute ? " chute" : "")));
  }
  console.log("L" + n, L.name.padEnd(20), s.done ? "done" : "STUCK", "t=" + s.t.toFixed(0) + "s", JSON.stringify(s.result));
  if (mode === "log" || mode === "trace" || !s.done) console.log("   ", log.join(" "));
}
