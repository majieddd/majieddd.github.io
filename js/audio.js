/* ==========================================================================
   COSMIC CONQUEST, Procedural Audio Engine
   --------------------------------------------------------------------------
   Every sound in the game is synthesised at runtime with the Web Audio API.
   There are no audio files, which keeps the game a single self-contained
   folder that works offline and from file://.

   Signal path:
       voices -> [pan] -> sfxBus  -\
                                     >- master -> tilt -> glue -> limiter -> out
       music + ambience -> musicBus -/

   Two ambience sends hang off the BUSES, never off individual voices: a short
   slap for the SFX kit and a longer, darker, tempo-tracking one for music, so
   the two do not smear into each other. The limiter after the glue compressor
   plus the WaveShaper ceiling under it is what guarantees the master never
   reaches 0 dBFS however many cues fire at once; the glue compressor above
   is a musical unit and deliberately lets transients through.

   The music system is a lookahead scheduler (Chris Wilson's pattern): a timer
   runs every SCHEDULE_TICK ms and schedules any beats falling inside the next
   LOOKAHEAD seconds, which keeps timing sample-accurate even when the main
   thread stutters during heavy waves.
   ========================================================================== */

'use strict';

const Sound = (() => {

  const SCHEDULE_TICK = 25;   // ms between scheduler polls
  const LOOKAHEAD     = 0.12; // seconds of audio scheduled ahead of time

  /* Master trim. 0.9 left about 0.9 dB of headroom above a measured 0.763
     peak on a wave-12 barrage, which is not enough margin for a boss dying
     inside that barrage. The glue compressor is a musical -14 dB unit, not a
     peak catcher, so it is the limiter below and this trim together that keep
     the sum of twenty simultaneous voices off the rails. */
  const MASTER_TRIM = 0.80;

  /* Brickwall, after the glue compressor. Hard knee and effectively zero
     attack so it catches exactly the transients the glue unit is meant to let
     through. Without it the kit clips instead of compressing. */
  const LIMIT_THRESHOLD = -1.4;
  const LIMIT_KNEE      = 0;
  const LIMIT_RATIO     = 20;
  const LIMIT_ATTACK    = 0.0005;
  const LIMIT_RELEASE   = 0.055;

  /* THE HARD CEILING, and the reason it exists rather than a second
     compressor: a DynamicsCompressor is not a brickwall. Measured on the
     worst case (every cue in the kit fired at once, four times over) the
     baseline reached 1.18871, and the limiter above pulled that only to
     1.01967, still clipping. Its 0.5 ms attack lets the very transients
     that cause the problem straight past.

     A WaveShaper cannot fail that way: its output is whatever its curve
     says, so a curve that never exceeds CEILING makes the bound arithmetic
     rather than a hope. The curve is EXACTLY LINEAR below SOFT_KNEE, so
     normal play is bit-for-bit untouched and only genuine overshoot is bent.
     No oversampling: a transfer function that is linear in the region the
     signal actually occupies generates no harmonics, so there is nothing for
     oversampling to suppress, and this sits on the master bus. */
  const CEILING   = 0.995;  // absolute output bound, never reached in play
  const SOFT_KNEE = 0.75;   // below this the curve is EXACTLY the identity
  const SHAPER_N  = 2048;   // curve resolution across the full input range

  /* The SFX slap. Unchanged from the shipped value: it is part of what the
     owner already likes about the kit. */
  const SFX_SLAP = 0.16;

  /* The music send is a dotted eighth so its repeats land on the grid instead
     of against it. It has to be computed rather than pinned because
     game.js:1127 moves the tempo every wave, from 98 up to 126 BPM, and the
     old shared 0.16 s slap was on the grid at none of them. */
  const MUS_SEND_BEATS = 0.75;
  function musDelayTime() {
    return Math.min(0.95, (60 / music.tempo) * MUS_SEND_BEATS);
  }

  let ctx = null;
  let master, comp, limiter, ceiling, sfxBus, musicBus, ambBus, sfxSend, musSend;
  /* Music sub-buses and the fixed per-voice channels of the kit. All built
     once at init and never rebuilt, so they cost nothing per bar. */
  let drumBus, bassBus, tunedBus, hatChan, ghostChan, clickChan;
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

    /* The peak catcher the glue unit above deliberately is not. */
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = LIMIT_THRESHOLD;
    limiter.knee.value = LIMIT_KNEE;
    limiter.ratio.value = LIMIT_RATIO;
    limiter.attack.value = LIMIT_ATTACK;
    limiter.release.value = LIMIT_RELEASE;

    /* y = x below the knee; a tanh bend above it reaching exactly CEILING at
       an input of 1. Value and slope are continuous at the knee (span / norm
       is 1.0003), so there is no audible corner where it engages.

       A WaveShaper curve is indexed over an input range of EXACTLY -1..1, and
       any input beyond that is clamped to the end entry. That is what makes
       the bound arithmetic: nothing can leave this node above CEILING. It is
       also the trap. A first attempt built the table across -1.5..1.5, which
       does not narrow the range, it rescales the signal: an input of 0.5
       landed on the entry computed for 0.75. Measured, that made the whole
       mix 50 percent louder (barrage RMS 0.153 to 0.230, music peak 0.207 to
       0.311) while still passing the no-clipping assertion, because a gain
       error hiding under a limiter still satisfies "peak below 1.0". */
    ceiling = ctx.createWaveShaper();
    const curve = new Float32Array(SHAPER_N);
    const span = CEILING - SOFT_KNEE;
    const norm = Math.tanh(1 - SOFT_KNEE);
    for (let i = 0; i < SHAPER_N; i++) {
      const x = (i / (SHAPER_N - 1)) * 2 - 1;
      const a = Math.abs(x);
      const y = a <= SOFT_KNEE ? a : SOFT_KNEE + span * Math.tanh(a - SOFT_KNEE) / norm;
      curve[i] = x < 0 ? -y : y;
    }
    ceiling.curve = curve;
    ceiling.oversample = 'none';

    master = ctx.createGain();
    master.gain.value = MASTER_TRIM;

    sfxBus = ctx.createGain();
    sfxBus.gain.value = settings.sfxEnabled ? settings.sfxVolume : 0;

    musicBus = ctx.createGain();
    musicBus.gain.value = settings.musicEnabled ? settings.musicVolume : 0;

    /* Ambience sends: filtered feedback delays give the dry synth voices a
       sense of space without the cost of convolution reverb.

       SFX AND MUSIC NO LONGER SHARE ONE SEND. They did, and a fixed 0.16 s
       slap is on the grid at none of the tempos the game actually runs, so
       every pad, bass and arpeggio note was being smeared by an off-grid
       repeat of itself. The SFX kit keeps the slap it was tuned with; music
       gets its own longer, darker send that tracks the tempo. */
    sfxSend = ctx.createDelay(1.0);
    sfxSend.delayTime.value = SFX_SLAP;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dampen = ctx.createBiquadFilter();
    dampen.type = 'lowpass'; dampen.frequency.value = 1900;
    const wet = ctx.createGain(); wet.gain.value = 0.14;
    sfxSend.connect(dampen); dampen.connect(fb); fb.connect(sfxSend);
    dampen.connect(wet);

    musSend = ctx.createDelay(1.0);
    musSend.delayTime.value = musDelayTime();
    const musFb = ctx.createGain(); musFb.gain.value = 0.26;
    const musDamp = ctx.createBiquadFilter();
    musDamp.type = 'lowpass'; musDamp.frequency.value = 1250;
    /* 0.34, and the change of destination below is why. This return used to
       land on `master`, downstream of musicBus, so the wet signal did not pass
       through the music volume control at all: turning the music down left the
       delay tail at full level, and the effective wet/dry ratio was not 0.17
       but 0.17 / 0.45 = 0.378, an accident of routing rather than a decision.
       The return now lands on musicBus with the dry, so the fader governs
       both, and 0.34 restores very nearly the ratio the owner has been
       hearing while leaving a little more room in the middle for a kit that
       did not exist when 0.17 was chosen. */
    const musWet = ctx.createGain(); musWet.gain.value = 0.34;
    musSend.connect(musDamp); musDamp.connect(musFb); musFb.connect(musSend);
    musDamp.connect(musWet);

    /* A gentle spectral tilt on the whole mix: a little body at 160Hz, a
       shave above 5k. This is what moves the kit from arcade-bright toward
       the warmer vaporwave register without dulling the transients. */
    const warmth = ctx.createBiquadFilter();
    warmth.type = 'lowshelf'; warmth.frequency.value = 160; warmth.gain.value = 2.5;
    const shave = ctx.createBiquadFilter();
    shave.type = 'highshelf'; shave.frequency.value = 5200; shave.gain.value = -3.5;

    sfxBus.connect(master);
    musicBus.connect(master);
    sfxBus.connect(sfxSend);
    wet.connect(master);
    /* The music bus is no longer one undifferentiated point. It fans into a
       kit, a bass and a tuned bus, because a breakbeat and a pad want opposite
       treatment and the old single send gave them the same one. */
    buildMusicBuses(musSend, musWet);
    master.connect(warmth);
    warmth.connect(shave);
    shave.connect(comp);
    comp.connect(limiter);
    limiter.connect(ceiling);
    ceiling.connect(ctx.destination);

    /* One second of white noise, reused by every percussive//noisy voice. */
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    buildAmbience();

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

  /* Every noise voice used to read the shared buffer from sample zero, so
     all forty impacts in a wave were the identical grain of noise. That
     repetition is the clearest tell that a kit is synthesised rather than
     recorded, and removing it costs one multiply: each voice now enters the
     buffer at its own offset. Looping voices may take any offset because the
     buffer wraps; one-shot voices must leave their own duration ahead. */
  function grain(dur) {
    const room = noiseBuf.duration - (dur || 0) - 0.02;
    return room <= 0 ? 0 : Math.random() * room;
  }

  /* Placement. The panner is only inserted when a voice actually asks to
     move, so every centred cue keeps exactly the node count it had and the
     frame cost of the common case does not change.

     PAN_MAKEUP IS NOT COSMETIC, it corrects a 3 dB level error. A mono voice
     connected straight to a stereo bus is up-mixed by COPY, so both channels
     receive it at full amplitude. A StereoPannerNode instead applies the
     equal-power law, which at dead centre puts cos(pi/4) into each side.
     Measured: an unpanned 0.5 voice renders 0.5 per channel, the same voice
     through a centred panner renders 0.35355. Panning a layer therefore
     silently made it 3 dB quieter than its unpanned neighbours, which is how
     hit() lost 55% of its RMS while nothing in its own definition had been
     turned down. The square root of two restores the reference exactly:
     re-measured, a centred panner with makeup renders 0.5, identical to no
     panner at all, so pan zero is a true no-op and every pan away from it is
     equal-power about the correct level. */
  const PAN_MAKEUP = Math.SQRT2;
  function panned(dest, pan) {
    if (!pan) return dest;
    const p = ctx.createStereoPanner();
    p.pan.value = pan < -1 ? -1 : pan > 1 ? 1 : pan;
    const mk = ctx.createGain();
    mk.gain.value = PAN_MAKEUP;
    mk.connect(p); p.connect(dest);
    return mk;
  }

  /* Cues that fire many times a second get a narrow random placement, so
     successive shots do not stack on one point in the image. Narrow on
     purpose: a battlefield, not a ping-pong match. */
  const JITTER = 0.34;
  function jit() { return (Math.random() * 2 - 1) * JITTER; }

  /* A transient is the first few milliseconds of a real weapon: the
     mechanical snap that happens before the tone arrives. Layering one under
     a cue is most of what separates a first-party weapon from one
     oscillator. Composed from noise() rather than added as a third
     primitive, so the two-primitive rule holds and the depth, envelope and
     throttle laws all apply to it unchanged. */
  function transient(o) {
    const t = o || {};
    noise({
      dur: t.dur || 0.010, gain: t.gain || 0.06, freq: t.freq || 5600,
      type: 'highpass', q: t.q || 0.7, attack: 0.0008,
      delay: t.delay || 0, pan: t.pan || 0
    });
  }

  /** A single oscillator voice with an ADSR-ish envelope and optional glide. */
  function tone(opts) {
    if (!ready || !settings.sfxEnabled) return;
    const {
      freq = 440, endFreq = null, type = 'sine',
      dur = 0.2, attack = 0.005, release = null,
      gain = 0.3, dest = sfxBus, detune = 0,
      filter = null, filterEnd = null, q = 1, delay = 0, pan = 0
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
    g.connect(panned(dest, pan));

    osc.start(t0);
    osc.stop(t0 + attack + rel + 0.05);
  }

  /** A filtered noise burst, the basis of every impact, hiss and explosion. */
  function noise(opts) {
    if (!ready || !settings.sfxEnabled) return;
    const {
      dur = 0.2, gain = 0.3, dest = sfxBus, delay = 0,
      type = 'lowpass', freq = 1200, freqEnd = null, q = 1, attack = 0.002,
      pan = 0
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

    src.connect(f); f.connect(g); g.connect(panned(dest, pan));
    /* Offset, not zero: see grain(). The source loops, so any offset is legal
       and the voice simply wraps through the end of the buffer. */
    src.start(t0, grain(0));
    src.stop(t0 + dur + 0.05);
  }

  /* ------------------------------------------------------------- ambience */

  /* ROOM TONE. A studio mix is never digitally silent. A low bed plus a band
     of slowly moving air gives every cue something to sit on top of, and the
     absence of one is a large part of what reads as "hobby project" even when
     the individual cues are good. The baseline engine rendered exactly zero
     signal with the music scheduler stopped; measured, not assumed.

     Built once at init and never touched again, so the per-frame cost is nil:
     a static graph running on the audio thread. Routed through musicBus so
     the existing music toggle governs it and no new setting appears. */
  const AIR_SUB_HZ    = 190;    // lowpass corner of the rumble bed
  const AIR_SUB_GAIN  = 0.020;  // felt as weight, never heard as a pitch
  const AIR_BAND_HZ   = 2050;   // centre of the moving air band
  /* Set by measurement, not by ear. The bed must be present and must not
     become the loudest thing in a calm wave: at 0.011 it rendered 18.2 dB
     under the intensity-1 music, which dragged that mix's spectral centroid
     from 485 Hz to 1635 Hz and would have read as hiss rather than as air.
     0.0072 puts it near 22 dB down, which is a room and not a layer. */
  const AIR_BAND_GAIN = 0.0072;
  const AIR_SPREAD    = 0.78;   // the two air voices, wide left and right
  /* Two LFOs at deliberately unrelated rates. One rate driving both sides
     would pump the image in lockstep, which reads as a tremolo pedal rather
     than as a room. */
  const AIR_LFO_L_HZ  = 0.043;
  const AIR_LFO_R_HZ  = 0.037;
  const AIR_LFO_DEPTH = 620;    // Hz of sweep either side of centre
  /* Unrelated playback rates too. The shared noise buffer is one second long,
     so three bed voices reading it at 1.0 would share an audible one-second
     cycle. At these rates the periods are 2.7 s, 1.4 s and 1.9 s and share no
     common cycle short enough to hear. */
  const AIR_RATE_SUB  = 0.37;
  const AIR_RATE_L    = 0.71;
  const AIR_RATE_R    = 0.53;

  function airVoice(centreHz, gainV, pan, lfoHz, rate) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 0.9;
    f.frequency.value = centreHz;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = lfoHz;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = AIR_LFO_DEPTH;
    lfo.connect(lfoAmt); lfoAmt.connect(f.frequency);
    const g = ctx.createGain(); g.gain.value = gainV;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(f); f.connect(g); g.connect(p); p.connect(ambBus);
    src.start(0); lfo.start(0);
  }

  function buildAmbience() {
    ambBus = ctx.createGain();
    ambBus.gain.value = 1;
    ambBus.connect(musicBus);
    /* The rumble stays centred. Low content that is spread smears on any
       system that sums to one driver, which is why bass is kept mono on every
       real desk; only the air above it is placed. */
    const sub = ctx.createBufferSource();
    sub.buffer = noiseBuf; sub.loop = true;
    sub.playbackRate.value = AIR_RATE_SUB;
    const sf = ctx.createBiquadFilter();
    sf.type = 'lowpass'; sf.frequency.value = AIR_SUB_HZ; sf.Q.value = 0.7;
    const sg = ctx.createGain(); sg.gain.value = AIR_SUB_GAIN;
    sub.connect(sf); sf.connect(sg); sg.connect(ambBus);
    sub.start(0);
    /* The two air voices sit a minor sixth apart rather than on one centre,
       so the bed has a width that does not collapse when it is summed. */
    airVoice(AIR_BAND_HZ, AIR_BAND_GAIN, -AIR_SPREAD, AIR_LFO_L_HZ, AIR_RATE_L);
    airVoice(AIR_BAND_HZ * 0.86, AIR_BAND_GAIN, AIR_SPREAD, AIR_LFO_R_HZ, AIR_RATE_R);
  }

  /* --------------------------------------------------------- music buses */

  /* THE KIT'S TONE LIVES HERE, NOT IN THE VOICES, and that is what keeps a
     breakbeat from brightening the mix.

     Jungle's drums are a sampled break played back through a late-eighties
     sampler: band-limited, a little soft on top, weighty in the low mids. That
     is not a preference, it is the machine. Modelling it as a fixed bus tilt
     rather than per-hit filtering does three things at once. It is free (built
     once, runs on the audio thread). It gives every drum voice the same
     character without repeating a filter thirty times a bar. And it is the
     lever that pays for the high-frequency energy hats necessarily add, so
     `tempo 84 (do not brighten)` in docs/BRAND.md survives the arrival of a
     hi-hat pattern. The centroid figures in the report are what settled the
     shelf frequency and depth; they were not chosen by ear.

     The three named channels below exist for the same reason plus one more.
     A hat's filtering is IDENTICAL on every hit, so rebuilding it per hit was
     pure waste: hoisting it here takes each hat from four nodes to three, and
     at up to eighty-eight hats in a four-bar loop that is the single largest
     allocation saving in this pass. Per-hit variation comes from playbackRate
     instead, which is a property write rather than a node, and which is also
     what actually varies on a sampler: the chop's resample rate. */
  const DRUM_SHELF_HZ   = 7400;   // the sampler's ceiling
  const DRUM_SHELF_DB   = -4.0;   // measured against the centroid lock
  const DRUM_BODY_HZ    = 190;    // the weight a break has on vinyl
  const DRUM_BODY_DB    = 2.2;
  /* A short room, NOT a delay. The music send is a dotted eighth, which is
     correct for a pad and ruinous for a break: every ghost note would arrive
     again three eighths later, on the grid, and turn the kit to porridge. Two
     incommensurate taps at 43 and 71 ms read as a small live room; one tap
     reads as an echo, which is the thing being avoided. */
  const ROOM_A_S = 0.043, ROOM_B_S = 0.071;
  const ROOM_FB  = 0.17;    // well under unity, so the pair cannot run away
  /* The taps sit near the edges rather than half way out, and the wet is up a
     little from 0.085. The dry kit is mostly centred by design (kick and snare
     body are mono on purpose, as all low content in this file is), so the room
     is the one place the kit can be given an image without putting bass in the
     sides. Measured: the music mix reads near-mono the moment the bass enters
     in BOTH engines, and this is the honest way to move that number rather
     than spreading content that must not be spread. */
  const ROOM_WET = 0.10;
  const ROOM_PAN = 0.78;
  const ROOM_DAMP_HZ = 2600;

  function roomTap(src, timeS, pan) {
    const dl = ctx.createDelay(0.5); dl.delayTime.value = timeS;
    const dp = ctx.createBiquadFilter();
    dp.type = 'lowpass'; dp.frequency.value = ROOM_DAMP_HZ;
    const fb = ctx.createGain(); fb.gain.value = ROOM_FB;
    const wet = ctx.createGain(); wet.gain.value = ROOM_WET;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(dl); dl.connect(dp); dp.connect(fb); fb.connect(dl);
    dp.connect(wet); wet.connect(p); p.connect(musicBus);
  }

  /* One fixed drum channel: filter, optional sampler ceiling, level makeup,
     placement. PAN_MAKEUP is applied for exactly the reason documented at its
     definition, and it matters more here than anywhere: without it every
     panned drum channel would sit 3 dB under the centred kick, so the kit
     would have been mixed around a level error rather than around a balance. */
  function drumChan(type, freq, q, topHz, pan) {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    let node = f;
    if (topHz) {
      const top = ctx.createBiquadFilter();
      top.type = 'lowpass'; top.frequency.value = topHz; top.Q.value = 0.6;
      node.connect(top); node = top;
    }
    const mk = ctx.createGain(); mk.gain.value = PAN_MAKEUP;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    node.connect(mk); mk.connect(p); p.connect(drumBus);
    return f;
  }

  function buildMusicBuses(sendNode, sendWet) {
    drumBus  = ctx.createGain(); drumBus.gain.value  = 1;
    bassBus  = ctx.createGain(); bassBus.gain.value  = 1;
    tunedBus = ctx.createGain(); tunedBus.gain.value = 1;

    const shave = ctx.createBiquadFilter();
    shave.type = 'highshelf';
    shave.frequency.value = DRUM_SHELF_HZ;
    shave.gain.value = DRUM_SHELF_DB;
    const body = ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = DRUM_BODY_HZ;
    body.Q.value = 0.8;
    body.gain.value = DRUM_BODY_DB;
    drumBus.connect(shave); shave.connect(body); body.connect(musicBus);
    roomTap(body, ROOM_A_S, -ROOM_PAN);
    roomTap(body, ROOM_B_S, ROOM_PAN);

    /* Hats: the band of a resampled break, not a synthesised 909. A highpass
       alone climbs forever and is most of why a synthetic hat sounds thin and
       bright; the lowpass above it is the sampler's own ceiling and is what
       lets this pattern exist inside the brightness lock.

       Two channels, hard left and hard right, because placement is fixed per
       channel rather than per hit. That is both how a kit is actually mixed
       and what removes the last per-hit node: a hat is now a source and an
       envelope, nothing else. */
    hatChan = [drumChan('highpass', 5800, 0.7, 11000, -HAT_SPREAD),
               drumChan('highpass', 5800, 0.7, 11000, HAT_SPREAD)];

    /* Ghost notes are MID, not high: a ghost is the wires of a snare struck
       softly, which sits around two kilohertz. Putting break density here
       rather than in the hats is what buys the density without the brightness. */
    ghostChan = [drumChan('bandpass', 1950, 1.15, 0, -GHOST_SPREAD),
                 drumChan('bandpass', 1950, 1.15, 0, GHOST_SPREAD)];

    /* The kick's beater, centred: a kick with no click disappears the moment
       anything else plays, because the sine carrying it is masked by the bass.
       Low content stays mono here for the same reason it does in the ambience
       bed, so this channel takes no panner and no makeup. */
    clickChan = ctx.createBiquadFilter();
    clickChan.type = 'bandpass'; clickChan.frequency.value = 2900; clickChan.Q.value = 1.0;
    clickChan.connect(drumBus);

    /* A HIGHPASS ON THE BASS BUS ONLY. Nothing below about 45 Hz survives a
       laptop speaker or a phone, so content down there is energy that is felt
       as mud on a real system and simply lost on most, and a sustained reese
       plus a pulsed square put a lot of it there. The KICK does not pass
       through here (it is on the drum bus), so it keeps its whole bottom
       octave and the space it needs to be felt: this cleans up around the
       kick rather than cleaning up the kick. Static, so it costs nothing. */
    const bassHP = ctx.createBiquadFilter();
    bassHP.type = 'highpass'; bassHP.frequency.value = 45; bassHP.Q.value = 0.7;
    bassBus.connect(bassHP); bassHP.connect(musicBus);
    tunedBus.connect(musicBus);
    /* ONLY the tuned bus feeds the send. Bass through a delay is mud and the
       kit has its own room above, so the dotted eighth now serves the parts it
       was computed for: the pad, the arpeggio and the lead. */
    tunedBus.connect(sendNode);
    sendWet.connect(musicBus);
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
    /* The workhorse: fires more than any other cue in the kit. It was all
       mid, so the gun had a crack but no weight behind it, and every shot
       landed on the same point in the image. Body and placement added; the
       original two voices are untouched. */
    bolt() {
      if (throttled('bolt', 0.045)) return;
      const p = jit();
      transient({ gain: 0.055, freq: 6000, dur: 0.009, pan: p });
      tone({ freq: 900, endFreq: 380, type: 'triangle', dur: 0.1, gain: 0.16, release: 0.09, pan: p * 0.5 });
      noise({ dur: 0.05, gain: 0.06, freq: 3000, freqEnd: 900, type: 'bandpass', q: 2, pan: p });
      tone({ freq: 190, endFreq: 110, type: 'sine', dur: 0.08, gain: 0.075, release: 0.07 });
    },

    /* Gains the mechanical launch snap and the barrel resonance that a tube
       adds after the charge. The original blast is unchanged. */
    mortar() {
      if (throttled('mortar', 0.07)) return;
      transient({ gain: 0.07, freq: 4400, dur: 0.011 });
      tone({ freq: 180, endFreq: 48, type: 'square', dur: 0.22, gain: 0.22, filter: 900, filterEnd: 180 });
      noise({ dur: 0.24, gain: 0.2, freq: 700, freqEnd: 120 });
      tone({ freq: 96, endFreq: 74, type: 'sine', dur: 0.30, gain: 0.10, release: 0.28, delay: 0.02 });
    },

    /* Was a single mono cloud. The blast itself is unchanged and stays
       centred, because low content is kept mono; what is added is the ignition
       snap in front of it and a debris tail arriving late and wide, which is
       the part that makes a blast read as happening in a place. */
    explosion(scale = 1) {
      if (throttled('explosion', 0.05)) return;
      transient({ gain: 0.09, freq: 5000, dur: 0.012 });
      noise({ dur: 0.34 * scale, gain: 0.26, freq: 1400, freqEnd: 70, q: 0.8 });
      tone({ freq: 110 * (1 / scale), endFreq: 28, type: 'sine', dur: 0.34 * scale, gain: 0.3, release: 0.3 * scale });
      noise({ dur: 0.30 * scale, gain: 0.045, freq: 2600, freqEnd: 900, type: 'bandpass', q: 0.6, attack: 0.05, delay: 0.05, pan: -0.65 });
      noise({ dur: 0.34 * scale, gain: 0.040, freq: 2100, freqEnd: 700, type: 'bandpass', q: 0.6, attack: 0.07, delay: 0.08, pan: 0.65 });
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

    /* THE ZAP. A sawtooth sweeping 2100 down to 240 through a resonant
       filter is the cartoon zap the brief rules out by name. An electrical
       arc is not a swept tone, it is a series of breakdowns: three crackle
       grains across the image over a low thump, no descending whine. */
    arc() {
      if (throttled('arc', 0.06)) return;
      const p = jit();
      transient({ gain: 0.09, freq: 6200, dur: 0.012, pan: p });
      noise({ dur: 0.05, gain: 0.075, freq: 3400, freqEnd: 1500, type: 'bandpass', q: 3.5, pan: p * 0.6 });
      noise({ dur: 0.035, gain: 0.055, freq: 4600, freqEnd: 2200, type: 'bandpass', q: 5, delay: 0.022, pan: -p * 0.8 });
      tone({ freq: 300, endFreq: 120, type: 'triangle', dur: 0.13, gain: 0.10, filter: 900, release: 0.11 });
    },

    pyre() {
      if (throttled('pyre', 0.16)) return;
      noise({ dur: 0.32, gain: 0.09, freq: 900, freqEnd: 1900, type: 'bandpass', q: 0.7, attack: 0.06 });
    },

    /* Structurally already right: charge, snap, tail. What it lacked was the
       snap's own transient and any sense of scale after it. The ring-out is
       wide, quiet and late, and NOTHING here is delayed that was not delayed
       before: adding latency to a weapon to make it sound bigger is a trade
       this cue is not allowed to make. */
    railgun() {
      if (throttled('railgun', 0.08)) return;
      transient({ gain: 0.11, freq: 7200, dur: 0.013 });
      tone({ freq: 120, endFreq: 1900, type: 'sawtooth', dur: 0.09, gain: 0.13, filter: 6000 });
      tone({ freq: 1500, endFreq: 90, type: 'square', dur: 0.4, gain: 0.19, filter: 3200, filterEnd: 300, release: 0.36 });
      noise({ dur: 0.42, gain: 0.13, freq: 5000, freqEnd: 200 });
      noise({ dur: 0.5, gain: 0.032, freq: 3000, freqEnd: 1200, type: 'bandpass', q: 0.7, attack: 0.09, delay: 0.09, pan: -0.7 });
      noise({ dur: 0.55, gain: 0.030, freq: 2400, freqEnd: 950, type: 'bandpass', q: 0.7, attack: 0.12, delay: 0.12, pan: 0.7 });
    },

    /* Two rising squares is the arcade power-up register the brief rules
       out. A critical hit should read as struck metal, and what makes metal
       sound like metal is INHARMONIC partials: 2.76 and 5.4 are non-integer
       on purpose, because integer ratios would just be a bell chord, which is
       the sound this cue is moving away from. */
    crit() {
      if (throttled('crit', 0.1)) return;
      transient({ gain: 0.07, freq: 7000, dur: 0.01, pan: 0.12 });
      tone({ freq: 1180, type: 'triangle', dur: 0.16, gain: 0.10, release: 0.14 });
      tone({ freq: 1180 * 2.76, type: 'sine', dur: 0.13, gain: 0.045, release: 0.11, pan: -0.30 });
      tone({ freq: 1180 * 5.4, type: 'sine', dur: 0.09, gain: 0.020, release: 0.08, pan: 0.30 });
    },

    toxin() {
      if (throttled('toxin', 0.07)) return;
      tone({ freq: 320, endFreq: 130, type: 'sine', dur: 0.2, gain: 0.13, filter: 1000 });
      tone({ freq: 470, endFreq: 190, type: 'sine', dur: 0.22, gain: 0.07, delay: 0.05 });
    },

    /* --- new archetypes --------------------------------------------- */

    /** TETHER, a mechanical winch: ratchet click then a rising cable haul. */
    tether() {
      if (throttled('tether', 0.09)) return;
      noise({ dur: 0.06, gain: 0.09, freq: 2200, freqEnd: 800, type: 'bandpass', q: 2.5 });
      tone({ freq: 220, endFreq: 520, type: 'sawtooth', dur: 0.26, gain: 0.11, filter: 1600, filterEnd: 700 });
    },

    /** PRISM, a pure sustained tone; the pitch rides the focus ramp. */
    prism() {
      if (throttled('prism', 0.11)) return;
      tone({ freq: 1300, endFreq: 1750, type: 'sine', dur: 0.24, gain: 0.055, attack: 0.05 });
      tone({ freq: 2600, endFreq: 3500, type: 'sine', dur: 0.22, gain: 0.028, attack: 0.06 });
    },

    /** SINGULARITY, everything sucked inward: a downward pitch collapse. */
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

    /* Two bare square beeps: a literal arcade bleep, and the one cue in the
       kit that most clearly announced itself as a synth. Arming a mine is a
       mechanism latching twice, so it is now a clack: transient plus a short
       damped body, the second one lower and quieter than the first. */
    mineArm() {
      if (throttled('mineArm', 0.12)) return;
      transient({ gain: 0.070, freq: 4200, dur: 0.010, pan: -0.14 });
      tone({ freq: 380, endFreq: 300, type: 'square', dur: 0.035, gain: 0.050, filter: 1400, release: 0.030, pan: -0.14 });
      transient({ gain: 0.050, freq: 3400, dur: 0.009, delay: 0.075, pan: 0.14 });
      tone({ freq: 300, endFreq: 250, type: 'square', dur: 0.030, gain: 0.035, filter: 1200, release: 0.026, delay: 0.075, pan: 0.14 });
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

    /** Reanimation: a hollow, inverted "kill", something getting back up. */
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

    /** Enemy escalation, an ugly, dissonant swell. */
    escalation() {
      [0, 0.16, 0.32].forEach(d => {
        tone({ freq: 73,  type: 'sawtooth', dur: 0.9, gain: 0.2,  delay: d, filter: 420 });
        tone({ freq: 103, type: 'sawtooth', dur: 0.9, gain: 0.12, delay: d, filter: 560 });
      });
      noise({ dur: 1.3, gain: 0.07, freq: 200, freqEnd: 1400, type: 'bandpass', q: 0.5, attack: 0.6 });
    },

    /** Command upgrade offered, a bright, hopeful arpeggio. */
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

    /** BLINK: a short inverted whoosh, something skipping space. */
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
    /* Fires on every landed shot, so it is the cue whose repetition is most
       audible. It gets a micro transient and placement and nothing else: any
       more material here would turn a dense wave into mud. */
    hit() {
      if (throttled('hit', 0.035)) return;
      const p = jit();
      transient({ gain: 0.030, freq: 6800, dur: 0.005, pan: p });
      noise({ dur: 0.05, gain: 0.05, freq: 2600, freqEnd: 700, type: 'bandpass', q: 1.4, pan: p });
    },

    /* Transient and placement; the low voice stays centred so a busy wave
       still has a stable middle. */
    kill() {
      if (throttled('kill', 0.04)) return;
      const p = jit();
      transient({ gain: 0.05, freq: 5600, dur: 0.008, pan: p });
      noise({ dur: 0.14, gain: 0.11, freq: 2200, freqEnd: 260, pan: p * 0.7 });
      tone({ freq: 420, endFreq: 130, type: 'triangle', dur: 0.14, gain: 0.09 });
    },

    bossKill() {
      [0, 0.12, 0.26, 0.42].forEach((d, i) => {
        noise({ dur: 0.8, gain: 0.26, freq: 1800, freqEnd: 50, delay: d });
        tone({ freq: 90 - i * 12, endFreq: 22, type: 'sine', dur: 1.0, gain: 0.34, delay: d, release: 0.9 });
      });
    },

    /* A shield failing is a plate breaking, not one filter sweep. The
       original sweep is kept as the failure itself and three shard grains
       scatter across the image behind it at falling pitch. */
    shieldBreak() {
      if (throttled('shieldBreak', 0.1)) return;
      transient({ gain: 0.09, freq: 7400, dur: 0.011 });
      tone({ freq: 1800, endFreq: 300, type: 'square', dur: 0.26, gain: 0.14, filter: 4000, filterEnd: 600 });
      noise({ dur: 0.3, gain: 0.12, freq: 4500, freqEnd: 800, type: 'bandpass', q: 2 });
      [[0.035, -0.55, 5200], [0.070, 0.60, 4300], [0.115, -0.30, 3600]].forEach(function (s) {
        noise({ dur: 0.05, gain: 0.035, freq: s[2], freqEnd: s[2] * 0.55, type: 'bandpass', q: 4, delay: s[0], pan: s[1] });
      });
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

    /* A KEY WITH NO READER, which is this codebase's signature defect wearing
       an audio costume. game.js:3693 has called Sound.play('place') since
       tower relocation shipped, and no cue of that name has ever existed, so
       play() looked it up, found nothing, and returned: moving a tower was
       silent. Deliberately NOT build(): that is the ascending three-note
       confirm for a NEW tower, and relocation is a different event. This is a
       magnetic release followed by a set, so the two read apart in a fight. */
    place() {
      if (throttled('place', 0.08)) return;
      transient({ gain: 0.06, freq: 5000, dur: 0.010 });
      tone({ freq: 700, endFreq: 300, type: 'triangle', dur: 0.09, gain: 0.10, release: 0.08, pan: -0.18 });
      tone({ freq: 240, endFreq: 180, type: 'sine', dur: 0.16, gain: 0.10, release: 0.14, delay: 0.05 });
      noise({ dur: 0.10, gain: 0.05, freq: 1800, freqEnd: 500, delay: 0.05, pan: 0.18 });
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

    /* The most-fired cue in the game: 52 call sites, more than any other.
       A bare 1500 Hz sine glide is an arcade bleep, and it was the single
       loudest signal that this interface was a hobby build. A studio UI tick
       is a noise transient over a short, dark, damped body, and it is the
       body being LOW that makes a click read as expensive. */
    click() {
      if (throttled('click', 0.02)) return;
      transient({ gain: 0.045, freq: 6400, dur: 0.008 });
      tone({ freq: 620, endFreq: 430, type: 'triangle', dur: 0.045, gain: 0.075, release: 0.038, filter: 2600 });
    },

    /* Same treatment, an order quieter: hover must be felt, never listened to. */
    hover() {
      if (throttled('hover', 0.04)) return;
      transient({ gain: 0.016, freq: 7600, dur: 0.006 });
      tone({ freq: 1180, type: 'sine', dur: 0.030, gain: 0.020, release: 0.026 });
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

     ONE SCORE, TWO CLOCKS.

     The harmony is the four-bar loop in A minor this file has always had, at
     84 BPM, and it does not move. The kit underneath runs at exactly twice
     that, 168 BPM, which is the middle of the jungle and drum-and-bass window.
     Fast drums under slowly moving harmony is the half-time feel that Ridge
     Racer Type 4 and Cowboy Bebop both live on, and it is the only way to put
     a breakbeat in this game without touching the tempo docs/BRAND.md pins.
     Every unit of energy this pass adds is added in the drums: the pad, the
     arpeggio, the chord rate and the lead are on exactly the clock they were
     on before, so the mood is untouched by construction rather than by care.

     THE BREAK IS SYNTHESISED, NOT SAMPLED. Jungle is historically a sliced
     Amen break, and this engine has no sample files and never will, so the
     break is built from the two things the rest of this file is built from:
     pitched oscillators with fast envelopes, and windowed grains of the shared
     noise buffer at line 208. Per voice:

       kick    sine, 168 Hz collapsing to 41 Hz in 55 ms, plus a band-passed
               noise beater on the fixed click channel. The chop kick is the
               same voice truncated, which is what a slice does to a sample.
       snare   three parts, because a snare is three things: a broadband crack
               (noise through a per-hit bandpass, so no two are identical), the
               wire rattle (noise on the hat band, placed left or right), and
               the membrane (a triangle falling 196 Hz to 148 Hz).
       ghost   the wire band alone, short and quiet, on its own mid channel.
               Ghosts are what make a break read as chopped rather than
               programmed, and they are MID, not high, on purpose.
       hat     a grain of the noise buffer read at a per-hit playbackRate
               through a fixed 5.8 kHz to 11 kHz band. Varying the rate rather
               than the filter is free, and it is also what actually varies on
               a sampler: the resample rate of the chop.

     The shuffle is not a slice either. It is a scheduling offset applied to
     odd steps, which is what a swung sixteenth physically is.
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

  /* Placement. The pad is wide because it is the bed; the rhythm parts are
     narrow because a kit that wanders is distracting rather than wide. */
  const PAD_SPREAD   = 0.62;
  /* WIDER THAN THE OLD 0.28, and measured rather than felt. With the kit at
     0.28 and the ghosts at 0.20 the whole music mix rendered at a stereo width
     of 0.005, which is 99.5 percent correlated: effectively mono. That is what
     happens when every loud voice (kick, snare body, bass, reese, arpeggio) is
     centred and only the quiet ones are placed. A real kit is wide across the
     overheads and dead centre at the drum, which is exactly this: hats and
     ghosts open up, snare body and kick do not move. */
  const HAT_SPREAD   = 0.42;
  const GHOST_SPREAD = 0.30;

  /* THE TEMPO LOCK. docs/BRAND.md line 76: "Audio identity: deep vaporwave
     register SFX_DEPTH 0.62, tempo 84 (do not brighten)." The harmonic layer
     runs at this and nothing is permitted to move it, which is why setTempo()
     below clamps instead of assigning. */
  const TEMPO_LOCK = 84;

  /* The kit runs at exactly twice the harmonic tempo. 84 x 2 = 168, and it is
     the 2:1 being EXACT that makes the half-time feel work rather than sound
     like two things nearly agreeing. */
  const DRUM_MULT = 2;

  /* The grid is sixteenths at the DRUM tempo, which is thirty-seconds at the
     harmonic one. The resolution had to double for this pass: ghost notes and
     shuffled hats do not exist on a sixteenth grid at 84, so the old scheduler
     could not have expressed a break at any tempo. */
  const DRUM_BAR_STEPS = 16;                          // one bar at 168
  const HARM_BAR_STEPS = DRUM_BAR_STEPS * DRUM_MULT;  // 32, one bar at 84
  const LOOP_STEPS     = HARM_BAR_STEPS * 4;          // 128, the four-bar loop

  /* SWING, AS A SCHEDULING OFFSET, which is the only form it can take here:
     there is no sliced loop to shuffle.

     STATED AT THE EIGHTH, not the sixteenth, and that is a correction the
     measurement forced. Swing on odd sixteenths leaves the eighth-note
     offbeats exactly where they were, and the eighth-note offbeats are where
     every loud hat in the table below sits. Measured, that gave intensity 2 a
     shuffle of precisely zero: the lope only appeared at intensity 3, when the
     quiet sixteenth ticks unlocked. The lope in both UK garage and in the jazz
     half of the reference set lives on the "and", so that is where it is put.

     A beat is four steps. The "and" lands SWING steps late, which puts it at
     (2 + SWING) / 4 = 0.58 of the beat: the UK garage pocket. Straight is
     0.50 and a triplet shuffle is 0.667. The "e" and the "a" subdivide the two
     eighths the swing has just made unequal, so they inherit half of it, which
     is what keeps a sixteenth run even inside a swung beat instead of
     jerking.

     SWING IS A PROPERTY OF THE GRID POSITION, NOT OF THE INSTRUMENT. Every
     drum voice takes the offset of the step it lands on, because a kick and a
     hat on the same "and" that disagree by 29 ms are a flam, not a groove. The
     pocket is preserved by the fact that the downbeats, and therefore the
     backbeat snares on steps 4 and 12, sit at offset zero by construction. */
  const SWING = 0.32;
  function swingOf(h) {
    const q = h & 3;
    return q === 0 ? 0 : q === 2 ? SWING : SWING * 0.5;
  }

  /* THE BREAK, as one-bar figures over sixteen steps at 168. Each entry is a
     velocity code, not a boolean: 2 is a full hit, 1 is the truncated or
     ghosted version, 0 is nothing.

     Four figures rather than one, because a break that repeats every bar reads
     as a loop no matter how well it is voiced. Jungle solves this by
     re-ordering slices of the same break, and BREAK_ORDER below is exactly
     that: horizontal re-sequencing, which is also far cheaper in memory than
     stacking vertical layers.

       D  the two-step. UK garage: one snare per bar, and the kick doing the
          skipping. Step 7 is the whole figure, the kick that lands one
          sixteenth BEFORE the snare rather than with it, and it is what makes
          this a two-step instead of a backbeat played slowly. Sparse and cool,
          so the kit ARRIVES as intensity climbs rather than being switched on.
          Note that step 7 is an odd step, so it does not exist on a sixteenth
          grid at 84: this figure is already at 168 even where it is quietest.
       A  the roller. Kick on 1 and on the "and" of 3, backbeat on 2 and 4,
          ghosts filling the gap before each. This is the workhorse.
       B  the displacement. Same skeleton with the second snare arriving a
          step late, which is what stops A from becoming a metronome.
       C  the turnaround. An extra kick, a flammed snare and three ghosts. */
  const BREAKS = {
    D: { kick: [2,0,0,0, 0,0,0,1, 0,0,2,0, 0,0,0,0],
         snr:  [0,0,0,0, 0,0,0,0, 2,0,0,0, 0,0,0,0],
         gst:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,1,0,0] },
    A: { kick: [2,0,0,0, 0,0,0,0, 0,0,2,0, 0,0,0,0],
         snr:  [0,0,0,0, 2,0,0,0, 0,0,0,0, 2,0,0,0],
         gst:  [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1] },
    B: { kick: [2,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0],
         snr:  [0,0,0,0, 2,0,0,0, 0,0,0,0, 0,0,2,0],
         gst:  [0,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0] },
    C: { kick: [2,0,0,0, 0,0,1,0, 0,0,2,0, 0,0,0,0],
         snr:  [0,0,0,0, 2,0,0,0, 0,0,0,0, 2,1,0,0],
         gst:  [0,0,1,0, 0,0,0,1, 0,0,0,0, 0,0,0,1] }
  };

  /* Eight drum bars per four-bar harmonic loop, one row per intensity tier.
     Intensity 0 has no row because it has no kit: the menu is a pad. */
  const BREAK_ORDER = {
    1: ['D','D','D','D','D','D','D','D'],
    2: ['A','B','A','B','A','B','A','C'],
    3: ['A','C','A','B','A','C','B','C']
  };

  /* Hat amplitudes per step. A table rather than a rule, because a rule is
     what makes programmed hats sound programmed.

     The four downbeats are ZERO on purpose: the kick and the snare occupy
     them, and leaving them open is most of what gives a garage kit its pocket.
     The loud entries are the eighth-note offbeats; the quiet ones are the
     sixteenth ticks between, and those are gated on drive so density arrives
     with the wave rather than being present from bar one. Step 15 is louder
     than its neighbours because it is the pickup into the next bar. */
  const HAT = [0.000, 0.018, 0.048, 0.013, 0.000, 0.020, 0.052, 0.015,
               0.000, 0.018, 0.046, 0.013, 0.000, 0.022, 0.050, 0.026];
  const HAT_LOUD = 0.04;   // at or above this, a hat plays at any drive

  const music = {
    playing: false,
    timer: null,
    nextTime: 0,
    step: 0,          // grid counter, sixteenths at 168, wraps every LOOP_STEPS
    tempo: TEMPO_LOCK,
    intensity: 1,
    /* Break density, 0..1. See setTempo(): this is where the game's per-wave
       tempo request is spent now that the tempo itself is pinned. */
    drive: 0.4,
    /* The reese's sidechain gain for the current bar, or null. Read by the
       kick, written by the bass. See the ordering note in scheduleStep(). */
    duck: null
  };

  function stepDuration() { return (60 / music.tempo) / (4 * DRUM_MULT); }

  /* A PRIVATE RANDOM STREAM FOR THE MUSIC LAYER. This is a defect fix, not a
     tidy-up, and it is the reason the break may safely draw as much noise as
     it likes.

     js/net.js:534 runs a lockstep match by REPLACING the global Math.random
     with the seeded simulation PRNG, and isolates the audio engine from that
     stream by wrapping exactly five entry points (net.js:632): play, resume,
     startMusic, stopMusic and setIntensity. schedulerTick is not one of them
     and cannot be: it runs on a setInterval, on wall-clock time, outside every
     wrapper. So the old snare and hat voices, which called grain() and
     therefore Math.random, were drawing from the simulation's RNG stream at a
     rate set by music.intensity and at moments set by when the audio context
     happened to start. Two clients cannot agree on either. That is a desync at
     intensity 2 and above, which is wave 5 onward.

     This pass adds ghosts, beaters and far more hats, so the exposure would
     have grown by roughly six times. A private stream removes it entirely, and
     a FIXED seed means the engine never touches the global generator at all,
     not even once at init. The break's grain sequence repeating per session is
     inaudible: it is which slice of a one-second noise buffer each hit reads. */
  let musSeed = 0x9E3779B9;
  function musRand() {
    musSeed = (Math.imul(1664525, musSeed) + 1013904223) >>> 0;
    return musSeed / 4294967296;
  }
  function musGrain(dur) {
    const room = noiseBuf.duration - dur - 0.02;
    return room <= 0 ? 0 : musRand() * room;
  }

  /* MEASUREMENT ONLY, and named so it is greppable, exactly like `bus` at the
     bottom of this file. The claim this pass owes ("the kit runs at twice the
     harmonic layer, and the shuffle is 58 percent") is only honest if it is
     read from the times the scheduler ACTUALLY hands the audio thread, rather
     than from the tables above. A harness installs a function here and
     receives (voiceName, contextTime, stepIndex) for every scheduled event.
     The step index is what makes the grid measurable rather than guessable;
     see the note at the export. Null in play:
     the cost is one truthiness test per voice per step. */
  let musTap = null;
  function setMusicTap(fn) { musTap = typeof fn === 'function' ? fn : null; }

  /* ------------------------------------------------------- kit voices */

  /* A short noise burst on a FIXED channel. Two nodes, because the filtering
     and the placement already exist on the channel and only the source and its
     envelope are per hit. rate shifts the grain's whole spectrum, which is how
     a sampler varies a chop and is free compared with a per-hit filter. */
  function grainHit(chan, t, amp, dur, rate, attack) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    const a = attack || 0.0008;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(g); g.connect(chan);
    src.start(t, musGrain(dur + 0.05));
    src.stop(t + dur + 0.02);
  }

  /* KICK. The pitch collapse is 55 ms, less than half the 120 ms the old kick
     used, and that is the single change that lets a kick exist at 168 at all:
     a slow collapse smears into the next sixteenth and the pattern turns to
     mud. `hard` false is the chop, the same voice truncated and lifted, which
     is what a slice does to a sample rather than a different drum. */
  const KICK_DUCK   = 0.34;   // how far the reese is pushed down under a kick
  function kickVoice(t, hard) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const drop = hard ? 0.055 : 0.038;
    const tail = hard ? 0.175 : 0.100;
    osc.frequency.setValueAtTime(hard ? 168 : 132, t);
    osc.frequency.exponentialRampToValueAtTime(hard ? 41 : 54, t + drop);
    const g = ctx.createGain();
    g.gain.setValueAtTime(hard ? 0.300 : 0.170, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + tail);
    osc.connect(g); g.connect(drumBus);
    osc.start(t); osc.stop(t + tail + 0.03);
    grainHit(clickChan, t, hard ? 0.055 : 0.032, 0.014, 0.9 + musRand() * 0.35);

    /* SIDECHAIN. A sustained reese and a kick occupy the same octave, so
       without this the low end is a single undifferentiated wall and the kick
       stops being felt. Ducking is what every record in this genre does, and
       it is two parameter writes rather than a compressor on the bus. */
    if (hard && music.duck) {
      music.duck.setTargetAtTime(KICK_DUCK, t, 0.006);
      music.duck.setTargetAtTime(1, t + 0.070, 0.045);
    }
  }

  /* SNARE. Three parts, because a snare is three things and modelling it as
     one noise burst is the clearest tell that a kit was synthesised. The crack
     gets a per-hit bandpass so no two are the same drum; the wires ride the
     fixed hat band and alternate side, which is where the snare's stereo
     shimmer comes from; the membrane is the tuned part underneath. */
  function snareVoice(t, full, side) {
    const amp = full ? 1 : 0.55;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.92 + musRand() * 0.22;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1650 + musRand() * 420;
    f.Q.value = 0.75;
    const g = ctx.createGain();
    const dur = full ? 0.135 : 0.085;
    g.gain.setValueAtTime(0.105 * amp, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(drumBus);
    src.start(t, musGrain(dur + 0.05)); src.stop(t + dur + 0.02);

    grainHit(hatChan[side & 1], t, 0.045 * amp, full ? 0.105 : 0.060,
             0.95 + musRand() * 0.25);

    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(196, t);
    body.frequency.exponentialRampToValueAtTime(148, t + 0.085);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.050 * amp, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + (full ? 0.105 : 0.065));
    body.connect(bg); bg.connect(drumBus);
    body.start(t); body.stop(t + 0.13);
  }

  /* --------------------------------------------------------- the score */

  function scheduleStep(step, t) {
    const bar   = Math.floor(step / HARM_BAR_STEPS) % 4;   // which chord
    const chord = PROGRESSION[bar];
    const b     = step % HARM_BAR_STEPS;                   // 0..31 in the 84 bar
    const d     = Math.floor(step / DRUM_BAR_STEPS) % 8;   // which drum bar
    const h     = step % DRUM_BAR_STEPS;                   // 0..15 in the 168 bar
    const I     = music.intensity;
    const drive = music.drive;
    const sd    = stepDuration();
    /* The shuffle, and the whole of it: this step's offset in seconds. */
    const sw    = sd * swingOf(h);

    /* --- pad: one long chord per HARMONIC bar, always present -----------
       Unchanged in rate, voicing, spread and level. b === 0 is the same
       instant the old beat === 0 was; only the number naming it doubled. */
    if (b === 0) {
      const dur = sd * HARM_BAR_STEPS;
      [chord.root * 2, chord.arp[0], chord.arp[2]].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        osc.detune.value = (i - 1) * 11;   /* wider chorus, tape-wobble feel */
        const flt = ctx.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(420 + I * 240, t);
        /* The pad breathes across the bar instead of sitting on one static
           cutoff. A still filter is most of what makes a synth pad read as a
           placeholder rather than as a part. */
        flt.frequency.exponentialRampToValueAtTime(300 + I * 170, t + dur);
        flt.Q.value = 1.2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.035, t + dur * 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const pp = ctx.createStereoPanner();
        pp.pan.value = (i - 1) * PAD_SPREAD;
        osc.connect(flt); flt.connect(g); g.connect(pp); pp.connect(tunedBus);
        osc.start(t); osc.stop(t + dur + 0.05);
        if (musTap) musTap('pad', t, step);
      });
    }

    /* --- reese: the sustained low end jungle is actually built on --------
       Two detuned sawtooths beating against each other through a resonant
       lowpass, held for the whole harmonic bar. It moves at the CHORD rate,
       so it reinforces the slow layer rather than the fast one, which is
       precisely the half-time relationship stated as a bass part.

       CREATED BEFORE THE KICK BLOCK ON PURPOSE. kickVoice() reads music.duck
       to sidechain, and scheduleStep is called in step order, so writing the
       reference here at b === 0 guarantees every kick in the bar (including
       the one at b === 0 itself) sees this bar's reese and not the last
       one's. Two gain stages, not one: the envelope and the duck would fight
       on a single AudioParam timeline. */
    if (I >= 2 && b === 0) {
      const dur = sd * HARM_BAR_STEPS;
      /* CUTOFF AND LEVEL BOTH SET BY THE STEM MEASUREMENT, not by ear.

         The first version ran this at 210 Hz with Q 4.5 and a level of 0.055,
         and muting the bass bus then moved the whole mix's spectral centroid
         from 1079 Hz to 1679 Hz: essentially the entire darkening this pass
         showed was one sustained voice sitting on the bottom, not a kit that
         had been tastefully tilted. The same voice was 43 percent of mix RMS
         and, being mono, collapsed the stereo width to 0.005.

         A cutoff of 210 Hz is also the wrong sound. What makes a reese a reese
         rather than a sub is the beating between the detuned saws, and that
         beating lives in the harmonics: filtering them off leaves the weight
         and throws away the growl. Opening to 320 Hz, rising toward 740 at
         full drive, puts the second and third harmonics back in the audible
         band, and the level comes down to pay for the energy they add. */
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass'; flt.Q.value = 3.5;
      flt.frequency.setValueAtTime(320 + drive * 420, t);
      flt.frequency.exponentialRampToValueAtTime(240 + drive * 260, t + dur);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.042, t + 0.06);
      env.gain.setValueAtTime(0.042, t + dur * 0.88);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const duck = ctx.createGain();
      duck.gain.value = 1;
      [-14, 13].forEach(cents => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = chord.root;
        osc.detune.value = cents;
        osc.connect(flt);
        osc.start(t); osc.stop(t + dur + 0.05);
      });
      flt.connect(env); env.connect(duck); duck.connect(bassBus);
      music.duck = duck.gain;
      if (musTap) musTap('reese', t, step);
    }

    /* --- bass: root on the pulse ---------------------------------------
       Rate unchanged: b % 8 is the same quarter note the old beat % 4 was. */
    if (I >= 1 && (b % 8 === 0 || (I >= 2 && b === 28))) {
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
      osc.connect(flt); flt.connect(g); g.connect(bassBus);
      osc.start(t); osc.stop(t + 0.36);
      if (musTap) musTap('bass', t, step);
    }

    /* --- the break ------------------------------------------------------ */
    const fig = I >= 1 ? BREAKS[BREAK_ORDER[Math.min(3, I)][d]] : null;
    if (fig) {
      const k = fig.kick[h];
      if (k) {
        kickVoice(t + sw, k === 2);
        if (musTap) musTap(k === 2 ? 'kick' : 'kickChop', t + sw, step);
      }

      /* The backbeats live on steps 4 and 12, which are downbeat positions, so
         swingOf returns zero for them and this lands exactly on the grid. The
         flam on step 13 does lean, which is the point of a flam. */
      const s = fig.snr[h];
      if (s) {
        snareVoice(t + sw, s === 2, d + h);
        if (musTap) musTap(s === 2 ? 'snare' : 'snareFlam', t + sw, step);
      }

      /* Ghosts swing with the hats. They are the reason the break reads as
         chopped, and the reason it reads as human. Present from intensity 1,
         where the two-step gets exactly one per bar: the shuffle has to be
         audible in the tier where the kit arrives, or the arrival reads as a
         drum machine being switched on rather than as a groove starting. */
      if (I >= 1 && fig.gst[h]) {
        grainHit(ghostChan[(d + h) & 1], t + sw, 0.024 + drive * 0.010,
                 0.045, 0.9 + musRand() * 0.3);
        if (musTap) musTap('ghost', t + sw, step);
      }

      /* Hats. The loud eighth-note offbeats play from intensity 2; the quiet
         sixteenth ticks between them wait for drive, so the kit gets busier as
         the wave escalates without a new layer being switched on. */
      if (I >= 2) {
        const amp = HAT[h];
        if (amp > 0 && (amp >= HAT_LOUD || I >= 3 || drive > 0.40)) {
          /* The open hat: one longer decay per two bars, on the pickup. It is
             the lift a break has, and it costs nothing but a number. */
          const open = (h === 15 && (d & 1) === 1 && I >= 2);
          grainHit(hatChan[(d + h) & 1], t + sw, amp,
                   open ? 0.155 : 0.045, 0.85 + musRand() * 0.45,
                   open ? 0.004 : 0.0008);
          if (musTap) musTap(open ? 'hatOpen' : 'hat', t + sw, step);
        }
      }

      /* The turnaround fill: a four-step ghost roll into the top of the loop,
         rising in level and in pitch. Only at full intensity and high drive,
         because a fill every four bars at wave one would be exhausting. */
      if (I >= 3 && drive > 0.5 && d === 7 && h >= 12) {
        const n = h - 12;
        grainHit(ghostChan[n & 1], t + sw, 0.020 + n * 0.011, 0.050,
                 0.95 + n * 0.14);
        if (musTap) musTap('fill', t + sw, step);
      }
    }

    /* --- arpeggio -------------------------------------------------------
       Rate unchanged. `every` doubled with the grid, so step / every is the
       same sequence of indices it was, and the notes land at the same
       instants they did before this pass. */
    if (I >= 1) {
      const every = I >= 3 ? 2 : 4;
      if (b % every === 0) {
        const idx = (step / every) % chord.arp.length | 0;
        const f = chord.arp[idx] * (I >= 3 && b % 16 === 8 ? 2 : 1);
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.045 + I * 0.008, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + sd * 3.2);
        osc.connect(g); g.connect(tunedBus);
        osc.start(t); osc.stop(t + sd * 4);
        if (musTap) musTap('arp', t, step);
      }
    }

    /* --- intensity 3 lead stab ------------------------------------------
       Rate unchanged: b 0 and 20 are the old beats 0 and 10. */
    if (I >= 3 && (b === 0 || b === 20)) {
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
      osc.connect(flt); flt.connect(g); g.connect(tunedBus);
      osc.start(t); osc.stop(t + 0.38);
      if (musTap) musTap('lead', t, step);
    }
  }

  function schedulerTick() {
    if (!music.playing || !ready) return;
    while (music.nextTime < ctx.currentTime + LOOKAHEAD) {
      if (settings.musicEnabled) scheduleStep(music.step, music.nextTime);
      music.nextTime += stepDuration();
      music.step = (music.step + 1) % LOOP_STEPS;
    }
  }

  function startMusic(intensity = 1) {
    if (!ready) return;
    music.intensity = intensity;
    if (music.playing) return;
    music.playing = true;
    music.nextTime = ctx.currentTime + 0.08;
    music.step = 0;
    /* A stale duck reference points at a gain node from the previous run,
       whose bar ended long ago. Harmless but wrong, so it is cleared. */
    music.duck = null;
    clearInterval(music.timer);
    music.timer = setInterval(schedulerTick, SCHEDULE_TICK);
  }

  function stopMusic() {
    music.playing = false;
    music.duck = null;
    clearInterval(music.timer);
    music.timer = null;
  }

  /** Waves 1-4 = calm, 5-11 = driving, 12+ = full intensity. */
  function setIntensity(level) {
    music.intensity = Math.max(0, Math.min(3, level));
  }

  /* THE TEMPO IS NOT SETTABLE, and this does not ignore its caller either.

     game.js:1127 asks for 96 + 2 * wave, which is 98 rising to 126, and that
     call predates the tempo lock recorded at docs/BRAND.md line 76. The two
     have been in direct contradiction: the brand document pins 84 and the game
     has been overriding it on every single wave start.

     Honouring the request literally is now impossible anyway. The kit is
     defined as twice the harmonic tempo, so 126 would put the break at 252
     BPM, which is not drum and bass, and 84 is the value the owner locked.
     But the request is not really for a tempo. It is for ENERGY as the waves
     escalate, and this arrangement has a proper place to spend that which did
     not exist when the call was written: break density. So the request is
     translated rather than dropped, the wave escalation the game intends still
     happens, and the harmonic clock never moves. */
  function setTempo(bpm) {
    music.tempo = TEMPO_LOCK;
    music.drive = Math.max(0, Math.min(1, (bpm - 96) / 30));
    if (musSend) musSend.delayTime.setTargetAtTime(musDelayTime(), ctx.currentTime, 0.08);
  }

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
    get isReady() { return ready; },
    /* MEASUREMENT ONLY, both of these, and named so they are greppable.

       A harness hangs an analyser off `out` during a real battle, which is the
       only way to read true master headroom without ears; headless Chrome runs
       muted, so "it sounded fine" is never available as evidence. setMusicTap
       is the same idea one layer up: it reports the times the scheduler hands
       the audio thread, so the half-time relationship and the swing ratio are
       read out of the engine rather than asserted about it.

       The tap reports the STEP INDEX alongside the time, and that third
       argument is what makes the grid observable instead of inferred. Once
       every offbeat in the kit leans, a swung thirty-second grid and a plain
       sixteenth grid describe literally the same instants, so no amount of
       arithmetic on times alone can separate them: a rig that tried this
       reported the kit at 42 BPM. With the index present, two events of the
       same voice the same distance into their beat carry identical offsets
       whatever the swing rule is, so their spacing over their step difference
       is the grid exactly, and the swing falls out as the residual. Nothing
       about the shuffle has to be assumed in order to measure it.

       Callers still make sounds through play(): neither of these is a licence
       to build nodes elsewhere. */
    setMusicTap,
    get bus() {
      return ready ? { master, sfx: sfxBus, music: musicBus, amb: ambBus,
                       drums: drumBus, bass: bassBus, tuned: tunedBus,
                       out: ceiling, ctx } : null;
    },
    /* The live scheduler state, read-only in practice: a harness needs the
       grid constants to convert step counts into bars without re-deriving
       them, and re-deriving them is how a rig ends up measuring its own
       arithmetic instead of the engine's. */
    get clock() {
      return { tempo: music.tempo, drumTempo: music.tempo * DRUM_MULT,
               intensity: music.intensity, drive: music.drive,
               step: music.step, stepSeconds: stepDuration(),
               swing: SWING, drumBarSteps: DRUM_BAR_STEPS,
               harmBarSteps: HARM_BAR_STEPS, loopSteps: LOOP_STEPS };
    }
  };
})();
