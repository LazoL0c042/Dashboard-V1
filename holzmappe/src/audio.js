// Umgebungsklang, vollständig im Browser erzeugt (keine Audiodateien).
// Kanäle: wind, leaves, birds, water, crickets, crackle, drone, owl, bees, paper
export class Ambience {
  constructor() { this.ctx = null; this.on = false; this.ch = {}; this.timers = []; this.mix = {}; }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
    const rev = this.reverb = ctx.createConvolver(); rev.buffer = this.impulse(2.8); const rg = ctx.createGain(); rg.gain.value = 0.35; rev.connect(rg).connect(this.master);
    this.noise = this.noiseBuffer();
    const bus = (name, send = 0.3) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.master); const s = ctx.createGain(); s.gain.value = send; g.connect(s).connect(rev); this.ch[name] = g; return g; };
    // Wind: gefiltertes Rauschen mit langsamer Modulation
    { const g = bus('wind', 0.2); const src = this.loopNoise(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 260; lfo.connect(lg).connect(f.frequency); lfo.start();
      const am = ctx.createGain(); am.gain.value = 0.5; const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.11; const lg2 = ctx.createGain(); lg2.gain.value = 0.35; lfo2.connect(lg2).connect(am.gain); lfo2.start();
      src.connect(f).connect(am).connect(g); }
    // Blätter: hohes Rauschen, böig
    { const g = bus('leaves', 0.25); const src = this.loopNoise(); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2200; const am = ctx.createGain(); am.gain.value = 0.15;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.23; const lg = ctx.createGain(); lg.gain.value = 0.13; lfo.connect(lg).connect(am.gain); lfo.start(); src.connect(f).connect(am).connect(g); }
    // Wasser: tiefes Rauschen + Tropfen
    { const g = bus('water', 0.3); const src = this.loopNoise(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; const am = ctx.createGain(); am.gain.value = 0.35; src.connect(f).connect(am).connect(g); }
    // Bordun: weicher, verträumter Klangteppich
    { const g = bus('drone', 0.7); this.droneOsc = [];
      [1, 1.5, 2, 3].forEach((m, i) => { const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = 82 * m; const og = ctx.createGain(); og.gain.value = [0.18, 0.07, 0.06, 0.025][i];
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03; const lg = ctx.createGain(); lg.gain.value = og.gain.value * 0.6; lfo.connect(lg).connect(og.gain); lfo.start();
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; o.connect(og).connect(lp).connect(g); o.start(); this.droneOsc.push([o, m]); }); }
    for (const n of ['birds', 'crickets', 'crackle', 'owl', 'bees', 'paper']) bus(n, n === 'birds' || n === 'owl' ? 0.5 : 0.2);
    this.schedule();
  }

  impulse(sec) { const ctx = this.ctx, len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); } return b; }
  noiseBuffer() { const ctx = this.ctx, len = ctx.sampleRate * 3, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3; } return b; }
  loopNoise() { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.start(0, Math.random() * 2); return s; }

  // Ereignisse: Vogelrufe, Grillen, Knistern, Eule, Bienen
  schedule() {
    const ctx = this.ctx;
    const every = (fn, min, max) => { const tick = () => { if (this.on) fn(); this.timers.push(setTimeout(tick, (min + Math.random() * (max - min)) * 1000)); }; tick(); };
    const tone = (ch, f0, f1, dur, type = 'sine', vol = 0.2, delay = 0) => { const t = ctx.currentTime + delay; const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (p) { p.pan.value = Math.random() * 1.6 - 0.8; o.connect(g).connect(p).connect(this.ch[ch]); } else o.connect(g).connect(this.ch[ch]); o.start(t); o.stop(t + dur + 0.05); };
    const burst = (ch, dur, freq, vol, delay = 0) => { const t = ctx.currentTime + delay; const s = ctx.createBufferSource(); s.buffer = this.noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2; const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(g).connect(this.ch[ch]); s.start(t, Math.random() * 2); s.stop(t + dur); };
    every(() => { if (!this.mix.birds) return; const base = 2200 + Math.random() * 2400; const n = 2 + Math.floor(Math.random() * 5); for (let i = 0; i < n; i++) tone('birds', base * (1 + Math.random() * 0.3), base * (0.7 + Math.random() * 0.8), 0.08 + Math.random() * 0.12, 'sine', 0.12, i * 0.13); }, 1.5, 5);
    every(() => { if (!this.mix.crickets) return; for (let i = 0; i < 6; i++) tone('crickets', 4300, 4250, 0.03, 'square', 0.025, i * 0.06); }, 0.6, 1.4);
    every(() => { if (!this.mix.crackle) return; for (let i = 0; i < 1 + Math.random() * 4; i++) burst('crackle', 0.02 + Math.random() * 0.04, 1500 + Math.random() * 3000, 0.25, Math.random() * 0.4); }, 0.15, 0.9);
    every(() => { if (!this.mix.owl) return; tone('owl', 420, 380, 0.5, 'sine', 0.18); tone('owl', 410, 360, 0.9, 'sine', 0.16, 0.8); }, 9, 18);
    every(() => { if (!this.mix.bees) return; tone('bees', 220 + Math.random() * 40, 230 + Math.random() * 40, 1.5 + Math.random(), 'sawtooth', 0.012); }, 1.2, 3);
    every(() => { if (!this.mix.water) return; tone('water', 900 + Math.random() * 900, 1800 + Math.random() * 600, 0.06, 'sine', 0.06); }, 0.5, 2.2);
  }

  setMix(mix = {}) {
    this.mix = mix; if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [n, g] of Object.entries(this.ch)) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime((mix[n] || 0) * (n === 'drone' ? 0.6 : 1), t, 1.2); }
    if (mix.droneNote && this.droneOsc) this.droneOsc.forEach(([o, m]) => o.frequency.setTargetAtTime(mix.droneNote * m, t, 2));
  }

  toggle(force) {
    this.on = force ?? !this.on;
    if (this.on) { this.init(); if (!this.ctx) return false; this.ctx.resume(); this.master.gain.setTargetAtTime(0.7, this.ctx.currentTime, 0.8); this.setMix(this.mix); }
    else if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    return this.on;
  }
}
