/* 03 art. 2.5D low-poly mesh factory. Every tower, enemy, projectile, particle
   is built from a small set of triangle strips + flat shading, then the
   faction palette is laid on as painted cel bands (Neon Reliquary discipline).
   Animations are pure functions of (mesh, phase, t) so they can be unit-tested
   without a renderer. */
(function(){
  const LP=window.LP;
  const PAL=LP.PAL, FAC=LP.FAC;
  const lerp=LP.lerp, clamp=LP.clamp, mix=LP.mix, shade=LP.shade, tint=LP.tint, hex=LP.hex;

  // 3D helpers. Mesh is {verts:[{x,y,z}], tris:[[a,b,c]], edges:[[a,b]], colors:['#hex']}
  // Drawing projects (x,y,z) -> screen with iso projection + per-frame camera.
  function v3(x,y,z){return {x,y,z};}
  function box(w,h,d){
    const x=w/2,y=h/2,z=d/2;
    return {verts:[
      v3(-x,-y,-z),v3(x,-y,-z),v3(x,y,-z),v3(-x,y,-z), // back 0..3
      v3(-x,-y, z),v3(x,-y, z),v3(x,y, z),v3(-x,y, z)  // front 4..7
    ],tris:[
      [0,1,2],[0,2,3],   // back
      [4,5,6],[4,6,7],   // front
      [0,1,5],[0,5,4],   // bottom
      [3,2,6],[3,6,7],   // top
      [0,3,7],[0,7,4],   // left
      [1,2,6],[1,6,5]    // right
    ],edges:[
      [0,1],[1,2],[2,3],[3,0],
      [4,5],[5,6],[6,7],[7,4],
      [0,4],[1,5],[2,6],[3,7]
    ]};
  }
  // Triangular prism (4-vert top + 4-vert bottom + 8 tris), used for gothic spires
  function prism(r,h){
    return {verts:[
      v3(0,0,-r),v3(r*0.866,0,-r*0.5),v3(r*0.866,0,r*0.5),v3(0,0,r),v3(-r*0.866,0,r*0.5),v3(-r*0.866,0,-r*0.5),
      v3(0,h,0) // apex
    ],tris:[
      [0,1,2],[0,2,3],[0,3,4],[0,4,5], // base (fans)
      [1,6,2],[2,6,3],[3,6,4],[4,6,5],[5,6,0],[0,6,1]
    ],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,6],[1,6],[2,6],[3,6],[4,6],[5,6]]};
  }
  // A diamond (octahedron) : used for ammo, faction crests, decoration
  function diamond(r){
    return {verts:[
      v3(0,-r,0),v3(0,r,0), // top/bottom (y is up)
      v3(-r,0,0),v3(r,0,0),
      v3(0,0,-r),v3(0,0,r)
    ],tris:[
      [0,2,4],[0,4,3],[0,3,5],[0,5,2],
      [1,4,2],[1,3,4],[1,5,3],[1,2,5]
    ],edges:[[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5]]};
  }
  // Pyramid (square base, 4-vert apex) : used for towers & buildings
  function pyramid(r,h){
    return {verts:[
      v3(-r,0,-r),v3(r,0,-r),v3(r,0,r),v3(-r,0,r),v3(0,h,0)
    ],tris:[[0,1,4],[1,2,4],[2,3,4],[3,0,4],[0,2,1],[0,3,2]],
      edges:[[0,1],[1,2],[2,3],[3,0],[0,4],[1,4],[2,4],[3,4]]};
  }
  // Stacked "totem" : base box + roof prism, used for several towers
  function totem(w,h,roofR){
    const b=box(w,h*0.6,w); const p=prism(roofR,h*0.5);
    // lift prism by h*0.6
    p.verts=p.verts.map(v=>v3(v.x,v.y+h*0.6,v.z));
    return {verts:b.verts.concat(p.verts),tris:b.tris.concat(p.tris.map(t=>[t[0]+8,t[1]+8,t[2]+8])),
      edges:b.edges.concat(p.edges.map(e=>[e[0]+8,e[1]+8]))};
  }

  // ISO projection. (x,z) = ground, y = up. camera fixed at (0,30,0) looking at origin from south-west.
  // To keep things readable we use a slight tilt: 30deg from vertical, 45deg yaw.
  // Screen coords: sx = (x - z) * COS, sy = (x + z) * SIN - y.
  const ISO_COS=Math.cos(Math.PI/6)*1.0, ISO_SIN=Math.sin(Math.PI/6)*1.0;
  function project(v,cam){
    const x=v.x-cam.x, z=v.z-cam.z, y=v.y;
    return {x:(x-z)*ISO_COS+cam.sx, y:(x+z)*ISO_SIN - y + cam.sy, z:y};
  }

  // Painted cel band shading: per-tri face normal -> brightness 0..1 -> mix(face, shadow, t).
  // For a single light source from upper-left.
  function triNormal(verts,tris,idx){
    const a=verts[tris[idx][0]],b=verts[tris[idx][1]],c=verts[tris[idx][2]];
    const ux=b.x-a.x, uy=b.y-a.y, uz=b.z-a.z;
    const vx=c.x-a.x, vy=c.y-a.y, vz=c.z-a.z;
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    const l=Math.hypot(nx,ny,nz)||1;
    return {x:nx/l,y:ny/l,z:nz/l};
  }
  const LIGHT={x:-0.5,y:0.8,z:0.4};
  function lightDot(n){return clamp(0.35+0.65*Math.max(0,n.x*LIGHT.x+n.y*LIGHT.y+n.z*LIGHT.z),0,1);}

  // Pre-build shaded tri lists. Returns array of {pts:[{x,y}], light:0..1, fill, stroke}.
  // light is used at draw time to mix the tri's fill colour (cel banding).
  function bake(mesh, fill, stroke, fillRamp){
    fillRamp=fillRamp||[shade(fill,0.85),fill,tint(fill,0.18)];
    const out=[];
    for(let i=0;i<mesh.tris.length;i++){
      const n=triNormal(mesh.verts,mesh.tris,i);
      const t=lightDot(n);
      // cel band: snap to 3 bands
      const band=t<.35?0:(t<.7?1:2);
      out.push({tris:mesh.tris[i],normal:n,fill:fillRamp[band]});
    }
    out.stroke=stroke; out.mesh=mesh;
    return out;
  }

  // Walk pose: biped/quadruped. phase in [0,1). Returns {legL,legR,armL,armR,bob,bend}.
  // Pure function; bounds checked in tests.
  function walkPose(speed, ph){
    const s=speed;
    const a=Math.sin(ph*Math.PI*2)*s;
    return {legL: clamp(a,-1,1), legR: clamp(-a,-1,1),
            armL: clamp(-a*0.7,-1,1), armR: clamp(a*0.7,-1,1),
            bob: clamp(0.5+0.5*Math.cos(ph*Math.PI*4)*s,0,1),
            bend: clamp(0.4+0.3*Math.sin(ph*Math.PI*2),0,1)};
  }
  // Idle pose: gentle bob and a slow rotation. Pure function.
  function idlePose(t){
    return {bob:0.5+0.5*Math.sin(t*1.8), sway:Math.sin(t*1.1)*0.08, yaw:Math.sin(t*0.7)*0.04};
  }
  // Fire pose: snap recoil then settle. Pure function.
  function firePose(cooldown,max){
    const ph=cooldown/max;
    if(ph>=1)return {recoil:0};
    return {recoil:Math.sin(ph*Math.PI)*0.9};
  }

  // ---------- Tower factory ----------
  // Each tower = {name, id, cost, range, fireInterval, damage, splash, projSpeed, palette, kind, draw(t,phase,ctx)}
  // We bake the meshes up front so render path is allocation-free.
  // `id` is the stable handle used by the dock and the test API.
  // `kind` is the broad "this is a human faction tower" semantic used by art
  // to pick the right mesh kit; the dock and placement use `id`, not `kind`.
  const TOWER_PRESETS={
    // HUMAN: pulse laser battery (cyan)
    pulse:    {id:"pulse",    name:"PULSE",    cost:60,  range:130, fireInterval:0.55, damage:8,  splash:0,   projSpeed:780, kind:"human", faction:"human", projKind:"laser"},
    // FEDERATION: prism of light (gold)
    prism:    {id:"prism",    name:"PRISM",    cost:110, range:160, fireInterval:0.85, damage:16, splash:28,  projSpeed:520, kind:"splash", faction:"light", projKind:"sphere"},
    // XENO: violet thorn that pierces
    thorn:    {id:"thorn",    name:"THORN",    cost:90,  range:150, fireInterval:0.70, damage:14, splash:0,   projSpeed:980, kind:"pierce", faction:"xeno",  projKind:"spike"},
    // PIRATE: red cannon, slow, big splash
    mortar:   {id:"mortar",   name:"MORTAR",   cost:140, range:220, fireInterval:1.40, damage:34, splash:54,  projSpeed:340, kind:"splash", faction:"pirate",projKind:"shell"},
    // PARALLEL: chrome gauss rail (machine)
    gauss:    {id:"gauss",    name:"GAUSS",    cost:160, range:200, fireInterval:0.42, damage:11, splash:0,   projSpeed:1200,kind:"fast",  faction:"parallel",projKind:"slug"},
    // HUMAN/FED: cryo beam (slows)
    cryo:     {id:"cryo",     name:"CRYO",     cost:130, range:140, fireInterval:0.60, damage:7,  splash:18,  projSpeed:0,   kind:"beam", faction:"human",   projKind:"beam"},
    // XENO/PIRATE: poison spore (DoT)
    spore:    {id:"spore",    name:"SPORE",    cost:100, range:120, fireInterval:0.80, damage:4,  splash:0,   projSpeed:260, kind:"dot",  faction:"xeno",    projKind:"spore"},
    // HUMAN/PARALLEL: Tesla arc (chains)
    tesla:    {id:"tesla",    name:"TESLA",    cost:200, range:170, fireInterval:1.20, damage:22, splash:0,   projSpeed:0,   kind:"chain",faction:"parallel",projKind:"arc"}
  };
  // Build a mesh kit per tower preset. Returns {base, top, barrel, anim hooks}.
  function makeTowerMeshes(preset){
    const f=FAC[preset.faction];
    if(preset.kind==="human"||preset.kind==="splash"||preset.kind==="fast"||preset.kind==="dot"||preset.kind==="pierce"||preset.kind==="chain"){
      // Generic totem: box base + pyramid roof + diamond floating topper (crystal)
      const baseMesh=totem(28,22,18);
      const roofMesh=pyramid(14,18);
      const topMesh=diamond(8);
      return {
        base: bake(baseMesh, f.deep, f.ink, [shade(f.deep,0.6),f.mid,tint(f.mid,0.25)]),
        roof: bake(roofMesh, f.mid, f.ink, [shade(f.mid,0.55),f.mid,tint(f.mid,0.30)]),
        top:  bake(topMesh, f.accent, f.ink, [f.accent,tint(f.accent,0.20),f.accent]),
        faction:f
      };
    } else if(preset.kind==="beam"){
      const baseMesh=box(34,18,34);
      const dishMesh=box(40,4,40);
      return {
        base: bake(baseMesh, f.deep, f.ink, [shade(f.deep,0.6),f.mid,tint(f.mid,0.30)]),
        roof: bake(dishMesh, f.mid, f.ink, [shade(f.mid,0.6),f.mid,tint(f.mid,0.30)]),
        top:  bake(diamond(7), f.accent, f.ink, [f.accent,tint(f.accent,0.18),f.accent]),
        faction:f
      };
    }
    return null;
  }

  // ---------- Enemy factory ----------
  // Each enemy = {name, kind, hp, speed, armor, palette, draw(ctx, e, ph)}
  // Kinds: "drone" (small), "grunt" (medium biped), "tank" (heavy), "swarm" (tiny fast), "boss" (large)
  const ENEMY_PRESETS={
    crawler:  {name:"CRAWLER",  hp:38,   speed:38,  armor:0, kind:"grunt",    bounty:4,  size:14, faction:"pirate",   accent:"#ef4444"},
    drone:    {name:"DRONE",    hp:18,   speed:62,  armor:0, kind:"drone",    bounty:2,  size:11, faction:"parallel", accent:"#94a3b8"},
    xenosw:   {name:"XENO SWARM",hp:12,  speed:74,  armor:0, kind:"swarm",    bounty:2,  size:9,  faction:"xeno",     accent:"#7c3aed"},
    sledger:  {name:"SLEDGER",  hp:120,  speed:22,  armor:3, kind:"tank",     bounty:14, size:18, faction:"pirate",   accent:"#dc2626"},
    seraph:   {name:"SERAPH",   hp:80,   speed:50,  armor:1, kind:"grunt",    bounty:9,  size:15, faction:"light",    accent:"#fbbf24"},
    impaler:  {name:"IMPALER",  hp:64,   speed:56,  armor:0, kind:"grunt",    bounty:7,  size:14, faction:"xeno",     accent:"#a855f7"},
    ranger:   {name:"RANGER",   hp:46,   speed:70,  armor:0, kind:"drone",    bounty:6,  size:13, faction:"human",    accent:"#0ea5e9"},
    overlord: {name:"OVERLORD", hp:880,  speed:18,  armor:8, kind:"boss",     bounty:160,size:30, faction:"xeno",     accent:"#ff2fd6"},
    revenant: {name:"REVENANT", hp:240,  speed:34,  armor:4, kind:"tank",     bounty:22, size:20, faction:"pirate",   accent:"#fb923c"},
    oracle:   {name:"ORACLE",   hp:160,  speed:48,  armor:2, kind:"drone",    bounty:16, size:16, faction:"light",    accent:"#fde68a"},
    knight:   {name:"KNIGHT",   hp:200,  speed:30,  armor:6, kind:"tank",     bounty:18, size:19, faction:"human",    accent:"#38e8ff"},
    viper:    {name:"VIPER",    hp:54,   speed:82,  armor:0, kind:"swarm",    bounty:6,  size:11, faction:"xeno",     accent:"#7c3aed"}
  };
  function makeEnemyMesh(p){
    const f=FAC[p.faction]||FAC.parallel;
    if(p.kind==="drone"){
      const m=box(p.size,p.size*0.7,p.size);
      return bake(m, f.deep, f.ink, [shade(f.deep,0.5),f.mid,tint(f.mid,0.30)]);
    }
    if(p.kind==="grunt"){
      // biped: torso box + head diamond
      const torso=box(p.size*1.4,p.size,p.size*0.8);
      const head=diamond(p.size*0.55);
      // shift head up
      head.verts=head.verts.map(v=>v3(v.x,v.y+p.size*0.7,v.z));
      return {tris:torso.tris.concat(head.tris.map(t=>[t[0]+8,t[1]+8,t[2]+8])),
        verts:torso.verts.concat(head.verts), edges:torso.edges.concat(head.edges.map(e=>[e[0]+8,e[1]+8])),
        bands:[
          bake(torso, f.deep, f.ink, [shade(f.deep,0.55),f.mid,tint(f.mid,0.25)]),
          bake(head,  p.accent||f.accent, f.ink, [shade(p.accent||f.accent,0.6),p.accent||f.accent,tint(p.accent||f.accent,0.30)])
        ], faction:f, accent:p.accent, kind:p.kind};
    }
    if(p.kind==="tank"){
      const base=box(p.size*1.8,p.size*0.8,p.size*1.2);
      const top=box(p.size*1.1,p.size*0.6,p.size*0.8);
      top.verts=top.verts.map(v=>v3(v.x,v.y+p.size*0.7,v.z));
      return {tris:base.tris.concat(top.tris.map(t=>[t[0]+8,t[1]+8,t[2]+8])),
        verts:base.verts.concat(top.verts), edges:base.edges.concat(top.edges.map(e=>[e[0]+8,e[1]+8])),
        bands:[
          bake(base, f.deep, f.ink, [shade(f.deep,0.55),f.mid,tint(f.mid,0.22)]),
          bake(top,  f.mid, f.ink, [shade(f.mid,0.55),f.mid,tint(f.mid,0.30)])
        ], faction:f, accent:p.accent, kind:p.kind};
    }
    if(p.kind==="swarm"){
      const m=diamond(p.size*0.9);
      return {tris:m.tris,verts:m.verts,edges:m.edges,
        bands:[bake(m, p.accent, f.ink, [shade(p.accent,0.5),p.accent,tint(p.accent,0.30)])],
        faction:f, accent:p.accent, kind:p.kind};
    }
    if(p.kind==="boss"){
      // large biped with crown
      const torso=box(p.size*1.4,p.size*1.6,p.size);
      const head=diamond(p.size*0.7);
      head.verts=head.verts.map(v=>v3(v.x,v.y+p.size*0.9,v.z));
      const crown=prism(p.size*0.6,p.size*0.5);
      crown.verts=crown.verts.map(v=>v3(v.x,v.y+p.size*1.4,v.z));
      const verts=torso.verts.concat(head.verts,crown.verts);
      const tris=torso.tris.concat(head.tris.map(t=>[t[0]+8,t[1]+8,t[2]+8]))
        .concat(crown.tris.map(t=>[t[0]+15,t[1]+15,t[2]+15]));
      const edges=torso.edges.concat(head.edges.map(e=>[e[0]+8,e[1]+8])).concat(crown.edges.map(e=>[e[0]+15,e[1]+15]));
      return {tris,verts,edges,
        bands:[
          bake(torso, f.deep, f.ink, [shade(f.deep,0.55),f.mid,tint(f.mid,0.22)]),
          bake(head,  p.accent, f.ink, [p.accent,tint(p.accent,0.25),p.accent]),
          bake(crown, "#fbbf24", f.ink, ["#fbbf24","#fde68a","#fffbeb"])
        ], faction:f, accent:p.accent, kind:p.kind};
    }
    return null;
  }

  // Projectile mesh: a small diamond.
  function makeProjectileMesh(kind,fac){
    const m=diamond(4);
    return bake(m, fac.accent, fac.ink, [fac.accent,fac.light,fac.mid]);
  }

  // Particle sprite: soft glow (we draw a filled disc with a radial fill, no image).
  function glowSprite(ctx,x,y,r,color,alpha){
    if(!isFinite(x)||!isFinite(y)||!isFinite(r))return;
    r=Math.max(0.1,r);
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    const c=hex(color);
    g.addColorStop(0,LP.rgba(c[0],c[1],c[2],alpha));
    g.addColorStop(0.5,LP.rgba(c[0],c[1],c[2],alpha*0.45));
    g.addColorStop(1,LP.rgba(c[0],c[1],c[2],0));
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  }

  // ----- Drawers -----
  function drawMesh(ctx,baked,cam,offset,scale,rotY){
    const m=baked.mesh||baked; // single-bake or raw mesh
    if(!m||!m.tris)return;
    // Per-vertex project. rotY rotates around y axis.
    const cosR=Math.cos(rotY||0), sinR=Math.sin(rotY||0);
    const projVerts=m.verts.map(v=>{
      const x=v.x*cosR+v.z*sinR, z=-v.x*sinR+v.z*cosR;
      return project({x:x*scale+offset.x,y:v.y*scale+offset.y,z:z*scale+offset.z},cam);
    });
    // Painter's: sort by avg z (back-to-front) within this mesh
    const order=m.tris.map((t,i)=>{
      const tz=(projVerts[t[0]].z+projVerts[t[1]].z+projVerts[t[2]].z)/3;
      // If bands present (multi-bake), look up the fill from bands
      const bands=baked.bands;
      return {i,tz,bandsIdx: bands? 0 : i};
    }).sort((a,b)=>a.tz-b.tz);
    const bands=baked.bands;
    for(const o of order){
      const t=m.tris[o.i];
      const a=projVerts[t[0]],b=projVerts[t[1]],c=projVerts[t[2]];
      let fill="#888";
      if(bands){
        // map original tri index -> band
        const originalIdx=o.i;
        let bi=0, acc=0;
        for(;bi<bands.length;bi++){
          const cnt=bands[bi].mesh.tris.length;
          if(originalIdx<acc+cnt)break;
          acc+=cnt;
        }
        const band=bands[bi];
        const localIdx=originalIdx-acc;
        const ln=band.mesh? band.mesh.tris[localIdx]: null;
        if(ln){
          const n=triNormal(band.mesh.verts,band.mesh.tris,localIdx);
          const tt=lightDot(n);
          const idx=tt<.35?0:(tt<.7?1:2);
          fill=band.fill[idx];
        } else fill=band.fill[1];
      } else {
        const ln=baked.mesh.tris[o.i];
        const n=triNormal(baked.mesh.verts,baked.mesh.tris,o.i);
        const tt=lightDot(n);
        const idx=tt<.35?0:(tt<.7?1:2);
        fill=baked.fill[idx];
      }
      ctx.fillStyle=fill;
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.closePath(); ctx.fill();
    }
    // Painted outline: trace silhouette via edges
    ctx.lineWidth=Math.max(1,1.4*scale);
    ctx.strokeStyle=(bands? bands[bands.length-1].stroke : baked.stroke)||"#0a0e17";
    ctx.lineJoin="round";
    // Only stroke visible edges (skip backfacing)
    for(const e of m.edges){
      const v1=projVerts[e[0]], v2=projVerts[e[1]];
      // Skip edges where both endpoints face away from camera (cheap check: z of midpoint)
      const mz=(v1.z+v2.z)/2;
      if(mz<-0.3)continue;
      ctx.beginPath(); ctx.moveTo(v1.x,v1.y); ctx.lineTo(v2.x,v2.y); ctx.stroke();
    }
  }

  // Public draw for an enemy (with its mesh + phase + walk pose)
  function drawEnemy(ctx,e,cam){
    const m=e.mesh; if(!m)return;
    const pose=walkPose(e.moving?0.7:0.2,e.ph||0);
    const scale=1; const offset={x:e.x,y:0,z:e.y}; // y is ground
    // Bob
    const bobY=-Math.abs(Math.sin((e.ph||0)*Math.PI*2))*3*pose.bob;
    drawMesh(ctx,m,cam,offset,scale,e.rotY||0);
    // HP bar above head (always 2D for legibility)
    const head=project({x:e.x,y:30,z:e.y},cam);
    const w=Math.max(22,e.hpMax*0.18);
    const pct=clamp(e.hp/e.hpMax,0,1);
    ctx.fillStyle="rgba(7,10,16,0.85)"; ctx.fillRect(head.x-w/2-1,head.y-7,w+2,5);
    ctx.fillStyle=LP.PAL.hp; ctx.fillRect(head.x-w/2,head.y-6,w*pct,3);
  }

  // Public draw for a tower. offset is world ground, rotY comes from facing target.
  function drawTower(ctx,t,cam,t0){
    const kit=t.kit; if(!kit)return;
    const id=idlePose(t0*0.001 + t.x*0.01 + t.z*0.02);
    const scale=1;
    const recoil=firePose(t.cooldown||0,t.fireInterval);
    const recoilZ=(recoil.recoil||0)*6;
    // base (no rotation)
    drawMesh(ctx,kit.base,cam,{x:t.x,y:0,z:t.z},scale,0);
    // roof: rotate slowly
    drawMesh(ctx,kit.roof,cam,{x:t.x,y:0,z:t.z+recoilZ*0.5},scale,id.yaw);
    // top: float and bob
    const topY=22+id.bob*2.5;
    drawMesh(ctx,kit.top,cam,{x:t.x,y:topY,z:t.z+recoilZ*0.7},scale,id.yaw*2);
    // faction banner chip floating above (small flat 2D)
    const head=project({x:t.x,y:46,z:t.z},cam);
    if(head.x>-50&&head.x<ctx.canvas.width+50){
      ctx.fillStyle=kit.faction.mid; ctx.beginPath();
      ctx.moveTo(head.x,head.y-4); ctx.lineTo(head.x+12,head.y);
      ctx.lineTo(head.x,head.y+4); ctx.closePath(); ctx.fill();
    }
    // Range ring on hover
    if(t.hover){
      const c=project({x:t.x,y:0.1,z:t.z},cam);
      const rpx=t.range*ISO_COS*2*0.55;
      ctx.strokeStyle=kit.faction.mid; ctx.globalAlpha=0.45;
      ctx.setLineDash([4,4]); ctx.lineWidth=1.2; ctx.beginPath(); ctx.ellipse(c.x,c.y,rpx,rpx*0.5,0,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
    }
    // Level pip dots
    const c=project({x:t.x,y:0,z:t.z},cam);
    for(let i=0;i<t.level;i++){
      ctx.fillStyle=kit.faction.accent; ctx.beginPath(); ctx.arc(c.x-6+i*6,c.y+22,1.6,0,Math.PI*2); ctx.fill();
    }
  }

  // Projectile drawer (small diamond + glow)
  function drawProjectile(ctx,p,cam){
    const head=project({x:p.x,y:14+Math.sin(p.t*0.02)*2,z:p.y},cam);
    glowSprite(ctx,head.x,head.y,12,p.color,0.55);
    ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(head.x,head.y,2.4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,0.55)"; ctx.lineWidth=0.6; ctx.stroke();
  }

  // Beam (between two points, fades quickly)
  function drawBeam(ctx,a,b,color,t,life){
    const pa=project({x:a.x,y:14,z:a.y},cam);
    const pb=project({x:b.x,y:14,z:b.y},cam);
    const alpha=clamp(1-t/life,0,1);
    const c=hex(color);
    // outer glow
    ctx.strokeStyle=LP.rgba(c[0],c[1],c[2],alpha*0.35);
    ctx.lineWidth=10; ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke();
    // core
    ctx.strokeStyle=LP.rgba(255,255,255,alpha*0.85);
    ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke();
  }

  // Ground tile
  function drawTile(ctx,x,z,col,cam,opts){
    opts=opts||{};
    const T=LP.TILE;
    const A=project({x:x,y:0,z:z},cam);
    const B=project({x:x+T,y:0,z:z},cam);
    const C=project({x:x+T,y:0,z:z+T},cam);
    const D=project({x:x,y:0,z:z+T},cam);
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.lineTo(C.x,C.y); ctx.lineTo(D.x,D.y); ctx.closePath(); ctx.fill();
    if(opts.edge){
      ctx.strokeStyle=opts.edge; ctx.lineWidth=0.8;
      ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.lineTo(C.x,C.y); ctx.lineTo(D.x,D.y); ctx.closePath(); ctx.stroke();
    }
  }

  // TILE size is set by module 05 (which loads later) before any draw.
  LP.TILE=64;

  // Expose
  LP.Art={
    box,prism,diamond,pyramid,totem,
    project,triNormal,lightDot,bake,
    walkPose,idlePose,firePose,
    TOWER_PRESETS,ENEMY_PRESETS,
    makeTowerMeshes,makeEnemyMesh,makeProjectileMesh,
    drawMesh,drawEnemy,drawTower,drawProjectile,drawBeam,drawTile,glowSprite,
    setTile:(t)=>{LP.TILE=t;},
  };
})();
