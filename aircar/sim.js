/* Blast Racer! physics + tracks (no drawing; shared by the game and the balance bot).
   The car is a point that either rides a track surface (s = distance along it) or flies.
   Real ideas inside, kept simple:
   - Hop and Zoom push air out one way, so the car goes the other way. They use up the air tank.
   - Stick is a fan that sucks air from under the car, so the air around presses it onto the road:
     it can hold the car upside down, but while it's on the car can't hop.
   - On a loop the road only pushes back if the car is fast enough (or sticking). Otherwise it falls.
   - A blast of air downward just before touching down makes a soft landing. */
(function (root) {
  "use strict";
  const DS = 6;                 // track point spacing (px of arc length)
  const C = {
    G: 1800,                    // gravity (px/s²)
    V0: 430,                    // cruising speed the wheels hold
    VMAX: 1150,
    HOP_V: 640,                 // hop kick
    HOP_T: 2650,                // hop thrust while held in the air (a bit more than gravity, so you can hover)
    ZOOM_A: 2100,               // zoom thrust (thrusters don't need tire grip)
    STICK: 2500,                // suction (more than gravity, so it holds the car upside down)
    MU: 1.1, ENG: 2600,         // tire grip and strongest wheel push
    SOFT: 430,                  // landing faster than this = Bonk!
    MAXALT: 460,                // above this height the hop jets fade out, so Zip can't fly off the screen
    TANK: 100, HOP_COST: 10, HOLD_COST: 32, ZOOM_COST: 34, PUMP: 5,   // PUMP: Zip's little pump refills the tank while driving (per s)
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };

  /* ================================================================ TRACK BUILDER */
  class Builder {
    constructor(y0) {
      this.x = 0; this.y = y0 || 520; this.a = 0; this.phi = 0; this.base = this.y;
      this.surfs = []; this.cur = null; this.items = []; this.cps = []; this.cues = []; this.zones = [];
      this.start();
    }
    start() { this.a = 0; this.phi = 0; this.cur = { pts: [] }; this.surfs.push(this.cur); this.pt(""); return this; }
    pt(tag) { this.cur.pts.push({ x: this.x, y: this.y, a: this.a, phi: this.phi, tag }); }
    step(a, dphi, tag) { this.a = a; this.x += Math.cos(a) * DS; this.y += Math.sin(a) * DS; this.phi += dphi; this.pt(tag); }
    road(len, tag) { const n = Math.max(1, Math.round(len / DS)); for (let i = 0; i < n; i++) this.step(this.a, 0, tag || ""); return this; }
    /** deg > 0 turns upward (counter-clockwise on screen) */
    turn(R, deg, tag) {
      const tot = Math.abs(deg) * Math.PI / 180, n = Math.max(1, Math.round(R * tot / DS)), dA = -Math.sign(deg) * tot / n;
      for (let i = 0; i < n; i++) this.step(this.a + dA, 0, tag || ""); return this;
    }
    /** straight piece that rolls the road by dphi (radians) while gently climbing by rise px */
    roll(len, dphi, rise, tag) {
      const n = Math.max(2, Math.round(len / DS)), a0 = this.a;
      // heading bump so that total climb ≈ rise: dy = sum sin(a) DS
      const amp = Math.asin(clamp(-rise * Math.PI / (2 * n * DS), -0.9, 0.9));
      for (let i = 1; i <= n; i++) this.step(a0 + amp * Math.sin(Math.PI * i / n) * 1, dphi / n, tag);
      this.a = a0; return this;
    }
    end() { this.cur = null; return this; }
    jump(dx, dy) { this.x += dx; this.y += dy; return this.start(); }
    at(dx, dy) { return { x: this.x + (dx || 0), y: this.y + (dy || 0) }; }
    item(kind, dx, dy, o) { const p = this.at(dx, dy); this.items.push(Object.assign({ kind, x: p.x, y: p.y }, o || {})); }
    cp() { this.cps.push({ si: this.surfs.length - 1, s: (this.cur.pts.length - 1) * DS, x: this.x }); }
    cue(act, x, o) { this.cues.push(Object.assign({ act, x }, o || {})); }
    zone(act, x0, x1) { this.zones.push({ act, x0, x1 }); }

    /* ------------ features (each one starts with a checkpoint) */
    flat(len, deco) {
      this.cp();
      if (deco) this.row(deco, len);
      return this.road(len);
    }
    row(kind, len, h) {
      const n = Math.max(3, Math.min(7, Math.floor(len / 140)));
      for (let i = 0; i < n; i++) this.item(kind, len * (0.5 + (i - (n - 1) / 2) / (n + 1)), -(h || 50));
    }
    cones(n, gap) {
      for (let i = 0; i < n; i++) {
        this.flat(gap || 560); this.item("cone", 0, -26, { r: 26 }); this.cue("hop", this.x - 150);
        this.item("bolt", 0, -150);
      }
      return this.flat(380);
    }
    truck() {
      this.flat(640); this.item("truck", 120, -55, { r: 70, w: 210, h: 110 }); this.cue("hop", this.x - 90, { hold: 0.3 });
      for (let i = 0; i < 4; i++) this.item("bolt", -10 + i * 80, -240 - Math.sin(i / 3 * Math.PI) * 30);
      return this.flat(560);
    }
    hill(R, deg, deco) { this.cp(); if (deco) this.item(deco, R * deg / 57, -R * (1 - Math.cos(deg / 57)) - 70);
      return this.turn(R, deg).turn(R, -2 * deg).turn(R, deg).road(200); }
    gap(len, dy) {
      this.flat(520); this.item("bubble", 260, -50); this.cue("hop", this.x - 40, { hold: len > 220 ? 0.3 : 0 });
      const x0 = this.x, y0 = this.y; this.end(); this.jump(len, dy || 0);
      for (let i = 1; i <= 3; i++) this.items.push({ kind: "bolt", x: x0 + len * i / 4, y: y0 - 130 - 30 * Math.sin(i / 4 * Math.PI) + (dy || 0) * i / 4 });
      return this.flat(520);
    }
    drop(dy, dx) {
      this.flat(560); this.end(); this.jump(dx || 120, dy);
      this.item("bubble", 60, -dy / 2 - 40);
      return this.flat(700);
    }
    loop(R, how) {
      this.flat(620); const x0 = this.x;
      this.zone(how || "stick", x0 - 260, x0 + 60);
      this.item("bolt", 0, -2 * R + 40); this.item("bolt", -R * 0.7, -R); this.item("bolt", R * 0.7, -R);
      this.turn(R, 360, "loop");
      this.zone(how || "stick", x0, x0 + 40);
      return this.flat(520);
    }
    spiral(R, n) {
      this.flat(620); const x0 = this.x;
      for (let i = 0; i < n; i++) { this.item("bolt", 0, -2 * R + 40); this.turn(R, 360, "loop"); if (i < n - 1) this.road(150, "loop"); }
      this.zone("stick", x0 - 260, this.x + 40);
      return this.flat(520);
    }
    twist(len) {
      this.flat(560); const x0 = this.x;
      this.item("bolt", len * 0.25, -60); this.item("bolt", len * 0.5, 40); this.item("bolt", len * 0.75, -60);
      this.roll(len, 2 * Math.PI, 0, "twist");
      this.zone("stick", x0 - 200, this.x + 40);
      return this.flat(480);
    }
    /** the "upside-down ramp": roll onto the underside of a high road over a pit, then fall, flip and land */
    ceiling(len) {
      this.flat(560); const x0 = this.x;
      this.roll(520, Math.PI, 230, "rise");
      for (let i = 0; i < 4; i++) this.item("bolt", 120 + i * (len - 160) / 3, 48);
      this.road(len, "ceil");
      this.zone("stick", x0 - 200, this.x - 10);
      const xe = this.x; this.end(); this.jump(150, 300);
      this.item("bubble", -40, -150);
      this.cue("land", xe);
      return this.flat(700);
    }
    station() { this.flat(500); this.item("pump", 0, -70, { r: 80 }); return this.flat(400); }
    finish() { this.flat(400); this.finishX = this.x; this.road(1400); return this; }

    build() { return new Track(this); }
  }

  /* ================================================================ TRACK */
  class Track {
    constructor(b) {
      this.surfs = b.surfs.filter(s => s.pts.length > 1);
      let maxY = -1e9, minY = 1e9;
      for (const S of this.surfs) {
        const P = S.pts;
        S.len = (P.length - 1) * DS;
        for (let i = 0; i < P.length; i++) {
          const p = P[i], a = P[Math.max(0, i - 1)], c = P[Math.min(P.length - 1, i + 1)];
          p.s = i * DS; p.k = c === a ? 0 : -(c.a - a.a) / ((Math.min(P.length - 1, i + 1) - Math.max(0, i - 1)) * DS);
          maxY = Math.max(maxY, p.y); minY = Math.min(minY, p.y);
        }
      }
      this.items = b.items; this.cps = b.cps; this.cues = b.cues.sort((a, c) => a.x - c.x); this.zones = b.zones;
      this.finishX = b.finishX || (b.x - 1400); this.endX = b.x; this.maxY = maxY; this.minY = minY;
      this.floorY = maxY + 420; this.waterY = maxY + 150; this.base = b.base;
      // a pond in every gap between two roads, a little below the lower edge
      this.ponds = [];
      for (let i = 0; i < this.surfs.length - 1; i++) {
        const A = this.surfs[i].pts, a = A[A.length - 1], c = this.surfs[i + 1].pts[0];
        if (c.x > a.x + 20 && Math.cos(a.phi) > 0.5) this.ponds.push({ x0: a.x, x1: c.x, y: Math.max(a.y, c.y) + 110 });
        // under the upside-down road
        const r = A.find(p => p.tag === "rise");
        if (r && Math.cos(a.phi) < 0) this.ponds.push({ x0: r.x + 40, x1: c.x, y: c.y + 110 });
      }
      // spatial index of segments (top-facing ones only can be landed on)
      this.B = 128; this.idx = new Map();
      this.surfs.forEach((S, si) => {
        for (let i = 0; i < S.pts.length - 1; i++) {
          const p = S.pts[i], q = S.pts[i + 1];
          if (Math.cos(p.phi) < 0.5 || p.tag === "loop") continue;
          for (let k = Math.floor(Math.min(p.x, q.x) / this.B); k <= Math.floor(Math.max(p.x, q.x) / this.B); k++) {
            if (!this.idx.has(k)) this.idx.set(k, []);
            this.idx.get(k).push([si, i]);
          }
        }
      });
    }
    /** interpolated point on surface si at distance s */
    at(si, s) {
      const P = this.surfs[si].pts, f = clamp(s / DS, 0, P.length - 1.0001), i = Math.floor(f), u = f - i, p = P[i], q = P[i + 1];
      return { x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u, a: p.a + (q.a - p.a) * u, phi: p.phi + (q.phi - p.phi) * u, k: p.k, tag: p.tag };
    }
    /** distance straight down from (x,y) to the nearest top-facing road (Infinity if none) */
    below(x, y) {
      let best = Infinity;
      for (const [si, i] of this.idx.get(Math.floor(x / this.B)) || []) {
        const p = this.surfs[si].pts[i], q = this.surfs[si].pts[i + 1];
        if ((p.x - x) * (q.x - x) > 0 || p.x === q.x) continue;
        const yy = p.y + (q.y - p.y) * (x - p.x) / (q.x - p.x);
        if (yy >= y - 4) best = Math.min(best, yy - y);
      }
      return best;
    }
  }

  /* ================================================================ SIM */
  class Sim {
    constructor(track, opt) {
      opt = opt || {};
      const up = opt.up || {};
      this.T = track; this.btn = opt.btn || "hzs";
      this.cap = C.TANK + 30 * (up.tank || 0);
      this.power = 1 + 0.12 * (up.puff || 0);
      this.soft = C.SOFT + 90 * (up.soft || 0);
      this.items = track.items.map(o => Object.assign({}, o));
      this.reset();
    }
    reset() {
      this.mode = "ground"; this.si = 0; this.s = 0; this.v = 0; this.air = this.cap;
      this.x = 0; this.y = this.T.surfs[0].pts[0].y; this.vx = 0; this.vy = 0; this.ang = 0; this.roll = 0;
      this.t = 0; this.airT = 0; this.ignore = 0; this.lastSi = -1; this.cp = this.T.cps[0] || { si: 0, s: 0, x: 0 };
      this.bonks = 0; this.smooth = 0; this.rescues = 0; this.bolts = 0; this.loops = 0; this.ev = [];
      this.hopPrev = false; this.rescueT = 0; this.done = false; this.onLoop = false; this.inp = {};
      this.place();
    }
    can(k) { return this.btn.includes(k); }
    place() { const p = this.T.at(this.si, this.s); this.x = p.x; this.y = p.y; this.ang = p.a; this.roll = p.phi; this.p = p; }
    emit(type, o) { this.ev.push(Object.assign({ type, x: this.x, y: this.y }, o || {})); }

    /** inp = { hop, zoom, stick } (held). dt in seconds */
    step(dt, inp) {
      if (this.done) return;
      this.t += dt;
      inp = this.inp = { hop: !!inp.hop && this.can("h"), zoom: !!inp.zoom && this.can("z"), stick: !!inp.stick && this.can("s") };
      const hopTap = inp.hop && !this.hopPrev; this.hopPrev = inp.hop;
      this.puffing = { hop: false, zoom: false };
      if (this.mode === "rescue") {
        this.rescueT -= dt;
        if (this.rescueT <= 0) {
          this.mode = "ground"; this.si = this.cp.si; this.s = this.cp.s; this.v = C.V0 * 0.7; this.air = Math.max(this.air, this.cap * 0.6);
          this.place(); this.emit("drop");
        }
        return;
      }
      if (this.mode === "ground") this.ground(dt, inp, hopTap); else this.fly(dt, inp);
      this.touch();
      if (this.x >= this.T.finishX && !this.done) { this.done = true; this.emit("finish"); }
      for (const c of this.T.cps) if (c.x <= this.x && c.x > this.cp.x && this.mode === "ground" && this.si === c.si) this.cp = c;
    }
    use(cost) {
      if (this.air < cost) { if (!this.wasEmpty) this.emit("empty"); this.wasEmpty = true; return false; }
      this.air -= cost; this.wasEmpty = false; return true;
    }

    ground(dt, inp, hopTap) {
      const T = this.T, S = T.surfs[this.si], p = T.at(this.si, this.s);
      const tx = Math.cos(p.a), ty = Math.sin(p.a), nx = ty, ny = -tx, c = Math.cos(p.phi);
      const gt = C.G * ty;
      const N = c * (this.v * this.v * p.k - C.G * ny);
      const stick = inp.stick ? C.STICK : 0;
      this.onLoop = p.tag === "loop" || p.tag === "twist" || p.tag === "rise" || p.tag === "ceil";
      if (hopTap && !inp.stick && c > 0.3 && this.use(C.HOP_COST)) {
        this.takeoff(p, this.v * tx + nx * c * C.HOP_V * this.power, this.v * ty + ny * c * C.HOP_V * this.power);
        this.puffing.hop = true; this.emit("hop"); return;
      }
      if (N + stick < 0) { this.takeoff(p, this.v * tx, this.v * ty); return; }
      const grip = C.MU * (Math.max(N, 0) + stick);
      if (!inp.zoom) this.air = Math.min(this.cap, this.air + C.PUMP * dt);
      let aE;
      if (this.v < C.V0) aE = clamp((C.V0 - this.v) * 4 - gt, 0, Math.min(C.ENG, grip));
      else aE = -(this.v - C.V0) * 0.7;
      let aZ = 0;
      if (inp.zoom && this.use(C.ZOOM_COST * dt)) { aZ = C.ZOOM_A * this.power; this.puffing.zoom = true; }
      this.v = Math.min(C.VMAX, this.v + (gt + aE + aZ) * dt);
      if (p.tag === "loop" && this.v < 40) { this.whoops(); return; }
      this.s += this.v * dt;
      if (this.s >= S.len) { this.s = S.len; const q = T.at(this.si, this.s); this.takeoff(q, this.v * Math.cos(q.a), this.v * Math.sin(q.a)); return; }
      if (this.s < 0) { this.s = 0; this.v = Math.max(0, this.v); }
      this.place();
    }
    takeoff(p, vx, vy) {
      this.mode = "air"; this.vx = vx; this.vy = vy; this.x = p.x; this.y = p.y; this.ang = p.a; this.roll = p.phi;
      this.airT = 0; this.ignore = 0.06; this.lastSi = this.si; this.vyMax = 0; this.highSaid = false;
      if (p.tag === "loop") this.whoops();
    }
    whoops() { this.mode = "rescue"; this.rescueT = 1.3; this.rescues++; this.emit("whoops"); }

    fly(dt, inp) {
      const T = this.T;
      this.airT += dt; this.ignore -= dt;
      let ax = 0, ay = C.G;
      const cr = Math.cos(this.roll);
      if (inp.hop && this.use(C.HOLD_COST * dt)) {
        const alt = T.below(this.x, this.y), fade = alt === Infinity ? 1 : clamp((C.MAXALT - alt) / 140, 0, 1);
        const k = C.HOP_T * this.power * Math.max(0, cr * Math.cos(this.ang)) * fade;
        ay -= k; this.puffing.hop = true;
        if (fade < 0.4 && !this.highSaid) { this.highSaid = true; this.emit("high"); }
        if (this.vy < 0) this.vy *= 1 - (1 - fade) * 6 * dt;   // gently stop climbing near the top
      }
      if (inp.zoom && this.use(C.ZOOM_COST * dt)) { ax += C.ZOOM_A * 0.5 * this.power; this.puffing.zoom = true; }
      // little side thrusters (and the hop puffs) spin the car back to wheels-down
      const rr = (inp.hop && this.air > 0 ? 10 : 4.2) * dt;
      const ra = wrap(this.ang), rl = wrap(this.roll);
      this.ang = ra - clamp(ra, -rr, rr); this.roll = rl - clamp(rl, -rr, rr);
      this.vx += ax * dt; this.vy += ay * dt; this.vyMax = Math.max(this.vyMax, this.vy);
      const px = this.x, py = this.y;
      this.x += this.vx * dt; this.y += this.vy * dt;
      // land?
      if (this.vy > -1e9) {
        const cand = T.idx.get(Math.floor(this.x / T.B)) || [];
        for (const [si, i] of cand) {
          if (this.ignore > 0 && si === this.lastSi) continue;
          const P = T.surfs[si].pts, p = P[i], q = P[i + 1];
          const tx = (q.x - p.x) / DS, ty = (q.y - p.y) / DS, nx = ty, ny = -tx;
          const d0 = (px - p.x) * nx + (py - p.y) * ny, d1 = (this.x - p.x) * nx + (this.y - p.y) * ny;
          const u = (this.x - p.x) * tx + (this.y - p.y) * ty;
          if (d0 >= -3 && d1 < 0 && u >= -3 && u <= DS + 3 && this.vx * nx + this.vy * ny < 0) { this.land(si, i * DS + clamp(u, 0, DS), tx, ty, nx, ny); return; }
        }
      }
      const pond = T.ponds.find(w => this.x > w.x0 && this.x < w.x1 && this.y > w.y + 10);
      if (pond || this.y > T.floorY) { this.mode = "rescue"; this.rescueT = 1.3; this.rescues++; this.emit("splash", { y: pond ? pond.y : T.waterY }); }
    }
    land(si, s, tx, ty, nx, ny) {
      const vn = -(this.vx * nx + this.vy * ny), vt = this.vx * tx + this.vy * ty;
      const dA = Math.abs(wrap(this.ang - Math.atan2(ty, tx))), dR = Math.abs(wrap(this.roll));
      this.mode = "ground"; this.si = si; this.s = s;
      if (vn > this.soft || dA > 0.9 || dR > 0.9) {
        this.v = Math.max(vt * 0.5, 140); this.bonks++; this.emit("bonk");
      } else {
        this.v = vt;
        if (this.vyMax > this.soft) { this.smooth++; this.bolts += 2; this.emit("smooth"); }
      }
      this.place();
    }
    /** things on the track */
    touch() {
      if (this.mode === "rescue") return;
      const ux = Math.sin(this.ang) * Math.cos(this.roll), uy = -Math.cos(this.ang) * Math.cos(this.roll);
      const cx = this.x + ux * 28, cy = this.y + uy * 28;
      for (const o of this.items) {
        if (o.gone || Math.abs(o.x - cx) > 160) continue;
        if (o.kind === "pump") { if (Math.abs(o.x - cx) < 60) { o.gone = true; this.air = this.cap; this.emit("refill", { x: o.x, y: o.y }); } continue; }
        if (o.kind === "truck") {
          if (Math.abs(cx - o.x) < o.w / 2 + 34 && Math.abs(cy - o.y) < o.h / 2 + 12) { o.gone = true; this.bump(o); }
          continue;
        }
        const r = (o.r || 24) + 30;
        if ((o.x - cx) ** 2 + (o.y - cy) ** 2 > r * r) continue;
        o.gone = true;
        if (o.kind === "cone") this.bump(o);
        else if (o.kind === "bolt") { this.bolts++; this.emit("bolt", { x: o.x, y: o.y }); }
        else if (o.kind === "bubble") { this.air = Math.min(this.cap, this.air + 22); this.emit("bubble", { x: o.x, y: o.y }); }
      }
    }
    bump(o) {
      this.bonks++; this.emit("bonk", { x: o.x, y: o.y, item: o });
      if (this.mode === "ground") this.v = Math.min(this.v, 200); else { this.vx *= 0.5; this.vy = Math.min(this.vy, 0) * 0.3; }
    }
    progress() { return clamp(this.x / this.T.finishX, 0, 1); }
  }

  /* ================================================================ LEVELS */
  const LEVELS = [
    { name: "First Blasts", btn: "h", tip: "Tap ⬆ HOP. Action: air blasts down. Reaction: Zip jumps up! Hop over the cones.",
      fact: "Action and reaction: Zip pushes air down, and the air pushes Zip up. That's how it hops!", dash: 1.18,
      build: b => b.flat(900, "bolt").cones(3).flat(500, "bubble").gap(170).cones(2, 520).flat(500, "bolt").gap(200).cones(2).finish() },
    { name: "Hop the Trucks", btn: "h", tip: "Big trucks ahead! Tap HOP, then keep holding it to fly higher.",
      fact: "At the real show, the car hopped over a pickup truck and a big semi truck!", dash: 1.14,
      build: b => b.flat(700, "bolt").truck().hill(500, 14, "bolt").gap(220).truck().flat(400, "bubble").cones(2).station().truck().gap(240).finish() },
    { name: "Soft Landing", btn: "h", tip: "Falling fast? Hold HOP just before you land to slow down. Smooth landings give extra 🔩!",
      fact: "Action and reaction again: air pushed down pushes Zip up and slows the fall. Some rockets land this way too.", dash: 1.12,
      build: b => b.flat(700, "bolt").drop(220).cones(1).drop(300).flat(400, "bubble").gap(200).drop(360).truck().drop(300).finish() },
    { name: "Zoom!", btn: "hz", tip: "Hold ➡ ZOOM. Action: air blasts out the back. Reaction: Zip zooms forward! Go fast to make it around the loop.",
      fact: "Action and reaction: push air back, go forward! A balloon does the same thing when you let it go.", dash: 1.12,
      build: b => b.flat(800, "bolt").hill(700, 16, "bolt").cones(1).station().loop(240, "zoom").gap(240).hill(700, 18).station().loop(240, "zoom").drop(260).finish() },
    { name: "Stick to It", btn: "hzs", tip: "Hold 🌀 STICK on loops and twisty roads. The fan sucks air from under Zip, so the air around presses it onto the road!",
      fact: "The real car's fans suck air from under it so hard that it can hang upside down.", dash: 1.1,
      build: b => b.flat(800, "bolt").loop(240).cones(1).twist(900).flat(400, "bubble").gap(220).loop(240).twist(1000).drop(260).finish() },
    { name: "Upside-Down Run", btn: "hzs", tip: "Hold STICK to drive upside down! When the road ends, let go and hold HOP to flip and land.",
      fact: "At the show, the real car drove up an upside-down ramp, flipped, and landed. Wow!", dash: 1.1,
      build: b => b.flat(800, "bolt").ceiling(900).cones(1).station().loop(240).ceiling(1100).gap(220).finish() },
    { name: "Spiral Mountain", btn: "hzs", tip: "A spiral is loop after loop. Keep holding STICK all the way through!",
      fact: "Inside a loop, the road pushes on the car. That push is what keeps it going around.", dash: 1.08,
      build: b => b.flat(800, "bolt").spiral(200, 2).drop(260).twist(900).station().spiral(200, 3).gap(240).hill(700, 18, "bolt").ceiling(900).finish() },
    { name: "Grand Blast Prix", btn: "hzs", tip: "Everything at once! Watch your 💨 air, and grab bubbles and pumps.",
      fact: "The real car's tanks hold about 600 liters of squeezed air. When it runs out, it has to be filled up again.", dash: 1.06,
      build: b => b.flat(700, "bolt").cones(2).loop(240).truck().station().ceiling(1000).twist(900).gap(260).spiral(200, 2).station().drop(320).truck().loop(240).ceiling(1100).finish() },
  ];
  const ENDLESS_PARTS = [
    b => b.cones(2), b => b.truck(), b => b.gap(200 + Math.random() * 80), b => b.drop(220 + Math.random() * 120),
    b => b.loop(240), b => b.twist(900), b => b.ceiling(900 + Math.random() * 300), b => b.spiral(200, 2),
    b => b.hill(700, 16, "bolt"), b => b.flat(600, "bolt"),
  ];
  function buildLevel(i) {
    const b = new Builder();
    if (i < 0) {   // endless: a long random track, with a pump every few parts
      b.flat(800, "bolt");
      for (let k = 0; k < 60; k++) { ENDLESS_PARTS[Math.floor(Math.random() * ENDLESS_PARTS.length)](b); if (k % 4 === 3) b.station(); }
      b.finish();
    } else LEVELS[i].build(b), b.finishX || b.finish();
    return b.build();
  }

  /* ================================================================ BOT (balance tests + Dash's racing line) */
  function bot(opts) {
    opts = opts || {};
    const late = opts.late || 0;
    let hold = 0;
    return sim => {
      const T = sim.T, x = sim.x, inp = { hop: false, zoom: false, stick: false };
      for (const z of T.zones) if (x >= z.x0 && x <= z.x1) inp[z.act] = true;
      if (sim.mode === "ground" && sim.onLoop) inp[sim.can("s") ? "stick" : "zoom"] = true;
      if (sim.mode === "ground") {
        hold = 0;
        for (const c of T.cues) if (c.act === "hop" && x >= c.x + late && x < c.x + late + 12) { inp.hop = true; hold = c.hold || 0; }
      } else if (sim.mode === "air") {
        if (hold > 0) { hold -= 1 / 120; inp.hop = true; }
        const d = T.below(x, sim.y), vy = sim.vy;
        if (sim.vyMax > sim.soft * 0.85 && vy > 200 && d < vy * vy / (2 * 800) + 40) inp.hop = true;
        if (Math.abs(wrap(sim.roll)) > 0.3 && sim.vy > 0) inp.hop = true;
        inp.stick = false;
      }
      if (inp.stick) inp.hop = false;
      return inp;
    };
  }
  /** run a whole level with a pilot; returns stats and (optionally) a recorded path */
  function run(track, pilot, opt) {
    opt = opt || {};
    const sim = new Sim(track, opt), dt = 1 / 120, rec = [];
    let n = 0;
    while (!sim.done && n < (opt.max || 120 * 240)) {
      sim.step(dt, pilot(sim)); n++;
      if (opt.rec && n % 2 === 0) rec.push([sim.x, sim.y, sim.ang, sim.roll, sim.mode === "rescue" ? 1 : 0]);
    }
    return { t: sim.t, done: sim.done, bonks: sim.bonks, smooth: sim.smooth, rescues: sim.rescues, bolts: sim.bolts, air: sim.air, rec, sim };
  }

  const API = { C, DS, Builder, Track, Sim, LEVELS, buildLevel, bot, run, wrap };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.PuffSim = API;
})(typeof window !== "undefined" ? window : globalThis);
