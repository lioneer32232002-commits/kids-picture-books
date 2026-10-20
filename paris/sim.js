/* Cathedral Builders! rules and geometry, with no drawing (runs in Node too).
 *
 * A level is three jobs on a cut-through view of a cathedral:
 *   1. stack   - a crane swings a stone over each wall; drop it on top (spire levels add oak beams on the roof)
 *   2. buttress - the heavy vault pushes the walls outward at "push points"; a flying buttress
 *                 placed at the push point pushes back, so the wall stands straight
 *   3. rain    - water runs off the roof to outlets; a gargoyle on an outlet spits it far away,
 *                an empty outlet lets it run down the wall (the wall gets wet)
 * Nothing can be destroyed: a missed stone just slides off, and a wall without help only wobbles.
 */
(function (root) {
  const W = 1280, H = 720, GROUND = 640, CX = 640;
  const BW = 64, BH = 36;              // a stone block
  const BEAM_W = 34, BEAM_H = 40;      // an oak beam of the spire
  const MISS = BW * 0.72;              // drop further off than this and the stone slides off

  // n: stones per wall, bt: flying buttresses per side, outlets, swing speed, rain prep seconds
  const LEVELS = [
    { name: "Little Chapel", n: 3, bt: 0, out: 2, w: 1.5, prep: 7, rain: 14, tip: "Low walls are strong enough on their own. Just stack them nice and straight!" },
    { name: "First Buttress", n: 4, bt: 1, out: 2, w: 1.6, prep: 7, rain: 14, tip: "The roof pushes the walls out. Put a flying buttress right at the red push arrow!" },
    { name: "Rainy Day", n: 5, bt: 1, out: 4, w: 1.7, prep: 7, rain: 16, tip: "More gutters, more gargoyles! Water also runs along the buttresses." },
    { name: "Windy Crane", n: 5, bt: 1, out: 4, w: 2.0, prep: 6, rain: 16, tip: "The crane swings faster now. Wait for the stone to be right above the wall!" },
    { name: "Taller Nave", n: 6, bt: 2, out: 4, w: 2.0, prep: 6, rain: 16, tip: "Tall walls get two pushes. Notre-Dame has two buttresses stacked on each side!" },
    { name: "Big Storm", n: 6, bt: 2, out: 6, w: 2.1, prep: 6, rain: 18, tip: "Six gutters! Move fast before the storm comes." },
    { name: "Grand Cathedral", n: 7, bt: 2, out: 6, w: 2.3, prep: 5, rain: 18, tip: "The tallest walls yet. Steady hands, master builder!" },
    { name: "The New Spire", n: 7, bt: 2, out: 6, w: 2.3, prep: 5, rain: 18, spire: 4, tip: "Rebuild the spire with oak beams, then the golden rooster goes on top!" },
  ];

  function endless(round) {
    const r = Math.min(round, 12);
    return { name: "Free Build " + (round + 1), n: 4 + Math.min(4, Math.floor(r / 2)), bt: r < 1 ? 1 : 2, out: r < 2 ? 4 : 6,
      w: 1.8 + Math.min(0.9, r * 0.08), prep: Math.max(4, 7 - r * 0.3), rain: 16, spire: r % 3 === 2 ? 4 : 0, tip: "Build round " + (round + 1) + "!" };
  }

  // a level's fixed shapes, from its config
  function layout(L) {
    const span = 300 + L.n * 10;                    // inside width of the nave
    const wl = CX - span / 2 - BW / 2, wr = CX + span / 2 + BW / 2;   // wall centres
    const top = GROUND - L.n * BH;                  // wall top (after stacking)
    const push = [];                                // push points (y), from the top down
    if (L.bt >= 1) push.push(top + BH * 0.5);
    if (L.bt >= 2) push.push(top + BH * 2.5);
    const reach = 150;                              // how far out the buttress piers stand
    const pierX = [wl - BW / 2 - reach, wr + BW / 2 + reach];
    const pierTop = push.length ? push[push.length - 1] + 60 : GROUND;
    const ridge = top - 120 - L.n * 4;              // roof peak
    const outlets = [];
    // eaves gutters at the wall tops
    outlets.push({ x: wl - BW / 2 - 6, y: top - 6, dir: -1, wall: 0 }, { x: wr + BW / 2 + 6, y: top - 6, dir: 1, wall: 1 });
    if (L.out >= 4) outlets.push({ x: pierX[0] - 18, y: pierTop + 6, dir: -1, wall: 0, pier: true }, { x: pierX[1] + 18, y: pierTop + 6, dir: 1, wall: 1, pier: true });
    if (L.out >= 6) {
      // gutters half way along the upper flyer
      const y = push[0] + 30, m = reach / 2 + BW / 2;
      outlets.push({ x: wl - m, y, dir: -1, wall: 0, flyer: true }, { x: wr + m, y, dir: 1, wall: 1, flyer: true });
    }
    return { span, wl, wr, top, push, pierX, pierTop, ridge, outlets, tol: L.n >= 6 ? BH * 0.7 : BH * 0.9 };
  }

  function Sim(L, opts) {
    opts = opts || {};
    this.L = L; this.G = layout(L);
    this.t = 0; this.phase = "stack"; this.pt = 0;        // pt = time in this phase
    this.walls = [[], []];                                // dx of each stone
    this.spire = [];                                      // dx of each beam
    this.side = 0;                                        // which wall the crane is over
    this.falling = null;                                  // {x, y, vy, target, ok}
    this.misses = 0; this.neat = [];
    this.butt = [[], []];                                 // placed buttress y per side (index = push point)
    this.buttTries = 0; this.buttFirst = 0;
    this.garg = this.G.outlets.map(() => false);
    this.wet = 0; this.wetMax = 1; this.wetBy = this.G.outlets.map(() => 0);
    this.rainOn = false; this.events = [];
    this.done = false; this.score = 0; this.stars = 0;
    this.phase0 = Math.random() * 6;
  }
  Sim.prototype = {
    emit(type, data) { this.events.push(Object.assign({ type }, data || {})); },
    target() {
      // where the next stone or beam must land: x of the wall (or roof ridge) and y of its top
      const G = this.G;
      if (this.phase === "spire") return { x: CX, y: G.ridge - this.spire.length * BEAM_H, w: BEAM_W, h: BEAM_H, spire: true };
      const s = this.side, n = this.walls[s].length;
      return { x: s ? G.wr : G.wl, y: GROUND - n * BH, w: BW, h: BH };
    },
    hookX() {
      const T = this.target(), amp = this.phase === "spire" ? 150 : 170;
      return T.x + amp * Math.sin(this.L.w * (this.t + this.phase0));
    },
    hookY() { return Math.min(this.target().y - 150, 150); },
    canDrop() { return (this.phase === "stack" || this.phase === "spire") && !this.falling; },
    drop() {
      if (!this.canDrop()) return false;
      const T = this.target(), x = this.hookX(), dx = x - T.x;
      const miss = this.phase === "spire" ? BEAM_W * 0.8 : MISS;
      this.falling = { x, y: this.hookY() + 30, vy: 0, target: T, dx, ok: Math.abs(dx) <= miss, miss };
      this.emit("drop");
      return true;
    },
    stepFall(dt) {
      const f = this.falling; if (!f) return;
      f.vy += 2200 * dt; f.y += f.vy * dt;
      const landY = f.target.y - f.target.h / 2;
      if (f.ok && f.y >= landY) {
        this.falling = null;
        const q = Math.max(0, 1 - Math.abs(f.dx) / f.miss);
        this.neat.push(q);
        if (this.phase === "spire") {
          this.spire.push(f.dx); this.emit("land", { x: f.x, y: landY, q, spire: true });
          if (this.spire.length >= this.L.spire) { this.emit("rooster"); this.next("rain"); }
        } else {
          this.walls[this.side].push(f.dx); this.emit("land", { x: f.x, y: landY, q });
          // alternate walls until both are tall enough
          const n = this.L.n, a = this.walls[0].length, b = this.walls[1].length;
          if (a >= n && b >= n) { this.emit("walls"); this.next(this.L.bt ? "buttress" : (this.L.spire ? "spire" : "rain")); }
          else this.side = a > b ? 1 : b > a ? 0 : 1 - this.side;
        }
      } else if (!f.ok && f.y > GROUND + 60) {
        this.falling = null; this.misses++; this.emit("miss", { x: f.x });
      } else if (!f.ok && f.y >= landY && !f.bonked) {
        f.bonked = true; this.emit("bonk", { x: f.x, y: landY });
      }
    },
    // push points that still need a buttress
    pushLeft() {
      let k = 0;
      for (let s = 0; s < 2; s++) for (let i = 0; i < this.G.push.length; i++) if (this.butt[s][i] === undefined) k++;
      return k;
    },
    // a buttress dropped at height y next to wall `side`; returns {ok, i, hint}
    placeButtress(side, y) {
      if (this.phase !== "buttress") return { ok: false };
      const G = this.G; this.buttTries++;
      let best = -1, bd = 1e9;
      G.push.forEach((py, i) => { if (this.butt[side][i] === undefined && Math.abs(py - y) < bd) { bd = Math.abs(py - y); best = i; } });
      if (best < 0) return { ok: false, hint: "done" };
      if (bd <= G.tol) {
        this.butt[side][best] = G.push[best];
        const first = !this["_tried" + side + best];
        if (first) this.buttFirst++;
        this.emit("buttress", { side, i: best, y: G.push[best] });
        if (!this.pushLeft()) { this.emit("standing"); this.next(this.L.spire ? "spire" : "rain"); }
        return { ok: true, i: best };
      }
      this["_tried" + side + best] = true;
      this.emit("wobble", { side, y });
      return { ok: false, hint: y > G.push[best] ? "higher" : "lower", i: best };
    },
    placeGargoyle(i) {
      if (this.phase !== "rain" || this.garg[i]) return false;
      this.garg[i] = true; this.emit("gargoyle", { i });
      return true;
    },
    // index of the outlet nearest to (x, y), or -1
    outletAt(x, y, r) {
      let best = -1, bd = (r || 70) ** 2;
      this.G.outlets.forEach((o, i) => { if (this.garg[i]) return; const d = (o.x - x) ** 2 + (o.y - y) ** 2; if (d < bd) { bd = d; best = i; } });
      return best;
    },
    next(ph) { this.phase = ph; this.pt = 0; this.emit("phase", { phase: ph }); if (ph === "rain") this.wetMax = this.L.rain * this.G.outlets.length; },
    step(dt) {
      this.t += dt; this.pt += dt;
      if (this.phase === "stack" || this.phase === "spire") this.stepFall(dt);
      else if (this.phase === "rain") {
        const L = this.L;
        if (!this.rainOn && this.pt >= L.prep) { this.rainOn = true; this.emit("rainStart"); }
        if (this.rainOn) {
          const rt = this.pt - L.prep;
          // the rain gets heavy, then eases off
          const k = Math.min(1, rt / 2) * Math.min(1, (L.rain - rt) / 2 + 0.2);
          this.G.outlets.forEach((o, i) => { if (!this.garg[i]) { this.wet += dt * k; this.wetBy[i] += dt * k; } });
          if (rt >= L.rain) { this.rainOn = false; this.finish(); }
        }
      }
    },
    dryness() { return this.phase === "stack" ? 1 : Math.max(0, 1 - this.wet / (this.wetMax * 0.8)); },
    neatness() { return this.neat.length ? this.neat.reduce((a, b) => a + b, 0) / this.neat.length : 1; },
    finish() {
      const neat = this.neatness(), dry = this.dryness();
      const need = this.G.push.length * 2;
      const bt = need ? this.buttFirst / need : 1;
      this.score = Math.round(40 * neat + 20 * bt + 40 * dry - Math.min(10, this.misses * 2));
      this.stars = this.score >= 85 ? 3 : this.score >= 55 ? 2 : 1;
      this.done = true; this.phase = "done"; this.emit("done", { score: this.score, stars: this.stars, neat, dry, bt });
    },
  };

  /* The bot plays like a careful 6-year-old: it waits until the stone is nearly over the wall
   * (with a slow reaction), drops buttresses near the arrow, and drags gargoyles one at a time. */
  function Bot(sim, skill) {
    this.s = sim; this.k = skill == null ? 1 : skill; this.wait = 0; this.plan = null;
  }
  Bot.prototype.step = function (dt) {
    const s = this.s, k = this.k;
    this.wait -= dt;
    if (this.wait > 0) return;
    if (s.canDrop()) {
      // plan to drop when the stone next passes over the wall, with a reaction error
      if (this.plan == null) {
        const T = s.target(), f = t => T.x + (s.phase === "spire" ? 150 : 170) * Math.sin(s.L.w * (t + s.phase0)) - T.x;
        let t = s.t + 0.3; const sg = Math.sign(f(t));
        while (Math.sign(f(t)) === sg && t < s.t + 10) t += 0.005;
        const g = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
        this.plan = t + g() * (0.04 + 0.12 * (1 - k)) * (1.6 / s.L.w);
      }
      if (s.t >= this.plan) { s.drop(); this.plan = null; this.wait = 0.4 + Math.random() * 0.4; }
    } else if (s.phase === "buttress") {
      for (let side = 0; side < 2; side++) for (let i = 0; i < s.G.push.length; i++) {
        if (s.butt[side][i] !== undefined) continue;
        const err = (Math.random() - 0.5) * 2 * (s.G.tol * (1.1 - 0.4 * k));
        s.placeButtress(side, s.G.push[i] + err); this.wait = 1.2 + Math.random() * 0.6; return;
      }
    } else if (s.phase === "rain") {
      if (s.pt < 1) return;      // reading the "storm coming" sign
      const i = s.garg.findIndex(g => !g);
      if (i >= 0) { s.placeGargoyle(i); this.wait = (1.3 + Math.random() * 0.5) / (0.7 + 0.3 * k); }
    }
  };

  function run(L, skill, maxT) {
    const s = new Sim(L), b = new Bot(s, skill);
    for (let t = 0; t < (maxT || 400) && !s.done; t += 1 / 60) { b.step(1 / 60); s.step(1 / 60); }
    return s;
  }

  const api = { W, H, GROUND, CX, BW, BH, BEAM_W, BEAM_H, LEVELS, endless, layout, Sim, Bot, run };
  if (typeof module !== "undefined") module.exports = api; else root.CathSim = api;
})(this);
