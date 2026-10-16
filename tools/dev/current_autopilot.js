// Auto-pilot for balance testing Ride the Current! (not shipped).
// Open currents/play.html?unlock=1&speed=3, load this file, then: simBot(levelIndex)   (-1 = endless)
// simBot steps the Phaser game by hand (so it runs even when the browser throttles hidden tabs) and
// plays like a careful kid: stays in the helpful current, taps bags/bottles near Mo, dodges nets and boats,
// cuts rescue knots and uses Turbo. Returns time, par, hits (with reasons), stars.
window.botPilot = function (opts) {
  opts = opts || {};
  const reach = opts.reach || 260;
  return sc => {
    const mo = sc.mo, L = sc.L, sd = sc.s;
    // 1) target: the helpful lane centre a little ahead
    const ay = mo.y + sd * 220, p = sc.prog(ay);
    let tx = mo.x, best = 1e9;
    for (const ln of L.lanes) {
      if (ln.v <= 0 || (ln.p && (p < ln.p[0] || p > ln.p[1]))) continue;
      const x = sc.laneX(ln, p, ay); if (Math.abs(x - mo.x) < best) { best = Math.abs(x - mo.x); tx = x; }
    }
    let vx = (tx - mo.x) / 120, vy = sd;
    // eddies: steer around the middle
    for (const E of sc.eddies) { const dy = (E.y - mo.y) * sd; if (dy > -60 && dy < 320 && Math.abs(E.x - mo.x) < E.r) vx += (mo.x < E.x ? -1 : 1) * 1.2; }
    // 2) tap trash near Mo (like a kid would), avoid nets and logs, grab seagrass
    for (const o of sc.things) {
      if (o.dead) continue;
      const dx = o.spr.x - mo.x, dy = (o.spr.y - mo.y) * sd, d = Math.hypot(dx, dy);
      if (o.T.tap && d < reach && dy > -40 && Math.random() < (opts.tapRate || 0.12)) sc.tapAt(o.spr.x, o.spr.y);
      if ((o.T.hurt || o.T.bonk) && dy > -30 && dy < 260 && Math.abs(dx) < o.T.size * 0.5 + 60) vx += (dx > 0 ? -1 : 1) * 1.5;
      if (o.T.food && dy > 0 && dy < 300 && Math.abs(dx) < 120) vx += dx / 120;
    }
    // 3) boats come down a red lane: swim sideways out of it
    if (sc.boatWarn != null && Math.abs(mo.x - sc.boatWarn) < 150) vx = (mo.x < sc.boatWarn ? -1 : 1) * 2.5 * (Math.abs(sc.boatWarn - (sc.xMin + sc.xMax) / 2) > 150 && (mo.x < sc.boatWarn) === (sc.boatWarn < (sc.xMin + sc.xMax) / 2) ? -1 : 1);
    // 4) rescue: cut knots, one every few frames
    if (sc.rescue && sc.rescue.knots.length && Math.random() < 0.05) { const k = sc.rescue.knots[0]; sc.tapAt(k.x, k.y); }
    if (sc.turbo >= 100 && !sc.rescue && Math.random() < 0.02) sc.goTurbo();
    const m = Math.hypot(vx, vy); return { x: vx / Math.max(1, m), y: vy / Math.max(1, m) };
  };
};
window.simBot = function (lv, opts) {
  opts = opts || {};
  const g = __rcGame, F = 1000 / 60;
  g.loop.sleep();
  let t = performance.now();
  const step = n => { for (let i = 0; i < n; i++) { t += F; g.step(t, F); } };
  g.scene.getScenes(true)[0].scene.start('play', { level: lv });
  step(3);
  const s = g.scene.getScene('play');
  s.autopilot = botPilot(opts);
  let n = 0;
  while (s.state !== 'done' && n < (opts.maxSteps || 9000)) {
    step(1); n++;
    if (s.L.endless && s.km() >= (opts.km || 8)) s.finish(false);
  }
  const stars = s.sv && !s.L.endless ? (s.hearts > 0 ? 1 + (s.hits <= 1) + (s.t <= s.par()) : 0) : '-';
  return { lv: lv + 1, state: s.state, stars, t: Math.round(s.t), par: s.L.endless ? '-' : s.par(), hits: s.hits, why: (s.hurtLog || []).join(','),
    hearts: s.hearts, shells: s.shells, friends: s.friends, scooped: s.scooped, km: s.L.endless ? s.km() : undefined, steps: n };
};
