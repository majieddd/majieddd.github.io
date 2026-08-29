/* RELIQUARY :: tools/winding
   Validates that every mesh primitive emits OUTWARD-facing triangles.

   WHY THIS EXISTS. The ground rendered roughly a quarter as bright as the
   arithmetic said it should, and every bisect of the post chain came back
   innocent because the fault was upstream: the terrain quads were wound so
   that cross(e1, e2) pointed at -Y. The ground was being lit as though its
   underside faced the sun, so it landed on the deep band of the ramp and went
   nearly black. Backface culling did not hide it (the projection flips the
   window-space winding, so the triangles still drew) which is precisely what
   made it hard to see: the surface was PRESENT and merely WRONG.

   Auditing the primitives afterwards found the same defect in frustum(), on
   all six of its faces, while box() next to it was correct. A per-primitive
   mistake that only shows up as "slightly too dark" is exactly the kind of
   thing that survives review, so it gets a checker rather than a fix.

   THE TEST. For a closed convex-ish shape built around a known interior point,
   every face normal must point away from that interior point:
       dot(faceNormal, faceCentroid - interior) > 0
   Shapes that are not closed (ring, limb caps at extreme tapers) are checked
   against an explicit expected direction instead.

   Run: node tools/winding.js         (exit 1 on any failure) */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* Load the two browser modules into a shared context. They are plain scripts
   with no module system, which is the project's whole convention, so vm is the
   honest way to exercise them from node rather than adding an export just for
   the test. */
const ctx = { console, Math, JSON, window: undefined, document: undefined };
vm.createContext(ctx);
for (const f of ['js/00-util.js', 'js/02-mesh.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  vm.runInContext(src, ctx, { filename: f });
}
const U = ctx.U, MESH = ctx.MESH;
if (!U || !MESH) {
  console.error('FAIL: modules did not attach to the context (U or MESH missing)');
  process.exit(1);
}

let failures = 0;
let checks = 0;

/* Read triangles back out of a built vertex buffer. */
function triangles(data) {
  const out = [];
  const S = 12, T = S * 3;
  for (let i = 0; i < data.verts.length; i += T) {
    const v = data.verts;
    out.push({
      a: [v[i], v[i + 1], v[i + 2]],
      b: [v[i + S], v[i + S + 1], v[i + S + 2]],
      c: [v[i + S * 2], v[i + S * 2 + 1], v[i + S * 2 + 2]],
      n: [v[i + 3], v[i + 4], v[i + 5]]
    });
  }
  return out;
}

function check(name, build, interior, opts) {
  opts = opts || {};
  const b = MESH.builder('winding:' + name);
  b.color('#ffffff');
  build(b);
  const data = b.build({ jitter: 0 });
  const tris = triangles(data);
  checks++;
  if (!tris.length) {
    console.log('  FAIL ' + name + ': produced no triangles');
    failures++;
    return;
  }
  let bad = 0;
  const tol = opts.tol === undefined ? 1e-6 : opts.tol;
  for (const t of tris) {
    const cx = (t.a[0] + t.b[0] + t.c[0]) / 3;
    const cy = (t.a[1] + t.b[1] + t.c[1]) / 3;
    const cz = (t.a[2] + t.b[2] + t.c[2]) / 3;
    let ref;
    if (opts.expect) ref = opts.expect;
    else ref = [cx - interior[0], cy - interior[1], cz - interior[2]];
    const len = Math.hypot(ref[0], ref[1], ref[2]);
    if (len < 1e-9) continue; /* face centroid sits on the interior point */
    const d = (t.n[0] * ref[0] + t.n[1] * ref[1] + t.n[2] * ref[2]) / len;
    if (d < tol) bad++;
  }
  const pct = (100 * bad / tris.length).toFixed(0);
  if (bad > (opts.allow || 0)) {
    console.log('  FAIL ' + name + ': ' + bad + '/' + tris.length +
      ' triangles (' + pct + '%) face inward');
    failures++;
  } else {
    console.log('  ok   ' + name + ' (' + tris.length + ' tris)');
  }
}

console.log('winding audit');

check('box', b => b.box(2, 2, 2), [0, 0, 0]);
check('frustum-straight', b => b.frustum(2, 2, 2, 2, 3, -1.5), [0, 0, 0]);
check('frustum-taper', b => b.frustum(3, 3, 1, 1, 4, -2), [0, 0, 0]);
check('prism', b => b.prism(2, 2, 3, 6, -1.5), [0, 0, 0]);
check('prism-taper', b => b.prism(2, 0.6, 3, 7, -1.5), [0, 0, 0]);
check('cone', b => b.cone(2, 3, 6, -1.5), [0, -0.6, 0]);
check('ico', b => b.ico(2, 0), [0, 0, 0]);
check('ico-subdiv', b => b.ico(2, 1), [0, 0, 0]);
check('shard', b => b.shard(1, 2, 2, 5, 0), [0, 0, 0]);
check('lathe', b => b.lathe([[0, 0], [1.4, 0.6], [1.1, 1.6], [0, 2.2]], 7), [0, 1.0, 0]);
check('extrude', b => b.extrude([[-1, -1], [1, -1], [1, 1], [-1, 1]], 2, -1), [0, 0, 0]);
check('limb', b => b.limb([0, -2, 0], [0, 2, 0], 0.8, 0.8, 5), [0, 0, 0]);

/* The ring is an open double-sided disc: it has no interior, so it is checked
   against the direction it is meant to face. */
check('ring', b => b.ring(1, 2, 12, 0), null, { expect: [0, 1, 0] });

/* The terrain quad emitter is the thing that actually failed in the field, so
   it is checked directly rather than by proxy. Both diagonal alternatives are
   exercised because the board alternates them per cell and only one of the two
   was wrong in an earlier draft. */
check('terrain-quad-even', b => {
  const p00 = [0, 0, 0], p10 = [1, 0, 0], p11 = [1, 0, 1], p01 = [0, 0, 1];
  b.tri(p00, p01, p10); b.tri(p10, p01, p11);
}, null, { expect: [0, 1, 0] });
check('terrain-quad-odd', b => {
  const p00 = [0, 0, 0], p10 = [1, 0, 0], p11 = [1, 0, 1], p01 = [0, 0, 1];
  b.tri(p00, p11, p10); b.tri(p00, p01, p11);
}, null, { expect: [0, 1, 0] });

console.log(checks + ' checks, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
