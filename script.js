/* ==========================================================================
   Friends of Fashion — welcome film, crackers, reveals
   No dependencies. Real CC0 cracker recordings are preloaded; the Web Audio
   synth is the fallback. Audio only starts after an explicit tap (browser
   autoplay policy).
   ========================================================================== */

(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const SESSION_WELCOMED = "fof-welcomed";
  const LOCAL_WELCOMED = "fof-welcomed-once";
  const SESSION_SOUND = "fof-sound";
  const rand = (min, max) => min + Math.random() * (max - min);
  const prefersReduced = () => reduceMotion.matches;

  // sessionStorage can throw when the page is opened from file://
  const store = {
    get(key) {
      try { return sessionStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { sessionStorage.setItem(key, value); } catch { /* ignore */ }
    },
  };

  // The welcome is a one-time event, so refreshes and new tabs go straight to the shop.
  const persist = {
    get(key) {
      try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch { /* ignore */ }
    },
  };

  /* ------------------------------------------------------------------------
     Audio — a tiny firecracker synth
     ------------------------------------------------------------------------ */

  class CrackerAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.noiseBuffer = null;
      this.reverb = null;
      this.enabled = store.get(SESSION_SOUND) === "on";
      this.samples = {};
      this.samplesLoading = false;
      this.samplesLoaded = false;
      this.sampleFailed = false;
    }

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;

        this.ctx = new AC();

        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 0.65 : 0;

        const limiter = this.ctx.createDynamicsCompressor();
        limiter.threshold.value = -3;
        limiter.knee.value = 0;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.0015;
        limiter.release.value = 0.15;

        this.master.connect(limiter);
        limiter.connect(this.ctx.destination);

        // A short outdoor echo, so the crackers sit in a street rather than a vacuum.
        this.reverb = this.ctx.createConvolver();
        this.reverb.buffer = this.makeImpulse(1.6);
        const wet = this.ctx.createGain();
        wet.gain.value = 0.4;
        this.reverb.connect(wet);
        wet.connect(this.master);

        // 2 s of white noise, reused by every layer.
        const rate = this.ctx.sampleRate;
        const buffer = this.ctx.createBuffer(1, rate * 2, rate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noiseBuffer = buffer;
      }

      if (this.ctx.state === "suspended") this.ctx.resume();
      return true;
    }

    // Dark, decaying noise with a few discrete reflections: a narrow street at night.
    makeImpulse(seconds = 1.6) {
      const rate = this.ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const buf = this.ctx.createBuffer(2, len, rate);
      const taps = [
        [0.037, 0.5],
        [0.061, 0.36],
        [0.093, 0.28],
        [0.128, 0.2],
        [0.181, 0.14],
        [0.243, 0.09],
      ];

      const pre = Math.floor(rate * 0.018);
      for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          lp += 0.32 * (white - lp);
          data[i] = i > pre ? lp * Math.pow(1 - i / len, 3) * 0.55 : 0;
        }
        taps.forEach(([sec, amp], idx) => {
          const pos = Math.min(len - 1, Math.floor((sec + (ch ? 0.004 : 0)) * rate));
          data[pos] += amp * ((idx + ch) % 2 ? -1 : 1) * (ch ? 0.85 : 1);
        });
      }
      return buf;
    }

    /* Real recordings, decoded with an offline context so no autoplay gate
       is involved. If any file is missing, the synth above takes over. */
    preload() {
      if (this.samplesLoaded || this.samplesLoading || this.sampleFailed) return;

      const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Offline || typeof fetch !== "function") {
        this.sampleFailed = true;
        return;
      }

      this.samplesLoading = true;
      const offline = new Offline(1, 1, 44100);
      const files = {
        crack1: "assets/audio/cracker-1.mp3",
        crack2: "assets/audio/cracker-2.mp3",
        crack3: "assets/audio/cracker-3.mp3",
        finale: "assets/audio/finale.mp3",
        bomb: "assets/audio/bomb.mp3",
        sparkler: "assets/audio/sparkler.mp3",
        saravedi: "assets/audio/saravedi.mp3?v=20261031-2",
      };

      Promise.all(Object.entries(files).map(([key, url]) =>
        fetch(url)
          .then((response) => {
            if (!response.ok) throw new Error(url);
            return response.arrayBuffer();
          })
          .then((data) => new Promise((resolve, reject) => {
            let settled = false;
            const ok = (buffer) => {
              if (settled) return;
              settled = true;
              resolve(buffer);
            };
            const fail = (error) => {
              if (settled) return;
              settled = true;
              reject(error);
            };
            try {
              const pending = offline.decodeAudioData(data, ok, fail);
              if (pending && pending.then) pending.then(ok, fail);
            } catch (error) {
              fail(error);
            }
          }))
          .then((buffer) => { this.samples[key] = buffer; })
      ))
        .then(() => { this.samplesLoaded = true; })
        .catch(() => { this.sampleFailed = true; })
        .finally(() => { this.samplesLoading = false; });
    }

    playBuffer(buffer, when = 0, { gain = 1, pan = 0, rate = 1, duration = 0, fade = 0.12 } = {}) {
      if (!buffer || !this.ctx) return false;

      const t = this.ctx.currentTime + Math.max(0, when);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;

      const amp = this.ctx.createGain();
      amp.gain.setValueAtTime(gain, t);

      if (duration > 0 && duration < buffer.duration / rate) {
        const tail = Math.min(fade, duration * 0.4);
        amp.gain.setValueAtTime(gain, t + Math.max(0, duration - tail));
        amp.gain.linearRampToValueAtTime(0.0001, t + duration);
        src.start(t);
        src.stop(t + duration + 0.02);
      } else {
        src.start(t);
      }

      const p = this.panner(pan);
      src.connect(amp).connect(p);
      p.connect(this.master);
      return true;
    }

    /* A short, softer cracker for UI confirmation. */
    confirm() {
      if (!this.ready()) return;
      if (this.samples.crack3) {
        this.playBuffer(this.samples.crack3, 0, {
          gain: 0.42,
          pan: 0,
          rate: 1.04,
          duration: 0.85,
          fade: 0.35,
        });
      } else {
        this.crackle(0.6, 8);
      }
    }

    setEnabled(on) {
      this.enabled = on;
      store.set(SESSION_SOUND, on ? "on" : "off");
      if (on) {
        if (!this.ensure()) return;
        this.master.gain.setTargetAtTime(0.65, this.ctx.currentTime, 0.04);
      } else if (this.master) {
        this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      }
      syncSoundUI();
    }

    toggle() {
      this.setEnabled(!this.enabled);
    }

    ready() {
      return this.enabled && this.ensure();
    }

    panner(pan) {
      if (this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        return p;
      }
      return this.ctx.createGain();
    }

    noise(at, duration) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.playbackRate.value = rand(0.9, 1.2);
      const maxOffset = Math.max(0, this.noiseBuffer.duration - duration - 0.1);
      src.start(at, rand(0, Math.min(1.4, maxOffset)), duration + 0.03);
      return src;
    }

    // One grain of debris after the main crack.
    tick(when = 0, { freq = rand(1600, 5200), gain = rand(0.03, 0.1), pan = rand(-0.9, 0.9) } = {}) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + Math.max(0, when);
      const src = this.noise(t, 0.08);
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = freq;
      bp.Q.value = rand(1.2, 4.5);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(gain, t + 0.0015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.025, 0.07));

      const p = this.panner(pan);
      src.connect(bp).connect(env).connect(p);
      p.connect(this.master);

      const send = this.ctx.createGain();
      send.gain.value = 0.05;
      p.connect(send).connect(this.reverb);
    }

    // The full report: supersonic snap, paper/mid body, low pressure wave, debris.
    crack(when = 0, { gain = 0.55, pan = rand(-0.8, 0.8), far = 0, size = rand(0.85, 1.2), room = 0.22 } = {}) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + Math.max(0, when);

      const p = this.panner(pan);
      const tone = this.ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = Math.max(1600, 18000 - far * 11500);
      tone.Q.value = 0.35;

      const out = this.ctx.createGain();
      out.gain.value = gain;
      out.connect(tone).connect(p);
      p.connect(this.master);

      const send = this.ctx.createGain();
      send.gain.value = room + far * 0.28;
      p.connect(send).connect(this.reverb);

      // 1 — the snap. Bright, almost instantaneous.
      const snap = this.noise(t, 0.08);
      const hp = this.ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = rand(1300, 2600);
      const snapEnv = this.ctx.createGain();
      snapEnv.gain.setValueAtTime(0.0001, t);
      snapEnv.gain.exponentialRampToValueAtTime(0.9 * size, t + 0.0009);
      snapEnv.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.018, 0.045));
      snap.connect(hp).connect(snapEnv).connect(out);

      // 2 — the paper-and-gunpowder body.
      const body = this.noise(t, 0.22);
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = rand(420, 950);
      bp.Q.value = 0.7;
      const bodyEnv = this.ctx.createGain();
      bodyEnv.gain.setValueAtTime(0.0001, t);
      bodyEnv.gain.exponentialRampToValueAtTime(0.72 * size, t + 0.003);
      bodyEnv.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.1, 0.2));
      body.connect(bp).connect(bodyEnv).connect(out);

      // 3 — the low thump that you feel in the chest.
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(rand(130, 180), t);
      osc.frequency.exponentialRampToValueAtTime(rand(42, 56), t + 0.22 + size * 0.08);
      const oscEnv = this.ctx.createGain();
      oscEnv.gain.setValueAtTime(0.0001, t);
      oscEnv.gain.exponentialRampToValueAtTime(0.8, t + 0.004);
      oscEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.24 + size * 0.16);
      osc.connect(oscEnv).connect(out);
      osc.start(t);
      osc.stop(t + 0.5);

      // 4 — a soft pressure wave under the thump.
      const thud = this.noise(t, 0.35);
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 150;
      const thudEnv = this.ctx.createGain();
      thudEnv.gain.setValueAtTime(0.0001, t);
      thudEnv.gain.exponentialRampToValueAtTime(0.7, t + 0.005);
      thudEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      thud.connect(lp).connect(thudEnv).connect(out);

      // 5 — grit falling after the burst.
      const bits = Math.floor(rand(2, 6));
      for (let i = 0; i < bits; i++) {
        this.tick(when + rand(0.02, 0.24), {
          gain: rand(0.015, 0.05),
          pan: rand(-0.9, 0.9),
        });
      }
    }

    rumble(when = 0, gain = 0.5) {
      const t = this.ctx.currentTime + Math.max(0, when);
      const src = this.noise(t, 0.9);
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 120;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(gain, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      const p = this.panner(0);
      src.connect(lp).connect(env).connect(p);
      p.connect(this.master);
      const send = this.ctx.createGain();
      send.gain.value = 0.2;
      p.connect(send).connect(this.reverb);
    }

    /* A string of pops. */
    crackle(duration = 1.1, count = 16) {
      if (!this.ready()) return;
      for (let i = 0; i < count; i++) {
        this.tick(Math.pow(Math.random(), 1.2) * duration, {
          gain: rand(0.025, 0.1),
          pan: rand(-0.9, 0.9),
        });
      }
      const hits = Math.max(1, Math.round(count / 9));
      for (let i = 0; i < hits; i++) {
        this.crack(rand(0.05, duration), {
          gain: rand(0.16, 0.3),
          size: rand(0.7, 1),
          far: rand(0.2, 0.65),
          room: 0.5,
          pan: rand(-1, 1),
        });
      }
    }

    /* One aerial firework: a real recording when available, synth otherwise. */
    burst(when = 0, { big = true } = {}) {
      if (!this.ready()) return;

      const recorded = big
        ? (Math.random() < 0.5 ? this.samples.crack1 : this.samples.crack2)
        : this.samples.crack3;
      if (recorded) {
        this.playBuffer(recorded, when, {
          gain: big ? 0.95 : 0.68,
          pan: rand(-0.5, 0.5),
          rate: rand(0.94, 1.06),
        });
        return;
      }

      const t = when + rand(0, 0.015);
      this.crack(t, {
        gain: big ? 0.9 : 0.65,
        size: big ? 1.55 : 1.1,
        far: 0.05,
        room: 0.3,
        pan: rand(-0.4, 0.4),
      });
      this.crack(t + rand(0.006, 0.018), {
        gain: big ? 0.32 : 0.18,
        size: 0.8,
        far: 0.2,
        room: 0.35,
        pan: rand(-0.9, 0.9),
      });
      if (big) this.rumble(t, 0.5);

      const count = big ? 30 : 18;
      const span = big ? 1.25 : 0.8;
      for (let i = 0; i < count; i++) {
        this.tick(t + Math.pow(Math.random(), 0.65) * span, {
          freq: rand(1200, 6200),
          gain: rand(0.012, big ? 0.075 : 0.05),
          pan: rand(-1, 1),
        });
      }
    }

    /* A flower-pot fountain: a hiss with a thousand tiny sparks. */
    fountain(duration = 1.9, when = 0) {
      if (!this.ready()) return;

      if (this.samples.sparkler) {
        this.playBuffer(this.samples.sparkler, when, {
          gain: 1.4,
          pan: rand(-0.2, 0.2),
          rate: rand(0.97, 1.03),
          duration,
          fade: 0.35,
        });
        return;
      }

      const t = this.ctx.currentTime + Math.max(0, when);

      const src = this.noise(t, duration);
      const hp = this.ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1800;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.075, t + 0.12);
      env.gain.setValueAtTime(0.075, t + duration - 0.3);
      env.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      const p = this.panner(rand(-0.25, 0.25));
      src.connect(hp).connect(env).connect(p);
      p.connect(this.master);
      const send = this.ctx.createGain();
      send.gain.value = 0.12;
      p.connect(send).connect(this.reverb);

      const ticks = Math.round(duration * 34);
      for (let i = 0; i < ticks; i++) {
        this.tick(when + rand(0.05, duration), {
          freq: rand(2000, 6500),
          gain: rand(0.008, 0.035),
          pan: rand(-0.6, 0.6),
        });
      }
    }

    /* A whole saravedi — a rapid string of small crackers. The recording is
       assembled from the real single-cracker takes, so it keeps the papery
       snap without the heavy boom of an aerial shell. */
    saravedi(when = 0, duration = 1.7) {
      if (!this.ready()) return;

      if (this.samples.saravedi) {
        this.playBuffer(this.samples.saravedi, when, {
          gain: 0.92,
          pan: rand(-0.12, 0.12),
          rate: rand(0.99, 1.01),
          duration,
          fade: 0.28,
        });
        return;
      }

      const count = Math.max(12, Math.round(duration * 20));
      for (let i = 0; i < count; i++) {
        this.crack(Math.pow(i / count, 0.92) * duration + rand(0, 0.02), {
          gain: rand(0.12, 0.24),
          size: rand(0.35, 0.55),
          far: rand(0.25, 0.55),
          room: 0.4,
          pan: rand(-0.85, 0.85),
        });
      }
    }

    finale() {
      if (!this.ready()) return;

      if (this.samples.finale) {
        this.playBuffer(this.samples.finale, 0, { gain: 0.9, pan: 0 });
        if (this.samples.bomb) {
          this.playBuffer(this.samples.bomb, 2.1, {
            gain: 0.95,
            pan: rand(-0.25, 0.25),
            rate: rand(0.97, 1.03),
          });
        }
        this.fountain(1.6, 0.35);
        return;
      }

      this.burst(0, { big: true });
      this.burst(0.26, { big: false });
      this.burst(0.55, { big: true });
      this.crackle(2.2, 36);
      this.fountain(1.3, 0.5);
    }
  }

  const audio = new CrackerAudio();
  audio.preload();

  /* ------------------------------------------------------------------------
     Fireworks field
     ------------------------------------------------------------------------ */

  class Fireworks {
    constructor(canvas, { embers = false } = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.withEmbers = embers;
      this.particles = [];
      this.embers = [];
      this.fountains = [];
      this.running = false;
      this.paused = false;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = 0;
      this.h = 0;
      this.last = 0;
      this.resize = this.resize.bind(this);
      this.tick = this.tick.bind(this);
      window.addEventListener("resize", this.resize);
      this.resize();
    }

    resize() {
      const w = this.canvas.clientWidth || window.innerWidth;
      const h = this.canvas.clientHeight || window.innerHeight;
      this.w = w;
      this.h = h;
      this.canvas.width = Math.max(1, Math.floor(w * this.dpr));
      this.canvas.height = Math.max(1, Math.floor(h * this.dpr));
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    start() {
      if (!this.w) this.resize();
      if (this.withEmbers) this.seedEmbers();
      if (!this.running) {
        this.running = true;
        this.last = performance.now();
        requestAnimationFrame(this.tick);
      }
    }

    stop() {
      this.running = false;
      this.particles.length = 0;
      this.embers.length = 0;
      this.fountains.length = 0;
      this.ctx.clearRect(0, 0, this.w, this.h);
    }

    seedEmbers() {
      for (let i = 0; i < 30; i++) {
        this.embers.push(this.makeEmber(true));
      }
    }

    makeEmber(spread) {
      return {
        x: rand(0, this.w),
        y: spread ? rand(0, this.h) : this.h + rand(4, 60),
        vx: rand(-6, 6),
        vy: rand(-26, -9),
        sway: rand(6, 20),
        freq: rand(0.4, 1.4),
        phase: rand(0, Math.PI * 2),
        r: rand(0.6, 1.8),
        alpha: rand(0.25, 0.8),
        life: rand(4, 10),
        max: 10,
        color: Math.random() > 0.35 ? "#E9A23B" : "#F0D79B",
      };
    }

    burst(x, y, { count = 70, power = 1 } = {}) {
      if (prefersReduced() && !this.allowReduced) return;
      const colors = ["#F0D79B", "#E9A23B", "#F8F0E3", "#D9B26A", "#E0563F"];
      const n = window.innerWidth < 640 ? Math.round(count * 0.65) : count;

      for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = rand(40, 230) * power;
        this.particles.push({
          x, y, px: x, py: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 16,
          life: 0,
          max: rand(1.05, 2),
          color: colors[(Math.random() * colors.length) | 0],
          size: rand(0.8, 2.1),
          grav: 118,
          drag: 0.977,
        });
      }

      // bright core crackle
      for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = rand(120, 320) * power;
        this.particles.push({
          x, y, px: x, py: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          max: rand(0.28, 0.6),
          color: "#FFF6E2",
          size: rand(0.7, 1.5),
          grav: 40,
          drag: 0.955,
        });
      }

      this.start();
    }

    fountain(x, y, seconds = 1.6) {
      this.fountains.push({ x, y, until: performance.now() + seconds * 1000 });
      this.start();
    }

    tick(now) {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 0.05);
      this.last = now;

      if (this.paused) {
        requestAnimationFrame(this.tick);
        return;
      }

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";

      /* Embers */
      for (let i = this.embers.length - 1; i >= 0; i--) {
        const e = this.embers[i];
        e.x += e.vx * dt + Math.sin(now / 1000 * e.freq + e.phase) * e.sway * dt;
        e.y += e.vy * dt;
        e.life -= dt;
        if (e.y < -30 || e.life <= 0) {
          this.embers[i] = this.makeEmber(false);
          continue;
        }
        const a = Math.min(1, e.life / 2) * e.alpha;
        ctx.globalAlpha = a;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      }

      /* Sparkler fountains */
      for (let i = this.fountains.length - 1; i >= 0; i--) {
        const f = this.fountains[i];
        if (now > f.until) {
          this.fountains.splice(i, 1);
          continue;
        }
        for (let k = 0; k < 3; k++) {
          this.particles.push({
            x: f.x + rand(-5, 5),
            y: f.y,
            px: f.x,
            py: f.y,
            vx: rand(-46, 46),
            vy: rand(-250, -140),
            life: 0,
            max: rand(0.55, 1.15),
            color: Math.random() > 0.4 ? "#F6D187" : "#FFF6E2",
            size: rand(0.7, 1.5),
            grav: 260,
            drag: 0.985,
          });
        }
      }

      /* Particles */
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.px = p.x;
        p.py = p.y;
        const drag = Math.pow(p.drag, dt * 60);
        p.vx *= drag;
        p.vy = p.vy * drag + p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life += dt;

        const lifeLeft = 1 - p.life / p.max;
        if (lifeLeft <= 0 || p.y > this.h + 40) {
          this.particles.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = Math.max(0, lifeLeft * lifeLeft);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      if (!this.embers.length && !this.fountains.length && !this.particles.length) {
        this.running = false;
        ctx.clearRect(0, 0, this.w, this.h);
        return;
      }

      requestAnimationFrame(this.tick);
    }
  }

  /* ------------------------------------------------------------------------
     Elements
     ------------------------------------------------------------------------ */

  const film = document.getElementById("welcomeFilm");
  const filmFxCanvas = document.getElementById("filmFx");
  const pageFxCanvas = document.getElementById("pageFx");
  if (!film || !filmFxCanvas) return;

  const filmFx = new Fireworks(filmFxCanvas, { embers: true });
  const pageFx = new Fireworks(pageFxCanvas);
  pageFx.allowReduced = true; // explicit user action, so motion is allowed

  const enterBtn = film.querySelector(".film__enter");
  const skipBtn = film.querySelector(".film__skip");
  const soundBtn = document.getElementById("soundToggle");
  const soundLabel = soundBtn ? soundBtn.querySelector(".film__sound-label") : null;

  let filmOpen = false;
  let filmTimers = [];
  let autoClose = null;
  let lastFocused = null;

  const clearTimers = () => {
    filmTimers.forEach(clearTimeout);
    filmTimers = [];
    if (autoClose) {
      clearTimeout(autoClose);
      autoClose = null;
    }
  };

  function syncSoundUI() {
    if (!soundBtn) return;
    const on = audio.enabled;
    soundBtn.setAttribute("aria-pressed", String(on));
    soundBtn.setAttribute("aria-label", on ? "Mute cracker sound" : "Enable cracker sound");
    if (soundLabel) soundLabel.textContent = on ? "Sound on" : "Sound off";
  }

  /* ------------------------------------------------------------------------
     Saravedi — a long string of crackers
     ------------------------------------------------------------------------ */

  const SARAVEDI_COUNT = 18;

  function buildSaravedi() {
    const rack = film.querySelector(".film__saravedi-crackers");
    const path = film.querySelector(".film__saravedi-string path");
    if (!rack) return;

    rack.replaceChildren();
    if (!path) return;

    const length = path.getTotalLength();
    for (let i = 0; i < SARAVEDI_COUNT; i++) {
      const t = SARAVEDI_COUNT === 1 ? 0 : i / (SARAVEDI_COUNT - 1);
      const point = path.getPointAtLength(length * t);
      const ahead = path.getPointAtLength(Math.min(length, length * t + 1.5));
      const angle = Math.atan2(ahead.y - point.y, ahead.x - point.x) * (180 / Math.PI);

      const cracker = document.createElement("span");
      cracker.className = "film__saravedi-cracker";
      cracker.style.setProperty("--i", i);
      cracker.style.left = `${point.x.toFixed(2)}%`;
      cracker.style.top = `${point.y.toFixed(2)}%`;
      cracker.style.transform = `translate(-50%, -50%) rotate(${(angle - 90).toFixed(1)}deg)`;
      rack.appendChild(cracker);
    }
  }

  function igniteSaravedi() {
    film.classList.add("is-saravedi");
    if (audio.ready()) audio.saravedi(0, 1.7);

    // A tiny spark at every cracker, timed to the visual chain reaction.
    film.querySelectorAll(".film__saravedi-cracker").forEach((cracker, i) => {
      filmTimers.push(setTimeout(() => {
        const rect = cracker.getBoundingClientRect();
        filmFx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, {
          count: 7,
          power: 0.22,
        });
      }, 30 + i * 72));
    });
  }

  buildSaravedi();

  /* ------------------------------------------------------------------------
     Welcome film controller
     ------------------------------------------------------------------------ */

  function fire(xRatio, yRatio, options) {
    filmFx.burst(filmFx.w * xRatio, filmFx.h * yRatio, options);
  }

  function openFilm() {
    if (filmOpen) return;
    filmOpen = true;
    // Mark it seen as soon as it starts, so a refresh mid-film doesn't replay it.
    persist.set(LOCAL_WELCOMED, "1");
    store.set(SESSION_WELCOMED, "1");
    lastFocused = document.activeElement;
    clearTimers();

    film.classList.remove(
      "stage-1", "stage-2", "stage-3", "stage-ready", "is-closing", "is-saravedi"
    );
    buildSaravedi();
    film.classList.add("is-active");
    film.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-locked");

    if (prefersReduced()) {
      film.classList.add("stage-1", "stage-2", "stage-3", "stage-ready");
      filmFx.stop();
    } else {
      filmFx.resize();
      filmFx.start();

      filmTimers.push(setTimeout(() => film.classList.add("stage-1"), 220));
      filmTimers.push(setTimeout(() => film.classList.add("stage-2"), 1450));
      filmTimers.push(setTimeout(() => film.classList.add("stage-3"), 2950));
      filmTimers.push(setTimeout(() => film.classList.add("stage-ready"), 3850));

      filmTimers.push(setTimeout(() => {
        fire(0.26, 0.3, { count: 56, power: 0.9 });
        if (audio.ready()) audio.burst(0, { big: false });
      }, 800));

      filmTimers.push(setTimeout(() => {
        fire(0.72, 0.26, { count: 74, power: 1.05 });
        fire(0.5, 0.17, { count: 48, power: 0.8 });
        if (audio.ready()) {
          audio.burst(0, { big: true });
          audio.burst(rand(0.05, 0.1), { big: false });
        }
      }, 2350));

      filmTimers.push(setTimeout(igniteSaravedi, 3120));

      filmTimers.push(setTimeout(() => {
        filmFx.fountain(filmFx.w * 0.5, filmFx.h * 0.84, 1.9);
        if (audio.ready()) audio.fountain(1.9);
      }, 4200));

      filmTimers.push(setTimeout(() => {
        fire(0.3, 0.22, { count: 84, power: 1.2 });
        fire(0.7, 0.2, { count: 78, power: 1.1 });
        fire(0.5, 0.12, { count: 92, power: 1.35 });
        if (audio.ready()) audio.finale();
      }, 6100));

      autoClose = setTimeout(() => closeFilm({ restoreFocus: false }), 9900);
    }

    enterBtn.focus({ preventScroll: true });
  }

  function closeFilm({ restoreFocus = true } = {}) {
    if (!filmOpen) return;
    filmOpen = false;
    clearTimers();

    film.classList.add("is-closing");
    document.body.classList.remove("is-locked");
    document.body.classList.add("is-ready");
    store.set(SESSION_WELCOMED, "1");

    setTimeout(() => {
      film.classList.remove(
        "is-active", "is-closing", "stage-1", "stage-2", "stage-3", "stage-ready", "is-saravedi"
      );
      film.setAttribute("aria-hidden", "true");
      filmFx.stop();
    }, 820);

    if (restoreFocus) {
      const main = document.getElementById("main");
      if (main) main.focus({ preventScroll: true });
    } else if (lastFocused && lastFocused.focus) {
      // keep the reader on whatever was focused before, without scrolling
      lastFocused.focus({ preventScroll: true });
    }
  }

  enterBtn.addEventListener("click", () => {
    if (audio.enabled) audio.confirm();
    closeFilm();
  });

  skipBtn.addEventListener("click", () => closeFilm());

  if (soundBtn) {
    const noAudio = !(window.AudioContext || window.webkitAudioContext);
    if (noAudio) soundBtn.hidden = true;
    soundBtn.addEventListener("click", () => {
      audio.toggle();
      if (audio.enabled) audio.confirm();
    });
    syncSoundUI();
  }

  document.addEventListener("keydown", (event) => {
    if (!filmOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeFilm();
      return;
    }

    if (event.key === "Tab") {
      const focusables = [enterBtn, soundBtn, skipBtn].filter(Boolean);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  document.querySelectorAll("[data-replay-film]").forEach((btn) => {
    btn.addEventListener("click", openFilm);
  });

  /* ------------------------------------------------------------------------
     "Light the sky" — an explicit, user-triggered burst
     ------------------------------------------------------------------------ */

  const lightBtn = document.querySelector("[data-fireworks]");
  if (lightBtn) {
    lightBtn.addEventListener("click", () => {
      if (!audio.enabled) audio.setEnabled(true);
      audio.finale();
      syncSoundUI();

      pageFx.resize();
      const rect = lightBtn.getBoundingClientRect();
      const originX = rect.left + rect.width / 2;
      const originY = rect.top + rect.height / 2;

      const shots = [
        { x: originX, y: originY - 20, count: 60, power: 0.9 },
        { x: window.innerWidth * 0.22, y: window.innerHeight * 0.28, count: 80, power: 1.1 },
        { x: window.innerWidth * 0.78, y: window.innerHeight * 0.24, count: 80, power: 1.1 },
        { x: window.innerWidth * 0.5, y: window.innerHeight * 0.16, count: 100, power: 1.3 },
      ];

      shots.forEach((shot) => {
        setTimeout(() => pageFx.burst(shot.x, shot.y, shot), 120 * shots.indexOf(shot));
      });
    });
  }

  /* ------------------------------------------------------------------------
     Chrome: header, menu, reveals, year
     ------------------------------------------------------------------------ */

  const head = document.getElementById("siteHead");
  const nav = document.getElementById("primaryNav");
  const navToggle = document.getElementById("navToggle");

  const onScroll = () => {
    if (head) head.classList.toggle("is-scrolled", window.scrollY > 24);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const setMenu = (open) => {
    if (!nav || !navToggle) return;
    nav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("is-locked", open || filmOpen);
  };

  if (navToggle) {
    navToggle.addEventListener("click", () => {
      setMenu(!nav.classList.contains("is-open"));
    });
  }

  if (nav) {
    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenu(false));
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav && nav.classList.contains("is-open")) {
      setMenu(false);
      navToggle.focus();
    }
  });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
  );

  document.querySelectorAll(".reveal").forEach((el) => {
    if (el.closest(".hero")) return;
    io.observe(el);
  });

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* Soft parallax on the hero backdrop */
  const heroBg = document.querySelector(".hero__bg");
  if (heroBg && !prefersReduced()) {
    let queued = false;
    window.addEventListener(
      "scroll",
      () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          const y = Math.min(window.scrollY, window.innerHeight);
          heroBg.style.transform = `translate3d(0, ${y * 0.16}px, 0)`;
          queued = false;
        });
      },
      { passive: true }
    );
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */

  document.addEventListener("visibilitychange", () => {
    filmFx.paused = document.hidden;
    pageFx.paused = document.hidden;
  });

  const seen = persist.get(LOCAL_WELCOMED) === "1" || store.get(SESSION_WELCOMED) === "1";

  if (!seen && !prefersReduced()) {
    // Hold the hero until the film has played.
    setTimeout(openFilm, 450);
  } else {
    document.body.classList.add("is-ready");
  }
})();
