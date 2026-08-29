import { GameSim } from '../src/core/sim.js';
import { TOWERS, TOWER_ORDER } from '../src/core/data.js';
const spots = [[5,0],[5,2],[10,2],[10,4],[15,0],[15,4],[6,3],[11,6],[16,6],[20,9]];
function setup(s){ for (const [c,r] of spots) for (const t of TOWER_ORDER){ if(s.gold>=TOWERS[t].cost){ if(s.placeTower(t,c,r).ok) break; } } return s; }
const a = setup(new GameSim({seed:7}));
const b = setup(new GameSim({seed:7}));
function hash(s){ let h=0; for(const e of s.enemies){ h=(h*31 + Math.round(e.x*1000))>>>0; h=(h*31 + Math.round(e.y*1000))>>>0; h=(h*31 + Math.round(e.hp))>>>0;} return h+':'+s.enemies.length+':'+s.gold+':'+s.kills; }
let div=-1;
for(let i=0;i<2000;i++){ if(!a.waveActive)a.startNextWave(false); if(!b.waveActive)b.startNextWave(false); a.update(1/60); b.update(1/60); a.drainEvents(); b.drainEvents(); if(hash(a)!==hash(b) && div<0){ div=i; console.log('DIVERGE at frame',i,'\n A',hash(a),'\n B',hash(b)); break; } }
if(div<0) console.log('identical for 2000 frames', hash(a));
