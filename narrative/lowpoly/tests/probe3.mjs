import { GameSim } from '../src/core/sim.js';
import { TOWERS, TOWER_ORDER } from '../src/core/data.js';
const spots = [[5,0],[5,2],[10,2],[10,4],[15,0],[15,4],[6,3],[11,6],[16,6],[20,9]];
function play(s){
  for (const [c,r] of spots) for (const t of TOWER_ORDER){ if(s.gold>=TOWERS[t].cost){ if(s.placeTower(t,c,r).ok) break; } }
  let f=0; while(s.state==='playing' && f<60*60*12){ f++;
    if(!s.waveActive)s.startNextWave(false);
    s.update(1/60);
    if(f%60===0) for(const t of s.towers){ if(s.gold>200 && t.level<3) s.upgradeTower(t.id); }
    s.drainEvents();
  }
  return s;
}
const a = play(new GameSim({seed:7}));
const b = play(new GameSim({seed:7}));
console.log('A kills',a.kills,'score',a.score,'wave',a.waveIndex+1,'state',a.state);
console.log('B kills',b.kills,'score',b.score,'wave',b.waveIndex+1,'state',b.state);
console.log('MATCH', a.kills===b.kills && a.score===b.score && a.waveIndex===b.waveIndex);
