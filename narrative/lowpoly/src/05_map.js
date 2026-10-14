/* 05 map. Builds the world from a map id: tile grid, path polyline (in world units),
   the buildable mask (path radius +1 = blocked), and a baked background sky/ground. */
(function(){
  const LP=window.LP;
  const TILE=46; // px
  LP.TILE=TILE;
  LP.Art.setTile(TILE);
  const Art=LP.Art;
  const project=Art.project;

  // Convert a path of tile units to world px, returns array of {x,z}.
  function bakePath(map){
    const T=TILE;
    const pts=map.path.map(p=>({x:p.x*T,z:p.z*T}));
    // Densify by linearly interpolating adjacent points so enemies move along a polyline
    // with reasonable step size, not a long line jump.
    const seg=20; // px between sampled points
    const out=[];
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i],b=pts[i+1];
      const d=Math.hypot(b.x-a.x,b.z-a.z);
      const n=Math.max(1,Math.ceil(d/seg));
      for(let k=0;k<n;k++){
        const t=k/n;
        out.push({x:LP.lerp(a.x,b.x,t), z:LP.lerp(a.z,b.z,t)});
      }
    }
    out.push(pts[pts.length-1]);
    return out;
  }

  // Buildable mask: a tile is buildable iff the closest path segment is more than
  // (path half-width + tower half-size + safety margin) away. 22px matches the
  // 32px rendered path width with a 4px buffer on each side.
  function buildableMask(map){
    const T=TILE;
    const pathWorld=map.path.map(p=>({x:p.x*T,z:p.z*T}));
    const w=map.w, h=map.h;
    const minDist=22; // px
    const mask=new Uint8Array(w*h);
    for(let z=0;z<h;z++){
      for(let x=0;x<w;x++){
        const wx=x*T+T/2, wz=z*T+T/2;
        let best=Infinity;
        for(let i=0;i<pathWorld.length-1;i++){
          const a=pathWorld[i],b=pathWorld[i+1];
          const dx=b.x-a.x, dz=b.z-a.z, l2=dx*dx+dz*dz;
          let t=0; if(l2>0)t=Math.max(0,Math.min(1,((wx-a.x)*dx+(wz-a.z)*dz)/l2));
          const px=a.x+dx*t, pz=a.z+dz*t;
          const d=Math.hypot(wx-px,wz-pz);
          if(d<best)best=d;
        }
        mask[z*w+x]=(best>=minDist)?1:0;
      }
    }
    return {mask,w,h};
  }

  // Build a one-time sky+ground bake into the supplied canvas. Returns its size.
  // (Not used in the live render loop, but kept for tooling that wants a poster.)
  function buildBackdrop(map,fac,canvas){
    const ctx=canvas.getContext("2d");
    const w=map.w*TILE+160, h=map.h*TILE+160;
    canvas.width=w; canvas.height=h;
    // Wet oil sky: vertical gradient with two large soft blobs (cel banding)
    const g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,"#04060a");
    g.addColorStop(0.45,fac.deep);
    g.addColorStop(0.85,"#0a0e17");
    g.addColorStop(1,"#000000");
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    drawDistantPlanet(ctx,w*0.78,h*0.18,Math.min(w,h)*0.18,fac);
    drawDistantPlanet(ctx,w*0.18,h*0.55,Math.min(w,h)*0.10,fac);
    // Star noise (seeded by map id so re-runs are deterministic)
    const rng=LP.rngOf("sky-"+map.id);
    for(let i=0;i<220;i++){
      const x=rng()*w, y=rng()*h*0.7;
      const a=0.15+rng()*0.6;
      ctx.fillStyle=LP.rgba(255,255,255,a);
      ctx.beginPath(); ctx.arc(x,y,rng()*1.4+0.2,0,Math.PI*2); ctx.fill();
    }
    // Big gothic silhouette of spires in the deep distance
    ctx.fillStyle=LP.mix(fac.deep,"#000000",0.6);
    ctx.beginPath(); ctx.moveTo(0,h*0.82);
    let x=0;
    while(x<w){
      const bw=20+rng()*60;
      const bh=20+rng()*90;
      ctx.lineTo(x,h*0.82-bh*0.4);
      ctx.lineTo(x+bw*0.3,h*0.82-bh);
      ctx.lineTo(x+bw,h*0.82-bh*0.6);
      x+=bw;
    }
    ctx.lineTo(w,h*0.82); ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.closePath(); ctx.fill();
    // Vaporwave horizon line
    ctx.strokeStyle=LP.mix(fac.mid,"#ffffff",0.4); ctx.globalAlpha=0.35; ctx.lineWidth=1.2;
    ctx.beginPath();
    for(let sx=0;sx<=w;sx+=12){
      const sy=h*0.78+Math.sin(sx*0.02)*8+Math.sin(sx*0.08)*2;
      if(sx===0)ctx.moveTo(sx,sy);else ctx.lineTo(sx,sy);
    }
    ctx.stroke(); ctx.globalAlpha=1;
    return {w,h};
  }
  function drawDistantPlanet(x,y,r,fac){
    const g=ctx.createRadialGradient(x-r*0.3,y-r*0.3,r*0.1,x,y,r);
    g.addColorStop(0,LP.tint(fac.mid,0.4));
    g.addColorStop(0.55,fac.mid);
    g.addColorStop(1,fac.deep);
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    // Painted rim shadow
    ctx.strokeStyle=LP.mix(fac.deep,"#000000",0.3); ctx.lineWidth=2; ctx.stroke();
  }

  // Path stroke (painted cel-shaded ribbon)
  function drawPath(ctx,path,fac,cam){
    // Outer wet-oil band
    ctx.lineWidth=42; ctx.lineCap="round"; ctx.lineJoin="round";
    ctx.strokeStyle=LP.mix(fac.deep,"#000000",0.2); ctx.globalAlpha=0.85;
    ctx.beginPath();
    const p0=project(path[0],cam); ctx.moveTo(p0.x,p0.y);
    for(let i=1;i<path.length;i++){const p=project(path[i],cam); ctx.lineTo(p.x,p.y);}
    ctx.stroke();
    // Mid
    ctx.lineWidth=32; ctx.globalAlpha=1;
    ctx.strokeStyle=LP.mix(fac.mid,fac.deep,0.3);
    ctx.beginPath(); ctx.moveTo(p0.x,p0.y);
    for(let i=1;i<path.length;i++){const p=project(path[i],cam); ctx.lineTo(p.x,p.y);}
    ctx.stroke();
    // Inner highlight
    ctx.lineWidth=18;
    ctx.strokeStyle=LP.mix(fac.mid,"#ffffff",0.25);
    ctx.beginPath(); ctx.moveTo(p0.x,p0.y);
    for(let i=1;i<path.length;i++){const p=project(path[i],cam); ctx.lineTo(p.x,p.y);}
    ctx.stroke();
    // Filigree edge (engraved linework: dashed)
    ctx.lineWidth=1.2; ctx.setLineDash([3,4]); ctx.globalAlpha=0.55;
    ctx.strokeStyle=LP.tint(fac.accent,0.3);
    ctx.beginPath(); ctx.moveTo(p0.x,p0.y);
    for(let i=1;i<path.length;i++){const p=project(path[i],cam); ctx.lineTo(p.x,p.y);}
    ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=1;
  }

  // Core (the thing you defend)
  function drawCore(ctx,fac,cam){
    const core={x:(LP.MAP.w-1)*LP.TILE, y:0, z:Math.floor(LP.MAP.h/2)*LP.TILE+LP.TILE/2};
    // Hexagonal pad
    const c=project(core,cam);
    const r=LP.TILE*0.6;
    ctx.save(); ctx.translate(c.x,c.y);
    ctx.fillStyle=LP.mix(fac.deep,"#000000",0.3); ctx.beginPath();
    for(let i=0;i<6;i++){const a=i*Math.PI/3+Math.PI/6;const x=Math.cos(a)*r,y=Math.sin(a)*r*0.55;ctx.lineTo(x,y);}
    ctx.closePath(); ctx.fill();
    ctx.fillStyle=LP.mix(fac.mid,fac.accent,0.4);
    ctx.beginPath();
    for(let i=0;i<6;i++){const a=i*Math.PI/3+Math.PI/6;const x=Math.cos(a)*r*0.65,y=Math.sin(a)*r*0.4;ctx.lineTo(x,y);}
    ctx.closePath(); ctx.fill();
    // Painted core crystal (large diamond drawn as a 2D iso projection)
    ctx.fillStyle=fac.accent;
    ctx.beginPath();
    ctx.moveTo(0,-r*0.5); ctx.lineTo(r*0.3,0); ctx.lineTo(0,r*0.5); ctx.lineTo(-r*0.3,0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=fac.ink; ctx.lineWidth=1.4; ctx.stroke();
    // Glow halo
    const g=ctx.createRadialGradient(0,0,1,0,0,r*1.2);
    g.addColorStop(0,LP.rgba(...LP.hex(fac.accent),0.6));
    g.addColorStop(1,LP.rgba(...LP.hex(fac.accent),0));
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,r*1.2,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  LP.Map={TILE,bakePath,buildableMask,buildBackdrop,drawPath,drawCore};
})();
