/* Shared picture-book engine: paging, read-aloud, sound effects, particle FX. */
(function () {
  "use strict";

  /* ================= SOUND (synthesized, no files) ================= */
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem("pb-muted") === "1"; } catch (e) {}

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function noiseBuffer(a, secs) {
    const b = a.createBuffer(1, Math.floor(a.sampleRate * secs), a.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function tone(type, f1, f2, dur, vol, delay) {
    const a = ac(); if (!a || muted) return;
    const t = a.currentTime + (delay || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, f1, f2, vol, type, delay) {
    const a = ac(); if (!a || muted) return;
    const t = a.currentTime + (delay || 0);
    const s = a.createBufferSource(); s.buffer = noiseBuffer(a, dur + 0.1);
    const f = a.createBiquadFilter(); f.type = type || "lowpass";
    f.frequency.setValueAtTime(f1, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.4, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + dur + 0.1);
  }
  const SFX = {
    pop()    { tone("sine", 500, 900, 0.12, 0.25); },
    tap()    { tone("triangle", 660, 990, 0.1, 0.18); },
    page()   { noise(0.25, 3000, 800, 0.12, "bandpass"); },
    ding()   { tone("sine", 880, 0, 0.5, 0.2); tone("sine", 1320, 0, 0.6, 0.12, 0.08); },
    yay()    { [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, 0, 0.25, 0.18, i * 0.09)); },
    oops()   { tone("sawtooth", 300, 150, 0.3, 0.1); },
    whoosh() { noise(1.3, 300, 3500, 0.35, "bandpass"); },
    boom()   { noise(2.2, 900, 40, 0.9); tone("sine", 90, 30, 1.6, 0.6); },
    rumble() { noise(2.5, 160, 60, 0.5); },
    wind()   { noise(3, 400, 900, 0.18, "bandpass"); noise(3, 900, 300, 0.12, "bandpass", 1); },
    chirp()  { tone("sine", 2200, 3200, 0.08, 0.15); tone("sine", 2400, 3600, 0.08, 0.15, 0.12); tone("sine", 2000, 3000, 0.1, 0.12, 0.26); },
    roar()   { tone("sawtooth", 140, 70, 0.9, 0.18); noise(0.9, 700, 200, 0.25); },
    munch()  { [0, 0.15, 0.3].forEach(d => noise(0.08, 1500, 600, 0.25, "bandpass", d)); },
    growl()  { tone("sawtooth", 80, 60, 0.7, 0.12); tone("sawtooth", 95, 70, 0.6, 0.1, 0.35); },
    splash() { noise(0.7, 4000, 500, 0.3, "highpass"); },
    dig()    { noise(0.18, 1200, 300, 0.3, "bandpass"); },
    rocket() { noise(3.2, 200, 1200, 0.45); tone("sawtooth", 60, 240, 3, 0.07); },
    jet()    { noise(2.5, 1500, 600, 0.25, "bandpass"); tone("sine", 300, 200, 2.5, 0.05); },
    snore()  { noise(0.9, 300, 120, 0.15, "bandpass"); noise(0.7, 600, 900, 0.08, "bandpass", 1.1); },
    tick()   { tone("square", 1800, 0, 0.03, 0.06); },
    sparkle(){ [1568, 2093, 2637].forEach((f, i) => tone("sine", f, 0, 0.3, 0.08, i * 0.07)); },
    puff()   { noise(0.32, 2500, 7000, 0.16, "bandpass"); tone("sine", 700, 1400, 0.18, 0.05); },   // air jet: a rising whoosh
    hiss()   { noise(0.16, 5200, 2400, 0.07, "highpass"); },
    hum()    { tone("sine", 110, 140, 0.4, 0.12); tone("triangle", 220, 260, 0.3, 0.05); },
  };

  /* ================= PARTICLES ================= */
  // One canvas per stage, created lazily. Emitters run on rAF.
  const fxMap = new WeakMap();
  function fx(stage) {
    if (fxMap.has(stage)) return fxMap.get(stage);
    const c = document.createElement("canvas");
    c.className = "fx";
    c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3";
    stage.appendChild(c);
    const g = c.getContext("2d");
    const st = { c, g, parts: [], weather: null, raf: 0, w: 0, h: 0 };
    function size() {
      const r = stage.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
      st.w = r.width; st.h = r.height; c.width = r.width * d; c.height = r.height * d;
      g.setTransform(d, 0, 0, d, 0, 0);
    }
    size(); new ResizeObserver(size).observe(stage);
    function loop() {
      g.clearRect(0, 0, st.w, st.h);
      if (st.weather) st.weather(st);
      const p = st.parts;
      for (let i = p.length - 1; i >= 0; i--) {
        const q = p[i];
        q.life -= 1;
        if (q.life <= 0) { p.splice(i, 1); continue; }
        q.vx *= q.drag; q.vy = q.vy * q.drag + q.grav;
        q.x += q.vx; q.y += q.vy; q.r *= q.shrink;
        const k = q.life / q.max;
        g.globalAlpha = Math.max(0, Math.min(1, q.alpha * (q.fade ? k : 1)));
        g.fillStyle = typeof q.color === "function" ? q.color(k) : q.color;
        if (q.glow) { g.shadowBlur = q.r * 2; g.shadowColor = g.fillStyle; } else g.shadowBlur = 0;
        g.beginPath(); g.arc(q.x, q.y, Math.max(0.3, q.r), 0, 6.283); g.fill();
      }
      g.globalAlpha = 1; g.shadowBlur = 0;
      st.raf = (p.length || st.weather) ? requestAnimationFrame(loop) : 0;
    }
    st.kick = () => { if (!st.raf) st.raf = requestAnimationFrame(loop); };
    fxMap.set(stage, st);
    return st;
  }
  function add(st, o) {
    st.parts.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, r: 4, life: 60, drag: 0.98, grav: 0, shrink: 0.99,
      color: "#fff", alpha: 1, fade: true, glow: false
    }, o, { max: o.life || 60 }));
    st.kick();
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const fireColor = k => k > .7 ? "#fff6c2" : k > .45 ? "#ffc23d" : k > .25 ? "#ff7a2f" : "#a33a2a";

  const FX = {
    /** fire trail puff at (x,y) in stage px */
    fire(stage, x, y, n, spread) {
      const st = fx(stage);
      for (let i = 0; i < (n || 6); i++) add(st, {
        x: x + rnd(-spread || -6, spread || 6), y: y + rnd(-6, 6), vx: rnd(-1, 1), vy: rnd(-1.2, 0.4),
        r: rnd(5, 12), life: rnd(18, 40), shrink: 0.96, color: fireColor, glow: true
      });
    },
    smoke(stage, x, y, n, col) {
      const st = fx(stage);
      for (let i = 0; i < (n || 4); i++) add(st, {
        x: x + rnd(-10, 10), y: y + rnd(-10, 10), vx: rnd(-.6, .6), vy: rnd(-1, -.2),
        r: rnd(8, 18), life: rnd(50, 90), shrink: 1.012, color: col || "#8b7f78", alpha: 0.45
      });
    },
    explode(stage, x, y, power) {
      const st = fx(stage), P = power || 1;
      for (let i = 0; i < 90 * P; i++) {
        const a = rnd(0, 6.283), s = rnd(2, 11) * P;
        add(st, { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, r: rnd(4, 11), life: rnd(30, 70),
          drag: 0.95, grav: 0.12, shrink: 0.975, color: fireColor, glow: true });
      }
      for (let i = 0; i < 40 * P; i++) {
        const a = rnd(3.4, 6.0), s = rnd(1, 5) * P;
        add(st, { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rnd(14, 30), life: rnd(80, 140),
          drag: 0.97, grav: -0.02, shrink: 1.008, color: "#7d6a5f", alpha: 0.55 });
      }
      for (let i = 0; i < 30 * P; i++) {
        const a = rnd(3.5, 5.9), s = rnd(5, 12) * P;
        add(st, { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rnd(2, 4), life: rnd(50, 90),
          drag: 0.99, grav: 0.25, shrink: 1, color: "#4a3a32", fade: false });
      }
    },
    sparkles(stage, x, y, n) {
      const st = fx(stage);
      const cols = ["#ffe066", "#ff8fab", "#8fd3ff", "#b5f28f", "#ffffff"];
      for (let i = 0; i < (n || 24); i++) {
        const a = rnd(0, 6.283), s = rnd(1.5, 5);
        add(st, { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rnd(2, 5), life: rnd(30, 55),
          drag: 0.94, grav: 0.05, shrink: 0.97, color: cols[i % cols.length], glow: true });
      }
    },
    dust(stage, x, y, n) {
      const st = fx(stage);
      for (let i = 0; i < (n || 12); i++) add(st, {
        x: x + rnd(-15, 15), y, vx: rnd(-2.5, 2.5), vy: rnd(-3, -0.5), r: rnd(3, 8), life: rnd(25, 45),
        grav: 0.12, color: "#b08a5c", alpha: 0.8
      });
    },
    /** air jet: a fast, glowing cyan streak shooting in direction (dx, dy) */
    jet(stage, x, y, dx, dy, n) {
      const st = fx(stage), m = Math.hypot(dx, dy) || 1, ux = dx / m, uy = dy / m;
      for (let i = 0; i < (n || 26); i++) {
        const s = rnd(9, 20), side = rnd(-1, 1) * 2;
        add(st, { x: x - uy * side * 3, y: y + ux * side * 3, vx: ux * s - uy * side * .3, vy: uy * s + ux * side * .3, r: rnd(2, 4.5), life: rnd(14, 26),
          drag: 0.93, shrink: 0.97, color: i % 3 ? "#9ff0ff" : "#ffffff", glow: true });
      }
    },
    hearts(stage, x, y) {
      const st = fx(stage);
      for (let i = 0; i < 10; i++) add(st, {
        x: x + rnd(-20, 20), y, vx: rnd(-1, 1), vy: rnd(-2.5, -1), r: rnd(4, 7), life: 60,
        color: "#ff6b8b", glow: true
      });
    },
    /** weather: "ash" | "snow" | "stars" | "pollen" | "rain" | "bubbles" | null */
    weather(stage, kind, density) {
      const st = fx(stage);
      if (!kind) { st.weather = null; return; }
      const D = density || 1;
      const pool = [];
      st.weather = (s) => {
        const want = Math.floor((kind === "rain" ? 120 : kind === "stars" ? 60 : 70) * D);
        while (pool.length < want) pool.push(spawn(s, true));
        const g = s.g;
        for (const q of pool) {
          q.t += 1; q.x += q.vx + Math.sin(q.t * q.wob) * q.sway; q.y += q.vy;
          if (q.y > s.h + 10 || q.y < -20 || q.x < -20 || q.x > s.w + 20) Object.assign(q, spawn(s, false));
          let a = q.a;
          if (kind === "stars") a = q.a * (0.4 + 0.6 * Math.abs(Math.sin(q.t * q.wob * 3)));
          g.globalAlpha = a; g.fillStyle = q.col;
          if (kind === "rain") {
            g.strokeStyle = q.col; g.lineWidth = 1.5; g.beginPath();
            g.moveTo(q.x, q.y); g.lineTo(q.x - q.vx * 2, q.y - q.vy * 2); g.stroke();
          } else if (kind === "bubbles") {
            g.strokeStyle = q.col; g.lineWidth = 1.5; g.beginPath(); g.arc(q.x, q.y, q.r, 0, 6.283); g.stroke();
            g.beginPath(); g.arc(q.x - q.r * .35, q.y - q.r * .35, q.r * .25, 0, 6.283); g.fill();
          } else { g.beginPath(); g.arc(q.x, q.y, q.r, 0, 6.283); g.fill(); }
        }
        g.globalAlpha = 1;
      };
      function spawn(s, first) {
        const base = { x: rnd(0, s.w), y: first ? rnd(0, s.h) : -10, t: rnd(0, 100), wob: rnd(0.01, 0.04) };
        switch (kind) {
          case "ash":  return Object.assign(base, { vx: rnd(-.3, .3), vy: rnd(.4, 1.1), r: rnd(1.5, 3.5), sway: .5, a: rnd(.4, .8), col: "#d9d2cb" });
          case "snow": return Object.assign(base, { vx: rnd(-.2, .2), vy: rnd(.6, 1.4), r: rnd(1.5, 4), sway: .6, a: rnd(.6, 1), col: "#ffffff" });
          case "pollen": return Object.assign(base, { vx: rnd(-.3, .3), vy: rnd(-.4, .3), r: rnd(1.5, 3), sway: .7, a: rnd(.4, .9), col: "#fff3a8", y: rnd(0, s.h) });
          case "rain": return Object.assign(base, { vx: -1.5, vy: rnd(7, 11), r: 1, sway: 0, a: .45, col: "#cfe6ff" });
          case "stars": return Object.assign(base, { vx: 0, vy: 0, r: rnd(.8, 2.2), sway: 0, a: rnd(.5, 1), col: "#ffffff", y: rnd(0, s.h) });
          case "bubbles": return Object.assign(base, { vx: rnd(-.1, .1), vy: rnd(-1.2, -.4), r: rnd(2, 6), sway: .5, a: rnd(.35, .75), col: "#ffffff", y: first ? rnd(0, s.h) : s.h + 8 });
        }
      }
      st.kick();
    },
    clear(stage) { const st = fx(stage); st.parts.length = 0; st.weather = null; },
    flash(stage, color) {
      let f = stage.querySelector(".flash");
      if (!f) { f = document.createElement("div"); f.className = "flash"; stage.appendChild(f); }
      if (color) f.style.background = color;
      f.classList.remove("go"); void f.offsetWidth; f.classList.add("go");
    },
    shake(el) { el.classList.remove("shake-stage"); void el.offsetWidth; el.classList.add("shake-stage"); },
  };

  /* ================= CONFETTI ================= */
  function confetti(n) {
    const box = document.createElement("div"); box.className = "confetti";
    const cols = ["#ff8a5c", "#ffcf5c", "#7cc8a4", "#7aa7ff", "#ff8fab", "#b28dff"];
    for (let i = 0; i < (n || 80); i++) {
      const p = document.createElement("i");
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = cols[i % cols.length];
      p.style.animationDuration = 1.8 + Math.random() * 1.8 + "s";
      p.style.animationDelay = Math.random() * .6 + "s";
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4500);
  }

  /* ================= READ ALOUD ================= */
  let voice = null;
  function pickVoice() {
    const vs = speechSynthesis.getVoices().filter(v => /^en(-|_)/i.test(v.lang));
    const pref = ["Samantha", "Google US English", "Microsoft Aria", "Microsoft Jenny", "Microsoft Zira", "Karen", "Serena"];
    for (const n of pref) { const v = vs.find(x => x.name.includes(n)); if (v) return v; }
    return vs.find(v => /en-US/i.test(v.lang)) || vs[0] || null;
  }
  if ("speechSynthesis" in window) {
    voice = pickVoice();
    speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
  }
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\s+/g, " ").trim());
    if (voice) u.voice = voice;
    u.lang = "en-US"; u.rate = 0.88; u.pitch = 1.12;
    speechSynthesis.speak(u);
  }
  function stopSpeak() { if ("speechSynthesis" in window) speechSynthesis.cancel(); }

  /* ================= BOOK ================= */
  const Book = {
    sfx: SFX, fx: FX, confetti, speak, stopSpeak,
    pages: [], index: 0, hooks: {}, autoRead: false,
    get muted() { return muted; },
    setMuted(m) { muted = !!m; try { localStorage.setItem("pb-muted", muted ? "1" : "0"); } catch (e) {} },

    /** register enter/leave hooks for page n (1-based) */
    on(n, enter, leave) { this.hooks[n] = { enter, leave }; },

    init() {
      this.pages = [...document.querySelectorAll(".page")];
      const dots = document.querySelector(".dots");
      this.pages.forEach((p, i) => {
        const b = document.createElement("button");
        b.setAttribute("aria-label", "Go to page " + (i + 1));
        b.onclick = () => this.go(i);
        dots.appendChild(b);
      });
      document.querySelector(".prev").onclick = () => this.go(this.index - 1);
      document.querySelector(".next").onclick = () => this.go(this.index + 1);
      document.addEventListener("keydown", e => {
        if (e.target.closest("input,textarea,select")) return;
        if (e.key === "ArrowRight") this.go(this.index + 1);
        if (e.key === "ArrowLeft") this.go(this.index - 1);
      });
      // swipe on text areas only (stages have their own taps)
      let sx = null, sy = null;
      document.querySelector(".book").addEventListener("touchstart", e => {
        if (e.target.closest(".stage,.choice,input,button")) { sx = null; return; }
        sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      }, { passive: true });
      document.querySelector(".book").addEventListener("touchend", e => {
        if (sx === null) return;
        const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) this.go(this.index + (dx < 0 ? 1 : -1));
        sx = null;
      });
      // tools
      const muteBtn = document.querySelector("[data-mute]");
      const paint = () => {
        muteBtn.innerHTML = (muted ? "🔇" : "🔊") + '<span class="lbl"> Sound</span>';
        muteBtn.classList.toggle("on", !muted);
      };
      if (muteBtn) {
        paint();
        muteBtn.onclick = () => {
          muted = !muted; try { localStorage.setItem("pb-muted", muted ? "1" : "0"); } catch (e) {}
          paint(); if (!muted) SFX.pop();
        };
      }
      const readBtn = document.querySelector("[data-read]");
      if (readBtn) {
        if (!("speechSynthesis" in window)) readBtn.style.display = "none";
        readBtn.onclick = () => this.readPage();
      }
      window.addEventListener("hashchange", () => {
        const n = parseInt((location.hash.match(/p(\d+)/) || [])[1] || "0", 10) - 1;
        if (n >= 0 && n !== this.index && n < this.pages.length) this.go(n);
      });
      const start = parseInt((location.hash.match(/p(\d+)/) || [])[1] || "1", 10) - 1;
      this.go(Math.max(0, Math.min(this.pages.length - 1, start)), true);
      // unlock audio on first gesture (iOS)
      const unlock = () => { ac(); window.removeEventListener("pointerdown", unlock); };
      window.addEventListener("pointerdown", unlock);
    },

    readPage() {
      const t = this.pages[this.index].querySelector(".text");
      if (!t) return;
      const clone = t.cloneNode(true);
      clone.querySelectorAll("[data-noread], .choice-row, button").forEach(n => n.remove());
      speak(clone.innerText);
    },

    go(i, first) {
      if (i < 0 || i >= this.pages.length) return;
      const old = this.index;
      if (!first && this.hooks[old + 1] && this.hooks[old + 1].leave) this.hooks[old + 1].leave();
      if (!first) {
        const os = this.pages[old].querySelector(".stage");
        if (os) FX.clear(os);
      }
      stopSpeak();
      this.pages.forEach((p, k) => p.classList.toggle("active", k === i));
      document.querySelectorAll(".dots button").forEach((d, k) => d.classList.toggle("on", k === i));
      document.querySelector(".prev").disabled = i === 0;
      const nx = document.querySelector(".next");
      nx.disabled = i === this.pages.length - 1;
      this.index = i;
      if (!first) { SFX.page(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      history.replaceState(null, "", "#p" + (i + 1));
      const h = this.hooks[i + 1];
      if (h && h.enter) setTimeout(() => h.enter(this.pages[i]), 60);
    },

    /** place a hotspot. x,y,w,h in % of stage. */
    hot(stage, x, y, w, h, label, onTap, shape) {
      const b = document.createElement("button");
      b.className = "hot";
      b.style.left = x + "%"; b.style.top = y + "%";
      b.style.width = w + "%"; b.style.height = h + "%";
      if (shape === "rect") b.style.borderRadius = "22px";
      b.setAttribute("aria-label", label);
      b.onclick = e => { e.stopPropagation(); b.classList.add("done"); onTap(b, e); };
      (stage.querySelector(".layer") || stage).appendChild(b);
      return b;
    },

    /** speech bubble at % coords; auto-removes other bubbles in stage */
    bubble(stage, x, y, html, opts) {
      stage.querySelectorAll(".bubble").forEach(b => b.remove());
      const d = document.createElement("div");
      d.className = "bubble"; d.innerHTML = html;
      d.style.left = x + "%"; d.style.top = y + "%";
      if (opts && opts.right) { d.style.left = "auto"; d.style.right = (100 - x) + "%"; }
      stage.appendChild(d);
      return d;
    },

    /** stage-relative px from % */
    px(stage, xp, yp) {
      const r = stage.getBoundingClientRect();
      return [r.width * xp / 100, r.height * yp / 100];
    },

    hint(stage, x, y, text) {
      stage.querySelectorAll(".tap-hint").forEach(h => h.remove());
      const d = document.createElement("div");
      d.className = "tap-hint"; d.textContent = text || "Tap!";
      d.style.left = x + "%"; d.style.top = y + "%";
      stage.appendChild(d);
      return d;
    },
    clearHints(stage) { stage.querySelectorAll(".tap-hint").forEach(h => h.remove()); },
  };

  window.Book = Book;
})();
