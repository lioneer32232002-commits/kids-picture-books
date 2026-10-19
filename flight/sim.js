/* Sky Pilot! flight physics, world and missions, with no drawing (runs in Node too).
   A kid-sized version of how a real small plane flies:
   - LIFT grows with speed x speed and with the wing's tilt (angle of attack). Too slow = not enough lift.
   - THRUST from the propeller, DRAG from the air, WEIGHT pulls down.
   - FLAPS give more lift when slow, WHEELS DOWN and flaps add drag.
   The stick works like a helpful fly-by-wire: let go and Poppy flies level with wings level,
   pull back to climb, push to go down, tilt to turn. A helper keeps the wing from stalling,
   so if Poppy is too slow it just sinks gently and says "Too slow!".
   World: x = east, y = up, z = north (meters). Heading 0 = north, turning right = positive. */
(function (root) {
  "use strict";
  const G = 9.8, D2R = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const approach = (v, t, r) => v < t ? Math.min(t, v + r) : Math.max(t, v - r);

  const K = {
    KL: 0.0125,          // lift = KL * V^2 * CL   (m/s^2)
    CL0: 0.3, CLA: 5.0,  // lift coefficient at zero tilt, and per radian of tilt
    FLAP_CL: 0.4,
    ALPHA_MAX: 0.24,     // the helper never lets the wing tilt more than this (stall at ~0.27)
    KD: 0.0011, GEAR_D: 0.00025, FLAP_D: 0.0006, KI: 0.05,
    TMAX: 4.6,           // full throttle push (m/s^2)
    ROLL: 0.7,           // max bank (rad), about 40 degrees
    ROLL_RATE: 1.4, PITCH_RATE: 0.7,
    GAMMA_MAX: 0.33,     // the steepest climb or dive the stick asks for (about 19 degrees)
    FRICTION: 0.5, BRAKE: 4.0,
    LIFTOFF_MIN: 18,     // the tail elevator can't lift the nose below this speed
  };
  const KMH = 3.6;

  /* ------------------------------------------------------------ world */
  // Islands are flat polygons [x, z]; everything else is sea.
  const blob = (cx, cz, r, n, wob, seed) => {
    const p = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const k = 1 + wob * (Math.sin(a * 3 + seed) * 0.5 + Math.sin(a * 5 + seed * 2) * 0.3 + Math.sin(a * 2 + seed * 3) * 0.2);
      p.push([cx + Math.sin(a) * r * k, cz + Math.cos(a) * r * k * 1.25]);
    }
    return p;
  };
  const ISLANDS = [
    { name: "Sunny Island", pts: blob(0, 300, 2100, 40, 0.18, 1.3), color: 0x8fd16a },
    { name: "Palm Island", pts: blob(1700, 4600, 800, 28, 0.2, 4.1), color: 0x9bd66f },
    { name: "Little Rock", pts: blob(-1900, 3900, 380, 20, 0.25, 2.2), color: 0xa7d27a },
  ];
  // runways: centre, heading (deg), length, width
  const RUNWAYS = [
    { name: "Sunny Airport", x: 0, z: 0, hdg: 0, len: 760, wid: 30 },
    { name: "Palm Airport", x: 1700, z: 4600, hdg: 30, len: 640, wid: 28 },
  ];
  const BOUNDS = 7500;

  function inPoly(x, z, pts) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, zi] = pts[i], [xj, zj] = pts[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
    }
    return c;
  }
  function runwayLocal(rw, x, z) {   // along = forward distance from centre, across = sideways
    const h = rw.hdg * D2R, dx = x - rw.x, dz = z - rw.z;
    return { along: dx * Math.sin(h) + dz * Math.cos(h), across: dx * Math.cos(h) - dz * Math.sin(h) };
  }
  function surface(x, z) {
    for (const rw of RUNWAYS) {
      const l = runwayLocal(rw, x, z);
      if (Math.abs(l.along) <= rw.len / 2 && Math.abs(l.across) <= rw.wid / 2 + 4) return { kind: "runway", rw };
    }
    for (const is of ISLANDS) if (inPoly(x, z, is.pts)) return { kind: "grass", is };
    return { kind: "sea" };
  }
  // point on a runway: t = -1 start end ... +1 far end
  function runwayPoint(rw, t, side) {
    const h = rw.hdg * D2R, a = t * rw.len / 2, s = side || 0;
    return { x: rw.x + Math.sin(h) * a + Math.cos(h) * s, z: rw.z + Math.cos(h) * a - Math.sin(h) * s };
  }

  /* ------------------------------------------------------------ plane */
  function newPlane(o) {
    return Object.assign({
      x: 0, y: 0, z: 0, psi: 0, theta: 0, phi: 0, gamma: 0, V: 0,
      onGround: true, master: false, engine: false, spin: 0, throttle: 0, brake: false,
      flaps: 0, flapsCmd: 0,              // flaps move slowly to the lever's notch: 0 = UP, 0.4 = 10 deg, 1 = 30 deg
      gear: true, gearCmd: true, gearPos: 1,   // gearPos 1 = down and locked (3 green lights), 0 = tucked up
      alpha: 0, lift: 0, slow: 0, airTime: 0, t: 0, stickX: 0, stickY: 0,
    }, o || {});
  }
  function liftCoef(p, alpha) { return K.CL0 + K.CLA * alpha + p.flaps * K.FLAP_CL; }
  function dragOf(p, cl) {
    return (K.KD + p.gearPos * K.GEAR_D + p.flaps * K.FLAP_D) * p.V * p.V + K.KI * K.KL * p.V * p.V * cl * cl;
  }

  /** One physics step. input: { x, y } stick (-1..1, y = +1 pull back), plus p.throttle/flaps/gear/brake.
      Returns an event ("liftoff", "touchdown") or null. */
  function step(p, input, dt) {
    p.t += dt;
    const sx = clamp(input.x || 0, -1, 1), sy = clamp(input.y || 0, -1, 1);
    p.stickX = sx; p.stickY = sy;
    p.spin = approach(p.spin, p.engine ? 1 : 0, dt / 1.2);
    if (p.onGround) p.gearCmd = true;                       // squat switch: the wheels can't fold up on the ground
    p.gearPos = approach(p.gearPos, p.gearCmd ? 1 : 0, dt / 4);   // about 4 seconds to swing up or down
    p.gear = p.gearPos >= 1;
    p.flaps = approach(p.flaps, p.flapsCmd, dt / 3.5);
    const thrust = p.throttle * K.TMAX * p.spin;
    let ev = null;

    if (p.onGround) {
      // rolling on the runway: the nose wheel steers, the stick can lift the nose once fast enough
      const tgt = p.V > K.LIFTOFF_MIN ? Math.max(0, sy) * 0.17 : 0;
      p.theta = approach(p.theta, tgt, 0.35 * dt);
      p.phi = approach(p.phi, 0, dt);
      p.gamma = 0; p.alpha = p.theta;
      p.psi += sx * 0.35 * Math.min(1, p.V / 8) * dt;
      const cl = liftCoef(p, p.alpha);
      p.lift = K.KL * p.V * p.V * cl;
      const fr = p.V > 0.05 ? K.FRICTION + (p.brake ? K.BRAKE : 0) : 0;
      p.V = Math.max(0, p.V + (thrust - dragOf(p, cl) * 0.5 - fr) * dt);
      if (!p.engine && p.V < 0.05) p.V = 0;
      if (p.lift > G * 1.02 && p.V > K.LIFTOFF_MIN) { p.onGround = false; p.gamma = 0.02; p.airTime = 0; ev = "liftoff"; }
    } else {
      p.airTime += dt;
      // the stick asks for a climb or dive angle; let go = fly level
      let gCmd = sy * K.GAMMA_MAX;
      if (Math.abs(sy) < 0.05 && p.airTime < 10 && p.y < 60) gCmd = 0.09;   // just after take-off: keep climbing gently
      if (p.V < 14) gCmd = Math.min(gCmd, -0.25);                              // nearly stopped in the air: nose goes down
      // roll: tilt to turn, let go = wings level
      p.phi = approach(p.phi, sx * K.ROLL, K.ROLL_RATE * dt);
      // how much lift do we need to bend the path toward gCmd?
      const kq = 1.3, cosPhi = Math.cos(p.phi);
      const needL = (G * Math.cos(p.gamma) + p.V * kq * (gCmd - p.gamma)) / Math.max(0.35, cosPhi);
      const V2 = Math.max(1, p.V * p.V);
      let aNeed = (needL / (K.KL * V2) - K.CL0 - p.flaps * K.FLAP_CL) / K.CLA;
      const limited = aNeed > K.ALPHA_MAX;
      aNeed = clamp(aNeed, -0.15, K.ALPHA_MAX);
      p.slow = limited ? p.slow + dt : Math.max(0, p.slow - dt * 2);
      p.theta = approach(p.theta, p.gamma + aNeed, K.PITCH_RATE * dt);
      p.alpha = p.theta - p.gamma;
      const cl = liftCoef(p, p.alpha);
      p.lift = K.KL * V2 * cl;
      p.V = Math.max(0, p.V + (thrust - dragOf(p, cl) - G * Math.sin(p.gamma)) * dt);
      p.gamma += (p.lift * Math.cos(p.phi) - G * Math.cos(p.gamma)) / Math.max(4, p.V) * dt;
      p.gamma = clamp(p.gamma, -0.9, 0.9);
      p.psi += p.lift * Math.sin(p.phi) / Math.max(6, p.V) * dt;
    }
    const cg = Math.cos(p.gamma);
    p.x += p.V * cg * Math.sin(p.psi) * dt;
    p.z += p.V * cg * Math.cos(p.psi) * dt;
    p.y += p.V * Math.sin(p.gamma) * dt;
    p.psi = ((p.psi + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    if (!p.onGround && p.y <= 0) {
      p.vsTouch = -p.V * Math.sin(p.gamma);
      p.y = 0; p.onGround = true; p.gamma = 0; p.theta = Math.max(0, p.theta); ev = "touchdown";
    }
    return ev;
  }

  /* ------------------------------------------------------------ missions */
  // ring: position, size and the heading it faces (deg). Rings are made of little clouds.
  const ring = (x, y, z, hdg, r) => ({ x, y, z, hdg: hdg || 0, r: r || 32 });
  // a chain of rings along a path of [x, y, z] points; each faces the way you fly in from the one before
  function chain(pts, r) {
    return pts.map((q, i) => {
      const a = i ? pts[i - 1] : q, b = i ? q : pts[1];
      const hdg = Math.atan2(b[0] - a[0], b[2] - a[2]) / D2R;
      return ring(q[0], q[1], q[2], hdg, r);
    });
  }
  const arc = (cx, cz, rad, a0, a1, n, y) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (a0 + (a1 - a0) * i / (n - 1)) * D2R;
      out.push([cx + Math.sin(a) * rad, typeof y === "function" ? y(i) : y, cz + Math.cos(a) * rad]);
    }
    return out;
  };
  const MAIN = RUNWAYS[0], PALM = RUNWAYS[1];
  const onRunway = (rw, t) => { const q = runwayPoint(rw, t); return { x: q.x, z: q.z, psi: rw.hdg * D2R }; };
  const air = (x, y, z, hdgDeg, V) => ({ x, y, z, psi: hdgDeg * D2R, V, onGround: false, master: true, engine: true, spin: 1, throttle: 0.55, theta: 0.02 });

  const LEVELS = [
    { id: 1, name: "First Take-off", sub: "Start the engine, speed up, pull up!", time: "morning",
      start: Object.assign(onRunway(MAIN, -0.88), {}),
      goal: "takeoff", climb: 120, tutorial: true,
      stars: ["Take off", "Climb to 120 m", "Wheels up"] },
    { id: 2, name: "Cloud Rings", sub: "Fly through the cloud rings", time: "morning",
      start: air(0, 150, -1200, 0, 48),
      rings: chain([[0, 150, -700], [0, 160, -250], [20, 175, 200], [40, 185, 650], [40, 175, 1100], [20, 160, 1550], [0, 150, 2000]]),
      stars: ["Reach the end", "5 rings or more", "Every ring"] },
    { id: 3, name: "Turn, Turn!", sub: "Tilt the stick to turn", time: "day",
      start: air(-600, 180, -1400, 0, 48),
      rings: chain([[-600, 180, -950]].concat(arc(-100, -550, 500, 285, 345, 3, 185), arc(-100, 450, 500, 165, 105, 3, 190), [[400, 195, 900]]), 42),
      stars: ["Reach the end", "6 rings or more", "Every ring"] },
    { id: 4, name: "Up and Down", sub: "Climb and dive through the clouds", time: "day",
      start: air(0, 160, -1600, 0, 50),
      rings: chain([[0, 160, -1150], [0, 230, -750], [0, 300, -350], [30, 220, 50], [60, 140, 450], [60, 220, 850], [30, 320, 1250], [0, 230, 1650], [0, 160, 2050]]),
      stars: ["Reach the end", "7 rings or more", "Every ring"] },
    { id: 5, name: "First Landing", sub: "Wheels down, flaps down, gently down!", time: "afternoon",
      start: air(0, 120, -380 - 2100, 0, 40),
      land: MAIN, tutorial: true, glide: true,
      stars: ["Land on the runway", "Smooth touchdown", "Stop on the runway"] },
    { id: 6, name: "Hello, Balloons!", sub: "Take off and wave to the balloons", time: "day",
      start: onRunway(MAIN, -0.88),
      rings: chain([[0, 80, 700], [0, 140, 1300]].concat(arc(500, 1300, 500, 300, 390, 4, i => 160 + i * 14))),
      balloons: [[-90, 150, 1500], [380, 270, 1800], [880, 200, 1640]],
      stars: ["Reach the end", "Every ring", "Wave to all 3 balloons"] },
    { id: 7, name: "Around the Airport", sub: "Take off, fly a loop, land back home", time: "sunset",
      start: onRunway(MAIN, -0.88),
      // the real "traffic pattern" pilots fly around an airport: a big rectangle, then line up and land
      rings: chain([[0, 100, 500], [150, 150, 900], [450, 160, 1000], [700, 160, 800], [800, 160, 300], [800, 150, -400],
        [700, 130, -1150], [450, 110, -1550], [120, 90, -1700], [0, 60, -1150]], 40),
      land: MAIN,
      stars: ["Land on the runway", "Every ring", "Smooth touchdown"] },
    { id: 8, name: "Island Hop", sub: "Fly across the sea to Palm Island", time: "sunset",
      start: onRunway(MAIN, -0.88),
      rings: (() => {
        const t = runwayPoint(PALM, -1), h = PALM.hdg * D2R;
        const app = d => [t.x - Math.sin(h) * d, 0, t.z - Math.cos(h) * d];
        const a1 = app(1500), a2 = app(850);
        return chain([[0, 120, 1000], [150, 190, 1800], [500, 210, 2600], [a1[0], 105, a1[2]], [a2[0], 60, a2[2]]], 40);
      })(),
      land: PALM,
      stars: ["Land on Palm Island", "Every ring", "Smooth touchdown"] },
  ];
  // the endless free flight: rings appear ahead of you
  const FREE = { id: 0, name: "Free Flight", sub: "Fly anywhere, find the rings", time: "day", start: onRunway(MAIN, -0.88), free: true, stars: [] };

  /* Mission: watches the plane and decides what happened. */
  class Mission {
    constructor(level) {
      this.L = level;
      this.p = newPlane(level.start);
      if (!this.p.onGround) this.p.gear = this.p.gearCmd = false, this.p.gearPos = 0;   // in the air: wheels up (you lower them to land)
      if (level.glide) this.p.throttle = 0.45;
      if (!this.p.onGround) this.p.master = true;
      this.rings = (level.rings || []).map(r => Object.assign({ passed: false, missed: false, side: null }, r));
      this.balloons = (level.balloons || []).map(b => ({ x: b[0], y: b[1], z: b[2], waved: false }));
      this.state = "play"; this.msg = null; this.result = null;
      this.tookOff = !this.p.onGround; this.maxY = this.p.y; this.gearUpInAir = false;
      this.landed = null; this.hard = 0; this.events = [];
      this.freeCount = 0; this.nextFree = 0;
      if (level.free) this.spawnFree(true);
    }
    get next() { return this.rings.find(r => !r.passed && !r.missed); }
    emit(e, d) { this.events.push(Object.assign({ e }, d || {})); }

    spawnFree(first) {
      // a short chain of 4 rings in front of the plane
      const p = this.p, base = first ? { x: 0, y: 120, z: 900, h: 0 } : { x: p.x, y: Math.max(120, p.y), z: p.z, h: p.psi };
      let h = base.h, x = base.x + Math.sin(h) * (first ? 0 : 500), z = base.z + Math.cos(h) * (first ? 0 : 500), y = base.y;
      const bend = (Math.random() - 0.5) * 0.5, pts = [];
      for (let i = 0; i < 4; i++) {
        pts.push([x, clamp(y, 90, 380), z]);
        h += bend; x += Math.sin(h) * 420; z += Math.cos(h) * 420; y += (Math.random() - 0.5) * 120;
      }
      // keep the chain inside the world
      if (Math.hypot(pts[3][0], pts[3][2]) > BOUNDS - 800) pts.forEach(q => { q[0] *= 0.6; q[2] *= 0.6; });
      this.rings = this.rings.filter(r => !r.passed && !r.missed).concat(chain(pts).map(r => Object.assign({ passed: false, missed: false, side: null }, r)));
    }

    update(input, dt) {
      if (this.state !== "play") return;
      const p = this.p, L = this.L;
      const ev = step(p, input, dt);
      this.maxY = Math.max(this.maxY, p.y);
      if (ev === "liftoff") { this.tookOff = true; this.emit("liftoff"); }
      if (!p.onGround && !p.gear && p.y > 20) this.gearUpInAir = true;
      if (p.slow > 0.6 && !p.onGround) { if (!this.slowWarned) { this.slowWarned = true; this.emit("slow"); } } else if (p.slow === 0) this.slowWarned = false;

      // rings: crossing the ring's plane inside the circle
      const nxt = this.next;
      this.rings.forEach((r, k) => {
        if (r.passed || r.missed) return;
        const h = r.hdg * D2R, nx = Math.sin(h), nz = Math.cos(h);
        const d = (p.x - r.x) * nx + (p.z - r.z) * nz;
        const side = d >= 0;
        if (r.side !== null && side && !r.side) {
          const lx = (p.x - r.x) * nz - (p.z - r.z) * nx, ly = p.y - r.y, off = Math.hypot(lx, ly);
          if (off <= r.r) {
            r.passed = true; this.emit("ring", { r }); if (L.free) this.freeCount++;
            // skipped the ones before it
            for (let j = 0; j < k; j++) if (!this.rings[j].passed && !this.rings[j].missed) { this.rings[j].missed = true; this.emit("miss", { r: this.rings[j] }); }
          } else if (r === nxt && off < 300) { r.missed = true; this.emit("miss", { r }); }
        }
        r.side = side;
        // the next ring left far behind counts as missed
        if (r === nxt && d > 250 && Math.hypot(p.x - r.x, p.z - r.z) > 500) { r.missed = true; this.emit("miss", { r }); }
      });
      if (L.free && this.rings.filter(r => !r.passed && !r.missed).length < 2 && !p.onGround) this.spawnFree(false);

      for (const b of this.balloons) {
        const dist = Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z);
        if (!b.waved && dist < 160) { b.waved = true; this.emit("wave", { b }); }
        if (dist < 30 && !b.tooClose) { b.tooClose = true; this.emit("close", { b }); }
        if (dist > 60) b.tooClose = false;
      }

      // touching the ground
      if (ev === "touchdown") {
        const s = surface(p.x, p.z), vs = p.vsTouch;
        this.touch = { vs, kind: s.kind, rw: s.rw };
        if (s.kind === "sea") return this.fail("splash", "Splash! Poppy landed in the sea. Planes need a runway!");
        if (!p.gear) return this.fail("belly", "Scraaape! The wheels weren't down. Put the GEAR lever down and wait for 3 green lights!");
        if (vs > 5.5) return this.fail("hard", "BONK! That was too fast. Come down slower and gently pull up just before the ground.");
        this.landed = { vs, kind: s.kind, rw: s.rw, smooth: vs < 2.5 };
        this.emit("touchdown", this.landed);
        if (L.land && !(s.kind === "runway" && s.rw === L.land)) {
          return this.fail("grass", s.kind === "grass" ? "Bumpy! Poppy landed on the grass. Aim for the gray runway." : "That's not the right runway!");
        }
      }
      if (p.onGround && this.landed && !L.land && this.tookOff && p.V < 2) {
        // landed somewhere without being asked: fine in free flight
        if (L.free) { this.landed = null; this.tookOff = false; }
      }
      if (p.onGround && this.tookOff && !this.landed && !L.free && p.airTime > 1) {
        // bounced back onto the runway right after take-off: that's ok
      }

      // leaving the map: a gentle turn-back
      const far = Math.hypot(p.x, p.z);
      this.far = far > BOUNDS - 600;
      if (far > BOUNDS + 600) return this.fail("far", "Poppy flew too far from the islands. Let's head home!");
      if (p.y > 1200) p.y = 1200;

      // win conditions
      const ringsDone = this.rings.length > 0 && !this.next;
      if (L.goal === "takeoff" && this.tookOff && p.y >= L.climb) return this.win();
      if (L.land) {
        if (this.landed && p.onGround && p.V < 2.5) return this.win();
        if (this.landed && p.onGround) {
          const l = runwayLocal(L.land, p.x, p.z);
          if (Math.abs(l.along) > L.land.len / 2 || Math.abs(l.across) > L.land.wid / 2 + 4) this.overrun = true;
        }
      } else if (!L.free && ringsDone) {
        const last = this.rings[this.rings.length - 1], h = last.hdg * D2R;
        if ((p.x - last.x) * Math.sin(h) + (p.z - last.z) * Math.cos(h) > 150) return this.win();
      }
    }

    fail(kind, text) { this.state = "fail"; this.result = { kind, text }; this.emit("fail", this.result); }
    win() {
      const L = this.L, nRing = this.rings.filter(r => r.passed).length, all = this.rings.length;
      const s = [true, false, false];
      if (L.goal === "takeoff") { s[1] = true; s[2] = this.gearUpInAir; }
      else if (L.land) {
        const smooth = !!(this.landed && this.landed.smooth);
        if (L.id === 5) { s[1] = smooth; s[2] = !this.overrun; }
        else { s[1] = nRing === all; s[2] = smooth; }
      } else if (L.balloons) { s[1] = nRing === all; s[2] = this.balloons.every(b => b.waved); }
      else { s[1] = nRing >= all - 2; s[2] = nRing === all; }
      this.state = "win";
      this.result = { stars: s.filter(Boolean).length, got: s, rings: nRing, all };
      this.emit("win", this.result);
    }
  }

  /* ------------------------------------------------------------ autopilot bot (tests and the demo) */
  // flies toward the next ring, or down the glide path to the runway
  function bot(m, dt) {
    const p = m.p, L = m.L, inp = { x: 0, y: 0 };
    const steerTo = (tx, ty, tz) => {
      const want = Math.atan2(tx - p.x, tz - p.z);
      let dh = want - p.psi; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      inp.x = clamp(dh * 2.2, -1, 1);
      const dist = Math.max(60, Math.hypot(tx - p.x, tz - p.z));
      const gWant = Math.atan2(ty - p.y, dist);
      inp.y = clamp((gWant - p.gamma) * 4 + gWant / K.GAMMA_MAX * 0.6, -1, 1);
    };
    if (p.onGround && !m.landed) {
      p.master = p.engine = true; p.throttle = 1; p.flapsCmd = 0.4;
      inp.y = p.V * KMH > 95 ? 1 : 0;
      return inp;
    }
    if (!p.onGround && p.y > 30 && p.gearCmd && !L.land) p.gearCmd = false;
    if (!p.onGround && p.y > 60 && !(L.land && !m.next)) p.flapsCmd = 0;
    if (L.goal === "takeoff") { p.throttle = 1; inp.y = 0.6; return inp; }
    const r = m.next;
    if (r) {
      // aim a little in front of the ring, so Poppy flies through it straight
      const h = r.hdg * D2R, d = Math.hypot(r.x - p.x, r.z - p.z), back = Math.min(160, d * 0.45);
      steerTo(r.x - Math.sin(h) * back, r.y, r.z - Math.cos(h) * back);
      p.throttle = r.y > p.y + 30 ? 1 : 0.7;
      if (L.land && m.rings.length && r === m.rings[m.rings.length - 1]) { p.gearCmd = true; p.flapsCmd = 1; p.throttle = 0.45; }
      return inp;
    }
    if (L.land) {
      // glide path: 3.5 degrees down to a point 120 m past the runway start
      const rw = L.land, a = runwayPoint(rw, -1), h = rw.hdg * D2R;
      const aim = { x: a.x + Math.sin(h) * 120, z: a.z + Math.cos(h) * 120 };
      const back = (p.x - aim.x) * Math.sin(h) + (p.z - aim.z) * Math.cos(h);   // negative before the aim point
      const across = (p.x - aim.x) * Math.cos(h) - (p.z - aim.z) * Math.sin(h);
      const dist = Math.max(0, -back);
      p.gearCmd = true; p.flapsCmd = 1;
      if (p.onGround) { p.throttle = 0; p.brake = true; inp.x = clamp(-across * 0.05, -1, 1); return inp; }
      const lead = Math.max(250, dist * 0.5), ahead = back + lead;
      const tx = aim.x + Math.sin(h) * ahead, tz = aim.z + Math.cos(h) * ahead;
      const want = Math.atan2(tx - p.x, tz - p.z);
      let dh = want - p.psi; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      inp.x = clamp(dh * 2.2, -1, 1);
      const yWant = Math.max(0, dist * Math.tan(3.5 * D2R));
      let gWant = -3.5 * D2R + clamp((yWant - p.y) / 120, -0.12, 0.12);
      p.throttle = clamp(0.35 + (34 - p.V) * 0.08, 0, 1);
      if (p.y < 8) { gWant = -0.8 * D2R; p.throttle = 0.3; }   // flare: almost level just above the runway
      inp.y = clamp(gWant / K.GAMMA_MAX + (gWant - p.gamma) * 3, -1, 1);
    }
    return inp;
  }

  const api = { K, KMH, D2R, G, ISLANDS, RUNWAYS, BOUNDS, LEVELS, FREE, Mission, newPlane, step, surface, runwayPoint, runwayLocal, inPoly, bot, clamp };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.FlightSim = api;
})(this);
