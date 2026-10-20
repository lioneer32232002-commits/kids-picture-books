// Open paris/play.html?unlock=1&bot=1, load this file, then: cathBot(levelIndex, seconds)   (-1 = Free Build)
// Steps the Phaser game by hand (works even when the browser throttles a hidden tab). With &bot=1 the
// sim's Bot plays (drops stones, places buttresses, puts gargoyles on gutters). Returns the sim state;
// pass `stopAt` (a phase name) to stop early and screenshot that moment.
window.cathBot = function (lv, secs, stopAt) {
  const g = __cbGame, F = 1000 / 60;
  g.loop.sleep();
  let t = performance.now();
  const step = n => { for (let i = 0; i < n; i++) { t += F; g.step(t, F); } };
  if (lv !== undefined && lv !== null) { g.scene.getScenes(true).forEach(x => x.scene.stop()); step(1); g.scene.start('play', { level: lv }); step(3); }
  const s = g.scene.getScene('play');
  let n = 0;
  while (!s.sim.done && n < (secs || 120) * 60 && s.sim.phase !== stopAt) { step(1); n++; }
  step(2);
  const m = s.sim;
  return { lv: lv + 1, phase: m.phase, t: Math.round(m.t), stars: m.stars, score: m.score, neat: +m.neatness().toFixed(2), dry: +m.dryness().toFixed(2), misses: m.misses };
};
window.cathStep = function (frames) { const g = __cbGame, F = 1000 / 60; let t = performance.now(); for (let i = 0; i < frames; i++) { t += F; g.step(t, F); } };
// The canvas looks blank while the loop sleeps; cathShot() copies the last frame into an <img> on top of it.
window.cathShot = function () {
  const pr = new Promise(r => __cbGame.renderer.snapshot(img => {
    let o = document.getElementById('__shot');
    if (!o) { o = document.createElement('img'); o.id = '__shot'; o.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:9'; const box = document.getElementById('game'); box.style.position = 'relative'; box.appendChild(o); }
    o.src = img.src; o.onload = () => r('ok');
  }));
  cathStep(1);   // the snapshot is taken after the next frame is drawn
  return pr;
};
