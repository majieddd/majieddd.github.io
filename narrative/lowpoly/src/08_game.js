/* 08 game. Holds the global state object and the fixed-timestep master loop.
   Drives waves, economy, level up, and victory/defeat. No DOM here; the UI
   module is a separate listener. */
(function(){
  const LP=window.LP;
  const Data=LP.Data, Sim=LP.Sim, Art=LP.Art, Map=LP.Map, Audio=LP.Audio;
  const clamp=LP.clamp, lerp=LP.lerp;

  // Global state
  const G={
    faction:"human", map:null, path:null, mask:null, maskW:0, maskH:0,
    towers:[], enemies:[], projs:[], particles:[],
    gold:120, lives:20, score:0, kills:0, leaks:0,
    wave:0, waveT:0, wavePending:0, between:7, // seconds until next wave
    paused:false, speed:1,
    status:"intro", // "intro" | "play" | "win" | "lose"
    selected:null, // tower preset key
    _accumulator:0, _lastT:0, _frame:0
  };
  LP.G=G;
  LP.towers=G.towers; LP.enemies=G.enemies; LP.projs=G.projs; LP._explosions=[];

  // ---- Game setup ----
  function setFaction(f){G.faction=f; LP.faction=f; document.documentElement.style.setProperty("--fc", (LP.FAC[f]||LP.FAC.human).mid);}
  function loadMap(mapId){
    const map=Data.MAPS.find(m=>m.id===mapId)||Data.MAPS[0];
    G.map=map; LP.MAP=map;
    G.path=Map.bakePath(map); LP.PATH=G.path;
    const bm=Map.buildableMask(map); G.mask=bm.mask; G.maskW=bm.w; G.maskH=bm.h;
    LP.BUILD=bm;
    // reset
    G.towers.length=0; G.enemies.length=0; G.projs.length=0; LP._explosions.length=0;
    G.gold=120; G.lives=20; G.score=0; G.kills=0; G.leaks=0;
    G.wave=0; G.waveT=0; G.wavePending=0; G.between=7; G.status="play";
    if(LP.Render && LP.Render.refreshCam) LP.Render.refreshCam();
    // BG music
    Audio.bgmSet(0.2);
    // Start the master loop if it isn't already running
    if(!G._running){G._running=true; G._lastT=0; requestAnimationFrame(tick);}
  }
  function placeTower(tx,tz){
    if(G.status!=="play")return false;
    if(!G.mask[tz*G.maskW+tx])return false;
    const preset=Art.TOWER_PRESETS[G.selected];
    if(!preset)return false;
    if(G.gold<preset.cost){UI.toast("Not enough credits");return false;}
    // Reject if another tower is already here
    const T=LP.TILE; const wx=tx*T+T/2, wz=tz*T+T/2;
    for(const t of G.towers){if(Math.hypot(t.x-wx,t.z-wz)<T*0.7)return false;}
    G.gold-=preset.cost;
    const t={
      x:wx, z:wz, preset, kit: Art.makeTowerMeshes(preset),
      cooldown:0, fireInterval:preset.fireInterval, range:preset.range, damage:preset.damage,
      level:0, target:null, _targIdx:-1, hover:false, alive:true
    };
    G.towers.push(t);
    Audio.coin();
    Audio.click();
    return true;
  }
  function upgradeSelected(){
    if(!G._selTower)return;
    const t=G._selTower; const cost=Data.upgradeCost(t);
    if(G.gold<cost){UI.toast("Need "+cost+" credits");return;}
    if(t.level>=3){UI.toast("Max level");return;}
    G.gold-=cost; t.level++;
    const s=Data.upgradeStats(t);
    t.damage=s.damage; t.range=s.range; t.fireInterval=s.fireInterval;
    Audio.coin();
  }
  function sellSelected(){
    if(!G._selTower)return;
    const t=G._selTower; G.gold+=Data.sellRefund(t);
    G.towers.splice(G.towers.indexOf(t),1); G._selTower=null;
    Audio.coin();
  }

  // ---- Master loop ----
  function tick(now){
    if(!G._lastT) G._lastT=now;
    const rawDt=Math.min(0.05,(now-G._lastT)/1000);
    G._lastT=now;
    if(!G.paused&&G.status==="play"){
      G._accumulator += rawDt * G.speed;
      const STEP=1/60;
      while(G._accumulator>=STEP){
        step(STEP);
        G._accumulator-=STEP;
      }
    }
    UI.updateHUD();
    LP.Render.frame(now);
    requestAnimationFrame(tick);
  }
  function step(dt){
    G.waveT+=dt;
    // Wave manager
    if(G.wave>=Data.WAVES.length){
      // win
      if(G.enemies.every(e=>!e.alive)&&G._explosions.length===0){
        G.status="win"; Audio.win(); UI.showEnd("win"); return;
      }
    } else {
      const w=Data.WAVES[G.wave];
      if(G.wavePending===0){
        G.between-=dt;
        if(G.between<=0){
          G.wavePending=1; G.waveT=0; G._waveSpawns=w.spawns.slice();
          Audio.waveStart();
          Audio.bgmSet(0.5+Math.min(0.5,G.wave*0.05));
        }
      } else {
        // walk spawns
        let acc=0;
        for(const s of G._waveSpawns){
          if(s._done)continue;
          acc += s.gap;
          if(G.waveT >= acc + (s.offset||0)){
            // spawn this one
            const start=G.path[0];
            const e=Sim.makeEnemy(s.enemy,start.x,start.z,G.path,0,{hpMult:1+G.wave*0.10, speedMult:1+G.wave*0.02});
            G.enemies.push(e);
            s._remaining=(s._remaining||s.count)-1;
            if(s._remaining<=0) s._done=true;
            // re-insert with its gap+offset 0 so it keeps firing
            s.offset=0;
          }
        }
        if(G._waveSpawns.every(s=>s._done)){
          // wait for the last enemy to die OR leak before next wave
          if(G.enemies.every(e=>!e.alive)){
            G.wave++; G.wavePending=0; G.between=Math.max(4,8-G.wave*0.2); G.waveT=0;
            // wave bonus
            const bonus=20+G.wave*4;
            G.gold+=bonus; G.score+=bonus*2; Audio.coin();
          }
        }
      }
    }
    // Update entities
    for(const e of G.enemies) Sim.updateEnemy(e,dt);
    // Check for leak (alive enemies that reached end)
    for(const e of G.enemies){
      if(e.alive && e.reached){
        e.alive=false; G.lives--; G.leaks++; Audio.lose(); // sub
        if(G.lives<=0){ G.status="lose"; UI.showEnd("lose"); return; }
      }
    }
    // Remove dead/done (compact in place, no per-step array allocation).
    {
      let w=0;
      for(let r=0;r<G.enemies.length;r++){
        const e=G.enemies[r];
        if(e.alive||e.dying<1) G.enemies[w++]=e;
      }
      G.enemies.length=w;
    }
    for(const t of G.towers) Sim.updateTower(t,dt,G.enemies,LP.now());
    for(const p of G.projs) if(!p.dead) Sim.updateProj(p,dt);
    {
      let w=0;
      for(let r=0;r<G.projs.length;r++){ const p=G.projs[r]; if(!p.dead) G.projs[w++]=p; }
      G.projs.length=w;
    }
    // Score for kills (and tally intensity in the same pass).
    let alive=0;
    for(const e of G.enemies){
      if(e.alive) alive++;
      else if(!e._counted){ e._counted=true; G.kills++; G.score+=e.bounty; G.gold+=e.bounty*0.4|0; }
    }
    Audio.bgmSet(clamp(0.2 + alive*0.04, 0.2, 0.95));
  }
  // Bridge: UI module reads LP, sets callbacks. We avoid a circular require by exposing a UI namespace now.
  const UI=LP.UI={};
  // Exposed actions
  LP.Actions={setFaction,loadMap,placeTower,upgradeSelected,sellSelected,start:()=>{G.status="play";G._lastT=0;requestAnimationFrame(tick);}};
  // Public step for the verifier (bypasses rAF entirely; deterministic).
  LP.step=function(n){for(let i=0;i<(n||1);i++)step(1/60);};
  LP.bootReady=true;
})();
