/* 06 sim. Pure logic, no DOM. Fixed-timestep update, deterministic from the
   state object. Targets the *closest enemy on the path ahead of the tower*
   (Bloons-style: target picks the unit whose current path position index is
   largest, with range check). Projectile = travelling point that hits and
   applies damage + optional splash + optional DoT. */
(function(){
  const LP=window.LP;
  const E=LP.Art.ENEMY_PRESETS;
  const Art=LP.Art;
  const clamp=LP.clamp, lerp=LP.lerp;

  // Enemy update: move along path by speed*dt. When reaches the end, deal core
  // damage equal to its current hp (or fixed: enemy.maxHp*0.1 : the latter
  // feels better; we use a per-enemy value).
  function makeEnemy(preset, x, z, path, idx, mods){
    mods=mods||{};
    return {
      preset, mesh: Art.makeEnemyMesh(preset),
      x, z, path, idx,  // idx is current waypoint index in path
      ph: Math.random(),  // walk phase
      moving: true, rotY: 0,
      hp: (preset.hp*(mods.hpMult||1))|0,
      hpMax: (preset.hp*(mods.hpMult||1))|0,
      armor: preset.armor,
      speed: preset.speed*(mods.speedMult||1),
      slowUntil: 0, slowFactor: 1,
      dot: 0, dotKind: null, dotUntil: 0,
      alive: true, dying: 0, // dying t (0..1)
      bounty: preset.bounty,
      size: preset.size
    };
  }
  function updateEnemy(e, dt){
    if(!e.alive){ e.dying=Math.min(1,e.dying+dt*2.5); return; }
    const slow = e.slowFactor<1 && e.slowUntil>LP.now()/1000;
    const sp = e.speed * (slow? e.slowFactor: 1);
    // Step: move toward the next waypoint at speed*dt px.
    const target=e.path[e.idx+1];
    if(!target){ e.alive=false; e.reached=true; return; }
    const dx=target.x-e.x, dz=target.z-e.z, d=Math.hypot(dx,dz);
    if(d<sp*dt){ e.x=target.x; e.z=target.z; e.idx++; }
    else { e.x+=dx/d*sp*dt; e.z+=dz/d*sp*dt; e.rotY=Math.atan2(dx,dz); }
    e.ph = (e.ph + dt*sp*0.018) % 1;
    if(e.slowUntil && e.slowUntil<LP.now()/1000) e.slowFactor=1;
    if(e.dot && e.dotUntil>LP.now()/1000){
      const dmg=e.dot*dt;
      e.hp-=dmg; if(e.hp<=0){e.alive=false; return;}
    } else e.dot=0;
  }

  // Tower update. Targets enemy with the highest path-progress within range.
  function updateTower(t, dt, enemies, t0){
    if(!t.alive)return;
    t.cooldown=Math.max(0,(t.cooldown||0)-dt);
    // pick target
    if(!t.target || !t.target.alive || t.target.idx<t._targIdx-1 || !inRange(t, t.target)){
      t.target=null;
      let bestIdx=-1, bestE=null;
      for(const e of enemies){
        if(!e.alive)continue;
        if(!inRange(t,e))continue;
        if(e.idx>bestIdx){bestIdx=e.idx;bestE=e;}
      }
      t.target=bestE; t._targIdx=bestIdx;
    }
    if(t.target && t.cooldown<=0){
      fire(t,t.target);
      t.cooldown=t.fireInterval;
    }
  }
  function inRange(t,e){
    return Math.hypot(t.x-e.x,t.z-e.z)<=t.range;
  }
  function fire(t, e){
    const dmg=t.damage;
    // Beam (cryo) : instant
    if(t.preset.projKind==="beam"){
      LP.Audio.fire();
      t._beam={ax:t.x,ay:t.z,bx:e.x,by:e.z,life:0.18,t:0,color:t.kit.faction.accent};
      e.hp-=dmg;
      if(t.preset.kind==="beam"){e.slowUntil=LP.now()/1000+1.0;e.slowFactor=0.45;}
      if(e.hp<=0){e.alive=false; return;}
    } else if(t.preset.projKind==="arc"){
      // Tesla chain
      LP.Audio.fire();
      const primary={ax:t.x,ay:t.z,bx:e.x,by:e.z,life:0.25,t:0,color:LP.PAL.cyan};
      const others=enemies.filter(o=>o!==e&&o.alive&&Math.hypot(o.x-e.x,o.z-e.z)<90).slice(0,1);
      t._beam=primary; t._beam2=others[0]?{ax:e.x,ay:e.z,bx:others[0].x,by:others[0].z,life:0.25,t:0,color:LP.PAL.cyan}:null;
      e.hp-=dmg;
      if(others[0])others[0].hp-=dmg*0.6;
      [e,...others].forEach(o=>{if(o.hp<=0)o.alive=false;});
    } else {
      // Projectile
      LP.Audio.fire();
      const proj={
        x:t.x, y:t.z, tx:e.x, tz:e.z, speed:t.preset.projSpeed||520,
        dmg, splash:t.preset.splash, kind:t.preset.projKind, color:t.kit.faction.accent, t:0
      };
      LP.projs.push(proj);
    }
  }
  function updateProj(p, dt){
    p.t+=dt;
    const dx=p.tx-p.x, dz=p.tz-p.y, d=Math.hypot(dx,dz);
    if(d<4){
      // Hit: re-acquire target by current position because the original
      // target may have moved while the projectile was in flight, and
      // several towers may converge on the same enemy.
      LP.Audio.hurt();
      const near=LP.enemies.filter(e=>e.alive && Math.hypot(e.x-p.x,e.z-p.y)<=p.splash);
      if(near.length>0){
        if(p.kind==="sphere"||p.kind==="shell") LP.Audio.explode();
        for(const e of near){
          const dist=Math.hypot(e.x-p.x,e.z-p.y);
          // Falloff: 100% at 0..22, scales down to 50% at splash edge
          const fall = 1 - clamp((dist-22)/Math.max(1,p.splash-22), 0, 1)*0.5;
          e.hp-=p.dmg*fall;
          if(p.kind==="spore"){e.dot=p.dmg*0.4;e.dotUntil=LP.now()/1000+3;}
          if(e.hp<=0)e.alive=false;
        }
      } else {
        // Splash=0 or shell that overshot: pick the closest live enemy to
        // the impact and apply full damage. Use a generous tolerance
        // (60px covers the diameter of one tile) so converging-fire works.
        let best=null, bestD=Infinity;
        for(const e of LP.enemies){
          if(!e.alive)continue;
          const dist=Math.hypot(e.x-p.x,e.z-p.y);
          if(dist<bestD){bestD=dist;best=e;}
        }
        if(best && bestD<60){
          if(p.kind==="shell") LP.Audio.explode();
          best.hp-=p.dmg;
          if(p.kind==="spore"){best.dot=p.dmg*0.4;best.dotUntil=LP.now()/1000+3;}
          if(best.hp<=0)best.alive=false;
        } else if(p.kind==="shell"){
          // Detonate anyway in case enemies are nearby
          LP.Audio.explode();
          const miss=LP.enemies.filter(e=>e.alive && Math.hypot(e.x-p.x,e.z-p.y)<=p.splash*0.6);
          miss.forEach(e=>{e.hp-=p.dmg*0.4; if(e.hp<=0)e.alive=false;});
        }
      }
      p.dead=true;
      LP._explosions.push({x:p.x,z:p.y,r:Math.max(8,p.splash),color:p.color,t:0,life:0.4});
      return;
    }
    p.x+=dx/d*p.speed*dt; p.y+=dz/d*p.speed*dt;
  }

  // Public
  LP.Sim={makeEnemy,updateEnemy,updateTower,updateProj,inRange,fire};
})();
