/* 07 render. Owns the main canvas, the camera, and the per-frame draw loop.
   Three-layer composite: backdrop -> world -> entities -> particles -> UI overlay.
   Time-stamped painters, no per-frame allocations on the hot path. */
(function(){
  const LP=window.LP;
  const Art=LP.Art;
  // Allocate canvases
  const stage=document.getElementById("stage");
  const canvas=document.createElement("canvas");
  canvas.id="game";
  stage.appendChild(canvas);
  const ctx=canvas.getContext("2d",{alpha:false});
  let DPR=Math.max(1,Math.min(2,window.devicePixelRatio||1));

  function resize(){
    DPR=Math.max(1,Math.min(2,window.devicePixelRatio||1));
    const w=window.innerWidth, h=window.innerHeight;
    canvas.style.width=w+"px"; canvas.style.height=h+"px";
    canvas.width=Math.floor(w*DPR); canvas.height=Math.floor(h*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    LP.VIEW={w,h};
  }
  window.addEventListener("resize",resize);
  resize();

  // Camera: world origin centred, offset chosen by map size.
  function makeCam(){
    const T=LP.TILE||46;
    const map=LP.MAP||{w:14,h:9};
    // Centre the map in the view, with HUD space on the right.
    const dockW=240; const topH=58; const botH=84;
    const worldW=map.w*T, worldH=map.h*T;
    const view=LP.VIEW||{w:1280,h:720};
    const availW=view.w - dockW - 20;
    const availH=view.h - topH - botH;
    const scale=Math.min(availW/worldW, availH/worldH, 1.3);
    const camX=worldW/2, camZ=worldH/2;
    const sx=(view.w - dockW)/2 - (camX - camZ)*Art.ISO_COS*scale;
    const sy=view.h/2 + 32 - (camX + camZ)*Art.ISO_SIN*scale;
    return {x:camX,z:camZ,sx,sy,scale,shade:0};
  }
  let cam=makeCam();
  function refreshCam(){ cam=makeCam(); }
  window.addEventListener("resize",refreshCam);

  // Tile pass
  function drawTiles(){
    const map=LP.MAP;
    const T=LP.TILE;
    const fac=LP.FAC[LP.faction]||LP.FAC.human;
    const rng=LP.rngOf(map.id);
    for(let z=0;z<map.h;z++){
      for(let x=0;x<map.w;x++){
        const c=tileCol(x,z,fac,rng);
        Art.drawTile(ctx,x*T,z*T,c,cam);
      }
    }
    // Buildable highlight: thin band on edges
    ctx.save();
    ctx.strokeStyle=LP.mix(fac.accent,"#ffffff",0.25); ctx.globalAlpha=0.4; ctx.lineWidth=0.6;
    for(let z=0;z<map.h;z++){
      for(let x=0;x<map.w;x++){
        if(!LP.BUILD.mask[z*map.w+x])continue;
        const A=Art.project({x:x*T,y:0,z:z*T},cam);
        const B=Art.project({x:x*T+T,y:0,z:z*T},cam);
        const C=Art.project({x:x*T+T,y:0,z:z*T+T},cam);
        const D=Art.project({x:x*T,y:0,z:z*T+T},cam);
        ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.lineTo(C.x,C.y); ctx.lineTo(D.x,D.y); ctx.closePath(); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function tileCol(x,z,fac,rng){
    const n=LP.noise2d(x*0.55+12.3,z*0.55-7.1);
    const m=LP.noise2d(x*0.13-3.2,z*0.16+1.7);
    const t=clamp(0.5+0.5*n+0.25*m,0,1);
    return LP.mix(LP.mix(fac.deep,"#000000",0.55),LP.mix(fac.deep,fac.mid,0.18),t);
  }
  function clamp(x,a,b){return x<a?a:x>b?b:x;}

  // Draw an isometric shadow disc beneath a unit
  function drawShadow(x,z,r,alpha){
    const c=Art.project({x,y:0.5,z},cam);
    const rr=r*cam.scale*Art.ISO_COS*1.4;
    ctx.fillStyle="rgba(0,0,0,"+alpha+")";
    ctx.beginPath(); ctx.ellipse(c.x,c.y+2,rr,rr*0.45,0,0,Math.PI*2); ctx.fill();
  }

  // Main draw
  function frame(t0){
    if(!LP.MAP)return;
    const fac=LP.FAC[LP.faction]||LP.FAC.human;
    // Sky/ground : we draw a soft gradient per frame (cheap; backdrop is heavy)
    const g=ctx.createLinearGradient(0,0,0,LP.VIEW.h);
    g.addColorStop(0,"#04060a");
    g.addColorStop(0.45,fac.deep);
    g.addColorStop(0.85,"#0a0e17");
    g.addColorStop(1,"#000000");
    ctx.fillStyle=g; ctx.fillRect(0,0,LP.VIEW.w,LP.VIEW.h);
    // Distant nebula
    const neb=ctx.createRadialGradient(LP.VIEW.w*0.78,LP.VIEW.h*0.18,5,LP.VIEW.w*0.78,LP.VIEW.h*0.18,LP.VIEW.h*0.55);
    neb.addColorStop(0,LP.rgba(...LP.hex(fac.mid),0.45));
    neb.addColorStop(0.5,LP.rgba(...LP.hex(fac.deep),0.18));
    neb.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=neb; ctx.fillRect(0,0,LP.VIEW.w,LP.VIEW.h);
    drawDistantPlanet(LP.VIEW.w*0.18,LP.VIEW.h*0.32,LP.VIEW.h*0.18,fac);
    drawDistantPlanet(LP.VIEW.w*0.86,LP.VIEW.h*0.18,LP.VIEW.h*0.10,fac);
    drawStars(t0);

    drawTiles();
    // Path
    LP.Map.drawPath(ctx, LP.PATH, fac, cam);
    // Decor
    for(const d of (LP.MAP.decor||[])) drawDecor(d,fac,t0);
    // Core
    LP.Map.drawCore(ctx, fac, cam);
    // Towers
    for(const t of LP.towers){
      drawShadow(t.x,t.z,18,0.45);
      Art.drawTower(ctx,t,cam,t0);
    }
    // Enemies
    for(const e of LP.enemies){
      if(!e.alive && e.dying>=1)continue;
      drawShadow(e.x,e.z,e.size*0.8,0.40);
      Art.drawEnemy(ctx,e,cam);
      if(e.slowFactor<1 && e.slowUntil>LP.now()/1000) drawSlowOverlay(e);
    }
    // Projectiles
    for(const p of LP.projs){
      if(!p.dead) Art.drawProjectile(ctx,p,cam);
    }
    // Beams (cryo, tesla)
    for(const t of LP.towers){
      if(t._beam){
        t._beam.t += 1/60;
        if(t._beam.t<t._beam.life) Art.drawBeam(ctx,{x:t._beam.ax,z:t._beam.ay},{x:t._beam.bx,z:t._beam.by},t._beam.color,t._beam.t,t._beam.life);
        else t._beam=null;
      }
      if(t._beam2){
        t._beam2.t += 1/60;
        if(t._beam2.t<t._beam2.life) Art.drawBeam(ctx,{x:t._beam2.ax,z:t._beam2.ay},{x:t._beam2.bx,z:t._beam2.by},t._beam2.color,t._beam2.t,t._beam2.life);
        else t._beam2=null;
      }
    }
    // Explosions
    for(const ex of LP._explosions){
      ex.t += 1/60;
      const a=1-ex.t/ex.life;
      const c=LP.hex(ex.color);
      const r=ex.r*(0.6+0.6*(1-a));
      Art.glowSprite(ctx,Art.project({x:ex.x,y:6,z:ex.z},cam).x, Art.project({x:ex.x,y:6,z:ex.z},cam).y, r*1.5, ex.color, a*0.5);
      ctx.strokeStyle=LP.rgba(c[0],c[1],c[2],a*0.6); ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(Art.project({x:ex.x,y:6,z:ex.z},cam).x, Art.project({x:ex.x,y:6,z:ex.z},cam).y, r, 0, Math.PI*2); ctx.stroke();
    }
    LP._explosions=LP._explosions.filter(ex=>ex.t<ex.life);

    // Hover ghost
    if(LP.hover&&LP.hover.buildable){
      const T=LP.TILE;
      const ghost=Art.drawTile;
      ctx.save(); ctx.globalAlpha=0.55;
      const t=LP.towerSel? LP.Art.TOWER_PRESETS[LP.towerSel] : null;
      if(t){
        const fac2=LP.FAC[t.faction]||fac;
        ctx.fillStyle=LP.rgba(...LP.hex(fac2.mid),0.45);
        Art.drawTile(ctx,LP.hover.tx*T,LP.hover.tz*T,LP.rgba(...LP.hex(fac2.mid),0.30),cam);
        // Range circle
        const c=Art.project({x:LP.hover.tx*T+T/2,y:0,z:LP.hover.tz*T+T/2},cam);
        const rpx=t.range*Art.ISO_COS*2*0.55;
        ctx.strokeStyle=LP.rgba(...LP.hex(fac2.mid),0.7); ctx.lineWidth=1.2;
        ctx.setLineDash([4,4]); ctx.beginPath(); ctx.ellipse(c.x,c.y,rpx,rpx*0.5,0,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }
    if(LP.hover&&!LP.hover.buildable&&LP.towerSel){
      const T=LP.TILE;
      ctx.save(); ctx.globalAlpha=0.35;
      ctx.fillStyle="rgba(239,68,68,0.35)";
      Art.drawTile(ctx,LP.hover.tx*T,LP.hover.tz*T,"rgba(239,68,68,0.30)",cam);
      ctx.restore();
    }
  }
  function drawDistantPlanet(x,y,r,fac){
    const g=ctx.createRadialGradient(x-r*0.3,y-r*0.3,r*0.1,x,y,r);
    g.addColorStop(0,LP.tint(fac.mid,0.4));
    g.addColorStop(0.55,fac.mid);
    g.addColorStop(1,fac.deep);
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=LP.mix(fac.deep,"#000000",0.3); ctx.lineWidth=1.5; ctx.stroke();
  }
  const starRng=LP.rngOf("stars-stable");
  const starPos=[];
  for(let i=0;i<160;i++){starPos.push({x:starRng()*2000,y:starRng()*800,a:0.15+starRng()*0.7,r:starRng()*1.4+0.2,p:starRng()*Math.PI*2});}
  function drawStars(t){
    for(const s of starPos){
      const a=s.a*(0.6+0.4*Math.sin(t*0.0008+s.p));
      ctx.fillStyle=LP.rgba(255,255,255,a);
      ctx.beginPath(); ctx.arc(s.x%LP.VIEW.w, s.y%LP.VIEW.h*0.7, s.r, 0, Math.PI*2); ctx.fill();
    }
  }
  function drawDecor(d,fac,t0){
    if(d.kind==="crystal"){
      const c=Art.project({x:d.x*LP.TILE+LP.TILE/2,y:0,z:d.z*LP.TILE+LP.TILE/2},cam);
      const b=LP.noise2d(d.x*0.5,t0*0.0003)*4;
      ctx.save();
      ctx.translate(c.x,c.y-12-b);
      const m=Art.diamond(7);
      Art.drawMesh(ctx,Art.bake(m,fac.accent,fac.ink,[LP.mix(fac.accent,"#000000",0.6),fac.accent,LP.tint(fac.accent,0.2)]),cam,{x:0,y:0,z:0},1,t0*0.0006);
      ctx.restore();
    } else if(d.kind==="star"){
      const c=Art.project({x:d.x*LP.TILE+LP.TILE/2,y:0,z:d.z*LP.TILE+LP.TILE/2},cam);
      Art.glowSprite(ctx,c.x,c.y,18,fac.mid,0.45);
    }
  }
  function drawSlowOverlay(e){
    const c=Art.project({x:e.x,y:0.5,z:e.z},cam);
    ctx.fillStyle="rgba(125,211,252,0.35)"; ctx.beginPath();
    ctx.ellipse(c.x,c.y+2,e.size*1.4,e.size*0.7,0,0,Math.PI*2); ctx.fill();
  }

  // Public
  LP.Render={frame,canvas,cam,makeCam,resize,refreshCam};
})();
