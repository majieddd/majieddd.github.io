/* GAMEPLAY CAPTURE. Generates a steps file for tools/headless.js that records
   the real game playing itself, then prints the ffmpeg line that turns the
   frames into video. Zero dependencies beyond the installed ffmpeg.

   Usage:
     node tools/capture.js [map] [seed] [frames] [fps] > /tmp/steps_cap.js
     python -m http.server 8471 --bind 127.0.0.1            # terminal 1
     node tools/headless.js http://127.0.0.1:8471/index.html <outdir> /tmp/steps_cap.js
     ffmpeg -y -framerate <fps> -i <outdir>/f%04d.png -c:v libx264 \
            -pix_fmt yuv420p -crf 20 -movflags +faststart out.mp4

   HOW IT STAYS DETERMINISTIC: the sim advances by explicit Game.step(1/30)
   calls between screenshots, never by wall clock, so the same seed yields the
   same battle and the same frames. The player seat drives itself with the
   same Object.create(AI) rig owner-sweep uses, so both sides actually fight.

   MEASURED ON FIRST USE (Session 29): 150 frames at 1280x720 captured in one
   headless pass, encoded to a 10.0s 902KB h264 at crf 20. The first attempt
   produced footage blocked by the NEW CONTACT dossier modal, which is why the
   setup pre-marks every enemy as seen: a capture is not a first playthrough.

   Frames are pixel-shots of whatever is on screen, side panels included. For
   clean trailer footage keep the UI quiet: do not open detail panels in extra
   eval steps, and capture at a resolution whose rail layout you have seen. */
'use strict';
const [, , map = 'spine', seed = '4242', frames = '150', fps = '15'] = process.argv;
const N = Math.max(1, Math.min(2000, parseInt(frames, 10) || 150));
const F = Math.max(1, Math.min(60, parseInt(fps, 10) || 15));
/* sim seconds per output frame, from the requested fps against the 30Hz step */
const stepsPerFrame = Math.max(1, Math.round(30 / F));

const steps = [];
steps.push({ size: [1280, 720] });
steps.push({ wait: 2500 });
steps.push({
  eval: `(() => {
  const p = Meta.load();
  /* a capture is not a first playthrough: no dossier modal may interrupt */
  p.seenEnemies = Object.keys(ENEMY_TYPES);
  Meta.save();
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById('screen-game').classList.remove('hidden');
  Game.start({ skirmish: true, map: '${map}', difficulty: 'contested', seed: ${parseInt(seed, 10) || 4242},
               commander: COMMANDERS[0].id, faction: 'human',
               loadout: ['bolt','cryo','mortar','flak'] });
  globalThis.__brain = Object.create(AI);
  __brain.init(Game.sides[0], Game.difficulty);
  /* fast-forward the opening build phase so frame one already has action */
  for (let i = 0; i < 300; i++) { __brain.update(1/30, Game); Game.step(1/30); }
  Game.draw && Game.draw();
  return { state: Game.state, wave: Game.wave, towers: Game.sides[0].towers.length };
})()`,
});
for (let f = 0; f < N; f++) {
  steps.push({
    eval: '(()=>{ for(let i=0;i<' + stepsPerFrame + ';i++){ __brain.update(1/30, Game); Game.step(1/30);} Game.draw&&Game.draw(); return 1; })()',
  });
  steps.push({ shot: 'f' + String(f).padStart(4, '0') });
}
process.stdout.write('module.exports = ' + JSON.stringify(steps) + ';\n');
process.stderr.write('capture plan: ' + N + ' frames, ' + F + 'fps output, ' +
  (N / F).toFixed(1) + 's of video, ' + (N * stepsPerFrame / 30).toFixed(1) + 's of game time on ' + map + ' seed ' + seed + '\n');
process.stderr.write('encode with: ffmpeg -y -framerate ' + F +
  ' -i <outdir>/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart out.mp4\n');
