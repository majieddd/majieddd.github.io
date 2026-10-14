/* RELIQUARY :: 10-audio
   Everything you hear, synthesised at runtime. No sample files, because the
   whole game has to survive as one self-contained HTML.

   THE BUS LAYOUT, and why it is not just "connect to destination":

     voice -> [pan] -> [send] -> reverb -> \
                                            +-> sfxGain -> comp -> limiter -> out
     voice -> [pan] ------------------------/
     music ---------------------------------> musicGain -^
     ui ------------------------------------> uiGain ----^

   A COMPRESSOR IS NOT OPTIONAL HERE. A tower defence at wave eighteen can fire
   forty shots a second. Without a compressor the summed peaks clip the output
   stage and the result is not "loud", it is a crackle that sounds like broken
   hardware. The compressor rides the whole mix down when the board is busy,
   which is also the effect that makes a big wave FEEL big: everything else
   ducks under the explosion.

   THE THING THAT MAKES SYNTHESISED SFX SOUND CHEAP is that every instance is
   identical. Real sound never repeats exactly. Every recipe here jitters
   pitch, timing and filter cutoff per shot, which is the difference between a
   machine gun and a machine gun sound effect played forty times.

   AUTOPLAY. Browsers refuse to start an AudioContext without a user gesture.
   That is handled by creating the context lazily on the first real input and
   by making every play() a no-op until then, rather than by throwing. */
'use strict';

var AUDIO = (function () {

  var ctx = null;
  var master = null, comp = null, limiter = null;
  var sfxGain = null, musicGain = null, uiGain = null, reverbSend = null;
  var echoSend = null;
  var noiseBuf = null;
  var ready = false;
  var muted = false;
  var volumes = { master: 0.85, sfx: 0.9, music: 0.5, ui: 0.7 };
  var errors = [];

  /* Voice budget. A cap per sound family, because forty simultaneous identical
     shots is both inaudible as detail and expensive. Oldest wins eviction is
     wrong for gunfire (you want the NEWEST), so over-budget calls are simply
     dropped, which is inaudible when the budget is generous. */
  var voices = Object.create(null);
  var VOICE_CAP = { shot: 14, impact: 10, death: 8, hit: 12, react: 6, ui: 6 };

  function now() { return ctx ? ctx.currentTime : 0; }

  function noteVoice(family) {
    var cap = VOICE_CAP[family] || 8;
    var t = now();
    var arr = voices[family] || (voices[family] = []);
    /* Drop expired entries, then check the budget. */
    var w = 0;
    for (var i = 0; i < arr.length; i++) if (arr[i] > t) arr[w++] = arr[i];
    arr.length = w;
    if (arr.length >= cap) return false;
    arr.push(t + 0.35);
    return true;
  }

  /* ---------- init ---------- */

  function init() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { errors.push('no AudioContext'); return false; }
      ctx = new AC();

      limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -1.5;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.08;

      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 8;
      comp.ratio.value = 3.5;
      comp.attack.value = 0.006;
      comp.release.value = 0.22;

      master = ctx.createGain();
      master.gain.value = volumes.master;

      sfxGain = ctx.createGain(); sfxGain.gain.value = volumes.sfx;
      musicGain = ctx.createGain(); musicGain.gain.value = volumes.music;
      uiGain = ctx.createGain(); uiGain.gain.value = volumes.ui;

      /* Reverb from a synthesised impulse: exponentially decaying noise with a
         low-pass sweep, which is a passable small hall and costs one buffer.
         The send is deliberately quiet: a game this busy turns to mud fast. */
      var conv = ctx.createConvolver();
      conv.buffer = buildImpulse(1.9, 2.6);
      reverbSend = ctx.createGain();
      reverbSend.gain.value = 0.22;
      reverbSend.connect(conv);
      conv.connect(sfxGain);

      /* Feedback echo: the space between a reverb and a delay line. Music
         plucks and upgrade arps run through it; the feedback adds depth the
         convolution tail alone cannot give a synth piano. */
      var echo = ctx.createDelay(1.2);
      echo.delayTime.value = 0.28;
      var echoFb = ctx.createGain();
      echoFb.gain.value = 0.34;
      var echoF = ctx.createBiquadFilter();
      echoF.type = 'lowpass';
      echoF.frequency.value = 2400;
      echoSend = ctx.createGain();
      echoSend.gain.value = 0.30;
      echoSend.connect(echo);
      echo.connect(echoFb);
      echoFb.connect(echo);
      echo.connect(echoF);
      echoF.connect(sfxGain);

      sfxGain.connect(comp);
      musicGain.connect(comp);
      uiGain.connect(comp);
      comp.connect(master);
      master.connect(limiter);
      limiter.connect(ctx.destination);

      noiseBuf = buildNoise(2.0);
      ready = true;
      return true;
    } catch (e) {
      errors.push(String(e && e.message || e));
      ctx = null;
      return false;
    }
  }

  /* Resume must be called from inside a real user gesture handler. */
  function resume() {
    if (!ctx) init();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(function (e) { errors.push('resume: ' + e); });
    }
    return !!ctx && ctx.state === 'running';
  }

  function buildNoise(seconds) {
    var n = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    var r = U.rng('noise');
    for (var i = 0; i < n; i++) d[i] = r() * 2 - 1;
    return buf;
  }

  function buildImpulse(seconds, decay) {
    var n = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(2, n, ctx.sampleRate);
    var r = U.rng('impulse');
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < n; i++) {
        var t = i / n;
        /* A short pre-delay of silence gives the tail a sense of room size
           that a bare decaying noise burst does not have. */
        var pre = t < 0.012 ? 0 : 1;
        d[i] = (r() * 2 - 1) * Math.pow(1 - t, decay) * pre;
      }
    }
    return buf;
  }

  /* ---------- primitives ---------- */

  function env(param, t0, peak, attack, decay, sustain, release, dur) {
    param.cancelScheduledValues(t0);
    param.setValueAtTime(0.0001, t0);
    param.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
    var s = Math.max(0.0001, peak * (sustain === undefined ? 0 : sustain));
    param.exponentialRampToValueAtTime(s, t0 + attack + decay);
    param.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  /* A single tone voice: oscillator through a filter through a gain, with
     optional pitch sweep. The workhorse. */
  function tone(o) {
    if (!ready || muted) return;
    var t0 = now() + (o.delay || 0);
    var osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1 !== undefined) {
      if (o.sweepExp === false) osc.frequency.linearRampToValueAtTime(o.f1, t0 + (o.sweep || o.dur));
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + (o.sweep || o.dur));
    }
    var g = ctx.createGain();
    var dur = o.dur || 0.2;
    env(g.gain, t0, o.gain === undefined ? 0.3 : o.gain,
        o.attack === undefined ? 0.004 : o.attack,
        o.decay === undefined ? dur * 0.4 : o.decay,
        o.sustain, o.release, dur);

    var node = osc;
    if (o.filter) {
      var f = ctx.createBiquadFilter();
      f.type = o.filter;
      f.frequency.setValueAtTime(o.cutoff || 1200, t0);
      if (o.cutoff1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.cutoff1), t0 + dur);
      f.Q.value = o.q === undefined ? 1 : o.q;
      node.connect(f); node = f;
    }
    node.connect(g);
    routeOut(g, o);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /* A noise burst: the basis of every impact, explosion and mechanical
     movement in the game. */
  function noise(o) {
    if (!ready || muted) return;
    var t0 = now() + (o.delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = o.rate === undefined ? 1 : o.rate;
    src.loop = true;
    var offset = (o.offset === undefined ? Math.random() * 1.5 : o.offset);
    var g = ctx.createGain();
    var dur = o.dur || 0.2;
    env(g.gain, t0, o.gain === undefined ? 0.3 : o.gain,
        o.attack === undefined ? 0.002 : o.attack,
        o.decay === undefined ? dur * 0.5 : o.decay,
        o.sustain, o.release, dur);

    var node = src;
    var f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.cutoff || 900, t0);
    if (o.cutoff1 !== undefined) {
      f.frequency.exponentialRampToValueAtTime(Math.max(30, o.cutoff1), t0 + dur);
    }
    f.Q.value = o.q === undefined ? 1.0 : o.q;
    node.connect(f); node = f;
    node.connect(g);
    routeOut(g, o);
    src.start(t0, offset);
    src.stop(t0 + dur + 0.05);
  }

  /* Pan by screen position. A sound coming from the left of the board should
     arrive on the left, and this is nearly free: it is the cheapest thing that
     makes a 2D-ish mix feel like a space. */
  function routeOut(node, o) {
    var target = o.bus === 'music' ? musicGain : (o.bus === 'ui' ? uiGain : sfxGain);
    var out = node;
    if (o.pan !== undefined && ctx.createStereoPanner) {
      var p = ctx.createStereoPanner();
      p.pan.value = U.clamp(o.pan, -1, 1);
      out.connect(p);
      out = p;
    }
    out.connect(target);
    if (o.reverb && reverbSend) out.connect(reverbSend);
    if (o.echo && echoSend) out.connect(echoSend);
  }

  /* ---------- SFX recipes ----------
     Each takes an options object carrying at least `pan`. Every one jitters,
     because identical repeats are what make synth SFX sound synthetic. */

  var J = Math.random;

  var SFX = {
    /* Tower fire, one per attack kind. These are the sounds the player will
       hear ten thousand times, so they are short, dry and mid-forward, and
       they deliberately leave the low end to the impacts. */
    fire_bullet: function (o) {
      var j = 1 + (J() - 0.5) * 0.18;
      noise({ pan: o.pan, dur: 0.09, gain: 0.20, filter: 'bandpass',
              cutoff: 2100 * j, cutoff1: 700, q: 1.4, attack: 0.001, decay: 0.03 });
      tone({ pan: o.pan, type: 'square', f0: 300 * j, f1: 90, dur: 0.08,
             gain: 0.13, filter: 'lowpass', cutoff: 1800, attack: 0.001 });
    },
    fire_shell: function (o) {
      var j = 1 + (J() - 0.5) * 0.12;
      noise({ pan: o.pan, dur: 0.22, gain: 0.30, filter: 'lowpass',
              cutoff: 900 * j, cutoff1: 180, q: 0.7, attack: 0.002, decay: 0.09, reverb: true });
      tone({ pan: o.pan, type: 'triangle', f0: 130 * j, f1: 42, dur: 0.26, gain: 0.24,
             filter: 'lowpass', cutoff: 700, attack: 0.002 });
    },
    fire_beam: function (o) {
      /* Beams are CONTINUOUS, so this is only the ignition tick. The sustain
         is handled by beamLoop below, because retriggering a sound every frame
         is the classic way to turn a laser into a buzzsaw. */
      tone({ pan: o.pan, type: 'sawtooth', f0: 620, f1: 1500, dur: 0.14, gain: 0.10,
             filter: 'bandpass', cutoff: 1400, q: 4, attack: 0.006 });
    },
    fire_chain: function (o) {
      var j = 1 + (J() - 0.5) * 0.3;
      noise({ pan: o.pan, dur: 0.16, gain: 0.22, filter: 'highpass',
              cutoff: 2400 * j, cutoff1: 5200, q: 0.8, attack: 0.001, decay: 0.05 });
      tone({ pan: o.pan, type: 'square', f0: 1800 * j, f1: 420, dur: 0.13, gain: 0.09,
             filter: 'bandpass', cutoff: 2600, q: 6 });
    },
    fire_cone: function (o) {
      noise({ pan: o.pan, dur: 0.30, gain: 0.22, filter: 'bandpass',
              cutoff: 700, cutoff1: 1500, q: 0.6, attack: 0.03, decay: 0.16, reverb: true });
    },
    fire_hitscan: function (o) {
      var j = 1 + (J() - 0.5) * 0.08;
      tone({ pan: o.pan, type: 'sawtooth', f0: 1400 * j, f1: 70, dur: 0.34, gain: 0.24,
             filter: 'lowpass', cutoff: 3200, cutoff1: 300, attack: 0.001, reverb: true });
      noise({ pan: o.pan, dur: 0.30, gain: 0.20, filter: 'highpass',
              cutoff: 1800, cutoff1: 400, attack: 0.001, decay: 0.12 });
    },
    fire_sweep: function (o) {
      tone({ pan: o.pan, type: 'sine', f0: 300, f1: 460, dur: 0.5, gain: 0.06,
             filter: 'bandpass', cutoff: 900, q: 3, attack: 0.1, reverb: true });
    },

    /* Impacts. These carry the low end. */
    impact_small: function (o) {
      noise({ pan: o.pan, dur: 0.13, gain: 0.18, filter: 'bandpass',
              cutoff: 1500 * (1 + (J() - 0.5) * 0.3), cutoff1: 400, q: 1.1, decay: 0.05 });
      /* The sub thump is what makes a hit FEEL like a hit at all. */
      tone({ pan: o.pan, type: 'sine', f0: 96 * (1 + (J() - 0.5) * 0.1), f1: 42,
             dur: 0.16, gain: 0.16, filter: 'lowpass', cutoff: 260, attack: 0.001 });
    },
    impact_splash: function (o) {
      var j = 1 + (J() - 0.5) * 0.16;
      noise({ pan: o.pan, dur: 0.55, gain: 0.42, filter: 'lowpass',
              cutoff: 1500 * j, cutoff1: 120, q: 0.6, attack: 0.001, decay: 0.2, reverb: true });
      tone({ pan: o.pan, type: 'sine', f0: 92 * j, f1: 34, dur: 0.5, gain: 0.34,
             filter: 'lowpass', cutoff: 400, attack: 0.002 });
      tone({ pan: o.pan, type: 'sine', f0: 46 * j, f1: 22, dur: 0.7, gain: 0.24,
             filter: 'lowpass', cutoff: 180, attack: 0.001, delay: 0.02, echo: true });
    },
    hit: function (o) {
      if (!noteVoice('hit')) return;
      noise({ pan: o.pan, dur: 0.07, gain: 0.10, filter: 'bandpass',
              cutoff: 2600 * (1 + (J() - 0.5) * 0.4), q: 2.5, decay: 0.02 });
    },
    /* Death is the paint shattering: a bright transient then a granular tail. */
    death: function (o) {
      if (!noteVoice('death')) return;
      var j = 1 + (J() - 0.5) * 0.25;
      noise({ pan: o.pan, dur: 0.4, gain: 0.26, filter: 'highpass',
              cutoff: 900 * j, cutoff1: 3400, q: 0.8, attack: 0.001, decay: 0.16, reverb: true });
      tone({ pan: o.pan, type: 'triangle', f0: 420 * j, f1: 60, dur: 0.3, gain: 0.14,
             filter: 'lowpass', cutoff: 1400, attack: 0.001 });
    },
    death_big: function (o) {
      var j = 1 + (J() - 0.5) * 0.1;
      noise({ pan: o.pan, dur: 1.3, gain: 0.5, filter: 'lowpass',
              cutoff: 2200 * j, cutoff1: 90, q: 0.5, attack: 0.002, decay: 0.5, reverb: true });
      tone({ pan: o.pan, type: 'sine', f0: 70 * j, f1: 24, dur: 1.2, gain: 0.42,
             filter: 'lowpass', cutoff: 300, attack: 0.004 });
      tone({ pan: o.pan, type: 'sawtooth', f0: 300, f1: 40, dur: 0.7, gain: 0.14,
             filter: 'lowpass', cutoff: 900, cutoff1: 120, delay: 0.03 });
    },

    /* Reactions get their own timbre family so the player learns them by ear.
       Pitch rises with the reaction's damage multiplier, which means the
       biggest reaction is also the highest and brightest. */
    reaction: function (o) {
      if (!noteVoice('react')) return;
      var base = 380 + (o.mult || 1) * 260;
      tone({ pan: o.pan, type: 'triangle', f0: base, f1: base * 2.4, dur: 0.36,
             gain: 0.20, filter: 'bandpass', cutoff: base * 2, q: 3, attack: 0.004, reverb: true });
      tone({ pan: o.pan, type: 'sine', f0: base * 0.5, f1: base * 1.2, dur: 0.42,
             gain: 0.16, attack: 0.006, delay: 0.02 });
      noise({ pan: o.pan, dur: 0.26, gain: 0.14, filter: 'highpass',
              cutoff: 2000, cutoff1: 6000, decay: 0.1 });
    },

    /* Construction and economy. Mechanical, satisfying, no music pitch. */
    build: function (o) {
      noise({ pan: o.pan, dur: 0.3, gain: 0.24, filter: 'lowpass',
              cutoff: 1100, cutoff1: 300, decay: 0.12, reverb: true });
      tone({ pan: o.pan, type: 'square', f0: 180, f1: 320, dur: 0.16, gain: 0.12,
             filter: 'lowpass', cutoff: 1400, attack: 0.004, sweepExp: false });
      tone({ pan: o.pan, type: 'sine', f0: 520, f1: 780, dur: 0.24, gain: 0.10,
             attack: 0.01, delay: 0.09 });
    },
    upgrade: function (o) {
      for (var i = 0; i < 3; i++) {
        tone({ pan: o.pan, type: 'triangle', f0: 440 * Math.pow(1.26, i), dur: 0.22,
               gain: 0.13, attack: 0.005, delay: i * 0.055, reverb: true });
      }
      noise({ pan: o.pan, dur: 0.25, gain: 0.14, filter: 'bandpass',
              cutoff: 1800, cutoff1: 3600, q: 1.2, delay: 0.02 });
    },
    sell: function (o) {
      tone({ pan: o.pan, type: 'triangle', f0: 520, f1: 190, dur: 0.3, gain: 0.14,
             filter: 'lowpass', cutoff: 1600, attack: 0.004 });
      noise({ pan: o.pan, dur: 0.24, gain: 0.14, filter: 'lowpass',
              cutoff: 900, cutoff1: 220, decay: 0.1 });
    },
    gold: function () {
      tone({ bus: 'ui', type: 'sine', f0: 1180, dur: 0.1, gain: 0.07, attack: 0.002 });
      tone({ bus: 'ui', type: 'sine', f0: 1760, dur: 0.12, gain: 0.05, attack: 0.002, delay: 0.045 });
    },

    /* Structural moments. These are allowed to be loud. */
    waveStart: function () {
      tone({ bus: 'ui', type: 'sawtooth', f0: 110, f1: 165, dur: 1.0, gain: 0.16,
             filter: 'lowpass', cutoff: 900, cutoff1: 2000, attack: 0.06, reverb: true });
      tone({ bus: 'ui', type: 'sine', f0: 220, f1: 330, dur: 0.9, gain: 0.11, attack: 0.08, delay: 0.05 });
      noise({ bus: 'ui', dur: 0.7, gain: 0.10, filter: 'bandpass', cutoff: 300, cutoff1: 900, q: 0.7, attack: 0.12 });
    },
    bossSpawn: function () {
      tone({ bus: 'ui', type: 'sawtooth', f0: 55, f1: 41, dur: 2.6, gain: 0.30,
             filter: 'lowpass', cutoff: 500, cutoff1: 140, attack: 0.4, reverb: true });
      tone({ bus: 'ui', type: 'square', f0: 82, f1: 62, dur: 2.2, gain: 0.14,
             filter: 'lowpass', cutoff: 400, attack: 0.5, delay: 0.15 });
      noise({ bus: 'ui', dur: 2.4, gain: 0.16, filter: 'lowpass', cutoff: 400, cutoff1: 90, attack: 0.6, reverb: true });
    },
    lifeLost: function () {
      tone({ bus: 'ui', type: 'sawtooth', f0: 300, f1: 84, dur: 0.7, gain: 0.24,
             filter: 'lowpass', cutoff: 1400, cutoff1: 260, attack: 0.003, reverb: true });
      noise({ bus: 'ui', dur: 0.5, gain: 0.18, filter: 'lowpass', cutoff: 700, cutoff1: 160, decay: 0.2 });
    },
    victory: function () {
      var chord = [261.6, 329.6, 392.0, 523.3];
      for (var i = 0; i < chord.length; i++) {
        tone({ bus: 'ui', type: 'triangle', f0: chord[i], dur: 2.4, gain: 0.13,
               attack: 0.05, delay: i * 0.10, reverb: true });
        tone({ bus: 'ui', type: 'sine', f0: chord[i] * 2, dur: 1.8, gain: 0.06,
               attack: 0.08, delay: i * 0.10 + 0.2 });
      }
    },
    defeat: function () {
      var chord = [196.0, 233.1, 293.7];
      for (var i = 0; i < chord.length; i++) {
        tone({ bus: 'ui', type: 'sawtooth', f0: chord[i], f1: chord[i] * 0.5, dur: 3.0,
               gain: 0.13, filter: 'lowpass', cutoff: 800, cutoff1: 200,
               attack: 0.1, delay: i * 0.16, reverb: true });
      }
    },
    ability: function (o) {
      tone({ bus: 'ui', type: 'sawtooth', f0: 180, f1: 900, dur: 0.5, gain: 0.16,
             filter: 'bandpass', cutoff: 1200, q: 3, attack: 0.01, reverb: true });
      noise({ bus: 'ui', dur: 0.45, gain: 0.14, filter: 'highpass', cutoff: 800, cutoff1: 4000, decay: 0.18 });
    },
    /* UI. Short, quiet, and pitched away from the gameplay band so they never
       compete with combat for attention. */
    hover: function () {
      tone({ bus: 'ui', type: 'sine', f0: 1320, dur: 0.05, gain: 0.035, attack: 0.002 });
    },
    click: function () {
      tone({ bus: 'ui', type: 'square', f0: 880, f1: 1200, dur: 0.06, gain: 0.06,
             filter: 'lowpass', cutoff: 2600, attack: 0.001 });
    },
    denied: function () {
      tone({ bus: 'ui', type: 'square', f0: 200, f1: 130, dur: 0.16, gain: 0.09,
             filter: 'lowpass', cutoff: 900, attack: 0.002 });
    }
  };

  function play(name, opts) {
    if (!ready || muted) return;
    var fn = SFX[name];
    if (!fn) { errors.push('unknown sfx: ' + name); return; }
    try { fn(opts || {}); } catch (e) { errors.push(name + ': ' + (e && e.message)); }
  }

  /* Shot sounds go through the voice budget so a wall of towers cannot
     saturate the mix. */
  function playShot(kind, opts) {
    if (!noteVoice('shot')) return;
    play('fire_' + kind, opts);
  }

  /* ---------- continuous beam voice ----------
     One persistent oscillator per beaming tower, with its gain and filter
     ridden by the sim. Retriggering a one-shot every frame is what makes
     lasers in amateur games sound like a dentist drill. */
  var _liveVoices = 0;
  function beamVoice() {
    if (!ready) return null;
    _liveVoices++;
    var osc = ctx.createOscillator();
    var sub = ctx.createOscillator();
    var f = ctx.createBiquadFilter();
    var g = ctx.createGain();
    var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.type = 'sawtooth'; osc.frequency.value = 220;
    sub.type = 'sine'; sub.frequency.value = 110;
    f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 3.5;
    g.gain.value = 0;
    osc.connect(f); sub.connect(f); f.connect(g);
    if (pan) { g.connect(pan); pan.connect(sfxGain); g.connect(reverbSend); }
    else { g.connect(sfxGain); g.connect(reverbSend); }
    osc.start(); sub.start();
    var alive = true;
    return {
      set: function (intensity, panVal, ramp) {
        if (!alive) return;
        var t = now();
        g.gain.setTargetAtTime(U.clamp(intensity, 0, 1) * 0.13, t, 0.03);
        f.frequency.setTargetAtTime(900 + ramp * 2200, t, 0.05);
        osc.frequency.setTargetAtTime(200 + ramp * 260, t, 0.05);
        sub.frequency.setTargetAtTime(100 + ramp * 130, t, 0.05);
        if (pan) pan.pan.setTargetAtTime(U.clamp(panVal, -1, 1), t, 0.05);
      },
      stop: function () {
        if (!alive) return;
        alive = false;
        _liveVoices--;
        var t = now();
        g.gain.setTargetAtTime(0, t, 0.04);
        try { osc.stop(t + 0.3); sub.stop(t + 0.3); } catch (e) { /* already stopped */ }
      }
    };
  }

  /* ---------- adaptive music ----------
     A scheduled pad and pulse, not a loop. The scheduler runs ahead of the
     playhead by a fixed lookahead, which is the only reliable way to get
     sample-accurate timing out of Web Audio: setTimeout jitter is tens of
     milliseconds and would be plainly audible as a stumbling pulse.

     ADAPTIVE MEANS THE MIX, NOT THE NOTES. Intensity moves the pulse layer's
     gain and the filter opening, and adds a third harmonic voice at high
     intensity. Changing the actual chord progression with tension is a good
     way to make a game score sound like it is panicking. */
  var music = {
    on: false, intensity: 0, target: 0,
    nextNote: 0, step: 0, timer: null,
    root: 0
  };
  var SCALE = [0, 3, 5, 7, 10];  /* minor pentatonic: cannot produce a wrong note */
  var PROG = [0, 0, -4, -2];     /* i i VI VII in semitone offsets from the root */

  function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function scheduleMusic() {
    if (!ready || !music.on) return;
    var lookahead = 0.35;
    var spb = 60 / 74;           /* 74 bpm, a slow march */
    var stepDur = spb / 2;
    var t = now();
    while (music.nextNote < t + lookahead) {
      var at = Math.max(music.nextNote, t + 0.02);
      var bar = Math.floor(music.step / 8) % PROG.length;
      var root = 38 + PROG[bar] + music.root;
      var inten = music.intensity;

      /* PAD: one long low voice per bar. Always present, it is the floor of
         the whole score. Stereo spread: the two lower voices sit left and
         right and the shimmer rings the middle, so the bed feels wide even
         through a laptop speaker. */
      if (music.step % 8 === 0) {
        for (var v = 0; v < 3; v++) {
          var n = root + [0, 7, 12][v];
          tone({ bus: 'music', type: v === 2 ? 'triangle' : 'sawtooth',
                 f0: midiToHz(n), dur: spb * 4.2, gain: 0.045 - v * 0.008,
                 filter: 'lowpass', cutoff: 340 + inten * 900, q: 1.2,
                 attack: 0.7, decay: spb * 2, delay: at - t, reverb: true,
                 pan: v === 0 ? -0.35 : (v === 1 ? 0.35 : 0) });
        }
        /* BASS DRONE: one octave below the root, the sub the speakers are
           waiting for. It is what makes the score feel anchored. */
        tone({ bus: 'music', type: 'sine', f0: midiToHz(root - 12),
               dur: spb * 4.2, gain: 0.16, filter: 'lowpass', cutoff: 160,
               attack: 0.5, decay: spb * 2, delay: at - t });
      }
      /* KICK: enters with the pulse. A pitched-down sine thump with a click
         transient; without a kick the pulse layer is just noise and the wave
         countdown loses its heartbeat. */
      if (inten > 0.22 && music.step % 4 === 0) {
        tone({ bus: 'music', type: 'sine', f0: 116 * (1 + inten * 0.2), f1: 40,
               dur: 0.22, gain: 0.10 + inten * 0.06, filter: 'lowpass',
               cutoff: 240, attack: 0.002, decay: 0.09, delay: at - t });
        noise({ bus: 'music', dur: 0.05, gain: 0.05, filter: 'highpass',
                cutoff: 3000, q: 1, attack: 0.001, decay: 0.03, delay: at - t });
      }
      /* MELODY: a sparse pluck that arrives earlier than the old arpeggio
         (intensity 0.4 rather than 0.55) and runs through the echo, so the
         pattern has a tail instead of a click. */
      if (inten > 0.40 && (music.step % 8) === 6) {
        var deg = SCALE[(music.step * 3) % SCALE.length];
        tone({ bus: 'music', type: 'triangle', f0: midiToHz(root + 24 + deg),
               dur: 0.5, gain: 0.035 + (inten - 0.4) * 0.07, attack: 0.008,
               filter: 'bandpass', cutoff: 2000, q: 2, delay: at - t,
               reverb: true, echo: true });
      }
      /* SHIMMER: the highest voice, only on the biggest moments. */
      if (inten > 0.72 && music.step % 8 === 2) {
        var dh = SCALE[(music.step + 2) % SCALE.length];
        tone({ bus: 'music', type: 'sine', f0: midiToHz(root + 36 + dh),
               dur: 1.6, gain: 0.038, attack: 0.04, decay: 1.0,
               delay: at - t, reverb: true, pan: 0.5 });
      }
      /* ARPEGGIO: only at high intensity, and only on the off-beats, so it
         reads as agitation rather than as a melody. */
      if (inten > 0.55 && (music.step % 4) === 3) {
        var deg = SCALE[(music.step * 3) % SCALE.length];
        tone({ bus: 'music', type: 'triangle', f0: midiToHz(root + 24 + deg),
               dur: 0.5, gain: 0.03 + (inten - 0.55) * 0.06, attack: 0.01,
               filter: 'bandpass', cutoff: 1800, q: 2, delay: at - t, reverb: true });
      }
      music.nextNote = at + stepDur;
      music.step++;
    }
  }

  function startMusic() {
    if (!ready) return;
    if (music.timer) return;
    music.on = true;
    music.nextNote = now() + 0.1;
    music.step = 0;
    music.timer = setInterval(scheduleMusic, 90);
  }
  function stopMusic() {
    music.on = false;
    if (music.timer) { clearInterval(music.timer); music.timer = null; }
  }
  /* Intensity is smoothed toward its target by the game loop rather than set
     directly, so a wave ending does not drop the score off a cliff. */
  function setIntensity(v) { music.target = U.clamp(v, 0, 1); }
  function tick(dt) {
    music.intensity = U.damp(music.intensity, music.target, 1.4, dt);
  }

  function setVolume(which, v) {
    volumes[which] = U.clamp(v, 0, 1);
    if (!ready) return;
    if (which === 'master') master.gain.value = volumes.master;
    if (which === 'sfx') sfxGain.gain.value = volumes.sfx;
    if (which === 'music') musicGain.gain.value = volumes.music;
    if (which === 'ui') uiGain.gain.value = volumes.ui;
  }
  function setMuted(m) {
    muted = !!m;
    if (ready) master.gain.value = muted ? 0 : volumes.master;
  }

  /* Duck the music under a big moment. Returns immediately; the recovery is
     scheduled on the audio clock so it is not affected by frame hitches. */
  function duck(amount, seconds) {
    if (!ready) return;
    var t = now();
    var g = musicGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(volumes.music * (1 - amount), t + 0.06);
    g.linearRampToValueAtTime(volumes.music, t + 0.06 + (seconds || 1.2));
  }

  return {
    init: init, resume: resume,
    play: play, playShot: playShot, beamVoice: beamVoice,
    startMusic: startMusic, stopMusic: stopMusic,
    setIntensity: setIntensity, tick: tick, duck: duck,
    setVolume: setVolume, setMuted: setMuted,
    volumes: volumes,
    isReady: function () { return ready; },
    liveVoices: function () { return _liveVoices; },
    state: function () { return ctx ? ctx.state : 'none'; },
    errors: function () { return errors.slice(); },
    SFX_NAMES: Object.keys(SFX)
  };
})();


