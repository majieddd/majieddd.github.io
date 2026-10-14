/* ==========================================================================
   POLY PROTOCOL — geo.js
   Procedural low/medium-poly models: board, towers, enemies, relics.
   EVERYTHING is new art — nothing is shared with the 2D parent game —
   but the palette and material language follow the Neon Reliquary rules:
   void black ground, chrome greys, one faction hue dominant per asset,
   emissive seams, engraved linework.
   ========================================================================== */
'use strict';
(() => {
const P = POLY.PAINT, { hex } = P;

/* palette (as float rgb) */
const PAL = {
  void:   hex('#12091c'), void2: hex('#1b1026'), stone: hex('#2a2038'),
  stone2: hex('#332844'), stone3: hex('#3e3258'),
  chrome: hex('#94a3b8'), chrome2: hex('#5b6b81'), chrome3: hex('#3a4759'),
  black:  hex('#070a10'), ink:   hex('#e8f1fb'),
  cyan:   hex('#38e8ff'), cyanD: hex('#0b5d75'),
  mag:    hex('#ff2fd6'), magD:  hex('#7a1a68'),
  violet: hex('#a855f7'), violet2: hex('#6d28d9'),
  gold:   hex('#fbbf24'), goldD: hex('#8a5a10'),
  crimson:hex('#ef4444'), crimsonD: hex('#7c2410'),
  lime:   hex('#a3e635'), limeD: hex('#3f5f0b'),
  greensmoke: hex('#4ade80'), frost: hex('#8ab8ff'), frostD: hex('#1e3a72'),
  rust:   hex('#c2622f'), rustD: hex('#5c2d12')
};
/* shorthand: lighten/darken a rgb triple */
function light(c, t){ return P.mix(c, hex('#ffffff'), t); }
function dark(c, t){ return P.mix(c, hex('#05070c'), t); }
function jit(c, a){ return P.jitter(c, a); }

/* ── RIG: a named set of sub-meshes with per-frame pose functions ──── */
class Rig {
  constructor(engine){
    this.eng = engine; this.parts = [];   // {name, geo, base:[x,y,z], mesh}
  }
  part(name, geo, x,y,z, opts){
    const m = this.eng.add(geo, POLY.M4.trans(x,y,z), opts);
    const plate = this.eng.plates[this.eng.plates.length-1];
    if(!plate.mesh.__name) plate.mesh.__name='rig_'+name;
    this.parts.push({name, geo, base:[x||0,y||0,z||0], mesh:m, plate});
    return m;
  }
  /* pose(t, ent): apply transforms to parts — subclasses override */
  pose(t, ent){}
  setPose(name, fn){ this.fn = this.fn||{}; this.fn[name]=fn; }
  apply(t, ent){
    if(!this.fn) return;
    const world = ent.world || POLY.M4.ident();
    for(const p of this.parts){
      const f = this.fn[p.name];
      p.plate.model = POLY.M4.mul(world, f ? f(t, ent, p.base) : POLY.M4.trans(p.base[0],p.base[1],p.base[2]));
    }
  }
}

/* ── BOARD ──────────────────────────────────────────────────────────── */
/* Octagonal reliquary plate on a floating rock lattice. Path tiles are
   engraved channels with emissive lane seams. */
function buildBoard(eng, def, cells, pathSet, tex){
  const B = { X: 1.16, Z: 1.16, H: 0.5 };  // tile size, tile height
  const cols = def.cols, rows = def.rows;
  const W = cols*B.X + 3.4, D = rows*B.Z + 3.4;
  const g = new POLY.Geo();
  // base rock lattice (trapezoid chunk going down)
  const bCol = [0.09,0.075,0.13];
  for(let i=0;i<8;i++){
    g.box(0, -0.65 - i*0.42, 0, Math.max(2.2, W - i*0.9), 0.36, Math.max(2.2, D - i*0.9),
      jit(bCol, 0.02));
  }
  // slight taper — rely on box shrink; then the top plate
  const plate = new POLY.Geo();
  const hw = W/2, hd = D/2;
  const oct = [];
  const ch = Math.min(1.7, hw*0.34);
  oct.push([-hw+ch, -hd], [hw-ch, -hd], [hw, -hd+ch], [hw, hd-ch], [hw-ch, hd], [-hw+ch, hd], [-hw, hd-ch], [-hw, -hd+ch]);
  const topCol = [0.16, 0.13, 0.21];
  plate.extrude(oct, -0.34, 0, jit(topCol,0.012), [0.045,0.058,0.088]);
  // chrome trim ring on the rim
  const trim = new POLY.Geo();
  for(let i=0;i<16;i++){
    const t0 = i/16*Math.PI*2, t1=(i+1)/16*Math.PI*2;
    const cx=Math.cos(t0)*(hw-0.18), cz=Math.sin(t0)*(hd-0.18);
    trim.box(cx, -0.02, cz, 0.34, 0.16, 0.34, jit(PAL.chrome2,0.04));
  }
  // engraved rose-window at center: ring + spokes
  const rune = new POLY.Geo();
  rune.torus(0, 0.045, 0, Math.min(W,D)*0.16, 0.10, 40, 4, jit(PAL.chrome2,0.05));
  rune.torus(0, 0.045, 0, Math.min(W,D)*0.24, 0.07, 40, 3, jit(PAL.chrome3,0.02));
  for(let i=0;i<12;i++){
    const a = i/12*Math.PI*2;
    rune.box(Math.cos(a)*Math.min(W,D)*0.20, 0.045, Math.sin(a)*Math.min(W,D)*0.20,
      0.16, 0.1, 0.16, dark(PAL.chrome3, 0.1));
  }
  eng.add(plate, undefined, {});
  eng.add(trim, undefined, {});
  eng.add(rune, undefined, {});

  // ------- tiles (buildable + path) -------
  const tileGeo = new POLY.Geo();
  const pathTileGeo = new POLY.Geo();
  const lane = new POLY.Geo();   // emissive lane seams
  const x0 = -(cols-1)/2*B.X, z0 = -(rows-1)/2*B.Z;
  const cellMeta = [];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const x = x0 + c*B.X, z = z0 + r*B.Z;
    const onPath = pathSet.has(r*cols+c);
    const mk = (size, col) => {
      const t = new POLY.Geo();
      t.box(x, 0.14, z, B.X*size, 0.30, B.Z*size, jit(col, 0.018));
      t.box(x, 0.30, z, B.X*0.9*size, 0.055, B.Z*0.9*size, jit(light(col,0.05),0.02));
      return t;
    };
    if(onPath){
      const t = new POLY.Geo();
      // recessed channel
      t.box(x, 0.09, z, B.X*0.98, 0.20, B.Z*0.98, jit(PAL.void2, 0.02));
      t.box(x, 0.20, z, B.X*0.86, 0.05, B.Z*0.86, jit(dark(PAL.void2, 0.25), 0.015));
      eng.add(t, undefined, {});
      // lane halves: emissive seams on the two edges running with path dir
      cells.push({x,z,c,r, path:true});
    } else {
      const t = mk(1, PAL.stone);
      // engraved cell frame
      const f = new POLY.Geo();
      f.box(x, 0.335, z - B.Z*0.47, B.X*0.9, 0.02, B.Z*0.06, jit(dark(PAL.chrome3,0.18),0.02));
      f.box(x, 0.335, z + B.Z*0.47, B.X*0.9, 0.02, B.Z*0.06, jit(dark(PAL.chrome3,0.18),0.02));
      f.box(x - B.X*0.47, 0.335, z, B.X*0.06, 0.02, B.Z*0.9, jit(dark(PAL.chrome3,0.18),0.02));
      f.box(x + B.X*0.47, 0.335, z, B.X*0.06, 0.02, B.Z*0.9, jit(dark(PAL.chrome3,0.18),0.02));
      eng.add(t, undefined, {});
      eng.add(f, undefined, {});
      cells.push({x,z,c,r, path:false});
    }
  }
  // lane seam glow: thin emissive boxes along path cells (drawn last, emissive)
  const laneG = new POLY.Geo();
  const pathCells = cells.filter(cl=>cl.path);
  for(const cl of pathCells){
    laneG.box(cl.x, 0.245, cl.z, B.X*0.9, 0.03, B.Z*0.06, [0.02,0.05,0.09]);
    laneG.box(cl.x, 0.245, cl.z, B.X*0.06, 0.03, B.Z*0.9, [0.02,0.05,0.09]);
  }
  eng.add(laneG, undefined, {emis:0.0, glow:0.5});

  // ------- portal (spawn) -------
  const gate = buildPortal(eng, def.portalPos, def.laneDir);
  // ------- core (relic) -------
  const core = buildCore(eng, def.corePos, hex(def.faction || '#38e8ff'));

  return { B, x0, z0, cells, gate, core, plate:{W,D} };
}

/* The spawn gate: a gothic arch emitting the enemy lane */
function buildPortal(eng, pos, dir){
  const g = new POLY.Geo();
  const col = jit(PAL.black, 0.02);
  const colChrome = jit(PAL.chrome2, 0.05);
  // two pillars
  g.box(pos[0]-0.85, 0.9, pos[2], 0.5, 2.6, 0.5, col);
  g.box(pos[0]+0.85, 0.9, pos[2], 0.5, 2.6, 0.5, col);
  // arch segments
  for(let i=0;i<7;i++){
    const t=i/6;
    const a = Math.PI * t;
    const x = pos[0] - Math.cos(a)*0.85;
    const y = 0.9 + 1.3 + Math.sin(a)*0.85;
    g.box(x, y, pos[2], 0.42, 0.55, 0.46, col);
  }
  // neon seam on pillars
  const seam = new POLY.Geo();
  seam.box(pos[0]-0.85, 1.1, pos[2]-0.26, 0.09, 1.9, 0.05, [0.9,0.03,0.4], [0.9,0.03,0.4]);
  seam.box(pos[0]+0.85, 1.1, pos[2]-0.26, 0.09, 1.9, 0.05, [0.9,0.03,0.4], [0.9,0.03,0.4]);
  // eyeball core of the gate
  const eye = new POLY.Geo();
  eye.sph(pos[0], 1.45, pos[2], 0.26, 6, 8, [0.04,0.02,0.07], [0.24,0.05,0.26], [0.02,0.01,0.04]);
  eng.add(g, undefined, {});
  eng.add(seam, undefined, {emis:0.5, glow:0.7});
  eng.add(eye, undefined, {emis:0.3, glow:0.6});
  return { pos, eye:[pos[0],1.45,pos[2]] };
}

/* The Aegis Core: a gothic reliquary heart that towers defend */
function buildCore(eng, pos, fac){
  const g = new POLY.Geo();
  const base = jit(PAL.void2, 0.02);
  // stepped base
  for(let i=0;i<3;i++){
    const s = 2.6 - i*0.62;
    g.box(pos[0], 0.30+i*0.14, pos[2], s, 0.28, s, jit(dark(PAL.stone2, i*0.08),0.02));
  }
  // pillar arms
  for(let i=0;i<4;i++){
    const a = i/4*Math.PI*2 + Math.PI/4;
    const x = pos[0]+Math.cos(a)*0.95, z = pos[2]+Math.sin(a)*0.95;
    g.box(x, 1.7, z, 0.28, 2.6, 0.28, base);
    g.cone(x, 3.10, z, 0.22, 0.52, 5, jit(dark(PAL.chrome3,0.1),0.03));
  }
  // orb cradle
  const cradle = new POLY.Geo();
  cradle.torus(pos[0], 2.15, pos[2], 0.62, 0.13, 18, 4, jit(PAL.chrome2,0.06));
  cradle.torus(pos[0], 2.15, pos[2], 0.40, 0.09, 14, 4, jit(dark(PAL.chrome3,0.14),0.03));
  // the orb — faction-tinted, separate mesh for spin/pulse
  const orbG = new POLY.Geo();
  orbG.sph(pos[0], 2.15, pos[2], 0.15, 8, 10, dark(fac,0.35), fac, dark(fac,0.7));
  const haloG = new POLY.Geo();
  haloG.torus(pos[0], 2.15, pos[2], 0.34, 0.035, 22, 3, fac);
  eng.add(g, undefined, {});
  eng.add(cradle, undefined, {});
  const orbM = eng.add(orbG, undefined, {emis:0.30, glow:0.4});
  const haloM = eng.add(haloG, undefined, {emis:0.22, glow:0.35});
  return { pos, orbM, haloM };
}

/* ── TOWERS ─────────────────────────────────────────────────────────── */
/* Each tower = Rig of 2-3 sub-meshes. pose() rotates turrets, pitches
   barrels, recoils. All new silhouettes. */
function makeTowerRig(eng, id){
  const R = new Rig(eng);

  if(id === 'bolt'){
    // twin-rail autocannon on a low pedestal
    const base = new POLY.Geo();
    base.box(0,0.32,0, 1.05,0.5,1.05, jit(PAL.stone2,0.02));
    base.box(0,0.66,0, 0.62,0.34,0.62, jit(PAL.chrome3,0.03));
    base.cyl(0,0.30,0, 0.38,0.34,0.10, 6, jit(dark(PAL.chrome3,0.1),0.03));
    const _bp = eng.add(base, POLY.M4.trans(0,0,0), {name:'tbase_'+id});
    R.basePlate = _bp;
    const tur = new POLY.Geo();
    tur.box(0,1.0,0, 0.9,0.42,0.5, jit(PAL.chrome2,0.05));
    tur.box(0,1.02,-0.12, 0.34,0.2,0.34, jit(PAL.cyanD,0.03));
    // twin barrels
    tur.box(-0.13,0.96,0.42, 0.13,0.13,0.5, jit(PAL.chrome,0.04), [0.1,0.12,0.16]);
    tur.box(0.13,0.96,0.42, 0.13,0.13,0.5, jit(PAL.chrome,0.04), [0.1,0.12,0.16]);
    // muzzle greebles
    tur.box(-0.13,0.96,0.72, 0.17,0.17,0.10, dark(PAL.chrome3,0.1));
    tur.box(0.13,0.96,0.72, 0.17,0.17,0.10, dark(PAL.chrome3,0.1));
    const m = R.part('turret', tur, 0,0,0, {});
    R.fn = { turret: (t, ent, base) => {
      const v = ent.aim || [1,0,0];
      const yaw = Math.atan2(v[0], v[2]);
      const pitch = Math.atan2(-(v[1]||0)*0.5, Math.hypot(v[0],v[2]));
      const rec = -(ent.recoil||0);
      return POLY.M4.mul(POLY.M4.trans(base[0],base[1],base[2]),
        POLY.M4.mul(POLY.M4.trs(0,0,0, 0,yaw,0),
          POLY.M4.mul(POLY.M4.trs(0,0,0, pitch,0,0), POLY.M4.trans(0, rec, 0))));
    }};
    return R;
  }
  if(id === 'cryo'){
    // claw ring with suspended frost crystal
    const base = new POLY.Geo();
    base.box(0,0.3,0, 1.2,0.55,1.2, jit(PAL.stone2,0.02));
    for(let i=0;i<4;i++){
      const a=i/4*Math.PI*2 + Math.PI/4;
      base.box(Math.cos(a)*0.42, 0.72, Math.sin(a)*0.42, 0.22, 0.55, 0.22, jit(PAL.chrome3,0.04));
    }
    const _bp = eng.add(base, POLY.M4.trans(0,0,0), {name:'tbase_'+id});
    R.basePlate = _bp;;
    const claw = new POLY.Geo();
    claw.torus(0, 1.05, 0, 0.5, 0.09, 12, 4, jit(PAL.chrome2,0.06));
    for(let i=0;i<4;i++){
      const a=i/4*Math.PI*2+Math.PI/4;
      claw.cone(Math.cos(a)*0.62, 1.30, Math.sin(a)*0.62, 0.13, 0.46, 4, jit(PAL.chrome,0.05));
    }
    const stone = new POLY.Geo();
    // crystal: octahedron-ish
    stone.sph(0, 1.1, 0, 0.24, 3, 4, jit(PAL.frostD,0.05), light(PAL.frost,0.3), dark(PAL.frostD,0.1));
    const crystal = new POLY.Geo();
    const cs = 0.26;
    const vt = [ [0,cs*1.9,0],[0,-cs*1.9,0],
      [cs,0,cs],[-cs,0,cs],[-cs,0,-cs],[cs,0,-cs] ];
    const dk = dark(PAL.frostD,0.2), lt = light(PAL.frost,0.35);
    const pk = (a,b,c,col)=>crystal.tri(vt[a],vt[b],vt[c], col||jit(PAL.frost,0.06));
    pk(0,2,3,lt); pk(0,3,4); pk(0,4,5); pk(0,5,2);
    pk(1,3,2,dk); pk(1,4,3,dk); pk(1,5,4,dk); pk(1,2,5,dk);
    const mC = R.part('crystal', crystal, 0,0.0,0, {emis:0.3, glow:0.5});
    const mClaw = R.part('claw', claw, 0,0,0, {});
    R.fn = { crystal: (t,ent,base)=>{
        const spin = t*1.4;
        const bob = Math.sin(t*2.2)*0.06;
        return POLY.M4.trs(base[0], base[1]+bob, base[2], 0, spin, 0, 1);
      }, claw: (t,ent,base)=> POLY.M4.trans(base[0],base[1],base[2]) };
    return R;
  }
  if(id === 'mortar'){
    const base = new POLY.Geo();
    base.box(0,0.3,0, 1.15,0.6,1.15, jit(PAL.stone2,0.02));
    base.box(0,0.72,0, 0.8,0.42,0.8, jit(PAL.chrome3,0.03));
    // ammo rack
    base.box(0.42,0.92,0.34, 0.3,0.5,0.34, jit(PAL.rustD,0.04));
    const _bp = eng.add(base, POLY.M4.trans(0,0,0), {name:'tbase_'+id});
    R.basePlate = _bp;;
    const tube = new POLY.Geo();
    tube.cyl(0, 1.05, 0.1, 0.30, 0.34, 0.85, 8, jit(PAL.rust,0.05), dark(PAL.chrome3,0.05));
    tube.torus(0, 1.45, 0.1, 0.31, 0.05, 8, 4, jit(PAL.chrome2,0.05));
    tube.torus(0, 1.10, 0.1, 0.31, 0.05, 8, 4, jit(PAL.chrome2,0.05));
    tube.box(0, 1.52, 0.1, 0.5, 0.1, 0.5, dark(PAL.rustD,0.1));
    const mT = R.part('tube', tube, 0,0,0, {});
    R.fn = { tube: (t,ent,base)=>{
      const v = ent.aim || [0,0.6,1];
      const yaw = Math.atan2(v[0], v[2]);
      const pitch = -Math.atan2(v[1], Math.hypot(v[0],v[2]));
      const rec = (ent.recoil||0)*0.4;
      return POLY.M4.mul(POLY.M4.trans(base[0],base[1],base[2]),
        POLY.M4.mul(POLY.M4.trs(0,0,0, 0,yaw,0),
          POLY.M4.mul(POLY.M4.trs(0, 0.18, 0, pitch,0,0), POLY.M4.trans(0, rec, 0))));
    }};
    return R;
  }
  if(id === 'arc'){
    const base = new POLY.Geo();
    base.box(0,0.3,0, 1.1,0.55,1.1, jit(PAL.stone2,0.02));
    base.cyl(0, 0.62, 0, 0.4, 0.3, 0.5, 6, jit(PAL.chrome3,0.04));
    base.torus(0, 0.62, 0, 0.5, 0.08, 10, 4, jit(PAL.chrome2,0.05));
    const _bp = eng.add(base, POLY.M4.trans(0,0,0), {name:'tbase_'+id});
    R.basePlate = _bp;;
    const mast = new POLY.Geo();
    mast.box(0, 1.3, 0, 0.26, 1.5, 0.26, jit(PAL.chrome2,0.05));
    // coil rings
    for(let i=0;i<4;i++){
      mast.torus(0, 1.0+i*0.32, 0, 0.34-i*0.02, 0.06, 10, 4, jit(PAL.violet2,0.05));
    }
    // spark emitters
    mast.cone(0.34, 1.9, 0, 0.11, 0.5, 4, jit(PAL.chrome,0.05));
    mast.cone(-0.34, 1.9, 0, 0.11, 0.5, 4, jit(PAL.chrome,0.05));
    const core = new POLY.Geo();
    core.sph(0, 2.05, 0, 0.17, 5, 6, jit(PAL.violet,0.05), light(PAL.violet,0.5), dark(PAL.violet2,0.2));
    const mM = R.part('mast', mast, 0,0,0, {});
    const mC = R.part('core', core, 0,0,0, {emis:0.35, glow:0.55});
    R.fn = { mast: (t,ent,base)=> POLY.M4.trans(base[0],base[1],base[2]),
      core: (t,ent,base)=>{
        const pulse = 1 + Math.sin(t*6)*0.22;
        return POLY.M4.trs(base[0], base[1] + Math.sin(t*2.4)*0.05, base[2], 0, t*0.8, 0,
          pulse, pulse, pulse);
      } };
    return R;
  }
  if(id === 'pyre'){
    // pirate brazier-tank: cone nozzle
    const base = new POLY.Geo();
    base.box(0,0.3,0, 1.2,0.5,1.2, jit(PAL.stone2,0.02));
    // fuel tank
    base.cyl(0, 0.72, 0.1, 0.32, 0.32, 0.55, 8, jit(PAL.crimsonD,0.05));
    base.torus(0, 0.72, 0.1, 0.33, 0.05, 8, 3, jit(PAL.rust,0.05));
    const _bp = eng.add(base, POLY.M4.trans(0,0,0), {name:'tbase_'+id});
    R.basePlate = _bp;;
    const nozzle = new POLY.Geo();
    nozzle.cone(0, 1.05, 0.55, 0.24, 0.6, 6, jit(PAL.rustD,0.05));
    nozzle.cyl(0, 0.62, 0.25, 0.1, 0.14, 0.8, 6, jit(PAL.crimsonD,0.05));
    // pilot flame
    const flame = new POLY.Geo();
    flame.cone(0, 0.75, 0.62, 0.085, 0.22, 5, [1.0,0.55,0.12]);
    const mN = R.part('nozzle', nozzle, 0,0,0, {});
    const mF = R.part('flame', flame, 0,0,0, {emis:0.4, glow:0.6});
    R.fn = { nozzle: (t,ent,base)=>{
      const v = ent.aim || [0.7,0.05,0.7];
      const yaw = Math.atan2(v[0], v[2]);
      const pitch = Math.atan2(v[1]||0.05, Math.hypot(v[0],v[2]));
      return POLY.M4.mul(POLY.M4.trans(base[0],base[1],base[2]),
        POLY.M4.mul(POLY.M4.trs(0,0,0, 0,yaw,0), POLY.M4.trs(0,0,0, -pitch*0.8, 0, 0)));
    }, flame: (t,ent,base)=>{
      const v = ent.aim || [0.7,0.05,0.7];
      const yaw = Math.atan2(v[0], v[2]);
      const s = 1 + Math.sin(t*17)*0.28;
      return POLY.M4.mul(POLY.M4.trans(base[0],base[1],base[2]),
        POLY.M4.mul(POLY.M4.trs(0,0,0, 0,yaw,0), POLY.M4.trs(0,0,0,0,0,0, s, s*(1+Math.sin(t*23)*0.15), s)));
    } };
    return R;
  }
  if(id === 'toxin'){
    // xeno sac pod: pulsing organic
    const base = new POLY.Geo();
    base.box(0,0.3,0, 1.1,0.5,1.1, jit(PAL.stone2,0.02));
    // root tendrils
    for(let i=0;i<5;i++){
      const a=i/5*Math.PI*2;
      base.box(Math.cos(a)*0.4, 0.55, Math.sin(a)*0.4, 0.3, 0.4, 0.3, jit(PAL.greensmoke,0.08));
    }
    const _bp = eng.add(base, POLY.M4.trans(0,0,0), {name:'tbase_'+id});
    R.basePlate = _bp;;
    const sac = new POLY.Geo();
    sac.sph(0, 0.85, 0, 0.38, 6, 8, jit(PAL.limeD,0.06), jit(PAL.lime,0.06), dark(PAL.limeD,0.2));
    const pods = new POLY.Geo();
    for(let i=0;i<3;i++){
      const a=i/3*Math.PI*2;
      pods.sph(Math.cos(a)*0.34, 1.25, Math.sin(a)*0.34, 0.14, 4, 5, dark(PAL.lime,0.12));
    }
    const mS = R.part('sac', sac, 0,0,0, {emis:0.2, glow:0.4});
    const mP = R.part('pods', pods, 0,0,0, {emis:0.25, glow:0.45});
    R.fn = { sac: (t,ent,base)=>{
        const p = 1 + Math.sin(t*3.1)*0.08;
        return POLY.M4.trs(base[0], base[1]+Math.sin(t*3.1)*0.03, base[2], 0,0,0, p, 1.05 - Math.sin(t*3.1)*0.05, p);
      }, pods: (t,ent,base)=> POLY.M4.trs(base[0], base[1]+Math.sin(t*2.0+1.5)*0.05, base[2], 0, t*0.7, 0) };
    return R;
  }
  if(id === 'railgun'){
    const base = new POLY.Geo();
    base.box(0,0.3,0, 1.3,0.6,1.3, jit(PAL.stone2,0.02));
    base.box(0,0.7,0, 0.7,0.3,0.7, jit(PAL.chrome3,0.03));
    const _bp = eng.add(base, POLY.M4.trans(0,0,0), {name:'tbase_'+id});
    R.basePlate = _bp;;
    const rail = new POLY.Geo();
    rail.box(0, 1.15, 0, 0.72, 0.28, 1.3, jit(PAL.chrome2,0.05));
    // twin rails
    rail.box(-0.27, 1.34, 0.1, 0.09, 0.12, 1.5, jit(PAL.chrome,0.04));
    rail.box(0.27, 1.34, 0.1, 0.09, 0.12, 1.5, jit(PAL.chrome,0.04));
    // coils
    for(let i=0;i<3;i++){
      rail.torus(0, 1.34, -0.4+i*0.42, 0.36, 0.07, 8, 3, jit(PAL.greensmoke,0.05));
    }
    const orb = new POLY.Geo();
    orb.sph(0, 1.34, 0.78, 0.13, 4, 5, [0.25,0.9,0.4], [0.6,1,0.7], [0.05,0.3,0.12]);
    const mR = R.part('rail', rail, 0,0,0, {});
    const mO = R.part('orb', orb, 0,0,0, {emis:0.4, glow:0.6});
    R.fn = { rail: (t,ent,base)=>{
      const v = ent.aim || [0,0,1];
      const yaw = Math.atan2(v[0], v[2]);
      const rec = (ent.recoil||0)*0.5;
      return POLY.M4.mul(POLY.M4.trans(base[0],base[1],base[2]),
        POLY.M4.mul(POLY.M4.trs(0,0,0, 0,yaw,0), POLY.M4.trans(0,0,rec)));
    }, orb: (t,ent,base)=> {
      const v = ent.aim || [0,0,1];
      const yaw = Math.atan2(v[0], v[2]);
      const ch = ent.charge ?? 0;
      const p = 1 + ch*0.7;
      return POLY.M4.mul(POLY.M4.trans(base[0],base[1],base[2]),
        POLY.M4.mul(POLY.M4.trs(0,0,0,0,yaw,0), POLY.M4.trs(0,0,0,0,0,0,p,p,p)));
    } };
    return R;
  }
  if(id === 'orison'){
    // federation light: gold lens chalice, beam
    const base = new POLY.Geo();
    base.box(0,0.3,0, 1.15,0.55,1.15, jit(PAL.stone2,0.02));
    base.cyl(0, 0.7, 0, 0.5, 0.38, 0.7, 6, jit(PAL.goldD,0.05));
    const _bp = eng.add(base, POLY.M4.trans(0,0,0), {name:'tbase_'+id});
    R.basePlate = _bp;;
    const lensBody = new POLY.Geo();
    lensBody.cone(0, 1.55, 0, 0.30, 1.0, 6, jit(PAL.goldD,0.05));
    lensBody.torus(0, 1.55, 0, 0.3, 0.06, 10, 4, jit(PAL.gold,0.06));
    const lens = new POLY.Geo();
    lens.sph(0, 1.62, 0.22, 0.16, 4, 6, [0.9,0.72,0.2], [1,0.95,0.7], [0.5,0.34,0.05]);
    const mL = R.part('body', lensBody, 0,0,0, {});
    const mLn = R.part('lens', lens, 0,0,0, {emis:0.4, glow:0.6});
    R.fn = { body: (t,ent,base)=>{
      const v = ent.aim || [0,0.3,1];
      const yaw = Math.atan2(v[0], v[2]);
      return POLY.M4.mul(POLY.M4.trans(base[0],base[1],base[2]),
        POLY.M4.trs(0,0,0, 0, yaw, 0));
    }, lens: (t,ent,base)=>{
      const v = ent.aim || [0,0.3,1];
      const yaw = Math.atan2(v[0], v[2]);
      const ch = ent.charge ?? 0;
      const p = 1 + ch*0.8;
      return POLY.M4.mul(POLY.M4.trans(base[0],base[1],base[2]),
        POLY.M4.mul(POLY.M4.trs(0,0,0,0,yaw,0), POLY.M4.trs(0,0,0,0,0,0,p,p,p)));
    } };
    return R;
  }
  if(id === 'nullfield'){
    // robotic: lattice emitter — rotating gyro
    const base = new POLY.Geo();
    base.box(0,0.3,0, 1.1,0.5,1.1, jit(PAL.stone2,0.02));
    base.cyl(0, 0.66, 0, 0.42, 0.3, 0.42, 6, jit(PAL.chrome3,0.04));
    const _bp = eng.add(base, POLY.M4.trans(0,0,0), {name:'tbase_'+id});
    R.basePlate = _bp;;
    const gyro2 = new POLY.Geo();
    gyro2.torus(0, 1.25, 0, 0.42, 0.06, 12, 4, jit(PAL.chrome,0.05));
    gyro2.torus(0, 1.25, 0, 0.30, 0.05, 10, 4, jit(PAL.chrome2,0.05));
    const core = new POLY.Geo();
    core.sph(0, 1.25, 0, 0.14, 4, 5, [0.4,0.5,0.9], [0.8,0.75,1], [0.1,0.2,0.5]);
    const mG = R.part('gyro', gyro2, 0,0,0, {});
    const mC = R.part('core', core, 0,0,0, {emis:0.4, glow:0.65});
    R.fn = { gyro: (t,ent,base)=> POLY.M4.mul(POLY.M4.trans(base[0],base[1],base[2]),
        POLY.M4.trs(0,0,0,0,0,t*2.2)),
      core: (t,ent,base)=> { const p=1+Math.sin(t*5)*0.2;
        return POLY.M4.trs(base[0],base[1]+Math.sin(t*2.5)*0.06,base[2],0,t*1.3,0,p,p,p); } };
    return R;
  }
  return R;
}

/* ── ENEMIES ────────────────────────────────────────────────────────── */
/* Each enemy: body rig + wave-tagged appendages (legs, wings, tails).
   wave() displacement runs in the vertex shader: real limb motion with
   one draw call per enemy. */
function buildEnemyModel(eng, id){
  const E = { rig:null, radius:0.5, flyY:0, shadow:0.7 };

  if(id==='crawler'){
    // chrome beetle-walker: dome shell + 6 legs + sensor eye
    const g = new POLY.Geo();
    const shell = new POLY.Geo();
    shell.sph(0, 0.42, 0, 0.42, 5, 7, jit(PAL.chrome3,0.04), jit(PAL.chrome,0.05), jit(PAL.chrome3,0.03));
    shell.box(0, 0.44, 0, 0.62, 0.2, 0.62, jit(PAL.chrome,0.05));
    shell.box(0, 0.52, 0, 0.42, 0.12, 0.42, jit(dark(PAL.chrome,0.2),0.03));
    // sensor
    shell.box(0, 0.35, 0.36, 0.18, 0.14, 0.14, jit(PAL.crimsonD,0.06));
    const eye = new POLY.Geo();
    eye.sph(0, 0.38, 0.44, 0.07, 4, 5, [1,0.3,0.25], [1,0.55,0.45], [0.5,0.05,0.05]);
    // six legs: backward-angled, waving
    const legs = new POLY.Geo();
    const legCol = jit(PAL.chrome3,0.05);
    for(let i=0;i<3;i++){
      const sx = i-1;
      legs.box(sx*0.40, 0.18, -0.12+i*0.22, 0.10, 0.44, 0.10, legCol);
      legs.box(sx*0.62, 0.05, -0.12+i*0.22, 0.12, 0.09, 0.12, jit(dark(PAL.chrome3,0.1),0.04));
    }
    const mB = eng.add(shell, undefined, {});
    const mE = eng.add(eye, undefined, {emis:0.9, glow:1.6});
    const mL = eng.add(legs, undefined, {});
    E.rig = { parts:{body:mB, eye:mE, legs:mL}, wave:{legs:[0,1,0,0.10,7.0]}, flyY:0 };
    E.radius = 0.46;
    return E;
  }
  if(id==='sprinter'){
    // sleek blade-runner: wedge body on 4 stilt legs
    const body = new POLY.Geo();
    body.box(0, 0.52, 0, 0.5, 0.3, 1.0, jit(PAL.chrome2,0.05));
    body.box(0, 0.62, 0.30, 0.34, 0.14, 0.6, jit(PAL.chrome3,0.04));
    body.box(0, 0.62, 1.02, 0.3, 0.1, 0.5, jit(PAL.magD,0.05));
    body.box(0, 0.5, -0.5, 0.4, 0.2, 0.3, jit(PAL.crimsonD,0.05));
    const legs = new POLY.Geo();
    for(let i=0;i<4;i++){
      const sx=i<2?-1:1, sz=i%2?-0.35:0.35;
      legs.box(sx*0.24, 0.24, sz, 0.07, 0.5, 0.07, jit(PAL.chrome3,0.05));
      legs.box(sx*0.24, 0.02, sz+0.05, 0.1, 0.06, 0.16, jit(dark(PAL.chrome3,0.12),0.04));
    }
    const eye = new POLY.Geo();
    eye.sph(0, 0.66, 0.66, 0.06, 4, 4, [1,0.2,0.1]);
    const mB = eng.add(body, undefined, {});
    const mE = eng.add(eye, undefined, {emis:0.9, glow:1.6});
    const mL = eng.add(legs, undefined, {});
    E.rig = { parts:{body:mB, eye:mE, legs:mL}, wave:{legs:[0.5,1,0, 0.14, 11.0]} };
    E.radius = 0.4;
    return E;
  }
  if(id==='mite'){
    // tiny ball of spikes
    const body = new POLY.Geo();
    body.sph(0, 0.22, 0, 0.19, 4, 5, jit(PAL.violet2,0.07), jit(PAL.violet,0.08), dark(PAL.violet2,0.3));
    const spikes = new POLY.Geo();
    for(let i=0;i<6;i++){
      const a=i/6*Math.PI*2;
      spikes.cone(Math.cos(a)*0.2, 0.22, Math.sin(a)*0.2, 0.05, 0.18, 3, dark(PAL.violet2,0.15));
    }
    const mB = eng.add(body, undefined, {});
    const mS = eng.add(spikes, undefined, {});
    E.rig = { parts:{body:mB, spikes:mS}, wave:{body:[0,1,0,0.05,14], spikes:[0,1,0,0.05,14]} };
    E.radius = 0.26;
    return E;
  }
  if(id==='bulwark'){
    // heavy hexagonal tank: armored carapace, 6 tread pods
    const body = new POLY.Geo();
    body.box(0, 0.5, 0, 0.9, 0.55, 1.1, jit(PAL.chrome3,0.05));
    body.box(0, 0.85, 0, 0.7, 0.25, 0.9, jit(PAL.chrome2,0.05));
    body.box(0, 0.62, 0.45, 0.8, 0.3, 0.3, jit(PAL.chrome,0.05));
    // spiked nose
    body.cone(0, 0.55, 0.78, 0.2, 0.42, 4, jit(PAL.chrome2,0.05));
    const pods = new POLY.Geo();
    const podCol = jit(PAL.chrome3,0.05);
    for(let i=0;i<3;i++){
      const sx=i-1, sz=-0.35+i*0.35;
      for(const sx2 of [-1,1]) {
        pods.box(sx2*0.62, 0.18, sz, 0.22, 0.4, 0.22, podCol);
      }
    }
    const light2 = new POLY.Geo();
    light2.sph(-0.18, 1.0, 0.5, 0.05, 4, 4, [1,0.62,0.2]); light2.sph(0.18, 1.0, 0.5, 0.05, 4, 4, [1,0.62,0.2]);
    const mB = eng.add(body, undefined, {});
    const mP = eng.add(pods, undefined, {});
    const mL = eng.add(light2, undefined, {emis:0.35, glow:0.5});
    E.rig = { parts:{body:mB, pods:mP, light:mL}, wave:{pods:[0,1,0,0.05,5.5]} };
    E.radius = 0.62;
    return E;
  }
  if(id==='wisp'){
    // spectral flame orb: hovers; ring halo; tail waves
    const body = new POLY.Geo();
    body.sph(0, 0, 0, 0.3, 5, 7, jit(PAL.cyanD,0.08), jit(PAL.cyan,0.12), dark(PAL.cyanD,0.15));
    const tail = new POLY.Geo();
    tail.cone(0, -0.42, -0.34, 0.16, 0.6, 5, jit(PAL.cyanD,0.06));
    const halo = new POLY.Geo();
    halo.torus(0, 0, 0, 0.42, 0.045, 14, 3, jit(PAL.cyan,0.09));
    const mB = eng.add(body, undefined, {emis:0.7, glow:1.6});
    const mT = eng.add(tail, undefined, {});
    const mH = eng.add(halo, undefined, {emis:0.25, glow:0.45});
    E.rig = { parts:{body:mB, tail:mT, halo:mH}, wave:{tail:[0,0.4,-1, 0.09, 5.0]},
      haloSpin:true };
    E.radius = 0.36;
    E.flyY = 0.55;
    return E;
  }
  if(id==='vector'){
    // federation votary: gold humanoid blade-saint. Legs & arms wave.
    const body = new POLY.Geo();
    // torso
    body.box(0, 0.95, 0, 0.5, 0.55, 0.34, jit(PAL.gold,0.07));
    body.box(0, 1.28, 0, 0.62, 0.16, 0.4, jit(PAL.goldD,0.06));
    // head with halo
    body.sph(0, 1.55, 0, 0.15, 4, 6, jit(PAL.gold,0.07), light(PAL.gold,0.35), dark(PAL.goldD,0.2));
    // shield of light (flat)
    body.box(0.0, 0.95, -0.3, 0.8, 0.8, 0.06, jit(PAL.goldD,0.05));
    body.box(0.0, 0.42, 0, 0.4, 0.5, 0.28, jit(PAL.goldD,0.06));
    const limbs = new POLY.Geo();
    for(const sx of [-1,1]){
      // legs
      limbs.box(sx*0.13, 0.42, 0.04, 0.12, 0.5, 0.12, jit(PAL.gold,0.07));
      limbs.box(sx*0.13, 0.05, 0.14, 0.14, 0.08, 0.24, jit(dark(PAL.goldD,0.12),0.04));
      // arms (one giant blade)
      limbs.box(sx*0.36, 1.05, 0.02, 0.10, 0.5, 0.10, jit(PAL.gold,0.07));
    }
    const blade = new POLY.Geo();
    blade.cone(0.36, 1.35, 0.05, 0.06, 0.6, 4, light(PAL.gold,0.2));
    const halo = new POLY.Geo();
    halo.torus(0, 1.75, 0, 0.26, 0.035, 12, 3, jit(PAL.gold,0.08));
    const mB = eng.add(body, undefined, {});
    const mL = eng.add(limbs, undefined, {});
    const mBl = eng.add(blade, undefined, {emis:0.4, glow:0.8});
    const mH = eng.add(halo, undefined, {emis:0.7, glow:1.4});
    E.rig = { parts:{body:mB, limbs:mL, blade:mBl, halo:mH},
      wave:{limbs:[0,1,0,0.11,9.0], blade:[0,1,0,0.08,9.0]} };
    E.radius = 0.42;
    return E;
  }
  if(id==='harbinger'){
    // pirate warchief: heavy brute with two scoop blades. Boss-tier mini.
    const body = new POLY.Geo();
    body.box(0, 1.0, 0, 0.85, 0.9, 0.7, jit(PAL.crimsonD,0.05));
    body.box(0, 1.55, 0, 0.6, 0.4, 0.5, jit(PAL.rust,0.05));
    body.box(0, 1.85, 0.1, 0.5, 0.24, 0.42, jit(PAL.crimson,0.06));
    // spiked shoulder
    body.cone(-0.5, 1.7, 0, 0.14, 0.5, 4, jit(PAL.rustD,0.05));
    body.cone(0.5, 1.7, 0, 0.14, 0.5, 4, jit(PAL.rustD,0.05));
    const legs = new POLY.Geo();
    for(const sx of [-1,1]){
      legs.box(sx*0.26, 0.5, 0.0, 0.26, 0.6, 0.3, jit(PAL.chrome3,0.05));
      legs.box(sx*0.26, 0.08, 0.1, 0.3, 0.12, 0.5, jit(dark(PAL.crimsonD,0.1),0.04));
    }
    const arms = new POLY.Geo();
    for(const sx of [-1,1]){
      arms.box(sx*0.62, 1.3, 0.1, 0.2, 0.6, 0.2, jit(PAL.rustD,0.05));
      arms.box(sx*0.62, 1.55, 0.35, 0.16, 0.5, 0.4, jit(PAL.rust,0.05));
    }
    const eye = new POLY.Geo();
    eye.box(0, 1.9, 0.36, 0.34, 0.1, 0.04, [1,0.85,0.3], [1,0.85,0.3]);
    const mB = eng.add(body, undefined, {});
    const mL = eng.add(legs, undefined, {});
    const mA = eng.add(arms, undefined, {});
    const mE = eng.add(eye, undefined, {emis:0.4, glow:0.6});
    E.rig = { parts:{body:mB, legs:mL, arms:mA, eye:mE},
      wave:{legs:[0,1,0,0.07,4.6]} };
    E.radius = 0.7;
    E.boss = true;
    return E;
  }
  if(id==='spawnling'){
    // tiny xeno gnawling: waddling maw
    const body = new POLY.Geo();
    body.sph(0, 0.3, 0, 0.24, 4, 6, jit(PAL.violet2,0.08), jit(PAL.violet,0.08), dark(PAL.violet2,0.25));
    // maw
    body.box(0, 0.26, 0.24, 0.28, 0.14, 0.14, dark(PAL.violet2,0.1));
    body.box(0, 0.20, 0.30, 0.22, 0.05, 0.08, [0.9,0.4,1], [0.9,0.4,1]);
    const legs = new POLY.Geo();
    for(const sx of [-1,1]){
      legs.box(sx*0.14, 0.16, 0.02, 0.07, 0.28, 0.07, jit(PAL.violet2,0.06));
      legs.box(sx*0.14, 0.03, 0.1, 0.1, 0.05, 0.16, dark(PAL.violet2,0.1));
    }
    const mB = eng.add(body, undefined, {});
    const mL = eng.add(legs, undefined, {});
    E.rig = { parts:{body:mB, legs:mL}, wave:{legs:[0,1,0,0.12,12.0]} };
    E.radius = 0.3;
    return E;
  }
  if(id==='juggernaut'){
    // final boss: colossal armored walker on 4 tower-legs with a crown
    const body = new POLY.Geo();
    body.box(0, 2.6, 0, 2.2, 1.5, 2.0, jit(PAL.void2,0.02));
    body.box(0, 3.5, 0, 1.7, 0.5, 1.6, jit(PAL.chrome3,0.04));
    body.box(0, 3.9, 0, 1.0, 0.4, 1.1, jit(PAL.chrome2,0.05));
    // crown spokes
    for(let i=0;i<6;i++){
      const a=i/6*Math.PI*2;
      body.box(Math.cos(a)*0.8, 4.35, Math.sin(a)*0.8, 0.22, 0.6, 0.22, jit(PAL.chrome2,0.05));
    }
    // face grille
    body.box(0, 3.35, 0.86, 0.9, 0.24, 0.06, [0.2,0.35,0.5]);
    const core = new POLY.Geo();
    core.sph(0, 3.3, 0.75, 0.22, 5, 6, [0.25,0.9,0.5], [0.6,1,0.8], [0.03,0.3,0.15]);
    const legs = new POLY.Geo();
    for(const sx of [-1,1]) for(const sz of [-1,1]){
      legs.box(sx*1.1, 1.75, sz*0.9, 0.4, 2.0, 0.4, jit(PAL.chrome3,0.05));
      legs.box(sx*1.1, 0.75, sz*0.9, 0.3, 1.2, 0.3, jit(PAL.chrome2,0.05));
      legs.box(sx*1.1, 0.12, sz*0.9 + 0.3, 0.4, 0.2, 0.8, jit(dark(PAL.chrome3,0.1),0.04));
    }
    const guns = new POLY.Geo();
    for(const sx of [-1,1]){
      guns.box(sx*0.8, 2.6, 1.15, 0.24, 0.24, 0.9, jit(PAL.chrome2,0.05));
    }
    const mB = eng.add(body, undefined, {});
    const mC = eng.add(core, undefined, {emis:0.4, glow:0.65});
    const mL = eng.add(legs, undefined, {});
    const mG = eng.add(guns, undefined, {});
    E.rig = { parts:{body:mB, core:mC, legs:mL, guns:mG},
      wave:{legs:[0,1,0,0.05,4.2]} };
    E.radius = 1.5;
    E.boss = true;
    return E;
  }
  return E;
}

POLY.PAL = PAL;
POLY.Rig = Rig;
POLY.buildBoard = buildBoard;
POLY.makeTowerRig = makeTowerRig;
POLY.buildEnemyModel = buildEnemyModel;
POLY.buildCore = buildCore;
})();
