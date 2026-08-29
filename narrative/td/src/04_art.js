// ===== art.js : procedural low-poly meshes (THREE global). Painterly flat shading. =====
// All geometry is built from primitives and given flat normals so facets read as brushwork.

const PALETTE = {
  void: 0x0a0e17, chrome: 0x94a3b8, chromeDark: 0x1e293b,
  magenta: 0xff2fd6, cyan: 0x38e8ff, gold: 0xfbbf24, violet: 0x7c3aed, crimson: 0xef4444,
};

function flatMat(color, opts) {
  opts = opts || {};
  return new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: opts.rough != null ? opts.rough : 0.62,
    metalness: opts.metal != null ? opts.metal : 0.35,
    emissive: opts.emissive != null ? opts.emissive : 0x000000,
    emissiveIntensity: opts.ei != null ? opts.ei : 1.0,
  });
}
function emissiveMat(color, intensity) {
  return new THREE.MeshStandardMaterial({ color: 0x05080e, flatShading: true, roughness: 0.5, metalness: 0.2, emissive: color, emissiveIntensity: intensity != null ? intensity : 1.4 });
}

// --- TOWER FACTORIES ----------------------------------------------------------
function buildTowerMesh(type) {
  const def = TOWERS[type];
  const root = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.26, 6), flatMat(0x16202f, { metal: 0.6, rough: 0.5 }));
  base.position.y = 0.13; root.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 6, 12), emissiveMat(def.color, 1.2));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.26; root.add(ring);

  const head = new THREE.Group(); head.position.y = 0.26; root.add(head);
  const towerColor = def.color;

  if (type === 'cannon') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.5, 6), flatMat(0x2a3a52, { metal: 0.7 }));
    body.position.y = 0.25; head.add(body);
    const barrel = new THREE.Group(); barrel.position.y = 0.5; head.add(barrel);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.7), flatMat(0x37506f, { metal: 0.8 }));
    b.position.z = 0.32; barrel.add(b);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.16, 6), emissiveMat(towerColor, 1.6));
    tip.rotation.x = Math.PI / 2; tip.position.z = 0.7; barrel.add(tip);
    head.userData.barrel = barrel;
  } else if (type === 'tesla') {
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.6, 6), flatMat(0x33485f, { metal: 0.8 }));
    coil.position.y = 0.3; head.add(coil);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), emissiveMat(towerColor, 2.0));
    orb.position.y = 0.66; head.add(orb);
    const spikes = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.3, 6, 1, true), emissiveMat(towerColor, 1.0));
    spikes.position.y = 0.55; head.add(spikes);
    head.userData.orb = orb;
  } else if (type === 'frost') {
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), flatMat(0x2c4a5e, { metal: 0.5 }));
    body.position.y = 0.32; head.add(body);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), emissiveMat(towerColor, 2.2));
    core.position.y = 0.32; head.add(core);
    head.userData.core = core;
  } else if (type === 'flak') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.4, 6), flatMat(0x2e4258, { metal: 0.75 }));
    body.position.y = 0.2; head.add(body);
    const left = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 5), flatMat(0x46627e, { metal: 0.8 }));
    left.rotation.z = 0.5; left.position.set(-0.16, 0.5, 0); head.add(left);
    const right = left.clone(); right.rotation.z = -0.5; right.position.x = 0.16; head.add(right);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), emissiveMat(towerColor, 1.4));
    muzzle.position.y = 0.62; head.add(muzzle);
    head.userData.muzzle = muzzle;
  } else if (type === 'lance') {
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.34, 6), flatMat(0x2a3c54, { metal: 0.7 }));
    pedestal.position.y = 0.17; head.add(pedestal);
    const arm = new THREE.Group(); arm.position.y = 0.34; head.add(arm);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.95), flatMat(0x3a5470, { metal: 0.85 }));
    beam.position.z = 0.45; arm.add(beam);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.2, 6), emissiveMat(towerColor, 2.4));
    lens.rotation.x = Math.PI / 2; lens.position.z = 0.95; arm.add(lens);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 6), emissiveMat(towerColor, 1.2));
    crown.position.y = 0.5; arm.add(crown);
    head.userData.arm = arm;
  }
  root.userData.head = head;
  return root;
}

// --- ENEMY FACTORIES ----------------------------------------------------------
function buildEnemyMesh(shape, color) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const mat = flatMat(color, { metal: 0.5, rough: 0.55 });
  const dark = flatMat(0x141019, { metal: 0.4, rough: 0.7 });
  const glow = emissiveMat(color, 1.6);

  if (shape === 'probe') {
    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.5, 6), mat); hull.rotation.x = Math.PI / 2; hull.position.z = -0.05; body.add(hull);
    const pod = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), flatMat(0x3a3f4a, { metal: 0.7 })); pod.position.z = 0.18; body.add(pod);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), glow); eye.position.z = 0.34; body.add(eye);
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.18), dark); w1.position.set(0.32, 0, 0.1); body.add(w1);
    const w2 = w1.clone(); w2.position.x = -0.32; body.add(w2);
    root.userData.wings = [w1, w2];
  } else if (shape === 'crawler') {
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.32, 3, 6), mat); torso.rotation.z = Math.PI / 2; body.add(torso);
    const headM = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), dark); headM.position.set(0.34, 0.06, 0); body.add(headM);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), glow); eye.position.set(0.5, 0.08, 0); body.add(eye);
    const legs = [];
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.32, 0.07), dark);
      const side = i < 2 ? 1 : -1; leg.position.set(0.18 - i * 0.14, -0.3, side * 0.22); body.add(leg); legs.push(leg);
    }
    root.userData.legs = legs;
  } else if (shape === 'flier') {
    const hull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 7, 6), mat); hull.scale.set(1.3, 0.6, 1.0); body.add(hull);
    const cockpit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), dark); cockpit.position.y = 0.12; body.add(cockpit);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.3), flatMat(0x2a2f3a, { metal: 0.7 })); wing.position.y = 0.02; body.add(wing);
    const trail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), glow); trail.rotation.x = -Math.PI / 2; trail.position.z = -0.4; body.add(trail);
    root.userData.wing = wing;
  } else if (shape === 'brood') {
    const blob = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), mat); body.add(blob);
    const sac = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), glow); sac.position.set(0.3, 0.2, 0.2); body.add(sac);
    const legs = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2; const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), dark);
      leg.position.set(Math.cos(a) * 0.5, -0.4, Math.sin(a) * 0.5); leg.rotation.z = Math.cos(a) * 0.4; leg.rotation.x = Math.sin(a) * 0.4; body.add(leg); legs.push(leg);
    }
    root.userData.legs = legs; root.userData.blob = blob;
  } else if (shape === 'wraith') {
    const cloth = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x1a1230, flatShading: true, transparent: true, opacity: 0.7, emissive: color, emissiveIntensity: 0.7, roughness: 0.8, metalness: 0 }));
    cloth.position.y = 0.1; body.add(cloth);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), glow); eye.position.y = 0.3; body.add(eye);
    root.userData.cloth = cloth;
  } else if (shape === 'devourer') {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 0), mat); body.add(core);
    const maw = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.22, 6, 10), glow); maw.position.set(0.7, 0.1, 0); body.add(maw);
    const spikes = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2; const s = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), dark);
      s.position.set(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0); s.rotation.z = a - Math.PI / 2; body.add(s); spikes.push(s);
    }
    root.userData.spikes = spikes; root.userData.core = core;
  }
  root.userData.body = body;
  return root;
}

// --- CORE (player base) -------------------------------------------------------
function buildCore() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 8, 24), emissiveMat(PALETTE.cyan, 1.4));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; g.add(ring);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), emissiveMat(PALETTE.cyan, 1.8));
  crystal.position.y = 0.6; g.add(crystal);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.4, 8), flatMat(0x14202f, { metal: 0.6 }));
  base.position.y = 0.2; g.add(base);
  g.userData.crystal = crystal; g.userData.ring = ring;
  return g;
}

// --- decorative asteroid ------------------------------------------------------
function buildRock(seed) {
  const rng = makeRNG(seed);
  const geo = new THREE.IcosahedronGeometry(rng.range(0.5, 1.2), 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const f = 1 + rng.range(-0.25, 0.25);
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, flatMat(0x223047, { metal: 0.3, rough: 0.85 }));
}
