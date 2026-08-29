import { GameSim } from '../src/core/sim.js';
const a = new GameSim({seed:7});
const b = new GameSim({seed:7});
function hash(s){ let h=0; for(const e of s.enemies){ h=(h*131 + Math.round(e.x*1000))>>>0; h=(h*131 + Math.round(e.y*1000))>>>0;} return h+':'+s.enemies.length+':'+s.gold+':'+s.kills+':'+s.waveIndex; }
let div=-1;
let i=0;
while(a.state==='playing' && b.state==='playing' && i<60*60*12){
  i++;
  if(!a.waveActive)a.startNextWave(false);
  if(!b.waveActive)b.startNextWave(false);
  a.update(1/60); b.update(1/60); a.drainEvents(); b.drainEvents();
  if(hash(a)!==hash(b)){ div=i; break; }
}
console.log('diverge frame=',div,'A',hash(a),'B',hash(b),'waveA',a.waveIndex,'waveB',b.waveIndex,'enA',a.enemies.length,'enB',b.enemies.length,'goldA',a.gold,'goldB',b.gold);
