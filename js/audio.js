/* ==========================================================================
   COSMIC CONQUEST — Procedural Audio Engine
   --------------------------------------------------------------------------
   Every sound in the game is synthesised at runtime with the Web Audio API.
   There are no audio files, which keeps the game a single self-contained
   folder that works offline and from file://.

   Signal path:
       voices -> sfxBus  -\
                            >- master -> compressor -> destination
       music  -> musicBus -/

   The music system is a lookahead scheduler (Chris Wilson's pattern): a timer
   runs every SCHEDULE_TICK ms and schedules any beats falling inside the next
   LOOKAHEAD seconds, which keeps timing sample-accurate even when the main
   thread stutters during heavy waves.
   ========================================================================== */

'use strict';

const Sound = (() => {

  const SCHEDULE_TICK = 25;   // ms between scheduler polls
  const LOOKAHEAD     = 0.12; // seconds of audio scheduled ahead of time

  let ctx = null;
  let master, comp, sfxBus, musicBus;
  let noiseBuf = null;
  let ready = false;

  const settings = {
    sfxVolume: 0.75,
    musicVolume: 0.45,
    sfxEnabled: true,
    musicEnabled: true
  };

  /* Rate-limits identical sounds so a 40-mite wave doesn't produce 40
     simultaneous voices and clip the master bus. */
  const lastPlayed = Object.create(null);
  function throttled(key, minGap) {
    const now = ctx ? ctx.currentTime : 0;
    if (lastPlayed[key] !== undefined && now - lastPlayed[key] < minGap) return true;
    lastPlayed[key] = now;
    return false;
  }

  /* ---------------------------------------------------------------- setup */

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;

    master = ctx.createGain();
    master.gain.value = 0.9;

    sfxBus = ctx.createGain();
    sfxBus.gain.value = settings.sfxEnabled ? settings.sfxVolume : 0;

    musicBus = ctx.createGain();
    musicBus.gain.value = settings.musicEnabled ? settings.musicVolume : 0;

    /* Ambience send: a filtered feedback delay gives the dry synth voices a
       sense of space without the cost of convolution reverb. */
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.16;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dampen = ctx.createBiquadFilter();
    dampen.type = 'lowpass'; dampen.frequency.value = 1900;
    const wet = ctx.createGain(); wet.gain.value = 0.14;
    delay.connect(dampen); dampen.connect(fb); fb.connect(delay);
    dampen.connect(wet);

    /* A gentle spectral tilt on the whole mix: a little body at 160Hz, a
       shave above 5k. This is what moves the kit from arcade-bright toward
       the warmer vaporwave register without dulling the transients. */
    const warmth = ctx.createBiquadFilter();
    warmth.type = 'lowshelf'; warmth.frequency.value = 160; warmth.gain.value = 2.5;
    const shave = ctx.createBiquadFilter();
    shave.type = 'highshelf'; shave.frequency.value = 5200; shave.gain.value = -3.5;

    sfxBus.connect(master);
    musicBus.connect(master);
    sfxBus.connect(delay);
    musicBus.connect(delay);
    wet.connect(master);
    master.connect(warmth);
    warmth.connect(shave);
    shave.connect(comp);
    comp.connect(ctx.destination);

    /* One second of white noise, reused by every percussive//noisy voice. */
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    ready = true;
    return true;
  }

  /* Browsers start the context suspended until a user gesture. */
  function resume() {
    if (!ctx) init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  /* ----------------------------------------------------------- primitives */

  function now() { return ctx.currentTime; }

  /* Uniform transposition for the SFX kit: every effect drops ~8 semitones,
     which keeps each sound's shape but trades shrillness for weight. Music is
     exempt -- it is tuned material and is voiced lower at the source. The
     floor keeps already-deep sweeps (explosions ending at 28Hz) audible. */
  const SFX_DEPTH = 0.62;
  function deep(f) { return f === null ? null : Math.max(30, f * SFX_DEPTH); }

  /** A single oscillator voice with an ADSR-ish envelope and optional glide. */
  function tone(opts) {
    if (!ready || !settings.sfxEnabled) return;
    const {
      freq = 440, endFreq = null, type = 'sine',
      dur = 0.2, attack = 0.005, release = null,
      gain = 0.3, dest = sfxBus, detune = 0,
      filter = null, filterEnd = null, q = 1, delay = 0
    } = opts;

    const t0 = now() + delay;
    const sfx = dest === sfxBus;
    const f0 = sfx ? deep(freq) : freq;
    const f1 = sfx ? deep(endFreq) : endFreq;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);

    const g = ctx.createGain();
    const rel = release === null ? dur * 0.7 : release;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + rel);

    let node = osc;
    if (filter !== null) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = q;
      f.frequency.setValueAtTime(filter, t0);
      if (filterEnd !== null) f.frequency.exponentialRampToValueAtTime(Math.max(40, filterEnd), t0 + dur);
      node.connect(f); node = f;
    }
    node.connect(g);
    g.connect(dest);

    osc.start(t0);
    osc.stop(t0 + attack + rel + 0.05);
  }

  /** A filtered noise burst — the basis of every impact, hiss and explosion. */
  function noise(opts) {
    if (!ready || !settings.sfxEnabled) return;
    const {
      dur = 0.2, gain = 0.3, dest = sfxBus, delay = 0,
      type = 'lowpass', freq = 1200, freqEnd = null, q = 1, attack = 0.002
    } = opts;

    const t0 = now() + delay;
    /* Noise voices live in their filter, so the depth factor applies there.
       Highpass hiss keeps a higher floor or it disappears entirely. */
    const sfx = dest === sfxBus;
    const floorHz = type === 'highpass' ? 900 : 40;
    const nf0 = sfx ? Math.max(floorHz, freq * SFX_DEPTH) : freq;
    const nf1 = (sfx && freqEnd !== null) ? Math.max(floorHz, freqEnd * SFX_DEPTH) : freqEnd;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(nf0, t0);
    if (nf1 !== null) f.frequency.exponentialRampToValueAtTime(Math.max(40, nf1), t0 + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /* ------------------------------------------------------------------ SFX */

  const sfx = {

    /* --- commander abilities: pitched by roster index so every commander
       has their own voice; offense climbs, defense settles --------------- */
    ability_off(i) {
      const p = Math.pow(1.045, (i || 0) % 12);
      tone({ freq: 340 * p, endFreq: 980 * p, type: 'sawtooth', dur: 0.30, gain: 0.16, release: 0.22 });
      tone({ freq: 170 * p, endFreq: 490 * p, type: 'square',   dur: 0.26, gain: 0.08, release: 0.2 });
      noise({ dur: 0.16, gain: 0.05, freq: 2400, freqEnd: 5200, type: 'bandpass', q: 1.4 });
    },
    ability_def(i) {
      const p = Math.pow(1.045, (i || 0) % 12);
      tone({ freq: 880 * p, endFreq: 330 * p, type: 'sine',     dur: 0.42, gain: 0.15, release: 0.3 });
      tone({ freq: 440 * p, endFreq: 220 * p, type: 'triangle', dur: 0.38, gain: 0.10, release: 0.28 });
    },

    /* --- tower fire ------------------------------------------------ */
    bolt() {
      if (throttled('bolt', 0.045)) return;
      tone({ freq: 900, endFreq: 380, type: 'triangle', dur: 0.1, gain: 0.16, release: 0.09 });
      noise({ dur: 0.05, gain: 0.06, freq: 3000, freqEnd: 900, type: 'bandpass', q: 2 });
    },

    mortar() {
      if (throttled('mortar', 0.07)) return;
      tone({ freq: 180, endFreq: 48, type: 'square', dur: 0.22, gain: 0.22, filter: 900, filterEnd: 180 });
      noise({ dur: 0.24, gain: 0.2, freq: 700, freqEnd: 120 });
    },

    explosion(scale = 1) {
      if (throttled('explosion', 0.05)) return;
      noise({ dur: 0.34 * scale, gain: 0.26, freq: 1400, freqEnd: 70, q: 0.8 });
      tone({ freq: 110 * (1 / scale), endFreq: 28, type: 'sine', dur: 0.34 * scale, gain: 0.3, release: 0.3 * scale });
    },

    cryo() {
      if (throttled('cryo', 0.06)) return;
      tone({ freq: 1650, endFreq: 2400, type: 'sine', dur: 0.16, gain: 0.11, detune: -8 });
      tone({ freq: 2480, endFreq: 3300, type: 'sine', dur: 0.16, gain: 0.07, delay: 0.015, detune: 12 });
      noise({ dur: 0.2, gain: 0.05, freq: 5200, type: 'highpass' });
    },

    freeze() {
      if (throttled('freeze', 0.12)) return;
      tone({ freq: 3200, endFreq: 900, type: 'sine', dur: 0.3, gain: 0.13 });
      noise({ dur: 0.3, gain: 0.07, freq: 6000, freqEnd: 1400, type: 'bandpass', q: 3 });
    },

    arc() {
      if (throttled('arc', 0.06)) return;
      tone({ freq: 2100, endFreq: 240, type: 'sawtooth', dur: 0.14, gain: 0.13, filter: 4000, filterEnd: 700, q: 4 });
      noise({ dur: 0.11, gain: 0.11, freq: 4200, freqEnd: 1200, type: 'bandpass', q: 1.6 });
    },

    pyre() {
      if (throttled('pyre', 0.16)) return;
      noise({ dur: 0.32, gain: 0.09, freq: 900, freqEnd: 1900, type: 'bandpass', q: 0.7, attack: 0.06 });
    },

    railgun() {
      if (throttled('railgun', 0.08)) return;
      tone({ freq: 120, endFreq: 1900, type: 'sawtooth', dur: 0.09, gain: 0.13, filter: 6000 });
      tone({ freq: 1500, endFreq: 90, type: 'square', dur: 0.4, gain: 0.19, filter: 3200, filterEnd: 300, release: 0.36 });
      noise({ dur: 0.42, gain: 0.13, freq: 5000, freqEnd: 200 });
    },

    crit() {
      if (throttled('crit', 0.1)) return;
      tone({ freq: 1400, endFreq: 2900, type: 'square', dur: 0.14, gain: 0.14 });
      tone({ freq: 2100, endFreq: 4200, type: 'sine', dur: 0.16, gain: 0.1, delay: 0.02 });
    },

    toxin() {
      if (throttled('toxin', 0.07)) return;
      tone({ freq: 320, endFreq: 130, type: 'sine', dur: 0.2, gain: 0.13, filter: 1000 });
      tone({ freq: 470, endFreq: 190, type: 'sine', dur: 0.22, gain: 0.07, delay: 0.05 });
    },

    /* --- new archetypes --------------------------------------------- */

    /** TETHER — a mechanical winch: ratchet click then a rising cable haul. */
    tether() {
      if (throttled('tether', 0.09)) return;
      noise({ dur: 0.06, gain: 0.09, freq: 2200, freqEnd: 800, type: 'bandpass', q: 2.5 });
      tone({ freq: 220, endFreq: 520, type: 'sawtooth', dur: 0.26, gain: 0.11, filter: 1600, filterEnd: 700 });
    },

    /** PRISM — a pure sustained tone; the pitch rides the focus ramp. */
    prism() {
      if (throttled('prism', 0.11)) return;
      tone({ freq: 1300, endFreq: 1750, type: 'sine', dur: 0.24, gain: 0.055, attack: 0.05 });
      tone({ freq: 2600, endFreq: 3500, type: 'sine', dur: 0.22, gain: 0.028, attack: 0.06 });
    },

    /** SINGULARITY — everything sucked inward: a downward pitch collapse. */
    gravity() {
      if (throttled('gravity', 0.16)) return;
      tone({ freq: 640, endFreq: 62, type: 'sine', dur: 0.45, gain: 0.16, release: 0.4 });
      noise({ dur: 0.45, gain: 0.09, freq: 3200, freqEnd: 130, q: 1.4 });
    },

    flak() {
      if (throttled('flak', 0.05)) return;
      noise({ dur: 0.11, gain: 0.13, freq: 1700, freqEnd: 420, q: 1.1 });
      tone({ freq: 340, endFreq: 130, type: 'square', dur: 0.11, gain: 0.09, filter: 1500 });
    },

    siphon() {
      if (throttled('siphon', 0.08)) return;
      tone({ freq: 520, endFreq: 200, type: 'triangle', dur: 0.2, gain: 0.1, filter: 1200 });
    },

    mineArm() {
      if (throttled('mineArm', 0.12)) return;
      tone({ freq: 1700, type: 'square', dur: 0.045, gain: 0.05 });
      tone({ freq: 2300, type: 'square', dur: 0.04, gain: 0.035, delay: 0.07 });
    },

    /* --- economy & sustain ------------------------------------------- */

    coin() {
      if (throttled('coin', 0.1)) return;
      tone({ freq: 1320, type: 'triangle', dur: 0.09, gain: 0.09 });
      tone({ freq: 1980, type: 'triangle', dur: 0.14, gain: 0.07, delay: 0.05 });
    },

    heal() {
      [523.25, 784, 1046.5].forEach((f, i) =>
        tone({ freq: f, type: 'sine', dur: 0.34, gain: 0.11, delay: i * 0.06 }));
    },

    /* --- PvP ---------------------------------------------------------- */

    /** Reanimation: a hollow, inverted "kill" — something getting back up. */
    reanimate() {
      if (throttled('reanimate', 0.09)) return;
      tone({ freq: 130, endFreq: 420, type: 'sawtooth', dur: 0.22, gain: 0.075, filter: 900, filterEnd: 2200 });
      noise({ dur: 0.18, gain: 0.035, freq: 400, freqEnd: 2400, type: 'bandpass', q: 1.4 });
    },

    ascend() {
      [0, 0.05, 0.1].forEach((d, i) =>
        tone({ freq: 660 * Math.pow(2, i / 3), type: 'triangle', dur: 0.2, gain: 0.12, delay: d }));
      noise({ dur: 0.26, gain: 0.04, freq: 3000, freqEnd: 9000, type: 'bandpass', delay: 0.06 });
    },

    /** Enemy escalation — an ugly, dissonant swell. */
    escalation() {
      [0, 0.16, 0.32].forEach(d => {
        tone({ freq: 73,  type: 'sawtooth', dur: 0.9, gain: 0.2,  delay: d, filter: 420 });
        tone({ freq: 103, type: 'sawtooth', dur: 0.9, gain: 0.12, delay: d, filter: 560 });
      });
      noise({ dur: 1.3, gain: 0.07, freq: 200, freqEnd: 1400, type: 'bandpass', q: 0.5, attack: 0.6 });
    },

    /** Command upgrade offered — a bright, hopeful arpeggio. */
    choice() {
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone({ freq: f, type: 'triangle', dur: 0.4, gain: 0.12, delay: i * 0.08 }));
    },

    /* --- expansion towers --------------------------------------------- */

    forge() {
      if (throttled('forge', 0.2)) return;
      noise({ dur: 0.16, gain: 0.1, freq: 500, freqEnd: 180 });
      tone({ freq: 220, endFreq: 340, type: 'square', dur: 0.14, gain: 0.08, filter: 900 });
    },
    sabotage() {
      if (throttled('sabotage', 0.25)) return;
      tone({ freq: 1900, endFreq: 160, type: 'sawtooth', dur: 0.4, gain: 0.12, filter: 3200, filterEnd: 400 });
      noise({ dur: 0.3, gain: 0.07, freq: 4000, freqEnd: 500, type: 'bandpass', q: 2 });
    },
    wallUp() {
      if (throttled('wallUp', 0.2)) return;
      tone({ freq: 120, endFreq: 240, type: 'square', dur: 0.2, gain: 0.12, filter: 800 });
      noise({ dur: 0.14, gain: 0.08, freq: 700, freqEnd: 300 });
    },
    wallBreak() {
      if (throttled('wallBreak', 0.2)) return;
      noise({ dur: 0.4, gain: 0.2, freq: 1200, freqEnd: 90 });
      tone({ freq: 150, endFreq: 40, type: 'sine', dur: 0.4, gain: 0.2 });
    },
    chrono() {
      if (throttled('chrono', 0.25)) return;
      tone({ freq: 900, endFreq: 2200, type: 'sine', dur: 0.3, gain: 0.09 });
      tone({ freq: 2200, endFreq: 700, type: 'sine', dur: 0.3, gain: 0.07, delay: 0.08 });
    },
    echo() {
      if (throttled('echo', 0.15)) return;
      tone({ freq: 760, type: 'triangle', dur: 0.09, gain: 0.09 });
      tone({ freq: 760, type: 'triangle', dur: 0.09, gain: 0.05, delay: 0.1 });
      tone({ freq: 760, type: 'triangle', dur: 0.09, gain: 0.028, delay: 0.2 });
    },
    quake() {
      if (throttled('quake', 0.3)) return;
      tone({ freq: 70, endFreq: 26, type: 'sine', dur: 0.6, gain: 0.3, release: 0.55 });
      noise({ dur: 0.5, gain: 0.16, freq: 500, freqEnd: 60 });
    },
    siren() {
      if (throttled('siren', 0.3)) return;
      tone({ freq: 620, endFreq: 1180, type: 'sine', dur: 0.5, gain: 0.1, attack: 0.12 });
      tone({ freq: 930, endFreq: 1770, type: 'sine', dur: 0.5, gain: 0.06, attack: 0.16 });
    },
    glaive() {
      if (throttled('glaive', 0.12)) return;
      noise({ dur: 0.22, gain: 0.08, freq: 2400, freqEnd: 900, type: 'bandpass', q: 2.5 });
      tone({ freq: 500, endFreq: 900, type: 'triangle', dur: 0.2, gain: 0.06 });
    },
    cyclone() {
      if (throttled('cyclone', 0.25)) return;
      noise({ dur: 0.45, gain: 0.1, freq: 400, freqEnd: 2400, type: 'bandpass', q: 0.8, attack: 0.15 });
    },
    nova() {
      if (throttled('nova', 0.25)) return;
      tone({ freq: 150, endFreq: 2400, type: 'sawtooth', dur: 0.12, gain: 0.1, filter: 5000 });
      noise({ dur: 0.4, gain: 0.18, freq: 3600, freqEnd: 200 });
    },
    execute() {
      if (throttled('execute', 0.15)) return;
      noise({ dur: 0.1, gain: 0.14, freq: 3000, freqEnd: 800, type: 'bandpass', q: 1.5 });
      tone({ freq: 320, endFreq: 90, type: 'square', dur: 0.16, gain: 0.12, filter: 1200 });
    },
    combo() {
      if (throttled('combo', 0.12)) return;
      [880, 1320, 1760].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.14, gain: 0.07, delay: i * 0.03 }));
    },

    /* --- disruptive enemies ------------------------------------------ */

    /** JAMMER: a harsh electrical silence. */
    jam() {
      if (throttled('jam', 0.3)) return;
      tone({ freq: 420, endFreq: 90, type: 'square', dur: 0.5, gain: 0.15, filter: 1400, filterEnd: 260 });
      noise({ dur: 0.55, gain: 0.1, freq: 2600, freqEnd: 300, type: 'bandpass', q: 0.7 });
    },

    /** BLINK: a short inverted whoosh — something skipping space. */
    blink() {
      if (throttled('blink', 0.12)) return;
      tone({ freq: 1500, endFreq: 380, type: 'sine', dur: 0.13, gain: 0.09 });
      tone({ freq: 380, endFreq: 1500, type: 'sine', dur: 0.13, gain: 0.07, delay: 0.05 });
    },

    /** WRAITH going untouchable. */
    phase() {
      if (throttled('phase', 0.4)) return;
      tone({ freq: 700, endFreq: 1400, type: 'sine', dur: 0.35, gain: 0.05, attack: 0.1 });
    },

    revive() {
      if (throttled('revive', 0.2)) return;
      [220, 330, 440].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.3, gain: 0.1, delay: i * 0.05 }));
    },

    miniboss() {
      [0, 0.22, 0.44].forEach((d, i) => {
        tone({ freq: 110 - i * 8, type: 'sawtooth', dur: 0.55, gain: 0.2, delay: d, filter: 620 });
        tone({ freq: 165 - i * 10, type: 'square', dur: 0.55, gain: 0.1, delay: d, filter: 800 });
      });
      noise({ dur: 1.0, gain: 0.07, freq: 260, freqEnd: 1500, type: 'bandpass', q: 0.6, attack: 0.5 });
    },

    /** Technology unlocked on a tower. */
    tech() {
      [660, 880, 1320].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.26, gain: 0.11, delay: i * 0.055 }));
      noise({ dur: 0.3, gain: 0.04, freq: 4000, freqEnd: 9000, type: 'bandpass', delay: 0.1 });
    },

    /* --- feedback --------------------------------------------------- */
    hit() {
      if (throttled('hit', 0.035)) return;
      noise({ dur: 0.05, gain: 0.05, freq: 2600, freqEnd: 700, type: 'bandpass', q: 1.4 });
    },

    kill() {
      if (throttled('kill', 0.04)) return;
      noise({ dur: 0.14, gain: 0.11, freq: 2200, freqEnd: 260 });
      tone({ freq: 420, endFreq: 130, type: 'triangle', dur: 0.14, gain: 0.09 });
    },

    bossKill() {
      [0, 0.12, 0.26, 0.42].forEach((d, i) => {
        noise({ dur: 0.8, gain: 0.26, freq: 1800, freqEnd: 50, delay: d });
        tone({ freq: 90 - i * 12, endFreq: 22, type: 'sine', dur: 1.0, gain: 0.34, delay: d, release: 0.9 });
      });
    },

    shieldBreak() {
      if (throttled('shieldBreak', 0.1)) return;
      tone({ freq: 1800, endFreq: 300, type: 'square', dur: 0.26, gain: 0.14, filter: 4000, filterEnd: 600 });
      noise({ dur: 0.3, gain: 0.12, freq: 4500, freqEnd: 800, type: 'bandpass', q: 2 });
    },

    split() {
      if (throttled('split', 0.08)) return;
      tone({ freq: 300, endFreq: 800, type: 'triangle', dur: 0.16, gain: 0.11 });
      noise({ dur: 0.16, gain: 0.08, freq: 1600, freqEnd: 3000, type: 'bandpass' });
    },

    /* --- interface --------------------------------------------------- */
    build() {
      tone({ freq: 520, type: 'triangle', dur: 0.09, gain: 0.16 });
      tone({ freq: 780, type: 'triangle', dur: 0.13, gain: 0.14, delay: 0.06 });
      tone({ freq: 1040, type: 'sine',    dur: 0.2,  gain: 0.11, delay: 0.12 });
    },

    upgrade() {
      [0, 0.06, 0.12, 0.19].forEach((d, i) =>
        tone({ freq: 440 * Math.pow(2, i / 4), type: 'triangle', dur: 0.22, gain: 0.14, delay: d }));
      noise({ dur: 0.3, gain: 0.05, freq: 3000, freqEnd: 8000, type: 'bandpass', q: 1.2, delay: 0.1 });
    },

    branch() {
      [0, 0.07, 0.14, 0.21, 0.3].forEach((d, i) =>
        tone({ freq: 330 * Math.pow(2, i / 3), type: 'sawtooth', dur: 0.26, gain: 0.11,
               delay: d, filter: 2600 }));
    },

    sell() {
      tone({ freq: 700, endFreq: 260, type: 'triangle', dur: 0.22, gain: 0.14 });
      noise({ dur: 0.14, gain: 0.05, freq: 1800, freqEnd: 400 });
    },

    denied() {
      if (throttled('denied', 0.14)) return;
      tone({ freq: 200, type: 'square', dur: 0.09, gain: 0.11, filter: 900 });
      tone({ freq: 150, type: 'square', dur: 0.12, gain: 0.11, filter: 700, delay: 0.08 });
    },

    click() {
      if (throttled('click', 0.02)) return;
      tone({ freq: 1500, endFreq: 1100, type: 'sine', dur: 0.035, gain: 0.07 });
    },

    hover() {
      if (throttled('hover', 0.04)) return;
      tone({ freq: 2200, type: 'sine', dur: 0.028, gain: 0.028 });
    },

    waveStart() {
      [0, 0.14].forEach(d => {
        tone({ freq: 165, type: 'sawtooth', dur: 0.5, gain: 0.15, delay: d, filter: 1100 });
        tone({ freq: 247, type: 'sawtooth', dur: 0.5, gain: 0.11, delay: d, filter: 1300 });
      });
      noise({ dur: 0.7, gain: 0.06, freq: 300, freqEnd: 1800, type: 'bandpass', q: 0.6, attack: 0.3 });
    },

    waveClear() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone({ freq: f, type: 'triangle', dur: 0.34, gain: 0.13, delay: i * 0.075 }));
    },

    bossWarn() {
      [0, 0.5, 1.0].forEach(d => {
        tone({ freq: 87, type: 'sawtooth', dur: 0.42, gain: 0.24, delay: d, filter: 500 });
        tone({ freq: 131, type: 'square', dur: 0.42, gain: 0.12, delay: d, filter: 700 });
      });
    },

    leak() {
      tone({ freq: 240, endFreq: 70, type: 'sawtooth', dur: 0.5, gain: 0.24, filter: 1400, filterEnd: 200 });
      noise({ dur: 0.4, gain: 0.14, freq: 900, freqEnd: 90 });
    },

    victory() {
      const mel = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
      mel.forEach((f, i) => {
        tone({ freq: f, type: 'triangle', dur: 0.55, gain: 0.15, delay: i * 0.14 });
        tone({ freq: f / 2, type: 'sine', dur: 0.6, gain: 0.1, delay: i * 0.14 });
      });
      tone({ freq: 2093, type: 'sine', dur: 1.6, gain: 0.13, delay: 0.9, release: 1.5 });
    },

    defeat() {
      [329.63, 293.66, 261.63, 207.65, 164.81].forEach((f, i) => {
        tone({ freq: f, type: 'sawtooth', dur: 0.85, gain: 0.16, delay: i * 0.26, filter: 1000, filterEnd: 300 });
      });
      tone({ freq: 82, type: 'sine', dur: 2.4, gain: 0.22, delay: 1.0, release: 2.2 });
    }
  };

  /* ---------------------------------------------------------------- MUSIC
     A four-bar loop in A minor. Layers are gated by `intensity` (0..3) which
     the game raises as waves progress, so the score escalates with the fight.
  ------------------------------------------------------------------------ */

  const NOTE = { A2: 110.00, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00,
                 A3: 220.00, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00,
                 A4: 440.00, C5: 523.25, E5: 659.25 };

  /* i - VI - III - VII in A minor: Am, F, C, G */
  const PROGRESSION = [
    { root: NOTE.A2, arp: [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.C4] },
    { root: NOTE.F3 / 2, arp: [NOTE.F3, NOTE.A3, NOTE.C4, NOTE.A3] },
    { root: NOTE.C3, arp: [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.E4] },
    { root: NOTE.G3 / 2, arp: [NOTE.G3, NOTE.D4, NOTE.F4, NOTE.D4] }
  ];

  const music = {
    playing: false,
    timer: null,
    nextTime: 0,
    step: 0,          // 16th-note counter, wraps every 64 (4 bars)
    tempo: 84,
    intensity: 1,
    padVoices: []
  };

  function stepDuration() { return (60 / music.tempo) / 4; }

  function scheduleStep(step, t) {
    const bar = Math.floor(step / 16) % 4;
    const chord = PROGRESSION[bar];
    const beat = step % 16;
    const I = music.intensity;

    /* --- pad: one long chord per bar, always present ------------------- */
    if (beat === 0) {
      const dur = stepDuration() * 16;
      [chord.root * 2, chord.arp[0], chord.arp[2]].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        osc.detune.value = (i - 1) * 11;   /* wider chorus, tape-wobble feel */
        const flt = ctx.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(420 + I * 240, t);
        flt.Q.value = 1.2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.035, t + dur * 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(flt); flt.connect(g); g.connect(musicBus);
        osc.start(t); osc.stop(t + dur + 0.05);
      });
    }

    /* --- bass: root on the pulse -------------------------------------- */
    if (I >= 1 && (beat % 4 === 0 || (I >= 2 && beat === 14))) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = chord.root;
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(1400, t);
      flt.frequency.exponentialRampToValueAtTime(240, t + 0.24);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(flt); flt.connect(g); g.connect(musicBus);
      osc.start(t); osc.stop(t + 0.36);
    }

    /* --- kick ---------------------------------------------------------- */
    if (I >= 1 && (beat === 0 || beat === 8 || (I >= 3 && beat === 6))) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(g); g.connect(musicBus);
      osc.start(t); osc.stop(t + 0.24);
    }

    /* --- snare --------------------------------------------------------- */
    if (I >= 2 && (beat === 4 || beat === 12)) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      src.connect(f); f.connect(g); g.connect(musicBus);
      src.start(t); src.stop(t + 0.18);
    }

    /* --- hats ---------------------------------------------------------- */
    if (I >= 2 && beat % 2 === 1) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 6200;
      const g = ctx.createGain();
      const amp = beat % 4 === 3 ? 0.05 : 0.028;
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      src.connect(f); f.connect(g); g.connect(musicBus);
      src.start(t); src.stop(t + 0.07);
    }

    /* --- arpeggio ------------------------------------------------------ */
    if (I >= 1) {
      const every = I >= 3 ? 1 : 2;
      if (beat % every === 0) {
        const idx = (step / every) % chord.arp.length | 0;
        const f = chord.arp[idx] * (I >= 3 && beat % 8 === 4 ? 2 : 1);
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.045 + I * 0.008, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + stepDuration() * 1.6);
        osc.connect(g); g.connect(musicBus);
        osc.start(t); osc.stop(t + stepDuration() * 2);
      }
    }

    /* --- intensity 3 lead stab ---------------------------------------- */
    if (I >= 3 && (beat === 0 || beat === 10)) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = chord.arp[0] * 2;
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass'; flt.Q.value = 7;
      flt.frequency.setValueAtTime(5200, t);
      flt.frequency.exponentialRampToValueAtTime(700, t + 0.3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      osc.connect(flt); flt.connect(g); g.connect(musicBus);
      osc.start(t); osc.stop(t + 0.38);
    }
  }

  function schedulerTick() {
    if (!music.playing || !ready) return;
    while (music.nextTime < ctx.currentTime + LOOKAHEAD) {
      if (settings.musicEnabled) scheduleStep(music.step, music.nextTime);
      music.nextTime += stepDuration();
      music.step = (music.step + 1) % 64;
    }
  }

  function startMusic(intensity = 1) {
    if (!ready) return;
    music.intensity = intensity;
    if (music.playing) return;
    music.playing = true;
    music.nextTime = ctx.currentTime + 0.08;
    music.step = 0;
    clearInterval(music.timer);
    music.timer = setInterval(schedulerTick, SCHEDULE_TICK);
  }

  function stopMusic() {
    music.playing = false;
    clearInterval(music.timer);
    music.timer = null;
  }

  /** Waves 1-3 = calm, 4-7 = driving, 8+ = full intensity. */
  function setIntensity(level) {
    music.intensity = Math.max(0, Math.min(3, level));
  }
  function setTempo(bpm) { music.tempo = bpm; }

  /* --------------------------------------------------------------- volume */

  function setSfxVolume(v) {
    settings.sfxVolume = v;
    if (sfxBus) sfxBus.gain.setTargetAtTime(settings.sfxEnabled ? v : 0, ctx.currentTime, 0.02);
  }
  function setMusicVolume(v) {
    settings.musicVolume = v;
    if (musicBus) musicBus.gain.setTargetAtTime(settings.musicEnabled ? v : 0, ctx.currentTime, 0.05);
  }
  function toggleSfx(on) {
    settings.sfxEnabled = on;
    if (sfxBus) sfxBus.gain.setTargetAtTime(on ? settings.sfxVolume : 0, ctx.currentTime, 0.02);
  }
  function toggleMusic(on) {
    settings.musicEnabled = on;
    if (musicBus) musicBus.gain.setTargetAtTime(on ? settings.musicVolume : 0, ctx.currentTime, 0.05);
  }

  /** Named dispatch so callers can do Sound.play('bolt') without a switch. */
  function play(name, arg) {
    if (!ready || !settings.sfxEnabled) return;
    const fn = sfx[name];
    if (fn) fn(arg);
  }

  return {
    init, resume, play, sfx, settings,
    startMusic, stopMusic, setIntensity, setTempo,
    setSfxVolume, setMusicVolume, toggleSfx, toggleMusic,
    get isReady() { return ready; }
  };
})();
