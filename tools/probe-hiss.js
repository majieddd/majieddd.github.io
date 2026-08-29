/* IS THERE BROADBAND NOISE UNDER SILENCE, AND WHERE DOES IT COME FROM?
 *
 * The owner: "there's a weird white noise in the background of audio playing."
 *
 * js/audio.js builds an ambience bed at init (buildAmbience): a lowpassed sub
 * rumble plus two wide bandpass noise voices, all looping forever from the
 * shared white-noise buffer. Its own comment says the band gain was set by
 * measurement so it would sit about 22 dB under the intensity-1 music and read
 * "as a room and not a layer".
 *
 * That measurement was taken against MUSIC. The bed starts at init and never
 * stops, so it also plays on the title screen, between waves, and any time the
 * mix is otherwise quiet, where there is nothing for it to sit under. This
 * measures the mix with nothing else playing and then A/B tests the bed.
 *
 * Runs under tools/headless.js, which already passes --mute-audio (silences
 * the speakers, not the graph) and --autoplay-policy=no-user-gesture-required
 * so the context actually runs and signal can be read.
 */
(async function hiss() {
  const C = [];
  const ok = (id, cond, detail) =>
    C.push({ id: id, verdict: cond ? 'PASS' : 'FAIL', pass: !!cond, detail: String(detail).slice(0, 260) });
  const info = (id, detail) =>
    C.push({ id: id, verdict: 'INFO', pass: true, detail: String(detail).slice(0, 260) });

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  Sound.resume();
  await sleep(400);
  const bus = Sound.bus;
  if (!bus || !bus.ctx) {
    ok('A0 the audio graph is running', false, 'Sound.bus is null, the context never came up');
    return { pass: 0, fail: 1, info: 0, checks: C };
  }
  const ctx = bus.ctx;
  info('A0 context', 'state=' + ctx.state + ' sampleRate=' + ctx.sampleRate);

  /* Tap the very end of the chain, which is what a speaker would hear. */
  const an = ctx.createAnalyser();
  an.fftSize = 2048;
  an.smoothingTimeConstant = 0;
  (bus.out || bus.master).connect(an);
  const bins = new Float32Array(an.frequencyBinCount);

  /* Average level across the audible band, in dB. Peak too, because a bed is
     broadband and a stray tone is not, and the two look different. */
  async function measure(label) {
    await sleep(500);
    let best = -Infinity, sum = 0, n = 0;
    /* Three reads, keep the loudest, so a single quiet frame cannot report
       silence over a signal that is genuinely there. */
    for (let pass = 0; pass < 3; pass++) {
      an.getFloatFrequencyData(bins);
      let s = 0, c = 0, pk = -Infinity;
      for (let i = 2; i < bins.length; i++) {
        const hz = i * ctx.sampleRate / 2 / bins.length;
        if (hz < 40 || hz > 16000) continue;
        const v = isFinite(bins[i]) ? bins[i] : -140;
        s += v; c++;
        if (v > pk) pk = v;
      }
      if (c && s / c > best) { best = s / c; sum = s; n = c; }
      await sleep(120);
    }
    return { avg: best, label: label };
  }

  /* ---- A1 SILENCE MEANS SILENT ----------------------------------------
     The guard this leaves behind. An always-on voice is the easiest thing in
     an audio engine to add and the hardest to notice: it never triggers, it
     never errors, it just sits under everything forever, and the person who
     hears it is the player. With the scheduler stopped the mix must be
     digitally silent, and anything that hums under it fails here.

     -120 dBFS is the bar rather than exactly -140, because an analyser on a
     running graph reports a floor rather than a true zero and pinning the
     check to the float minimum would make it brittle without making it
     stricter. The bed this was written for measured -110. */
  if (Sound.stopMusic) Sound.stopMusic();
  await sleep(500);
  const idle = await measure('idle');
  ok('A1 nothing plays when nothing is playing',
     idle.avg <= -120,
     'idle mix ' + idle.avg.toFixed(1) + ' dBFS averaged across 40Hz to 16kHz ' +
     '(the removed room-tone bed measured -110 here, and was all of it)');

  /* ---- A2 and a cue still makes sound ---------------------------------
     Silence is trivially achievable by breaking the engine, so the negative
     above is worthless without this beside it. */
  /* SAMPLED WHILE IT IS PLAYING. measure() leads in with 500ms and a click is
     about 50ms long, so the first cut sampled well after the cue had ended and
     reported it QUIETER than silence. Retrigger across a short window and keep
     the loudest frame, which is what "did that make a sound" actually means. */
  let cueAvg = -Infinity;
  for (let i = 0; i < 12; i++) {
    Sound.play('click');
    an.getFloatFrequencyData(bins);
    let sum = 0, n = 0;
    for (let k = 2; k < bins.length; k++) {
      const hz = k * ctx.sampleRate / 2 / bins.length;
      if (hz < 40 || hz > 16000) continue;
      sum += (isFinite(bins[k]) ? bins[k] : -140); n++;
    }
    if (n && sum / n > cueAvg) cueAvg = sum / n;
    await sleep(40);
  }
  const cue = { avg: cueAvg };
  ok('A2 a cue still makes sound, so the silence above is not a dead engine',
     cue.avg > idle.avg + 6,
     'one cue read ' + cue.avg.toFixed(1) + ' dBFS against an idle ' +
     idle.avg.toFixed(1) + ', a rise of ' + (cue.avg - idle.avg).toFixed(1) + ' dB');

  const out = { pass: C.filter(c => c.verdict === 'PASS').length,
                fail: C.filter(c => c.verdict === 'FAIL').length,
                info: C.filter(c => c.verdict === 'INFO').length, checks: C };
  window.__SWEEP = out;
  return out;
})()
