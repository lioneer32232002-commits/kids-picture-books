// Auto-player for balance testing. Usage in page: await autoplay(levelIndex, foodRate)
window.autoplay = async function (lv, foodRate = 0.5, spd = 4) {
  const G = __bdGame; G.scene.start('game', { level: lv });
  await new Promise(r => setTimeout(r, 600));
  const s = G.scene.getScene('game');
  s.speed = spd; s.tweens.timeScale = spd;
  const P = s.path, pads = s.pads.map(p => { let c = 0; for (let d = 0; d < P.len; d += 10) { const [x, y] = P.at(d); if (Math.hypot(x - p.x, y - p.y) < 135) c++; } return { p, c }; }).sort((a, b) => b.c - a.c);
  const order = s.L.towers;
  let i = 0;
  const think = () => {
    // eat food (kid taps some of it)
    s.foods.forEach(f => { if (!f.seen) { f.seen = 1; if (!f.F.junk && Math.random() < foodRate) s.eat(f); } });
    // build or upgrade
    for (const { p } of pads) {
      if (!p.tower) {
        const want = order[i % order.length], T = s.L.towers.includes('tcell') && i % 4 === 3 ? 'tcell' : want;
        const k = BodyDefenders.TOWERS[T] ? T : want;
        if (s.energy >= BodyDefenders.TOWERS[k].cost) { s.build(p, k); i++; }
        return;
      }
    }
    const t = s.towers.filter(t => t.lvl < 3).sort((a, b) => a.lvl - b.lvl)[0];
    if (t && s.energy >= t.T.ups[t.lvl - 1]) { s.energy -= t.T.ups[t.lvl - 1]; t.spent += t.T.ups[t.lvl - 1]; t.lvl++; }
  };
  s.nextWave();
  const t0 = Date.now();
  while (!s.ended && Date.now() - t0 < 240000) {
    think();
    if (s.state === 'break' && s.breakT < 7) s.nextWave();
    await new Promise(r => setTimeout(r, 120));
  }
  return { lv: lv + 1, ended: s.ended, lives: s.lives, wave: s.wave, towers: s.towers.map(t => t.k[0] + t.lvl).join(','), energy: Math.round(s.energy) };
};
'ok';
