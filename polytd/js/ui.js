/* ==========================================================================
   POLY PROTOCOL — ui.js
   Screens and HUD. Dark glass, engraved rules, faction accents.
   ========================================================================== */
'use strict';
(() => {
const D = POLY.DATA;

function qs(sel){ return document.querySelector(sel); }
function mk(tag, cls, html){ const e=document.createElement(tag);
  if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }

function towerIcon(canvas, tid, cc){
  const g=canvas.getContext('2d');
  const w=canvas.width, h=canvas.height;
  g.clearRect(0,0,w,h);
  const cx=w/2, cy=h*0.62;
  g.save(); g.translate(0,0);
  g.strokeStyle='rgba(148,163,184,0.5)'; g.lineWidth=2;
  g.beginPath(); g.arc(cx,cy,w*0.30,0,7); g.stroke();
  g.fillStyle='#1b2333';
  g.beginPath(); g.arc(cx,cy,w*0.26,0,7); g.fill();
  g.restore();
  const draw=(fn)=>{ g.save(); g.translate(w/2,h*0.56); fn(g); g.restore(); };
  const col=cc || '#38e8ff';
  draw(g=>{
    if(tid==='bolt'){
      g.fillStyle='#5b6b81'; g.fillRect(-16,-9,32,18);
      g.fillStyle=col; g.fillRect(-10,-4,20,8); g.fillRect(-7,-8,4,18); g.fillRect(3,-8,4,18);
      g.fillStyle='#94a3b8'; g.fillRect(-14,-13,28,5);
    } else if(tid==='cryo'){
      g.fillStyle=col; g.fillRect(-4,-26,8,40);
      g.fillRect(-4,-26,-14,8); g.fillRect(4,-26,14,8);
      g.fillStyle='#94a3b8'; g.fillRect(-20,-2,40,5);
    } else if(tid==='mortar'){
      g.fillStyle='#c2622f'; g.fillRect(-8,-24,16,34);
      g.fillStyle='#3a4759'; g.fillRect(-12,-8,24,6);
      g.fillStyle=col; g.fillRect(-4,-28,8,6);
    } else if(tid==='arc'){
      g.fillStyle='#5b6b81'; g.fillRect(-3,-26,6,32);
      g.fillStyle=col; g.fillRect(-13,-18,26,5); g.fillRect(-13,-4,26,5);
      g.beginPath(); g.arc(0,-30,5,0,7); g.fillStyle=col; g.fill();
    } else if(tid==='pyre'){
      g.fillStyle='#7c2410'; g.fillRect(-10,-6,20,18);
      g.fillStyle='#c2622f'; g.fillRect(-6,-18,12,14);
      g.fillStyle=col; g.beginPath(); g.moveTo(-7,-18); g.lineTo(7,-18); g.lineTo(0,-32); g.closePath(); g.fill();
    } else if(tid==='toxin'){
      g.fillStyle='#3f5f0b'; g.beginPath(); g.arc(0,-10,12,0,7); g.fill();
      g.fillStyle=col; g.beginPath(); g.arc(0,-14,6,0,7); g.fill();
      g.fillStyle='#3f5f0b'; g.fillRect(-3,-2,6,8);
    } else if(tid==='railgun'){
      g.fillStyle='#5b6b81'; g.fillRect(-20,-5,40,10);
      g.fillStyle='#94a3b8'; g.fillRect(-16,-8,32,3); g.fillRect(-16,5,32,3);
      g.fillStyle=col; g.beginPath(); g.arc(12,0,4,0,7); g.fill();
    } else if(tid==='nullfield'){
      g.strokeStyle='#94a3b8'; g.lineWidth=3;
      g.beginPath(); g.arc(0,-8,14,0,7); g.stroke();
      g.strokeStyle=col; g.lineWidth=2;
      g.beginPath(); g.arc(0,-8,8,0,7); g.stroke();
    }
    g.strokeStyle='rgba(56,170,192,0.6)'; g.lineWidth=1.5;
    g.beginPath(); g.arc(0,0,w*0.34,0,7); g.stroke();
  });
}

class UI {
  constructor(env){
    this.env=env;
    this.root=qs('#screen-root');
    this.toasts=qs('#toasts');
    this.screen=null;
    this.selectedTower=null;
    this.armed=null;
    this._tipEl=null;
    this.chipSpeed=qs('#speed-chip');
    this.chipPause=qs('#pause-chip');
    this.chipSpeed.addEventListener('click', ()=>{ this.env.cycleSpeed(); });
    this.chipPause.addEventListener('click', ()=>{ this.env.togglePause(); });
  }
  setFactionColor(col){ document.documentElement.style.setProperty('--fc', col); }
  toast(html, kind, dur){
    const t=mk('div','toast'+(kind?' '+kind:''), html);
    this.toasts.appendChild(t);
    // keep at most 4 live toasts; drop the oldest immediately
    while(this.toasts.children.length>4) this.toasts.firstChild.remove();
    setTimeout(()=>{ t.style.transition='opacity .4s'; t.style.opacity='0';
      setTimeout(()=>t.remove(), 450); }, (dur??2.6)*1000);
  }
  showScreen(html){
    this.root.innerHTML='';
    const s=mk('section','screen', html);
    this.root.appendChild(s);
    this.screen=s;
    return s;
  }
  hidden(){ this.root.innerHTML=''; this.screen=null; }

  title(){
    const s=this.showScreen('' +
      '<div class="veil"></div><div class="mid">' +
      '<div class="logo" style="--fc:#38e8ff">' +
      '<div class="l1">The galaxy, in paint</div>' +
      '<div class="l2">Cosmic Conquest</div>' +
      '<div class="l3">Poly Protocol</div>' +
      '<div class="rule"></div></div>' +
      '<p class="lemma">A tower defence re-rigged in low poly and wet oil. Five powers, one lane, nobody to send in. Stand where the core falls.</p>' +
      '<div class="menu-col">' +
      '<button class="btn primary" id="btn-play">Deploy</button>' +
      '<button class="btn ghost" id="btn-about">The Briefing</button></div>' +
      '<p class="fact-row">' +
      '<span class="fact"><b>8</b> towers</span>' +
      '<span class="fact"><b>9</b> engines</span>' +
      '<span class="fact"><b>12</b> waves</span>' +
      '<span class="fact"><b>3</b> boards</span>' +
      '<span class="fact"><b>10</b> reactions</span>' +
      '<span class="fact"><b>0</b> assets</span></p></div>');
    s.querySelector('#btn-play').onclick=()=>{ this.env.audio?.sfx('ui'); this.briefing(); };
    s.querySelector('#btn-about').onclick=()=>{
      this.env.audio?.sfx('ui2'); this.toast('Build. Upgrade. Overload.<br><b>Q</b> Prism Lance &nbsp; <b>E</b> Overclock &nbsp; <b>1-8</b> towers &nbsp; <b>Space</b> pause','',4);
    };
    return s;
  }

  briefing(){
    const env=this.env;
    const s=this.showScreen('' +
      '<div class="veil"></div><div class="mid">' +
      '<div class="logo" style="--fc:#38e8ff">' +
      '<div class="l1">Deployment plan</div><div class="l2">The Aegis</div>' +
      '<div class="rule"></div></div>' +
      '<div class="card-row" id="map-cards"></div>' +
      '<div class="brief-card" id="brief-card"></div>' +
      '<div class="menu-col" style="width:min(360px,88vw)">' +
      '<button class="btn primary" id="btn-begin">Begin the vigil</button>' +
      '<button class="btn ghost" id="btn-back">Back</button></div></div>');
    const cards=s.querySelector('#map-cards');
    for(const mid in D.MAPS){
      const m=D.MAPS[mid];
      const c=mk('div','pcard',
        '<h4>'+m.name+'</h4>' +
        '<div class="role">'+m.sub+'</div>' +
        '<p>'+m.desc+'</p>' +
        '<div class="chips"><i>'+m.cols+'&times;'+m.rows+'</i><i>GOLD &times;'+m.bonus.gold+'</i></div>');
      if(env.mapId===mid) c.classList.add('sel');
      c.style.setProperty('--fc', m.faction);
      c.onclick=()=>{ env.audio?.sfx('ui'); env.mapId=mid; this.briefing(); };
      cards.appendChild(c);
    }
    const m=D.MAPS[env.mapId];
    const bc=s.querySelector('#brief-card');
    bc.style.setProperty('--fc', m.faction);
    bc.innerHTML='' +
      '<h3><span class="dot"></span> '+m.name+' &mdash; '+m.sub+'</h3>' +
      '<div class="row"><div class="box"><b>Intel</b><span>'+m.desc+'</span></div></div>' +
      '<div class="row"><div class="box"><b>Guard</b><span>220 gold to begin. Leaks spend the core. The lane doubles back; the reactions do the rest.</span></div></div>' +
      '<div class="tip"><em>Two different element marks on one body always react.</em> Q drops the Prism Lance, E overclocks the whole arsenal.</div>';
    s.querySelector('#btn-begin').onclick=()=>{ env.audio?.sfx('wave'); env.startBattle(); };
    s.querySelector('#btn-back').onclick=()=>{ env.audio?.sfx('ui2'); this.title(); };
  }

  showHUD(){
    qs('#hud-top').classList.remove('hidden');
    qs('#dock').classList.remove('hidden');
    qs('#abilities').classList.remove('hidden');
    this._buildDock();
    this._buildAbilities();
    this.refreshGold();
  }
  hideHUD(){
    qs('#hud-top').classList.add('hidden');
    qs('#dock').classList.add('hidden');
    qs('#abilities').classList.add('hidden');
    qs('#inspector').classList.add('hidden');
  }
  _buildDock(){
    const dock=qs('#dock'); dock.innerHTML='';
    const order=['bolt','cryo','mortar','arc','toxin','pyre','railgun','nullfield'];
    order.forEach((tid,i)=>{
      const def=D.TOWERS[tid];
      const c=mk('div','dock-card');
      c.style.setProperty('--fc', def.mk.col);
      c.innerHTML='' +
        '<div class="icon"><canvas width="144" height="108"></canvas></div>' +
        '<span class="nm">'+def.name+'</span>' +
        '<span class="cost">'+def.cost+'</span>' +
        '<span class="key">'+(i+1)+'</span>' +
        '<span class="elem" style="color:'+def.mk.col+';background:'+def.mk.col+'"></span>';
      towerIcon(c.querySelector('canvas'), tid, def.mk.col);
      c.addEventListener('click', ()=>{
        this.env.audio?.sfx('ui');
        if(this.env.battle && this.env.battle.state==='wave' && this.env.armed){
          // allow swapping mid-wave? keep simple: re-arm
          this.env.setBuildMode(null);
        }
        this.armed = (this.armed===tid) ? null : tid;
        this._refreshDock();
        this.env.setBuildMode(this.armed);
      });
      c.addEventListener('mouseenter', ()=> this._dockTip(def, c));
      c.addEventListener('mouseleave', ()=> this._clearTip());
      dock.appendChild(c);
      c.dataset.tid=tid;
    });
    this._refreshDock();
  }
  _dockTip(def){
    this._clearTip();
    this._tipEl=mk('div','toast',
      '<b>'+def.name+'</b> &mdash; '+def.elem.toUpperCase()+' &middot; '+def.role+'<br>' +
      def.desc+'<br>' +
      '<b>DMG '+def.base.dmg+'</b> &middot; <b>RANGE '+def.base.range+'</b> &middot; <b>RATE '+def.base.rate+'/s</b>');
    this._tipEl.style.cssText='position:absolute;bottom:118px;transform:translateX(-50%);left:50%;max-width:420px;z-index:70';
    document.body.appendChild(this._tipEl);
  }
  _clearTip(){ if(this._tipEl){ this._tipEl.remove(); this._tipEl=null; } }
  _refreshDock(){
    const dock=qs('#dock'); const b=this.env.battle;
    for(const c of dock.children){
      const tid=c.dataset.tid; const def=D.TOWERS[tid];
      const canBuy=b && b.gold>=def.cost;
      c.classList.toggle('poor', !canBuy);
      c.classList.toggle('sel', this.armed===tid);
      c.querySelector('.cost').textContent=def.cost;
      // pulse when affordable
      const rune=c.querySelector('.cd-rune');
    }
  }
  refreshGold(){
    const b=this.env.battle; if(!b) return;
    qs('#hud-gold').textContent=Math.round(b.gold);
    this._refreshDock();
  }
  _buildAbilities(){
    const ab=qs('#abilities'); ab.innerHTML='';
    const list=this.env.battle?this.env.battle.abilities():[
      {id:'prism',key:'Q',name:'PRISM LANCE',ac:'#38e8ff',glyph:'&#10022;',cd:26},
      {id:'overclock',key:'E',name:'OVERCLOCK',ac:'#fbbf24',glyph:'&#10038;',cd:30}];
    list.forEach(a=>{
      const e=mk('div','abil');
      e.style.setProperty('--ac', a.ac);
      e.innerHTML='<div class="glyph">'+a.glyph+'</div><div class="nm">'+a.name+'</div>' +
        '<div class="key">'+a.key+'</div><div class="cd"></div>';
      e.dataset.ab=a.id;
      e.addEventListener('click', ()=>{
        const b=this.env.battle; if(!b) return;
        if(a.id==='prism'){
          if(!b.canAbility('prism')) { this.env.audio?.sfx('ui2'); return; }
          this.env.audio?.sfx('ui');
          this.env.setAbilityAim('prism');
        } else {
          if(!b.canAbility('overclock')) { this.env.audio?.sfx('ui2'); return; }
          b.castAbility('overclock');
        }
      });
      ab.appendChild(e);
    });
  }
  onWaveStart(no){
    qs('#hud-wave').textContent=Math.max(no,1)+'/'+D.WAVES.length;
    const w=no>=1?D.WAVES[Math.min(no,D.WAVES.length)-1]:D.WAVES[0];
    let comp='';
    for(const [id,n] of w.compose){
      comp+='<span class="comp"><i>'+n+'</i> '+D.ENEMIES[id].name+'</span>';
    }
    qs('#next-chip').innerHTML=comp;
    this._announce(no, w);
  }
  _announce(no, w){
    const a=qs('#announce');
    a.classList.remove('hidden');
    a.innerHTML='<div class="big">'+(w.boss? (w.boss===1?'The Harbinger':'The Juggernaut') : 'Wave '+no)+'</div>' +
      '<div class="sub">'+(w.boss? 'A shroud of the war machine' : (no===D.WAVES.length?'Stand. The last wave comes.':'Hold the lane'))+'</div>';
    setTimeout(()=>{ a.classList.add('hidden'); }, w.boss?2600:1900);
  }
  onBuildPause(wait){ const b=this.env.battle; if(b) qs('#hud-wave').textContent=(b.nextNo||1)+'/'+D.WAVES.length; }
  onKill(){ this.refreshGold(); }
  onLeak(lives){ qs('#hud-lives').textContent=lives;
    const chip=qs('#lives-chip');
    chip.style.borderColor=lives<=5?'#ef4444':'';
    this.toast('The core took a hit', 'bad', 1.4);
  }
  onPlace(){ this.refreshGold(); }
  onUpgrade(t){ this.refreshGold(); this.inspect(t); }
  onSell(){ this.refreshGold(); this.closeInspector(); }
  onEnd(won, b){
    const s=this.showScreen('' +
      '<div class="veil"></div><div class="mid"><div class="results">' +
      '<div class="verdict '+(won?'win':'lose')+'">'+(won?'Lane held':'The core fell')+'</div>' +
      '<div class="stars" id="stars"></div>' +
      '<div class="score">'+(won?'THE SECTOR BREATHES':'It came through anyway')+'</div>' +
      '<table class="statline">' +
      '<tr><td>Waves held</td><td>'+(b.waveNo)+' / '+D.WAVES.length+'</td></tr>' +
      '<tr><td>Kills</td><td>'+b.kills+'</td></tr>' +
      '<tr><td>Leaks</td><td>'+b.leaks+'</td></tr>' +
      '<tr><td>Damage dealt</td><td>'+Math.round(b.dmgDealt)+'</td></tr>' +
      '<tr><td>Gold unspent</td><td>'+Math.round(b.gold)+'</td></tr></table>' +
      '<div class="menu-col" style="width:min(320px,86vw)">' +
      '<button class="btn primary" id="btn-again">Run it again</button>' +
      '<button class="btn ghost" id="btn-title">Title</button></div>' +
      '</div></div>');
    const starsEl=s.querySelector('#stars');
    const n=won ? (b.leaks===0?3 : b.leaks<=3?2 : 1) : 0;
    for(let i=0;i<3;i++){
      const st=mk('span', i<n?'on':'', '&#9733;');
      starsEl.appendChild(st);
    }
    s.querySelector('#btn-again').onclick=()=>{ this.env.audio?.sfx('ui'); this.env.startBattle(); };
    s.querySelector('#btn-title').onclick=()=>{ this.env.audio?.sfx('ui2'); this.hideHUD(); this.title(); };
  }
  inspect(t){
    const ins=qs('#inspector');
    if(!t){ ins.classList.add('hidden'); return; }
    const b=this.env.battle;
    const def=t.def;
    ins.classList.remove('hidden');
    ins.style.setProperty('--fc', def.mk.col);
    const nextLv=t.lv<2?def.lv[t.lv]:null;
    let statHtml='' +
      '<div class="stat">' +
      '<i>Damage</i><b>'+t.stats.dmg+'</b>' +
      '<i>Fire rate</i><b>'+t.stats.rate+'/s</b>' +
      '<i>Range</i><b>'+t.stats.range+'</b>';
    if(t.stats.slow) statHtml+='<i>Slow</i><b>'+Math.round(t.stats.slow*100)+'%</b>';
    if(t.stats.splash) statHtml+='<i>Splash</i><b>'+t.stats.splash+'</b>';
    if(t.stats.burn) statHtml+='<i>Burn</i><b>'+t.stats.burn+'/s</b>';
    if(t.stats.aura) statHtml+='<i>Aura</i><b>'+Math.round(t.stats.aura*100)+'%</b>';
    if(t.stats.run) statHtml+='<i>Lane run</i><b>'+t.stats.run+'t</b>';
    statHtml+='</div>';
    const actions = nextLv
      ? '<div class="insp-actions"><button class="ok" id="btn-upg">'+nextLv.name+' &middot; '+nextLv.cost+'</button>' +
        '<button class="no" id="btn-sell">Sell '+b.sellValue(t)+'</button></div>'
      : '<div class="insp-actions"><button class="ok dim">MAXED</button>' +
        '<button class="no" id="btn-sell">Sell '+b.sellValue(t)+'</button></div>';
    ins.innerHTML='' +
      '<h3>'+def.name+' <span class="lv">'+(t.lv===0?'MK I':t.lv===1?'MK II':'MK III')+'</span></h3>' +
      '<div class="role">'+def.elem.toUpperCase()+' &middot; '+def.role+'</div>' +
      statHtml + actions +
      '<div class="desc">'+def.desc+'</div>';
    if(nextLv){
      const bu=ins.querySelector('#btn-upg');
      bu.addEventListener('click', ()=>{ b.upgrade(t); });
      if(b.gold<nextLv.cost) bu.classList.add('dim');
    }
    ins.querySelector('#btn-sell').addEventListener('click', ()=>{ b.sell(t); });
  }
  closeInspector(){ qs('#inspector').classList.add('hidden'); }
  hint(msg){ const h=qs('#build-hint'); h.classList.remove('hidden');
    qs('#hint-text').textContent=msg; }
  unHint(){ qs('#build-hint').classList.add('hidden'); }
  refreshCd(){
    const b=this.env.battle; if(!b) return;
    for(const e of document.querySelectorAll('.abil')){
      const id=e.dataset.ab;
      const cd=Math.max(0, b.abilCd?.[id] ?? 0);
      const full=e.querySelector('.cd');
      const max=id==='prism'?26:30;
      full.style.setProperty('--cd', Math.min(1,cd/max).toFixed(3));
      full.textContent=cd>0?Math.ceil(cd):'';
      e.classList.toggle('charged', cd<=0);
    }
  }
}

POLY.UI = UI;
})();
