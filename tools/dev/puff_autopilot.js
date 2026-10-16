// Auto-pilot for testing Blast Racer! (not shipped).
// Open aircar/play.html?unlock=1, load this file, then:
//   puffGo(levelIndex)          start a level with the bot driving (-1 = endless); the game loop is paused
//   puffStep(frames)            advance by hand (works in hidden tabs, which the browser throttles)
//   puffBot(levelIndex)         run a whole level and return the result
// The pure physics can also be balanced in Node: require("aircar/sim.js").run(buildLevel(i), bot(), {btn}).
window.puffGo = function (lv, human) {
  const g = __prGame;
  g.loop.sleep();
  window.__pt = performance.now();
  g.scene.getScenes(true)[0].scene.start("play", { level: lv });
  puffStep(3);
  const s = g.scene.getScene("play");
  if (!human) s.autopilot = PuffSim.bot();
  return s;
};
window.puffStep = function (n) {
  const g = __prGame, F = 1000 / 60;
  for (let i = 0; i < n; i++) { __pt += F; g.step(__pt, F); }
  const s = g.scene.getScene("play");
  return s && s.sim ? { state: s.state, t: +s.sim.t.toFixed(1), x: Math.round(s.sim.x), mode: s.sim.mode, air: Math.round(s.sim.air) } : null;
};
window.puffBot = function (lv) {
  const s = puffGo(lv);
  let n = 0;
  while (s.state !== "done" && n < 60 * 240) { puffStep(1); n++; }
  const m = s.sim;
  return { lv: lv + 1, state: s.state, stars: s.stars, t: +m.t.toFixed(1), dash: +(s.dashT || 0).toFixed(1), bonks: m.bonks, smooth: m.smooth, rescues: m.rescues, bolts: m.bolts };
};
