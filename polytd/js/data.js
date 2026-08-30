/* ==========================================================================
   POLY PROTOCOL — data.js
   Towers, enemies and the wave script. Uses the parent game's rhythm —
   same banded HP curve, same economy shape — so the demo plays like the
   real thing, with numbers tuned for the poly board.
   ========================================================================== */
'use strict';
(() => {

const ELEM = {
  kinetic:{ name:'KINETIC', col:'#38e8ff', dark:'#0b5d75' },
  frost:{ name:'FROST', col:'#8ab8ff', dark:'#1e3a72' },
  fire:{ name:'FIRE', col:'#ff9b3d', dark:'#7a4210' },
  storm:{ name:'STORM', col:'#c084fc', dark:'#4c1d95' },
  venom:{ name:'VENOM', col:'#a3e635', dark:'#3f5f0b' },
  void:{ name:'VOID', col:'#7c3aed', dark:'#3b0764' },
  radiant:{ name:'RADIANT', col:'#fbbf24', dark:'#8a5a10' }
};

const TOWERS = {
  bolt: {
    id:'bolt', name:'BOLT', elem:'kinetic', cost:115, role:'RAPID SINGLE',
    desc:'Cheap, fast, reliable — every kill refunds part of the reload. The wall that pays for itself.',
    base:{ dmg:7, range:3.3, rate:1.6, pv:15, splash:0 }, tag:'projectile',
    lv:[ {cost:60, dmg:14, rate:1.7, name:'MK II'},
         {cost:125, dmg:24, rate:1.9, range:3.6, name:'MK III'} ],
    mk:{ emitter:'gun', col:'#38e8ff' }
  },
  cryo: {
    id:'cryo', name:'CRYO', elem:'frost', cost:155, role:'AREA SLOW',
    desc:'Chills an area and doubles the window every other gun gets. The multiplier tower.',
    base:{ dmg:5, range:3.0, rate:1.05, pv:11, splash:1.1, slow:0.34, slowDur:1.8 }, tag:'projectile',
    lv:[ {cost:85, dmg:9, slow:0.42, slowDur:2.1, name:'DEEP CHILL'},
         {cost:155, dmg:14, slow:0.52, slowDur:2.4, range:3.4, splash:1.2, name:'PERMAFROST'} ],
    mk:{ emitter:'crystal', col:'#8ab8ff' }
  },
  mortar: {
    id:'mortar', name:'MORTAR', elem:'fire', cost:223, role:'GROUND SPLASH',
    desc:'Arcing shells well past its own reach onto whatever your other guns already hold. Blind to the air.',
    base:{ dmg:18, range:3.9, rate:0.58, pv:9, splash:1.3, groundOnly:true, lob:8 }, tag:'lobbed',
    lv:[ {cost:115, dmg:46, splash:1.4, name:'HEAVY'},
         {cost:210, dmg:76, splash:1.55, range:4.3, rate:0.62, name:'BATTERY'} ],
    mk:{ emitter:'tube', col:'#ff9b3d' }
  },
  arc: {
    id:'arc', name:'ARC', elem:'storm', cost:256, role:'LANE CURRENT',
    desc:'Earthing straight into the road: the discharge runs the lane forward and back through everything standing on it.',
    base:{ dmg:13, range:3.1, rate:1.0, pv:10, run:2.4, runFall:0.8 }, tag:'grounding',
    lv:[ {cost:135, dmg:30, run:3.2, name:'CONDUIT'},
         {cost:245, dmg:48, run:4.0, range:3.4, runFall:0.85, name:'DYNAMO'} ],
    mk:{ emitter:'mast', col:'#c084fc' }
  },
  pyre: {
    id:'pyre', name:'PYRE', elem:'fire', cost:189, role:'CONE BURN',
    desc:'Salvaged tank, no interlock: a cone of flame that burns and, held too long, blows its own tank across the lane.',
    base:{ dmg:12, range:2.3, rate:1.0, pv:10, cone:0.62, burn:9, burnDur:2.2, overheat:4.5, blowDmg:40, blowR:1.6 }, tag:'cone',
    lv:[ {cost:100, dmg:36, burn:15, blowDmg:120, name:'STOKED'},
         {cost:185, dmg:56, burn:23, range:2.6, cone:0.68, blowDmg:210, name:'FURNACE'} ],
    mk:{ emitter:'nozzle', col:'#ff6b4a' }
  },
  toxin: {
    id:'toxin', name:'TOXIN', elem:'venom', cost:209, role:'STACKING POISON',
    desc:'Venom that scales off current health: ferocious on a full-health giant, feeble once it is nearly dead.',
    base:{ dmg:4, range:3.3, rate:1.1, pv:10, splash:1.0, poison:3.5, poisonPct:0.005, poisonDur:4.0, stacks:2 }, tag:'projectile',
    lv:[ {cost:110, dmg:10, poison:5.5, poisonPct:0.008, name:'VIRULENT'},
         {cost:200, dmg:15, poison:8.5, poisonPct:0.012, stacks:4, range:3.6, name:'PANDEMIC'} ],
    mk:{ emitter:'sac', col:'#a3e635' }
  },
  railgun: {
    id:'railgun', name:'RAILGUN', elem:'kinetic', cost:317, role:'LONG-RANGE HITSCAN',
    desc:'Extreme range, instant hit, huge per-shot damage that halves armour. An execution tool.',
    base:{ dmg:38, range:8.0, rate:0.42, pv:7, pierce:0.5, preferStrong:true }, tag:'hitscan',
    lv:[ {cost:170, dmg:120, range:8.6, name:'LONG BORE'},
         {cost:300, dmg:200, rate:0.5, pierce:0.6, name:'MASS DRIVER'} ],
    mk:{ emitter:'rail', col:'#4ade80' }
  },
  nullfield: {
    id:'nullfield', name:'NULLFIELD', elem:'void', cost:275, role:'SLOW FIELD',
    desc:'A rotating gyro of the Vigil: everything near it drags. The lattice pays in stillness.',
    base:{ dmg:5, range:2.8, rate:0.8, pv:9, aura:0.28, auraR:2.6 }, tag:'aura',
    lv:[ {cost:130, dmg:12, aura:0.38, auraR:3.0, name:'SCHELL'},
         {cost:220, dmg:20, aura:0.5, auraR:3.4, name:'CHURCH'} ],
    mk:{ emitter:'gyro', col:'#e2e8f0' }
  }
};

const ENEMIES = {
  crawler: { id:'crawler', name:'CRAWLER', hp:38, speed:1.35, bounty:8, armor:0, kind:'walk', col:'#94a3b8',
    desc:'A neutral machine that belongs to nobody. The record argues about whether it was ours.' },
  sprinter: { id:'sprinter', name:'SPRINTER', hp:26, speed:2.6, bounty:9, armor:0, kind:'walk', col:'#ef4444',
    desc:'Small, fast, loud. The last thing you hear past your front line.' },
  mite: { id:'mite', name:'MITE', hp:12, speed:1.9, bounty:4, armor:0, kind:'walk', col:'#a855f7',
    desc:'A xeno spawnling — slow alone, unbearable in the hundreds.' },
  bulwark: { id:'bulwark', name:'BULWARK', hp:110, speed:0.95, bounty:14, armor:6, kind:'walk', col:'#cbd5e1',
    desc:'A Hive warrior in plated chassis. Kinetic does not care. Magic barely does.' },
  wisp: { id:'wisp', name:'WISP', hp:30, speed:1.8, bounty:8, armor:0, kind:'fly', col:'#38e8ff',
    desc:'A spectral carrier from the Vigil fleet. It ignores ground fire and the lane itself.' },
  vector: { id:'vector', name:'VECTOR', hp:64, speed:1.5, bounty:11, armor:3, kind:'walk', col:'#fbbf24',
    desc:'Federation blade-saint. Her halo is the order that ruled the sky for nine hundred years.' },
  harbinger: { id:'harbinger', name:'HARBINGER', hp:420, speed:0.85, bounty:60, armor:4, kind:'walk', col:'#ef4444',
    boss:1, desc:'Pirate warchief aboard a black freighter. The warning the galaxy never heard.' },
  spawnling: { id:'spawnling', name:'SPAWNLING', hp:34, speed:1.55, bounty:5, armor:0, kind:'walk', col:'#a855f7',
    desc:'Xeno gnawling, born of a carrier wake. Every wave feeds the next.' },
  juggernaut: { id:'juggernaut', name:'JUGGERNAUT', hp:2600, speed:0.5, bounty:400, armor:10, kind:'walk', col:'#e2e8f0',
    boss:2, desc:'The Vigil answer to a fortress: a cathedral that walks. It does not die to one gun.' }
};

function waveHpMul(w){
  if(w <= 1) return 1;
  if(w <= 10) return Math.pow(1.15, w-1);
  if(w <= 20) return Math.pow(1.22, w-10) * Math.pow(1.26, 9);
  return Math.pow(1.4, w-20) * Math.pow(1.22, 10) * Math.pow(1.26, 9);
}
function wavePause(w){ return w === 1 ? 22 : Math.max(7, 15 - (w-1)*0.35); }

const WAVES = [
  { id:'w1',  pause:22, compose:[['crawler', 10]] },
  { id:'w2',  compose:[['crawler', 14], ['sprinter', 3]] },
  { id:'w3',  compose:[['crawler', 10], ['mite', 14]] },
  { id:'w4',  compose:[['crawler', 8], ['sprinter', 8], ['bulwark', 2]] },
  { id:'w5',  compose:[['mite', 30], ['bulwark', 2]] },
  { id:'w6',  compose:[['crawler', 10], ['sprinter', 10], ['wisp', 6]] },
  { id:'w7',  compose:[['bulwark', 5], ['vector', 7], ['sprinter', 6]] },
  { id:'w8',  compose:[['harbinger', 1], ['crawler', 8], ['wisp', 6]], boss:1 },
  { id:'w9',  compose:[['vector', 10], ['bulwark', 4], ['mite', 18]] },
  { id:'w10', compose:[['wisp', 12], ['sprinter', 12], ['crawler', 8]] },
  { id:'w11', compose:[['vector', 8], ['harbinger', 1], ['bulwark', 6], ['wisp', 8]] },
  { id:'w12', compose:[['juggernaut', 1], ['vector', 6], ['wisp', 10], ['crawler', 10]], boss:2 }
];

const MAPS = {
  orrery: {
    id:'orrery', name:'THE ORRERY', sub:'SECTOR 0 — EARTH SYSTEM SHIELD',
    desc:'A reliquary plate hanging in the ringed shadow of the dead world. The Xeno came first; something older comes after.',
    cols:9, rows:7, faction:'#38e8ff',
    path: [ [4,0],[4,1],[4,2],[3,2],[2,2],[2,3],[2,4],[3,4],[4,4],[5,4],[6,4],[6,3],[6,2],[7,2],[8,2],[8,3],[8,4],[7,4],[7,5],[6,5],[5,5],[4,5],[4,6] ],
    portalPos:[0,0, -3.6], corePos:[0,0, 3.35], laneDir:[0,1],
    bonus:{ gold: 1.0 }
  },
  crown: {
    id:'crown', name:'THE CROWN', sub:'SECTOR 3 — PLEIADES REVERSE',
    desc:'A ringed gallery of the Federation, where the lane doubles back on itself three times before the sanctuary.',
    cols:9, rows:7, faction:'#fbbf24',
    path: [ [1,0],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],[7,2],[7,3],[6,3],[5,3],[5,4],[6,4],[7,4],[7,5],[7,6],[6,6],[5,6],[4,6],[3,6],[2,6],[1,6],[1,5],[1,4],[2,4],[3,4],[3,3],[3,2],[2,2],[1,2],[1,3] ],
    portalPos:[-4.75,0,-3.3], corePos:[1.2,0, 0], laneDir:[1,0],
    bonus:{ gold: 1.12 }
  },
  maelstrom: {
    id:'maelstrom', name:'THE MAELSTROM', sub:'SECTOR X — THE HUNGRY CENTER',
    desc:'Twenty seats, one arena, and the thing that pulled every fleet here. The lane spirals the core.',
    cols:9, rows:7, faction:'#ff2fd6',
    path: [ [4,0],[4,1],[4,2],[5,2],[6,2],[6,3],[6,4],[5,4],[4,4],[3,4],[2,4],[2,3],[2,2],[3,2],[3,1],[3,0], [2,0],[2,1],[1,1],[1,2],[1,3],[1,4],[0,4],[0,3],[0,2],[0,1],[0,0],[1,0] ],
    portalPos:[0.5,0,-1.7], corePos:[1.2,0,0], laneDir:[0,1],
    bonus:{ gold: 1.25 }
  }
};

POLY.DATA = { ELEM, TOWERS, ENEMIES, WAVES, MAPS, waveHpMul, wavePause };
})();
