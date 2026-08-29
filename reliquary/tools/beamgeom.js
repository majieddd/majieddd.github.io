/* RELIQUARY :: tools/beamgeom
   Proves that a beam mesh, pushed through the beam transform, actually spans
   from its source to its target.

   WHY THIS EXISTS. The PRISM beam did not reach its target, and the reason was
   an axis mismatch that is invisible in either file on its own: the beam mesh
   is built with prism(), which extrudes along +Y, while drawBeam() builds a
   matrix whose THIRD column carries the beam direction, so the mesh's long
   axis was mapped to the perpendicular and its cross-section radius was mapped
   to the length. The visible result was a stub centred on the muzzle,
   extending half its length backward THROUGH the tower and stopping halfway to
   the target.

   Neither file is wrong by itself. The contract between them is what broke, so
   the contract is what gets the test: take the actual mesh vertices, push them
   through the actual transform, and assert the resulting bounds.

   Run: node tools/beamgeom.js      (exit 1 on failure) */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, JSON, window: undefined, document: undefined };
vm.createContext(ctx);
for (const f of ['js/00-util.js', 'js/02-mesh.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const U = ctx.U, MESH = ctx.MESH;

/* The beam mesh, built exactly as MODELS.beam builds it. Kept in sync by
   asserting below that the model file still uses this primitive. */
function buildBeamMesh() {
  const b = MESH.builder('beam:test');
  b.color('#ffffff').tooth(0).emissive(1.0);
  b.limb([0, 0, 0], [0, 0, 1], 0.5, 0.5, 4);
  return b.build({ jitter: 0 });
}

/* The transform, copied from GAME.drawBeam. Copied rather than imported
   because that function needs a GL context; the arithmetic is what matters. */
function beamMatrix(a, bPt, width) {
  const V = U.V;
  const d = V.sub(bPt, a);
  const len = V.len(d);
  const fwd = V.scale(d, 1 / len);
  const up = Math.abs(fwd[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const right = V.norm(V.cross(up, fwd));
  const realUp = V.cross(fwd, right);
  const m = new Float32Array(16);
  m[0] = right[0] * width; m[1] = right[1] * width; m[2] = right[2] * width; m[3] = 0;
  m[4] = realUp[0] * width; m[5] = realUp[1] * width; m[6] = realUp[2] * width; m[7] = 0;
  m[8] = fwd[0] * len; m[9] = fwd[1] * len; m[10] = fwd[2] * len; m[11] = 0;
  m[12] = a[0]; m[13] = a[1]; m[14] = a[2]; m[15] = 1;
  return m;
}

let fail = 0;
function ok(name, pass, detail) {
  console.log('  ' + (pass ? 'ok  ' : 'FAIL') + ' ' + name + (detail ? '  [' + detail + ']' : ''));
  if (!pass) fail++;
}

console.log('beam geometry');

const data = buildBeamMesh();
const cases = [
  { name: 'horizontal', a: [0, 3, 0], b: [20, 3, 0] },
  { name: 'diagonal', a: [-5, 2, -5], b: [10, 6, 12] },
  { name: 'straight down', a: [0, 12, 0], b: [0, 0.5, 0] },
  { name: 'straight up', a: [0, 1, 0], b: [0, 14, 0] },
  { name: 'short', a: [2, 2, 2], b: [3.2, 2.4, 2] }
];

for (const c of cases) {
  const m = beamMatrix(c.a, c.b, 0.3);
  /* Push every vertex through the transform and find how close the mesh gets
     to each endpoint, and how far it overshoots behind the source. */
  let nearSrc = Infinity, nearTgt = Infinity, behind = 0;
  const V = U.V;
  const dir = V.norm(V.sub(c.b, c.a));
  const total = V.dist(c.a, c.b);
  for (let i = 0; i < data.verts.length; i += 12) {
    const p = U.m4xform(m, [data.verts[i], data.verts[i + 1], data.verts[i + 2]]);
    nearSrc = Math.min(nearSrc, V.dist(p, c.a));
    nearTgt = Math.min(nearTgt, V.dist(p, c.b));
    /* Signed distance along the beam axis: negative means behind the muzzle. */
    const along = V.dot(V.sub(p, c.a), dir);
    if (along < behind) behind = along;
  }
  ok(c.name + ': reaches the target', nearTgt < 0.6,
    'closest vertex is ' + nearTgt.toFixed(2) + ' from target (beam is ' + total.toFixed(1) + ' long)');
  ok(c.name + ': starts at the source', nearSrc < 0.6, nearSrc.toFixed(2));
  ok(c.name + ': does not extend behind the muzzle', behind > -0.6, behind.toFixed(2));
}

/* The mesh in the shipping model file must be the one this test models. If
   MODELS.beam goes back to prism(), the axis mismatch returns and this test
   would otherwise keep passing against a mesh the game does not use. */
const modelsSrc = fs.readFileSync(path.join(__dirname, '..', 'js', '09-models.js'), 'utf8');
const beamFn = modelsSrc.slice(modelsSrc.indexOf('function beam('),
  modelsSrc.indexOf('function dome('));
ok('MODELS.beam builds along +Z with limb()',
  /limb\(\s*\[0,\s*0,\s*0\]\s*,\s*\[0,\s*0,\s*1\]/.test(beamFn),
  /* Match an actual CALL, not the word. The comment beside the fix explains
     the defect and therefore contains the name of the primitive that caused
     it, so a bare substring search reports its own documentation. */
  /b\.prism\(/.test(beamFn) ? 'still CALLS b.prism(), which extrudes along +Y' : '');

console.log(fail ? fail + ' failed' : 'all beam geometry checks passed');
process.exit(fail ? 1 : 0);
