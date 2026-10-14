// ===== audio.js : high-fidelity synthesized Web Audio (no asset files) =====

function makeAudio() {
  const A = { ctx: null, master: null, musicGain: null, sfxGain: null, reverb: null, enabled: false, started: false };
  A.init = function () {
    if (A.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    A.ctx = new Ctx();
    A.master = A.ctx.createGain(); A.master.gain.value = 0.9; A.master.connect(A.ctx.destination);
    A.musicGain = A.ctx.createGain(); A.musicGain.gain.value = 0.34; A.musicGain.connect(A.master);
    A.sfxGain = A.ctx.createGain(); A.sfxGain.gain.value = 0.6; A.sfxGain.connect(A.master);
    // reverb
    const len = A.ctx.sampleRate * 2.2;
    const buf = A.ctx.createBuffer(2, len, A.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); }
    A.reverb = A.ctx.createConvolver(); A.reverb.buffer = buf;
    A.reverbGain = A.ctx.createGain(); A.reverbGain.gain.value = 0.35; A.reverb.connect(A.reverbGain); A.reverbGain.connect(A.master);
    A._noise = null;
  };
  A.resume = function () { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); A.started = true; };
  A.setMuted = function (m) { if (A.master) A.master.gain.value = m ? 0 : 0.9; A.enabled = !m; };

  function env(node, t, a, d, peak, sus) {
    const g = node.gain; g.cancelScheduledValues(t); g.setValueAtTime(0.0001, t); g.exponentialRampToValueAtTime(peak, t + a); g.exponentialRampToValueAtTime(Math.max(0.0001, sus != null ? sus : 0.0001), t + a + d);
  }
  function tone(freq, type, dur, gain, dest, detune) {
    if (!A.ctx) return;
    const o = A.ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq; if (detune) o.detune.value = detune;
    const g = A.ctx.createGain(); env(g, A.ctx.currentTime, 0.006, dur, gain, 0.0001);
    o.connect(g); g.connect(dest || A.sfxGain); o.start(); o.stop(A.ctx.currentTime + dur + 0.05);
    return o;
  }
  function noiseBurst(dur, gain, lp, dest) {
    if (!A.ctx) return;
    const n = A.ctx.createBufferSource();
    const len = A.ctx.sampleRate * dur; const b = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = b;
    const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1800;
    const g = A.ctx.createGain(); env(g, A.ctx.currentTime, 0.004, dur, gain, 0.0001);
    n.connect(f); f.connect(g); g.connect(dest || A.sfxGain); n.start(); n.stop(A.ctx.currentTime + dur + 0.05);
  }

  A.sfx = {
    click() { tone(660, 'triangle', 0.08, 0.18); },
    build() { tone(330, 'sawtooth', 0.12, 0.22); tone(495, 'triangle', 0.18, 0.16); A.spawnLight && 0; },
    deny() { tone(180, 'square', 0.12, 0.14); },
    fire(kind, hue) {
      if (kind === 'arc') { tone(900, 'sawtooth', 0.16, 0.18); tone(1340, 'sawtooth', 0.16, 0.12); }
      else if (kind === 'frost') { tone(420, 'sine', 0.22, 0.16); tone(620, 'sine', 0.22, 0.1); }
      else if (kind === 'beam') { tone(180, 'sawtooth', 0.3, 0.22); tone(360, 'sawtooth', 0.3, 0.12); }
      else if (kind === 'flak') { noiseBurst(0.12, 0.25, 2600); tone(220, 'square', 0.1, 0.12); }
      else { tone(520, 'square', 0.09, 0.18); noiseBurst(0.06, 0.12, 3200); }
    },
    hit() { noiseBurst(0.05, 0.12, 3000); },
    boom() { noiseBurst(0.32, 0.4, 900); tone(70, 'sine', 0.4, 0.3, A.reverb); },
    kill(hue) { tone(880, 'triangle', 0.14, 0.14); tone(1320, 'sine', 0.18, 0.1, A.reverb); },
    leak() { tone(140, 'sawtooth', 0.5, 0.3); tone(90, 'square', 0.6, 0.2, A.reverb); },
    wave() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 'triangle', 0.3, 0.2, A.musicGain), i * 90)); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 'triangle', 0.5, 0.25, A.reverb), i * 140)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 'sawtooth', 0.5, 0.22, A.reverb), i * 160)); },
  };

  // ambient drone
  A.startMusic = function () {
    if (!A.ctx || A._music) return;
    A._music = true;
    const chord = [55, 82.4, 110, 164.8]; // A1 E2 A2 E3-ish, vaporwave low pad
    A._pads = chord.map((f, i) => {
      const o = A.ctx.createOscillator(); o.type = i % 2 ? 'sine' : 'triangle'; o.frequency.value = f;
      const lfo = A.ctx.createOscillator(); lfo.frequency.value = 0.07 + i * 0.03; const lg = A.ctx.createGain(); lg.gain.value = 0.5;
      const g = A.ctx.createGain(); g.gain.value = 0.12;
      lfo.connect(lg); lg.connect(o.detune); o.connect(g); g.connect(A.musicGain); g.connect(A.reverb);
      o.start(); lfo.start();
      return { o, lfo };
    });
  };
  A.stopMusic = function () {
    if (!A._pads) return; A._pads.forEach((p) => { try { p.o.stop(); p.lfo.stop(); } catch (e) {} }); A._pads = null; A._music = false;
  };
  return A;
}
