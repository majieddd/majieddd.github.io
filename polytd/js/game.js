/* ==========================================================================
   POLY PROTOCOL — game.js
   Simulation: board, enemies, towers, projectiles, marks & reactions,
   waves and economy. Deterministic seeded RNG so the demo is reproducible.
   ========================================================================== */
'use strict';
(() => {
const D = POLY.DATA, P = POLY.PAINT;
const EL = POLY.DATA.ELEM;
const M4 = POLY.M4, V3 = POLY.V3;
const C = P.C;

/* seeded rng (mulberry32) */
function rng(seed){
  let a = seed>>>0;
  return function(){
    a|=0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a>>>15, 1|a);
    t = t + Math.imul(t ^ t>>>7, 61|t) ^ t;
    return ((t ^ t>>>14)>>>0)/4294967296;
  };
}

/* reactions table (element mark pairs — the parent game's signature) */
const REACTIONS = {
  'fire|frost': { name:'THERMAL SHOCK', col:'#ffd089', blast:0.9, mul:6, dot:0, stun:0.5 },
  'fire|storm': { name:'PLASMA', col:'#c084fc', blast:1.3, mul:7, dot:18, dotDur:2.0 },
  'fire|venom': { name:'IMMOLATE', col:'#ff8a5c', blast:0.4, mul:3, dot:30, dotDur:3.0 },
  'frost|storm': { name:'SUPERCONDUCT', col:'#8ab8ff', blast:1.0, mul:5, arc:1.4 },
  'frost|venom': { name:'PARALYSIS', col:'#b9e6a0', blast:0.2, mul:2, stun:1.6 },
  'storm|venom': { name:'CATALYSE', col:'#c9f06b', blast:1.2, mul:6, dot:10, dotDur:2.4 },
  'void|fire':  { name:'COLLAPSE', col:'#7c3aed', blast:1.5, mul:8, shred:8 },
  'void|frost': { name:'ENTROPY', col:'#a78bfa', blast:0.8, mul:6, dot:14, dotDur:2.6, slow:0.3, slowDur:2.6 },
  'void|storm': { name:'RUPTURE', col:'#e879f9', blast:1.6, mul:9, stun:0.8 },
  'void|venom': { name:'BLIGHT', col:'#86efac', blast:0.6, mul:5, dot:40, dotDur:3.2 }
};
function reactKey(a,b){ return (a<b ? a+'|'+b : b+'|'+a); }

/* one battle */
class Battle {
  constructor(env, mapId, opts){
    this.env = env;                       // {eng, audio, gl}
    this.mapId = mapId;
    this.opts = opts || {};
    this.rng = rng((opts?.seed ?? 90210) >>> 0);
    this.map = D.MAPS[mapId];
    this.time=0; this.state='build';      // build|wave|won|lost
    this.speed=1; this.paused=false;
    this.gold=opts?.gold ?? 220; this.lives=opts?.lives ?? 20;
    this.waveNo=0; this.nextNo=1;
    this.wait=(this.map ? D.wavePause(1) : 20);
    this.enemies=[]; this.towers=[]; this.shots=[]; this.beams=[];
    this.particles=this.env.eng.pool;
    this.kills=0; this.leaks=0; this.dmgDealt=0;
    this.spawnQ=[]; this.spawnT=0; this.spawnGap=0;
    this.marksFx=[];
    this.floaters=[];
    this.seed=opts?.seed ?? 90210;
    this._build();
  }
  /* ── board construction ─────────────────────────────────────────── */
  _build(){
    const map=this.map;
    const eng=this.env.eng;
    this.cells=[];
    const pathSet=new Set(map.path.map(p=>p[1]*map.cols+p[0]));
    this.pathCells=map.path;
    this.board=POLY.buildBoard(eng, map, this.cells, pathSet, null);
    // path polyline: world positions
    this.path=[];
    for(const [c,r] of map.path){
      const cl=this.cells.find(cl=>cl.c===c && cl.r===r);
      if(cl) this.path.push([cl.x, 0.4, cl.z]);
    }
    // fix core/portal positions to grid-derived coords
    const B=this.board.B;
    this.portalPos=this.path[0];
    const last=this.path[this.path.length-1];
    this.corePos=[last[0], 0, last[2]];
    // rebuild core/portal at true positions: dispose and rebuild via fresh meshes
    // (buildBoard already made them at approx pos; nudge by re-adding at final coords)
    // 1. portal arch at path[0] minus outward dir
    const p0=this.path[0], p1=this.path[1];
    const dir0=V3.norm(V3.sub(p0,p1));
    this.gatePos=V3.add([p0[0],0,p0[2]], V3.scale(dir0,1.4));
    this.corePos=[last[0],0,last[2]];
    // core is a separate mesh so HP bar can pulse; enemies stop here.
    // build lane glow strip along path
    const laneCol=[0.12,0.75,1.0];
    const lg=new POLY.Geo();
    for(let i=0;i<this.path.length-1;i++){
      const a=this.path[i], b=this.path[i+1];
      const d=V3.norm(V3.sub(b,a));
      const len=V3.len(V3.sub(b,a));
      const n=[-d[2],0,d[0]];
      const w=0.09;
      lg.quad([a[0]+n[0]*w,0.26,a[2]+n[2]*w],[b[0]+n[0]*w,0.26,b[2]+n[2]*w],
        [b[0]-n[0]*w,0.26,b[2]-n[2]*w],[a[0]-n[0]*w,0.26,a[2]-n[2]*w],
        [0.05,0.2,0.3],[0,1,0]);
    }
    this._clearPlate='lane';
    // lane strip: warm champagne guide, painted thin — no glow, subtle
    this.env.eng.plates.push({mesh:lg.build(eng.gl), model:M4.ident(), emis:0.0, glow:0.0, alpha:1});
    // ambience removed for readability — board stays the hero
    this.orbitals=[];
    // camera
    this.env.cam.yaw=0; this.env.cam.pitch=0.71; this.env.cam.dist=15.2;
    this.env.cam.target=[0,1.05,0.75];
    this.env.eng.setCam([0,11.6,13.8],[0,1.05,0.75]);
    this.env.camBase=[0,11.6,13.8];
    this.env.camTgt=[0,1.05,0.75];
  }
  _makeOrbitals(){
    const eng=this.env.eng;
    const items=[];
    for(let i=0;i<5;i++){
      const a=i/5*Math.PI*2;
      const r=11.5+i*1.4;
      const g=new POLY.Geo();
      g.sph(0,0,0, 0.10, 4,5, [0.16,0.18,0.32], [0.3,0.38,0.62], [0.04,0.06,0.12]);
      const m=eng.add(g, undefined, {emis:0.12, glow:0.3, name:'orbital'+i});
      items.push({mesh:m, a, r, h:2.6+i*1.3, speed:0.05+i*0.012});
    }
    return items;
  }
  /* ── helpers ────────────────────────────────────────────────────── */
  tileAt(c,r){ return this.cells.find(cl=>cl.c===c&&cl.r===r); }
  upgradeLevel(t){ return t.lv ?? 0; }
  tierStat(t, key){
    const def=D.TOWERS[t.id];
    let v = def.base[key];
    for(let i=0;i<t.lv;i++) v = def.lv[i][key] ?? v;
    return v;
  }
  costOf(t){
    const def=D.TOWERS[t.id];
    if(t.lv===0) return def.cost;
    return def.lv[t.lv-1].cost;
  }
  sellValue(t){ return Math.round(this.costSoFar(t)*0.7); }
  costSoFar(t){
    const def=D.TOWERS[t.id];
    let c=def.cost;
    for(let i=0;i<t.lv;i++) c+=def.lv[i].cost;
    return c;
  }
  /* ── placement ──────────────────────────────────────────────────── */
  canPlace(cell){
    return cell && !cell.path && !cell.tower;
  }
  place(tid, cell, tierLv=0){
    const def=D.TOWERS[tid];
    const cost=def.cost;
    if(!this.canPlace(cell)) return null;
    if(this.gold < cost){ this.env.ui.toast('Not enough gold','warn'); return null; }
    this.gold -= cost;
    const rig = POLY.makeTowerRig(this.env.eng, tid);
    const t={ id:tid, cell, def, rig, lv:0, x:cell.x, z:cell.z, y:0.62,
      cd:0, aim:[1,0,0], recoil:0, charge:0, heat:0, target:null,
      xp:0, mode:0 };
    t.stats=this._recalcStats(t);
    cell.tower=t;
    this.towers.push(t);
    this.env.audio?.sfx('place');
    this.env.ui?.onPlace(t);
    this._fxPlace(t);
    return t;
  }
  _recalcStats(t){
    const s={};
    for(const k of Object.keys(t.def.base)) s[k]=this.tierStat(t,k);
    return s;
  }
  upgrade(t){
    if(!t || t.lv>=2) return false;
    const cost=t.def.lv[t.lv].cost;
    if(this.gold<cost){ this.env.ui?.toast('Not enough gold','warn'); return false; }
    this.gold-=cost; t.lv++;
    t.stats=this._recalcStats(t);
    this.env.audio?.sfx('upgrade');
    this.env.ui?.onUpgrade(t);
    this._fxUpgrade(t);
    return true;
  }
  sell(t){
    if(!t) return;
    const v=this.sellValue(t);
    this.gold+=v;
    this.env.audio?.sfx('sell');
    const cell=t.cell; cell.tower=null;
    this.towers=this.towers.filter(x=>x!==t);
    this.env.ui?.onSell(t, v);
  }

  /* ── waves ──────────────────────────────────────────────────────── */
  beginNext(){
    if(this.state!=='build') return;
    const w=D.WAVES[this.nextNo-1];
    if(!w){ this.state='win'; this.env.ui?.onEnd(true, this); this.env.audio?.sfx('victory'); return; }
    this.state='wave';
    this.waveNo++;
    this._composeWave(w);
    this.env.audio?.sfx('wave');
    this.env.ui?.onWaveStart(this.waveNo, this.waveNo>=D.WAVES.length);
  }
  _composeWave(w){
    this.spawnQ=[];
    const mul=D.waveHpMul(this.waveNo);
    const bossIds={1:'harbinger',2:'juggernaut'};
    for(const [id,n] of w.compose){
      const isBoss= bossIds[w.boss]===id;
      const gap=(isBoss?5.5 : 0.55+this.rng()*0.55) * (isBoss?1: w.boss?1.25:1);
      for(let i=0;i<n;i++){
        this.spawnQ.push({id, gap, hpMul:mul, isBoss});
      }
    }
    // keep bosses last
    this.spawnQ.sort((a,b)=>(b.isBoss?1:0)-(a.isBoss?1:0));
    this.spawnT=0;
    this._initialGap=w.boss?3.2:1.1;
  }
  alive(){ return this.enemies.length>0 || this.spawnQ.length>0; }
  rush(){
    if(this.state==='build' && this.nextNo<=D.WAVES.length){ this.wait=0; }
  }

  /* ── core loop ──────────────────────────────────────────────────── */
  tick(dt){
    if(this.paused) return;
    this.time+=dt;
    if(this.state==='build'){
      this.wait-=dt;
      if(this.wait<=0) this.beginNext();
    }
    if(this.state==='wave'){
      this._spawn(dt);
    }
    this._waveEndCheck();
    this._updateEnemies(dt);
    this._updateTowers(dt);
    this._updateShots(dt);
    this._updateStatuses(dt);
    this._updateFx(dt);
    this._updateAbilities(dt);
    this._present(dt);
  }
  _spawn(dt){
    if(this.spawnQ.length===0) return;
    if(this._initialGap>0){ this._initialGap-=dt; return; }
    const first=this.spawnQ[0];
    this.spawnT-=dt;
    if(this.spawnT<=0){
      this.spawnQ.shift();
      const gapN=this.spawnQ.length?this.spawnQ[0].gap:0.5; this.spawnT=gapN;
      this._spawnEnemy(first.id, first.hpMul, first.boss);
    }
  }
  _spawnEnemy(id, hpMul, boss){
    const def=D.ENEMIES[id];
    // Blender-skinned model when available; procedural fallback otherwise
    let m=null, skin=null;
    const app=this.env;
    if(app.skinMeshes && app.skinMeshes[id]){
      skin=new POLY.Skin.SkinUnit(app.skinMeshes[id]);
      skin.setClip('run');
      app.eng.addSkin(skin);
    } else {
      m=POLY.buildEnemyModel(this.env.eng, id);
    }
    const e={
      id, def, hp:def.hp*hpMul, maxHp:def.hp*hpMul, pos:[...this.path[0]],
      pathT:0, speed:def.speed, armor:def.armor, kind:def.kind,
      rig:m?m.rig:null, skin, radius:m?m.radius:0.4, flyY:m?m.flyY??0:0, boss:!!def.boss,
      slowT:0, slowP:0, burn:0, burnT:0, burnCol:[1,0.6,0.2],
      poison:0, poisonT:0, marks:{}, markSeq:[],
      stunT:0, spawnT:0.7, dead:false, leak:false,
      hpBar:{mesh:null}, soulT:0, bobb:this.rng()*7
    };
    e.x=e.pos[0]; e.z=e.pos[2];
    // hover ring mark mesh
    e.markMesh={};
    this.enemies.push(e);
    this.env.audio?.sfx('acquire');
  }
  _waveEndCheck(){
    if(this.state!=='wave') return;
    if(this.alive()) return;
    // wave cleared
    const w=D.WAVES[this.waveNo-1];
    const bonus=24+this.waveNo*3;
    this.gold+=bonus;
    this.env.ui?.toast('WAVE '+this.waveNo+' CLEARED <b>+'+bonus+'</b>','good',2.2);
    if(this.waveNo>=D.WAVES.length){
      this.state='won';
      this.env.audio?.sfx('victory');
      this.env.ui?.onEnd(true, this);
      return;
    }
    this.state='build';
    this.nextNo=this.waveNo+1;
    this.wait=D.wavePause(this.nextNo);
    this.env.ui?.onBuildPause(this.wait);
  }

  /* ── enemies ────────────────────────────────────────────────────── */
  _enemyDist(e){
    let d=0;
    for(let i=0;i<e.pathT;i++) d+=V3.len(V3.sub(this.path[i+1],this.path[i]));
    const k=e.pathT;
    const seg=V3.len(V3.sub(this.path[k+1],this.path[k]));
    return d+seg*e.prog;
  }
  _updateEnemies(dt){
    for(let i=this.enemies.length-1;i>=0;i--){
      const e=this.enemies[i];
      if(e.dying){ if(e.skin){ e.skin.update(dt); }
        continue; }
      if(e.spawnT>0){ e.spawnT-=dt;
        e.spawnScale=1-Math.max(0,e.spawnT)/0.7; continue; }
      // statuses
      let speed=e.speed;
      if(e.slowT>0) speed*= (1-e.slowP);
      if(e.stunT>0){ e.stunT-=dt; speed=0; }
      if(e.armor<0)e.armor=0;
      // move along path
      let move=speed*dt*0.72;
      while(move>0 && e.pathT<this.path.length-1){
        const a=this.path[e.pathT], b=this.path[e.pathT+1];
        const seg=V3.len(V3.sub(b,a));
        const remain=seg*(1-(e.prog??0));
        if(move<remain){ e.prog=(e.prog??0)+move/seg; move=0; }
        else { move-=remain; e.pathT++; e.prog=0; }
      }
      if(e.pathT>=this.path.length-1){
        // reached the core: leak
        this._leak(e);
        continue;
      }
      const a=this.path[e.pathT], b=this.path[e.pathT+1];
      const d=V3.norm(V3.sub(b,a));
      e.prog=(e.prog??0)+0;
      const y=e.kind==='fly' ? 0.9+e.flyY : 0.42;
      e.pos=[a[0]+(b[0]-a[0])*(e.prog), y, a[2]+(b[2]-a[2])*(e.prog)];
      e.dir=d;
      e.bobb+=dt*e.speed*4;
      // lean/rotate visuals
      const yaw=Math.atan2(d[0],d[2]);
      e.yaw=Math.atan2(d[0],d[2]);
      if(e.skin){
        e.skin.setClip(e.stunT>0?'attack':'run');
        e.skin.update(dt);
        // face along path: +X bone-forward → yaw around Y. M4 rotation: R_y(yaw).
        // unit model ~1.7u tall; scale to read clearly (min 0.6), feet to ground
        const sc=0.60*(e.radius/0.42);
        e.skin.model=POLY.M4.mul(POLY.M4.trans(e.pos[0], e.pos[1]-0.04, e.pos[2]),
          POLY.M4.mul(POLY.M4.trs(0,0,0, 0, yaw+Math.PI/2, 0, sc,sc,sc),
            POLY.M4.trans(0,-0.85,0)));
        e.skin.shadowM=POLY.M4.mul(POLY.M4.trans(e.pos[0], 0.022, e.pos[2]),
          POLY.M4.trs(0,0,0, 0, 0, 0, sc*1.4, 1, sc*1.25));
      } else {
        this._poseEnemy(e, dt);
      }
    }
  }
  _leak(e){
    this.env.eng.gl && this._fxLeak(e);
    this.leaks++; this.lives-=1;
    this.env.audio?.sfx('leak');
    this.env.ui?.onLeak(this.lives);
    // remove enemy & its meshes
    this._removeEnemy(e);
    if(this.lives<=0){
      this.state='lost';
      this.env.audio?.sfx('defeat');
      this.env.ui?.onEnd(false, this);
    }
  }
  _removeEnemy(e){
    const i=this.enemies.indexOf(e);
    if(i>=0) this.enemies.splice(i,1);
    if(e.skin){
      const arr=this.env.eng.skinUnits||[];
      const k=arr.indexOf(e.skin);
      if(k>=0) arr.splice(k,1);
    }
    // mark plates dead: set model scale 0 via hidden flag
    e.hidden=true;
    const plates=this.env.eng.plates;
    for(const p of e.plates||[]) { p.model=M4.scale(0.001); }
    e.dead=true;
  }
  _poseEnemy(e, dt){
    const rig=e.rig; if(!rig) return;
    const scale=e.spawnScale??1;
    const rot=e.yaw??0;
    const t=this.time;
    if(!e._plates){
      e._plates={};
      for(const [pn, mesh] of Object.entries(rig.parts)){
        // locate plate once
        const idx=this.env.eng.plates.findIndex(pl=>pl.mesh===mesh);
        e._plates[pn]=idx>=0?this.env.eng.plates[idx]:null;
      }
    }
    const bob=(e.kind==='fly'?Math.sin(t*2.4+e.bobb)*0.12:Math.abs(Math.sin(t*(e.speed*1.9)+e.bobb))*0.06);
    const base=M4.mul(M4.trans(e.pos[0],(e.pos[1]||0.4)+bob,e.pos[2]),
      M4.mul(M4.trs(0,0,0, 0, rot, Math.sin(t*4+e.bobb)*0.04), M4.scale(scale)));
    for(const pn in e._plates){
      const plate=e._plates[pn];
      if(plate){ plate.model=base; }
    }
    this._hpBar(e);
  }
  _hpBar(e){
    if(!this.env.eng) return;
    const frac=Math.max(0,Math.min(1,e.hp/e.maxHp));
    if(!e._hpPlates){
      const bg=new POLY.Geo(); bg.box(0,0,0, 1,1,1, [0.35,0.45,0.6],[0.35,0.45,0.6]);
      const fg=new POLY.Geo(); fg.box(0,0,0, 1,1,1, [0.75,1.0,0.85],[0.75,1.0,0.85]);
      this.env.eng.add(bg, undefined, {emis:0.25, glow:0});
      this.env.eng.add(fg, undefined, {emis:0.35, glow:0});
      e._hpPlates={ bg: this.env.eng.plates[this.env.eng.plates.length-2],
                   fg: this.env.eng.plates[this.env.eng.plates.length-1] };
    }
    const h=(e.kind==='fly'?1.5:1.05)*Math.max(0.72,e.radius)+0.35;
    const w=Math.max(0.5,e.radius*2.1);
    const yaw=e.yaw??0;
    const col=frac>0.5?[0.45,0.95,0.65]:frac>0.25?[1,0.8,0.3]:[1,0.35,0.4];
    const mB=M4.mul(M4.trans(e.pos[0],(e.pos[1]||0.4)+h,e.pos[2]),
      M4.mul(M4.trs(0,0,0,0,yaw,0), M4.scale(w+0.06,0.07,0.02)));
    const mF=M4.mul(M4.trans(e.pos[0],(e.pos[1]||0.4)+h,e.pos[2]),
      M4.mul(M4.trs(0,0,0,0,yaw,0),
        M4.mul(M4.scale(Math.max(0.01,frac)*w,0.05,0.025),
          M4.trans(-(1-frac)*0.5*w,0,0))));
    e._hpPlates.bg.model=mB;
    e._hpPlates.fg.model=mF;
    // tint fg by color
    e._hpPlates.fg.emis=1.4; e._hpPlates.fg.overrode=true;
    e._hpPlates.fg.geo = e._hpPlates.fg.geo; // geometry color static; use glow tint hack:
    // set custom color via model-based tint not possible; emulate: choose glow color through emis scale
    e._hpPlates.fg.emis = 1.2 + (frac<0.3?0.8:0);
  }
  _removeEnemyFull(e){ this._removeEnemy(e); if(e.hpMesh){ const i=this.env.eng.plates.findIndex(p=>p.mesh===e.hpMesh); if(i>=0)this.env.eng.plates.splice(i,1);} }
  damage(e, amount, opts){
    opts=opts||{};
    if(e.spawnT>0 || e.dead) return 0;
    let a=amount;
    if(!opts.ignoreArmor && e.armor>0){
      a = amount * (1 - Math.min(0.7, e.armor*0.12*Math.max(0,1-(opts.pierce??0)*1.4)));
      a = Math.max(1, a);
    }
    e.hp-=a;
    e.hitFlash=0.12;
    this.dmgDealt+=a;
    if(e.hp<=0) this._kill(e, opts);
    return a;
  }
  _kill(e, opts){
    if(e.dead) return;
    e.dead=true;
    // bounty
    const b=Math.round(e.def.bounty * (this.map.bonus?.gold ?? 1));
    this.gold+=b;
    this.kills++;
    this.env.audio?.sfx('kill');
    this._fxKill(e);
    if(e.skin){
      // death animation: play clip, remove after it ends
      e.dying=true; e.deadT=0;
      e.skin.setClip('death');
      this.env.ui?.onKill(e, b);
      setTimeout(()=>{ this._removeEnemy(e); }, 900);
    } else {
      this._removeEnemy(e);
      this.env.ui?.onKill(e, b);
    }
  }
  /* ── towers ─────────────────────────────────────────────────────── */
  _inRange(t, e){
    const dx=e.pos[0]-t.x, dz=e.pos[2]-t.z;
    const r=this.stat(t,'range')+ (e.kind==='fly'?0.3:0);
    return dx*dx+dz*dz <= r*r;
  }
  stat(t,k){ return t.stats[k]; }
  _updateTowers(dt){
    for(const t of this.towers){
      const st=t.stats;
      const oc=this.ocT>0 ? 1.55 : 1;          // overclock haste
      t.cd-=dt*oc;
      t.recoil=Math.max(0, t.recoil-dt*5*(oc>1?1.4:1));
      // pick target
      let best=null, bestScore=-1;
      const preferStrong=st.preferStrong;
      for(const e of this.enemies){
        if(e.spawnT>0||e.dead||e.leak) continue;
        if(st.groundOnly && e.kind==='fly') continue;
        if(!this._inRange(t,e)) continue;
        const d=this._enemyDist(e);
        let score = preferStrong ? e.hp : -d;
        if(t.target===e) score+=10;
        if(score>bestScore){ bestScore=score; best=e; }
      }
      t.target=best;
      if(best){
        const v=V3.norm(V3.sub([best.pos[0],best.pos[1],best.pos[2]],[t.x,t.y,t.z]));
        t.aim=v;
        // aim lerp
        t.aimT=(t.aimT??0)+dt;
        if(t.cd<=0) this._fire(t, best, st);
      } else {
        t.aimT=0;
      }
      // special passives
      if(t.id==='nullfield'){
        // aura: slow all in auraR
        for(const e of this.enemies){
          if(e.dead||e.kind==='fly') continue;
          const dx=e.pos[0]-t.x, dz=e.pos[2]-t.z;
          if(dx*dx+dz*dz <= (st.auraR??2.6)**2){
            e.slowT=0.3; e.slowP=Math.max(e.slowP, st.aura);
            e.auraSlow=true;
          }
        }
      }
      if(t.id==='pyre'){
        // cone: continuous
        t.heat=(t.heat??0)+dt;
        for(const e of this.enemies){
          if(e.dead||e.spawnT>0) continue;
          if(st.groundOnly && e.kind==='fly') continue;
          const dx=e.pos[0]-t.x, dz=e.pos[2]-t.z;
          const dist=Math.hypot(dx,dz);
          if(dist>st.range) continue;
          const ang=Math.acos((dx*t.aim[0]+dz*t.aim[2])/(dist||1));
          if(ang>st.cone) continue;
          this.damage(e, st.dmg*dt, {});
          this._applyMark(e, 'fire', t);
          if(st.burn) this._applyBurn(e, st.burn, st.burnDur);
          this._fxBurn(e, dt);
        }
        if((t.heat??0)>st.overheat){
          // blowout
          t.heat=0;
          this._blowout(t, st);
        }
      }
      if(t.id==='arc'){
        // already handled in _fire
      }
      // xp: none (mastery is a parent-game feature; demo keeps it lean)
      // pose the rig at world position
      t.world = M4.trans(t.x, 0.62, t.z);
      t.rig.apply(this.time, t);
      if(t.rig.basePlate) t.rig.basePlate.model = M4.trans(t.x, 0, t.z);
      if(t.rig.basePlate2) t.rig.basePlate2.model = M4.mul(M4.trans(t.x, 0, t.z), t.rig.basePlate2.base);
    }
  }
  _fire(t, e, st){
    const d=t.def;
    const kind=d.tag;
    t.cd=1/st.rate;
    t.recoil=1;
    const from=[t.x, (t.id==='mortar'?1.5:1.15), t.z];
    switch(kind){
      case 'projectile': {
        const col=P.hex(EL[d.elem].col);
        this.shots.push({x:from[0],y:from[1],z:from[2], mode:'straight',
          tx:e.pos[0],ty:e.pos[1],tz:e.pos[2], target:e, dmg:st.dmg, speed:16,
          pierce:0, splash:st.splash||0, slow:st.slow, slowDur:st.slowDur,
          elem:d.elem, poison:st.poison, poisonPct:st.poisonPct, poisonDur:st.poisonDur,
          stacks:st.stacks, col, trail:0.14, life:2.2});
        this.env.audio?.sfx(d.id==='bolt'?'fire_bolt':('fire_'+d.id));
        this._fxMuzzle(from, col);
        break;
      }
      case 'lobbed': {
        const col=P.hex(EL[d.elem].col);
        this.shots.push({x:from[0],y:from[1],z:from[2], mode:'lobbed',
          tx:e.pos[0],ty:e.pos[2], target:e, dmg:st.dmg, t:0, dur:1.05,
          splash:st.splash, startY:from[1], endY:0.25, col, trail:0.3, life:1.4});
        this.env.audio?.sfx('fire_mortar');
        this._fxMuzzle(from, col);
        break;
      }
      case 'hitscan': {
        const col=P.hex('#4ade80');
        this.beams.push({x0:from[0],y0:from[1],z0:from[2], x1:e.pos[0],y1:e.pos[1],z1:e.pos[2],
          life:0.22, max:0.22, col, w:0.09, target:e, dmg:st.dmg, pierce:st.pierce,
          hit:new Set()});
        this.env.audio?.sfx('fire_rail');
        this._fxMuzzle(from, col);
        break;
      }
      case 'grounding': {
        // lane current: run forward & back along path from the nearest path point to e
        const col=P.hex('#c084fc');
        let bestI=0,bd=1e9;
        for(let i=0;i<this.path.length;i++){
          const dx=this.path[i][0]-e.pos[0], dz=this.path[i][2]-e.pos[2];
          const dd=dx*dx+dz*dz;
          if(dd<bd){bd=dd;bestI=i;}
        }
        const run=st.run;
        const hitI=[];
        for(let i=Math.max(0,Math.floor(bestI-run)); i<=Math.min(this.path.length-1, Math.ceil(bestI+run)); i++){
          hitI.push(i);
        }
        // damage everything near those path segments
        let f=1;
        for(const i of hitI){
          const dmg=st.dmg*f;
          for(const ee of this.enemies){
            if(ee.dead) continue;
            const dx=ee.pos[0]-this.path[i][0], dz=ee.pos[2]-this.path[i][2];
            if(dx*dx+dz*dz<1.1){
              this.damage(ee, dmg, {});
              this._applyMark(ee, 'storm', t);
              ee.hitFlash=0.1;
            }
          }
          this._fxGrounding(this.path[i], col);
          f*=st.runFall;
        }
        this.env.audio?.sfx('fire_arc');
        this._fxMuzzle(from, col);
        break;
      }
      case 'cone': break; // handled continuously in _updateTowers
    }
  }
  _applyBurn(e, dps, dur){
    e.burn=Math.max(e.burn??0, dps);
    e.burnT=Math.max(e.burnT??0, dur);
  }
  _applyMark(e, elem, t){
    if(!e.marks[elem]){
      e.marks[elem]=true;
      e.markSeq.push(elem);
      // check reaction
      if(e.markSeq.length>=2){
        const a=e.markSeq[0], b=e.markSeq[1];
        const key=reactKey(a,b);
        const r=REACTIONS[key];
        if(r){
          e.marks={}; e.markSeq=[];
          const tgt=this._nearestAlive(e.pos);
          if(tgt){
            const boom=r.mul*(t&&t.stats ? t.stats.dmg : 8);
            // reaction damages: % + flat
            this.damage(tgt, e.maxHp*0.09 + boom, {});
            this._fxReaction(e, r);
            this.env.ui?.toast('<b>'+r.name+'</b>', 'warn', 1.2);
            this.env.audio?.sfx('explode');
            if(r.stun) tgt.stunT=r.stun;
            if(r.dot) this._applyBurn(tgt, r.dot, r.dotDur);
            if(r.slow){ tgt.slowT=r.slowDur; tgt.slowP=r.slow; }
            if(r.arc){ this._chain(tgt, r.arc, e.maxHp*0.05); }
          }
        }
      }
    }
  }
  _chain(src, radius, dmg){
    for(const e of this.enemies){
      if(e===src||e.dead) continue;
      const dx=e.pos[0]-src.pos[0], dz=e.pos[2]-src.pos[2];
      if(dx*dx+dz*dz< radius*radius){
        this.damage(e, dmg, {});
        this._fxChain(e.pos, P.hex('#8ab8ff'));
      }
    }
  }
  _nearestAlive(pos){
    let best=null,bd=1e9;
    for(const e of this.enemies){ if(e.dead) continue;
      const dx=e.pos[0]-pos[0], dz=e.pos[2]-pos[2];
      const dd=dx*dx+dz*dz;
      if(dd<bd){bd=dd;best=e;}
    }
    return best;
  }
  _blowout(t, st){
    const col=P.hex('#ff6b4a');
    this._fxMuzzle([t.x,1.0,t.z], col);
    this._fxMuzzle([t.x,1.4,t.z], P.hex('#ffd089'));
    for(const e of this.enemies){
      if(e.dead) continue;
      const dx=e.pos[0]-t.x, dz=e.pos[2]-t.z;
      if(dx*dx+dz*dz < (st.blowR??1.6)**2){
        this.damage(e, st.blowDmg, {});
        if(e.kind!=='fly') e.stunT=0.5;
      }
    }
    this._fxRing([t.x,0.6,t.z], col, st.blowR??1.6);
    this.env.audio?.sfx('explode');
  }
  /* ── projectiles & beams ────────────────────────────────────────── */
  _updateShots(dt){
    for(let i=this.shots.length-1;i>=0;i--){
      const s=this.shots[i];
      s.life-=dt;
      this._fxTrail(s);
      if(s.mode==='straight'){
        if(s.target && !s.target.dead){ s.tx=s.target.pos[0]; s.ty=s.target.pos[1]; s.tz=s.target.pos[2]; }
        const d=[s.tx-s.x,s.ty-s.y,s.tz-s.z];
        const len=V3.len(d);
        if(len<0.35){
          this._impact(s);
          this.shots.splice(i,1); continue;
        }
        const step=Math.min(len, s.speed*dt);
        s.x+=d[0]/len*step; s.y+=d[1]/len*step; s.z+=d[2]/len*step;
      } else if(s.mode==='lobbed'){
        s.t+=dt/s.dur;
        if(s.t>=1){
          // impact at target
          const tx=s.target && !s.target.dead ? s.target.pos[0] : s.tx;
          const tz=s.target && !s.target.dead ? s.target.pos[2] : s.tz;
          this._impact(s, [tx,tz]);
          this.shots.splice(i,1); continue;
        }
        const k=s.t;
        s.x=(s.tx??s.x);
        s.z=(s.tz??s.z);
        s.y=s.startY + (s.endY - s.startY)*k + Math.sin(Math.PI*k)*5.2;
        // interpolate horizontally from launch to target
        s.x=s.lx + ((s.tx??s.lx)-s.lx)*k;
        s.z=s.lz + ((s.tz??s.lz)-s.lz)*k;
      }
      if(s.life<=0){
        if(s.mode==='straight' && s.splash) this._impact(s);
        this.shots.splice(i,1);
      }
    }
    for(let i=this.beams.length-1;i>=0;i--){
      const b=this.beams[i];
      b.life-=dt;
      if(b.life<=0){ this.beams.splice(i,1); continue; }
      if(b.target && !b.target.dead){ b.x1=b.target.pos[0]; b.y1=b.target.pos[1]; b.z1=b.target.pos[2]; }
    }
  }
  _impact(s, at){
    const target=s.target;
    const col=s.col;
    if(s.splash){
      const cx=at?at[0]:s.x, cz=at?at[1]:s.z;
      this._fxRing([cx,0.5,cz], col, s.splash);
      this._fxSplash(cx,0.5,cz, col, 26);
      for(const e of this.enemies){
        if(e.dead) continue;
        const dx=e.pos[0]-cx, dz=e.pos[2]-cz;
        if(dx*dx+dz*dz < s.splash*s.splash){
          this._hitEnemy(e, s.dmg, s);
        }
      }
    } else if(target){
      if(!target.dead) this._hitEnemy(target, s.dmg, s);
    } else {
      this._fxSplash(s.x,0.4,s.z, col, 10);
    }
  }
  _hitEnemy(e, dmg, s){
    this.damage(e, dmg, {pierce:0});
    e.hitFlash=0.12;
    this._fxHit(e, s?.col);
    if(s?.slow) { e.slowT=Math.max(e.slowT, s.slowDur); e.slowP=Math.max(e.slowP, s.slow); }
    if(s?.elem && s.elem!=='kinetic' && s.elem!=='radiant'){
      const t=this.towers.find(t=>t.id===s.fromId || true);
      this._applyMark(e, s.elem, t||null);
    }
    if(s?.poison){ e.poison=Math.max(e.poison??0, s.poison); e.poisonT=Math.max(e.poisonT??0, s.poisonDur);
      e.poisonStacks=Math.min(s.stacks??2, (e.poisonStacks??0)+0.5); }
  }
  /* ── statuses ───────────────────────────────────────────────────── */
  _updateStatuses(dt){
    for(const e of this.enemies){
      if(e.dead) continue;
      if(e.hitFlash>0) e.hitFlash-=dt;
      if(e.slowT>0) e.slowT-=dt;
      if(e.burnT>0){
        this.damage(e, (e.burn??0)*dt, {});
        e.burnT-=dt;
        if(e.burnT<=0) e.burn=0;
      }
      if(e.poisonT>0){
        const stacks=e.poisonStacks??1;
        this.damage(e, ((e.poison??0)*stacks + e.maxHp*e.poisonPct*stacks)*dt*0.5, {ignoreArmor:true});
        e.poisonT-=dt;
        if(e.poisonT<=0){ e.poison=0; e.poisonStacks=0; }
      }
      // marks expiry not needed; reactions consume
    }
  }
  /* ── FX ─────────────────────────────────────────────────────────── */
  _updateFx(dt){ /* floater cleanup hook; particles live in the engine pool */ }
  _fxPlace(t){
    const p=this.env.eng.pool;
    for(let i=0;i<10;i++){
      const a=this.rng()*Math.PI*2;
      p.emit({x:t.x,y:0.25,z:t.z,size:0.3+this.rng()*0.3,
        r:0.5,g:0.9,b:1,a:0.9,life:0.4+this.rng()*0.2,soft:0,mode:0,
        sp:[Math.cos(a)*2,2+this.rng()*2,Math.sin(a)*2],grav:8});
    }
    this.env.eng.glow([t.x,1.2,t.z],1.2,[0.3,0.8,1],1.0);
  }
  _fxUpgrade(t){
    const p=this.env.eng.pool;
    const col=P.hex('#fbbf24');
    for(let i=0;i<18;i++){
      const a=this.rng()*Math.PI*2;
      p.emit({x:t.x,y:0.6,z:t.z,size:0.2+this.rng()*0.25,r:col[0],g:col[1],b:col[2],a:0.8,
        life:0.5+this.rng()*0.3,soft:1,sp:[Math.cos(a)*2.5,3+this.rng()*3,Math.sin(a)*2.5],grav:6});
    }
    this.env.eng.glow([t.x,1.5,t.z],1.6,col,1.4);
  }
  _fxKill(e){
    const p=this.env.eng.pool;
    const col=P.hex(e.def.col||'#94a3b8');
    for(let i=0;i<16;i++){
      const a=this.rng()*Math.PI*2;
      p.emit({x:e.pos[0],y:(e.pos[1]||0.4),z:e.pos[2],size:0.14+this.rng()*0.22,
        r:col[0],g:col[1],b:col[2],a:0.9,life:0.35+this.rng()*0.3,soft:1,
        sp:[Math.cos(a)*(2+this.rng()*3),2+this.rng()*4,Math.sin(a)*(2+this.rng()*3)],grav:5});
    }
    for(let i=0;i<8;i++){
      const a=this.rng()*Math.PI*2;
      p.emit({x:e.pos[0],y:(e.pos[1]||0.4),z:e.pos[2],size:0.1+this.rng()*0.12,
        r:1,g:0.9,b:0.6,a:0.9,life:0.3,soft:0,mode:0,
        sp:[Math.cos(a)*4,4+this.rng()*3,Math.sin(a)*4],grav:9});
    }
    this.env.eng.glow(e.pos,0.8,col,1.2);
    this.env.audio?.sfx('kill');
  }
  _fxHit(e, col){
    const p=this.env.eng.pool;
    const c=col??[1,1,1];
    p.emit({x:e.pos[0],y:(e.pos[1]||0.5),z:e.pos[2],size:0.16,r:c[0],g:c[1],b:c[2],a:0.8,
      life:0.16,soft:1,sp:[0,0.5,0]});
  }
  _fxMuzzle(from, col){
    const p=this.env.eng.pool;
    p.emit({x:from[0],y:from[1],z:from[2],size:0.22,r:col[0]*1.5,g:col[1]*1.5,b:col[2]*1.5,a:1,
      life:0.10,soft:1,sp:[0,0.6,0]});
    this.env.eng.glow(from,0.4,col,1.1);
  }
  _fxTrail(s){
    if(!s.trailAcc || s.trailAcc>s.trail){ 
      const p=this.env.eng.pool;
      if((this.rng()<0.6)){
        p.emit({x:s.x,y:s.y,z:s.z,size:0.12,r:s.col[0],g:s.col[1],b:s.col[2],a:0.55,
          life:0.22,soft:1,sp:[0,0.2,0]});
      }
      s.trailAcc=0;
    }
    s.trailAcc=(s.trailAcc||0)+ (s.trail);
  }
  _fxSplash(x,y,z, col, n){
    const p=this.env.eng.pool;
    for(let i=0;i<n;i++){
      const a=this.rng()*Math.PI*2;
      p.emit({x,y,z,size:0.12+this.rng()*0.2,r:col[0],g:col[1],b:col[2],a:0.85,
        life:0.3+this.rng()*0.25,soft:1,sp:[Math.cos(a)*(2+this.rng()*3),2+this.rng()*3,Math.sin(a)*(2+this.rng()*3)],grav:7});
    }
    this.env.eng.glow([x,y,z],1.0,col,1.4);
  }
  _fxRing(pos, col, r){
    const p=this.env.eng.pool;
    for(let i=0;i<14;i++){
      const a=i/14*Math.PI*2;
      p.emit({x:pos[0],y:pos[1],z:pos[2],size:0.1+this.rng()*0.1,r:col[0],g:col[1],b:col[2],a:0.9,
        life:0.3,soft:1,sp:[Math.cos(a)*r*2.2,0.4,Math.sin(a)*r*2.2],drag:0.85});
    }
  }
  _fxReaction(e, r){
    const col=P.hex(r.col);
    this._fxRing(e.pos, col, 1.0);
    this._fxSplash(e.pos[0], e.pos[1], e.pos[2], col, 30);
    this._fxMuzzle(e.pos, col);
  }
  _fxChain(pos, col){ this._fxSplash(pos[0],pos[1],pos[2], col, 6); }
  _fxGrounding(pos, col){
    this.env.eng.glow([pos[0],0.4,pos[2]],1.1,col,1.3);
  }
  _fxBurn(e, dt){
    const p=this.env.eng.pool;
    if(this.rng()<0.5){
      p.emit({x:e.pos[0]+(this.rng()-0.5)*0.4,y:e.pos[1]+0.2,z:e.pos[2]+(this.rng()-0.5)*0.4,
        size:0.14,r:1,g:0.45,b:0.1,a:0.6,life:0.3,soft:1,sp:[0,1.6,0],grav:-2});
    }
  }
  _fxLeak(e){
    const p=this.env.eng.pool;
    const col=P.hex('#ef4444');
    this._fxRing([this.corePos[0],0.8,this.corePos[2]], col, 1.2);
    this._fxSplash(this.corePos[0],0.8,this.corePos[2], col, 24);
    this.env.audio?.sfx('leak');
  }
  /* ── commander abilities ────────────────────────────────────────── */
  abilities(){
    return [
      { id:'prism', key:'Q', name:'PRISM LANCE', nm:'Q', cd:26, ac:'#38e8ff',
        glyph:'\u2606', desc:'A beam of cold light falls from the sky at the cursor: 140 damage and a wide stun.' },
      { id:'overclock', key:'E', name:'OVERCLOCK', nm:'E', cd:30, ac:'#fbbf24',
        glyph:'\u2726', desc:'Every tower shoots 55% faster for 9 seconds. The galaxy on fire.' }
    ];
  }
  _updateAbilities(dt){
    this.abilCd=this.abilCd||{prism:0, overclock:0};
    for(const k in this.abilCd) this.abilCd[k]=Math.max(0, this.abilCd[k]-dt);
    if(this.ocT>0){ this.ocT-=dt; if(this.ocT<=0) this.ocT=0; }
  }
  canAbility(id){ return (this.abilCd?.[id]??0)<=0; }
  castAbility(id, at){
    if(!this.canAbility(id)) return false;
    this.abilCd[id]=id==='prism'?26:30;
    this.env.audio?.sfx('ability');
    if(id==='prism'){
      const pos=at||[this.corePos[0],0,this.corePos[2]];
      this._prismStrike(pos);
    } else if(id==='overclock'){
      this.ocT=9;
      for(const t of this.towers){ t.ocT=9; }
      this.env.ui?.toast('<b>OVERCLOCK</b> — 55% fire rate for 9s','good',1.6);
    }
    return true;
  }
  _prismStrike(at){
    const col=P.hex('#38e8ff');
    this._fxMuzzle([at[0],6,at[2]], col);
    this._fxRing(at, col, 2.0);
    this._fxSplash(at[0],0.4,at[2], col, 40);
    for(let i=0;i<26;i++){
      this.env.eng.pool.emit({x:at[0]+(this.rng()-0.5)*1.6,y:6,z:at[2]+(this.rng()-0.5)*1.6,
        size:0.2,r:col[0],g:col[1],b:col[2],a:0.9,life:0.5,soft:1,sp:[0,-16,0]});
    }
    for(const e of this.enemies){
      if(e.dead) continue;
      const dx=e.pos[0]-at[0], dz=e.pos[2]-at[2];
      if(dx*dx+dz*dz<4){
        this.damage(e, 140, {});
        if(e.kind!=='fly') e.stunT=1.2;
      }
    }
  }
  /* ── presentation (every frame, independent of sim) ─────────────── */
  _present(dt){
    const eng=this.env.eng;
    // orbitals orbit
    for(const o of this.orbitals){
      o.a+=o.speed*dt*3;
      const x=Math.cos(o.a)*o.r, z=Math.sin(o.a)*o.r;
      const y=o.h+Math.sin(this.time*0.6+o.r)*0.5;
      const plate=eng.plates.find(p=>p.mesh===o.mesh);
      if(plate) plate.model=M4.trans(x,y,z);
      if(this.rng()<0.006) eng.glow([x,y,z],0.35,[0.4,0.5,0.9],0.5);
    }
    // core orb pulse: geometry is baked at (x,2.15,z), so scale/rotate IN PLACE
    const cp=this.board?.core;
    if(cp && cp.orbM){
      const s=1+Math.sin(this.time*2.1)*0.06;
      const plate=eng.plates.find(p=>p.mesh===cp.orbM);
      if(plate){
        plate.model=POLY.M4.mul(POLY.M4.trans(cp.pos[0],2.15,cp.pos[2]),
          POLY.M4.mul(POLY.M4.trs(0,0,0, 0,this.time*0.7,0, s,s,s),
            POLY.M4.trans(-cp.pos[0],-2.15,-cp.pos[2])));
      }
    }
    // beams as glow chains
    for(const b of this.beams){
      const f=b.life/b.max;
      const n=6;
      for(let i=0;i<n;i++){
        const k=i/(n-1);
        eng.glow([b.x0+(b.x1-b.x0)*k, b.y0+(b.y1-b.y0)*k, b.z0+(b.z1-b.z0)*k], 0.22*(f+0.4),
          b.col, 1.8*f);
      }
    }
    // marks on enemies: colored ring sprite above
    const markCols={fire:'#ff9b3d', frost:'#8ab8ff', storm:'#c084fc', venom:'#a3e635', void:'#7c3aed'};
    for(const e of this.enemies){
      if(e.dead) continue;
      if(Object.keys(e.marks).length){
        let i=0;
        for(const mk in e.marks){
          const c=P.hex(markCols[mk]||'#fff');
          const y=(e.kind==='fly'?1.5:1.0)+(i*0.3)+Math.sin(this.time*3+i)*0.07;
          eng.glow([e.pos[0],(e.pos[1]||0.4)+y,e.pos[2]], 0.34+(i*0.06), c, 1.9);
          i++;
        }
      }
      if(e.hitFlash>0){
        eng.glow([e.pos[0],e.pos[1],e.pos[2]], e.radius*0.8, [1,1,1], e.hitFlash*6);
      }
    }
    // tower muzzle idle glow for charged towers
    for(const t of this.towers){
      if(t.charge>0.5){ eng.glow([t.x,1.4,t.z],0.7,[1,1,0.8], t.charge*1.4); }
    }
    // faint heat shimmer at the gate — never a big white blob
    if(this.rng()<0.05){
      eng.glow([this.path[0][0],1.2,this.path[0][2]],0.28,[0.45,0.18,0.5],0.35);
    }
  }
}
POLY.Battle = Battle;
POLY.REACTIONS = REACTIONS;
})();
