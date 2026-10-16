/* Simplified map of the seas around Taiwan, shared by the book (SVG) and the game (Phaser).
   Coordinates are [longitude, latitude]. Coastlines are hand-simplified from real positions
   and smoothed when drawn, so they're cute but in the right places. */
(function () {
  "use strict";
  const BOX = { w: 116.5, e: 125.5, s: 18.8, n: 27.5 };
  const KX = Math.cos(23.5 * Math.PI / 180);   // longitude shrink at Taiwan's latitude

  const ring = (lon, lat, rx, ry, n) => {
    const pts = [];
    for (let i = 0; i < (n || 10); i++) {
      const a = i / (n || 10) * Math.PI * 2, wob = 1 + 0.12 * Math.sin(a * 3 + lon);
      pts.push([lon + Math.cos(a) * rx * wob, lat + Math.sin(a) * (ry || rx) * wob]);
    }
    return pts;
  };

  const LAND = {
    taiwan: [[121.53, 25.30], [121.74, 25.16], [121.92, 25.05], [122.0, 25.0], [121.86, 24.86], [121.83, 24.66],
      [121.86, 24.56], [121.74, 24.30], [121.62, 24.0], [121.5, 23.6], [121.4, 23.18], [121.18, 22.78], [120.95, 22.44],
      [120.87, 22.08], [120.84, 21.9], [120.74, 21.93], [120.7, 22.1], [120.6, 22.34], [120.43, 22.5], [120.28, 22.62],
      [120.17, 22.95], [120.12, 23.2], [120.15, 23.45], [120.2, 23.75], [120.36, 24.06], [120.48, 24.27], [120.62, 24.48],
      [120.82, 24.72], [120.96, 24.9], [121.06, 25.05], [121.24, 25.12], [121.4, 25.18]],
    china: [[116.0, 28.2], [121.2, 28.2], [121.0, 27.6], [120.6, 27.0], [120.2, 26.6], [119.65, 26.3], [119.5, 25.9],
      [119.6, 25.5], [119.2, 25.2], [118.9, 24.9], [118.6, 24.6], [118.1, 24.45], [117.8, 24.1], [117.4, 23.7],
      [117.0, 23.45], [116.6, 23.2], [116.0, 23.0]],
    luzon: [[120.2, 18.0], [120.3, 18.45], [120.6, 18.62], [121.1, 18.6], [121.6, 18.38], [122.15, 18.52], [122.4, 18.1], [122.4, 17.6]],
    penghu: ring(119.58, 23.57, 0.13, 0.15, 12),
    lanyu: ring(121.55, 22.04, 0.06, 0.05),
    green: ring(121.49, 22.66, 0.04, 0.035),
    turtle: ring(121.95, 24.84, 0.035, 0.025),
    liuqiu: ring(120.37, 22.34, 0.03, 0.025),
    matsu: ring(119.95, 26.16, 0.05, 0.04),
    kinmen: ring(118.38, 24.44, 0.08, 0.05),
    batanes: ring(121.97, 20.45, 0.05, 0.08),
    babuyan: ring(121.95, 19.5, 0.07, 0.06),
    yonaguni: ring(122.99, 24.45, 0.06, 0.035),
    iriomote: ring(123.82, 24.33, 0.13, 0.09),
    ishigaki: ring(124.18, 24.42, 0.1, 0.07),
    miyako: ring(125.3, 24.78, 0.09, 0.06),
  };

  // Currents. pts run in the direction of flow. warm: true = warm water, false = cold.
  // seasons: which seasons the arrow is shown in. strength: 1 = strong, 0.5 = weak.
  const CURRENTS = {
    kuroshio: { name: "Kuroshio", warm: true, seasons: ["summer", "winter"], strength: 1,
      pts: [[122.7, 18.8], [122.35, 19.8], [121.98, 20.8], [121.8, 21.6], [121.85, 22.4], [121.95, 23.2], [122.05, 24.0],
        [122.3, 24.6], [122.8, 25.0], [123.6, 25.4], [124.5, 25.85], [125.5, 26.3]] },
    coastal: { name: "China Coastal Current", warm: false, seasons: ["winter"], strength: 0.8,
      pts: [[121.1, 27.4], [120.6, 26.8], [120.1, 26.3], [119.95, 25.6], [119.55, 25.1], [119.0, 24.6], [118.4, 24.1], [117.9, 23.6], [117.4, 23.1]] },
    straitWinter: { name: "Warm water (weak)", warm: true, seasons: ["winter"], strength: 0.45,
      pts: [[119.9, 22.6], [119.95, 23.2], [119.95, 23.8], [120.2, 24.4], [120.65, 25.0], [121.3, 25.6]] },
    scs: { name: "South China Sea Warm Current", warm: true, seasons: ["summer"], strength: 0.85,
      pts: [[117.4, 21.0], [118.5, 21.8], [119.4, 22.5], [119.92, 23.2], [119.98, 23.9], [120.25, 24.5], [120.75, 25.1], [121.4, 25.8], [122.0, 26.6]] },
  };

  const PLACES = {
    taiwan: { name: "Taiwan", at: [120.95, 23.65], big: true },
    china: { name: "China", at: [117.6, 25.9], big: true },
    luzon: { name: "Philippines", at: [120.7, 19.1] },
    japan: { name: "to Japan ➜", at: [124.4, 26.55] },
    pacific: { name: "Pacific Ocean", at: [124.0, 21.4], sea: true },
    strait: { name: "Taiwan Strait", at: [119.0, 24.15], sea: true, rot: -52 },
    scsea: { name: "South China Sea", at: [117.9, 20.3], sea: true },
    ecsea: { name: "East China Sea", at: [123.2, 27.05], sea: true },
    penghu: { name: "Penghu", at: [119.58, 23.57], dot: true },
    lanyu: { name: "Orchid Island", at: [121.55, 22.04], dot: true },
    green: { name: "Green Island", at: [121.49, 22.66], dot: true },
    turtle: { name: "Turtle Island", at: [121.95, 24.84], dot: true },
    hualien: { name: "Hualien", at: [121.6, 23.98], dot: true },
    keelung: { name: "Keelung", at: [121.74, 25.14], dot: true },
    kaohsiung: { name: "Kaohsiung", at: [120.28, 22.62], dot: true },
    taichung: { name: "Taichung", at: [120.5, 24.25], dot: true },
    matsu: { name: "Matsu", at: [119.95, 26.16], dot: true },
    yonaguni: { name: "Yonaguni", at: [122.99, 24.45], dot: true },
  };

  /** project lon/lat into a box of width w (height follows the map's shape) */
  function projector(w, pad) {
    pad = pad || 0;
    const sx = (w - pad * 2) / ((BOX.e - BOX.w) * KX);
    const h = (BOX.n - BOX.s) * sx + pad * 2;
    const f = ([lon, lat]) => [pad + (lon - BOX.w) * KX * sx, pad + (BOX.n - lat) * sx];
    f.w = w; f.h = h; f.scale = sx;
    return f;
  }

  /** Catmull-Rom smoothing; closed for land, open for currents */
  function smooth(pts, closed, steps) {
    const n = pts.length, out = [], S = steps || 6;
    const P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let k = 0; k < S; k++) {
        const t = k / S, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }

  /** point at fraction t (0..1) along a polyline, plus heading in radians */
  function along(pts, t) {
    const seg = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
    let want = Math.max(0, Math.min(1, t)) * total;
    for (let i = 0; i < seg.length; i++) {
      if (want <= seg[i] || i === seg.length - 1) {
        const k = seg[i] ? Math.min(1, want / seg[i]) : 0, a = pts[i], b = pts[i + 1];
        return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
      }
      want -= seg[i];
    }
    return { x: pts[0][0], y: pts[0][1], ang: 0 };
  }

  window.TaiwanGeo = { BOX, LAND, CURRENTS, PLACES, projector, smooth, along };
})();
