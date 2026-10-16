// Auto-pilot for balance testing Space Clean-Up (not shipped). await bot(levelIndex, lenSeconds)
window.bot = async function (lv, len) {
  __scGame.scene.getScenes(true)[0].scene.start('play', { level: lv }); await new Promise(r => setTimeout(r, 700));
  const s = __scGame.scene.getScene('play'); s.L = Object.assign({}, s.L, { len: len || s.L.len });
  if (len) s.eliteQ = (s.L.elites || []).filter(([t]) => t < len - 5).map(([t, k]) => ({ t: t * len / LEVLEN(lv), k }));
  const t0 = Date.now();
  while (s.state !== 'done' && Date.now() - t0 < 200000) {
    const sh = s.ship; let tx = sh.x;
    const threats = s.objs.filter(o => o.O.big && o.spr.y < sh.y && o.spr.y > sh.y - 260 && Math.abs(o.spr.x - sh.x) < o.O.size * 0.5 + 40)
      .concat(s.shards.filter(d => d.spr.y < sh.y + 20 && d.spr.y > sh.y - 220 && Math.abs(d.spr.x - sh.x) < 60).map(d => ({ spr: d.spr })))
      .concat(s.elites.filter(e => e.phase === 'out' && Math.abs(e.spr.x - sh.x) < e.E.size * 0.5 + 40).map(e => ({ spr: e.spr })));
    if (threats.length) { const o = threats[0]; tx = o.spr.x < sh.x ? sh.x + 140 : sh.x - 140; }
    else {
      const el = s.elites.find(e => e.phase === 'stay');
      const tgt = el || s.objs.filter(o => o.spr.y < sh.y - 200).sort((a, b) => b.spr.y - a.spr.y)[0] || (s.boss && !s.boss.dead ? { spr: s.boss.spr } : null);
      if (tgt) tx = tgt.spr.x;
    }
    for (const c of s.comets) if (Math.abs(c.spr.x - sh.x) < 110) tx = c.spr.x < 360 ? 600 : 120;
    sh.x += Phaser.Math.Clamp(tx - sh.x, -40, 40); sh.x = Phaser.Math.Clamp(sh.x, 40, 680);
    if (s.burst >= 100 && (s.objs.length > 6 || s.elites.length)) s.starBurst();
    await new Promise(r => setTimeout(r, 60));
  }
  return { lv: lv + 1, state: s.state, hearts: s.hearts, hits: s.hits, dust: s.dust, power: s.power, t: Math.round((Date.now() - t0) / 1000) };
};
window.LEVLEN = lv => SpaceCleanUp.LEVELS[lv].len;
