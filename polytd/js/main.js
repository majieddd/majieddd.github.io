/* ==========================================================================
   POLY PROTOCOL — main.js
   Bootstrap: canvas, camera, input, placement raycasting, main loop.
   ========================================================================== */
'use strict';
(() => {
window.__bootErr=null;
window.addEventListener('error', e=>{ window.__bootErr = (e.message||'')+' | '+(e.filename||'').split(/[\\/]/).pop()+':'+e.lineno; });
const D = POLY.DATA, P = POLY.PAINT;
const M4 = POLY.M4, V3 = POLY.V3;

class App {
  constructor(){
    this.canvas=document.getElementById('gl');
    this.eng=new POLY.Engine(this.canvas);
    if(!this.eng.gl){ document.getElementById('gl-fallback').classList.remove('hidden');
      this.canvas.style.display='none'; return; }
    this.audio=new POLY.Audio();
    this.mapId='orrery';
    this.quality={ dpr: Math.min(devicePixelRatio||1, 1.75) };
    this.time=0;
    this.speedMul=1;
    this.paused=false;
    this.battle=null;
    this.buildMode=null;
    this.abilityAim=null;
    this._wire();
    this.ui=new POLY.UI(this);
    this._resize();
    this._bindResize();
    this._screenId='title';
    this.ui.title();
    this._anim=this._frame.bind(this);
    this.audio.init();
    requestAnimationFrame(this._anim);
  }
  _reset(){
    this.buildMode=null;
    this.abilityAim=null;
    this.ui.armed=null;
    if(this.battle) this.battle=null;
  }
  /* ── wiring ─────────────────────────────────────────────────────── */
  _wire(){
    this.sun=new POLY.Geo();
    // done in board; camera controls:
    this.cam={ yaw:0, pitch:0.62, dist:21, target:[0,0.8,0] };
    this._cam={ ...this.cam };
    // pointer state
    this._down=false; this._downPos=null; this._downT=0;
    this.canvas.addEventListener('pointerdown', e=>{
      this._down=true; this._downPos=[e.clientX,e.clientY]; this._downT=performance.now();
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointerup', e=>{
      const wasClick = this._down && Math.hypot(e.clientX-this._downPos[0], e.clientY-this._downPos[1])<6;
      this._down=false;
      if(wasClick) this._click(e);
      else if(this._downPos) this._click(e); // draggy click still fires build (cell snap)
    });
    this.canvas.addEventListener('pointermove', e=>{
      if(this._down && this._downPos){
        const dx=e.clientX-this._downPos[0], dy=e.clientY-this._downPos[1];
        if(Math.hypot(dx,dy)>6){
          this.cam.yaw += dx*0.005;
          this.cam.pitch = Math.min(1.25, Math.max(0.25, this.cam.pitch + dy*0.004));
          this._downPos=[e.clientX,e.clientY];
        }
      }
    });
    this.canvas.addEventListener('wheel', e=>{
      e.preventDefault();
      this.cam.dist=Math.min(34, Math.max(9, this.cam.dist + e.deltaY*0.016));
    }, {passive:false});
    window.addEventListener('keydown', e=>this._key(e));
    this._hudResize=()=>this._resize();
    window.addEventListener('resize', this._hudResize);
  }
  _bindResize(){ /* set in _wire */ }
  _resize(){
    const w=window.innerWidth, h=window.innerHeight;
    const dpr=Math.min(devicePixelRatio||1, 1.75);
    this.eng.resize(w,h,dpr);
    const aspect=w/h;
    this.eng.proj=M4.persp(0.78,aspect,0.1,140);
  }
  cycleSpeed(){ this.speedMul = this.speedMul===1?2 : this.speedMul===2?4 : 1;
    document.getElementById('hud-speed').textContent=this.speedMul+'\u00d7';
    this.audio?.sfx('ui2');
  }
  togglePause(){ this.paused=!this.paused;
    document.getElementById('hud-pause').textContent=this.paused?'\u25b6':'\u2759\u2759';
    this.ui.toast(this.paused?'PAUSED':'UNPAUSED','',0.9);
  }
  /* ── screens/flow ───────────────────────────────────────────────── */
  startBattle(){
    this._reset();
    this.audio.resume();
    this.audio.startMusic();
    this.ui.hidden();
    this.ui.showHUD();
    this.battle=new POLY.Battle(this, this.mapId);
    this.ui.setFactionColor(D.MAPS[this.mapId].faction);
    document.getElementById('hud-lives').textContent=this.battle.lives;
    document.getElementById('hud-gold').textContent=Math.round(this.battle.gold);
    document.getElementById('hud-wave').textContent='0/'+D.WAVES.length;
    this.ui.toast('<b>'+D.MAPS[this.mapId].name+'</b> — build before the first wave.','good',4);
    this.ui.onWaveStart(0);
    this.ui.hint('Pick a tower (1-8), click a stone cell to build');
    this._screenId='battle';
  }
  /* ── input ──────────────────────────────────────────────────────── */
  _key(e){
    if(!this.battle){ if(e.key==='Enter') this.ui?.briefing?.(); return; }
    const k=e.key.toLowerCase();
    if(e.key===' '){ e.preventDefault(); this.togglePause(); return; }
    if(k==='escape'){ this.setBuildMode(null); this.abilityAim=null;
      this.ui.closeInspector(); return; }
    if(k==='p'){ this.togglePause(); return; }
    if(e.altKey && /^[123]$/.test(k)){ this.cycleSpeed(); return; }
    if(/^[1-8]$/.test(k)){
      const order=['bolt','cryo','mortar','arc','toxin','pyre','railgun','nullfield'];
      const tid=order[parseInt(k,10)-1];
      this.audio?.sfx('ui');
      this.buildMode=this.buildMode===tid?null:tid;
      this.ui.armed=this.buildMode;
      this.ui._refreshDock();
      return;
    }
    if(k==='q'){
      const b=this.battle;
      if(b.canAbility('prism')){ this.audio?.sfx('ui'); this.setAbilityAim('prism'); }
      else this.audio?.sfx('ui2');
      return;
    }
    if(k==='e'){ this.battle.castAbility('overclock'); return; }
    if(k==='n' || k==='enter'){ this.battle.rush(); return; }
    if(k==='u'){ this.ui.inspect(this.ui.selectedTower); this._tryUpgrade(); return; }
    if(k==='s' || k==='f'){ if(this.ui.selectedTower) this.battle.sell(this.ui.selectedTower); return; }
  }
  _tryUpgrade(){
    const t=this.ui.selectedTower; if(t) this.battle.upgrade(t);
  }
  setBuildMode(tid){
    this.buildMode=tid;
    if(tid){ this.abilityAim=null; this.ui.unHint(); }
    else this.ui.hint('Pick a tower (1-8), click a stone cell to build');
  }
  setAbilityAim(id){
    this.abilityAim=id;
    this.ui.hint('Click a point on the board — the lance falls there');
  }
  /* ── pointer → ground ───────────────────────────────────────────── */
  _raycast(e){
    const r=this.canvas.getBoundingClientRect();
    const nx=((e.clientX-r.left)/r.width)*2-1;
    const ny=-((e.clientY-r.top)/r.height)*2+1;
    const inv=this._invertViewProj();
    const p1=POLY.M4.mulP? null : null;
    // unproject twice along ray near/far
    const m=this._viewProj();
    const near=POLY.M4.mul(M4.inv(m), [nx,ny,-1,1]);
    const far =POLY.M4.mul(M4.inv(m), [nx,ny, 1,1]);
    const o=[near[0]/near[3],near[1]/near[3],near[2]/near[3]];
    const f=[far[0]/far[3],far[1]/far[3],far[2]/far[3]];
    const d=V3.norm(V3.sub(f,o));
    // intersect plane y=0.42
    const t=(0.42-o[1])/d[1];
    if(t<=0||t>200) return null;
    return [o[0]+d[0]*t, 0.42, o[2]+d[2]*t];
  }
  _viewProj(){ return M4.mul(this.eng.proj, this.eng.view); }
  _invertViewProj(){ return M4.inv(this._viewProj()); }
  _click(e){
    if(!this.battle || this.battle.state==='won' || this.battle.state==='lost') return;
    const pt=this._raycast(e);
    if(!pt) return;
    const b=this.battle;
    if(this.abilityAim==='prism'){
      b.castAbility('prism', [pt[0],0,pt[2]]);
      this.abilityAim=null; this.ui.unHint(); return;
    }
    const cell=b.cells.reduce((best,cl)=>{
      const dx=cl.x-pt[0], dz=cl.z-pt[2];
      const d2=dx*dx+dz*dz;
      return (!best||d2<best.d2)?{cl,d2}:best;
    }, null)?.cl;
    if(!cell) return;
    if(this.buildMode && b.canPlace(cell)){
      const t=b.place(this.buildMode, cell);
      if(t){ this.ui.selectedTower=t; this.ui.inspect(t); }
      return;
    }
    if(cell.tower){ this.ui.selectedTower=cell.tower; this.ui.inspect(cell.tower); }
    else if(!this.buildMode){ this.ui.selectedTower=null; this.ui.closeInspector(); }
  }
  /* ── render loop ────────────────────────────────────────────────── */
  _frame(ts){
    const now=ts/1000;
    const rawDt=Math.min(0.05, now-(this._lastT??now));
    this._lastT=now;
    this.time+=rawDt;
    if(this.eng && this.eng.gl){
      // camera easing
      const c=this.cam, cc=this._cam;
      cc.yaw += (c.yaw-cc.yaw)*0.12;
      cc.pitch += (c.pitch-cc.pitch)*0.12;
      cc.dist += (c.dist-cc.dist)*0.12;
      const eye=[ Math.sin(cc.yaw)*Math.cos(cc.pitch)*cc.dist + cc.target[0],
                  Math.sin(cc.pitch)*cc.dist*0.9 + cc.target[1],
                  Math.cos(cc.yaw)*Math.cos(cc.pitch)*cc.dist + cc.target[2] ];
      this.eng.setCam(eye, cc.target);
      this.eng.step(rawDt);
      // sim tick (fixed-ish)
      if(this.battle && !this._screenError){
        try{
          const simDt=rawDt*this.speedMul;
          if(!this.paused && !this.battle.paused){
            this.battle.tick(simDt);
            for(let i=1;i<this.speedMul;i++){
              if(this.battle.paused) break;
              this.battle.tick(simDt/Math.max(1,this.speedMul-1));
            }
          }
        }catch(err){
          if(!this._simErr){ this._simErr=err; console.error('SIM', err);
            this.ui.toast('Sim error: '+err.message,'bad',5); }
        }
      }
            // ability cooldown UI
      if(this.battle) this.ui.refreshCd();
      this._presentFx();
      try{ this.eng.draw(); }catch(err){
        if(!this._screenError){ this._screenError=err; console.error('RENDER', err);
          this.ui.toast('Renderer error: '+err.message,'bad',6); }
      }
    }
    requestAnimationFrame(this._anim);
  }
  _presentFx(){
    const b=this.battle; if(!b) return;
    // overclock glow on towers
    if(b.ocT>0 && Math.random()<0.4){
      const t=b.towers[Math.floor(Math.random()*b.towers.length)];
      if(t) this.eng.glow([t.x,1.6,t.z],1.1,[1,0.75,0.2],1.2);
    }
  }
}

/* minimal matrix extras on M4 (placed privately) */
const M4x = {
  inv(m){
    const o=new Float32Array(16);
    const a00=m[0],a01=m[1],a02=m[2],a03=m[3];
    const a10=m[4],a11=m[5],a12=m[6],a13=m[7];
    const a20=m[8],a21=m[9],a22=m[10],a23=m[11];
    const a30=m[12],a31=m[13],a32=m[14],a33=m[15];
    const b00=a00*a11-a01*a10, b01=a00*a12-a02*a10, b02=a00*a13-a03*a10;
    const b03=a01*a12-a02*a11, b04=a01*a13-a03*a11, b05=a02*a13-a03*a12;
    const b06=a20*a31-a21*a30, b07=a20*a32-a22*a30, b08=a20*a33-a23*a30;
    const b09=a21*a32-a22*a31, b10=a21*a33-a23*a31, b11=a22*a33-a23*a32;
    let det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;
    if(!det) return m;
    det=1.0/det;
    o[0]=( a11*b11-a12*b10+a13*b09)*det;
    o[1]=( a02*b10-a01*b11-a03*b09)*det;
    o[2]=( a31*b05-a32*b04+a33*b03)*det;
    o[3]=( a22*b04-a21*b05-a23*b03)*det;
    o[4]=( a12*b08-a10*b11-a13*b07)*det;
    o[5]=( a00*b11-a02*b08+a03*b07)*det;
    o[6]=( a32*b02-a30*b05-a33*b01)*det;
    o[7]=( a20*b05-a22*b02+a23*b01)*det;
    o[8]=( a10*b10-a11*b08+a13*b06)*det;
    o[9]=( a01*b08-a00*b10-a03*b06)*det;
    o[10]=( a30*b04-a31*b02+a33*b00)*det;
    o[11]=( a21*b02-a20*b04-a23*b00)*det;
    o[12]=( a11*b07-a10*b09-a12*b06)*det;
    o[13]=( a00*b09-a01*b07+a02*b06)*det;
    o[14]=( a31*b01-a30*b03-a32*b00)*det;
    o[15]=( a20*b03-a21*b01+a22*b00)*det;
    return o;
  },
  mulP(m, v){
    const x=v[0],y=v[1],z=v[2],w=v[3]??1;
    return [ m[0]*x+m[4]*y+m[8]*z+m[12]*w,
             m[1]*x+m[5]*y+m[9]*z+m[13]*w,
             m[2]*x+m[6]*y+m[10]*z+m[14]*w,
             m[3]*x+m[7]*y+m[11]*z+m[15]*w ];
  }
};
POLY.M4.inv = M4x.inv;
POLY.M4.mulP = M4x.mulP;

try{ window.__poly = new App(); }catch(err){ window.__bootErr = (err&&err.stack)||String(err); console.error('BOOT FAIL', err); }
})();
