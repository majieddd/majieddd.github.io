/* lowpoly/js/audio.js — Web Audio engine, everything synthesised.
   Brand constraints from docs/BRAND.md: tempo 84, deep vaporwave register
   (SFX_DEPTH 0.62 — do not brighten). Chain: buses -> compressor -> destination.
   Music is a scheduled step sequencer (two crossfaded intensity layers);
   SFX are layered primitives (tone/noise/boom) with world-space panning.
   Every entry point is a no-op before Audio.init(), so the engine can be
   wired anywhere in the code without ceremony. */
(function () {
  'use strict';

  const TEMPO = 84;                       // brand-locked
  const STEP = 60 / TEMPO / 4;            // 16th note
  const DEPTH_CUTOFF = 7400;              // SFX_DEPTH 0.62 — never brighten

  const A = {
    ctx: null,
    master: null, comp: null,
    sfxBus: null, musicBus: null, ambBus: null,
    reverb: null, reverbGain: null,
    delay: null, delayGain: null,
    musicIntensity: 0,                    // 0..1, crossfades layer B + filter
    _targetIntensity: 0,
    _step: 0, _nextT: 0, _schedTimer: 0, _rootMidi: 0,
    _ambTimer: 0, _ambNext: 0,
    vol: { master: 0.9, music: 0.55, sfx: 0.8 },
    muted: false
  };

  /* ------------------------------------------------------------ */
  function init() {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = A.ctx = new Ctx();

    A.master = ctx.createGain();
    A.master.gain.value = A.muted ? 0 : A.vol.master;
    A.comp = ctx.createDynamicsCompressor();
    A.comp.threshold.value = -16;
    A.comp.knee.value = 18;
    A.comp.ratio.value = 4.5;
    A.comp.attack.value = 0.004;
    A.comp.release.value = 0.22;
    A.master.connect(A.comp);
    A.comp.connect(ctx.destination);

    /* The deep register: a lowpass that never opens fully, the brand's
       0.62 depth. */
    const depth = ctx.createBiquadFilter();
    depth.type = 'lowpass';
    depth.frequency.value = DEPTH_CUTOFF;
    depth.Q.value = 0.4;

    A.sfxBus = ctx.createGain(); A.sfxBus.gain.value = A.vol.sfx;
    A.sfxBus.connect(depth); depth.connect(A.master);

    A.musicBus = ctx.createGain(); A.musicBus.gain.value = A.vol.music;
    A.musicBus.connect(A.master);

    A.ambBus = ctx.createGain(); A.ambBus.gain.value = 0.5;
    A.ambBus.connect(A.master);

    /* Reverb from a synthesised impulse: stereo noise, 2.4s, exponential fall. */
    A.reverb = ctx.createConvolver();
    A.reverb.buffer = impulse(ctx, 2.4, 2.8);
    A.reverbGain = ctx.createGain(); A.reverbGain.gain.value = 0.34;
    A.reverb.connect(A.reverbGain);
    A.reverbGain.connect(A.sfxBus);

    /* Dotted-8th echo, the vaporwave staple. */
    A.delay = ctx.createDelay(1.2);
    A.delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600;
    A.delay.connect(tone); tone.connect(fb); fb.connect(A.delay);
    A.delayGain = ctx.createGain(); A.delayGain.gain.value = 0.0;
    A.delay.connect(A.delayGain); A.delayGain.connect(A.sfxBus);

    startMusic();
    startAmbience();
  }

  function impulse(ctx, secs, decay) {
    const len = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  /* ------------------------------------------------------------ */
  /* Primitives. Every sound is built from these. */
  function tone(freq, dur, type, vol, o) {
    if (!A.ctx) return;
    const oo = o || {};
    const ctx = A.ctx;
    const t0 = (oo.at || 0) + ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (oo.glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, oo.glide), t0 + dur);
    if (oo.detune) osc.detune.value = oo.detune;
    const g = ctx.createGain();
    const a = oo.attack === undefined ? 0.004 : oo.attack;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    let tail = g;
    if (oo.filter) {
      const f = ctx.createBiquadFilter();
      f.type = oo.filter[0]; f.frequency.value = oo.filter[1];
      if (oo.filterQ) f.Q.value = oo.filterQ;
      g.connect(f); tail = f;
    }
    tail.connect(oo.bus === 'music' ? A.musicBus : (oo.bus || A.sfxBus));
    if (oo.reverb) {
      const rv = ctx.createGain(); rv.gain.value = oo.reverb;
      tail.connect(rv); rv.connect(A.reverb);
    }
    if (oo.delay) {
      const dl = ctx.createGain(); dl.gain.value = oo.delay;
      tail.connect(dl); dl.connect(A.delay);
    }
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, type, f0, f1, o) {
    if (!A.ctx) return;
    const oo = o || {};
    const ctx = A.ctx;
    const t0 = (oo.at || 0) + ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    f.Q.value = oo.Q || 0.8;
    const g = ctx.createGain();
    const a = oo.attack === undefined ? 0.002 : oo.attack;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g);
    let tail = g;
    if (oo.pan !== undefined) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, oo.pan));
      g.connect(p); tail = p;
    }
    tail.connect(oo.bus === 'music' ? A.musicBus : (oo.bus || A.sfxBus));
    if (oo.reverb) { const rv = ctx.createGain(); rv.gain.value = oo.reverb; tail.connect(rv); rv.connect(A.reverb); }
    src.start(t0);
  }

  function boom(freq, dur, vol, o) {
    const oo = o || {};
    tone(freq, dur, 'sine', vol * 0.9, { at: oo.at, glide: freq * 0.32, attack: 0.006, reverb: 0.5, filter: ['lowpass', 420] });
    tone(freq * 1.5, dur * 0.6, 'triangle', vol * 0.35, { at: oo.at, glide: freq * 0.5, attack: 0.004, reverb: 0.3, filter: ['lowpass', 800] });
    noise(dur * 0.5, vol * 0.5, 'lowpass', 300, 90, { at: oo.at, reverb: 0.5 });
  }

  function panOf(worldX) {
    if (window.Game && Game.camTarget) {
      const t = Game.camTarget;
      const dx = worldX - t.x;
      return Math.max(-1, Math.min(1, dx / 22));
    }
    return 0;
  }

  /* ------------------------------------------------------------ */
  /* Event vocabulary. Layers are cheap; composition is the identity. */
  const S = {
    click() { tone(620, 0.07, 'sine', 0.12, { glide: 880, filter: ['lowpass', 3200] }); },
    hover() { tone(460, 0.04, 'sine', 0.05, {}); },
    err() { tone(180, 0.14, 'square', 0.07, { glide: 110, filter: ['lowpass', 1200] }); },
    place() {
      tone(190, 0.16, 'triangle', 0.30, { glide: 90, filter: ['lowpass', 700], reverb: 0.3 });
      noise(0.1, 0.16, 'bandpass', 1400, 700, { reverb: 0.2 });
    },
    upgrade() {
      tone(392, 0.5, 'sine', 0.14, { glide: 784, attack: 0.02, reverb: 0.5, delay: 0.3 });
      tone(587, 0.6, 'sine', 0.10, { at: 0.08, glide: 1175, attack: 0.02, reverb: 0.5, delay: 0.3 });
    },
    sell() { tone(300, 0.2, 'triangle', 0.16, { glide: 130, reverb: 0.3 }); },
    coin() { tone(1318, 0.08, 'sine', 0.09, { filter: ['highpass', 900], delay: 0.25 }); },
    waveStart() {
      tone(110, 0.9, 'sawtooth', 0.1, { glide: 220, attack: 0.3, filter: ['lowpass', 500], reverb: 0.5 });
      tone(220, 0.4, 'square', 0.08, { at: 0.1, attack: 0.05, filter: ['lowpass', 900] });
      tone(330, 0.5, 'square', 0.07, { at: 0.35, attack: 0.05, filter: ['lowpass', 1200] });
    },
    waveClear() {
      tone(523, 0.7, 'sine', 0.1, { attack: 0.03, reverb: 0.6, delay: 0.35 });
      tone(659, 0.8, 'sine', 0.08, { at: 0.1, attack: 0.03, reverb: 0.6, delay: 0.35 });
      tone(784, 1.0, 'sine', 0.08, { at: 0.22, attack: 0.03, reverb: 0.6, delay: 0.35 });
    },
    leak() {
      tone(220, 0.35, 'sawtooth', 0.16, { glide: 80, filter: ['lowpass', 900], reverb: 0.4 });
      tone(440, 0.25, 'square', 0.07, { at: 0.05, glide: 220, filter: ['lowpass', 1400] });
    },
    defeat() {
      boom(70, 2.6, 0.5, {});
      tone(220, 1.6, 'sawtooth', 0.12, { at: 0.15, glide: 55, attack: 0.4, filter: ['lowpass', 600], reverb: 0.7 });
    },
    victory() {
      tone(392, 1.4, 'sine', 0.12, { attack: 0.05, reverb: 0.7, delay: 0.4 });
      tone(494, 1.4, 'sine', 0.11, { at: 0.14, attack: 0.05, reverb: 0.7, delay: 0.4 });
      tone(587, 1.8, 'sine', 0.12, { at: 0.28, attack: 0.05, reverb: 0.7, delay: 0.4 });
      tone(784, 2.2, 'sine', 0.1, { at: 0.44, attack: 0.05, reverb: 0.7, delay: 0.4 });
    },
    shootBolt(x) {
      tone(1150, 0.07, 'square', 0.10, { glide: 420, filter: ['lowpass', 4200] });
      tone(2300, 0.04, 'sine', 0.05, { glide: 900, filter: ['highpass', 1800] });
    },
    shootCryo(x) {
      tone(1750, 0.14, 'sine', 0.07, { glide: 2100, attack: 0.02, reverb: 0.3 });
      tone(2620, 0.1, 'triangle', 0.04, { at: 0.02, glide: 3000, reverb: 0.3 });
    },
    shootMortar(x) {
      boom(90, 0.5, 0.22, {});
      noise(0.16, 0.12, 'lowpass', 800, 200, { reverb: 0.3 });
    },
    shootArc(x) {
      noise(0.22, 0.22, 'bandpass', 2600, 900, { Q: 1.4, pan: panOf(x) });
      tone(95, 0.2, 'sawtooth', 0.14, { glide: 240, filter: ['lowpass', 1600], pan: panOf(x) });
    },
    shootFlak(x) {
      noise(0.1, 0.16, 'bandpass', 1800, 500, { pan: panOf(x) });
      noise(0.06, 0.08, 'bandpass', 3200, 900, { at: 0.03, pan: panOf(x) });
    },
    shootRailgun(x) {
      boom(55, 0.7, 0.4, {});
      noise(0.3, 0.2, 'bandpass', 5000, 600, { Q: 1.2, pan: panOf(x) });
    },
    shootPrism(x) {
      tone(880, 0.35, 'sine', 0.06, { glide: 1760, attack: 0.05, reverb: 0.4, delay: 0.3 });
    },
    shootTether(x) {
      tone(140, 0.14, 'triangle', 0.2, { glide: 60, reverb: 0.2 });
      noise(0.08, 0.14, 'bandpass', 900, 300, { pan: panOf(x) });
    },
    shootPyre(x) {
      noise(0.5, 0.3, 'lowpass', 2400, 500, { pan: panOf(x), reverb: 0.2 });
      tone(70, 0.4, 'sawtooth', 0.1, { glide: 45, filter: ['lowpass', 500] });
    },
    shootToxin(x) {
      tone(320, 0.2, 'sine', 0.1, { glide: 110, reverb: 0.4 });
      noise(0.12, 0.1, 'lowpass', 700, 250, { at: 0.04 });
    },
    shootSingularity(x) {
      tone(60, 0.9, 'sine', 0.22, { glide: 30, attack: 0.2, reverb: 0.6 });
      tone(240, 0.7, 'triangle', 0.06, { glide: 90, attack: 0.15, reverb: 0.5 });
    },
    shootCanister(x) {
      noise(0.3, 0.2, 'bandpass', 1200, 400, { Q: 1.8, reverb: 0.3 });
      tone(150, 0.25, 'sine', 0.08, { glide: 70 });
    },
    impactKinetic(x) {
      noise(0.07, 0.14, 'bandpass', 2200, 800, { pan: panOf(x) });
      tone(210, 0.06, 'triangle', 0.1, { glide: 120, pan: panOf(x) });
    },
    impactFire(x) {
      boom(120, 0.5, 0.2, {});
      noise(0.3, 0.16, 'bandpass', 1500, 400, { pan: panOf(x), reverb: 0.3 });
    },
    impactFrost(x) {
      tone(2400, 0.2, 'sine', 0.07, { glide: 1200, reverb: 0.5, pan: panOf(x) });
      noise(0.12, 0.1, 'highpass', 5000, 7000, { pan: panOf(x) });
    },
    impactStorm(x) {
      noise(0.18, 0.18, 'bandpass', 3200, 1200, { Q: 2, pan: panOf(x) });
    },
    impactVenom(x) {
      tone(220, 0.18, 'sawtooth', 0.07, { glide: 70, filter: ['lowpass', 800], pan: panOf(x) });
      noise(0.1, 0.06, 'lowpass', 500, 150, { pan: panOf(x) });
    },
    impactVoid(x) {
      boom(60, 0.8, 0.3, {});
      tone(880, 0.3, 'sine', 0.04, { glide: 220, reverb: 0.5, pan: panOf(x) });
    },
    impactRadiant(x) {
      tone(1568, 0.3, 'sine', 0.06, { glide: 2350, reverb: 0.6, delay: 0.3, pan: panOf(x) });
    },
    death(x) {
      noise(0.25, 0.16, 'highpass', 2600, 5000, { pan: panOf(x), reverb: 0.3 });
      tone(340, 0.22, 'triangle', 0.09, { glide: 90, pan: panOf(x), reverb: 0.3 });
    },
    shatter(x) {
      for (let i = 0; i < 3; i++) {
        tone(1400 + Math.random() * 2200, 0.09, 'sine', 0.05, { at: i * 0.03, glide: 500, reverb: 0.5, pan: panOf(x) });
      }
      noise(0.18, 0.12, 'highpass', 4000, 8000, { pan: panOf(x), reverb: 0.4 });
    },
    shieldHit(x) {
      tone(980, 0.16, 'sine', 0.07, { glide: 620, reverb: 0.4, pan: panOf(x) });
    },
    heal(x) {
      tone(660, 0.4, 'sine', 0.05, { glide: 990, attack: 0.1, reverb: 0.5, pan: panOf(x) });
    },
    summon(x) {
      tone(180, 0.3, 'sine', 0.1, { glide: 90, attack: 0.08, reverb: 0.4, pan: panOf(x) });
    },
    boss() {
      boom(45, 2.4, 0.6, {});
      tone(110, 1.8, 'sawtooth', 0.1, { at: 0.1, glide: 38, attack: 0.5, filter: ['lowpass', 320], reverb: 0.8 });
    },
    reaction(name, x) {
      const p = panOf(x);
      switch (name) {
        case 'plasma': noise(0.3, 0.26, 'bandpass', 3800, 900, { Q: 1.6, pan: p }); tone(1200, 0.25, 'sawtooth', 0.1, { glide: 300, filter: ['lowpass', 3000], pan: p }); break;
        case 'superconduct': tone(2100, 0.5, 'sine', 0.08, { glide: 3300, reverb: 0.6, pan: p }); noise(0.3, 0.08, 'highpass', 6000, 9000, { pan: p }); break;
        case 'catalyse': tone(300, 0.3, 'sawtooth', 0.08, { glide: 620, filter: ['lowpass', 900], pan: p }); break;
        case 'thermal shock': boom(140, 0.5, 0.26, {}); noise(0.2, 0.16, 'highpass', 4000, 7000, { pan: p }); break;
        case 'immolate': noise(0.7, 0.3, 'lowpass', 2000, 400, { pan: p, reverb: 0.3 }); break;
        case 'paralysis': tone(3200, 0.4, 'sine', 0.06, { glide: 900, reverb: 0.6, pan: p }); break;
        case 'collapse': boom(50, 1.1, 0.4, {}); tone(160, 0.8, 'sawtooth', 0.08, { glide: 40, filter: ['lowpass', 400], reverb: 0.7, pan: p }); break;
        case 'entropy': tone(140, 0.9, 'triangle', 0.08, { glide: 55, reverb: 0.6, pan: p }); break;
        case 'rupture': boom(75, 0.6, 0.34, {}); noise(0.2, 0.14, 'bandpass', 1600, 500, { pan: p }); break;
        case 'blight': tone(180, 0.5, 'sawtooth', 0.08, { glide: 60, filter: ['lowpass', 700], reverb: 0.5, pan: p }); break;
      }
    }
  };

  /* ------------------------------------------------------------ */
  /* Music: 84bpm sequencer, two layers crossfaded by musicIntensity. */
  const CHORDS = [
    [57, 60, 64, 67],   // Am7
    [53, 57, 60, 64],   // Fmaj7
    [52, 55, 59, 62],   // Em7
    [55, 59, 62, 65]    // G6
  ];

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function startMusic() {
    A._nextT = A.ctx.currentTime + 0.1;
    A._schedTimer = setInterval(schedule, 40);
  }

  function schedule() {
    const ahead = A.ctx.currentTime + 0.16;
    while (A._nextT < ahead) {
      const stepIdx = A._step;
      const bar = Math.floor(stepIdx / 16) % 4;
      const s16 = stepIdx % 16;
      const t = A._nextT;
      const chord = CHORDS[bar].map((m) => m + A._rootMidi);
      const bass = chord[0] - 24;
      const layerB = A.musicIntensity;

      /* Pad: slow swell, re-struck each bar. */
      if (s16 === 0) {
        for (const m of chord) {
          tone(mtof(m), 60 / TEMPO * 4.4, 'triangle', 0.028, {
            at: t - A.ctx.currentTime, attack: 0.9, bus: 'music', detune: (Math.random() - 0.5) * 14, reverb: 0.4
          });
          tone(mtof(m + 12), 60 / TEMPO * 4.4, 'sawtooth', 0.006, {
            at: t - A.ctx.currentTime, attack: 1.1, bus: 'music', filter: ['lowpass', 900], reverb: 0.4
          });
        }
      }
      /* Bass: half notes, sub register. */
      if (s16 === 0 || s16 === 8) {
        tone(mtof(bass), STEP * 8, 'sine', 0.16, { at: t - A.ctx.currentTime, attack: 0.03, bus: 'music' });
        tone(mtof(bass + 12), STEP * 8, 'triangle', 0.05, { at: t - A.ctx.currentTime, attack: 0.03, bus: 'music', detune: 8 });
      }
      /* Layer B: drums + echo arp, scaled by intensity. */
      if (layerB > 0.02) {
        const L = layerB;
        if (s16 === 0 || s16 === 8) {                    // kick
          tone(95, 0.22, 'sine', 0.24 * L, { at: t - A.ctx.currentTime, glide: 42, bus: 'music' });
        }
        if (s16 === 4 || s16 === 12) {                   // snare-ish
          noise(0.14, 0.11 * L, 'bandpass', 1900, 1200, { at: t - A.ctx.currentTime, bus: 'music', Q: 1.1 });
        }
        if (s16 % 4 === 2) {                             // hats
          noise(0.04, 0.05 * L, 'highpass', 6800, 7600, { at: t - A.ctx.currentTime, bus: 'music' });
        }
        if (s16 % 2 === 0) {                             // pentatonic arp into the echo
          const penta = [0, 3, 5, 7, 10, 12, 15];
          const note = chord[0] + penta[(stepIdx * 7) % penta.length] + 12;
          tone(mtof(note), 0.22, 'square', 0.018 * L, {
            at: t - A.ctx.currentTime, bus: 'music', delay: 0.8, filter: ['lowpass', 2100], attack: 0.005
          });
        }
      }

      A._step++;
      A._nextT += STEP;
    }
  }

  function startAmbience() {
    /* Wind: looping filtered noise with a slow breathing LFO. */
    const ctx = A.ctx;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 120;
    lfo.connect(lfoG); lfoG.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(A.ambBus);
    src.start(); lfo.start();
    /* Deep distant booms, on a slow random clock. */
    A._ambNext = ctx.currentTime + 14 + Math.random() * 22;
    A._ambTimer = setInterval(() => {
      if (ctx.currentTime >= A._ambNext) {
        boom(38, 2.2, 0.16, {});
        A._ambNext = ctx.currentTime + 18 + Math.random() * 26;
      }
    }, 1000);
  }

  /* ------------------------------------------------------------ */
  function setIntensity(v) {
    A._targetIntensity = Math.max(0, Math.min(1, v));
  }
  function tick(dt) {
    if (!A.ctx) return;
    A.musicIntensity += (A._targetIntensity - A.musicIntensity) * Math.min(1, dt * 1.4);
  }

  function setFactionRoot(factionId) {
    A._rootMidi = factionId === 'light' ? 5 : factionId === 'xeno' ? 3 : factionId === 'pirate' ? 7 : 0;
  }

  function setVolume(which, v) {
    A.vol[which] = Math.max(0, Math.min(1, v));
    if (!A.ctx) return;
    if (which === 'master') A.master.gain.value = A.muted ? 0 : A.vol.master;
    if (which === 'music') A.musicBus.gain.value = A.vol.music;
    if (which === 'sfx') A.sfxBus.gain.value = A.vol.sfx;
  }
  function setMuted(m) {
    A.muted = m;
    if (A.ctx) A.master.gain.value = m ? 0 : A.vol.master;
  }

  window.Audio = { init, sfx: S, tick, setIntensity, setFactionRoot, setVolume, setMuted, get state() { return A; } };
})();
